-- ROLLBACK voor 012_migrate_existing_guests.sql (BEST EFFORT).
-- Een data-backfill is niet exact omkeerbaar. Deze rollback verwijdert de
-- voorlopige gasten die overeenkomen met hun contact en nog niet bevestigd
-- of aan een document gekoppeld zijn. De hoofdgast-markering (stap 1) laten we
-- staan (onschadelijk). Enkel gebruiken in noodgeval en na controle.

delete from gasten g
using bookings b join clients c on c.id = b.client_id
where g.booking_id = b.id
  and g.id_consent = false
  and g.is_hoofdgast = true
  and g.naam = c.naam
  and not exists (select 1 from booking_documents d where d.gast_id = g.id);
