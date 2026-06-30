-- ROLLBACK voor 005_booking_documents.sql
drop trigger if exists trg_booking_documents_updated_at on booking_documents;
drop table if exists booking_documents;
drop type if exists id_proces_status;
