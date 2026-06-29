import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gast uploadt één of meerdere ID-foto's via de publieke upload-pagina.
// Geen auth vereist — checkin_token valideert de boeking.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json()
    const { token, images } = body  // images: [{image_base64, media_type}]

    if (!token) throw new Error('Geen token meegegeven')
    if (!images || !Array.isArray(images) || images.length === 0)
      throw new Error('Geen afbeeldingen ontvangen')

    // Token valideren
    const { data: booking } = await sb
      .from('bookings')
      .select('id,volgnummer')
      .eq('checkin_token', token)
      .maybeSingle()
    if (!booking) throw new Error('Ongeldige of verlopen link')

    const ts = Date.now()
    let count = 0

    for (let i = 0; i < images.length; i++) {
      const { image_base64, media_type } = images[i]
      if (!image_base64) continue

      const ext = (media_type || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
      const path = `guest-upload/${booking.id}/${ts}-${i}.${ext}`
      const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))

      const { error: upErr } = await sb.storage
        .from('id-fotos')
        .upload(path, imageBytes, { contentType: media_type || 'image/jpeg', upsert: true })
      if (upErr) continue  // sla mislukte foto over, ga door

      // Pending record per foto — Karen scant ze daarna met AI
      await sb.from('gasten').insert({
        booking_id: booking.id,
        naam: '__pending_guest_upload__',
        foto_url: path,
        id_consent: true,
        is_hoofdgast: i === 0,
      })
      count++
    }

    if (count === 0) throw new Error('Geen enkele foto kon worden opgeslagen')

    return new Response(JSON.stringify({ ok: true, count }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
