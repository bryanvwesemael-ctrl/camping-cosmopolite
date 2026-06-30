import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function setting(sb: any, key: string): Promise<string|null> {
  const { data } = await sb.from('settings').select('value').eq('key', key).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  return data?.value || null
}

// AI-herkenning van de VOORKANT van een identiteitsdocument (Claude vision).
// Wordt ALLEEN aangeroepen wanneer een ingelogde medewerker er bewust om vraagt.
// Leest registervelden uit, maar NOOIT het rijksregisternummer.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ','')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data:{ user } } = await sb.auth.getUser(jwt!)
    if (!user) throw new Error('Niet ingelogd')

    const KEY = Deno.env.get('ANTHROPIC_API_KEY') || await setting(sb,'anthropic_api_key')
    if (!KEY) throw new Error('AI is nog niet gekoppeld. Vul je Anthropic-sleutel in bij de instellingen.')

    const { image_base64, media_type } = await req.json()
    if (!image_base64) throw new Error('Geen afbeelding ontvangen')

    const prompt = [
      'Dit is de VOORKANT van een identiteitsdocument (identiteitskaart, paspoort, Kids-ID of buitenlands ID).',
      'Geef UITSLUITEND geldige JSON terug, niets anders, in exact dit formaat:',
      '{"voornaam":"","achternaam":"","geboortedatum":"YYYY-MM-DD","geboorteplaats":"","nationaliteit":"","documenttype":"identiteitskaart|paspoort|kids-id|buitenlands|ander","documentnummer":"","vervaldatum":"YYYY-MM-DD","confidence":"hoog|gemiddeld|laag"}',
      'documentnummer = het KAARTNUMMER/documentnummer (niet het rijksregisternummer). Lees NOOIT het rijksregisternummer (de lange reeks 11 cijfers).',
      'Als een veld onleesbaar of afwezig is: lege string. confidence = jouw zekerheid over de gelezen naam/geboortedatum.',
    ].join(' ')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role:'user', content: [
          { type:'image', source:{ type:'base64', media_type: media_type||'image/jpeg', data: image_base64 } },
          { type:'text', text: prompt }
        ]}]
      })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error?.message || 'AI-fout')
    const text = data.content?.[0]?.text || ''
    let p: any = {}
    try { p = JSON.parse((text.match(/\{[\s\S]*\}/)||['{}'])[0]) } catch(_e) {}

    const voornaam = p.voornaam || ''
    const achternaam = p.achternaam || ''
    const naam = (voornaam || achternaam) ? `${voornaam} ${achternaam}`.trim() : (p.naam || '')

    return new Response(JSON.stringify({
      ok: true,
      naam,
      voornaam, achternaam,
      geboortedatum: p.geboortedatum || '',
      geboorteplaats: p.geboorteplaats || '',
      nationaliteit: p.nationaliteit || '',
      documenttype: p.documenttype || '',
      documentnummer: p.documentnummer || '',
      vervaldatum: p.vervaldatum || '',
      confidence: p.confidence || 'gemiddeld',
    }), { headers:{...cors,'Content-Type':'application/json'} })
  } catch(err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status:400, headers:{...cors,'Content-Type':'application/json'} })
  }
})
