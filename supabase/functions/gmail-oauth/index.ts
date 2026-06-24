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

    // 1. Wissel auth code in voor tokens bij Google
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

    // 2. Haal Gmail-adres op
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    // 3. Haal Supabase user_id op uit JWT
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt!)
    if (userErr || !user) throw new Error('Niet ingelogd')

    // 4. Sla tokens op (upsert)
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
