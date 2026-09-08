'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { DRILLS, DRILL_SLOT_ORDER, DRILL_SLOT_LABELS } from '../../../lib/constants';
import { todayLocal, displayDate } from '../../../lib/date';

export default function DrillsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [date] = useState(todayLocal);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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
      const { data } = await supabase
        .from('drill_log')
        .select('drill_id')
        .eq('user_id', userId)
        .eq('log_date', date);
      if (!cancelled && data) {
        setDone(new Set(data.map(r => r.drill_id)));
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId, date, supabase]);

  const toggleDrill = useCallback(
    (drillId: string) => {
      if (!userId) return;
      setDone(prev => {
        const next = new Set(prev);
        if (next.has(drillId)) {
          next.delete(drillId);
          supabase.from('drill_log').delete().eq('user_id', userId).eq('log_date', date).eq('drill_id', drillId).then();
        } else {
          next.add(drillId);
          supabase.from('drill_log').insert({ user_id: userId, log_date: date, drill_id: drillId }).then();
        }
        return next;
      });
    },
    [userId, date, supabase],
  );

  const doneCount = done.size;
  const totalMinutes = DRILLS.filter(d => done.has(d.id)).reduce((s, d) => s + d.minutes, 0);
  const pct = (doneCount / DRILLS.length) * 100;

  const groups = DRILL_SLOT_ORDER.map(slot => ({
    slot,
    label: DRILL_SLOT_LABELS[slot],
    items: DRILLS.filter(d => d.slot === slot),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Daily Drills</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{displayDate(date)}</p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {doneCount}<span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}> / {DRILLS.length}</span>
          </span>
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {totalMinutes} min done
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? 'rgb(34, 197, 94)' : 'rgb(245, 158, 11)',
            }}
          />
        </div>
        {pct === 100 && (
          <p className="text-sm font-medium text-success text-center">All drills done! 💪</p>
        )}
      </div>

      {/* Drill groups */}
      {groups.map(group => (
        <section key={group.slot} className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-tertiary)' }}>
            {group.label}
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
            {group.items.map((drill, i) => {
              const checked = done.has(drill.id);
              return (
                <button
                  key={drill.id}
                  onClick={() => toggleDrill(drill.id)}
                  className={`tap-target w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    i < group.items.length - 1 ? 'border-b' : ''
                  }`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      checked ? 'bg-primary-500 border-primary-500' : ''
                    }`}
                    style={!checked ? { borderColor: 'var(--border)' } : undefined}
                  >
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${checked ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--text)' }}>
                      {drill.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {drill.minutes} min · {drill.instruction}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
