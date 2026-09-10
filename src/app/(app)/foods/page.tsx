'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';
import type { Food, Slot } from '../../../lib/types';
import { SLOT_ORDER, SLOT_LABELS } from '../../../lib/constants';

export default function FoodsPage() {
  const supabase = createClient();
  const [foods, setFoods] = useState<Food[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Food | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [fName, setFName] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fKcal, setFKcal] = useState('');
  const [fProtein, setFProtein] = useState('');
  const [fSlot, setFSlot] = useState<Slot>('extra');
  const [fIsPlan, setFIsPlan] = useState(false);
  const [fPlanServings, setFPlanServings] = useState('0');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    console.log('[FoodsPage] Fetching data for userId:', userId);
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', userId)
        .eq('archived', false)
        .order('slot')
        .order('sort_order');
      if (!cancelled && data) setFoods(structuredClone(data));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  const resetForm = () => {
    setFName('');
    setFUnit('');
    setFKcal('');
    setFProtein('');
    setFSlot('extra');
    setFIsPlan(false);
    setFPlanServings('0');
    setEditing(null);
    setShowAdd(false);
  };

  const openEdit = (food: Food) => {
    setEditing(food);
    setFName(food.name);
    setFUnit(food.unit ?? '');
    setFKcal(String(food.kcal));
    setFProtein(String(food.protein));
    setFSlot((food.slot as Slot) ?? 'extra');
    setFIsPlan(food.is_plan);
    setFPlanServings(String(food.plan_servings));
    setShowAdd(true);
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!userId) return;

      const payload = {
        name: fName,
        unit: fUnit || null,
        kcal: Number(fKcal),
        protein: Number(fProtein),
        slot: fSlot,
        is_plan: fIsPlan,
        plan_servings: Number(fPlanServings),
      };

      if (editing) {
        const { data } = await supabase
          .from('foods')
          .update(payload)
          .eq('id', editing.id)
          .select()
          .single();
        if (data) {
          setFoods(prev => prev.map(f => (f.id === data.id ? structuredClone(data) : f)));
        }
      } else {
        const { data } = await supabase
          .from('foods')
          .insert({ ...payload, user_id: userId, sort_order: foods.length })
          .select()
          .single();
        if (data) {
          setFoods(prev => [...prev, structuredClone(data)]);
        }
      }

      resetForm();
    },
    [userId, editing, fName, fUnit, fKcal, fProtein, fSlot, fIsPlan, fPlanServings, foods.length, supabase],
  );

  const archiveFood = useCallback(
    async (foodId: string) => {
      setFoods(prev => prev.filter(f => f.id !== foodId));
      await supabase.from('foods').update({ archived: true }).eq('id', foodId);
    },
    [supabase],
  );

  const moveFood = useCallback(
    async (foodId: string, direction: 'up' | 'down') => {
      setFoods(prev => {
        const idx = prev.findIndex(f => f.id === foodId);
        if (idx === -1) return prev;
        const food = prev[idx];

        // Find siblings in same slot
        const slotFoods = prev.filter(f => f.slot === food.slot);
        const slotIdx = slotFoods.findIndex(f => f.id === foodId);

        if (direction === 'up' && slotIdx === 0) return prev;
        if (direction === 'down' && slotIdx === slotFoods.length - 1) return prev;

        const swapWith = direction === 'up' ? slotFoods[slotIdx - 1] : slotFoods[slotIdx + 1];

        const next = prev.map(f => {
          if (f.id === foodId) return { ...structuredClone(f), sort_order: swapWith.sort_order };
          if (f.id === swapWith.id) return { ...structuredClone(f), sort_order: food.sort_order };
          return f;
        });

        // Persist
        supabase.from('foods').update({ sort_order: swapWith.sort_order }).eq('id', foodId).then();
        supabase.from('foods').update({ sort_order: food.sort_order }).eq('id', swapWith.id).then();

        return next.sort((a, b) => {
          const sa = SLOT_ORDER.indexOf(a.slot as Slot);
          const sb = SLOT_ORDER.indexOf(b.slot as Slot);
          if (sa !== sb) return sa - sb;
          return a.sort_order - b.sort_order;
        });
      });
    },
    [supabase],
  );

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Food Library</h1>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="tap-target px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold transition-all active:scale-95"
        >
          + Add food
        </button>
      </div>

      {/* Add / Edit form */}
      {showAdd && (
        <div className="rounded-2xl p-4 space-y-3 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit food' : 'New food'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              placeholder="Name"
              value={fName}
              onChange={e => setFName(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
            />
            <input
              placeholder="Unit (e.g. 1 scoop)"
              value={fUnit}
              onChange={e => setFUnit(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="kcal"
                type="number"
                value={fKcal}
                onChange={e => setFKcal(e.target.value)}
                required
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
              />
              <input
                placeholder="protein (g)"
                type="number"
                step="0.1"
                value={fProtein}
                onChange={e => setFProtein(e.target.value)}
                required
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Slot</label>
                <select
                  value={fSlot}
                  onChange={e => setFSlot(e.target.value as Slot)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
                >
                  {SLOT_ORDER.map(s => (
                    <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Plan servings</label>
                <input
                  type="number"
                  min="0"
                  value={fPlanServings}
                  onChange={e => setFPlanServings(e.target.value)}
                  disabled={!fIsPlan}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums disabled:opacity-50"
                  style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={fIsPlan}
                onChange={e => setFIsPlan(e.target.checked)}
                className="rounded accent-primary-500 w-4 h-4"
              />
              Part of daily plan
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="tap-target flex-1 rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-600 active:scale-[0.98]"
              >
                {editing ? 'Save' : 'Add'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="tap-target px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Food list by slot */}
      {foodsBySlot.map(group => (
        <section key={group.slot} className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-tertiary)' }}>
            {group.label}
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
            {group.items.map((food, i) => (
              <div
                key={food.id}
                className={`flex items-center gap-2 px-3 py-3 ${i < group.items.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{food.name}</p>
                    {food.is_plan && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-500/15 text-primary-500">
                        Plan ×{food.plan_servings}
                      </span>
                    )}
                  </div>
                  {food.unit && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{food.unit}</p>
                  )}
                  <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {food.kcal} kcal · {food.protein}g protein
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => moveFood(food.id, 'up')}
                    className="tap-target p-1.5 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                  </button>
                  <button
                    onClick={() => moveFood(food.id, 'down')}
                    className="tap-target p-1.5 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  <button
                    onClick={() => openEdit(food)}
                    className="tap-target p-1.5 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  </button>
                  <button
                    onClick={() => archiveFood(food.id)}
                    className="tap-target p-1.5 text-danger transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {foods.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No foods yet. Add your first food above.</p>
        </div>
      )}
    </div>
  );
}
