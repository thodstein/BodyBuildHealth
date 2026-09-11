/**
 * quality-hub-parts.tsx — P7-распил CalcQualityTab (без смены логики, дословный перенос):
 * useQualityProgram (выбор программы + разделение), useQualityCharts (все чарты/экстры),
 * QualityScoreCard (кольцо 0-100 + issues), PerMuscleBars (полосы MEV/MAV/MRV).
 */
import React, { useMemo, useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { loadUserPrograms } from '../../../engines/user-program/program-store';
import { loadTrainingProfile } from './training-profile';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { norm } from '../../../engines/norm';
import { calcSessionMetrics } from '../../../engines/lms/lms-metrics.engine';
import type { LMSWeekMetric } from '../SRCBBScreen_parts/TrainingMetricsChart';
import { LEGACY_WM_DEFAULTS, buildSyntheticPlWeeks, resolveWorkMax } from './quality-hub-helpers';

export type QualityDivision = 'bb' | 'pl';

const ru = (g: string) => GROUP_RU[g] || g;

/** Выбор программы + разделение (было inline-стейтом CalcQualityTab, 1-в-1). */
export function useQualityProgram(propsProgram: UserProgram | null | undefined) {
  const programs = useMemo(() => loadUserPrograms(), []);
  const [selectedId, setSelectedId] = useState<string>(() => propsProgram?.meta.id || programs[0]?.meta.id || '');
  const [division, setDivision] = useState<QualityDivision>(() => {
    const p = propsProgram || programs[0];
    if (!p) return 'bb';
    if (p.meta.direction === 'pl') return 'pl';
    if (p.meta.direction === 'bb') return 'bb';
    return 'bb';
  });
  const selectedProgram: UserProgram | null = useMemo(() => {
    if (propsProgram && !selectedId) return propsProgram;
    if (selectedId) return programs.find(p => p.meta.id === selectedId) || propsProgram || programs[0] || null;
    return propsProgram || programs[0] || null;
  }, [propsProgram, programs, selectedId]);
  const isHybrid = selectedProgram?.meta.direction === 'hybrid';
  return { programs, selectedId, setSelectedId, division, setDivision, selectedProgram, isHybrid };
}

/** Все чарты/экстры (дословный перенос 7 useMemo из CalcQualityTab). */
export function useQualityCharts(
  selectedProgram: UserProgram | null,
  division: QualityDivision,
  analysis: { perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; mev: number; mav: number; mrv: number; status: string }> } | null,
) {
  const lmsChart: LMSWeekMetric[] | null = useMemo(() => {
    if (division !== 'pl' || !selectedProgram?.pl) return null;
    try {
      const weeks: any[] = (selectedProgram.pl as any).customWeeks || [];
      let plWeeks: any[] = weeks;
      if (!plWeeks.length && (selectedProgram.pl as any).sourceCycleId) {
        const tpl = getCycleById((selectedProgram.pl as any).sourceCycleId);
        if (tpl) plWeeks = buildSyntheticPlWeeks(tpl as any) as any[];
      }
      if (!plWeeks.length) return null;
      const workMax: any = (selectedProgram.pl as any).workMax || { squat: 140, bench: 100, dead: 160 };
      const pmMap: Record<string, number> = {
        'Присед': workMax.squat || 140,
        'Приседания со штангой': workMax.squat || 140,
        'Жим лежа': workMax.bench || 100,
        'Жим лёжа': workMax.bench || 100,
        'Становая тяга': workMax.dead || 160,
        'Тяга': workMax.dead || 160,
      };
      const fallbackPm = 80;
      const getPm = (name: string) => {
        if (pmMap[name] != null) return pmMap[name];
        const n = norm(name);
        for (const k of Object.keys(pmMap)) if (n.includes(norm(k)) || norm(k).includes(n)) return pmMap[k];
        return fallbackPm;
      };
      const chart: LMSWeekMetric[] = [];
      for (const w of plWeeks) {
        const sessions: any[] = [];
        for (const d of (w.days || [])) {
          const exs: any[] = [];
          for (const ex of (d.exercises || [])) {
            const pm = getPm(ex.name);
            const sets = (ex.sets || []).map((s: any) => ({ weight: pm * (s.pct || 0.7), reps: s.reps || 5, sets: s.sets || 3 }));
            exs.push({ name: ex.name, group: ex.muscle || 'chest', coef: 1, mnosz: 1, pm, sets });
          }
          const m = calcSessionMetrics(exs);
          sessions.push(m);
        }
        let ton = 0, kpsh = 0, relW = 0, uoiN = 0, intFB = 0;
        for (const s of sessions) { ton += s.tonnage; kpsh += s.kpsh; relW += s.relIntensity * s.kpsh; uoiN += s.uoi * s.kpsh; intFB += s.intFB; }
        const relInt = kpsh > 0 ? relW / kpsh : 0;
        const uoi = kpsh > 0 ? uoiN / kpsh : 0;
        chart.push({ week: (w as any).week || chart.length + 1, tonnage: Math.round(ton), kpsh, relInt: Math.round(relInt * 1000) / 1000, uoi: Math.round(uoi * 100) / 100, intFB: Math.round(intFB) });
      }
      return chart.length ? chart : null;
    } catch { return null; }
  }, [selectedProgram, division]);

  const bbChart = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const per = analysis?.perMuscle || [];
      if (!per.length) return null;
      return per.map(p => ({
        muscle: ru(p.muscle),
        sets: p.peakSets,
        тяж: Math.round(p.peakSets * 0.6),
        памп: Math.round(p.peakSets * 0.4),
        mrv: p.mrv,
      }));
    } catch { return null; }
  }, [selectedProgram, division, analysis]);

  const profileWorkMax = useMemo<Record<string, number>>(() => {
    try { const p = loadTrainingProfile() as any; return p?.workMax || {}; } catch { return {}; }
  }, [selectedProgram, division]);
  const wmOf = (mu: string) => resolveWorkMax(profileWorkMax, mu, LEGACY_WM_DEFAULTS[mu.toLowerCase()] ?? 60);

  const bbWeeklyChart = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const weeks: any[] = (selectedProgram.bb as any).weeks || [];
      if (!weeks.length) return null;
      return weeks.map((w: any, wi: number) => {
        let ton = 0, eff = 0, sets = 0;
        for (const s of (w.sessions || [])) {
          for (const b of (s.blocks || [])) {
            const muKey = String(b.muscle || '').toLowerCase();
            const fallback = wmOf(muKey);
            for (const st of (b.sets || [])) {
              const pct = (st as any).pctOf1RM ?? (st as any).pct ?? 0;
              const baseW = (st as any).weight;
              const wgt = Number.isFinite(baseW) && baseW > 0 ? baseW : (pct > 0 ? Math.round(fallback * pct) : fallback);
              const reps = Number(st.reps) || 8;
              ton += wgt * reps;
              sets += 1;
              if ((st.rir ?? 2) <= 3 && reps >= 5) eff += 1;
            }
          }
        }
        return { week: (w as any).week || wi + 1, tonnage: Math.round(ton), kpsh: sets, relInt: eff > 0 ? Math.round((eff / Math.max(1, sets)) * 1000) / 1000 : 0, uoi: 0, intFB: eff };
      });
    } catch { return null; }
  }, [selectedProgram, division]); // eslint-disable-line react-hooks/exhaustive-deps

  const bbExtra = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const weeks: any[] = (selectedProgram.bb as any).weeks || [];
      if (!weeks.length) return null;
      const totalWeeks = weeks.length;
      const freq: Record<string, number> = {};
      let hardSets = 0, totalSets = 0, rirSum = 0, rirN = 0, tonnage = 0, effectiveSets = 0;
      const perMuscleSets: Record<string, number> = {};
      for (const w of weeks) {
        for (const s of (w.sessions || [])) {
          const musclesInSess = new Set<string>();
          for (const b of (s.blocks || [])) {
            const mu = String(b.muscle || '').toLowerCase();
            if (mu) {
              musclesInSess.add(mu);
              perMuscleSets[mu] = (perMuscleSets[mu] || 0) + (b.sets?.length || 0);
            }
            const sets = (b.sets?.length || 0);
            totalSets += sets;
            for (const st of (b.sets || [])) {
              const pct = (st as any).pctOf1RM ?? (st as any).pct ?? 0;
              const baseW = (st as any).weight;
              const muKey = String(b.muscle || '').toLowerCase();
              const fallback = wmOf(muKey);
              const wgt = Number.isFinite(baseW) && baseW > 0 ? baseW : (pct > 0 ? Math.round(fallback * pct) : fallback);
              const reps = Number(st.reps) || 8;
              tonnage += wgt * reps;
              if ((st.rir ?? 2) <= 3 && reps >= 5) effectiveSets += 1;
            }
            const rir = b.sets?.[0]?.rir ?? 2;
            if (Number.isFinite(rir) && rir < 1) hardSets += sets;
            if (Number.isFinite(rir)) { rirSum += rir * sets; rirN += sets; }
          }
          for (const mu of musclesInSess) freq[mu] = (freq[mu] || 0) + 1;
        }
      }
      const freqPerWeek: Record<string, number> = {};
      for (const [k, v] of Object.entries(freq)) freqPerWeek[k] = Math.round((v / totalWeeks) * 10) / 10;
      const avgFreq = Object.values(freqPerWeek).length ? (Object.values(freqPerWeek).reduce((a, b) => a + b, 0) / Object.values(freqPerWeek).length) : 0;
      return { freqPerWeek, hardSets, totalSets, avgRir: rirN ? rirSum / rirN : 0, tonnage: Math.round(tonnage), effectiveSets, perMuscleSets, avgFreq: Math.round(avgFreq * 10) / 10 };
    } catch { return null; }
  }, [selectedProgram, division]); // eslint-disable-line react-hooks/exhaustive-deps

  const plExtra = useMemo(() => {
    if (division !== 'pl' || !selectedProgram?.pl) return null;
    try {
      const weeks: any[] = (selectedProgram.pl as any).customWeeks || [];
      let plWeeks: any[] = weeks;
      if (!plWeeks.length && (selectedProgram.pl as any).sourceCycleId) {
        const tpl = getCycleById((selectedProgram.pl as any).sourceCycleId);
        if (tpl) plWeeks = buildSyntheticPlWeeks(tpl as any) as any[];
      }
      if (!plWeeks.length) return null;
      const liftFreq: Record<string, number> = { squat: 0, bench: 0, dead: 0 };
      let totalKpsh = 0, totalTonnage = 0;
      const zoneCounts: Record<string, number> = { '50-60': 0, '60-70': 0, '70-80': 0, '80-90': 0, '90+': 0 };
      for (const w of plWeeks) {
        for (const d of (w.days || [])) {
          for (const ex of (d.exercises || [])) {
            const name = norm(ex.name);
            if (/присед|squat/.test(name)) liftFreq.squat += 1;
            else if (/жим|bench|press/.test(name) && !/стоя/.test(name)) liftFreq.bench += 1;
            else if (/тяга|dead|становая/.test(name)) liftFreq.dead += 1;
            for (const s of (ex.sets || [])) {
              const kpsh = (s.reps || 5) * (s.sets || 3);
              totalKpsh += kpsh;
              const pct = s.pct || 0.7;
              const pm = 100; // условный
              totalTonnage += pm * pct * (s.reps || 5) * (s.sets || 3);
              if (pct < 0.6) zoneCounts['50-60'] += kpsh;
              else if (pct < 0.7) zoneCounts['60-70'] += kpsh;
              else if (pct < 0.8) zoneCounts['70-80'] += kpsh;
              else if (pct < 0.9) zoneCounts['80-90'] += kpsh;
              else zoneCounts['90+'] += kpsh;
            }
          }
        }
      }
      const totalWeeks = plWeeks.length || 1;
      const freqPerWeek = {
        squat: Math.round((liftFreq.squat / totalWeeks) * 10) / 10,
        bench: Math.round((liftFreq.bench / totalWeeks) * 10) / 10,
        dead: Math.round((liftFreq.dead / totalWeeks) * 10) / 10,
      };
      return { freqPerWeek, totalKpsh, totalTonnage: Math.round(totalTonnage), zoneCounts };
    } catch { return null; }
  }, [selectedProgram, division]);

  const bbReportExtras = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const weeks: any[] = (selectedProgram.bb as any).weeks || [];
      if (!weeks.length) return null;
      const phaseCount: Record<string, number> = {};
      for (const w of weeks) phaseCount[String((w as any).phase || 'рабочая')] = (phaseCount[String((w as any).phase || 'рабочая')] || 0) + 1;
      let pull = 0, press = 0;
      for (const w of weeks) for (const s of (w.sessions || [])) for (const b of (s.blocks || [])) {
        const mu = String(b.muscle || '').toLowerCase();
        if (mu === 'back' || mu === 'biceps') pull += (b.sets?.length || 0);
        if (mu === 'chest' || mu === 'shoulders' || mu === 'triceps') press += (b.sets?.length || 0);
      }
      const ratio = press > 0 ? pull / press : 0;
      let superset = 0, tech = 0; const dup = (selectedProgram.bb as any).progression?.loadStrategy || '';
      for (const w of weeks) for (const s of (w.sessions || [])) for (const b of (s.blocks || [])) {
        if ((b as any).supersetWith) superset++;
        if ((b as any).technique && (b as any).technique !== 'none') tech++;
      }
      const tonPerWeek = weeks.map((w: any) => {
        let ton = 0;
        for (const s of (w.sessions || [])) for (const b of (s.blocks || [])) for (const st of (b.sets || [])) ton += ((st as any).weight || 60) * (Number(st.reps) || 8);
        return ton;
      });
      const peakIdx = tonPerWeek.indexOf(Math.max(...tonPerWeek));
      const progPct = tonPerWeek[0] > 0 ? Math.round(((tonPerWeek[peakIdx] / tonPerWeek[0]) - 1) * 100) : 0;
      return { phaseCount, pull, press, ratio: Math.round(ratio * 100) / 100, superset, tech, dup, progPct, peakWeek: peakIdx + 1 };
    } catch { return null; }
  }, [selectedProgram, division]);

  const plReportExtras = useMemo(() => {
    if (division !== 'pl' || !selectedProgram?.pl) return null;
    try {
      const weeks: any[] = (selectedProgram.pl as any).customWeeks || [];
      let plWeeks: any[] = weeks;
      if (!plWeeks.length && (selectedProgram.pl as any).sourceCycleId) {
        const tpl = getCycleById((selectedProgram.pl as any).sourceCycleId);
        if (tpl) plWeeks = buildSyntheticPlWeeks(tpl as any) as any[];
      }
      if (!plWeeks.length) return null;
      const phaseCount: Record<string, number> = {};
      for (const w of plWeeks) phaseCount[String((w as any).phase || 'accumulation')] = (phaseCount[String((w as any).phase || 'accumulation')] || 0) + 1;
      const kpshPerWeek = plWeeks.map((w: any) => {
        let k = 0;
        for (const d of (w.days || [])) for (const ex of (d.exercises || [])) for (const s of (ex.sets || [])) k += (s.reps || 5) * (s.sets || 3);
        return k;
      });
      const peakK = Math.max(...kpshPerWeek);
      const progPct = kpshPerWeek[0] > 0 ? Math.round(((peakK / kpshPerWeek[0]) - 1) * 100) : 0;
      return { phaseCount, peakK, progPct, weeks: plWeeks.length };
    } catch { return null; }
  }, [selectedProgram, division]);

  return { lmsChart, bbChart, bbWeeklyChart, bbExtra, plExtra, bbReportExtras, plReportExtras };
}

