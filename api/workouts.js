// api/workouts.js — Vercel Serverless + Neon PostgreSQL (v2 live sessions)
// Env: process.env.DATABASE_URL
// Workouts: GET /api/workouts · POST /api/workouts {category,name,metric_type,value_count,sets,date,notes,duration_sec,rest_sec,started_at,ended_at}
// Sessions: GET /api/workouts?type=sessions · POST /api/workouts?type=sessions {started_at,ended_at,total_work_sec,total_rest_sec,total_sets,notes}
// Profile:  GET/POST /api/workouts?type=profile
// DELETE /api/workouts?id=123

const { Pool } = require('pg');
let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non configurata');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });
  }
  return pool;
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      exercise_category TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      metric_type TEXT NOT NULL DEFAULT 'reps' CHECK (metric_type IN ('reps', 'seconds')),
      value_count INTEGER NOT NULL CHECK (value_count > 0),
      sets INTEGER NOT NULL DEFAULT 1 CHECK (sets > 0),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT NOT NULL DEFAULT '',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      rest_sec INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS duration_sec INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rest_sec INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      total_work_sec INTEGER NOT NULL DEFAULT 0,
      total_rest_sec INTEGER NOT NULL DEFAULT 0,
      total_sets INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Atleta',
      weekly_goal INTEGER NOT NULL DEFAULT 500,
      avatar TEXT NOT NULL DEFAULT '💪',
      level TEXT NOT NULL DEFAULT 'Intermedio',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO profile (id, name, weekly_goal, avatar, level)
    VALUES (1, 'Atleta', 500, '💪', 'Intermedio') ON CONFLICT (id) DO NOTHING;
  `);
}

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
const clampInt = (v, dflt, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
};

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

    if (type === 'profile') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM profile WHERE id = 1');
        return send(res, 200, { profile: rows[0] || null });
      }
      if (req.method === 'POST') {
        const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { rows } = await client.query(
          `INSERT INTO profile (id,name,weekly_goal,avatar,level,updated_at) VALUES (1,$1,$2,$3,$4,NOW())
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,weekly_goal=EXCLUDED.weekly_goal,avatar=EXCLUDED.avatar,level=EXCLUDED.level,updated_at=NOW() RETURNING *`,
          [String(b.name || 'Atleta').slice(0, 60), clampInt(b.weekly_goal, 500, 1, 1000000), String(b.avatar || '💪').slice(0, 8), String(b.level || 'Intermedio').slice(0, 30)]
        );
        return send(res, 200, { profile: rows[0] });
      }
      return send(res, 405, { error: 'Metodo non supportato' });
    }

    if (type === 'sessions') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100');
        return send(res, 200, { sessions: rows });
      }
      if (req.method === 'POST') {
        const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { rows } = await client.query(
          `INSERT INTO sessions (started_at,ended_at,total_work_sec,total_rest_sec,total_sets,notes)
           VALUES (COALESCE($1,NOW()),$2,$3,$4,$5,$6) RETURNING *`,
          [b.started_at || null, b.ended_at || null, clampInt(b.total_work_sec, 0, 0, 86400),
           clampInt(b.total_rest_sec, 0, 0, 86400), clampInt(b.total_sets, 0, 0, 10000), String(b.notes || '').slice(0, 500)]
        );
        return send(res, 201, { session: rows[0] });
      }
      return send(res, 405, { error: 'Metodo non supportato' });
    }

    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
      const params = [];
      let sql = 'SELECT * FROM workouts';
      if (req.query.category && req.query.category !== 'all') { sql += ' WHERE exercise_category = $1'; params.push(req.query.category); }
      sql += ' ORDER BY COALESCE(started_at, created_at) DESC LIMIT ' + limit;
      const { rows } = await client.query(sql, params);
      return send(res, 200, { workouts: rows });
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.exercise_category || !b.exercise_name) return send(res, 400, { error: 'exercise_category ed exercise_name obbligatori' });
      const metric = b.metric_type === 'seconds' ? 'seconds' : 'reps';
      const value = clampInt(b.value_count, 0, 1, 100000);
      const nSets = clampInt(b.sets, 1, 1, 100);
      if (!value) return send(res, 400, { error: 'value_count deve essere > 0' });
      let d = new Date().toISOString().slice(0, 10);
      if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) d = b.date;
      // Timestamp preciso: usa started_at inviato dal client (ora di sistema) oppure NOW()
      const startedAt = b.started_at ? new Date(b.started_at).toISOString() : new Date().toISOString();
      const endedAt = b.ended_at ? new Date(b.ended_at).toISOString() : null;
      const { rows } = await client.query(
        `INSERT INTO workouts (exercise_category,exercise_name,metric_type,value_count,sets,date,notes,duration_sec,rest_sec,started_at,ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [b.exercise_category, b.exercise_name, metric, value, nSets, d, String(b.notes || '').slice(0, 500),
         clampInt(b.duration_sec, 0, 0, 86400), clampInt(b.rest_sec, 0, 0, 86400), startedAt, endedAt]
      );
      return send(res, 201, { workout: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!Number.isFinite(id)) return send(res, 400, { error: 'id non valido' });
      await client.query('DELETE FROM workouts WHERE id = $1', [id]);
      return send(res, 200, { ok: true, deleted: id });
    }
    return send(res, 405, { error: 'Metodo non supportato' });
  } catch (err) {
    console.error('API error:', err);
    return send(res, 500, { error: /DATABASE_URL/.test(err.message || '') ? 'DATABASE_URL non configurata su Vercel.' : 'Errore server: ' + err.message });
  } finally { if (client) client.release(); }
};
