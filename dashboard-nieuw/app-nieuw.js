/* ============================================================================
 * app-nieuw.js — echte data-koppeling voor het NIEUWE dashboard.
 * Draait op /dashboard-nieuw/ naast het huidige systeem en gebruikt DEZELFDE
 * Supabase-backend (zelfde login, zelfde reserveringen). Acties hier wijzigen
 * dus dezelfde data die Karen in het oude systeem ziet.
 *
 * Fase 1 (dit bestand): login, echte data, Dagbord, 4 mappen, fiche met echte
 * gegevens/betaling/gasten/communicatie, en de kern-acties bevestigen →
 * inchecken → uitchecken + cash/overschrijving registreren.
 * Nog niet gekoppeld (komt later): mail versturen, AI ID-scan, QR/Mollie,
 * velden bewerken, kalender, beheer.
 * ==========================================================================*/
const SUPABASE_URL = 'https://whubbowuqhjdkdequbmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodWJib3d1cWhqZGtkZXF1Ym1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjM3NTYsImV4cCI6MjA5Nzc5OTc1Nn0.1S-eme0sMmC_25H-XnZ9r3AMKFSSxnpRx3-GRefSyzs';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TODAY = new Date().toISOString().split('T')[0];
const AV = ['#3B7DD8', '#1B8A5B', '#5A57C4', '#C77A11', '#B23F2A', '#2C8F87', '#8A5CD8'];
const MO = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const FOLDER_LABEL = { postvak: '📥 Postvak', booking: '📂 Booking', aanwezig: '📂 Aanwezig', vertrokken: '📂 Vertrokken' };

let bookings = [], paidByBooking = {}, maxPlaatsen = 0, currentUser = null, selectedId = null, clubCfg = {};
const MAIL_SJABLONEN = {
  bevestiging: { onderwerp: 'Bevestiging reservatie — Camping Cosmopolite #{{volgnummer}}', inhoud: 'Beste {{voornaam}},\n\nJe reservatie is bevestigd.\nAankomst: {{aankomst}}\nVertrek: {{vertrek}}\nPersonen: {{personen}}\nTotaal: {{bedrag}}\n\nTot binnenkort!\n{{from_name}}' },
  herinnering: { onderwerp: 'Herinnering — Camping Cosmopolite #{{volgnummer}}', inhoud: 'Beste {{voornaam}},\n\nEen vriendelijke herinnering aan je verblijf van {{aankomst}} tot {{vertrek}}.\n\nTot binnenkort!\n{{from_name}}' },
  betaling: { onderwerp: 'Betaalverzoek — Camping Cosmopolite #{{volgnummer}}', inhoud: 'Beste {{voornaam}},\n\nVoor je reservatie (#{{volgnummer}}) staat nog een bedrag open. Je kan betalen via de QR-code die we je bezorgen of via overschrijving met mededeling {{ogm}}.\n\nDank je wel!\n{{from_name}}' },
  uitchecken: { onderwerp: 'Tot ziens! — Camping Cosmopolite', inhoud: 'Beste {{voornaam}},\n\nBedankt voor je verblijf bij Camping Cosmopolite. We hopen je snel weer te verwelkomen!\n\nVriendelijke groeten,\n{{from_name}}' },
  volzet: { onderwerp: 'Helaas volzet — Camping Cosmopolite', inhoud: 'Beste {{voornaam}},\n\nHartelijk dank voor je aanvraag voor {{aankomst}} tot {{vertrek}}. Helaas zitten we voor deze periode volzet en kunnen we je aanvraag niet inwilligen.\n\nWe hopen je een volgende keer te mogen verwelkomen!\n\nVriendelijke groeten,\n{{from_name}}' },
};

/* ---------- helpers ---------- */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function initials(n){return String(n||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?';}
function avColor(id){let h=0;const s=String(id);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return AV[Math.abs(h)%AV.length];}
function nights(a,v){return Math.max(0,Math.round((new Date(v)-new Date(a))/86400000));}
function fmt(d){if(!d)return'—';const p=d.split('-');return parseInt(p[2])+' '+MO[parseInt(p[1])-1];}
function money(n){return '€ '+Number(n||0).toFixed(2);}
function isMobile(){return window.matchMedia('(max-width:859px)').matches;}

/* ---------- auth ---------- */
async function checkSession(){
  const {data:{session}} = await sb.auth.getSession();
  if(session && session.user){ currentUser=session.user; showApp(); await loadData(); }
  else showLogin();
}
sb.auth.onAuthStateChange(function(){ checkSession(); });

async function doLogin(){
  const email=(document.getElementById('nlEmail').value||'').trim();
  const pw=document.getElementById('nlPassword').value||'';
  const msg=document.getElementById('nlMsg');
  if(!email||!pw){msg.style.color='var(--red)';msg.textContent='Vul e-mail en wachtwoord in';return;}
  msg.style.color='var(--ink-2)';msg.textContent='Bezig…';
  const {error}=await sb.auth.signInWithPassword({email,password:pw});
  if(error){msg.style.color='var(--red)';msg.textContent=(error.message==='Invalid login credentials')?'Ongeldig e-mailadres of wachtwoord':error.message;}
}
let currentRole='staff';
async function loadRole(){
  try{
    const {data}=await sb.from('user_roles').select('role').eq('user_id',currentUser.id).maybeSingle();
    currentRole=(data&&data.role)||'staff';
  }catch(e){currentRole='staff';}
  const isAdmin=currentRole==='admin';
  ['rail-beheer','tab-beheer'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isAdmin?'':'none';});
}
async function doLogout(){ if(confirm('Uitloggen?')){ await sb.auth.signOut(); location.reload(); } }
function showLogin(){document.getElementById('loginScreen').style.display='flex';document.getElementById('app').style.display='none';}
function showApp(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='flex';
  const who=document.getElementById('whoLbl');
  if(who && currentUser){const n=(currentUser.email||'').split('@')[0];who.textContent='👤 '+(n.charAt(0).toUpperCase()+n.slice(1));}
  updateNotifIcon();
  initRealtimeNotifications();
}

/* ---------- meldingen ----------
   Browser-meldingen (Notification API) i.p.v. iets ingewikkelders zoals
   push-meldingen: geen extra server-infrastructuur nodig, werkt vandaag al.
   Beperking om eerlijk te zijn: dit werkt zolang deze pagina/tab open staat
   (mag op de achtergrond) — niet wanneer de browser volledig gesloten is.
   Trigger: een live Supabase-verbinding die meteen een nieuwe reservering
   in Postvak detecteert (bv. via de AI-postvak-controle), ongeacht wie er
   op dat moment is ingelogd. */
let notifEnabled = localStorage.getItem('cc_notif_enabled')==='1';
function updateNotifIcon(){
  const btn=document.getElementById('notifBtn'); if(!btn)return;
  btn.textContent = (notifEnabled && typeof Notification!=='undefined' && Notification.permission==='granted') ? '🔔' : '🔕';
}
async function toggleNotifications(){
  if(typeof Notification==='undefined'){toast('⚠️ Meldingen worden niet ondersteund in deze browser');return;}
  if(notifEnabled){
    notifEnabled=false; localStorage.setItem('cc_notif_enabled','0');
    updateNotifIcon(); toast('🔕 Meldingen uitgeschakeld');
    return;
  }
  const perm = await Notification.requestPermission();
  if(perm!=='granted'){toast('⚠️ Toestemming geweigerd — kan later aangepast worden bij je browserinstellingen voor deze site');updateNotifIcon();return;}
  notifEnabled=true; localStorage.setItem('cc_notif_enabled','1');
  updateNotifIcon();
  toast('🔔 Meldingen aan — je krijgt een melding bij nieuwe aanvragen zolang deze pagina open staat');
  try{ new Notification('🏕️ Meldingen ingeschakeld',{body:'Je krijgt hier voortaan een melding bij nieuwe aanvragen in Postvak.'}); }catch(e){}
}
function showNotif(title,body){
  if(!notifEnabled || typeof Notification==='undefined' || Notification.permission!=='granted')return;
  try{ new Notification(title,{body}); }catch(e){}
}
let _notifChannelActive=false;
function initRealtimeNotifications(){
  if(_notifChannelActive)return; _notifChannelActive=true;
  sb.channel('bookings-notif')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'bookings'},payload=>{
      const row=payload.new;
      if(row && row.status==='aanvraag'){
        showNotif('📥 Nieuwe aanvraag in Postvak', (row.ai_draft?'🤖 Automatisch ingelezen — ':'')+'te controleren en te bevestigen.');
      }
      loadData();
    })
    .subscribe();
}

/* ---------- data ---------- */
function mapBooking(row){
  const c=row.clients||{};
  return {
    id:row.id, clientId:c.id, volgnummer:row.volgnummer, ogm:row.ogm_referentie,
    naam:c.naam||'(onbekend)', email:c.email||'', telefoon:c.telefoon||'',
    plaat:c.nummerplaten||'', idnr:c.id_nummer||'',
    volwassenen:row.volwassenen||0, kinderen:row.kinderen||0, baby:row.baby||0,
    personen:(row.volwassenen||0)+(row.kinderen||0)+(row.baby||0),
    aankomst:row.aankomst, vertrek:row.vertrek,
    type:row.verblijfstype||'', tenten:row.tenten||0, campers:row.campers||0,
    extraTypeUnits:(()=>{try{return typeof row.extra_type_units==='string'?JSON.parse(row.extra_type_units):(row.extra_type_units||[]);}catch(e){return[];}})(),
    status:row.status, bron:row.bron||'', bedrag:row.bedrag_totaal||0,
    ingecheckt_at:row.ingecheckt_at, uitgecheckt_at:row.uitgecheckt_at,
    aiDraft:!!row.ai_draft, aiParsed:row.ai_parsed||null,
    nota:row.nota||'', honden:row.honden||0, autos:row.autos||1, elektriciteit:!!row.elektriciteit,
    waarborgOntvangenAt:row.waarborg_ontvangen_at||null, waarborgTeruggegevenAt:row.waarborg_teruggegeven_at||null,
  };
}
/* ---------- offline-cache (lezen zonder internet) ----------
   Vervolg-punt: op de weide moet je tussen bestaande boekingen kunnen
   wisselen zonder verbinding. Optie A (besproken en gekozen): na elke
   geslaagde laadbeurt bewaren we een kopie van alles in IndexedDB; lukt
   het live laden niet (geen netwerk), dan vallen we terug op die kopie
   zodat de app toch gevuld is en je kan lezen/wisselen. Acties die een
   schrijfactie vereisen (inchecken, gast toevoegen...) blijven wel
   internet nodig hebben — dat is optie B, bewust (nog) niet gebouwd. */
const CACHE_DB='cc_offline_cache', CACHE_STORE='snapshot';
function cacheDbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(CACHE_DB,1);
    req.onupgradeneeded=()=>{ req.result.createObjectStore(CACHE_STORE,{keyPath:'key'}); };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveOfflineSnapshot(){
  try{
    const db=await cacheDbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readwrite');
      tx.objectStore(CACHE_STORE).put({
        key:'main', bookings, paidByBooking, maxPlaatsen, clubCfg, PRICES, accTypes, extraTarieven,
        savedAt:new Date().toISOString(),
      });
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }catch(e){/* IndexedDB kan uitzonderlijk falen (privé-modus) — offline-lezen is een extra, geen vereiste */}
}
async function loadOfflineSnapshot(){
  try{
    const db=await cacheDbOpen();
    return await new Promise((resolve,reject)=>{
      const req=db.transaction(CACHE_STORE,'readonly').objectStore(CACHE_STORE).get('main');
      req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error);
    });
  }catch(e){return null;}
}
async function loadData(){
  try{
    const pr=await sb.from('club_settings').select('value').eq('key','max_plaatsen').limit(1);
    if(pr.data&&pr.data.length) maxPlaatsen=parseInt(pr.data[0].value)||0;
    await loadRole();
    const cs=await sb.from('club_settings').select('key,value');
    clubCfg={};(cs.data||[]).forEach(r=>{clubCfg[r.key]=r.value;});
    await loadPrices(); // PRICES/accTypes altijd fris — nodig voor de prijsopbouw in elke fiche
    const res=await sb.from('bookings').select('*,clients(*)').order('aankomst',{ascending:true});
    if(res.error)throw new Error(res.error.message);
    bookings=(res.data||[]).map(mapBooking);
    paidByBooking={};
    const pays=await sb.from('payments').select('booking_id,bedrag,status');
    (pays.data||[]).filter(p=>p.status==='paid').forEach(p=>{paidByBooking[p.booking_id]=(paidByBooking[p.booking_id]||0)+Number(p.bedrag||0);});
    renderAll();
    saveOfflineSnapshot();
  }catch(e){
    const snap=await loadOfflineSnapshot();
    if(!snap){toast('⚠️ Kon reserveringen niet laden: '+e.message);return;}
    bookings=snap.bookings||[]; paidByBooking=snap.paidByBooking||{}; maxPlaatsen=snap.maxPlaatsen||0;
    clubCfg=snap.clubCfg||{}; PRICES=snap.PRICES||PRICES; accTypes=snap.accTypes||[]; extraTarieven=snap.extraTarieven||[];
    renderAll();
    toast('📵 Geen verbinding — laatst gekende gegevens getoond (van '+new Date(snap.savedAt).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'). Nieuw inschrijven/inchecken lukt pas terug met internet.');
  }
}
function reloadData(){ loadData(); toast('↻ Vernieuwd'); }

function paidOf(b){return paidByBooking[b.id]||0;}
function openOf(b){return Math.round((Number(b.bedrag||0)-paidOf(b))*100)/100;}
function folderOf(b){
  if(b.status==='geannuleerd')return 'vertrokken';
  if(b.uitgecheckt_at)return 'vertrokken';
  if(b.vertrek && b.vertrek<TODAY)return 'vertrokken';
  if(b.ingecheckt_at)return 'aanwezig';
  if(b.status==='aanvraag')return 'postvak';
  return 'booking';
}
function inFolder(f){return bookings.filter(b=>folderOf(b)===f);}
function waarborgTotaal(b){
  return (b.extraTypeUnits||[]).reduce((s,t)=>s+(t.waarborgBedrag||0)*(t.count||0),0);
}
function verblijf(b){
  const parts=[];
  if(b.tenten>0)parts.push('⛺ '+b.tenten+' tent'+(b.tenten>1?'en':''));
  if(b.campers>0)parts.push('🚐 '+b.campers+' camper'+(b.campers>1?'s':''));
  (b.extraTypeUnits||[]).forEach(t=>{if(t.count>0)parts.push((t.emoji||'🏕️')+' '+t.count+'× '+t.naam);});
  return parts.join(' + ')||(b.type||'—');
}

