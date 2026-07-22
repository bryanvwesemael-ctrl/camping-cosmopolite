-- ============================================================================
-- 025_security_hardening.sql
-- Vier snelle, veilige fixes uit de Supabase security-advisor:
--
-- 1. set_updated_at()/touch_booking(): search_path was niet vastgezet
--    (WARN "Function Search Path Mutable"). Toegevoegd zonder gedrag te
--    wijzigen.
--
-- 2. has_role()/is_admin(): waren rechtstreeks aanroepbaar door eender wie
--    via de publieke REST-RPC (bv. /rest/v1/rpc/is_admin?uid=<willekeurige-
--    uuid>), waardoor je kon aftoetsen welke user-id's admin zijn. Alle
--    bestaande RLS-policies roepen deze functies altijd ZONDER argument aan
--    (dus impliciet = auth.uid()) — nergens in de codebase wordt een ander
--    uid doorgegeven. Het uid-argument wordt dus genegeerd en er wordt altijd
--    tegen auth.uid() gecheckt: 100% zelfde gedrag voor alle bestaande RLS-
--    policies, maar het "aftoetsen van een ander account"-lek is dicht.
--
-- (mollie-webhook edge function apart verwijderd — was ongebruikt sinds
-- Karen voor QR-only betalingen koos, geen DB-wijziging nodig daarvoor.)
--
-- Rollback: 025_security_hardening_rollback.sql
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.touch_booking()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
  select exists (select 1 from user_roles where user_id = auth.uid());
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
$$;
