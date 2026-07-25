/**
 * ProgramEditorPanels.tsx — извлечённые панели инструментов для ProgramEditor.
 * Вынесено из ProgramManagerPanel.tsx для соблюдения лимита 1500 строк.
 */
import React, { useState } from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT, IN, BTN_GHOST } from './training-ui';
import { GROUP_RU } from './program-types';
import type { UserProgram, UserBlock, BBProgramBody } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate, suggestExercisesForGroup } from '../../../engines/manual-constructor.engine';
import { prescribeLoad } from '../../../engines/bb/bb-autocoach.engine';
import { selectSplit } from '../../../engines/split-selector.engine';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadTrainingProfile } from './training-profile';
import { distributePhases } from './phase-periodization';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';

interface PanelProps {
  program: UserProgram;
  dir: string;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  labMrvMult: number;
}

const PHASE_LABELS: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };

/* ───── Диагностическая панель ───── */
export const DiagnosticPanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast, labMrvMult }) => {
  if (!(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks)) return null;
  const prof = loadTrainingProfile();
  let q: ReturnType<typeof computePlanQualityFor> | null = null;
  try {
    q = computePlanQualityFor(program, program.meta.level, { onCourse: prof.onCourse ?? false, courseIntensity: prof.courseIntensity ?? 'moderate', labMult: labMrvMult });
  } catch { return null; }
  if (!q || q.perMuscle.length === 0) return null;
  const weak = q.perMuscle.filter(m => m.status === 'low');
  const overloaded = q.perMuscle.filter(m => m.status === 'over');
  const ok = q.perMuscle.filter(m => m.status === 'ok');
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + (q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444') }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔬 Диагностика программы</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444' }}>{q.score}/100 {q.grade}</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{weak.length} недобор · {overloaded.length} перегруз · {ok.length} ок</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {q.perMuscle.map(pm => {
          const c = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
          const icon = pm.status === 'over' ? '⚠' : pm.status === 'low' ? '⬇' : pm.status === 'high' ? '📈' : '✅';
          const pct = pm.mrv > 0 ? Math.round((pm.sets / pm.mrv) * 100) : 0;
          return <span key={pm.muscle} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c + '18', border: '1px solid ' + c + '30', color: c }}>{icon} {GROUP_RU[pm.muscle] ?? pm.muscle} {pm.sets}/{pm.mrv}с ({pct}%)</span>;
        })}
      </div>
      {weak.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>⬇ Недобор — упражнения:</div>
          {weak.map(w => {
            const exs = suggestExercisesForGroup(w.muscle, program.meta.level, 3, (prof.equipment ?? []) as string[], [], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
            if (exs.length === 0) return null;
            return (
              <div key={w.muscle} style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG }}>{GROUP_RU[w.muscle] ?? w.muscle}: +{w.mev - Math.max(0, w.sets)} сетов до MEV={w.mev}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {exs.slice(0, 3).map((ex, i) => (
                    <button key={i} onClick={() => {
                      if (!program.bb?.weeks[0]?.sessions[0]) return;
                      const nb: UserBlock = { id: newId('blk'), type: 'accessory' as const, exerciseName: ex.name, muscle: w.muscle, role: 'accessory' as const, sets: makeSetsFromTemplate(muscleAwareSets(w.muscle, program.meta.level), (prof.workMax ?? {})[w.muscle] ?? 40) };
                      const upd = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((wk, wi) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : wk) } };
                      onChange(upd);
                      showToast('✅ ' + ex.name + ' → ' + (GROUP_RU[w.muscle] ?? w.muscle));
                    }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', fontWeight: 700, minHeight: 34 }}>+ {ex.name}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {overloaded.length > 0 && (
        <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>⚠ Превышение MRV:</div>
          {overloaded.map(o => (
            <div key={o.muscle} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{GROUP_RU[o.muscle] ?? o.muscle}: {o.sets} сетов {'>'} MRV {o.mrv} (снизьте на {o.sets - o.mrv})</div>
          ))}
        </div>
      )}
      {q.perMuscle.length >= 2 && (() => {
        const pcts = q.perMuscle.map(p => ({ m: p.muscle, p: p.mrv > 0 ? (p.sets / p.mrv) * 100 : 0 }));
        const gap = Math.max(...pcts.map(p => p.p)) - Math.min(...pcts.map(p => p.p));
        if (gap < 30) return null;
        return (
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚖ Дисбаланс нагрузки ({Math.round(gap)}%)</div>
          </div>
        );
      })()}
    </div>
  );
};

/* ───── Тренер прогрессии ───── */
export const ProgressionCoach: React.FC<PanelProps & { onCourse: boolean; courseIntensity: string }> = ({ program, dir, onCourse, courseIntensity }) => {
  if (dir !== 'bb' || !program.bb || program.bb.weeks.length < 2) return null;
  const prof = loadTrainingProfile();
  const strat = (program.bb.progression?.loadStrategy ?? 'double_progression') as 'double_progression' | 'linear' | 'wave' | 'rpe_based';
  const lastW = program.bb.weeks[program.bb.weeks.length - 1];
  if (!lastW) return null;
  const preds: Array<{ name: string; muscle: string; curW: number; curR: number; curRIR: number; nextW: number; nextR: number; nextRIR: number; label: string }> = [];
  try {
    for (const s of lastW.sessions) {
      for (const b of s.blocks) {
        if (!b.exerciseName || !b.sets[0]?.weight) continue;
        const c = b.sets[0];
        const cw = c.weight!;
        const cr = typeof c.reps === 'number' ? c.reps : 10;
        const crir = c.rir ?? 2;
        const wm = (prof.workMax ?? {})[b.muscle] ?? cw * 1.5;
        const pred = prescribeLoad(strat, cw, cr, crir, wm, lastW.week, program.bb.weeks.length, lastW.phase, b.type, b.role as 'primary' | 'accessory' | undefined);
        if (pred.nextWeight !== cw || pred.nextReps !== cr) preds.push({ name: b.exerciseName, muscle: b.muscle, curW: cw, curR: cr, curRIR: crir, nextW: pred.nextWeight, nextR: pred.nextReps, nextRIR: pred.nextRIR, label: pred.label });
      }
    }
  } catch { return null; }
  if (preds.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #22c55e' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>🧠 Тренер прогрессии ({strat})</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Предсказание недели {lastW.week + 1}:</div>
      {preds.slice(0, 8).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 10, flexWrap: 'wrap' }}>
          <span style={{ color: DIM_STRONG, fontWeight: 700, minWidth: 100 }}>{p.name}</span>
          <span style={{ color: DIM }}>{p.curW}кг×{p.curR} RIR{p.curRIR}</span>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>→</span>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>{p.nextW}кг×{p.nextR} RIR{p.nextRIR}</span>
          <span style={{ fontSize: 9, color: DIM }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ───── Консультант по сплитам ───── */
export const SplitConsultant: React.FC<PanelProps> = ({ program, dir, onChange, showToast }) => {
  if (dir !== 'bb' || !program.bb) return null;
  const totalSessions = program.bb.weeks.reduce((s, w) => s + (w.sessions?.length || 0), 0);
  if (totalSessions > 2) return null;
  const prof = loadTrainingProfile();
  let candidates: any[] = [];
  try {
    candidates = (selectSplit({ goal: program.meta.goal, level: program.meta.level, daysPerWeek: program.meta.daysPerWeek, recovery: prof.recovery ?? 70, fatigue: prof.fatigue ?? 30, sleep: prof.sleepHours ?? 7, stress: prof.stressLevel ?? 30, weakPoints: (prof.weakPoints ?? []) as string[], injuries: [], onCourse: prof.onCourse ?? false, equipment: (prof.equipment ?? []) as string[] } as any) as any[]).slice(0, 4);
  } catch { return null; }
  if (!candidates || candidates.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #3b82f6' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', marginBottom: 6 }}>🗓 Рекомендованные сплиты</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
        {candidates.map((c: any, ci: number) => (
          <div key={ci} style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>{c.name}</div>
            <div style={{ fontSize: 9, color: DIM }}>{c.desc}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {(c.groupsPerDay || []).map((day: string[], di: number) => (
                <span key={di} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: DIM_STRONG }}>Д{di+1}: {day.map((g: string) => (GROUP_RU[g as keyof typeof GROUP_RU] ?? g)).join('/')}</span>
              ))}
            </div>
            <button style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontWeight: 700, minHeight: 34 }}
              onClick={() => {
                const sessions = (c.groupsPerDay || []).map((groups: string[], di: number) => ({
                  id: newId('ses'), name: 'День ' + (di + 1), focus: groups.map((g: string) => GROUP_RU[g as keyof typeof GROUP_RU] ?? g).join('/'),
                  blocks: groups.map((muscle: string) => ({ id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle, role: 'primary' as const, sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] })),
                }));
                const weeks = Array.from({ length: program.meta.weeks || 4 }, (_, wi) => ({ week: wi + 1, phase: 'accumulation' as const, deload: wi > 0 && wi % 4 === 3, sessions: sessions.map((s: any) => ({ ...s, id: newId('ses'), blocks: s.blocks.map((b: any) => ({ ...b, id: newId('blk'), sets: b.sets.map((st: any) => ({ ...st })) })) })) }));
                onChange({ ...program, bb: { ...program.bb!, weeks } });
                showToast('🗓 Сплит применён: ' + c.name);
              }}>Применить</button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───── Объём и MRV ───── */
export const VolumeLandmarksPanel: React.FC<PanelProps> = ({ program, dir, labMrvMult }) => {
  const MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
  const prof = loadTrainingProfile();
  const peakByMuscle: Record<string, number> = {};
  if (dir === 'bb' && program.bb) {
    for (const w of program.bb.weeks) {
      const ws: Record<string, number> = {};
      for (const s of w.sessions) for (const b of s.blocks) if (b.muscle) ws[b.muscle] = (ws[b.muscle] || 0) + (b.sets?.length || 0);
      for (const [m, sets] of Object.entries(ws)) peakByMuscle[m] = Math.max(peakByMuscle[m] || 0, sets);
    }
  } else if (dir === 'pl' && program.pl?.customWeeks) {
    for (const w of program.pl.customWeeks) {
      const ws: Record<string, number> = {};
      for (const d of w.days) for (const ex of d.exercises) if (ex.muscle) ws[ex.muscle] = (ws[ex.muscle] || 0) + ex.sets.reduce((s, st) => s + st.sets, 0);
      for (const [m, sets] of Object.entries(ws)) peakByMuscle[m] = Math.max(peakByMuscle[m] || 0, sets);
    }
  }
  if (Object.keys(peakByMuscle).length === 0) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #22c55e' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>📊 Объём и MRV по мышцам (пиковая неделя)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Сравнение с MEV/MAV/MRV для уровня <b>{program.meta.level}</b>{labMrvMult < 1 && <span> (лаб ×{labMrvMult.toFixed(2)})</span>}{(prof.onCourse ?? false) && <span style={{ color: '#f59e0b' }}> · курс</span>}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {MUSCLES.filter(m => peakByMuscle[m] > 0).map(m => {
          const cur = peakByMuscle[m] || 0;
          const lm = getVolumeLandmarks(program.meta.level, m);
          if (!lm) return null;
          const labMrv = labMrvMult < 1 ? Math.round(lm.mrv * labMrvMult) : lm.mrv;
          const pct = labMrv > 0 ? Math.round((cur / labMrv) * 100) : 0;
          const bc = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG, flex: '0 0 80px' }}>{GROUP_RU[m] ?? m}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: Math.min(100, pct) + '%', height: '100%', background: bc, borderRadius: 4 }} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: bc, minWidth: 60, textAlign: 'right' }}>{cur} / {labMrv}с</span>
              <span style={{ fontSize: 11, color: DIM, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ───── Фазовая легенда ───── */
export const PhaseLegend: React.FC<{ weeks: number; goal: string; level: string }> = ({ weeks, goal, level }) => {
  if (weeks < 4) return null;
  const phases = distributePhases(weeks, 0, goal === 'powerlifting' ? 'strength' : 'bulk');
  if (!phases?.length) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #60a5fa' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📈 Фазовая легенда ({weeks} нед)</div>
      {phases.map((p, i) => {
        const pc = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[p.phase] ?? '#fff';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 10, background: pc, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: DIM_STRONG, flex: '0 0 100px' }}>{PHASE_LABELS[p.phase]}</span>
            <span style={{ fontSize: 10, color: DIM }}>нед {p.startWeek}–{p.endWeek}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: pc, marginLeft: 'auto' }}>{p.endWeek - p.startWeek + 1} нед</span>
          </div>
        );
      })}
    </div>
  );
};

