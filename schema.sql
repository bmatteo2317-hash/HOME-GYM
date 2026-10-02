-- ============================================
-- HOME-GYM Calisthenics — Schema Neon PostgreSQL
-- Esegui questo script una volta nel Neon SQL Editor
-- ============================================

-- Tabella allenamenti
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  exercise_category TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'reps' CHECK (metric_type IN ('reps', 'seconds')),
  value_count INTEGER NOT NULL CHECK (value_count > 0),
  sets INTEGER NOT NULL DEFAULT 1 CHECK (sets > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_category ON workouts(exercise_category);

-- Tabella profilo utente (single-row: id sempre = 1)
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Atleta',
  weekly_goal INTEGER NOT NULL DEFAULT 500,
  avatar TEXT NOT NULL DEFAULT '💪',
  level TEXT NOT NULL DEFAULT 'Intermedio',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profilo di default
INSERT INTO profile (id, name, weekly_goal, avatar, level)
VALUES (1, 'Atleta', 500, '💪', 'Intermedio')
ON CONFLICT (id) DO NOTHING;
