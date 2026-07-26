/**
 * ProgramEditorComponents.tsx — extracted sub-components for BB/PL program editing.
 * Extracted from ProgramManagerPanel.tsx.
 *
 * Components: BBEditor, SessionList, BlockList, SetEditor, PLEditor,
 *             WeakPointChips, Chip, BBConstraintsPanel
 * Constants: WEAK_OPTS, EQUIPMENT_OPTS, LOAD_STRATEGY_OPTS, DELOAD_PROTOCOL_OPTS, INTENSITY_TECHNIQUE_OPTS
 */
import React, { useMemo, useState } from 'react';
import { SET_TEMPLATES, GROUP_RU } from './program-types';
import { ACCENT, ACCENT_LINE, BTN_GHOST, CARD, DIM, DIM_STRONG, IN, SMALL, panelStyle } from './training-ui';
import { getReferencedCycle, userWeekToBBPlan } from '../../../engines/user-program/program-store';
import type {
  UserProgram, BBProgramBody, PLProgramBody, UserWeek, UserSession, UserBlock, UserSet,
  ProgramConstraints, ProgramProgression,
  PLWeek, PLDay, PLExercise, PLSet,
} from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import {
  muscleAwareSets,
  makeSetsFromTemplate,
  suggestExercisesForGroup,
} from '../../../engines/manual-constructor.engine';
import { loadTrainingProfile } from './training-profile';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { findSubstitutions } from '../../../engines/exercise-substitution.engine';
import { ExerciseLabPicker } from './ExerciseLabPicker';
import { VolumeBudgetCard } from './VolumeBudgetCard';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { tempoFor, TEMPO_BY_CHARACTER, REST_BY_CHARACTER, tutForSet } from '../../../engines/bb/bb-tempo-rest';
import { RIR_MATRIX } from '../../../engines/rir-matrix.engine';

/* ─── ББ-редактор: недели → сессии → блоки ─── */

const BBEditor: React.FC<{ body: BBProgramBody; onChange: (b: BBProgramBody) => void; level: string }> = ({ body, onChange, level }) => {
  const [volWeekIdx, setVolWeekIdx] = useState<number | null>(null);
  const setWeeks = (weeks: UserWeek[]) => onChange({ ...body, weeks });
  const addWeek = () => {
    const n = body.weeks.length + 1;
    setWeeks([...body.weeks, { week: n, phase: 'accumulation', deload: false, sessions: [] }]);
  };
  const updateWeek = (wi: number, patch: Partial<UserWeek>) => {
    const w2 = body.weeks.map((w, i) => i === wi ? { ...w, ...patch } : w);
    setWeeks(w2);
  };
  // U4: confirm-диалог при удалении недели
  const removeWeek = (wi: number) => {
    const wk = body.weeks[wi];
    const sessCount = wk?.sessions?.length ?? 0;
    if (!window.confirm(`Удалить неделю ${wk?.week}? Будет потеряно ${sessCount} сессий. Это нельзя отменить.`)) return;
    setWeeks(body.weeks.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 })));
  };
  // U12: клонировать неделю с прогрессией весов +2.5%
  const cloneWeek = (wi: number) => {
    const src = body.weeks[wi];
    if (!src) return;
    const progression = 1.025; // +2.5% к весу
    const cloned: UserWeek = {
      week: body.weeks.length + 1,
      phase: src.phase,
      deload: src.deload,
      sessions: src.sessions.map(s => ({
        id: newId('ses'),
        name: s.name,
        dayOfWeek: s.dayOfWeek,
        focus: s.focus,
        blocks: s.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st, weight: st.weight ? Math.round(st.weight * progression / 2.5) * 2.5 : st.weight })) })),
        warmup: s.warmup,
        cooldown: s.cooldown,
      })),
    };
    setWeeks([...body.weeks, cloned]);
  };

  /** Метрики для выбранной недели — пересчитываем при каждом изменении блоков/сетов. */
  const volMetrics = useMemo(() => {
    if (volWeekIdx == null) return null;
    const w = body.weeks[volWeekIdx];
    if (!w) return null;
    if ((w.sessions ?? []).length === 0) return null;
    try { return calcBBPlanMetrics(userWeekToBBPlan(w, level)); } catch { return null; }
  }, [volWeekIdx, body.weeks, level]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Структура ({body.weeks.length} нед)</div>
      {/* 🎯 Быстрое добавление упражнений для слабых групп из профиля */}
      {(() => {
        const prof = loadTrainingProfile();
        const wp = (prof.weakPoints ?? []) as string[];
        if (wp.length === 0) return null;
        const addWeakToWeek = (muscle: string) => {
          if (!body.weeks[0]?.sessions[0]) return;
          const recs = suggestExercisesForGroup(muscle, level, 2, (prof.equipment ?? []) as string[], wp, [], prof.avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as string[], (prof.excludedExercises ?? []) as string[]);
          if (recs.length === 0) return;
          const w0 = body.weeks[0];
          const s0 = w0.sessions[0];
          const newBlocks: UserBlock[] = recs.slice(0, 2).map((r) => ({
            id: newId('blk'),
            type: 'accessory' as const,
            exerciseName: r.name,
            muscle,
            role: 'accessory' as const,
            sets: makeSetsFromTemplate(muscleAwareSets(muscle, level), (prof.workMax ?? {})[muscle] ?? 40),
          }));
          const updatedWeeks = body.weeks.map((w, i) => i === 0 ? {
            ...w,
            sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, ...newBlocks] } : s),
          } : w);
          setWeeks(updatedWeeks);
        };
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>🎯 Слабые группы — быстрое добавление</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {wp.map((m) => (
                <button
                  key={m}
                  onClick={() => addWeakToWeek(m)}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 38 }}
                >
                  + {GROUP_RU[m] ?? m}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {body.weeks.map((w, wi) => (
        <div key={wi} style={{ ...CARD, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {(() => {
              const pc = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[w.phase];
              const prog = wi > 0 ? Math.round(((1.025 ** wi) - 1) * 100) : 0;
              const totalSets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.length, 0), 0);
              return (
                <>
                  <div style={{ width: 4, height: 24, borderRadius: 2, background: pc, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: DIM_STRONG }}>Неделя {w.week}</span>
                  {prog > 0 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>+{prog}%</span>}
                  <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{totalSets} сетов</span>
                </>
              );
            })()}
            <select style={{ ...IN, padding: '4px 6px', fontSize: 11, flex: '0 0 auto', minHeight: 38 }} value={w.phase} onChange={e => updateWeek(wi, { phase: e.target.value as UserWeek['phase'] })}>
              <option value="accumulation">Накопление</option>
              <option value="intensification">Интенсификация</option>
              <option value="deload">Разгрузка</option>
              <option value="peaking">Пик</option>
            </select>
            {/* P0-2: RIR-навигатор — целевой RIR фазы vs фактический в плане */}
            {(() => {
              const phaseRir: Record<string, string> = { accumulation: '3→1', intensification: '2→0', deload: '4', peaking: '1→0' };
              const avgRir = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.reduce((st, set) => st + (set.rir ?? 2), 0), 0), 0);
              const totalSets = w.sessions.reduce((s, ses) => s + ses.blocks.reduce((b, blk) => b + blk.sets.length, 0), 0);
              const actual = totalSets > 0 ? Math.round((avgRir / totalSets) * 10) / 10 : null;
              const targetLo = { accumulation: 3, intensification: 2, deload: 4, peaking: 1 }[w.phase] ?? 2;
              const ok = actual !== null && actual >= targetLo - 1 && actual <= targetLo + 1;
              return (
                <span style={{ fontSize: 10, color: ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
                  🎯 RIR {phaseRir[w.phase] ?? '—'}
                  {actual !== null && <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}> · факт {actual}</span>}
                </span>
              );
            })()}
            <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={w.deload} onChange={e => updateWeek(wi, { deload: e.target.checked })} /> deload
            </label>
            <button
              style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38,
                       color: volWeekIdx === wi ? ACCENT : DIM_STRONG,
                       borderColor: volWeekIdx === wi ? ACCENT_LINE : 'rgba(255,255,255,0.08)' }}
              onClick={() => setVolWeekIdx(volWeekIdx === wi ? null : wi)}
              title="Показать бюджет объёма по мышцам для этой недели"
            >📊 Объём</button>
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38 }} onClick={() => cloneWeek(wi)} title="Клонировать неделю">⧉</button>
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38, marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeWeek(wi)}>✕ нед</button>
          </div>
          {volWeekIdx === wi && (
            <div style={{ marginBottom: 8 }}>
              {volMetrics
                ? <VolumeBudgetCard metrics={volMetrics} />
                : <div style={{ fontSize: 11, color: DIM, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    Недостаточно данных — добавьте хотя бы одну сессию с упражнениями, чтобы увидеть бюджет объёма.
                  </div>
              }
            </div>
          )}
          <SessionList sessions={w.sessions} onChange={(sessions) => updateWeek(wi, { sessions })} />
        </div>
      ))}
      {/* P0-1: Ротация — упражнения старше 4 недель */}
      {body.weeks.length >= 4 && (() => {
        const exAge: Record<string, { weeks: number; muscle: string }> = {};
        for (const w of body.weeks) {
          for (const s of w.sessions) {
            for (const b of s.blocks) {
              if (!b.exerciseName) continue;
              const key = b.exerciseName;
              if (!exAge[key]) exAge[key] = { weeks: 0, muscle: b.muscle };
              exAge[key].weeks++;
            }
          }
        }
        const stale = Object.entries(exAge).filter(([, v]) => v.weeks >= 4).slice(0, 5);
        if (stale.length === 0) return null;
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #f59e0b' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🔄 Ротация — упражнения старше 4 недель</div>
            {stale.map(([name, { weeks: age, muscle }]) => {
              const subs = findSubstitutions(name, muscle, new Set()).slice(0, 2);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: DIM_STRONG, fontWeight: 700 }}>{name}</span>
                  <span style={{ color: '#f59e0b', fontSize: 11 }}>{age} нед</span>
                  {subs.length > 0 ? subs.map((sub, si) => (
                    <button key={si}
                      onClick={() => {
                        const newWeeks = body.weeks.map(w => ({
                          ...w, sessions: w.sessions.map(s => ({
                            ...s, blocks: s.blocks.map(b => b.exerciseName === name ? { ...b, exerciseName: sub.exercise.name, muscle: sub.exercise.group || b.muscle } : b)
                          }))
                        }));
                        setWeeks(newWeeks);
                      }}
                      title={sub.reason + ' · confidence: ' + sub.confidence}
                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700, minHeight: 30 }}
                    >→ {sub.exercise.name}</button>
                  )) : <span style={{ color: DIM, fontSize: 11 }}>нет замен</span>}
                </div>
              );
            })}
          </div>
        );
      })()}
      <button style={{ ...BTN_GHOST, padding: '8px 14px', minHeight: 38 }} onClick={addWeek}>+ Добавить неделю</button>
    </div>
  );
};

