'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { lastNDays, displayDate, todayLocal } from '../../../lib/date';
import { useRouter } from 'next/navigation';
import type { Settings, WeighIn } from '../../../lib/types';

interface DaySummary {
  log_date: string;
  kcal: number;
  protein: number;
}

export default function HistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [loading, setLoading] = useState(true);

  // Weigh-in form
  const [wiWeight, setWiWeight] = useState('');
  const [wiSaving, setWiSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const last30 = lastNDays(30);
      const startDate = last30[0];
      const endDate = last30[last30.length - 1];

      const [settingsRes, entriesRes, weighInsRes] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).single(),
        supabase
          .from('entries')
          .select('log_date, kcal, protein, servings')
          .eq('user_id', userId)
          .gte('log_date', startDate)
          .lte('log_date', endDate),
        supabase
          .from('weigh_ins')
          .select('*')
          .eq('user_id', userId)
          .order('log_date', { ascending: true }),
      ]);

      if (cancelled) return;
      if (settingsRes.data) setSettings(structuredClone(settingsRes.data));
      if (weighInsRes.data) setWeighIns(structuredClone(weighInsRes.data));

      // Aggregate entries by day
      const dayMap = new Map<string, { kcal: number; protein: number }>();
      last30.forEach(d => dayMap.set(d, { kcal: 0, protein: 0 }));

      if (entriesRes.data) {
        for (const e of entriesRes.data) {
          const existing = dayMap.get(e.log_date) ?? { kcal: 0, protein: 0 };
          existing.kcal += Number(e.kcal) * Number(e.servings);
          existing.protein += Number(e.protein) * Number(e.servings);
          dayMap.set(e.log_date, existing);
        }
      }

      const summaries: DaySummary[] = last30.map(d => ({
        log_date: d,
        kcal: dayMap.get(d)?.kcal ?? 0,
        protein: dayMap.get(d)?.protein ?? 0,
      }));

      setDays(summaries);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  // Rolling 7-day average
  const rolling7 = useCallback(
    (metric: 'kcal' | 'protein') => {
      if (days.length < 7) return null;
      const last7 = days.slice(-7);
      const avg = last7.reduce((s, d) => s + d[metric], 0) / 7;
      return Math.round(avg);
    },
    [days],
  );

  const kcalTarget = settings?.kcal_target ?? 2850;
  const proteinTarget = settings?.protein_target ?? 110;

  // Weigh-in submit
  const handleWeighIn = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!userId || !wiWeight) return;
      setWiSaving(true);

      const today = todayLocal();
      const weight = Number(wiWeight);

      // Optimistic
      setWeighIns(prev => {
        const filtered = prev.filter(w => w.log_date !== today);
        return [...filtered, { user_id: userId, log_date: today, weight_kg: weight }].sort(
          (a, b) => a.log_date.localeCompare(b.log_date),
        );
      });

      await supabase.from('weigh_ins').upsert(
        { user_id: userId, log_date: today, weight_kg: weight },
        { onConflict: 'user_id,log_date' },
      );

      setWiWeight('');
      setWiSaving(false);
    },
    [userId, wiWeight, supabase],
  );

  // Navigate to day
  const goToDay = (dateStr: string) => {
    // Store date in sessionStorage for the Today page to pick up
    sessionStorage.setItem('viewDate', dateStr);
    router.push('/');
  };

  // Chart max
  const maxKcal = Math.max(kcalTarget, ...days.map(d => d.kcal));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>History</h1>

      {/* Rolling averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)' }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>7-day avg kcal</p>
          <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: 'var(--text)' }}>
            {rolling7('kcal') ?? '—'}
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)' }}>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>7-day avg protein</p>
          <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: 'var(--text)' }}>
            {rolling7('protein') != null ? `${rolling7('protein')}g` : '—'}
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Daily Calories</h2>
        <div className="overflow-x-auto scrollbar-thin -mx-1">
          <div className="flex items-end gap-[3px] h-32 min-w-[450px] px-1 relative">
            {/* Target line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed"
              style={{
                bottom: `${(kcalTarget / maxKcal) * 100}%`,
                borderColor: 'var(--text-tertiary)',
              }}
            />
            {days.map(day => {
              const h = maxKcal > 0 ? (day.kcal / maxKcal) * 100 : 0;
              const miss = day.kcal > 0 && day.kcal < kcalTarget * 0.85;
              return (
                <div
                  key={day.log_date}
                  className="flex-1 min-w-[12px] rounded-t transition-all cursor-pointer hover:opacity-80"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    backgroundColor: miss ? 'rgb(239, 68, 68)' : 'rgb(245, 158, 11)',
                    opacity: day.kcal === 0 ? 0.15 : 1,
                  }}
                  title={`${displayDate(day.log_date)}: ${Math.round(day.kcal)} kcal`}
                  onClick={() => goToDay(day.log_date)}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {displayDate(days[0]?.log_date ?? '')}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Target: {kcalTarget}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {displayDate(days[days.length - 1]?.log_date ?? '')}
            </span>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>kcal</th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>%</th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Protein</th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map(day => {
                const kcalPct = kcalTarget > 0 ? Math.round((day.kcal / kcalTarget) * 100) : 0;
                const protPct = proteinTarget > 0 ? Math.round((day.protein / proteinTarget) * 100) : 0;
                const missed = (day.kcal > 0 || day.protein > 0) && (kcalPct < 85 || protPct < 85);

                return (
                  <tr
                    key={day.log_date}
                    onClick={() => goToDay(day.log_date)}
                    className="border-b cursor-pointer transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: missed ? 'rgba(239, 68, 68, 0.06)' : undefined,
                    }}
                  >
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text)' }}>{displayDate(day.log_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text)' }}>{Math.round(day.kcal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: missed && kcalPct < 85 ? 'rgb(239, 68, 68)' : 'var(--text-secondary)' }}>{kcalPct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--text)' }}>{Math.round(day.protein)}g</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: missed && protPct < 85 ? 'rgb(239, 68, 68)' : 'var(--text-secondary)' }}>{protPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weigh-in */}
      <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Weigh-in</h2>
        <form onSubmit={handleWeighIn} className="flex gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Weight (kg)"
            value={wiWeight}
            onChange={e => setWiWeight(e.target.value)}
            required
            className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={wiSaving}
            className="tap-target px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
          >
            Log
          </button>
        </form>

        {/* Weight chart */}
        {weighIns.length >= 2 && (
          <div className="space-y-2">
            <div className="overflow-x-auto scrollbar-thin -mx-1">
              <WeightChart data={weighIns} />
            </div>
          </div>
        )}

        {weighIns.length > 0 && (
          <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            Latest: {weighIns[weighIns.length - 1].weight_kg} kg on {displayDate(weighIns[weighIns.length - 1].log_date)}
          </p>
        )}
      </section>
    </div>
  );
}

