-- Add configurable behavior for school-hours mode and per-user AI key.

alter table public.users
add column if not exists use_school_hours_mode boolean not null default true;

alter table public.users
add column if not exists openai_api_key text;