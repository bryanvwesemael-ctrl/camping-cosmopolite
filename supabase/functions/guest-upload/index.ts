import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gast uploadt eigen ID-foto via de publieke upload-pagina (met check-in token).
// Geen auth vereist — token valideert de identiteit.
// Slaat foto op in id-fotos bucket en maakt een pending gasten-record aan.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { token, image_base64, media_type } = await req.json()
    if (!token) throw new Error('Geen token meegegeven')
    if (!image_base64) throw new Error('Geen afbeelding ontvangen')

    // Token valideren
    const { data: booking } = await sb
      .from('bookings')
      .select('id,volgnummer,clients(naam)')
      .eq('checkin_token', token)
      .maybeSingle()
    if (!booking) throw new Error('Ongeldige of verlopen link')

    // Foto opslaan in id-fotos bucket
    const ext = (media_type||'image/jpeg').split('/')[1]?.replace('jpeg','jpg') || 'jpg'
    const path = `guest-upload/${booking.id}/${Date.now()}.${ext}`
    const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))

    const { error: upErr } = await sb.storage
      .from('id-fotos')
      .upload(path, imageBytes, { contentType: media_type||'image/jpeg', upsert: true })
    if (upErr) throw new Error('Opslaan mislukt: ' + upErr.message)

    // Pending gasten-record aanmaken (naam leeg = nog te scannen door Karen)
    // Controleer eerst of er al een pending record bestaat voor deze boeking
    const { data: existing } = await sb
      .from('gasten')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('naam', '__pending_guest_upload__')
      .maybeSingle()

    if (existing) {
      // Bestaand pending record updaten met nieuwe foto
      await sb.from('gasten').update({ foto_url: path, id_consent: true }).eq('id', existing.id)
    } else {
      // Nieuw pending record
      await sb.from('gasten').insert({
        booking_id: booking.id,
        naam: '__pending_guest_upload__',
        foto_url: path,
        id_consent: true,
        is_hoofdgast: false,
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
