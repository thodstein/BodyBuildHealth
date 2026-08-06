/**
 * ProgramEditorPanels2.tsx — A1: extracted sub-components from ProgramEditorView.
 *
 * RirWaveChart, QualityScorePanel, PlanStatsPanel, MetaEditor, LibraryModal.
 * Each was an inline IIFE in ProgramEditorView; extracted for testability and readability.
 */
import React, { useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import { userWeekToBBPlan } from '../../../engines/user-program/program-store';
import { getAllPrograms } from '../../../engines/complete-program-library.engine';
import { cloneFromLibrary } from '../../../engines/user-program/program-store';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cloneFromCycle } from '../../../engines/user-program/program-store';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { ACCENT, CARD, DIM, DIM_STRONG, IN, BTN, BTN_GHOST } from './training-ui';
import type { TrainingProfile } from './training-profile';

/* ─── RirWaveChart ─── */

interface RirWaveChartProps {
  program: UserProgram;
}

export const RirWaveChart: React.FC<RirWaveChartProps> = ({ program }) => {
  if (program.meta.weeks < 4) return null;
  const chartW = 280, chartH = 56;
  const N = Math.min(program.meta.weeks, 12);
  const goalMap: Record<string, 'mass' | 'strength' | 'cut' | 'endurance'> = {
    hypertrophy: 'mass', strength: 'strength', cut: 'cut', recomposition: 'mass',
    endurance: 'endurance', power: 'strength', peaking: 'strength', general: 'mass',
  };
  const lvlMap: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
    beginner: 'beginner', intermediate: 'intermediate', novice: 'beginner',
    advanced: 'advanced', enhanced: 'advanced', elite: 'advanced',
  };
  const goalKey = goalMap[program.meta.goal as string] ?? 'mass';
  const lvlKey = lvlMap[program.meta.level as string] ?? 'intermediate';
  const expectedWave: number[] = [];
  for (let w = 0; w < N; w++) {
    let rir = 2;
    if (lvlKey === 'beginner') rir = Math.max(2, 4 - Math.floor(w / 4));
    else if (goalKey === 'strength') rir = w < N - 2 ? 3 : w >= N - 1 ? 1 : 2;
    else if (goalKey === 'mass') rir = (w % 8 === 6 || w % 8 === 7) ? 4 : 2;
    else if (goalKey === 'cut') rir = 3;
    else rir = 2;
    if (program.bb?.weeks?.[w]?.deload) rir = 4;
    expectedWave.push(rir);
  }
  const realWave: number[] = [];
  for (let w = 0; w < N; w++) {
    const week = program.bb?.weeks?.[w];
    if (!week) { realWave.push(-1); continue; }
    const allRirs: number[] = (week.sessions ?? [])
      .flatMap(s => (s.blocks ?? []).flatMap(b => (b.sets ?? []).map(st => typeof st.rir === 'number' ? st.rir : 2)));
    realWave.push(allRirs.length ? allRirs.reduce((a, b) => a + b, 0) / allRirs.length : -1);
  }
  const wave = realWave.map((r, i) => r >= 0 ? r : (expectedWave[i] ?? 2));
  const maxRir = 5;
  const points = wave.map((r, i) => {
    const x = (i / Math.max(1, N - 1)) * (chartW - 8) + 4;
    const y = chartH - 6 - (r / maxRir) * (chartH - 12);
    return [x, y] as const;
  });
  const expPoints = expectedWave.map((r, i) => {
    const x = (i / Math.max(1, N - 1)) * (chartW - 8) + 4;
    const y = chartH - 6 - (r / maxRir) * (chartH - 12);
    return [x, y] as const;
  });
  const pathD = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const expPathD = expPoints.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const areaD = `${pathD} L${points[points.length - 1][0]},${chartH - 6} L${points[0][0]},${chartH - 6} Z`;
  const isMass = program.meta.goal === 'hypertrophy' || program.meta.goal === 'recomposition';
  const stroke = '#00e68a';
  return (
    <div style={{ ...CARD, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>
        📉 RIR-волна по неделям
        <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>
          {program.meta.goal ?? '—'} · {program.meta.level ?? '—'} · {N} из {program.meta.weeks} нед
        </span>
      </div>
      <svg width={chartW} height={chartH} style={{ display: 'block' }} viewBox={`0 0 ${chartW} ${chartH}`}>
        {[1, 2, 3, 4].map((r) => (
          <line key={r} x1={4} x2={chartW - 4} y1={chartH - 6 - (r / maxRir) * (chartH - 12)} y2={chartH - 6 - (r / maxRir) * (chartH - 12)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
        ))}
        <path d={areaD} fill={stroke} opacity="0.10" />
        <path d={expPathD} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" />
        <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={stroke} />
        ))}
        <text x={4} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">RIR0</text>
        <text x={chartW - 24} y={10} fontSize="8" fill="rgba(255,255,255,0.4)">RIR5</text>
        {wave.map((r, i) => r === 4 && i > 0 && (i - 1) > 0 ? (
          <line key={'d' + i} x1={points[i][0]} x2={points[i][0]} y1={6} y2={chartH - 6}
            stroke={isMass ? '#f59e0b' : '#22c55e'} strokeDasharray="2 2" opacity="0.6" />
        ) : null)}
      </svg>
      <div style={{ fontSize: 11, color: DIM, marginTop: 6, lineHeight: 1.4 }}>
        {isMass
          ? '🔄 Mass: волна 8 нед → 7-я делод (RIR4); к концу блока снижение RIR до 1 для пика.'
          : goalKey === 'strength'
          ? '📈 Strength: линейная прогрессия, финальные 1-2 недели — пик (RIR1).'
          : '🟢 Cut: удержание RIR3 для контроля утомления на фоне дефицита калорий.'}
      </div>
    </div>
  );
};

