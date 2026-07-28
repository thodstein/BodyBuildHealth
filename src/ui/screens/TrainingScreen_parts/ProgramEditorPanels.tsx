/**
 * ProgramEditorPanels.tsx — извлечённые панели инструментов для ProgramEditor.
 * Вынесено из ProgramManagerPanel.tsx для соблюдения лимита 1500 строк.
 */
import React, { useState } from 'react';
import { CARD, DIM, DIM_STRONG, ACCENT, IN, BTN_GHOST } from './training-ui';
import { GROUP_RU } from './program-types';
import type { UserProgram, UserBlock, BBProgramBody } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate, suggestExercisesForGroup } from '../../../engines/manual-constructor';
import { prescribeLoad } from '../../../engines/bb/bb-autocoach.engine';
import { selectSplit } from '../../../engines/split-selector.engine';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadTrainingProfile } from './training-profile';
import { distributePhases } from './phase-periodization';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import type { Exercise } from '../../../core/types';
import { findSubstitutions } from '../../../engines/exercise-substitution.engine';

interface PanelProps {
  program: UserProgram;
  dir: string;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  labMrvMult: number;
}

const PHASE_LABELS: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };

/* ───── Единая панель диагностики и рекомендаций (объединяет DiagnosticPanel + RecommendationsPanel) ───── */
export const PlanDiagnosticsPanel: React.FC<PanelProps> = ({ program, dir, onChange, showToast, labMrvMult }) => {
  if (!(dir === 'bb' && program.bb || dir === 'pl' && program.pl?.customWeeks)) return null;
  const prof = loadTrainingProfile();
  let q: ReturnType<typeof computePlanQualityFor> | null = null;
  try {
    q = computePlanQualityFor(program, program.meta.level, { onCourse: prof.onCourse ?? false, courseIntensity: prof.courseIntensity ?? 'moderate', labMult: labMrvMult });
  } catch { return null; }
  if (!q || q.perMuscle.length === 0) return null;

  const weak = q.perMuscle.filter(m => m.status === 'low');
  const overloaded = q.perMuscle.filter(m => m.status === 'over');
  const high = q.perMuscle.filter(m => m.status === 'high');
  const ok = q.perMuscle.filter(m => m.status === 'ok');
  const gaps = q.perMuscle.filter(m => m.status === 'low' || m.status === 'over');
  const pctCalc = q.perMuscle.length >= 2 ? (() => {
    const pcts = q.perMuscle.map(p => ({ m: p.muscle, p: p.mrv > 0 ? (p.peakSets / p.mrv) * 100 : 0 }));
    return Math.max(...pcts.map(p => p.p)) - Math.min(...pcts.map(p => p.p));
  })() : 0;
  const barColor = q.score >= 75 ? '#22c55e' : q.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid ' + barColor, background: 'linear-gradient(135deg, ' + barColor + '08, rgba(167,139,250,0.04))' }}>
      {/* Заголовок: score + сводка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🔬 Диагностика программы</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor }}>{q.score}/100 {q.grade}</span>
        <div style={{ flex: 1, minWidth: 80, maxWidth: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
          <div style={{ width: q.score + '%', height: '100%', background: barColor, borderRadius: 6, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{weak.length} недобор · {overloaded.length} перегруз · {high.length} зона · {ok.length} ок</span>
      </div>

      {/* Чипсы статусов по мышцам */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {q.perMuscle.map(pm => {
          const c = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
          const icon = pm.status === 'over' ? '⚠' : pm.status === 'low' ? '⬇' : pm.status === 'high' ? '📈' : '✅';
          const pct = pm.mrv > 0 ? Math.round((pm.peakSets / pm.mrv) * 100) : 0;
          return <span key={pm.muscle} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c + '18', border: '1px solid ' + c + '30', color: c }}>{icon} {GROUP_RU[pm.muscle] ?? pm.muscle} {pm.peakSets}/{pm.mrv}с ({pct}%)</span>;
        })}
      </div>

      {/* Рекомендации: недобор → предложить упражнения */}
      {weak.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>⬇ Недобор — добавить упражнения:</div>
          {weak.map(w => {
            const exs = suggestExercisesForGroup(w.muscle, program.meta.level, 3, (prof.equipment ?? []) as string[], [], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
            if (exs.length === 0) return null;
            return (
              <div key={w.muscle} style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG }}>{GROUP_RU[w.muscle] ?? w.muscle}: +{w.mev - Math.max(0, w.peakSets)} сетов до MEV={w.mev}</span>
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

      {/* Рекомендации: перегруз → текст */}
      {overloaded.length > 0 && (
        <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠ Превышение MRV — снизьте объём:</div>
          {overloaded.map(o => (
            <div key={o.muscle} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{GROUP_RU[o.muscle] ?? o.muscle}: {o.peakSets} сетов {'>'} MRV {o.mrv} (−{o.peakSets - o.mrv} сетов)</div>
          ))}
        </div>
      )}

      {/* Дисбаланс */}
      {pctCalc >= 30 && (
        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚖ Дисбаланс нагрузки ({Math.round(pctCalc)}%) — выровняйте объём между группами</div>
        </div>
      )}

      {/* Сводка issues */}
      {q.issues.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
          {q.issues.slice(0, 4).map((iss, i) => <div key={i} style={{ marginBottom: 2 }}>• {iss}</div>)}
        </div>
      )}
    </div>
  );
};

/* ───── Сводная таблица плана (мобильная) ───── */
const PHASE_LABELS_SP: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };
const CHAR_MAP: Record<string, string> = { 'тяж': '#ef4444', 'памп': '#3b82f6', 'лёг': '#6b7280' };

