import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_URL          = `${SUPABASE_URL}/functions/v1/mollie-webhook`
const REDIRECT_URL         = Deno.env.get('SITE_URL') || 'https://camping-cosmopolite.netlify.app'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// Plug-and-play: Mollie-sleutel uit env-secret OF settings-tabel (UI slaat hem daar op).
async function getMollieKey(sb: any): Promise<string|null> {
  const env = Deno.env.get('MOLLIE_API_KEY')
  if (env) return env
  const { data } = await sb.from('settings').select('value').eq('key','mollie_api_key').order('updated_at',{ascending:false}).limit(1).maybeSingle()
  return data?.value || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ','')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data:{ user } } = await sb.auth.getUser(jwt!)
    if (!user) throw new Error('Niet ingelogd')

    const MOLLIE_API_KEY = await getMollieKey(sb)
    if (!MOLLIE_API_KEY) throw new Error('Mollie is nog niet gekoppeld. Vul je Mollie-sleutel in bij Instellingen → Mollie.')

    // amount optioneel: anders automatisch het openstaande saldo (totaal - reeds betaald).
    const { booking_id, amount } = await req.json()
    const { data: b } = await sb.from('bookings').select('*,clients(naam,email)').eq('id', booking_id).single()
    if (!b) throw new Error('Boeking niet gevonden')

    const { data: paidRows } = await sb.from('payments').select('bedrag').eq('booking_id', booking_id).eq('status','paid')
    const reedsBetaald = (paidRows||[]).reduce((s:number,p:any)=>s+Number(p.bedrag||0),0)
    const totaal = Number(b.bedrag_totaal||0)
    const openstaand = Math.round((totaal - reedsBetaald)*100)/100
    const bedrag = (amount && Number(amount)>0) ? Math.round(Number(amount)*100)/100 : openstaand
    if (!(bedrag > 0)) throw new Error('Niets te betalen — deze boeking is al volledig betaald.')

    const isBij = reedsBetaald > 0
    const description = `Camping Cosmopolite #${b.volgnummer} — ${b.clients?.naam}${isBij?' (bijbetaling)':''}`

    const res = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MOLLIE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: { currency: 'EUR', value: bedrag.toFixed(2) },
        description,
        redirectUrl: `${REDIRECT_URL}/betaald/?booking=${booking_id}`,
        webhookUrl:  WEBHOOK_URL,
        metadata: { booking_id }
      })
    })
    const payment = await res.json()
    if (payment.status === 'open' || payment._links) {
      const checkoutUrl = payment._links?.checkout?.href
      await sb.from('payments').insert({ booking_id, mollie_id: payment.id, bedrag, checkout_url: checkoutUrl })
      await sb.from('settings').upsert({ user_id: user.id, key:'last_betaallink', value: checkoutUrl, updated_at: new Date().toISOString() }, { onConflict:'user_id,key' })
      return new Response(JSON.stringify({ ok:true, checkout_url: checkoutUrl, bedrag, bijbetaling:isBij }), { headers:{...cors,'Content-Type':'application/json'} })
    }
    throw new Error(payment.detail || 'Mollie fout')
  } catch(err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status:400, headers:{...cors,'Content-Type':'application/json'} })
  }
})