const SessionList: React.FC<{ sessions: UserSession[]; onChange: (s: UserSession[]) => void }> = ({ sessions, onChange }) => {
  const addSession = () => onChange([...sessions, { id: newId('ses'), name: 'День ' + (sessions.length + 1), focus: '', blocks: [] }]);
  const updateSession = (si: number, patch: Partial<UserSession>) => onChange(sessions.map((s, i) => i === si ? { ...s, ...patch } : s));
  // U4: confirm-диалог при удалении сессии
  const removeSession = (si: number) => {
    const s = sessions[si];
    if (!window.confirm(`Удалить "${s.name}"? Будет потеряно ${s.blocks.length} упражнений. Это нельзя отменить.`)) return;
    onChange(sessions.filter((_, i) => i !== si));
  };
  // U12: клонировать сессию
  const cloneSession = (si: number) => {
    const src = sessions[si];
    if (!src) return;
    onChange([
      ...sessions,
      {
        id: newId('ses'),
        name: src.name + ' (копия)',
        dayOfWeek: src.dayOfWeek,
        focus: src.focus,
        blocks: src.blocks.map(b => ({ ...b, id: newId('blk'), sets: b.sets.map(st => ({ ...st })) })),
        warmup: src.warmup,
        cooldown: src.cooldown,
      },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sessions.map((s, si) => (
        <div key={s.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input style={{ ...IN, padding: '6px 10px', fontSize: 11, flex: 1, minHeight: 38 }} value={s.name} onChange={e => updateSession(si, { name: e.target.value })} placeholder="День" />
            <input style={{ ...IN, padding: '6px 10px', fontSize: 11, flex: 1, minHeight: 38 }} value={s.focus} onChange={e => updateSession(si, { focus: e.target.value })} placeholder="Фокус (грудь/трицепс)" />
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38 }} onClick={() => cloneSession(si)} title="Клонировать сессию">⧉</button>
            <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeSession(si)}>✕</button>
          </div>
          <BlockList blocks={s.blocks} onChange={(blocks) => updateSession(si, { blocks })} />
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 38 }} onClick={addSession}>+ Сессия</button>
    </div>
  );
};

