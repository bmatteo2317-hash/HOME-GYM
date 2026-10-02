-- ============================================
-- HOME-GYM v3 — Schema Neon (Garmin-style)
-- Sessioni con JSONB + log per-serie
-- Esegui nel Neon SQL Editor
-- ============================================

-- Serie singole (una riga per serie loggata)
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
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);

-- Sessioni attività (una riga per attività Garmin-style)
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
VALUES (1, 'Atleta', 500, '💪', 'Intermedio')
ON CONFLICT (id) DO NOTHING;
