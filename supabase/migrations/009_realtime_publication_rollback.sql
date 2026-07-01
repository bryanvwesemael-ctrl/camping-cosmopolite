-- ROLLBACK voor 009_realtime_publication.sql
alter publication supabase_realtime drop table if exists booking_documents;
alter publication supabase_realtime drop table if exists gasten;
