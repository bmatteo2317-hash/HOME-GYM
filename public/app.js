/* HOME-GYM · logica condivisa cloud (Neon) + UX modello cyber-fitness.
   Backend invariato: /api/workouts. Solo UI/UX portata dal modello PUSH-UP. */
const TYPES = {
  'Flessioni': { icon: '💪', unit: 'reps', file: 'pushups.html', desc: 'Push-ups', accent: '#38bdf8', glow: 'glow-cyan', variants: ['Larghe', 'Strette', 'Diamond', 'Classiche', 'Decline', 'Incline'] },
  'Addominali': { icon: '🔥', unit: 'reps', file: 'abs.html', desc: 'Abs', variants: ['Bassi', 'Alti', 'Isometrici'] , accent: '#fb923c', glow: 'glow-fire'},
  'Plank': { icon: '⏱️', unit: 'seconds', file: 'plank.html', desc: 'Core in secondi', accent: '#a3e635', glow: 'glow-lime', variants: ['Normale', 'Laterale', 'Dinamico'] },
  'Trazioni': { icon: '🧗', unit: 'reps', file: 'pullups.html', desc: 'Pull-ups', accent: '#f472b6', glow: 'glow-pink', variants: ['Pronate', 'Supine', 'Neutre', 'Wide Grip'] },
};
const COUNTRIES = ['Italia', 'Francia', 'Germania', 'Spagna', 'Portogallo', 'Regno Unito', 'USA', 'Canada', 'Brasile', 'Argentina', 'Australia', 'Giappone', 'Altro'];
const TYPE = document.body.dataset.type || null; // Flessioni|Addominali|Plank|Trazioni su pagine esercizio
const ACCENT = (TYPE && TYPES[TYPE].accent) || '#a3e635';
let data = [], goal = 100, dayOffset = 0, variant = null, amount = 10;
let profile = { name: 'Atleta', username: '', country: 'Italia', weekly_goal: 500, avatar: '💪', level: 'Intermedio' };
let rank = { scope: 'global', period: 'week', metric: 'volume', room: '', roomName: '', rows: [] };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const isoOf = (d) => d.toISOString().slice(0, 10);
const realToday = () => { const n = new Date(); n.setHours(0, 0, 0, 0); return n; };
const selISO = () => { const d = realToday(); d.setDate(d.getDate() + dayOffset); return isoOf(d); };
const flag = (c) => ({ Italia: '🇮🇹', Francia: '🇫🇷', Germania: '🇩🇪', Spagna: '🇪🇸', Portogallo: '🇵🇹', 'Regno Unito': '🇬🇧', USA: '🇺🇸', Canada: '🇨🇦', Brasile: '🇧🇷', Argentina: '🇦🇷', Australia: '🇦🇺', Giappone: '🇯🇵' }[c] || '🏳️');
function toast(m) { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
async function api(p, o = {}) { const r = await fetch(p, { headers: { 'Content-Type': 'application/json' }, ...o }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || r.status); return d; }
function keyOf(w) { return w.category && w.variant ? w.category + ' · ' + w.variant : w.exercise; }
function ofType(w, t) { return (w.category || '') === t || (w.exercise || '').startsWith(t + ' ·'); }
function medal(i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 + '°'; }
function calcStreak(username, t) {
  const set = new Set(data.filter((w) => (!username || w.username === username) && (!t || ofType(w, t))).map((w) => w.date));
  if (!set.size) return 0;
  let s = 0; const c = realToday();
  if (!set.has(isoOf(c))) c.setDate(c.getDate() - 1);
  while (set.has(isoOf(c))) { s++; c.setDate(c.getDate() - 1); }
  return s;
}
function offlineBanner(e) {
  const b = $('banner'); if (!b) return;
  b.classList.remove('hidden');
  b.innerHTML = `⚠️ Offline: impossibile raggiungere il database (${esc(e.message)}). Dati locali. <button onclick="boot(true)" class="underline font-extrabold">🔄 Riprova</button>`;
}
/* Righe dell'utente corrente (o tutte se username non impostato), per un tipo */
function mineRows(t) {
  const me = profile.username;
  return data.filter((w) => (!me || w.username === me) && (!t || ofType(w, t)));
}
/* ---------- topbar ---------- */
function paintTopbar() {
  const p = $('streakPill');
  if (p) {
    const st = calcStreak(profile.username || null);
    p.classList.toggle('off', !st);
    p.textContent = `🔥 ${st}`;
  }
}

/* ---------- dati ---------- */
async function loadAll() {
  const [w, p] = await Promise.all([api('/api/workouts'), api('/api/workouts?type=profile')]);
  data = w.workouts || [];
  if (p.profile) profile = { ...profile, ...p.profile };
  try {
    const g = parseInt(localStorage.getItem('hg_goal') || '', 10);
    if (g > 0) goal = g;
    localStorage.setItem('hg_w', JSON.stringify(data));
    localStorage.setItem('hg_p', JSON.stringify(profile));
  } catch (e) {}
}
async function boot() {
  try {
    await loadAll();
    const b = $('banner'); if (b) b.classList.add('hidden');
  } catch (e) {
    try {
      data = JSON.parse(localStorage.getItem('hg_w') || '[]');
      profile = { ...profile, ...JSON.parse(localStorage.getItem('hg_p') || '{}') };
      const g = parseInt(localStorage.getItem('hg_goal') || '', 10);
      if (g > 0) goal = g;
    } catch (e2) {}
    offlineBanner(e);
  }
  document.documentElement.style.setProperty('--accent', ACCENT);
  paintTopbar();
  const page = document.body.dataset.page;
  if (page === 'home') renderHome();
  if (page === 'profile') renderProfilePage();
  if (page === 'exercise') renderExercisePage();
  if (page === 'rank') renderRankPage();
  if (page === 'stats') renderStatsPage();
}

/* ---------- PAGINA CLASSIFICHE GLOBALI (tutti e 4 gli esercizi) ---------- */
function renderRankPage() {
  const sel = $('rankExG');
  if (sel && !sel.options.length) {
    const opts = [{ label: 'all' }];
    Object.entries(TYPES).forEach(([t, i]) => { opts.push({ label: t }); i.variants.forEach((v) => opts.push({ label: t + ' · ' + v })); });
    sel.innerHTML = opts.map((o) => `<option value="${esc(o.label)}">${o.label === 'all' ? '⭐ Tutti (Flessioni+Addominali+Plank+Trazioni)' : esc(o.label)}</option>`).join('');
  }
  paintRankSeg(); loadRank();
  const q = new URLSearchParams(location.search).get('room');
  if (q) { rank.scope = 'room'; rank.room = q.trim().toUpperCase(); paintRankSeg(); loadRank(); }
}

/* ---------- giorni ---------- */
function moveDay(dir) {
  if (dir > 0 && dayOffset >= 0) return toast('⛔ Non puoi andare nel futuro');
  dayOffset = Math.min(0, dayOffset + dir);
  paintDay(); refresh();
}
function goToday() { dayOffset = 0; paintDay(); refresh(); }
function paintDay() {
  const d = realToday(); d.setDate(d.getDate() + dayOffset);
  const iso = isoOf(d), isToday = dayOffset === 0;
  const l = $('dayLabel'), s = $('daySub'), n = $('dayNext');
  if (l) l.textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  if (s) s.textContent = isToday ? '📍 Oggi · ' + iso : iso;
  if (n) n.disabled = isToday;
}
function refresh() {
  const page = document.body.dataset.page;
  if (page === 'exercise') { renderEntry(); renderHero(); renderGoalCard(); renderStats(); renderHistory(); }
}

/* ---------- HOME ---------- */
async function renderHome() {
  paintTopbar();
  const me = profile.username, iso = isoOf(realToday());
  const todayTot = data.filter((w) => w.date === iso).reduce((s, w) => s + w.amount, 0);
  const nSet = data.filter((w) => w.date === iso).length;
  const days = new Set(data.filter((w) => !me || w.username === me).map((w) => w.date)).size;
  const hd = $('heroDay'); if (hd) hd.textContent = todayTot;
  const hm = $('heroMeta'); if (hm) hm.innerHTML = `<b>${nSet}</b> serie oggi · <b>${days}</b> giorni attivi`;
  const ss = $('streakStrip');
  if (ss) ss.innerHTML = `<span style="font-size:26px">🔥</span>
    <div style="flex:1"><p style="font-weight:800">${calcStreak(me || null)} giorni di fila</p>
    <p class="mu" style="font-size:11px">${me ? '@' + esc(me) + ' · ' : ''}oggi: ${todayTot} · target ${goal}</p></div>
    <a href="profile.html" class="touch press glass" style="border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;text-decoration:none;color:inherit">👤</a>`;
  renderHomeStatsSub(me);
  const hg = $('homeGrid');
  if (hg) hg.innerHTML = Object.entries(TYPES).map(([t, i]) => {
    const rows = data.filter((w) => ofType(w, t));
    const tot = rows.reduce((s, w) => s + w.amount, 0);
    const pr = rows.length ? Math.max(...rows.map((w) => w.amount)) : 0;
    const u = i.unit === 'seconds' ? 's' : '';
    return `<a href="${i.file}" class="card cardlink excard">
      <span class="eicon">${i.icon}</span>
      <span class="ebody"><b>${esc(t)}</b>
      <span class="esub" style="display:block">${esc(i.desc)} · ${i.variants.length} varianti</span>
      <span class="estats">Vol <b>${tot.toLocaleString('it-IT')}${u}</b> · 🏆 <b style="color:var(--fire)">${pr}${u}</b> · 🔥${calcStreak(me || null, t)}gg</span></span>
      <span class="go">›</span></a>`;
  }).join('');
  try {
    const r = await api('/api/workouts?type=rooms');
    const rooms = r.rooms || [];
    $('roomsHome').innerHTML = rooms.length ? rooms.map((x) => {
      const f = (TYPES[x.exercise] || {}).file || 'pushups.html';
      return `<a href="${f}?room=${esc(x.code)}" class="card cardlink" style="display:flex;align-items:center;gap:10px;padding:12px 14px;margin-bottom:8px">
        <span>🔒</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b> <span class="mu" style="font-size:12px">${esc(x.code)} · ${esc(x.exercise)}</span></span>
        <span class="mu" style="font-size:12px">👥${x.members}</span></a>`;
    }).join('') : '<p class="mu" style="font-size:12px">Nessuna stanza — creane una dalla scheda Rank del tuo esercizio! 🔒</p>';
  } catch (e) { $('roomsHome').innerHTML = '<p class="mu" style="font-size:12px">Stanze non disponibili offline.</p>'; }
}

/* Sottotitolo del pulsante Statistiche in home */
function renderHomeStatsSub(me) {
  const sub = $('homeStatsSub');
  if (!sub) return;
  sub.textContent = me
    ? `@${me} · 🔥${calcStreak(me)}gg · target ${goal}/giorno`
    : 'Streak · volumi · PR · medie';
}

/* Pagina dedicata: statistiche generali del profilo, layout spazioso */
function renderStatsPage() {
  paintTopbar();
  const me = profile.username;
  $('statsTitle').textContent = me ? `@${me}` : 'Statistiche';
  $('statsSub').textContent = me
    ? `${flag(profile.country)} ${profile.country || ''} · target ${goal}/giorno`
    : 'Imposta il tuo username per statistiche personali';
  if (!me) {
    $('statsBody').innerHTML = `<a href="profile.html" class="card cardlink excard">
      <span class="eicon">👤</span>
      <span class="ebody"><b>Vai al Profilo</b>
      <span class="esub" style="display:block">Username · Stato · obiettivo giornaliero</span></span>
      <span class="go">›</span></a>`;
    const sc0 = $('statsChartCard'); if (sc0) sc0.style.display = 'none';
    return;
  }
  const mine = data.filter((w) => w.username === me);
  const days = new Set(mine.map((w) => w.date)).size;
  const vol = mine.reduce((s, w) => s + w.amount, 0);
  const pr = mine.length ? Math.max(...mine.map((w) => w.amount)) : 0;
  const avg = mine.length ? (vol / mine.length).toFixed(1) : 0;
  const cards = [
    ['🔥', String(calcStreak(me)), 'giorni streak'],
    ['📦', vol.toLocaleString('it-IT'), 'volume totale'],
    ['🏆', String(pr), 'PR massimo'],
    ['📅', String(days), 'giorni attivi'],
    ['📝', String(mine.length), 'serie totali'],
    ['📊', String(avg), 'media per serie'],
  ];
  $('statsBody').innerHTML = `<div class="grid3">` + cards.map(([icon, v, l]) =>
    `<div class="kpi"><b>${icon === '🔥' || icon === '📦' ? esc(v) : esc(v)}</b><small>${icon} ${l}</small></div>`).join('') + `</div>
    <div style="margin-top:12px;display:grid;gap:10px">` + Object.entries(TYPES).map(([t, i]) => {
      const rows = mine.filter((w) => ofType(w, t));
      const tv = rows.reduce((s, w) => s + w.amount, 0);
      const tp = rows.length ? Math.max(...rows.map((w) => w.amount)) : 0;
      const ta = rows.length ? (tv / rows.length).toFixed(1) : 0;
      const u = i.unit === 'seconds' ? 's' : '';
      const maxV = Math.max(1, ...Object.keys(TYPES).map((k) => mine.filter((w) => ofType(w, k)).reduce((s, w) => s + w.amount, 0)));
      return `<a href="${i.file}" class="card cardlink">
        <div class="row"><span style="font-size:34px">${i.icon}</span>
          <span style="flex:1"><b style="font-size:18px">${esc(t)}</b>
          <span class="mu" style="display:block;font-size:11px">${esc(i.desc)} · ${i.variants.length} varianti · 🔥${calcStreak(me, t)}gg</span></span>
          <span class="mu" style="font-weight:900;font-size:20px">›</span>
        </div>
        <div class="grid3" style="margin-top:10px;text-align:center">
          <div class="kpi"><b>${tv.toLocaleString('it-IT')}${u}</b><small>volume</small></div>
          <div class="kpi pr"><b>${tp}${u}</b><small>PR</small></div>
          <div class="kpi"><b>${ta}${u}</b><small>media</small></div>
        </div>
        <div class="gbar"><i style="width:${Math.round(tv / maxV * 100)}%"></i></div>
      </a>`;
    }).join('') + `</div>`;
  renderStatsChart(mine);
}
/* Andamento globale: ultimi 14 giorni impilati per esercizio */
const TYPE_KEYS = Object.keys(TYPES);
function stackedSVG(items) {
  const cols = TYPE_KEYS.map((t) => TYPES[t].accent);
  const W = 340, H = 130, max = Math.max(1, ...items.map((i) => i.p.reduce((s, v) => s + v, 0))), bw = W / items.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H + 16}" role="img">`;
  [0.33, 0.66, 1].forEach((f) => { const gy = (H - H * f).toFixed(1); s += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" class="grid"/>`; });
  items.forEach((it, x) => {
    let y = H;
    it.p.forEach((v, k) => {
      if (v <= 0) return;
      const hh = v / max * H; y -= hh;
      s += `<rect x="${(x * bw + bw * .15).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${Math.max(2, hh).toFixed(1)}" rx="2" fill="${cols[k]}"/>`;
    });
    const tot = it.p.reduce((a, b) => a + b, 0);
    if (tot > 0 && bw > 20) s += `<text x="${(x * bw + bw / 2).toFixed(1)}" y="${Math.max(10, y - 4).toFixed(1)}" text-anchor="middle">${tot.toLocaleString('it-IT')}</text>`;
    s += `<text x="${(x * bw + bw / 2).toFixed(1)}" y="${H + 13}" text-anchor="middle">${esc(it.l)}</text>`;
  });
  return s + `<line x1="0" y1="${H}" x2="${W}" y2="${H}" class="base"/></svg><div class="legend">` + TYPE_KEYS.map((t) =>
    `<span><span class="dot" style="background:${TYPES[t].accent};color:${TYPES[t].accent}"></span> ${esc(t)}</span>`).join('') + '</div>';
}
function renderStatsChart(mine) {
  const card = $('statsChartCard'); if (!card) return;
  card.style.display = '';
  const box = $('statsChart'); if (!box) return;
  const now = realToday(), items = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 864e5), k = isoOf(dt);
    items.push({ l: String(dt.getDate()), p: TYPE_KEYS.map((t) => mine.filter((w) => w.date === k && ofType(w, t)).reduce((s, w) => s + w.amount, 0)) });
  }
  box.innerHTML = items.some((it) => it.p.some((v) => v > 0)) ? stackedSVG(items)
    : '<p class="mu empty">Nessun dato negli ultimi 14 giorni — allenati e torna qui! 💪</p>';
}

