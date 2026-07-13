import React, { useState, useMemo, useEffect } from 'react';

import { calcTraining, EXERCISE_DB, getAvailableSplits, replaceExercise, calcExercisePrescription, canReplace, getSubstitutes } from '../../engines/training.engine';

import { EXERCISE_CATALOG, getExercisesByGroup, getExerciseById } from '../../core/exercise-catalog';

import { calcReadiness } from '../../engines/readiness.engine';

import { getProfile } from '../../core/profile-manager';

import { useDataLink, derivePAL } from '../../core/data-link';

import { generateMacrocycle, getAvailableSplits as getPeriodizationSplits, adaptWeekForReadiness, MESOCYCLE_PARAMS } from '../../engines/training-periodization.engine';

import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';

import { selectProgressionRule, calcSuggestedWeight, estimate1RM, getDeloadRecommendation, PROGRESSION_RULES } from '../../engines/progression.engine';

import type { TrainingInput, TrainingOutput, ReadinessInput, ReadinessScores, Exercise } from '../../core/types';

import type { MacrocyclePlan, Microcycle } from '../../engines/training-periodization.engine';



const GOALS = [

  { value: 'bulk', label: 'Масса' },

  { value: 'cut', label: 'Сушка' },

  { value: 'maintenance', label: 'Поддержка' },

  { value: 'strength', label: 'Сила' },

  { value: 'recomp', label: 'Реcomp' },

  { value: 'rehab', label: 'Реабилитация' },

] as const;



const LEVELS = [

  { value: 'beginner', label: 'Новичок' },

  { value: 'intermediate', label: 'Средний' },

  { value: 'advanced', label: 'Продвинутый' },

  { value: 'enhanced', label: 'Enhanced' },

] as const;



const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;



const GROUP_LABELS: Record<string, string> = {

  chest: '', back: '', legs: '', shoulders: '', arms: '', core: '',

};



const RIR_TABLE: Record<string, Record<string, [number, number]>> = {

  strength: { beginner: [3, 4], intermediate: [2, 3], advanced: [1, 2], enhanced: [1, 2] },

  hypertrophy: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [0, 1] },

  bulk: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [0, 1] },

  cut: { beginner: [2, 3], intermediate: [2, 3], advanced: [1, 2], enhanced: [1, 2] },

  maintenance: { beginner: [2, 3], intermediate: [2, 3], advanced: [2, 3], enhanced: [2, 3] },

  recomp: { beginner: [2, 3], intermediate: [1, 2], advanced: [1, 2], enhanced: [1, 2] },

  rehab: { beginner: [3, 5], intermediate: [3, 4], advanced: [3, 4], enhanced: [2, 3] },

  endurance: { beginner: [3, 4], intermediate: [2, 3], advanced: [2, 3], enhanced: [1, 2] },

};



function getRIR(goal: string, level: string, isDeload: boolean): string {

  if (isDeload) return '3-5';

  const goalMap = RIR_TABLE[goal] || RIR_TABLE.maintenance;

  const range = goalMap[level] || goalMap.intermediate;

  return `${range[0]}-${range[1]}`;

}



function getSplitRationale(goal: string, level: string, daysPerWeek: number, recovery: number, weakPoints: string[]): string[] {

  const reasons: string[] = [];

  if (daysPerWeek <= 3) reasons.push(`${daysPerWeek} дней/нед → фуллбоди или Верх/Низ сплит для частоты каждой группы ≥2×`);

  else if (daysPerWeek === 4) reasons.push(`${daysPerWeek} дня → оптимально Верх/Низ для гипертрофии (каждая группа 2×/нед)`);

  else if (daysPerWeek === 5) reasons.push(`${daysPerWeek} дней → PPL + акцент или бро-сплит для специализации`);

  else reasons.push(`${daysPerWeek} дней → PPL дважды для максимального объёма и частоты`);



  if (weakPoints.length > 0) reasons.push(``);

  if (recovery < 55) reasons.push(``);

  if (goal === 'strength') reasons.push('');

  if (goal === 'cut') reasons.push('');

  if (level === 'enhanced') reasons.push('');

  return reasons;

}



const SPLIT_LABELS: Record<string, string> = { chest: '', back: '', legs: '', shoulders: '', arms: '', core: '' };



