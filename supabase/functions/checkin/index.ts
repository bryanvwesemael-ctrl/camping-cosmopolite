// ============================================================================
// LET OP — deze bron is op 2026-08-08 opgehaald UIT PRODUCTIE, niet andersom.
//
// Tijdens de beveiligingsaudit bleek dat deze functie al sinds 2026-06-25 live
// draaide zonder dat de broncode ooit in versiebeheer stond (bevinding F-08).
// Ze is publiek aanroepbaar (verify_jwt = false) én draait met de service role.
// Code met die rechten die niemand kan reviewen en waarvan niemand ziet of ze
// verandert, is een risico op zich — vandaar dat ze nu alsnog is vastgelegd.
//
// De inhoud hieronder is een letterlijke kopie van versie 3 zoals die draait.
// Bekende zwakke punten (zie F-09, nog niet opgelost):
//   - Bij een onbekend booking-id komt 404 en bij een geldig id met verkeerd
//     token 403. Dat verschil verklapt of een id bestaat. Beperkt risico:
//     boeking-id's zijn UUIDv4.
//   - Het token wordt vergeleken met !== (niet timing-veilig).
//   - Er is geen pogingenlimiet.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const t  = url.searchParams.get('t')

  if (!id || !t) {
    return new Response(JSON.stringify({ error: 'Ongeldige link' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: booking, error } = await sb
    .from('bookings')
    .select('id,volgnummer,aankomst,vertrek,status,checkin_token,volwassenen,kinderen,baby,tenten,campers,clients(naam,email)')
    .eq('id', id)
    .single()

  if (error || !booking) {
    return new Response(JSON.stringify({ error: 'Reservatie niet gevonden' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (booking.checkin_token !== t) {
    return new Response(JSON.stringify({ error: 'Ongeldige QR-code' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (req.method === 'POST') {
    // Bevestig check-in
    const { error: upErr } = await sb.from('bookings').update({
      status: 'ingecheckt',
      ingecheckt_at: new Date().toISOString()
    }).eq('id', id)

    if (upErr) {
      return new Response(JSON.stringify({ error: 'Check-in mislukt: ' + upErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // GET: stuur boeking terug
  return new Response(JSON.stringify({ booking }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
