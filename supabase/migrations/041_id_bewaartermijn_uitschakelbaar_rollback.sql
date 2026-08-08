-- Rollback van 041: zet de automatische verwijdering van ID-afbeeldingen weer
-- aan op 90 dagen. LET OP: als je dit uitvoert, moet het privacybeleid mee
-- terug aangepast worden — anders belooft de tekst iets anders dan er gebeurt.
update club_settings set value='90', updated_at=now() where key='id_bewaartermijn_dagen';
update settings      set value='90', updated_at=now() where key='id_bewaartermijn_dagen';
