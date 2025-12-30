-- =============================================================================
-- 04_post_images.sql - Post Images Table
-- =============================================================================
-- This file creates the post_images table for storing images attached to posts.
-- Run AFTER: 03_posts.sql
-- =============================================================================

begin;

-- Create the post_images table
create table if not exists ordn.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references ordn.posts(id) on delete cascade,
  image_url text not null,
  order_index integer not null default 0,
  created_at timestamptz default now()
);

-- Indexes for efficient image queries
create index if not exists post_images_post_id_idx on ordn.post_images(post_id);
create index if not exists post_images_post_order_idx on ordn.post_images(post_id, order_index);

-- Enable Row Level Security
alter table ordn.post_images enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Anyone can view post images (since posts are public)
drop policy if exists "Post images are viewable by everyone" on ordn.post_images;
create policy "Post images are viewable by everyone"
  on ordn.post_images for select
  using (true);

-- Users can add images to their own posts
drop policy if exists "Users can add images to own posts" on ordn.post_images;
create policy "Users can add images to own posts"
  on ordn.post_images for insert
  with check (
    exists (
      select 1 from ordn.posts p
      where p.id = post_id
      and p.userid = auth.uid()
    )
  );

-- Users can update images on their own posts
drop policy if exists "Users can update images on own posts" on ordn.post_images;
create policy "Users can update images on own posts"
  on ordn.post_images for update
  using (
    exists (
      select 1 from ordn.posts p
      where p.id = post_id
      and p.userid = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from ordn.posts p
      where p.id = post_id
      and p.userid = auth.uid()
    )
  );

-- Users can delete images from their own posts
drop policy if exists "Users can delete images from own posts" on ordn.post_images;
create policy "Users can delete images from own posts"
  on ordn.post_images for delete
  using (
    exists (
      select 1 from ordn.posts p
      where p.id = post_id
      and p.userid = auth.uid()
    )
  );

-- =============================================================================
-- Trigger: Ensure created_at is set
-- =============================================================================

create or replace function ordn.set_post_image_created_at()
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

drop trigger if exists set_post_image_created_at_trigger on ordn.post_images;
create trigger set_post_image_created_at_trigger
  before insert on ordn.post_images
  for each row
  execute function ordn.set_post_image_created_at();

commit;

