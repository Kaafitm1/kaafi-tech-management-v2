-- Kaafi Tech user-management compatibility migration.
-- Review existing profiles policies before running. Does not delete profile rows.

alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Align role values with the current app and the account-creation form.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','registration_staff','finance_staff','teacher','student'));

-- Allow the authenticated user to read their own profile; Admin can read all profiles.
-- This helper uses SECURITY DEFINER to avoid recursive RLS on profiles.
create or replace function public.kaafi_is_active_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(coalesce(p.role,'')) = 'admin'
  );
$$;
grant execute on function public.kaafi_is_active_admin() to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.kaafi_is_active_admin());

-- The API route uses service-role credentials only on the server and independently
-- verifies the caller's current profiles.role is admin before creating or changing accounts.
-- This migration intentionally does not replace policies on operational tables.
