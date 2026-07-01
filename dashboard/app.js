/* ═══════════ HELPERS ═══════════ */
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ═══════════ SUPABASE ═══════════ */
const SUPABASE_URL='https://whubbowuqhjdkdequbmb.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJib3d1cWhqZGtkZXF1Ym1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjM3NTYsImV4cCI6MjA5Nzc5OTc1Nn0.1S-eme0sMmC_25H-XnZ9r3AMKFSSxnpRx3-GRefSyzs';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const pw=document.getElementById('loginPassword').value;
  const msg=document.getElementById('loginMsg');
  if(!email||!email.includes('@')){msg.textContent='⚠️ Vul een geldig e-mailadres in';msg.style.color='var(--red)';return}
  if(!pw){msg.textContent='⚠️ Vul je wachtwoord in';msg.style.color='var(--red)';return}
  msg.style.color='var(--lbl3)';msg.textContent='Bezig…';
  const {error}=await sb.auth.signInWithPassword({email,password:pw});
  if(error){msg.textContent=`⚠️ ${error.message==='Invalid login credentials'?'Ongeldig e-mailadres of wachtwoord':error.message}`;msg.style.color='var(--red)';}
}
async function forgotPassword(){
  const email=document.getElementById('loginEmail').value.trim();
  const msg=document.getElementById('loginMsg');
  if(!email||!email.includes('@')){msg.textContent='⚠️ Vul eerst je e-mailadres in';msg.style.color='var(--red)';return}
  msg.style.color='var(--lbl3)';msg.textContent='Herstelmail versturen…';
  const {error}=await sb.auth.resetPasswordForEmail(email,{
    redirectTo:'https://camping-cosmopolite.netlify.app/dashboard/'
  });
  if(error){msg.textContent='⚠️ '+error.message;msg.style.color='var(--red)';}
  else{msg.textContent='✅ Herstelmail verzonden. Check je inbox (en spam).';msg.style.color='var(--green)';}
}
async function doLogout(){await sb.auth.signOut();location.reload()}

/* ═══════════ MELDINGEN NIEUWE BOEKING ═══════════ */
let notifUnread=0;
// AudioContext wordt één keer aangemaakt via een gebruikersklik (browserregel).
// Zonder die eerste klik blokkeert de browser het geluid.
let _audioCtx=null;
function _ensureAudioCtx(){
  try{
    if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==='suspended')_audioCtx.resume();
  }catch(e){_audioCtx=null;}
  return _audioCtx;
}
function notifSoundOn(){return localStorage.getItem('notifSound')!=='off';}
function audioUnlocked(){return !!_audioCtx&&_audioCtx.state!=='suspended';}
function updateNotifBadge(){
  const b=document.getElementById('notifBadge');if(!b)return;
  if(notifUnread>0){b.textContent=notifUnread>9?'9+':notifUnread;b.style.display='block';}
  else b.style.display='none';
}
function updateSoundIcon(){
  const el=document.getElementById('soundIcon');if(!el)return;
  if(!notifSoundOn()){el.textContent='🔕';return;}
  el.textContent=audioUnlocked()?'🔔':'🔔*'; // * = nog niet geactiveerd
}
function toggleNotifSound(){
  localStorage.setItem('notifSound',notifSoundOn()?'off':'on');
  if(notifSoundOn()){
    _ensureAudioCtx(); // unlock via deze gebruikersklik
    toast('🔔 Meldingsgeluid aan — geluid is nu geactiveerd!');
    playNotifSound();
  }else{
    toast('🔕 Meldingsgeluid uit');
  }
  updateSoundIcon();
}
function playNotifSound(){
  if(!notifSoundOn())return;
  const ctx=_ensureAudioCtx();
  if(!ctx||ctx.state==='suspended')return; // nog niet geactiveerd door gebruiker
  try{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.value=880;
    g.gain.setValueAtTime(.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.25,ctx.currentTime+.02);
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.4);
    o.start();o.stop(ctx.currentTime+.42);
  }catch(e){}
}
function openNewBookings(){
  notifUnread=0;updateNotifBadge();
  activeFilter='aanvraag';
  showView('boekingen',null);
  renderBookingList();
}

// Analytics enkel zichtbaar voor admins (intern gebruik)
let currentUserRole='staff';
async function applyRoleVisibility(session){
  try{
    const {data:roleRow}=await sb.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
    currentUserRole=roleRow?.role||'staff';
  }catch(e){currentUserRole='staff';}
  const isAdmin=currentUserRole==='admin';
  ['nav-analytics','tab-analytics'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.display=isAdmin?'':'none';
  });
}

async function checkSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('appRoot').style.display='block';
    const naam=(session.user.user_metadata?.full_name||session.user.email||'').split(/[\s@]/)[0];
    const greet=document.getElementById('heroGreet');
    if(greet&&naam)greet.textContent=`Goeiedag, ${naam} 👋`;
    await applyRoleVisibility(session);
    updateSoundIcon();updateNotifBadge();
    await loadData();
  }else{
    document.getElementById('loginScreen').style.display='flex';
    document.getElementById('appRoot').style.display='none';
  }
}
sb.auth.onAuthStateChange((_event,_session)=>{checkSession()});

/* ═══════════ REALTIME — live updates (meerdere medewerkers tegelijk) ═══════════ */
// Gedebouncede reload: veel events vlak na elkaar → één reload.
let _rtTimer=null;
function scheduleRealtimeRefresh(){
  clearTimeout(_rtTimer);
  _rtTimer=setTimeout(async()=>{
    await loadData();
    // Als een boekingsdetail openstaat, ook het documentenpaneel/gasten verversen.
    if(activeBookingId && document.getElementById('shDetail')?.classList.contains('on')){
      loadBookingDocuments(activeBookingId); loadGasten(activeBookingId);
    }
  },400);
}
sb.channel('bookings-live')
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'bookings'},payload=>{
    const updated=payload.new;
    const idx=bookings.findIndex(b=>b.id===updated.id);
    const oldStatus=idx>=0?bookings[idx].status:null;
    const naam=idx>=0?(bookings[idx].naam||'Gast'):'Gast';
    if(updated.status==='ingecheckt'&&oldStatus&&oldStatus!=='ingecheckt')
      toast(`🏕️ ${naam.split(' ')[0]} heeft ingecheckt!`);
    if(updated.status==='betaald'&&oldStatus&&oldStatus!=='betaald')
      toast(`💶 Betaling ontvangen van ${naam.split(' ')[0]}!`);
    scheduleRealtimeRefresh();
  })
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'bookings'},()=>{
    notifUnread++; updateNotifBadge(); playNotifSound();
    toast('🔔 Nieuwe reservatie binnengekomen!');
    scheduleRealtimeRefresh();
  })
  .on('postgres_changes',{event:'DELETE',schema:'public',table:'bookings'},()=>scheduleRealtimeRefresh())
  .on('postgres_changes',{event:'*',schema:'public',table:'gasten'},()=>scheduleRealtimeRefresh())
  .on('postgres_changes',{event:'*',schema:'public',table:'booking_documents'},()=>scheduleRealtimeRefresh())
  .subscribe();

// Optimistic locking via compare-and-swap op het version-veld. Als de version
// niet meer klopt (iemand anders wijzigde ondertussen), raakt de update 0 rijen
// → we melden een conflict i.p.v. stil te overschrijven.
async function casUpdateBooking(id, patch, expectedVersion){
  const {data:{user}}=await sb.auth.getUser();
  patch=Object.assign({updated_by:user?.id||null},patch);
  let q=sb.from('bookings').update(patch).eq('id',id);
  if(expectedVersion!=null)q=q.eq('version',expectedVersion);
  const {data,error}=await q.select('id,version');
  if(error)return {ok:false,error};
  if(expectedVersion!=null&&(!data||!data.length))return {ok:false,conflict:true};
  return {ok:true,row:data&&data[0]};
}

/* ═══════════ DATA ═══════════ */
const AV_COLORS=[
  {bg:'#E5F5EE',fg:'#1B7A4F'},{bg:'#EBF4FF',fg:'#0060CC'},
  {bg:'#F3E8FF',fg:'#8B2FC8'},{bg:'#FFF3E5',fg:'#CC7700'},
  {bg:'#FFE8E8',fg:'#CC2A20'},{bg:'#E8EFF5',fg:'#2B5C8A'},
];
const STATUS_META={
  aanvraag:{label:'Aanvraag',cls:'b-aanvraag',icon:'⏳',order:0},
  bevestigd:{label:'Bevestigd',cls:'b-bevestigd',icon:'✅',order:1},
  ingecheckt:{label:'Ingecheckt',cls:'b-ingecheckt',icon:'🏕️',order:2},
  betaald:{label:'Betaald',cls:'b-betaald',icon:'💶',order:3},
  wachtlijst:{label:'Wachtlijst',cls:'b-wacht',icon:'⏸️',order:4},
  geannuleerd:{label:'Geannuleerd',cls:'b-geannuleerd',icon:'🚫',order:5},
};
const BRON_META={
  mail:{label:'E-mail',cls:'b-mail',icon:'📧'},
  website:{label:'Website',cls:'b-website',icon:'🌐'},
  telefoon:{label:'Telefoon',cls:'b-telefoon',icon:'☎️'},
};
const VI={Tent:'⛺',Caravan:'🚐',Camper:'🚌',Stacaravan:'🏠',Safaritent:'🏕️'};
const TODAY=new Date().toISOString().split('T')[0];

/* Prijzen — eenvoudig aanpasbaar op één plek. Safaritent volgt voorlopig
   dezelfde basis als de andere types (basis + per volwassene/kind) —
   te bevestigen met Karen zodra het exacte safaritent-tarief gekend is. */
// Defaults uit de centrale module (shared/pricing.js). Worden bij het laden
// overschreven met de actuele tarieven uit Supabase (settings).
const PRICES=Object.assign({},CampingPricing.DEFAULTS);
/* Delegeert naar de CENTRALE berekening in shared/pricing.js (single source of
   truth). Bouwt de genormaliseerde units en behoudt de dashboard-specifieke
   weergavevelden (stdBasis/extraTypeBasis + per-nacht zonder verbruik). */
function calcPrice(o){
  const extraTypeUnits=o.extraTypeUnits||[];
  const units=[
    {prijs:PRICES.tent,count:o.tenten||0,allIn:false},
    {prijs:PRICES.camper,count:o.campers||0,allIn:false},
    ...extraTypeUnits.map(t=>({prijs:t.prijs,count:t.count||0,allIn:!!t.allIn})),
  ];
  const r=CampingPricing.calc({
    prices:PRICES, units,
    volwassenen:o.volwassenen||0, kinderen:o.kinderen||0, baby:o.baby||0,
    honden:o.honden||0, autos:o.autos||1, elektriciteit:o.elektriciteit,
    nights:Math.max(o.nights||0,0), extraTarieven:extraTarieven||[],
  });
  const stdBasis=(o.tenten||0)*PRICES.tent+(o.campers||0)*PRICES.camper;
  const extraTypeBasis=extraTypeUnits.reduce((s,t)=>(t.count||0)*(t.prijs||0)+s,0);
  // Dashboard toont "per nacht" zonder verbruik (afval/elek staan apart in de lijst)
  return Object.assign({}, r, {
    stdBasis, extraTypeBasis, extraTypeUnits,
    perNacht:CampingPricing.round2(r.dienstenPerNachtExclVerbruik+r.taksPerNacht),
  });
}
function genRef(idOrBooking){
  if(typeof idOrBooking==='object')return idOrBooking.ogm||(idOrBooking.volgnummer?`#${idOrBooking.volgnummer}`:'—');
  const b=bookings.find(x=>x.id===idOrBooking);
  return b?genRef(b):'—';
}

/* Vertaalt het admin-formulier "type" (Tent/Caravan/...) naar de echte
   tenten/campers-kolommen die de gastmodule en database gebruiken. */
function typeToCounts(type){
  const camperTypes=['Caravan','Camper'];
  return camperTypes.includes(type)?{tenten:0,campers:1}:{tenten:1,campers:0};
}
function countsToType(tenten,campers){
  if(campers>0&&tenten===0)return 'Camper';
  if(tenten>0&&campers>0)return 'Tent';
  return 'Tent';
}

let bookings=[];
let activeFilter='alle',activeSource='alle',activeBookingId=null,editingId=null;
let calYear=new Date(TODAY).getFullYear(),calMonth=new Date(TODAY).getMonth();
let fFotoData=null,eFotoData=null,eveningShown=false;
const EVENING_HOUR=20;

/* ═══════════ PRIJZEN UIT DB LADEN ═══════════ */
let extraTarieven=[],accTypes=[];
async function loadPricesFromDB(){
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const {data}=await sb.from('settings').select('key,value').eq('user_id',session.user.id)
    .in('key',['prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby','prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6','toeristentaks','extra_tarieven','accommodatie_types']);
  if(!data)return;
  const pm={};data.forEach(s=>pm[s.key]=s.value);
  const tm={prijs_tent:'tent',prijs_camper:'camper',prijs_volwassene:'volwassene',prijs_kind:'kind',prijs_baby:'baby',prijs_hond:'hond',prijs_extra_auto:'extraAuto',prijs_elektriciteit:'elektriciteit',prijs_afval_per_6:'afvalPer6',toeristentaks:'toeristentaks'};
  Object.entries(tm).forEach(([k,pk])=>{if(pm[k]!=null)PRICES[pk]=parseFloat(pm[k])||PRICES[pk];});
  if(pm.extra_tarieven){try{extraTarieven=JSON.parse(pm.extra_tarieven)||[];}catch(e){extraTarieven=[];}}
  if(pm.accommodatie_types){try{accTypes=JSON.parse(pm.accommodatie_types)||[];}catch(e){accTypes=[];}}
  updateNieuwBoekingLabels();
  renderVerblijfTypesNB();
}
function updateNieuwBoekingLabels(){
  const set=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
  set('lblPrijsTent',`€${PRICES.tent}/nacht`);
  set('lblPrijsCamper',`€${PRICES.camper}/nacht`);
  set('lblPrijsVolw',`€${PRICES.volwassene}/nacht + €${PRICES.toeristentaks} taks`);
  set('lblPrijsKind',`€${PRICES.kind}/nacht`);
  set('lblPrijsBaby',PRICES.baby>0?`€${PRICES.baby}/nacht`:'gratis');
  set('lblPrijsHond',`€${PRICES.hond}/hond/nacht`);
  set('lblPrijsAuto',`1e gratis, +€${PRICES.extraAuto}/extra/nacht`);
  set('lblPrijsElek',`+€${PRICES.elektriciteit}/nacht`);
}

/* ═══════════ LADEN UIT SUPABASE ═══════════ */
async function loadData(){
  await loadPricesFromDB();
  const {data,error}=await sb.from('bookings').select('*,clients(*)').order('aankomst',{ascending:true});
  if(error){toast('⚠️ Kon data niet laden: '+error.message);return}
  bookings=(data||[]).map(row=>{
    const c=row.clients||{};
    const type=row.verblijfstype||countsToType(row.tenten||0,row.campers||0);
    return{
      id:row.id, volgnummer:row.volgnummer, ogm:row.ogm_referentie,
      clientId:c.id, naam:c.naam||'(onbekend)', email:c.email, telefoon:c.telefoon,
      plaat:c.nummerplaten||'', id_kaart:!!c.id_nummer, idnr:c.id_nummer,
      geboortedatum:c.geboortedatum, nationaliteit:c.nationaliteit, woonplaats:c.woonplaats,
      fotoPath:c.id_foto_url||null, foto:null,
      personen:(row.volwassenen||0)+(row.kinderen||0)+(row.baby||0),
      volwassenen:row.volwassenen||0, kinderen:row.kinderen||0, baby:row.baby||0,
      aankomst:row.aankomst, vertrek:row.vertrek, type,
      tenten:row.tenten||0, campers:row.campers||0,
      extraTypeUnits:(()=>{try{return typeof row.extra_type_units==='string'?JSON.parse(row.extra_type_units):(row.extra_type_units||[]);}catch(e){return[];}})(),
      status:row.status, bron:row.bron, bedrag:row.bedrag_totaal||0, version:row.version,
      nota:row.nota||'', honden:row.honden||0, autos:row.autos||1,
      hond:(row.honden||0)>0, extraAuto:(row.autos||0)>1,
      elektriciteit:!!row.elektriciteit,
      controle:{id:!!row.controle_id,kenteken:!!row.controle_kenteken,personen:!!row.controle_personen},
    };
  });
  // Foto's: signed urls ophalen voor wie er een heeft (privé bucket)
  bookings.filter(b=>b.fotoPath).forEach(async b=>{
    const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(b.fotoPath,3600);
    if(s?.signedUrl){b.foto=s.signedUrl;
      const img=document.querySelector(`img[data-foto-for="${b.id}"]`);
      if(img){img.src=s.signedUrl;img.classList.add('show')}
    }
  });
  renderDashboard();renderBookingList();renderWieIsEr();
  if(document.getElementById('view-kalender').classList.contains('on')){if(calViewMode==='maand')renderCalendar_monthView();else renderCalendar();}
  if(document.getElementById('view-analytics').classList.contains('on'))renderAnalytics();
  if(document.getElementById('view-mail').classList.contains('on'))loadMailView();
  checkEveningAlert();
}

/* ═══════════ HELPERS ═══════════ */
function avColor(id){
  let h=0;const s=String(id);
  for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0}
  return AV_COLORS[Math.abs(h)%AV_COLORS.length]
}
function fmtDate(d){if(!d)return'—';const[y,m,day]=d.split('-');return`${day}/${m}`}
function fmtDateLong(d){
  if(!d)return'—';
  const months=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const[y,m,day]=d.split('-');return`${parseInt(day)} ${months[parseInt(m)-1]} ${y}`
}
function nightCount(a,v){return Math.round((new Date(v)-new Date(a))/86400000)}
function isOnsite(b){return b.aankomst<=TODAY&&b.vertrek>TODAY&&(b.status==='ingecheckt'||b.status==='betaald')}
function avHtml(b,size=44,radius=14){
  const c=avColor(b.id);
  const init=b.naam.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return`<div class="av" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${c.bg};color:${c.fg};">${init}</div>`
}

/* ═══════════ VIEW ═══════════ */
function showView(id,dtEl){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  document.getElementById('view-'+id).classList.add('on');
  document.querySelectorAll('.ti[id^="tab-"]').forEach(t=>{t.classList.remove('on');t.querySelector('svg').style.stroke='#8E8E93'});
  const tab=document.getElementById('tab-'+id);
  if(tab){tab.classList.add('on');tab.querySelector('svg').style.stroke='var(--green)'}
  document.querySelectorAll('.dt').forEach(d=>d.classList.remove('on'));
  if(dtEl)dtEl.classList.add('on');
  else document.querySelectorAll('.dt').forEach(d=>{if(d.textContent.toLowerCase().includes(id.substr(0,4)))d.classList.add('on')});
  if(id==='overzicht')renderDashboard();
  if(id==='boekingen')renderBookingList();
  if(id==='kalender')renderCalendar();
  if(id==='analytics')renderAnalytics();
  if(id==='wieiser')renderWieIsEr();
  if(id==='register'){const rd=document.getElementById('registerDate');if(!rd.value)rd.value=TODAY;renderRegister(rd.value)}
  if(id==='instellingen'){loadSettings();switchSettingsPage(_lastSettingsPage||'mail');}
}
let _lastSettingsPage='mail';

/* ═══════════ SHEETS ═══════════ */
function openSheet(id){document.getElementById(id).classList.add('on')}
function closeSheet(id){document.getElementById(id).classList.remove('on')}
function closeSheetOnOverlay(e,id){if(e.target===document.getElementById(id))closeSheet(id)}

/* ═══════════ TOAST ═══════════ */
let _tt;
function toast(msg){
  const el=document.getElementById('toastEl');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),2200)
}

/* ═══════════ FILTERS ═══════════ */
function openSearch(){showView('boekingen',null);setTimeout(()=>document.getElementById('searchInput').focus(),200)}
function setFilter(val,el){activeFilter=val;document.querySelectorAll('.fc').forEach(f=>f.classList.remove('on'));el.classList.add('on');renderBookingList()}
function setSourceFilter(val,el){activeSource=val;document.querySelectorAll('.sp').forEach(p=>p.classList.remove('on'));el.classList.add('on');renderBookingList()}

/* ═══════════ BOOKING ROW ═══════════ */
function bookingRowHtml(b){
  const sm=STATUS_META[b.status];const bm=BRON_META[b.bron]||{};
  const nights=nightCount(b.aankomst,b.vertrek);
  const borderColor={aanvraag:'#FF9500',bevestigd:'#34C759',ingecheckt:'#007AFF',betaald:'#5856D6',geannuleerd:'#FF3B30',wachtlijst:'#8E8E93'}[b.status]||'transparent';
  const verblijfParts=[];
  if((b.tenten||0)>0)verblijfParts.push(`⛺ ${b.tenten} tent${b.tenten>1?'en':''}`);
  if((b.campers||0)>0)verblijfParts.push(`🚐 ${b.campers} camper${b.campers>1?'s':''}`);
  const verblijf=verblijfParts.join(' + ')||`⛺ ${b.type}`;
  const hasRealEmail=b.email&&!b.email.includes('@cosmopolite.local');
  const contactLine=hasRealEmail
    ?`<div style="font-size:11px;color:var(--lbl4);margin-top:2px;">✉️ ${b.email}${b.telefoon?` · ☎️ ${b.telefoon}`:''}</div>`
    :b.status==='aanvraag'?`<div style="font-size:11px;color:#FF9500;margin-top:2px;font-weight:600;">⚠️ Geen e-mail — bevestiging niet mogelijk</div>`:
    b.telefoon?`<div style="font-size:11px;color:var(--lbl4);margin-top:2px;">☎️ ${b.telefoon}</div>`:'';
  return`<div class="bk-row" id="bkr-${b.id}" onclick="openBookingDetail('${b.id}')" style="border-left:3px solid ${borderColor};padding-left:13px;">
    ${avHtml(b)}
    <div class="bk-mid">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="bk-name" style="margin:0;">${b.naam}</span>
        <span style="color:var(--lbl4);font-size:11px;">#${b.volgnummer??'—'}</span>
        <span class="badge ${sm.cls}" style="padding:1px 7px;font-size:10px;" onclick="quickStatus(event,'${b.id}')" title="Tik om te wijzigen">${sm.icon} ${sm.label}</span>
      </div>
      <div class="bk-meta" style="margin-top:3px;">📅 ${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)} <span class="bk-sep">·</span> ${nights}n <span class="bk-sep">·</span> ${b.personen}p <span class="bk-sep">·</span> ${verblijf}${b.bron?`<span class="bk-sep">·</span>${bm.icon||''}`:''}</div>
      ${contactLine}
    </div>
    <div class="bk-right" style="align-items:flex-end;">
      ${b.bedrag?`<span style="font-size:13px;color:var(--lbl1);font-weight:700;">€${b.bedrag}</span>`:'<span style="font-size:11px;color:var(--lbl4);">—</span>'}
    </div>
    <svg class="chev" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="#C7C7CC" stroke-width="1.5" stroke-linecap="round"/></svg>
  </div>`
}

/* ═══════════ DASHBOARD ═══════════ */
function renderDashboard(){
  document.getElementById('tTotal').textContent=bookings.length;
  const onsite=bookings.filter(isOnsite);
  document.getElementById('tOnsite').textContent=onsite.length;
  document.getElementById('tPending').textContent=bookings.filter(b=>b.status==='aanvraag').length;
  document.getElementById('tPaid').textContent=bookings.filter(b=>b.status==='betaald').length;
  document.getElementById('chMail').textContent=bookings.filter(b=>b.bron==='mail').length;
  document.getElementById('chWeb').textContent=bookings.filter(b=>b.bron==='website').length;
  document.getElementById('chTel').textContent=bookings.filter(b=>b.bron==='telefoon').length;

  // Onsite header
  document.getElementById('onsiteTitle').textContent=onsite.length?`🟢 Wie is er nu? (${onsite.length})`:'🔴 Wie is er nu?';

  // Onsite cards
  const os=document.getElementById('onsiteScroll');
  if(!onsite.length){
    os.innerHTML='<div class="oc-none">Niemand is momenteel ingecheckt</div>';
  }else{
    os.innerHTML=onsite.map(b=>{
      const c=avColor(b.id);const vi2=VI[b.type]||'⛺';
      const nights=nightCount(b.aankomst,b.vertrek);
      return`<div class="oc" onclick="openBookingDetail('${b.id}')">
        <div class="oc-header" style="background:${c.bg};"><span>${vi2}</span><div class="oc-pulse"></div></div>
        <div class="oc-body">
          <div class="oc-name">${b.naam.split(' ')[0]}</div>
          <div class="oc-meta">${b.personen} pers · ${nights} nachten<br>${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)}</div>
          <span class="oc-badge oc-badge-in">✓ Aanwezig</span>
        </div>
      </div>`
    }).join('')
  }

  // Recent list — enkel openstaande aanvragen
  const openAanvragen=bookings.filter(b=>b.status==='aanvraag');
  const recentEl=document.getElementById('recentList');
  if(recentEl){
    if(!openAanvragen.length){
      recentEl.innerHTML='<div style="padding:18px;text-align:center;color:var(--lbl3);font-size:13px;">✅ Geen openstaande aanvragen</div>';
    }else{
      recentEl.innerHTML=openAanvragen.slice(-5).reverse().map(bookingRowHtml).join('');
    }
  }
  // Presence preview
  const prs=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  document.getElementById('presencePreview').textContent=prs.length?`${prs.length} gast${prs.length>1?'en':''} aanwezig`:'Geen gasten aanwezig';
}

/* ═══════════ BOOKING LIST ═══════════ */
function renderBookingList(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const filtered=bookings.filter(b=>{
    if(q&&!(b.naam+b.plaat+b.email).toLowerCase().includes(q))return false;
    if(activeFilter!=='alle'&&b.status!==activeFilter)return false;
    if(activeSource!=='alle'&&b.bron!==activeSource)return false;
    return true;
  });
  const list=document.getElementById('bkList');
  if(!filtered.length){list.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">Geen resultaten</div><div class="empty-sub">Pas de filters aan</div></div>';return}

  // Aanvragen bovenaan als aparte actie-sectie
  const aanvragen=filtered.filter(b=>b.status==='aanvraag');
  const rest=filtered.filter(b=>b.status!=='aanvraag');
  let html='';
  if(aanvragen.length&&(activeFilter==='alle'||activeFilter==='aanvraag')){
    html+=`<div style="padding:12px 16px 6px;font-size:11px;font-weight:800;color:#FF9500;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;">
      <span style="background:#FF9500;color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;">${aanvragen.length}</span> Openstaande aanvragen — actie vereist
    </div>`;
    html+=aanvragen.map(b=>{
      const nights=nightCount(b.aankomst,b.vertrek);
      const hasRealEmail=b.email&&!b.email.includes('@cosmopolite.local');
      return`<div style="background:#FFFBF2;border-left:3px solid #FF9500;padding:12px 14px 12px 15px;margin:0 8px 6px;border-radius:12px;display:flex;gap:10px;align-items:flex-start;">
        ${avHtml(b,40,12)}
        <div style="flex:1;min-width:0;" onclick="openBookingDetail('${b.id}')" class="cursor-ptr">
          <div style="font-size:14px;font-weight:700;color:var(--lbl1);">${b.naam} <span style="color:var(--lbl4);font-weight:400;font-size:11px;">#${b.volgnummer??'—'}</span></div>
          <div style="font-size:12px;color:var(--lbl3);margin-top:2px;">📅 ${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)} · ${nights}n · ${b.personen}p · €${b.bedrag||'?'}</div>
          ${hasRealEmail?`<div style="font-size:11px;color:var(--lbl4);margin-top:2px;">✉️ ${b.email}</div>`:'<div style="font-size:11px;color:#FF9500;font-weight:600;margin-top:2px;">⚠️ Geen e-mailadres</div>'}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
          <button onclick="accepteerAanvraag('${b.id}')" style="padding:7px 12px;background:#34C759;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">✅ Accepteren</button>
          <button onclick="weigerAanvraag('${b.id}')" style="padding:7px 12px;background:#FF3B30;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">❌ Weigeren</button>
        </div>
      </div>`
    }).join('');
    if(rest.length&&activeFilter==='alle'){
      html+=`<div style="padding:12px 16px 6px;font-size:11px;font-weight:800;color:var(--lbl3);text-transform:uppercase;letter-spacing:.5px;">Alle boekingen</div>`;
    }
  }
  html+=rest.map(bookingRowHtml).join('');
  list.innerHTML=html;
}

async function accepteerAanvraag(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const {error}=await sb.from('bookings').update({status:'bevestigd'}).eq('id',id);
  if(error){toast('⚠️ Fout: '+error.message);return}
  b.status='bevestigd';
  renderBookingList();renderDashboard();
  toast('✅ Boeking bevestigd');
  // Automatisch bevestigingsmail sturen als er een e-mailadres is
  const hasRealEmail=b.email&&!b.email.includes('@cosmopolite.local');
  if(hasRealEmail) sendAutoMail(id,'bevestiging');
}
async function weigerAanvraag(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm(`Aanvraag van ${b.naam} weigeren en verwijderen?`))return;
  const {error}=await sb.from('bookings').delete().eq('id',id);
  if(error){toast('⚠️ Fout: '+error.message);return}
  bookings=bookings.filter(x=>x.id!==id);
  renderBookingList();renderDashboard();
  toast('❌ Aanvraag geweigerd en verwijderd');
}