const BlockList: React.FC<{ blocks: UserBlock[]; onChange: (b: UserBlock[]) => void }> = ({ blocks, onChange }) => {
  const addBlock = () => onChange([...blocks, { id: newId('blk'), type: 'accessory', exerciseName: '', muscle: '', role: 'accessory', sets: [{ reps: 10, rir: 2 }] }]);
  const updateBlock = (bi: number, patch: Partial<UserBlock>) => onChange(blocks.map((b, i) => i === bi ? { ...b, ...patch } : b));
  // U4: confirm-диалог при удалении блока
  const removeBlock = (bi: number) => {
    const b = blocks[bi];
    if (!window.confirm(`Удалить "${b.exerciseName || 'упражнение'}"? Будет потеряно ${b.sets.length} сетов. Это нельзя отменить.`)) return;
    onChange(blocks.filter((_, i) => i !== bi));
  };
  // U12: клонировать блок
  const cloneBlock = (bi: number) => {
    const src = blocks[bi];
    if (!src) return;
    onChange([
      ...blocks,
      { ...src, id: newId('blk'), sets: src.sets.map(s => ({ ...s })) },
    ]);
  };
  // U11: назначить/снять superset-партнёра (следующий/предыдущий блок)
  const linkSuperset = (bi: number) => {
    const current = blocks[bi];
    if (!current) return;
    // Ищем ближайший блок вверх/вниз, у которого ещё нет supersetWith или текущий — не его партнёр
    const partnerIdx = bi > 0 ? bi - 1 : bi + 1;
    if (partnerIdx < 0 || partnerIdx >= blocks.length) return;
    const partner = blocks[partnerIdx];
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: partner.id };
      if (i === partnerIdx) return { ...b, supersetWith: current.id };
      return b;
    }));
  };
  const unlinkSuperset = (bi: number) => {
    onChange(blocks.map((b, i) => {
      if (i === bi) return { ...b, supersetWith: undefined };
      if (b.supersetWith === blocks[bi]?.id) return { ...b, supersetWith: undefined };
      return b;
    }));
  };
  // 🔄 Замена упражнения: findSubstitutions подбирает альтернативы
  const [substFor, setSubstFor] = useState<number | null>(null);
  const substResults = useMemo(() => {
    if (substFor == null) return [];
    const b = blocks[substFor];
    if (!b || !b.exerciseName) return [];
    const prof = loadTrainingProfile();
    const injured = new Set((prof.injuries ?? []).filter((i) => i.exclude).map((i) => i.muscle));
    return findSubstitutions(b.exerciseName, b.muscle, injured).slice(0, 4);
  }, [substFor, blocks]);
  const applySubst = (bi: number, name: string, muscle: string) => {
    updateBlock(bi, { exerciseName: name, muscle: muscle || blocks[bi].muscle });
    setSubstFor(null);
  };
  const moveBlock = (bi: number, dir: -1 | 1) => { const j = bi + dir; if (j < 0 || j >= blocks.length) return; const arr = [...blocks]; const tmp = arr[bi]; arr[bi] = arr[j]; arr[j] = tmp; onChange(arr); };
  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return;
    const arr = [...blocks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  };

  // HTML5 drag-and-drop: desktop работает «из коробки», мобильный (iOS 13+/Chrome) — через draggable.
  // Touch fallback (long-press → перетаскивание через touch events) для старых мобильных WebView.
  const dragSrcRef = React.useRef<number | null>(null);
  const touchSrcRef = React.useRef<number | null>(null);
  const touchArmedRef = React.useRef<number | null>(null);
  const longPressTimer = React.useRef<number | null>(null);
  const rowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const onTouchStart = (bi: number) => (e: React.TouchEvent) => {
    touchSrcRef.current = bi;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      touchArmedRef.current = bi;
      setOverIdx(bi);
      try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }
    }, 350);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchArmedRef.current == null) return;
    e.preventDefault();
    const t = e.touches[0];
    const y = t.clientY;
    let nearest = touchArmedRef.current;
    let nearestDist = Infinity;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const d = Math.abs(mid - y);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    setOverIdx(nearest);
  };
  const onTouchEnd = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (touchArmedRef.current != null && overIdx != null) {
      moveTo(touchArmedRef.current, overIdx);
    }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    setOverIdx(null);
  };
  const onTouchCancel = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    touchSrcRef.current = null;
    touchArmedRef.current = null;
    setOverIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      {blocks.map((b, bi) => (
        <div
          key={b.id}
          ref={el => { rowRefs.current[bi] = el; }}
          draggable
          onDragStart={e => { dragSrcRef.current = bi; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(bi)); setOverIdx(bi); }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== bi) setOverIdx(bi); }}
          onDragLeave={() => { if (overIdx === bi) setOverIdx(null); }}
          onDrop={e => {
            e.preventDefault();
            const src = dragSrcRef.current;
            dragSrcRef.current = null;
            setOverIdx(null);
            if (src != null) moveTo(src, bi);
          }}
          onDragEnd={() => { dragSrcRef.current = null; setOverIdx(null); }}
          onTouchStart={onTouchStart(bi)}
          onTouchMove={onTouchMove}
          style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0',
            borderTop: overIdx === bi ? '2px solid #00e68a' : '2px solid transparent',
            transition: 'border-color 0.1s',
            background: touchArmedRef.current === bi ? 'rgba(0,230,138,0.06)' : 'transparent',
            borderRadius: 8,
          }}
        >
          {/* Ряд 1: drag + тип + упражнение + мышца + сеты */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            title="Перетащите для изменения порядка"
            style={{ cursor: 'grab', fontSize: 13, color: '#64748b', userSelect: 'none', padding: '4px 6px', touchAction: 'none', minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="drag handle"
          >☰</span>
          <select style={{ ...IN, padding: '5px 8px', fontSize: 11, flex: '0 0 auto', minHeight: 38 }} value={b.type} onChange={e => updateBlock(bi, { type: e.target.value as UserBlock['type'], role: e.target.value === 'compound' ? 'primary' : 'accessory' })}>
            <option value="compound">Базовое</option>
            <option value="accessory">Доп.</option>
            <option value="isolation">Изоляция</option>
            <option value="finisher">Финишь</option>
          </select>
          <ExerciseLabPicker value={b.exerciseName} muscle={b.muscle} onSelect={ex => updateBlock(bi, { exerciseName: ex.name, muscle: ex.group || b.muscle, type: (ex.type === 'compound' ? 'compound' : ex.type === 'isolation' ? 'isolation' : 'accessory') as UserBlock['type'], role: ex.type === 'compound' ? 'primary' : 'accessory' })} />
          <input style={{ ...IN, padding: '6px 10px', fontSize: 11, width: 80, minHeight: 38 }} value={b.muscle} onChange={e => updateBlock(bi, { muscle: e.target.value })} placeholder="Мышца" list="muscle-list" />
          <SetEditor sets={b.sets} onChange={(sets) => updateBlock(bi, { sets })} muscle={b.muscle} workMax={(loadTrainingProfile().workMax ?? {}) as Record<string, number>} />
          </div>
          
          {/* Авто-разминка для compound с заданным весом */}
          {b.type === 'compound' && b.sets[0]?.weight && b.sets[0].weight > 0 && (() => {
            const w = b.sets[0].weight;
            const warmup = [
              { pct: 0.5, reps: 8, label: 'разминка' },
              { pct: 0.7, reps: 5, label: 'подход' },
              { pct: 0.85, reps: 3, label: 'подход' },
            ];
            return (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>🔥 Разминка:</span>
                {warmup.map((wu, i) => (
                  <span key={i} style={{ fontSize: 10, color: DIM }}>
                    {Math.round(w * wu.pct / 2.5) * 2.5}кг×{wu.reps}
                    {i < warmup.length - 1 ? ' → ' : ''}
                  </span>
                ))}
                <button
                  style={{ marginLeft: 4, fontSize: 11, color: DIM, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => {
                    const warmupSets = warmup.map(wu => ({ load: Math.round(w * wu.pct / 2.5) * 2.5, reps: wu.reps }));
                    updateBlock(bi, { warmupSets });
                  }}
                >сохранить</button>
              </div>
            );
          })()}
          
          {/* P0-3: Гид по темпу и отдыху */}
          {b.type === 'compound' || b.type === 'accessory' ? (() => {
            const ch = b.character || (b.type === 'compound' ? 'тяж' : 'памп');
            const spec = tempoFor(ch as 'тяж' | 'памп' | 'лёг');
            const rest = REST_BY_CHARACTER[ch as 'тяж' | 'памп' | 'лёг'] ?? 90;
            const reps = typeof b.sets[0]?.reps === 'number' ? b.sets[0].reps as number : 10;
            const tut = spec.tutPerRep * reps;
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '3px 0', borderTop: '1px dashed rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>⏱ Рекомендация:</span>
                <span style={{ fontSize: 10, color: DIM }}>темп <b style={{ color: DIM_STRONG }}>{spec.notation}</b></span>
                <span style={{ fontSize: 10, color: DIM }}>· отдых <b style={{ color: DIM_STRONG }}>{rest}s</b></span>
                <span style={{ fontSize: 10, color: DIM }}>· TUT <b style={{ color: DIM_STRONG }}>~{tut}s</b></span>
                <button
                  style={{ fontSize: 11, color: DIM, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => updateBlock(bi, { sets: b.sets.map(st => ({ ...st, tempo: spec.notation, restSec: rest })), tempoSpec: spec.notation })}
                >применить</button>
              </div>
            );
          })() : null}
          
          {/* Ряд 2: комментарий + кнопки управления */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            style={{ ...IN, padding: '6px 10px', fontSize: 11, flex: '1 1 120px', minWidth: 90, minHeight: 38 }} 
            value={b.note || ''} 
            onChange={e => updateBlock(bi, { note: e.target.value })} 
            placeholder="💬 Комментарий" 
          />
          {b.rationale && (
            <span style={{ fontSize: 10, color: DIM, flex: '0 0 auto', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.rationale}>📝</span>
          )}
          {/* Выбор второго упражнения для суперсета */}
          {b.supersetWith && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'rgba(167,139,250,0.08)', borderRadius: 6, border: '1px solid rgba(167,139,250,0.2)' }}>
              <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>⊕ Суперсет с:</span>
              <ExerciseLabPicker 
                value={blocks.find(bl => bl.id === b.supersetWith)?.exerciseName || ''} 
                muscle={b.muscle}
                onSelect={ex => {
                  // Найти индекс партнёра и обновить его название
                  const partnerIdx = blocks.findIndex(bl => bl.id === b.supersetWith);
                  if (partnerIdx >= 0) {
                    updateBlock(partnerIdx, { exerciseName: ex.name, muscle: ex.group || b.muscle });
                  }
                }} 
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38, lineHeight: 1 }} onClick={() => moveBlock(bi, -1)} title="Вверх">▲</button>
            <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38, lineHeight: 1 }} onClick={() => moveBlock(bi, 1)} title="Вниз">▼</button>
          </div>
          <button
            style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38, color: b.supersetWith ? '#a78bfa' : DIM, borderColor: b.supersetWith ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)' }}
            onClick={() => b.supersetWith ? unlinkSuperset(bi) : linkSuperset(bi)}
            title={b.supersetWith ? 'Снять superset-привязку' : 'Связать суперсетом с соседним блоком'}
          >⊕</button>
          <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38 }} onClick={() => cloneBlock(bi)} title="Клонировать блок">⧉</button>
          {b.exerciseName && (
            <button
              style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38, color: substFor === bi ? '#f59e0b' : DIM, borderColor: substFor === bi ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)' }}
              onClick={() => setSubstFor(substFor === bi ? null : bi)}
              title="Подобрать замену"
            >🔄</button>
          )}
          <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 11, minHeight: 38, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeBlock(bi)}>✕</button>
          {substFor === bi && substResults.length > 0 && (
            <div style={{ padding: '4px 8px', marginTop: 4, background: 'rgba(245,158,11,0.06)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.18)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>🔄 Замены для «{b.exerciseName}»:</div>
              {substResults.map((r, ri) => (
                <button
                  key={ri}
                  onClick={() => applySubst(bi, r.exercise.name, r.exercise.group || b.muscle)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: 2, borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM_STRONG }}
                >
                  <b>{r.exercise.name}</b> <span style={{ color: DIM, fontSize: 11 }}>({r.confidence})</span>
                  <div style={{ fontSize: 11, color: DIM }}>{r.reason}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 38, alignSelf: 'flex-start' }} onClick={addBlock}>+ Упражнение</button>
    </div>
  );
};

const SetEditor: React.FC<{ sets: UserSet[]; onChange: (s: UserSet[]) => void; muscle?: string; workMax?: Record<string, number> }> = ({ sets, onChange, muscle, workMax }) => {
  const add = () => onChange([...sets, { reps: 10, rir: 2, weight: 0, restSec: 90 }]);
  const upd = (i: number, patch: Partial<UserSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i: number) => onChange(sets.filter((_, j) => j !== i));
  const confirmDelete = (i: number) => {
    if (sets.length === 1) {
      if (!window.confirm('Удалить последний сет? Блок останется без сетов (можно добавить заново).')) return;
    }
    del(i);
  };
  const [weightMode, setWeightMode] = useState<'kg' | 'pct'>('kg');
  const wmKey = (muscle || '').toLowerCase();
  const wm = workMax?.[wmKey] ?? workMax?.[muscle || ''] ?? 0;
  const autoCalcWeight = (setIdx: number, rir: number, reps: number) => {
    const s = sets[setIdx];
    if (!s || wm <= 0) return;
    const pctForRir = [1.0, 0.96, 0.92, 0.88, 0.84, 0.80][Math.min(rir, 5)] ?? 0.85;
    const repFactor = typeof reps === 'number' ? (reps > 10 ? 0.95 : reps > 6 ? 1.0 : 1.02) : 1.0;
    const pct = pctForRir * (typeof reps === 'number' && reps <= 1 ? 1.0 : repFactor);
    const wt = Math.round((wm * pct) / 2.5) * 2.5;
    upd(setIdx, { weight: wt });
  };
  const toggleTechnique = (i: number, tech: IntensityTechnique) => {
    const s = sets[i];
    const current = s.techniques || [];
    const updated = current.includes(tech)
      ? current.filter(t => t !== tech)
      : [...current, tech];
    upd(i, { techniques: updated });
  };
  const hasTechnique = (s: UserSet, tech: IntensityTechnique) => (s.techniques || []).includes(tech);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 auto' }}>
      {sets.map((s, i) => (
        <div key={i} style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 40, minHeight: 40 }} value={typeof s.reps === 'number' ? s.reps : 0} onChange={e => upd(i, { reps: parseInt(e.target.value) || 0 })} title="повторения" />
            <span style={{ fontSize: 11, color: DIM }}>×</span>
            <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 36, minHeight: 40 }} value={s.rir} min={0} max={5} onChange={e => upd(i, { rir: parseInt(e.target.value) || 0 })} title="RIR" />
            <span style={{ fontSize: 11, color: DIM }}>@</span>
            {weightMode === 'pct' ? (
              <>
                <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 38, minHeight: 40 }} value={s.pctOf1RM != null ? Math.round(s.pctOf1RM * 100) : ''} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) upd(i, { pctOf1RM: v / 100, weight: Math.round((wm * v / 100) / 2.5) * 2.5 }); }} title="% от 1ПМ" placeholder="%" />
                <span style={{ fontSize: 11, color: DIM }}>%→</span>
              </>
            ) : null}
            <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 44, minHeight: 40 }} value={s.weight ?? 0} onChange={e => upd(i, { weight: parseFloat(e.target.value) || 0 })} title="вес (кг)" placeholder="кг" />
            {wm > 0 && typeof s.reps === 'number' && (
              <button style={{ border: 'none', background: 'rgba(0,230,138,0.12)', color: ACCENT, cursor: 'pointer', fontSize: 11, padding: '4px 6px', borderRadius: 4, fontWeight: 700, minHeight: 40 }} onClick={() => autoCalcWeight(i, s.rir, s.reps as number)} title="Рассчитать вес из %1RM" aria-label="calc">🧮</button>
            )}
            <input type="number" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 36, minHeight: 40 }} value={Math.floor((s.restSec ?? 90) / 60)} min={0} max={20} onChange={e => upd(i, { restSec: (parseInt(e.target.value) || 0) * 60 })} title="отдых (мин)" placeholder="отд" />
            <span style={{ fontSize: 11, color: DIM }}>м</span>
            <input type="text" style={{ ...IN, padding: '4px 6px', fontSize: 11, width: 52, minHeight: 40 }} value={s.tempo || ''} onChange={e => upd(i, { tempo: e.target.value })} placeholder="темп" title="Темп (2-1-1-0)" />
            <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '4px 8px', minHeight: 38 }} onClick={() => confirmDelete(i)}>✕</button>
          </div>
          {wm > 0 && (
            <button type="button" onClick={() => setWeightMode(m => m === 'kg' ? 'pct' : 'kg')} style={{ marginTop: 2, fontSize: 11, color: DIM, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', minHeight: 38 }}>
              {weightMode === 'kg' ? `+ %1PM (ПМ:${wm}кг)` : '→ только кг'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: DIM, marginRight: 2 }}>Тех:</span>
            {(['drop_set', 'myo_reps', 'pause_rep', 'rest_pause', 'mechanical_drop'] as IntensityTechnique[]).map(tech => {
              const active = hasTechnique(s, tech);
              const lbl: Record<string, string> = { drop_set: '↓DRP', myo_reps: 'MYO', pause_rep: 'PRS', rest_pause: 'RP', mechanical_drop: 'MD' };
              const clr: Record<string, string> = { drop_set: '#f59e0b', myo_reps: '#a78bfa', pause_rep: '#22c55e', rest_pause: '#3b82f6', mechanical_drop: '#ef4444' };
              return <button key={tech} type="button" onClick={() => toggleTechnique(i, tech)} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: active ? `1px solid ${clr[tech]}` : '1px solid rgba(255,255,255,0.08)', background: active ? `${clr[tech]}20` : 'transparent', color: active ? clr[tech] : DIM, minHeight: 38 }}>{lbl[tech]}</button>;
            })}
          </div>
          {hasTechnique(s, 'drop_set') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>↓ Дроп:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 40, minHeight: 34 }} value={s.dropWeight ?? 0} onChange={e => upd(i, { dropWeight: parseFloat(e.target.value) || 0 })} placeholder="вес" />
              <span style={{ fontSize: 11, color: DIM }}>×</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 34, minHeight: 34 }} value={s.dropReps ?? 0} onChange={e => upd(i, { dropReps: parseInt(e.target.value) || 0 })} placeholder="повт" />
            </div>
          )}
          {hasTechnique(s, 'myo_reps') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>Мини:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 34, minHeight: 34 }} value={s.miniReps ?? 0} onChange={e => upd(i, { miniReps: parseInt(e.target.value) || 0 })} placeholder="повт" />
              <span style={{ fontSize: 11, color: DIM }}>отд</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 36, minHeight: 34 }} value={Math.floor((s.miniRestSec ?? 15) / 60)} onChange={e => upd(i, { miniRestSec: (parseInt(e.target.value) || 0) * 60 })} placeholder="м" />
            </div>
          )}
          {hasTechnique(s, 'pause_rep') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>Пауза:</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 36, minHeight: 34 }} value={s.pauseSec ?? 2} onChange={e => upd(i, { pauseSec: parseInt(e.target.value) || 0 })} placeholder="сек" />
            </div>
          )}
        </div>
      ))}
      <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38, alignSelf: 'flex-start' }} onClick={add}>+ сет</button>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 11, color: DIM, marginRight: 4 }}>📋 Шаблоны:</span>
        {Object.entries(SET_TEMPLATES).slice(0, 5).map(([key, tmpl]) => (
          <button key={key} title={'Применить: ' + key} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 38 }}
            onClick={() => onChange(Array.from({ length: tmpl.sets }, () => ({ reps: tmpl.reps, rir: tmpl.rir, restSec: tmpl.rest, weight: sets[0]?.weight ?? 0 })))}
          >{key}</button>
        ))}
      </div>
    </div>
  );
};

