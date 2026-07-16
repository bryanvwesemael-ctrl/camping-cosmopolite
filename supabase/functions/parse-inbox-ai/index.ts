import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// -- Gmail-helpers (zelfde patroon als gmail-sync/send-mail) -----------------
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
async function gmailFetch(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  return res.json()
}
function decodeB64(b64: string): string {
  try { return atob(b64.replace(/-/g, '+').replace(/_/g, '/')) } catch { return '' }
}
function extractBody(payload: any): string {
  if (!payload) return ''
  if (payload.body?.data) return decodeB64(payload.body.data)
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decodeB64(plain.body.data)
    const html = payload.parts.find((p: any) => p.mimeType === 'text/html')
    if (html?.body?.data) return decodeB64(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}
function findAttachments(payload: any, acc: any[] = []): any[] {
  if (!payload) return acc
  if (payload.filename && payload.body?.attachmentId && /pdf|image/.test(payload.mimeType || '')) {
    acc.push({ filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId })
  }
  if (payload.parts) payload.parts.forEach((p: any) => findAttachments(p, acc))
  return acc
}

// -- AI-extractie (zelfde Claude-integratie/patroon als scan-id) -------------
async function classifyAndExtract(anthropicKey: string, subject: string, body: string) {
  const prompt = [
    'Dit is een e-mail die een camping ontving. Bepaal of dit een NIEUWE reservatie-aanvraag is',
    '(geen bevestiging, geen factuur, geen nieuwsbrief, geen spam, geen reeds-lopend gesprek over een bestaande boeking).',
    'Geef UITSLUITEND geldige JSON terug, exact dit formaat:',
    '{"is_reservatie_aanvraag":true|false,"naam":"","aankomst":"YYYY-MM-DD of leeg","vertrek":"YYYY-MM-DD of leeg",',
    '"volwassenen":0,"kinderen":0,"baby":0,"verblijfstype":"tent|camper|onbekend","opmerking":"","confidence":"hoog|gemiddeld|laag"}',
    'Gebruik lege waarden/0 als iets niet vermeld staat. Wees strikt: bij twijfel is_reservatie_aanvraag=false.',
    '', `ONDERWERP: ${subject}`, '', `INHOUD: ${body.slice(0, 3000)}`,
  ].join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error?.message || 'AI-fout')
  const text = data.content?.[0]?.text || ''
  try { return JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]) } catch (_e) { return { is_reservatie_aanvraag: false } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await sb.auth.getUser(jwt!)
    if (!user) throw new Error('Niet ingelogd')

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('AI is niet geconfigureerd (ANTHROPIC_API_KEY ontbreekt).')

    const { data: cfgRow } = await sb.from('club_settings').select('value').eq('key', 'mail_sender_email').maybeSingle()
    const senderEmail = cfgRow?.value
    if (!senderEmail) throw new Error('Geen afzender ingesteld bij Beheer → Mail.')

    const { data: integ } = await sb.from('integrations').select('*').eq('provider', 'gmail').eq('email', senderEmail).maybeSingle()
    if (!integ) throw new Error(`Gmail (${senderEmail}) is nog niet gekoppeld.`)

    let accessToken: string
    try { accessToken = await refreshAccessToken(integ.refresh_token) }
    catch (_e) { throw new Error('Gmail-koppeling verlopen — koppel opnieuw in Beheer → Mail.') }
    await sb.from('integrations').update({ access_token: accessToken, expires_at: new Date(Date.now() + 3599000).toISOString(), updated_at: new Date().toISOString() }).eq('id', integ.id)

    const since = Math.floor((Date.now() - 14 * 86400000) / 1000)
    const listData = await gmailFetch(accessToken, `users/me/messages?maxResults=25&q=${encodeURIComponent(`in:inbox -from:${senderEmail} after:${since}`)}`)
    const messages = listData.messages || []

    let nieuw = 0, overgeslagen = 0
    for (const msg of messages) {
      const { data: existing } = await sb.from('communicatie').select('id').eq('gmail_message_id', msg.id).maybeSingle()
      if (existing) { overgeslagen++; continue }

      const full = await gmailFetch(accessToken, `users/me/messages/${msg.id}?format=full`)
      const headers = full.payload?.headers || []
      const get = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
      const fromHeader = get('From')
      const fromEmail = (fromHeader.match(/<(.+?)>/)?.[1] || fromHeader).toLowerCase().trim()
      const subject = get('Subject') || '(geen onderwerp)'
      const body = extractBody(full.payload)

      let extracted: any
      try { extracted = await classifyAndExtract(anthropicKey, subject, body) }
      catch (_e) { extracted = { is_reservatie_aanvraag: false } }

      const magBoeken = extracted.is_reservatie_aanvraag && extracted.naam && (extracted.aankomst || extracted.vertrek)

      if (!magBoeken) {
        // Loggen zodat we deze mail niet opnieuw verwerken, maar GEEN boeking
        // aanmaken — voorkomt dat nieuwsbrieven/spam het Postvak vervuilen.
        await sb.from('communicatie').insert({
          booking_id: null, richting: 'inkomend', status: 'verzonden', onderwerp: subject,
          inhoud: body.slice(0, 2000), gmail_message_id: msg.id, gmail_thread_id: full.threadId,
        })
        overgeslagen++
        continue
      }

      let aankomst = extracted.aankomst || ''
      let vertrek = extracted.vertrek || ''
      if (aankomst && !vertrek) { const d = new Date(aankomst); d.setDate(d.getDate() + 1); vertrek = d.toISOString().split('T')[0] }
      if (!aankomst && vertrek) aankomst = vertrek

      const isCamper = (extracted.verblijfstype || '').toLowerCase() === 'camper'
      // Als de AI geen volwassenen vond én er ook geen kinderen/baby's vermeld
      // staan, ga uit van minstens 1 volwassene — voorkomt een boeking met 0
      // personen die Karen enkel zou verwarren.
      const heeftJongeren = (extracted.kinderen || 0) + (extracted.baby || 0) > 0
      const volwassenen = extracted.volwassenen || (heeftJongeren ? 0 : 1)

      const { data: existingClient } = await sb.from('clients').select('id').eq('email', fromEmail).maybeSingle()
      let clientId = existingClient?.id
      if (!clientId) {
        const { data: newClient, error: cErr } = await sb.from('clients').insert({ naam: extracted.naam, email: fromEmail }).select('id').single()
        if (cErr) { overgeslagen++; continue }
        clientId = newClient.id
      }

      const { data: booking, error: bErr } = await sb.from('bookings').insert({
        client_id: clientId, aankomst, vertrek,
        tenten: isCamper ? 0 : 1, campers: isCamper ? 1 : 0,
        verblijfstype: isCamper ? 'Camper' : 'Tent',
        volwassenen, kinderen: extracted.kinderen || 0, baby: extracted.baby || 0,
        bron: 'mail', status: 'aanvraag', bedrag_totaal: 0,
        nota: extracted.opmerking || null, ai_draft: true, ai_parsed: extracted,
      }).select('id').single()
      if (bErr) { overgeslagen++; continue }

      await sb.from('communicatie').insert({
        booking_id: booking.id, richting: 'inkomend', status: 'verzonden', onderwerp: subject,
        inhoud: body.slice(0, 2000), gmail_message_id: msg.id, gmail_thread_id: full.threadId,
      })

      // Bijlagen (bv. een pdf-bevestiging) meekoppelen aan de nieuwe conceptboeking.
      const atts = findAttachments(full.payload)
      for (const att of atts.slice(0, 5)) {
        try {
          const attData = await gmailFetch(accessToken, `users/me/messages/${msg.id}/attachments/${att.attachmentId}`)
          if (!attData.data) continue
          const bytes = Uint8Array.from(atob(attData.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
          const path = `mail-bijlagen/${booking.id}/${Date.now()}-${att.filename}`
          const { error: upErr } = await sb.storage.from('booking-fotos').upload(path, bytes, { contentType: att.mimeType })
          if (!upErr) await sb.from('booking_attachments').insert({ booking_id: booking.id, storage_path: path, media_type: att.mimeType, original_filename: att.filename })
        } catch (_e) { /* bijlage overslaan mag de rest niet blokkeren */ }
      }

      nieuw++
    }

    return new Response(JSON.stringify({ ok: true, nieuw, overgeslagen }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
