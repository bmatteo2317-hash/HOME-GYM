/* HOME-GYM · logica condivisa (index, profilo, 4 pagine esercizio) */
const TYPES = {
  'Flessioni': { icon: '💪', unit: 'reps', file: 'pushups.html', desc: 'Push-ups', variants: ['Larghe', 'Strette', 'Diamond', 'Classiche', 'Decline', 'Incline'] },
  'Addominali': { icon: '🔥', unit: 'reps', file: 'abs.html', desc: 'Abs', variants: ['Bassi', 'Alti', 'Isometrici'] },
  'Plank': { icon: '⏱️', unit: 'seconds', file: 'plank.html', desc: 'Core in secondi', variants: ['Normale', 'Laterale', 'Dinamico'] },
  'Trazioni': { icon: '🧗', unit: 'reps', file: 'pullups.html', desc: 'Pull-ups', variants: ['Pronate', 'Supine', 'Neutre', 'Wide Grip'] },
};
const COUNTRIES = ['Italia', 'Francia', 'Germania', 'Spagna', 'Portogallo', 'Regno Unito', 'USA', 'Canada', 'Brasile', 'Argentina', 'Australia', 'Giappone', 'Altro'];
const TYPE = document.body.dataset.type || null; // Flessioni|Addominali|Plank|Trazioni su pagine esercizio
let data = [], goal = 100, dayOffset = 0, variant = null, amount = 10;
let profile = { name: 'Atleta', username: '', country: 'Italia', weekly_goal: 500, avatar: '💪', level: 'Intermedio' };
let rank = { scope: 'global', period: 'week', metric: 'volume', room: '', roomName: '', rows: [] };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const isoOf = (d) => d.toISOString().slice(0, 10);
const realToday = () => { const n = new Date(); n.setHours(0, 0, 0, 0); return n; };
const selISO = () => { const d = realToday(); d.setDate(d.getDate() + dayOffset); return isoOf(d); };
const flag = (c) => ({ Italia: '🇮🇹', Francia: '🇫🇷', Germania: '🇩🇪', Spagna: '🇪🇸', Portogallo: '🇵🇹', 'Regno Unito': '🇬🇧', USA: '🇺🇸', Canada: '🇨🇦', Brasile: '🇧🇷', Argentina: '🇦🇷', Australia: '🇦🇺', Giappone: '🇯🇵' }[c] || '🏳️');
function toast(m) { const t = $('toast'); if (!t) return; t.textContent = m; t.style.opacity = '1'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.opacity = '0'), 2200); }
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
  const page = document.body.dataset.page;
  if (page === 'home') renderHome();
  if (page === 'profile') renderProfilePage();
  if (page === 'exercise') renderExercisePage();
  if (page === 'rank') renderRankPage();
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
  if (page === 'exercise') { renderEntry(); renderStats(); renderHistory(); }
}

