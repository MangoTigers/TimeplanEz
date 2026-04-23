-- Ensure every auth user has a matching public.users profile row.
-- This prevents FK errors like shifts_user_id_fkey when inserting shifts.

-- 1) Trigger function: create profile row after auth signup
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    school_hours_per_week,
    hourly_rate,
    currency,   
    notifications_enabled,
    email_digest_enabled
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@local.user'),
    20,
    120,
    'NOK',
    true,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 2) Recreate trigger safely

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_auth_user();

-- 3) Backfill: create missing profiles for already-registered auth users
insert into public.users (
  id,
  email,
  school_hours_per_week,
  hourly_rate,
  currency,
  notifications_enabled,
  email_digest_enabled
)
select
  au.id,
  coalesce(au.email, au.id::text || '@local.user') as email,
  20,
  120,
  'NOK',
  true,
  true
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;