/* ───── Инфо упражнения ───── */
export const ExerciseInfo: React.FC<{ program: UserProgram; dir: string }> = ({ program, dir }) => {
  let selectedEx: Exercise | undefined;
  if (dir === 'bb' && program.bb) {
    for (const w of program.bb.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.exerciseName) { const f = EXERCISE_CATALOG.find((e: Exercise) => e.name === b.exerciseName); if (f) { selectedEx = f; break; } }
        }
        if (selectedEx) break;
      }
      if (selectedEx) break;
    }
  }
  if (!selectedEx) return null;
  const ex = selectedEx as any;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #06b6d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4', marginBottom: 4 }}>🔬 Инфо: {ex.name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4 }}>
        {ex.group && <div style={{ fontSize: 10, color: DIM }}>Группа: <b style={{ color: DIM_STRONG }}>{GROUP_RU[ex.group] ?? ex.group}</b></div>}
        {ex.type && <div style={{ fontSize: 10, color: DIM }}>Тип: <b style={{ color: DIM_STRONG }}>{ex.type}</b></div>}
        {ex.equipment && <div style={{ fontSize: 10, color: DIM }}>Инвентарь: <b style={{ color: DIM_STRONG }}>{typeof ex.equipment === 'string' ? ex.equipment : (ex.equipment as string[]).join(', ')}</b></div>}
        {ex.forceVector && <div style={{ fontSize: 10, color: DIM }}>Вектор: <b style={{ color: DIM_STRONG }}>{ex.forceVector}</b></div>}
        {ex.primaryMuscles && <div style={{ fontSize: 10, color: DIM }}>Мышцы: <b style={{ color: DIM_STRONG }}>{Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles.join(', ') : ex.primaryMuscles}</b></div>}
      </div>
    </div>
  );
};