/* ---------- render: shell ---------- */
function renderAll(){
  renderDagbord(); renderFolders(); updateCounts();
  if(selectedId){const b=bookings.find(x=>x.id===selectedId); if(b){renderFiche(b);return;}}
  showFicheEmptyState();
}
// Leeg-scherm voor de fiche zolang er niets geselecteerd is (of nadat de
// geopende boeking net verwijderd/geweigerd werd) — anders zou het laatst
// getoonde (of het allereerste, statische) fiche-scherm blijven hangen.
function showFicheEmptyState(){
  const av=document.getElementById('ficheAv'); if(av)av.textContent='—';
  const nm=document.getElementById('ficheName'); if(nm)nm.textContent='Selecteer een boeking';
  const mt=document.getElementById('ficheMeta'); if(mt)mt.textContent='Kies links een reservering uit de lijst';
  const fi=document.getElementById('ficheIn'); if(fi)fi.textContent='—';
  const fo=document.getElementById('ficheOut'); if(fo)fo.textContent='—';
  const mv=document.getElementById('moveBtn'); if(mv)mv.style.display='none';
  const db=document.getElementById('draftBanner'); if(db)db.style.display='none';
  ['gegCard','paneGegExtra','pane-comm','pane-bet','pane-gast'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
}
function updateCounts(){
  ['postvak','booking','aanwezig','vertrokken'].forEach(f=>{
    const el=document.querySelector('.foldertabs .ft[data-folder="'+f+'"] .ct');
    if(el) el.textContent=inFolder(f).length;
  });
}
function rowHtml(b,sub,pill){
  return '<div class="task'+(b.id===selectedId?' sel':'')+'" onclick="openReal(\''+b.id+'\')">'+
    '<div class="av" style="background:'+avColor(b.id)+'">'+esc(initials(b.naam))+'</div>'+
    '<div class="tb"><div class="tn">'+esc(b.naam)+'</div><div class="td">'+sub+'</div></div>'+
    (pill||'')+'</div>';
}
function emptyCard(txt){return '<div class="card taskcard"><div class="note-inline" style="padding:20px;">'+txt+'</div></div>';}

/* ---------- render: dagbord ---------- */
function dbScrollTo(id){
  const el=document.getElementById(id); if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderDagbord(){
  const aankomst=bookings.filter(b=>b.aankomst===TODAY&&b.status!=='geannuleerd'&&!b.uitgecheckt_at);
  const vertrek=bookings.filter(b=>b.vertrek===TODAY&&b.status!=='geannuleerd'&&!b.uitgecheckt_at);
  const aanwezig=inFolder('aanwezig');
  const openList=bookings.filter(b=>folderOf(b)!=='vertrokken'&&openOf(b)>0.005);
  const openSom=openList.reduce((s,b)=>s+openOf(b),0);
  const postvak=inFolder('postvak');
  const bezet=maxPlaatsen>0?Math.round(aanwezig.length/maxPlaatsen*100)+'%':'—';
  let naam=currentUser&&currentUser.email?currentUser.email.split('@')[0]:'';
  naam=naam?naam.charAt(0).toUpperCase()+naam.slice(1):'';

  let h='';
  h+='<div class="greet"><div class="g1">Goeiedag'+(naam?', '+esc(naam):'')+' 👋</div><div class="g2">Dit is je werk voor vandaag.</div></div>';
  h+='<div class="kpis">'+
     '<div class="kpi" style="cursor:pointer;" onclick="dbScrollTo(\'dbAankomstSec\')"><div class="kv g">'+aankomst.length+'</div><div class="kk">🟢 Aankomst</div></div>'+
     '<div class="kpi" style="cursor:pointer;" onclick="dbScrollTo(\'dbVertrekSec\')"><div class="kv r">'+vertrek.length+'</div><div class="kk">🔴 Vertrek</div></div>'+
     '<div class="kpi" style="cursor:pointer;" onclick="setFolder(\'aanwezig\')"><div class="kv b">'+aanwezig.length+'</div><div class="kk">🏕️ Aanwezig</div></div>'+
     '<div class="kpi"><div class="kv" style="font-size:19px;">'+money(openSom)+'</div><div class="kk">💰 Openstaand</div></div>'+
     '<div class="kpi"><div class="kv" style="font-size:22px;">'+bezet+'</div><div class="kk">📊 Bezetting</div></div>'+
     '</div>';
  if(postvak.length){
    h+='<div class="alert" onclick="setFolder(\'postvak\')"><div class="ai">📥</div>'+
       '<div class="at"><div class="a1">'+postvak.length+' aanvra'+(postvak.length===1?'ag':'gen')+' in Postvak</div>'+
       '<div class="a2">Nog te controleren en te bevestigen</div></div><div class="ar">›</div></div>';
  }
  h+='<div id="draftsAlertBox"></div>';
  h+='<div class="sec-lbl" id="dbAankomstSec">🟢 Aankomst vandaag</div>';
  h+=aankomst.length?'<div class="card taskcard">'+aankomst.map(b=>rowHtml(b,esc(verblijf(b))+' · '+b.personen+' pers.','<span class="pill p-arr">AANKOMST</span>')).join('')+'</div>':emptyCard('Geen aankomsten vandaag');
  h+='<div class="sec-lbl" id="dbVertrekSec">🔴 Vertrek vandaag</div>';
  h+=vertrek.length?'<div class="card taskcard">'+vertrek.map(b=>rowHtml(b,esc(verblijf(b)),'<span class="pill p-dep">VERTREK</span>')).join('')+'</div>':emptyCard('Geen vertrekken vandaag');
  h+='<div class="sec-lbl">💰 Openstaande betalingen</div>';
  h+=openList.length?'<div class="card taskcard">'+openList.slice(0,8).map(b=>rowHtml(b,'Nog '+money(openOf(b))+' open','<span class="pill p-pay">OPEN</span>')).join('')+'</div>':emptyCard('Alles betaald 🎉');
  h+='<div style="height:6px;"></div>';
  document.getElementById('scr-dagbord').innerHTML=h;
  updateDraftsUI();
}

/* ---------- render: mappen ---------- */
function renderFolders(){
  const conf={
    postvak:{list:inFolder('postvak').sort(byAankomst),pill:'<span class="pill p-req">controleren</span>',hint:'nieuwe aanvragen · nog te bevestigen'},
    booking:{list:inFolder('booking').sort(byAankomst),pill:'<span class="pill p-conf">bevestigd</span>',hint:'binnen, nog niet gearriveerd'},
    aanwezig:{list:inFolder('aanwezig').sort(byAankomst),pill:'<span class="pill p-in">aanwezig</span>',hint:'staan nu op de camping · dit is "wie is er"'},
    vertrokken:{list:inFolder('vertrokken').sort(byVertrekDesc),pill:'<span class="pill p-out">afgesloten</span>',hint:'archief · doorzoekbaar'},
  };
  Object.keys(conf).forEach(f=>{
    const c=conf[f];const el=document.getElementById('fc-'+f);if(!el)return;
    const rows=c.list.map(b=>{
      const sub=fmt(b.aankomst)+'–'+fmt(b.vertrek)+' · '+esc(verblijf(b))+(openOf(b)>0.005&&f!=='vertrokken'?' · nog '+money(openOf(b)):'');
      let pill=c.pill;
      if(f==='postvak'&&b.status!=='aanvraag')pill='<span class="pill p-conf">'+esc(b.status)+'</span>';
      else if(f==='postvak'&&b.aiDraft)pill='<span class="pill p-draft">🤖 AI-concept</span>';
      return rowHtml(b,sub,pill);
    }).join('');
    el.innerHTML=(c.list.length?'<div class="card taskcard">'+rows+'</div>':emptyCard('Geen reserveringen in deze map'))+'<div class="list-hint">'+c.hint+'</div>';
  });
}
function byAankomst(a,b){return (a.aankomst||'').localeCompare(b.aankomst||'');}
function byVertrekDesc(a,b){return (b.vertrek||'').localeCompare(a.vertrek||'');}

/* ---------- navigatie ---------- */
function setNav(screen){document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-screen')===screen));}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));document.getElementById('scr-'+id).classList.add('on');document.getElementById('content').scrollTop=0;}
function go(screen){
  document.getElementById('app').classList.remove('mobileFiche');
  setNav(screen);showScreen(screen);
  if(screen==='kalender')renderKalender();
  if(screen==='bezoekers')loadBezoekers();
  if(screen==='beheer')setBeheer(_beheerTab);
}
function setFolder(f){
  go('reserv');
  document.querySelectorAll('#scr-reserv .foldertabs .ft').forEach(b=>b.classList.toggle('on',b.getAttribute('data-folder')===f));
  ['postvak','booking','aanwezig','vertrokken'].forEach(x=>{document.getElementById('fc-'+x).style.display=(x===f)?'block':'none';});
  const bar=document.getElementById('postvakCheckBar'); if(bar)bar.style.display=(f==='postvak')?'block':'none';
}
async function checkNieuweMails(){
  const btn=document.getElementById('postvakCheckBtn');
  btn.disabled=true; btn.textContent='🔄 Bezig — AI leest de inbox…';
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(SUPABASE_URL+'/functions/v1/parse-inbox-ai',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
    });
    const d=await res.json();
    if(d.error)throw new Error(d.error);
    toast(d.nieuw>0?('📥 '+d.nieuw+' nieuwe aanvraag'+(d.nieuw>1?'en':'')+' gevonden'):'✅ Geen nieuwe reservatie-aanvragen');
    await loadData(); setFolder('postvak');
  }catch(e){toast('⚠️ '+e.message);}
  finally{btn.disabled=false;btn.textContent='🔄 Nieuwe mails controleren (AI leest reservatie-aanvragen)';}
}
function setTab(t){
  document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.toggle('on',b.getAttribute('data-tab')===t));
  ['geg','comm','bet','gast'].forEach(x=>document.getElementById('pane-'+x).classList.toggle('on',x===t));
}
function closeFiche(){document.getElementById('app').classList.remove('mobileFiche');}
function doMove(){} // vervangen door contextactie in renderFiche

/* ---------- fiche ---------- */
function openReal(id){
  selectedId=id;
  const b=bookings.find(x=>x.id===id); if(!b)return;
  renderFiche(b);
  document.querySelectorAll('.reserv-list .task').forEach(t=>t.classList.remove('sel'));
  go('reserv');
  if(isMobile()){document.getElementById('app').classList.add('mobileFiche');document.getElementById('content').scrollTop=0;}
  else{document.getElementById('reservDetail').scrollIntoView({block:'nearest'});}
}
function renderFiche(b){
  const folder=folderOf(b);
  const db=document.getElementById('draftBanner');
  db.style.display=(b.aiDraft&&folder==='postvak')?'flex':'none';
  const av=document.getElementById('ficheAv');
  av.textContent=initials(b.naam); av.style.background=avColor(b.id);
  document.getElementById('ficheName').textContent=b.naam;
  document.getElementById('ficheMeta').textContent='#'+(b.volgnummer||'—')+' · '+FOLDER_LABEL[folder];
  document.getElementById('ficheIn').textContent=fmt(b.aankomst);
  document.getElementById('ficheOut').textContent=fmt(b.vertrek);

  // context-actieknop
  const mv=document.getElementById('moveBtn');
  mv.style.display='flex'; mv.style.background='var(--green)';
  if(folder==='postvak'){mv.textContent='✓ Bevestigen  →  Booking';mv.onclick=()=>actBevestig(b.id);}
  else if(folder==='booking'){mv.textContent='🏕️ Inchecken  →  Aanwezig';mv.onclick=()=>actInchecken(b.id);}
  else if(folder==='aanwezig'){mv.textContent='👋 Uitchecken  →  Vertrokken';mv.style.background='var(--blue)';mv.onclick=()=>actUitchecken(b.id);}
  else {mv.style.display='none';}

  // gegevens
  const extra=[];
  if(b.honden>0)extra.push('🐕 '+b.honden+' hond'+(b.honden>1?'en':''));
  if(b.autos>1)extra.push('🚗 '+b.autos+' auto\'s');
  if(b.elektriciteit)extra.push('⚡ elektriciteit');
  const bronL={mail:'📧 E-mail',website:'🌐 Website',telefoon:'☎️ Telefoon'}[b.bron]||(b.bron||'—');
  let g='';
  g+=grow('Plaats / type',esc(verblijf(b)));
  g+=grow('Personen',b.volwassenen+' volw.'+(b.kinderen?' · '+b.kinderen+' kind':'')+(b.baby?' · '+b.baby+' baby':''));
  g+=grow('Nummerplaat',b.plaat?esc(b.plaat):'—');
  if(extra.length)g+=grow('Extra\'s',extra.join(' · '));
  g+=grow('E-mail',b.email?esc(b.email):'—');
  g+=grow('Telefoon',b.telefoon?esc(b.telefoon):'—');
  g+=grow('Kanaal',bronL);
  document.getElementById('gegCard').innerHTML=g;
  const gp=document.getElementById('paneGegExtra');
  if(gp){
    let x='';
    // Prijs per dag × aantal dagen, direct op basis van deze boeking — zodat
    // Karen meteen ziet wat een extra dag zou kosten. Gebaseerd op het al
    // bevestigde totaalbedrag (klopt altijd, ook voor boekingen met een
    // eigen verblijfstype dat niet de standaard tent/camper-prijs volgt).
    const nn=nights(b.aankomst,b.vertrek);
    const perDagTarief=nn>0?Math.round((Number(b.bedrag||0)/nn)*100)/100:0;
    x+='<div class="sec-lbl">Prijs</div><div class="card">'+
      grow('Prijs per dag',money(perDagTarief))+
      grow('× '+nn+' nacht'+(nn===1?'':'en'),money(b.bedrag))+
      '<div class="row" style="background:var(--green-soft);"><span class="rl" style="color:var(--green);font-weight:700;">Totaal</span><span class="rv" style="color:var(--green);font-weight:800;">'+money(b.bedrag)+'</span></div>'+
      '</div>';
    if(b.nota)x+='<div class="sec-lbl">Opmerking</div><div class="card"><div class="row" style="justify-content:flex-start;"><span class="rl">'+esc(b.nota)+'</span></div></div>';
    x+='<button class="sbtn" style="width:100%;margin-top:12px;" onclick="editGegevens(\''+b.id+'\')">✏️ Gegevens bewerken</button>';
    gp.innerHTML=x;
  }

  loadBetPane(b);
  loadGastPane(b);
  loadCommPane(b);
  setTab('geg');
}
function grow(l,v){return '<div class="row"><span class="rl">'+l+'</span><span class="rv">'+v+'</span></div>';}