/* ---------- PAGINA ESERCIZIO ---------- */
function pickVar(v) { variant = v; amount = TYPES[TYPE].unit === 'seconds' ? 30 : 12; renderEntry(); }
function step(d) { amount = Math.max(1, (parseInt($('inAmount').value || '0', 10) || 0) + d); $('inAmount').value = amount; updSelInfo(); }
function updSelInfo() {
  const s = $('selInfo'); if (!s || !TYPE) return;
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : ' reps';
  s.textContent = `${TYPES[TYPE].icon} ${TYPE} · ${variant} → ${amount}${u} · ${selISO()}`;
}
function renderVariants() {
  if (!TYPE) return;
  const info = TYPES[TYPE];
  const vg = $('varGrid');
  if (vg) vg.innerHTML = info.variants.map((v) =>
    `<button onclick="pickVar('${esc(v)}')" class="var-btn touch press glass ${v === variant ? 'active' : ''}" style="border-radius:14px">${esc(v)}</button>`).join('');
  const uh = $('unitHint');
  if (uh) uh.textContent = info.unit === 'seconds' ? '⏱️ Inserisci SECONDI' : '🔁 Inserisci ripetizioni';
}
function renderEntry() {
  if (!TYPE) return;
  renderVariants();
  const inp = $('inAmount'); if (inp) inp.value = amount;
  updSelInfo();
}
function renderHero() {
  if (!TYPE) return;
  const iso = selISO();
  const appDay = data.filter((w) => w.date === iso && ofType(w, TYPE)).reduce((s, w) => s + w.amount, 0);
  const nSet = data.filter((w) => w.date === iso && ofType(w, TYPE)).length;
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : '';
  const hd = $('heroDay'); if (hd) hd.textContent = appDay + (appDay ? u : '');
  const hm = $('heroMeta');
  if (hm) {
    const tot = mineRows(TYPE).reduce((s, w) => s + w.amount, 0);
    hm.innerHTML = `<b>${nSet}</b> serie · volume totale <b>${tot.toLocaleString('it-IT')}${u}</b>`;
  }
}
/* Invio unificato (form + sheet rapida) — backend cloud invariato */
async function postEntry(val, varOverride) {
  if (!profile.username) { toast('👤 Prima imposta username nel Profilo'); setTimeout(() => (location.href = 'profile.html'), 600); return false; }
  const info = TYPES[TYPE];
  const vv = varOverride || variant;
  const body = { category: TYPE, variant: vv, exercise: TYPE + ' · ' + vv, amount: parseInt(val, 10), unit: info.unit, date: selISO(), username: profile.username, country: profile.country };
  if (!body.amount || body.amount <= 0) { toast('❌ Valore non valido'); return false; }
  const before = snapshot();
  try { const r = await api('/api/workouts', { method: 'POST', body: JSON.stringify(body) }); data.unshift(r.workout); }
  catch (e) { console.error('POST fallita:', e); data.unshift({ id: Date.now(), ...body, created_at: new Date().toISOString() }); toast('📴 Salvato in locale: ' + e.message); }
  renderHero(); renderGoalCard(); renderStats(); renderHistory(); paintTopbar();
  maybeCelebrate();
  newsToast(detectNews(before), `✅ +${body.amount} · ${vv}`);
  return true;
}
async function saveEntry() {
  const ok = await postEntry(($('inAmount') || {}).value, null);
  if (ok) tReset(true);
}
async function delEntry(id) {
  if (!confirm('Eliminare?')) return;
  try { await api('/api/workouts?id=' + id, { method: 'DELETE' }); } catch (e) {}
  data = data.filter((w) => w.id !== id);
  renderHero(); renderGoalCard(); renderStats(); renderHistory(); paintTopbar();
}