/* ═══════════ DETAIL SHEET ═══════════ */
function openBookingDetail(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  activeBookingId=id;
  const sm=STATUS_META[b.status];const bm=BRON_META[b.bron]||{};
  const nights=nightCount(b.aankomst,b.vertrek);
  const ctrl=b.controle||{id:false,kenteken:false,personen:false};
  document.getElementById('shDetailTitle').textContent=b.naam.split(' ')[0];
  const benodigdheden=[b.hond?'🐕 Hond':'',b.extraAuto?'🚙 Extra auto':'',b.elektriciteit?'⚡ Elektriciteit':''].filter(Boolean).join(' · ')||'—';
  document.getElementById('shDetailBody').innerHTML=`
    <div style="padding:16px 16px 0;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        ${avHtml(b,52,16)}
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:800;color:var(--lbl1);line-height:1.2;">${b.naam}</div>
          <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
            <span class="badge ${sm.cls}">${sm.icon} ${sm.label}</span>
            <span style="font-size:12px;color:var(--lbl4);font-weight:600;">#${b.volgnummer??'—'}</span>
            <span style="font-size:12px;color:var(--lbl3);">${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)} · ${nights}n</span>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:var(--green-soft);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;font-weight:700;color:var(--green-deep);text-transform:uppercase;letter-spacing:.4px;">Bedrag</div>
          <div style="font-size:20px;font-weight:800;color:var(--green-deep);">€${b.bedrag||'—'}</div>
        </div>
        <div style="background:#F2F2F7;border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;">Personen</div>
          <div style="font-size:20px;font-weight:800;color:var(--lbl1);">${b.personen}p</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:4px;">
        <button class="da da-g" onclick="openStatusSheet('${b.id}')"><span class="da-icon">🔄</span>Status</button>
        <button class="da da-o" onclick="openEditSheet('${b.id}')"><span class="da-icon">✏️</span>Bewerken</button>
        <button class="da da-b" onclick="prepareMail('${b.id}')"><span class="da-icon">📧</span>Mail</button>
        <button class="da da-r" onclick="deleteBooking('${b.id}')"><span class="da-icon">🗑</span>Verwijder</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">
        <button class="da da-g" onclick="sendAutoMail('${b.id}','bevestiging')"><span class="da-icon">✉️</span>Bevestig</button>
        <button class="da" style="background:rgba(255,149,0,.1);color:#FF9500;" onclick="sendAutoMail('${b.id}','herinnering')"><span class="da-icon">🔔</span>Reminder</button>
        <button class="da da-b" onclick="stuurBetaallink('${b.id}')"><span class="da-icon">💳</span>Betalen</button>
        <button class="da" style="background:rgba(88,86,214,.1);color:#5856D6;" onclick="toonQR('${b.id}')"><span class="da-icon">📱</span>QR</button>
      </div>
    </div>

    <!-- TABS -->
    <div style="display:flex;border-bottom:1.5px solid var(--sep);padding:0 16px;" id="detailTabs">
      <button onclick="switchDetailTab('info')" id="dtab-info" style="flex:1;padding:10px 4px;font-size:13px;font-weight:700;border:none;background:none;cursor:pointer;color:var(--green);border-bottom:2.5px solid var(--green);margin-bottom:-1.5px;">Info</button>
      <button onclick="switchDetailTab('gasten')" id="dtab-gasten" style="flex:1;padding:10px 4px;font-size:13px;font-weight:700;border:none;background:none;cursor:pointer;color:var(--lbl3);border-bottom:2.5px solid transparent;margin-bottom:-1.5px;">👥 Gasten</button>
      <button onclick="switchDetailTab('mail')" id="dtab-mail" style="flex:1;padding:10px 4px;font-size:13px;font-weight:700;border:none;background:none;cursor:pointer;color:var(--lbl3);border-bottom:2.5px solid transparent;margin-bottom:-1.5px;">📧 Mail</button>
    </div>

    <!-- TAB: INFO -->
    <div id="dtab-content-info" style="padding:14px 16px;">
      <div class="detail-rows" style="margin-bottom:14px;">
        <div class="detail-r"><span class="dr-k">E-mail</span><span class="dr-v">${b.email||'—'}</span></div>
        <div class="detail-r"><span class="dr-k">Telefoon</span><span class="dr-v">${b.telefoon||'—'}</span></div>
        <div class="detail-r"><span class="dr-k">ID-nummer</span><span class="dr-v">${b.idnr||'—'}</span></div>
        <div class="detail-r"><span class="dr-k">Nummerplaat</span><span class="dr-v">${b.plaat||'—'}</span></div>
        <div class="detail-r"><span class="dr-k">Aankomst</span><span class="dr-v">${fmtDateLong(b.aankomst)}</span></div>
        <div class="detail-r"><span class="dr-k">Vertrek</span><span class="dr-v">${fmtDateLong(b.vertrek)}</span></div>
        <div class="detail-r"><span class="dr-k">Type</span><span class="dr-v">${VI[b.type]||''} ${b.type}</span></div>
        <div class="detail-r"><span class="dr-k">Extra's</span><span class="dr-v">${benodigdheden}</span></div>
        <div class="detail-r"><span class="dr-k">Kanaal</span><span class="dr-v">${bm.icon||''} ${bm.label||'—'}</span></div>
        <div class="detail-r"><span class="dr-k">Betaalref.</span><span class="dr-v" style="font-size:11px;font-family:monospace;">${genRef(b)}</span></div>
        ${b.nota?`<div class="detail-r"><span class="dr-k">Nota</span><span class="dr-v">${b.nota}</span></div>`:''}
      </div>
      <button onclick="openDateChangeModal('${b.id}')" style="width:100%;padding:10px;margin-bottom:14px;background:rgba(0,122,255,.08);color:#007AFF;border:1.5px solid rgba(0,122,255,.3);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">📅 Datums wijzigen / verlengen (met herprijzing)</button>
      <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">💶 Betaling</div>
      <div id="paymentInfo" style="margin-bottom:16px;">Laden…</div>
      <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">✅ Controle bij aankomst</div>
      <div class="ctrl-list">
        <div class="ctrl-item"><input type="checkbox" id="ctrlId" ${ctrl.id?'checked':''} onchange="toggleControle('${b.id}','id',this.checked)"><label for="ctrlId">ID-kaart gecontroleerd</label></div>
        <div class="ctrl-item"><input type="checkbox" id="ctrlKent" ${ctrl.kenteken?'checked':''} onchange="toggleControle('${b.id}','kenteken',this.checked)"><label for="ctrlKent">Nummerplaat genoteerd</label></div>
        <div class="ctrl-item"><input type="checkbox" id="ctrlPers" ${ctrl.personen?'checked':''} onchange="toggleControle('${b.id}','personen',this.checked)"><label for="ctrlPers">Aantal personen bevestigd</label></div>
      </div>
    </div>

    <!-- TAB: GASTEN & ID -->
    <div id="dtab-content-gasten" style="display:none;padding:14px 16px;">
      <div style="font-size:12px;color:var(--lbl3);margin-bottom:10px;line-height:1.5;">Wettelijk verplicht reizigersregister (KB 27/04/2007). De gast uploadt de ID-documenten; jij leest ze hieronder bewust in met AI en bevestigt de gegevens.</div>

      <!-- ID-DOCUMENTEN PANEEL (bewuste AI-gate) -->
      <div id="docPanel" style="margin-bottom:16px;">Documenten laden…</div>

      <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin:14px 0 8px;">👥 Geregistreerde gasten</div>
      <div id="gastenList">Laden…</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        <button onclick="openBulkGastenSheet('${b.id}',${b.volwassenen||0},${b.kinderen||0},${b.baby||0})" style="padding:9px;background:var(--bg2);color:var(--lbl1);border:1.5px solid var(--sep);border-radius:var(--r-sm);font-size:12.5px;font-weight:700;cursor:pointer;">✏️ Handmatig (bulk)</button>
        <button onclick="openAddGuestSheet('${b.id}')" style="padding:9px;background:var(--bg2);color:var(--lbl1);border:1.5px solid var(--sep);border-radius:var(--r-sm);font-size:12.5px;font-weight:700;cursor:pointer;">+ Individueel</button>
      </div>
    </div>

    <!-- TAB: MAIL -->
    <div id="dtab-content-mail" style="display:none;padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">📤 Snel versturen</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">
        <button onclick="openMailSendSheet('${b.id}','bevestiging')" style="padding:10px;background:rgba(27,138,91,.1);color:var(--green);border:1.5px solid var(--green);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">✅ Bevestigingsmail</button>
        <button onclick="openMailSendSheet('${b.id}','herinnering')" style="padding:10px;background:rgba(255,149,0,.1);color:#FF9500;border:1.5px solid #FF9500;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🔔 Herinnering</button>
        <button onclick="openMailSendSheet('${b.id}','betaling')" style="padding:10px;background:rgba(88,86,214,.1);color:#5856D6;border:1.5px solid #5856D6;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">💶 Betaalverzoek</button>
        <button onclick="openMailSendSheet('${b.id}','uitchecken')" style="padding:10px;background:rgba(0,122,255,.1);color:#007AFF;border:1.5px solid #007AFF;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">👋 Uitchecken</button>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">📬 Communicatiehistoriek</div>
      <div id="commHistory">Laden…</div>
      <div style="margin-top:16px;padding:12px;background:var(--bg);border:1.5px solid var(--sep);border-radius:10px;text-align:center;">
        <div style="font-size:12px;color:var(--lbl3);">Templates beheren → <button onclick="closeSheet('shDetail');showView('mail',null);setTimeout(()=>switchMailSeg('templates'),200)" style="background:none;border:none;color:var(--green);font-weight:700;cursor:pointer;font-size:12px;">Mail → Templates ↗</button></div>
      </div>
      <div id="mailTemplateBlocksDetail" style="display:none;"></div>
      <span id="mailTplMsg" style="display:none;"></span>
    </div>
    <div style="height:24px;"></div>`;

  openSheet('shDetail');
  loadCommHistory(b.id);
  loadGasten(b.id);
  loadBookingDocuments(b.id);
  loadPaymentInfo(b.id);
}

async function loadPaymentInfo(bookingId){
  const el=document.getElementById('paymentInfo');if(!el)return;
  const b=bookings.find(x=>x.id===bookingId);
  const totaal=Number(b?.bedrag||0);
  const {data}=await sb.from('payments').select('bedrag,status,created_at').eq('booking_id',bookingId).order('created_at');
  const betaaldRows=(data||[]).filter(p=>p.status==='paid');
  const betaald=betaaldRows.reduce((s,p)=>s+Number(p.bedrag||0),0);
  const open=Math.round((totaal-betaald)*100)/100;
  const pct=totaal>0?Math.min(100,Math.round(betaald/totaal*100)):0;
  const volledig=open<=0.005;

  el.innerHTML=`
    <div style="background:var(--card);border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,.07);padding:14px 16px;margin-bottom:4px;">
      <!-- Bedragenoverzicht -->
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:11px;color:var(--lbl3);font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Totaal</div>
          <div style="font-size:17px;font-weight:800;color:var(--lbl1);">€${totaal.toFixed(2)}</div>
        </div>
        <div style="flex:1;background:rgba(27,138,91,.08);border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:11px;color:var(--green);font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Betaald</div>
          <div style="font-size:17px;font-weight:800;color:var(--green);">€${betaald.toFixed(2)}</div>
        </div>
        <div style="flex:1;background:${volledig?'rgba(27,138,91,.08)':'rgba(255,59,48,.07)'};border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:11px;color:${volledig?'var(--green)':'#FF3B30'};font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Open</div>
          <div style="font-size:17px;font-weight:800;color:${volledig?'var(--green)':'#FF3B30'};">${volledig?'✅':'€'+Math.max(0,open).toFixed(2)}</div>
        </div>
      </div>
      <!-- Voortgangsbalk -->
      <div style="height:8px;background:var(--sep);border-radius:4px;overflow:hidden;margin-bottom:6px;">
        <div style="height:100%;width:${pct}%;background:${volledig?'var(--green)':'linear-gradient(90deg,var(--green),#22C55E)'};border-radius:4px;transition:width .6s;"></div>
      </div>
      <div style="font-size:11px;color:var(--lbl3);text-align:right;margin-bottom:10px;">${pct}% betaald</div>
      <!-- Betalingshistoriek -->
      ${betaaldRows.length?`<div style="margin-bottom:10px;">${betaaldRows.map(p=>`
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--lbl3);padding:3px 0;">
          <span>💳 Mollie — ${new Date(p.created_at).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})}</span>
          <span style="color:var(--green);font-weight:700;">+€${Number(p.bedrag).toFixed(2)}</span>
        </div>`).join('')}</div>`:''}
      <!-- Actieknop -->
      ${!volledig
        ?`<button onclick="stuurBetaallink('${bookingId}')" style="width:100%;padding:11px;background:linear-gradient(135deg,#5856D6,#7C3AED);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">💳 ${betaald>0?'Bijbetaling':'Betaallink'} sturen — €${Math.max(0,open).toFixed(2)}</button>`
        :`<div style="text-align:center;font-size:13px;color:var(--green);font-weight:700;padding:6px 0;">✅ Volledig betaald — geen openstaand saldo</div>`}
    </div>`;
}
function switchDetailTab(tab){
  ['info','gasten','mail'].forEach(t=>{
    document.getElementById('dtab-content-'+t).style.display=t===tab?'block':'none';
    const btn=document.getElementById('dtab-'+t);
    if(btn){btn.style.color=t===tab?'var(--green)':'var(--lbl3)';btn.style.borderBottomColor=t===tab?'var(--green)':'transparent';}
  });
  if(tab==='mail')loadMailTemplatesForDetail();
}
function toggleMailTemplatesInDetail(){
  const wrap=document.getElementById('mailTplDetailWrap');
  const arrow=document.getElementById('mailTplToggleArrow');
  if(!wrap)return;
  const open=wrap.style.display==='none';
  wrap.style.display=open?'block':'none';
  if(arrow)arrow.textContent=open?'▴':'▾';
}
async function loadMailTemplatesForDetail(){
  const el=document.getElementById('mailTemplateBlocksDetail');if(!el)return;
  const {data:{session}}=await sb.auth.getSession();
  const {data:rows}=await sb.from('settings').select('key,value').eq('user_id',session.user.id).like('key','mailtemplate_%');
  MAIL_TYPES.forEach(t=>{
    const raw=rows?.find(r=>r.key==='mailtemplate_'+t.key)?.value;
    try{mailTemplates[t.key]=JSON.parse(raw||'[]')}catch(e){mailTemplates[t.key]=[]}
    if(!mailTemplates[t.key].length)mailTemplates[t.key]=t.defaultVarianten||[{onderwerp:t.defaultOnderwerp,inhoud:t.defaultInhoud}];
  });
  renderMailTemplateBlocksDetail();
}
function renderMailTemplateBlocksDetail(){
  const el=document.getElementById('mailTemplateBlocksDetail');if(!el)return;
  el.innerHTML=MAIL_TYPES.map(t=>{
    const tpls=mailTemplates[t.key]||[];
    const tplHtml=tpls.map((tpl,i)=>`
      <div style="border:1px solid var(--sep);border-radius:10px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--lbl3);">Variant ${i+1}</span>
          ${tpls.length>1?`<button onclick="verwijderMailVariantDetail('${t.key}',${i})" style="background:none;border:none;color:#FF3B30;font-size:13px;cursor:pointer;">🗑</button>`:''}
        </div>
        <input class="cfg-full-input" placeholder="Onderwerp…" value="${(tpl.onderwerp||'').replace(/"/g,'&quot;')}" oninput="mailTemplates['${t.key}'][${i}].onderwerp=this.value" style="margin-bottom:8px;">
        <textarea class="cfg-full-input" rows="5" placeholder="Inhoud…" style="resize:vertical;line-height:1.5;font-size:12.5px;" oninput="mailTemplates['${t.key}'][${i}].inhoud=this.value">${tpl.inhoud||''}</textarea>
      </div>`).join('');
    return`<div style="font-size:12px;font-weight:800;color:${t.color};margin:16px 0 8px;">${t.label}</div>
      ${tplHtml}
      <button onclick="voegMailVariantToeDetail('${t.key}')" style="width:100%;padding:8px;background:none;border:1.5px dashed ${t.color};color:${t.color};border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:4px;">+ Variant toevoegen</button>`;
  }).join('');
}
function voegMailVariantToeDetail(key){
  const t=MAIL_TYPES.find(x=>x.key===key);
  mailTemplates[key].push({onderwerp:t?.defaultOnderwerp||'',inhoud:''});
  renderMailTemplateBlocksDetail();
}
function verwijderMailVariantDetail(key,i){
  mailTemplates[key].splice(i,1);
  if(!mailTemplates[key].length){const t=MAIL_TYPES.find(x=>x.key===key);mailTemplates[key]=[{onderwerp:t?.defaultOnderwerp||'',inhoud:''}];}
  renderMailTemplateBlocksDetail();
}
async function loadCommHistory(bookingId){
  const el=document.getElementById('commHistory');if(!el)return;
  const {data,error}=await sb.from('communicatie').select('*').eq('booking_id',bookingId).order('created_at',{ascending:false});
  if(error){el.innerHTML='<div style="color:var(--lbl4);font-size:13px;">Kon geschiedenis niet laden</div>';return}
  if(!data||!data.length){el.innerHTML='<div style="color:var(--lbl4);font-size:13px;">Nog geen e-mails voor deze boeking</div>';return}
  const STMETA={concept:{lbl:'📝 Concept',color:'var(--lbl3)'},verzonden:{lbl:'✅ Verzonden',color:'var(--green)'},mislukt:{lbl:'⚠️ Mislukt',color:'var(--red)'}};
  el.innerHTML=data.map(c=>{
    const st=STMETA[c.status]||{lbl:c.status,color:'var(--lbl4)'};
    const richting=c.richting==='inkomend'?'📩 Ontvangen':'📤 Verstuurd';
    const id=`cmh-${c.id}`;
    return`<div style="border:1px solid var(--sep);border-radius:12px;margin-bottom:8px;overflow:hidden;">
      <div style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="toggleCommBody('${id}')">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--lbl1);">${c.onderwerp||'(geen onderwerp)'}</div>
          <div style="font-size:11px;color:var(--lbl4);margin-top:2px;">${richting} · ${new Date(c.created_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${st.color};flex-shrink:0;margin-left:8px;">${st.lbl}</span>
      </div>
      <div id="${id}" style="display:none;padding:0 14px 12px;font-size:12px;color:var(--lbl2);white-space:pre-wrap;line-height:1.6;border-top:.5px solid var(--sep);padding-top:10px;">${c.inhoud||'(geen inhoud)'}</div>
    </div>`}).join('')
}
function toggleCommBody(id){
  const el=document.getElementById(id);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

/* ═══════════ MAIL TEMPLATES BEHEER ═══════════ */
const MAIL_TYPES=[
  {key:'bevestiging',label:'✅ Bevestigingsmail',icon:'✅',color:'var(--green)',
   defaultVarianten:[
    {onderwerp:'Reservatiebevestiging — Camping Cosmopolite',inhoud:`Beste {{voornaam}},\n\nJe reservatie is bevestigd! ✅\n\nAankomst: {{aankomst}}\nVertrek: {{vertrek}}\nNachten: {{nachten}}\nPersonen: {{personen}}\nBedrag: {{bedrag}}\nOGM-mededeling: {{ogm}}\n\nWe kijken ernaar uit je te verwelkomen!\nCamping Cosmopolite`},
    {onderwerp:'Je boeking is in orde ✅ — Camping Cosmopolite',inhoud:`Dag {{voornaam}},\n\nGoed nieuws! We hebben je reservatie ontvangen en bevestigd.\n\n📅 {{aankomst}} → {{vertrek}} ({{nachten}} nachten)\n👥 {{personen}} personen\n💶 Te betalen: {{bedrag}}\n🔢 Betalingsreferentie: {{ogm}}\n\nVragen? Antwoord gerust op deze mail.\n\nTot binnenkort!\nTeam Camping Cosmopolite`},
    {onderwerp:'Welkom bij Camping Cosmopolite — Bevestiging',inhoud:`Hallo {{voornaam}},\n\nWe zijn blij dat je voor Camping Cosmopolite hebt gekozen! 🏕️\n\nHier zijn je reservatiedetails:\n• Aankomst: {{aankomst}}\n• Vertrek: {{vertrek}} ({{nachten}} nachten)\n• Aantal personen: {{personen}}\n• Totaal: {{bedrag}}\n• Betaalreferentie: {{ogm}}\n\nWe verwelkomen je graag!\nCamping Cosmopolite`},
   ],
   defaultOnderwerp:'Reservatiebevestiging — Camping Cosmopolite',
   defaultInhoud:`Beste {{voornaam}},\n\nJe reservatie is bevestigd! ✅\n\nAankomst: {{aankomst}}\nVertrek: {{vertrek}}\nBedrag: {{bedrag}}\nOGM: {{ogm}}\n\nTot dan!\nCamping Cosmopolite`},
  {key:'herinnering',label:'🔔 Herinnering',icon:'🔔',color:'#FF9500',
   defaultVarianten:[
    {onderwerp:'Herinnering — Jouw verblijf nadert! 🏕️',inhoud:`Beste {{voornaam}},\n\nEen vriendelijke herinnering: je verblijf bij Camping Cosmopolite begint op {{aankomst}}!\n\n💶 Bedrag: {{bedrag}}\n🔢 Betaalreferentie: {{ogm}}\n\nTot snel!\nCamping Cosmopolite`},
    {onderwerp:'Nog even geduld — je vakantie begint binnenkort!',inhoud:`Hallo {{voornaam}},\n\nNog even en het is zover! 🎉 Je verblijf bij Camping Cosmopolite start op {{aankomst}}.\n\nVergeet niet:\n• Betaalreferentie: {{ogm}}\n• Te betalen bedrag: {{bedrag}}\n\nZie je binnenkort!\nTeam Camping Cosmopolite`},
   ],
   defaultOnderwerp:'Herinnering — Jouw verblijf nadert!',
   defaultInhoud:`Beste {{voornaam}},\n\nJe verblijf begint op {{aankomst}}.\nBedrag: {{bedrag}} · OGM: {{ogm}}\n\nTot dan!\nCamping Cosmopolite`},
  {key:'betaling',label:'💶 Betaalverzoek',icon:'💶',color:'#5856D6',
   defaultVarianten:[
    {onderwerp:'Betaalverzoek — Camping Cosmopolite',inhoud:`Beste {{voornaam}},\n\nGraag ontvangen wij de betaling voor je verblijf ({{aankomst}} → {{vertrek}}).\n\n💶 Bedrag: {{bedrag}}\n🔢 Mededeling: {{ogm}}\n\nBetaal bij voorkeur 14 dagen voor aankomst.\nBedankt!\nCamping Cosmopolite`},
    {onderwerp:'Betalingsherinnering — je verblijf op {{aankomst}}',inhoud:`Dag {{voornaam}},\n\nWe sturen je een vriendelijke herinnering om het verblijfsbedrag over te maken:\n\n• Bedrag: {{bedrag}}\n• Mededeling: {{ogm}}\n• Verblijf: {{aankomst}} → {{vertrek}}\n\nVragen? Antwoord gerust!\nTeam Camping Cosmopolite`},
   ],
   defaultOnderwerp:'Betaalverzoek — Camping Cosmopolite',
   defaultInhoud:`Beste {{voornaam}},\n\nGraag {{bedrag}} overmaken met mededeling {{ogm}}.\n\nBedankt!\nCamping Cosmopolite`},
  {key:'uitchecken',label:'👋 Uitchecken',icon:'👋',color:'#007AFF',
   defaultVarianten:[
    {onderwerp:'Tot ziens! Bedankt voor je verblijf 🏕️',inhoud:`Beste {{voornaam}},\n\nBedankt voor je verblijf bij Camping Cosmopolite van {{aankomst}} tot {{vertrek}}!\n\nWe hopen dat je genoten hebt en verwelkomen je graag opnieuw. 🌟\n\nLaat gerust een recensie achter als je tevreden was!\n\nVriendelijke groeten,\nCamping Cosmopolite`},
    {onderwerp:'We hopen tot ziens — Camping Cosmopolite',inhoud:`Hallo {{voornaam}},\n\nJe verblijf bij ons zit er op — we hopen dat je je hebt vermaakt! 😊\n\nHeb je een momentje? We stellen een korte review erg op prijs.\nTot een volgende keer!\n\nCamping Cosmopolite`},
   ],
   defaultOnderwerp:'Tot ziens! — Camping Cosmopolite',
   defaultInhoud:`Beste {{voornaam}},\n\nBedankt voor je verblijf!\nTot een volgende keer.\n\nCamping Cosmopolite`},
];
let mailTemplates={};// {bevestiging:[{onderwerp,inhoud},...], ...}

/* ═══ MAIL SEGMENT (pagina) ═══ */
function switchMailSeg(seg){
  const isMails=seg==='mails';
  document.getElementById('ms-mails').style.background=isMails?'var(--green)':'transparent';
  document.getElementById('ms-mails').style.color=isMails?'#fff':'var(--lbl2)';
  document.getElementById('ms-mails').style.borderColor=isMails?'var(--green)':'var(--sep)';
  document.getElementById('ms-templates').style.background=isMails?'transparent':'var(--green)';
  document.getElementById('ms-templates').style.color=isMails?'var(--lbl2)':'#fff';
  document.getElementById('ms-templates').style.borderColor=isMails?'var(--sep)':'var(--green)';
  document.getElementById('mailMailsWrap').style.display=isMails?'block':'none';
  document.getElementById('mailTemplatesWrap').style.display=isMails?'none':'block';
  if(!isMails)loadMailTemplatesPage();
}
async function loadMailTemplatesPage(){
  const el=document.getElementById('mailTemplateBlocksPage');if(!el)return;
  el.innerHTML='<div style="padding:20px;text-align:center;color:var(--lbl3);font-size:13px;">Laden…</div>';
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const {data:rows}=await sb.from('settings').select('key,value').eq('user_id',session.user.id).like('key','mailtemplate_%');
  MAIL_TYPES.forEach(t=>{
    const raw=rows?.find(r=>r.key==='mailtemplate_'+t.key)?.value;
    try{mailTemplates[t.key]=JSON.parse(raw||'[]');}catch(e){mailTemplates[t.key]=[];}
    if(!mailTemplates[t.key].length)mailTemplates[t.key]=t.defaultVarianten||[{onderwerp:t.defaultOnderwerp,inhoud:t.defaultInhoud}];
  });
  renderMailTemplateBlocksPage();
}
// Actieve edit-staat per type: {typeKey: variantIndex|null}
const _tplEditState={};

function renderMailTemplateBlocksPage(){
  const el=document.getElementById('mailTemplateBlocksPage');if(!el)return;
  const PREVIEW_VARS={voornaam:'Jan',aankomst:'26 jun 2026',vertrek:'28 jun 2026',nachten:'2',personen:'4',bedrag:'€ 178,50',ogm:'+++123/4567/89012+++'};
  function previewFill(str){return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>`<span style="background:rgba(27,138,91,.15);color:var(--green);border-radius:3px;padding:0 3px;font-weight:700;">${PREVIEW_VARS[k]||'{{'+k+'}}'}</span>`);}
  el.innerHTML=MAIL_TYPES.map(t=>{
    const variants=mailTemplates[t.key]||[];
    const editIdx=_tplEditState[t.key]??null;
    const isEditing=editIdx!==null;
    const ev=isEditing?variants[editIdx]:null;
    return `<div style="border:1.5px solid var(--sep);border-radius:16px;overflow:hidden;margin-bottom:18px;">
      <!-- Type header -->
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg2);border-bottom:1.5px solid var(--sep);">
        <div style="width:36px;height:36px;border-radius:10px;background:${t.color}22;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${t.icon||'📧'}</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:800;color:var(--lbl1);">${t.label}</div>
          <div style="font-size:11px;color:var(--lbl3);">${variants.length} variant${variants.length!==1?'en':''} · systeem kiest willekeurig</div>
        </div>
        <button onclick="voegMailVariantToePage('${t.key}')" style="padding:6px 10px;border-radius:8px;background:${t.color}22;color:${t.color};border:1.5px solid ${t.color}44;font-size:12px;font-weight:700;cursor:pointer;">+ Variant</button>
      </div>
      <!-- Varianten lijst (altijd zichtbaar) -->
      <div style="padding:10px 12px;">
        ${variants.map((v,vi)=>`
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:${editIdx===vi?t.color+'18':'var(--bg2)'};border:1.5px solid ${editIdx===vi?t.color+'66':'var(--sep)'};margin-bottom:6px;cursor:pointer;" onclick="tplSelectVariant('${t.key}',${vi})">
            <div style="width:22px;height:22px;border-radius:50%;background:${t.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;">${vi+1}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12.5px;font-weight:700;color:var(--lbl1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(v.onderwerp)||'(geen onderwerp)'}</div>
              <div style="font-size:11px;color:var(--lbl3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml((v.inhoud||'').split('\n')[0])}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button onclick="event.stopPropagation();tplPreviewVariant('${t.key}',${vi})" style="padding:4px 7px;border-radius:6px;background:rgba(0,122,255,.1);color:#007AFF;border:none;font-size:11px;cursor:pointer;">👁 Preview</button>
              ${variants.length>1?`<button onclick="event.stopPropagation();verwijderMailVariantPage('${t.key}',${vi})" style="padding:4px 7px;border-radius:6px;background:rgba(255,59,48,.1);color:var(--red);border:none;font-size:11px;cursor:pointer;">✕</button>`:''}
            </div>
          </div>`).join('')}
      </div>
      <!-- Editor (alleen zichtbaar als editIdx != null) -->
      ${isEditing&&ev?`
      <div style="border-top:1.5px solid var(--sep);padding:12px 14px;background:var(--bg);">
        <div style="font-size:11px;font-weight:700;color:${t.color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">✏️ Variant ${editIdx+1} bewerken</div>
        <div style="font-size:10.5px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">Onderwerp</div>
        <input id="tplInpOnderwerp_${t.key}" value="${escHtml(ev.onderwerp)}" placeholder="Onderwerp van de mail…"
          oninput="mailTemplates['${t.key}'][${editIdx}].onderwerp=this.value"
          style="width:100%;padding:9px 11px;border-radius:9px;border:1.5px solid ${t.color}66;background:var(--bg2);font-size:13px;font-weight:600;color:var(--lbl1);box-sizing:border-box;outline:none;margin-bottom:10px;">
        <div style="font-size:10.5px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">Inhoud</div>
        <textarea id="tplInpInhoud_${t.key}" rows="8"
          oninput="mailTemplates['${t.key}'][${editIdx}].inhoud=this.value"
          style="width:100%;padding:10px 12px;border-radius:9px;border:1.5px solid ${t.color}66;background:var(--bg2);font-size:13px;color:var(--lbl1);resize:vertical;box-sizing:border-box;outline:none;line-height:1.6;font-family:inherit;">${escHtml(ev.inhoud)}</textarea>
        <div style="font-size:11px;color:var(--lbl3);margin:6px 0 10px;">
          Variabelen: <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{voornaam}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{aankomst}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{vertrek}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{nachten}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{personen}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{bedrag}}</code>
          <code style="background:var(--bg2);padding:1px 4px;border-radius:4px;font-size:11px;">{{ogm}}</code>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="tplPreviewVariant('${t.key}',${editIdx})" style="flex:1;padding:9px;background:rgba(0,122,255,.1);color:#007AFF;border:1.5px solid rgba(0,122,255,.3);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">👁 Preview</button>
          <button onclick="slaMailTemplatesOpPage('${t.key}')" style="flex:2;padding:9px;background:var(--green);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">💾 Opslaan</button>
        </div>
      </div>`:''}
    </div>`;
  }).join('');
}
function tplSelectVariant(typeKey,vi){
  _tplEditState[typeKey]=(_tplEditState[typeKey]===vi)?null:vi;
  renderMailTemplateBlocksPage();
}
function tplPreviewVariant(typeKey,vi){
  const v=(mailTemplates[typeKey]||[])[vi];if(!v)return;
  const DEMO={voornaam:'Jan',aankomst:'26 jun 2026',vertrek:'28 jun 2026',nachten:'2',personen:'4',bedrag:'€ 178,50',ogm:'+++123/4567/89012+++'};
  function fill(s){return(s||'').replace(/\{\{(\w+)\}\}/g,(_,k)=>DEMO[k]||'{{'+k+'}}');}
  const t=MAIL_TYPES.find(x=>x.key===typeKey)||{};
  const body=document.getElementById('tplPreviewModal');
  if(!body)return;
  document.getElementById('tplPreviewTitle').textContent='Preview: '+t.label;
  document.getElementById('tplPreviewSubject').textContent=fill(v.onderwerp);
  document.getElementById('tplPreviewBody').innerHTML=fill(v.inhoud).replace(/\n/g,'<br>');
  body.style.display='flex';
}
function voegMailVariantToePage(typeKey){
  const t=MAIL_TYPES.find(x=>x.key===typeKey);
  if(!mailTemplates[typeKey])mailTemplates[typeKey]=[];
  const dv=(t?.defaultVarianten||[])[0]||{onderwerp:'',inhoud:''};
  mailTemplates[typeKey].push({onderwerp:dv.onderwerp,inhoud:dv.inhoud});
  renderMailTemplateBlocksPage();
}
function verwijderMailVariantPage(typeKey,idx){
  if(!mailTemplates[typeKey]||mailTemplates[typeKey].length<=1)return;
  mailTemplates[typeKey].splice(idx,1);
  renderMailTemplateBlocksPage();
}
async function slaMailTemplatesOpPage(typeKey){
  const msg=document.getElementById('mailTplPageMsg');
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const types=typeKey?MAIL_TYPES.filter(t=>t.key===typeKey):MAIL_TYPES;
  for(const t of types){
    await sb.from('settings').upsert({user_id:session.user.id,key:'mailtemplate_'+t.key,value:JSON.stringify(mailTemplates[t.key]||[])},{onConflict:'user_id,key'});
  }
  toast('✅ Templates opgeslagen');
  if(msg){msg.textContent='✅ Opgeslagen';setTimeout(()=>msg.textContent='',2000);}
}