/* ---------- HOME ---------- */
async function renderHome() {
  const me = profile.username, iso = isoOf(realToday());
  const todayTot = data.filter((w) => w.date === iso).reduce((s, w) => s + w.amount, 0);
  $('streakStrip').innerHTML = `<span class="text-2xl">🔥</span>
    <div class="flex-1"><p class="font-extrabold leading-tight">${calcStreak(me || null)} giorni di fila</p>
    <p class="text-[11px] text-slate-400">${me ? '@' + esc(me) + ' · ' : ''}oggi: ${todayTot} · target ${goal}</p></div>
    <a href="profile.html" class="press glass rounded-2xl px-3 py-2 text-xs font-bold">👤</a>`;
  $('homeGrid').innerHTML = Object.entries(TYPES).map(([t, i]) => {
    const rows = data.filter((w) => ofType(w, t));
    const tot = rows.reduce((s, w) => s + w.amount, 0);
    const pr = rows.length ? Math.max(...rows.map((w) => w.amount)) : 0;
    const u = i.unit === 'seconds' ? 's' : '';
    return `<a href="${i.file}" class="press glass rounded-3xl p-4 flex items-center gap-3">
      <span class="text-4xl">${i.icon}</span>
      <span class="flex-1"><span class="font-extrabold text-lg block">${esc(t)}</span>
      <span class="text-[11px] text-slate-400">${esc(i.desc)} · ${i.variants.length} varianti</span><br>
      <span class="text-[11px] text-slate-300">Vol <b>${tot.toLocaleString('it-IT')}${u}</b> · PR <b class="text-amber-300">${pr}${u}</b> · 🔥${calcStreak(me || null, t)}gg</span></span>
      <span class="text-slate-500 font-extrabold">›</span></a>`;
  }).join('');
  try {
    const r = await api('/api/workouts?type=rooms');
    const rooms = r.rooms || [];
    $('roomsHome').innerHTML = rooms.length ? rooms.map((x) => {
      const f = (TYPES[x.exercise] || {}).file || 'pushups.html';
      return `<a href="${f}?room=${esc(x.code)}" class="press glass px-4 py-3 flex items-center gap-2" style="border-radius:18px">
        <span>🔒</span><span class="flex-1 min-w-0"><b>${esc(x.name)}</b> <span class="text-slate-500 text-xs">${esc(x.code)} · ${esc(x.exercise)}</span></span>
        <span class="text-xs text-slate-400">👥${x.members}</span></a>`;
    }).join('') : '<p class="text-xs text-slate-500">Nessuna stanza — creane una dalla scheda Rank del tuo esercizio! 🔒</p>';
  } catch (e) { $('roomsHome').innerHTML = '<p class="text-xs text-slate-500">Stanze non disponibili offline.</p>'; }
}

