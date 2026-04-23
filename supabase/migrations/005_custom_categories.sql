-- Add per-user customizable categories.

alter table public.users
add column if not exists custom_categories text[] not null default array['General','Tutoring','Event','Administration','Other'];