/* ---------- DAILY GOAL intelligente (auto mediana +10% / manuale) ---------- */
function gsKey() { return 'hg_goal_' + (TYPE || 'global'); }
function goalSettings() {
  try {
    const s = Object.assign({ mode: 'auto', manual: TYPES[TYPE] && TYPES[TYPE].unit === 'seconds' ? 120 : 50 }, JSON.parse(localStorage.getItem(gsKey()) || '{}'));
    if (!(s.manual > 0)) s.manual = 50;
    return s;
  } catch (e) { return { mode: 'auto', manual: 50 }; }
}
let GS = goalSettings(), goalEdit = false;
function saveGS() { try { localStorage.setItem(gsKey(), JSON.stringify(GS)); } catch (e) {} }
function typeTrainedDays(cutoff) {
  const set = new Set(mineRows(TYPE).map((w) => w.date));
  return [...set].filter((d) => !cutoff || d < cutoff).sort();
}
function autoGoal(cutoff) {
  const last = typeTrainedDays(cutoff).slice(-7).map((d) =>
    mineRows(TYPE).filter((w) => w.date === d).reduce((s, w) => s + w.amount, 0));
  if (!last.length) return (TYPES[TYPE] && TYPES[TYPE].unit === 'seconds') ? 60 : 30;
  const s = [...last].sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
  return Math.max(10, Math.ceil(med * 1.1 / 5) * 5);
}
function currentGoal() { GS = GS || goalSettings(); return GS.mode === 'manual' ? Math.max(1, parseInt(GS.manual) || 50) : autoGoal(isoOf(realToday())); }
function goalDots() {
  const now = realToday(); let h = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = isoOf(d), g = i === 0 ? currentGoal() : autoGoal(ds);
    const t = mineRows(TYPE).filter((w) => w.date === ds).reduce((s, w) => s + w.amount, 0);
    h += `<span class="gdot ${t >= g ? 'hit' : ''}" title="${ds}: ${t}/${g}">${t >= g ? '●' : '○'}</span>`;
  }
  return h;
}
function toggleGoalEdit() { goalEdit = !goalEdit; renderGoalCard(); }
function setGoalMode(m) { GS.mode = m; saveGS(); goalEdit = m === 'manual'; renderGoalCard(); maybeCelebrate(); }
function saveGoalManual() {
  const v = parseInt(($('g-man') || {}).value) || 0;
  if (v < 1) { toast('Inserisci un numero ≥ 1'); return; }
  GS.manual = v; GS.mode = 'manual'; saveGS(); goalEdit = false; renderGoalCard(); maybeCelebrate();
  toast('Obiettivo: ' + v + ' 🏁');
}
function renderGoalCard() {
  if (!TYPE) return;
  GS = goalSettings();
  const box = $('goalCard'); if (!box) return;
  const g = currentGoal();
  const appDay = mineRows(TYPE).filter((w) => w.date === selISO()).reduce((s, w) => s + w.amount, 0);
  const pct = Math.min(100, Math.round(appDay / g * 100)), done = appDay >= g;
  box.innerHTML = `<div class="row sp"><div>
      <span class="mu" style="font-size:13px">🎯 Obiettivo di oggi · ${esc(TYPE)}</span>
      <div id="g-txt" style="font-size:17px;font-weight:800"><b>${appDay}</b> / ${g}</div></div>
      <button onclick="toggleGoalEdit()" aria-label="Modifica obiettivo" style="min-height:42px">✏️</button></div>
    <div class="gbar"><i id="g-fill" style="width:${pct}%"></i></div>
    <div class="row sp" style="margin-top:8px">
      <span class="mu" style="font-size:12px">${GS.mode === 'manual' ? 'Obiettivo personalizzato' : 'Suggerito · mediana +10%'}</span>
      ${done ? '<span class="badge b-up">Completato! 🎉</span>' : `<span class="mu" style="font-size:12px">${pct}%</span>`}</div>
    <div class="gdots" title="Ultimi 7 giorni">${goalDots()}</div>
    ${goalEdit ? `<div class="gedit"><div class="seg">
        <button class="${GS.mode === 'auto' ? 'on' : ''}" onclick="setGoalMode('auto')">🤖 Auto (${autoGoal(isoOf(realToday()))})</button>
        <button class="${GS.mode === 'manual' ? 'on' : ''}" onclick="setGoalMode('manual')">✏️ Manuale</button></div>
      ${GS.mode === 'manual' ? `<div class="row" style="margin-top:8px">
        <input id="g-man" type="number" inputmode="numeric" min="1" max="100000" value="${GS.manual}"
          style="flex:1;min-height:48px;text-align:center;font-weight:800;font-size:18px" aria-label="Obiettivo manuale">
        <button class="tgo" style="min-height:48px;padding:0 18px;border:0;border-radius:12px;font-weight:900" onclick="saveGoalManual()">OK</button></div>` : ''}</div>` : ''}`;
  const sl = $('streakLine');
  if (sl) sl.textContent = `🔥 Streak ${TYPE}: ${calcStreak(profile.username || null, TYPE)} giorni · globale: ${calcStreak(profile.username || null)} giorni`;
}
function celKey() { return 'hg_cel_' + TYPE + ':' + isoOf(realToday()); }
function maybeCelebrate() {
  if (!TYPE) return false;
  try {
    if (mineRows(TYPE).filter((w) => w.date === isoOf(realToday())).reduce((s, w) => s + w.amount, 0) >= currentGoal()
      && !localStorage.getItem(celKey())) {
      localStorage.setItem(celKey(), '1');
      confetti();
      return true;
    }
  } catch (e) {}
  return false;
}
function confetti() {
  const c = $('confetti'); if (!c) return;
  c.style.display = 'block';
  const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#a3e635', '#38bdf8', '#f472b6', '#f97316', '#ffffff'], P = [];
  for (let i = 0; i < 140; i++) P.push({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5,
    w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, c: cols[i % cols.length],
    vy: 2 + Math.random() * 3, vx: -1.5 + Math.random() * 3, r: Math.random() * Math.PI, vr: -.1 + Math.random() * .2
  });
  let f = 0; const id = setInterval(() => {
    x.clearRect(0, 0, c.width, c.height); f++;
    P.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
    });
    if (f > 170) { clearInterval(id); x.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; }
  }, 16);
}