/* betaling — Karen werkt met cash / overschrijving / QR op eigen IBAN (geen Mollie) */
async function loadBetPane(b){
  const el=document.getElementById('pane-bet');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('payments').select('bedrag,status,methode,created_at').eq('booking_id',b.id).order('created_at');
  const rows=(data||[]).filter(p=>p.status==='paid');
  const betaald=rows.reduce((s,p)=>s+Number(p.bedrag||0),0);
  const terugbetaald=rows.filter(p=>p.methode==='terugbetaling').length>0;
  const totaal=Number(b.bedrag||0);
  const open=Math.round((totaal-betaald)*100)/100;
  const pct=totaal>0?Math.min(100,Math.max(0,Math.round(betaald/totaal*100))):0;
  const volledig=open<=0.005 && betaald>0;
  // afgeleide betaalstatus (de 7 statussen van Karen)
  let statusLbl, statusKleur;
  if(terugbetaald){statusLbl='↩️ Terugbetaald';statusKleur='var(--blue)';}
  else if(volledig){statusLbl='✅ Volledig betaald';statusKleur='var(--green)';}
  else if(betaald>0){statusLbl='◐ Voorschot betaald';statusKleur='var(--amber)';}
  else {statusLbl='○ Niet betaald';statusKleur='var(--red)';}
  const methL={cash:'💵 Cash',overschrijving:'🏦 Overschrijving',qr:'📱 QR-code',terugbetaling:'↩️ Terugbetaling'};

  let h='<div class="card"><div class="paytop">'+
    '<div class="ring" style="background:conic-gradient('+(volledig?'var(--green)':'var(--amber)')+' '+pct+'%, var(--sep) 0);color:'+(volledig?'var(--green)':'var(--amber)')+';"><div class="inner">'+pct+'%</div></div>'+
    '<div class="pt"><div class="a">'+money(betaald)+' <span style="font-size:13px;color:var(--ink-3);font-weight:600;">/ '+money(totaal)+'</span></div>'+
    '<div class="b" style="color:'+statusKleur+';font-weight:700;">'+statusLbl+(!volledig&&betaald>0?' · nog '+money(open):'')+'</div></div></div></div>';

  h+='<button class="sbtn" style="width:100%;margin-bottom:12px;" onclick="openFactuur(\''+b.id+'\')">🧾 Factuur openen (printen / als PDF bewaren)</button>';
  h+='<div class="sec-lbl">Registreer betaling</div>';
  h+='<div class="statusgrid" style="padding:0;">'+
     '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'cash\')">💵 Cash</div>'+
     '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'overschrijving\')">🏦 Overschrijving</div>'+
     '<div class="sbtn" style="grid-column:1/-1;" onclick="actBetaling(\''+b.id+'\',\'qr\')">📱 QR-betaling ontvangen</div>'+
     '<div class="sbtn" style="grid-column:1/-1;border-color:var(--green);color:var(--green);font-weight:700;" onclick="toggleQR(\''+b.id+'\')">📱 Toon betaal-QR (op eigen IBAN)</div>'+
     '</div>';
  h+='<div id="qrBox" style="display:none;margin-top:10px;"></div>';

  h+='<div class="sec-lbl">Historiek</div>';
  h+=rows.length?'<div class="card payhist">'+rows.map(p=>'<div class="row"><span class="rl">'+(methL[p.methode]||'💳 '+esc(p.methode||''))+' · '+new Date(p.created_at).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+'</span><span class="rv" style="color:'+(Number(p.bedrag)<0?'var(--blue)':'var(--green)')+'">'+(Number(p.bedrag)<0?'':'+')+money(p.bedrag)+'</span></div>').join('')+'</div>':emptyCard('Nog geen betalingen');
  if(betaald>0 && !terugbetaald){
    h+='<div style="text-align:center;margin-top:10px;"><span onclick="actTerugbetaling(\''+b.id+'\')" style="font-size:12px;color:var(--blue);cursor:pointer;font-family:var(--f-mono);">↩️ Terugbetaling registreren</span></div>';
  }
  // Waarborg — bewust volledig los van de prijs/payments-hierboven: telt
  // nooit mee als omzet en mag Karen enkel cash registreren (nooit QR of
  // overschrijving), zodat een deposito nooit als betaling van de
  // accommodatie zelf verward kan worden.
  const wTot=waarborgTotaal(b);
  if(wTot>0.005){
    h+='<div class="sec-lbl">🔒 Waarborg (cash, apart van bovenstaande prijs)</div>';
    if(!b.waarborgOntvangenAt){
      h+='<div class="card"><div class="row" style="background:var(--amber-soft);"><span class="rl" style="color:var(--amber);font-weight:700;">Nog te ontvangen</span><span class="rv" style="color:var(--amber);font-weight:800;">'+money(wTot)+'</span></div></div>'+
        '<button class="sbtn" style="width:100%;margin-top:8px;border-color:var(--green);color:var(--green);font-weight:700;" onclick="actWaarborgOntvangen(\''+b.id+'\')">💵 Waarborg ontvangen (cash)</button>';
    } else if(!b.waarborgTeruggegevenAt){
      h+='<div class="card"><div class="row" style="background:var(--green-soft);"><span class="rl" style="color:var(--green);font-weight:700;">Ontvangen · '+new Date(b.waarborgOntvangenAt).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+'</span><span class="rv" style="color:var(--green);font-weight:800;">'+money(wTot)+'</span></div></div>'+
        '<button class="sbtn" style="width:100%;margin-top:8px;" onclick="actWaarborgTeruggegeven(\''+b.id+'\')">↩️ Waarborg teruggegeven (cash)</button>';
    } else {
      h+='<div class="card"><div class="row"><span class="rl" style="color:var(--ink-3);">↩️ Teruggegeven · '+new Date(b.waarborgTeruggegevenAt).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+'</span><span class="rv">'+money(wTot)+'</span></div></div>';
    }
  }
  el.innerHTML=h;
}
async function actWaarborgOntvangen(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Waarborg van '+money(waarborgTotaal(b))+' cash ontvangen van '+b.naam+'?'))return;
  const {error}=await sb.from('bookings').update({waarborg_ontvangen_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('💵 Waarborg geregistreerd als ontvangen (cash)'); await loadData();
}
async function actWaarborgTeruggegeven(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Waarborg van '+money(waarborgTotaal(b))+' cash teruggegeven aan '+b.naam+'?'))return;
  const {error}=await sb.from('bookings').update({waarborg_teruggegeven_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('↩️ Waarborg geregistreerd als teruggegeven (cash)'); await loadData();
}
/* ---------- factuur (printbaar, geen aparte PDF-lib nodig) ----------
   Optie 1 uit het overleg met Bryan: on-demand vanuit de fiche zelf, geen
   apart Beheer-scherm en geen doorlopende nummering (dat kan later als er
   veel vraag naar komt). Gebruikt window.print() — zelfde patroon als het
   bestaande register/calamiteiten-export — zodat Karen of de klant het
   rechtstreeks kan afdrukken of via de browser als PDF kan bewaren. */
async function openFactuur(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const {data}=await sb.from('settings').select('key,value').in('key',['kbo','btw_nummer','adres']);
  const cfg={};(data||[]).forEach(r=>cfg[r.key]=r.value);
  const nn=nights(b.aankomst,b.vertrek);
  const perDag=nn>0?Math.round((Number(b.bedrag||0)/nn)*100)/100:0;
  const betaald=paidOf(b), open=openOf(b);
  const w=window.open('','_blank');
  if(!w){toast('⚠️ Sta pop-ups toe om de factuur te openen');return;}
  w.document.write('<html><head><title>Factuur #'+(b.volgnummer||'—')+'</title></head>'+
    '<body style="font-family:sans-serif;padding:32px;max-width:640px;margin:0 auto;color:#1c1c1e;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">'+
    '<div><div style="font-size:20px;font-weight:800;">🏕️ Camping Cosmopolite</div>'+
    '<div style="font-size:12px;color:#666;margin-top:4px;">'+esc(cfg.adres||'')+'</div>'+
    '<div style="font-size:12px;color:#666;">KBO: '+esc(cfg.kbo||'—')+' · BTW: '+esc(cfg.btw_nummer||'—')+'</div></div>'+
    '<div style="text-align:right;"><div style="font-size:22px;font-weight:800;">FACTUUR</div>'+
    '<div style="font-size:12px;color:#666;">Nr. FACT-'+(b.volgnummer||'—')+'</div>'+
    '<div style="font-size:12px;color:#666;">Datum: '+fmtDateLong(TODAY)+'</div></div></div>'+
    '<div style="margin-bottom:24px;"><div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Klant</div>'+
    '<div style="font-size:14px;font-weight:700;">'+esc(b.naam)+'</div>'+
    (b.email?'<div style="font-size:12.5px;color:#666;">'+esc(b.email)+'</div>':'')+'</div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">'+
    '<tr style="border-bottom:1.5px solid #ddd;text-align:left;"><th style="padding:8px 4px;">Omschrijving</th><th style="padding:8px 4px;text-align:right;">Bedrag</th></tr>'+
    '<tr style="border-bottom:.5px solid #eee;"><td style="padding:8px 4px;">'+esc(verblijf(b))+' · '+fmt(b.aankomst)+' – '+fmt(b.vertrek)+' ('+nn+' nacht'+(nn===1?'':'en')+')<br>'+
    '<span style="font-size:11px;color:#999;">€'+perDag.toFixed(2)+'/nacht × '+nn+'</span></td><td style="padding:8px 4px;text-align:right;vertical-align:top;">'+money(b.bedrag)+'</td></tr>'+
    '<tr style="border-top:1.5px solid #1c1c1e;font-weight:800;"><td style="padding:10px 4px;">Totaal</td><td style="padding:10px 4px;text-align:right;">'+money(b.bedrag)+'</td></tr>'+
    '</table>'+
    '<div style="font-size:12.5px;line-height:1.8;">'+
    '<div>Reeds betaald: <b>'+money(betaald)+'</b></div>'+
    (open>0.005?'<div>Nog te betalen: <b style="color:#CC7700;">'+money(open)+'</b></div>':'<div style="color:#1B8A5B;font-weight:700;">✅ Volledig betaald</div>')+
    '</div>'+
    '<div style="margin-top:28px;font-size:10.5px;color:#999;">Prijzen incl. 12% BTW (campingdiensten) en toeristentaks. Waarborg (indien van toepassing) is niet in deze factuur inbegrepen — cash geregeld ter plaatse.</div>'+
    '<script>window.onload=function(){window.print()}<\/script></body></html>');
  w.document.close();
}
function toggleQR(id){
  const box=document.getElementById('qrBox');if(!box)return;
  if(box.style.display==='block'){box.style.display='none';box.innerHTML='';return;}
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const iban=clubCfg.iban||'';
  if(!iban || (window.CampingPayment && !CampingPayment.isValidIban(iban))){
    box.style.display='block';
    box.innerHTML='<div class="card"><div class="note-inline" style="padding:16px;color:var(--red);">⚠️ Geen geldig IBAN ingesteld. Vul dit in bij Beheer → Bankgegevens.</div></div>';
    return;
  }
  const open=openOf(b)>0.005?openOf(b):Number(b.bedrag||0);
  const naam=clubCfg.rekeninghouder||'Camping Cosmopolite';
  const ref=(window.CampingPayment&&b.volgnummer!=null)?CampingPayment.belgianOgm(b.volgnummer):(b.ogm||'');
  const payload=CampingPayment.buildEpcQrPayload({iban:iban,name:naam,bic:clubCfg.bic,amount:open,reference:ref});
  let qrSvg='';
  try{ const qr=qrcode(0,'M'); qr.addData(payload); qr.make(); qrSvg=qr.createSvgTag({cellSize:4,margin:2}); }
  catch(e){ qrSvg='<div style="color:var(--red);font-size:12px;">QR kon niet laden</div>'; }
  box.style.display='block';
  box.innerHTML='<div class="card" style="padding:16px;text-align:center;">'+
    '<div style="background:#fff;display:inline-block;padding:10px;border-radius:12px;">'+qrSvg+'</div>'+
    '<div style="font-size:12.5px;color:var(--ink-2);margin-top:12px;text-align:left;line-height:1.7;">'+
    '<div><b>Begunstigde:</b> '+esc(naam)+'</div>'+
    '<div><b>IBAN:</b> '+esc(CampingPayment.formatIban(iban))+'</div>'+
    '<div><b>Bedrag:</b> '+money(open)+'</div>'+
    '<div><b>Mededeling:</b> '+esc(ref)+'</div></div>'+
    '<div class="note-inline">Laat de gast scannen met de bankapp</div></div>';
}

/* gasten — lezen + toevoegen + verwijderen, met AI ID-scan */
async function loadGastPane(b){
  const el=document.getElementById('pane-gast');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('gasten').select('*').eq('booking_id',b.id).order('is_hoofdgast',{ascending:false}).order('created_at');
  const real=(data||[]).filter(g=>g.naam!=='__pending_guest_upload__'&&!g.deleted_at);
  let h='';
  if(real.length){
    h+='<div class="card">'+real.map(g=>{
      const sub=[g.geboortedatum?'°'+String(g.geboortedatum).slice(0,4):'',g.nationaliteit||'',g.id_nummer?'ID ✓':''].filter(Boolean).join(' · ');
      const thumb=g.foto_url?'<div class="thumb" data-id-thumb="'+esc(g.foto_url)+'" style="cursor:pointer;" onclick="event.stopPropagation();bekijkIdFoto(\''+esc(g.foto_url)+'\')">···</div>':'<div class="thumb">🪪</div>';
      return '<div class="guest">'+thumb+'<div class="gi"><div class="gn">'+esc(g.naam)+(g.is_hoofdgast?' <span class="pill p-conf" style="margin-left:4px;">Hoofd</span>':'')+'</div><div class="gd">'+(esc(sub)||'geen details')+'</div></div>'+
        '<span onclick="delGast(\''+g.id+'\',\''+b.id+'\')" style="color:var(--red);cursor:pointer;font-size:15px;padding:6px;">🗑</span></div>';
    }).join('')+'</div>';
  } else {
    h+=emptyCard('Nog geen gasten geregistreerd voor deze reservering');
  }
  h+='<button class="ai-btn" onclick="openAddGuest(\''+b.id+'\')">➕ Gast toevoegen · 🤖 met AI-scan</button>';
  h+='<div class="note-inline">wettelijk register · '+real.length+' gast'+(real.length===1?'':'en')+' geregistreerd</div>';
  el.innerHTML=h;
  // ID-thumbnails asynchroon inladen (signed URLs), blokkeert de lijst niet.
  // Zichtbaar voor elke ingelogde gebruiker met een rol (staff of admin).
  document.querySelectorAll('#pane-gast [data-id-thumb]').forEach(async(elm)=>{
    const path=elm.getAttribute('data-id-thumb');
    try{
      const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(path,300);
      if(s&&s.signedUrl)elm.innerHTML='<img src="'+s.signedUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
    }catch(e){/* foto niet gevonden — emoji-placeholder blijft staan */}
  });
}
function bekijkIdFoto(path){
  sb.storage.from('id-fotos').createSignedUrl(path,120).then(({data})=>{
    if(data&&data.signedUrl)window.open(data.signedUrl,'_blank');
    else toast('⚠️ Kon foto niet ophalen');
  });
}
async function delGast(gastId,bookingId){
  if(!confirm('Gast verwijderen uit het register?'))return;
  const {error}=await sb.from('gasten').delete().eq('id',gastId);
  if(error){toast('⚠️ '+error.message);return;}
  toast('🗑 Gast verwijderd');
  const b=bookings.find(x=>x.id===bookingId); if(b) loadGastPane(b);
}
function _fileToB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});}

function openAddGuest(bookingId){
  const b=bookings.find(x=>x.id===bookingId);
  openModal('Gast toevoegen',
    '<div style="display:flex;gap:8px;margin-bottom:8px;">'+
    '<button class="scanbtn" style="margin:0;flex:1;" onclick="document.getElementById(\'gScanFileCam\').click()">📷 Foto nemen</button>'+
    '<button class="scanbtn" style="margin:0;flex:1;background:var(--card-2);border-style:solid;border-color:var(--sep);color:var(--ink-2);" onclick="document.getElementById(\'gScanFile\').click()">🖼️ Bestand kiezen</button>'+
    '</div>'+
    '<input type="file" id="gScanFileCam" accept="image/*" capture="environment" style="display:none;" onchange="scanGuestFile(this)">'+
    '<input type="file" id="gScanFile" accept="image/*" style="display:none;" onchange="scanGuestFile(this)">'+
    '<img id="gScanPreview" style="display:none;width:100%;max-height:200px;object-fit:contain;border-radius:10px;border:1px solid var(--sep);margin-bottom:8px;background:var(--card-2);">'+
    '<div id="gScanHint" class="note-inline" style="min-height:14px;"></div>'+
    '<div class="fld"><label>Naam *</label><input id="gNaam" placeholder="Volledige naam"></div>'+
    '<div class="fld2"><div class="fld"><label>Geboortedatum</label><input id="gGeb" type="date"></div>'+
    '<div class="fld"><label>Nationaliteit</label><input id="gNat" placeholder="BE"></div></div>'+
    '<div class="fld2"><div class="fld"><label>ID-nummer</label><input id="gIdnr" placeholder="documentnummer"></div>'+
    '<div class="fld"><label>Nummerplaat</label><input id="gPlaat" placeholder="1-ABC-123"></div></div>'+
    '<div class="toggle-row" style="margin-bottom:13px;"><span class="sl">Hoofdgast</span><input type="checkbox" id="gHoofd" style="width:20px;height:20px;"></div>'+
    '<div id="gAddMsg" class="note-inline" style="min-height:14px;"></div>'+
    '<button class="modal-save" id="gSaveBtn" onclick="saveNewGuest(\''+bookingId+'\')">Gast opslaan</button>');
  window._scanFileCache=null;
}
async function scanGuestFile(input){
  const file=input.files&&input.files[0]; if(!file)return;
  window._scanFileCache=file;
  // Meteen een preview tonen — zo zie je onmiddellijk of de foto scherp/
  // leesbaar is, nog voor de AI-herkenning klaar is (of faalt).
  const preview=document.getElementById('gScanPreview');
  if(preview){
    if(preview.dataset.blobUrl)URL.revokeObjectURL(preview.dataset.blobUrl);
    const url=URL.createObjectURL(file);
    preview.src=url; preview.dataset.blobUrl=url; preview.style.display='block';
  }
  const hint=document.getElementById('gScanHint');
  hint.style.color='var(--ink-2)'; hint.textContent='🔎 AI leest de kaart…';
  try{
    const b64=await _fileToB64(file);
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(SUPABASE_URL+'/functions/v1/scan-id',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({image_base64:b64,media_type:file.type||'image/jpeg'}),
    });
    const d=await res.json();
    if(d.error){hint.style.color='var(--red)';hint.textContent='⚠️ '+d.error;return;}
    const naam=d.naam||[d.voornaam,d.achternaam].filter(Boolean).join(' ');
    if(naam)document.getElementById('gNaam').value=naam;
    if(d.geboortedatum)document.getElementById('gGeb').value=d.geboortedatum;
    if(d.nationaliteit)document.getElementById('gNat').value=d.nationaliteit;
    if(d.documentnummer)document.getElementById('gIdnr').value=d.documentnummer;
    hint.style.color='var(--green)';hint.textContent='✅ Ingevuld — controleer de gegevens';
  }catch(e){hint.style.color='var(--red)';hint.textContent='⚠️ AI-herkenning mislukt — vul handmatig in';}
}
async function saveNewGuest(bookingId){
  const naam=(document.getElementById('gNaam').value||'').trim();
  const msg=document.getElementById('gAddMsg');
  if(!naam){msg.style.color='var(--red)';msg.textContent='Naam is verplicht';return;}
  const btn=document.getElementById('gSaveBtn'); btn.disabled=true; btn.textContent='Opslaan…';
  try{
    const row={booking_id:bookingId, naam,
      geboortedatum:document.getElementById('gGeb').value||null,
      nationaliteit:(document.getElementById('gNat').value||'').trim()||null,
      id_nummer:(document.getElementById('gIdnr').value||'').trim()||null,
      nummerplaat:(document.getElementById('gPlaat').value||'').trim()||null,
      is_hoofdgast:document.getElementById('gHoofd').checked };
    const {data:ins,error}=await sb.from('gasten').insert(row).select('id').single();
    if(error)throw new Error(error.message);
    // ID-foto bewaren (indien gescand)
    const file=window._scanFileCache;
    if(file&&ins&&ins.id){
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
      const path=bookingId+'/'+ins.id+'.'+ext;
      const {error:upErr}=await sb.storage.from('id-fotos').upload(path,file,{upsert:true,contentType:file.type});
      if(!upErr)await sb.from('gasten').update({foto_url:path}).eq('id',ins.id);
    }
    closeModal(); toast('✅ Gast toegevoegd');
    const b=bookings.find(x=>x.id===bookingId); if(b) loadGastPane(b);
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;btn.disabled=false;btn.textContent='Gast opslaan';}
}

/* communicatie — lezen + antwoorden/nieuwe mail versturen via Karens Gmail */
async function loadCommPane(b){
  const el=document.getElementById('pane-comm');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('communicatie').select('*').eq('booking_id',b.id).order('created_at',{ascending:true});
  let thread='';
  if(data&&data.length){
    thread=data.map(c=>{
      const inkomend=c.richting==='inkomend';
      const when=new Date(c.created_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return '<div class="msg '+(inkomend?'in':'out')+'"><div class="mh"><span>'+(inkomend?'← ontvangen':'→ '+esc(c.onderwerp||'verzonden'))+'</span><span>'+when+'</span></div>'+esc(c.inhoud||'(geen inhoud)').slice(0,800)+'</div>';
    }).join('');
  } else {
    thread='<div class="note-inline" style="padding:20px;">Nog geen e-mails voor deze reservering</div>';
  }
  const geenMail=!b.email||b.email.indexOf('@cosmopolite.local')!==-1;
  let composer;
  if(geenMail){
    composer='<div class="note-inline" style="color:var(--amber);padding:14px;">⚠️ Geen geldig e-mailadres bij deze gast — mailen niet mogelijk</div>';
  } else {
    composer='<div style="padding:11px;border-top:1px solid var(--sep);">'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px;">'+
      Object.keys(MAIL_SJABLONEN).map(k=>'<button class="sbtn" style="flex:0 0 auto;padding:7px 11px;font-size:11.5px;" onclick="prefillMail(\''+b.id+'\',\''+k+'\')">'+({bevestiging:'✅ Bevestiging',herinnering:'🔔 Herinnering',betaling:'💶 Betaalverzoek',uitchecken:'👋 Uitchecken'}[k])+'</button>').join('')+'</div>'+
      '<input id="mailSubj" placeholder="Onderwerp" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;margin-bottom:8px;font-family:var(--f);">'+
      '<textarea id="mailBody" rows="5" placeholder="Typ hier je antwoord…" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;font-family:var(--f);resize:vertical;"></textarea>'+
      '<button id="mailSendBtn" class="move-btn" style="margin-top:9px;" onclick="sendFicheMail(\''+b.id+'\')">📤 Verstuur via Gmail</button>'+
      '<div id="mailSendMsg" style="font-size:12px;text-align:center;margin-top:7px;min-height:15px;"></div></div>';
  }
  el.innerHTML='<div class="card"><div class="thread">'+thread+'</div>'+composer+'</div>'+
    '<div class="note-inline">verstuurd via '+esc(clubCfg.mail_sender_email||'Karens Gmail')+' · geen aparte mailbox nodig</div>';
}
function prefillMail(id,key){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const t=MAIL_SJABLONEN[key];if(!t)return;
  const vn=(b.naam||'').split(' ')[0];
  const v={voornaam:vn,naam:b.naam,volgnummer:b.volgnummer,aankomst:fmt(b.aankomst),vertrek:fmt(b.vertrek),personen:b.personen,bedrag:money(b.bedrag),ogm:b.ogm||'',from_name:'Camping Cosmopolite'};
  const fill=s=>String(s).replace(/\{\{(\w+)\}\}/g,(_,k)=>v[k]!=null?v[k]:'{{'+k+'}}');
  document.getElementById('mailSubj').value=fill(t.onderwerp);
  document.getElementById('mailBody').value=fill(t.inhoud);
}
async function sendFicheMail(id){
  const subj=(document.getElementById('mailSubj').value||'').trim();
  const body=(document.getElementById('mailBody').value||'').trim();
  const msg=document.getElementById('mailSendMsg');
  const btn=document.getElementById('mailSendBtn');
  if(!subj||!body){msg.style.color='var(--red)';msg.textContent='Vul onderwerp en tekst in';return;}
  msg.style.color='var(--ink-2)';msg.textContent='Versturen…';btn.style.opacity='.6';
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(SUPABASE_URL+'/functions/v1/send-mail',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({booking_id:id,onderwerp:subj,inhoud:body}),
    });
    const d=await res.json();
    if(d.error)throw new Error(d.error);
    msg.style.color='var(--green)';msg.textContent='✅ Verstuurd!';
    const b=bookings.find(x=>x.id===id);
    setTimeout(()=>{if(b)loadCommPane(b);},1000);
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;btn.style.opacity='1';}
}

