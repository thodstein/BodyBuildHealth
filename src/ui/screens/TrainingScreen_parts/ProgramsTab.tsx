import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateCooldown } from '../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { useDataLink } from '../../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../../engines/analytics-engine';
import { computeConstraints } from '../../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY, type FullProgram } from '../../../engines/complete-program-library.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import {
  GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';

import {
  GOAL_FILTER_OPTIONS, WOMENS_PROGRAMS, CUSTOM_PROGRAMS, ORIGINAL_PROGRAMS,
  PROGRAM_LEVEL_MAP, PROGRAM_GOAL_MAP, PROGRAM_EQUIP_MAP,
} from './programs-data';
import { applyToPlanner } from './planner-bridge';
import { programToCycleTemplate } from '../../../engines/bb/cycle-to-plan';
import { useOriginalPrograms } from './useOriginalPrograms';

export const ProgramsTab: React.FC<{
  selectedProgram: string | null; setSelectedProgram: (id: string | null) => void;
  onAddToMyTraining?: (exercises: { name: string; sets: number; reps: number; rir: number }[]) => void;
  onLoadToConstructor?: (program: { name: string; exercises: { name: string; sets: number; reps: number; rir: number }[] }) => void;
  goPlannerManual?: () => void;
}> = ({ selectedProgram: selectedId, setSelectedProgram: setSelectedId, onAddToMyTraining, onLoadToConstructor, goPlannerManual }) => {
  const [goalFilter, setGoalFilter] = React.useState('all');
  const [levelFilter, setLevelFilter] = React.useState('all');
  const [detailWeek, setDetailWeek] = React.useState(1);
  const [expandedDay, setExpandedDay] = React.useState<number | null>(null);

  const originalPrograms = useOriginalPrograms();
  const allPrograms = React.useMemo<FullProgram[]>(() => [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS, ...originalPrograms], [originalPrograms]);
  const programs = React.useMemo(() => {
    let filtered = allPrograms;
    if (goalFilter === 'women') filtered = WOMENS_PROGRAMS;
    else if (goalFilter === 'custom') filtered = [...CUSTOM_PROGRAMS, ...originalPrograms];
    else if (goalFilter !== 'all') filtered = allPrograms.filter(p => p.goal === goalFilter);
    if (levelFilter !== 'all') filtered = filtered.filter(p => p.level === levelFilter);
    return filtered;
  }, [goalFilter, levelFilter, allPrograms, originalPrograms]);
  const selected = selectedId ? allPrograms.find(p => p.id === selectedId) || null : null;
  const expandedSelected = selected;

  const handleLoadToConstructor = () => {
    if (!expandedSelected || !onLoadToConstructor) return;
    const exercises = expandedSelected.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => ({
      name: e.name, sets: e.sets, reps: parseInt(String(e.reps), 10) || 10, rir: e.rir ?? 2,
    }))));
    onLoadToConstructor({ name: expandedSelected.name, exercises });
    if (goPlannerManual) goPlannerManual();
    setLoadedMsg('✅ Загружено в конструктор!');
    setTimeout(() => setLoadedMsg(''), 3000);
  };

  const [loadedMsg, setLoadedMsg] = useState('');
  const [myProgMsg, setMyProgMsg] = useState('');
  const [myTrainingMsg, setMyTrainingMsg] = useState('');
  const [bbMsg, setBbMsg] = useState('');
  const handleSendToBbAuto = () => {
    if (!expandedSelected) return;
    try {
      const cycleTpl = programToCycleTemplate(expandedSelected);
      applyToPlanner({ kind: 'program', label: expandedSelected.name, data: cycleTpl as any });
      setBbMsg('✅ Отправлено в ББ-авто! Перейдите в Планировщик → ББ-авто.');
      setTimeout(() => setBbMsg(''), 4000);
    } catch (e: any) {
      setBbMsg('❌ Ошибка конвертации: ' + (e?.message || String(e)));
      setTimeout(() => setBbMsg(''), 4000);
    }
  };
  const handleLoadProgram = () => {
    if (!expandedSelected) return;
    try {
      const prog = {
        id: expandedSelected.id, name: expandedSelected.name, goal: expandedSelected.goal, level: expandedSelected.level,
        daysPerНеделя: expandedSelected.daysPerWeek, durationWeeks: expandedSelected.durationWeeks,
        description: expandedSelected.description, weeks: expandedSelected.weeks,
        loadedAt: new Date().toISOString(),
      };
      localStorage.setItem('activeProgram', JSON.stringify(prog));
      setLoadedMsg('✅ Программа загружена!');
      setTimeout(() => setLoadedMsg(''), 3000);
    } catch {}
  };

  const handleSaveToMyPrograms = () => {
    if (!expandedSelected) return;
    try {
      const exercises = expandedSelected.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => ({
        name: e.name, sets: e.sets, reps: parseInt(e.reps) || 10, rir: e.rir ?? 2,
      }))));
      const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
      existing.push({ id: 'prog_' + Date.now(), name: expandedSelected.name, date: new Date().toISOString(), exercises });
      localStorage.setItem('myTrainingPlans', JSON.stringify(existing));
      setMyProgMsg('✅ Добавлено в «Мои программы»!');
      setTimeout(() => setMyProgMsg(''), 3000);
    } catch {}
  };

  const handleAddToMyTraining = () => {
    if (!expandedSelected || !onAddToMyTraining) return;
    try {
      const exercises = expandedSelected.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => ({
        name: e.name, sets: e.sets, reps: parseInt(e.reps) || 10, rir: e.rir ?? 2,
      }))));
      onAddToMyTraining(exercises);
      setMyTrainingMsg('✅ Добавлено в «Моя тренировка»!');
      setTimeout(() => setMyTrainingMsg(''), 3000);
    } catch {}
  };

  return (<div>
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
      {GOAL_FILTER_OPTIONS.map(g => (
        <button key={g.value} onClick={() => { setGoalFilter(g.value); setSelectedId(null); }}
          style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', minHeight: 38,
            background: goalFilter === g.value ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
            color: goalFilter === g.value ? '#000' : '#fff', border: 'none',
            fontWeight: goalFilter === g.value ? 600 : 400,
          }}>{g.label}</button>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: '#fff', alignSelf: 'center' }}>Уровень:</span>
      {[{v:'all',l:'Все'},{v:'beginner',l:'Начинающий'},{v:'intermediate',l:'Средний'},{v:'advanced',l:'Продвинутый'},{v:'enhanced',l:'Enhanced'}].map(l => (
        <button key={l.v} onClick={() => { setLevelFilter(l.v); setSelectedId(null); }}
          style={{
            padding: '6px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer', minHeight: 38,
            background: levelFilter === l.v ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
            color: levelFilter === l.v ? '#000' : '#fff', border: 'none',
            fontWeight: levelFilter === l.v ? 600 : 400,
          }}>{l.l}</button>
      ))}
    </div>

    {!selected && (
      <div style={{ display: 'grid', gap: 8 }}>
        {programs.map(p => (
          <div key={p.id} onClick={() => setSelectedId(p.id)}
            style={{
              padding: 12, borderRadius: 14, cursor: 'pointer',
              background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' as any,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{p.name}</div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600 }}>
                {PROGRAM_GOAL_MAP[p.goal] || p.goal}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>{p.description}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#fff', flexWrap: 'wrap' }}>
              <span>Автор: <b>{p.author}</b></span>
              <span>Уровень: <b style={{ color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[p.level] || p.level}</b></span>
                <span>{p.daysPerWeek} дн/нед</span>
              <span>{p.durationWeeks} нед</span>
            </div>
          </div>
        ))}
      </div>
    )}

    {expandedSelected && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setSelectedId(null)}
          style={{
            alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12,
            minHeight: 38,
          }}>← К списку</button>

        <div style={{
          padding: 14, borderRadius: 14, background: 'rgba(24,24,27,0.42)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#fff' }}>{expandedSelected.name}</h3>
          <p style={{ fontSize: 11, color: '#fff', margin: '0 0 8px' }}>{expandedSelected.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 11 }}>Уровень</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[expandedSelected.level] || expandedSelected.level}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 11 }}>Цель</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_GOAL_MAP[expandedSelected.goal] || expandedSelected.goal}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 11 }}>Дней/нед</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{expandedSelected.daysPerWeek} ({expandedSelected.durationWeeks} нед)</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}>
            <b>Снаряжение:</b> {expandedSelected.equipmentNeeded.map(e => PROGRAM_EQUIP_MAP[e] || e).join(', ')}
          </div>
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}>
            <b>Прогрессия:</b> {expandedSelected.progressionModel}
          </div>
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 8 }}>
            <b>Разгрузка:</b> {expandedSelected.deloadProtocol}
          </div>
          {expandedSelected.warnings.length > 0 && (
            <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {expandedSelected.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--accent)', background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <b>Ожидаемый результат:</b> {expandedSelected.expectedResults}
          </div>

          <button onClick={handleLoadProgram}
            style={{
              width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 13, marginBottom: 6,
              minHeight: 44,
            }}>
            📋 Загрузить программу
          </button>
          {onLoadToConstructor && (
            <button onClick={handleLoadToConstructor}
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: '1px solid #8b5cf6', cursor: 'pointer',
                background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: 700, fontSize: 13, marginBottom: 6,
                minHeight: 44,
              }}>
              📥 Загрузить в конструктор (все {expandedSelected.weeks.length} нед)
            </button>
          )}
          <button onClick={handleSaveToMyPrograms}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--accent)', cursor: 'pointer',
              background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, marginBottom: 6,
              minHeight: 44,
            }}>
            📋 В мои программы
          </button>
          <button onClick={handleAddToMyTraining}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: '1px solid #8b5cf6', cursor: 'pointer',
              background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: 700, fontSize: 12, marginBottom: 6,
              minHeight: 38,
            }}>
            ⭐ В мою тренировку
          </button>
          {/* Кнопка "В ББ-авто" — только для BB/hypertrophy программ (не ПЛ!) */}
          {(expandedSelected.goal === 'hypertrophy' || expandedSelected.goal === 'bodybuilding' || expandedSelected.direction === 'bodybuilding' || expandedSelected.goal === 'athletic') && (
            <button onClick={handleSendToBbAuto}
              style={{
                width: '100%', padding: 10, borderRadius: 10, border: '1px solid #00e68a', cursor: 'pointer',
                background: 'rgba(0,230,138,0.08)', color: '#00e68a', fontWeight: 700, fontSize: 12, marginBottom: 6,
                minHeight: 38,
              }}>
              📥 В ББ-авто (с PED/делод/техниками)
            </button>
          )}
          {(expandedSelected.goal === 'strength' || expandedSelected.goal === 'powerlifting' || expandedSelected.direction === 'strength') && (
            <div style={{ width:'100%', padding:10, borderRadius:10, border:'1px solid rgba(245,158,11,0.2)', background:'rgba(245,158,11,0.06)', color:'#f59e0b', fontWeight:600, fontSize:11, marginBottom:6, textAlign:'center' }}>
              ⚠ Это силовая программа — используйте ПЛ-авто (Планировщик → ПЛ-авто)
            </div>
          )}
          {bbMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontSize:11, marginBottom:6, textAlign:'center' }}>{bbMsg}</div>}
          {loadedMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontSize:11, marginBottom:6, textAlign:'center' }}>{loadedMsg}</div>}
          {myProgMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontSize:11, marginBottom:6, textAlign:'center' }}>{myProgMsg}</div>}
          {myTrainingMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.3)', color:'#ffd700', fontSize:11, marginBottom:6, textAlign:'center' }}>{myTrainingMsg}</div>}

          {/* Неделя-by-week detail */}
          <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#fff' }}>
            Программа по неделям ({expandedSelected.weeks.length} из {expandedSelected.durationWeeks} нед{expandedSelected.weeks.length >= expandedSelected.durationWeeks ? ' ✅' : ' ⚠️'})
          </h4>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {expandedSelected.weeks.map((w, i) => (
              <button key={i} onClick={() => setDetailWeek(i + 1)}
                style={{
                  padding: '6px 12px', borderRadius: 12, fontSize: 12, cursor: 'pointer', minWidth: 44, minHeight: 38,
                  background: detailWeek === i + 1 ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)',
                  border: detailWeek === i + 1 ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  color: detailWeek === i + 1 ? 'var(--accent)' : '#fff',
                  fontWeight: detailWeek === i + 1 ? 600 : 400,
                }}>
                Нед {w.week}{w.deload ? ' 🟢' : ''}
              </button>
            ))}
          </div>

          {expandedSelected.weeks[detailWeek - 1] && (() => {
            const wk = expandedSelected.weeks[detailWeek - 1];
            const DAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
            const dayMap: Record<number, typeof wk.days[0]> = {};
            wk.days.forEach(d => { dayMap[d.day] = d; });
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#fff', marginBottom: 2 }}>
                  Фаза: <b>{PHASE_LABELS[wk.phase] || wk.phase}</b> | Объём: ×{wk.volumeMultiplier} | Интенсивность: ×{wk.intensityMultiplier}
                  {wk.deload ? ' | 🟢 Разгрузка' : ''}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', margin: '4px 0 6px' }}>
                  📅 Неделя {wk.week}
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3,
                  borderRadius: 10, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {DAY_NAMES.map((dn, i) => (
                    <div key={`hdr-${i}`} style={{
                      padding: '6px 2px', textAlign: 'center',
                      background: 'rgba(0,230,138,0.08)',
                      fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}>{dn}</div>
                  ))}
                  {DAY_NAMES.map((_, i) => {
                    const dayNum = i + 1;
                    const day = dayMap[dayNum];
                    const isRest = !day;
                    const isExpanded = expandedDay === dayNum;
                    return (
                      <div key={`day-${i}`} onClick={() => day && setExpandedDay(isExpanded ? null : dayNum)}
                        style={{
                          padding: isRest ? '10px 4px' : '8px 4px',
                          textAlign: 'center',
                          cursor: day ? 'pointer' : 'default',
                          background: isExpanded ? 'rgba(0,230,138,0.1)' : isRest ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                          border: isExpanded ? '1px solid var(--accent)' : '1px solid transparent',
                          borderRadius: isExpanded ? 4 : 0,
                          transition: 'background 0.2s',
                          minHeight: 50,
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}
                      >
                        {isRest ? (
                          <span style={{ fontSize: 11, color: '#fff', opacity: 0.5 }}>Отдых</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                              {day.focus || day.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>
                              {day.exercises.length} упр
                            </span>
                            {day.day && (
                              <span style={{ fontSize: 11, color: '#fff', marginTop: 1 }}>
                                День {day.day}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {expandedDay !== null && dayMap[expandedDay] && (() => {
                  const day = dayMap[expandedDay];
                  return (
                    <div style={{
                      padding: 10, marginTop: 4, borderRadius: 10,
                      background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                          {DAY_NAMES[expandedDay - 1]} — День {day.day}: {day.name}
                        </div>
                        <button onClick={() => setExpandedDay(null)} style={{
                          padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                          color: '#fff', minHeight: 38,
                        }}>✕</button>
                      </div>
                      <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>
                        {day.focus} · Разминка: {day.warmup} · Заминка: {day.cooldown}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 52px 52px 58px', gap: 6, padding: '2px 8px', borderRadius: 4, marginBottom: 2, fontSize: 11, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span>Упражнение</span>
                        <span style={{ textAlign: 'center' }}>Подходы</span>
                        <span style={{ textAlign: 'center' }}>RPE</span>
                        <span style={{ textAlign: 'center' }}>RIR</span>
                        <span style={{ textAlign: 'center' }}>Отдых</span>
                      </div>
                      {day.exercises.map((ex, ei) => (
                        <div key={ei} style={{
                          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 52px 52px 58px', gap: 6, alignItems: 'start', padding: '6px 8px',
                          borderRadius: 6, marginBottom: 2, background: 'rgba(255,255,255,0.03)',
                          fontSize: 11,
                        }}>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'normal', fontWeight: 600 }}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)', fontSize: 11, textAlign: 'center', whiteSpace: 'normal' }}>{ex.sets}×{ex.reps}</span>
                          <span style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>RPE {ex.rpe}</span>
                          <span style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>RIR {ex.rir}</span>
                          <span style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>{ex.restSec}с</span>
                          {ex.notes ? <span style={{ gridColumn: '1 / -1', minWidth: 0, color: '#fff', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{ex.notes}</span> : null}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      </div>
    )}
  </div>);
};
