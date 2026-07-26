import { createClient } from '@supabase/supabase-js';

// Zelfde Supabase-project als het dashboard en het reserveringsformulier.
// Enkel de publieke anon-sleutel — de site leest alleen publieke website-
// inhoud (RLS: anon mag zichtbare pagina's + prijs-instellingen lezen).
const SUPABASE_URL = 'https://whubbowuqhjdkdequbmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJib3d1cWhqZGtkZXF1Ym1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjM3NTYsImV4cCI6MjA5Nzc5OTc1Nn0.1S-eme0sMmC_25H-XnZ9r3AMKFSSxnpRx3-GRefSyzs';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
