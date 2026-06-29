import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function setting(sb: any, key: string): Promise<string|null> {
  const { data } = await sb.from('settings').select('value').eq('key', key).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  return data?.value || null
}

// Webhook: verify_jwt = false (Mollie roept dit aan). Gebruikt service_role,
// zodat anon NOOIT betalingen kan wijzigen. Mollie-status wordt server-side
// geverifieerd via de Mollie API (bron van waarheid).
Deno.serve(async (req) => {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const mollieId = params.get('id')
    if (!mollieId) return new Response('ok')

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const MOLLIE_API_KEY = Deno.env.get('MOLLIE_API_KEY') || await setting(sb,'mollie_api_key')
    if (!MOLLIE_API_KEY) return new Response('ok')

    const res = await fetch(`https://api.mollie.com/v2/payments/${mollieId}`, {
      headers: { 'Authorization': `Bearer ${MOLLIE_API_KEY}` }
    })
    const payment = await res.json()

    if (payment.status === 'paid') {
      const bookingId = payment.metadata?.booking_id
      if (!bookingId) return new Response('ok')

      await sb.from('payments').update({ status:'paid', betaald_at: new Date().toISOString() }).eq('mollie_id', mollieId)
      await sb.from('bookings').update({ status:'betaald' }).eq('id', bookingId)

      const { data: b } = await sb.from('bookings').select('volgnummer,bedrag_totaal,clients(naam,email)').eq('id', bookingId).single()

      // 'verzonden' = geldige enum-waarde (concept/verzonden/mislukt)
      await sb.from('communicatie').insert({
        booking_id: bookingId, richting:'inkomend', status:'verzonden',
        onderwerp:`✅ Betaling ontvangen — ${b?.clients?.naam} #${b?.volgnummer}`,
        inhoud:`Bedrag: €${payment.amount?.value}\nMollie ID: ${mollieId}\nTijdstip: ${new Date().toLocaleString('nl-BE')}`
      })

      // Notificatiemail naar het team (indien Resend + afzender ingesteld)
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || await setting(sb,'resend_api_key')
      const fromEmail = await setting(sb,'mail_from_email')
      const fromName  = await setting(sb,'mail_from_name') || 'Camping Cosmopolite'
      if (RESEND_API_KEY && fromEmail && b?.clients) {
        const { data: users } = await sb.auth.admin.listUsers()
        const to = (users?.users || []).map((u:any)=>u.email).filter(Boolean)
        if (to.length) {
          await fetch('https://api.resend.com/emails', {
            method:'POST',
            headers:{ 'Authorization':`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json' },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to,
              subject: `💶 Betaling ontvangen — ${b.clients.naam} (€${payment.amount?.value})`,
              text: `Betaling ontvangen voor boeking #${b.volgnummer}\n\nKlant: ${b.clients.naam}\nBedrag: €${payment.amount?.value}\nMollie ID: ${mollieId}\n\nDe boeking is automatisch op "Betaald" gezet.`
            })
          })
        }
      }
    }
    return new Response('ok')
  } catch(err) {
    console.error(err)
    return new Response('ok')
  }
})
