// Database row types — match supabase/schema.sql exactly.
// Never use `any`. Every field is explicitly typed.

export interface Settings {
  user_id: string;
  kcal_target: number;
  protein_target: number;
  bodyweight_kg: number | null;
  updated_at: string;
}

export interface Food {
  id: string;
  user_id: string;
  name: string;
  unit: string | null;
  kcal: number;
  protein: number;
  slot: Slot | null;
  is_plan: boolean;
  plan_servings: number;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  log_date: string;           // YYYY-MM-DD
  food_id: string | null;
  name: string;
  unit: string | null;
  kcal: number;
  protein: number;
  servings: number;
  created_at: string;
}

export interface DrillLog {
  user_id: string;
  log_date: string;           // YYYY-MM-DD
  drill_id: string;
}

export interface MasteryRow {
  user_id: string;
  test_id: string;
  passed_at: string;
}

export interface WeighIn {
  user_id: string;
  log_date: string;           // YYYY-MM-DD
  weight_kg: number;
}

// Slot types
export type Slot = 'pre' | 'post' | 'pg' | 'snack' | 'night' | 'extra';

export type DrillSlot = 'wake' | 'wait' | 'bath' | 'bed';

// Drill definition (hardcoded in app)
export interface DrillDef {
  id: string;
  name: string;
  slot: DrillSlot;
  minutes: number;
  instruction: string;
}

// Weapon + test definition (hardcoded in app)
export interface WeaponTest {
  id: string;
  description: string;
}

export interface Weapon {
  id: number;
  name: string;
  tests: WeaponTest[];
}

// History row for display
export interface DaySummary {
  log_date: string;
  kcal: number;
  protein: number;
  kcal_pct: number;
  protein_pct: number;
}