/* ---------- TIMER recupero ---------- */
let tmr = { dur: 60, left: 60, on: false, timer: null, finished: false };
const TRC = 2 * Math.PI * 44;
const tFmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function tSet(s) { tStop(true); tmr.dur = s; tmr.left = s; tmr.finished = false; renderTimer(); }
function tStart() {
  if (tmr.left <= 0) tmr.left = tmr.dur;
  tmr.on = true; tmr.finished = false;
  clearInterval(tmr.timer); tmr.timer = setInterval(tTick, 1000); renderTimer();
}
function tStop(silent) { tmr.on = false; clearInterval(tmr.timer); if (!silent) renderTimer(); }
function tReset(silent) { tStop(true); tmr.left = tmr.dur; tmr.finished = false; if (!silent) renderTimer(); else { const t = $('tmr-t'); if (t) t.textContent = tFmt(tmr.left); } }
function tTick() {
  tmr.left--;
  if (tmr.left <= 0) {
    tmr.left = 0; tmr.on = false; clearInterval(tmr.timer); tmr.finished = true; beep();
    if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    renderTimer(); return;
  }
  const t = $('tmr-t'); if (t) t.textContent = tFmt(tmr.left);
  const r = $('tmr-ring'); if (r) r.style.strokeDashoffset = TRC * (1 - tmr.left / tmr.dur);
}
function beep() {
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    [0, .28, .56].forEach((d, i) => {
      const o = C.createOscillator(), g = C.createGain(); o.connect(g); g.connect(C.destination);
      o.frequency.value = i < 2 ? 880 : 1320; o.start(C.currentTime + d);
      g.gain.setValueAtTime(.001, C.currentTime + d); g.gain.exponentialRampToValueAtTime(.4, C.currentTime + d + .02);
      o.stop(C.currentTime + d + .24);
    });
  } catch (e) {}
}
function renderTimer() {
  const box = $('timerCard'); if (!box) return;
  const off = TRC * (1 - tmr.left / tmr.dur);
  const col = tmr.finished ? '#a3e635' : tmr.on ? '#38bdf8' : '#8b98ab';
  box.innerHTML = `<div class="row sp" style="margin-bottom:12px"><b>⏱️ Recupero</b>
      <span class="mu" style="font-size:12px">tra una serie e l’altra</span></div>
    <div class="timer-wrap"><div class="ring">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/>
        <circle id="tmr-ring" cx="52" cy="52" r="44" fill="none" stroke="${col}" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${TRC}" stroke-dashoffset="${off}"
          style="filter:drop-shadow(0 0 6px ${col});transition:stroke-dashoffset 1s linear"/>
      </svg><div class="t ${tmr.finished ? 'done' : ''}" id="tmr-t">${tmr.finished ? 'VIA!' : tFmt(tmr.left)}</div></div>
    <div class="tctrl"><div class="chips">
      ${[30, 60, 90, 120].map((s) => `<button class="chipbtn ${tmr.dur === s ? 'on' : ''}" onclick="tSet(${s})">${s}s</button>`).join('')}
    </div><div class="tbtns">
      ${tmr.on ? `<button onclick="tStop()">⏸ Pausa</button>` : `<button class="tgo" onclick="tStart()">${tmr.finished ? '🔁 Ancora' : '▶ Via'}</button>`}
      <button onclick="tReset()">↺</button>
    </div></div></div>`;
}