export const PlanSummaryTable: React.FC<{
  program: UserProgram;
  showWeek?: number;
  onShowWeekChange?: (w: number) => void;
}> = ({ program, showWeek = 1, onShowWeekChange }) => {
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const body = program.bb;
  if (!body || !body.weeks || body.weeks.length === 0) return null;

  const week = body.weeks.find(w => w.week === showWeek) || body.weeks[0];
  const totalWeeks = body.weeks.length;
  const DAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  const phaseColors: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };

  return (
    <div style={{ ...CARD, padding: 12, borderLeft: '3px solid #00e68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>📋 План: {program.meta.title}</span>
          <span style={{ fontSize: 11, color: DIM, marginLeft: 8 }}>{totalWeeks} нед · {program.meta.daysPerWeek} дн/нед</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {body.weeks.map((w, i) => {
            const pc = phaseColors[w.phase] || '#666';
            return (
              <button key={i} onClick={() => onShowWeekChange?.(w.week)}
                style={{
                  padding: '5px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', minHeight: 34, minWidth: 36,
                  background: showWeek === w.week ? pc + '20' : 'rgba(255,255,255,0.04)',
                  border: showWeek === w.week ? '1px solid ' + pc : '1px solid rgba(255,255,255,0.06)',
                  color: showWeek === w.week ? pc : DIM,
                  fontWeight: showWeek === w.week ? 700 : 400,
                }}>
                Н{w.week}{w.deload ? '🟢' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
        Фаза: <b style={{ color: phaseColors[week.phase] || '#fff' }}>{PHASE_LABELS_SP[week.phase] || week.phase}</b>
        {week.deload && <span style={{ color: '#22c55e', marginLeft: 6 }}>🟢 Разгрузка</span>}
      </div>
      {week.sessions.map((session, si) => {
        const totalSets = session.blocks.reduce((s, b) => s + b.sets.length, 0);
        return (
          <div key={si} style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(24,24,27,0.3)' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(0,230,138,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{DAY_NAMES[(session.dayOfWeek ?? si) % 7]} — {session.name || `День ${si + 1}`}</span>
              <span style={{ fontSize: 11, color: DIM }}>{session.focus || ''} · {totalSets} подх.{session.estimatedMin ? ` · ~${session.estimatedMin}м` : ''}</span>
            </div>
            {session.warmup && <div style={{ padding: '3px 12px', fontSize: 11, color: DIM, fontStyle: 'italic', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>🔥 {session.warmup}</div>}
            {session.cooldown && <div style={{ padding: '3px 12px', fontSize: 11, color: DIM, fontStyle: 'italic', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>🧊 {session.cooldown}</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: DIM, fontWeight: 700 }}>
                <span style={{ flex: 1, minWidth: 100 }}>Упражнение</span>
                <span style={{ width: 52, textAlign: 'center' }}>Схема</span>
                <span style={{ width: 44, textAlign: 'center' }}>RIR</span>
                <span style={{ width: 52, textAlign: 'center' }}>Вес</span>
                <span style={{ width: 48, textAlign: 'center' }}>Темп</span>
                <span style={{ width: 44, textAlign: 'center' }}>Отдых</span>
                <span style={{ width: 44, textAlign: 'center' }}>Режим</span>
              </div>
              {session.blocks.map((block, bi) => {
                const exId = `${si}-${bi}`;
                const isExpanded = expandedEx === exId;
                const chars = (block.character || (block.role === 'primary' ? 'тяж' : 'памп'));
                const bs = block.sets;
                const reps = bs[0]?.reps ?? '—';
                const rir = bs[0]?.rir ?? '—';
                const wgt = bs[0]?.weight ? `${bs[0].weight}кг` : bs[0]?.pctOf1RM ? `${bs[0].pctOf1RM}%` : '—';
                const tmp = bs[0]?.tempo || block.tempoSpec || '—';
                const rst = bs[0]?.restSec ? `${bs[0].restSec}с` : '—';
                return (
                  <div key={exId}>
                    <div onClick={() => setExpandedEx(isExpanded ? null : exId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isExpanded ? 'rgba(0,230,138,0.06)' : 'transparent', fontSize: 12, transition: 'background 0.15s' }}>
                      <span style={{ flex: 1, minWidth: 100, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {block.exerciseName || <span style={{ color: DIM, fontStyle: 'italic' }}>Пусто</span>}
                        {block.role && block.role !== 'primary' && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: DIM }}>{block.role === 'accessory' ? 'АКС' : block.role}</span>}
                      </span>
                      <span style={{ width: 52, textAlign: 'center', color: ACCENT }}>{bs.length}×{reps}</span>
                      <span style={{ width: 44, textAlign: 'center', color: (typeof rir === 'number' && rir <= 1) ? '#ef4444' : DIM_STRONG }}>R{rir}</span>
                      <span style={{ width: 52, textAlign: 'center', color: DIM_STRONG }}>{wgt}</span>
                      <span style={{ width: 48, textAlign: 'center', color: DIM }}>{tmp}</span>
                      <span style={{ width: 44, textAlign: 'center', color: DIM }}>{rst}</span>
                      <span style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 700, color: CHAR_MAP[chars] || DIM }}>{chars || block.type}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,230,138,0.03)' }}>
                        {block.muscle && <div style={{ fontSize: 11, color: DIM }}>Мышца: <b style={{ color: DIM_STRONG }}>{GROUP_RU[block.muscle] || block.muscle}</b></div>}
                        {block.rationale && <div style={{ fontSize: 11, color: '#60a5fa' }}>📝 {block.rationale}</div>}
                        {block.note && <div style={{ fontSize: 11, color: '#f59e0b' }}>💬 {block.note}</div>}
                        {block.comment && <div style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>{block.comment}</div>}
                        {block.repsRange && <div style={{ fontSize: 11, color: DIM }}>Диапазон: {block.repsRange}</div>}
                        {block.warmupSets && block.warmupSets.length > 0 && <div style={{ fontSize: 11, color: DIM }}>Разминка: {block.warmupSets.length} подх.</div>}
                        {bs.length > 1 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>{bs.map((set, si2) => <span key={si2} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM_STRONG }}>{set.reps}×R{set.rir}{set.weight ? `@${set.weight}кг` : ''}{set.note ? ` — ${set.note}` : ''}</span>)}</div>}
                        {(block as any).techniques && (block as any).techniques.length > 0 && (block as any).techniques[0] !== 'none' && <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4 }}>🔧 {(block as any).techniques.map((t: string) => t.replace(/_/g, ' ')).join(', ')}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ───── Панель автопериодизации ───── */
export const AutoPeriodizationPanel: React.FC<{
  weeks: number; goal: string; level: string;
  onApply?: (phases: Array<{ startWeek: number; endWeek: number; phase: string }>) => void;
}> = ({ weeks, goal, level, onApply }) => {
  if (weeks < 2) return null;
  let phases: Array<{ startWeek: number; endWeek: number; phase: string }> = [];
  try { phases = distributePhases(weeks, 0, goal === 'powerlifting' ? 'strength' : 'bulk') || []; } catch { return null; }
  if (!phases.length) return null;
  const pc: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };
  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #60a5fa' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', marginBottom: 8 }}>📈 Авто-периодизация</div>
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        {phases.map((p, i) => {
          const c = pc[p.phase] || '#666';
          const w = p.endWeek - p.startWeek + 1;
          return <div key={i} style={{ width: `${(w / weeks) * 100}%`, height: '100%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>{w}н</div>;
        })}
      </div>
      {phases.map((p, i) => {
        const c = pc[p.phase] || '#666';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 10, background: c, flexShrink: 0 }} />
            <span style={{ color: c, fontWeight: 700, minWidth: 100 }}>{PHASE_LABELS_SP[p.phase] || p.phase}</span>
            <span style={{ color: DIM }}>нед {p.startWeek}–{p.endWeek} ({p.endWeek - p.startWeek + 1} нед)</span>
          </div>
        );
      })}
      {onApply && (
        <button onClick={() => onApply(phases)} style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontWeight: 700, minHeight: 38, width: '100%' }}>
          🔧 Применить периодизацию
        </button>
      )}
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
          <span style={{ fontSize: 11, color: DIM }}>{p.label}</span>
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

/* ───── Интерактивный объём и MRV (±сеты прямо из панели) ───── */
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

  // Добавить 1 сет к мышце в week1/session0 (добавляет сет к последнему блоку этой мышцы, или создаёт новый блок)
  const addSetToMuscle = (muscle: string) => {
    if (dir !== 'bb' || !program.bb?.weeks[0]?.sessions[0] || !onChange) return;
    const w0 = program.bb.weeks[0];
    const s0 = w0.sessions[0];
    // Найти последний блок этой мышцы в день 1
    const blockIdx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === muscle).pop();
    let newBlocks;
    if (blockIdx) {
      // Добавить сет к существующему блоку
      newBlocks = s0.blocks.map((b, i) => i === blockIdx.i ? { ...b, sets: [...b.sets, { ...b.sets[b.sets.length - 1] ?? { reps: 10, rir: 2, weight: 0, restSec: 90 } }] } : b);
    } else {
      // Создать новый блок-аксессуар
      const exs = suggestExercisesForGroup(muscle, program.meta.level, 1, (prof.equipment ?? []) as string[], [], [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
      const nb: UserBlock = { id: newId('blk'), type: 'accessory' as const, exerciseName: exs[0]?.name ?? '', muscle, role: 'accessory' as const, sets: makeSetsFromTemplate(muscleAwareSets(muscle, program.meta.level), (prof.workMax ?? {})[muscle] ?? 40) };
      newBlocks = [...s0.blocks, nb];
    }
    onChange({ ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((w, wi) => wi === 0 ? { ...w, sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: newBlocks } : s) } : w) } });
    showToast?.('➕ +1 сет: ' + (GROUP_RU[muscle] ?? muscle));
  };

  // Убрать 1 сет у мышцы (удаляет последний сет последнего блока этой мышцы в week1/session0)
  const removeSetFromMuscle = (muscle: string) => {
    if (dir !== 'bb' || !program.bb?.weeks[0]?.sessions[0] || !onChange) return;
    const w0 = program.bb.weeks[0];
    const s0 = w0.sessions[0];
    const blockIdx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === muscle).pop();
    if (!blockIdx) return;
    let newBlocks;
    if (blockIdx.b.sets.length > 1) {
      // Убрать последний сет
      newBlocks = s0.blocks.map((b, i) => i === blockIdx.i ? { ...b, sets: b.sets.slice(0, -1) } : b);
    } else {
      // Удалить блок целиком (1 сет = удалить)
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

/* ───── Фазовая легенда удалена — функционал полностью покрыт AutoPeriodizationPanel (легенда + onApply) ───── */

/* ───── Инфо упражнений (показывает ВСЕ упражнения плана, кликабельно) ───── */
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

/* ───── RecommendationsPanel удалён — функционал полностью покрыт PlanDiagnosticsPanel ───── */

/* ───── Панель замен упражнений ───── */
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
