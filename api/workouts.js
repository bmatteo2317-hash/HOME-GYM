// api/workouts.js — Funzione Serverless Vercel (Node.js) + Neon PostgreSQL
// Env: process.env.DATABASE_URL
// - GET  /api/workouts?limit=500&category=Flessioni -> { workouts: [...] }
// - POST /api/workouts { exercise_category, exercise_name, metric_type, value_count, sets, date, notes } -> { workout }
// - DELETE /api/workouts?id=123 -> { ok: true }
// - GET/POST /api/workouts?type=profile <-> { profile }

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non configurata');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Atleta',
      weekly_goal INTEGER NOT NULL DEFAULT 500,
      avatar TEXT NOT NULL DEFAULT '💪',
      level TEXT NOT NULL DEFAULT 'Intermedio',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO profile (id, name, weekly_goal, avatar, level)
    VALUES (1, 'Atleta', 500, '💪', 'Intermedio')
    ON CONFLICT (id) DO NOTHING;
  `);
}

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
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

    if (type === 'profile') {
      if (req.method === 'GET') {
        const { rows } = await client.query('SELECT * FROM profile WHERE id = 1');
        return send(res, 200, { profile: rows[0] || null });
      }
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { name = 'Atleta', weekly_goal = 500, avatar = '💪', level = 'Intermedio' } = body;
        const { rows } = await client.query(
          `INSERT INTO profile (id, name, weekly_goal, avatar, level, updated_at)
           VALUES (1, $1, $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, weekly_goal=EXCLUDED.weekly_goal,
             avatar=EXCLUDED.avatar, level=EXCLUDED.level, updated_at=NOW()
           RETURNING *`,
          [String(name).slice(0, 60), Math.max(1, parseInt(weekly_goal, 10) || 500), String(avatar).slice(0, 8), String(level).slice(0, 30)]
        );
        return send(res, 200, { profile: rows[0] });
      }
      return send(res, 405, { error: 'Metodo non supportato per profile' });
    }

    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
      const category = req.query.category;
      const params = [];
      let sql = 'SELECT * FROM workouts';
      if (category && category !== 'all') { sql += ' WHERE exercise_category = $1'; params.push(category); }
      sql += ' ORDER BY date DESC, created_at DESC LIMIT ' + limit;
      const { rows } = await client.query(sql, params);
      return send(res, 200, { workouts: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { exercise_category, exercise_name, metric_type = 'reps', value_count, sets = 1, date, notes = '' } = body;
      if (!exercise_category || !exercise_name) return send(res, 400, { error: 'exercise_category ed exercise_name obbligatori' });
      const metric = metric_type === 'seconds' ? 'seconds' : 'reps';
      const value = parseInt(value_count, 10);
      const nSets = parseInt(sets, 10);
      if (!Number.isFinite(value) || value <= 0) return send(res, 400, { error: 'value_count deve essere > 0' });
      if (!Number.isFinite(nSets) || nSets <= 0 || nSets > 100) return send(res, 400, { error: 'sets tra 1 e 100' });
      let workoutDate = new Date().toISOString().slice(0, 10);
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) workoutDate = date;
      const { rows } = await client.query(
        `INSERT INTO workouts (exercise_category, exercise_name, metric_type, value_count, sets, date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [exercise_category, exercise_name, metric, value, nSets, workoutDate, String(notes).slice(0, 500)]
      );
      return send(res, 201, { workout: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!Number.isFinite(id)) return send(res, 400, { error: 'id non valido. Usa DELETE /api/workouts?id=123' });
      await client.query('DELETE FROM workouts WHERE id = $1', [id]);
      return send(res, 200, { ok: true, deleted: id });
    }

    return send(res, 405, { error: 'Metodo non supportato' });
  } catch (err) {
    console.error('API error:', err);
    return send(res, 500, {
      error: /DATABASE_URL/.test(err.message || '')
        ? 'DATABASE_URL non configurata su Vercel. Vedi README.'
        : 'Errore server: ' + err.message,
    });
  } finally {
    if (client) client.release();
  }
};
