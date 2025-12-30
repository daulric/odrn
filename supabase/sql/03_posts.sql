-- =============================================================================
-- 03_posts.sql - User Posts Table
-- =============================================================================
-- This file creates the posts table for user-generated content.
-- Run AFTER: 01_profiles.sql
-- =============================================================================

begin;

-- Create the posts table
create table if not exists ordn.posts (
  id uuid primary key default gen_random_uuid(),
  userid uuid not null references ordn.profiles(id) on delete cascade,
  content text,
  created_at timestamptz default now()
);

-- Indexes for efficient post queries
create index if not exists posts_userid_idx on ordn.posts(userid);
create index if not exists posts_created_at_idx on ordn.posts(created_at desc);
create index if not exists posts_user_created_idx on ordn.posts(userid, created_at desc);

-- Enable Row Level Security
alter table ordn.posts enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Anyone can view posts (public feed)
drop policy if exists "Posts are viewable by everyone" on ordn.posts;
create policy "Posts are viewable by everyone"
  on ordn.posts for select
  using (true);

-- Users can create their own posts
drop policy if exists "Users can create own posts" on ordn.posts;
create policy "Users can create own posts"
  on ordn.posts for insert
  with check (auth.uid() = userid);

-- Users can update their own posts
drop policy if exists "Users can update own posts" on ordn.posts;
create policy "Users can update own posts"
  on ordn.posts for update
  using (auth.uid() = userid)
  with check (auth.uid() = userid);

-- Users can delete their own posts
drop policy if exists "Users can delete own posts" on ordn.posts;
create policy "Users can delete own posts"
  on ordn.posts for delete
  using (auth.uid() = userid);

-- =============================================================================
-- Trigger: Update timestamps (optional - for future updated_at column)
-- =============================================================================

-- Function to set created_at on insert
create or replace function ordn.set_post_created_at()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_post_created_at_trigger on ordn.posts;
create trigger set_post_created_at_trigger
  before insert on ordn.posts
  for each row
  execute function ordn.set_post_created_at();

commit;

