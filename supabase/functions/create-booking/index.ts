import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Hercontrole 2026-10-11, punt 3: het publieke formulier schreef rechtstreeks
// met de anon-sleutel in clients/bookings/booking_kentekens/communicatie.
// De honeypot/tijdscontrole zaten enkel in de browser — wie de API direct
// aansprak, kon onbeperkt nepaanvragen indienen, inclusief een conceptmail
// met eigen tekst naar een willekeurig e-mailadres. Deze functie doet dat
// werk nu server-side, met limieten die niet te omzeilen zijn.
const LIMIET_PER_IP_PER_UUR     = 5
const LIMIET_PER_EMAIL_PER_DAG  = 3
const LIMIET_GLOBAAL_PER_UUR    = 40   // normaal volume: ±15 aanvragen per maand
const MAX_GASTEN                = 20

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

class Weigering extends Error {
  constructor(public code: string, msg: string, public status = 400) { super(msg) }
}

async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const tekst = (v: unknown, max: number, verplicht = false): string | null => {
  const s = v == null ? '' : String(v).trim()
  if (!s) { if (verplicht) throw new Weigering('ongeldig', 'Verplicht veld ontbreekt'); return null }
  if (s.length > max) throw new Weigering('ongeldig', 'Veld te lang')
  return s
}
const geheel = (v: unknown, min: number, max: number): number => {
  const n = Number(v ?? 0)
  if (!Number.isInteger(n) || n < min || n > max) throw new Weigering('ongeldig', 'Ongeldig aantal')
  return n
}
const datum = (v: unknown, verplicht = false): string | null => {
  const s = v == null ? '' : String(v)
  if (!s) { if (verplicht) throw new Weigering('ongeldig', 'Datum ontbreekt'); return null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + 'T00:00:00Z')))
    throw new Weigering('ongeldig', 'Ongeldige datum')
  return s
}
const uuid = (v: unknown): string => {
  const s = String(v ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
    throw new Weigering('ongeldig', 'Ongeldige sleutel')
  return s
}
const dagenVanaf = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Methode niet toegelaten' }, 405)

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json().catch(() => { throw new Weigering('ongeldig', 'Ongeldige aanvraag') })
    const k = body?.klant ?? {}
    const b = body?.boeking ?? {}

    // 1. Honeypot: enkel bots vullen het verborgen veld in. Doe alsof het
    //    gelukt is (geen signaal aan de bot), maar schrijf niets weg.
    if (body?.hp) return json({ ok: true })

    // 2. Optionele Cloudflare Turnstile — actief zodra TURNSTILE_SECRET bestaat.
    const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET')
    if (TURNSTILE_SECRET) {
      const tk = body?.turnstile_token
      if (!tk) throw new Weigering('bot', 'Bot-verificatie ontbreekt')
      const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(TURNSTILE_SECRET)}&response=${encodeURIComponent(tk)}`
      }).then(r => r.json()).catch(() => ({ success: false }))
      if (!vr.success) throw new Weigering('bot', 'Bot-verificatie mislukt')
    }

    // 3. Validatie — dezelfde grenzen als de vroegere anon-RLS-policies,
    //    plus alles wat de server zelf moet bepalen (status, bron, bedrag).
    const naam  = tekst(k.naam, 120, true)!
    const email = tekst(k.email, 160, true)!
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Weigering('ongeldig', 'Ongeldig e-mailadres')
    // Sleutels worden door de server aangemaakt, niet uit de aanvraag
    // overgenomen. Enkel de idempotency_key komt van de browser: die moet
    // per paginabezoek stabiel zijn om dubbele inzendingen te herkennen.
    const clientId     = crypto.randomUUID()
    const bookingId    = crypto.randomUUID()
    const checkinToken = crypto.randomUUID()
    const idemKey      = uuid(body?.idempotency_key)

    const klant = {
      id: clientId,
      naam, email,
      telefoon: tekst(k.telefoon, 40),
      id_nummer: tekst(k.id_nummer, 40),
      nummerplaten: tekst(k.nummerplaten, 200),
      geboortedatum: datum(k.geboortedatum),
      nationaliteit: tekst(k.nationaliteit, 80),
      woonplaats: tekst(k.woonplaats, 160),
    }

    const aankomst = datum(b.aankomst, true)!
    const vertrek  = datum(b.vertrek, true)!
    if (vertrek <= aankomst) throw new Weigering('ongeldig', 'Vertrek moet na aankomst liggen')
    const dA = dagenVanaf(aankomst)
    if (dA < -7 || dA > 1095) throw new Weigering('ongeldig', 'Aankomstdatum buiten bereik')
    if (dagenVanaf(vertrek) - dA > 365) throw new Weigering('ongeldig', 'Verblijf te lang')

    const volwassenen = geheel(b.volwassenen, 0, 60)
    const kinderen    = geheel(b.kinderen, 0, 60)
    const baby        = geheel(b.baby, 0, 60)
    const personen = volwassenen + kinderen + baby
    if (personen < 1 || personen > 60) throw new Weigering('ongeldig', 'Ongeldig aantal personen')

    let extraTypeUnits: string | null = null
    if (b.extra_type_units != null && b.extra_type_units !== '') {
      const raw = typeof b.extra_type_units === 'string' ? b.extra_type_units : JSON.stringify(b.extra_type_units)
      if (raw.length > 4000) throw new Weigering('ongeldig', 'Verblijfstypes te lang')
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch { throw new Weigering('ongeldig', 'Ongeldige verblijfstypes') }
      if (!Array.isArray(parsed)) throw new Weigering('ongeldig', 'Ongeldige verblijfstypes')
      extraTypeUnits = raw   // zelfde vorm als voorheen (string in jsonb), dashboard verwacht dat
    }

    const boeking = {
      id: bookingId,
      client_id: klant.id,
      aankomst, vertrek,
      tenten: geheel(b.tenten, 0, 50),
      campers: geheel(b.campers, 0, 50),
      verblijfstype: tekst(b.verblijfstype, 300),
      extra_type_units: extraTypeUnits,
      volwassenen, kinderen, baby,
      honden: geheel(b.honden, 0, 20),
      autos: geheel(b.autos, 0, 50),
      elektriciteit: !!b.elektriciteit,
      nota: tekst(b.nota, 2000),
      // Door de server vastgelegd — nooit uit de aanvraag overgenomen:
      bron: 'website', status: 'aanvraag',
      checkin_token: checkinToken,
      idempotency_key: idemKey,
    }

    const platen = String(k.nummerplaten ?? '').split(/[,;\n]/).map(p => p.trim()).filter(Boolean)
    if (platen.length > 20 || platen.some(p => p.length > 15)) throw new Weigering('ongeldig', 'Ongeldige nummerplaten')

    const gastenIn = Array.isArray(body?.gasten) ? body.gasten : []
    if (gastenIn.length > MAX_GASTEN) throw new Weigering('ongeldig', 'Te veel gasten')
    const gasten = gastenIn.map((g: any, i: number) => ({
      booking_id: bookingId,
      is_hoofdgast: i === 0,
      naam: tekst(g?.naam, 120, true),
      geboortedatum: i === 0 ? datum(g?.geboortedatum) : null,
      nationaliteit: i === 0 ? tekst(g?.nationaliteit, 80) : null,
      id_nummer: i === 0 ? tekst(g?.id_nummer, 40) : null,
      id_consent: i === 0 ? !!g?.id_consent : false,
    }))

    const richtprijs = Number(body?.richtprijs)
    const richtprijsTekst = Number.isFinite(richtprijs) && richtprijs >= 0 && richtprijs < 100000
      ? '€ ' + richtprijs.toFixed(2).replace('.', ',') : null

    // Testmodus: valideert alles maar schrijft niets weg (ook geen teller).
    if (body?.dry_run === true) return json({ ok: true, dry_run: true })

    // 4. Rate limiting — server-side, op gehashte IP en e-mail (geen ruwe
    //    IP-adressen opgeslagen; rijen ouder dan 2 dagen worden opgeruimd).
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'onbekend'
    const ipHash    = await hmacHex(SUPABASE_SERVICE_KEY, 'ip:' + ip)
    const emailHash = await hmacHex(SUPABASE_SERVICE_KEY, 'mail:' + email.toLowerCase())
    const uurGeleden = new Date(Date.now() - 3600_000).toISOString()
    const dagGeleden = new Date(Date.now() - 86400_000).toISOString()

    const tel = async (kolom: string | null, waarde: string | null, sinds: string) => {
      let q = sb.from('aanvraag_pogingen').select('id', { count: 'exact', head: true }).gte('created_at', sinds)
      if (kolom) q = q.eq(kolom, waarde)
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    }
    const [perIp, perEmail, globaal] = await Promise.all([
      tel('ip_hash', ipHash, uurGeleden),
      tel('email_hash', emailHash, dagGeleden),
      tel(null, null, uurGeleden),
    ])
    if (perIp >= LIMIET_PER_IP_PER_UUR || perEmail >= LIMIET_PER_EMAIL_PER_DAG || globaal >= LIMIET_GLOBAAL_PER_UUR)
      throw new Weigering('te_veel', 'Te veel aanvragen — probeer het later opnieuw', 429)

    await sb.from('aanvraag_pogingen').insert({ ip_hash: ipHash, email_hash: emailHash })
    sb.from('aanvraag_pogingen').delete().lt('created_at', new Date(Date.now() - 2 * 86400_000).toISOString()).then(() => {})

    // 5. Wegschrijven. 23505 op idempotency_key = dubbele inzending → succes.
    // Dubbele inzending (zelfde idempotency_key) vóór het aanmaken van de
    // klant afvangen, zodat er geen wees-klantrecord achterblijft.
    const { data: bestaand } = await sb.from('bookings').select('id').eq('idempotency_key', idemKey).maybeSingle()
    if (bestaand) return json({ ok: true, dubbel: true })

    const { error: cErr } = await sb.from('clients').insert(klant)
    if (cErr) throw cErr

    const { error: bErr } = await sb.from('bookings').insert(boeking)
    if (bErr && bErr.code === '23505') {
      await sb.from('clients').delete().eq('id', clientId)
      return json({ ok: true, dubbel: true })
    }
    if (bErr) throw bErr

    if (platen.length) {
      const { error } = await sb.from('booking_kentekens').insert(platen.map(plaat => ({ booking_id: bookingId, plaat })))
      if (error) console.error('booking_kentekens', error)
    }
    if (gasten.length) {
      const { error } = await sb.from('gasten').insert(gasten)
      if (error && error.code !== '23505') console.error('gasten', error)
    }

    // Conceptmail: tekst door de server opgesteld — niet meer vrij invulbaar.
    const { error: mErr } = await sb.from('communicatie').insert({
      booking_id: bookingId, richting: 'uitgaand', status: 'concept',
      template_key: 'bevestiging_aanvraag',
      onderwerp: `Bevestiging aanvraag — ${naam}`,
      inhoud: `Beste ${naam},\n\nBedankt voor je aanvraag bij Camping Cosmopolite van ${aankomst} tot ${vertrek}.\n\n` +
              (richtprijsTekst ? `Richtprijs: ${richtprijsTekst}\n\n` : '') + `Tot binnenkort!\nCamping Cosmopolite`,
    })
    if (mErr) console.error('communicatie', mErr)

    // Het formulier heeft het token nodig voor de optionele ID-upload
    // (guest-upload). Het geeft enkel toegang tot deze ene, nieuwe boeking.
    return json({ ok: true, checkin_token: checkinToken })
  } catch (err) {
    if (err instanceof Weigering) return json({ error: err.message, code: err.code }, err.status)
    console.error('create-booking', err)
    return json({ error: 'Er ging iets mis bij het opslaan', code: 'serverfout' }, 500)
  }
})
