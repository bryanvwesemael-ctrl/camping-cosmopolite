import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function interpolate(t: string, vars: Record<string,string>): string {
  return (t||'').replace(/\{\{(\w+)\}\}/g, (_,k) => vars[k] ?? `{{${k}}}`)
}

// -- Gmail-verzendhelpers ----------------------------------------------------
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}
function toBase64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}
function toBase64Url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
// Bouwt een RFC822-bericht en codeert het volgens wat de Gmail API verwacht
// (base64url van het volledige bericht; het lichaam zelf ook base64 i.v.m. UTF-8).
function buildRawMessage(fromName: string, fromEmail: string, to: string, subject: string, text: string): string {
  const lines = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${toBase64Utf8(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Utf8(text),
  ].join('\r\n')
  return toBase64Url(btoa(lines))
}

// Verstuurt bevestigingsmails rechtstreeks via Karen's gekoppelde Gmail-account
// (Gmail API), niet meer via Resend. club_settings.mail_sender_email bepaalt
// WIE altijd de afzender is — vast, ongeacht welke medewerker is ingelogd
// (voorkomt het "instellingen per gebruiker"-conflict van voorheen).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ','')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data:{ user } } = await sb.auth.getUser(jwt!)
    if (!user) throw new Error('Niet ingelogd')

    const { booking_id, template_key } = await req.json()
    const { data: b } = await sb.from('bookings').select('*,clients(*)').eq('id', booking_id).single()
    if (!b) throw new Error('Boeking niet gevonden')
    if (!b.clients?.email) throw new Error('Geen e-mailadres bij deze gast')

    const { data: cfgRow } = await sb.from('club_settings').select('value').eq('key','mail_sender_email').maybeSingle()
    const senderEmail = cfgRow?.value
    if (!senderEmail) throw new Error('Geen afzender ingesteld. Stel dit in bij Instellingen → Mail.')

    const { data: integ } = await sb.from('integrations').select('*').eq('provider','gmail').eq('email', senderEmail).maybeSingle()
    if (!integ) throw new Error(`Gmail (${senderEmail}) is nog niet gekoppeld. Koppel Gmail in Instellingen → Mail.`)

    let accessToken: string
    try {
      accessToken = await refreshAccessToken(integ.refresh_token)
    } catch (_e) {
      throw new Error('Gmail-koppeling verlopen of ingetrokken — koppel opnieuw in Instellingen → Mail.')
    }
    await sb.from('integrations').update({ access_token: accessToken, expires_at: new Date(Date.now()+3599000).toISOString(), updated_at: new Date().toISOString() }).eq('id', integ.id)

    // Templates blijven in de bestaande (per-gebruiker) settings-tabel — enkel
    // de VERZENDMETHODE (Resend -> Gmail) verandert hier.
    const { data: rows } = await sb.from('settings').select('key,value,updated_at').order('updated_at',{ascending:true})
    const cfg: Record<string,string> = {}
    ;(rows||[]).forEach((s:any)=>{ cfg[s.key]=s.value })
    const fromName = cfg['mail_from_name'] || 'Camping Cosmopolite'

    const nights = Math.round((new Date(b.vertrek).getTime()-new Date(b.aankomst).getTime())/86400000)
    const vars: Record<string,string> = {
      voornaam:(b.clients?.naam||'').split(' ')[0], naam:b.clients?.naam||'', email:b.clients?.email||'',
      volgnummer:String(b.volgnummer??''),
      aankomst:new Date(b.aankomst).toLocaleDateString('nl-BE',{day:'numeric',month:'long',year:'numeric'}),
      vertrek:new Date(b.vertrek).toLocaleDateString('nl-BE',{day:'numeric',month:'long',year:'numeric'}),
      nachten:String(nights), personen:String((b.volwassenen??0)+(b.kinderen??0)+(b.baby??0)),
      bedrag:b.bedrag_totaal?`€${b.bedrag_totaal}`:'—', ogm:b.ogm_referentie||'—',
      betaallink:cfg['last_betaallink']||'—', from_name:fromName,
    }

    let subjectTpl='', bodyTpl=''
    try {
      const arr = JSON.parse(cfg['mailtemplate_'+template_key]||'[]')
      if (Array.isArray(arr) && arr.length) {
        const v = arr[Math.floor(Math.random()*arr.length)]
        subjectTpl = v.onderwerp||''; bodyTpl = v.inhoud||''
      }
    } catch(_e) {}
    if (!bodyTpl) {
      subjectTpl = `Camping Cosmopolite #{{volgnummer}}`
      bodyTpl = `Beste {{voornaam}},\n\nAankomst: {{aankomst}}\nVertrek: {{vertrek}}\nPersonen: {{personen}}\nBedrag: {{bedrag}}\n\nTot binnenkort!\n{{from_name}}`
    }
    const subject = interpolate(subjectTpl, vars)
    const text    = interpolate(bodyTpl, vars)

    const raw = buildRawMessage(fromName, senderEmail, b.clients.email, subject, text)
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    const sendResult = await sendRes.json()
    if (sendResult.error) {
      const reason = sendResult.error?.message || 'Gmail-fout'
      if (sendRes.status === 403 || /insufficient/i.test(reason))
        throw new Error('Gmail-koppeling heeft geen verzendrechten. Koppel Gmail opnieuw in Instellingen → Mail.')
      throw new Error(reason)
    }

    await sb.from('communicatie').insert({
      booking_id, richting:'uitgaand', status:'verzonden', template_key, onderwerp:subject, inhoud:text,
      gmail_message_id: sendResult.id, gmail_thread_id: sendResult.threadId,
    })
    return new Response(JSON.stringify({ ok:true }), { headers:{...cors,'Content-Type':'application/json'} })
  } catch(err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status:400, headers:{...cors,'Content-Type':'application/json'} })
  }
})