/* ---------- Bottom sheet inserimento rapido ---------- */
let sheet = { open: false, val: 0, touchY: null };
function quickVals() { return (TYPES[TYPE] && TYPES[TYPE].unit === 'seconds') ? [10, 30, 60, 120, 300] : [5, 10, 20, 50, 100]; }
function openSheet() {
  if (!TYPE) return;
  sheet = { open: true, val: TYPES[TYPE].unit === 'seconds' ? 30 : 12, touchY: null };
  document.body.style.overflow = 'hidden'; renderSheet();
  requestAnimationFrame(() => requestAnimationFrame(() => { const w = $('sheetWrap'); if (w) w.classList.add('open'); }));
}
function closeSheet() {
  const w = $('sheetWrap'); if (w) w.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { sheet.open = false; renderSheet(); }, 280);
}
function bump(n) {
  sheet.val = Math.max(0, Math.min(100000, sheet.val + n));
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  const c = $('sh-val');
  if (c) { c.textContent = sheet.val; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
  const m = $('sh-man');
  if (m && document.activeElement !== m) m.value = sheet.val || '';
  const b = $('sh-ok'); if (b) b.disabled = sheet.val <= 0;
}
function sheetReset() { sheet.val = 0; updSheet(); }
function sheetType(v) { sheet.val = Math.max(0, Math.min(100000, parseInt(v) || 0)); updSheet(); }
function updSheet() {
  const c = $('sh-val'); if (c) c.textContent = sheet.val;
  const b = $('sh-ok'); if (b) b.disabled = sheet.val <= 0;
}
async function sheetConfirm() {
  if (sheet.val <= 0) return;
  const v = sheet.val;
  closeSheet();
  const ok = await postEntry(v, variant);
  if (ok) tReset(true);
}
function shT(e) { sheet.touchY = e.touches[0].clientY; }
function shE(e) {
  if (sheet.touchY == null) return;
  const dy = e.changedTouches[0].clientY - sheet.touchY; sheet.touchY = null;
  if (dy > 90) closeSheet();
}
function renderSheet() {
  const root = $('sheetRoot'); if (!root) return;
  if (!sheet.open) { root.innerHTML = ''; return; }
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : '';
  root.innerHTML = `<div class="sheet-wrap" id="sheetWrap"><div class="backdrop" onclick="closeSheet()"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Aggiungi serie ${esc(variant || '')}"
      ontouchstart="shT(event)" ontouchend="shE(event)">
      <div class="grab"></div>
      <button class="x" onclick="closeSheet()" aria-label="Annulla">✕</button>
      <div class="sh-cat"><span class="dot" style="background:${ACCENT};color:${ACCENT}"></span>${esc(variant || '')}
        <span class="mu">${esc(TYPE)}</span></div>
      <div class="sh-counter" id="sh-val" style="color:${ACCENT};text-shadow:0 0 30px ${ACCENT}66">${sheet.val}</div>
      <div class="sh-hint">serie in composizione · ${selISO()}</div>
      <div class="quick">${quickVals().map((n) => `<button onclick="bump(${n})" aria-label="Aggiungi ${n}">+${n}</button>`).join('')}</div>
      <div class="qcorr"><button class="qminus" onclick="bump(-5)">−5</button>
        <button onclick="sheetReset()">↺ Reset</button></div>
      <input class="sh-manual" id="sh-man" type="number" inputmode="numeric" min="0" max="100000"
        placeholder="o digita il numero…" oninput="sheetType(this.value)" aria-label="Valore manuale">
      <button class="pri" id="sh-ok" onclick="sheetConfirm()">✔ Conferma serie${u ? ' (' + u + ')' : ''}</button>
    </div></div>`;
}

/* ---------- PR / news ---------- */
function prSnapshot() {
  const rows = mineRows(TYPE);
  return {
    dayBest: rows.length ? Math.max(...rows.map((w) => w.amount)) : 0,
    setPR: rows.length ? Math.max(...rows.map((w) => w.amount)) : 0,
    vol: rows.reduce((s, w) => s + w.amount, 0),
  };
}
function achDefs() {
  const rows = mineRows(TYPE);
  const days = new Set(rows.map((w) => w.date));
  const dayBest = (() => { const m = {}; rows.forEach((w) => { m[w.date] = Math.max(m[w.date] || 0, w.amount); }); return Math.max(0, ...Object.values(m)); })();
  const setPR = rows.length ? Math.max(...rows.map((w) => w.amount)) : 0;
  const vol = rows.reduce((s, w) => s + w.amount, 0);
  const secs = TYPES[TYPE].unit === 'seconds';
  const usedVars = new Set(rows.map((w) => w.variant).filter(Boolean));
  return [
    { id: 'first', icon: '💧', name: 'Prima goccia', desc: `Primo giorno di ${TYPE}`, target: 1, prog: days.size },
    { id: 't100', icon: '💯', name: 'Centenario', desc: `100 ${secs ? 'secondi' : 'ripetizioni'} totali di ${TYPE}`, target: 100, prog: vol },
    { id: 't1000', icon: '🏰', name: 'Muro dei 1000', desc: `1.000 volume ${TYPE}`, target: 1000, prog: vol },
    { id: 't5000', icon: '🚀', name: 'Macchina da guerra', desc: `5.000 volume ${TYPE}`, target: 5000, prog: vol },
    { id: 's3', icon: '🔥', name: 'Accendino', desc: '3 giorni di fila', target: 3, prog: calcStreak(profile.username || null, TYPE) },
    { id: 's7', icon: '🔥', name: 'Settimana di fuoco', desc: '7 giorni di fila', target: 7, prog: calcStreak(profile.username || null, TYPE) },
    { id: 's10', icon: '🌋', name: 'Dieci di fila', desc: '10 giorni consecutivi', target: 10, prog: calcStreak(profile.username || null, TYPE) },
    { id: 'd50', icon: '🧱', name: secs ? 'Muro dei 120s' : 'Muro delle 50', desc: secs ? `120s di ${TYPE} in un giorno` : `50 ${TYPE} in un giorno`, target: secs ? 120 : 50, prog: dayBest },
    { id: 'd100', icon: '💥', name: 'Giornata mostruosa', desc: secs ? `300s di ${TYPE} in un giorno` : `100 ${TYPE} in un giorno`, target: secs ? 300 : 100, prog: dayBest },
    { id: 'set', icon: '⚡', name: 'Serie d’acciaio', desc: secs ? `Serie singola da 120s` : `Serie singola da 30`, target: secs ? 120 : 30, prog: setPR },
    { id: 'vars', icon: '🔱', name: 'Tutte le varianti', desc: `Prova tutte le ${TYPES[TYPE].variants.length} varianti`, target: TYPES[TYPE].variants.length, prog: usedVars.size },
  ];
}
function snapshot() { return { pr: JSON.stringify(prSnapshot()), ach: achDefs().filter((a) => a.prog >= a.target).map((a) => a.id).join(',') }; }
function detectNews(before) {
  const after = prSnapshot(), news = [];
  let b = {};
  try { b = JSON.parse(before.pr); } catch (e) {}
  if (after.setPR > (b.setPR || 0) && after.setPR > 0) news.push(`🏆 Record ${TYPE}: ${after.setPR}!`);
  const nb = achDefs().filter((a) => a.prog >= a.target).map((a) => a.id).filter((id) => before.ach.split(',').indexOf(id) < 0);
  nb.forEach((id) => { const a = achDefs().find((x) => x.id === id); if (a) news.push('🎖️ ' + a.name + ' sbloccato!'); });
  return news;
}
function newsToast(news, fallback) {
  toast(news.length ? news.slice(0, 2).join('  ·  ') + (news.length > 2 ? `  (+${news.length - 2} in Obiettivi)` : '') : fallback);
}

/* ---------- STATS esercizio: KPI + PR + chart SVG + obiettivi ---------- */
function renderStats() {
  if (!TYPE) return;
  const info = TYPES[TYPE];
  const u = info.unit === 'seconds' ? 's' : '';
  const rows = mineRows(TYPE);
  const today = isoOf(realToday());
  const todayV = rows.filter((w) => w.date === today).reduce((s, w) => s + w.amount, 0);
  const weekV = rows.filter((w) => w.date >= isoOf(new Date(realToday().getTime() - 6 * 864e5))).reduce((s, w) => s + w.amount, 0);
  const tot = rows.reduce((s, w) => s + w.amount, 0);
  const kr = $('kpiRow');
  if (kr) kr.innerHTML = `<div class="kpi"><b>${todayV}${u}</b><small>Oggi</small></div>
    <div class="kpi"><b>${weekV}${u}</b><small>Settimana</small></div>
    <div class="kpi"><b>${tot.toLocaleString('it-IT')}${u}</b><small>Totale</small></div>`;
  const byV = Object.fromEntries(info.variants.map((x) => [x, { vol: 0, n: 0, pr: 0 }]));
  data.filter((w) => (!profile.username || w.username === profile.username) && ofType(w, TYPE)).forEach((w) => {
    const vv = w.variant || ((w.exercise || '').includes('·') ? w.exercise.split('·')[1].trim() : '?');
    if (!byV[vv]) byV[vv] = { vol: 0, n: 0, pr: 0 };
    byV[vv].vol += w.amount; byV[vv].n++; byV[vv].pr = Math.max(byV[vv].pr, w.amount);
  });
  const pg = $('prGrid');
  if (pg) pg.innerHTML = info.variants.map((x) => {
    const r = byV[x] || { vol: 0, n: 0, pr: 0 };
    return `<div class="kpi pr" style="text-align:left;padding:12px 14px">
      <div class="row sp"><b>${esc(x)}</b><span style="font-weight:900;color:var(--fire)">🏆 ${r.pr}${u}</span></div>
      <p class="mu" style="font-size:11px;margin-top:2px">Vol <b style="color:var(--tx)">${r.vol}${u}</b> · Media <b style="color:var(--tx)">${(r.n ? r.vol / r.n : 0).toFixed(1)}${u}</b> · ×${r.n}</p>
      <div class="pbar" style="margin-top:6px"><i style="width:${r.pr ? 100 : 0}%"></i></div></div>`;
  }).join('');
  renderTrend();
  renderAch();
}
function barsSVG(items, color) {
  const W = 340, H = 130, max = Math.max(1, ...items.map((i) => i.v)), bw = W / items.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H + 16}" role="img">`;
  [0.33, 0.66, 1].forEach((f) => { const y = (H - H * f).toFixed(1); s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="grid"/>`; });
  items.forEach((it, x) => {
    const hh = it.v / max * H, y = H - hh;
    if (it.v > 0) s += `<rect x="${(x * bw + bw * .15).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${Math.max(4, hh).toFixed(1)}" rx="4" fill="${color}"/>`;
    if (it.v > 0 && bw > 20) s += `<text x="${(x * bw + bw / 2).toFixed(1)}" y="${Math.max(10, y - 4).toFixed(1)}" text-anchor="middle">${it.v.toLocaleString('it-IT')}</text>`;
    s += `<text x="${(x * bw + bw / 2).toFixed(1)}" y="${H + 13}" text-anchor="middle">${esc(it.l)}</text>`;
  });
  return s + `<line x1="0" y1="${H}" x2="${W}" y2="${H}" class="base"/></svg>`;
}
/* Andamento: 7 giorni / 30 giorni / 12 mesi */
let chartRange = '7d';
function setChartRange(r) { chartRange = r; paintChartSeg(); renderTrend(); }
function paintChartSeg() {
  document.querySelectorAll('[data-cr]').forEach((b) => b.classList.toggle('on', b.dataset.cr === chartRange));
  document.querySelectorAll('[data-cr2]').forEach((b) => b.classList.toggle('on', b.dataset.cr2 === chartRange));
}
function renderTrend() {
  if (!TYPE) return;
  const buckets = [];
  if (chartRange === '1y') {
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(realToday()); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
      const y = dt.getFullYear(), m = dt.getMonth();
      const v = mineRows(TYPE).filter((w) => {
        const d = new Date(w.date + 'T12:00:00');
        return d.getFullYear() === y && d.getMonth() === m;
      }).reduce((s, w) => s + w.amount, 0);
      buckets.push({ label: dt.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''), v });
    }
  } else {
    const n = chartRange === '30d' ? 30 : 7;
    for (let i = n - 1; i >= 0; i--) {
      const dt = new Date(realToday().getTime() - i * 864e5), k = isoOf(dt);
      const v = mineRows(TYPE).filter((w) => w.date === k).reduce((s, w) => s + w.amount, 0);
      buckets.push({ label: n === 30 ? ((n - 1 - i) % 5 === 0 ? String(dt.getDate()) : '') : dt.toLocaleDateString('it-IT', { weekday: 'narrow' }), v });
    }
  }
  const sub = $('chartSub');
  if (sub) sub.textContent = chartRange === '1y' ? 'Ultimi 12 mesi' : chartRange === '30d' ? 'Ultimi 30 giorni' : 'Ultimi 7 giorni';
  const box = $('chartSvg');
  if (box) box.innerHTML = buckets.some((b) => b.v > 0) ? barsSVG(buckets, ACCENT)
    : '<p class="mu empty">Nessun dato in questo periodo — salva la prima serie 💪</p>';
  // settimanale: ultime 8 settimane + trend
  const wb = $('weekSvg');
  if (wb) {
    const mon = monday(new Date());
    const wk = [];
    for (let i = 7; i >= 0; i--) {
      const s = new Date(mon); s.setDate(s.getDate() - 7 * i);
      let v = 0;
      for (let d = 0; d < 7; d++) {
        const dd = new Date(s); dd.setDate(dd.getDate() + d);
        v += mineRows(TYPE).filter((w) => w.date === isoOf(dd)).reduce((x, w) => x + w.amount, 0);
      }
      wk.push({ l: s.getDate() + '/' + (s.getMonth() + 1), v });
    }
    wb.innerHTML = wk.some((w) => w.v > 0) ? barsSVG(wk, '#a3e635')
      : '<p class="mu empty">Nessun dato nelle ultime 8 settimane 💪</p>';
    const rec = wk.slice(4).reduce((s, w) => s + w.v, 0) / 4, prev = wk.slice(0, 4).reduce((s, w) => s + w.v, 0) / 4;
    let b;
    if (prev === 0 && rec === 0) b = '<span class="badge b-eq">Dati insufficienti</span>';
    else if (prev === 0) b = '<span class="badge b-up">▲ In crescita</span>';
    else {
      const p = (rec - prev) / prev * 100;
      b = Math.abs(p) < 3 ? `<span class="badge b-eq">● Stabile (${p.toFixed(0)}%)</span>`
        : p > 0 ? `<span class="badge b-up">▲ +${p.toFixed(0)}%</span>` : `<span class="badge b-dn">▼ ${p.toFixed(0)}%</span>`;
    }
    const tb = $('trendBadge'); if (tb) tb.innerHTML = `<span class="mu">Ultime 4 sett. vs 4 precedenti</span>${b}`;
  }
  paintChartSeg();
}
function monday(d) { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; }
function renderAch() {
  const box = $('achList'); if (!box || !TYPE) return;
  const defs = achDefs();
  const un = defs.filter((a) => a.prog >= a.target).length;
  box.innerHTML = `<div class="sub">${un}/${defs.length} obiettivi · ${mineRows(TYPE).reduce((s, w) => s + w.amount, 0).toLocaleString('it-IT')} volume ${TYPE}</div>` +
    defs.map((a) => {
      const p = Math.min(a.prog, a.target), done = p >= a.target, pct = Math.round(p / a.target * 100);
      return `<div class="goal ${done ? '' : 'lock'}"><div class="gicon">${done ? a.icon : '🔒'}</div>
        <div class="gbody"><b>${esc(a.name)}</b> ${done ? '<span style="color:var(--lime);font-size:12px;font-weight:800">✓</span>' : ''}
        <p>${esc(a.desc)}</p><div class="pbar"><i style="width:${pct}%"></i></div>
        <div class="mu" style="font-size:11px;margin-top:4px">${p}/${a.target} · ${pct}%</div></div></div>`;
    }).join('');
}
function renderHistory() {
  if (!TYPE) return;
  const box = $('histList'); if (!box) return;
  const rows = mineRows(TYPE).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id > a.id ? 1 : -1));
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : '';
  box.innerHTML = rows.length ? rows.slice(0, 60).map((w) =>
    `<div class="card" style="padding:12px 14px;margin-bottom:8px"><div class="row sp"><span class="hist-date">${esc(w.variant || keyOf(w))} · +${w.amount}${u}</span>
      <span class="hist-tot" style="font-size:16px">${esc(w.date)}</span></div>
      <div class="row" style="margin-top:8px"><button class="histbtn" onclick="editEntryDate(${w.id})">✏️ Data</button>
      <button class="dng histbtn" onclick="delEntry(${w.id})">🗑</button></div></div>`).join('')
    : '<p class="mu" style="text-align:center;padding:20px 0;font-size:13px">Nessun inserimento per questo esercizio.</p>';
}
async function editEntryDate(id) {
  const w = data.find((x) => x.id === id);
  if (!w) return;
  const v = prompt('Nuova data (AAAA-MM-GG):', w.date);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  try { await api('/api/workouts?id=' + id, { method: 'PATCH', body: JSON.stringify({ date: v }) }); w.date = v; }
  catch (e) { w.date = v; toast('📴 Data aggiornata in locale'); }
  renderHero(); renderGoalCard(); renderStats(); renderHistory();
}
/* ---------- Backup locale (export/import JSON) ---------- */
function exportJSON() {
  if (!TYPE) return;
  const entries = mineRows(TYPE);
  const blob = new Blob([JSON.stringify({ app: 'home-gym', version: 1, type: TYPE, exported: new Date().toISOString(), entries }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `home-gym-${TYPE.toLowerCase()}-${isoOf(realToday())}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Backup esportato 📥');
}
function importJSON(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const j = JSON.parse(r.result);
      const arr = Array.isArray(j) ? j : j.entries || j.workouts || j.data;
      if (!Array.isArray(arr)) throw 0;
      const clean = arr.filter((e) => e && (e.category === TYPE || String(e.exercise || '').startsWith(TYPE + ' ·'))
        && parseInt(e.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || '')));
      if (!clean.length) throw 0;
      const have = new Set(data.map((w) => w.id));
      const fresh = clean.filter((e) => !have.has(e.id));
      if (!fresh.length) { toast('Nessun dato nuovo 📤'); return; }
      toast(`Importo ${fresh.length} serie…`);
      for (const e of fresh) {
        const body = { category: TYPE, variant: e.variant || variant || TYPES[TYPE].variants[0], exercise: TYPE + ' · ' + (e.variant || variant || TYPES[TYPE].variants[0]), amount: parseInt(e.amount), unit: TYPES[TYPE].unit, date: e.date, username: profile.username || e.username || 'Atleta', country: profile.country || e.country || 'Italia' };
        try { const res = await api('/api/workouts', { method: 'POST', body: JSON.stringify(body) }); data.unshift(res.workout); }
        catch (err) { data.unshift({ id: Date.now() + Math.random(), ...body }); }
      }
      renderHero(); renderGoalCard(); renderStats(); renderHistory(); paintTopbar();
      toast(fresh.length + ' serie importate 📤');
    } catch (e) { toast('File non valido ❌'); }
    inp.value = '';
  };
  r.readAsText(f);
}
async function wipeType() {
  if (!TYPE) return;
  if (!confirm(`Cancellare TUTTE le serie di ${TYPE}?`)) return;
  if (!confirm('Sicuro? Esporta prima un backup!')) return;
  const rows = mineRows(TYPE);
  for (const w of rows) { try { await api('/api/workouts?id=' + w.id, { method: 'DELETE' }); } catch (e) {} }
  const ids = new Set(rows.map((w) => w.id));
  data = data.filter((w) => !ids.has(w.id));
  renderHero(); renderGoalCard(); renderStats(); renderHistory(); paintTopbar();
  toast('Tutto cancellato 🗑');
}

