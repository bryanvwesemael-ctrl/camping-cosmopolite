import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function interpolate(t: string, vars: Record<string,string>): string {
  return (t||'').replace(/\{\{(\w+)\}\}/g, (_,k) => vars[k] ?? `{{${k}}}`)
}

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

    // Plug-and-play: lees ALLE settings (laatste waarde per sleutel), niet per gebruiker.
    const { data: rows } = await sb.from('settings').select('key,value,updated_at').order('updated_at',{ascending:true})
    const cfg: Record<string,string> = {}
    ;(rows||[]).forEach((s:any)=>{ cfg[s.key]=s.value })

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || cfg['resend_api_key']
    if (!RESEND_API_KEY) throw new Error('Mail is nog niet gekoppeld. Vul je Resend-sleutel in bij Instellingen → Mail.')
    const fromName  = cfg['mail_from_name']  || 'Camping Cosmopolite'
    const fromEmail = cfg['mail_from_email']
    if (!fromEmail) throw new Error('Stel eerst een afzender-e-mail in bij Instellingen → Mail.')

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

    // Nieuwe variant-templates (mailtemplate_<key> = JSON array) — kies willekeurig
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

    const res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json' },
      body: JSON.stringify({ from:`${fromName} <${fromEmail}>`, to:[b.clients.email], subject, text })
    })
    const result = await res.json()
    if (result.statusCode >= 400 || result.error) throw new Error(result.message || result.error?.message || 'Resend fout')

    await sb.from('communicatie').insert({ booking_id, richting:'uitgaand', status:'verzonden', template_key, onderwerp:subject, inhoud:text })
    return new Response(JSON.stringify({ ok:true }), { headers:{...cors,'Content-Type':'application/json'} })
  } catch(err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status:400, headers:{...cors,'Content-Type':'application/json'} })
  }
})