async function loadMailTemplates(){
  const el=document.getElementById('mailTemplateBlocks');if(!el)return;
  const {data:{session}}=await sb.auth.getSession();
  const {data:rows}=await sb.from('settings').select('key,value').eq('user_id',session.user.id).like('key','mailtemplate_%');
  MAIL_TYPES.forEach(t=>{
    const raw=rows?.find(r=>r.key==='mailtemplate_'+t.key)?.value;
    try{mailTemplates[t.key]=JSON.parse(raw||'[]')}catch(e){mailTemplates[t.key]=[]}
    if(!mailTemplates[t.key].length)mailTemplates[t.key]=t.defaultVarianten||[{onderwerp:t.defaultOnderwerp,inhoud:t.defaultInhoud}];
  });
  renderMailTemplateBlocks();
}
function renderMailTemplateBlocks(){
  const el=document.getElementById('mailTemplateBlocks');if(!el)return;
  el.innerHTML=MAIL_TYPES.map(t=>{
    const tpls=mailTemplates[t.key]||[];
    const tplHtml=tpls.map((tpl,i)=>`
      <div style="border:1px solid var(--sep);border-radius:10px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--lbl3);">Variant ${i+1}</span>
          ${tpls.length>1?`<button onclick="verwijderMailVariant('${t.key}',${i})" style="background:none;border:none;color:#FF3B30;font-size:13px;cursor:pointer;">🗑 Verwijder</button>`:''}
        </div>
        <input class="cfg-full-input" placeholder="Onderwerp…" value="${(tpl.onderwerp||'').replace(/"/g,'&quot;')}" oninput="mailTemplates['${t.key}'][${i}].onderwerp=this.value" style="margin-bottom:8px;">
        <textarea class="cfg-full-input" rows="6" placeholder="Inhoud…" style="resize:vertical;line-height:1.5;font-size:12.5px;" oninput="mailTemplates['${t.key}'][${i}].inhoud=this.value">${tpl.inhoud||''}</textarea>
      </div>`).join('');
    return`<div class="cfg-section-label" style="margin-top:20px;">${t.label}</div>
      <div style="font-size:12px;color:var(--lbl3);margin-bottom:8px;">Meerdere varianten → het systeem kiest willekeurig bij het versturen.</div>
      ${tplHtml}
      <button onclick="voegMailVariantToe('${t.key}')" style="width:100%;padding:8px;background:none;border:1.5px dashed ${t.color};color:${t.color};border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:4px;">+ Variant toevoegen</button>`;
  }).join('');
}
function voegMailVariantToe(key){
  const t=MAIL_TYPES.find(x=>x.key===key);
  mailTemplates[key].push({onderwerp:t?.defaultOnderwerp||'',inhoud:''});
  renderMailTemplateBlocks();
}
function verwijderMailVariant(key,i){
  mailTemplates[key].splice(i,1);
  if(!mailTemplates[key].length){const t=MAIL_TYPES.find(x=>x.key===key);mailTemplates[key]=[{onderwerp:t?.defaultOnderwerp||'',inhoud:''}];}
  renderMailTemplateBlocks();
}
async function slaMailTemplatesOp(){
  const btn=document.getElementById('mailTplMsg');
  if(btn)btn.textContent='Opslaan…';
  try{
    const {data:{session}}=await sb.auth.getSession();
    for(const t of MAIL_TYPES){
      await sb.from('settings').upsert({user_id:session.user.id,key:'mailtemplate_'+t.key,value:JSON.stringify(mailTemplates[t.key]),updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
    }
    if(btn){btn.textContent='✅ Opgeslagen!';btn.style.color='var(--green)';setTimeout(()=>{btn.textContent='';},3000);}
  }catch(err){if(btn){btn.textContent='⚠️ '+err.message;btn.style.color='var(--red)';}}
}

/* ═══════════ MAIL SEND SHEET ═══════════ */
let _mailSendCtx={};
async function openMailSendSheet(bookingId, type){
  const b=bookings.find(x=>x.id===bookingId);if(!b)return;
  const {voornaam}=splitNaam(b.naam);
  const nights=nightCount(b.aankomst,b.vertrek);
  const vars={
    voornaam,
    aankomst:fmtDateLong(b.aankomst),
    vertrek:fmtDateLong(b.vertrek),
    nachten:nights,
    personen:b.personen||'',
    bedrag:`€${b.bedrag||'?'}`,
    ogm:genRef(b),
    plaatsnummer:b.plaatsnummer||'—',
  };
  // Laad templates uit settings
  const {data:{session}}=await sb.auth.getSession();
  const {data:rows}=await sb.from('settings').select('key,value').eq('user_id',session.user.id).like('key','mailtemplate_%');
  const keyMap={'bevestiging':'mailtemplate_bevestiging','herinnering':'mailtemplate_herinnering','betaling':'mailtemplate_betaling','uitchecken':'mailtemplate_uitchecken'};
  const key=keyMap[type]||('mailtemplate_'+type);
  const raw=rows?.find(r=>r.key===key)?.value;
  let templates=[];
  try{templates=JSON.parse(raw||'[]')}catch(e){}
  if(!templates.length){
    // Default templates per type
    const defaults={
      bevestiging:{onderwerp:'Reservatiebevestiging — Camping Cosmopolite',inhoud:`Beste {{voornaam}},\n\nJe reservatie bij Camping Cosmopolite is bevestigd! ✅\n\nAankomst: {{aankomst}}\nVertrek: {{vertrek}}\nNachten: {{nachten}}\nPersonen: {{personen}}\nBedrag: {{bedrag}}\nBetaalreferentie (OGM): {{ogm}}\n\nWij kijken ernaar uit je te ontvangen!\n\nVriendelijke groeten,\nCamping Cosmopolite`},
      herinnering:{onderwerp:'Herinnering — Jouw verblijf nadert!',inhoud:`Beste {{voornaam}},\n\nEen vriendelijke herinnering — je verblijf bij Camping Cosmopolite begint op {{aankomst}}.\n\nVertrek: {{vertrek}}\nBedrag te betalen: {{bedrag}} (OGM: {{ogm}})\n\nTot dan!\nCamping Cosmopolite`},
      betaling:{onderwerp:'Betalingsverzoek — Camping Cosmopolite',inhoud:`Beste {{voornaam}},\n\nGraag ontvangen wij de betaling van {{bedrag}} voor jouw verblijf ({{aankomst}} → {{vertrek}}).\n\nGebruik als mededeling: {{ogm}}\n\nBedankt!\nCamping Cosmopolite`},
      uitchecken:{onderwerp:'Tot ziens! — Camping Cosmopolite',inhoud:`Beste {{voornaam}},\n\nBedankt voor je verblijf bij Camping Cosmopolite! We hopen je snel weer te verwelkomen.\n\nVriendelijke groeten,\nCamping Cosmopolite`},
    };
    templates=[defaults[type]||{onderwerp:'',inhoud:''}];
  }
  // Kies willekeurig template
  const picked=templates[Math.floor(Math.random()*templates.length)];
  function fillVars(str){return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'')}
  const onderwerp=fillVars(picked.onderwerp);
  const inhoud=fillVars(picked.inhoud);
  _mailSendCtx={bookingId,type,onderwerp,inhoud,vars,templates,picked};

  const TYPE_NL={bevestiging:'Bevestigingsmail',herinnering:'Herinnering',betaling:'Betaalverzoek',uitchecken:'Uitchecken'};
  document.getElementById('shMailSendTitle').textContent=`📧 ${TYPE_NL[type]||type} — ${voornaam}`;
  document.getElementById('mailSendTo').textContent=b.email||'(geen e-mail)';
  document.getElementById('mailSendOnderwerp').value=onderwerp;
  document.getElementById('mailSendInhoud').value=inhoud;
  document.getElementById('mailSendTemplateInfo').textContent=templates.length>1?`Template ${templates.indexOf(picked)+1}/${templates.length} (willekeurig gekozen)`:'1 template';
  openSheet('shMailSend');
}
async function verzendMailSend(){
  const btn=document.getElementById('mailSendBtn');
  const msg=document.getElementById('mailSendMsg');
  btn.disabled=true;btn.textContent='Versturen…';
  const onderwerp=document.getElementById('mailSendOnderwerp').value.trim();
  const inhoud=document.getElementById('mailSendInhoud').value.trim();
  if(!onderwerp||!inhoud){msg.textContent='⚠️ Vul onderwerp en inhoud in';msg.style.color='var(--red)';btn.disabled=false;btn.textContent='📤 Versturen';return}
  const b=bookings.find(x=>x.id===_mailSendCtx.bookingId);
  if(!b?.email||b.email.includes('@cosmopolite.local')){msg.textContent='⚠️ Geen geldig e-mailadres voor deze boeking';msg.style.color='var(--red)';btn.disabled=false;btn.textContent='📤 Versturen';return}
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(`${SUPABASE_URL}/functions/v1/send-mail`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({booking_id:_mailSendCtx.bookingId,to:b.email,onderwerp,inhoud,type:_mailSendCtx.type}),
    });
    const d=await res.json();
    if(d.error)throw new Error(d.error);
    msg.textContent='✅ Mail verstuurd!';msg.style.color='var(--green)';
    setTimeout(()=>{closeSheet('shMailSend');loadCommHistory(_mailSendCtx.bookingId)},1200);
  }catch(err){msg.textContent='⚠️ '+err.message;msg.style.color='var(--red)';}
  finally{btn.disabled=false;btn.textContent='📤 Versturen';}
}
async function toggleControle(id,key,val){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!b.controle)b.controle={id:false,kenteken:false,personen:false};
  b.controle[key]=val;
  const col={id:'controle_id',kenteken:'controle_kenteken',personen:'controle_personen'}[key];
  const {error}=await sb.from('bookings').update({[col]:val}).eq('id',id);
  if(error){toast('⚠️ Opslaan mislukt');return}
  if(b.controle.id&&b.controle.kenteken&&b.controle.personen)toast('✅ Controle volledig afgerond')
}

/* ═══════════ MAIL VOORBEREIDEN ═══════════ */
let mailText='',mailSubject='',mailTemplateKey='bevestiging';
const MAIL_TEMPLATES={
  bevestiging:{
    subject:b=>`Bevestiging reservatie — Camping Cosmopolite #${b.volgnummer??''}`,
    body:b=>{const nights=nightCount(b.aankomst,b.vertrek);return`Beste ${splitNaam(b.naam).voornaam},

Bedankt voor je reservatie bij Camping Cosmopolite!

Verblijf: ${b.type} (${VI[b.type]||''})
Aankomst: ${fmtDateLong(b.aankomst)}
Vertrek: ${fmtDateLong(b.vertrek)} (${nights} nacht${nights===1?'':'en'})
Aantal personen: ${b.personen}
Totaalbedrag: €${b.bedrag}
Betaalreferentie: ${genRef(b)}

Gelieve het bedrag te betalen met bovenstaande referentie zodat we je betaling snel kunnen verwerken.

Tot binnenkort!
Camping Cosmopolite`}
  },
  checkin:{
    subject:b=>`Check-in informatie — Camping Cosmopolite #${b.volgnummer??''}`,
    body:b=>`Beste ${splitNaam(b.naam).voornaam},

Je verblijf bij Camping Cosmopolite komt eraan! Hier de praktische info voor je aankomst:

Aankomst: ${fmtDateLong(b.aankomst)}
Vertrek: ${fmtDateLong(b.vertrek)}
Aantal personen: ${b.personen}

Gelieve volgende zaken klaar te hebben bij check-in:
- Identiteitskaart of paspoort van alle gasten (wettelijk verplicht voor registratie)
- Nummerplaat van je voertuig
- Eventuele bevestiging van betaling

Tot binnenkort!
Camping Cosmopolite`
  },
  herinnering:{
    subject:b=>`Betalingsherinnering — Camping Cosmopolite #${b.volgnummer??''}`,
    body:b=>`Beste ${splitNaam(b.naam).voornaam},

We hebben nog geen betaling ontvangen voor je reservatie bij Camping Cosmopolite.

Totaalbedrag: €${b.bedrag}
Betaalreferentie: ${genRef(b)}

Gelieve het bedrag zo snel mogelijk te betalen met bovenstaande referentie. Heb je al betaald? Dan mag je deze mail negeren.

Met vriendelijke groeten,
Camping Cosmopolite`
  },
  bedankt:{
    subject:b=>`Bedankt voor je verblijf — Camping Cosmopolite`,
    body:b=>`Beste ${splitNaam(b.naam).voornaam},

Bedankt om bij Camping Cosmopolite te verblijven! We hopen dat je een fijne tijd hebt gehad.

We zouden het erg appreciëren als je een review zou achterlaten. Tot een volgende keer!

Met vriendelijke groeten,
Camping Cosmopolite`
  }
};
function prepareMail(id,templateKey){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  activeBookingId=id;
  mailTemplateKey=templateKey||'bevestiging';
  document.getElementById('mailTemplateSelect').value=mailTemplateKey;
  const tpl=MAIL_TEMPLATES[mailTemplateKey];
  mailSubject=tpl.subject(b);mailText=tpl.body(b);
  document.getElementById('mailBoxText').textContent=mailText;
  closeSheet('shDetail');openSheet('shMailPreview')
}
function copyMailText(){
  navigator.clipboard?.writeText(mailText).then(()=>toast('📋 Mailtekst gekopieerd!')).catch(()=>toast('⚠️ Kopiëren mislukt — selecteer handmatig'))
}
async function logMail(status){
  if(!activeBookingId){toast('⚠️ Geen boeking geselecteerd');return}
  const {error}=await sb.from('communicatie').insert({
    booking_id:activeBookingId,richting:'uitgaand',status,
    onderwerp:mailSubject,inhoud:mailText,template_key:mailTemplateKey,
    verzonden_at:status==='verzonden'?new Date().toISOString():null
  });
  if(error){toast('⚠️ Opslaan mislukt: '+error.message);return}
  toast(status==='verzonden'?'✅ Gemarkeerd als verzonden':'📝 Bewaard als concept');
  closeSheet('shMailPreview')
}

/* ═══════════ STATUS SHEET ═══════════ */
function openStatusSheet(id){
  activeBookingId=id;
  const b=bookings.find(x=>x.id===id);
  document.getElementById('shStatusName').textContent=b?b.naam:'';
  // Progress bar
  const order=['aanvraag','bevestigd','ingecheckt','betaald'];
  const cur=order.indexOf(b.status);
  const labels=['Aanvraag','Bevestigd','Ingecheckt','Betaald'];
  const icons=['⏳','✅','🏕️','💶'];
  document.getElementById('statusProgress').innerHTML=order.map((s,i)=>`
    <div class="sp-step ${i<cur?'done':''} ${i===cur?'current':''}">
      <div class="sp-dot">${i<=cur?icons[i]:''}</div>
      <div class="sp-txt">${labels[i]}</div>
    </div>`).join('');
  document.querySelectorAll('.sts-opt').forEach(o=>{
    const lbl=o.querySelector('.sts-lbl').textContent.toLowerCase();
    o.classList.toggle('active',lbl===b.status)
  });
  closeSheet('shDetail');openSheet('shStatus')
}
function quickStatus(e,id){e.stopPropagation();openStatusSheet(id)}
async function setStatus(st){
  const b=bookings.find(x=>x.id===activeBookingId);if(!b)return;
  const {error}=await sb.from('bookings').update({status:st}).eq('id',b.id);
  if(error){toast('⚠️ Status opslaan mislukt: '+error.message);return}
  b.status=st;closeSheet('shStatus');
  toast(`${STATUS_META[st].icon} Status → ${STATUS_META[st].label}`);
  renderDashboard();renderBookingList();renderWieIsEr();
  setTimeout(()=>{
    const row=document.getElementById('bkr-'+b.id);
    if(row){row.classList.add('just-arrived');setTimeout(()=>row.classList.remove('just-arrived'),900)}
  },100);
  // Automatisch bevestigingsmail sturen bij statuswissel naar bevestigd
  if(st==='bevestigd' && b.email){
    const sturen=confirm(`✅ Bevestigingsmail sturen naar ${b.email}?`);
    if(sturen) await _autoMailSilent(b.id,'tpl_bevestiging');
  }
  // Automatisch annuleringsmail bij annuleren
  if(st==='geannuleerd' && b.email){
    const sturen=confirm(`❌ Annuleringsmail sturen naar ${b.email}?`);
    if(sturen) await _autoMailSilent(b.id,'tpl_annulering');
  }
}

async function _autoMailSilent(bookingId, templateKey){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  toast('⏳ Mail versturen…');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/send-mail`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify({booking_id:bookingId,template_key:templateKey}),
  });
  const data=await res.json();
  if(data.error){toast('⚠️ Mail mislukt: '+data.error)}
  else{toast('✅ Mail verzonden naar gast!');loadCommHistory(bookingId)}
}

/* ═══════════ EDIT BOOKING ═══════════ */
function openEditSheet(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  editingId=id;
  document.getElementById('eNaam').value=b.naam||'';
  document.getElementById('eEmail').value=b.email||'';
  document.getElementById('eTelefoon').value=b.telefoon||'';
  document.getElementById('ePlaat').value=b.plaat||'';
  document.getElementById('eVolwassenen').value=b.volwassenen??b.personen??1;
  document.getElementById('eKinderen').value=b.kinderen??0;
  document.getElementById('eBaby').value=b.baby??0;
  document.getElementById('eAankomst').value=b.aankomst||'';
  document.getElementById('eVertrek').value=b.vertrek||'';
  document.getElementById('eTenten').value=b.tenten??0;
  document.getElementById('eCampers').value=b.campers??0;
  document.getElementById('eAutos').value=b.autos??1;
  document.getElementById('eHonden').value=b.honden??0;
  document.getElementById('eBron').value=b.bron||'';
  document.getElementById('eBedrag').value=b.bedrag||0;
  document.getElementById('eNota').value=b.nota||'';
  document.getElementById('eElektriciteit').checked=!!b.elektriciteit;
  eFotoData=b.foto||null;
  const img=document.getElementById('eFotoPreview');
  if(img){if(b.foto){img.src=b.foto;img.classList.add('show')}else{img.classList.remove('show')}}
  // Render verblijfstype kaarten vanuit tarieven
  renderVerblijfTypesEdit(b.tenten,b.campers,b.extraTypeUnits||[]);
  updatePriceLiveEdit();
  closeSheet('shDetail');openSheet('shEdit');
}
async function saveEdit(){
  const b=bookings.find(x=>x.id===editingId);if(!b)return;
  const naam=document.getElementById('eNaam').value.trim();
  const email=document.getElementById('eEmail').value.trim();
  const telefoon=document.getElementById('eTelefoon').value.trim();
  const aankomst=document.getElementById('eAankomst').value;
  const vertrek=document.getElementById('eVertrek').value;
  const editUnits=getEditTypeUnits();
  const tenten=editUnits.find(t=>t.id==='tent')?.count||0;
  const campers=editUnits.find(t=>t.id==='camper')?.count||0;
  const extraTypeUnits=editUnits.filter(t=>!t.isStandaard&&t.count>0);
  const honden=parseInt(document.getElementById('eHonden').value)||0;
  const volwassenen=parseInt(document.getElementById('eVolwassenen').value)||0;
  const kinderen=parseInt(document.getElementById('eKinderen').value)||0;
  const baby=parseInt(document.getElementById('eBaby').value)||0;
  const autos=parseInt(document.getElementById('eAutos').value)||1;
  const plaat=document.getElementById('ePlaat').value.trim();
  const bron=document.getElementById('eBron').value;
  const bedrag=parseFloat(document.getElementById('eBedrag').value)||0;
  const nota=document.getElementById('eNota').value.trim();
  const elektriciteit=document.getElementById('eElektriciteit').checked;
  if(!naam||!aankomst||!vertrek){toast('⚠️ Vul naam en datums in');return}
  if(aankomst>=vertrek){toast('⚠️ Vertrek moet na aankomst zijn');return}
  if(volwassenen+kinderen+baby<1){toast('⚠️ Minstens 1 persoon is verplicht');return}
  const res=await casUpdateBooking(b.id,{
    aankomst,vertrek,tenten,campers,
    volwassenen,kinderen,baby,honden,autos,
    elektriciteit,bron,bedrag_totaal:bedrag,nota,
    extra_type_units:extraTypeUnits.length?JSON.stringify(extraTypeUnits):null
  },b.version);
  if(res.conflict){closeSheet('shEdit');toast('⚠️ Boeking werd ondertussen aangepast — nieuwste versie geladen');await loadData();return;}
  if(!res.ok){toast('⚠️ Opslaan mislukt: '+(res.error?.message||''));return}
  if(b.clientId){
    const upd={naam,nummerplaten:plaat};
    if(email)upd.email=email;
    if(telefoon)upd.telefoon=telefoon;
    const {error:cErr}=await sb.from('clients').update(upd).eq('id',b.clientId);
    if(cErr)toast('⚠️ Klantgegevens opslaan mislukt: '+cErr.message);
  }
  closeSheet('shEdit');toast('✅ Boeking bijgewerkt!');
  await loadData();
}

/* ═══════════ PRIJS LIVE ═══════════ */
function priceBreakdownHtml(p){
  if(!p)return'<div class="price-row muted"><span>Vul aankomst, vertrek en verblijfstype in…</span></div>';
  let rows='';
  // Itemlijst: per nacht tarieven
  if((p.stdBasis||0)>0)rows+=`<div class="price-row"><span>🏕️ Standplaats (${p.nights}n)</span><span>€${(p.stdBasis*p.nights).toFixed(2)}</span></div>`;
  (p.extraTypeUnits||[]).forEach(t=>{if(t.count>0)rows+=`<div class="price-row"><span>${t.emoji||'🏕️'} ${t.naam} (${t.count}× × ${p.nights}n)</span><span>€${(t.count*t.prijs*p.nights).toFixed(2)}</span></div>`;});
  if(p.allInMode){rows+=`<div class="price-row muted"><span>✅ All-in — ${p.personen}p inbegrepen</span><span>—</span></div>`;}
  else if(p.personen>0){
    const personKost=(p.diensten_totaal-(p.basis||0)*p.nights-p.elek-p.afval-(p.extraLines||[]).reduce((s,[,v])=>s+v,0)-(p.extraAutos||0)*PRICES.extraAuto*p.nights-(p.honden||0)*PRICES.hond*p.nights);
    rows+=`<div class="price-row"><span>👥 Personen (${p.personen}p × ${p.nights}n)</span><span>€${Math.max(0,personKost).toFixed(2)}</span></div>`;
  }
  if((p.honden||0)>0)rows+=`<div class="price-row"><span>🐕 Honden (${p.honden} × ${p.nights}n)</span><span>€${(p.honden*PRICES.hond*p.nights).toFixed(2)}</span></div>`;
  if((p.extraAutos||0)>0)rows+=`<div class="price-row"><span>🚗 Extra auto's (${p.extraAutos} × ${p.nights}n)</span><span>€${(p.extraAutos*PRICES.extraAuto*p.nights).toFixed(2)}</span></div>`;
  (p.extraLines||[]).forEach(([l,v])=>{rows+=`<div class="price-row"><span>➕ ${l}</span><span>€${v.toFixed(2)}</span></div>`;});
  if(!p.allInMode)rows+=`<div class="price-row"><span>♻️ Afval (€${(p.afvalDag||0).toFixed(2)}/dag × ${p.nights}n)</span><span>€${p.afval.toFixed(2)}</span></div>`;
  if(p.elek)rows+=`<div class="price-row"><span>⚡ Elektriciteit (€${(p.elekDag||0).toFixed(2)}/dag × ${p.nights}n)</span><span>€${p.elek.toFixed(2)}</span></div>`;
  rows+=`<div class="price-row"><span>🏛️ Toeristentaks (BTW-vrij)</span><span>€${p.taks_totaal.toFixed(2)}</span></div>`;
  rows+=`<div class="price-row muted"><span>📊 BTW 12% (reeds inbegrepen)</span><span>€${p.btw.toFixed(2)}</span></div>`;
  // Per-nacht subtotaal + nachten-rij (zelfde concept als publiek formulier)
  const dienstenZonderTaks=p.totaal-p.taks_totaal;
  rows+=`<div class="price-row subtotal"><span>Totaal per nacht (excl. BTW)</span><span>€${(p.perNacht||0).toFixed(2)}</span></div>`;
  rows+=`<div class="price-row nights-line"><span>× ${p.nights} nacht${p.nights===1?'':'en'}</span><span>€${dienstenZonderTaks.toFixed(2)} + €${p.taks_totaal.toFixed(2)} taks</span></div>`;
  rows+=`<div class="price-row total"><span>Totaal te betalen</span><span>€${p.totaal.toFixed(2)}</span></div>`;
  return rows;
}
function stepField(id,delta){
  const el=document.getElementById(id);
  const min=parseInt(el.min)||0,max=parseInt(el.max)||99;
  el.value=Math.min(max,Math.max(min,(parseInt(el.value)||0)+delta));
  updatePriceLive();updatePriceLiveEdit();
  if(['fVolwassenen','fKinderen','fBaby'].includes(id))renderNBGasten();
}
/* Rendert verblijfstype-kaarten in Nieuwe boeking met qty-steppers */
/* ═══════════ VERBLIJFSTYPE KAARTEN (gedeeld NB + Edit) ═══════════ */
function _allAccTypes(){
  return[
    {id:'tent',naam:'Tent',emoji:'⛺',prijs:PRICES.tent,maxPersonen:0,isStandaard:true},
    {id:'camper',naam:'Camper / Caravan',emoji:'🚐',prijs:PRICES.camper,maxPersonen:0,isStandaard:true},
    ...(accTypes||[]).map(t=>({...t,isStandaard:false}))
  ];
}
function _typeCardHtml(t,prefix,qty){
  const active=qty>0;
  return`<div style="display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:12px;border:1.5px solid ${active?'var(--green)':'var(--sep)'};background:${active?'rgba(27,138,91,.06)':'var(--bg)'};margin-bottom:8px;transition:border .15s,background .15s;" id="${prefix}TypeCard_${t.id}">
    <div style="font-size:24px;flex-shrink:0;">${t.emoji||'🏕️'}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13.5px;font-weight:700;color:var(--lbl1);">${t.naam}</div>
      <div style="font-size:11px;color:var(--lbl3);">€${t.prijs}/nacht${t.maxPersonen>0?' · max '+t.maxPersonen+'p':''}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
      <button type="button" onclick="${prefix}TypeStep('${t.id}',-1)" style="width:28px;height:28px;border-radius:50%;background:var(--sep);border:none;font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
      <span id="${prefix}Qty_${t.id}" style="min-width:18px;text-align:center;font-size:15px;font-weight:800;color:var(--lbl1);">${qty}</span>
      <button type="button" onclick="${prefix}TypeStep('${t.id}',1)" style="width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;border:none;font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
    </div>
  </div>`;
}
function _updateTypeCard(prefix,typeId,qty){
  const card=document.getElementById(prefix+'TypeCard_'+typeId);if(!card)return;
  card.style.borderColor=qty>0?'var(--green)':'var(--sep)';
  card.style.background=qty>0?'rgba(27,138,91,.06)':'var(--bg)';
}
function _getTypeUnits(prefix){
  return _allAccTypes().map(t=>({...t,count:parseInt(document.getElementById(prefix+'Qty_'+t.id)?.textContent)||0}));
}

function renderVerblijfTypesNB(){
  const el=document.getElementById('verblijfTypesNB');if(!el)return;
  el.innerHTML=_allAccTypes().map(t=>_typeCardHtml(t,'nb',parseInt(document.getElementById('nbQty_'+t.id)?.textContent)||0)).join('');
  const tentQty=document.getElementById('nbQty_tent');
  if(tentQty&&tentQty.textContent==='0'){tentQty.textContent='1';_updateTypeCard('nb','tent',1);}
}
function nbTypeStep(typeId,delta){
  const el=document.getElementById('nbQty_'+typeId);if(!el)return;
  const newVal=Math.max(0,(parseInt(el.textContent)||0)+delta);
  el.textContent=newVal;_updateTypeCard('nb',typeId,newVal);updatePriceLive();
}
function getNBTypeUnits(){return _getTypeUnits('nb');}

