// ============================================================================
// purge-storage — AVG-bewaartermijn voor identiteitsdocumenten
//
// Waarom deze functie bestaat (audit 2026-08-08, bevindingen F-02 en F-16):
// purge_expired_data() probeerde bestanden op te ruimen met
// `delete from storage.objects`. Dat faalt sinds Supabase daar een
// beschermingstrigger op zet, én het zou hoe dan ook alleen de metadata-rij
// wissen — de werkelijke bestandsbytes bleven in de objectopslag staan. Voor
// foto's van identiteitskaarten is dat precies het verkeerde resultaat.
//
// Deze functie doet het wél correct: ze vraagt de databank welke paden weg
// moeten (RPC te_verwijderen_id_bestanden) en verwijdert die via de
// Storage-API met de service role, zodat de bestanden echt verdwijnen.
//
// VEILIGHEID: standaard DROOGLOOP. Zonder { "bevestig": true } wordt er niets
// verwijderd — je krijgt enkel te zien wat er zou gebeuren. Dat is bewust:
// dit wist onomkeerbaar persoonsgegevens.
//
// Toegang: admin-only (is_admin), of de geplande aanroep met de service role.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Autorisatie: enkel een ingelogde admin mag dit handmatig aanroepen.
    // Een aanroep met de service-role-sleutel zelf (geplande job) heeft geen
    // gebruiker en wordt hieronder apart toegelaten.
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const isServiceRole = jwt === SUPABASE_SERVICE_KEY
    if (!isServiceRole) {
      const { data: { user } } = await sb.auth.getUser(jwt)
      if (!user) throw new Error('Niet ingelogd')
      const { data: rol } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
      if (rol?.role !== 'admin') throw new Error('Geen beheerdersrechten')
    }

    const body = await req.json().catch(() => ({}))
    const bevestig      = body.bevestig === true
    const respijtDagen  = Number.isInteger(body.respijt_dagen) ? body.respijt_dagen : 7

    const { data: teWissen, error: rpcErr } =
      await sb.rpc('te_verwijderen_id_bestanden', { p_respijt_dagen: respijtDagen })
    if (rpcErr) throw rpcErr

    const paden: string[] = (teWissen || []).map((r: any) => r.pad).filter(Boolean)
    const perReden: Record<string, number> = {}
    for (const r of (teWissen || [])) perReden[r.reden] = (perReden[r.reden] || 0) + 1

    if (!bevestig) {
      return new Response(JSON.stringify({
        ok: true,
        droogloop: true,
        zou_verwijderen: paden.length,
        per_reden: perReden,
        toelichting: 'Niets verwijderd. Roep opnieuw aan met {"bevestig":true} om echt te wissen.',
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // In blokken verwijderen: de Storage-API heeft een limiet per aanroep.
    let verwijderd = 0
    const fouten: any[] = []
    for (let i = 0; i < paden.length; i += 100) {
      const blok = paden.slice(i, i + 100)
      const { data, error } = await sb.storage.from('id-fotos').remove(blok)
      if (error) { fouten.push({ blok: i / 100, fout: error.message }); continue }
      verwijderd += (data?.length ?? 0)
    }

    // Documentrijen waarvan het bestand nu weg is, ook opruimen.
    if (paden.length) {
      await sb.from('booking_documents').delete().in('storage_path', paden)
    }

    // Spoor nalaten in het audit-logboek. Bewust GEEN bestandspaden loggen:
    // die bevatten boeking-id's en verwijzen naar identiteitsdocumenten.
    await sb.from('audit_logs').insert({
      actie: 'purge_storage',
      entiteit: 'storage.id-fotos',
      bron: 'purge-storage',
      reden: 'AVG-bewaartermijn identiteitsdocumenten',
      nieuwe_waarde: { verwijderd, aangeboden: paden.length, per_reden: perReden, fouten: fouten.length },
    })

    return new Response(JSON.stringify({ ok: true, droogloop: false, verwijderd, aangeboden: paden.length, per_reden: perReden, fouten }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
