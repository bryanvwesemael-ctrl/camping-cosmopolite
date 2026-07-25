/* ============================================================================
 * Camping Cosmopolite — WEBSITE-BOUWER (Beheer → Website)
 * ----------------------------------------------------------------------------
 * Blok-gebaseerde paginabouwer waarmee Karen de publieke website zelf beheert:
 * blokken (widgets) toevoegen, bewerken, verslepen en verwijderen — tweetalig
 * (NL/FR) — met foto-upload en een live preview. Rendert de preview met exact
 * dezelfde CampingWebsite-renderer als de publieke site.
 *
 * Leunt op globals uit app-nieuw.js: sb, SUPABASE_URL, esc, toast, PRICES,
 * accTypes. Reordenen gebruikt SortableJS (CDN). Enkel admins zien deze tab.
 * ========================================================================== */
let wbPaginas = [], wbSlug = null, wbBlokken = [], wbLang = 'nl', wbSortable = null;

async function renderBeheerWebsite() {
  const el = document.getElementById('beheerBody');
  el.innerHTML = '<div class="note-inline">Laden…</div>';
  const { data, error } = await sb.from('website_paginas').select('*').order('volgorde');
  if (error) { el.innerHTML = '<div class="note-inline" style="color:var(--red)">⚠️ ' + esc(error.message) + '</div>'; return; }
  wbPaginas = data || [];
  if (!wbSlug || !wbPaginas.find(p => p.slug === wbSlug)) wbSlug = wbPaginas.length ? wbPaginas[0].slug : null;
  const cur = wbPaginas.find(p => p.slug === wbSlug);
  wbBlokken = cur ? JSON.parse(JSON.stringify(cur.blokken || [])) : [];

  const tabs = wbPaginas.map(p =>
    '<button class="ft' + (p.slug === wbSlug ? ' on' : '') + '" onclick="wbSelectPagina(\'' + p.slug + '\')">' +
    esc(p.titel_nl || p.slug) + (p.zichtbaar ? '' : ' 🚫') + '</button>').join('');

  el.innerHTML =
    '<div class="note-inline" style="margin-bottom:10px;">Kies een pagina, sleep en bewerk de blokken. Vergeet niet <b>Opslaan</b> onderaan.</div>' +
    '<div class="foldertabs" style="flex-wrap:wrap;margin-bottom:12px;">' + tabs + '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="statusgrid" style="padding:0;grid-template-columns:1fr 1fr;flex:0 0 auto;width:180px;">' +
    '<div class="sbtn' + (wbLang === 'nl' ? ' act' : '') + '" onclick="wbSetLang(\'nl\')">🇳🇱 NL</div>' +
    '<div class="sbtn' + (wbLang === 'fr' ? ' act' : '') + '" onclick="wbSetLang(\'fr\')">🇫🇷 FR</div>' +
    '</div>' +
    '<button class="sbtn" style="flex:0 0 auto;" onclick="wbPreview()">👁️ Voorbeeld</button>' +
    '<label style="font-size:12.5px;color:var(--ink-2);display:flex;align-items:center;gap:6px;margin-left:auto;"><input type="checkbox" id="wbZichtbaar" ' + (cur && cur.zichtbaar ? 'checked' : '') + '> Zichtbaar op site</label>' +
    '</div>' +
    '<div id="wbBlokken"></div>' +
    wbPalette() +
    '<button class="modal-save" style="margin-top:14px;" onclick="wbSave()">💾 Pagina opslaan</button>' +
    '<div id="wbMsg" class="note-inline"></div>';

  wbRenderBlokken();
}

function wbSelectPagina(slug) { wbSlug = slug; renderBeheerWebsite(); }
function wbSetLang(l) { wbLang = l; renderBeheerWebsite(); }