/* Verblijfstype Edit */
function renderVerblijfTypesEdit(tenten,campers,extraUnits){
  const el=document.getElementById('verblijfTypesEdit');if(!el)return;
  const startQty={tent:tenten||0,camper:campers||0};
  (extraUnits||[]).forEach(u=>{startQty[u.id]=(u.count||0);});
  el.innerHTML=_allAccTypes().map(t=>_typeCardHtml(t,'ed',startQty[t.id]||0)).join('');
}
function edTypeStep(typeId,delta){
  const el=document.getElementById('edQty_'+typeId);if(!el)return;
  const newVal=Math.max(0,(parseInt(el.textContent)||0)+delta);
  el.textContent=newVal;_updateTypeCard('ed',typeId,newVal);updatePriceLiveEdit();
}
function getEditTypeUnits(){return _getTypeUnits('ed');}

function readPriceInputs(prefix){
  const g=id=>document.getElementById(prefix+id);
  const aankomst=g('Aankomst')?.value,vertrek=g('Vertrek')?.value;
  if(!aankomst||!vertrek||aankomst>=vertrek)return null;
  let tenten=0,campers=0,extraTypeUnits=[];
  if(prefix==='f'){
    const units=getNBTypeUnits();
    tenten=units.find(t=>t.id==='tent')?.count||0;
    campers=units.find(t=>t.id==='camper')?.count||0;
    extraTypeUnits=units.filter(t=>!t.isStandaard&&t.count>0);
    if(tenten+campers+extraTypeUnits.reduce((s,t)=>s+t.count,0)<1)return null;
  }else if(prefix==='e'){
    const units=getEditTypeUnits();
    tenten=units.find(t=>t.id==='tent')?.count||0;
    campers=units.find(t=>t.id==='camper')?.count||0;
    extraTypeUnits=units.filter(t=>!t.isStandaard&&t.count>0);
    // Sync hidden inputs for compat
    const th=document.getElementById('eTenten');if(th)th.value=tenten;
    const ch=document.getElementById('eCampers');if(ch)ch.value=campers;
  }else{
    tenten=parseInt(g('Tenten')?.value)||0;
    campers=parseInt(g('Campers')?.value)||0;
  }
  return calcPrice({
    tenten,campers,extraTypeUnits,nights:nightCount(aankomst,vertrek),
    volwassenen:parseInt(g('Volwassenen')?.value)||0,
    kinderen:parseInt(g('Kinderen')?.value)||0,
    baby:parseInt(g('Baby')?.value)||0,
    autos:parseInt(g('Autos')?.value)||1,
    honden:parseInt(g('Honden')?.value)||0,
    elektriciteit:g('Elektriciteit')?.checked
  })
}
function updatePriceLive(){
  const p=readPriceInputs('f');
  document.getElementById('priceBreakdown').innerHTML=priceBreakdownHtml(p);
  if(p)document.getElementById('fBedrag').value=p.totaal
}
function updatePriceLiveEdit(){
  const p=readPriceInputs('e');
  document.getElementById('priceBreakdownEdit').innerHTML=priceBreakdownHtml(p);
  if(p)document.getElementById('eBedrag').value=p.totaal
}

/* ═══════════ FOTO ═══════════ */
function previewFoto(e,prefix){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const data=ev.target.result;
    if(prefix==='f')fFotoData=data;else eFotoData=data;
    const img=document.getElementById(prefix+'FotoPreview');
    img.src=data;img.classList.add('show')
  };
  reader.readAsDataURL(file)
}

/* ═══════════ ADD BOOKING ═══════════ */
async function addBooking(){
  const naam=document.getElementById('fNaam').value.trim();
  const email=document.getElementById('fEmail').value.trim();
  const plaat=document.getElementById('fPlaat').value.trim();
  const volwassenen=parseInt(document.getElementById('fVolwassenen').value)||0;
  const kinderen=parseInt(document.getElementById('fKinderen').value)||0;
  const baby=parseInt(document.getElementById('fBaby').value)||0;
  const autos=parseInt(document.getElementById('fAutos').value)||1;
  const nbUnits=getNBTypeUnits();
  const tenten=nbUnits.find(t=>t.id==='tent')?.count||0;
  const campers=nbUnits.find(t=>t.id==='camper')?.count||0;
  const extraTypeUnits=nbUnits.filter(t=>!t.isStandaard&&t.count>0);
  const totalEenheden=tenten+campers+extraTypeUnits.reduce((s,t)=>s+t.count,0);
  const honden=parseInt(document.getElementById('fHonden').value)||0;
  const aankomst=document.getElementById('fAankomst').value;
  const vertrek=document.getElementById('fVertrek').value;
  const bron=document.getElementById('fBron').value||'telefoon';
  const bedrag=parseFloat(document.getElementById('fBedrag').value)||0;
  const nota=document.getElementById('fNota').value.trim();
  const elektriciteit=document.getElementById('fElektriciteit').checked;
  if(!naam){toast('⚠️ Naam is verplicht');return}
  if(!aankomst||!vertrek){toast('⚠️ Aankomst- en vertrekdatum zijn verplicht');return}
  if(aankomst>=vertrek){toast('⚠️ Vertrek moet na aankomst zijn');return}
  if(totalEenheden<1){toast('⚠️ Voeg minstens 1 verblijfseenheid toe');return}
  if(volwassenen+kinderen+baby<1){toast('⚠️ Minstens 1 persoon is verplicht');return}
  const maxPlaatsen=PRICES.maxPlaatsen||0;
  if(maxPlaatsen>0){
    const bezet=bookings.filter(b=>b.aankomst<vertrek&&b.vertrek>aankomst&&b.status!=='geannuleerd')
      .reduce((s,b)=>s+(b.tenten||0)+(b.campers||0),0);
    if(bezet+totalEenheden>maxPlaatsen){toast(`⚠️ Max. capaciteit overschreden: ${bezet} van ${maxPlaatsen} plaatsen bezet`);return}
  }
  // Verblijfstype label bepalen
  const typeParts=[];
  if(tenten>0)typeParts.push(`${tenten}× Tent`);
  if(campers>0)typeParts.push(`${campers}× Camper`);
  extraTypeUnits.forEach(t=>typeParts.push(`${t.count}× ${t.naam}`));
  const verblijfstype=typeParts.join(' + ')||'Tent';
  const clientEmail=email||`geen-email+${Date.now()}@cosmopolite.local`;
  const {data:client,error:cErr}=await sb.from('clients').insert({naam,nummerplaten:plaat,email:clientEmail}).select().single();
  if(cErr){toast('⚠️ Klant aanmaken mislukt: '+cErr.message);return}
  // Voor extra eenheden (safaritent e.d.): sla op als tenten=count zodat capaciteit klopt
  const dbTenten=tenten+(extraTypeUnits.reduce((s,t)=>s+t.count,0));
  const {data:newBooking,error:bErr}=await sb.from('bookings').insert({
    client_id:client.id,aankomst,vertrek,
    tenten:dbTenten,campers,verblijfstype,
    volwassenen,kinderen,baby,honden,autos,elektriciteit,
    bron,bedrag_totaal:bedrag,nota,status:'aanvraag'
  }).select('id').single();
  if(bErr){toast('⚠️ Boeking opslaan mislukt: '+bErr.message);return}
  // Gasten opslaan
  if(newBooking&&nbGastenData.length){
    const gastenRows=nbGastenData.filter(g=>g.naam.trim()).map((g,i)=>({
      booking_id:newBooking.id,naam:g.naam.trim(),
      geboortedatum:g.geboortedatum||null,
      nationaliteit:null,id_nummer:null,is_hoofdgast:i===0
    }));
    if(gastenRows.length)await sb.from('gasten').insert(gastenRows);
  }
  nbGastenData=[];
  ['fNaam','fEmail','fPlaat','fAankomst','fVertrek','fBedrag','fNota','fID'].forEach(f=>document.getElementById(f)&&(document.getElementById(f).value=''));
  document.getElementById('fVolwassenen').value=2;
  document.getElementById('fKinderen').value=0;
  document.getElementById('fBaby').value=0;
  document.getElementById('fAutos').value=1;
  document.getElementById('fHonden').value=0;
  document.getElementById('fBron').value='';
  document.getElementById('fElektriciteit').checked=false;
  document.getElementById('fFotoPreview').classList.remove('show');fFotoData=null;
  document.getElementById('priceBreakdown').innerHTML=priceBreakdownHtml(null);
  renderVerblijfTypesNB();
  renderNBGasten();
  toast('✅ Boeking opgeslagen!');showView('boekingen',null);
  await loadData()
}

/* ═══════════ DELETE ═══════════ */
async function deleteBooking(id){
  if(!confirm('Boeking verwijderen?'))return;
  const {error}=await sb.from('bookings').delete().eq('id',id);
  if(error){toast('⚠️ Verwijderen mislukt: '+error.message);return}
  bookings=bookings.filter(b=>b.id!==id);
  closeSheet('shDetail');toast('🗑 Boeking verwijderd');
  renderDashboard();renderBookingList();renderWieIsEr()
}

/* ═══════════ QUICK PHONE ═══════════ */
async function submitQuickPhone(){
  const naam=document.getElementById('qpeName').value.trim();
  const aankomst=document.getElementById('qpeAankomst').value;
  const vertrek=document.getElementById('qpeVertrek').value;
  const personen=parseInt(document.getElementById('qpePersonen').value)||1;
  const type=document.getElementById('qpeType').value;
  if(!naam||!aankomst||!vertrek){toast('⚠️ Naam en datums zijn verplicht');return}
  const counts=typeToCounts(type||'Tent');
  const {data:client,error:cErr}=await sb.from('clients').insert({naam,email:`onbekend+${Date.now()}@cosmopolite.local`}).select().single();
  if(cErr){toast('⚠️ Klant aanmaken mislukt: '+cErr.message);return}
  const {error:bErr}=await sb.from('bookings').insert({
    client_id:client.id,aankomst,vertrek,tenten:counts.tenten,campers:counts.campers,
    volwassenen:personen,kinderen:0,bron:'telefoon',status:'aanvraag'
  });
  if(bErr){toast('⚠️ Opslaan mislukt: '+bErr.message);return}
  ['qpeName','qpeAankomst','qpeVertrek','qpePersonen'].forEach(f=>document.getElementById(f).value='');
  closeSheet('shQuickPhone');toast('✅ Telefoongesprek opgeslagen!');
  await loadData()
}

/* ═══════════ PRESENCE ═══════════ */
function renderPresenceAndOpen(){
  const list=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  const el=document.getElementById('presenceList');
  if(!list.length){el.innerHTML='<div class="oc-none" style="padding:20px 0;">Geen gasten aanwezig</div>'}
  else el.innerHTML=list.map((b,i)=>`
    <div class="plist-row">
      <div class="plist-num">${i+1}</div>
      ${avHtml(b,36,10)}
      <div class="plist-name">${b.naam} <span style="color:var(--lbl4);font-weight:400;">#${b.volgnummer??'—'}</span><br><span style="font-size:12px;color:var(--lbl3);font-weight:400;">${b.personen} pers · ${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)}</span></div>
      <div class="plist-plate">${b.plaat||'—'}</div>
    </div>`).join('');
  openSheet('shPresence')
}

function printPresence(){
  const list=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Aanwezigheidslijst — Cosmopolite</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;max-width:900px;margin:0 auto}
  h1{color:#1B8A5B;margin-bottom:4px;font-size:22px}
  .sub{color:#666;margin-bottom:24px;font-size:13px}
  table{width:100%;border-collapse:collapse}
  th{background:#1B8A5B;color:#fff;padding:10px 12px;text-align:left;font-size:12px}
  td{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px}
  tr:nth-child(even) td{background:#f9f9f9}
  .footer{margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px}
  @media print{.no-print{display:none}}</style></head><body>
  <h1>🏕️ Cosmopolite — Aanwezigheidslijst</h1>
  <div class="sub">Gegenereerd op ${fmtDateLong(TODAY)} · ${list.length} gast${list.length!==1?'en':''} aanwezig</div>
  <table><tr><th>ID</th><th>Naam</th><th>Aankomst</th><th>Vertrek</th><th>Pers.</th><th>Type</th><th>Nummerplaat</th><th>Status</th></tr>
  ${list.map((b)=>`<tr><td>#${b.volgnummer??'—'}</td><td><strong>${b.naam}</strong></td><td>${fmtDateLong(b.aankomst)}</td><td>${fmtDateLong(b.vertrek)}</td><td>${b.personen}</td><td>${b.type}</td><td>${b.plaat||'—'}</td><td>${STATUS_META[b.status].label}</td></tr>`).join('')}
  </table>
  <div class="footer">Camping Cosmopolite · Aanwezigheidslijst · Afgedrukt op ${fmtDateLong(TODAY)}</div>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close()
}

/* ═══════════ AVONDMELDING ═══════════ */
function buildEveningList(){
  const list=bookings.filter(isOnsite);
  const el=document.getElementById('eveningList');
  if(!list.length){el.innerHTML='<div class="oc-none" style="padding:20px 0;">Niemand meer aanwezig</div>'}
  else el.innerHTML=list.map((b,i)=>`
    <div class="plist-row">
      <div class="plist-num">${i+1}</div>
      ${avHtml(b,36,10)}
      <div class="plist-name">${b.naam}<br><span style="font-size:12px;color:var(--lbl3);font-weight:400;">${b.personen} pers · ${VI[b.type]||'⛺'} ${b.type}</span></div>
      <div class="plist-plate">${b.plaat||'—'}</div>
    </div>`).join('');
  return list.length
}
function showEveningAlert(){buildEveningList();openSheet('shEveningAlert')}
function testEveningAlert(){showEveningAlert();toast(`🔔 Testmelding getoond (normaal automatisch om ${EVENING_HOUR}:00u)`)}
function checkEveningAlert(){
  const now=new Date();
  if(now.getHours()>=EVENING_HOUR&&!eveningShown){eveningShown=true;showEveningAlert()}
  if(now.getHours()<EVENING_HOUR)eveningShown=false
}

/* ═══════════ ANALYTICS ═══════════ */
function svgBars(values,labels,colors,h=140){
  const max=Math.max(...values,1);
  const n=values.length;const w=Math.max(n*80,280);
  const bw=Math.floor(w/n)-16;
  let bars='';
  values.forEach((v,i)=>{
    const bh=v>0?Math.max(6,Math.round(v/max*(h-38))):3;
    const x=i*(bw+16)+10;const y=h-26-bh;
    const col=v===0?'#D1D1D6':colors[i%colors.length];
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="5" fill="${col}"/>`;
    bars+=`<text x="${x+bw/2}" y="${y-5}" font-size="12" font-weight="700" fill="${v===0?'#8E8E93':'#1C1C1E'}" text-anchor="middle">${v}</text>`;
    bars+=`<text x="${x+bw/2}" y="${h-8}" font-size="10" fill="#6E6E73" text-anchor="middle">${labels[i]}</text>`;
  });
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;max-width:100%;">${bars}</svg>`
}
async function renderFunnel(){
  const since=new Date(Date.now()-30*86400000).toISOString();
  const {data:events}=await sb.from('analytics_events').select('event,session_id,created_at').gte('created_at',since);
  if(!events?.length){document.getElementById('funnelChart').innerHTML='<div style="padding:20px;text-align:center;color:var(--lbl4);font-size:13px;">Nog geen data — tracking start zodra bezoekers het formulier openen.</div>';return}
  const sessions=new Set(events.map(e=>e.session_id).filter(Boolean));
  const count=ev=>new Set(events.filter(e=>e.event===ev).map(e=>e.session_id)).size;
  const steps=[
    {label:'Formulier bezocht',icon:'👁️',n:sessions.size},
    {label:'Begon invullen',icon:'✏️',n:count('form_start')},
    {label:'Datum gekozen',icon:'📅',n:count('field_focus')},
    {label:'Reservatie verzonden',icon:'✅',n:count('submit')},
  ];
  const top=steps[0].n||1;
  let html='';
  steps.forEach((s,i)=>{
    const pct=Math.round(s.n/top*100);
    const drop=i>0?Math.round((1-s.n/steps[i-1].n)*100):0;
    html+=`
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
          <div style="font-size:13px;font-weight:600;color:var(--lbl1);">${s.icon} ${s.label}</div>
          <div style="font-size:13px;font-weight:800;color:var(--lbl1);">${s.n} <span style="font-weight:400;color:var(--lbl4);font-size:11px;">${i>0&&steps[i-1].n?`(−${drop}%)`:''}</span></div>
        </div>
        <div style="background:var(--bg2);border-radius:6px;height:10px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${i===3?'var(--green)':'var(--blue)'};border-radius:6px;transition:width .5s;"></div>
        </div>
      </div>`;
  });
  document.getElementById('funnelChart').innerHTML=html;
}

function renderAnalytics(){
  renderFunnel();
  const nonCancelled=bookings.filter(b=>b.status!=='geannuleerd');
  const actief=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  const aanvragen=bookings.filter(b=>b.status==='aanvraag');
  const totalOmzet=nonCancelled.reduce((s,b)=>s+(b.bedrag||0),0);
  const totalPersonen=nonCancelled.reduce((s,b)=>s+(b.personen||0),0);

  // KPI rij bovenaan
  const kpiEl=document.getElementById('analyticsKPI');
  if(kpiEl) kpiEl.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:16px 16px 0;">
      <div style="background:var(--bg);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:var(--green);">${nonCancelled.length}</div>
        <div style="font-size:11px;color:var(--lbl3);margin-top:2px;">Boekingen</div>
      </div>
      <div style="background:var(--bg);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#5856D6;">€${Math.round(totalOmzet)}</div>
        <div style="font-size:11px;color:var(--lbl3);margin-top:2px;">Totale omzet</div>
      </div>
      <div style="background:var(--bg);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#FF9500;">${aanvragen.length}</div>
        <div style="font-size:11px;color:var(--lbl3);margin-top:2px;">Open aanvragen</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 16px 4px;">
      <div style="background:var(--bg);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#007AFF;">${actief.length}</div>
        <div style="font-size:11px;color:var(--lbl3);margin-top:2px;">Nu aanwezig</div>
      </div>
      <div style="background:var(--bg);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#1c1c1e;">${totalPersonen}</div>
        <div style="font-size:11px;color:var(--lbl3);margin-top:2px;">Totale bezoekers</div>
      </div>
    </div>`;

  // Omzet per maand
  const months=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const revenue=new Array(12).fill(0);
  nonCancelled.forEach(b=>{const m=parseInt(b.aankomst.split('-')[1])-1;revenue[m]+=b.bedrag||0});
  const usedMonths=months.map((m,i)=>i).filter(i=>revenue[i]>0);
  const idxs=usedMonths.length?usedMonths:[new Date(TODAY).getMonth()];
  document.getElementById('chartRevenue').innerHTML=usedMonths.length
    ?svgBars(idxs.map(i=>revenue[i]),idxs.map(i=>months[i]),['#1B8A5B','#22A86F'])
    :'<div style="text-align:center;padding:24px 0;color:var(--lbl4);font-size:13px;">Nog geen omzetdata</div>';

  // Boekingen per kanaal
  const chCounts=[bookings.filter(b=>b.bron==='mail').length,bookings.filter(b=>b.bron==='website').length,bookings.filter(b=>b.bron==='telefoon').length];
  document.getElementById('chartChannel').innerHTML=svgBars(chCounts,['E-mail','Website','Telefoon'],['#007AFF','#1B8A5B','#FF9500']);

  // Boekingen per status
  const stOrder=['aanvraag','bevestigd','ingecheckt','betaald'];
  const stCounts=stOrder.map(s=>bookings.filter(b=>b.status===s).length);
  document.getElementById('chartStatus').innerHTML=svgBars(stCounts,stOrder.map(s=>STATUS_META[s].label),['#FF9500','#007AFF','#34C759','#AF52DE']);

  // Gemiddelde bezetting lopende maand
  const td=new Date(TODAY);const y=td.getFullYear(),m=td.getMonth();
  const monthName=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'][m];
  const dim=new Date(y,m+1,0).getDate();
  let totalSlots=0;
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    totalSlots+=bookings.filter(b=>b.aankomst<=ds&&b.vertrek>ds).length
  }
  const avg=Math.round(totalSlots/dim*10)/10;
  document.getElementById('chartOccupancy').innerHTML=`<div style="text-align:center;padding:16px 0 8px;"><div style="font-size:44px;font-weight:800;color:var(--green);letter-spacing:-1px;">${avg}</div><div style="font-size:13px;color:var(--lbl3);margin-top:4px;">gem. bezette plaatsen per dag</div><div style="font-size:12px;color:var(--lbl4);margin-top:2px;">${monthName} ${y}</div></div>`
}

/* ═══════════ GANTT KALENDER ═══════════ */
let ganttStart=null;
const GANTT_DAYS=21;
const GANTT_ROW=52;
const GANTT_NAME_W=130;
const GANTT_COLORS={bevestigd:'#34C759',aanvraag:'#FF9500',ingecheckt:'#007AFF',betaald:'#5856D6',wachtlijst:'#8E8E93',geannuleerd:'#FF3B30'};
const NL_MONTHS_S=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const NL_DAYS_S=['zo','ma','di','wo','do','vr','za'];
let calViewMode='gantt';// 'gantt' of 'maand'
function setCalView(mode){
  calViewMode=mode;
  document.getElementById('calBtnGantt').classList.toggle('cal-view-on',mode==='gantt');
  document.getElementById('calBtnMaand').classList.toggle('cal-view-on',mode==='maand');
  document.getElementById('calGanttNav').style.display=mode==='gantt'?'flex':'none';
  document.getElementById('calMaandNav').style.display=mode==='maand'?'flex':'none';
  document.getElementById('ganttChartWrap').style.display=mode==='gantt'?'block':'none';
  document.getElementById('calMaandWrap').style.display=mode==='maand'?'block':'none';
  if(mode==='maand')renderCalendar_monthView();else renderCalendar();
}

function ganttToday(){ganttStart=new Date(TODAY);ganttStart.setDate(ganttStart.getDate()-2);ganttStart.setHours(0,0,0,0);renderCalendar()}
function ganttShift(d){if(!ganttStart){ganttToday();return}ganttStart=new Date(ganttStart.getTime()+d*86400000);renderCalendar()}

function renderCalendar(){
  if(!ganttStart){ganttToday();return}
  const DAY=86400000;
  const endDate=new Date(ganttStart.getTime()+GANTT_DAYS*DAY);
  const last=new Date(endDate.getTime()-DAY);
  document.getElementById('ganttRangeLabel').textContent=
    `${ganttStart.getDate()} ${NL_MONTHS_S[ganttStart.getMonth()]} – ${last.getDate()} ${NL_MONTHS_S[last.getMonth()]} ${last.getFullYear()}`;

  const active=bookings.filter(b=>{
    if(b.status==='geannuleerd')return false;
    return new Date(b.aankomst)<endDate && new Date(b.vertrek)>ganttStart;
  }).sort((a,b)=>a.aankomst.localeCompare(b.aankomst));

  // Build header row
  let dayHeaderTop='', dayHeaderBot='';
  for(let i=0;i<GANTT_DAYS;i++){
    const d=new Date(ganttStart.getTime()+i*DAY);
    const dow=d.getDay();
    const ds=d.toISOString().slice(0,10);
    const isToday=ds===TODAY;
    const isWe=dow===0||dow===6;
    const lbl1Color=isToday?'#1B8A5B':isWe?'#FF3B30':'var(--lbl4)';
    const lbl2Color=isToday?'#1B8A5B':isWe?'#FF3B30':'var(--lbl1)';
    dayHeaderTop+=`<div style="flex:1;text-align:center;font-size:9px;font-weight:700;color:${lbl1Color};text-transform:uppercase;letter-spacing:.3px;">${NL_DAYS_S[dow]}</div>`;
    dayHeaderBot+=`<div style="flex:1;text-align:center;font-size:13px;font-weight:${isToday?'800':'600'};color:${lbl2Color};${isToday?'background:var(--green);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;':''}">${d.getDate()}</div>`;
  }

  // Build column background overlay
  let colBg='';
  for(let i=0;i<GANTT_DAYS;i++){
    const d=new Date(ganttStart.getTime()+i*DAY);
    const dow=d.getDay();
    const isToday=d.toISOString().slice(0,10)===TODAY;
    if(isToday){
      colBg+=`<div style="position:absolute;left:calc(${GANTT_NAME_W}px + (100% - ${GANTT_NAME_W}px)*${i}/${GANTT_DAYS});width:calc((100% - ${GANTT_NAME_W}px)/${GANTT_DAYS});top:0;bottom:0;background:rgba(27,138,91,.06);border-left:2px solid var(--green);pointer-events:none;z-index:0;"></div>`;
    } else if(dow===0||dow===6){
      colBg+=`<div style="position:absolute;left:calc(${GANTT_NAME_W}px + (100% - ${GANTT_NAME_W}px)*${i}/${GANTT_DAYS});width:calc((100% - ${GANTT_NAME_W}px)/${GANTT_DAYS});top:0;bottom:0;background:rgba(0,0,0,.025);pointer-events:none;z-index:0;"></div>`;
    }
  }

  // Build rows
  let rowsHtml='';
  if(!active.length){
    rowsHtml=`<div style="padding:40px 16px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">📭</div>
      <div style="font-size:14px;color:var(--lbl3);">Geen boekingen in deze periode</div>
    </div>`;
  } else {
    active.forEach((b,idx)=>{
      const a=new Date(b.aankomst), v=new Date(b.vertrek);
      const startOff=Math.max(0,(a.getTime()-ganttStart.getTime())/DAY);
      const endOff=Math.min(GANTT_DAYS,(v.getTime()-ganttStart.getTime())/DAY);
      const wPct=((endOff-startOff)/GANTT_DAYS)*100;
      const lPct=((startOff)/GANTT_DAYS)*100;
      const color=GANTT_COLORS[b.status]||'#8E8E93';
      const nachten=Math.round((v-a)/DAY);
      const personen=(b.volwassenen||0)+(b.kinderen||0)+(b.baby||0);
      const rowBg=idx%2===0?'transparent':'rgba(0,0,0,.015)';
      const statusDot=`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:5px;flex-shrink:0;"></span>`;
      rowsHtml+=`
        <div style="display:flex;align-items:center;height:${GANTT_ROW}px;border-bottom:.5px solid var(--sep);background:${rowBg};position:relative;cursor:pointer;" onclick="openBookingDetail('${b.id}')">
          <div style="width:${GANTT_NAME_W}px;flex-shrink:0;padding:0 10px 0 14px;z-index:1;">
            <div style="display:flex;align-items:center;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:6px;flex-shrink:0;"></span><span style="font-size:12.5px;font-weight:700;color:var(--lbl1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${b.naam||'—'}</span></div>
            <div style="font-size:10.5px;color:var(--lbl4);margin-top:1px;padding-left:13px;">${nachten}n · ${personen}p</div>
          </div>
          <div style="flex:1;position:relative;height:${GANTT_ROW-10}px;">
            <div style="position:absolute;left:${lPct}%;width:${Math.max(wPct,1)}%;top:50%;transform:translateY(-50%);height:34px;background:${color};border-radius:8px;display:flex;flex-direction:column;justify-content:center;padding:0 10px;overflow:hidden;box-shadow:0 2px 8px ${color}55;" title="${b.naam} · ${fmtDate(b.aankomst)} → ${fmtDate(b.vertrek)} · ${nachten}n · ${personen}p${b.plaat?' · '+b.plaat:''}">
              <span style="font-size:11.5px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${b.naam||'—'}</span>
              <span style="font-size:9.5px;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${nachten}n · ${personen}p${b.plaat?' · '+b.plaat:''}</span>
            </div>
          </div>
        </div>`;
    });
  }

  const wrapper=document.getElementById('ganttChart');
  const headerW=`calc(100% - ${GANTT_NAME_W}px)`;
  wrapper.innerHTML=`
    <div style="display:flex;align-items:flex-end;margin-bottom:2px;">
      <div style="width:${GANTT_NAME_W}px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="display:flex;">${dayHeaderTop}</div>
        <div style="display:flex;align-items:center;margin-top:2px;">${dayHeaderBot}</div>
      </div>
    </div>
    <div style="position:relative;border-top:.5px solid var(--sep);">${colBg}<div style="position:relative;">${rowsHtml}</div></div>`;
}

/* ═══════════ MAANDWEERGAVE ═══════════ */
function prevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCalendar_monthView()}
function nextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCalendar_monthView()}

const CAL_FILTERS=[
  {key:'alle',label:'Alles'},
  {key:'aanvraag',label:'⏳ Aanvraag'},
  {key:'bevestigd',label:'✅ Bevestigd'},
  {key:'ingecheckt',label:'🏕️ Ingecheckt'},
  {key:'betaald',label:'💶 Betaald'},
  {key:'arr',label:'↓ Aankomsten'},
  {key:'dep',label:'↑ Vertrekken'},
  {key:'geannuleerd',label:'🚫 Geannuleerd'},
];
let calFilter='alle';
function setCalFilter(k){calFilter=k;renderCalendar_monthView();}
function renderCalFilters(){
  const el=document.getElementById('calFilters');if(!el)return;
  el.innerHTML=CAL_FILTERS.map(f=>{
    const on=calFilter===f.key;
    return`<button onclick="setCalFilter('${f.key}')" style="flex-shrink:0;padding:6px 11px;border-radius:20px;font-size:11.5px;font-weight:700;cursor:pointer;border:1.5px solid ${on?'var(--green)':'var(--sep)'};background:${on?'var(--green)':'#fff'};color:${on?'#fff':'var(--lbl2)'};">${f.label}</button>`;
  }).join('');
}
function ymd(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}