/* ───── Рекомендации (все мышцы) ───── */
export const RecommendationsPanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast, labMrvMult }) => {
  if (!(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks)) return null;
  const prof = loadTrainingProfile();
  let q: ReturnType<typeof computePlanQualityFor> | null = null;
  try {
    q = computePlanQualityFor(program, program.meta.level, { onCourse: prof.onCourse ?? false, courseIntensity: prof.courseIntensity ?? 'moderate', labMult: labMrvMult });
  } catch { return null; }
  if (!q || q.perMuscle.length === 0) return null;
  const gaps = q.perMuscle.filter(m => m.status === 'low' || m.status === 'over');
  if (gaps.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa', background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(245,158,11,0.04))' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>💡 Рекомендации ({gaps.length})</span>
        <span style={{ fontSize: 10, color: DIM }}>Мышцы вне зоны MEV–MRV</span>
      </div>
      {gaps.slice(0, 6).map((g, gi) => {
        const recs = suggestExercisesForGroup(g.muscle, program.meta.level, 3, (prof.equipment ?? []) as string[], (prof.weakPoints ?? []) as string[], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
        const isOver = g.status === 'over';
        const c = isOver ? '#ef4444' : '#3b82f6';
        return (
          <div key={gi} style={{ padding: 6, marginBottom: 4, background: c + '08', borderRadius: 8, border: '1px solid ' + c + '15' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c }}>{(isOver ? '⚠' : '⬇')} {GROUP_RU[g.muscle] ?? g.muscle}: {g.sets} из {g.mev}–{g.mrv} сетов{isOver ? ` (перегруз на ${g.sets - g.mrv})` : ` (недобор ${g.mev - Math.max(0, g.sets)})`}</div>
            {!isOver && recs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                {recs.map((r, ri) => (
                  <button key={ri} onClick={() => {
                    if (dir !== 'bb' || !program.bb?.weeks[0]?.sessions[0]) return;
                    const nb: UserBlock = { id: newId('blk'), type: 'accessory' as const, exerciseName: r.name, muscle: g.muscle, role: 'accessory' as const, sets: makeSetsFromTemplate(muscleAwareSets(g.muscle, program.meta.level), (prof.workMax ?? {})[g.muscle] ?? 40) };
                    onChange({ ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === 0 ? { ...w, sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : w) } });
                    showToast('✅ ' + r.name);
                  }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: c + '10', border: '1px solid ' + c + '25', color: c, fontWeight: 700, minHeight: 34 }}>+ {r.name}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
