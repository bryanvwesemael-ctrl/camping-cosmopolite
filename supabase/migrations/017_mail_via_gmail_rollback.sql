-- ROLLBACK voor 017_mail_via_gmail.sql
delete from club_settings where key = 'mail_sender_email';
