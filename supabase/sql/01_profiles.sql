-- =============================================================================
-- 01_profiles.sql - User Profiles Table
-- =============================================================================
-- This file creates the profiles table which stores user information.
-- The profiles table is linked to Supabase Auth (auth.users).
-- Run AFTER: 00_schema.sql
-- =============================================================================

begin;

-- Create the profiles table
create table if not exists ordn.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text,
  avatar text,
  expo_push_token text,
  is_online boolean default false,
  last_seen timestamptz,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists profiles_username_idx on ordn.profiles(username);
create index if not exists profiles_is_online_idx on ordn.profiles(is_online);
create index if not exists profiles_last_seen_idx on ordn.profiles(last_seen);

-- Enable Row Level Security
alter table ordn.profiles enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Anyone can view profiles (for searching users, viewing posts, etc.)
drop policy if exists "Profiles are viewable by everyone" on ordn.profiles;
create policy "Profiles are viewable by everyone"
  on ordn.profiles for select
  using (true);

-- Users can insert their own profile
drop policy if exists "Users can insert own profile" on ordn.profiles;
create policy "Users can insert own profile"
  on ordn.profiles for insert
  with check (auth.uid() = id);

-- Users can update their own profile
drop policy if exists "Users can update own profile" on ordn.profiles;
create policy "Users can update own profile"
  on ordn.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can delete their own profile
drop policy if exists "Users can delete own profile" on ordn.profiles;
create policy "Users can delete own profile"
  on ordn.profiles for delete
  using (auth.uid() = id);

-- =============================================================================
-- Trigger: Auto-create profile on user signup
-- =============================================================================

-- Function to handle new user signup
create or replace function ordn.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ordn.profiles (id, email, created_at)
  values (new.id, new.email, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function ordn.handle_new_user();

-- =============================================================================
-- Trigger: Update last_seen on profile access
-- =============================================================================

-- Function to update last_seen timestamp
create or replace function ordn.update_last_seen()
returns trigger
language plpgsql
security definer
as $$
begin
  new.last_seen := now();
  return new;
end;
$$;

-- Apply trigger when is_online changes
drop trigger if exists on_profile_online_change on ordn.profiles;
create trigger on_profile_online_change
  before update of is_online on ordn.profiles
  for each row
  when (old.is_online is distinct from new.is_online)
  execute function ordn.update_last_seen();

commit;