/* ---------- RANK (scope/metric/periodo + stanze) ---------- */
function setScope(s) { rank.scope = s; if (s !== 'room') rank.room = ''; paintRankSeg(); loadRank(); }
function setMetric(m) { rank.metric = m; paintRankSeg(); loadRank(); }
function setPeriod(p) { rank.period = p; paintRankSeg(); loadRank(); }
function paintRankSeg() {
  const on = (id, c) => { const e = $(id); if (e) e.classList.toggle('on', c); };
  on('mVol', rank.metric === 'volume'); on('mPr', rank.metric === 'pr'); on('mStreak', rank.metric === 'streak');
  on('gGlobal', rank.scope === 'global'); on('gCountry', rank.scope === 'country'); on('gRoom', rank.scope === 'room');
  const dim = rank.metric === 'streak';
  const pb = $('periodBlock'); if (pb) pb.style.opacity = dim ? '.35' : '1';
  on('gToday', rank.period === 'today'); on('gWeek', rank.period === 'week'); on('gAll', rank.period === 'all');
  if (dim) on('gAll', true);
  const rp = $('roomPanel'); if (rp) rp.classList.toggle('hidden', rank.scope !== 'room');
}
function rankRow(r, i, metric) {
  const cat = r.top_category || TYPE, vari = r.top_variant || 'Generale';
  const icon = (TYPES[cat] || {}).icon || '🏋️';
  const isMe = r.username === profile.username;
  const unit = (r.top_unit || r.unit) === 'seconds' || cat === 'Plank' ? 's' : '';
  const score = metric === 'pr' ? r.best + (unit || '') : metric === 'streak' ? (r.streak ?? 0) + '🔥' : Number(r.total ?? r.score ?? 0).toLocaleString('it-IT');
  const sub = metric === 'pr' ? `vol ${Number(r.total || 0)} · ×${r.entries}` : metric === 'streak' ? `vol ${Number(r.total || 0)} · PR ${r.best}` : `🏆 max ${r.best} · ×${r.entries}`;
  const med = i === 0 ? 'medal1' : i === 1 ? 'medal2' : i === 2 ? 'medal3' : '';
  return `<div class="lb-row"><span class="lb-pos ${med}">${i + 1}</span>
    <span class="lb-name">${icon} ${esc(vari || '—')} <span class="lb-sub">@${esc(r.username)}${isMe ? ' · TU' : ''} · ${flag(r.country)} ${esc(r.country || '')} · ${esc(cat || '')}</span><br><span class="lb-sub">${sub}</span></span>
    <span class="lb-val">${score}</span></div>`;
}
async function loadRank() {
  paintRankSeg();
  const exSel = $('rankExG');
  const ex = TYPE || (exSel ? exSel.value : 'all') || 'all'; // pagina globale: filtro selezionabile (tutti e 4 gli esercizi)
  const qs = `scope=${rank.scope}&country=${encodeURIComponent(profile.country || 'Italia')}&period=${rank.period}&metric=${rank.metric}&exercise=${encodeURIComponent(ex)}&room=${encodeURIComponent(rank.room || '')}`;
  try {
    const r = await api('/api/workouts?type=leaderboard&' + qs);
    rank.rows = r.leaderboard || [];
  } catch (e) { rank.rows = localRank(ex); }
  const mLabel = rank.metric === 'pr' ? '🏆 PR' : rank.metric === 'streak' ? '🔥 Streak' : '📦 Volume';
  const box = $('rankList'); if (!box) return;
  box.innerHTML = (rank.rows.length ? rank.rows.map((r, i) => rankRow(r, i, rank.metric)).join('')
      : '<p class="mu" style="text-align:center;padding:16px 0;font-size:13px">Nessuno qui — sii il primo! 🚀</p>');
  const lab = $('rankLabel'); if (lab) lab.textContent = `${mLabel} · ${ex}`;
  if (rank.scope === 'room') loadRoomPanel();
}
function localRank(exercise) {
  const today = isoOf(realToday()), weekAgo = isoOf(new Date(realToday().getTime() - 6 * 864e5));
  const map = {};
  data.forEach((w) => {
    if (!w.username) return;
    if (rank.scope === 'country' && (w.country || '') !== profile.country) return;
    if (rank.scope === 'room' && rank.roomMembers && !rank.roomMembers.includes(w.username)) return;
    if (rank.metric !== 'streak') {
      if (rank.period === 'today' && w.date !== today) return;
      if (rank.period === 'week' && w.date < weekAgo) return;
    }
    const k = keyOf(w);
    if (exercise !== 'all' && !(k === exercise || k.startsWith(exercise + ' ·'))) return;
    const m = (map[w.username] = map[w.username] || { username: w.username, country: w.country || '', total: 0, best: 0, entries: 0, unit: w.unit, top: {}, days: {} });
    m.total += w.amount; m.best = Math.max(m.best, w.amount); m.entries++; m.days[w.date] = 1;
    const kc = w.category || (w.exercise.includes('·') ? w.exercise.split('·')[0].trim() : w.exercise);
    const kv = w.variant || ((w.exercise.includes('·') && w.exercise.split('·')[1].trim()) || '');
    m.top[kc + '|' + kv] = (m.top[kc + '|' + kv] || 0) + w.amount;
  });
  const rows = Object.values(map).map((m) => {
    const tk = Object.entries(m.top).sort((a, b) => b[1] - a[1])[0]?.[0] || '|';
    const [tc, tv] = tk.split('|');
    m.top_category = tc; m.top_variant = tv; delete m.top;
    let s = 0; const c = realToday();
    if (!m.days[isoOf(c)]) c.setDate(c.getDate() - 1);
    while (m.days[isoOf(c)]) { s++; c.setDate(c.getDate() - 1); }
    m.streak = s; delete m.days; return m;
  });
  if (rank.metric === 'streak') return rows.filter((m) => m.streak > 0).sort((a, b) => b.streak - a.streak || b.total - a.total).slice(0, 50);
  if (rank.metric === 'pr') return rows.sort((a, b) => b.best - a.best).slice(0, 50);
  return rows.sort((a, b) => b.total - a.total).slice(0, 50);
}

