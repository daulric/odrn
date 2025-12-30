-- =============================================================================
-- 00_schema.sql - Base Schema Setup
-- =============================================================================
-- This file sets up the base schema and required extensions for the ODRN app.
-- Run this file FIRST before any other SQL files.
-- =============================================================================

begin;

-- Enable required extensions
create extension if not exists pgcrypto;      -- For gen_random_uuid()
create extension if not exists "uuid-ossp";   -- For uuid_generate_v4()

-- Create the ordn schema if it doesn't exist
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'ordn') then
    create schema ordn;
  end if;
end
$$;

-- Grant usage on the schema to authenticated users
grant usage on schema ordn to authenticated;
grant usage on schema ordn to anon;

commit;