export interface ScoreCardData {
  score: number;
  grade: string;
  perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; mev: number; mav: number; mrv: number; status: string }>;
  issues: string[];
}

/** Кольцо 0-100 + контекст + issues (дословный перенос из CalcQualityTab). */
export const QualityScoreCard: React.FC<{
  analysis: ScoreCardData;
  division: QualityDivision;
  sc: string;
  contextLine: string;
}> = ({ analysis, division, sc, contextLine }) => (
  <div style={{ padding: 12, borderRadius: 12, background: analysis.score >= 80 ? '#22c55e08' : analysis.score >= 50 ? '#f59e0b08' : '#ef444408', border: '1px solid ' + sc + '40', marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: sc }}>Оценка качества {analysis.grade} · {division === 'bb' ? 'ББ-гипертрофия' : 'ПЛ-сила'}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: sc, fontVariantNumeric: 'tabular-nums' }}>{analysis.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
    </div>
    <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
      <div style={{ height: '100%', width: analysis.score + '%', background: `linear-gradient(90deg, ${sc}, ${sc}cc)`, transition: 'width 0.35s', boxShadow: `0 0 10px ${sc}66`, borderRadius: 6 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800, letterSpacing: 0.3, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{analysis.score >= 80 ? 'ОТЛИЧНО' : analysis.score >= 50 ? 'СРЕДНЕ' : 'ТРЕБУЕТ РАБОТЫ'}</div>
    </div>
    <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>{contextLine}</div>
    {analysis.issues.length > 0 && (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {analysis.issues.map((iss, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: iss.startsWith('⚠') ? '#f59e0b' : iss.startsWith('⬇') ? '#3b82f6' : '#fff' }}>
            <span style={{ fontWeight: 700 }}>{iss}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/** Полосы объёма по группам (дословный перенос из CalcQualityTab). */
export const PerMuscleBars: React.FC<{
  perMuscle: ScoreCardData['perMuscle'];
  division: QualityDivision;
}> = ({ perMuscle, division }) => (
  <>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Объём по группам — {division === 'bb' ? 'ББ (гипертрофия)' : 'ПЛ (сила)'} · Сеты · MEV · MAV · MRV · %MRV</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      {perMuscle.map(pm => {
        const st = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
        const pct = pm.mrv > 0 ? Math.round((pm.peakSets / pm.mrv) * 100) : 0;
        const bar = Math.min(100, pct);
        const mevPct = pm.mrv > 0 ? (pm.mev / pm.mrv) * 100 : 0;
        const mavPct = pm.mrv > 0 ? (pm.mav / pm.mrv) * 100 : 0;
        return (
          <div key={pm.muscle} style={{ padding: '10px 12px', borderRadius: 12, background: `linear-gradient(135deg, ${st}0f, ${st}06)`, border: `1px solid ${st}30`, boxShadow: `0 2px 12px ${st}0a` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 6 }}>
              <span style={{ fontWeight: 800, color: '#fff', minWidth: 90 }}>{ru(pm.muscle)}</span>
              <span style={{ color: st, fontWeight: 900, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{pm.peakSets}<span style={{ fontSize: 9, color: '#fff' }}> сет</span></span>
              <span style={{ color: '#fff', fontSize: 10 }}>· MEV {pm.mev} · MAV {pm.mav} · MRV {pm.mrv} · <b style={{ color: st }}>{pct}%</b></span>
              <span style={{ marginLeft: 'auto', padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: 800, background: st, color: pm.status === 'high' || pm.status === 'low' ? '#000' : '#fff', boxShadow: `0 1px 6px ${st}55` }}>{pm.status === 'over' ? 'ПЕРЕГРУЗ' : pm.status === 'low' ? 'НЕДОГРУЗ' : pm.status === 'high' ? 'ВЫСОКО' : 'ОК'}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ position: 'absolute', left: 0, width: `${mevPct}%`, height: '100%', background: 'rgba(59,130,246,0.14)', borderRight: '1px dashed rgba(59,130,246,0.35)' }} />
              <div style={{ position: 'absolute', left: `${mevPct}%`, width: `${Math.max(0, mavPct - mevPct)}%`, height: '100%', background: 'rgba(34,197,94,0.12)', borderRight: '1px dashed rgba(34,197,94,0.35)' }} />
              <div style={{ height: '100%', width: bar + '%', background: `linear-gradient(90deg, ${st}, ${st}cc)`, borderRadius: 6, transition: 'width 0.35s', boxShadow: bar > 85 ? `0 0 8px ${st}88` : 'none' }} />
              <div style={{ position: 'absolute', right: 4, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 7, color: '#fff', opacity: 0.6 }}>MEV {pm.mev} · MAV {pm.mav}</div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#fff' }}>
              <span>Средн/нед: <b style={{ color: st }}>{pm.avgSets}</b> сет</span>
              <span style={{ color: pct > 100 ? '#ef4444' : '#fff', fontWeight: pct > 100 ? 800 : 400 }}>{pct > 100 ? `+${pct - 100}% сверх MRV` : `${100 - pct}% запас до MRV`}</span>
            </div>
          </div>
        );
      })}
    </div>
  </>
);
