-- ============================================================
-- GymTracker — single-file, idempotent Supabase schema
-- Run once in the Supabase SQL editor. Safe to run again.
-- ============================================================

-- ---------- settings ----------
CREATE TABLE IF NOT EXISTS settings (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal_target    int NOT NULL DEFAULT 2850,
  protein_target int NOT NULL DEFAULT 110,
  bodyweight_kg  numeric,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'settings_owner'
  ) THEN
    CREATE POLICY settings_owner ON settings
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- foods ----------
CREATE TABLE IF NOT EXISTS foods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  unit         text,
  kcal         numeric NOT NULL,
  protein      numeric NOT NULL,
  slot         text,
  is_plan      boolean DEFAULT false,
  plan_servings numeric DEFAULT 0,
  sort_order   int DEFAULT 0,
  archived     boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'foods' AND policyname = 'foods_owner'
  ) THEN
    CREATE POLICY foods_owner ON foods
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- entries ----------
CREATE TABLE IF NOT EXISTS entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date     date NOT NULL,
  food_id      uuid REFERENCES foods(id) ON DELETE SET NULL,
  name         text NOT NULL,
  unit         text,
  kcal         numeric NOT NULL,
  protein      numeric NOT NULL,
  servings     numeric NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, log_date);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'entries' AND policyname = 'entries_owner'
  ) THEN
    CREATE POLICY entries_owner ON entries
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- drill_log ----------
CREATE TABLE IF NOT EXISTS drill_log (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date  date NOT NULL,
  drill_id  text NOT NULL,
  PRIMARY KEY (user_id, log_date, drill_id)
);

ALTER TABLE drill_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drill_log' AND policyname = 'drill_log_owner'
  ) THEN
    CREATE POLICY drill_log_owner ON drill_log
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- mastery ----------
CREATE TABLE IF NOT EXISTS mastery (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id   text NOT NULL,
  passed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, test_id)
);

ALTER TABLE mastery ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mastery' AND policyname = 'mastery_owner'
  ) THEN
    CREATE POLICY mastery_owner ON mastery
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------- weigh_ins ----------
CREATE TABLE IF NOT EXISTS weigh_ins (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date   date NOT NULL,
  weight_kg  numeric NOT NULL,
  PRIMARY KEY (user_id, log_date)
);

ALTER TABLE weigh_ins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weigh_ins' AND policyname = 'weigh_ins_owner'
  ) THEN
    CREATE POLICY weigh_ins_owner ON weigh_ins
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Trigger: auto-create settings + seed foods on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default settings row
  INSERT INTO public.settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Seed the default food library
  INSERT INTO public.foods (user_id, name, unit, kcal, protein, slot, is_plan, plan_servings, sort_order)
  VALUES
    (NEW.id, 'Sattu drink',        '3 tbsp (30 g) + jaggery, in water',  140, 6.0,  'pre',   true,  1, 0),
    (NEW.id, 'Workout drink',      '1 L — sugar, salt, lemon',           115, 0,    'pre',   true,  1, 1),
    (NEW.id, 'Whey',               '1 scoop (33 g) in water',            130, 28,   'post',  true,  1, 0),
    (NEW.id, 'PG breakfast',       '1 plate',                            400, 10,   'pg',    true,  1, 0),
    (NEW.id, 'PG lunch',           '1 plate',                            650, 16,   'pg',    true,  1, 1),
    (NEW.id, 'PG dinner',          '1 plate',                            550, 14,   'pg',    true,  1, 2),
    (NEW.id, 'Peanuts',            '1 handful (30 g)',                   170, 7.8,  'snack', true,  2, 0),
    (NEW.id, 'Soya chunks',        '30 g dry, soaked and squeezed',      104, 15.6, 'snack', true,  1, 1),
    (NEW.id, 'Roasted chana',      '1 handful (30 g)',                   114, 6.6,  'snack', true,  1, 2),
    (NEW.id, 'Oats + milk powder', '33 g oats + 16 g powder + jaggery', 223, 8.3,  'night', true,  1, 0),
    (NEW.id, 'Boiled egg',         '1 egg',                              78,  6.3,  'extra', false, 0, 0),
    (NEW.id, 'Banana',             '1 medium',                          105, 1.3,  'extra', false, 0, 1),
    (NEW.id, 'Milk powder',        '3 tbsp (25 g) in water',            124, 6.3,  'extra', false, 0, 2)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop and re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
