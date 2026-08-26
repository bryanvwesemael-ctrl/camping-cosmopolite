import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_GASTEN = 20

// Tijdelijke omweg: anon-INSERT op public.gasten faalt project-breed met een
// RLS-fout, ook met een test-policy 'with check (true)' op een gloednieuwe
// tabel, ook na een project-restart (26/08/2026) — dus geen policy- of
// cache-probleem aan onze kant, vermoedelijk een Supabase/Postgres-bug.
// Deze functie doet exact wat anon_insert_gasten (migratie 049) toeliet,
// maar via service_role zodat RLS niet in de weg zit. checkin_token
// bewijst dat de aanroeper de bijhorende boeking kent (zelfde patroon als
// guest-upload) — er wordt niet blind op een meegestuurde booking_id vertrouwd.
function validGast(g: any, isHoofdgast: boolean) {
  const naam = String(g?.naam || '').trim()
  if (naam.length < 1 || naam.length > 120) return null
  const nationaliteit = g?.nationaliteit != null ? String(g.nationaliteit).slice(0, 80) : null
  const id_nummer = g?.id_nummer != null ? String(g.id_nummer).slice(0, 40) : null
  const geboortedatum = g?.geboortedatum || null
  const id_consent = isHoofdgast ? !!g?.id_consent : false
  return { naam, nationaliteit, id_nummer, geboortedatum, id_consent }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json()
    const token = body.token
    const gastenIn = Array.isArray(body.gasten) ? body.gasten : []

    if (!token) throw new Error('Geen token meegegeven')
    if (!gastenIn.length) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    if (gastenIn.length > MAX_GASTEN) throw new Error('Te veel gasten')

    const { data: booking } = await sb
      .from('bookings').select('id').eq('checkin_token', token).maybeSingle()
    if (!booking) throw new Error('Ongeldige of verlopen link')

    const rows: any[] = []
    gastenIn.forEach((g: any, i: number) => {
      const isHoofdgast = i === 0
      const v = validGast(g, isHoofdgast)
      if (!v) return
      rows.push({ booking_id: booking.id, is_hoofdgast: isHoofdgast, ...v })
    })
    if (!rows.length) throw new Error('Geen geldige gasten')

    const { error, count } = await sb.from('gasten').insert(rows, { count: 'exact' })
    // Dubbele inzending (retry): hoofdgast-rij bestaat al voor deze boeking — geen fout.
    if (error && (error as any).code !== '23505') throw error

    return new Response(JSON.stringify({ ok: true, count: count ?? rows.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