/* ─── ПЛ-редактор: immutable-цикл + оверлей / custom-цикл с полным редактированием ─── */

const LIFT_OPTS: Array<{ id: PLExercise['lift']; label: string }> = [
  { id: 'squat', label: 'Присед' }, { id: 'bench', label: 'Жим' }, { id: 'dead', label: 'Тяга' }, { id: 'accessory', label: 'Подсобка' },
];
const PHASE_OPTS: Array<{ id: PLWeek['phase']; label: string }> = [
  { id: 'accumulation', label: 'Накопление' }, { id: 'intensification', label: 'Интенсификация' },
  { id: 'deload', label: 'Разгрузка' }, { id: 'peaking', label: 'Пик' },
];

const PLSetEditor: React.FC<{ sets: PLSet[]; lift: PLExercise['lift']; workMax: PLProgramBody['workMax']; onChange: (s: PLSet[]) => void }> = ({ sets, lift, workMax, onChange }) => {
  const addSet = () => onChange([...sets, { pct: 0.7, reps: 5, sets: 3, rir: 2 }]);
  const updSet = (i: number, patch: Partial<PLSet>) => onChange(sets.map((s, j) => j === i ? { ...s, ...patch } : s));
  const removeSet = (i: number) => onChange(sets.filter((_, j) => j !== i));
  const calcW = (pct: number) => {
    const pm = workMax[lift === 'accessory' ? 'squat' : lift];
    if (!pm || pm <= 0) return null;
    return Math.round((pm * pct) / 2.5) * 2.5;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sets.map((s, i) => {
        const w = calcW(s.pct);
        return (
          <div key={i} style={{ background: 'rgba(167,139,250,0.10)', borderRadius: 6, padding: '5px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: DIM }}>%1RM</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 44, minHeight: 34 }}
                value={Math.round(s.pct * 100)} min={30} max={110} onChange={e => updSet(i, { pct: (parseInt(e.target.value) || 70) / 100 })} />
              {w != null && <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>→ {w}кг</span>}
              <span style={{ fontSize: 10, color: DIM }}>×</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 32, minHeight: 34 }}
                value={s.reps} min={1} max={20} onChange={e => updSet(i, { reps: parseInt(e.target.value) || 1 })} title="повт" />
              <span style={{ fontSize: 10, color: DIM }}>повт</span>
              <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 34, minHeight: 34 }}
                value={s.sets} min={1} max={12} onChange={e => updSet(i, { sets: parseInt(e.target.value) || 1 })} title="подходов" />
              <span style={{ fontSize: 10, color: DIM }}>сетов</span>
              <label style={{ fontSize: 10, color: DIM, display: 'flex', alignItems: 'center', gap: 2 }}>
                RIR <input type="number" style={{ ...IN, padding: '3px 4px', fontSize: 11, width: 28, minHeight: 34 }}
                  value={s.rir ?? 2} min={0} max={5} onChange={e => updSet(i, { rir: parseInt(e.target.value) || 0 })} />
              </label>
              <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '4px 6px', minHeight: 38 }} onClick={() => removeSet(i)}>✕</button>
            </div>
          </div>
        );
      })}
      <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38, alignSelf: 'flex-start' }} onClick={addSet}>+ сет</button>
    </div>
  );
};

