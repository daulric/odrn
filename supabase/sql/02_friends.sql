-- =============================================================================
-- 02_friends.sql - Friend Relationships Table
-- =============================================================================
-- This file creates the friends table for managing friend requests and
-- accepted friendships between users.
-- Run AFTER: 01_profiles.sql
-- =============================================================================

begin;

-- Create friend status enum if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'ordn' and t.typname = 'friend_status'
  ) then
    create type ordn.friend_status as enum ('pending', 'accepted');
  end if;
end
$$;

-- Create the friends table
create table if not exists ordn.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references ordn.profiles(id) on delete cascade,
  friend_id uuid not null references ordn.profiles(id) on delete cascade,
  status ordn.friend_status not null default 'pending',
  created_at timestamptz default now(),
  
  -- Prevent duplicate friend requests
  constraint friends_unique_pair unique (user_id, friend_id),
  -- Prevent self-friending
  constraint friends_no_self check (user_id <> friend_id)
);

-- Indexes for efficient friend lookups
create index if not exists friends_user_id_idx on ordn.friends(user_id);
create index if not exists friends_friend_id_idx on ordn.friends(friend_id);
create index if not exists friends_status_idx on ordn.friends(status);
create index if not exists friends_user_status_idx on ordn.friends(user_id, status);
create index if not exists friends_friend_status_idx on ordn.friends(friend_id, status);

-- Enable Row Level Security
alter table ordn.friends enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Users can view their own friend relationships (sent or received)
drop policy if exists "Users can view own friendships" on ordn.friends;
create policy "Users can view own friendships"
  on ordn.friends for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Users can send friend requests
drop policy if exists "Users can send friend requests" on ordn.friends;
create policy "Users can send friend requests"
  on ordn.friends for insert
  with check (auth.uid() = user_id);

-- Users can update friend requests they received (to accept)
drop policy if exists "Users can accept friend requests" on ordn.friends;
create policy "Users can accept friend requests"
  on ordn.friends for update
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

-- Users can delete friendships they're part of
drop policy if exists "Users can remove friendships" on ordn.friends;
create policy "Users can remove friendships"
  on ordn.friends for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- =============================================================================
-- Helper Function: Check if two users are friends
-- =============================================================================

-- This function is used by other tables (calls, etc.) to verify friendship
create or replace function ordn.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from ordn.friends f
    where f.status = 'accepted'::ordn.friend_status
      and (
        (f.user_id = a and f.friend_id = b)
        or
        (f.user_id = b and f.friend_id = a)
      )
  );
$$;

-- =============================================================================
-- Helper Function: Get friend IDs for a user
-- =============================================================================

create or replace function ordn.get_friend_ids(user_uuid uuid)
returns setof uuid
language sql
stable
security definer
as $$
  select 
    case 
      when f.user_id = user_uuid then f.friend_id
      else f.user_id
    end as friend_id
  from ordn.friends f
  where f.status = 'accepted'::ordn.friend_status
    and (f.user_id = user_uuid or f.friend_id = user_uuid);
$$;

commit;