function renderCalendar_monthView(){
  const DAYS=['Ma','Di','Wo','Do','Vr','Za','Zo'];
  const MONTHS=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
  const el=document.getElementById('calMaandLabel');if(el)el.textContent=`${MONTHS[calMonth]} ${calYear}`;
  renderCalFilters();
  const offset=(new Date(calYear,calMonth,1).getDay()+6)%7;
  const dim=new Date(calYear,calMonth+1,0).getDate();
  const td=new Date(TODAY);
  const active=bookings.filter(b=>b.status!=='geannuleerd'||calFilter==='geannuleerd');
  const statusFilter=['aanvraag','bevestigd','ingecheckt','betaald','geannuleerd'].includes(calFilter)?calFilter:null;

  let html=DAYS.map(d=>`<div class="cal-dh">${d}</div>`).join('');
  for(let i=0;i<offset;i++)html+=`<div></div>`;

  for(let d=1;d<=dim;d++){
    const ds=ymd(calYear,calMonth,d);
    const isToday=(calYear===td.getFullYear()&&calMonth===td.getMonth()&&d===td.getDate());
    const arr=active.filter(b=>CampingGuests.isArrival(b,ds));
    const dep=active.filter(b=>CampingGuests.isDeparture(b,ds));
    const stay=active.filter(b=>CampingGuests.isPresentOn(b,ds));
    const presentPersonen=stay.reduce((s,b)=>s+(b.personen||0),0);

    // Welke boekingen tonen we als chip op deze dag? (afhankelijk van filter)
    let chipsB;
    if(calFilter==='arr')chipsB=arr;
    else if(calFilter==='dep')chipsB=dep;
    else{
      // stay (incl. aankomstdag) + vertrekkers die die dag weggaan
      const map=new Map();stay.forEach(b=>map.set(b.id,b));dep.forEach(b=>map.set(b.id,b));
      chipsB=[...map.values()];
    }
    if(statusFilter)chipsB=chipsB.filter(b=>b.status===statusFilter);
    chipsB.sort((a,b)=>a.aankomst.localeCompare(b.aankomst));

    const hasEv=arr.length||dep.length||stay.length;
    const cls=[isToday?'today':'',hasEv&&!isToday?'has-ev':''].join(' ').trim();

    // Dagtotalen bovenaan de cel.
    let totals='';
    if(arr.length||dep.length||presentPersonen){
      totals=`<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;font-size:8.5px;font-weight:800;line-height:1;margin-bottom:2px;">
        ${arr.length?`<span style="color:${isToday?'#fff':'#1A7A35'};">↓${arr.length}</span>`:''}
        ${dep.length?`<span style="color:${isToday?'#fff':'#CC7700'};">↑${dep.length}</span>`:''}
        ${presentPersonen?`<span style="color:${isToday?'#fff':'var(--lbl3)'};">👥${presentPersonen}</span>`:''}
      </div>`;
    }

    // Chips (doorlopende balkjes met marker).
    const MAXCHIPS=3;
    let chips='';
    chipsB.slice(0,MAXCHIPS).forEach(b=>{
      const color=GANTT_COLORS[b.status]||'#8E8E93';
      const isArr=CampingGuests.isArrival(b,ds), isDep=CampingGuests.isDeparture(b,ds);
      const marker=isArr?'↓':isDep?'↑':'';
      chips+=`<div onclick="event.stopPropagation();openBookingDetail('${b.id}')" title="${escHtml(b.naam)} · ${b.personen}p · ${b.type||''}"
        style="display:flex;align-items:center;gap:2px;background:${color};color:#fff;border-radius:${isArr?'6px':'0'} ${isDep?'6px':'0'} ${isDep?'6px':'0'} ${isArr?'6px':'0'};padding:1px 4px;margin-bottom:2px;font-size:8.5px;font-weight:700;line-height:1.4;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;">
        <span style="flex-shrink:0;">${marker}</span><span style="overflow:hidden;text-overflow:ellipsis;">${escHtml((b.naam||'').split(' ')[0])}</span>
      </div>`;
    });
    if(chipsB.length>MAXCHIPS){
      chips+=`<div onclick="event.stopPropagation();openDayDetail(${d})" style="font-size:8.5px;font-weight:800;color:${isToday?'#fff':'var(--green)'};cursor:pointer;">+${chipsB.length-MAXCHIPS} meer</div>`;
    }

    const clickFn=hasEv?`onclick="openDayDetail(${d})"`:'';
    html+=`<div class="cal-d ${cls}" style="min-height:70px;align-items:stretch;" ${clickFn}>
      <div class="cal-d-num" style="text-align:center;">${d}</div>
      ${totals}
      <div style="width:100%;">${chips}</div>
    </div>`;
  }
  document.getElementById('calGrid').innerHTML=html;
}

/* ═══════════ DATUMS WIJZIGEN + HERPRIJZING (sectie 24-25) ═══════════ */
// Overlay met datumkiezers + LIVE prijsvergelijking. Wijzigt nooit stilzwijgend:
// Karen ziet oud/nieuw bedrag en verschil voordat ze opslaat.
async function openDateChangeModal(bookingId){
  const b=bookings.find(x=>x.id===bookingId);if(!b)return;
  // Reeds betaald ophalen.
  const {data:pays}=await sb.from('payments').select('bedrag,status').eq('booking_id',bookingId).eq('status','paid');
  const betaald=(pays||[]).reduce((s,p)=>s+Number(p.bedrag||0),0);
  let ov=document.getElementById('dateChangeOverlay');
  if(ov)ov.remove();
  ov=document.createElement('div');
  ov.id='dateChangeOverlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML=`<div style="background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:18px 18px 24px;max-height:90vh;overflow-y:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:16px;font-weight:800;color:var(--lbl1);">📅 Datums wijzigen — ${escHtml(b.naam)}</div>
      <button onclick="document.getElementById('dateChangeOverlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--lbl3);">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
      <div><label style="font-size:11px;font-weight:700;color:var(--lbl3);">Aankomst</label>
        <input type="date" id="dcAankomst" value="${b.aankomst}" onchange="updateDateChangePreview('${bookingId}')" style="width:100%;padding:9px;border:1.5px solid var(--sep);border-radius:9px;font-size:14px;"></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--lbl3);">Vertrek</label>
        <input type="date" id="dcVertrek" value="${b.vertrek}" onchange="updateDateChangePreview('${bookingId}')" style="width:100%;padding:9px;border:1.5px solid var(--sep);border-radius:9px;font-size:14px;"></div>
    </div>
    <div id="dcPreview" data-betaald="${betaald}"></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
      <button onclick="saveDateChange('${bookingId}',false)" style="padding:12px;background:var(--green);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">💾 Opslaan (geen klantmail)</button>
      <button onclick="saveDateChange('${bookingId}',true)" style="padding:12px;background:rgba(0,122,255,.1);color:#007AFF;border:1.5px solid #007AFF;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">💾 Opslaan + wijzigingsmail voorbereiden</button>
      <button onclick="document.getElementById('dateChangeOverlay').remove()" style="padding:11px;background:none;color:var(--lbl3);border:1.5px solid var(--sep);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">Annuleren</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  updateDateChangePreview(bookingId);
}
function _repriceFor(b,nights){
  return calcPrice({tenten:b.tenten,campers:b.campers,extraTypeUnits:b.extraTypeUnits,
    volwassenen:b.volwassenen,kinderen:b.kinderen,baby:b.baby,honden:b.honden,autos:b.autos,
    elektriciteit:b.elektriciteit,nights});
}
function updateDateChangePreview(bookingId){
  const b=bookings.find(x=>x.id===bookingId);if(!b)return;
  const pv=document.getElementById('dcPreview');if(!pv)return;
  const na=document.getElementById('dcAankomst').value, nv=document.getElementById('dcVertrek').value;
  const betaald=Number(pv.dataset.betaald||0);
  const oldNights=nightCount(b.aankomst,b.vertrek);
  const newNights=nightCount(na,nv);
  if(!(newNights>0)){pv.innerHTML='<div style="color:var(--red);font-size:13px;padding:8px 0;">⚠️ Vertrek moet na aankomst liggen.</div>';return;}
  const oldTot=Number(b.bedrag||0);
  const newTot=_repriceFor(b,newNights).totaal;
  const diff=CampingPricing.round2(newTot-oldTot);
  const openstaand=CampingPricing.round2(newTot-betaald);
  const row=(k,v,c)=>`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;${c||''}"><span style="color:var(--lbl3);">${k}</span><span style="font-weight:700;">${v}</span></div>`;
  const teveel=betaald>newTot+0.001;
  pv.innerHTML=`<div style="background:var(--bg);border:1.5px solid var(--sep);border-radius:12px;padding:12px 14px;margin-top:4px;">
    ${row('Nachten',`${oldNights} → <b style="color:var(--lbl1)">${newNights}</b>`)}
    ${row('Oud bedrag',fmt(oldTot))}
    ${row('Nieuw bedrag',fmt(newTot))}
    ${row('Verschil',(diff>=0?'+':'')+fmt(diff),diff!==0?`color:${diff>0?'#CC7700':'#1A7A35'};`:'')}
    ${row('Reeds betaald',fmt(betaald))}
    ${row(teveel?'⚠️ Te veel betaald':'Nieuw openstaand saldo',fmt(Math.abs(openstaand)),`color:${teveel?'#CC7700':openstaand>0?'var(--red)':'var(--green)'};font-weight:800;`)}
    ${teveel?`<div style="font-size:11px;color:#CC7700;margin-top:6px;">Terugbetaling nodig — gebeurt nooit automatisch.</div>`:''}
  </div>`;
}
async function saveDateChange(bookingId,prepMail){
  const b=bookings.find(x=>x.id===bookingId);if(!b)return;
  const na=document.getElementById('dcAankomst').value, nv=document.getElementById('dcVertrek').value;
  const newNights=nightCount(na,nv);
  if(!(newNights>0)){toast('⚠️ Ongeldige datums');return;}
  const r=_repriceFor(b,newNights);
  // Optimistic locking via compare-and-swap op version.
  const res=await casUpdateBooking(bookingId,{aankomst:na,vertrek:nv,bedrag_totaal:r.totaal,bedrag_per_nacht:r.dienstenPerNacht},b.version);
  if(res.conflict){
    document.getElementById('dateChangeOverlay')?.remove();
    toast('⚠️ Boeking werd ondertussen aangepast — nieuwste versie geladen');
    await loadData();
    return;
  }
  if(!res.ok){toast('⚠️ Opslaan mislukt: '+(res.error?.message||''));return;}
  await auditLog('datum_gewijzigd','booking',bookingId,bookingId,
    {oude_waarde:{aankomst:b.aankomst,vertrek:b.vertrek,bedrag:b.bedrag},nieuwe_waarde:{aankomst:na,vertrek:nv,bedrag:r.totaal}});
  document.getElementById('dateChangeOverlay')?.remove();
  toast('✅ Datums bijgewerkt');
  await loadBookings(); // ververst kalender, wie is er, register, lijst, analytics
  if(prepMail){ closeSheet('shDetail'); prepareMail(bookingId); }
}

function openDayDetail(d){
  const ev=bookings.reduce((acc,b)=>{
    const[ay,am,ad]=b.aankomst.split('-').map(Number);
    const[vy,vm,vd]=b.vertrek.split('-').map(Number);
    if(ay===calYear&&am-1===calMonth&&ad===d)acc.arr.push(b);
    if(vy===calYear&&vm-1===calMonth&&vd===d)acc.dep.push(b);
    return acc
  },{arr:[],dep:[]});
  const MONTHS=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  document.getElementById('shDayTitle').textContent=`${d} ${MONTHS[calMonth]} ${calYear}`;
  let html='';
  if(ev.arr.length){
    html+=`<div class="day-ev-section"><div class="day-ev-title" style="color:var(--green);">🟢 Aankomsten (${ev.arr.length})</div>`;
    html+=ev.arr.map(b=>{const sm=STATUS_META[b.status]||{cls:'',label:b.status,icon:''};return`<div class="day-ev-row">${avHtml(b,36,10)}<div><div class="day-ev-name">${b.naam} <span style="color:var(--lbl4);font-weight:400;font-size:12px;">#${b.volgnummer??'—'}</span></div><div class="day-ev-meta">${b.personen} pers · ${VI[b.type]||'⛺'} ${b.type} · <span class="badge ${sm.cls}" style="font-size:10px;padding:1px 6px;">${sm.label}</span></div></div></div>`}).join('');
    html+='</div>'
  }
  if(ev.dep.length){
    html+=`<div class="day-ev-section"><div class="day-ev-title" style="color:var(--orange);">🟠 Vertrekken (${ev.dep.length})</div>`;
    html+=ev.dep.map(b=>`<div class="day-ev-row">${avHtml(b,36,10)}<div><div class="day-ev-name">${b.naam} <span style="color:var(--lbl4);font-weight:400;font-size:12px;">#${b.volgnummer??'—'}</span></div><div class="day-ev-meta">${b.personen} pers · ${b.plaat||'—'}</div></div></div>`).join('');
    html+='</div>'
  }
  if(!html)html='<div class="oc-none">Geen aankomsten of vertrekken op deze dag</div>';
  document.getElementById('dayEvList').innerHTML=html;
  openSheet('shDayDetail')
}