const WB_TYPES = [
  ['kop', '🏔️ Kop / hero'], ['titel', '🔠 Titel'], ['tekst', '📝 Tekst'],
  ['foto', '🖼️ Foto'], ['galerij', '🖼️ Fotogalerij'], ['kaarten', '🃏 Info-kaarten'],
  ['knop', '🔘 Knop'], ['tarieven', '💶 Tarieven (live)'], ['nieuws', '📣 Nieuws / drop-ins'],
  ['contact', '📞 Contact'], ['ruimte', '⬜ Ruimte']
];
function wbPalette() {
  return '<div class="card" style="padding:12px;margin-top:12px;">' +
    '<div class="sec-lbl" style="margin-top:0;">➕ Blok toevoegen</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
    WB_TYPES.map(t => '<button class="sbtn" style="flex:0 0 auto;font-size:12px;" onclick="wbAddBlok(\'' + t[0] + '\')">' + t[1] + '</button>').join('') +
    '</div></div>';
}
function wbAddBlok(type) {
  const nieuw = { type };
  if (type === 'kaarten') nieuw.items = [{ emoji: '⭐', titel_nl: '', titel_fr: '', tekst_nl: '', tekst_fr: '' }];
  if (type === 'nieuws') nieuw.items = [{ datum: '', titel_nl: '', titel_fr: '', tekst_nl: '', tekst_fr: '' }];
  if (type === 'galerij') nieuw.urls = [];
  wbBlokken.push(nieuw); wbRenderBlokken();
  const c = document.getElementById('wbBlokken'); if (c) c.lastElementChild && c.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function wbDelBlok(i) { if (!confirm('Dit blok verwijderen?')) return; wbBlokken.splice(i, 1); wbRenderBlokken(); }

// Tweetalig tekstveld: bewerkt _nl of _fr afhankelijk van de taalknop bovenaan.
function wbTxt(i, veld, label, ph) {
  const b = wbBlokken[i], k = veld + '_' + wbLang;
  return '<div class="fld"><label>' + esc(label) + ' <span style="color:var(--ink-3);">(' + wbLang.toUpperCase() + ')</span></label>' +
    '<input value="' + esc(b[k] || '') + '" placeholder="' + esc(ph || '') + '" oninput="wbBlokken[' + i + '][\'' + k + '\']=this.value"></div>';
}
function wbRich(i, label) {
  const b = wbBlokken[i], k = 'html_' + wbLang;
  return '<div class="fld"><label>' + esc(label) + ' <span style="color:var(--ink-3);">(' + wbLang.toUpperCase() + ')</span></label>' +
    '<div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;">' +
    '<button type="button" class="sbtn" style="flex:0 0 auto;padding:4px 9px;font-weight:800;" onmousedown="event.preventDefault();document.execCommand(\'bold\')">B</button>' +
    '<button type="button" class="sbtn" style="flex:0 0 auto;padding:4px 9px;font-style:italic;" onmousedown="event.preventDefault();document.execCommand(\'italic\')">I</button>' +
    '<button type="button" class="sbtn" style="flex:0 0 auto;padding:4px 9px;" onmousedown="event.preventDefault();document.execCommand(\'formatBlock\',false,\'h3\')">Titel</button>' +
    '<button type="button" class="sbtn" style="flex:0 0 auto;padding:4px 9px;" onmousedown="event.preventDefault();document.execCommand(\'insertUnorderedList\')">• Lijst</button>' +
    '<button type="button" class="sbtn" style="flex:0 0 auto;padding:4px 9px;" onmousedown="event.preventDefault();var u=prompt(\'Link (https://...)\');if(u)document.execCommand(\'createLink\',false,u)">🔗</button>' +
    '</div>' +
    '<div contenteditable="true" class="wb-rich" oninput="wbBlokken[' + i + '][\'' + k + '\']=this.innerHTML" ' +
    'style="min-height:70px;padding:10px;border:1px solid var(--sep);border-radius:9px;background:var(--card-2);color:var(--ink);font-size:14px;">' + (b[k] || '') + '</div></div>';
}
function wbFotoVeld(i, veld, label) {
  const b = wbBlokken[i], url = b[veld] || '';
  return '<div class="fld"><label>' + esc(label) + '</label>' +
    (url ? '<img src="' + esc(url) + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:9px;margin-bottom:6px;">' : '') +
    '<input type="file" accept="image/*" onchange="wbUpload(this,' + i + ',\'' + veld + '\')" style="font-size:12px;">' +
    (url ? '<button class="sbtn" style="margin-top:6px;" onclick="wbBlokken[' + i + '].' + veld + '=\'\';wbRenderBlokken()">Foto verwijderen</button>' : '') +
    '</div>';
}

function wbBlokEditor(b, i) {
  let inner = '';
  switch (b.type) {
    case 'kop': inner = wbTxt(i, 'titel', 'Titel', 'Camping Cosmopolite') + wbTxt(i, 'ondertitel', 'Ondertitel') + wbFotoVeld(i, 'foto', 'Achtergrondfoto (optioneel)'); break;
    case 'titel': inner = wbTxt(i, 'tekst', 'Titel'); break;
    case 'tekst': inner = wbRich(i, 'Tekst'); break;
    case 'foto': inner = wbFotoVeld(i, 'url', 'Foto') + wbTxt(i, 'bijschrift', 'Bijschrift (optioneel)'); break;
    case 'galerij': inner = wbGalerijEditor(b, i); break;
    case 'kaarten': inner = wbItemsEditor(b, i, 'kaart'); break;
    case 'nieuws': inner = wbItemsEditor(b, i, 'nieuws'); break;
    case 'knop': inner = wbTxt(i, 'tekst', 'Knoptekst', 'Reserveer nu') +
      '<div class="fld"><label>Link</label><input value="' + esc(b.url || '') + '" placeholder="/reserveren/" oninput="wbBlokken[' + i + '].url=this.value"></div>'; break;
    case 'tarieven': inner = '<div class="note-inline">Toont automatisch de actuele tarieven uit Beheer → Tarieven. Niets in te vullen.</div>'; break;
    case 'contact': inner = '<div class="note-inline" style="margin-bottom:8px;">Leeg laten = gebruikt de standaard campinggegevens. Vul in om te overschrijven.</div>' +
      '<div class="fld"><label>Adres</label><input value="' + esc(b.adres || '') + '" oninput="wbBlokken[' + i + '].adres=this.value"></div>' +
      '<div class="fld"><label>Telefoon</label><input value="' + esc(b.tel || '') + '" oninput="wbBlokken[' + i + '].tel=this.value"></div>' +
      '<div class="fld"><label>E-mail</label><input value="' + esc(b.email || '') + '" oninput="wbBlokken[' + i + '].email=this.value"></div>' +
      '<div class="fld"><label>Instagram (zonder @)</label><input value="' + esc(b.instagram || '') + '" oninput="wbBlokken[' + i + '].instagram=this.value"></div>'; break;
    case 'ruimte': inner = '<div class="note-inline">Lege ruimte tussen blokken.</div>'; break;
    default: inner = '<div class="note-inline">Onbekend blok.</div>';
  }
  const lbl = (WB_TYPES.find(t => t[0] === b.type) || [b.type, b.type])[1];
  return '<div class="card wb-blok" style="padding:12px;margin-bottom:10px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
    '<span class="wb-drag" style="cursor:grab;font-size:18px;color:var(--ink-3);" title="Versleep">⠿</span>' +
    '<b style="flex:1;font-size:13px;">' + esc(lbl) + '</b>' +
    '<button onclick="wbDelBlok(' + i + ')" style="background:var(--red-soft);color:var(--red);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;">🗑</button>' +
    '</div>' + inner + '</div>';
}
function wbGalerijEditor(b, i) {
  const imgs = (b.urls || []).map((u, j) =>
    '<div style="position:relative;"><img src="' + esc(u) + '" style="width:70px;height:70px;object-fit:cover;border-radius:8px;">' +
    '<button onclick="wbBlokken[' + i + '].urls.splice(' + j + ',1);wbRenderBlokken()" style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px;">✕</button></div>'
  ).join('');
  return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' + imgs + '</div>' +
    '<input type="file" accept="image/*" multiple onchange="wbUploadGalerij(this,' + i + ')" style="font-size:12px;">';
}
function wbItemsEditor(b, i, soort) {
  const items = (b.items || []).map((it, j) => {
    const kt = 'titel_' + wbLang, kx = 'tekst_' + wbLang;
    let velden = '';
    if (soort === 'kaart') velden = '<input value="' + esc(it.emoji || '') + '" placeholder="emoji" oninput="wbBlokken[' + i + '].items[' + j + '].emoji=this.value" style="width:60px;">';
    if (soort === 'nieuws') velden = '<input value="' + esc(it.datum || '') + '" placeholder="datum (bv. 12 aug)" oninput="wbBlokken[' + i + '].items[' + j + '].datum=this.value" style="flex:1;">';
    return '<div class="card" style="padding:10px;margin-bottom:8px;background:var(--card-2);">' +
      '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">' + velden +
      '<button onclick="wbBlokken[' + i + '].items.splice(' + j + ',1);wbRenderBlokken()" style="margin-left:auto;background:var(--red-soft);color:var(--red);border:none;border-radius:7px;width:30px;height:30px;cursor:pointer;">🗑</button></div>' +
      '<input value="' + esc(it[kt] || '') + '" placeholder="Titel (' + wbLang.toUpperCase() + ')" oninput="wbBlokken[' + i + '].items[' + j + '][\'' + kt + '\']=this.value" style="width:100%;margin-bottom:6px;">' +
      '<input value="' + esc(it[kx] || '') + '" placeholder="Tekst (' + wbLang.toUpperCase() + ')" oninput="wbBlokken[' + i + '].items[' + j + '][\'' + kx + '\']=this.value" style="width:100%;">' +
      '</div>';
  }).join('');
  const leeg = soort === 'kaart' ? { emoji: '⭐', titel_nl: '', titel_fr: '', tekst_nl: '', tekst_fr: '' } : { datum: '', titel_nl: '', titel_fr: '', tekst_nl: '', tekst_fr: '' };
  return items + '<button class="sbtn" onclick="wbBlokken[' + i + '].items=wbBlokken[' + i + '].items||[];wbBlokken[' + i + '].items.push(' + JSON.stringify(leeg).replace(/"/g, '&quot;') + ');wbRenderBlokken()">➕ Item toevoegen</button>';
}

function wbRenderBlokken() {
  const c = document.getElementById('wbBlokken'); if (!c) return;
  c.innerHTML = wbBlokken.length ? wbBlokken.map((b, i) => wbBlokEditor(b, i)).join('') :
    '<div class="note-inline" style="padding:14px;text-align:center;">Nog geen blokken — voeg er hieronder een toe.</div>';
  // Verslepen om te herordenen (SortableJS).
  if (window.Sortable) {
    if (wbSortable) { try { wbSortable.destroy(); } catch (e) {} }
    wbSortable = new Sortable(c, {
      handle: '.wb-drag', animation: 150,
      onEnd: function (e) {
        if (e.oldIndex === e.newIndex) return;
        const m = wbBlokken.splice(e.oldIndex, 1)[0];
        wbBlokken.splice(e.newIndex, 0, m);
        wbRenderBlokken();
      }
    });
  }
}

async function wbUpload(input, i, veld) {
  const f = input.files && input.files[0]; if (!f) return;
  const url = await wbUploadNaarBucket(f); if (url) { wbBlokken[i][veld] = url; wbRenderBlokken(); }
}
async function wbUploadGalerij(input, i) {
  const files = Array.from(input.files || []);
  wbBlokken[i].urls = wbBlokken[i].urls || [];
  for (const f of files) { const url = await wbUploadNaarBucket(f); if (url) wbBlokken[i].urls.push(url); }
  wbRenderBlokken();
}
async function wbUploadNaarBucket(file) {
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = 'pagina/' + wbSlug + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    const { error } = await sb.storage.from('website-media').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast('⚠️ Upload mislukt: ' + error.message); return null; }
    return sb.storage.from('website-media').getPublicUrl(path).data.publicUrl;
  } catch (e) { toast('⚠️ ' + e.message); return null; }
}

async function wbSave() {
  const msg = document.getElementById('wbMsg');
  msg.style.color = 'var(--ink-2)'; msg.textContent = 'Opslaan…';
  try {
    const { data: { session } } = await sb.auth.getSession();
    const zichtbaar = document.getElementById('wbZichtbaar').checked;
    const { error } = await sb.from('website_paginas').update({
      blokken: wbBlokken, zichtbaar, updated_by: session.user.id
    }).eq('slug', wbSlug);
    if (error) throw new Error(error.message);
    msg.style.color = 'var(--green)'; msg.textContent = '✅ Opgeslagen — meteen live op de website';
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = '⚠️ ' + e.message; }
}

function wbPreview() {
  const ctx = { prices: (typeof PRICES !== 'undefined' ? PRICES : {}), accTypes: (typeof accTypes !== 'undefined' ? accTypes : []) };
  const html = window.CampingWebsite ? CampingWebsite.renderPagina(wbBlokken, wbLang, ctx) : '<p>Renderer niet geladen</p>';
  openModal('👁️ Voorbeeld (' + wbLang.toUpperCase() + ')',
    '<div class="cw-root"><div class="cw-wrap">' + html + '</div></div>' +
    '<div class="note-inline" style="margin-top:10px;">Zo ziet deze pagina er live uit. Sluit dit venster om verder te bewerken.</div>');
}
