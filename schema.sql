-- HOME-GYM — Schema Neon (multi-pagina + stanze private)
-- Esegui nel Neon SQL Editor (sicuro da rieseguire)

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
-- Tabelle vecchissime (exercise_category/exercise_name/value_count/metric_type):
-- aggiunge le colonne moderne e migra i dati esistenti, senza perdere nulla
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS exercise TEXT NOT NULL DEFAULT '';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'reps';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='exercise_category') THEN
    UPDATE workouts SET category = exercise_category
    WHERE (category IS NULL OR category = '') AND exercise_category IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='exercise_name') THEN
    UPDATE workouts SET variant = exercise_name
    WHERE (variant IS NULL OR variant = '') AND exercise_name IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='value_count') THEN
    UPDATE workouts SET amount = value_count WHERE value_count > 0 AND (amount IS NULL OR amount = 1);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workouts' AND column_name='metric_type') THEN
    UPDATE workouts SET unit = metric_type WHERE metric_type IN ('reps','seconds');
  END IF;
  UPDATE workouts
  SET exercise = TRIM(BOTH ' ' FROM COALESCE(NULLIF(category,''),'') || CASE WHEN COALESCE(NULLIF(variant,''),'') <> '' THEN ' · ' || variant ELSE '' END)
  WHERE (exercise IS NULL OR exercise = '') AND (COALESCE(category,'') <> '' OR COALESCE(variant,'') <> '');
END $$;
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

-- Stanze private per classifiche tra amici
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
CREATE INDEX IF NOT EXISTS idx_room_members_code ON room_members(room_code);