/* ═══════════ OCCUPANCY ═══════════ */
function calcOccupancy(){
  const from=document.getElementById('occFrom').value;
  const to=document.getElementById('occTo').value;
  const maxCap=parseInt(document.getElementById('maxCap').value)||30;
  if(!from||!to||from>=to){toast('⚠️ Kies een geldige periode');return}
  const overlap=bookings.filter(b=>b.aankomst<to&&b.vertrek>from);
  const totalPersons=overlap.reduce((s,b)=>s+b.personen,0);
  const days=Math.round((new Date(to)-new Date(from))/86400000);
  let totalSlots=0;
  for(let i=0;i<days;i++){
    const d=new Date(from);d.setDate(d.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    totalSlots+=bookings.filter(b=>b.aankomst<=ds&&b.vertrek>ds).length
  }
  const avgPerDay=days>0?Math.round(totalSlots/days*10)/10:0;
  const pct=Math.min(Math.round(avgPerDay/maxCap*100),100);
  const color=pct>80?'var(--red)':pct>50?'var(--orange)':'var(--green)';
  document.getElementById('occResult').innerHTML=`
    <div class="occ-stats">
      <div class="occ-stat"><div class="occ-n" style="color:var(--green);">${overlap.length}</div><div class="occ-lbl">Boekingen</div></div>
      <div class="occ-stat"><div class="occ-n" style="color:var(--blue);">${totalPersons}</div><div class="occ-lbl">Personen</div></div>
      <div class="occ-stat"><div class="occ-n">${avgPerDay}</div><div class="occ-lbl">Gem/dag</div></div>
      <div class="occ-stat"><div class="occ-n" style="color:${color};">${pct}%</div><div class="occ-lbl">Bezetting</div></div>
    </div>
    <div class="occ-bar"><div class="occ-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},${color}88);"></div></div>
    <div class="occ-note">${days} dagen · max ${maxCap} plaatsen/dag · ${pct<50?'🟢 Nog plaatsen beschikbaar':pct<80?'🟡 Goed gevuld':'🔴 Bijna vol'}</div>`
}

/* ═══════════ HERO DATE ═══════════ */
function setHeroDate(){
  const D=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const M=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const d=new Date(TODAY);
  document.getElementById('heroDate').textContent=`${D[d.getDay()]} ${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`
}

/* ═══════════ WIE IS ER ═══════════ */
async function renderWieIsEr(date){
  const el=document.getElementById('wieIsErList');if(!el)return;
  const inp=document.getElementById('wieDate');
  if(!date)date=(inp&&inp.value)||TODAY;
  if(inp&&inp.value!==date)inp.value=date;

  // Classificeer op datuminterval via de gedeelde logica (verwacht vs ingecheckt).
  const ingecheckt=[],verwacht=[];
  bookings.forEach(b=>{
    const cat=CampingGuests.presenceCategory(b,date);
    if(cat==='ingecheckt')ingecheckt.push(b);else if(cat==='verwacht')verwacht.push(b);
  });
  if(!ingecheckt.length&&!verwacht.length){el.innerHTML='<div class="oc-none" style="padding:20px 0;">Niemand verwacht of aanwezig op deze datum</div>';return}

  // Eén query: tel bevestigde gasten per boeking (voor de ID-status).
  const ids=[...ingecheckt,...verwacht].map(b=>b.id);
  const counts={};
  if(ids.length){
    const {data}=await sb.from('gasten').select('booking_id').in('booking_id',ids).neq('naam',CampingGuests.PENDING_MARKER).is('deleted_at',null);
    (data||[]).forEach(g=>{counts[g.booking_id]=(counts[g.booking_id]||0)+1});
  }
  el.innerHTML=
    (ingecheckt.length?wieGroupHtml('🏕️ Ingecheckt',ingecheckt,counts,'ingecheckt'):'')+
    (verwacht.length?wieGroupHtml('🕓 Verwacht',verwacht,counts,'verwacht'):'');
}
function wieGroupHtml(titel,list,counts,cat){
  return`<div style="padding:10px 16px 4px;font-size:11px;font-weight:800;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;">${titel} (${list.length})</div>`+
    list.map(b=>wieCard(b,counts[b.id]||0,cat)).join('');
}
function wieCard(b,have,cat){
  const fotoHtml=`<div style="width:44px;height:44px;border-radius:12px;background:${avColor(b.id).bg};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:${avColor(b.id).fg};flex-shrink:0;">${(b.naam||'?')[0].toUpperCase()}</div>`;
  const verblijf=[(b.tenten||0)>0?`${b.tenten}⛺`:'',(b.campers||0)>0?`${b.campers}🚐`:''].filter(Boolean).join(' ')||(b.type||'');
  const nights=nightCount(b.aankomst,b.vertrek);
  const n=b.personen||0;
  const idCompleet=have>=n&&n>0;
  const idBadge=`<span style="font-size:10px;padding:3px 7px;border-radius:20px;background:${idCompleet?'rgba(52,199,89,.14)':'rgba(255,149,0,.14)'};color:${idCompleet?'#1A7A35':'#CC7700'};font-weight:700;">${idCompleet?'✓ ID '+have+'/'+n:'ID '+have+'/'+n}</span>`;
  const statBadge=`<span style="font-size:10px;padding:3px 8px;border-radius:20px;background:${cat==='ingecheckt'?'rgba(0,122,255,.1)':'rgba(88,86,214,.1)'};color:${cat==='ingecheckt'?'#007AFF':'#5856D6'};font-weight:700;">${cat==='ingecheckt'?'🏕️ Aanwezig':'🕓 Verwacht'}</span>`;
  return`<div style="border-bottom:1px solid var(--sep);">
    <div onclick="openWieIsErDetail('${b.id}')" style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:12px 16px;">
      ${fotoHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:var(--lbl1);">${escHtml(b.naam)} <span style="color:var(--lbl4);font-weight:400;font-size:12px;">#${b.volgnummer??'—'}</span></div>
        <div style="font-size:12px;color:var(--lbl3);margin-top:2px;">${n}p · ${verblijf} · ${nights}n · ${fmtDate(b.aankomst)}→${fmtDate(b.vertrek)}</div>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap;">${statBadge}${idBadge}</div>
        ${b.plaat?`<div style="font-size:11px;color:var(--lbl4);margin-top:3px;">🚗 ${escHtml(b.plaat)}</div>`:''}
      </div>
    </div>
    <div id="wie-gasten-${b.id}" style="display:none;padding:0 16px 12px;"></div>
  </div>`;
}

async function openWieIsErDetail(id){
  const el=document.getElementById('wie-gasten-'+id);if(!el)return;
  if(el.style.display==='block'){el.style.display='none';return}
  el.style.display='block';
  el.innerHTML='<div style="font-size:12px;color:var(--lbl3);">Laden…</div>';
  const b=bookings.find(x=>x.id===id);
  const nights=nightCount(b.aankomst,b.vertrek);
  const daysLeft=Math.round((new Date(b.vertrek)-new Date(TODAY))/86400000);

  // Acties
  let html=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
    <button class="da da-g" onclick="sendAutoMail('${id}','bevestiging')"><span class="da-icon">✉️</span>Mail</button>
    <button class="da da-b" onclick="stuurBetaallink('${id}')"><span class="da-icon">💳</span>Betalen</button>
    <button class="da" style="background:rgba(88,86,214,.1);color:#5856D6;" onclick="toonQR('${id}')"><span class="da-icon">📱</span>QR</button>
  </div>`;

  // Gasten ophalen
  const {data:gastenRaw}=await sb.from('gasten').select('*').eq('booking_id',id).order('created_at');
  // Splits pending uploads (door gast zelf) van geregistreerde gasten
  const pendingUploads=(gastenRaw||[]).filter(g=>CampingGuests.isPendingDoc(g));
  const gasten=(gastenRaw||[]).filter(g=>!CampingGuests.isPendingDoc(g));

  // Pending uploads tonen met bulk-scan knop
  if(pendingUploads.length){
    const ids=pendingUploads.map(g=>`'${g.id}'`).join(',');
    html+=`<div style="background:rgba(255,149,0,.1);border:1.5px solid rgba(255,149,0,.4);border-radius:12px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#CC7700;">📱 ${pendingUploads.length} foto${pendingUploads.length>1?'\'s':''} klaar om te scannen</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">Geüpload door de gast via de link</div>
        </div>
        <button id="scanAllBtn-${id}" onclick="scanAllPendingUploads([${ids}],'${id}')" style="padding:8px 14px;background:#FF9500;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;flex-shrink:0;">🔎 Scan alle ${pendingUploads.length}</button>
      </div>
      <div id="scanAllProgress-${id}" style="display:none;">
        <div style="height:5px;background:#ffe5b0;border-radius:3px;overflow:hidden;margin-bottom:6px;">
          <div id="scanAllFill-${id}" style="height:100%;background:#FF9500;border-radius:3px;width:0%;transition:width .4s;"></div>
        </div>
        <div id="scanAllStatus-${id}" style="font-size:11px;color:#CC7700;"></div>
      </div>
    </div>`;
  }

  const {voornaam,achternaam}=splitNaam(b.naam);
  const alleGasten=[
    {voornaam,achternaam,geboortedatum:b.geboortedatum||'—',nationaliteit:b.nationaliteit||'—',id_nummer:b.idnr||'—',rol:'Hoofdboeker'},
    ...gasten.map(g=>({...g,rol:'Gast'}))
  ];
  html+=`<div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">👥 Geregistreerde gasten (${alleGasten.length}/${b.personen})</div>`;
  html+=alleGasten.map(g=>`
    <div style="background:#F9F9FB;border-radius:8px;padding:8px 10px;margin-bottom:5px;font-size:12px;">
      <div style="font-weight:700;color:var(--lbl1);">${g.voornaam} ${g.achternaam} <span style="font-size:10px;font-weight:500;color:var(--lbl4);">${g.rol}</span></div>
      <div style="color:var(--lbl3);margin-top:2px;">📅 ${g.geboortedatum||'—'} · 🌍 ${g.nationaliteit||'—'} · 🪪 ${g.id_nummer||'—'}</div>
    </div>`).join('');
  if(alleGasten.length<b.personen){
    html+=`<div style="font-size:11px;color:#FF9500;font-weight:600;margin-top:4px;">⚠️ ${b.personen-alleGasten.length} persoon/personen nog niet geregistreerd</div>`;
  }
  html+=`<button onclick="openBookingDetail('${id}')" style="margin-top:10px;width:100%;padding:8px;background:none;border:1.5px solid var(--sep);border-radius:8px;font-size:12px;font-weight:700;color:var(--lbl2);cursor:pointer;">Volledige boeking openen →</button>`;
  el.innerHTML=html;
}

/* ═══════════ POLITIEREGISTER ═══════════ */
function splitNaam(naam){
  const parts=(naam||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return{voornaam:'—',achternaam:'—'};
  return{voornaam:parts[0],achternaam:parts.slice(1).join(' ')||'—'}
}
function registerEntries(date){
  return bookings.filter(b=>b.aankomst<=date&&b.vertrek>date&&b.status!=='geannuleerd')
}
async function renderRegister(date){
  const activeBookings=registerEntries(date);
  const wrap=document.getElementById('registerTableWrap');if(!wrap)return;
  if(!activeBookings.length){wrap.innerHTML='<div class="oc-none" style="padding:20px 0;">Geen gasten geregistreerd op deze datum</div>';return}
  wrap.innerHTML='<div style="padding:12px 0;color:var(--lbl3);font-size:13px;">Laden…</div>';

  // Haal gasten op voor alle actieve boekingen
  const bookingIds=activeBookings.map(b=>b.id);
  const {data:gasten}=await sb.from('gasten').select('*').in('booking_id',bookingIds).neq('naam',CampingGuests.PENDING_MARKER);
  const gastenByBooking={};
  (gasten||[]).forEach(g=>{
    if(!gastenByBooking[g.booking_id])gastenByBooking[g.booking_id]=[];
    gastenByBooking[g.booking_id].push(g);
  });

  // Bouw rijen. Zijn er bevestigde gasten? → toon die (geen dubbeltelling met de
  // contactnaam). Geen bevestigde gasten? → voorlopige contactrij met waarschuwing.
  const rows=[];
  activeBookings.forEach(b=>{
    const isVertrek=b.vertrek===date; // vertrekdag = geen overnachting, wel activiteit
    const extraGasten=gastenByBooking[b.id]||[];
    if(extraGasten.length){
      extraGasten.forEach(g=>{
        const gn=splitNaam(g.naam);
        rows.push({
          volgnummer:b.volgnummer, voornaam:gn.voornaam, achternaam:gn.achternaam,
          geboortedatum:g.geboortedatum, geboorteplaats:g.geboorteplaats, nationaliteit:g.nationaliteit,
          documenttype:g.documenttype, idnr:g.id_nummer, nummerplaat:g.nummerplaat||b.plaat, woonplaats:'',
          aankomst:b.aankomst, vertrek:b.vertrek, isVertrek,
          rol:g.is_hoofdgast?'Hoofdgast':'Meereizend', warning:!g.id_nummer
        });
      });
    } else {
      const n=splitNaam(b.naam);
      rows.push({
        volgnummer:b.volgnummer, voornaam:n.voornaam, achternaam:n.achternaam,
        geboortedatum:b.geboortedatum, geboorteplaats:'', nationaliteit:b.nationaliteit,
        documenttype:'', idnr:b.idnr, nummerplaat:b.plaat, woonplaats:b.woonplaats,
        aankomst:b.aankomst, vertrek:b.vertrek, isVertrek,
        rol:'Voorlopig (geen ID)', warning:true
      });
    }
  });

  const missingId=rows.filter(r=>r.warning).length;
  wrap.innerHTML=`
    ${missingId>0?`<div style="background:rgba(255,149,0,.12);border:1px solid rgba(255,149,0,.3);border-radius:var(--r-sm);padding:8px 12px;margin-bottom:10px;font-size:12.5px;color:#CC7700;">⚠️ ${missingId} gast${missingId>1?'en':''} zonder ID-nummer</div>`:''}
    <div style="overflow-x:auto;">
    <table class="reg-table" style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap;">
      <thead><tr style="text-align:left;border-bottom:1.5px solid var(--sep);background:var(--bg);">
        <th style="padding:8px 6px;">#</th>
        <th style="padding:8px 6px;">Voornaam</th>
        <th style="padding:8px 6px;">Achternaam</th>
        <th style="padding:8px 6px;">Geboortedatum</th>
        <th style="padding:8px 6px;">Geboorteplaats</th>
        <th style="padding:8px 6px;">Nationaliteit</th>
        <th style="padding:8px 6px;">Documenttype</th>
        <th style="padding:8px 6px;">Documentnr.</th>
        <th style="padding:8px 6px;">Nummerplaat</th>
        <th style="padding:8px 6px;">Aankomst</th>
        <th style="padding:8px 6px;">Vertrek</th>
        <th style="padding:8px 6px;">Rol</th>
      </tr></thead><tbody>
      ${rows.map(r=>`<tr style="border-bottom:.5px solid var(--sep2);${r.warning?'background:rgba(255,59,48,.04);':''}">
        <td style="padding:7px 6px;color:var(--lbl4);">#${r.volgnummer??'—'}</td>
        <td style="padding:7px 6px;font-weight:600;">${r.voornaam||'—'}</td>
        <td style="padding:7px 6px;font-weight:600;">${r.achternaam||'—'}</td>
        <td style="padding:7px 6px;">${r.geboortedatum?fmtDateLong(r.geboortedatum):'—'}</td>
        <td style="padding:7px 6px;">${r.geboorteplaats||'—'}</td>
        <td style="padding:7px 6px;">${r.nationaliteit||'—'}</td>
        <td style="padding:7px 6px;">${r.documenttype||'—'}</td>
        <td style="padding:7px 6px;font-family:monospace;${!r.idnr?'color:var(--red);font-weight:600;':''}">${r.idnr||'❌'}</td>
        <td style="padding:7px 6px;font-family:monospace;">${r.nummerplaat||'—'}</td>
        <td style="padding:7px 6px;">${fmtDateLong(r.aankomst)}</td>
        <td style="padding:7px 6px;${r.isVertrek?'color:var(--orange);font-weight:700;':''}">${fmtDateLong(r.vertrek)}${r.isVertrek?' ↑':''}</td>
        <td style="padding:7px 6px;color:var(--lbl3);font-size:11px;">${r.rol}</td>
      </tr>`).join('')}
      </tbody>
    </table></div>
    <div style="font-size:11px;color:var(--lbl4);margin-top:8px;">${rows.length} pers. geregistreerd op ${fmtDateLong(date)} (${activeBookings.length} boekingen)</div>`
}

/* ═══════════ CALAMITEITENLIJST NU ═══════════ */
// Snel overzicht van wie vermoedelijk of daadwerkelijk aanwezig is (vandaag).
// Geen ID-afbeeldingen. Print/PDF. Wie de lijst opent/exporteert wordt gelogd.
async function openCalamiteiten(){
  const date=TODAY;
  const present=bookings.filter(b=>{const c=CampingGuests.presenceCategory(b,date);return c==='ingecheckt'||c==='verwacht';});
  const win=window.open('','_blank');
  if(!win){toast('⚠️ Sta pop-ups toe om te openen');return;}
  win.document.write('<html><body style="font-family:Arial;padding:24px;"><p>Calamiteitenlijst laden…</p></body></html>');
  await auditLog('calamiteitenexport','booking',null,null,{nieuwe_waarde:{datum:date,boekingen:present.length}});

  const ids=present.map(b=>b.id);
  const gByB={};
  if(ids.length){
    const {data}=await sb.from('gasten').select('booking_id,naam,is_hoofdgast').in('booking_id',ids).neq('naam',CampingGuests.PENDING_MARKER).is('deleted_at',null);
    (data||[]).forEach(g=>{(gByB[g.booking_id]=gByB[g.booking_id]||[]).push(g);});
  }
  const totPers=present.reduce((s,b)=>s+(b.personen||0),0);
  const totVolw=present.reduce((s,b)=>s+(b.volwassenen||0),0);
  const totKind=present.reduce((s,b)=>s+(b.kinderen||0)+(b.baby||0),0);
  const now=new Date();
  const gentime=`${fmtDateLong(date)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const rowsHtml=present.map((b,i)=>{
    const cat=CampingGuests.presenceCategory(b,date);
    const namen=(gByB[b.id]||[]).map(g=>g.naam).join(', ')||'—';
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(b.naam)}</strong><br><span style="font-size:11px;color:#666;">#${b.volgnummer??'—'}</span></td>
      <td>${b.personen||0} (${b.volwassenen||0}V/${(b.kinderen||0)+(b.baby||0)}K)</td>
      <td>${escHtml(b.type||'')}</td>
      <td>${fmtDateLong(b.aankomst)} → ${fmtDateLong(b.vertrek)}</td>
      <td>${cat==='ingecheckt'?'🏕️ Ingecheckt':'🕓 Verwacht'}</td>
      <td>${b.telefoon||'—'}</td>
      <td>${escHtml(b.plaat||'—')}</td>
      <td style="font-size:11px;">${escHtml(namen)}</td>
    </tr>`;
  }).join('');

  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><title>Calamiteitenlijst — Cosmopolite</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:1000px;margin:0 auto}
  h1{color:#FF3B30;margin-bottom:2px;font-size:22px}.sub{color:#666;margin-bottom:8px;font-size:13px}
  .tot{background:#fff4f4;border:1px solid #ffd0cd;border-radius:8px;padding:10px 14px;margin:12px 0;font-size:14px;font-weight:700;color:#c0271e}
  table{width:100%;border-collapse:collapse}th{background:#FF3B30;color:#fff;padding:9px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}tr:nth-child(even) td{background:#fafafa}
  .footer{margin-top:20px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:8px}
  @media print{.no-print{display:none}}</style></head><body>
  <h1>🚨 Calamiteitenlijst</h1>
  <div class="sub">Camping Cosmopolite · gegenereerd ${gentime}</div>
  <div class="tot">👥 ${totPers} personen aanwezig (${totVolw} volwassenen · ${totKind} kinderen) · ${present.length} boekingen</div>
  <table><thead><tr><th>#</th><th>Boeking</th><th>Pers.</th><th>Type</th><th>Verblijf</th><th>Status</th><th>Telefoon</th><th>Nummerplaat</th><th>Namen</th></tr></thead>
  <tbody>${rowsHtml||'<tr><td colspan="9">Niemand aanwezig</td></tr>'}</tbody></table>
  <div class="footer">⚠️ Vertrouwelijk — bevat persoonsgegevens. Enkel voor noodgebruik door bevoegde medewerkers. Geen ID-afbeeldingen opgenomen.</div>
  <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:10px 18px;background:#FF3B30;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🖨 Afdrukken / PDF</button>
  </body></html>`);
  win.document.close();
}

async function printRegister(){
  const date=document.getElementById('registerDate').value||TODAY;
  const activeBookings=registerEntries(date);
  // Venster meteen openen (vóór await, anders blokkeert popup-blocker)
  const win=window.open('','_blank');
  if(!win){toast('⚠️ Sta pop-ups toe om af te drukken');return;}
  auditLog('politie_export','booking',null,null,{nieuwe_waarde:{datum:date,type:'print'}});
  win.document.write('<html><body style="font-family:Arial;padding:24px;"><p>Register laden met foto\'s…</p></body></html>');

  // Gasten ophalen voor alle actieve boekingen
  const bookingIds=activeBookings.map(b=>b.id);
  const {data:gasten}=bookingIds.length?await sb.from('gasten').select('*').in('booking_id',bookingIds).neq('naam',CampingGuests.PENDING_MARKER):{data:[]};

  // Signed URL's ophalen voor ID-foto's
  const photoUrls={};
  for(const g of(gasten||[])){
    if(g.foto_url){
      const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(g.foto_url,3600);
      if(s?.signedUrl)photoUrls[g.id]=s.signedUrl;
    }
  }

  const gastenByBooking={};
  (gasten||[]).forEach(g=>{
    if(!gastenByBooking[g.booking_id])gastenByBooking[g.booking_id]=[];
    gastenByBooking[g.booking_id].push(g);
  });

  // Rijen samenstellen: hoofdgast + extra gasten
  const rows=[];
  activeBookings.forEach(b=>{
    const n=splitNaam(b.naam);
    const extras=gastenByBooking[b.id]||[];
    rows.push({volgnummer:b.volgnummer,voornaam:n.voornaam,achternaam:n.achternaam,
      geboortedatum:b.geboortedatum,nationaliteit:b.nationaliteit,idnr:b.idnr,
      aankomst:b.aankomst,vertrek:b.vertrek,rol:'Hoofdgast',fotoUrl:null});
    extras.forEach(g=>{
      const gn=splitNaam(g.naam);
      rows.push({volgnummer:b.volgnummer,voornaam:gn.voornaam,achternaam:gn.achternaam,
        geboortedatum:g.geboortedatum,nationaliteit:g.nationaliteit,idnr:g.id_nummer,
        aankomst:b.aankomst,vertrek:b.vertrek,rol:g.is_hoofdgast?'Hoofdgast':'Meereizend',
        fotoUrl:photoUrls[g.id]||null});
    });
  });

  const hasPhotos=rows.some(r=>r.fotoUrl);
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><title>Register Toeristenverblijf — ${date}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:28px;max-width:1200px;margin:0 auto}
    h1{color:#1B8A5B;margin-bottom:4px;font-size:20px}
    .sub{color:#666;margin-bottom:20px;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#1B8A5B;color:#fff;padding:8px;text-align:left}
    td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle}
    tr:nth-child(even) td{background:#f9f9f9}
    .foto-cell img{width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #ddd;}
    .foto-cell{width:60px;text-align:center;}
    .missing{color:#c00;font-weight:600}
    .footer{margin-top:20px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px}
    @media print{body{padding:12px}}
  </style></head><body>
  <h1>🛂 Camping Cosmopolite — Register Toeristenverblijf</h1>
  <div class="sub">Datum: ${fmtDateLong(date)} · ${rows.length} pers. in ${activeBookings.length} boekingen · conform wettelijke registratieplicht toeristenverblijven</div>
  <table>
    <thead><tr>
      <th>#</th><th>Voornaam</th><th>Achternaam</th><th>Geboortedatum</th>
      <th>Nationaliteit</th><th>ID-nummer</th><th>Aankomst</th><th>Vertrek</th><th>Rol</th>
      ${hasPhotos?'<th>Foto</th>':''}
    </tr></thead>
    <tbody>
    ${rows.map(r=>`<tr>
      <td>#${r.volgnummer??'—'}</td>
      <td><b>${r.voornaam||'—'}</b></td>
      <td><b>${r.achternaam||'—'}</b></td>
      <td>${r.geboortedatum?fmtDateLong(r.geboortedatum):'—'}</td>
      <td>${r.nationaliteit||'—'}</td>
      <td class="${!r.idnr?'missing':''}">${r.idnr||'❌ ontbreekt'}</td>
      <td>${fmtDateLong(r.aankomst)}</td>
      <td>${fmtDateLong(r.vertrek)}</td>
      <td style="color:#666;font-size:10px;">${r.rol}</td>
      ${hasPhotos?`<td class="foto-cell">${r.fotoUrl?`<img src="${r.fotoUrl}" alt="ID-foto">`:'—'}</td>`:''}
    </tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">Camping Cosmopolite · Register Toeristenverblijf · Afgedrukt op ${fmtDateLong(TODAY)} · Vertrouwelijk</div>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}
async function exportRegisterCSV(){
  const date=document.getElementById('registerDate').value||TODAY;
  const activeBookings=registerEntries(date);
  auditLog('politie_export','booking',null,null,{nieuwe_waarde:{datum:date,type:'csv'}});
  const rows=[['Volgnummer','Voornaam','Achternaam','Geboortedatum','Nationaliteit','ID-nummer','Woonplaats','Aankomst','Vertrek','Rol']];
  // Haal ook gasten op uit de gasten-tabel
  const bookingIds=activeBookings.map(b=>b.id);
  let gastenMap={};
  if(bookingIds.length){
    const {data:gasten}=await sb.from('gasten').select('*').in('booking_id',bookingIds).neq('naam',CampingGuests.PENDING_MARKER);
    (gasten||[]).forEach(g=>{if(!gastenMap[g.booking_id])gastenMap[g.booking_id]=[];gastenMap[g.booking_id].push(g);});
  }
  activeBookings.forEach(b=>{
    const n=splitNaam(b.naam);
    const extraGasten=gastenMap[b.id]||[];
    rows.push([b.volgnummer??'',n.voornaam,n.achternaam,b.geboortedatum||'',b.nationaliteit||'',b.idnr||'',b.woonplaats||'',b.aankomst,b.vertrek,extraGasten.length>0?'Hoofdgast':'—']);
    extraGasten.forEach(g=>{
      const gn=splitNaam(g.naam);
      rows.push([b.volgnummer??'',gn.voornaam,gn.achternaam,g.geboortedatum||'',g.nationaliteit||'',g.id_nummer||'','',b.aankomst,b.vertrek,g.is_hoofdgast?'Hoofdgast':'Meereizend']);
    });
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`register_${date}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('⬇️ CSV gedownload (incl. alle gasten)')
}

/* ═══════════ INIT ═══════════ */
document.getElementById('presenceBtn').onclick=renderPresenceAndOpen;
/* ═══════════ AUTO MAIL + BETAALLINK + QR ═══════════ */
async function sendAutoMail(bookingId, templateKey){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){toast('⚠️ Niet ingelogd');return}
  const labels={bevestiging:'Bevestigingsmail',herinnering:'Herinneringsmail',betaallink:'Betaallink'};
  if(!confirm(`${labels[templateKey]||'Mail'} sturen naar de klant?`)) return;
  toast('⏳ Mail versturen…');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/send-mail`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify({booking_id:bookingId,template_key:templateKey}),
  });
  const data=await res.json();
  if(data.error){toast('⚠️ '+data.error);return}
  toast('✅ Mail verzonden!');
  loadCommHistory(bookingId);
}

async function stuurBetaallink(bookingId){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){toast('⚠️ Niet ingelogd');return}
  if(!confirm('Betaallink aanmaken via Mollie voor het openstaande saldo en sturen naar de klant?')) return;
  toast('⏳ Betaallink aanmaken…');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/create-payment`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify({booking_id:bookingId}),
  });
  const data=await res.json();
  if(data.error){toast('⚠️ '+data.error);return}
  // Stuur ook mail met betaallink (faalt stil als mail nog niet gekoppeld is)
  try{await sendAutoMail(bookingId,'betaling');}catch(e){}
  navigator.clipboard?.writeText(data.checkout_url);
  toast(`✅ ${data.bijbetaling?'Bijbetaling':'Betaallink'} €${Number(data.bedrag||0).toFixed(2)} aangemaakt & gekopieerd!`);
  loadPaymentInfo(bookingId);
}

let currentQrUrl='';
let _qrRealtimeSub=null;
async function toonQR(bookingId){
  const b=bookings.find(x=>x.id===bookingId);if(!b)return;
  // Haal checkin_token op (of genereer via update)
  let {data}=await sb.from('bookings').select('checkin_token').eq('id',bookingId).single();
  if(!data?.checkin_token){
    const token=crypto.randomUUID();
    await sb.from('bookings').update({checkin_token:token}).eq('id',bookingId);
    data={checkin_token:token};
  }
  const url=`${window.location.origin}/check-in/?id=${bookingId}&t=${data.checkin_token}`;
  currentQrUrl=url;
  document.getElementById('qrUrl').textContent=url;
  // Genereer QR
  const canvas=document.getElementById('qrCanvas');
  canvas.innerHTML='';
  const img=document.createElement('img');
  img.src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  img.style.cssText='width:200px;height:200px;border-radius:12px;';
  canvas.appendChild(img);
  openSheet('shQR');
}
function copyQrUrl(){
  navigator.clipboard?.writeText(currentQrUrl);
  toast('📋 Check-in link gekopieerd!');
}

/* ═══════════ INSTELLINGEN LADEN/OPSLAAN ═══════════ */
let saveDebounce={};
function debounceSave(key,value){
  clearTimeout(saveDebounce[key]);
  saveDebounce[key]=setTimeout(()=>saveSetting(key,value),800);
}
async function saveSetting(key,value){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  await sb.from('settings').upsert({user_id:session.user.id,key,value,updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
}
async function loadSettings(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  const email=session.user.email||'';
  ['settingsUserEmail'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=email;});
  ['settingsUserAvatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=(email[0]||'K').toUpperCase();});

  // Rol ophalen
  const {data:roleRow}=await sb.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
  const roleLabel=roleRow?.role==='admin'?'Beheerder':'Medewerker';
  const roleEl=document.getElementById('settingsUserRole');
  if(roleEl) roleEl.textContent=roleLabel;

  // Alle instellingen ophalen
  const {data}=await sb.from('settings').select('key,value').eq('user_id',session.user.id);
  const cfg={};
  (data||[]).forEach(s=>cfg[s.key]=s.value);

  // Mail instellingen
  if(cfg.mail_from_name)  {const el=document.getElementById('cfgFromName');if(el)el.value=cfg.mail_from_name;}
  if(cfg.mail_from_email) {const el=document.getElementById('cfgFromEmail');if(el)el.value=cfg.mail_from_email;}
  if(cfg.tpl_bevestiging_subject){const el=document.getElementById('cfgSubjectBev');if(el)el.value=cfg.tpl_bevestiging_subject;}
  const bodyEl=document.getElementById('cfgBodyBev');
  if(bodyEl) bodyEl.value=cfg.tpl_bevestiging_body||`Beste {{voornaam}},\n\nBedankt voor je reservatie bij Camping Cosmopolite!\n\nAankomst:  {{aankomst}}\nVertrek:   {{vertrek}}\nNachten:   {{nachten}}\nPersonen:  {{personen}}\nBedrag:    {{bedrag}}\nBetaalreferentie (OGM): {{ogm}}\n\nGelieve het bedrag te betalen met bovenstaande referentie.\n\nTot binnenkort!\n\nVriendelijke groeten,\n{{from_name}}`;

  // Tarieven laden vanuit DB (prijs_ prefix = gedeeld met publieke site)
  const tarMap={prijs_tent:'tent',prijs_camper:'camper',prijs_volwassene:'volwassene',prijs_kind:'kind',
    prijs_baby:'baby',prijs_hond:'hond',prijs_extra_auto:'extraAuto',prijs_elektriciteit:'elektriciteit',
    prijs_afval_per_6:'afvalPer6',toeristentaks:'toeristentaks'};
  Object.entries(tarMap).forEach(([k,pk])=>{if(cfg[k])PRICES[pk]=parseFloat(cfg[k])||PRICES[pk];});
  if(cfg.max_plaatsen)PRICES.maxPlaatsen=parseInt(cfg.max_plaatsen)||0;
  if(cfg.prijs_waarborg!==undefined)PRICES.waarborg=parseFloat(cfg.prijs_waarborg)||0;
  if(cfg.extra_tarieven){try{extraTarieven=JSON.parse(cfg.extra_tarieven)||[];}catch(e){extraTarieven=[]}}
  if(cfg.accommodatie_types){try{accTypes=JSON.parse(cfg.accommodatie_types)||[];}catch(e){accTypes=[]}}
  // Juridische instellingen laden
  ['cfgKBO','cfgBTW','cfgAdres','cfgGemeente','cfgAnnulering'].forEach(id=>{
    const el=document.getElementById(id);if(el&&cfg[id.replace('cfg','').toLowerCase()])el.value=cfg[id.replace('cfg','').toLowerCase()];
  });
  if(cfg.kbo){const el=document.getElementById('cfgKBO');if(el)el.value=cfg.kbo;}
  if(cfg.btw_nummer){const el=document.getElementById('cfgBTW');if(el)el.value=cfg.btw_nummer;}
  if(cfg.adres){const el=document.getElementById('cfgAdres');if(el)el.value=cfg.adres;}
  if(cfg.gemeente){const el=document.getElementById('cfgGemeente');if(el)el.value=cfg.gemeente;}
  if(cfg.annulering_beleid){const el=document.getElementById('cfgAnnulering');if(el)el.value=cfg.annulering_beleid;}
  if(cfg.id_bewaartermijn_dagen){const el=document.getElementById('idRetentionDays');if(el)el.value=cfg.id_bewaartermijn_dagen;}

  // Herinnering template
  if(cfg.tpl_herinnering_subject){const el=document.getElementById('cfgSubjectHer');if(el)el.value=cfg.tpl_herinnering_subject;}
  const herEl=document.getElementById('cfgBodyHer');
  if(herEl) herEl.value=cfg.tpl_herinnering_body||`Beste {{voornaam}},\n\nEen vriendelijke herinnering: je verblijf bij Camping Cosmopolite start over een week!\n\nAankomst:  {{aankomst}}\nVertrek:   {{vertrek}}\nBedrag:    {{bedrag}}\nBetaalreferentie (OGM): {{ogm}}\n\nHeb je vragen? Contacteer ons gerust.\n\nTot binnenkort!\n{{from_name}}`;
}
function toonMailPreview(type='bev'){
  const isHer=type==='her';
  const bodyEl=document.getElementById(isHer?'cfgBodyHer':'cfgBodyBev');
  const from=document.getElementById('cfgFromName').value||'Camping Cosmopolite';
  const vars={voornaam:'Karen',naam:'Karen Cosmopolite',aankomst:'26 juni 2026',vertrek:'28 juni 2026',nachten:'2',personen:'4',bedrag:'€120',ogm:'+++000/0000/00101+++',from_name:from,volgnummer:'1001'};
  const preview=(bodyEl?.value||'').replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||`{{${k}}}`);
  const box=document.getElementById(isHer?'mailPreviewBoxHer':'mailPreviewBox');
  if(!box)return;
  box.textContent=preview;
  box.style.display=box.style.display==='none'?'block':'none';
}
/* ═══════════ SETTINGS OVERLAY ═══════════ */
const SETTINGS_PAGES=['mail','betaling','gebruikers','tarieven','juridisch','account'];
function openSettingsOverlay(page='mail'){
  showView('instellingen',null);
  switchSettingsPage(page);
}
function closeSettingsOverlay(){ showView('overzicht',null); }
function switchSettingsPage(page){
  _lastSettingsPage=page;
  SETTINGS_PAGES.forEach(p=>{
    const nav=document.getElementById('stnav-'+p);
    const panel=document.getElementById('stpage-'+p);
    if(nav) nav.classList.toggle('on',p===page);
    if(panel) panel.style.display=p===page?'block':'none';
  });
  const titles={mail:'Mail',betaling:'Betaling',gebruikers:'Gebruikers',tarieven:'Tarieven',juridisch:'Juridisch & Wettelijk',account:'Account'};
  document.getElementById('settingsPageTitle').textContent=titles[page]||'Instellingen';
  if(page==='gebruikers') loadUsers();
  if(page==='tarieven') loadTarieven();
  if(page==='mail') loadMailTemplates();
}
function switchSettingsTab(tab){ switchSettingsPage(tab); } // legacy alias

/* ═══════════ WACHTWOORD ═══════════ */
async function changePassword(){
  const pw1=document.getElementById('newPassword').value;
  const pw2=document.getElementById('newPassword2').value;
  const msg=document.getElementById('pwMsg');
  const btn=document.getElementById('changePwBtn');
  msg.style.color='var(--lbl3)';
  if(pw1.length<8){msg.textContent='⚠️ Minimum 8 tekens';msg.style.color='var(--red)';return}
  if(pw1!==pw2){msg.textContent='⚠️ Wachtwoorden komen niet overeen';msg.style.color='var(--red)';return}
  btn.textContent='Opslaan…';btn.disabled=true;
  const {error}=await sb.auth.updateUser({password:pw1});
  if(error){msg.textContent='⚠️ '+error.message;msg.style.color='var(--red)';}
  else{msg.textContent='✅ Wachtwoord gewijzigd!';msg.style.color='var(--green)';document.getElementById('newPassword').value='';document.getElementById('newPassword2').value='';}
  btn.textContent='Wachtwoord opslaan';btn.disabled=false;
}
async function sendPasswordReset(){
  const btn=document.getElementById('resetPwBtn');
  const msg=document.getElementById('resetPwMsg');
  const {data:{session}}=await sb.auth.getSession();
  if(!session){msg.textContent='⚠️ Niet ingelogd';return}
  btn.textContent='Versturen…';btn.disabled=true;
  const {error}=await sb.auth.resetPasswordForEmail(session.user.email,{
    redirectTo:'https://camping-cosmopolite.netlify.app/dashboard/'
  });
  if(error){msg.textContent='⚠️ '+error.message;msg.style.color='var(--red)';}
  else{msg.textContent='✅ Herstelmail verzonden naar '+session.user.email;msg.style.color='var(--green)';}
  btn.textContent='📨 Herstelmail sturen';btn.disabled=false;
}

/* ═══════════ GEBRUIKERSBEHEER ═══════════ */
async function inviteUser(){
  const email=document.getElementById('inviteEmail').value.trim();
  const role=document.getElementById('inviteRole').value;
  const btn=document.getElementById('inviteBtn');
  const msg=document.getElementById('inviteMsg');
  if(!email){msg.textContent='⚠️ Vul een e-mailadres in';msg.style.color='var(--red)';return}
  btn.textContent='Versturen…';btn.disabled=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(`${SUPABASE_URL}/functions/v1/invite-user`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({email,role}),
    });
    const d=await res.json();
    if(d.error) throw new Error(d.error);
    msg.textContent=`✅ Uitnodiging verstuurd naar ${d.email}`;msg.style.color='var(--green)';
    document.getElementById('inviteEmail').value='';
    setTimeout(()=>loadUsers(),1200);
  }catch(err){msg.textContent='⚠️ '+err.message;msg.style.color='var(--red)';}
  finally{btn.textContent='📨 Uitnodiging sturen';btn.disabled=false;}
}
async function loadUsers(){
  const el=document.getElementById('usersList');
  if(!el) return;
  const {data,error}=await sb.from('user_roles').select('user_id,role,created_at');
  if(error||!data?.length){el.innerHTML='<div style="color:var(--lbl4);font-size:13px;padding:8px 0;">Geen extra gebruikers gevonden.</div>';return}
  el.innerHTML=data.map(u=>`
    <div class="cfg-row">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--lbl1);">${u.user_id.slice(0,8)}…</div>
        <div style="font-size:11px;color:var(--lbl4);margin-top:1px;">Toegevoegd ${new Date(u.created_at).toLocaleDateString('nl-BE')}</div>
      </div>
      <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${u.role==='admin'?'rgba(255,59,48,.1)':'rgba(27,138,91,.1)'};color:${u.role==='admin'?'var(--red)':'var(--green)'};">${u.role==='admin'?'Beheerder':'Medewerker'}</span>
    </div>
    ${data.indexOf(u)<data.length-1?'<div class="cfg-sep"></div>':''}`).join('');
}

/* ═══════════ TARIEVEN ═══════════ */
// extraTarieven en accTypes worden gedeclareerd in loadPricesFromDB sectie hierboven

function renderAccTypes(){
  const el=document.getElementById('accTypesList');if(!el)return;
  if(!accTypes.length){el.innerHTML='';return;}
  el.innerHTML=accTypes.map((t,i)=>`
    <div style="background:var(--bg);border:1.5px solid var(--sep);border-radius:14px;padding:14px;margin-bottom:10px;">
      <!-- Header: emoji + naam + prijs + verwijder -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <input value="${t.emoji||'🏕️'}" oninput="accTypes[${i}].emoji=this.value"
          style="width:44px;height:44px;border:1.5px solid var(--sep);border-radius:10px;text-align:center;font-size:22px;background:var(--bg2);flex-shrink:0;cursor:text;">
        <input value="${t.naam||''}" placeholder="Naam (bv. Safaritent)" oninput="accTypes[${i}].naam=this.value"
          style="flex:1;font-size:15px;font-weight:700;border:none;background:transparent;color:var(--lbl1);outline:none;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:3px;flex-shrink:0;background:rgba(27,138,91,.08);border-radius:10px;padding:6px 10px;">
          <span style="font-size:13px;color:var(--lbl3);">€</span>
          <input type="number" min="0" step="0.5" value="${t.prijs||0}" oninput="accTypes[${i}].prijs=parseFloat(this.value)||0"
            style="width:54px;font-size:20px;font-weight:800;color:var(--green);border:none;background:transparent;text-align:center;outline:none;-moz-appearance:textfield;">
          <span style="font-size:11px;color:var(--lbl4);">/n</span>
        </div>
        <button onclick="verwijderAccType(${i})" title="Verwijder"
          style="background:rgba(255,59,48,.1);color:#FF3B30;border:none;border-radius:10px;width:36px;height:36px;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">🗑</button>
      </div>
      <!-- Stats: max personen + waarborg -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:var(--bg2);border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:11px;color:var(--lbl4);margin-bottom:4px;">👥 Max. personen</div>
          <input type="number" min="0" step="1" value="${t.maxPersonen||0}" placeholder="0" oninput="accTypes[${i}].maxPersonen=parseInt(this.value)||0"
            style="width:60px;font-size:20px;font-weight:800;color:var(--lbl1);border:none;background:transparent;text-align:center;outline:none;-moz-appearance:textfield;">
          <div style="font-size:10px;color:var(--lbl4);margin-top:2px;">0 = geen limiet</div>
        </div>
        <div style="background:var(--bg2);border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-size:11px;color:var(--lbl4);margin-bottom:4px;">🔒 Waarborg</div>
          <div style="display:flex;align-items:baseline;justify-content:center;gap:2px;">
            <span style="font-size:13px;color:var(--lbl3);">€</span>
            <input type="number" min="0" step="10" value="${t.waarborgBedrag||0}" placeholder="0" oninput="accTypes[${i}].waarborgBedrag=parseFloat(this.value)||0"
              style="width:60px;font-size:20px;font-weight:800;color:var(--lbl1);border:none;background:transparent;text-align:center;outline:none;-moz-appearance:textfield;">
          </div>
          <div style="font-size:10px;color:var(--lbl4);margin-top:2px;">cash bij aankomst</div>
        </div>
      </div>
      <!-- All-in prijs -->
      <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:12.5px;color:var(--lbl2);cursor:pointer;background:var(--bg2);border-radius:8px;padding:9px 11px;">
        <input type="checkbox" ${t.allIn?'checked':''} onchange="accTypes[${i}].allIn=this.checked" style="width:16px;height:16px;flex-shrink:0;margin-top:1px;">
        <span><b>All-in prijs</b> — €${t.prijs||0}/nacht dekt alles (geen aparte persoons- of afvalkost). Enkel toeristentaks komt erbij. Bv. backpacker.</span>
      </label>
      <!-- Beschrijving -->
      <input value="${t.beschrijving||''}" placeholder="Beschrijving voor gast (bv. 'Incl. beddengoed, max. 6 personen')" oninput="accTypes[${i}].beschrijving=this.value"
        style="width:100%;font-size:12px;color:var(--lbl2);border:1.5px solid var(--sep);border-radius:8px;padding:8px 10px;background:var(--bg2);box-sizing:border-box;">
    </div>`).join('');
}
function voegAccTypesToe(){
  accTypes.push({id:'custom_'+Date.now(),naam:'',emoji:'🏕️',prijs:0,maxPersonen:0,waarborgBedrag:0,allIn:false,beschrijving:''});
  renderAccTypes();
}
function verwijderAccType(i){
  accTypes.splice(i,1);
  renderAccTypes();
}

function loadTarieven(){
  document.getElementById('tarTent').value=PRICES.tent;
  document.getElementById('tarCamper').value=PRICES.camper;
  document.getElementById('tarVolw').value=PRICES.volwassene;
  document.getElementById('tarKind').value=PRICES.kind;
  document.getElementById('tarBaby').value=PRICES.baby;
  document.getElementById('tarHond').value=PRICES.hond;
  document.getElementById('tarAuto').value=PRICES.extraAuto;
  document.getElementById('tarElek').value=PRICES.elektriciteit;
  document.getElementById('tarAfval').value=PRICES.afvalPer6;
  document.getElementById('tarTaks').value=PRICES.toeristentaks;
  const mp=document.getElementById('tarMaxPlaatsen');if(mp)mp.value=PRICES.maxPlaatsen||0;
  renderAccTypes();
  renderExtraTarieven();
}
function renderExtraTarieven(){
  const el=document.getElementById('extraTarievenList');if(!el)return;
  el.innerHTML=extraTarieven.map((t,i)=>`
    <div style="border:1px solid var(--sep);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input class="cfg-row-input" style="flex:2;" value="${t.naam||''}" placeholder="Naam (bv. Safaritent)" oninput="extraTarieven[${i}].naam=this.value">
        <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
          <span style="color:var(--lbl3);font-size:13px;">€</span>
          <input class="cfg-row-input" type="number" min="0" step="0.5" style="width:60px;text-align:right;" value="${t.prijs||0}" oninput="extraTarieven[${i}].prijs=parseFloat(this.value)||0">
        </div>
        <button onclick="verwijderExtraTarief(${i})" style="background:rgba(255,59,48,.1);color:#FF3B30;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer;flex-shrink:0;">🗑</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['standplaats','personen','extra'].map(cat=>`<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--lbl2);cursor:pointer;"><input type="radio" name="cat_${i}" value="${cat}" ${(t.categorie||'extra')===cat?'checked':''} onchange="extraTarieven[${i}].categorie=this.value"> ${cat==='standplaats'?'🏕 /standplaats/nacht':cat==='personen'?'👤 /persoon/nacht':'➕ Eenmalig extra'}</label>`).join('')}
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--lbl2);cursor:pointer;"><input type="checkbox" ${t.perNacht?'checked':''} onchange="extraTarieven[${i}].perNacht=this.checked"> /nacht</label>
      </div>
    </div>`).join('')||'<div style="font-size:12px;color:var(--lbl4);padding:4px 0;">Nog geen extra kostenposten</div>';
}
function voegExtraTarief(){
  extraTarieven.push({naam:'',prijs:0,key:'extra_'+(Date.now())});
  renderExtraTarieven();
}
function verwijderExtraTarief(i){
  extraTarieven.splice(i,1);
  renderExtraTarieven();
}
function updateTarief(key,val){
  PRICES[key]=parseFloat(val)||0;
  updatePriceLive();
}
async function saveTarieven(){
  const btn=document.getElementById('saveTarBtn');
  const msg=document.getElementById('tarMsg');
  btn.textContent='Opslaan…';btn.disabled=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    PRICES.maxPlaatsen=parseInt(document.getElementById('tarMaxPlaatsen')?.value)||0;
    const pairs=[['prijs_tent',PRICES.tent],['prijs_camper',PRICES.camper],
      ['prijs_volwassene',PRICES.volwassene],['prijs_kind',PRICES.kind],['prijs_baby',PRICES.baby],
      ['prijs_hond',PRICES.hond],['prijs_extra_auto',PRICES.extraAuto],
      ['prijs_elektriciteit',PRICES.elektriciteit],['prijs_afval_per_6',PRICES.afvalPer6],['toeristentaks',PRICES.toeristentaks],
      ['max_plaatsen',PRICES.maxPlaatsen],
      ['extra_tarieven',JSON.stringify(extraTarieven.filter(t=>t.naam.trim()))],
      ['accommodatie_types',JSON.stringify(accTypes.filter(t=>t.naam.trim()))]];
    for(const [key,value] of pairs){
      await sb.from('settings').upsert({user_id:session.user.id,key,value:String(value),updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
    }
    msg.textContent='✅ Tarieven opgeslagen!';msg.style.color='var(--green)';
  }catch(err){msg.textContent='⚠️ '+err.message;msg.style.color='var(--red)';}
  finally{btn.textContent='Tarieven opslaan';btn.disabled=false;setTimeout(()=>msg.textContent='',3000);}
}
async function saveJuridisch(){
  const btn=document.getElementById('saveJuridischBtn');
  const msg=document.getElementById('juridischMsg');
  btn.textContent='Opslaan…';btn.disabled=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    const pairs=[
      ['kbo',document.getElementById('cfgKBO')?.value.trim()||''],
      ['btw_nummer',document.getElementById('cfgBTW')?.value.trim()||''],
      ['adres',document.getElementById('cfgAdres')?.value.trim()||''],
      ['gemeente',document.getElementById('cfgGemeente')?.value.trim()||''],
      ['annulering_beleid',document.getElementById('cfgAnnulering')?.value.trim()||''],
      ['id_bewaartermijn_dagen',document.getElementById('idRetentionDays')?.value||'90'],
    ];
    for(const [key,value] of pairs){
      await sb.from('settings').upsert({user_id:session.user.id,key,value,updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
    }
    msg.textContent='✅ Juridische gegevens opgeslagen!';msg.style.color='var(--green)';
  }catch(err){msg.textContent='⚠️ '+err.message;msg.style.color='var(--red)';}
  finally{btn.textContent='Opslaan';btn.disabled=false;setTimeout(()=>msg.textContent='',3000);}
}

async function exportToeristentaksReport(){
  const maand=document.getElementById('taksMonth')?.value||TODAY.slice(0,7);
  const [y,m]=maand.split('-').map(Number);
  const vanDatum=`${y}-${String(m).padStart(2,'0')}-01`;
  const totDatum=`${y}-${String(m+1>12?1:m+1).padStart(2,'0')}-${m+1>12?y+1:y}-01`.split('-').slice(0,3).join('-');
  // Alle boekingen die overlap hebben met de maand
  const overlap=bookings.filter(b=>b.aankomst<`${y+1}-01-01`&&b.vertrek>vanDatum&&b.status!=='geannuleerd');
  const rows=[['Boeking#','Naam','Aankomst','Vertrek','Volwassenen','Nachten (in maand)','Taks/volw/nacht','Toeristentaks']];
  const taksPerNacht=PRICES.toeristentaks;
  let totaalTaks=0;
  const dim=new Date(y,m,0).getDate();
  overlap.forEach(b=>{
    const aankD=new Date(b.aankomst),vertD=new Date(b.vertrek);
    const startM=new Date(y,m-1,1),endM=new Date(y,m,1);
    const overlapStart=new Date(Math.max(aankD,startM));
    const overlapEnd=new Date(Math.min(vertD,endM));
    const nachtsMaand=Math.max(0,Math.round((overlapEnd-overlapStart)/86400000));
    const volw=b.volwassenen||0;
    const taks=Math.round(volw*taksPerNacht*nachtsMaand*100)/100;
    totaalTaks+=taks;
    rows.push([`#${b.volgnummer??'—'}`,b.naam,b.aankomst,b.vertrek,volw,nachtsMaand,`€${taksPerNacht}`,`€${taks.toFixed(2)}`]);
  });
  rows.push(['','','','','','','TOTAAL',`€${totaalTaks.toFixed(2)}`]);
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`toeristentaks_${maand}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast(`⬇️ Toeristentaks rapport ${maand} gedownload (€${totaalTaks.toFixed(2)} totaal)`);
}

async function saveMollieKey(){
  const key=document.getElementById('cfgMollieKey').value.trim();
  const btn=document.getElementById('saveMollieBtn');
  const msg=document.getElementById('mollieSaveMsg');
  if(!key){msg.textContent='⚠️ Vul een Mollie sleutel in';return}
  btn.textContent='Opslaan…';btn.disabled=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(`${SUPABASE_URL}/functions/v1/save-api-keys`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({mollie_key:key}),
    });
    const d=await res.json();
    if(d.error) throw new Error(d.error);
    msg.textContent='✅ Mollie sleutel opgeslagen!';msg.style.color='var(--green)';
    document.getElementById('cfgMollieKey').value='';
  }catch(err){msg.textContent='⚠️ '+err.message;msg.style.color='var(--red)';}
  finally{btn.textContent='Sleutel opslaan';btn.disabled=false;}
}
async function saveApiKeys(){
  const resend=document.getElementById('cfgResendKey').value.trim();
  const mollie=document.getElementById('cfgMollieKey').value.trim();
  const btn=document.getElementById('saveApiBtn');
  const msg=document.getElementById('apiSaveMsg');
  if(!resend&&!mollie){msg.textContent='⚠️ Vul minstens één sleutel in';return}
  btn.textContent='Opslaan…';btn.disabled=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    // Stuur keys naar Supabase secrets via een edge function of sla hint op
    const res=await fetch(`${SUPABASE_URL}/functions/v1/save-api-keys`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({resend_key:resend||null,mollie_key:mollie||null}),
    });
    const d=await res.json();
    if(d.error) throw new Error(d.error);
    msg.textContent='✅ Sleutels opgeslagen!';
    msg.style.color='var(--green)';
    document.getElementById('cfgResendKey').value='';
    document.getElementById('cfgMollieKey').value='';
  }catch(err){
    msg.textContent='⚠️ '+err.message;
    msg.style.color='var(--red)';
  }finally{btn.textContent='Sleutels opslaan';btn.disabled=false;}
}

/* ═══════════ GASTEN ═══════════ */
const _gastenCache={};  // {id: gastObject}
async function loadGasten(bookingId){
  const el=document.getElementById('gastenList');if(!el)return;
  const {data,error}=await sb.from('gasten').select('*').eq('booking_id',bookingId).order('is_hoofdgast',{ascending:false}).order('created_at');
  if(error){el.textContent='Kon gasten niet laden';return}
  if(!data||!data.length){el.innerHTML='<div style="padding:4px 0 12px;font-size:13px;color:var(--lbl4);">Nog geen gasten toegevoegd</div>';return}
  data.forEach(g=>_gastenCache[g.id]=g);
  el.innerHTML=data.map(g=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:.5px solid var(--sep);">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">👤</div>
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="openEditGuestSheet('${g.id}')">
        <div style="font-size:14px;font-weight:700;color:var(--lbl1);">${escHtml(g.naam)}${g.is_hoofdgast?' <span style="font-size:10px;background:var(--green);color:#fff;padding:2px 6px;border-radius:8px;margin-left:4px;">Hoofd</span>':''}${g.foto_url?' <span title="ID-foto bewaard" style="font-size:11px;margin-left:2px;">📷</span>':''}</div>
        <div style="font-size:11.5px;color:var(--lbl3);margin-top:1px;">${[g.geboortedatum?fmtDateLong(g.geboortedatum):'',g.nationaliteit||'',g.id_nummer||''].filter(Boolean).join(' · ')||'Tik om te bewerken…'}</div>
        ${g.nummerplaat?`<div style="font-size:11px;color:var(--lbl4);font-family:monospace;">${escHtml(g.nummerplaat)}</div>`:''}
      </div>
      <button onclick="openEditGuestSheet('${g.id}')" style="color:var(--blue);font-size:14px;padding:6px;background:rgba(0,122,255,.08);border:none;border-radius:8px;cursor:pointer;flex-shrink:0;">✏️</button>
      <button onclick="deleteGast('${g.id}','${bookingId}')" style="color:var(--red);font-size:14px;padding:6px;background:rgba(255,59,48,.08);border:none;border-radius:8px;cursor:pointer;flex-shrink:0;">🗑</button>
    </div>`).join('')
}

