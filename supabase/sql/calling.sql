-- Friends-only calling feature (P2P WebRTC) for Supabase/Postgres.
-- Schema: ordn
--
-- This file is intended to be run in the Supabase SQL editor.
-- It creates:
-- - Enums: ordn.call_status, ordn.call_signal_type
-- - Tables: ordn.calls, ordn.call_signals
-- - Helper: ordn.are_friends(a uuid, b uuid)
-- - Triggers: updated_at + call state transition enforcement
-- - RLS policies to enforce friends-only calls and participant-only signaling

begin;

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- Ensure schema exists (your project already uses `ordn`, this is a safety net).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'ordn') then
    create schema ordn;
  end if;
end
$$;

-- Enums (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ordn' and t.typname = 'call_status'
  ) then
    create type ordn.call_status as enum (
      'ringing',
      'accepted',
      'declined',
      'missed',
      'ended',
      'cancelled'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ordn' and t.typname = 'call_signal_type'
  ) then
    create type ordn.call_signal_type as enum (
      'offer',
      'answer',
      'ice',
      'renegotiate',
      'hangup',
      'control'
    );
  end if;
end
$$;

-- Helper to check accepted friendship in either direction.
create or replace function ordn.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from ordn.friends f
    where f.status = 'accepted'
      and (
        (f.user_id = a and f.friend_id = b)
        or
        (f.user_id = b and f.friend_id = a)
      )
  );
$$;

-- updated_at trigger helper
create or replace function ordn.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Call state machine enforcement.
-- RLS ensures only participants can update; this trigger ensures only valid transitions.
create or replace function ordn.enforce_call_state_machine()
returns trigger
language plpgsql
as $$
declare
  actor uuid;
begin
  actor := auth.uid();

  if new.caller_id = new.callee_id then
    raise exception 'caller_id and callee_id must differ';
  end if;

  -- Insert: ensure we start in ringing.
  if tg_op = 'INSERT' then
    if new.status is distinct from 'ringing'::ordn.call_status then
      raise exception 'new calls must start as ringing';
    end if;
    return new;
  end if;

  -- Update: enforce transitions when status changes.
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if actor is null then
      raise exception 'auth.uid() is required for call updates';
    end if;

    -- ringing -> accepted/declined (callee only)
    if old.status = 'ringing'::ordn.call_status and new.status = 'accepted'::ordn.call_status then
      if actor <> old.callee_id then
        raise exception 'only callee can accept a call';
      end if;
      new.accepted_at := coalesce(new.accepted_at, now());
    elsif old.status = 'ringing'::ordn.call_status and new.status = 'declined'::ordn.call_status then
      if actor <> old.callee_id then
        raise exception 'only callee can decline a call';
      end if;
      new.ended_at := coalesce(new.ended_at, now());
    elsif old.status = 'ringing'::ordn.call_status and new.status = 'cancelled'::ordn.call_status then
      if actor <> old.caller_id then
        raise exception 'only caller can cancel a ringing call';
      end if;
      new.ended_at := coalesce(new.ended_at, now());
    -- accepted -> ended (either participant)
    elsif old.status = 'accepted'::ordn.call_status and new.status = 'ended'::ordn.call_status then
      if actor <> old.caller_id and actor <> old.callee_id then
        raise exception 'only participants can end a call';
      end if;
      new.ended_at := coalesce(new.ended_at, now());
    -- ringing -> missed (either participant; typically set by client timeout/housekeeping)
    elsif old.status = 'ringing'::ordn.call_status and new.status = 'missed'::ordn.call_status then
      if actor <> old.caller_id and actor <> old.callee_id then
        raise exception 'only participants can mark call missed';
      end if;
      new.ended_at := coalesce(new.ended_at, now());
    else
      raise exception 'invalid call status transition: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

