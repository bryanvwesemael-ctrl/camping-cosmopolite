-- ROLLBACK voor 016_bezoekers.sql
alter publication supabase_realtime drop table if exists bezoekers;
drop trigger if exists trg_bezoekers_updated_at on bezoekers;
drop table if exists bezoekers;
