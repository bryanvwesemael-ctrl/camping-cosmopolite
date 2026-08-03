import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type' }

Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ','')
    const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data:{user}, error:uErr } = await sb.auth.getUser(jwt!)
    if (uErr||!user) throw new Error('Niet ingelogd')

    // Controleer of aanvrager admin is
    const { data:role } = await sb.from('user_roles').select('role').eq('user_id',user.id).single()
    if (role?.role!=='admin') throw new Error('Geen beheerdersrechten')

    const { email, role: newRole='staff' } = await req.json()
    if (!email) throw new Error('E-mailadres verplicht')

    // Stuur invite e-mail via Supabase Auth — naar het huidige dashboard,
    // niet het uitgefaseerde /dashboard/ (dat draait nog parallel, maar is
    // niet waar nieuwe gebruikers moeten landen).
    const { data:invited, error:invErr } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: `https://camping-cosmopolite.netlify.app/dashboard-nieuw/`
    })
    if (invErr) throw invErr

    // Sla rol op
    await sb.from('user_roles').upsert({
      user_id: invited.user.id,
      role: newRole,
      invited_by: user.id
    }, { onConflict:'user_id' })

    return new Response(JSON.stringify({ok:true,email:invited.user.email}),
      {headers:{...cors,'Content-Type':'application/json'}})
  } catch(err) {
    return new Response(JSON.stringify({error:String(err.message)}),
      {status:400,headers:{...cors,'Content-Type':'application/json'}})
  }
})
