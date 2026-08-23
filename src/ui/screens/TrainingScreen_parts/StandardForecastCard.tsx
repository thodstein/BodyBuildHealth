import React, { useMemo } from 'react';
import type { WorkoutLog } from '../../../core/types';

interface Standards {
  ms: number;       // Мастер спорта
  mc: number;       // Мастер спорта международного класса
  zms: number;      // Заслуженный мастер спорта
  label: string;
}

const IPF_STANDARDS: Record<string, (bw: number) => Standards> = {
  squat: (bw: number) => {
    if (bw <= 59) return { ms: 165, mc: 190, zms: 220, label: 'Присед' };
    if (bw <= 66) return { ms: 185, mc: 210, zms: 240, label: 'Присед' };
    if (bw <= 74) return { ms: 205, mc: 230, zms: 260, label: 'Присед' };
    if (bw <= 83) return { ms: 220, mc: 245, zms: 280, label: 'Присед' };
    if (bw <= 93) return { ms: 230, mc: 260, zms: 295, label: 'Присед' };
    if (bw <= 105) return { ms: 240, mc: 270, zms: 310, label: 'Присед' };
    if (bw <= 120) return { ms: 250, mc: 280, zms: 320, label: 'Присед' };
    return { ms: 255, mc: 285, zms: 325, label: 'Присед' };
  },
  bench: (bw: number) => {
    if (bw <= 59) return { ms: 105, mc: 125, zms: 150, label: 'Жим лёжа' };
    if (bw <= 66) return { ms: 120, mc: 140, zms: 165, label: 'Жим лёжа' };
    if (bw <= 74) return { ms: 135, mc: 155, zms: 180, label: 'Жим лёжа' };
    if (bw <= 83) return { ms: 145, mc: 170, zms: 195, label: 'Жим лёжа' };
    if (bw <= 93) return { ms: 155, mc: 180, zms: 210, label: 'Жим лёжа' };
    if (bw <= 105) return { ms: 165, mc: 190, zms: 220, label: 'Жим лёжа' };
    if (bw <= 120) return { ms: 170, mc: 200, zms: 230, label: 'Жим лёжа' };
    return { ms: 175, mc: 205, zms: 235, label: 'Жим лёжа' };
  },
  deadlift: (bw: number) => {
    if (bw <= 59) return { ms: 200, mc: 230, zms: 265, label: 'Становая тяга' };
    if (bw <= 66) return { ms: 225, mc: 255, zms: 295, label: 'Становая тяга' };
    if (bw <= 74) return { ms: 245, mc: 280, zms: 320, label: 'Становая тяга' };
    if (bw <= 83) return { ms: 265, mc: 300, zms: 345, label: 'Становая тяга' };
    if (bw <= 93) return { ms: 280, mc: 320, zms: 365, label: 'Становая тяга' };
    if (bw <= 105) return { ms: 295, mc: 335, zms: 385, label: 'Становая тяга' };
    if (bw <= 120) return { ms: 305, mc: 350, zms: 400, label: 'Становая тяга' };
    return { ms: 315, mc: 360, zms: 410, label: 'Становая тяга' };
  },
};

function loadTrainingProfile(): any {
  try { return JSON.parse(localStorage.getItem('he_training_profile') || '{}'); } catch { return {}; }
}

const LIFT_ALIASES: Record<string, string[]> = {
  squat: ['squat', 'присед', 'приседания', 'barbell squat', 'squat (barbell)', 'присед со штангой'],
  bench: ['bench', 'жим', 'жим лёжа', 'bench press', 'жим штанги лёжа'],
  deadlift: ['deadlift', 'тяга', 'становая тяга', 'conventional deadlift', 'deadlift (barbell)'],
};

function findMainLift(sessions: WorkoutLog[], key: string): { name: string; current1RM: number; weeklyGain: number } | null {
  const aliases = LIFT_ALIASES[key];
  const byEx: Record<string, { dates: string[]; rmVals: number[] }> = {};
  sessions.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    if (!aliases.some(a => en.includes(a))) return;
    const name = e.exerciseName || e.exerciseId;
    if (!byEx[name]) byEx[name] = { dates: [], rmVals: [] };
    (e.sets || []).forEach((s: any) => {
      const e1rm = (s.weight || 0) * (1 + (s.reps || 0) / 30);
      if (e1rm > 0) {
        byEx[name].dates.push(w.date);
        byEx[name].rmVals.push(Math.round(e1rm));
      }
    });
  }));
  const entries = Object.entries(byEx).map(([n, d]) => ({
    name: n, current1RM: Math.max(...d.rmVals, 0),
    recent: d.rmVals.slice(-2),
    dates: d.dates.sort(),
  })).filter(e => e.current1RM > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b.current1RM - a.current1RM);
  const best = entries[0];
  const weeklyGain = best.recent.length >= 2 ? (best.recent[1] - best.recent[0]) / Math.max(1, (new Date(best.dates[best.dates.length - 1]).getTime() - new Date(best.dates[0]).getTime()) / 604800000) : 0;
  return { name: best.name, current1RM: best.current1RM, weeklyGain };
}

