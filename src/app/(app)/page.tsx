'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';
import type { Food, Entry, Settings, Slot } from '../../lib/types';
import { todayLocal, addDays, displayDate, isToday, isFuture } from '../../lib/date';
import { SLOT_ORDER, SLOT_LABELS } from '../../lib/constants';
import Link from 'next/link';

// ────────────────────────────────────────────
//  Today Page — the home screen
// ────────────────────────────────────────────

export default function TodayPage() {
  const supabase = createClient();
  const [date, setDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('viewDate');
      if (stored) {
        sessionStorage.removeItem('viewDate');
        return stored;
      }
    }
    return todayLocal();
  });
  const [foods, setFoods] = useState<Food[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick-add form
  const [qaName, setQaName] = useState('');
  const [qaKcal, setQaKcal] = useState('');
  const [qaProtein, setQaProtein] = useState('');
  const [qaServings, setQaServings] = useState('1');
  const [qaSave, setQaSave] = useState(false);
  const [qaSlot, setQaSlot] = useState<Slot>('extra');

  // Track pending writes to prevent stale overwrites
  const pendingRef = useRef<Set<string>>(new Set());

  // Debounce timers for stepper writes
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Editing entry
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editServings, setEditServings] = useState('');

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase.auth]);

  // Load data when date or userId changes
  useEffect(() => {
    if (!userId) return;
    console.log('[TodayPage] Fetching data for userId:', userId);
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [settingsRes, foodsRes, entriesRes] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).single(),
        supabase.from('foods').select('*').eq('user_id', userId).eq('archived', false).order('slot').order('sort_order'),
        supabase.from('entries').select('*').eq('user_id', userId).eq('log_date', date).order('created_at'),
      ]);

      if (cancelled) return;
      if (settingsRes.data) setSettings(structuredClone(settingsRes.data));
      if (foodsRes.data) setFoods(structuredClone(foodsRes.data));
      if (entriesRes.data) setEntries(structuredClone(entriesRes.data));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, date, supabase]);

  // ── Helpers ──
  const kcalTarget = settings?.kcal_target ?? 2850;
  const proteinTarget = settings?.protein_target ?? 110;

  const totalKcal = entries.reduce((s, e) => s + Number(e.kcal) * Number(e.servings), 0);
  const totalProtein = entries.reduce((s, e) => s + Number(e.protein) * Number(e.servings), 0);

  const kcalLeft = Math.max(0, kcalTarget - totalKcal);
  const proteinLeft = Math.max(0, proteinTarget - totalProtein);
  const kcalDone = totalKcal >= kcalTarget;
  const proteinDone = totalProtein >= proteinTarget;

  // Count servings already logged for a given food today
  const servingsLogged = useCallback(
    (foodId: string) =>
      entries
        .filter(e => e.food_id === foodId)
        .reduce((s, e) => s + Number(e.servings), 0),
    [entries],
  );

  // ── Log a food (optimistic) ──
  const logFood = useCallback(
    (food: Food, servings: number = 1) => {
      if (!userId || isFuture(date)) return;

      const tempId = crypto.randomUUID();
      const entry: Entry = {
        id: tempId,
        user_id: userId,
        log_date: date,
        food_id: food.id,
        name: food.name,
        unit: food.unit,
        kcal: Number(food.kcal),
        protein: Number(food.protein),
        servings,
        created_at: new Date().toISOString(),
      };

      // Optimistic
      setEntries(prev => [...prev, structuredClone(entry)]);

      pendingRef.current.add(tempId);

      // Debounce
      const existing = debounceTimers.current.get(food.id);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        food.id,
        setTimeout(async () => {
          const { data } = await supabase
            .from('entries')
            .insert({
              user_id: userId,
              log_date: date,
              food_id: food.id,
              name: food.name,
              unit: food.unit,
              kcal: Number(food.kcal),
              protein: Number(food.protein),
              servings,
            })
            .select()
            .single();

          pendingRef.current.delete(tempId);

          if (data) {
            setEntries(prev =>
              prev.map(e => (e.id === tempId ? structuredClone(data) : e)),
            );
          }
        }, 400),
      );
    },
    [userId, date, supabase],
  );

  // ── Remove one serving of a food (optimistic) ──
  const removeOneServing = useCallback(
    (food: Food) => {
      // Find the last entry for this food
      const idx = [...entries].reverse().findIndex(e => e.food_id === food.id);
      if (idx === -1) return;
      const entry = entries[entries.length - 1 - idx];

      if (Number(entry.servings) <= 1) {
        // Delete the entry
        setEntries(prev => prev.filter(e => e.id !== entry.id));
        supabase.from('entries').delete().eq('id', entry.id).then();
      } else {
        // Decrement servings
        const newServings = Number(entry.servings) - 1;
        setEntries(prev =>
          prev.map(e =>
            e.id === entry.id ? { ...structuredClone(e), servings: newServings } : e,
          ),
        );
        supabase
          .from('entries')
          .update({ servings: newServings })
          .eq('id', entry.id)
          .then();
      }
    },
    [entries, supabase],
  );

  // ── Delete entry ──
  const deleteEntry = useCallback(
    (entryId: string) => {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      supabase.from('entries').delete().eq('id', entryId).then();
    },
    [supabase],
  );

  // ── Update entry servings ──
  const updateEntryServings = useCallback(
    (entryId: string, newServings: number) => {
      if (newServings < 0) return;
      if (newServings === 0) {
        deleteEntry(entryId);
        return;
      }
      setEntries(prev =>
        prev.map(e =>
          e.id === entryId ? { ...structuredClone(e), servings: newServings } : e,
        ),
      );
      supabase
        .from('entries')
        .update({ servings: newServings })
        .eq('id', entryId)
        .then();
    },
    [deleteEntry, supabase],
  );

  // ── Quick add ──
  const handleQuickAdd = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!userId || !qaName || !qaKcal || !qaProtein) return;

      const kcal = Number(qaKcal);
      const protein = Number(qaProtein);
      const servings = Number(qaServings) || 1;

      let foodId: string | null = null;

      // If saving to library, create food first
      if (qaSave) {
        const { data: foodData } = await supabase
          .from('foods')
          .insert({
            user_id: userId,
            name: qaName,
            kcal,
            protein,
            slot: qaSlot,
            is_plan: false,
            plan_servings: 0,
            sort_order: 999,
          })
          .select()
          .single();

        if (foodData) {
          foodId = foodData.id;
          setFoods(prev => [...prev, structuredClone(foodData)]);
        }
      }

      // Log entry
      const entry: Entry = {
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: date,
        food_id: foodId,
        name: qaName,
        unit: null,
        kcal,
        protein,
        servings,
        created_at: new Date().toISOString(),
      };

      setEntries(prev => [...prev, structuredClone(entry)]);

      const { data } = await supabase
        .from('entries')
        .insert({
          user_id: userId,
          log_date: date,
          food_id: foodId,
          name: qaName,
          kcal,
          protein,
          servings,
        })
        .select()
        .single();

      if (data) {
        setEntries(prev =>
          prev.map(ent => (ent.id === entry.id ? structuredClone(data) : ent)),
        );
      }

      // Reset form
      setQaName('');
      setQaKcal('');
      setQaProtein('');
      setQaServings('1');
      setQaSave(false);
    },
    [userId, date, qaName, qaKcal, qaProtein, qaServings, qaSave, qaSlot, supabase],
  );

  // ── Log all PG meals ──
  const logAllPG = useCallback(() => {
    const pgFoods = foods.filter(f => f.slot === 'pg');
    pgFoods.forEach(food => logFood(food, 1));
  }, [foods, logFood]);

  // ── Still to eat logic ──
  const computeStillToEat = useCallback(() => {
    let kcalGap = kcalTarget - totalKcal;
    let proteinGap = proteinTarget - totalProtein;

    // Day closed?
    if (kcalGap <= 40 && proteinGap <= 3) {
      return { closed: true, planItems: [], extras: [] };
    }

    // Remaining plan items
    const planItems: { food: Food; remaining: number }[] = [];
    foods
      .filter(f => f.is_plan)
      .forEach(food => {
        const logged = servingsLogged(food.id);
        const remaining = Number(food.plan_servings) - logged;
        if (remaining > 0) {
          planItems.push({ food, remaining });
          kcalGap -= remaining * Number(food.kcal);
          proteinGap -= remaining * Number(food.protein);
        }
      });

    // Need extras?
    const extras: { food: Food; count: number }[] = [];
    if (kcalGap > 200 || proteinGap > 10) {
      const candidates = foods.filter(f => f.slot !== 'pg' && !f.archived);
      const pickCounts = new Map<string, number>();

      for (let i = 0; i < 8; i++) {
        if (kcalGap <= 0 && proteinGap <= 0) break;

        let bestFood: Food | null = null;
        let bestScore = -Infinity;

        for (const food of candidates) {
          const count = pickCounts.get(food.id) ?? 0;
          if (count >= 4) continue;

          const newKcalGap = kcalGap - Number(food.kcal);

          const score =
            (2 * Math.max(0, proteinGap - Number(food.protein))) / proteinTarget +
            Math.max(0, kcalGap - Number(food.kcal)) / kcalTarget;

          // We want the food that reduces the gap most → lower score is better,
          // but we compute original score minus new score
          const improvement =
            (2 * Math.max(0, proteinGap)) / proteinTarget +
            Math.max(0, kcalGap) / kcalTarget -
            score;

          let finalScore = improvement;

          // Penalty for overshooting calories
          if (newKcalGap < -220) {
            finalScore -= 0.35;
          }

          if (finalScore > bestScore) {
            bestScore = finalScore;
            bestFood = food;
          }
        }

        if (!bestFood || bestScore <= 0) break;

        const count = pickCounts.get(bestFood.id) ?? 0;
        pickCounts.set(bestFood.id, count + 1);

        const existing = extras.find(x => x.food.id === bestFood!.id);
        if (existing) {
          existing.count++;
        } else {
          extras.push({ food: bestFood, count: 1 });
        }

        kcalGap -= Number(bestFood.kcal);
        proteinGap -= Number(bestFood.protein);
      }
    }

    return { closed: false, planItems, extras };
  }, [foods, kcalTarget, proteinTarget, totalKcal, totalProtein, servingsLogged]);

  const stillToEat = computeStillToEat();

  // ── Date navigation ──
  const goBack = () => setDate(prev => addDays(prev, -1));
  const goForward = () => {
    if (!isToday(date)) setDate(prev => addDays(prev, 1));
  };
  const goToday = () => setDate(todayLocal());

  // Group foods by slot
  const foodsBySlot = SLOT_ORDER.map(slot => ({
    slot,
    label: SLOT_LABELS[slot],
    items: foods.filter(f => f.slot === slot),
  })).filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
      {/* ── Date Header ── */}
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="tap-target p-2 rounded-xl transition-colors hover:bg-surface-200 dark:hover:bg-surface-800" style={{ color: 'var(--text)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
        <button onClick={goToday} className="text-center">
          <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{displayDate(date)}</span>
          {!isToday(date) && (
            <span className="block text-xs text-primary-500 font-medium">tap for today</span>
          )}
        </button>
        <button
          onClick={goForward}
          disabled={isToday(date)}
          className="tap-target p-2 rounded-xl transition-colors hover:bg-surface-200 dark:hover:bg-surface-800 disabled:opacity-25"
          style={{ color: 'var(--text)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>

      {/* ── Macro Meters ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/settings" className="block tap-target hover:scale-[0.98] transition-transform">
          <MacroMeter label="Calories" remaining={kcalLeft} logged={totalKcal} target={kcalTarget} done={kcalDone} unit="kcal" color="primary" />
        </Link>
        <Link href="/settings" className="block tap-target hover:scale-[0.98] transition-transform">
          <MacroMeter label="Protein" remaining={proteinLeft} logged={totalProtein} target={proteinTarget} done={proteinDone} unit="g" color="emerald" />
        </Link>
      </div>

      {/* ── Food Library ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Food Library</h2>
        {foodsBySlot.map(group => (
          <div key={group.slot} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-tertiary)' }}>
              {group.label}
            </h3>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
              {group.items.map((food, i) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  count={servingsLogged(food.id)}
                  onAdd={() => logFood(food)}
                  onRemove={() => removeOneServing(food)}
                  isLast={i === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Log all PG ── */}
      {foods.some(f => f.slot === 'pg') && (
        <button
          onClick={logAllPG}
          className="tap-target w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          🍽️ Log all PG meals
        </button>
      )}

      {/* ── Quick Add ── */}
      <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Quick add</h2>
        <form onSubmit={handleQuickAdd} className="space-y-3">
          <input
            placeholder="Food name"
            value={qaName}
            onChange={e => setQaName(e.target.value)}
            required
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              placeholder="kcal"
              type="number"
              value={qaKcal}
              onChange={e => setQaKcal(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
            />
            <input
              placeholder="protein (g)"
              type="number"
              step="0.1"
              value={qaProtein}
              onChange={e => setQaProtein(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
            />
            <input
              placeholder="servings"
              type="number"
              min="1"
              value={qaServings}
              onChange={e => setQaServings(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={qaSave}
                onChange={e => setQaSave(e.target.checked)}
                className="rounded accent-primary-500 w-4 h-4"
              />
              Save to my foods
            </label>
            {qaSave && (
              <select
                value={qaSlot}
                onChange={e => setQaSlot(e.target.value as Slot)}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
              >
                {SLOT_ORDER.map(s => (
                  <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                ))}
              </select>
            )}
          </div>
          <button
            type="submit"
            className="tap-target w-full rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-600 active:scale-[0.98]"
          >
            Add
          </button>
        </form>
      </section>

      {/* ── Today's Entries ── */}
      {entries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Today&apos;s entries ({entries.length})
          </h2>
          <div className="rounded-2xl overflow-hidden divide-y" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{entry.name}</p>
                  <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {Number(entry.kcal) * Number(entry.servings)} kcal · {(Number(entry.protein) * Number(entry.servings)).toFixed(1)}g
                    {Number(entry.servings) !== 1 && ` · ×${entry.servings}`}
                  </p>
                </div>
                {editingEntry === entry.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editServings}
                      onChange={e => setEditServings(e.target.value)}
                      className="w-14 rounded-lg px-2 py-1 text-sm text-center tabular-nums"
                      style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
                    />
                    <button
                      onClick={() => {
                        updateEntryServings(entry.id, Number(editServings));
                        setEditingEntry(null);
                      }}
                      className="tap-target p-1.5 text-success"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { setEditingEntry(entry.id); setEditServings(String(entry.servings)); }}
                      className="tap-target p-1.5 transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="tap-target p-1.5 text-danger transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Still to eat ── */}
      <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Still to eat</h2>
        {stillToEat.closed ? (
          <div className="text-center py-4">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-medium mt-1 text-success">Day closed — targets met!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stillToEat.planItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>From your plan</p>
                {stillToEat.planItems.map(({ food, remaining }) => (
                  <div key={food.id} className="flex items-center justify-between text-sm py-1">
                    <span style={{ color: 'var(--text)' }}>{food.name}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      ×{remaining} ({remaining * Number(food.kcal)} kcal, {(remaining * Number(food.protein)).toFixed(1)}g)
                    </span>
                  </div>
                ))}
              </div>
            )}
            {stillToEat.extras.length > 0 && (
              <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Suggested extras</p>
                {stillToEat.extras.map(({ food, count }) => (
                  <div key={food.id} className="flex items-center justify-between text-sm py-1">
                    <span style={{ color: 'var(--text)' }}>{food.name}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      ×{count} ({count * Number(food.kcal)} kcal, {(count * Number(food.protein)).toFixed(1)}g)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ────────────────────────────────────────────
//  Sub-components
// ────────────────────────────────────────────

function MacroMeter({
  label,
  remaining,
  logged,
  target,
  done,
  unit,
  color,
}: {
  label: string;
  remaining: number;
  logged: number;
  target: number;
  done: boolean;
  unit: string;
  color: 'primary' | 'emerald';
}) {
  const pct = Math.min(100, (logged / target) * 100);
  const barColor = done
    ? 'rgb(34, 197, 94)'
    : color === 'primary'
    ? 'rgb(245, 158, 11)'
    : 'rgb(16, 185, 129)';

  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </p>
      {done ? (
        <p className="text-2xl font-bold text-success tabular-nums">Done ✓</p>
      ) : (
        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
          {Math.round(remaining)}
          <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>
            {unit} left
          </span>
        </p>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
        {Math.round(logged)} / {target} {unit}
      </p>
    </div>
  );
}

function FoodRow({
  food,
  count,
  onAdd,
  onRemove,
  isLast,
}: {
  food: Food;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 ${!isLast ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {food.name}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {food.unit}
        </p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {food.kcal} kcal · {food.protein}g
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRemove}
          disabled={count === 0}
          className="tap-target w-9 h-9 flex items-center justify-center rounded-lg text-base font-bold transition-all active:scale-90 disabled:opacity-25"
          style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-semibold tabular-nums no-layout-shift" style={{ color: 'var(--text)' }}>
          {count}
        </span>
        <button
          onClick={onAdd}
          className="tap-target w-9 h-9 flex items-center justify-center rounded-lg text-base font-bold transition-all active:scale-90 bg-primary-500 text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}
