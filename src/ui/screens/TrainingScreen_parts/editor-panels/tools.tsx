/**
 * editor-panels/tools.tsx — инструменты тренера (сплит, объём, инфо, замены).
 * F4.6: вынесено из ProgramEditorPanels.tsx.
 */
import React, { useState } from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT } from '../training-ui';
import { GROUP_RU } from '../program-types';
import type { UserProgram, UserBlock } from '../../../../engines/user-program/user-program.types';
import { newId } from '../../../../engines/user-program/user-program.types';
import { suggestExercisesForGroup, muscleAwareSets, makeSetsFromTemplate } from '../../../../engines/manual-constructor';
import { selectSplit } from '../../../../engines/split-selector.engine';
import { getVolumeLandmarks } from '../../../../engines/volume-landmarks.engine';
import { findSubstitutions } from '../../../../engines/exercise-substitution.engine';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import type { Exercise } from '../../../../core/types';
import { loadTrainingProfile } from '../training-profile';
import type { PanelProps } from './shared';

/* ─── Консультант по сплитам ─── */
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
            <div style={{ fontSize: 11, color: DIM }}>{c.desc}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {(c.groupsPerDay || []).map((day: string[], di: number) => (
                <span key={di} style={{ fontSize: 11, padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: DIM_STRONG }}>Д{di+1}: {day.map((g: string) => (GROUP_RU[g as keyof typeof GROUP_RU] ?? g)).join('/')}</span>
              ))}
            </div>
            <button style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontWeight: 700, minHeight: 34 }}
              onClick={() => {
                const sessions = (c.groupsPerDay || []).map((groups: string[], di: number) => ({
                  id: newId('ses'), name: 'День ' + (di + 1), focus: groups.map((g: string) => GROUP_RU[g as keyof typeof GROUP_RU] ?? g).join('/'),
                  blocks: groups.map((muscle: string) => ({ id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle, role: 'primary' as const, sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] })),
                }));
                const weeks = Array.from({ length: program.meta.weeks || 4 }, (_, wi: number) => ({ week: wi + 1, phase: 'accumulation' as const, deload: wi > 0 && wi % 4 === 3, sessions: sessions.map((s: any) => ({ ...s, id: newId('ses'), blocks: s.blocks.map((b: any) => ({ ...b, id: newId('blk'), sets: b.sets.map((st: any) => ({ ...st })) })) })) }));
                onChange({ ...program, bb: { ...program.bb!, weeks } });
                showToast('🗓 Сплит применён: ' + c.name);
              }}>Применить</button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Интерактивный объём и MRV (±сеты прямо из панели) ─── */
