-- =============================================================================
-- 05_messages.sql - Direct Messages Table
-- =============================================================================
-- This file creates the messages table for direct messaging between users.
-- Run AFTER: 01_profiles.sql
-- =============================================================================

begin;

-- Create the messages table
create table if not exists ordn.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  sender_id uuid not null references ordn.profiles(id) on delete cascade,
  receiver_id uuid not null references ordn.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen boolean not null default false,
  
  -- Prevent sending messages to self
  constraint messages_no_self check (sender_id <> receiver_id)
);

-- Indexes for efficient message queries
create index if not exists messages_sender_id_idx on ordn.messages(sender_id);
create index if not exists messages_receiver_id_idx on ordn.messages(receiver_id);
create index if not exists messages_created_at_idx on ordn.messages(created_at desc);

-- Composite indexes for conversation queries
create index if not exists messages_conversation_idx 
  on ordn.messages(sender_id, receiver_id, created_at desc);
create index if not exists messages_unread_idx 
  on ordn.messages(receiver_id, seen) where not seen;

-- Enable Row Level Security
alter table ordn.messages enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Users can view messages they sent or received
drop policy if exists "Users can view own messages" on ordn.messages;
create policy "Users can view own messages"
  on ordn.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Users can send messages
drop policy if exists "Users can send messages" on ordn.messages;
create policy "Users can send messages"
  on ordn.messages for insert
  with check (auth.uid() = sender_id);

-- Users can update messages they received (to mark as seen)
drop policy if exists "Receivers can mark messages as seen" on ordn.messages;
create policy "Receivers can mark messages as seen"
  on ordn.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Users can delete messages they sent
drop policy if exists "Senders can delete own messages" on ordn.messages;
create policy "Senders can delete own messages"
  on ordn.messages for delete
  using (auth.uid() = sender_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get unread message count for a user
create or replace function ordn.get_unread_count(user_uuid uuid)
returns bigint
language sql
stable
security definer
as $$
  select count(*)
  from ordn.messages m
  where m.receiver_id = user_uuid
    and m.seen = false;
$$;

-- Function to get unread count from a specific sender
create or replace function ordn.get_unread_count_from(user_uuid uuid, from_uuid uuid)
returns bigint
language sql
stable
security definer
as $$
  select count(*)
  from ordn.messages m
  where m.receiver_id = user_uuid
    and m.sender_id = from_uuid
    and m.seen = false;
$$;

-- Function to mark all messages from a sender as read
create or replace function ordn.mark_messages_read(user_uuid uuid, from_uuid uuid)
returns void
language sql
security definer
as $$
  update ordn.messages
  set seen = true
  where receiver_id = user_uuid
    and sender_id = from_uuid
    and seen = false;
$$;

-- =============================================================================
-- Realtime: Enable for live message updates
-- =============================================================================

-- Note: Run this separately in Supabase Dashboard or via API:
-- alter publication supabase_realtime add table ordn.messages;

commit;

