-- ============================================================================
-- 014_payments_methode.sql
-- Betaalmethode op payments zodat cash-betalingen naast Mollie geregistreerd
-- kunnen worden. Additief, default 'mollie' voor bestaande rijen.
--
-- Rollback: 014_payments_methode_rollback.sql
-- ============================================================================
alter table payments add column if not exists methode text not null default 'mollie';