/* ---------- vrij verplaatsen tussen mappen (ook terug = ongedaan maken) ---------- */
function openMoveMenu(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const cur=folderOf(b);
  const opts=[['postvak','📥 Postvak'],['booking','📂 Booking'],['aanwezig','🏕️ Aanwezig'],['vertrokken','🚗 Vertrokken']];
  let h='<div style="display:flex;flex-direction:column;gap:8px;">'+
    opts.map(([k,l])=>'<button class="sbtn" style="width:100%;text-align:left;padding:13px 14px;display:flex;justify-content:space-between;'+(k===cur?'border-color:var(--green);color:var(--green);font-weight:700;':'')+'" onclick="doMoveToFolder(\''+id+'\',\''+k+'\')"><span>'+l+'</span>'+(k===cur?'<span style="font-family:var(--f-mono);font-size:11px;">huidige map</span>':'')+'</button>').join('')+
    '</div>'+
    '<div class="note-inline" style="margin-top:10px;">Je kan altijd terugverplaatsen — niets gaat verloren.</div>';
  h+='<div style="border-top:1px solid var(--sep);margin-top:14px;padding-top:14px;display:flex;flex-direction:column;gap:8px;">';
  if(cur==='postvak'){
    h+='<button class="sbtn" style="width:100%;text-align:left;color:var(--red);border-color:var(--red);" onclick="actWeigeren(\''+id+'\')">❌ Aanvraag weigeren (verwijderen)</button>';
  }
  h+='<button class="sbtn" style="width:100%;text-align:left;color:var(--red);border-color:var(--red);" onclick="actVerwijderBoeking(\''+id+'\')">🗑 Boeking volledig verwijderen</button>'+
    '</div>';
  openModal('Verplaats '+b.naam+' naar…',h);
}
/* ---------- weigeren / verwijderen (destructief, met FK-cleanup) ---------- */
async function _cleanupBookingRelated(id){
  // Opgeslagen ID-foto's mee opruimen (best effort — een falende foto-
  // cleanup mag de rest van het verwijderen niet blokkeren).
  const {data:gasten}=await sb.from('gasten').select('foto_url').eq('booking_id',id);
  const paths=(gasten||[]).map(g=>g.foto_url).filter(Boolean);
  if(paths.length){ try{ await sb.storage.from('id-fotos').remove(paths); }catch(_e){} }
  await sb.from('gasten').delete().eq('booking_id',id);
  await sb.from('payments').delete().eq('booking_id',id);
  await sb.from('communicatie').delete().eq('booking_id',id);
  // booking_attachments heeft ON DELETE CASCADE, geen aparte cleanup nodig.
  await sb.from('bezoekers').update({omgezet_naar_booking_id:null}).eq('omgezet_naar_booking_id',id);
}
/* Stuurt automatisch een mail zonder de fiche-composer nodig te hebben —
   gebruikt voor achtergrondacties zoals weigeren. Een mislukte mail mag het
   weigeren zelf niet blokkeren (Karen ziet het resultaat in communicatie). */
async function sendAutoMailV2(id,key){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const hasRealEmail=b.email&&b.email.indexOf('@cosmopolite.local')===-1;
  if(!hasRealEmail)return;
  const t=MAIL_SJABLONEN[key];if(!t)return;
  const vn=(b.naam||'').split(' ')[0];
  const v={voornaam:vn,naam:b.naam,volgnummer:b.volgnummer,aankomst:fmt(b.aankomst),vertrek:fmt(b.vertrek),personen:b.personen,bedrag:money(b.bedrag),ogm:b.ogm||'',from_name:'Camping Cosmopolite'};
  const fill=s=>String(s).replace(/\{\{(\w+)\}\}/g,(_,k)=>v[k]!=null?v[k]:'{{'+k+'}}');
  try{
    const {data:{session}}=await sb.auth.getSession();
    await fetch(SUPABASE_URL+'/functions/v1/send-mail',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({booking_id:id,onderwerp:fill(t.onderwerp),inhoud:fill(t.inhoud)}),
    });
  }catch(e){/* mail mislukt — weigeren gaat gewoon door */}
}
async function actWeigeren(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Aanvraag van '+b.naam+' weigeren en verwijderen?\n\nAls er een geldig e-mailadres bekend is, wordt automatisch een "volzet"-mail gestuurd.\n\nDit kan niet ongedaan gemaakt worden.'))return;
  await sendAutoMailV2(id,'volzet'); // vóór de cleanup/delete — de mail heeft de boeking nog nodig
  await _cleanupBookingRelated(id);
  const {error}=await sb.from('bookings').delete().eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  closeModal(); closeFiche(); toast('❌ Aanvraag geweigerd, mail verstuurd (indien e-mailadres bekend) en verwijderd');
  selectedId=null; await loadData();
}
async function actVerwijderBoeking(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const [{count:nGasten},{count:nPayments}]=await Promise.all([
    sb.from('gasten').select('id',{count:'exact',head:true}).eq('booking_id',id).neq('naam','__pending_guest_upload__'),
    sb.from('payments').select('id',{count:'exact',head:true}).eq('booking_id',id),
  ]);
  let msg='Boeking van '+b.naam+' volledig verwijderen?';
  const details=[];
  if(nGasten)details.push(nGasten+' gast'+(nGasten>1?'en':''));
  if(nPayments)details.push(nPayments+' betaling'+(nPayments>1?'en':''));
  if(details.length)msg+='\n\nDit verwijdert ook '+details.join(' en ')+' — dit kan niet ongedaan gemaakt worden.';
  if(nGasten>0)msg+='\n\n⚠️ Er staan gasten geregistreerd voor het reizigersregister. Overweeg te verplaatsen naar Vertrokken i.p.v. verwijderen als je die gegevens wil bewaren.';
  if(!confirm(msg))return;
  await _cleanupBookingRelated(id);
  const {error}=await sb.from('bookings').delete().eq('id',id);
  if(error){toast('⚠️ Verwijderen mislukt: '+error.message);return;}
  closeModal(); closeFiche(); toast('🗑 Boeking verwijderd');
  selectedId=null; await loadData();
}
async function doMoveToFolder(id,target){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(folderOf(b)===target){closeModal();return;}
  const upd={};
  if(target==='postvak'){upd.status='aanvraag';upd.ingecheckt_at=null;upd.uitgecheckt_at=null;}
  else if(target==='booking'){upd.status='bevestigd';upd.ingecheckt_at=null;upd.uitgecheckt_at=null;}
  else if(target==='aanwezig'){upd.status='ingecheckt';upd.ingecheckt_at=b.ingecheckt_at||new Date().toISOString();upd.uitgecheckt_at=null;}
  else if(target==='vertrokken'){upd.uitgecheckt_at=new Date().toISOString();}
  const {error}=await sb.from('bookings').update(upd).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  closeModal();
  toast('↔ Verplaatst naar '+FOLDER_LABEL[target]);
  await loadData();
  if(bookings.find(x=>x.id===id)){selectedId=id;openReal(id);}
}