/* ---------- PAGINA ESERCIZIO ---------- */
function pickVar(v) { variant = v; amount = TYPES[TYPE].unit === 'seconds' ? 30 : 12; renderEntry(); }
function step(d) { amount = Math.max(1, (parseInt($('inAmount').value || '0', 10) || 0) + d); $('inAmount').value = amount; }
function renderVariants() {
  const info = TYPES[TYPE];
  $('varGrid').innerHTML = info.variants.map((v) =>
    `<button onclick="pickVar('${esc(v)}')" class="var-btn touch press glass px-4 text-sm font-bold ${v === variant ? 'active' : ''}" style="border-radius:16px;min-height:48px">${esc(v)}</button>`).join('');
  $('unitHint').textContent = info.unit === 'seconds' ? '⏱️ Inserisci SECONDI' : '🔁 Inserisci ripetizioni';
}
function renderEntry() {
  renderVariants();
  $('inAmount').value = amount;
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : ' reps';
  $('selInfo').textContent = `${TYPES[TYPE].icon} ${TYPE} · ${variant} → ${amount}${u} · ${selISO()}`;
}
async function saveEntry() {
  if (!profile.username) { toast('👤 Prima imposta username nel Profilo'); setTimeout(() => (location.href = 'profile.html'), 600); return; }
  const info = TYPES[TYPE];
  const body = { category: TYPE, variant, exercise: TYPE + ' · ' + variant, amount: parseInt($('inAmount').value, 10), unit: info.unit, date: selISO(), username: profile.username, country: profile.country };
  if (!body.amount || body.amount <= 0) return toast('❌ Valore non valido');
  try { const r = await api('/api/workouts', { method: 'POST', body: JSON.stringify(body) }); data.unshift(r.workout); toast(`✅ +${body.amount} · ${variant}`); }
  catch (e) { data.unshift({ id: Date.now(), ...body, created_at: new Date().toISOString() }); toast('📴 Salvato in locale'); }
  renderStats(); renderHistory();
}
async function delEntry(id) {
  if (!confirm('Eliminare?')) return;
  try { await api('/api/workouts?id=' + id, { method: 'DELETE' }); } catch (e) {}
  data = data.filter((w) => w.id !== id);
  renderStats(); renderHistory();
}
function renderStats() {
  const info = TYPES[TYPE], iso = selISO();
  const dayRows = data.filter((w) => w.date === iso);
  const dayTot = dayRows.reduce((s, w) => s + w.amount, 0);
  const appDay = dayRows.filter((w) => ofType(w, TYPE)).reduce((s, w) => s + w.amount, 0);
  const pct = Math.min(100, Math.round(dayTot / goal * 100));
  $('goalBar').style.width = pct + '%'; $('goalPct').textContent = pct + '%';
  $('goalText').textContent = `${dayTot}/${goal} oggi${pct >= 100 ? ' 🎉' : ' · mancano ' + (goal - dayTot)} · ${TYPE} oggi: ${appDay}`;
  $('streakLine').textContent = `🔥 Streak ${TYPE}: ${calcStreak(profile.username || null, TYPE)} giorni · globale: ${calcStreak(profile.username || null)} giorni`;
  const u = info.unit === 'seconds' ? 's' : '';
  const rows = Object.fromEntries(info.variants.map((x) => [x, { vol: 0, n: 0, pr: 0 }]));
  data.filter((w) => ofType(w, TYPE)).forEach((w) => {
    const vv = w.variant || ((w.exercise || '').includes('·') ? w.exercise.split('·')[1].trim() : '?');
    if (!rows[vv]) rows[vv] = { vol: 0, n: 0, pr: 0 };
    rows[vv].vol += w.amount; rows[vv].n++; rows[vv].pr = Math.max(rows[vv].pr, w.amount);
  });
  const maxV = Math.max(1, ...Object.values(rows).map((r) => r.vol));
  $('prGrid').innerHTML = info.variants.map((x) => {
    const r = rows[x] || { vol: 0, n: 0, pr: 0 };
    return `<div class="glass px-4 py-3" style="border-radius:20px">
      <div class="flex justify-between text-sm"><b>${esc(x)}</b><span class="font-extrabold text-amber-300">🏆 ${r.pr}${u}</span></div>
      <p class="text-[11px] text-slate-400 mt-0.5">Vol <b class="text-slate-100">${r.vol}${u}</b> · Media <b class="text-slate-100">${(r.n ? r.vol / r.n : 0).toFixed(1)}${u}</b> · ×${r.n}</p>
      <div class="h-2.5 mt-1.5 rounded-full bg-white/10 overflow-hidden"><div class="bar h-full rounded-full" style="width:${Math.round(r.vol / maxV * 100)}%;background:linear-gradient(90deg,#6366f1,#22d3ee)"></div></div></div>`;
  }).join('');
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(realToday().getTime() - i * 864e5), k = isoOf(d);
    week.push({ d, v: data.filter((w) => w.date === k && ofType(w, TYPE)).reduce((s, w) => s + w.amount, 0) });
  }
  const maxW = Math.max(1, ...week.map((x) => x.v));
  $('weekChart').innerHTML = week.map((x) => `<div class="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
    <span class="text-[8px] font-bold text-slate-400">${x.v || ''}</span>
    <div class="bar w-full rounded-t-lg" style="height:${Math.max(5, Math.round(x.v / maxW * 100))}%;background:${x.v === maxW && x.v > 0 ? 'linear-gradient(180deg,#22d3ee,#6366f1)' : 'rgba(255,255,255,.15)'}"></div>
    <span class="text-[8px] text-slate-500 font-bold">${x.d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</span></div>`).join('');
}
function renderHistory() {
  const rows = data.filter((w) => ofType(w, TYPE));
  const u = TYPES[TYPE].unit === 'seconds' ? 's' : '';
  $('histList').innerHTML = rows.length ? rows.slice(0, 60).map((w) =>
    `<div class="glass px-4 py-3 flex items-center gap-2" style="border-radius:18px">
      <div class="flex-1 min-w-0 text-sm"><b>${esc(w.variant || keyOf(w))}</b> · +${w.amount}${u} <span class="text-slate-500">· ${w.date}</span></div>
      <button onclick="delEntry(${w.id})" class="touch press px-3 text-slate-500">✕</button></div>`).join('')
    : '<p class="text-xs text-slate-500 text-center py-4">Nessun inserimento per questo esercizio.</p>';
}

