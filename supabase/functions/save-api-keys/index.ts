// ============================================================================
// LET OP — deze bron is op 2026-08-08 opgehaald UIT PRODUCTIE (bevinding F-08).
// Ze draaide sinds 2026-06-24 live zonder broncode in versiebeheer.
//
// ⚠️ DEZE FUNCTIE HEEFT BEKENDE GEBREKEN (bevinding F-05) — nog niet opgelost:
//
//  1. Ze bewaart volledige API-sleutels als PLATTE TEKST in de settings-tabel.
//     De commentaar hieronder beweert "encrypted via RLS". Dat klopt niet:
//     RLS is toegangscontrole, geen versleuteling. De sleutel staat
//     onversleuteld in de databank en in elke back-up.
//
//  2. Er is geen rolcontrole — elke ingelogde gebruiker mag dit aanroepen.
//
//  3. Erger: create-payment en scan-id lezen de sleutel op met
//     .eq('key', ...).order('updated_at', desc).limit(1) — ZONDER user_id.
//     De meest recent bijgewerkte rij van eender welke gebruiker wint. Een
//     staff-account kan daarmee in principe zijn eigen Mollie-sleutel
//     opdringen en betalingen omleiden.
//
// Op dit moment niet actief misbruikbaar: er staan geen mollie/anthropic-rijen
// in settings (die komen uit omgevingsvariabelen) en Mollie is uitgeschakeld.
// Aanbeveling in het remediatieplan: deze functie verwijderen en sleutels
// uitsluitend als Supabase-secret beheren.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await sb.auth.getUser(jwt!)
    if (!user) throw new Error('Niet ingelogd')

    const { resend_key, mollie_key } = await req.json()

    // Sla keys op als Supabase secrets via management API
    // (In productie: gebruik Supabase secrets API - hier slaan we hints op in settings)
    const upserts: any[] = []
    if (resend_key) {
      upserts.push({ user_id: user.id, key: 'resend_key_set', value: 'true', updated_at: new Date().toISOString() })
      upserts.push({ user_id: user.id, key: 'resend_key_hint', value: '...'+resend_key.slice(-4), updated_at: new Date().toISOString() })
      // Sla volledige key op in settings (encrypted via RLS)   ← ONJUIST, zie kop
      upserts.push({ user_id: user.id, key: 'resend_api_key', value: resend_key, updated_at: new Date().toISOString() })
    }
    if (mollie_key) {
      upserts.push({ user_id: user.id, key: 'mollie_key_set', value: 'true', updated_at: new Date().toISOString() })
      upserts.push({ user_id: user.id, key: 'mollie_key_hint', value: '...'+mollie_key.slice(-4), updated_at: new Date().toISOString() })
      upserts.push({ user_id: user.id, key: 'mollie_api_key', value: mollie_key, updated_at: new Date().toISOString() })
    }
    if (upserts.length) {
      await sb.from('settings').upsert(upserts, { onConflict: 'user_id,key' })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