-- Calls table
create table if not exists ordn.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references ordn.profiles(id) on delete cascade,
  callee_id uuid not null references ordn.profiles(id) on delete cascade,
  status ordn.call_status not null default 'ringing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz null,
  ended_at timestamptz null,
  end_reason text null,
  client_version text null,
  constraint calls_caller_callee_different check (caller_id <> callee_id)
);

-- Call signals table (append-only)
create table if not exists ordn.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references ordn.calls(id) on delete cascade,
  sender_id uuid not null references ordn.profiles(id) on delete cascade,
  recipient_id uuid null references ordn.profiles(id) on delete cascade,
  type ordn.call_signal_type not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists calls_callee_status_created_at_idx
  on ordn.calls (callee_id, status, created_at desc);

create index if not exists calls_caller_created_at_idx
  on ordn.calls (caller_id, created_at desc);

create index if not exists call_signals_call_created_at_idx
  on ordn.call_signals (call_id, created_at asc);

create index if not exists call_signals_recipient_created_at_idx
  on ordn.call_signals (recipient_id, created_at desc);

-- Optional: prevent multiple simultaneous calls between the same pair.
-- (Allows one active call per pair while ringing/accepted.)
create unique index if not exists calls_unique_active_pair_idx
  on ordn.calls (least(caller_id, callee_id), greatest(caller_id, callee_id))
  where status in ('ringing'::ordn.call_status, 'accepted'::ordn.call_status);

-- Triggers
drop trigger if exists calls_set_updated_at on ordn.calls;
create trigger calls_set_updated_at
before update on ordn.calls
for each row execute function ordn.set_updated_at();

drop trigger if exists calls_enforce_state_machine on ordn.calls;
create trigger calls_enforce_state_machine
before insert or update on ordn.calls
for each row execute function ordn.enforce_call_state_machine();

-- RLS
alter table ordn.calls enable row level security;
alter table ordn.call_signals enable row level security;

-- Calls: participants can read
drop policy if exists calls_select_participants on ordn.calls;
create policy calls_select_participants
on ordn.calls
for select
using (auth.uid() = caller_id or auth.uid() = callee_id);

-- Calls: only caller can create, only for accepted friends
drop policy if exists calls_insert_friends_only on ordn.calls;
create policy calls_insert_friends_only
on ordn.calls
for insert
with check (
  auth.uid() = caller_id
  and ordn.are_friends(caller_id, callee_id)
  and caller_id <> callee_id
);

-- Calls: participants can update (state transitions enforced by trigger)
drop policy if exists calls_update_participants on ordn.calls;
create policy calls_update_participants
on ordn.calls
for update
using (auth.uid() = caller_id or auth.uid() = callee_id)
with check (auth.uid() = caller_id or auth.uid() = callee_id);

-- Call signals: participants can read
drop policy if exists call_signals_select_participants on ordn.call_signals;
create policy call_signals_select_participants
on ordn.call_signals
for select
using (
  exists (
    select 1
    from ordn.calls c
    where c.id = call_id
      and (auth.uid() = c.caller_id or auth.uid() = c.callee_id)
  )
);

-- Call signals: sender must be auth.uid(), sender must be a participant, recipient must be null or a participant
drop policy if exists call_signals_insert_participants on ordn.call_signals;
create policy call_signals_insert_participants
on ordn.call_signals
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from ordn.calls c
    where c.id = call_id
      and (auth.uid() = c.caller_id or auth.uid() = c.callee_id)
      and (
        recipient_id is null
        or recipient_id = c.caller_id
        or recipient_id = c.callee_id
      )
  )
);

-- No UPDATE/DELETE policies on call_signals: append-only log.

-- Supabase Realtime: ensure these tables are included in the `supabase_realtime` publication
-- so `postgres_changes` subscriptions receive events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime' and n.nspname = 'ordn' and c.relname = 'calls'
    ) then
      alter publication supabase_realtime add table ordn.calls;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime' and n.nspname = 'ordn' and c.relname = 'call_signals'
    ) then
      alter publication supabase_realtime add table ordn.call_signals;
    end if;
  end if;
end
$$;

commit;


