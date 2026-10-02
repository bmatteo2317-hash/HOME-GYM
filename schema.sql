-- Totali giornalieri — Schema Neon
-- Esegui nel Neon SQL Editor
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  exercise TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL DEFAULT 'reps' CHECK (unit IN ('reps', 'seconds')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
