// api/workouts.js — Vercel Serverless + Neon (multi-pagina + stanze private)
// Workouts: GET /api/workouts · POST /api/workouts · DELETE /api/workouts?id=
// Leaderboard: GET /api/workouts?type=leaderboard&scope=global|country&country=&period=today|week|all&metric=volume|pr|streak&exercise=&room=CODE
// Stanze: GET /api/workouts?type=rooms · POST type=rooms {name, exercise, username, country}
//         POST type=room_join {code, username, country} · GET type=room&code=
// Profilo: GET/POST /api/workouts?type=profile

const crypto = require('crypto');
const { Pool } = require('pg');
let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non configurata');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
  }
  return pool;
}
function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      exercise TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      variant TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL CHECK (amount > 0),
      unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps','seconds')),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      username TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
    CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(username);
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Atleta',
      username TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Italia',
      weekly_goal INTEGER NOT NULL DEFAULT 500,
      avatar TEXT NOT NULL DEFAULT '💪',
      level TEXT NOT NULL DEFAULT 'Intermedio',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
    ALTER TABLE profile ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Italia';
    INSERT INTO profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      exercise TEXT NOT NULL DEFAULT 'all',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS room_members (
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      username TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_code, username)
    );
  `);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const type = (req.query && req.query.type) || 'workouts';
  const body = (() => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return {}; } })();
  let client;
  try {
    client = await getPool().connect();
    await ensureSchema(client);

    if (type === 'profile') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM profile WHERE id = 1');
        return send(res, 200, { profile: rows[0] || null });
      }
      const { rows } = await client.query(
        `UPDATE profile SET name=$1, username=$2, country=$3, weekly_goal=$4, avatar=$5, level=$6, updated_at=NOW()
         WHERE id=1 RETURNING *`,
        [String(body.name || 'Atleta').slice(0, 60), String(body.username || '').slice(0, 30),
         String(body.country || 'Italia').slice(0, 40), Math.max(1, parseInt(body.weekly_goal, 10) || 500),
         String(body.avatar || '💪').slice(0, 8), String(body.level || 'Intermedio').slice(0, 30)]
      );
      return send(res, 200, { profile: rows[0] });
    }

    // ---------- STANZE PRIVATE ----------
    if (type === 'rooms') {
      if (req.method === 'GET') {
        const { rows } = await client.query(
          `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_code=r.code) AS members
           FROM rooms r ORDER BY r.created_at DESC LIMIT 100`);
        return send(res, 200, { rooms: rows.map((r) => ({ ...r, members: Number(r.members) })) });
      }
      const name = String(body.name || '').trim().slice(0, 60);
      const username = String(body.username || '').trim().slice(0, 30);
      if (!name) return send(res, 400, { error: 'nome stanza obbligatorio' });
      if (!username) return send(res, 400, { error: 'username obbligatorio (impostalo nel Profilo)' });
      let code = null;
      for (let i = 0; i < 5 && !code; i++) {
        const c = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
        const exists = await client.query('SELECT 1 FROM rooms WHERE code=$1', [c]);
        if (!exists.rowCount) code = c;
      }
      if (!code) return send(res, 500, { error: 'riprova' });
      await client.query('INSERT INTO rooms (code,name,exercise,created_by) VALUES ($1,$2,$3,$4)',
        [code, name, String(body.exercise || 'all').slice(0, 80), username]);
      await client.query(
        'INSERT INTO room_members (room_code,username,country) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [code, username, String(body.country || '').slice(0, 40)]);
      return send(res, 201, { room: { code, name, exercise: String(body.exercise || 'all') } });
    }
    if (type === 'room_join' && req.method === 'POST') {
      const code = String(body.code || '').trim().toUpperCase();
      const username = String(body.username || '').trim().slice(0, 30);
      if (!code || !username) return send(res, 400, { error: 'code e username obbligatori' });
      const r = await client.query('SELECT * FROM rooms WHERE code=$1', [code]);
      if (!r.rowCount) return send(res, 404, { error: 'stanza non trovata: controlla il codice' });
      await client.query(
        'INSERT INTO room_members (room_code,username,country) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [code, username, String(body.country || '').slice(0, 40)]);
      return send(res, 200, { ok: true, room: r.rows[0] });
    }
    if (type === 'room' && req.method === 'GET') {
      const code = String(req.query.code || '').trim().toUpperCase();
      const r = await client.query('SELECT * FROM rooms WHERE code=$1', [code]);
      if (!r.rowCount) return send(res, 404, { error: 'stanza non trovata' });
      const m = await client.query('SELECT username,country,joined_at FROM room_members WHERE room_code=$1 ORDER BY joined_at', [code]);
      return send(res, 200, { room: r.rows[0], members: m.rows });
    }

    // ---------- LEADERBOARD (volume | pr | streak), con filtro stanza ----------
    if (type === 'leaderboard') {
      const scope = req.query.scope === 'country' ? 'country' : 'global';
      const country = String(req.query.country || '').slice(0, 40);
      const period = ['today', 'week', 'all'].includes(req.query.period) ? req.query.period : 'today';
      const exercise = String(req.query.exercise || 'all').slice(0, 80);
      const metric = ['volume', 'pr', 'streak'].includes(req.query.metric) ? req.query.metric : 'volume';
      const room = String(req.query.room || '').trim().toUpperCase();
      const conds = ["username <> ''"];
      const params = [];
      if (room) { params.push(room); conds.push('username IN (SELECT username FROM room_members WHERE room_code=$' + params.length + ')'); }
      else if (scope === 'country' && country) { params.push(country); conds.push('country = $' + params.length); }
      if (metric !== 'streak') {
        if (period === 'today') conds.push('date = CURRENT_DATE');
        if (period === 'week') conds.push("date >= CURRENT_DATE - INTERVAL '6 days'");
      }
      if (exercise !== 'all') {
        params.push(exercise);
        if (exercise.includes('·')) conds.push('exercise = $' + params.length);
        else conds.push('(category = $' + params.length + ' OR exercise = $' + params.length + ')');
      }
      const orderBy = metric === 'pr' ? 'agg.best DESC' : metric === 'streak' ? 'cur.streak DESC, agg.total DESC' : 'agg.total DESC';
      const topExpr = metric === 'pr'
        ? 'SELECT DISTINCT ON (username) username, category AS top_category, variant AS top_variant, unit AS top_unit FROM f ORDER BY username, amount DESC, id DESC'
        : 'SELECT DISTINCT ON (username) username, category AS top_category, variant AS top_variant, unit AS top_unit FROM (SELECT username, category, variant, unit, SUM(amount) AS v FROM f GROUP BY username, category, variant, unit) s ORDER BY username, v DESC';
      const streakJoin = metric === 'streak' ? 'JOIN (SELECT username, COUNT(*) AS streak FROM (SELECT username, dt, dt - ROW_NUMBER() OVER (PARTITION BY username ORDER BY dt)::int AS grp FROM (SELECT username, date::date AS dt FROM f GROUP BY username, dt) d) g GROUP BY username, grp HAVING MAX(dt) >= CURRENT_DATE - 1) cur USING (username)' : '';
      const { rows } = await client.query(
        `WITH f AS (SELECT * FROM workouts WHERE ${conds.join(' AND ')}),
         agg AS (SELECT username, MAX(country) AS country, SUM(amount) AS total, MAX(amount) AS best, COUNT(*) AS entries, MAX(unit) AS unit FROM f GROUP BY username),
         top AS (${topExpr})
         SELECT agg.*, top.top_category, top.top_variant, top.top_unit ${metric === 'streak' ? ', cur.streak' : ''}
         FROM agg LEFT JOIN top USING (username) ${streakJoin} ORDER BY ${orderBy} LIMIT 50`,
        params
      );
      return send(res, 200, { leaderboard: rows.map((r) => ({
        ...r, total: Number(r.total), best: Number(r.best),
        streak: r.streak == null ? undefined : Number(r.streak),
        score: metric === 'pr' ? Number(r.best) : metric === 'streak' ? Number(r.streak) : Number(r.total),
      })) });
    }

    if (req.method === 'GET') {
      const { rows } = await client.query('SELECT * FROM workouts ORDER BY date DESC, created_at DESC LIMIT 1000');
      return send(res, 200, { workouts: rows });
    }
    if (req.method === 'POST') {
      if (!body.exercise && !(body.category || body.variant)) return send(res, 400, { error: 'esercizio obbligatorio' });
      const category = String(body.category || '').slice(0, 40);
      const variant = String(body.variant || '').slice(0, 40);
      const exercise = String(body.exercise || (category + ' · ' + variant)).slice(0, 80);
      const amount = parseInt(body.amount, 10);
      if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'amount deve essere > 0' });
      let d = new Date().toISOString().slice(0, 10);
      if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) d = body.date;
      if (d > new Date().toISOString().slice(0, 10)) return send(res, 400, { error: 'Non puoi registrare nel futuro' });
      const { rows } = await client.query(
        'INSERT INTO workouts (exercise, category, variant, amount, unit, date, username, country) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [exercise, category, variant, amount, body.unit === 'seconds' ? 'seconds' : 'reps', d,
         String(body.username || '').slice(0, 30), String(body.country || '').slice(0, 40)]
      );
      return send(res, 201, { workout: rows[0] });
    }
    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!Number.isFinite(id)) return send(res, 400, { error: 'id non valido' });
      await client.query('DELETE FROM workouts WHERE id = $1', [id]);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Metodo non supportato' });
  } catch (err) {
    return send(res, 500, { error: /DATABASE_URL/.test(err.message || '') ? 'DATABASE_URL non configurata su Vercel.' : err.message });
  } finally { if (client) client.release(); }
};