function formatWeeks(weeks: number): string {
  if (weeks <= 0) return '—';
  if (weeks < 2) return `${Math.round(weeks * 7)} дн.`;
  if (weeks < 52) return `${Math.round(weeks)} нед (${Math.round(weeks / 4.33)} мес.)`;
  return `${(weeks / 52).toFixed(1)} лет`;
}

const StandardForecastCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const forecasts = useMemo(() => {
    if (!sessions.length) return null;
    const profile = loadTrainingProfile();
    const bw = profile.bodyWeight || 80;
    const lifts: Record<string, { name: string; current1RM: number; weeklyGain: number }> = {};
    for (const key of ['squat', 'bench', 'deadlift']) {
      const found = findMainLift(sessions, key);
      if (found) lifts[key] = found;
    }
    const results: { lift: string; name: string; current: number; std: Standards; weeksToMS: number; weeksToMC: number }[] = [];
    for (const [key, data] of Object.entries(lifts)) {
      const std = IPF_STANDARDS[key](bw);
      const g = Math.max(0.1, data.weeklyGain);
      results.push({
        lift: std.label, name: data.name, current: data.current1RM, std,
        weeksToMS: Math.max(0, (std.ms - data.current1RM) / g),
        weeksToMC: Math.max(0, (std.mc - data.current1RM) / g),
      });
    }
    // Сумма
    const total = { current: 0, ms: 0, mc: 0, gain: 0 };
    for (const r of results) {
      total.current += r.current;
      total.ms += r.std.ms;
      total.mc += r.std.mc;
      const g = Math.max(0.1, r.weeksToMS > 0 ? (r.std.ms - r.current) / r.weeksToMS : 0);
      total.gain += g;
    }
    const avgGain = total.gain / Math.max(1, results.length);
    return { lifts: results, total, avgGain, bw };
  }, [sessions]);

  if (!forecasts || !forecasts.lifts.length) return null;

  return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        🏆 Прогноз достижения нормативов (IPF, {forecasts.bw} кг)
      </div>
      {forecasts.lifts.map((r, i) => {
        const msPct = Math.round((r.current / r.std.ms) * 100);
        const mcPct = Math.round((r.current / r.std.mc) * 100);
        return (
          <div key={r.lift} style={{ marginBottom: 8, padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{r.lift}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#00e68a' }}>{r.current} кг</span>
            </div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 2 }}>
              {r.name.length > 25 ? r.name.slice(0, 23) + '…' : r.name}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', marginBottom: 2 }}>МС ({r.std.ms} кг) — {msPct}%</div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, msPct)}%`, height: '100%', borderRadius: 2, background: msPct >= 100 ? '#22c55e' : '#60a5fa' }} />
                </div>
                <div style={{ marginTop: 2, color: msPct >= 100 ? '#22c55e' : '#fff' }}>
                  {msPct >= 100 ? '✅ Норматив выполнен' : `→ ${formatWeeks(r.weeksToMS)}`}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', marginBottom: 2 }}>МСМК ({r.std.mc} кг) — {mcPct}%</div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, mcPct)}%`, height: '100%', borderRadius: 2, background: mcPct >= 100 ? '#22c55e' : '#a855f7' }} />
                </div>
                <div style={{ marginTop: 2, color: mcPct >= 100 ? '#22c55e' : '#fff' }}>
                  {mcPct >= 100 ? '✅ Норматив выполнен' : `→ ${formatWeeks(r.weeksToMC)}`}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {forecasts.lifts.length >= 2 && (
        <div style={{ fontSize: 10, padding: '4px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.06)', marginTop: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Сумма: {forecasts.total.current} / {forecasts.total.ms} кг (МС)</div>
          <div style={{ color: '#fff', fontSize: 10 }}>
            {forecasts.total.current >= forecasts.total.ms
              ? '✅ Норматив МС по сумме выполнен'
              : `При текущем темпе (+${forecasts.avgGain.toFixed(1)} кг/нед в среднем) МС по сумме достигается через ${formatWeeks((forecasts.total.ms - forecasts.total.current) / Math.max(0.1, forecasts.avgGain * forecasts.lifts.length))}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StandardForecastCard);