async function deleteGast(gastId,bookingId){
  if(!confirm('Gast verwijderen?'))return;
  await sb.from('gasten').delete().eq('id',gastId);
  loadGasten(bookingId);
}

/* ═══════════ ID-DOCUMENTEN PANEEL — bewuste AI-gate (Fase 3) ═══════════ */
const _docPanelState={}; // {bookingId:{docs:[],sel:Set}}
const DOC_STATUS_META={
  documenten_ontvangen:{lbl:'Ontvangen',cls:'',icon:'📥'},
  klaar_voor_ai:{lbl:'Klaar voor AI',cls:'',icon:'⏳'},
  ai_bezig:{lbl:'AI bezig…',cls:'',icon:'🔄'},
  ai_uitgelezen_controle_nodig:{lbl:'Controle nodig',cls:'',icon:'👁️'},
  gegevens_bevestigd:{lbl:'Bevestigd',cls:'',icon:'✅'},
  document_onleesbaar:{lbl:'Onleesbaar',cls:'',icon:'⚠️'},
  document_afgekeurd:{lbl:'Afgekeurd',cls:'',icon:'🚫'},
  fout_bij_verwerking:{lbl:'Fout',cls:'',icon:'❌'},
};
function docStatusColor(s){
  return s==='gegevens_bevestigd'?'var(--green)'
    :s==='ai_uitgelezen_controle_nodig'?'#FF9500'
    :s==='document_afgekeurd'||s==='document_onleesbaar'||s==='fout_bij_verwerking'?'var(--red)'
    :'var(--lbl3)';
}

// Auditlog — privacygevoelige/wettelijke gebeurtenissen, append-only.
async function auditLog(actie,entiteit,entiteitId,bookingId,extra){
  try{
    const {data:{user}}=await sb.auth.getUser();
    await sb.from('audit_logs').insert({
      actor:user?.id||null, actor_email:user?.email||null,
      actie, entiteit, entiteit_id:entiteitId||null, booking_id:bookingId||null,
      bron:'medewerker', ...(extra||{})
    });
  }catch(_e){/* auditfout mag de actie niet blokkeren */}
}

async function _signedUrl(path,secs){
  const {data}=await sb.storage.from('id-fotos').createSignedUrl(path,secs||300);
  return data?.signedUrl||null;
}

async function loadBookingDocuments(bookingId){
  const el=document.getElementById('docPanel');if(!el)return;
  const {data,error}=await sb.from('booking_documents')
    .select('*').eq('booking_id',bookingId).is('deleted_at',null).order('slot_index').order('created_at');
  if(error){el.innerHTML='<div style="font-size:12px;color:var(--lbl4);">Kon documenten niet laden</div>';return;}
  _docPanelState[bookingId]={docs:data||[],sel:new Set()};
  // Standaard: selecteer alles wat nog niet bevestigd is.
  (data||[]).forEach(d=>{if(d.status!=='gegevens_bevestigd'&&d.status!=='document_afgekeurd')_docPanelState[bookingId].sel.add(d.id);});
  await renderDocPanel(bookingId);
}

async function renderDocPanel(bookingId){
  const el=document.getElementById('docPanel');if(!el)return;
  const st=_docPanelState[bookingId];const docs=st?.docs||[];
  if(!docs.length){
    el.innerHTML='<div style="background:var(--bg);border:1.5px dashed var(--sep);border-radius:12px;padding:16px;text-align:center;font-size:12.5px;color:var(--lbl4);">📭 Nog geen ID-documenten geüpload door de gast</div>';
    return;
  }
  const b=bookings.find(x=>x.id===bookingId);
  const nPersonen=b?.personen||0;
  const nNieuw=docs.filter(d=>st.sel.has(d.id)&&!d.ai_result).length;
  const nReeds=docs.filter(d=>st.sel.has(d.id)&&d.ai_result).length;

  // Signed previews ophalen (parallel).
  const urls=await Promise.all(docs.map(d=>_signedUrl(d.storage_path,300)));

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <div style="font-size:11px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.4px;">📄 ID-documenten (${docs.length}/${nPersonen})</div>
    <button onclick="toggleAllDocs('${bookingId}')" style="font-size:11px;color:var(--blue);background:none;border:none;cursor:pointer;font-weight:700;">Alles aan/uit</button>
  </div>`;

  html+=docs.map((d,i)=>{
    const sm=DOC_STATUS_META[d.status]||{lbl:d.status,icon:'•'};
    const checked=st.sel.has(d.id)?'checked':'';
    const isPdf=d.media_type==='application/pdf';
    const thumb=urls[i]&&!isPdf
      ?`<img src="${urls[i]}" onclick="openDocImage('${bookingId}','${d.id}')" style="width:52px;height:52px;border-radius:8px;object-fit:cover;cursor:pointer;border:1.5px solid var(--sep);flex-shrink:0;">`
      :`<div onclick="openDocImage('${bookingId}','${d.id}')" style="width:52px;height:52px;border-radius:8px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--lbl3);cursor:pointer;flex-shrink:0;">${isPdf?'PDF':'IMG'}</div>`;
    return`<div style="border:1.5px solid var(--sep);border-radius:11px;padding:9px;margin-bottom:8px;background:#fff;">
      <div style="display:flex;align-items:center;gap:9px;">
        <input type="checkbox" ${checked} onchange="toggleDocSel('${bookingId}','${d.id}')" ${d.status==='gegevens_bevestigd'?'disabled':''} style="width:17px;height:17px;flex-shrink:0;">
        ${thumb}
        <div style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:700;color:var(--lbl1);">Persoon ${(d.slot_index??i)+1}${(d.slot_index??i)===0?' · hoofdboeker':''}</div>
          <div style="font-size:11px;color:${docStatusColor(d.status)};font-weight:600;">${sm.icon} ${sm.lbl}</div>
          <div style="font-size:10px;color:var(--lbl4);font-family:monospace;" title="SHA-256">#${(d.content_hash||'').slice(0,10)}</div>
        </div>
      </div>
      ${d.ai_result?renderDocReview(bookingId,d):''}
      ${d.fout_melding?`<div style="font-size:11px;color:var(--red);margin-top:6px;">⚠️ ${escHtml(d.fout_melding)}</div>`:''}
    </div>`;
  }).join('');

  // AI-gate knop met kostwaarschuwing.
  const anySel=st.sel.size>0;
  html+=`<div id="docAiProgress-${bookingId}" style="display:none;margin:6px 0;">
      <div style="height:5px;background:var(--sep);border-radius:3px;overflow:hidden;"><div id="docAiFill-${bookingId}" style="height:100%;width:0%;background:#FF9500;transition:width .3s;"></div></div>
      <div id="docAiStatus-${bookingId}" style="font-size:11px;color:#CC7700;margin-top:4px;"></div>
    </div>`;
  html+=`<button id="docAiBtn-${bookingId}" ${anySel?'':'disabled'} onclick="aiScanSelected('${bookingId}')"
      style="width:100%;padding:11px;background:${anySel?'#5856D6':'#c7c7cc'};color:#fff;border:none;border-radius:10px;font-size:13.5px;font-weight:800;cursor:${anySel?'pointer':'default'};">
      🤖 Geselecteerde ID's inlezen met AI${anySel?` (${st.sel.size})`:''}
    </button>`;
  if(anySel){
    html+=`<div style="font-size:11px;color:var(--lbl4);margin-top:6px;line-height:1.5;">
      ${nNieuw} nieuw document${nNieuw===1?'':'en'} wordt uitgelezen${nReeds?` · ${nReeds} reeds verwerkt wordt overgeslagen (geen extra kost)`:''}. Dit veroorzaakt AI-verbruik.</div>`;
  }
  const nBevestigd=docs.filter(d=>d.status==='gegevens_bevestigd').length;
  if(docs.some(d=>d.ai_result&&d.status!=='gegevens_bevestigd')){
    html+=`<button onclick="confirmAllDocs('${bookingId}')" style="width:100%;padding:10px;margin-top:8px;background:var(--green);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;">✅ Alle gecontroleerde personen bevestigen</button>`;
  }
  html+=`<div style="font-size:11px;color:var(--lbl4);margin-top:6px;">${nBevestigd}/${docs.length} bevestigd</div>`;
  el.innerHTML=html;
}

// Bewerkbaar controleformulier per document (AI-resultaat = concept tot bevestiging).
function renderDocReview(bookingId,d){
  const r=d.ai_result||{};
  const b=bookings.find(x=>x.id===bookingId);
  const conf=r.confidence||'gemiddeld';
  const confColor=conf==='hoog'?'var(--green)':conf==='laag'?'var(--red)':'#FF9500';
  const bevestigd=d.status==='gegevens_bevestigd';
  // Verschil met de hoofdboeker-naam op het formulier (alleen voor de hoofdboeker-slot).
  let diff='';
  if((d.slot_index??0)===0 && b?.naam && r.naam && b.naam.trim().toLowerCase()!==r.naam.trim().toLowerCase()){
    diff=`<div style="font-size:10.5px;color:#CC7700;margin-bottom:6px;background:rgba(255,149,0,.1);padding:5px 7px;border-radius:7px;">
      ⚠️ Formulier: <b>${escHtml(b.naam)}</b> · ID: <b>${escHtml(r.naam)}</b> — kies de juiste.</div>`;
  }
  const f=(id,lbl,val,type)=>`<label style="display:block;font-size:10px;font-weight:700;color:var(--lbl3);text-transform:uppercase;letter-spacing:.3px;margin:5px 0 2px;">${lbl}</label>
    <input id="dr-${id}-${d.id}" type="${type||'text'}" value="${escHtml(val||'')}" ${bevestigd?'disabled':''} style="width:100%;padding:7px 9px;border:1.5px solid var(--sep);border-radius:8px;font-size:13px;background:${bevestigd?'var(--bg)':'#fff'};">`;
  return`<div style="margin-top:9px;padding-top:9px;border-top:1px dashed var(--sep);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:10.5px;font-weight:700;color:var(--lbl3);">🤖 AI-resultaat (controleer)</span>
      <span style="font-size:10px;font-weight:700;color:${confColor};">zekerheid: ${conf}</span>
    </div>
    ${diff}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div>${f('voornaam','Voornaam',r.voornaam)}</div>
      <div>${f('achternaam','Achternaam',r.achternaam)}</div>
      <div>${f('geboortedatum','Geboortedatum',r.geboortedatum,'date')}</div>
      <div>${f('geboorteplaats','Geboorteplaats',r.geboorteplaats)}</div>
      <div>${f('nationaliteit','Nationaliteit',r.nationaliteit)}</div>
      <div>${f('documenttype','Documenttype',r.documenttype)}</div>
      <div>${f('documentnummer','Documentnr.',r.documentnummer)}</div>
      <div style="display:flex;align-items:flex-end;padding-bottom:1px;"><label style="font-size:11.5px;color:var(--lbl2);display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" id="dr-hoofd-${d.id}" ${r._hoofdgast||(d.slot_index??0)===0?'checked':''} ${bevestigd?'disabled':''}> Hoofdgast</label></div>
    </div>
    ${bevestigd?`<div style="font-size:11px;color:var(--green);font-weight:700;margin-top:7px;">✅ Bevestigd & gekoppeld aan de boeking</div>`
      :`<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;margin-top:8px;">
        <button onclick="confirmDocGuest('${bookingId}','${d.id}')" style="padding:8px;background:var(--green);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;">✅ Bevestig persoon</button>
        <button onclick="rescanDoc('${bookingId}','${d.id}')" style="padding:8px;background:var(--bg2);color:var(--lbl2);border:1.5px solid var(--sep);border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;">↻ Opnieuw</button>
        <button onclick="rejectDoc('${bookingId}','${d.id}')" style="padding:8px;background:#fff;color:var(--red);border:1.5px solid rgba(255,59,48,.4);border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;">🚫 Afkeuren</button>
      </div>`}
  </div>`;
}

function toggleDocSel(bookingId,docId){
  const st=_docPanelState[bookingId];if(!st)return;
  if(st.sel.has(docId))st.sel.delete(docId);else st.sel.add(docId);
  renderDocPanel(bookingId);
}
function toggleAllDocs(bookingId){
  const st=_docPanelState[bookingId];if(!st)return;
  const selectable=st.docs.filter(d=>d.status!=='gegevens_bevestigd');
  if(st.sel.size>=selectable.length)st.sel.clear();
  else selectable.forEach(d=>st.sel.add(d.id));
  renderDocPanel(bookingId);
}

async function openDocImage(bookingId,docId){
  const st=_docPanelState[bookingId];const d=st?.docs.find(x=>x.id===docId);if(!d)return;
  const url=await _signedUrl(d.storage_path,120);
  if(!url){toast('⚠️ Kon document niet openen');return;}
  auditLog('document_geopend','document',docId,bookingId);
  window.open(url,'_blank');
}

// Stuurt één document naar de AI en bewaart het resultaat als concept op het document.
async function _scanOneDoc(d,session){
  const url=await _signedUrl(d.storage_path,180);
  if(!url)throw new Error('signed url');
  const blob=await fetch(url).then(r=>r.blob());
  const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});
  const res=await fetch(`${SUPABASE_URL}/functions/v1/scan-id`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify({image_base64:b64,media_type:d.media_type||'image/jpeg'}),
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error);
  const ai={voornaam:data.voornaam,achternaam:data.achternaam,naam:data.naam,geboortedatum:data.geboortedatum,
    geboorteplaats:data.geboorteplaats,nationaliteit:data.nationaliteit,documenttype:data.documenttype,
    documentnummer:data.documentnummer,vervaldatum:data.vervaldatum,confidence:data.confidence};
  const leesbaar=!!(data.naam||data.geboortedatum);
  await sb.from('booking_documents').update({
    ai_result:ai, ai_verwerkt_at:new Date().toISOString(),
    status:leesbaar?'ai_uitgelezen_controle_nodig':'document_onleesbaar',
    fout_melding:leesbaar?null:'AI kon geen leesbare gegevens vinden',
  }).eq('id',d.id);
}

// Bewuste AI-start. Slaat reeds verwerkte documenten over (dedup → geen dubbele kost).
// Concurrency 2; één fout blokkeert de rest niet.
async function aiScanSelected(bookingId){
  const st=_docPanelState[bookingId];if(!st)return;
  const selected=st.docs.filter(d=>st.sel.has(d.id));
  const nieuw=selected.filter(d=>!d.ai_result);
  const reeds=selected.filter(d=>d.ai_result);
  if(!nieuw.length){toast('ℹ️ Alle geselecteerde documenten zijn al verwerkt. Gebruik "Opnieuw" om te herverwerken.');return;}
  if(!confirm(`Je gaat ${nieuw.length} nieuw(e) document(en) laten uitlezen met AI.${reeds.length?`\n${reeds.length} document(en) werd al verwerkt en wordt overgeslagen (geen extra kost).`:''}\n\nDit veroorzaakt AI-verbruik. Doorgaan?`))return;

  await auditLog('ai_verwerking_gestart','booking',bookingId,bookingId,{nieuwe_waarde:{aantal:nieuw.length}});
  const btn=document.getElementById('docAiBtn-'+bookingId);if(btn){btn.disabled=true;}
  const prog=document.getElementById('docAiProgress-'+bookingId);if(prog)prog.style.display='block';
  const fill=document.getElementById('docAiFill-'+bookingId);
  const status=document.getElementById('docAiStatus-'+bookingId);
  const {data:{session}}=await sb.auth.getSession();

  let done=0,fail=0;const total=nieuw.length;
  // Concurrency-pool van 2.
  const queue=[...nieuw];
  async function worker(){
    while(queue.length){
      const d=queue.shift();
      if(status)status.textContent=`🔎 ${done+1} van ${total} verwerkt…`;
      try{ await _scanOneDoc(d,session); }
      catch(e){
        fail++;
        await sb.from('booking_documents').update({status:'fout_bij_verwerking',fout_melding:String(e.message||e).slice(0,200)}).eq('id',d.id);
      }
      done++;
      if(fill)fill.style.width=Math.round(done/total*100)+'%';
    }
  }
  await Promise.all([worker(),worker()]);
  if(status)status.textContent=`✅ ${total-fail} verwerkt${fail?` · ${fail} fout`:''}. Controleer de gegevens hieronder.`;
  await loadBookingDocuments(bookingId);
}

async function rescanDoc(bookingId,docId){
  const st=_docPanelState[bookingId];const d=st?.docs.find(x=>x.id===docId);if(!d)return;
  if(!confirm('Dit document werd al verwerkt. Opnieuw uitlezen kan extra AI-kosten veroorzaken. Doorgaan?'))return;
  await auditLog('ai_verwerking_opnieuw','document',docId,bookingId);
  const {data:{session}}=await sb.auth.getSession();
  toast('🔎 AI leest opnieuw…');
  try{ await _scanOneDoc(d,session); toast('✅ Opnieuw uitgelezen'); }
  catch(e){ toast('⚠️ Mislukt: '+(e.message||e)); }
  await loadBookingDocuments(bookingId);
}

// Bevestigt de gecontroleerde gegevens → maakt/updatet de echte gast en koppelt het document.
async function confirmDocGuest(bookingId,docId){
  const g=id=>document.getElementById(`dr-${id}-${docId}`)?.value?.trim()||'';
  const voornaam=g('voornaam'),achternaam=g('achternaam');
  const naam=`${voornaam} ${achternaam}`.trim();
  if(!naam){toast('⚠️ Vul minstens een naam in');return;}
  const isHoofd=document.getElementById('dr-hoofd-'+docId)?.checked;
  const st=_docPanelState[bookingId];const d=st?.docs.find(x=>x.id===docId);

  // Max één hoofdgast: bestaande hoofdgast degraderen indien deze hoofdgast wordt.
  if(isHoofd){
    await sb.from('gasten').update({is_hoofdgast:false}).eq('booking_id',bookingId).eq('is_hoofdgast',true);
    await auditLog('hoofdgast_gewijzigd','booking',bookingId,bookingId,{nieuwe_waarde:{naam}});
  }
  const row={
    booking_id:bookingId, naam,
    geboortedatum:g('geboortedatum')||null, geboorteplaats:g('geboorteplaats')||null,
    nationaliteit:g('nationaliteit')||null, documenttype:g('documenttype')||null,
    id_nummer:g('documentnummer')||null, is_hoofdgast:!!isHoofd, id_consent:true,
    foto_url:d?.storage_path||null,
  };
  let gastId=d?.gast_id;
  if(gastId){ await sb.from('gasten').update(row).eq('id',gastId); }
  else { const {data:ins}=await sb.from('gasten').insert(row).select('id').single(); gastId=ins?.id; }

  await sb.from('booking_documents').update({gast_id:gastId,status:'gegevens_bevestigd'}).eq('id',docId);
  await auditLog('gastgegevens_bevestigd','document',docId,bookingId,{nieuwe_waarde:{naam,is_hoofdgast:!!isHoofd}});
  toast('✅ Persoon bevestigd: '+naam);
  await loadBookingDocuments(bookingId);
  loadGasten(bookingId);
}

async function confirmAllDocs(bookingId){
  const st=_docPanelState[bookingId];if(!st)return;
  const todo=st.docs.filter(d=>d.ai_result&&d.status!=='gegevens_bevestigd'&&d.status!=='document_afgekeurd');
  if(!todo.length){toast('Niets te bevestigen');return;}
  if(!confirm(`${todo.length} gecontroleerde perso(o)n(en) bevestigen en aan de boeking koppelen?`))return;
  for(const d of todo){ await confirmDocGuest(bookingId,d.id); }
}

async function rejectDoc(bookingId,docId){
  if(!confirm('Document afkeuren? Je kan de gast daarna een nieuwe uploadlink sturen.'))return;
  await sb.from('booking_documents').update({status:'document_afgekeurd'}).eq('id',docId);
  await auditLog('document_afgekeurd','document',docId,bookingId);
  toast('🚫 Document afgekeurd');
  await loadBookingDocuments(bookingId);
}

function openAddGuestSheet(bookingId){
  document.getElementById('addGuestForm').reset();
  document.getElementById('addGuestBookingId').value=bookingId;
  document.getElementById('editGastId').value='';
  const title=document.getElementById('addGuestSheetTitle');
  if(title)title.textContent='👤 Gast toevoegen';
  resetGuestFotoUI();
  document.getElementById('addGuestMsg').textContent='';
  openSheet('shAddGuest');
}

function resetGuestFotoUI(){
  const c=document.getElementById('gIdConsent');if(c)c.checked=false;
  const w=document.getElementById('gIdFotoWrap');if(w)w.style.display='none';
  const f=document.getElementById('gIdFoto');if(f)f.value='';
  const p=document.getElementById('guestFotoPreview');if(p){p.style.display='none';p.src='';}
  const h=document.getElementById('gIdAiHint');if(h)h.textContent='';
}
function previewGuestFoto(input){
  const f=input.files?.[0];const img=document.getElementById('guestFotoPreview');
  if(f&&img){img.src=URL.createObjectURL(f);img.style.display='block';}
  const sb2=document.getElementById('gScanBtn');if(sb2)sb2.style.display=f?'block':'none';
}
function scanSelectedGuestFoto(){
  const f=document.getElementById('gIdFoto')?.files?.[0];
  if(!f){toast('⚠️ Kies eerst een foto');return;}
  scanGuestId(f);
}
function _fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});}
async function scanGuestId(file){
  const hint=document.getElementById('gIdAiHint');
  if(hint)hint.textContent='🔎 AI leest de kaart…';
  try{
    const b64=await _fileToBase64(file);
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(`${SUPABASE_URL}/functions/v1/scan-id`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({image_base64:b64,media_type:file.type||'image/jpeg'}),
    });
    const d=await res.json();
    if(d.error){if(hint)hint.textContent='⚠️ '+d.error;return;}
    const nEl=document.getElementById('gNaam'),gEl=document.getElementById('gGeboortedatum'),natEl=document.getElementById('gNationaliteit');
    if(d.naam&&nEl&&!nEl.value)nEl.value=d.naam;
    if(d.geboortedatum&&gEl)gEl.value=d.geboortedatum;
    if(d.nationaliteit&&natEl&&!natEl.value)natEl.value=d.nationaliteit;
    if(hint)hint.textContent='✅ Automatisch ingevuld — controleer de gegevens.';
  }catch(e){if(hint)hint.textContent='⚠️ AI-herkenning mislukt — vul handmatig in.';}
}

// Scant een foto die de gast zelf heeft geüpload via de publieke upload-pagina.
// Leest de foto uit storage, stuurt naar AI, vult het gasten-record in.
async function scanPendingGuestUpload(gastId, bookingId){
  toast('🔎 AI scant de gast-foto…');
  try{
    const {data:g}=await sb.from('gasten').select('foto_url').eq('id',gastId).single();
    if(!g?.foto_url){toast('⚠️ Geen foto gevonden');return;}
    const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(g.foto_url,120);
    if(!s?.signedUrl){toast('⚠️ Foto ophalen mislukt');return;}
    // Foto downloaden als blob
    const blob=await fetch(s.signedUrl).then(r=>r.blob());
    const file=new File([blob],'id.jpg',{type:blob.type||'image/jpeg'});
    const b64=await _fileToBase64(file);
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(`${SUPABASE_URL}/functions/v1/scan-id`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({image_base64:b64,media_type:file.type}),
    });
    const d=await res.json();
    if(d.error){toast('⚠️ AI-fout: '+d.error);return;}
    if(!d.naam){toast('⚠️ AI kon geen naam lezen — open gast handmatig om in te vullen');return;}
    // Pending record omzetten naar echte gast
    await sb.from('gasten').update({
      naam:d.naam||'',
      geboortedatum:d.geboortedatum||null,
      nationaliteit:d.nationaliteit||null,
      id_consent:true,
    }).eq('id',gastId);
    toast(`✅ Gast ingelezen: ${d.naam}`);
    // Wie is er sectie vernieuwen
    const el=document.getElementById('wie-gasten-'+bookingId);
    if(el&&el.style.display==='block'){el.style.display='none';openWieIsErDetail(bookingId);}
  }catch(e){toast('⚠️ Scannen mislukt: '+e.message);}
}

// Scant alle pending gast-uploads in één keer.
// Toont voortgangsbalk en status per foto, slaat alles op.
async function scanAllPendingUploads(gastIds, bookingId){
  const btn=document.getElementById('scanAllBtn-'+bookingId);
  const progWrap=document.getElementById('scanAllProgress-'+bookingId);
  const fill=document.getElementById('scanAllFill-'+bookingId);
  const status=document.getElementById('scanAllStatus-'+bookingId);
  if(btn)btn.disabled=true;
  if(progWrap)progWrap.style.display='block';
  const {data:{session}}=await sb.auth.getSession();
  let ok=0,fail=0;
  for(let i=0;i<gastIds.length;i++){
    const gastId=gastIds[i];
    if(status)status.textContent=`🔎 Scanning foto ${i+1} van ${gastIds.length}…`;
    if(fill)fill.style.width=`${Math.round(i/gastIds.length*100)}%`;
    try{
      const {data:g}=await sb.from('gasten').select('foto_url').eq('id',gastId).single();
      if(!g?.foto_url){fail++;continue;}
      const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(g.foto_url,120);
      if(!s?.signedUrl){fail++;continue;}
      const blob=await fetch(s.signedUrl).then(r=>r.blob());
      const file=new File([blob],'id.jpg',{type:blob.type||'image/jpeg'});
      const b64=await _fileToBase64(file);
      const res=await fetch(`${SUPABASE_URL}/functions/v1/scan-id`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({image_base64:b64,media_type:file.type}),
      });
      const d=await res.json();
      if(d.error||!d.naam){fail++;continue;}
      await sb.from('gasten').update({
        naam:d.naam,
        geboortedatum:d.geboortedatum||null,
        nationaliteit:d.nationaliteit||null,
        id_consent:true,
      }).eq('id',gastId);
      ok++;
    }catch(e){fail++;}
  }
  if(fill)fill.style.width='100%';
  if(status){
    status.textContent=`✅ ${ok} gescand${fail>0?` · ⚠️ ${fail} mislukt — open handmatig`:''}`;
    status.style.color=fail>0?'#CC7700':'#1B8A5B';
  }
  if(ok>0) toast(`✅ ${ok} gast${ok>1?'en':''} automatisch ingelezen!`);
  if(fail>0) toast(`⚠️ ${fail} foto${fail>1?'\'s':''} konden niet worden gelezen — vul handmatig in`);
  // Sectie vernieuwen
  const el=document.getElementById('wie-gasten-'+bookingId);
  if(el&&el.style.display==='block'){el.style.display='none';openWieIsErDetail(bookingId);}
}

async function openEditGuestSheet(gastId){
  const g=_gastenCache[gastId];if(!g){toast('⚠️ Gast niet gevonden');return;}
  // Reset eerst, dan waarden invullen (anders wist reset() de hidden velden)
  document.getElementById('addGuestForm').reset();
  resetGuestFotoUI();
  document.getElementById('addGuestBookingId').value=g.booking_id;
  document.getElementById('editGastId').value=g.id;
  const title=document.getElementById('addGuestSheetTitle');
  if(title)title.textContent='✏️ Gast bewerken';
  document.getElementById('gNaam').value=g.naam||'';
  document.getElementById('gGeboortedatum').value=g.geboortedatum||'';
  document.getElementById('gNationaliteit').value=g.nationaliteit||'';
  document.getElementById('gIdNummer').value=g.id_nummer||'';
  document.getElementById('gNummerplaat').value=g.nummerplaat||'';
  document.getElementById('gHoofdgast').checked=!!g.is_hoofdgast;
  // Bestaande toestemming + foto tonen
  if(g.id_consent){
    const c=document.getElementById('gIdConsent');if(c)c.checked=true;
    const w=document.getElementById('gIdFotoWrap');if(w)w.style.display='block';
  }
  if(g.foto_url){
    const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(g.foto_url,3600);
    const p=document.getElementById('guestFotoPreview');
    if(s?.signedUrl&&p){p.src=s.signedUrl;p.style.display='block';}
  }
  document.getElementById('addGuestMsg').textContent='';
  openSheet('shAddGuest');
}

async function saveGuest(){
  const bookingId=document.getElementById('addGuestBookingId').value;
  const gastId=document.getElementById('editGastId').value;
  const naam=document.getElementById('gNaam').value.trim();
  if(!naam){document.getElementById('addGuestMsg').textContent='⚠️ Naam verplicht';return}
  const btn=document.getElementById('saveGuestBtn');
  btn.textContent='Opslaan…';btn.disabled=true;
  try{
    const geboortedatum=document.getElementById('gGeboortedatum').value||null;
    const nationaliteit=document.getElementById('gNationaliteit').value.trim()||null;
    const id_nummer=document.getElementById('gIdNummer').value.trim()||null;
    const nummerplaat=document.getElementById('gNummerplaat').value.trim()||null;
    const is_hoofdgast=document.getElementById('gHoofdgast').checked;
    const consent=document.getElementById('gIdConsent')?.checked||false;
    const file=document.getElementById('gIdFoto')?.files?.[0];
    let savedId=gastId;
    if(gastId){
      await sb.from('gasten').update({naam,geboortedatum,nationaliteit,id_nummer,nummerplaat,is_hoofdgast,id_consent:consent}).eq('id',gastId);
      toast('✅ Gast bijgewerkt');
    }else{
      const {data:ins}=await sb.from('gasten').insert({booking_id:bookingId,naam,geboortedatum,nationaliteit,id_nummer,nummerplaat,is_hoofdgast,id_consent:consent}).select('id').single();
      savedId=ins?.id;
      toast('✅ Gast toegevoegd');
    }
    // ID-foto uploaden — enkel met expliciete toestemming
    if(consent&&file&&savedId){
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${bookingId}/${savedId}.${ext}`;
      const {error:upErr}=await sb.storage.from('id-fotos').upload(path,file,{upsert:true,contentType:file.type});
      if(upErr)toast('⚠️ Foto upload mislukt: '+upErr.message);
      else await sb.from('gasten').update({foto_url:path}).eq('id',savedId);
    }
    closeSheet('shAddGuest');
    loadGasten(bookingId);
  }catch(err){
    document.getElementById('addGuestMsg').textContent='⚠️ '+err.message;
  }finally{btn.textContent='Opslaan';btn.disabled=false;}
}

