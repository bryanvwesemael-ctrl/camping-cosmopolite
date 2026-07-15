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

let bookings = [], paidByBooking = {}, maxPlaatsen = 0, currentUser = null, selectedId = null;

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
    id:row.id, volgnummer:row.volgnummer, ogm:row.ogm_referentie,
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
  if(gp) gp.innerHTML=b.nota?'<div class="sec-lbl">Opmerking</div><div class="card"><div class="row" style="justify-content:flex-start;"><span class="rl">'+esc(b.nota)+'</span></div></div>':'';

  loadBetPane(b);
  loadGastPane(b);
  loadCommPane(b);
  setTab('geg');
}
function grow(l,v){return '<div class="row"><span class="rl">'+l+'</span><span class="rv">'+v+'</span></div>';}

/* betaling */
async function loadBetPane(b){
  const el=document.getElementById('pane-bet');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('payments').select('bedrag,status,methode,created_at').eq('booking_id',b.id).order('created_at');
  const paid=(data||[]).filter(p=>p.status==='paid');
  const betaald=paid.reduce((s,p)=>s+Number(p.bedrag||0),0);
  const totaal=Number(b.bedrag||0);
  const open=Math.round((totaal-betaald)*100)/100;
  const pct=totaal>0?Math.min(100,Math.round(betaald/totaal*100)):0;
  const volledig=open<=0.005;
  const methL={cash:'💵 Cash',overschrijving:'🏦 Overschrijving'};
  let h='<div class="card"><div class="paytop">'+
    '<div class="ring" style="background:conic-gradient('+(volledig?'var(--green)':'var(--amber)')+' '+pct+'%, var(--sep) 0);color:'+(volledig?'var(--green)':'var(--amber)')+';"><div class="inner">'+pct+'%</div></div>'+
    '<div class="pt"><div class="a">'+money(betaald)+' <span style="font-size:13px;color:var(--ink-3);font-weight:600;">/ '+money(totaal)+'</span></div>'+
    '<div class="b">'+(volledig?'<b style="color:var(--green)">✅ Volledig betaald</b>':'Nog <b>'+money(open)+' openstaand</b>')+'</div></div></div></div>';
  if(!volledig){
    h+='<div class="sec-lbl">Registreer betaling</div>';
    h+='<div class="statusgrid" style="padding:0;">'+
       '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'cash\')">💵 Cash</div>'+
       '<div class="sbtn" onclick="actBetaling(\''+b.id+'\',\'overschrijving\')">🏦 Overschrijving</div>'+
       '<div class="sbtn" style="opacity:.5;" onclick="toast(\'QR-code — komt in volgende stap\')">📱 QR-code</div>'+
       '<div class="sbtn" style="opacity:.5;" onclick="toast(\'Betaallink — komt in volgende stap\')">🔗 Betaallink</div>'+
       '</div>';
  }
  h+='<div class="sec-lbl">Historiek</div>';
  h+=paid.length?'<div class="card payhist">'+paid.map(p=>'<div class="row"><span class="rl">'+(methL[p.methode]||'💳 Mollie')+' · '+new Date(p.created_at).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})+'</span><span class="rv" style="color:var(--green)">+'+money(p.bedrag)+'</span></div>').join('')+'</div>':emptyCard('Nog geen betalingen');
  el.className='pane'+(el.classList.contains('on')?' on':'');
  el.innerHTML=h;
}

/* gasten */
async function loadGastPane(b){
  const el=document.getElementById('pane-gast');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('gasten').select('*').eq('booking_id',b.id).order('is_hoofdgast',{ascending:false}).order('created_at');
  const real=(data||[]).filter(g=>g.naam!=='__pending_guest_upload__'&&!g.deleted_at);
  let h='';
  if(real.length){
    h+='<div class="card">'+real.map(g=>{
      const sub=[g.geboortedatum?'°'+String(g.geboortedatum).slice(0,4):'',g.nationaliteit||'',g.id_nummer?'ID ✓':''].filter(Boolean).join(' · ');
      return '<div class="guest"><div class="thumb">'+(g.foto_url?'📷':'🪪')+'</div><div class="gi"><div class="gn">'+esc(g.naam)+(g.is_hoofdgast?' <span class="pill p-conf" style="margin-left:4px;">Hoofd</span>':'')+'</div><div class="gd">'+(esc(sub)||'geen details')+'</div></div></div>';
    }).join('')+'</div>';
  } else {
    h+=emptyCard('Nog geen gasten geregistreerd voor deze reservering');
  }
  h+='<button class="ai-btn" style="opacity:.55;" onclick="toast(\'AI ID-scan — komt in volgende stap\')">🤖 Scan ID-kaart met AI</button>';
  h+='<div class="note-inline">wettelijk register · '+real.length+' gast'+(real.length===1?'':'en')+' geregistreerd</div>';
  el.innerHTML=h;
}

/* communicatie */
async function loadCommPane(b){
  const el=document.getElementById('pane-comm');
  el.innerHTML='<div class="note-inline">Laden…</div>';
  const {data}=await sb.from('communicatie').select('*').eq('booking_id',b.id).order('created_at',{ascending:true});
  let thread='';
  if(data&&data.length){
    thread=data.map(c=>{
      const inkomend=c.richting==='inkomend';
      const when=new Date(c.created_at).toLocaleString('nl-BE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return '<div class="msg '+(inkomend?'in':'out')+'"><div class="mh"><span>'+(inkomend?'← ontvangen':'→ '+esc(c.onderwerp||'verzonden'))+'</span><span>'+when+'</span></div>'+esc(c.inhoud||'(geen inhoud)').slice(0,600)+'</div>';
    }).join('');
  } else {
    thread='<div class="note-inline" style="padding:20px;">Nog geen e-mails voor deze reservering</div>';
  }
  el.innerHTML='<div class="card"><div class="thread">'+thread+'</div>'+
    '<div class="composer"><div class="fake-input">Antwoorden — komt in volgende stap</div>'+
    '<button class="send" style="opacity:.55;" onclick="toast(\'Mail versturen — komt in volgende stap\')">➤</button></div></div>'+
    '<div class="note-inline">alle communicatie chronologisch (alleen-lezen in deze fase)</div>';
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

/* ---------- toast ---------- */
let toastTimer;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}

/* ---------- start ---------- */
setFolder('aanwezig');
checkSession();
