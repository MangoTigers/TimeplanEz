-- Allow fractional school hours such as 6h 45m (6.75 hours).

alter table public.users
alter column school_hours_per_week type numeric(5, 2)
using school_hours_per_week::numeric(5, 2);