/* ---------- STANZE PRIVATE ---------- */
function roomLink(code) { return location.origin + location.pathname + '?room=' + code; }
async function loadRoomPanel() {
  const box = $('roomPanel'); if (!box) return;
  const q = new URLSearchParams(location.search).get('room');
  if (q && !rank.room) { rank.room = q.trim().toUpperCase(); rank.scope = 'room'; }
  if (!rank.room) {
    box.innerHTML = `<div class="card roombox">
      <p style="font-size:14px;font-weight:800">🔒 Nessuna stanza selezionata</p>
      <div class="row" style="margin-top:8px"><input id="joinCode" placeholder="Codice (es. A1B2C3)" maxlength="12" style="flex:1;text-transform:uppercase;font-weight:800" />
      <button onclick="joinByCode()" class="tgo" style="padding:0 18px;border:0;border-radius:12px;font-weight:900">Entra</button></div>
      <div class="row" style="margin-top:8px"><input id="roomName" placeholder="Nome nuova stanza" maxlength="60" style="flex:1" />
      <button onclick="createRoom()" class="tgo" style="padding:0 18px;border:0;border-radius:12px;font-weight:900">Crea</button></div>
      <p class="mu" style="font-size:11px;margin-top:6px">La stanza sfida è legata a <b>${esc(TYPE || 'tutti gli esercizi')}</b>. Creala e condividi il link!</p></div>`;
    return;
  }
  try {
    const r = await api('/api/workouts?type=room&code=' + encodeURIComponent(rank.room));
    const mine = (r.members || []).some((m) => m.username === profile.username);
    box.innerHTML = `<div class="card roombox">
      <p style="font-weight:800">🔒 ${esc(r.room.name)} <span class="mu" style="font-size:12px">${esc(r.room.code)} · 👥${r.members.length}</span></p>
      <p class="mu" style="font-size:11px">Membri: ${(r.members || []).map((m) => esc(m.username)).join(', ') || '—'}</p>
      <div class="row" style="margin-top:8px">
        <button onclick="copyRoomLink()" class="tgo" style="flex:1;border:0;border-radius:12px;font-weight:800;font-size:14px">🔗 Copia link invito</button>
        ${mine ? '' : `<button onclick="joinRoom()" style="flex:1;font-size:14px">➕ Unisciti</button>`}
      </div>
      <button onclick="leaveRoom()" class="mu" style="font-size:11px;text-decoration:underline;background:none;border:0;min-height:32px;padding:4px 0">Esci dalla stanza / cambia codice</button></div>`;
  } catch (e) { box.innerHTML = `<p class="dng" style="font-size:12px">Stanza non trovata. <button onclick="leaveRoom()" class="underline">Reset</button></p>`; }
}
async function createRoom() {
  const name = ($('roomName').value || '').trim();
  if (!name) return toast('❌ Dai un nome alla stanza');
  if (!profile.username) { toast('👤 Imposta username nel Profilo'); return; }
  try {
    const exScope = TYPE || (($('rankExG') || {}).value || 'all');
    const r = await api('/api/workouts?type=rooms', { method: 'POST', body: JSON.stringify({ name, exercise: exScope, username: profile.username, country: profile.country }) });
    rank.room = r.room.code;
    history.replaceState(null, '', '?room=' + r.room.code);
    toast('🎉 Stanza creata! Condividi il link');
    loadRoomPanel(); loadRank();
  } catch (e) { toast('❌ ' + e.message); }
}
async function joinByCode() {
  const code = ($('joinCode').value || '').trim().toUpperCase();
  if (!code) return;
  rank.room = code;
  history.replaceState(null, '', '?room=' + code);
  await joinRoom(true);
}
async function joinRoom(silent) {
  if (!profile.username) { toast('👤 Imposta username nel Profilo'); return; }
  try {
    await api('/api/workouts?type=room_join', { method: 'POST', body: JSON.stringify({ code: rank.room, username: profile.username, country: profile.country }) });
    if (!silent) toast('✅ Entrato nella stanza!');
    loadRoomPanel(); loadRank();
  } catch (e) { toast('❌ ' + e.message); }
}
function leaveRoom() {
  rank.room = ''; rank.scope = 'global';
  history.replaceState(null, '', location.pathname);
  paintRankSeg(); loadRoomPanel(); loadRank();
}
function copyRoomLink() {
  const link = roomLink(rank.room);
  const done = () => toast('🔗 Link copiato! Invialo agli amici');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done).catch(() => prompt('Copia il link:', link));
  else prompt('Copia il link:', link);
}

