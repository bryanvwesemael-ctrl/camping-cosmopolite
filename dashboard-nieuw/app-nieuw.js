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
async function doLogout(){ if(confirm('Uitloggen?')){ await sb.auth.signOut(); location.reload(); } }
function showLogin(){document.getElementById('loginScreen').style.display='flex';document.getElementById('app').style.display='none';}
function showApp(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='flex';
  const who=document.getElementById('whoLbl');
  if(who && currentUser){const n=(currentUser.email||'').split('@')[0];who.textContent='👤 '+(n.charAt(0).toUpperCase()+n.slice(1));}
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
    status:row.status, bron:row.bron||'', bedrag:row.bedrag_totaal||0,
    ingecheckt_at:row.ingecheckt_at, uitgecheckt_at:row.uitgecheckt_at,
    nota:row.nota||'', honden:row.honden||0, autos:row.autos||1, elektriciteit:!!row.elektriciteit,
  };
}
async function loadData(){
  try{
    const pr=await sb.from('settings').select('value').eq('key','maxPlaatsen').limit(1);
    if(pr.data&&pr.data.length) maxPlaatsen=parseInt(pr.data[0].value)||0;
  }catch(e){}
  try{
    const cs=await sb.from('club_settings').select('key,value');
    clubCfg={};(cs.data||[]).forEach(r=>{clubCfg[r.key]=r.value;});
  }catch(e){}
  const res=await sb.from('bookings').select('*,clients(*)').order('aankomst',{ascending:true});
  if(res.error){toast('⚠️ Kon reserveringen niet laden: '+res.error.message);return;}
  bookings=(res.data||[]).map(mapBooking);
  paidByBooking={};
  const pays=await sb.from('payments').select('booking_id,bedrag,status');
  (pays.data||[]).filter(p=>p.status==='paid').forEach(p=>{paidByBooking[p.booking_id]=(paidByBooking[p.booking_id]||0)+Number(p.bedrag||0);});
  renderAll();
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
function verblijf(b){
  const parts=[];
  if(b.tenten>0)parts.push('⛺ '+b.tenten+' tent'+(b.tenten>1?'en':''));
  if(b.campers>0)parts.push('🚐 '+b.campers+' camper'+(b.campers>1?'s':''));
  return parts.join(' + ')||(b.type||'—');
}

/* ---------- render: shell ---------- */
function renderAll(){
  renderDagbord(); renderFolders(); updateCounts();
  if(selectedId){const b=bookings.find(x=>x.id===selectedId); if(b) renderFiche(b); }
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
function renderDagbord(){
  const aankomst=bookings.filter(b=>b.aankomst===TODAY&&b.status!=='geannuleerd'&&!b.uitgecheckt_at);
  const vertrek=bookings.filter(b=>b.vertrek===TODAY&&b.status!=='geannuleerd');
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
     '<div class="kpi"><div class="kv g">'+aankomst.length+'</div><div class="kk">🟢 Aankomst</div></div>'+
     '<div class="kpi"><div class="kv r">'+vertrek.length+'</div><div class="kk">🔴 Vertrek</div></div>'+
     '<div class="kpi"><div class="kv b">'+aanwezig.length+'</div><div class="kk">🏕️ Aanwezig</div></div>'+
     '<div class="kpi"><div class="kv" style="font-size:19px;">'+money(openSom)+'</div><div class="kk">💰 Openstaand</div></div>'+
     '<div class="kpi"><div class="kv" style="font-size:22px;">'+bezet+'</div><div class="kk">📊 Bezetting</div></div>'+
     '</div>';
  if(postvak.length){
    h+='<div class="alert" onclick="setFolder(\'postvak\')"><div class="ai">📥</div>'+
       '<div class="at"><div class="a1">'+postvak.length+' aanvra'+(postvak.length===1?'ag':'gen')+' in Postvak</div>'+
       '<div class="a2">Nog te controleren en te bevestigen</div></div><div class="ar">›</div></div>';
  }
  h+='<div class="sec-lbl">🟢 Aankomst vandaag</div>';
  h+=aankomst.length?'<div class="card taskcard">'+aankomst.map(b=>rowHtml(b,esc(verblijf(b))+' · '+b.personen+' pers.','<span class="pill p-arr">AANKOMST</span>')).join('')+'</div>':emptyCard('Geen aankomsten vandaag');
  h+='<div class="sec-lbl">🔴 Vertrek vandaag</div>';
  h+=vertrek.length?'<div class="card taskcard">'+vertrek.map(b=>rowHtml(b,esc(verblijf(b)),'<span class="pill p-dep">VERTREK</span>')).join('')+'</div>':emptyCard('Geen vertrekken vandaag');
  h+='<div class="sec-lbl">💰 Openstaande betalingen</div>';
  h+=openList.length?'<div class="card taskcard">'+openList.slice(0,8).map(b=>rowHtml(b,'Nog '+money(openOf(b))+' open','<span class="pill p-pay">OPEN</span>')).join('')+'</div>':emptyCard('Alles betaald 🎉');
  h+='<div style="height:6px;"></div>';
  document.getElementById('scr-dagbord').innerHTML=h;
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
function go(screen){document.getElementById('app').classList.remove('mobileFiche');setNav(screen);showScreen(screen);}
function setFolder(f){
  go('reserv');
  document.querySelectorAll('.foldertabs .ft').forEach(b=>b.classList.toggle('on',b.getAttribute('data-folder')===f));
  ['postvak','booking','aanwezig','vertrokken'].forEach(x=>{document.getElementById('fc-'+x).style.display=(x===f)?'block':'none';});
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
  document.getElementById('draftBanner').style.display='none';
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
  g+=grow('Nachten',nights(b.aankomst,b.vertrek)+' · '+money(b.bedrag)+' totaal');
  g+=grow('Nummerplaat',b.plaat?esc(b.plaat):'—');
  if(extra.length)g+=grow('Extra\'s',extra.join(' · '));
  g+=grow('E-mail',b.email?esc(b.email):'—');
  g+=grow('Telefoon',b.telefoon?esc(b.telefoon):'—');
  g+=grow('Kanaal',bronL);
  document.getElementById('gegCard').innerHTML=g;
  const gp=document.getElementById('paneGegExtra');
  if(gp){
    let x='';
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

  h+='<div class="sec-lbl">Registreer betaling</div>';
  h+='<div class="statusgrid" style="padding:0;">'+
     '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'cash\')">💵 Cash</div>'+
     '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'overschrijving\')">🏦 Overschrijving</div>'+
     '<div class="sbtn" style="grid-column:1/-1;border-color:var(--green);color:var(--green);font-weight:700;" onclick="toggleQR(\''+b.id+'\')">📱 Toon betaal-QR (op eigen IBAN)</div>'+
     '</div>';
  h+='<div id="qrBox" style="display:none;margin-top:10px;"></div>';

  h+='<div class="sec-lbl">Historiek</div>';
  h+=rows.length?'<div class="card payhist">'+rows.map(p=>'<div class="row"><span class="rl">'+(methL[p.methode]||'💳 '+esc(p.methode||''))+' · '+new Date(p.created_at).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+'</span><span class="rv" style="color:'+(Number(p.bedrag)<0?'var(--blue)':'var(--green)')+'">'+(Number(p.bedrag)<0?'':'+')+money(p.bedrag)+'</span></div>').join('')+'</div>':emptyCard('Nog geen betalingen');
  if(betaald>0 && !terugbetaald){
    h+='<div style="text-align:center;margin-top:10px;"><span onclick="actTerugbetaling(\''+b.id+'\')" style="font-size:12px;color:var(--blue);cursor:pointer;font-family:var(--f-mono);">↩️ Terugbetaling registreren</span></div>';
  }
  el.innerHTML=h;
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
      return '<div class="guest"><div class="thumb">'+(g.foto_url?'📷':'🪪')+'</div><div class="gi"><div class="gn">'+esc(g.naam)+(g.is_hoofdgast?' <span class="pill p-conf" style="margin-left:4px;">Hoofd</span>':'')+'</div><div class="gd">'+(esc(sub)||'geen details')+'</div></div>'+
        '<span onclick="delGast(\''+g.id+'\',\''+b.id+'\')" style="color:var(--red);cursor:pointer;font-size:15px;padding:6px;">🗑</span></div>';
    }).join('')+'</div>';
  } else {
    h+=emptyCard('Nog geen gasten geregistreerd voor deze reservering');
  }
  h+='<button class="ai-btn" onclick="openAddGuest(\''+b.id+'\')">➕ Gast toevoegen · 🤖 met AI-scan</button>';
  h+='<div class="note-inline">wettelijk register · '+real.length+' gast'+(real.length===1?'':'en')+' geregistreerd</div>';
  el.innerHTML=h;
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
    '<button class="scanbtn" onclick="document.getElementById(\'gScanFile\').click()">🤖 Scan identiteitskaart met AI</button>'+
    '<input type="file" id="gScanFile" accept="image/*" capture="environment" style="display:none;" onchange="scanGuestFile(this)">'+
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

/* ---------- acties (schrijven echte data) ---------- */
async function actBevestig(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  if(!confirm('Reservering van '+b.naam+' bevestigen?\n\nStatus wordt "bevestigd" en de fiche verhuist naar Booking.'))return;
  const {error}=await sb.from('bookings').update({status:'bevestigd'}).eq('id',id);
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
  const inp=prompt((methode==='cash'?'Cash':'Overschrijving')+' registreren voor '+b.naam+'\n\nBedrag (€):', open>0?String(open):'');
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

/* ---------- modal ---------- */
function openModal(title,html){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=html;
  document.getElementById('modal').classList.add('on');
}
function closeModal(){document.getElementById('modal').classList.remove('on');document.getElementById('modalBody').innerHTML='';}

/* ---------- gegevens bewerken (in de fiche, geen apart scherm) ---------- */
function editGegevens(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const el=document.getElementById('gegCard');
  const f=(l,inner)=>'<div class="row" style="align-items:center;"><span class="rl">'+l+'</span><span style="flex:0 0 58%;">'+inner+'</span></div>';
  const inp=(id,val,type)=>'<input id="'+id+'" '+(type?'type="'+type+'"':'')+' value="'+esc(val)+'" style="width:100%;padding:8px 10px;border-radius:9px;border:1px solid var(--sep);background:var(--card-2);color:var(--ink);font-size:13px;font-family:var(--f);">';
  el.innerHTML=
    f('Naam',inp('eNaam',b.naam))+
    f('E-mail',inp('eEmail',b.email,'email'))+
    f('Telefoon',inp('eTel',b.telefoon,'tel'))+
    f('Nummerplaat',inp('ePlaat',b.plaat))+
    f('Aankomst',inp('eAan',b.aankomst,'date'))+
    f('Vertrek',inp('eVer',b.vertrek,'date'))+
    f('Volwassenen',inp('eVolw',b.volwassenen,'number'))+
    f('Kinderen',inp('eKind',b.kinderen,'number'))+
    f('Bedrag (€)',inp('eBedrag',b.bedrag,'number'))+
    f('Opmerking',inp('eNota',b.nota));
  const gp=document.getElementById('paneGegExtra');
  if(gp)gp.innerHTML='<div style="display:flex;gap:8px;margin-top:10px;">'+
    '<button class="modal-save" style="margin:0;flex:1;" onclick="saveGegevens(\''+id+'\')">✓ Opslaan</button>'+
    '<button class="sbtn" style="flex:0 0 auto;" onclick="openReal(\''+id+'\')">Annuleren</button></div>';
}
async function saveGegevens(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  const g=x=>document.getElementById(x);
  const aan=g('eAan').value, ver=g('eVer').value;
  if(aan&&ver&&aan>=ver){toast('⚠️ Vertrek moet na aankomst zijn');return;}
  try{
    const cErr=(await sb.from('clients').update({
      naam:(g('eNaam').value||'').trim()||b.naam,
      email:(g('eEmail').value||'').trim()||null,
      telefoon:(g('eTel').value||'').trim()||null,
      nummerplaten:(g('ePlaat').value||'').trim()||null,
    }).eq('id',b.clientId||(await clientIdOf(id)))).error;
    const bErr=(await sb.from('bookings').update({
      aankomst:aan||b.aankomst, vertrek:ver||b.vertrek,
      volwassenen:parseInt(g('eVolw').value)||0, kinderen:parseInt(g('eKind').value)||0,
      bedrag_totaal:parseFloat(g('eBedrag').value)||0, nota:(g('eNota').value||'').trim()||null,
    }).eq('id',id)).error;
    if(cErr||bErr)throw new Error((cErr||bErr).message);
    toast('✅ Opgeslagen'); await loadData();
  }catch(e){toast('⚠️ '+e.message);}
}
async function clientIdOf(bookingId){
  const {data}=await sb.from('bookings').select('client_id').eq('id',bookingId).single();
  return data?data.client_id:null;
}

/* ---------- nieuwe reservering (+ knop) — met centrale prijsengine ---------- */
let PRICES = (window.CampingPricing?Object.assign({},CampingPricing.DEFAULTS):{});
let nbState = {volw:2,kind:0,baby:0,tent:0,camper:1,honden:0,autos:1,elek:false};
async function loadPrices(){
  try{
    const {data:{session}}=await sb.auth.getSession();if(!session)return;
    const {data}=await sb.from('settings').select('key,value').eq('user_id',session.user.id)
      .in('key',['prijs_tent','prijs_camper','prijs_volwassene','prijs_kind','prijs_baby','prijs_hond','prijs_extra_auto','prijs_elektriciteit','prijs_afval_per_6','toeristentaks']);
    const pm={};(data||[]).forEach(s=>pm[s.key]=s.value);
    const map={prijs_tent:'tent',prijs_camper:'camper',prijs_volwassene:'volwassene',prijs_kind:'kind',prijs_baby:'baby',prijs_hond:'hond',prijs_extra_auto:'extraAuto',prijs_elektriciteit:'elektriciteit',prijs_afval_per_6:'afvalPer6',toeristentaks:'toeristentaks'};
    Object.keys(map).forEach(k=>{if(pm[k]!=null)PRICES[map[k]]=parseFloat(pm[k])||PRICES[map[k]];});
  }catch(e){}
}
async function openNewBooking(){
  await loadPrices();
  nbState={volw:2,kind:0,baby:0,tent:0,camper:1,honden:0,autos:1,elek:false};
  const today=TODAY;
  const step=(lbl,key)=>'<div class="stpr"><span class="sl">'+lbl+'</span><div class="ct"><button onclick="nbStep(\''+key+'\',-1)">−</button><span class="val" id="nb_'+key+'">'+nbState[key]+'</span><button onclick="nbStep(\''+key+'\',1)">+</button></div></div>';
  openModal('Nieuwe reservering',
    '<div class="fld"><label>Naam *</label><input id="nbNaam" placeholder="Volledige naam" oninput="nbPrice()"></div>'+
    '<div class="fld2"><div class="fld"><label>E-mail</label><input id="nbEmail" type="email" placeholder="gast@email.com"></div>'+
    '<div class="fld"><label>Nummerplaat</label><input id="nbPlaat" placeholder="1-ABC-123"></div></div>'+
    '<div class="fld2"><div class="fld"><label>Aankomst *</label><input id="nbAan" type="date" value="'+today+'" onchange="nbPrice()"></div>'+
    '<div class="fld"><label>Vertrek *</label><input id="nbVer" type="date" onchange="nbPrice()"></div></div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Verblijf</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('⛺ Tenten','tent')+step('🚐 Campers','camper')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Personen</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🧑 Volwassenen','volw')+step('🧒 Kinderen 3–11','kind')+step('👶 Baby'+"'"+'s <3','baby')+'</div>'+
    '<label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3);">Extra</label>'+
    '<div style="display:grid;gap:8px;margin:6px 0 13px;">'+step('🐕 Honden','honden')+step('🚗 Auto'+"'"+'s','autos')+
    '<div class="toggle-row"><span class="sl">⚡ Elektriciteit</span><input type="checkbox" id="nbElek" onchange="nbState.elek=this.checked;nbPrice()"></div></div>'+
    '<div class="fld"><label>Via kanaal</label><select id="nbBron"><option value="telefoon">☎️ Telefoon</option><option value="mail">📧 E-mail</option><option value="website">🌐 Website</option></select></div>'+
    '<div class="pricebox"><div class="pb1" id="nbTotaal">€ 0,00</div><div class="pb2" id="nbUitleg">Vul aankomst, vertrek en verblijf in</div></div>'+
    '<div id="nbMsg" class="note-inline" style="min-height:14px;"></div>'+
    '<button class="modal-save" id="nbSaveBtn" onclick="saveNewBooking()">Reservering opslaan → Postvak</button>');
  nbPrice();
}
function nbStep(key,delta){
  nbState[key]=Math.max(key==='autos'?1:0,(nbState[key]||0)+delta);
  const el=document.getElementById('nb_'+key); if(el)el.textContent=nbState[key];
  nbPrice();
}
function nbCalc(){
  const aan=document.getElementById('nbAan').value, ver=document.getElementById('nbVer').value;
  if(!window.CampingPricing) return {totaal:0, nights:0};
  const r=CampingPricing.calc({
    prices:PRICES,
    units:[{prijs:PRICES.tent,count:nbState.tent,allIn:false},{prijs:PRICES.camper,count:nbState.camper,allIn:false}],
    volwassenen:nbState.volw, kinderen:nbState.kind, baby:nbState.baby,
    honden:nbState.honden, autos:nbState.autos, elektriciteit:nbState.elek,
    aankomst:aan, vertrek:ver,
  });
  return r;
}
function nbPrice(){
  const r=nbCalc();
  const nights=r.nights||0;
  document.getElementById('nbTotaal').textContent='€ '+Number(r.totaal||0).toFixed(2).replace('.',',');
  document.getElementById('nbUitleg').textContent=nights>0?(nights+' nacht'+(nights>1?'en':'')+' · incl. taks'):'Vul aankomst, vertrek en verblijf in';
}
async function saveNewBooking(){
  const naam=(document.getElementById('nbNaam').value||'').trim();
  const aan=document.getElementById('nbAan').value, ver=document.getElementById('nbVer').value;
  const msg=document.getElementById('nbMsg');
  if(!naam){msg.style.color='var(--red)';msg.textContent='Naam is verplicht';return;}
  if(!aan||!ver){msg.style.color='var(--red)';msg.textContent='Aankomst en vertrek zijn verplicht';return;}
  if(aan>=ver){msg.style.color='var(--red)';msg.textContent='Vertrek moet na aankomst zijn';return;}
  if(nbState.tent+nbState.camper<1){msg.style.color='var(--red)';msg.textContent='Voeg minstens 1 tent of camper toe';return;}
  if(nbState.volw+nbState.kind+nbState.baby<1){msg.style.color='var(--red)';msg.textContent='Minstens 1 persoon';return;}
  const btn=document.getElementById('nbSaveBtn'); btn.disabled=true; btn.textContent='Opslaan…';
  try{
    const r=nbCalc();
    const email=(document.getElementById('nbEmail').value||'').trim()||('geen-email+'+Date.now()+'@cosmopolite.local');
    const parts=[];
    if(nbState.tent>0)parts.push(nbState.tent+'× Tent');
    if(nbState.camper>0)parts.push(nbState.camper+'× Camper');
    const {data:client,error:cErr}=await sb.from('clients').insert({naam,email,nummerplaten:(document.getElementById('nbPlaat').value||'').trim()||null}).select('id').single();
    if(cErr)throw new Error(cErr.message);
    const {error:bErr}=await sb.from('bookings').insert({
      client_id:client.id, aankomst:aan, vertrek:ver,
      tenten:nbState.tent, campers:nbState.camper, verblijfstype:parts.join(' + ')||'Tent',
      volwassenen:nbState.volw, kinderen:nbState.kind, baby:nbState.baby,
      honden:nbState.honden, autos:nbState.autos, elektriciteit:nbState.elek,
      bron:document.getElementById('nbBron').value, bedrag_totaal:Number(r.totaal||0), status:'aanvraag',
    });
    if(bErr)throw new Error(bErr.message);
    closeModal(); toast('✅ Reservering aangemaakt → Postvak');
    await loadData(); setFolder('postvak');
  }catch(e){msg.style.color='var(--red)';msg.textContent='⚠️ '+e.message;btn.disabled=false;btn.textContent='Reservering opslaan → Postvak';}
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}

/* ---------- start ---------- */
setFolder('aanwezig');
checkSession();