/* ---------- acties (schrijven echte data) ---------- */
async function actBevestig(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Reservering van '+b.naam+' bevestigen?\n\nStatus wordt "bevestigd" en de fiche verhuist naar Booking.'))return;
  const {error}=await sb.from('bookings').update({status:'bevestigd',ai_draft:false}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('✅ Bevestigd → Booking'); await loadData();
}
async function actInchecken(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Gasten van '+b.naam+' inchecken?\n\nDe fiche verhuist naar Aanwezig.'))return;
  const {error}=await sb.from('bookings').update({status:'ingecheckt',ingecheckt_at:new Date().toISOString(),uitgecheckt_at:null}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('🏕️ Ingecheckt → Aanwezig'); await loadData();
}
async function actUitchecken(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Gasten van '+b.naam+' uitchecken?\n\nDe fiche verhuist naar Vertrokken.'))return;
  const {error}=await sb.from('bookings').update({uitgecheckt_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('👋 Uitgecheckt → Vertrokken'); await loadData();
}
async function actBetaling(id,methode){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const open=openOf(b);
  const methLbl={cash:'Cash',overschrijving:'Overschrijving',qr:'QR-betaling'}[methode]||methode;
  const inp=prompt(methLbl+' registreren voor '+b.naam+'\n\nBedrag (€):', open>0?String(open):'');
  if(inp===null)return;
  const bedrag=Math.round(parseFloat(String(inp).replace(',','.'))*100)/100;
  if(!(bedrag>0)){toast('⚠️ Ongeldig bedrag');return;}
  const {error}=await sb.from('payments').insert({booking_id:id,bedrag:bedrag,status:'paid',methode:methode});
  if(error){toast('⚠️ '+error.message);return;}
  const nieuwBetaald=(paidByBooking[id]||0)+bedrag;
  if(nieuwBetaald>=Number(b.bedrag||0)-0.005 && b.status!=='ingecheckt'){
    await sb.from('bookings').update({status:'betaald'}).eq('id',id);
  }
  toast('💰 '+money(bedrag)+' geregistreerd'); await loadData();
}
async function actTerugbetaling(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const betaald=paidByBooking[id]||0;
  const inp=prompt('Terugbetaling registreren voor '+b.naam+'\n\nBedrag (€) dat je terugbetaalt:', betaald>0?String(betaald):'');
  if(inp===null)return;
  const bedrag=Math.round(parseFloat(String(inp).replace(',','.'))*100)/100;
  if(!(bedrag>0)){toast('⚠️ Ongeldig bedrag');return;}
  // negatieve betaalregel met methode 'terugbetaling'
  const {error}=await sb.from('payments').insert({booking_id:id,bedrag:-bedrag,status:'paid',methode:'terugbetaling'});
  if(error){toast('⚠️ '+error.message);return;}
  toast('↩️ Terugbetaling '+money(bedrag)+' geregistreerd'); await loadData();
}

/* ---------- rechtsboven in de fiche: extra dagen / extra geld (punt 10) ---------- */
function addDaysToDate(dateStr,n){
  const d=new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
async function actExtraDagen(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const huidigeNachten=Math.max(nights(b.aankomst,b.vertrek),1);
  const perDag=Number(b.bedrag||0)/huidigeNachten;
  const inp=prompt('Extra dagen inplannen voor '+b.naam+'.\n\nHuidige prijs/dag: '+money(perDag)+'. Hoeveel dagen wil je erbij plannen? Vertrekdatum en totaalbedrag worden automatisch aangepast.','1');
  if(inp===null)return;
  const extraDagen=parseInt(inp,10);
  if(!(extraDagen>0)){toast('⚠️ Geef een positief aantal dagen op');return;}
  const nieuweVertrek=addDaysToDate(b.vertrek,extraDagen);
  const nieuwBedrag=Math.round(perDag*(huidigeNachten+extraDagen)*100)/100;
  if(!confirm(extraDagen+' extra dag'+(extraDagen>1?'en':'')+' inplannen voor '+b.naam+'?\n\nNieuwe vertrekdatum: '+fmt(nieuweVertrek)+'\nNieuw totaalbedrag: '+money(nieuwBedrag)+' (was '+money(b.bedrag)+')'))return;
  const {error}=await sb.from('bookings').update({vertrek:nieuweVertrek,bedrag_totaal:nieuwBedrag}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('📅 '+extraDagen+' extra dag'+(extraDagen>1?'en':'')+' ingepland — nieuw totaal '+money(nieuwBedrag));
  await loadData();
}
async function actExtraGeld(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const inp=prompt('Extra bedrag toevoegen aan de rekening van '+b.naam+' (€) — bv. voor kleine extra kosten:','');
  if(inp===null)return;
  const bedrag=Math.round(parseFloat(String(inp).replace(',','.'))*100)/100;
  if(!(bedrag>0)){toast('⚠️ Ongeldig bedrag');return;}
  const omsch=(prompt('Omschrijving (optioneel) — bv. "kapotte tafel":','')||'').trim();
  const nieuwBedrag=Math.round((Number(b.bedrag||0)+bedrag)*100)/100;
  if(!confirm(money(bedrag)+' toevoegen aan het totaal'+(omsch?' ('+omsch+')':'')+'?\n\nNieuw totaal: '+money(nieuwBedrag)+'\n\n⚠️ Let op: als je nadien "Gegevens bewerken" gebruikt, wordt het bedrag daar volledig herberekend — deze toevoeging telt dan niet meer mee.'))return;
  // Genoteerd in Opmerking, want het bedrag zelf is hier bewust een simpele
  // optelling (geen apart kostenpost-archief) — zo blijft er toch een spoor
  // van waar het verschil vandaan komt.
  const regel='💶 +'+money(bedrag)+(omsch?' — '+omsch:'')+' ('+fmtDateLong(TODAY)+')';
  const nieuweNota=b.nota?(b.nota+'\n'+regel):regel;
  const {error}=await sb.from('bookings').update({bedrag_totaal:nieuwBedrag,nota:nieuweNota}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('💶 '+money(bedrag)+' toegevoegd — nieuw totaal '+money(nieuwBedrag));
  await loadData();
}

/* ---------- modal ---------- */
function openModal(title,html){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('modal').classList.add('on');
}
function closeModal(){document.getElementById('modal').classList.remove('on');document.getElementById('modalBody').innerHTML='';}

/* ---------- gegevens bewerken — zelfde modal-stijl als "Nieuwe reservering" ----------
   Punt 11: Bryan wil hetzelfde scherm als bij het aanmaken (steppers voor
   tent/camper/eigen types/personen/honden/auto's/elektriciteit), niet de
   vorige inline-bewerking in het tabblad zelf. ID-foto's blijven bewust
   in het Gasten-tabblad (daar staan de al gekoppelde ID's met foto) —
   dit scherm dupliceert dat niet. Herprijst automatisch bij elke
   wijziging, net als voorheen. */
let egState=null;
async function editGegevens(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  await loadPrices();
  egState={tent:b.tenten||0,camper:b.campers||0,volw:b.volwassenen||0,kind:b.kinderen||0,baby:b.baby||0,honden:b.honden||0,autos:b.autos||1,elek:!!b.elektriciteit,custom:{}};
  accTypes.forEach(t=>{egState.custom[t.id]=0;});
  (b.extraTypeUnits||[]).forEach(u=>{if(egState.custom[u.id]!=null)egState.custom[u.id]=u.count||0;});
  const priceSub={
    tent:'€'+PRICES.tent+'/nacht', camper:'€'+PRICES.camper+'/nacht',
    volw:'€'+PRICES.volwassene+'/nacht + €'+PRICES.toeristentaks+' taks',
    kind:'€'+PRICES.kind+'/nacht',
    baby:PRICES.baby>0?('€'+PRICES.baby+'/nacht'):'gratis',
    honden:'€'+PRICES.hond+'/hond/nacht',
    autos:'1e gratis, +€'+PRICES.extraAuto+'/extra/nacht',
  };
  const step=(lbl,key)=>'<div class="stpr"><span class="sl">'+lbl+' <span style="opacity:.6;font-size:11px;font-weight:400;">'+(priceSub[key]||'')+'</span></span><div class="ct"><button type="button" onclick="egStep(\''+key+'\',-1)">−</button><span class="val" id="eg_'+key+'">'+egState[key]+'</span><button type="button" onclick="egStep(\''+key+'\',1)">+</button></div></div>';
  const customStep=(t)=>'<div class="stpr"><span class="sl">'+esc(t.emoji||'🏕️')+' '+esc(t.naam)+' <span style="opacity:.6;font-size:11px;font-weight:400;">€'+(t.prijs||0)+'/nacht</span></span><div class="ct"><button type="button" onclick="egCustomStep(\''+t.id+'\',-1)">−</button><span class="val" id="eg_custom_'+t.id+'">'+(egState.custom[t.id]||0)+'</span><button type="button" onclick="egCustomStep(\''+t.id+'\',1)">+</button></div></div>';
  openModal('Boeking bewerken',
    '<div class="fld"><label>Naam *</label><input id="eNaam" value="'+esc(b.naam)+'"></div>'+
    '<div class="fld2"><div class="fld"><label>E-mail</label><input id="eEmail" type="email" value="'+esc(b.email)+'"></div>'+
    '<div class="fld"><label>Telefoon</label><input id="eTel" type="tel" value="'+esc(b.telefoon)+'"></div></div>'+
    '<div class="fld"><label>Nummerplaat</label><input id="ePlaat" value="'+esc(b.plaat)+'"></div>'+
    '<div class="fld2"><div class="fld"><label>Aankomst *</label><input id="eAan" type="date" value="'+esc(b.aankomst)+'" onchange="egPrice()"></div>'+
    '<div class="fld"><label>Vertrek *</label><input id="eVer" type="date" value="'+esc(b.vertrek)+'" onchange="egPrice()"></div></div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Verblijf</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('⛺ Tenten','tent')+step('🚐 Campers','camper')+accTypes.map(customStep).join('')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Personen</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🧑 Volwassenen','volw')+step('🧒 Kinderen 3–11','kind')+step('👶 Baby\'s <3','baby')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Extra</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🐕 Honden','honden')+step('🚗 Auto\'s','autos')+
    '<div class="toggle-row"><span class="sl">⚡ Elektriciteit <span style="opacity:.6;font-size:11px;font-weight:400;">+€'+PRICES.elektriciteit+'/nacht</span></span><input type="checkbox" id="eElek" '+(egState.elek?'checked':'')+' onchange="egState.elek=this.checked;egPrice()"></div></div>'+
    '<div class="fld"><label>Opmerking</label><input id="eNota" value="'+esc(b.nota)+'"></div>'+
    '<div class="card" id="egBreakdown" style="margin:6px 0 4px;"></div>'+
    '<div class="fld"><label>Bedrag (€) — automatisch herberekend</label><input id="eBedrag" type="number" value="'+esc(b.bedrag)+'"></div>'+
    '<div id="egMsg" class="note-inline" style="min-height:14px;"></div>'+
    '<button class="modal-save" id="egSaveBtn" onclick="saveGegevens(\''+id+'\')">✓ Opslaan</button>');
  egPrice();
}
function egStep(key,delta){
  egState[key]=Math.max(key==='autos'?1:0,(egState[key]||0)+delta);
  const el=document.getElementById('eg_'+key); if(el)el.textContent=egState[key];
  egPrice();
}
function egCustomStep(id,delta){
  egState.custom[id]=Math.max(0,(egState.custom[id]||0)+delta);
  const el=document.getElementById('eg_custom_'+id); if(el)el.textContent=egState.custom[id];
  egPrice();
}
function egPrice(){
  const el=document.getElementById('egBreakdown'); if(!el||!egState)return;
  const aan=document.getElementById('eAan').value, ver=document.getElementById('eVer').value;
  if(!window.CampingPricing||!aan||!ver||aan>=ver){el.innerHTML='<div class="note-inline" style="padding:12px;">Vul geldige data in om te herprijzen</div>';return;}
  const units=[{prijs:PRICES.tent,count:egState.tent,allIn:false},{prijs:PRICES.camper,count:egState.camper,allIn:false}];
  accTypes.forEach(t=>{const c=egState.custom[t.id]||0; if(c>0)units.push({prijs:t.prijs||0,count:c,allIn:!!t.allIn});});
  const r=CampingPricing.calc({prices:PRICES,units,volwassenen:egState.volw,kinderen:egState.kind,baby:egState.baby,honden:egState.honden,autos:egState.autos,elektriciteit:egState.elek,aankomst:aan,vertrek:ver});
  el.innerHTML='<div class="row" style="background:var(--green-soft);"><span class="rl" style="color:var(--green);font-weight:700;">Herberekend totaal ('+(r.nights||0)+' nacht'+(r.nights===1?'':'en')+')</span><span class="rv" style="color:var(--green);font-weight:800;">'+money(r.totaal)+'</span></div>';
  const bEl=document.getElementById('eBedrag'); if(bEl)bEl.value=Number(r.totaal||0).toFixed(2);
}
async function saveGegevens(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const g=x=>document.getElementById(x);
  const msg=document.getElementById('egMsg');
  const btn=document.getElementById('egSaveBtn');
  const aan=g('eAan').value, ver=g('eVer').value;
  if(!(g('eNaam').value||'').trim()){msg.style.color='var(--red)';msg.textContent='Naam is verplicht';return;}
  if(aan&&ver&&aan>=ver){msg.style.color='var(--red)';msg.textContent='Vertrek moet na aankomst zijn';return;}
  if(btn){btn.disabled=true;btn.textContent='Opslaan…';}
  try{
    const parts=[];
    if(egState.tent>0)parts.push(egState.tent+'× Tent');
    if(egState.camper>0)parts.push(egState.camper+'× Camper');
    const extraTypeUnits=accTypes.filter(t=>(egState.custom[t.id]||0)>0).map(t=>({...t,count:egState.custom[t.id]}));
    extraTypeUnits.forEach(t=>parts.push(t.count+'× '+t.naam));
    const cErr=(await sb.from('clients').update({
      naam:(g('eNaam').value||'').trim()||b.naam,
      email:(g('eEmail').value||'').trim()||null,
      telefoon:(g('eTel').value||'').trim()||null,
      nummerplaten:(g('ePlaat').value||'').trim()||null,
    }).eq('id',b.clientId||(await clientIdOf(id)))).error;
    const bErr=(await sb.from('bookings').update({
      aankomst:aan||b.aankomst, vertrek:ver||b.vertrek,
      tenten:egState.tent, campers:egState.camper, verblijfstype:parts.join(' + ')||'Tent',
      extra_type_units:extraTypeUnits.length?JSON.stringify(extraTypeUnits):null,
      volwassenen:egState.volw, kinderen:egState.kind, baby:egState.baby,
      honden:egState.honden, autos:egState.autos, elektriciteit:egState.elek,
      bedrag_totaal:parseFloat(g('eBedrag').value)||0, nota:(g('eNota').value||'').trim()||null,
    }).eq('id',id)).error;
    if(cErr||bErr)throw new Error((cErr||bErr).message);
    closeModal(); toast('✅ Opgeslagen'); await loadData();
  }catch(e){
    msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;
    if(btn){btn.disabled=false;btn.textContent='✓ Opslaan';}
  }
}
async function clientIdOf(bookingId){
  const {data}=await sb.from('bookings').select('client_id').eq('id',bookingId).single();
  return data?data.client_id:null;
}

/* ---------- nieuwe reservering (+ knop) — met centrale prijsengine ---------- */
let PRICES = (window.CampingPricing?Object.assign({},CampingPricing.DEFAULTS):{});
let accTypes=[], extraTarieven=[];
let nbState = {volw:2,kind:0,baby:0,tent:0,camper:1,honden:0,autos:1,elek:false,custom:{}};
let nbIdFotos = []; // [{file, naam, geboortedatum, nationaliteit, id_nummer}]
async function loadPrices(){
  try{
    // club_settings i.p.v. per-gebruiker settings — één gedeelde bron voor
    // tarieven, zodat wijzigingen in Beheer overal meteen doorwerken
    // (Nieuwe reservering, het publieke formulier, en tussen medewerkers
    // onderling) i.p.v. willekeurig af te hangen van wie het laatst bewaarde.
    const {data}=await sb.from('club_settings').select('key,value')
      .in('key',['prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby','prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6','toeristentaks','accommodatie_types','extra_tarieven']);
    const pm={};(data||[]).forEach(s=>pm[s.key]=s.value);
    const map={prijs_tent:'tent',prijs_camper:'camper',prijs_volwassene:'volwassene',prijs_kind:'kind',prijs_baby:'baby',prijs_hond:'hond',prijs_extra_auto:'extraAuto',prijs_elektriciteit:'elektriciteit',prijs_afval_per_6:'afvalPer6',toeristentaks:'toeristentaks'};
    Object.keys(map).forEach(k=>{if(pm[k]!=null)PRICES[map[k]]=parseFloat(pm[k])||PRICES[map[k]];});
    try{accTypes=JSON.parse(pm.accommodatie_types||'[]')||[];}catch(e){accTypes=[];}
    try{extraTarieven=JSON.parse(pm.extra_tarieven||'[]')||[];}catch(e){extraTarieven=[];}
  }catch(e){}
}
/* ---------- concepten ("+" nieuwe reservering zonder wifi) ----------
   Punt 8+vervolg: een boeking aanmaken mag niet verloren gaan als de wifi/
   data wegvalt. Meerdere concepten tegelijk (bv. 3-4 gasten die je zonder
   wifi inschrijft) worden bewaard in IndexedDB — inclusief de ID-foto's
   zelf (Files), in tegenstelling tot de vorige localStorage-versie die
   enkel tekstvelden en maar 1 concept tegelijk aankon. Elk concept krijgt
   een eigen id; "Nieuwe reservering" start altijd vers, tenzij je een
   concept uit de lijst (📝-melding/badge) expliciet opent om verder te
   werken. */
const DRAFTS_DB='cc_drafts_db', DRAFTS_STORE='drafts';
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DRAFTS_DB,1);
    req.onupgradeneeded=()=>{ req.result.createObjectStore(DRAFTS_STORE,{keyPath:'id'}); };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function idbPutDraft(record){
  try{
    const db=await idbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DRAFTS_STORE,'readwrite');
      tx.objectStore(DRAFTS_STORE).put(record);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }catch(e){/* IndexedDB kan uitzonderlijk falen (privé-modus) — concept-opslag is een extra, geen vereiste */}
}
async function idbDeleteDraft(id){
  try{
    const db=await idbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DRAFTS_STORE,'readwrite');
      tx.objectStore(DRAFTS_STORE).delete(id);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  }catch(e){}
}
async function idbGetDraft(id){
  try{
    const db=await idbOpen();
    return await new Promise((resolve,reject)=>{
      const req=db.transaction(DRAFTS_STORE,'readonly').objectStore(DRAFTS_STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error);
    });
  }catch(e){return null;}
}
async function idbGetAllDrafts(){
  try{
    const db=await idbOpen();
    return await new Promise((resolve,reject)=>{
      const req=db.transaction(DRAFTS_STORE,'readonly').objectStore(DRAFTS_STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    });
  }catch(e){return [];}
}
let currentDraftId=null;
function nbDraftHasContent(){
  if((document.getElementById('nbNaam')?.value||'').trim())return true;
  const s=nbState||{};
  if((s.tent||0)>0||(s.camper||0)!==1||(s.volw||0)!==2||(s.kind||0)>0||(s.baby||0)>0||(s.honden||0)>0)return true;
  if(s.custom&&Object.values(s.custom).some(c=>c>0))return true;
  if(nbIdFotos.length>0)return true;
  return false;
}
async function nbSaveDraft(){
  if(!nbDraftHasContent())return;
  if(!currentDraftId)currentDraftId='draft_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  await idbPutDraft({
    id:currentDraftId,
    naam:document.getElementById('nbNaam')?.value||'',
    email:document.getElementById('nbEmail')?.value||'',
    plaat:document.getElementById('nbPlaat')?.value||'',
    aan:document.getElementById('nbAan')?.value||'',
    ver:document.getElementById('nbVer')?.value||'',
    bron:document.getElementById('nbBron')?.value||'telefoon',
    state:JSON.parse(JSON.stringify(nbState)),
    idFotos:nbIdFotos.map(g=>({file:g.file,naam:g.naam,geboortedatum:g.geboortedatum,nationaliteit:g.nationaliteit,id_nummer:g.id_nummer})),
    savedAt:new Date().toISOString(),
  });
  updateDraftsUI();
}
async function updateDraftsUI(){
  const drafts=await idbGetAllDrafts();
  const n=drafts.length;
  const box=document.getElementById('draftsAlertBox');
  if(box)box.innerHTML=n?('<div class="alert" onclick="openDraftsList()"><div class="ai">📝</div><div class="at"><div class="a1">'+n+' concept'+(n===1?'':'en')+' nog niet verstuurd</div><div class="a2">Klaar om af te werken</div></div><div class="ar">›</div></div>'):'';
  ['plusBadge','plusBadgeRail'].forEach(bid=>{
    const b=document.getElementById(bid); if(!b)return;
    if(n){b.textContent=n;b.style.display='flex';} else {b.style.display='none';}
  });
}
async function openDraftsList(){
  const drafts=(await idbGetAllDrafts()).sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
  if(!drafts.length){toast('Geen openstaande concepten');return;}
  const rows=drafts.map(d=>{
    const naam=(d.naam||'').trim()?esc(d.naam):'Naamloos concept';
    const nFotos=(d.idFotos||[]).length;
    const when=new Date(d.savedAt).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return '<div class="card" style="padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">'+
      '<div style="flex:1;min-width:0;">'+
      '<div style="font-weight:700;font-size:13.5px;">'+naam+'</div>'+
      '<div style="font-size:11px;color:var(--ink-3);">'+when+(nFotos?' · '+nFotos+' ID-foto'+(nFotos===1?'':'\'s'):'')+'</div>'+
      '</div>'+
      '<button class="sbtn" style="flex:0 0 auto;" onclick="closeModal();openNewBooking(\''+d.id+'\')">Verderwerken</button>'+
      '<button onclick="deleteDraftPrompt(\''+d.id+'\')" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;width:32px;height:32px;flex-shrink:0;cursor:pointer;">🗑</button>'+
      '</div>';
  }).join('');
  openModal('📝 Concepten ('+drafts.length+')',rows);
}
async function deleteDraftPrompt(id){
  if(!confirm('Dit concept verwijderen? Dit kan niet ongedaan gemaakt worden.'))return;
  await idbDeleteDraft(id);
  await updateDraftsUI();
  openDraftsList();
}
async function openNewBooking(resumeId){
  await loadPrices();
  const draft=resumeId?await idbGetDraft(resumeId):null;
  currentDraftId=resumeId||('draft_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  nbState=draft?Object.assign({volw:2,kind:0,baby:0,tent:0,camper:1,honden:0,autos:1,elek:false,custom:{}},draft.state):{volw:2,kind:0,baby:0,tent:0,camper:1,honden:0,autos:1,elek:false,custom:{}};
  nbIdFotos=(draft&&draft.idFotos)?draft.idFotos.map(g=>({file:g.file,previewUrl:g.file?URL.createObjectURL(g.file):'',naam:g.naam||'',geboortedatum:g.geboortedatum||'',nationaliteit:g.nationaliteit||'',id_nummer:g.id_nummer||''})):[];
  accTypes.forEach(t=>{if(nbState.custom[t.id]==null)nbState.custom[t.id]=0;});
  const today=TODAY;
  // Prijs meteen zichtbaar naast elk veld — zelfde formaat als het oude
  // "Nieuwe boeking"-formulier, zodat je bij het aanmaken al ziet wat elk
  // stukje kost, niet enkel het totaal onderaan.
  const priceSub={
    tent:'€'+PRICES.tent+'/nacht', camper:'€'+PRICES.camper+'/nacht',
    volw:'€'+PRICES.volwassene+'/nacht + €'+PRICES.toeristentaks+' taks',
    kind:'€'+PRICES.kind+'/nacht',
    baby:PRICES.baby>0?('€'+PRICES.baby+'/nacht'):'gratis',
    honden:'€'+PRICES.hond+'/hond/nacht',
    autos:'1e gratis, +€'+PRICES.extraAuto+'/extra/nacht',
  };
  const step=(lbl,key)=>'<div class="stpr"><span class="sl">'+lbl+' <span style="opacity:.6;font-size:11px;font-weight:400;">'+(priceSub[key]||'')+'</span></span><div class="ct"><button onclick="nbStep(\''+key+'\',-1)">−</button><span class="val" id="nb_'+key+'">'+nbState[key]+'</span><button onclick="nbStep(\''+key+'\',1)">+</button></div></div>';
  const customStep=(t)=>'<div class="stpr"><span class="sl">'+esc(t.emoji||'🏕️')+' '+esc(t.naam)+' <span style="opacity:.6;font-size:11px;font-weight:400;">€'+(t.prijs||0)+'/nacht</span></span><div class="ct"><button onclick="nbCustomStep(\''+t.id+'\',-1)">−</button><span class="val" id="nb_custom_'+t.id+'">'+(nbState.custom[t.id]||0)+'</span><button onclick="nbCustomStep(\''+t.id+'\',1)">+</button></div></div>';
  openModal('Nieuwe reservering',
    (draft?'<div class="note-inline" style="color:var(--amber);padding:0 0 8px;">📝 Concept hersteld van '+new Date(draft.savedAt).toLocaleString('nl-BE')+(nbIdFotos.length?' — inclusief '+nbIdFotos.length+' ID-foto'+(nbIdFotos.length===1?'':'\'s'):'')+'.</div>':'')+
    '<div class="fld"><label>Naam *</label><input id="nbNaam" placeholder="Volledige naam" value="'+esc(draft?draft.naam:'')+'" oninput="nbPrice();nbSaveDraft();"></div>'+
    '<div class="fld2"><div class="fld"><label>E-mail</label><input id="nbEmail" type="email" placeholder="gast@email.com" value="'+esc(draft?draft.email:'')+'" oninput="nbSaveDraft()"></div>'+
    '<div class="fld"><label>Nummerplaat</label><input id="nbPlaat" placeholder="1-ABC-123" value="'+esc(draft?draft.plaat:'')+'" oninput="nbSaveDraft()"></div></div>'+
    '<div class="fld2"><div class="fld"><label>Aankomst *</label><input id="nbAan" type="date" value="'+(draft&&draft.aan?draft.aan:today)+'" onchange="nbPrice();nbSaveDraft();"></div>'+
    '<div class="fld"><label>Vertrek *</label><input id="nbVer" type="date" value="'+(draft?draft.ver:'')+'" onchange="nbPrice();nbSaveDraft();"></div></div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Verblijf</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('⛺ Tenten','tent')+step('🚐 Campers','camper')+accTypes.map(customStep).join('')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Personen</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🧑 Volwassenen','volw')+step('🧒 Kinderen 3–11','kind')+step('👶 Baby'+"'"+'s <3','baby')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Extra</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🐕 Honden','honden')+step('🚗 Auto'+"'"+'s','autos')+
    '<div class="toggle-row"><span class="sl">⚡ Elektriciteit <span style="opacity:.6;font-size:11px;font-weight:400;">+€'+PRICES.elektriciteit+'/nacht</span></span><input type="checkbox" id="nbElek" '+(nbState.elek?'checked':'')+' onchange="nbState.elek=this.checked;nbPrice();nbSaveDraft();"></div></div>'+
    '<div class="fld"><label>Via kanaal</label><select id="nbBron" onchange="nbSaveDraft()">'+
    ['telefoon','mail','website'].map(k=>'<option value="'+k+'" '+((draft?draft.bron:'telefoon')===k?'selected':'')+'>'+({telefoon:'☎️ Telefoon',mail:'📧 E-mail',website:'🌐 Website'}[k])+'</option>').join('')+
    '</select></div>'+
    '<div class="card" id="nbBreakdown" style="margin:6px 0 4px;"></div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);margin-top:8px;display:block;">ID-kaarten (optioneel)</label>'+
    '<div style="display:flex;gap:8px;margin:8px 0;">'+
    '<button type="button" class="scanbtn" style="margin:0;flex:1;" onclick="document.getElementById(\'nbCamInput\').click()">📷 Foto nemen</button>'+
    '<button type="button" class="scanbtn" style="margin:0;flex:1;background:var(--card-2);border-style:solid;border-color:var(--sep);color:var(--ink-2);" onclick="document.getElementById(\'nbFileInput\').click()">🖼️ Bestand kiezen</button>'+
    '</div>'+
    '<input type="file" id="nbCamInput" accept="image/*" capture="environment" style="display:none;" onchange="nbAddIdFoto(this)">'+
    '<input type="file" id="nbFileInput" accept="image/*" multiple style="display:none;" onchange="nbAddIdFoto(this)">'+
    '<div id="nbIdFotoList"></div>'+
    '<div id="nbMsg" class="note-inline" style="min-height:14px;"></div>'+
    '<button class="modal-save" id="nbSaveBtn" onclick="saveNewBooking()">Reservering opslaan → Booking</button>'+
    '<div class="note-inline" style="margin-top:6px;">📝 Wordt automatisch lokaal bewaard als concept — ook zonder wifi ga je niets kwijt.</div>');
  nbPrice(); renderNbIdFotoList();
}
function nbStep(key,delta){
  nbState[key]=Math.max(key==='autos'?1:0,(nbState[key]||0)+delta);
  const el=document.getElementById('nb_'+key); if(el)el.textContent=nbState[key];
  nbPrice(); nbSaveDraft();
}
function nbCustomStep(id,delta){
  nbState.custom[id]=Math.max(0,(nbState.custom[id]||0)+delta);
  const el=document.getElementById('nb_custom_'+id); if(el)el.textContent=nbState.custom[id];
  nbPrice(); nbSaveDraft();
}
function nbCalc(){
  const aan=document.getElementById('nbAan').value, ver=document.getElementById('nbVer').value;
  if(!window.CampingPricing) return {totaal:0, nights:0};
  const units=[{prijs:PRICES.tent,count:nbState.tent,allIn:false},{prijs:PRICES.camper,count:nbState.camper,allIn:false}];
  accTypes.forEach(t=>{const c=nbState.custom[t.id]||0; if(c>0)units.push({prijs:t.prijs||0,count:c,allIn:!!t.allIn});});
  const r=CampingPricing.calc({
    prices:PRICES, units,
    volwassenen:nbState.volw, kinderen:nbState.kind, baby:nbState.baby,
    honden:nbState.honden, autos:nbState.autos, elektriciteit:nbState.elek,
    aankomst:aan, vertrek:ver,
  });
  return r;
}
function nbPrice(){
  const el=document.getElementById('nbBreakdown');
  const r=nbCalc();
  const nights=r.nights||0;
  if(!nights){el.innerHTML='<div class="note-inline" style="padding:14px;">Vul aankomst, vertrek en verblijf in</div>';return;}
  const perDag=(lbl,val)=>(val>0.005?'<div class="row"><span class="rl">'+lbl+' <span style="opacity:.6;font-size:10.5px;">/dag</span></span><span class="rv">€ '+Number(val).toFixed(2).replace('.',',')+'</span></div>':'');
  let h='';
  // Standplaats — apart per type als eigen types gekozen zijn, anders één regel.
  const gekozenTypes=accTypes.filter(t=>(nbState.custom[t.id]||0)>0);
  if(nbState.tent>0)h+=perDag('⛺ Tent × '+nbState.tent,PRICES.tent*nbState.tent);
  if(nbState.camper>0)h+=perDag('🚐 Camper × '+nbState.camper,PRICES.camper*nbState.camper);
  gekozenTypes.forEach(t=>{h+=perDag(esc(t.emoji||'🏕️')+' '+esc(t.naam)+' × '+nbState.custom[t.id],(t.prijs||0)*nbState.custom[t.id]);});
  h+=perDag('🧑 Personen ('+r.personen+'p)',r.persoonsKost);
  h+=perDag('🐕 Honden',r.hondKost);
  h+=perDag('🚗 Extra auto\'s',r.extraAutoKost);
  h+=perDag('♻️ Afval',r.afvalDag);
  h+=perDag('⚡ Elektriciteit',r.elekDag);
  h+=perDag('🏛️ Toeristentaks',r.taksPerNacht);
  h+='<div class="row" style="background:var(--card-2);"><span class="rl"><b>Subtotaal per dag</b></span><span class="rv"><b>€ '+Number(r.perNacht).toFixed(2).replace('.',',')+'</b></span></div>';
  h+='<div class="row"><span class="rl">× '+nights+' nacht'+(nights===1?'':'en')+'</span><span class="rv">€ '+Number(r.totaal).toFixed(2).replace('.',',')+'</span></div>';
  h+='<div class="row" style="background:var(--green-soft);"><span class="rl" style="color:var(--green);font-weight:800;">Totaal te betalen</span><span class="rv" style="color:var(--green);font-weight:800;">€ '+Number(r.totaal).toFixed(2).replace('.',',')+'</span></div>';
  const waarborgTotaal=gekozenTypes.reduce((s,t)=>s+(t.waarborgBedrag||0)*nbState.custom[t.id],0);
  if(waarborgTotaal>0)h+='<div class="row"><span class="rl" style="color:var(--amber);">🔒 Waarborg (apart, niet in totaal)</span><span class="rv" style="color:var(--amber);">€ '+waarborgTotaal.toFixed(2).replace('.',',')+'</span></div>';
  el.innerHTML=h;
}
/* ID-foto's toevoegen tijdens het aanmaken — zelfde AI-scan als bij een
   bestaande boeking, plus een garantie-fallback "bestand kiezen" voor
   toestellen/browsers waar de camera-knop niet native opent. */
async function nbAddIdFoto(input){
  const files=input.files;if(!files||!files.length)return;
  for(let i=0;i<files.length;i++){
    const file=files[i];
    const idx=nbIdFotos.length;
    // previewUrl: kleine voorbeeldweergave zodat meteen duidelijk is of de
    // foto scherp/leesbaar getrokken is, ongeacht of de AI-herkenning lukt.
    nbIdFotos.push({file,previewUrl:URL.createObjectURL(file),naam:'',geboortedatum:'',nationaliteit:'',id_nummer:''});
    renderNbIdFotoList();
    try{
      const b64=await _fileToB64(file);
      const {data:{session}}=await sb.auth.getSession();
      const res=await fetch(SUPABASE_URL+'/functions/v1/scan-id',{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({image_base64:b64,media_type:file.type||'image/jpeg'}),
      });
      const d=await res.json();
      if(!d.error){
        const naam=d.naam||[d.voornaam,d.achternaam].filter(Boolean).join(' ');
        nbIdFotos[idx].naam=naam||''; nbIdFotos[idx].geboortedatum=d.geboortedatum||'';
        nbIdFotos[idx].nationaliteit=d.nationaliteit||''; nbIdFotos[idx].id_nummer=d.documentnummer||'';
      }
    }catch(e){/* AI-herkenning mislukt — Karen vult hieronder gewoon manueel in */}
    renderNbIdFotoList();
  }
  input.value=''; nbSaveDraft();
}
function renderNbIdFotoList(){
  const el=document.getElementById('nbIdFotoList');if(!el)return;
  el.innerHTML=nbIdFotos.map((g,i)=>
    '<div class="card" style="padding:10px;margin-bottom:8px;display:flex;gap:8px;align-items:center;">'+
    (g.previewUrl?'<img src="'+g.previewUrl+'" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer;" onclick="window.open(\''+g.previewUrl+'\',\'_blank\')">':'<div class="thumb" style="flex-shrink:0;">🪪</div>')+
    '<div style="flex:1;min-width:0;">'+
    '<input value="'+esc(g.naam)+'" placeholder="Naam" oninput="nbIdFotos['+i+'].naam=this.value;nbSaveDraft();" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:12.5px;margin-bottom:5px;">'+
    '<div style="font-size:10.5px;color:var(--ink-3);">'+(g.geboortedatum?fmt(g.geboortedatum)+' · ':'')+(g.nationaliteit||'AI leest…')+'</div>'+
    '</div>'+
    '<button onclick="if(nbIdFotos['+i+'].previewUrl)URL.revokeObjectURL(nbIdFotos['+i+'].previewUrl);nbIdFotos.splice('+i+',1);renderNbIdFotoList();nbSaveDraft();" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;width:32px;height:32px;flex-shrink:0;cursor:pointer;">🗑</button>'+
    '</div>'
  ).join('');
}
async function saveNewBooking(){
  const naam=(document.getElementById('nbNaam').value||'').trim();
  const aan=document.getElementById('nbAan').value, ver=document.getElementById('nbVer').value;
  const msg=document.getElementById('nbMsg');
  const totalCustom=Object.values(nbState.custom).reduce((s,c)=>s+c,0);
  if(!naam){msg.style.color='var(--red)';msg.textContent='Naam is verplicht';return;}
  if(!aan||!ver){msg.style.color='var(--red)';msg.textContent='Aankomst en vertrek zijn verplicht';return;}
  if(aan>=ver){msg.style.color='var(--red)';msg.textContent='Vertrek moet na aankomst zijn';return;}
  if(nbState.tent+nbState.camper+totalCustom<1){msg.style.color='var(--red)';msg.textContent='Voeg minstens 1 verblijfseenheid toe';return;}
  if(nbState.volw+nbState.kind+nbState.baby<1){msg.style.color='var(--red)';msg.textContent='Minstens 1 persoon';return;}
  const btn=document.getElementById('nbSaveBtn'); btn.disabled=true; btn.textContent='Opslaan…';
  try{
    const r=nbCalc();
    const email=(document.getElementById('nbEmail').value||'').trim()||('geen-email+'+Date.now()+'@cosmopolite.local');
    const parts=[];
    if(nbState.tent>0)parts.push(nbState.tent+'× Tent');
    if(nbState.camper>0)parts.push(nbState.camper+'× Camper');
    const extraTypeUnits=accTypes.filter(t=>(nbState.custom[t.id]||0)>0).map(t=>({...t,count:nbState.custom[t.id]}));
    extraTypeUnits.forEach(t=>parts.push(t.count+'× '+t.naam));
    const {data:client,error:cErr}=await sb.from('clients').insert({naam,email,nummerplaten:(document.getElementById('nbPlaat').value||'').trim()||null}).select('id').single();
    if(cErr)throw new Error(cErr.message);
    const {data:booking,error:bErr}=await sb.from('bookings').insert({
      client_id:client.id, aankomst:aan, vertrek:ver,
      tenten:nbState.tent, campers:nbState.camper, verblijfstype:parts.join(' + ')||'Tent',
      extra_type_units:extraTypeUnits.length?JSON.stringify(extraTypeUnits):null,
      volwassenen:nbState.volw, kinderen:nbState.kind, baby:nbState.baby,
      honden:nbState.honden, autos:nbState.autos, elektriciteit:nbState.elek,
      bron:document.getElementById('nbBron').value, bedrag_totaal:Number(r.totaal||0), status:'bevestigd',
    }).select('id').single();
    if(bErr)throw new Error(bErr.message);
    // ID-foto's die tijdens het aanmaken werden toegevoegd, meteen koppelen.
    for(let i=0;i<nbIdFotos.length;i++){
      const g=nbIdFotos[i];
      try{
        const {data:gast,error:gErr}=await sb.from('gasten').insert({
          booking_id:booking.id, naam:g.naam||('Gast '+(i+1)),
          geboortedatum:g.geboortedatum||null, nationaliteit:g.nationaliteit||null,
          id_nummer:g.id_nummer||null, is_hoofdgast:i===0,
        }).select('id').single();
        if(gErr||!gast)continue;
        const ext=(g.file.name.split('.').pop()||'jpg').toLowerCase();
        const path=booking.id+'/'+gast.id+'.'+ext;
        const {error:upErr}=await sb.storage.from('id-fotos').upload(path,g.file,{upsert:true,contentType:g.file.type});
        if(!upErr)await sb.from('gasten').update({foto_url:path}).eq('id',gast.id);
      }catch(e){/* één mislukte foto mag de rest niet blokkeren */}
    }
    await idbDeleteDraft(currentDraftId); currentDraftId=null; updateDraftsUI();
    closeModal(); toast('✅ Reservering aangemaakt → Booking'+(nbIdFotos.length?' · '+nbIdFotos.length+' ID(\'s) gekoppeld':''));
    await loadData(); setFolder('booking');
  }catch(e){
    // Geen wifi/data op de camping is een reëel scenario — het concept blijft
    // hoe dan ook al bewaard (elke wijziging wordt live opgeslagen), maar
    // geef hier wel een duidelijker signaal dan de generieke foutmelding.
    const offline=(typeof navigator!=='undefined'&&navigator.onLine===false)||/failed to fetch|network/i.test(e.message||'');
    nbSaveDraft();
    if(offline){msg.style.color='var(--amber)';msg.textContent='📵 Geen internetverbinding — je concept is lokaal bewaard. Probeer opnieuw zodra je weer wifi/data hebt.';}
    else{msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;}
    btn.disabled=false;btn.textContent='Reservering opslaan → Booking';
  }
}

/* ============================================================================
 * FASE 3 — Kalender (maand/week/dag), Bezoekers, Beheer (admin)
 * ==========================================================================*/

/* ---------- kalender ---------- */
let calMode='maand', calAnchor=new Date();
function ymd(d){return d.toISOString().split('T')[0];}
function setCalView(m){
  calMode=m;
  document.querySelectorAll('#scr-kalender .foldertabs .ft').forEach(b=>b.classList.toggle('on',b.getAttribute('data-cal')===m));
  renderKalender();
}
function calShift(dir){
  const d=new Date(calAnchor);
  if(calMode==='maand')d.setMonth(d.getMonth()+dir);
  else if(calMode==='week')d.setDate(d.getDate()+dir*7);
  else d.setDate(d.getDate()+dir);
  calAnchor=d; renderKalender();
}
function calToday(){calAnchor=new Date();renderKalender();}
function bookingsOnDay(dateStr){
  return bookings.filter(b=>b.status!=='geannuleerd'&&b.aankomst<=dateStr&&b.vertrek>dateStr);
}
function renderKalender(){
  const wrap=document.getElementById('calWrap');
  const lbl=document.getElementById('calLabel');
  const MND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const DGN=['ma','di','wo','do','vr','za','zo'];
  if(calMode==='maand'){
    lbl.textContent=MND[calAnchor.getMonth()]+' '+calAnchor.getFullYear();
    const first=new Date(calAnchor.getFullYear(),calAnchor.getMonth(),1);
    const startOffset=(first.getDay()+6)%7; // maandag=0
    const daysInMonth=new Date(calAnchor.getFullYear(),calAnchor.getMonth()+1,0).getDate();
    let cells='';
    DGN.forEach(d=>cells+='<div style="text-align:center;font-size:10.5px;color:var(--ink-3);font-family:var(--f-mono);padding:4px 0;">'+d+'</div>');
    for(let i=0;i<startOffset;i++)cells+='<div></div>';
    for(let day=1;day<=daysInMonth;day++){
      const dateStr=calAnchor.getFullYear()+'-'+String(calAnchor.getMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      const cnt=bookingsOnDay(dateStr).length;
      const isToday=dateStr===TODAY;
      cells+='<div onclick="calOpenDay(\''+dateStr+'\')" style="aspect-ratio:1;border:1px solid var(--sep);border-radius:8px;padding:5px;cursor:pointer;background:'+(isToday?'var(--green-soft)':'var(--card)')+';display:flex;flex-direction:column;">'+
        '<span style="font-size:11px;font-weight:'+(isToday?'800':'600')+';color:'+(isToday?'var(--green)':'var(--ink)')+';">'+day+'</span>'+
        (cnt?'<span style="margin-top:auto;font-size:9.5px;background:var(--blue-soft);color:var(--blue);border-radius:5px;padding:1px 4px;text-align:center;">'+cnt+'</span>':'')+
        '</div>';
    }
    wrap.innerHTML='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">'+cells+'</div>';
  } else if(calMode==='week'){
    const day0=(calAnchor.getDay()+6)%7;
    const monday=new Date(calAnchor); monday.setDate(monday.getDate()-day0);
    const days=[]; for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(d.getDate()+i);days.push(d);}
    lbl.textContent=days[0].getDate()+' '+MND[days[0].getMonth()].slice(0,3)+' – '+days[6].getDate()+' '+MND[days[6].getMonth()].slice(0,3);
    wrap.innerHTML=days.map((d,i)=>{
      const ds=ymd(d);const cnt=bookingsOnDay(ds).length;const isToday=ds===TODAY;
      return '<div onclick="calOpenDay(\''+ds+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:'+(isToday?'var(--green-soft)':'var(--card)')+';border:1px solid var(--sep);border-radius:10px;margin-bottom:6px;cursor:pointer;">'+
        '<span style="font-size:13.5px;font-weight:'+(isToday?'800':'600')+';color:'+(isToday?'var(--green)':'var(--ink)')+';">'+DGN[i]+' '+d.getDate()+' '+MND[d.getMonth()].slice(0,3)+'</span>'+
        '<span class="pill p-in">'+cnt+' aanwezig</span></div>';
    }).join('');
  } else {
    const ds=ymd(calAnchor);
    lbl.textContent=calAnchor.getDate()+' '+MND[calAnchor.getMonth()]+' '+calAnchor.getFullYear();
    const list=bookingsOnDay(ds);
    const aank=bookings.filter(b=>b.aankomst===ds&&b.status!=='geannuleerd');
    const vert=bookings.filter(b=>b.vertrek===ds&&b.status!=='geannuleerd');
    let h='<div class="sec-lbl">🟢 Aankomst ('+aank.length+')</div>'+(aank.length?'<div class="card taskcard">'+aank.map(b=>rowHtml(b,esc(verblijf(b)),'')).join('')+'</div>':emptyCard('Geen'));
    h+='<div class="sec-lbl">🔴 Vertrek ('+vert.length+')</div>'+(vert.length?'<div class="card taskcard">'+vert.map(b=>rowHtml(b,esc(verblijf(b)),'')).join('')+'</div>':emptyCard('Geen'));
    h+='<div class="sec-lbl">🏕️ Aanwezig ('+list.length+')</div>'+(list.length?'<div class="card taskcard">'+list.map(b=>rowHtml(b,esc(verblijf(b)),'')).join('')+'</div>':emptyCard('Geen'));
    h+='<div class="sec-lbl">🅿️ Vrije plaatsen</div><div class="card taskcard"><div class="note-inline" style="padding:16px;">'+(maxPlaatsen>0?(Math.max(0,maxPlaatsen-list.length)+' van '+maxPlaatsen+' plaatsen vrij'):'Geen capaciteitslimiet ingesteld')+'</div></div>';
    wrap.innerHTML=h;
  }
}
function calOpenDay(dateStr){
  calMode='dag'; calAnchor=new Date(dateStr+'T00:00:00');
  document.querySelectorAll('#scr-kalender .foldertabs .ft').forEach(b=>b.classList.toggle('on',b.getAttribute('data-cal')==='dag'));
  renderKalender();
}

/* ---------- bezoekers (dagbezoek, los van overnachting) ---------- */
let _bzFotoData=null;
async function loadBezoekers(){
  const el=document.getElementById('bezList');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data,error}=await sb.from('bezoekers').select('*').is('uitgecheckt_at',null).order('ingecheckt_at',{ascending:false});
  const list=error?[]:(data||[]);
  document.getElementById('bezTitle').textContent='🧍 Bezoekers vandaag ('+list.length+')';
  if(!list.length){el.innerHTML=emptyCard('Geen bezoekers ingecheckt');return;}
  el.innerHTML='<div class="card taskcard">'+list.map(b=>{
    const t=new Date(b.ingecheckt_at);
    const tijd=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
    return '<div class="task"><div class="av" style="background:'+avColor(b.id)+';">'+initials(b.naam||'?')+'</div>'+
      '<div class="tb"><div class="tn">'+esc(b.naam||'Bezoeker')+'</div><div class="td">sinds '+tijd+(b.notitie?' · '+esc(b.notitie):'')+'</div></div>'+
      '<button class="sbtn" style="flex:0 0 auto;padding:7px 12px;" onclick="checkoutBezoeker(\''+b.id+'\')">Uitchecken</button></div>';
  }).join('')+'</div>';
}
function openBezoekerCheckin(){
  _bzFotoData=null;
  openModal('Bezoeker inchecken',
    '<div class="fld"><label>Naam</label><input id="bzNaam" placeholder="Naam (optioneel)"></div>'+
    '<div class="fld"><label>Notitie</label><input id="bzNotitie" placeholder="bv. dagbezoek, picknick…"></div>'+
    '<button class="modal-save" onclick="doCheckinBezoeker()">✅ Inchecken</button>');
}
async function doCheckinBezoeker(){
  const naam=(document.getElementById('bzNaam').value||'').trim()||null;
  const notitie=(document.getElementById('bzNotitie').value||'').trim()||null;
  const {data:{user}}=await sb.auth.getUser();
  const {error}=await sb.from('bezoekers').insert({naam,notitie,created_by:user?user.id:null});
  if(error){toast('⚠️ '+error.message);return;}
  closeModal(); toast('✅ '+(naam||'Bezoeker')+' ingecheckt'); loadBezoekers();
}
async function checkoutBezoeker(id){
  const {error}=await sb.from('bezoekers').update({uitgecheckt_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('⚠️ '+error.message);return;}
  toast('👋 Uitgecheckt'); loadBezoekers();
}

/* ---------- beheer (admin-only, RLS dekt dit ook server-side) ---------- */
let _beheerTab='tarieven';
function setBeheer(tab){
  if(currentRole!=='admin'){toast('⚠️ Enkel voor beheerders');return;}
  _beheerTab=tab;
  document.querySelectorAll('#scr-beheer .foldertabs .ft').forEach(b=>b.classList.toggle('on',b.getAttribute('data-beh')===tab));
  const fns={tarieven:renderBeheerTarieven,gebruikers:renderBeheerGebruikers,idarchief:renderBeheerIdArchief,register:renderBeheerRegister,analytics:renderBeheerAnalytics,mail:renderBeheerMail};
  (fns[tab]||renderBeheerTarieven)();
}
async function renderBeheerTarieven(){
  const el=document.getElementById('beheerBody');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  await loadPrices();
  const {data:mp}=await sb.from('club_settings').select('value').eq('key','max_plaatsen').limit(1);
  const maxP=(mp&&mp.length)?mp[0].value:'0';

  // grote prijs-kaart (tent/camper) — zelfde stijl als het oude systeem
  const bigCard=(id,val,emoji,lbl)=>'<div class="card" style="padding:14px 10px;text-align:center;">'+
    '<div style="font-size:26px;margin-bottom:5px;">'+emoji+'</div>'+
    '<div style="font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:8px;">'+lbl+'</div>'+
    '<div style="display:flex;align-items:center;justify-content:center;gap:3px;">'+
    '<span style="font-size:15px;color:var(--ink-3);">€</span>'+
    '<input id="'+id+'" type="number" min="0" step="0.5" value="'+val+'" style="width:56px;font-size:19px;font-weight:800;color:var(--green);border:none;background:transparent;text-align:center;outline:none;">'+
    '</div><div style="font-size:10px;color:var(--ink-3);margin-top:2px;">per nacht</div></div>';
  // kleine prijs-kaart (personen)
  const smallCard=(id,val,emoji,lbl)=>'<div class="card" style="padding:11px 6px;text-align:center;">'+
    '<div style="font-size:20px;margin-bottom:4px;">'+emoji+'</div>'+
    '<div style="font-size:10.5px;font-weight:600;color:var(--ink-2);margin-bottom:6px;">'+lbl+'</div>'+
    '<div style="display:flex;align-items:center;justify-content:center;gap:2px;">'+
    '<span style="font-size:12px;color:var(--ink-3);">€</span>'+
    '<input id="'+id+'" type="number" min="0" step="0.5" value="'+val+'" style="width:44px;font-size:17px;font-weight:800;color:var(--ink);border:none;background:transparent;text-align:center;outline:none;">'+
    '</div></div>';
  // icoon-rij (extra's / belastingen)
  const iconRow=(id,val,emoji,lbl,sub,warn)=>'<div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid '+(warn?'var(--amber-soft)':'var(--sep)')+';">'+
    '<span style="font-size:19px;margin-right:11px;">'+emoji+'</span>'+
    '<div style="flex:1;"><div style="font-size:12.5px;font-weight:600;color:var(--ink);">'+lbl+'</div>'+
    '<div style="font-size:10.5px;color:var(--ink-3);">'+sub+'</div></div>'+
    '<div style="display:flex;align-items:center;gap:3px;">'+
    '<span style="font-size:12px;color:var(--ink-3);">€</span>'+
    '<input id="'+id+'" type="number" min="0" step="0.1" value="'+val+'" style="width:52px;font-size:15px;font-weight:700;color:'+(warn?'var(--amber)':'var(--ink)')+';border:1.5px solid '+(warn?'var(--amber-soft)':'var(--sep)')+';border-radius:8px;padding:5px 6px;text-align:right;background:'+(warn?'var(--amber-soft)':'var(--card-2)')+';">'+
    '</div></div>';
  const secLbl=t=>'<div class="sec-lbl">'+t+'</div>';

  el.innerHTML=
    secLbl('🏕️ Verblijfstype /nacht')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">'+
    bigCard('bTent',PRICES.tent,'⛺','Tent')+bigCard('bCamper',PRICES.camper,'🚐','Camper / Caravan')+
    '</div>'+
    '<div id="accTypesList"></div>'+
    '<button class="sbtn" style="width:100%;margin-bottom:18px;border-style:dashed;border-color:var(--green);color:var(--green);" onclick="voegAccTypeToe()">➕ Eigen type toevoegen (bv. Safaritent)</button>'+

    secLbl('🧑 Personen /nacht')+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;">'+
    smallCard('bVolw',PRICES.volwassene,'🧑','Volwassene')+smallCard('bKind',PRICES.kind,'🧒','Kind 3–11j')+smallCard('bBaby',PRICES.baby,'👶','Baby <3j')+
    '</div>'+

    secLbl('➕ Extra\'s')+
    '<div class="card" style="overflow:hidden;margin-bottom:18px;">'+
    iconRow('bHond',PRICES.hond,'🐕','Hond','per hond per nacht')+
    iconRow('bAuto',PRICES.extraAuto,'🚗','Extra auto','1e auto gratis, elke volgende per nacht')+
    iconRow('bElek',PRICES.elektriciteit,'⚡','Elektriciteit','eenmalig per verblijf')+
    '</div>'+

    secLbl('🏛️ Belastingen &amp; bijdragen')+
    '<div class="card" style="overflow:hidden;margin-bottom:18px;">'+
    iconRow('bAfval',PRICES.afvalPer6,'♻️','Afvalbijdrage','stapgrootte — getrapt: 0-6p, 7-10p, 11-15p, 16-20p, +5p…',true)+
    iconRow('bTaks',PRICES.toeristentaks,'🏛️','Toeristentaks','per volwassene per nacht — BTW-vrij',true)+
    '</div>'+

    secLbl('🔢 Capaciteit')+
    '<div class="card" style="padding:14px;margin-bottom:18px;">'+
    '<div class="fld" style="margin-bottom:0;"><label>Max. boekingen per dag (0 = geen limiet) — elke boeking telt als 1, ongeacht aantal personen</label><input id="bMax" type="number" min="0" value="'+maxP+'"></div>'+
    '</div>'+

    secLbl('📦 Vrije kostenposten')+
    '<div id="extraTarList"></div>'+
    '<button class="sbtn" style="width:100%;margin-bottom:18px;" onclick="voegExtraTariefToe()">➕ Kostenpost toevoegen (bv. Waarborg)</button>'+

    '<button class="modal-save" onclick="saveBeheerTarieven()">💾 Tarieven opslaan</button>'+
    '<div id="tarMsg" class="note-inline"></div>';

  renderAccTypesList();
  renderExtraTarList();
}
/* Volledig open tariefplan: elk eigen type heeft niet enkel een prijs/nacht,
   maar ook een eigen max. aantal personen, waarborgbedrag en omschrijving —
   zelfde velden als de bestaande data, niets wordt meer stilzwijgend
   afgekapt bij het bewerken/opslaan. */
function renderAccTypesList(){
  const el=document.getElementById('accTypesList');if(!el)return;
  const fld=(lbl,html)=>'<div style="flex:1;min-width:90px;"><label style="font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px;">'+lbl+'</label>'+html+'</div>';
  const inp=(val,oninput,type,ph)=>'<input '+(type?'type="'+type+'"':'')+' value="'+esc(val)+'" placeholder="'+(ph||'')+'" oninput="'+oninput+'" style="width:100%;padding:8px 9px;border-radius:8px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;">';
  el.innerHTML=accTypes.length?accTypes.map((t,i)=>
    '<div class="card" style="padding:12px;margin-bottom:8px;">'+
    '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-end;">'+
    fld('Emoji',inp(t.emoji||'🏕️','accTypes['+i+'].emoji=this.value'))+
    '<div style="flex:3;min-width:120px;">'+fld('Naam',inp(t.naam||'','accTypes['+i+'].naam=this.value',null,'bv. Safaritent'))+'</div>'+
    '<button onclick="accTypes.splice('+i+',1);renderAccTypesList();" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;width:36px;height:36px;flex-shrink:0;cursor:pointer;">🗑</button>'+
    '</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">'+
    fld('Prijs/nacht (€)',inp(t.prijs||0,'accTypes['+i+'].prijs=parseFloat(this.value)||0','number'))+
    fld('Max. personen',inp(t.maxPersonen||0,'accTypes['+i+'].maxPersonen=parseInt(this.value)||0','number'))+
    fld('Waarborg (€)',inp(t.waarborgBedrag||0,'accTypes['+i+'].waarborgBedrag=parseFloat(this.value)||0','number'))+
    '</div>'+
    '<label style="font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px;">Omschrijving (optioneel)</label>'+
    inp(t.beschrijving||'','accTypes['+i+'].beschrijving=this.value',null,'bv. Inclusief afvalbijdrage')+
    '</div>'
  ).join(''):'<div class="note-inline" style="padding:6px 0;">Nog geen eigen types — standaard zijn Tent en Camper</div>';
}
function voegAccTypeToe(){accTypes.push({id:'custom_'+Date.now(),emoji:'🏕️',naam:'',prijs:0,maxPersonen:0,waarborgBedrag:0,allIn:false,beschrijving:''});renderAccTypesList();}
function renderExtraTarList(){
  const el=document.getElementById('extraTarList');if(!el)return;
  el.innerHTML=extraTarieven.length?extraTarieven.map((t,i)=>
    '<div class="card" style="padding:10px 12px;margin-bottom:8px;">'+
    '<div style="display:flex;gap:8px;margin-bottom:8px;">'+
    '<input value="'+esc(t.naam||'')+'" placeholder="Naam (bv. Waarborg)" oninput="extraTarieven['+i+'].naam=this.value" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;">'+
    '<input type="number" step="0.5" value="'+(t.prijs||0)+'" oninput="extraTarieven['+i+'].prijs=parseFloat(this.value)||0" style="width:64px;padding:8px;border-radius:8px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;">'+
    '<button onclick="extraTarieven.splice('+i+',1);renderExtraTarList();" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;width:34px;height:34px;cursor:pointer;">🗑</button></div>'+
    '<label style="font-size:11.5px;color:var(--ink-2);display:flex;align-items:center;gap:6px;"><input type="checkbox" '+(t.perNacht?'checked':'')+' onchange="extraTarieven['+i+'].perNacht=this.checked"> per nacht (anders eenmalig)</label>'+
    '</div>'
  ).join(''):'<div class="note-inline" style="padding:6px 0;">Nog geen extra kostenposten</div>';
}
function voegExtraTariefToe(){extraTarieven.push({naam:'',prijs:0,categorie:'extra',perNacht:false});renderExtraTarList();}
async function saveBeheerTarieven(){
  const msg=document.getElementById('tarMsg');
  msg.textContent='Opslaan…';msg.style.color='var(--ink-2)';
  try{
    const {data:{session}}=await sb.auth.getSession();
    const g=id=>document.getElementById(id).value;
    const pairs=[['prijs_tent',g('bTent')],['prijs_camper',g('bCamper')],['prijs_volwassene',g('bVolw')],
      ['prijs_kind',g('bKind')],['prijs_baby',g('bBaby')],['prijs_hond',g('bHond')],['prijs_extra_auto',g('bAuto')],
      ['prijs_elektriciteit',g('bElek')],['prijs_afval_per_6',g('bAfval')],['toeristentaks',g('bTaks')],['max_plaatsen',g('bMax')||'0'],
      ['accommodatie_types',JSON.stringify(accTypes.filter(t=>(t.naam||'').trim()))],
      ['extra_tarieven',JSON.stringify(extraTarieven.filter(t=>(t.naam||'').trim()))]];
    for(const [key,value] of pairs){
      await sb.from('club_settings').upsert({key,value:String(value),updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'key'});
    }
    msg.style.color='var(--green)';msg.textContent='✅ Opgeslagen — meteen zichtbaar bij Nieuwe reservering en op het publieke formulier'; maxPlaatsen=parseInt(g('bMax'))||0;
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;}
}

/* ---------- beheer: Gmail-koppeling ---------- */
const GOOGLE_CLIENT_ID='54730723430-j707rj00757gkh5f0hsfu9peh645tp32.apps.googleusercontent.com';
const GMAIL_SCOPES='https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
// Google OAuth staat enkel geregistreerd op de /dashboard/-URL van het oude
// systeem. Koppelen bounct daar even langs om te bevestigen, maar schrijft
// naar dezelfde integrations-tabel die beide systemen delen — direct
// daarna bruikbaar hier, geen tweede koppeling nodig.
function connectGmailV2(){
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri',window.location.origin+'/dashboard/');
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',GMAIL_SCOPES);
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('state','gmail_connect');
  window.location.href=url.toString();
}
async function renderBeheerMail(){
  const el=document.getElementById('beheerBody');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('integrations').select('email,updated_at').eq('provider','gmail').maybeSingle();
  let h='<div class="card" style="padding:16px;">';
  if(data){
    h+='<div class="row"><span class="rl">Gekoppeld account</span><span class="rv">'+esc(data.email)+'</span></div>';
    h+='<div class="row"><span class="rl">Laatste update</span><span class="rv">'+new Date(data.updated_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</span></div>';
    h+='<button class="sbtn" style="width:100%;margin-top:12px;" onclick="syncGmailV2()">🔄 Mails synchroniseren</button>';
    h+='<button class="sbtn" style="width:100%;margin-top:8px;color:var(--red);border-color:var(--red);" onclick="disconnectGmailV2()">Ontkoppelen</button>';
  } else {
    h+='<div class="note-inline" style="padding:0 0 12px;">Nog geen Gmail gekoppeld — nodig om mails te versturen en het Postvak automatisch te vullen.</div>';
    h+='<button class="modal-save" onclick="connectGmailV2()">📧 Gmail koppelen</button>';
    h+='<div class="note-inline">Je wordt eventjes naar het klassieke dashboard gestuurd om te bevestigen, daarna direct bruikbaar hier.</div>';
  }
  h+='<div id="gmailV2Msg" class="note-inline"></div></div>';
  el.innerHTML=h;
}
async function syncGmailV2(){
  const msg=document.getElementById('gmailV2Msg');
  msg.textContent='Bezig…';msg.style.color='var(--ink-2)';
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(SUPABASE_URL+'/functions/v1/gmail-sync',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token}});
    const d=await res.json();
    if(d.error)throw new Error(d.error);
    msg.style.color='var(--green)';msg.textContent='✅ '+(d.synced>0?d.synced+' nieuwe mail'+(d.synced===1?'':'s')+' gesynchroniseerd':'Alles up-to-date');
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;}
}
async function disconnectGmailV2(){
  if(!confirm('Gmail ontkoppelen?'))return;
  await sb.from('integrations').delete().eq('provider','gmail');
  toast('Gmail ontkoppeld'); renderBeheerMail();
}
async function renderBeheerGebruikers(){
  const el=document.getElementById('beheerBody');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('user_roles').select('user_id,role,created_at');
  let list='';
  if(data&&data.length){
    list='<div class="card">'+data.map(u=>'<div class="row"><span class="rl">'+u.user_id.slice(0,8)+'… · sinds '+new Date(u.created_at).toLocaleDateString('nl-BE')+'</span><span class="pill '+(u.role==='admin'?'p-pay':'p-conf')+'">'+(u.role==='admin'?'Beheerder':'Medewerker')+'</span></div>').join('')+'</div>';
  } else list=emptyCard('Nog geen extra gebruikers');
  el.innerHTML='<div class="card" style="padding:14px;">'+
    '<div class="fld"><label>E-mailadres</label><input id="invEmail" placeholder="collega@camping.be"></div>'+
    '<div class="fld"><label>Rol</label><select id="invRole"><option value="staff">Medewerker</option><option value="admin">Beheerder</option></select></div>'+
    '<button class="modal-save" onclick="sendInvite()">📨 Uitnodiging sturen</button>'+
    '<div id="invMsg" class="note-inline"></div></div>'+
    '<div class="sec-lbl">Huidige gebruikers</div>'+list;
}
async function sendInvite(){
  const email=(document.getElementById('invEmail').value||'').trim();
  const role=document.getElementById('invRole').value;
  const msg=document.getElementById('invMsg');
  if(!email){msg.style.color='var(--red)';msg.textContent='Vul een e-mailadres in';return;}
  msg.style.color='var(--ink-2)';msg.textContent='Versturen…';
  try{
    const {data:{session}}=await sb.auth.getSession();
    const res=await fetch(SUPABASE_URL+'/functions/v1/invite-user',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({email,role}),
    });
    const d=await res.json();
    if(d.error)throw new Error(d.error);
    msg.style.color='var(--green)';msg.textContent='✅ Uitnodiging verstuurd naar '+d.email;
    setTimeout(renderBeheerGebruikers,1200);
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;}
}
/* ID-archief: elk gescand document, gegroepeerd per boeking — zodat een
   opgevraagde ID altijd meteen toont bij welke reservering (naam, #, data)
   die hoort, in plaats van losse namen zonder context. */
