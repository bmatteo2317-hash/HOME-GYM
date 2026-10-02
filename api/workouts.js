// api/workouts.js — Vercel Serverless + Neon (tipologia+variante, day-nav, obiettivi)
// GET  /api/workouts -> { workouts }
// POST /api/workouts { category, variant, exercise?, amount, unit?, date } -> { workout }

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  let client;
  try {
    client = await getPool().connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        exercise TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        variant TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL CHECK (amount > 0),
        unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps','seconds')),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
    `);
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
      // blocco futuro: mai oltre oggi
      const today = new Date().toISOString().slice(0, 10);
      if (d > today) return send(res, 400, { error: 'Non puoi registrare nel futuro' });
      const { rows } = await client.query(
        'INSERT INTO workouts (exercise, category, variant, amount, unit, date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [exercise, category, variant, amount, b.unit === 'seconds' ? 'seconds' : 'reps', d]
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
