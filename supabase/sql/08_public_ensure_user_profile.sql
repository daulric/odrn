-- =============================================================================
-- 08_public_ensure_user_profile.sql - Public Schema User Profile Function
-- =============================================================================
-- This function ensures a user profile exists in the target tenant schema.
-- It creates the profile if it doesn't exist, or returns the existing one.
-- The public.users table links auth_user_id to auth.users.id
-- =============================================================================

begin;

-- =============================================================================
-- Function: public.ensure_user_profile
-- =============================================================================
-- Creates or returns a user's profile in the specified tenant schema.
-- Safe to call on every sign-in.
-- Returns is_new = true for first-time users, false for returning users.

create or replace function public.ensure_user_profile(
  target_schema text,
  user_name text default null
)
returns table (
  id uuid,
  auth_user_id uuid,
  email text,
  name text,
  role text,
  username text,
  avatar text,
  is_online boolean,
  last_seen timestamptz,
  created_at timestamptz,
  is_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_user_email text;
  v_profile_id uuid;
  v_is_new boolean := false;
  v_query text;
  v_result record;
begin
  -- Get the current authenticated user
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get user email from auth.users
  select u.email into v_user_email
  from auth.users u
  where u.id = v_auth_user_id;

  -- Check if profile exists in the target schema
  v_query := format(
    'SELECT id, username, email, avatar, is_online, last_seen, created_at 
     FROM %I.profiles 
     WHERE id = $1',
    target_schema
  );
  
  execute v_query into v_result using v_auth_user_id;

  if v_result.id is null then
    -- Create new profile in target schema
    v_query := format(
      'INSERT INTO %I.profiles (id, email, username, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, username, email, avatar, is_online, last_seen, created_at',
      target_schema
    );
    
    execute v_query into v_result using v_auth_user_id, v_user_email, user_name;
    v_is_new := true;
  else
    -- Update email if changed and set online
    v_query := format(
      'UPDATE %I.profiles 
       SET email = coalesce($2, email),
           is_online = true,
           last_seen = now()
       WHERE id = $1
       RETURNING id, username, email, avatar, is_online, last_seen, created_at',
      target_schema
    );
    
    execute v_query into v_result using v_auth_user_id, v_user_email;
  end if;

  -- Return the profile with is_new flag
  return query select
    v_result.id,
    v_auth_user_id as auth_user_id,
    v_result.email,
    user_name as name,
    'user'::text as role,
    v_result.username,
    v_result.avatar,
    v_result.is_online,
    v_result.last_seen,
    v_result.created_at,
    v_is_new;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.ensure_user_profile(text, text) to authenticated;

commit;