function formatSplitGroups(groupsPerDay: string[][]): string {

  return groupsPerDay.map(day => day.map(g => SPLIT_LABELS[g] || g).join('+')).join(' / ');

}



function buildDayPlan(result: TrainingOutput, daysPerWeek: number, weakPoints: string[] = [], splitGroups?: string[][], weekNum: number = 0): { day: number; name: string; exercises: Exercise[] }[] {

  const days: { day: number; name: string; exercises: Exercise[] }[] = [];

  const groups = Object.keys(result.volumePerGroup);

  const isDeload = result.isDeload;



  for (let d = 0; d < daysPerWeek; d++) {

    const dayGroups: string[] = [];

    if (splitGroups && splitGroups[d]) {

      dayGroups.push(...splitGroups[d]);

    } else if (daysPerWeek <= 3) {

      dayGroups.push(...groups);

    } else if (daysPerWeek === 4) {

      dayGroups.push(...(d % 2 === 0 ? ['chest', 'shoulders', 'arms'] : ['back', 'legs', 'core']));

    } else if (daysPerWeek === 5) {

      const map5: string[][] = [['chest'], ['back'], ['legs'], ['shoulders', 'arms'], ['core', 'arms']];

      dayGroups.push(...(map5[d] || groups));

    } else {

      const map6: string[][] = [['chest', 'triceps'], ['back', 'biceps'], ['legs'], ['shoulders', 'arms'], ['chest', 'back'], ['legs', 'core']];

      dayGroups.push(...(map6[d] || groups));

    }



    const exercises: Exercise[] = [];

    for (const g of dayGroups) {

      const vol = result.volumePerGroup[g] || 0;

      if (vol <= 0) continue;

      const sets = Math.max(2, Math.round(vol / 3));

      const avail = getExercisesByGroup(g);

      const filtered = avail.filter(e => !(isDeload && e.fatigueCost > 5));

      const maxPicks = Math.min(3, Math.ceil(sets / 3));

      const rotationOffset = (weekNum * 2 + d) % Math.max(1, filtered.length - maxPicks + 1);

      const picked = filtered.slice(rotationOffset, rotationOffset + maxPicks).sort((a, b) => (a.order ?? 2) - (b.order ?? 2));

      for (const ex of picked) {

        const setsForEx = picked.length === 1 ? sets : Math.max(2, Math.round(picked.length > 0 ? sets / picked.length : 0));

        const rirStr = result.rir;

        const rirVal = parseInt(rirStr.split('-')[0], 10) || 2;

        const presc = calcExercisePrescription(ex, result.splitName.includes('') ? 'strength' : 'hypertrophy', 'intermediate', weakPoints.includes(g), isDeload, 1.0);

        const dropPct = presc.dropSet ? '−20%' : undefined;

        const backoffReps = presc.backoffSet ? '+2пов' : undefined;

        exercises.push({ ...ex, sets: setsForEx, reps: parseInt(presc.reps.split('-')[0], 10) || 10, rir: rirVal, rest: ex.type === 'compound' ? 120 : 60, targetMuscle: ex.targetMuscle, technique: ex.technique, comments: ex.comments, dropSet: presc.dropSet, backoffSet: presc.backoffSet, canReplace: ex.canReplace, cannotReplace: ex.cannotReplace });

      }

    }



    const dayNames = ['', '', '', '', '', '', ''];

    days.push({ day: d + 1, name: dayNames[d] || ``, exercises });

  }



  const restDays = 7 - daysPerWeek;

  for (let r = 0; r < restDays; r++) {

    if (!days.find(dd => dd.day === daysPerWeek + r + 1)) {

      days.push({ day: daysPerWeek + r + 1, name: '', exercises: [] });

    }

  }



  return days;

}



