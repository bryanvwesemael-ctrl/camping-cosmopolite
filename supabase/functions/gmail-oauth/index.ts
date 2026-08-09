import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, redirect_uri } = await req.json()

    // Rolcontrole vóór de OAuth-code wordt verzilverd — auditbevinding F-04
    // (2026-08-08). Voorheen kon eender welk ingelogd account hier een Gmail-
    // koppeling aanmaken, zelfs zonder rol in het systeem.
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt!)
    if (userErr || !user) throw new Error('Niet ingelogd')
    const { data: rol } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (!rol || !['admin','staff'].includes(rol.role))
      throw new Error('Geen toegang — je account heeft geen rol in dit systeem.')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (tokens.error) throw new Error(tokens.error_description || tokens.error)

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const { error: upsertErr } = await sb.from('integrations').upsert({
      user_id:       user.id,
      provider:      'gmail',
      email:         profile.email,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
    if (upsertErr) throw upsertErr

    return new Response(JSON.stringify({ ok: true, email: profile.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