/* ═══════════ BULK ID-FOTO'S INLEZEN (AI) ═══════════ */
let _bulkIdRows=[];  // {file, naam, geboortedatum, nationaliteit}
function openBulkIdSheet(bookingId){
  document.getElementById('bulkIdBookingId').value=bookingId;
  document.getElementById('bulkIdConsent').checked=false;
  document.getElementById('bulkIdPickWrap').style.display='none';
  document.getElementById('bulkIdFiles').value='';
  document.getElementById('bulkIdScanBtn').style.display='none';
  document.getElementById('bulkIdSaveBtn').style.display='none';
  document.getElementById('bulkIdRows').innerHTML='';
  document.getElementById('bulkIdMsg').textContent='';
  _bulkIdRows=[];
  openSheet('shBulkId');
}
function bulkIdFilesSelected(){
  const files=[...(document.getElementById('bulkIdFiles').files||[])];
  const btn=document.getElementById('bulkIdScanBtn');
  const msg=document.getElementById('bulkIdMsg');
  if(!files.length){btn.style.display='none';msg.textContent='';return;}
  const kost=(files.length*0.4).toFixed(1);
  btn.textContent=`🔎 Lees ${files.length} foto${files.length>1?'\'s':''} met AI (± ${kost} cent)`;
  btn.style.display='block';
  msg.textContent='';
}
async function leesBulkIdMetAI(){
  const files=[...(document.getElementById('bulkIdFiles').files||[])];
  if(!files.length)return;
  const btn=document.getElementById('bulkIdScanBtn');
  const msg=document.getElementById('bulkIdMsg');
  btn.disabled=true;
  const {data:{session}}=await sb.auth.getSession();
  _bulkIdRows=[];
  for(let i=0;i<files.length;i++){
    msg.textContent=`🔎 AI leest foto ${i+1} van ${files.length}…`;
    const f=files[i];
    let parsed={naam:'',geboortedatum:'',nationaliteit:''};
    try{
      const b64=await _fileToBase64(f);
      const res=await fetch(`${SUPABASE_URL}/functions/v1/scan-id`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({image_base64:b64,media_type:f.type||'image/jpeg'}),
      });
      const d=await res.json();
      if(!d.error)parsed={naam:d.naam||'',geboortedatum:d.geboortedatum||'',nationaliteit:d.nationaliteit||''};
    }catch(e){}
    _bulkIdRows.push({file:f,...parsed});
  }
  msg.textContent=`✅ ${files.length} kaart(en) gelezen — controleer en corrigeer hieronder.`;
  btn.disabled=false;btn.style.display='none';
  renderBulkIdRows();
  document.getElementById('bulkIdSaveBtn').style.display='block';
}
function renderBulkIdRows(){
  const el=document.getElementById('bulkIdRows');if(!el)return;
  el.innerHTML=_bulkIdRows.map((r,i)=>`
    <div style="display:flex;gap:10px;background:var(--bg2);border:1.5px solid var(--sep);border-radius:12px;padding:10px;margin-bottom:8px;">
      <img src="${URL.createObjectURL(r.file)}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <input value="${escHtml(r.naam)}" placeholder="Naam *" oninput="_bulkIdRows[${i}].naam=this.value" style="width:100%;padding:7px 9px;border-radius:7px;border:1.5px solid var(--sep);background:var(--bg);font-size:13px;color:var(--lbl1);margin-bottom:5px;box-sizing:border-box;">
        <div style="display:flex;gap:5px;">
          <input type="date" value="${escHtml(r.geboortedatum)}" oninput="_bulkIdRows[${i}].geboortedatum=this.value" style="flex:1;padding:7px 9px;border-radius:7px;border:1.5px solid var(--sep);background:var(--bg);font-size:12px;color:var(--lbl1);min-width:0;">
          <input value="${escHtml(r.nationaliteit)}" placeholder="Nat." oninput="_bulkIdRows[${i}].nationaliteit=this.value" style="width:70px;padding:7px 9px;border-radius:7px;border:1.5px solid var(--sep);background:var(--bg);font-size:12px;color:var(--lbl1);">
        </div>
      </div>
      <button onclick="_bulkIdRows.splice(${i},1);renderBulkIdRows()" style="color:var(--red);background:rgba(255,59,48,.08);border:none;border-radius:8px;width:30px;flex-shrink:0;cursor:pointer;">🗑</button>
    </div>`).join('');
}
async function saveBulkId(){
  const bookingId=document.getElementById('bulkIdBookingId').value;
  const msg=document.getElementById('bulkIdMsg');
  const rows=_bulkIdRows.filter(r=>r.naam.trim());
  if(!rows.length){msg.textContent='⚠️ Geen geldige rijen (naam verplicht).';return;}
  const btn=document.getElementById('bulkIdSaveBtn');btn.textContent='Opslaan…';btn.disabled=true;
  try{
    for(const r of rows){
      const {data:ins}=await sb.from('gasten').insert({booking_id:bookingId,naam:r.naam.trim(),geboortedatum:r.geboortedatum||null,nationaliteit:r.nationaliteit||null,id_consent:true,is_hoofdgast:false}).select('id').single();
      if(ins?.id){
        const ext=(r.file.name.split('.').pop()||'jpg').toLowerCase();
        const path=`${bookingId}/${ins.id}.${ext}`;
        const {error:upErr}=await sb.storage.from('id-fotos').upload(path,r.file,{upsert:true,contentType:r.file.type});
        if(!upErr)await sb.from('gasten').update({foto_url:path}).eq('id',ins.id);
      }
    }
    toast(`✅ ${rows.length} gast(en) toegevoegd`);
    closeSheet('shBulkId');
    loadGasten(bookingId);
  }catch(err){msg.textContent='⚠️ '+err.message;}
  finally{btn.textContent='✓ Alle gasten opslaan';btn.disabled=false;}
}

/* ═══════════ BULK GASTEN ═══════════ */
let _bulkBookingId=null,_bulkGastenRows=[];

async function openBulkGastenSheet(bookingId,volw,kind,baby){
  _bulkBookingId=bookingId;
  // Laad bestaande gasten als basis
  const {data:existing}=await sb.from('gasten').select('*').eq('booking_id',bookingId).order('is_hoofdgast',{ascending:false}).order('created_at');
  const cats=[...Array(volw).fill({cat:'volwassene',emoji:'🧑',lbl:'Volwassene'}),...Array(kind).fill({cat:'kind',emoji:'🧒',lbl:'Kind 3–11'}),...Array(baby).fill({cat:'baby',emoji:'👶',lbl:'Baby <3j'})];
  // Map bestaande gasten op positie, rest leeg
  _bulkGastenRows=cats.map((c,i)=>{
    const ex=existing?.[i];
    return{id:ex?.id||null,naam:ex?.naam||'',geboortedatum:ex?.geboortedatum||'',categorie:c.cat,emoji:c.emoji,lbl:c.lbl,is_hoofdgast:i===0};
  });
  renderBulkGastenFields();
  document.getElementById('bulkGastenMsg').textContent='';
  openSheet('shBulkGasten');
}

function renderBulkGastenFields(){
  const el=document.getElementById('bulkGastenFields');if(!el)return;
  const cnt={volwassene:0,kind:0,baby:0};
  el.innerHTML=_bulkGastenRows.map((g,i)=>{
    cnt[g.categorie]=(cnt[g.categorie]||0)+1;
    const isBaby=g.categorie==='baby';
    return`<div style="background:var(--bg2);border:1.5px solid var(--sep);border-radius:12px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:16px;">${g.emoji}</span>
        <div style="font-size:12px;font-weight:700;color:var(--lbl2);">${g.lbl} ${cnt[g.categorie]}${g.is_hoofdgast?' <span style="font-size:10px;background:var(--green);color:#fff;padding:1px 6px;border-radius:6px;margin-left:4px;">Hoofdgast</span>':''}</div>
      </div>
      <input type="text" placeholder="Volledige naam *" value="${escHtml(g.naam)}"
        oninput="_bulkGastenRows[${i}].naam=this.value"
        style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid var(--sep);background:var(--bg);font-size:13px;color:var(--lbl1);box-sizing:border-box;margin-bottom:6px;">
      ${isBaby?'':`<input type="date" placeholder="Geboortedatum *" value="${escHtml(g.geboortedatum)}"
        oninput="_bulkGastenRows[${i}].geboortedatum=this.value"
        style="width:100%;padding:9px 11px;border-radius:8px;border:1.5px solid var(--sep);background:var(--bg);font-size:13px;color:var(--lbl1);box-sizing:border-box;">`}
    </div>`;
  }).join('');
}

async function saveBulkGasten(){
  const msg=document.getElementById('bulkGastenMsg');
  // Validatie: naam + geboortedatum verplicht (behalve baby)
  const ongeldig=_bulkGastenRows.find(g=>!g.naam.trim()||(g.categorie!=='baby'&&!g.geboortedatum));
  if(ongeldig){msg.textContent='⚠️ Vul naam en geboortedatum in voor alle gasten (behalve baby\'s).';return;}
  msg.textContent='';
  const btn=document.getElementById('saveBulkBtn');btn.textContent='Opslaan…';btn.disabled=true;
  try{
    for(const g of _bulkGastenRows){
      const row={booking_id:_bulkBookingId,naam:g.naam.trim(),geboortedatum:g.geboortedatum||null,is_hoofdgast:g.is_hoofdgast,nationaliteit:null,id_nummer:null};
      if(g.id){
        await sb.from('gasten').update(row).eq('id',g.id);
      }else{
        const {data:ins}=await sb.from('gasten').insert(row).select('id').single();
        if(ins)_gastenCache[ins.id]={...row,id:ins.id};
      }
    }
    toast('✅ Alle gasten opgeslagen!');
    closeSheet('shBulkGasten');
    loadGasten(_bulkBookingId);
  }catch(err){msg.textContent='⚠️ '+err.message;}
  finally{btn.textContent='✓ Alle gasten opslaan';btn.disabled=false;}
}

/* ═══════════ NIEUWE BOEKING — GASTEN ═══════════ */
let nbGastenData=[];
function renderNBGasten(){
  const el=document.getElementById('nbGastenFields');if(!el)return;
  const wrap=document.getElementById('nbGastenWrap');
  const volw=parseInt(document.getElementById('fVolwassenen')?.value)||0;
  const kind=parseInt(document.getElementById('fKinderen')?.value)||0;
  const baby=parseInt(document.getElementById('fBaby')?.value)||0;
  const cats=[...Array(volw).fill('volwassene'),...Array(kind).fill('kind'),...Array(baby).fill('baby')];
  if(!cats.length){if(wrap)wrap.style.display='none';return;}
  if(wrap)wrap.style.display='block';
  // Bewaar bestaande waarden
  nbGastenData=cats.map((cat,i)=>({
    naam:nbGastenData[i]?.naam||'',
    geboortedatum:nbGastenData[i]?.geboortedatum||'',
    categorie:cat
  }));
  const emoji={volwassene:'🧑',kind:'🧒',baby:'👶'};
  const lbl={volwassene:'Volwassene',kind:'Kind',baby:'Baby'};
  const cnt={volwassene:0,kind:0,baby:0};
  el.innerHTML=nbGastenData.map((g,i)=>{
    cnt[g.categorie]++;
    const isBaby=g.categorie==='baby';
    return`<div style="margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;color:var(--lbl3);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px;">${emoji[g.categorie]} ${lbl[g.categorie]} ${cnt[g.categorie]}</div>
      <div style="display:grid;grid-template-columns:${isBaby?'1fr':'1fr 1fr'};gap:8px;">
        <input type="text" placeholder="Volledige naam" value="${g.naam}"
          oninput="nbGastenData[${i}].naam=this.value"
          style="padding:9px 11px;border-radius:9px;border:1.5px solid var(--sep);background:var(--bg2);font-size:13px;color:var(--lbl1);">
        ${isBaby?'':`<input type="date" value="${g.geboortedatum}" oninput="nbGastenData[${i}].geboortedatum=this.value"
          style="padding:9px 11px;border-radius:9px;border:1.5px solid var(--sep);background:var(--bg2);font-size:13px;color:var(--lbl1);">`}
      </div>
    </div>`;
  }).join('');
}

/* ═══════════ BOOKING FOTO'S ═══════════ */
async function loadFotos(bookingId){
  const el=document.getElementById('fotoGrid');if(!el)return;
  const {data}=await sb.from('booking_fotos').select('*').eq('booking_id',bookingId).order('created_at');
  if(!data||!data.length){el.innerHTML='<div style="grid-column:1/-1;font-size:13px;color:var(--lbl4);padding:4px 0 12px;">Nog geen foto\'s</div>';return}
  const urls=await Promise.all(data.map(async f=>{
    const {data:sd}=await sb.storage.from('booking-fotos').createSignedUrl(f.url,3600);
    return {id:f.id,url:sd?.signedUrl||'',label:f.label,bookingId};
  }));
  el.innerHTML=urls.map(f=>`
    <div style="position:relative;">
      <img src="${f.url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r-sm);cursor:pointer;" onclick="window.open('${f.url}','_blank')" loading="lazy">
      <button onclick="deleteFoto('${f.id}','${f.bookingId}')" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>`).join('')
}

async function uploadBookingFotos(bookingId,input){
  const files=[...input.files];if(!files.length)return;
  toast(`⏳ ${files.length} foto${files.length>1?'\'s':''} uploaden…`);
  for(const file of files){
    const ext=file.name.split('.').pop();
    const path=`${bookingId}/${Date.now()}.${ext}`;
    const {error:upErr}=await sb.storage.from('booking-fotos').upload(path,file);
    if(!upErr) await sb.from('booking_fotos').insert({booking_id:bookingId,url:path});
  }
  loadFotos(bookingId);
  toast(`✅ ${files.length} foto${files.length>1?'\'s':''} opgeslagen`);
}

async function deleteFoto(fotoId,bookingId){
  const {data}=await sb.from('booking_fotos').select('url').eq('id',fotoId).single();
  if(data) await sb.storage.from('booking-fotos').remove([data.url]);
  await sb.from('booking_fotos').delete().eq('id',fotoId);
  loadFotos(bookingId);
}

/* ═══════════ GMAIL OAUTH ═══════════ */
const GOOGLE_CLIENT_ID='54730723430-j707rj00757gkh5f0hsfu9peh645tp32.apps.googleusercontent.com';
const GMAIL_SCOPES='https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email';
const REDIRECT_URI=window.location.origin+window.location.pathname;

function connectGmail(){
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri',REDIRECT_URI);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',GMAIL_SCOPES);
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('state','gmail_connect');
  window.location.href=url.toString();
}

async function handleOAuthCallback(){
  // Wachtwoord-reset via e-mail link (#access_token + type=recovery in hash)
  const hash=new URLSearchParams(window.location.hash.replace('#',''));
  if(hash.get('type')==='recovery'){
    const accessToken=hash.get('access_token');
    if(accessToken){
      await sb.auth.setSession({access_token:accessToken,refresh_token:hash.get('refresh_token')||''});
      window.history.replaceState({},'',window.location.pathname);
      toast('🔑 Stel hieronder je nieuw wachtwoord in');
      setTimeout(()=>openSettingsOverlay('account'),600);
      return;
    }
  }
  const params=new URLSearchParams(window.location.search);
  const code=params.get('code');
  const state=params.get('state');
  if(!code||state!=='gmail_connect') return;
  window.history.replaceState({},'',window.location.pathname);
  const {data:{session}}=await sb.auth.getSession();
  if(!session){toast('⚠️ Log eerst in voor je Gmail koppelt');return}
  setGmailMsg('Gmail koppelen…');
  try{
    const res=await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({code,redirect_uri:REDIRECT_URI}),
    });
    const data=await res.json();
    if(data.error) throw new Error(data.error);
    toast('✅ Gmail gekoppeld: '+data.email);
    openSettingsOverlay('mail');
    loadGmailStatus();
    syncGmail();
  }catch(err){
    setGmailMsg('⚠️ '+err.message);
  }
}

async function loadGmailStatus(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  const {data}=await sb.from('integrations').select('email,updated_at').eq('provider','gmail').maybeSingle();
  if(data){
    document.getElementById('gmailDisconnected').style.display='none';
    document.getElementById('gmailConnected').style.display='block';
    document.getElementById('gmailConnectedEmail').textContent=data.email||'';
    const dt=new Date(data.updated_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    document.getElementById('gmailSyncStatus').textContent='Laatste sync: '+dt;
    document.getElementById('settingsUserEmail').textContent=session.user.email||'';
  }else{
    document.getElementById('gmailDisconnected').style.display='block';
    document.getElementById('gmailConnected').style.display='none';
    document.getElementById('settingsUserEmail').textContent=session.user?.email||'';
  }
}

async function syncGmail(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  const btn=document.getElementById('syncBtn');
  if(btn){btn.textContent='⏳ Bezig…';btn.disabled=true;}
  setGmailMsg('Mails ophalen…');
  try{
    const res=await fetch(`${SUPABASE_URL}/functions/v1/gmail-sync`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    });
    const data=await res.json();
    if(data.error) throw new Error(data.error);
    const msg=data.synced>0?`✅ ${data.synced} nieuwe mail${data.synced===1?'':'s'} gesynchroniseerd`:'✅ Alles up-to-date';
    setGmailMsg(msg);
    toast(msg);
    loadGmailStatus();
    if(document.getElementById('view-mail').classList.contains('on')) loadMailView();
  }catch(err){
    setGmailMsg('⚠️ '+err.message);
  }finally{
    if(btn){btn.textContent='🔄 Nu synchroniseren';btn.disabled=false;}
  }
}

async function disconnectGmail(){
  if(!confirm('Gmail ontkoppelen?')) return;
  await sb.from('integrations').delete().eq('provider','gmail');
  document.getElementById('gmailDisconnected').style.display='block';
  document.getElementById('gmailConnected').style.display='none';
  setGmailMsg('Gmail ontkoppeld.');
}

function setGmailMsg(msg){
  const el=document.getElementById('gmailMsg');
  if(el) el.textContent=msg;
}

document.getElementById('registerDate').value=TODAY;
setHeroDate();
setInterval(checkEveningAlert,60000);
checkSession();
handleOAuthCallback();
loadGmailStatus();
loadSettings();

/* ═══════════ MAIL VIEW ═══════════ */
let mailFilter='all';
let allComms=[];

function setMailFilter(f,el){
  mailFilter=f;
  document.querySelectorAll('.mf-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  renderMailView();
}

async function loadMailView(){
  document.getElementById('mailViewContent').innerHTML='<div class="mail-empty">Laden…</div>';
  const {data,error}=await sb.from('communicatie')
    .select('*,bookings(id,volgnummer,aankomst,vertrek,client_id,clients(naam,email))')
    .order('created_at',{ascending:false});
  if(error){document.getElementById('mailViewContent').innerHTML='<div class="mail-empty">⚠️ Kon mails niet laden</div>';return}
  allComms=data||[];
  renderMailView();
}

function renderMailView(){
  const filtered=mailFilter==='all'?allComms:allComms.filter(c=>c.status===mailFilter);
  const wrap=document.getElementById('mailViewContent');
  if(!filtered.length){wrap.innerHTML='<div class="mail-empty">Geen e-mails gevonden</div>';return}

  // Groepeer per klant (client_id of naam)
  const groups={};
  filtered.forEach(c=>{
    const naam=c.bookings?.clients?.naam||'Onbekende klant';
    const clientKey=c.bookings?.client_id||naam;
    if(!groups[clientKey])groups[clientKey]={naam,email:c.bookings?.clients?.email||'',items:[],volgnummers:new Set()};
    groups[clientKey].items.push(c);
    if(c.bookings?.volgnummer)groups[clientKey].volgnummers.add(c.bookings.volgnummer);
  });

  const COLORS=['#1B8A5B','#007AFF','#AF52DE','#FF9500','#FF3B30','#2B5C8A'];
  let html='';
  Object.values(groups).forEach((g,gi)=>{
    const initials=g.naam.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const color=COLORS[gi%COLORS.length];
    const refs=[...g.volgnummers].map(n=>`#${n}`).join(', ')||'';
    html+=`<div class="mail-group">
      <div class="mail-group-hd">
        <div class="mail-group-av" style="background:${color}">${initials}</div>
        <div>
          <div class="mail-group-name">${g.naam}</div>
          <div class="mail-group-meta">${g.email}${refs?' · '+refs:''}</div>
        </div>
      </div>`;
    g.items.forEach(c=>{
      const badge=c.status==='verzonden'
        ?'<span class="mail-item-badge badge-verzonden">✅ Verzonden</span>'
        :'<span class="mail-item-badge badge-concept">📝 Concept</span>';
      const preview=(c.inhoud||'').replace(/\n/g,' ').slice(0,80)+'…';
      const dt=new Date(c.created_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      html+=`<div class="mail-item" onclick="openMailItem('${c.id}')">
        <div class="mail-item-top">
          <div class="mail-item-subj">${c.onderwerp||'(geen onderwerp)'}</div>
          ${badge}
        </div>
        <div class="mail-item-date">${dt}</div>
        <div class="mail-item-preview">${preview}</div>
      </div>`;
    });
    html+='</div>';
  });
  wrap.innerHTML=html;
}

function openMailItem(id){
  const c=allComms.find(x=>x.id===id);if(!c)return;
  const naam=c.bookings?.clients?.naam||'Onbekende klant';
  const isConcept=c.status==='concept';
  document.getElementById('shMailItemTitle').textContent=c.onderwerp||'(geen onderwerp)';
  document.getElementById('shMailItemMeta').textContent=naam+' · '+new Date(c.created_at).toLocaleString('nl-BE');
  document.getElementById('shMailItemBody').textContent=c.inhoud||'';
  document.getElementById('shMailItemMarkBtn').style.display=isConcept?'block':'none';
  document.getElementById('shMailItemMarkBtn').onclick=()=>markMailVerzonden(id);
  openSheet('shMailItem');
}

async function markMailVerzonden(id){
  const {error}=await sb.from('communicatie').update({status:'verzonden',verzonden_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('⚠️ Opslaan mislukt');return}
  toast('✅ Gemarkeerd als verzonden');
  closeSheet('shMailItem');
  loadMailView();
}
