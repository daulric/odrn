-- Posts Likes Table
-- Tracks which users have liked which posts

create table if not exists ordn.posts_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references ordn.profiles(id) on delete cascade,
  post_id uuid not null references ordn.posts(id) on delete cascade,
  created_at timestamptz default now(),
  -- Ensure a user can only like a post once
  constraint unique_user_post_like unique (user_id, post_id)
);

-- Set up RLS
alter table ordn.posts_likes enable row level security;

-- Everyone can view likes (to show like counts)
create policy "Likes are viewable by everyone."
  on ordn.posts_likes for select
  using (true);

-- Users can like posts (insert their own likes)
create policy "Users can like posts."
  on ordn.posts_likes for insert
  with check (auth.uid() = user_id);

-- Users can unlike posts (delete their own likes)
create policy "Users can unlike posts."
  on ordn.posts_likes for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_posts_likes_post_id
  on ordn.posts_likes (post_id);

create index if not exists idx_posts_likes_user_id
  on ordn.posts_likes (user_id);

create index if not exists idx_posts_likes_user_post
  on ordn.posts_likes (user_id, post_id);

-- Add posts_likes to realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_publication p on p.oid = pr.prpubid
      where p.pubname = 'supabase_realtime' and n.nspname = 'ordn' and c.relname = 'posts_likes'
    ) then
      alter publication supabase_realtime add table ordn.posts_likes;
    end if;
  end if;
end
$$;

