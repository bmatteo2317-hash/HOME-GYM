// api/workouts.js — Vercel Serverless + Neon (v3 Garmin-style)
// GET  /api/workouts                    -> { workouts }
// POST /api/workouts                    -> singola serie { workout }
// GET  /api/workouts?type=sessions      -> { sessions } da workout_sessions
// POST /api/workouts?type=sessions      -> { session } { session_name, sets[], started_at, ended_at }
// GET/POST /api/workouts?type=profile
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
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id SERIAL PRIMARY KEY,
      session_name TEXT NOT NULL DEFAULT 'Attività',
      sets JSONB NOT NULL DEFAULT '[]'::jsonb,
      total_sets INTEGER NOT NULL DEFAULT 0,
      total_work_sec INTEGER NOT NULL DEFAULT 0,
      total_rest_sec INTEGER NOT NULL DEFAULT 0,
      total_duration_sec INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
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
const ci = (v, d, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return d;
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
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { rows } = await client.query(
        `INSERT INTO profile (id,name,weekly_goal,avatar,level,updated_at) VALUES (1,$1,$2,$3,$4,NOW())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,weekly_goal=EXCLUDED.weekly_goal,avatar=EXCLUDED.avatar,level=EXCLUDED.level,updated_at=NOW() RETURNING *`,
        [String(b.name || 'Atleta').slice(0, 60), ci(b.weekly_goal, 500, 1, 1000000), String(b.avatar || '💪').slice(0, 8), String(b.level || 'Intermedio').slice(0, 30)]
      );
      return send(res, 200, { profile: rows[0] });
    }

    if (type === 'sessions') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT 100');
        return send(res, 200, { sessions: rows });
      }
      if (req.method === 'POST') {
        const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const sets = Array.isArray(b.sets) ? b.sets.slice(0, 500) : [];
        // Normalizza serie
        const clean = sets.map((s) => ({
          exercise_category: String(s.exercise_category || ''),
          exercise_name: String(s.exercise_name || ''),
          metric_type: s.metric_type === 'seconds' ? 'seconds' : 'reps',
          value_count: ci(s.value_count, 1, 1, 100000),
          duration_sec: ci(s.duration_sec, 0, 0, 86400),
          rest_sec: ci(s.rest_sec, 0, 0, 86400),
          started_at: s.started_at || null,
          ended_at: s.ended_at || null,
        })).filter((s) => s.exercise_category && s.exercise_name);
        if (!clean.length) return send(res, 400, { error: 'sets vuoto: registra almeno una serie' });
        const startedAt = b.started_at ? new Date(b.started_at).toISOString() : new Date().toISOString();
        const endedAt = b.ended_at ? new Date(b.ended_at).toISOString() : new Date().toISOString();
        const tw = ci(b.total_work_sec, clean.reduce((a, s) => a + (s.duration_sec || 0), 0), 0, 86400 * 2);
        const tr = ci(b.total_rest_sec, clean.reduce((a, s) => a + (s.rest_sec || 0), 0), 0, 86400 * 2);
        const td = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000)) || (tw + tr);
        const name = String(b.session_name || 'Attività').slice(0, 120);
        const { rows } = await client.query(
          `INSERT INTO workout_sessions (session_name, sets, total_sets, total_work_sec, total_rest_sec, total_duration_sec, started_at, ended_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [name, JSON.stringify(clean), clean.length, tw, tr, td, startedAt, endedAt]
        );
        // Specchio per-serie in workouts (statistiche / storico esistenti)
        const date = new Date(startedAt).toISOString().slice(0, 10);
        for (const s of clean) {
          await client.query(
            `INSERT INTO workouts (exercise_category,exercise_name,metric_type,value_count,sets,date,notes,duration_sec,rest_sec,started_at,ended_at)
             VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10)`,
            [s.exercise_category, s.exercise_name, s.metric_type, s.value_count, date, name, s.duration_sec, s.rest_sec,
             s.started_at ? new Date(s.started_at).toISOString() : startedAt, s.ended_at ? new Date(s.ended_at).toISOString() : endedAt]
          );
        }
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
      let d = new Date().toISOString().slice(0, 10);
      if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) d = b.date;
      const { rows } = await client.query(
        `INSERT INTO workouts (exercise_category,exercise_name,metric_type,value_count,sets,date,notes,duration_sec,rest_sec,started_at,ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [b.exercise_category, b.exercise_name, b.metric_type === 'seconds' ? 'seconds' : 'reps',
         ci(b.value_count, 0, 1, 100000), ci(b.sets, 1, 1, 100), d, String(b.notes || '').slice(0, 500),
         ci(b.duration_sec, 0, 0, 86400), ci(b.rest_sec, 0, 0, 86400),
         b.started_at ? new Date(b.started_at).toISOString() : new Date().toISOString(),
         b.ended_at ? new Date(b.ended_at).toISOString() : null]
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
    console.error(err);
    return send(res, 500, { error: /DATABASE_URL/.test(err.message || '') ? 'DATABASE_URL non configurata su Vercel.' : 'Errore server: ' + err.message });
  } finally { if (client) client.release(); }
};