/* ─── QualityScorePanel ─── */

interface QualityScorePanelProps {
  program: UserProgram;
  level: string;
  tprofile: TrainingProfile;
  labMrvMult: number;
}

export const QualityScorePanel: React.FC<QualityScorePanelProps> = ({ program, level, tprofile, labMrvMult }) => {
  const dir = program.meta.direction;
  if (!(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks)) return null;
  const q = computePlanQualityFor(program, level, {
    onCourse: tprofile.onCourse ?? false,
    courseIntensity: tprofile.courseIntensity ?? 'moderate',
    labMult: labMrvMult,
  });
  const bar = q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid ' + bar }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🏆 Качество (live)</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: bar, marginLeft: 'auto' }}>{q.score}/100 {q.grade}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: q.score + '%', height: '100%', background: bar, transition: 'width 0.3s' }} />
      </div>
      {q.issues.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {q.issues.slice(0, 5).map((iss, i) => <div key={i} style={{ marginBottom: 2 }}>{iss}</div>)}
        </div>
      )}
      <div style={{ fontSize: 11, color: DIM, marginTop: 4, fontStyle: 'italic' }}>
        Оценка в реальном времени: weeklySets vs MRV. Зелёный ≥75, жёлтый ≥50, красный &lt;50.
      </div>
    </div>
  );
};

/* ─── PlanStatsPanel ─── */

interface PlanStatsPanelProps {
  program: UserProgram;
  execWeek: number;
  onCourse: boolean;
}

export const PlanStatsPanel: React.FC<PlanStatsPanelProps> = ({ program, execWeek, onCourse }) => {
  if (!program.bb) return null;
  try {
    const wi = Math.max(0, Math.min(execWeek - 1, (program.bb.weeks?.length ?? 1) - 1));
    const wk = program.bb.weeks?.[wi];
    if (!wk?.sessions?.[0]) return null;
    const m = calcBBPlanMetrics(userWeekToBBPlan(wk, program.meta.level), 1.0);
    const courseMark = onCourse ? ' 🅿 курс' : '';
    return (
      <div style={{ ...CARD, padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>📊 Статистика плана · нед {wk.week}{courseMark}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Недель</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{program.bb.weeks.length}</div>
          </div>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Сессий/нед</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{wk.sessions.length}</div>
          </div>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Упражнений</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{wk.sessions.reduce((s, ss) => s + (ss.blocks?.length ?? 0), 0)}</div>
          </div>
          <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Сетов/нед</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DIM_STRONG }}>{wk.sessions.reduce((s, ss) => s + (ss.blocks ?? []).reduce((s2, b) => s2 + (b.sets?.length ?? 0), 0), 0)}</div>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: DIM, lineHeight: 1.4 }}>
          Тяж {m.тяжPct?.toFixed?.(0) ?? 0}% / Памп {m.пампPct?.toFixed?.(0) ?? 0}% · Средний RIR {m.avgRir?.toFixed?.(1) ?? '—'}
        </div>
      </div>
    );
  } catch { return null; }
};