async function renderBeheerIdArchief(){
  const el=document.getElementById('beheerBody');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('gasten').select('*').neq('naam','__pending_guest_upload__').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);
  const rows=data||[];
  const groups={};
  rows.forEach(g=>{
    const b=bookings.find(x=>x.id===g.booking_id);
    if(!groups[g.booking_id])groups[g.booking_id]={booking:b,gasten:[]};
    groups[g.booking_id].gasten.push(g);
  });
  const groupList=Object.values(groups).sort((a,b)=>{
    const da=(a.booking&&a.booking.aankomst)||''; const db=(b.booking&&b.booking.aankomst)||'';
    return db.localeCompare(da);
  });
  el.innerHTML='<div class="fld"><input id="idaSearch" placeholder="🔍 Zoek op naam of boekingsnummer…" oninput="filterIdArchief()"></div>'+
    '<div id="idaList">'+(groupList.length?groupList.map(gr=>{
      const b=gr.booking;
      const titel=b?esc(b.naam)+' <span class="mono" style="font-weight:400;color:var(--ink-3);">#'+(b.volgnummer||'—')+' · '+fmt(b.aankomst)+'–'+fmt(b.vertrek)+'</span>':'<span style="color:var(--ink-3);">(boeking niet meer gevonden)</span>';
      const zoekTekst=((b&&b.naam)||'').toLowerCase()+' '+((b&&b.volgnummer)||'')+' '+gr.gasten.map(g=>(g.naam||'').toLowerCase()).join(' ');
      return '<div class="card" data-zoek="'+esc(zoekTekst)+'" style="margin-bottom:10px;">'+
        '<div class="row" style="background:var(--card-2);"><span class="rl" style="font-weight:700;color:var(--ink);">'+titel+'</span></div>'+
        gr.gasten.map(g=>{
          const sub=[g.geboortedatum?'°'+String(g.geboortedatum).slice(0,4):'',g.nationaliteit||'',g.id_nummer?'ID ✓':''].filter(Boolean).join(' · ');
          const thumb=g.foto_url?'<div class="thumb" data-id-thumb="'+esc(g.foto_url)+'" style="cursor:pointer;" onclick="bekijkIdFoto(\''+esc(g.foto_url)+'\')">···</div>':'<div class="thumb">🪪</div>';
          return '<div class="guest">'+thumb+'<div class="gi"><div class="gn">'+esc(g.naam)+(g.is_hoofdgast?' <span class="pill p-conf" style="margin-left:4px;">Hoofd</span>':'')+'</div><div class="gd">'+(esc(sub)||'geen details')+'</div></div></div>';
        }).join('')+
      '</div>';
    }).join(''):'<div class="note-inline" style="padding:16px;">Geen gasten gevonden</div>')+'</div>';
  document.querySelectorAll('#idaList [data-id-thumb]').forEach(async(elm)=>{
    const path=elm.getAttribute('data-id-thumb');
    try{
      const {data:s}=await sb.storage.from('id-fotos').createSignedUrl(path,300);
      if(s&&s.signedUrl)elm.innerHTML='<img src="'+s.signedUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
    }catch(e){}
  });
}
function filterIdArchief(){
  const q=(document.getElementById('idaSearch').value||'').toLowerCase();
  document.querySelectorAll('#idaList [data-zoek]').forEach(r=>{r.style.display=r.getAttribute('data-zoek').indexOf(q)!==-1?'block':'none';});
}
/* Wettelijk reizigersregister (KB 27/04/2007) — op elke gekozen datum, niet
   enkel "vandaag", zodat een historische controle-aanvraag (politie,
   gemeente) beantwoord kan worden zonder in de database te moeten spitten. */