export const InteractiveVolumePanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast, labMrvMult }) => {
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

  const addSetToMuscle = (muscle: string) => {
    if (dir !== 'bb' || !program.bb?.weeks[0]?.sessions[0] || !onChange) return;
    const w0 = program.bb.weeks[0];
    const s0 = w0.sessions[0];
    const blockIdx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === muscle).pop();
    let newBlocks;
    if (blockIdx) {
      newBlocks = s0.blocks.map((b, i) => i === blockIdx.i ? { ...b, sets: [...b.sets, { ...b.sets[b.sets.length - 1] ?? { reps: 10, rir: 2, weight: 0, restSec: 90 } }] } : b);
    } else {
      const exs = suggestExercisesForGroup(muscle, program.meta.level, 1, (prof.equipment ?? []) as string[], [], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
      const nb: UserBlock = { id: newId('blk'), type: 'accessory' as const, exerciseName: exs[0]?.name ?? '', muscle, role: 'accessory' as const, sets: makeSetsFromTemplate(muscleAwareSets(muscle, program.meta.level), (prof.workMax ?? {})[muscle] ?? 40) };
      newBlocks = [...s0.blocks, nb];
    }
    onChange({ ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === 0 ? { ...w, sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: newBlocks } : s) } : w) } });
    showToast?.('➕ +1 сет: ' + (GROUP_RU[muscle] ?? muscle));
  };

  const removeSetFromMuscle = (muscle: string) => {
    if (dir !== 'bb' || !program.bb?.weeks[0]?.sessions[0] || !onChange) return;
    const w0 = program.bb.weeks[0];
    const s0 = w0.sessions[0];
    const blockIdx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === muscle).pop();
    if (!blockIdx) return;
    let newBlocks;
    if (blockIdx.b.sets.length > 1) {
      newBlocks = s0.blocks.map((b, i) => i === blockIdx.i ? { ...b, sets: b.sets.slice(0, -1) } : b);
    } else {
      newBlocks = s0.blocks.filter((_, i) => i !== blockIdx.i);
    }
    onChange({ ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === 0 ? { ...w, sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: newBlocks } : s) } : w) } });
    showToast?.('➖ −1 сет: ' + (GROUP_RU[muscle] ?? muscle));
  };

  const canEdit = dir === 'bb' && !!onChange;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #22c55e' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', marginBottom: 6 }}>📊 Объём и MRV (интерактивно)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Сравнение с MEV/MAV/MRV для уровня <b>{program.meta.level}</b>{labMrvMult < 1 && <span> (лаб ×{labMrvMult.toFixed(2)})</span>}{(prof.onCourse ?? false) && <span style={{ color: '#f59e0b' }}> · курс</span>}{canEdit && <span> · кнопки ± изменяют неделю 1</span>}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {MUSCLES.filter(m => peakByMuscle[m] > 0 || canEdit).map(m => {
          const cur = peakByMuscle[m] || 0;
          const lm = getVolumeLandmarks(program.meta.level, m);
          if (!lm) return null;
          const labMrv = labMrvMult < 1 ? Math.round(lm.mrv * labMrvMult) : lm.mrv;
          const pct = labMrv > 0 ? Math.round((cur / labMrv) * 100) : 0;
          const bc = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
          const statusLabel = pct > 100 ? 'перегруз' : pct >= 80 ? 'зона' : cur < lm.mev ? 'недобор' : 'ок';
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 11, color: DIM_STRONG, flex: '0 0 70px' }}>{GROUP_RU[m] ?? m}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', minWidth: 50 }}><div style={{ width: Math.min(100, pct) + '%', height: '100%', background: bc, borderRadius: 4 }} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: bc, minWidth: 54, textAlign: 'right' }}>{cur}/{labMrv}с</span>
              <span style={{ fontSize: 10, color: bc, minWidth: 48, textAlign: 'right', fontWeight: 600 }}>{statusLabel}</span>
              {canEdit && (
                <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
                  <button onClick={() => removeSetFromMuscle(m)} disabled={cur === 0} style={{ width: 26, height: 26, borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: cur === 0 ? 'not-allowed' : 'pointer', background: cur === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: cur === 0 ? DIM : '#ef4444', opacity: cur === 0 ? 0.4 : 1 }}>−</button>
                  <button onClick={() => addSetToMuscle(m)} disabled={pct > 100} style={{ width: 26, height: 26, borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: pct > 100 ? 'not-allowed' : 'pointer', background: pct > 100 ? 'rgba(255,255,255,0.02)' : 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: pct > 100 ? DIM : '#22c55e', opacity: pct > 100 ? 0.4 : 1 }}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div style={{ fontSize: 10, color: DIM, marginTop: 6, fontStyle: 'italic' }}>
          «+» — добавить сет к последнему блоку мышцы в день 1 (или создать аксессуар). «−» — убрать последний сет. Блок с 1 сетом удаляется.
        </div>
      )}
    </div>
  );
};