/* ---------- PROFILO ---------- */
function renderProfilePage() {
  paintTopbar();
  $('pfUsername').value = profile.username || '';
  $('pfCountry').value = profile.country || 'Italia';
  $('pfName').value = profile.name || 'Atleta';
  $('pfGoal').value = goal;
  $('pfNameBig').textContent = profile.name || 'Atleta';
  $('pfMeta').textContent = (profile.username ? '@' + profile.username + ' · ' : '') + flag(profile.country) + ' ' + (profile.country || '');
  const mine = data.filter((w) => !profile.username || w.username === profile.username);
  $('pfStreak').textContent = calcStreak(profile.username || null) + '🔥';
  $('pfEntries').textContent = mine.length;
  $('pfBest').textContent = mine.length ? Math.max(...mine.map((w) => w.amount)) : 0;
}
async function saveProfile() {
  const u = $('pfUsername').value.trim();
  if (!u) return toast('❌ Username obbligatorio');
  goal = Math.max(10, parseInt($('pfGoal').value, 10) || 100);
  try { localStorage.setItem('hg_goal', String(goal)); } catch (e) {}
  profile = { ...profile, username: u, country: $('pfCountry').value, name: $('pfName').value.trim() || 'Atleta', weekly_goal: goal };
  try {
    const r = await api('/api/workouts?type=profile', { method: 'POST', body: JSON.stringify(profile) });
    profile = r.profile; toast('✅ Profilo salvato!');
  } catch (e) { try { localStorage.setItem('hg_p', JSON.stringify(profile)); } catch (e2) {} toast('📴 Salvato in locale'); }
  renderProfilePage();
}

/* ---------- init ---------- */
function renderExercisePage() {
  variant = TYPES[TYPE].variants[0];
  amount = TYPES[TYPE].unit === 'seconds' ? 30 : 12;
  GS = goalSettings();
  paintTopbar(); paintDay(); renderEntry(); renderHero(); renderGoalCard(); renderTimer(); renderStats(); renderHistory(); loadRank();
  setTimeout(maybeCelebrate, 600);
  const q = new URLSearchParams(location.search).get('room');
  if (q) { rank.scope = 'room'; rank.room = q.trim().toUpperCase(); subtab('rank'); paintRankSeg(); loadRank(); }
}
function subtab(n) {
  document.querySelectorAll('.subtab').forEach((s) => s.classList.remove('active'));
  const el = $('sub-' + n); if (el) el.classList.add('active');
  document.querySelectorAll('[data-sub]').forEach((b) => b.classList.toggle('on', b.dataset.sub === n));
  if (n === 'rank') loadRank();
  window.scrollTo({ top: 0 });
}
document.addEventListener('DOMContentLoaded', () => {
  const sel = $('pfCountry');
  if (sel) sel.innerHTML = COUNTRIES.map((c) => `<option ${c === (profile.country || 'Italia') ? 'selected' : ''}>${c}</option>`).join('');
  boot();
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'inAmount') {
    amount = Math.max(1, parseInt(e.target.value || '0', 10) || 1);
    updSelInfo();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.open) closeSheet(); });
/* ---------- PWA: registra service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('SW non registrato:', e));
  });
}