export const PlanScreen: React.FC<{ goal: string }> = ({ goal }) => {

  const { profile, readiness: linkedReadiness, activeDrugs, pal } = useDataLink();

  const [tab, setTab] = useState<'plan' | 'readiness' | 'exercises'>('plan');



  const [goalState, setGoalState] = useState(goal || 'bulk');

  const [level, setLevel] = useState('intermediate');

  const [daysPerWeek, setDaysPerWeek] = useState(4);

  const [weakPoints, setWeakPoints] = useState<string[]>([]);

  const [recovery, setRecovery] = useState(70);

  const [fatigue, setFatigue] = useState(30);

  const [nutrition, setNutrition] = useState(70);

  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(null);

  const [selectedWeek, setSelectedWeek] = useState(1);



  const [sleepHours, setSleepHours] = useState(7.5);

  const [sleepQuality, setSleepQuality] = useState(7);

  const [nightAwakenings, setNightAwakenings] = useState(0);

  const [hrvRatio, setHrvRatio] = useState(1.0);

  const [doms, setDoms] = useState(3);

  const [stress, setStress] = useState(3);

  const [calRatio, setCalRatio] = useState(0.9);

  const [proteinRatio, setProteinRatio] = useState(0.9);

  const [waterRatio, setWaterRatio] = useState(0.85);

  const [fiberRatio, setFiberRatio] = useState(0.8);

  const [trainingLoadRatio, setTrainingLoadRatio] = useState(0.5);

  const [subjFatigue, setSubjFatigue] = useState(3);



  useEffect(() => {

    const s = profile.settings;

    if (s.primaryGoal || s.goal) setGoalState(s.primaryGoal ?? s.goal ?? 'bulk');

    if (s.baselineSleepHours) setSleepHours(s.baselineSleepHours);

    if (s.baselineSleepQuality) setSleepQuality(Math.round(s.baselineSleepQuality));

    if (s.baselineHrvRatio) setHrvRatio(s.baselineHrvRatio);

    if (s.baselineStressLevel) setStress(Math.round(s.baselineStressLevel));

    if (s.nightAwakenings !== undefined) setNightAwakenings(s.nightAwakenings);

    if (s.fatigueLevel) setSubjFatigue(s.fatigueLevel);

    if (s.trainingLevel) setLevel(s.trainingLevel === 'enhanced' ? 'advanced' : s.trainingLevel);

    if (s.workoutsPerWeek) setDaysPerWeek(s.workoutsPerWeek);

    if (s.weakPoints) setWeakPoints(s.weakPoints);

    if (s.dailyWaterLiters) setWaterRatio(Math.min(1, s.dailyWaterLiters / 3));

    if (s.nutritionFactor) setCalRatio(s.nutritionFactor);

  }, [profile]);



  useEffect(() => {

    if (linkedReadiness) {

      setRecovery(linkedReadiness.recovery);

      setFatigue(linkedReadiness.fatigue);

      setNutrition(linkedReadiness.nutrition);

    }

  }, [linkedReadiness]);



  const trainingResult = useMemo<TrainingOutput | null>(() => {

    const input: TrainingInput = {

      goal: goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints, injuries: [],

    };

    return calcTraining(input);

  }, [goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints]);



  const readinessResult = useMemo<ReadinessScores | null>(() => {

    const input: ReadinessInput = {

      sleepHours, sleepQuality: sleepQuality / 10, nightAwakenings, hrvRatio, doms, stress,

      calRatio, proteinRatio, waterRatio, fiberRatio, trainingLoadRatio, subjFatigue, hrIncrease: 0,

    };

    return calcReadiness(input);

  }, [sleepHours, sleepQuality, nightAwakenings, hrvRatio, doms, stress, calRatio, proteinRatio, waterRatio, fiberRatio, trainingLoadRatio, subjFatigue]);



  const exerciseGroups = useMemo(() => {

    const groups: Record<string, Exercise[]> = {};

    for (const ex of EXERCISE_CATALOG) {

      if (!groups[ex.group]) groups[ex.group] = [];

      groups[ex.group].push(ex);

    }

    return groups;

  }, []);



  const toggleWeakPoint = (g: string) => {

    setWeakPoints(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  };



  const splitRationale = useMemo(() => {

    return getSplitRationale(goalState, level, daysPerWeek, recovery, weakPoints);

  }, [goalState, level, daysPerWeek, recovery, weakPoints]);



  const splitOptions = useMemo(() => {

    const input: TrainingInput = { goal: goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints, injuries: [] };

    return getSplitOptions(input);

  }, [goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints]);



  const bestSplit = useMemo(() => {

    const input: TrainingInput = { goal: goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints, injuries: [] };

    return selectSplit(input)[0] || null;

  }, [goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints]);



  const progressionRule = useMemo(() => selectProgressionRule(level), [level]);



  const deloadRec = useMemo(() => {

    return getDeloadRecommendation([], 7.5, 1, recovery);

  }, [recovery]);



  const rirForGoal = getRIR(goalState, level, trainingResult?.isDeload ?? false);



  const palForDisplay = useMemo(() => derivePAL((profile.settings as any).training?.daysPerWeek, (profile.settings as any).training?.minutesPerSession), [(profile.settings as any).training?.daysPerWeek, (profile.settings as any).training?.minutesPerSession]);



  return (

    <div className="screen plan">

      <div className="tab-bar">

          {(['plan', 'readiness', 'exercises'] as const).map(t => (

            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>

              {t === 'plan' ? 'План' : t === 'readiness' ? 'Готовность' : 'Упражнения'}

          </button>

        ))}

      </div>



      {tab === 'plan' && (

        <div className="plan-training">

          {/* Unified input form */}

          <div className="card input-form">

            <h3>Параметры программы</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

              <div className="form-group">

                <label>Цель</label>

                <select value={goalState} onChange={e => setGoalState(e.target.value)}>

                  {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}

                </select>

              </div>

              <div className="form-group">

                <label>Уровень</label>

                <select value={level} onChange={e => setLevel(e.target.value)}>

                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}

                </select>

              </div>

              <div className="form-group">

                <label>Дней/неделю: {daysPerWeek}</label>

                <input type="range" min={2} max={6} value={daysPerWeek} onChange={e => setDaysPerWeek(parseFloat(e.target.value) || 0)} />

              </div>

              <div className="form-group">

                <label>Восстановление: {recovery}%</label>

                <input type="range" min={0} max={100} value={recovery} onChange={e => setRecovery(parseFloat(e.target.value) || 0)} />

              </div>

              <div className="form-group">

                <label>Утомлённость: {fatigue}%</label>

                <input type="range" min={0} max={100} value={fatigue} onChange={e => setFatigue(parseFloat(e.target.value) || 0)} />

              </div>

              <div className="form-group">

                <label>Питание: {nutrition}%</label>

                <input type="range" min={0} max={100} value={nutrition} onChange={e => setNutrition(parseFloat(e.target.value) || 0)} />

              </div>

            </div>

            <div className="form-group" style={{ marginTop: 8 }}>

              <label>Слабые точки</label>

              <div className="checkbox-group">

                {MUSCLE_GROUPS.map(g => (

                  <label key={g} className={`chip ${weakPoints.includes(g) ? 'active' : ''}`}>

                    <input type="checkbox" checked={weakPoints.includes(g)} onChange={() => toggleWeakPoint(g)} />

                    {GROUP_LABELS[g]}

                  </label>

                ))}

              </div>

            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>

              PAL (коэффициент активности): {palForDisplay} | Тренировок: {(profile.settings as any).training?.daysPerWeek ?? 3}/нед × {(profile.settings as any).training?.minutesPerSession ?? 60} мин

            </div>

          </div>



          {trainingResult && (

            <>

              {/* Split card with rationale */}

              <div className="card summary">

                <h3>{trainingResult.splitName}</h3>

                <p>{trainingResult.splitDesc}</p>

                <div className="row">

                  <span className="label">RIR</span>

                  <span className="value">{rirForGoal}</span>

                </div>

                <div className="row">

                  <span className="label">PAL</span>

                  <span className="value">{palForDisplay}</span>

                </div>

                <div className="row">

                  <span className="label">Прогрессия</span>

                  <span style={{ fontSize: 13 }}>{progressionRule.name}</span>

                </div>

                {trainingResult.isDeload && (

                  <div className="deload-badge" style={{ background: 'var(--warning, #f90)', padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>

                    Разгрузка: {trainingResult.deloadReason}

                  </div>

                )}

                {deloadRec.shouldDeload && (

                  <div style={{ background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: 6, marginTop: 8, fontSize: 12, color: '#ef4444' }}>

                    ⚠️ {deloadRec.reason}

                  </div>

                )}

                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5 }}>

                  <strong style={{ color: 'var(--accent)' }}>Обоснование:</strong>

                  {bestSplit ? bestSplit.rationale.map((r, i) => <div key={i}>• {r}</div>) : splitRationale.map((r, i) => <div key={i}>• {r}</div>)}

                </div>

              </div>



              {/* Split alternatives */}

              {splitOptions.length > 1 && (

                <div className="card" style={{ marginTop: 12 }}>

                  <h3 style={{ margin: '0 0 8px 0' }}>Альтернативные сплиты</h3>

                  {splitOptions.slice(0, 4).map((opt, i) => (

                    <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, marginBottom: 4, background: i === 0 ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)' }}>

                      <div>

                        <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.name} <span style={{ fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text-dim)' }}>{i === 0 ? '★ Лучший' : `#${i + 1}`}</span></div>

                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{formatSplitGroups(opt.groupsPerDay)}</div>

                      </div>

                      <div style={{ textAlign: 'right' }}>

                        <div style={{ fontWeight: 700, fontSize: 14, color: opt.score >= 60 ? 'var(--accent)' : opt.score >= 30 ? '#eab308' : '#ef4444' }}>{opt.score}</div>

                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>баллов</div>

                      </div>

                    </div>

                  ))}

                </div>

              )}



              {/* Progression info */}

              <div className="card" style={{ marginTop: 12 }}>

                <h3 style={{ margin: '0 0 8px 0' }}>Прогрессия: {progressionRule.name}</h3>

                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{progressionRule.description}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>

                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Прирост веса/нед</div>

                    <div style={{ fontWeight: 700 }}>{progressionRule.weeklyWeightIncrement} кг</div>

                  </div>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>

                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Делоад через</div>

                    <div style={{ fontWeight: 700 }}>{progressionRule.deloadTrigger.plateauWeeks} нед плато</div>

                  </div>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>

                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Объём делоада</div>

                    <div style={{ fontWeight: 700 }}>{Math.round(progressionRule.deloadProtocol.volumeMultiplier * 100)}%</div>

                  </div>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>

                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>RIR+ делоада</div>

                    <div style={{ fontWeight: 700 }}>+{progressionRule.deloadProtocol.rirAdd}</div>

                  </div>

                </div>

              </div>



              {/* Volume table */}

              <div className="card volume-table">

                <h3>Объём (сетов/нед) — MV-MRV</h3>

                <div className="grid volume-grid">

                  {Object.entries(trainingResult.volumePerGroup).map(([g, v]) => (

                    <div key={g} className={`volume-item ${weakPoints.includes(g) ? 'accent' : ''}`}>

                      <span className="label">{GROUP_LABELS[g] || g}</span>

                      <span className="value">{v}</span>

                    </div>

                  ))}

                </div>

              </div>



              {/* Weekly plan - use macrocycle if available, otherwise old logic */}

              <div className="card week-plan" style={{ display: !macrocycle ? 'block' : 'none' }}>

                <p className="week-note">{trainingResult.weekPlan}</p>

                {(() => {

                  const days = buildDayPlan(trainingResult, daysPerWeek, weakPoints, bestSplit?.groupsPerDay);

                  return days.map((day) => (

                    <div key={day.day} className="day-block">

                      <h4>{day.day} — {day.name}</h4>

                      {day.exercises.length === 0 ? (

                        <p className="rest-day">Отдых — восстановление, растяжка, лёгкое кардио</p>

                      ) : (

                        <table className="exercise-table">

                          <thead>

                            <tr><th>Упражнение</th><th>Сеты</th><th>Повторы</th><th>RIR</th><th>Отдых</th><th>Вес</th></tr>

                          </thead>

                          <tbody>

                            {day.exercises.map((ex, i) => {

                              const suggestion = calcSuggestedWeight(ex.id, [], selectedWeek, progressionRule, goalState, ex.type === 'compound', undefined);

                              return (

                              <tr key={ex.id || i}>

                                <td style={{ maxWidth: 180 }}>

                                  <div style={{ fontWeight: 600, fontSize: 12 }}>{ex.name}</div>

                                  {ex.targetMuscle && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{ex.targetMuscle}</div>}

                                  {ex.dropSet && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(249,115,22,0.15)', color: '#f97316', marginLeft: 4 }}>Дроп</span>}

                                  {ex.backoffSet && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#22c55e', marginLeft: 4 }}>Бэк</span>}

                                </td>

                                <td>{ex.sets}</td>

                                <td>{ex.reps}</td>

                                <td>{ex.rir}</td>

                                <td>{ex.rest}</td>

                                <td style={{ fontSize: 12 }}>

                                  <div style={{ fontWeight: 700, color: suggestion.isDeload ? '#ef4444' : 'var(--accent)' }}>

                                    {suggestion.suggestedWeight > 0 ? `${suggestion.suggestedWeight} кг` : '—'}

                                  </div>

                                  {suggestion.rationale && <div style={{ fontSize: 9, color: 'var(--text-dim)', maxWidth: 120 }}>{suggestion.rationale}</div>}

                                </td>

                              </tr>

                            );})}

                          </tbody>

                        </table>

                      )}

                    </div>

                  ));

                })()}

              </div>



              {/* Macrocycle generation */}

              <div className="card" style={{ marginTop: 16, display: macrocycle ? 'none' : 'block' }}>

                <h3 style={{ margin: '0 0 10px 0' }}>Периодизация (макроцикл)</h3>

                <button onClick={() => {

                  const macro = generateMacrocycle({

                    goal: goalState as any, level: level as any, daysPerWeek,

                    readinessScore: recovery, isOnCourse: level === 'enhanced',

                    weakPoints, injuries: [], experience: level as any,

                  });

                  setMacrocycle(macro);

                  setSelectedWeek(1);

                }} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer', width: '100%', fontWeight: 700 }}>

                  Сгенерировать макроцикл

                </button>

              </div>



              {macrocycle && (

                <>

                  <button onClick={() => {

                    setMacrocycle(null);

                  }} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', marginBottom: 12, fontWeight: 600 }}>

                    ⬅️ Скрыть макроцикл

                  </button>

                  <div className="card" style={{ marginTop: 12 }}>

                    <h4 style={{ margin: '0 0 8px 0' }}>Обзор ({macrocycle.totalWeeks} нед.)</h4>

                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>

                      {macrocycle.mesocycles.map(meso => (

                        <div key={meso.type + meso.weekStart} style={{ flex: '1 0 auto', minWidth: 80 }}>

                          {Array.from({ length: meso.weeks }, (_, i) => {

                            const wk = meso.microcycles[i];

                            if (!wk) return null;

                            const mesoColor: Record<string, string> = {

                              accumulation: '#2196F3', intensification: '#FF9800', peaking: '#f44336', deload: '#4CAF50', recovery: '#9C27B0',

                            };

                            return (

                              <div key={wk.weekNumber} onClick={() => setSelectedWeek(wk.weekNumber)}

                                style={{ padding: '4px 6px', margin: '1px 0', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: selectedWeek === wk.weekNumber ? 'var(--accent-blue)' : 'var(--bg-secondary)', color: selectedWeek === wk.weekNumber ? '#fff' : 'var(--text-primary)', borderLeft: `3px solid ${mesoColor[meso.type] || '#888'}` }}>

                                <div style={{ fontWeight: 600 }}>Н{wk.weekNumber}</div>

                                <div style={{ fontSize: 9 }}>{wk.isDeload ? 'делоад' : meso.type === 'accumulation' ? 'накопл.' : meso.type === 'intensification' ? 'интенс.' : meso.type === 'peaking' ? 'пик' : meso.type.slice(0, 4)}</div>

                                <div style={{ fontSize: 9 }}>RIR {wk.rirRange.join('-')}</div>

                              </div>

                            );

                          })}

                        </div>

                      ))}

                    </div>

                  </div>



                  {(() => {

                    const week = macrocycle.mesocycles.flatMap(m => m.microcycles).find(w => w.weekNumber === selectedWeek);

                    if (!week) return null;

                    const adapted = adaptWeekForReadiness(week, recovery);

                    const mesoInfo = MESOCYCLE_PARAMS[week.mesocycleType];

                    return (

                      <div className="card" style={{ marginBottom: 12 }}>

                        <h4>Неделя {week.weekNumber} — {week.mesocycleType === 'accumulation' ? 'Накопление' : week.mesocycleType === 'intensification' ? 'Интенсификация' : week.mesocycleType === 'peaking' ? 'Пик' : week.mesocycleType === 'deload' ? 'Разгрузка' : 'Рабочая фаза'}

                          {week.isDeload ? ' (Делоад)' : ''}</h4>

                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{mesoInfo?.description}</div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>

                          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>Объём: ×{adapted.volumeMultiplier.toFixed(2)}</div>

                          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>RIR: {adapted.rirRange.join('-')}</div>

                          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>RPE: {adapted.rpeTarget}</div>

                          {recovery < 40 && <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#ef4444' }}>⚠️ Автоделоды</div>}

                        </div>

                        {adapted.days.map(day => (

                          <div key={day.day} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, marginBottom: 6 }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>

                              <span style={{ fontWeight: 700, fontSize: 14 }}>{day.day}</span>

                              <div style={{ display: 'flex', gap: 6 }}>

                                <span style={{ fontSize: 11, color: day.isTraining ? 'var(--accent-blue)' : 'var(--text-dim)' }}>{day.isTraining ? day.split : ''}</span>

                                {day.isTraining && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: day.intensity === 'very_high' ? 'rgba(239,68,68,0.2)' : day.intensity === 'high' ? 'rgba(249,115,22,0.2)' : day.intensity === 'medium' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)', color: day.intensity === 'very_high' ? '#ef4444' : day.intensity === 'high' ? '#f97316' : day.intensity === 'medium' ? '#eab308' : '#22c55e' }}>{day.intensity === 'very_high' ? 'очень высокая' : day.intensity === 'high' ? 'высокая' : day.intensity === 'medium' ? 'средняя' : 'лёгкая'}</span>}

                              </div>

                            </div>

                            {day.isTraining && day.exercises.length > 0 && (

                              <div style={{ fontSize: 12 }}>

                                {day.exercises.map((ex, i) => (

                                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                      <div><span>{ex.isCompound ? 'Базовое: ' : 'Изоляция: '}{ex.name}</span>{ex.targetMuscle && <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--accent)' }}>{ex.targetMuscle}</span>}</div>

                                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>

                                        <span style={{ color: 'var(--text-dim)' }}>{ex.sets}×{ex.reps} RIR {ex.rir}</span>

                                        {ex.dropSet && <span style={{ fontSize: 9, padding: '0 3px', borderRadius: 3, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>Дроп</span>}

                                        {ex.backoffSet && <span style={{ fontSize: 9, padding: '0 3px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Бэк</span>}

                                      </div>

                                    </div>

                                    {ex.technique && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{ex.technique}</div>}

                                    {ex.canReplace && ex.canReplace.length > 0 && <div style={{ fontSize: 9, marginTop: 2, color: 'var(--text-dim)' }}>Замены: {ex.canReplace.map(rId => getExerciseById(rId)?.name || rId).join(', ')}</div>}

                                  </div>

                                ))}

                              </div>

                            )}

                            {!day.isTraining && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Восстановление, растяжка, лёгкое кардио</div>}

                          </div>

                        ))}

                      </div>

                    );

                  })()}

                </>

              )}

            </>

          )}

        </div>

      )}



      {tab === 'readiness' && (

        <div className="plan-readiness">

          <div className="card readiness-inputs">

            <h3>Готовность к тренировке</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

              <div className="form-group"><label>Сон: {sleepHours}ч</label><input type="range" min={0} max={12} step={0.5} value={sleepHours} onChange={e => setSleepHours(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Качество: {sleepQuality}/10</label><input type="range" min={1} max={10} value={sleepQuality} onChange={e => setSleepQuality(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Пробуждения: {nightAwakenings}</label><input type="range" min={0} max={5} value={nightAwakenings} onChange={e => setNightAwakenings(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>HRV: {hrvRatio}</label><input type="range" min={0.5} max={1.5} step={0.05} value={hrvRatio} onChange={e => setHrvRatio(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>DOMS: {doms}/10</label><input type="range" min={0} max={10} value={doms} onChange={e => setDoms(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Стресс: {stress}/10</label><input type="range" min={0} max={10} value={stress} onChange={e => setStress(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Калории: {calRatio}</label><input type="range" min={0.5} max={1.5} step={0.05} value={calRatio} onChange={e => setCalRatio(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Белок: {proteinRatio}</label><input type="range" min={0.5} max={1.5} step={0.05} value={proteinRatio} onChange={e => setProteinRatio(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Нагрузка: {trainingLoadRatio}</label><input type="range" min={0} max={2} step={0.05} value={trainingLoadRatio} onChange={e => setTrainingLoadRatio(parseFloat(e.target.value) || 0)} /></div>

              <div className="form-group"><label>Усталость: {subjFatigue}/10</label><input type="range" min={0} max={10} value={subjFatigue} onChange={e => setSubjFatigue(parseFloat(e.target.value) || 0)} /></div>

            </div>

          </div>

          {readinessResult && (

            <div className="card readiness-scores">

              <h3>Оценки готовности</h3>

              <div className="score-grid">

                <div className="score-item"><span className="label">Восстановление</span><span className="value" style={{ color: readinessResult.recovery > 60 ? 'var(--success)' : 'var(--danger)' }}>{readinessResult.recovery}</span></div>

                <div className="score-item"><span className="label">Питание</span><span className="value" style={{ color: readinessResult.nutrition > 60 ? 'var(--success)' : 'var(--danger)' }}>{readinessResult.nutrition}</span></div>

                <div className="score-item"><span className="label">Поддержка</span><span className="value">{readinessResult.support}</span></div>

                <div className="score-item"><span className="label">Утомлённость</span><span className="value" style={{ color: readinessResult.fatigue < 50 ? 'var(--success)' : 'var(--danger)' }}>{readinessResult.fatigue}</span></div>

              </div>

              {readinessResult.isConservative && <div style={{ background: 'var(--warning)', padding: 8, borderRadius: 4, marginTop: 8, fontSize: 13 }}>Консервативный режим: {readinessResult.conservativeReason}</div>}

              <div className="card volume-adjustment" style={{ marginTop: 12 }}>

                <h4>Влияние на объём</h4>

                <div style={{ fontSize: 13 }}>{readinessResult.recovery < 50 ? 'Восстановление низкое: снизьте объём на 20-30%.' : readinessResult.recovery < 65 ? 'Восстановление среднее: держите RIR выше и не идите в отказ.' : 'Восстановление хорошее: можно выполнять плановый объём.'}</div>

                <div style={{ fontSize: 13 }}>{readinessResult.fatigue > 70 ? 'Утомлённость высокая: рекомендован делоад или лёгкая техника.' : readinessResult.fatigue > 50 ? 'Утомлённость повышена: контролируйте RPE и отдых.' : 'Утомлённость в норме.'}</div>

              </div>

            </div>

          )}

        </div>

      )}



      {tab === 'exercises' && (

        <div className="plan-exercises">

          {Object.entries(exerciseGroups).map(([group, exercises]) => (

            <div key={group} className="card exercise-group">

              <h3>{GROUP_LABELS[group] || group}</h3>

              {exercises.map(ex => {

                const subInfo = getSubstitutes(ex.id);

                return (

                  <div key={ex.id} style={{ padding: '8px 10px', marginBottom: 4, background: 'var(--bg-secondary)', borderRadius: 6 }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                      <div><span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>

                        <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: ex.type === 'compound' ? 'rgba(0,230,138,0.12)' : 'rgba(100,150,255,0.12)', color: ex.type === 'compound' ? '#00e68a' : '#6496ff' }}>{ex.type === 'compound' ? 'Базовое' : 'Изолирующее'}</span>

                      </div>

                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ex.equipment} | {ex.difficulty} | суставы: {ex.jointStress}</span>

                    </div>

                    {ex.targetMuscle && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{ex.targetMuscle}</div>}

                    {ex.technique && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2, lineHeight: 1.5 }}>{ex.technique}</div>}

                    {ex.comments && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{ex.comments}</div>}

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>

                      {ex.pauseSeconds ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(234,179,8,0.12)', color: '#eab308' }}>Пауза {ex.pauseSeconds}с</span> : null}

                      {ex.peakContraction && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>Пиковое сокращение</span>}

                      {ex.stretchPhase && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Растяжение</span>}

                    </div>

                    {subInfo && subInfo.substitutes.length > 0 && (

                      <div style={{ marginTop: 4, fontSize: 10 }}><span style={{ color: 'var(--text-dim)' }}>Заменители: </span>

                        {subInfo.substitutes.map(s => <span key={s.id} style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.08)', margin: '0 2px' }}>{getExerciseById(s.id)?.name || s.id} ({s.reason})</span>)}

                      </div>

                    )}

                  </div>

                );

              })}

            </div>

          ))}

        </div>

      )}

    </div>

  );

};