function splitNaam(n){
  const p=String(n||'').trim().split(/\s+/);
  return {voornaam:p[0]||'',achternaam:p.slice(1).join(' ')||''};
}
function fmtDateLong(d){if(!d)return'—';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('nl-BE',{day:'numeric',month:'short',year:'numeric'});}
function registerEntries(date){
  return bookings.filter(b=>b.aankomst<=date&&b.vertrek>date&&b.status!=='geannuleerd');
}
async function registerRows(date){
  const activeBookings=registerEntries(date);
  const bookingIds=activeBookings.map(b=>b.id);
  let gastenMap={};
  if(bookingIds.length){
    const {data}=await sb.from('gasten').select('*').in('booking_id',bookingIds).neq('naam','__pending_guest_upload__').is('deleted_at',null);
    (data||[]).forEach(g=>{if(!gastenMap[g.booking_id])gastenMap[g.booking_id]=[];gastenMap[g.booking_id].push(g);});
  }
  const rows=[];
  activeBookings.forEach(b=>{
    const isVertrek=b.vertrek===date;
    const gasten=gastenMap[b.id]||[];
    if(gasten.length){
      gasten.forEach(g=>{
        const gn=splitNaam(g.naam);
        rows.push({volgnummer:b.volgnummer,voornaam:gn.voornaam,achternaam:gn.achternaam,
          geboortedatum:g.geboortedatum,geboorteplaats:g.geboorteplaats,nationaliteit:g.nationaliteit,
          documenttype:g.documenttype,idnr:g.id_nummer,nummerplaat:g.nummerplaat||b.plaat,woonplaats:'',
          aankomst:b.aankomst,vertrek:b.vertrek,isVertrek,rol:g.is_hoofdgast?'Hoofdgast':'Meereizend',warning:!g.id_nummer});
      });
    } else {
      const n=splitNaam(b.naam);
      rows.push({volgnummer:b.volgnummer,voornaam:n.voornaam,achternaam:n.achternaam,
        geboortedatum:'',geboorteplaats:'',nationaliteit:'',documenttype:'',idnr:b.idnr,nummerplaat:b.plaat,woonplaats:'',
        aankomst:b.aankomst,vertrek:b.vertrek,isVertrek,rol:'Voorlopig (geen ID)',warning:true});
    }
  });
  return rows;
}
async function renderBeheerRegister(){
  const el=document.getElementById('beheerBody');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  el.innerHTML='<div class="card" style="padding:14px;">'+
    '<div class="note-inline" style="padding:0 0 12px;">Wettelijk verplicht reizigersregister (KB 27/04/2007) — kies een datum om het register op die dag te bekijken (bv. voor een controle-aanvraag).</div>'+
    '<div class="fld" style="margin-bottom:10px;"><label>Datum</label><input id="regDate" type="date" value="'+TODAY+'" onchange="renderRegisterTable()"></div>'+
    '<div style="display:flex;gap:8px;">'+
    '<button class="sbtn" style="flex:1;" onclick="printRegisterExport()">🖨️ Afdrukken</button>'+
    '<button class="sbtn" style="flex:1;" onclick="exportRegisterCSV()">⬇️ CSV-export</button>'+
    '</div></div>'+
    '<div id="regTableWrap"></div>';
  renderRegisterTable();
}
async function renderRegisterTable(){
  const wrap=document.getElementById('regTableWrap');if(!wrap)return;
  const date=document.getElementById('regDate').value||TODAY;
  wrap.innerHTML='<div class="note-inline">Laden…</div>';
  const rows=await registerRows(date);
  if(!rows.length){wrap.innerHTML=emptyCard('Geen gasten geregistreerd op '+fmtDateLong(date));return;}
  const missingId=rows.filter(r=>r.warning).length;
  let h=missingId>0?'<div class="note-inline" style="color:var(--amber);padding:8px 0;">⚠️ '+missingId+' gast'+(missingId>1?'en':'')+' zonder ID-nummer</div>':'';
  h+='<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap;">'+
    '<thead><tr style="text-align:left;border-bottom:1.5px solid var(--sep);">'+
    ['#','Voornaam','Achternaam','Geboortedatum','Geboorteplaats','Nationaliteit','Documenttype','Documentnr.','Nummerplaat','Aankomst','Vertrek','Rol'].map(t=>'<th style="padding:7px 6px;color:var(--ink-3);">'+t+'</th>').join('')+
    '</tr></thead><tbody>'+
    rows.map(r=>'<tr style="border-bottom:.5px solid var(--sep);'+(r.warning?'background:var(--red-soft);':'')+'">'+
      '<td style="padding:6px;color:var(--ink-3);">#'+(r.volgnummer??'—')+'</td>'+
      '<td style="padding:6px;font-weight:600;">'+esc(r.voornaam||'—')+'</td>'+
      '<td style="padding:6px;font-weight:600;">'+esc(r.achternaam||'—')+'</td>'+
      '<td style="padding:6px;">'+(r.geboortedatum?fmtDateLong(r.geboortedatum):'—')+'</td>'+
      '<td style="padding:6px;">'+esc(r.geboorteplaats||'—')+'</td>'+
      '<td style="padding:6px;">'+esc(r.nationaliteit||'—')+'</td>'+
      '<td style="padding:6px;">'+esc(r.documenttype||'—')+'</td>'+
      '<td style="padding:6px;font-family:var(--f-mono);'+(!r.idnr?'color:var(--red);font-weight:700;':'')+'">'+esc(r.idnr||'❌')+'</td>'+
      '<td style="padding:6px;font-family:var(--f-mono);">'+esc(r.nummerplaat||'—')+'</td>'+
      '<td style="padding:6px;">'+fmtDateLong(r.aankomst)+'</td>'+
      '<td style="padding:6px;'+(r.isVertrek?'color:var(--amber);font-weight:700;':'')+'">'+fmtDateLong(r.vertrek)+(r.isVertrek?' ↑':'')+'</td>'+
      '<td style="padding:6px;color:var(--ink-3);font-size:11px;">'+esc(r.rol)+'</td>'+
      '</tr>').join('')+
    '</tbody></table></div>'+
    '<div class="note-inline" style="margin-top:8px;">'+rows.length+' pers. geregistreerd op '+fmtDateLong(date)+'</div>';
  wrap.innerHTML=h;
}
async function printRegisterExport(){
  const date=document.getElementById('regDate').value||TODAY;
  const rows=await registerRows(date);
  const w=window.open('','_blank');
  if(!w){toast('⚠️ Sta pop-ups toe om te exporteren');return;}
  w.document.write('<html><head><title>Register '+date+'</title></head><body style="font-family:sans-serif;padding:20px;">'+
    '<h2>Register toeristenverblijf — '+fmtDateLong(date)+'</h2><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px;">'+
    '<tr>'+['#','Voornaam','Achternaam','Geboortedatum','Geboorteplaats','Nationaliteit','Documenttype','Documentnr.','Nummerplaat','Aankomst','Vertrek','Rol'].map(t=>'<th>'+t+'</th>').join('')+'</tr>'+
    rows.map(r=>'<tr><td>#'+(r.volgnummer??'—')+'</td><td>'+esc(r.voornaam||'—')+'</td><td>'+esc(r.achternaam||'—')+'</td>'+
      '<td>'+(r.geboortedatum?fmtDateLong(r.geboortedatum):'—')+'</td><td>'+esc(r.geboorteplaats||'—')+'</td><td>'+esc(r.nationaliteit||'—')+'</td>'+
      '<td>'+esc(r.documenttype||'—')+'</td><td>'+esc(r.idnr||'❌ ontbreekt')+'</td><td>'+esc(r.nummerplaat||'—')+'</td>'+
      '<td>'+fmtDateLong(r.aankomst)+'</td><td>'+fmtDateLong(r.vertrek)+'</td><td>'+esc(r.rol)+'</td></tr>').join('')+
    '</table><div style="margin-top:16px;font-size:11px;color:#666;">Camping Cosmopolite · Register Toeristenverblijf · Afgedrukt op '+fmtDateLong(TODAY)+' · Vertrouwelijk</div>'+
    '<script>window.onload=function(){window.print()}<\/script></body></html>');
  w.document.close();
}
async function exportRegisterCSV(){
  const date=document.getElementById('regDate').value||TODAY;
  const rows=await registerRows(date);
  const csvRows=[['Volgnummer','Voornaam','Achternaam','Geboortedatum','Geboorteplaats','Nationaliteit','Documenttype','ID-nummer','Nummerplaat','Aankomst','Vertrek','Rol']];
  rows.forEach(r=>csvRows.push([r.volgnummer??'',r.voornaam,r.achternaam,r.geboortedatum||'',r.geboorteplaats||'',r.nationaliteit||'',r.documenttype||'',r.idnr||'',r.nummerplaat||'',r.aankomst,r.vertrek,r.rol]));
  const csv=csvRows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='register_'+date+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('⬇️ CSV gedownload (incl. alle gasten)');
}
async function renderBeheerAnalytics(){
  const el=document.getElementById('beheerBody');
  const totBoekingen=bookings.length;
  const aanwezigNu=inFolder('aanwezig').length;
  const omzet=bookings.reduce((s,b)=>s+Number(b.bedrag||0),0);
  const openTotaal=bookings.reduce((s,b)=>s+Math.max(0,openOf(b)),0);
  const perKanaal={};bookings.forEach(b=>{const k=b.bron||'onbekend';perKanaal[k]=(perKanaal[k]||0)+1;});
  el.innerHTML='<div class="kpis" style="grid-template-columns:repeat(2,1fr);">'+
    '<div class="kpi"><div class="kv">'+totBoekingen+'</div><div class="kk">Totaal boekingen</div></div>'+
    '<div class="kpi"><div class="kv b">'+aanwezigNu+'</div><div class="kk">Nu aanwezig</div></div>'+
    '<div class="kpi"><div class="kv g">'+money(omzet)+'</div><div class="kk">Totale omzet</div></div>'+
    '<div class="kpi"><div class="kv" style="color:var(--amber)">'+money(openTotaal)+'</div><div class="kk">Totaal openstaand</div></div></div>'+
    '<div class="sec-lbl">Boekingen per kanaal</div><div class="card taskcard">'+
    Object.keys(perKanaal).map(k=>'<div class="row"><span class="rl">'+({mail:'📧 E-mail',website:'🌐 Website',telefoon:'☎️ Telefoon'}[k]||k)+'</span><span class="rv">'+perKanaal[k]+'</span></div>').join('')+'</div>';
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}

/* ---------- start ---------- */
setFolder('aanwezig');
checkSession();
