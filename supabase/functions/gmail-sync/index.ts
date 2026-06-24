import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

async function gmailFetch(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.json()
}

function extractBody(payload: any): string {
  if (!payload) return ''
  const decode = (b64: string) => {
    try { return atob(b64.replace(/-/g,'+').replace(/_/g,'/')) } catch { return '' }
  }
  if (payload.body?.data) return decode(payload.body.data)
  if (payload.parts) {
    const plain = payload.parts.find((p:any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decode(plain.body.data)
    const html = payload.parts.find((p:any) => p.mimeType === 'text/html')
    if (html?.body?.data) return decode(html.body.data).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Haal Supabase user op
    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt!)
    if (userErr || !user) throw new Error('Niet ingelogd')

    // Haal integratie op
    const { data: integ, error: integErr } = await sb.from('integrations')
      .select('*').eq('user_id', user.id).eq('provider', 'gmail').single()
    if (integErr || !integ) throw new Error('Gmail niet gekoppeld')

    // Ververs access token
    const accessToken = await refreshAccessToken(integ.refresh_token)

    // Sla ververs access token op
    await sb.from('integrations').update({
      access_token: accessToken,
      expires_at:   new Date(Date.now() + 3599000).toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('id', integ.id)

    // Haal alle klant-e-mailadressen op
    const { data: clients } = await sb.from('clients').select('id, email').not('email', 'is', null)
    const clientByEmail: Record<string, string> = {}
    clients?.forEach((c:any) => { if (c.email) clientByEmail[c.email.toLowerCase()] = c.id })
    const allEmails = Object.keys(clientByEmail)
    if (!allEmails.length) return new Response(JSON.stringify({ ok: true, synced: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Zoek Gmail threads met klant-emails (laatste 30 dagen)
    const since = Math.floor((Date.now() - 30 * 86400000) / 1000)
    const query = `(${allEmails.map(e=>`from:${e} OR to:${e}`).join(' OR ')}) after:${since}`
    const listData = await gmailFetch(accessToken, `users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`)
    const messages = listData.messages || []

    let synced = 0
    for (const msg of messages) {
      // Check of al opgeslagen
      const { data: existing } = await sb.from('communicatie')
        .select('id').eq('gmail_message_id', msg.id).maybeSingle()
      if (existing) continue

      // Haal volledig bericht op
      const full = await gmailFetch(accessToken, `users/me/messages/${msg.id}?format=full`)
      const headers = full.payload?.headers || []
      const get = (name: string) => headers.find((h:any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

      const fromAddr = get('From').match(/<(.+?)>/)?.[1] || get('From')
      const toAddr   = get('To').match(/<(.+?)>/)?.[1]   || get('To')
      const subject  = get('Subject') || '(geen onderwerp)'
      const dateStr  = get('Date')

      // Bepaal richting en klant
      const myEmail     = integ.email?.toLowerCase()
      const fromLower   = fromAddr.toLowerCase()
      const toLower     = toAddr.toLowerCase()
      const isUitgaand  = fromLower === myEmail
      const klantEmail  = isUitgaand ? toLower : fromLower
      const clientId    = clientByEmail[klantEmail]
      if (!clientId) continue

      // Zoek bijhorende boeking (meest recente)
      const { data: booking } = await sb.from('bookings')
        .select('id').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle()

      const body = extractBody(full.payload)

      await sb.from('communicatie').insert({
        booking_id:       booking?.id || null,
        richting:         isUitgaand ? 'uitgaand' : 'inkomend',
        status:           'verzonden',
        onderwerp:        subject,
        inhoud:           body.slice(0, 4000),
        gmail_message_id: msg.id,
        gmail_thread_id:  msg.threadId,
        created_at:       dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      })
      synced++
    }

    return new Response(JSON.stringify({ ok: true, synced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
