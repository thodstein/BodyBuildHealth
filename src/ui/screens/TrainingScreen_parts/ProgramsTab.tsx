import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateWarmup } from '../../../engines/warmup.engine';
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
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';

import {
  GOAL_FILTER_OPTIONS, WOMENS_PROGRAMS, CUSTOM_PROGRAMS,
  PROGRAM_LEVEL_MAP, PROGRAM_GOAL_MAP, PROGRAM_EQUIP_MAP,
} from './programs-data';

export const ProgramsTab: React.FC<{ selectedProgram: string | null; setSelectedProgram: (id: string | null) => void; onAddToMyTraining?: (exercises: { name: string; sets: number; reps: number; rir: number }[]) => void }> = ({ selectedProgram: selectedId, setSelectedProgram: setSelectedId, onAddToMyTraining }) => {
  const [goalFilter, setGoalFilter] = React.useState('all');
  const [levelFilter, setLevelFilter] = React.useState('all');
  const [detailWeek, setDetailWeek] = React.useState(1);
  const [expandedDay, setExpandedDay] = React.useState<number | null>(null);

  const allPrograms = React.useMemo(() => [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS], []);
  const programs = React.useMemo(() => {
    let filtered = allPrograms;
    if (goalFilter === 'women') filtered = WOMENS_PROGRAMS;
    else if (goalFilter === 'custom') filtered = CUSTOM_PROGRAMS;
    else if (goalFilter !== 'all') filtered = allPrograms.filter(p => p.goal === goalFilter);
    if (levelFilter !== 'all') filtered = filtered.filter(p => p.level === levelFilter);
    return filtered;
  }, [goalFilter, levelFilter, allPrograms]);
  const selected = selectedId ? allPrograms.find(p => p.id === selectedId) || null : null;

  const [loadedMsg, setLoadedMsg] = useState('');
  const [myProgMsg, setMyProgMsg] = useState('');
  const [myTrainingMsg, setMyTrainingMsg] = useState('');
  const handleLoadProgram = () => {
    if (!selected) return;
    try {
      const prog = {
        id: selected.id, name: selected.name, goal: selected.goal, level: selected.level,
        daysPerWeek: selected.daysPerWeek, durationWeeks: selected.durationWeeks,
        description: selected.description, weeks: selected.weeks,
        loadedAt: new Date().toISOString(),
      };
      localStorage.setItem('activeProgram', JSON.stringify(prog));
      setLoadedMsg('✅ Программа загружена!');
      setTimeout(() => setLoadedMsg(''), 3000);
    } catch {}
  };

  const handleSaveToMyPrograms = () => {
    if (!selected) return;
    try {
      const exercises = selected.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => ({
        name: e.name, sets: e.sets, reps: parseInt(e.reps) || 10, rir: e.rir ?? 2,
      }))));
      const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
      existing.push({ id: 'prog_' + Date.now(), name: selected.name, date: new Date().toISOString(), exercises });
      localStorage.setItem('myTrainingPlans', JSON.stringify(existing));
      setMyProgMsg('✅ Добавлено в «Мои программы»!');
      setTimeout(() => setMyProgMsg(''), 3000);
    } catch {}
  };

  const handleAddToMyTraining = () => {
    if (!selected || !onAddToMyTraining) return;
    try {
      const exercises = selected.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => ({
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
            padding: '6px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            background: goalFilter === g.value ? 'var(--accent)' : 'var(--bg-secondary)',
            color: goalFilter === g.value ? '#000' : 'var(--text-dim)', border: 'none',
            fontWeight: goalFilter === g.value ? 600 : 400,
          }}>{g.label}</button>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>Уровень:</span>
      {[{v:'all',l:'Все'},{v:'beginner',l:'Начинающий'},{v:'intermediate',l:'Средний'},{v:'advanced',l:'Продвинутый'},{v:'enhanced',l:'Enhanced'}].map(l => (
        <button key={l.v} onClick={() => { setLevelFilter(l.v); setSelectedId(null); }}
          style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
            background: levelFilter === l.v ? 'var(--accent)' : 'var(--bg-secondary)',
            color: levelFilter === l.v ? '#000' : 'var(--text-dim)', border: 'none',
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
              background: 'rgba(24,24,27,0.12)', border: '1px solid var(--glass-border)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600 }}>
                {PROGRAM_GOAL_MAP[p.goal] || p.goal}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{p.description}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-light)' }}>
              <span>Автор: <b>{p.author}</b></span>
              <span>Уровень: <b style={{ color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[p.level] || p.level}</b></span>
              <span>{p.daysPerWeek} дн/нед</span>
              <span>{p.durationWeeks} нед</span>
            </div>
          </div>
        ))}
      </div>
    )}

    {selected && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setSelectedId(null)}
          style={{
            alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
            cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 11,
          }}>← К списку</button>

        <div style={{
          padding: 14, borderRadius: 14, background: 'rgba(24,24,27,0.12)',
          border: '1px solid var(--glass-border)',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>{selected.name}</h3>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px' }}>{selected.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, marginBottom: 8 }}>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Уровень</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[selected.level] || selected.level}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Цель</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_GOAL_MAP[selected.goal] || selected.goal}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Дней/нед</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{selected.daysPerWeek}</div>
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>
            <b>Снаряжение:</b> {selected.equipmentNeeded.map(e => PROGRAM_EQUIP_MAP[e] || e).join(', ')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>
            <b>Прогрессия:</b> {selected.progressionModel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 8 }}>
            <b>Разгрузка:</b> {selected.deloadProtocol}
          </div>
          {selected.warnings.length > 0 && (
            <div style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {selected.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <b>Ожидаемый результат:</b> {selected.expectedResults}
          </div>

          <button onClick={handleLoadProgram}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, marginBottom: 10,
            }}>
            📋 Загрузить программу
          </button>
          <button onClick={handleSaveToMyPrograms}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--accent)', cursor: 'pointer',
              background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, marginBottom: 6,
            }}>
            📋 В мои программы
          </button>
          <button onClick={handleAddToMyTraining}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: '1px solid #8b5cf6', cursor: 'pointer',
              background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: 700, fontSize: 12, marginBottom: 6,
            }}>
            ⭐ В мою тренировку
          </button>
          {loadedMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(0,230,138,0.1)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a', fontSize:10, marginBottom:6, textAlign:'center' }}>{loadedMsg}</div>}
          {myProgMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontSize:10, marginBottom:6, textAlign:'center' }}>{myProgMsg}</div>}
          {myTrainingMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.3)', color:'#ffd700', fontSize:10, marginBottom:6, textAlign:'center' }}>{myTrainingMsg}</div>}

          {/* Week-by-week detail */}
          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text)' }}>Программа по неделям</h4>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {selected.weeks.map((w, i) => (
              <button key={i} onClick={() => setDetailWeek(i + 1)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                  background: detailWeek === i + 1 ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
                  border: detailWeek === i + 1 ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: detailWeek === i + 1 ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: detailWeek === i + 1 ? 600 : 400,
                }}>
                Нед {w.week}{w.deload ? ' 🟢' : ''}
              </button>
            ))}
          </div>

          {selected.weeks[detailWeek - 1] && (() => {
            const wk = selected.weeks[detailWeek - 1];
            const DAY_NAMES = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
            const dayMap: Record<number, typeof wk.days[0]> = {};
            wk.days.forEach(d => { dayMap[d.day] = d; });
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                  Фаза: <b>{PHASE_LABELS[wk.phase] || wk.phase}</b> | Объём: {wk.volumeMultiplier}× | Интенсивность: {wk.intensityMultiplier}×
                  {wk.deload ? ' | 🟢 Разгрузка' : ''}
                </div>
                {/* Visual weekly calendar */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', margin: '4px 0 6px' }}>
                  📅 Неделя {wk.week}
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3,
                  borderRadius: 10, overflow: 'hidden',
                  border: '1px solid var(--glass-border)',
                }}>
                  {/* Day headers */}
                  {DAY_NAMES.map((dn, i) => (
                    <div key={`hdr-${i}`} style={{
                      padding: '6px 2px', textAlign: 'center',
                      background: 'rgba(0,230,138,0.08)',
                      fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                      borderBottom: '1px solid var(--glass-border)',
                    }}>{dn}</div>
                  ))}
                  {/* Day cells */}
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
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.5 }}>Отдых</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>
                              {day.focus || day.name}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--accent)', marginTop: 1 }}>
                              {day.exercises.length} упр
                            </span>
                            {day.day && (
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
                                День {day.day}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Expanded day detail */}
                {expandedDay !== null && dayMap[expandedDay] && (() => {
                  const day = dayMap[expandedDay];
                  return (
                    <div style={{
                      padding: 10, marginTop: 4, borderRadius: 10,
                      background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)' }}>
                          {DAY_NAMES[expandedDay - 1]} — День {day.day}: {day.name}
                        </div>
                        <button onClick={() => setExpandedDay(null)} style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--text-dim)',
                        }}>✕</button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
                        {day.focus} · Разминка: {day.warmup} · Заминка: {day.cooldown}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, marginBottom: 2, fontSize: 10, color: 'var(--text-dim)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ flex: 1 }}>Упражнение</span>
                        <span style={{ minWidth: 50, textAlign: 'center' }}>Подходы</span>
                        <span style={{ minWidth: 35, textAlign: 'center' }}>RPE</span>
                        <span style={{ minWidth: 30, textAlign: 'center' }}>RIR</span>
                        <span style={{ minWidth: 35, textAlign: 'center' }}>Отдых</span>
                      </div>
                      {day.exercises.map((ex, ei) => (
                        <div key={ei} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                          borderRadius: 6, marginBottom: 2, background: 'rgba(255,255,255,0.03)',
                          fontSize: 10,
                        }}>
                          <span style={{ flex: 1, fontWeight: 600 }}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)' }}>{ex.sets}×{ex.reps}</span>
                          <span style={{ color: 'var(--text-dim)' }}>RPE {ex.rpe}</span>
                          <span style={{ color: 'var(--text-dim)' }}>RIR {ex.rir}</span>
                          <span style={{ color: 'var(--text-dim)' }}>Отд {ex.restSec}с</span>
                          {ex.notes ? <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ex.notes}</span> : null}
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
