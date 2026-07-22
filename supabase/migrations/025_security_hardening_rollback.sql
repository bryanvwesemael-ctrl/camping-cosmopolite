-- ROLLBACK voor 025_security_hardening.sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.touch_booking()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version    = coalesce(old.version, 1) + 1;
  return new;
end
$$;

create or replace function public.has_role(uid uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from user_roles where user_id = uid);
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'admin');
$$;
