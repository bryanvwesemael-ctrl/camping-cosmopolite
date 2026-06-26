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
async function doLogout(){await sb.auth.signOut();location.reload()}

async function checkSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('appRoot').style.display='block';
    const naam=(session.user.user_metadata?.full_name||session.user.email||'').split(/[\s@]/)[0];
    const greet=document.getElementById('heroGreet');
    if(greet&&naam)greet.textContent=`Goeiedag, ${naam} 👋`;
    await loadData();
  }else{
    document.getElementById('loginScreen').style.display='flex';
    document.getElementById('appRoot').style.display='none';
  }
}
sb.auth.onAuthStateChange((_event,_session)=>{checkSession()});

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
const PRICES={
  tent:15,camper:15,
  volwassene:7,kind:5,baby:0,hond:3,extraAuto:2,elektriciteit:6,afvalPer6:2,toeristentaks:1
};
function calcPrice(o){
  const eenheden=(o.tenten||0)+(o.campers||0);
  const basis=(o.tenten||0)*PRICES.tent+(o.campers||0)*PRICES.camper;
  const volw=o.volwassenen||0, kind=o.kinderen||0, baby=o.baby||0;
  const totaalPersonen=volw+kind+baby;
  const afval=Math.ceil(Math.max(totaalPersonen,1)/6)*PRICES.afvalPer6;
  const extraAutos=Math.max(0,(o.autos||1)-1);
  const honden=o.honden||0;
  const nights=Math.max(o.nights||0,0);
  const elek=o.elektriciteit?PRICES.elektriciteit:0;
  // Toeristentaks is BTW-vrij (gemeentelijke belasting, geen BTW)
  const taks=volw*PRICES.toeristentaks;
  const taks_totaal=taks*nights;
  // Camping diensten: 12% BTW (wetswijziging 1 maart 2026)
  const diensten_per_nacht=basis+volw*PRICES.volwassene+kind*PRICES.kind+honden*PRICES.hond+extraAutos*PRICES.extraAuto;
  const diensten_totaal=diensten_per_nacht*nights+elek+afval;
  const btw=Math.round(diensten_totaal*0.12*100)/100;
  const totaal=Math.round((diensten_totaal+btw+taks_totaal)*100)/100;
  const perNacht=diensten_per_nacht+taks;
  return{basis,afval,taks,taks_totaal,perNacht,nights,elek,btw,diensten_totaal,totaal,personen:totaalPersonen,extraAutos,honden,eenheden};
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

/* ═══════════ LADEN UIT SUPABASE ═══════════ */
async function loadData(){
  const {data,error}=await sb.from('bookings').select('*,clients(*)').order('aankomst',{ascending:true});
  if(error){toast('⚠️ Kon data niet laden: '+error.message);return}
  bookings=(data||[]).map(row=>{
    const c=row.clients||{};
    const type=countsToType(row.tenten||0,row.campers||0);
    return{
      id:row.id, volgnummer:row.volgnummer, ogm:row.ogm_referentie,
      clientId:c.id, naam:c.naam||'(onbekend)', email:c.email, telefoon:c.telefoon,
      plaat:c.nummerplaten||'', id_kaart:!!c.id_nummer, idnr:c.id_nummer,
      geboortedatum:c.geboortedatum, nationaliteit:c.nationaliteit, woonplaats:c.woonplaats,
      fotoPath:c.id_foto_url||null, foto:null,
      personen:(row.volwassenen||0)+(row.kinderen||0)+(row.baby||0),
      volwassenen:row.volwassenen||0, kinderen:(row.kinderen||0)+(row.baby||0),
      aankomst:row.aankomst, vertrek:row.vertrek, type,
      tenten:row.tenten||0, campers:row.campers||0,
      status:row.status, bron:row.bron, bedrag:row.bedrag_totaal||0,
      nota:row.nota||'', hond:(row.honden||0)>0, extraAuto:(row.autos||0)>1,
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
  if(document.getElementById('view-kalender').classList.contains('on'))renderCalendar();
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

  // Recent list
  document.getElementById('recentList').innerHTML=[...bookings].reverse().slice(0,3).map(bookingRowHtml).join('');
  // Presence preview
  const prs=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  document.getElementById('presencePreview').textContent=prs.length?`${prs.length} gast${prs.length>1?'en':''} aanwezig`:'Geen gasten aanwezig';
}

/* ═══════════ BOOKING LIST ═══════════ */
function renderBookingList(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const filtered=bookings.filter(b=>{
    if(q&&!(b.naam+b.plaat).toLowerCase().includes(q))return false;
    if(activeFilter!=='alle'&&b.status!==activeFilter)return false;
    if(activeSource!=='alle'&&b.bron!==activeSource)return false;
    return true;
  });
  const list=document.getElementById('bkList');
  if(!filtered.length){list.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">Geen resultaten</div><div class="empty-sub">Pas de filters aan</div></div>'}
  else list.innerHTML=filtered.map(bookingRowHtml).join('')
}

/* ═══════════ DETAIL SHEET ═══════════ */
function openBookingDetail(id){
  const b=bookings.find(x=>x.id===id);if(!b)return;
  activeBookingId=id;
  const sm=STATUS_META[b.status];const bm=BRON_META[b.bron]||{};
  const nights=nightCount(b.aankomst,b.vertrek);
  const ctrl=b.controle||{id:false,kenteken:false,personen:false};
  document.getElementById('shDetailTitle').textContent=b.naam.split(' ')[0];
  document.getElementById('shDetailBody').innerHTML=`
    <div class="detail-hero">${avHtml(b,60,18)}<div><div class="detail-name">${b.naam}</div><div class="detail-sub"><span class="badge ${sm.cls}">${sm.icon} ${sm.label}</span> <span style="color:var(--lbl4);">#${b.volgnummer??'—'}</span></div></div></div>
    <img class="foto-thumb-lg ${b.foto?'show':''}" style="display:${b.foto?'block':'none'}" data-foto-for="${b.id}" src="${b.foto||''}">
    <div class="detail-actions">
      <button class="da da-g" onclick="openStatusSheet('${b.id}')"><span class="da-icon">🔄</span>Status</button>
      <button class="da da-o" onclick="openEditSheet('${b.id}')"><span class="da-icon">✏️</span>Bewerken</button>
      <button class="da da-b" onclick="prepareMail('${b.id}')"><span class="da-icon">📧</span>Mail</button>
      <button class="da da-r" onclick="deleteBooking('${b.id}')"><span class="da-icon">🗑</span>Verwijder</button>
    </div>
    <div class="detail-actions" style="margin-top:-6px;">
      <button class="da da-g" onclick="sendAutoMail('${b.id}','bevestiging')"><span class="da-icon">✉️</span>Bevestig & mail</button>
      <button class="da" style="background:rgba(255,149,0,.1);color:#FF9500;" onclick="sendAutoMail('${b.id}','herinnering')"><span class="da-icon">🔔</span>Herinnering</button>
      <button class="da da-b" onclick="stuurBetaallink('${b.id}')"><span class="da-icon">💳</span>Betaallink</button>
      <button class="da" style="background:rgba(88,86,214,.1);color:#5856D6;" onclick="toonQR('${b.id}')"><span class="da-icon">📱</span>QR check-in</button>
    </div>
    <div class="detail-rows">
      <div class="detail-r"><span class="dr-k">E-mail</span><span class="dr-v">${b.email||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Telefoon</span><span class="dr-v">${b.telefoon||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">ID-nummer</span><span class="dr-v">${b.idnr||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Nummerplaat</span><span class="dr-v">${b.plaat||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Personen</span><span class="dr-v">${b.personen} (${b.volwassenen??b.personen} vw + ${b.kinderen??0} kind)</span></div>
      <div class="detail-r"><span class="dr-k">Aankomst</span><span class="dr-v">${fmtDateLong(b.aankomst)}</span></div>
      <div class="detail-r"><span class="dr-k">Vertrek</span><span class="dr-v">${fmtDateLong(b.vertrek)}</span></div>
      <div class="detail-r"><span class="dr-k">Nachten</span><span class="dr-v">${nights}</span></div>
      <div class="detail-r"><span class="dr-k">Type</span><span class="dr-v">${VI[b.type]||''} ${b.type}</span></div>
      <div class="detail-r"><span class="dr-k">Benodigdheden</span><span class="dr-v">${[b.hond?'🐕 Hond':'',b.extraAuto?'🚙 Extra auto':'',b.elektriciteit?'⚡ Elektriciteit':''].filter(Boolean).join(', ')||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Kanaal</span><span class="dr-v">${bm.icon||''} ${bm.label||'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Bedrag</span><span class="dr-v">${b.bedrag?'€'+b.bedrag:'—'}</span></div>
      <div class="detail-r"><span class="dr-k">Betaalreferentie</span><span class="dr-v">${genRef(b)}</span></div>
      ${b.nota?`<div class="detail-r"><span class="dr-k">Nota</span><span class="dr-v">${b.nota}</span></div>`:''}
    </div>
    <div class="sg mt16"><div class="sg-lbl">✅ Controle bij boeking</div></div>
    <div class="ctrl-list">
      <div class="ctrl-item"><input type="checkbox" id="ctrlId" ${ctrl.id?'checked':''} onchange="toggleControle('${b.id}','id',this.checked)"><label for="ctrlId">ID-kaart gecontroleerd</label></div>
      <div class="ctrl-item"><input type="checkbox" id="ctrlKent" ${ctrl.kenteken?'checked':''} onchange="toggleControle('${b.id}','kenteken',this.checked)"><label for="ctrlKent">Nummerplaat genoteerd</label></div>
      <div class="ctrl-item"><input type="checkbox" id="ctrlPers" ${ctrl.personen?'checked':''} onchange="toggleControle('${b.id}','personen',this.checked)"><label for="ctrlPers">Aantal personen bevestigd</label></div>
    </div>
    <div class="sg mt16">
      <div class="sg-lbl">👥 Gasten <span style="font-weight:500;color:var(--lbl4);font-size:11px;">(politie/brandweer register)</span></div>
      <button onclick="openAddGuestSheet('${b.id}')" style="margin:0 16px 10px;padding:8px 14px;background:var(--green);color:#fff;border-radius:var(--r-sm);font-size:13px;font-weight:700;border:none;cursor:pointer;display:block;">+ Gast toevoegen</button>
    </div>
    <div id="gastenList" style="padding:0 16px 4px;">Laden…</div>

    <div class="sg mt16">
      <div class="sg-lbl">📸 Foto's</div>
      <label style="margin:0 16px 10px;padding:8px 14px;background:var(--bg);border:1.5px dashed var(--sep);border-radius:var(--r-sm);font-size:13px;font-weight:600;color:var(--green);cursor:pointer;display:block;text-align:center;">
        + Foto('s) toevoegen
        <input type="file" accept="image/*" multiple capture="environment" style="display:none" onchange="uploadBookingFotos('${b.id}',this)">
      </label>
    </div>
    <div id="fotoGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 16px 16px;">Laden…</div>

    <div class="sg mt16"><div class="sg-lbl">📧 E-mailgeschiedenis</div></div>
    <div id="commHistory" style="padding:0 16px 16px;font-size:13px;color:var(--lbl3);">Laden…</div>
    <div style="height:16px;"></div>`;
  openSheet('shDetail');
  loadCommHistory(b.id);
  loadGasten(b.id);
  loadFotos(b.id);
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
  document.getElementById('eNaam').value=b.naam;
  document.getElementById('ePlaat').value=b.plaat;
  document.getElementById('eVolwassenen').value=b.volwassenen??b.personen;
  document.getElementById('eKinderen').value=b.kinderen??0;
  document.getElementById('eAankomst').value=b.aankomst;
  document.getElementById('eVertrek').value=b.vertrek;
  document.getElementById('eTenten').value=b.tenten??1;
  document.getElementById('eCampers').value=b.campers??0;
  document.getElementById('eHonden').value=b.honden??0;
  document.getElementById('eBron').value=b.bron;
  document.getElementById('eBedrag').value=b.bedrag;
  document.getElementById('eNota').value=b.nota;
  document.getElementById('eExtraAuto').checked=!!b.extraAuto;
  document.getElementById('eElektriciteit').checked=!!b.elektriciteit;
  eFotoData=b.foto||null;
  const img=document.getElementById('eFotoPreview');
  if(b.foto){img.src=b.foto;img.classList.add('show')}else{img.classList.remove('show')}
  updatePriceLiveEdit();
  closeSheet('shDetail');openSheet('shEdit')
}
async function saveEdit(){
  const b=bookings.find(x=>x.id===editingId);if(!b)return;
  const naam=document.getElementById('eNaam').value.trim();
  const aankomst=document.getElementById('eAankomst').value;
  const vertrek=document.getElementById('eVertrek').value;
  const tenten=parseInt(document.getElementById('eTenten').value)||0;
  const campers=parseInt(document.getElementById('eCampers').value)||0;
  const honden=parseInt(document.getElementById('eHonden').value)||0;
  const volwassenen=parseInt(document.getElementById('eVolwassenen').value)||0;
  const kinderen=parseInt(document.getElementById('eKinderen').value)||0;
  const plaat=document.getElementById('ePlaat').value.trim();
  const bron=document.getElementById('eBron').value;
  const bedrag=parseFloat(document.getElementById('eBedrag').value)||0;
  const nota=document.getElementById('eNota').value.trim();
  const extraAuto=document.getElementById('eExtraAuto').checked;
  const elektriciteit=document.getElementById('eElektriciteit').checked;
  if(!naam||!aankomst||!vertrek){toast('⚠️ Vul naam en datums in');return}
  if(tenten+campers<1){toast('⚠️ Minstens 1 tent of camper verplicht');return}
  if(aankomst>=vertrek){toast('⚠️ Vertrek moet na aankomst zijn');return}
  if(volwassenen+kinderen<1){toast('⚠️ Minstens 1 persoon is verplicht');return}
  const {error:bErr}=await sb.from('bookings').update({
    aankomst,vertrek,tenten,campers,
    volwassenen,kinderen,honden,autos:extraAuto?2:1,
    elektriciteit,bron,bedrag_totaal:bedrag,nota
  }).eq('id',b.id);
  if(bErr){toast('⚠️ Opslaan mislukt: '+bErr.message);return}
  if(b.clientId){
    const {error:cErr}=await sb.from('clients').update({naam,nummerplaten:plaat}).eq('id',b.clientId);
    if(cErr)toast('⚠️ Klantgegevens opslaan mislukt: '+cErr.message)
  }
  closeSheet('shEdit');toast('✅ Boeking bijgewerkt!');
  await loadData()
}

/* ═══════════ PRIJS LIVE ═══════════ */
function priceBreakdownHtml(p){
  if(!p)return'<div class="price-row muted"><span>Vul aankomst, vertrek en eenheden in om prijs te berekenen…</span></div>';
  const personenKost=(volw,kind)=>(volw*PRICES.volwassene+kind*PRICES.kind)*p.nights;
  return`
    <div class="price-row"><span>🏕️ Verblijf — ${p.eenheden} eenheid${p.eenheden===1?'':'en'} × ${p.nights} nacht${p.nights===1?'':'en'}</span><span>€${(p.basis*p.nights).toFixed(2)}</span></div>
    <div class="price-row"><span>👥 Personen (${p.personen}p × ${p.nights}n)</span><span>€${((p.perNacht-p.basis-p.taks-(p.extraAutos||0)*PRICES.extraAuto-(p.honden||0)*PRICES.hond)*p.nights).toFixed(2)}</span></div>
    ${(p.honden||0)>0?`<div class="price-row"><span>🐕 Honden (${p.honden} × ${p.nights}n)</span><span>€${(p.honden*PRICES.hond*p.nights).toFixed(2)}</span></div>`:''}
    ${(p.extraAutos||0)>0?`<div class="price-row"><span>🚗 Extra auto's (${p.extraAutos} × ${p.nights}n)</span><span>€${(p.extraAutos*PRICES.extraAuto*p.nights).toFixed(2)}</span></div>`:''}
    <div class="price-row"><span>🗑️ Afvalbijdrage (eenmalig)</span><span>€${p.afval.toFixed(2)}</span></div>
    <div class="price-row"><span>🏛️ Toeristentaks (BTW-vrij)</span><span>€${p.taks_totaal.toFixed(2)}</span></div>
    <div class="price-row"><span>📊 BTW 12% (campingdiensten)</span><span>€${p.btw.toFixed(2)}</span></div>
    ${p.elek?`<div class="price-row"><span>⚡ Elektriciteit (eenmalig)</span><span>€${p.elek.toFixed(2)}</span></div>`:''}
    <div class="price-row total"><span>Totaal</span><span>€${p.totaal.toFixed(2)}</span></div>`
}
function stepField(id,delta){
  const el=document.getElementById(id);
  const min=parseInt(el.min)||0,max=parseInt(el.max)||99;
  el.value=Math.min(max,Math.max(min,(parseInt(el.value)||0)+delta));
  updatePriceLive();updatePriceLiveEdit();
}
function readPriceInputs(prefix){
  const g=id=>document.getElementById(prefix+id);
  const aankomst=g('Aankomst')?.value,vertrek=g('Vertrek')?.value;
  if(!aankomst||!vertrek||aankomst>=vertrek)return null;
  const tenten=parseInt(g('Tenten')?.value)||0;
  const campers=parseInt(g('Campers')?.value)||0;
  if(tenten+campers<1)return null;
  return calcPrice({
    tenten,campers,nights:nightCount(aankomst,vertrek),
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
  const tenten=parseInt(document.getElementById('fTenten').value)||0;
  const campers=parseInt(document.getElementById('fCampers').value)||0;
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
  if(tenten+campers<1){toast('⚠️ Voeg minstens 1 tent of camper toe');return}
  if(volwassenen+kinderen+baby<1){toast('⚠️ Minstens 1 persoon is verplicht');return}
  // Capaciteitscontrole (vergunde max. plaatsen conform Logiesdecreet)
  const maxPlaatsen=parseInt(document.getElementById('tarMaxPlaatsen')?.value)||0;
  if(maxPlaatsen>0){
    const bezet=bookings.filter(b=>b.aankomst<vertrek&&b.vertrek>aankomst&&b.status!=='geannuleerd')
      .reduce((s,b)=>s+(b.tenten||0)+(b.campers||0),0);
    if(bezet+tenten+campers>maxPlaatsen){toast(`⚠️ Max. capaciteit overschreden: ${bezet} van ${maxPlaatsen} plaatsen bezet`);return}
  }
  const clientEmail=email||`geen-email+${Date.now()}@cosmopolite.local`;
  const {data:client,error:cErr}=await sb.from('clients').insert({naam,nummerplaten:plaat,email:clientEmail}).select().single();
  if(cErr){toast('⚠️ Klant aanmaken mislukt: '+cErr.message);return}
  const {error:bErr}=await sb.from('bookings').insert({
    client_id:client.id,aankomst,vertrek,tenten,campers,
    volwassenen,kinderen,baby,honden,autos,elektriciteit,
    bron,bedrag_totaal:bedrag,nota,status:'aanvraag'
  });
  if(bErr){toast('⚠️ Boeking opslaan mislukt: '+bErr.message);return}
  ['fNaam','fEmail','fPlaat','fAankomst','fVertrek','fBedrag','fNota','fID'].forEach(f=>document.getElementById(f)&&(document.getElementById(f).value=''));
  document.getElementById('fVolwassenen').value=2;
  document.getElementById('fKinderen').value=0;
  document.getElementById('fBaby').value=0;
  document.getElementById('fAutos').value=1;
  document.getElementById('fTenten').value=1;
  document.getElementById('fCampers').value=0;
  document.getElementById('fHonden').value=0;
  document.getElementById('fBron').value='';
  document.getElementById('fElektriciteit').checked=false;
  document.getElementById('fFotoPreview').classList.remove('show');fFotoData=null;
  document.getElementById('priceBreakdown').innerHTML=priceBreakdownHtml(null);
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
  const n=values.length;const w=Math.max(n*70,280);
  const bw=Math.floor(w/n)-14;
  let bars='';
  values.forEach((v,i)=>{
    const bh=Math.max(4,Math.round(v/max*(h-34)));
    const x=i*(bw+14)+10;const y=h-26-bh;
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="5" fill="${colors[i%colors.length]}"/>`;
    bars+=`<text x="${x+bw/2}" y="${y-6}" font-size="11" font-weight="700" fill="#1C1C1E" text-anchor="middle">${v}</text>`;
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
  document.getElementById('chartChannel').innerHTML=chCounts.some(c=>c>0)
    ?svgBars(chCounts,['E-mail','Website','Telefoon'],['#007AFF','#1B8A5B','#FF9500'])
    :'<div style="text-align:center;padding:24px 0;color:var(--lbl4);font-size:13px;">Nog geen boekingen</div>';

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
const GANTT_DAYS=18;
const GANTT_ROW=46;
const GANTT_NAME_W=120;
const GANTT_COLORS={bevestigd:'#34C759',aanvraag:'#FF9500',ingecheckt:'#007AFF',betaald:'#5856D6',wachtlijst:'#8E8E93',geannuleerd:'#FF3B30'};
const NL_MONTHS_S=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const NL_DAYS_S=['zo','ma','di','wo','do','vr','za'];

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
          <div style="flex:1;position:relative;height:${GANTT_ROW-12}px;">
            <div style="position:absolute;left:${lPct}%;width:${Math.max(wPct,.5)}%;top:50%;transform:translateY(-50%);height:28px;background:${color};border-radius:7px;display:flex;align-items:center;padding:0 9px;overflow:hidden;box-shadow:0 2px 6px ${color}44;" title="${b.naam} · ${b.aankomst} → ${b.vertrek}">
              <span style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.naam||'—'}${b.plaat?' · '+b.plaat:''}</span>
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

/* ═══════════ OLD MONTH CALENDAR (kept for day-detail sheet) ═══════════ */
function prevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCalendar()}
function nextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCalendar()}

function renderCalendar_monthView(){
  const DAYS=['Ma','Di','Wo','Do','Vr','Za','Zo'];
  const MONTHS=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
  document.getElementById('calMonth').textContent=`${MONTHS[calMonth]} ${calYear}`;
  const offset=(new Date(calYear,calMonth,1).getDay()+6)%7;
  const dim=new Date(calYear,calMonth+1,0).getDate();
  // Build event map: key=day, val={arrivals:[],departures:[]}
  const evMap={};
  bookings.forEach(b=>{
    const[ay,am,ad]=b.aankomst.split('-').map(Number);
    const[vy,vm,vd]=b.vertrek.split('-').map(Number);
    if(ay===calYear&&am-1===calMonth){
      if(!evMap[ad])evMap[ad]={arr:[],dep:[]};evMap[ad].arr.push(b)
    }
    if(vy===calYear&&vm-1===calMonth){
      if(!evMap[vd])evMap[vd]={arr:[],dep:[]};evMap[vd].dep.push(b)
    }
  });
  const td=new Date(TODAY);
  let html=DAYS.map(d=>`<div class="cal-dh">${d}</div>`).join('');
  for(let i=0;i<offset;i++)html+=`<div></div>`;
  for(let d=1;d<=dim;d++){
    const ev=evMap[d];
    const isToday=(calYear===td.getFullYear()&&calMonth===td.getMonth()&&d===td.getDate());
    const hasEv=ev&&(ev.arr.length||ev.dep.length);
    const cls=[isToday?'today':'',hasEv?'has-ev':''].join(' ');
    let minis='';
    if(ev){
      minis='<div class="cal-minis">';
      ev.arr.slice(0,2).forEach(b=>{
        const c=avColor(b.id);
        minis+=`<div class="cal-mini" style="background:${c.bg};color:${c.fg};">${b.naam[0]}</div>`
      });
      if(ev.arr.length>2)minis+=`<div class="cal-mini" style="background:rgba(52,199,89,.15);color:#1A7A35;">+${ev.arr.length-2}</div>`;
      ev.dep.slice(0,1).forEach(b=>{
        minis+=`<div class="cal-dep-chip">→</div>`
      });
      minis+='</div>'
    }
    const clickFn=hasEv?`openDayDetail(${d})`:'';
    html+=`<div class="cal-d ${cls}" ${clickFn?`onclick="${clickFn}"`:''}><div class="cal-d-num">${d}</div>${minis}</div>`
  }
  document.getElementById('calGrid').innerHTML=html
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
    html+=ev.arr.map(b=>`<div class="day-ev-row">${avHtml(b,36,10)}<div><div class="day-ev-name">${b.naam} <span style="color:var(--lbl4);font-weight:400;font-size:12px;">#${b.volgnummer??'—'}</span></div><div class="day-ev-meta">${b.personen} pers · ${VI[b.type]||'⛺'} ${b.type} · <span class="badge ${STATUS_META[b.status].cls}" style="font-size:10px;padding:1px 6px;">${STATUS_META[b.status].label}</span></div></div></div>`).join('');
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
function renderWieIsEr(){
  const el=document.getElementById('wieIsErList');if(!el)return;
  const list=bookings.filter(b=>b.status==='ingecheckt'||b.status==='betaald');
  if(!list.length){el.innerHTML='<div class="oc-none" style="padding:20px 0;">Geen gasten aanwezig</div>';return}
  el.innerHTML=list.map((b,i)=>{
    const fotoHtml=b.foto
      ?`<img src="${b.foto}" style="width:44px;height:44px;border-radius:12px;object-fit:cover;flex-shrink:0;" data-foto-for="${b.id}">`
      :`<div style="width:44px;height:44px;border-radius:12px;background:${avColor(b.id).bg};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:${avColor(b.id).fg};flex-shrink:0;">${(b.naam||'?')[0].toUpperCase()}</div>`;
    const verblijf=[(b.tenten||0)>0?`${b.tenten}⛺`:'',(b.campers||0)>0?`${b.campers}🚐`:''].filter(Boolean).join(' ');
    const nights=nightCount(b.aankomst,b.vertrek);
    const vertrekDate=new Date(b.vertrek);
    const today=new Date(TODAY);
    const daysLeft=Math.round((vertrekDate-today)/86400000);
    const daysTag=daysLeft===0?'<span style="color:var(--red);font-weight:700;">Vandaag weg!</span>':daysLeft===1?'<span style="color:#FF9500;font-weight:700;">Morgen weg</span>':`nog ${daysLeft} nachten`;
    return`<div class="plist-row" onclick="openBookingDetail('${b.id}')" style="cursor:pointer;align-items:flex-start;padding:12px 16px;">
      ${fotoHtml}
      <div style="flex:1;min-width:0;margin-left:12px;">
        <div style="font-size:15px;font-weight:700;color:var(--lbl1);">${b.naam} <span style="color:var(--lbl4);font-weight:400;font-size:12px;">#${b.volgnummer??'—'}</span></div>
        <div style="font-size:12px;color:var(--lbl3);margin-top:2px;">${b.personen}p · ${verblijf} · ${nights}n · ${fmtDate(b.aankomst)}→${fmtDate(b.vertrek)}</div>
        <div style="font-size:11px;margin-top:3px;">${daysTag}</div>
        ${b.plaat?`<div style="font-size:11px;color:var(--lbl4);margin-top:2px;">🚗 ${b.plaat}</div>`:''}
      </div>
      <div style="font-size:10px;padding:3px 8px;border-radius:20px;background:${b.status==='ingecheckt'?'rgba(0,122,255,.1)':'rgba(88,86,214,.1)'};color:${b.status==='ingecheckt'?'#007AFF':'#5856D6'};font-weight:700;flex-shrink:0;">${b.status==='ingecheckt'?'🏕️ Aanwezig':'💶 Betaald'}</div>
    </div>`;
  }).join('')
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
  const {data:gasten}=await sb.from('gasten').select('*').in('booking_id',bookingIds);
  const gastenByBooking={};
  (gasten||[]).forEach(g=>{
    if(!gastenByBooking[g.booking_id])gastenByBooking[g.booking_id]=[];
    gastenByBooking[g.booking_id].push(g);
  });

  // Bouw rijen: hoofdgast (uit boeking) + extra gasten
  const rows=[];
  activeBookings.forEach(b=>{
    const n=splitNaam(b.naam);
    const extraGasten=gastenByBooking[b.id]||[];
    const hasGasten=extraGasten.length>0;
    // Hoofdgast uit boeking zelf
    rows.push({
      volgnummer:b.volgnummer, voornaam:n.voornaam, achternaam:n.achternaam,
      geboortedatum:b.geboortedatum, nationaliteit:b.nationaliteit,
      idnr:b.idnr, nummerplaat:b.plaat, woonplaats:b.woonplaats,
      aankomst:b.aankomst, vertrek:b.vertrek,
      rol:hasGasten?'Hoofdgast':'—', warning:!b.idnr
    });
    // Extra gasten uit gasten-tabel
    extraGasten.forEach(g=>{
      const gn=splitNaam(g.naam);
      rows.push({
        volgnummer:b.volgnummer, voornaam:gn.voornaam, achternaam:gn.achternaam,
        geboortedatum:g.geboortedatum, nationaliteit:g.nationaliteit,
        idnr:g.id_nummer, nummerplaat:g.nummerplaat, woonplaats:'',
        aankomst:b.aankomst, vertrek:b.vertrek,
        rol:g.is_hoofdgast?'Hoofdgast':'Meereizend', warning:!g.id_nummer
      });
    });
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
        <th style="padding:8px 6px;">Nationaliteit</th>
        <th style="padding:8px 6px;">ID-nummer</th>
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
        <td style="padding:7px 6px;">${r.nationaliteit||'—'}</td>
        <td style="padding:7px 6px;${!r.idnr?'color:var(--red);font-weight:600;':''}">${r.idnr||'❌ ontbreekt'}</td>
        <td style="padding:7px 6px;font-family:monospace;">${r.nummerplaat||'—'}</td>
        <td style="padding:7px 6px;">${fmtDateLong(r.aankomst)}</td>
        <td style="padding:7px 6px;">${fmtDateLong(r.vertrek)}</td>
        <td style="padding:7px 6px;color:var(--lbl3);font-size:11px;">${r.rol}</td>
      </tr>`).join('')}
      </tbody>
    </table></div>
    <div style="font-size:11px;color:var(--lbl4);margin-top:8px;">${rows.length} pers. geregistreerd op ${fmtDateLong(date)} (${activeBookings.length} boekingen)</div>`
}
function printRegister(){
  const date=document.getElementById('registerDate').value||TODAY;
  const list=registerEntries(date);
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Register Toeristenverblijf — Cosmopolite — ${date}</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;max-width:1100px;margin:0 auto}
  h1{color:#1B8A5B;margin-bottom:4px;font-size:20px}
  .sub{color:#666;margin-bottom:20px;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th{background:#1B8A5B;color:#fff;padding:8px 8px;text-align:left;font-size:11px}
  td{padding:7px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even) td{background:#f9f9f9}
  .footer{margin-top:20px;font-size:10.5px;color:#999;border-top:1px solid #eee;padding-top:8px}
  @media print{.no-print{display:none}}</style></head><body>
  <h1>🛂 Camping Cosmopolite — Register Toeristenverblijf</h1>
  <div class="sub">Datum: ${fmtDateLong(date)} · ${list.length} gast${list.length!==1?'en':''} · conform wettelijke registratieplicht toeristenverblijven</div>
  <table><tr><th>#</th><th>Voornaam</th><th>Achternaam</th><th>Geboortedatum</th><th>Nationaliteit</th><th>ID-nummer</th><th>Woonplaats</th><th>Aankomst</th><th>Vertrek</th></tr>
  ${list.map(b=>{const n=splitNaam(b.naam);return`<tr><td>#${b.volgnummer??'—'}</td><td>${n.voornaam}</td><td>${n.achternaam}</td><td>${b.geboortedatum?fmtDateLong(b.geboortedatum):'—'}</td><td>${b.nationaliteit||'—'}</td><td>${b.idnr||'—'}</td><td>${b.woonplaats||'—'}</td><td>${fmtDateLong(b.aankomst)}</td><td>${fmtDateLong(b.vertrek)}</td></tr>`}).join('')}
  </table>
  <div class="footer">Camping Cosmopolite · Register Toeristenverblijf · Afgedrukt op ${fmtDateLong(TODAY)}</div>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close()
}
async function exportRegisterCSV(){
  const date=document.getElementById('registerDate').value||TODAY;
  const activeBookings=registerEntries(date);
  const rows=[['Volgnummer','Voornaam','Achternaam','Geboortedatum','Nationaliteit','ID-nummer','Woonplaats','Aankomst','Vertrek','Rol']];
  // Haal ook gasten op uit de gasten-tabel
  const bookingIds=activeBookings.map(b=>b.id);
  let gastenMap={};
  if(bookingIds.length){
    const {data:gasten}=await sb.from('gasten').select('*').in('booking_id',bookingIds);
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
  if(!confirm('Betaallink aanmaken via Mollie en sturen naar klant?')) return;
  toast('⏳ Betaallink aanmaken…');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/create-payment`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify({booking_id:bookingId}),
  });
  const data=await res.json();
  if(data.error){toast('⚠️ '+data.error);return}
  // Stuur ook mail met betaallink
  await sendAutoMail(bookingId,'betaallink');
  navigator.clipboard?.writeText(data.checkout_url);
  toast('✅ Betaallink aangemaakt & gekopieerd!');
}

let currentQrUrl='';
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
  // Juridische instellingen laden
  ['cfgKBO','cfgBTW','cfgAdres','cfgGemeente','cfgAnnulering'].forEach(id=>{
    const el=document.getElementById(id);if(el&&cfg[id.replace('cfg','').toLowerCase()])el.value=cfg[id.replace('cfg','').toLowerCase()];
  });
  if(cfg.kbo){const el=document.getElementById('cfgKBO');if(el)el.value=cfg.kbo;}
  if(cfg.btw_nummer){const el=document.getElementById('cfgBTW');if(el)el.value=cfg.btw_nummer;}
  if(cfg.adres){const el=document.getElementById('cfgAdres');if(el)el.value=cfg.adres;}
  if(cfg.gemeente){const el=document.getElementById('cfgGemeente');if(el)el.value=cfg.gemeente;}
  if(cfg.annulering_beleid){const el=document.getElementById('cfgAnnulering');if(el)el.value=cfg.annulering_beleid;}

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
      ['max_plaatsen',PRICES.maxPlaatsen]];
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
async function loadGasten(bookingId){
  const el=document.getElementById('gastenList');if(!el)return;
  const {data,error}=await sb.from('gasten').select('*').eq('booking_id',bookingId).order('is_hoofdgast',{ascending:false}).order('created_at');
  if(error){el.textContent='Kon gasten niet laden';return}
  if(!data||!data.length){el.innerHTML='<div style="padding:4px 0 12px;font-size:13px;color:var(--lbl4);">Nog geen gasten toegevoegd</div>';return}
  el.innerHTML=data.map(g=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:.5px solid var(--sep);">
      ${g.foto_url?`<img src="${g.foto_url}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        :`<div style="width:38px;height:38px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">👤</div>`}
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--lbl1);">${g.naam}${g.is_hoofdgast?' <span style="font-size:10px;background:var(--green);color:#fff;padding:2px 6px;border-radius:8px;margin-left:4px;">Hoofd</span>':''}</div>
        <div style="font-size:11.5px;color:var(--lbl3);margin-top:1px;">${[g.geboortedatum?fmtDateLong(g.geboortedatum):'',g.nationaliteit||'',g.id_nummer||''].filter(Boolean).join(' · ')||'Geen details'}</div>
        ${g.nummerplaat?`<div style="font-size:11px;color:var(--lbl4);font-family:monospace;">${g.nummerplaat}</div>`:''}
      </div>
      <button onclick="deleteGast('${g.id}','${bookingId}')" style="color:var(--red);font-size:18px;padding:4px;background:none;border:none;cursor:pointer;flex-shrink:0;">✕</button>
    </div>`).join('')
}

async function deleteGast(gastId,bookingId){
  await sb.from('gasten').delete().eq('id',gastId);
  loadGasten(bookingId);
}

function openAddGuestSheet(bookingId){
  document.getElementById('addGuestBookingId').value=bookingId;
  document.getElementById('addGuestForm').reset();
  document.getElementById('guestFotoPreview').style.display='none';
  document.getElementById('addGuestMsg').textContent='';
  openSheet('shAddGuest');
}

async function saveGuest(){
  const bookingId=document.getElementById('addGuestBookingId').value;
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
    // ID-foto upload niet toegestaan (GDPR art. 5.1.c dataminimalisatie)
    await sb.from('gasten').insert({booking_id:bookingId,naam,geboortedatum,nationaliteit,id_nummer,nummerplaat,is_hoofdgast});
    closeSheet('shAddGuest');
    loadGasten(bookingId);
    toast('✅ Gast toegevoegd');
  }catch(err){
    document.getElementById('addGuestMsg').textContent='⚠️ '+err.message;
  }finally{btn.textContent='Opslaan';btn.disabled=false;}
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
