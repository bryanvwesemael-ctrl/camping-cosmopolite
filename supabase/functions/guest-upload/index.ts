import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MIN_FILE_BYTES = 1024
const MAX_DOCS_PER_BOOKING = 20            // rate limit per boeking
const ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']

// Server-side signatuurcontrole — vertrouw nooit op de meegestuurde media_type.
function sniffMime(b: Uint8Array): string | null {
  if (!b || b.length < 4) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (['heic', 'heix', 'heif', 'mif1', 'msf1', 'hevc'].includes(brand)) return 'image/heic'
  }
  return null
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Gast uploadt identiteitsdocumenten via het formulier of een vervang-link.
// Geen auth vereist — checkin_token valideert de boeking. GEEN AI-aanroep hier:
// AI gebeurt pas wanneer Karen er in het dashboard bewust om vraagt.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json()
    const token = body.token
    // Achterwaarts compatibel: 'documents' (nieuw) of 'images' (oud).
    const docs = Array.isArray(body.documents) ? body.documents
               : Array.isArray(body.images)    ? body.images
               : []

    if (!token) throw new Error('Geen token meegegeven')
    if (!docs.length) throw new Error('Geen documenten ontvangen')

    // Optionele bot-check: enkel actief wanneer TURNSTILE_SECRET is ingesteld.
    const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET')
    if (TURNSTILE_SECRET) {
      const tk = body.turnstile_token
      if (!tk) throw new Error('Bot-verificatie ontbreekt')
      const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(TURNSTILE_SECRET)}&response=${encodeURIComponent(tk)}`
      }).then(r => r.json()).catch(() => ({ success: false }))
      if (!vr.success) throw new Error('Bot-verificatie mislukt')
    }

    const { data: booking } = await sb
      .from('bookings').select('id,volgnummer').eq('checkin_token', token).maybeSingle()
    if (!booking) throw new Error('Ongeldige of verlopen link')

    // Rate limit: bestaand aantal documenten voor deze boeking.
    const { count: existingCount } = await sb
      .from('booking_documents').select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id).is('deleted_at', null)
    if ((existingCount || 0) + docs.length > MAX_DOCS_PER_BOOKING)
      throw new Error('Te veel documenten voor deze boeking')

    const ts = Date.now()
    let count = 0, skipped = 0
    const results: any[] = []

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      const b64 = d.image_base64 || d.base64
      if (!b64) { results.push({ i, ok: false, reason: 'leeg' }); continue }

      let bytes: Uint8Array
      try { bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }
      catch { results.push({ i, ok: false, reason: 'decode_fout' }); continue }

      if (bytes.length < MIN_FILE_BYTES) { results.push({ i, ok: false, reason: 'leeg_of_corrupt' }); continue }
      if (bytes.length > MAX_FILE_BYTES) { results.push({ i, ok: false, reason: 'te_groot' }); continue }

      const mime = sniffMime(bytes)
      if (!mime || !ALLOWED.includes(mime)) { results.push({ i, ok: false, reason: 'type_niet_toegelaten' }); continue }

      const hash = await sha256Hex(bytes)

      // Dedup: zelfde inhoud al aanwezig voor deze boeking? Overslaan (geen dubbele AI later).
      const { data: dup } = await sb.from('booking_documents')
        .select('id').eq('booking_id', booking.id).eq('content_hash', hash).is('deleted_at', null).maybeSingle()
      if (dup) { skipped++; results.push({ i, ok: true, skipped: true }); continue }

      const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1].replace('jpeg', 'jpg')
      const path = `guest-upload/${booking.id}/${ts}-${i}.${ext}`

      const { error: upErr } = await sb.storage.from('id-fotos')
        .upload(path, bytes, { contentType: mime, upsert: true })
      if (upErr) { results.push({ i, ok: false, reason: 'storage_fout' }); continue }

      const { error: insErr } = await sb.from('booking_documents').insert({
        booking_id: booking.id,
        slot_index: d.slot_index ?? i,
        page_index: d.page_index ?? 0,
        storage_path: path,
        media_type: mime,
        file_size: bytes.length,
        content_hash: hash,
        status: 'documenten_ontvangen',
      })
      // Unieke (booking_id, content_hash)-index kan alsnog botsen bij race → als duplicaat tellen.
      if (insErr) { skipped++; results.push({ i, ok: true, skipped: true, note: 'race_dedup' }); continue }

      count++
      results.push({ i, ok: true })
    }

    if (count === 0 && skipped === 0)
      throw new Error('Geen enkel document kon worden opgeslagen')

    return new Response(JSON.stringify({ ok: true, count, skipped, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
