-- Root cause van een gekend, herhaaldelijk terugkerend beveiligingspunt:
-- dit project had een database-brede standaardregel die élke NIEUWE
-- functie in het public-schema automatisch EXECUTE-rechten gaf aan de
-- "anon"-rol (niet-ingelogde bezoekers), bovenop authenticated/service_role.
-- Een losse "revoke ... from public" na het aanmaken van een functie helpt
-- daar niet tegen, want die standaardregel geeft een APARTE, directe grant
-- aan anon — niet via PUBLIC.
--
-- 1) De standaardregel zelf aanpassen: nieuwe functies krijgen voortaan
--    geen automatische anon-toegang meer (authenticated blijft wel
--    automatisch, dat is voor deze app steeds correct/gewenst).
alter default privileges in schema public revoke execute on functions from anon;

-- 2) Bestaande functies die deze anon-toegang nooit nodig hadden, expliciet
--    corrigeren. has_role/is_admin worden enkel gebruikt door ingelogde
--    gebruikers (RLS-policies en de front-end na inloggen) — een
--    niet-ingelogde bezoeker heeft hier nooit een geldige reden toe.
revoke execute on function public.has_role(uuid) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.verwijder_laatste_factuur(uuid, text) from anon;