const PLEditor: React.FC<{ body: PLProgramBody; onChange: (b: PLProgramBody) => void }> = ({ body, onChange }) => {
  const cycle = useMemo(() => getReferencedCycle({ meta: {} as any, pl: body } as UserProgram), [body.sourceCycleId]);
  const set = (patch: Partial<PLProgramBody>) => onChange({ ...body, ...patch });
  const isCustom = !body.sourceCycleId;

  // ── Custom PL: fully editable weeks/days/exercises ──
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const addWeek = () => {
    const weeks = [...(body.customWeeks ?? [])];
    const n = weeks.length + 1;
    weeks.push({ week: n, phase: 'accumulation', deload: false, days: [{ name: 'День 1', exercises: [] }] });
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wi) => w.days.map((_, di) => ({ sessionIdx: weeks.slice(0, wi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: di }))) });
  };
  const removeWeek = (wi: number) => {
    const weeks = body.customWeeks?.filter((_, i) => i !== wi).map((w, i) => ({ ...w, week: i + 1 })) ?? [];
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((_, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: di }))) });
  };
  const cloneWeek = (wi: number) => {
    const src = body.customWeeks?.[wi];
    if (!src) return;
    const weeks = [...(body.customWeeks ?? [])];
    const cloned: PLWeek = { week: weeks.length + 1, phase: src.phase, deload: src.deload, days: src.days.map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) })) })) };
    set({ customWeeks: [...weeks, cloned], schedule: [...weeks, cloned].flatMap((w, wwi) => w.days.map((_, di) => ({ sessionIdx: [...weeks, cloned].slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: di }))) });
  };
  const updateWeek = (wi: number, patch: Partial<PLWeek>) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, ...patch } : w);
    set({ customWeeks: weeks });
  };
  const updateDay = (wi: number, di: number, patch: Partial<PLDay>) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, ...patch } : d) } : w);
    set({ customWeeks: weeks });
  };
  const addDay = (wi: number) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: [...w.days, { name: 'День ' + (w.days.length + 1), exercises: [] }] } : w);
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((_, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: di }))) });
  };
  const removeDay = (wi: number, di: number) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.filter((_, j) => j !== di) } : w);
    set({ customWeeks: weeks, schedule: weeks.flatMap((w, wwi) => w.days.map((_, di) => ({ sessionIdx: weeks.slice(0, wwi).reduce((a, ww) => a + ww.days.length, 0) + di, dayOfWeek: di }))) });
  };
  const updateExercise = (wi: number, di: number, ei: number, patch: Partial<PLExercise>) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: d.exercises.map((e, k) => k === ei ? { ...e, ...patch } : e) } : d) } : w);
    set({ customWeeks: weeks });
  };
  const addExercise = (wi: number, di: number) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: [...d.exercises, { name: '', lift: 'accessory' as const, muscle: '', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }] } : d) } : w);
    set({ customWeeks: weeks });
  };
  const removeExercise = (wi: number, di: number, ei: number) => {
    const weeks = (body.customWeeks ?? []).map((w, i) => i === wi ? { ...w, days: w.days.map((d, j) => j === di ? { ...d, exercises: d.exercises.filter((_, k) => k !== ei) } : d) } : w);
    set({ customWeeks: weeks });
  };

  // ── Immutable cycle: current overlay-only behavior ──
  if (!isCustom) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📋 Проф. ПЛ-цикл (immutable)</div>
          {cycle ? (
            <div style={{ fontSize: 11, color: DIM_STRONG }}>
              <div style={{ fontWeight: 700 }}>{cycle.meta.title}</div>
              <div style={{ fontSize: 10, color: DIM }}>{cycle.meta.sessionsPerWeek}д/нед · {cycle.meta.weeks} нед · {cycle.meta.level} · {cycle.meta.period} · корректировка {((cycle.meta.correctionPct || 0) * 100).toFixed(1)}%/нед</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>Процентки/сеты/повторения цикла не редактируются — это профессиональная методика. Ниже — ваш оверлей.</div>
              <button
                style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, marginTop: 6, minHeight: 38, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                onClick={() => {
                  if (!window.confirm('Переключиться на свой ПЛ-цикл? Процентки LMS-цикла будут отсоединены — вы сможете редактировать недели/дни/упражнения/процентки самостоятельно. Это нельзя отменить.')) return;
                  set({ sourceCycleId: null, customWeeks: [{ week: 1, phase: 'accumulation', deload: false, days: [{ name: 'День 1', exercises: [{ name: 'Присед', lift: 'squat', muscle: 'legs', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 2 }] }] }] }] });
                }}
              >✏ Переключить на свой цикл</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#ef4444' }}>⚠ Цикл не выбран. Вернитесь и подключите цикл через «🔍 ПЛ-циклы».</div>
          )}
        </div>

        <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Оверлей пользователя</div>

          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Рабочие максимумы (кг) — для расчёта весов из % цикла
            <div style={{ display: 'flex', gap: 6 }}>
              {(['squat', 'bench', 'dead'] as const).map(k => (
                <label key={k} style={{ flex: 1, fontSize: 10, color: DIM }}>
                  {k === 'squat' ? 'Присед' : k === 'bench' ? 'Жим' : 'Тяга'}
                  <input type="number" style={IN} value={body.workMax[k] ?? ''} onChange={e => set({ workMax: { ...body.workMax, [k]: parseFloat(e.target.value) || undefined } })} />
                </label>
              ))}
            </div>
          </label>

          <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Заметки к циклу
            <textarea style={{ ...IN, minHeight: 60, resize: 'vertical' }} value={body.notes} onChange={e => set({ notes: e.target.value })} placeholder="Например: акцент на слабые группы, адаптации под восстановление" />
          </label>

          <div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Слабые группы (приоритет акцента)</div>
            <WeakPointChips value={body.weakPoints} onChange={(weakPoints) => set({ weakPoints })} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Расписание: сессия → день недели</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {body.schedule.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ color: DIM, minWidth: 70 }}>Сессия {s.sessionIdx + 1}</span>
                  <select style={{ ...IN, padding: '4px 6px', fontSize: 10 }} value={s.dayOfWeek} onChange={e => { const sc = [...body.schedule]; sc[i] = { ...sc[i], dayOfWeek: parseInt(e.target.value) }; set({ schedule: sc }); }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, di) => <option key={di} value={di}>{d}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Custom PL: full editable structure ──
  const weeks = body.customWeeks ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...panelStyle('#a78bfa'), padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>
          ✏ Свой ПЛ-цикл — полное редактирование ({weeks.length} нед)
        </div>
        <div style={{ fontSize: 10, color: DIM }}>
          Все процентки, сеты, повторения и структура цикла полностью редактируемы.
        </div>
      </div>

      {/* WorkMax */}
      <div style={{ ...CARD, padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>🎯 Рабочие максимумы (кг)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['squat', 'bench', 'dead'] as const).map(k => (
            <label key={k} style={{ flex: 1, fontSize: 11, color: DIM, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {k === 'squat' ? 'Присед' : k === 'bench' ? 'Жим' : 'Тяга'}
              <input type="number" style={{ ...IN, minHeight: 38 }} value={body.workMax[k] ?? ''} onChange={e => set({ workMax: { ...body.workMax, [k]: parseFloat(e.target.value) || undefined } })} placeholder="кг" />
            </label>
          ))}
        </div>
      </div>

      {/* Слабые точки ПЛ — диагностика по движениям */}
      <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #ef4444' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>🎯 Слабые точки ПЛ-движений</div>
        {(['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'] as Lift[]).map(lift => {
          const liftLabel: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Тяга', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга блока', incline_press: 'Жим наклон' };
          const weakPoints = WEAK_POINTS_BY_LIFT[lift] ?? [];
          if (weakPoints.length === 0) return null;
          return (
            <div key={lift} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DIM_STRONG, marginBottom: 3 }}>{liftLabel[lift] ?? lift}:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {weakPoints.map((wp: WeakPoint) => {
                  const diag = diagnoseWeakPoint(lift, wp);
                  return (
                    <button
                      key={wp}
                      onClick={() => {
                        if (!weeks[0]?.days[0]) return;
                        const d0 = weeks[0].days[0];
                        const newExercises = diag.assistance.slice(0, 2).map(name => ({
                          name, lift: 'accessory' as const, muscle: lift === 'bench' || lift === 'incline_press' ? 'chest' : lift === 'squat' ? 'legs' : lift === 'deadlift' ? 'back' : lift === 'ohp' ? 'shoulders' : lift === 'row' || lift === 'pulldown' ? 'back' : 'back',
                          sets: [{ pct: diag.intensityPct, reps: 6, sets: 3, rir: 2 }],
                        }));
                        updateDay(0, 0, { exercises: [...d0.exercises, ...newExercises] });
                      }}
                      title={diag.description + '\n' + diag.rationale + '\nУпр: ' + diag.assistance.join(', ')}
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444', fontWeight: 700, minHeight: 38, textAlign: 'left', lineHeight: 1.3 }}
                    >
                      <div>{diag.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{diag.assistance.slice(0, 2).join(' · ')}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weeks */}
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>🗓 Недели ({weeks.length})</div>
      {weeks.map((w, wi) => {
        const isExp = expandedWeek === wi;
        const phaseColor = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' }[w.phase];
        return (
          <div key={wi} style={{ ...CARD, padding: 10, borderLeft: `3px solid ${phaseColor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setExpandedWeek(isExp ? null : wi)}
                style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: `1px solid ${phaseColor}44`, color: DIM_STRONG, minHeight: 38 }}
              >{isExp ? '▼' : '▶'} Неделя {w.week}</button>
              <select style={{ ...IN, padding: '4px 6px', fontSize: 11, minHeight: 38, flex: '0 0 auto' }} value={w.phase} onChange={e => updateWeek(wi, { phase: e.target.value as PLWeek['phase'] })}>
                {PHASE_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={w.deload} onChange={e => updateWeek(wi, { deload: e.target.checked })} /> deload
              </label>
              <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 38 }} onClick={() => cloneWeek(wi)} title="Клонировать">⧉</button>
              <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 38, marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeWeek(wi)}>✕ нед</button>
            </div>

            {isExp && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {w.days.map((d, di) => (
                  <div key={di} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input style={{ ...IN, padding: '5px 8px', fontSize: 11, flex: 1, minHeight: 38 }} value={d.name} onChange={e => updateDay(wi, di, { name: e.target.value })} placeholder="Название дня" />
                      <span style={{ fontSize: 10, color: DIM }}>{d.exercises.length} упр</span>
                      <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 38, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeDay(wi, di)}>✕ день</button>
                    </div>
                    {d.exercises.map((ex, ei) => (
                      <div key={ei} style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                          <ExerciseLabPicker
                            value={ex.name}
                            muscle={ex.muscle ?? ''}
                            onSelect={selected => updateExercise(wi, di, ei, { name: selected.name, muscle: selected.group || ex.muscle, lift: ex.lift })}
                          />
                          <select style={{ ...IN, padding: '4px 6px', fontSize: 11, minHeight: 38, flex: '0 0 100px' }} value={ex.lift} onChange={e => updateExercise(wi, di, ei, { lift: e.target.value as PLExercise['lift'] })}>
                            {LIFT_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                          <input style={{ ...IN, padding: '5px 8px', fontSize: 11, flex: '0 0 90px', minHeight: 38 }} value={ex.muscle ?? ''} onChange={e => updateExercise(wi, di, ei, { muscle: e.target.value })} placeholder="мышца" list="muscle-list" />
                          <input style={{ ...IN, padding: '5px 8px', fontSize: 11, flex: '1 1 100px', minHeight: 38 }} value={ex.note ?? ''} onChange={e => updateExercise(wi, di, ei, { note: e.target.value })} placeholder="заметка" />
                          <button style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 38, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => removeExercise(wi, di, ei)}>✕</button>
                        </div>
                        <PLSetEditor sets={ex.sets} lift={ex.lift} workMax={body.workMax} onChange={(sets) => updateExercise(wi, di, ei, { sets })} />
                      </div>
                    ))}
                    <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38 }} onClick={() => addExercise(wi, di)}>+ Упражнение</button>
                  </div>
                ))}
                <button style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 38 }} onClick={() => addDay(wi)}>+ День</button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...BTN_GHOST, padding: '8px 14px', fontSize: 11, minHeight: 38 }} onClick={addWeek}>+ Добавить неделю</button>
      </div>

      {/* PL ротация — упражнения старше 4 недель */}
      {(body.customWeeks?.length ?? 0) >= 4 && (() => {
        const exAge: Record<string, { weeks: number }> = {};
        for (const w of body.customWeeks ?? []) {
          for (const d of w.days) {
            for (const e of d.exercises) {
              if (!e.name) continue;
              if (!exAge[e.name]) exAge[e.name] = { weeks: 0 };
              exAge[e.name].weeks++;
            }
          }
        }
        const stale = Object.entries(exAge).filter(([, v]) => v.weeks >= 4).slice(0, 5);
        if (stale.length === 0) return null;
        return (
          <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #f59e0b' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🔄 Ротация ПЛ — устаревшие упражнения</div>
            {stale.map(([name, { weeks: age }]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10, flexWrap: 'wrap' }}>
                <span style={{ color: DIM_STRONG, fontWeight: 700 }}>{name}</span>
                <span style={{ color: '#f59e0b', fontSize: 11 }}>{age} нед</span>
                <span style={{ color: DIM, fontSize: 11 }}>— замените вручную через 🔬 лабораторию упражнений</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Оверлей для custom: заметки + слабые группы + расписание */}
      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Оверлей пользователя</div>
        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Заметки к циклу
          <textarea style={{ ...IN, minHeight: 60, resize: 'vertical' }} value={body.notes} onChange={e => set({ notes: e.target.value })} placeholder="Например: акцент на слабые группы, адаптации под восстановление" />
        </label>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Слабые группы (приоритет акцента)</div>
          <WeakPointChips value={body.weakPoints} onChange={(weakPoints) => set({ weakPoints })} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Расписание: сессия → день недели</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {body.schedule.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: DIM, minWidth: 70 }}>Сессия {s.sessionIdx + 1}</span>
                <select style={{ ...IN, padding: '4px 6px', fontSize: 10, minHeight: 38 }} value={s.dayOfWeek} onChange={e => { const sc = [...body.schedule]; sc[i] = { ...sc[i], dayOfWeek: parseInt(e.target.value) }; set({ schedule: sc }); }}>
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, di) => <option key={di} value={di}>{d}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const WEAK_OPTS = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'traps', 'forearms', 'core', 'arms'];
const WeakPointChips: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {WEAK_OPTS.map(m => {
        const on = value.includes(m);
        return <button key={m} onClick={() => toggle(m)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: on ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.02)', color: on ? '#fff' : DIM, minHeight: 38 }}>{GROUP_RU[m] ?? m}</button>;
      })}
    </div>
  );
};

/* ─── P2.11: BBConstraintsPanel — редактирование constraints (оборудование, травмы, avoidAxial, любимые/исключённые) + progression ─── */

const EQUIPMENT_OPTS = [
  { id: 'barbell', label: 'Штанга' }, { id: 'dumbbell', label: 'Гантели' }, { id: 'cable', label: 'Блок' },
  { id: 'machine', label: 'Тренажёр' }, { id: 'bodyweight', label: 'Свой вес' }, { id: 'suspension', label: 'TRX/петли' },
  { id: 'kettlebell', label: 'Гиря' }, { id: 'band', label: 'Резина' }, { id: 'smith', label: 'Смит' }, { id: 'plate', label: 'Блин' },
];
const LOAD_STRATEGY_OPTS = [
  { id: 'double_progression', label: 'Двойная прогрессия' }, { id: 'linear', label: 'Линейная' },
  { id: 'wave', label: 'Волновая' }, { id: 'rpe_based', label: 'По RPE' },
];
const DELOAD_PROTOCOL_OPTS = [
  { id: 'pump', label: 'Памп' }, { id: 'neural', label: 'Нейральная' },
  { id: 'full_rest', label: 'Полный отдых' }, { id: 'mini', label: 'Микро-делод' },
];
const INTENSITY_TECHNIQUE_OPTS = [
  { id: 'none', label: 'Нет' }, { id: 'rest_pause', label: 'Рест-пауза' }, { id: 'drop_set', label: 'Дроп-сет' },
  { id: 'myo_reps', label: 'Мио-репс' }, { id: 'pause_rep', label: 'Пауза' }, { id: 'mechanical_drop', label: 'Мех. дроп' },
];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; color?: string }> = ({ active, onClick, children, color }) => (
  <button onClick={onClick} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: active ? '1px solid ' + (color || '#00e68a') : '1px solid rgba(255,255,255,0.08)', background: active ? (color || '#00e68a') + '20' : 'rgba(255,255,255,0.02)', color: active ? '#fff' : DIM, minHeight: 38 }}>{children}</button>
);

const BBConstraintsPanel: React.FC<{
  constraints: ProgramConstraints;
  progression: ProgramProgression;
  onChangeConstraints: (c: ProgramConstraints) => void;
  onChangeProgression: (p: ProgramProgression) => void;
}> = ({ constraints, progression, onChangeConstraints, onChangeProgression }) => {
  const toggleEq = (eq: string) => {
    const arr = constraints.equipment ?? [];
    onChangeConstraints({ ...constraints, equipment: arr.includes(eq) ? arr.filter(x => x !== eq) : [...arr, eq] });
  };
  const toggleIntensity = (it: any) => {
    const arr: any[] = (progression.intensityTechniques as any[]) ?? ['none'];
    if (it === 'none') onChangeProgression({ ...progression, intensityTechniques: ['none'] as any });
    else onChangeProgression({ ...progression, intensityTechniques: (arr.includes(it) ? arr.filter(x => x !== it && x !== 'none') : [...arr.filter(x => x !== 'none'), it]) as any });
  };
  return (
    <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>⚙️ Параметры ББ-программы</div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Оборудование (доступное)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {EQUIPMENT_OPTS.map(o => <Chip key={o.id} active={(constraints.equipment ?? []).includes(o.id)} onClick={() => toggleEq(o.id)}>{o.label}</Chip>)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Прогрессия весов</div>
        <select style={IN} value={progression.loadStrategy || 'double_progression'} onChange={e => onChangeProgression({ ...progression, loadStrategy: e.target.value as any })}>
          {LOAD_STRATEGY_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Протокол делода</div>
        <select style={IN} value={progression.deloadProtocol || 'pump'} onChange={e => onChangeProgression({ ...progression, deloadProtocol: e.target.value as any })}>
          {DELOAD_PROTOCOL_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>Интенсив-техники</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {INTENSITY_TECHNIQUE_OPTS.map(o => <Chip key={o.id} active={((progression.intensityTechniques as any[]) ?? ['none']).includes(o.id as any)} onClick={() => toggleIntensity(o.id)}>{o.label}</Chip>)}
        </div>
      </div>
      <label style={{ ...SMALL, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={constraints.avoidAxialLoad ?? false} onChange={e => onChangeConstraints({ ...constraints, avoidAxialLoad: e.target.checked })} />
        🦴 Убрать осевую нагрузку (присед/становая/жим стоя)
      </label>
    </div>
  );
};

export { BBEditor, SessionList, BlockList, SetEditor, PLEditor, WeakPointChips, BBConstraintsPanel };
