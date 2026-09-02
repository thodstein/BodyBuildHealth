/**
 * CardioAnalyticsDashboard.tsx — мини-дашборд аналитики (H3).
 * 7д vs 28д, TRIMP тренд, HR compliance, стрик.
 */
import React, { useMemo } from 'react';
import { CARD, ROW, LABEL, HINT_SM, Badge, StatTile } from './CardioUI';
import { cardioLogStats, cardioHrCompliance } from '../../../engines/lms/cardio-diary.engine';
import { cardioMonotonyStrain, cardioFactCtlSeries, cardioHrDrift, interferenceForCycle } from '../../../engines/lms/cardio.engine';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import type { CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';

export const CardioAnalyticsDashboard: React.FC<{ cycle: CardioCycle | null; log: CardioLogEntry[] }> = ({ cycle, log }) => {
  const s7 = useMemo(() => cardioLogStats(log, 7), [log]);
  const s28 = useMemo(() => cardioLogStats(log, 28), [log]);
  const hr = useMemo(() => {
    if (!cycle) return null;
    try { return cardioHrCompliance(cycle, log, { days: 28 }); } catch { return null; }
  }, [cycle, log]);

  const trimp7 = useMemo(() => {
    const factor: Record<string, number> = { zone2: 2, miss: 3, hiit: 5, recovery: 1 };
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    const iso = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    const week = log.filter(e => e.completed && e.date >= iso);
    // Banister HR где есть avgHr, иначе фактор — показывает реальную нагрузку с учётом пульса
    return week.reduce((sum, e) => {
      if (e.avgHr && cycle?.config?.restingHr && cycle?.config?.age) {
        const maxHr = cycle.config.sex === 'female' ? 226 - cycle.config.age : 220 - cycle.config.age;
        const hrr = Math.max(0, Math.min(1, (e.avgHr - cycle.config.restingHr) / (maxHr - cycle.config.restingHr)));
        const k = cycle.config.sex === 'female' ? 0.86 : 0.64;
        const b = cycle.config.sex === 'female' ? 1.67 : 1.92;
        const t = e.durationMin * hrr * k * Math.exp(b * hrr);
        if (t > 0) return sum + Math.round(t);
      }
      return sum + e.durationMin * (factor[e.type] ?? 2);
    }, 0);
  }, [log, cycle]);

  const delta = s28.minutes > 0 ? Math.round(((s7.minutes * 4 - s28.minutes) / s28.minutes) * 100) : 0;

  const polarized = useMemo(() => {
    if (!cycle) return null;
    const totalMin = cycle.weeks.reduce((s, w) => s + w.totalMinutes, 0);
    const intenseMin = cycle.weeks.reduce((s, w) => s + w.sessions.filter(x => x.type === 'hiit' || x.type === 'miss').reduce((a, x) => a + x.durationMin * x.weeklyFrequency, 0), 0);
    if (totalMin === 0) return null;
    const pct = Math.round((intenseMin / totalMin) * 100);
    const ok = pct <= 20;
    return { pct, ok, label: `${100 - pct}/${pct} · ${ok ? '✓ 80/20' : '⚠ >20% интенсива'}` };
  }, [cycle]);

  const monotony = useMemo(() => {
    if (log.length < 7) return null;
    const daily: number[] = [];
    const map = new Map<string, number>();
    for (const e of log.filter(x => x.completed)) map.set(e.date, (map.get(e.date) ?? 0) + e.durationMin * (e.rpe ? e.rpe / 5 : 1));
    const dates = Array.from(map.keys()).sort();
    const last7 = dates.slice(-7);
    for (const d of last7) daily.push(map.get(d) ?? 0);
    if (daily.length < 3) return null;
    const m = cardioMonotonyStrain(daily);
    return { ...m, warn: m.monotony > 2 || m.strain > 6000 };
  }, [log]);

  const factCtl = useMemo(() => {
    if (log.length < 7) return null;
    try {
      const now = new Date();
      const ref = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const series = cardioFactCtlSeries(log, {
        restHr: cycle?.config?.restingHr,
        maxHr: cycle?.config?.age ? (cycle.config.sex === 'female' ? 226 - cycle.config.age : 220 - cycle.config.age) : undefined,
        sex: cycle?.config?.sex,
        referenceIso: ref,
        days: 42,
      });
      if (series.length === 0) return null;
      return series[series.length - 1];
    } catch { return null; }
  }, [log, cycle]);

  const hrDriftNote = useMemo(() => {
    if (log.length < 2) return null;
    const withHr = log.filter(e => e.completed && e.avgHr && e.avgHr > 0).slice(0, 10);
    if (withHr.length < 2) return null;
    const first = withHr[0].avgHr!;
    const second = withHr[1].avgHr!;
    const drift = cardioHrDrift(first, second);
    return drift.warn ? `HR drift ${drift.driftPct}% >5% — признак утомления/обезвоживания` : null;
  }, [log]);

  const interference = useMemo(() => {
    if (!cycle) return null;
    try {
      const legPerWeek = cycle.config?.legDays ? cycle.config.legDays.filter(d => d >= 0 && d <= 6).length || 2 : 2;
      return interferenceForCycle(cycle as any, legPerWeek, cycle.config?.sex);
    } catch { return null; }
  }, [cycle]);

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>Аналитика 7д / 28д</span>
        <Badge bg={delta >= 10 ? 'rgba(239,68,68,0.12)' : delta <= -10 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)'} border={delta >= 10 ? 'rgba(239,68,68,0.24)' : delta <= -10 ? 'rgba(34,197,94,0.24)' : 'rgba(255,255,255,0.08)'} color={delta >= 10 ? '#f87171' : delta <= -10 ? '#4ade80' : '#fff'}>{delta > 0 ? '+' + delta + '%' : delta + '%'} к 28д</Badge>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <StatTile label="7Д МИН" value={String(s7.minutes)} color="#22c55e" sub={s7.sessions + ' сесс' + (s7.avgPace ? ' · ' + s7.avgPace : '')} />
        <StatTile label="28Д МИН" value={String(s28.minutes)} color="#3b82f6" sub={s28.sessions + ' сесс'} />
        <StatTile label="TRIMP 7Д" value={String(trimp7)} color="#a78bfa" sub="Banister/HR" />
        <StatTile label="HR в зоне" value={hr?.inZonePct != null ? hr.inZonePct + '%' : '—'} color={hr?.inZonePct != null && hr.inZonePct >= 70 ? '#4ade80' : '#fbbf24'} sub={hr?.avgDelta != null ? (hr.avgDelta > 0 ? '+' : '') + hr.avgDelta + ' уд' : ''} />
        {polarized && <StatTile label="80/20" value={polarized.pct + '%'} color={polarized.ok ? '#4ade80' : '#fbbf24'} sub={polarized.label} />}
        {interference && <StatTile label="INTERF." value={String(interference.score)} color={interference.level === 'low' ? '#4ade80' : interference.level === 'mid' ? '#fbbf24' : '#f87171'} sub={interference.level} />}
      </div>
      {hr?.advice && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>{hr.advice}</div>}
      {polarized && !polarized.ok && <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, padding: '6px 8px' }}>⚠ Поляризация {polarized.pct}% интенсива — по Seiler держите ≤20% HIIT/MISS, остальное Zone2.</div>}
      {monotony && (
        <div style={{ fontSize: 11, color: monotony.warn ? '#f87171' : '#4ade80', background: monotony.warn ? 'rgba(239,68,68,0.08)' : 'rgba(0,230,138,0.08)', border: `1px solid ${monotony.warn ? 'rgba(239,68,68,0.24)' : 'rgba(0,230,138,0.24)'}`, borderRadius: 8, padding: '6px 8px' }}>
          {monotony.warn ? '⚠' : '✓'} Monotony {monotony.monotony} · Strain {monotony.strain} {monotony.warn ? '— варьируйте нагрузку (Foster)' : '— вариативность в норме'}
        </div>
      )}
      {factCtl && (
        <div style={{ fontSize: 11, color: Math.abs(factCtl.tsb) > 10 ? '#f87171' : factCtl.tsb > 5 ? '#4ade80' : '#fff', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.24)', borderRadius: 8, padding: '6px 8px' }}>
          📈 Факт CTL {factCtl.ctl} · ATL {factCtl.atl} · TSB {factCtl.tsb > 0 ? '+' : ''}{factCtl.tsb} {factCtl.tsb > 15 ? '— пик формы, снизьте объём' : factCtl.tsb < -10 ? '— перегруз, восстановитесь' : '— баланс'}
        </div>
      )}
      {hrDriftNote && <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 8, padding: '6px 8px' }}>⚠ {hrDriftNote}</div>}
      {interference && interference.level !== 'low' && <div style={{ fontSize: 11, color: interference.level === 'high' ? '#f87171' : '#fbbf24', background: interference.level === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${interference.level === 'high' ? 'rgba(239,68,68,0.24)' : 'rgba(245,158,11,0.24)'}`, borderRadius: 8, padding: '6px 8px' }}>⚡ Interference {interference.score}/10 ({interference.level}) — {interference.advice}</div>}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 8px' }}>🩸 При ferritin &lt;30 мкг/л — железо 18мг + витамин C, контроль Hb; RED-S &lt;30 ккал/кг FFM — объём не повышать.</div>
      <div style={HINT_SM}>TRIMP Banister (HRr×k·e^b·HRr) где есть HR, иначе фактор. Рост &gt;15% за неделю — риск перегруза. 80/20 — Seiler polarized.</div>
    </div>
  );
};
