-- ============================================================================
-- 017_mail_via_gmail.sql
-- Bevestigingsmails worden voortaan via Karen's gekoppelde Gmail-account
-- verstuurd (Gmail API), niet meer via Resend. Dit lost meteen ook het
-- "instellingen per gebruiker, laatste wijziging wint"-probleem op dat
-- eerder de mailverzending brak (settings.resend_api_key/mail_from_email
-- waren per-user, en Karen's ongeldige waarden overschreven stilzwijgend
-- Bryan's werkende configuratie).
--
-- club_settings.mail_sender_email wijst vast naar Karen's account: het
-- systeem verstuurt ALTIJD via haar Gmail-koppeling, ongeacht wie er
-- ingelogd is. Aanpasbaar via Instellingen indien dit ooit moet wijzigen.
--
-- Rollback: 017_mail_via_gmail_rollback.sql
-- ============================================================================
insert into club_settings (key, value)
values ('mail_sender_email', 'karen.campingcosmopolite@gmail.com')
on conflict (key) do nothing;
