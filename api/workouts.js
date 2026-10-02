// api/workouts.js — Vercel Serverless + Neon (con Classifiche Mondiale/Stato)
// GET  /api/workouts -> { workouts }
// POST /api/workouts { category, variant, exercise?, amount, unit?, date, username?, country? }
// GET  /api/workouts?type=leaderboard&scope=global|country&country=Italia&period=today|week|all&exercise=all|Flessioni · Diamond
// GET/POST /api/workouts?type=profile { username, country, ... }

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
  `);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const type = (req.query && req.query.type) || 'workouts';
  let client;
  try {
    client = await getPool().connect();
    await ensureSchema(client);

    // ---------- PROFILO (username + stato per le classifiche) ----------
    if (type === 'profile') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM profile WHERE id = 1');
        return send(res, 200, { profile: rows[0] || null });
      }
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { rows } = await client.query(
        `UPDATE profile SET name=$1, username=$2, country=$3, weekly_goal=$4, avatar=$5, level=$6, updated_at=NOW()
         WHERE id=1 RETURNING *`,
        [String(b.name || 'Atleta').slice(0, 60), String(b.username || '').slice(0, 30),
         String(b.country || 'Italia').slice(0, 40), Math.max(1, parseInt(b.weekly_goal, 10) || 500),
         String(b.avatar || '💪').slice(0, 8), String(b.level || 'Intermedio').slice(0, 30)]
      );
      return send(res, 200, { profile: rows[0] });
    }

    // ---------- LEADERBOARD: volume | PR | streak, decrescente ----------
    if (type === 'leaderboard') {
      const scope = req.query.scope === 'country' ? 'country' : 'global';
      const country = String(req.query.country || '').slice(0, 40);
      const period = ['today', 'week', 'all'].includes(req.query.period) ? req.query.period : 'today';
      const exercise = String(req.query.exercise || 'all').slice(0, 80);
      const metric = ['volume', 'pr', 'streak'].includes(req.query.metric) ? req.query.metric : 'volume';
      const conds = ["username <> ''"];
      const params = [];
      if (scope === 'country' && country) { params.push(country); conds.push('country = $' + params.length); }
      if (metric !== 'streak') {
        if (period === 'today') conds.push("date = CURRENT_DATE");
        if (period === 'week') conds.push('date >= CURRENT_DATE - INTERVAL \'6 days\'');
      }
      if (exercise !== 'all') {
        params.push(exercise);
        if (exercise.includes('·')) conds.push('exercise = $' + params.length);
        else { conds.push('(category = $' + params.length + ' OR exercise = $' + params.length + ')'); }
      }
      const orderBy = metric === 'pr' ? 'agg.best DESC' : metric === 'streak' ? 'cur.streak DESC, agg.total DESC' : 'agg.total DESC';
      // top = variante col volume maggiore (volume/streak) oppure variante del PR (pr)
      const topExpr = metric === 'pr'
        ? `SELECT DISTINCT ON (username) username, category AS top_category, variant AS top_variant, unit AS top_unit
           FROM f ORDER BY username, amount DESC, id DESC`
        : `SELECT DISTINCT ON (username) username, category AS top_category, variant AS top_variant, unit AS top_unit
           FROM (SELECT username, category, variant, unit, SUM(amount) AS v
                 FROM f GROUP BY username, category, variant, unit) s ORDER BY username, v DESC`;
      const streakJoin = metric === 'streak' ? `JOIN (
           SELECT username, COUNT(*) AS streak FROM (
             SELECT username, dt, dt - ROW_NUMBER() OVER (PARTITION BY username ORDER BY dt)::int AS grp
             FROM (SELECT username, date::date AS dt FROM f GROUP BY username, dt) d
           ) g GROUP BY username, grp HAVING MAX(dt) >= CURRENT_DATE - 1
         ) cur USING (username)` : '';
      const { rows } = await client.query(
        `WITH f AS (SELECT * FROM workouts WHERE ${conds.join(' AND ')}),
         agg AS (SELECT username, MAX(country) AS country, SUM(amount) AS total,
                        MAX(amount) AS best, COUNT(*) AS entries, MAX(unit) AS unit
                 FROM f GROUP BY username),
         top AS (${topExpr})
         SELECT agg.*, top.top_category, top.top_variant, top.top_unit
                ${metric === 'streak' ? ', cur.streak' : ''}
         FROM agg LEFT JOIN top USING (username) ${streakJoin} ORDER BY ${orderBy} LIMIT 50`,
        params
      );
      return send(res, 200, { leaderboard: rows.map((r) => ({
        ...r, total: Number(r.total), best: Number(r.best),
        streak: r.streak == null ? undefined : Number(r.streak),
        score: metric === 'pr' ? Number(r.best) : metric === 'streak' ? Number(r.streak) : Number(r.total),
      })) });
    }

    // ---------- WORKOUTS ----------
    if (req.method === 'GET') {
      const { rows } = await client.query('SELECT * FROM workouts ORDER BY date DESC, created_at DESC LIMIT 1000');
      return send(res, 200, { workouts: rows });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const category = String(b.category || '').slice(0, 40);
      const variant = String(b.variant || '').slice(0, 40);
      const exercise = String(b.exercise || (category && variant ? category + ' · ' + variant : category || variant)).slice(0, 80);
      if (!exercise) return send(res, 400, { error: 'exercise/category obbligatorio' });
      const amount = parseInt(b.amount, 10);
      if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: 'amount deve essere > 0' });
      let d = new Date().toISOString().slice(0, 10);
      if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) d = b.date;
      const today = new Date().toISOString().slice(0, 10);
      if (d > today) return send(res, 400, { error: 'Non puoi registrare nel futuro' });
      const { rows } = await client.query(
        'INSERT INTO workouts (exercise, category, variant, amount, unit, date, username, country) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [exercise, category, variant, amount, b.unit === 'seconds' ? 'seconds' : 'reps', d,
         String(b.username || '').slice(0, 30), String(b.country || '').slice(0, 40)]
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