/* ─── Инфо упражнений (все упражнения плана, кликабельно) ─── */
export const ExerciseInfoPanel: React.FC<{ program: UserProgram; dir: string }> = ({ program, dir }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const allExercises: { name: string; muscle: string }[] = [];
  if (dir === 'bb' && program.bb) {
    for (const w of program.bb.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.exerciseName && !allExercises.find(e => e.name === b.exerciseName)) {
            allExercises.push({ name: b.exerciseName, muscle: b.muscle || '' });
          }
        }
      }
    }
  }
  if (allExercises.length === 0) return null;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #06b6d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4', marginBottom: 6 }}>🔬 Инфо упражнений ({allExercises.length})</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Клик — раскрыть биомеханику, вектор, мышцы, инвентарь</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '40vh', overflow: 'auto' }}>
        {allExercises.slice(0, 30).map(({ name, muscle }) => {
          const ex = EXERCISE_CATALOG.find((e: Exercise) => e.name === name) as any | undefined;
          const isExpanded = expanded === name;
          return (
            <div key={name} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div onClick={() => setExpanded(isExpanded ? null : name)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', background: isExpanded ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)', fontSize: 11, transition: 'background 0.15s' }}>
                <span style={{ flex: 1, fontWeight: 600, color: DIM_STRONG }}>{name}</span>
                {muscle && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: DIM }}>{GROUP_RU[muscle] || muscle}</span>}
                <span style={{ fontSize: 11, color: isExpanded ? '#06b6d4' : DIM }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && ex && (
                <div style={{ padding: '8px 10px', background: 'rgba(6,182,212,0.03)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4 }}>
                    {ex.group && <div style={{ fontSize: 10, color: DIM }}>Группа: <b style={{ color: DIM_STRONG }}>{GROUP_RU[ex.group] ?? ex.group}</b></div>}
                    {ex.type && <div style={{ fontSize: 10, color: DIM }}>Тип: <b style={{ color: DIM_STRONG }}>{ex.type}</b></div>}
                    {ex.equipment && <div style={{ fontSize: 10, color: DIM }}>Инвентарь: <b style={{ color: DIM_STRONG }}>{typeof ex.equipment === 'string' ? ex.equipment : (ex.equipment as string[]).join(', ')}</b></div>}
                    {ex.forceVector && <div style={{ fontSize: 10, color: DIM }}>Вектор: <b style={{ color: DIM_STRONG }}>{ex.forceVector}</b></div>}
                    {ex.primaryMuscles && <div style={{ fontSize: 10, color: DIM }}>Мышцы: <b style={{ color: DIM_STRONG }}>{Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles.join(', ') : ex.primaryMuscles}</b></div>}
                  </div>
                </div>
              )}
              {isExpanded && !ex && (
                <div style={{ padding: '8px 10px', background: 'rgba(6,182,212,0.03)', fontSize: 10, color: DIM, fontStyle: 'italic' }}>Упражнение не найдено в каталоге</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Панель замен упражнений ─── */
export const SubstitutionPanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast }) => {
  if (dir !== 'bb' || !program.bb) return null;
  const allBlocks: { weekIdx: number; sessionIdx: number; blockIdx: number; block: UserBlock; weekLabel: string; sessionLabel: string }[] = [];
  program.bb.weeks.forEach((w, wi) =>
    w.sessions.forEach((s, si) =>
      s.blocks.forEach((b, bi) => {
        if (b.exerciseName) allBlocks.push({ weekIdx: wi, sessionIdx: si, blockIdx: bi, block: b, weekLabel: `Нед ${w.week}`, sessionLabel: s.name || `День ${si + 1}` });
      })
    )
  );
  if (allBlocks.length === 0) return null;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #f59e0b' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 8 }}>🔄 Замены упражнений ({allBlocks.length} упр)</div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>Клик — заменить упражнение на рекомендуемый аналог.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflow: 'auto' }}>
        {allBlocks.slice(0, 20).map(({ weekIdx, sessionIdx, blockIdx, block, weekLabel, sessionLabel }) => {
          let subs: any[] = [];
          try { subs = (findSubstitutions(block.exerciseName, block.muscle, new Set<string>()) || []).filter((s: any) => s?.name && s.name !== block.exerciseName); } catch { subs = []; }
          if (subs.length === 0) return null;
          return (
            <div key={`${weekIdx}-${sessionIdx}-${blockIdx}`} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>
                {weekLabel} · {sessionLabel} · <b style={{ color: DIM_STRONG }}>{block.exerciseName}</b>
                {block.muscle && <span style={{ color: DIM, marginLeft: 4 }}>({GROUP_RU[block.muscle] || block.muscle})</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {subs.slice(0, 4).map((s: any, si2: number) => (
                  <button key={si2} onClick={() => {
                    const upd = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === weekIdx ? { ...w, sessions: w.sessions.map((se, si) => si === sessionIdx ? { ...se, blocks: se.blocks.map((bl, bi) => bi === blockIdx ? { ...bl, exerciseName: s.name, note: `Замена: ${block.exerciseName} → ${s.name}` } : bl) } : se) } : w) } };
                    onChange(upd);
                    showToast('✅ ' + s.name);
                  }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 600, minHeight: 38 }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