// ── Simple SVG line chart for weight ──
function WeightChart({ data }: { data: WeighIn[] }) {
  if (data.length < 2) return null;

  const weights = data.map(d => Number(d.weight_kg));
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const W = 400;
  const H = 120;
  const padX = 30;
  const padY = 10;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + (1 - (Number(d.weight_kg) - min) / range) * chartH;
    return { x, y, weight: d.weight_kg, date: d.log_date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => (
        <line
          key={frac}
          x1={padX}
          y1={padY + (1 - frac) * chartH}
          x2={W - padX}
          y2={padY + (1 - frac) * chartH}
          stroke="var(--border)"
          strokeWidth={0.5}
          strokeDasharray="3,3"
        />
      ))}
      {/* Y labels */}
      <text x={4} y={padY + 4} fontSize={8} fill="var(--text-tertiary)" fontFamily="var(--font-sans)">{max.toFixed(1)}</text>
      <text x={4} y={H - padY + 4} fontSize={8} fill="var(--text-tertiary)" fontFamily="var(--font-sans)">{min.toFixed(1)}</text>
      {/* Line */}
      <path d={pathD} fill="none" stroke="rgb(245, 158, 11)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(245, 158, 11)" stroke="var(--bg-card)" strokeWidth={1.5}>
          <title>{displayDate(p.date)}: {p.weight} kg</title>
        </circle>
      ))}
    </svg>
  );
}