/* ---------- RANK (scope/metric/periodo + stanze) ---------- */
function setScope(s) { rank.scope = s; if (s !== 'room') rank.room = ''; paintRankSeg(); loadRank(); }
function setMetric(m) { rank.metric = m; paintRankSeg(); loadRank(); }
function setPeriod(p) { rank.period = p; paintRankSeg(); loadRank(); }
function paintRankSeg() {
  const on = (id, c) => { const e = $(id); if (e) e.classList.toggle('active', c); };
  on('mVol', rank.metric === 'volume'); on('mPr', rank.metric === 'pr'); on('mStreak', rank.metric === 'streak');
  on('gGlobal', rank.scope === 'global'); on('gCountry', rank.scope === 'country'); on('gRoom', rank.scope === 'room');
  const dim = rank.metric === 'streak';
  const pb = $('periodBlock'); if (pb) pb.style.opacity = dim ? '.35' : '1';
  on('gToday', rank.period === 'today'); on('gWeek', rank.period === 'week'); on('gAll', rank.period === 'all');
  if (dim) on('gAll', true);
  const rp = $('roomPanel'); if (rp) rp.classList.toggle('hidden', rank.scope !== 'room');
}
function rankRow(r, i, metric) {
  const cat = r.top_category || TYPE, vari = r.top_variant || '';
  const icon = (TYPES[cat] || {}).icon || '🏋️';
  const me = r.username === profile.username ? 'me' : '';
  const unit = (r.top_unit || r.unit) === 'seconds' || cat === 'Plank' ? 's' : '';
  const score = metric === 'pr' ? r.best + (unit || '') : metric === 'streak' ? (r.streak ?? 0) + '🔥' : Number(r.total ?? r.score ?? 0).toLocaleString('it-IT');
  const sub = metric === 'pr' ? `vol ${Number(r.total || 0)} · ×${r.entries}` : metric === 'streak' ? `vol ${Number(r.total || 0)} · PR ${r.best}` : `🏆 max ${r.best} · ×${r.entries}`;
  const edge = i === 0 ? 'border-color:rgba(250,204,21,.6) !important' : i === 1 ? 'border-color:rgba(203,213,225,.5) !important' : i === 2 ? 'border-color:rgba(217,119,6,.55) !important' : '';
  return `<div class="glass px-4 py-3 flex items-center gap-3 ${me}" style="border-radius:20px;${edge}">
    <span class="text-xl w-9 text-center font-extrabold shrink-0">${medal(i)}</span>
    <div class="flex-1 min-w-0">
      <p class="text-[10px] uppercase tracking-widest text-slate-500 truncate">${icon} ${esc(cat || '—')} · ${flag(r.country)} ${esc(r.country || '—')}</p>
      <p class="font-extrabold text-base leading-tight truncate">${esc(vari || '—')} <span class="text-[11px] font-semibold text-slate-400">@${esc(r.username)}${me ? ' <span class="text-[10px] text-emerald-300">· TU</span>' : ''}</span></p>
      <p class="text-[11px] text-slate-400">${sub}</p></div>
    <span class="font-extrabold text-lg shrink-0 ${i === 0 ? 'text-yellow-300' : ''}">${score}</span></div>`;
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
  $('rankList').innerHTML = `<p class="text-[11px] text-slate-400">${mLabel} · ${esc(ex)}</p>` +
    (rank.rows.length ? rank.rows.map((r, i) => rankRow(r, i, rank.metric)).join('')
      : '<p class="text-xs text-slate-500 text-center py-4">Nessuno qui — sii il primo! 🚀</p>');
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
    const kk = (w.category || '') + '|' + (w.variant || '');
    m.top[kk] = (m.top[kk] || 0) + w.amount;
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
    box.innerHTML = `<div class="glass p-4 space-y-2" style="border-radius:20px">
      <p class="text-sm font-bold">🔒 Nessuna stanza selezionata</p>
      <div class="flex gap-2"><input id="joinCode" placeholder="Codice stanza (es. A1B2C3)" maxlength="12" class="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 font-bold uppercase outline-none" />
      <button onclick="joinByCode()" class="press px-5 rounded-2xl font-extrabold text-white" style="background:linear-gradient(135deg,#6366f1,#22d3ee)">Entra</button></div>
      <div class="flex gap-2"><input id="roomName" placeholder="Nome nuova stanza (es. Sfida Lupi)" maxlength="60" class="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none" />
      <button onclick="createRoom()" class="press px-5 rounded-2xl font-extrabold text-white" style="background:linear-gradient(135deg,#34d399,#22d3ee)">Crea</button></div>
      <p class="text-[11px] text-slate-500">La stanza sfida è legata a <b>${esc(TYPE || 'tutti gli esercizi')}</b>. Creala e condividi il link!</p></div>`;
    return;
  }
  try {
    const r = await api('/api/workouts?type=room&code=' + encodeURIComponent(rank.room));
    const mine = (r.members || []).some((m) => m.username === profile.username);
    box.innerHTML = `<div class="glass p-4 space-y-2" style="border-radius:20px;border-color:rgba(99,102,241,.4)">
      <p class="font-extrabold">🔒 ${esc(r.room.name)} <span class="text-xs text-slate-400">${esc(r.room.code)} · 👥${r.members.length}</span></p>
      <p class="text-[11px] text-slate-400">Membri: ${(r.members || []).map((m) => esc(m.username)).join(', ') || '—'}</p>
      <div class="flex gap-2">
        <button onclick="copyRoomLink()" class="press flex-1 py-3 rounded-2xl font-extrabold text-white text-sm" style="background:linear-gradient(135deg,#6366f1,#22d3ee)">🔗 Copia link invito</button>
        ${mine ? '' : `<button onclick="joinRoom()" class="press flex-1 py-3 rounded-2xl font-extrabold glass text-sm">➕ Unisciti</button>`}
      </div>
      <button onclick="leaveRoom()" class="text-[11px] text-slate-500 underline">Esci dalla stanza / cambia codice</button></div>`;
  } catch (e) { box.innerHTML = `<p class="text-xs text-red-300">Stanza non trovata. <button onclick="leaveRoom()" class="underline">Reset</button></p>`; }
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
  paintDay(); renderEntry(); renderStats(); renderHistory(); loadRank();
  const q = new URLSearchParams(location.search).get('room');
  if (q) { rank.scope = 'room'; rank.room = q.trim().toUpperCase(); subtab('rank'); paintRankSeg(); loadRank(); }
}
function subtab(n) {
  document.querySelectorAll('.subtab').forEach((s) => s.classList.remove('active'));
  const el = $('sub-' + n); if (el) el.classList.add('active');
  document.querySelectorAll('[data-sub]').forEach((b) => b.classList.toggle('active', b.dataset.sub === n));
  if (n === 'rank') loadRank();
  window.scrollTo({ top: 0 });
}
document.addEventListener('DOMContentLoaded', () => {
  const sel = $('pfCountry');
  if (sel) sel.innerHTML = COUNTRIES.map((c) => `<option ${c === 'Italia' ? 'selected' : ''}>${c}</option>`).join('');
  boot();
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'inAmount') {
    amount = Math.max(1, parseInt(e.target.value || '0', 10) || 1);
    const s = $('selInfo');
    if (s) { const u = TYPES[TYPE].unit === 'seconds' ? 's' : ' reps'; s.textContent = `${TYPES[TYPE].icon} ${TYPE} · ${variant} → ${amount}${u} · ${selISO()}`; }
  }
});
