import React, { useState, useMemo, useEffect } from 'react';
import { SubstanceCard } from '../cards/SubstanceCard';
import { calcTraining, EXERCISE_DB, selectExercises, getAvailableSplits } from '../../engines/training.engine';
import { generateSupportStack, calculateSupport } from '../../engines/support.engine';
import { calcReadiness } from '../../engines/readiness.engine';
import { getProfile } from '../../core/profile-manager';
import type { TrainingInput, TrainingOutput, ReadinessInput, ReadinessScores, Exercise } from '../../core/types';

const GOALS = [
  { value: 'bulk', label: 'Набор массы' },
  { value: 'cut', label: 'Сушка' },
  { value: 'maintenance', label: 'Поддержание' },
  { value: 'strength', label: 'Сила' },
  { value: 'rehab', label: 'Реабилитация' },
] as const;

const LEVELS = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
] as const;

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

const GROUP_LABELS: Record<string, string> = {
  chest: 'Грудь',
  back: 'Спина',
  legs: 'Ноги',
  shoulders: 'Плечи',
  arms: 'Руки',
  core: 'Кор',
};

const DAYS_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function buildDayPlan(result: TrainingOutput, daysPerWeek: number): { day: number; name: string; exercises: Exercise[] }[] {
  const days: { day: number; name: string; exercises: Exercise[] }[] = [];
  const groups = Object.keys(result.volumePerGroup);
  const exercisesPerDay = Math.max(4, Math.min(8, Math.round(groups.length * 2 / daysPerWeek)));

  for (let d = 0; d < daysPerWeek; d++) {
    const dayGroups: string[] = [];
    if (daysPerWeek <= 3) {
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
      const reps = result.rir === '4' ? 12 : result.rir === '1-2' ? 10 : 8;
      const avail = selectExercises(g, {
        avoidHighJointStress: result.isDeload,
        maxFatigueCost: result.isDeload ? 5 : undefined,
      });
      const picked = avail.slice(0, Math.min(2, Math.ceil(sets / 3)));
      for (const ex of picked) {
        const setsForEx = picked.length === 1 ? sets : Math.max(2, Math.round(sets / picked.length));
        const rirVal = parseInt(result.rir.split('-')[0], 10) || 2;
        exercises.push({ ...ex, sets: setsForEx, reps, rir: rirVal, rest: ex.type === 'compound' ? 120 : 60 });
      }
    }
    days.push({ day: d + 1, name: DAYS_LABELS[d] || `День ${d + 1}`, exercises });
  }
  return days;
}

export const PlanScreen: React.FC<{ goal: string }> = ({ goal }) => {
  const [tab, setTab] = useState<'training' | 'support' | 'readiness' | 'exercises'>('training');

  const [goalState, setGoalState] = useState(goal || 'bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [recovery, setRecovery] = useState(70);
  const [fatigue, setFatigue] = useState(30);
  const [nutrition, setNutrition] = useState(70);

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
    const s = getProfile().settings;
    if (s.goal) setGoalState(s.goal);
    if (s.baselineSleepHours) setSleepHours(s.baselineSleepHours);
    if (s.baselineSleepQuality) setSleepQuality(Math.round(s.baselineSleepQuality * 10));
    if (s.baselineHrvRatio) setHrvRatio(s.baselineHrvRatio);
    if (s.baselineStressLevel) setStress(Math.round(s.baselineStressLevel));
  }, []);

  const trainingResult = useMemo<TrainingOutput | null>(() => {
    const input: TrainingInput = {
      goal: goalState,
      level,
      daysPerWeek,
      recovery,
      fatigue,
      nutrition,
      weakPoints,
      injuries: [],
    };
    return calcTraining(input);
  }, [goalState, level, daysPerWeek, recovery, fatigue, nutrition, weakPoints]);

  const dayPlan = useMemo(() => {
    if (!trainingResult) return [];
    return buildDayPlan(trainingResult, daysPerWeek);
  }, [trainingResult, daysPerWeek]);

  const readinessResult = useMemo<ReadinessScores | null>(() => {
    const input: ReadinessInput = {
      sleepHours,
      sleepQuality: sleepQuality / 10,
      nightAwakenings,
      hrvRatio,
      doms,
      stress,
      calRatio,
      proteinRatio,
      waterRatio,
      fiberRatio,
      trainingLoadRatio,
      subjFatigue,
      hrIncrease: 0,
    };
    return calcReadiness(input);
  }, [sleepHours, sleepQuality, nightAwakenings, hrvRatio, doms, stress, calRatio, proteinRatio, waterRatio, fiberRatio, trainingLoadRatio, subjFatigue]);

  const supportStack = useMemo(() => {
    return generateSupportStack(goalState);
  }, [goalState]);

  const supportResult = useMemo(() => {
    if (supportStack.length === 0) return null;
    return calculateSupport({
      substances: supportStack.map(s => s.id),
      goals: [goalState],
      nutritionFactor: nutrition / 100,
      trainingFactor: recovery / 100,
    });
  }, [supportStack, goalState, nutrition, recovery]);

  const exerciseGroups = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of EXERCISE_DB) {
      if (!groups[ex.group]) groups[ex.group] = [];
      groups[ex.group].push(ex);
    }
    return groups;
  }, []);

  const toggleWeakPoint = (g: string) => {
    setWeakPoints(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const availableSplits = useMemo(() => {
    return getAvailableSplits(daysPerWeek, recovery);
  }, [daysPerWeek, recovery]);

  return (
    <div className="screen plan">
      <div className="tab-bar">
        {(['training', 'support', 'readiness', 'exercises'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'training' ? 'Тренировочный план' : t === 'support' ? 'Стек поддержки' : t === 'readiness' ? 'Готовность' : 'Упражнения'}
          </button>
        ))}
      </div>

      {tab === 'training' && (
        <div className="plan-training">
          <div className="card input-form">
            <h3>Параметры плана</h3>
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
              <label>Дней в неделю: {daysPerWeek}</label>
              <input type="range" min={2} max={6} value={daysPerWeek} onChange={e => setDaysPerWeek(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Восстановление: {recovery}%</label>
              <input type="range" min={0} max={100} value={recovery} onChange={e => setRecovery(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Утомлённость: {fatigue}%</label>
              <input type="range" min={0} max={100} value={fatigue} onChange={e => setFatigue(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Питание: {nutrition}%</label>
              <input type="range" min={0} max={100} value={nutrition} onChange={e => setNutrition(Number(e.target.value))} />
            </div>
            <div className="form-group">
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
          </div>

          {trainingResult && (
            <>
              <div className="card summary">
                <h3>{trainingResult.splitName}</h3>
                <p>{trainingResult.splitDesc}</p>
                <div className="row">
                    <span className="label">RIR</span>
                  <span className="value">{trainingResult.rir}</span>
                </div>
                {trainingResult.isDeload && (
                  <div className="deload-badge" style={{ background: 'var(--warning, #f90)', padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
                    Разгрузка: {trainingResult.deloadReason}
                  </div>
                )}
              </div>

              <div className="card volume-table">
                <h3>Объём по группам (сетов/нед)</h3>
                <div className="grid volume-grid">
                  {Object.entries(trainingResult.volumePerGroup).map(([g, v]) => (
                    <div key={g} className={`volume-item ${weakPoints.includes(g) ? 'accent' : ''}`}>
                      <span className="label">{GROUP_LABELS[g] || g}</span>
                      <span className="value">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {availableSplits.length > 0 && (
                <div className="card splits-info">
                  <h3>Доступные сплиты для {daysPerWeek} дней</h3>
                  {availableSplits.map(s => (
                    <div key={s.id} className="row"><span className="label">{s.name}</span><span className="value">{s.desc}</span></div>
                  ))}
                </div>
              )}

              <div className="card week-plan">
                <h3>Недельный план</h3>
                <p className="week-note">{trainingResult.weekPlan}</p>
                {dayPlan.map(day => (
                  <div key={day.day} className="day-block">
                    <h4>День {day.day} — {day.name}</h4>
                    {day.exercises.length === 0 ? (
                      <p className="rest-day">Отдых</p>
                    ) : (
                      <table className="exercise-table">
                        <thead>
                          <tr><th>Упражнение</th><th>Сеты</th><th>Повторы</th><th>RIR</th><th>Отдых (с)</th></tr>
                        </thead>
                        <tbody>
                          {day.exercises.map(ex => (
                            <tr key={ex.id}>
                              <td>{ex.name}</td>
                              <td>{ex.sets}</td>
                              <td>{ex.reps}</td>
                              <td>{ex.rir}</td>
                              <td>{ex.rest}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'support' && (
        <div className="plan-support">
          {supportStack.length > 0 ? (
            <>
              <div className="card summary" style={{ marginBottom: 16 }}>
                <h3>Стек поддержки: {goalState}</h3>
                <div className="row">
                  <span className="label">Веществ</span>
                  <span className="value">{supportStack.length}</span>
                </div>
                {supportResult && (
                  <>
                    <div className="row">
                      <span className="label">Оценка поддержки</span>
                      <span className="value" style={{ color: 'var(--accent)' }}>{supportResult.supportScore}</span>
                    </div>
                    <div className="row">
                      <span className="label">Риск до</span>
                      <span className="value">{supportResult.riskBeforeSupport.toFixed(1)}</span>
                    </div>
                    <div className="row">
                      <span className="label">Риск после</span>
                      <span className="value" style={{ color: 'var(--success, #0a0)' }}>{supportResult.riskAfterSupport.toFixed(1)}</span>
                    </div>
                  </>
                )}
              </div>
              {supportStack.map(s => <SubstanceCard key={s.id} sub={s as any} />)}
            </>
          ) : (
            <div className="card"><p>Нет данных стека для цели «{goalState}»</p></div>
          )}
        </div>
      )}

      {tab === 'readiness' && (
        <div className="plan-readiness">
          <div className="card readiness-inputs">
            <h3>Входные параметры готовности</h3>
            <div className="form-group">
              <label>Сон (часы): {sleepHours}</label>
              <input type="range" min={0} max={12} step={0.5} value={sleepHours} onChange={e => setSleepHours(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Качество сна: {sleepQuality}/10</label>
              <input type="range" min={1} max={10} value={sleepQuality} onChange={e => setSleepQuality(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Ночные пробуждения: {nightAwakenings}</label>
              <input type="range" min={0} max={5} value={nightAwakenings} onChange={e => setNightAwakenings(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Коэффициент HRV: {hrvRatio}</label>
              <input type="range" min={0.5} max={1.5} step={0.05} value={hrvRatio} onChange={e => setHrvRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>DOMS (мышечная боль): {doms}/10</label>
              <input type="range" min={0} max={10} value={doms} onChange={e => setDoms(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Стресс: {stress}/10</label>
              <input type="range" min={0} max={10} value={stress} onChange={e => setStress(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Калории (соотношение): {calRatio}</label>
              <input type="range" min={0.5} max={1.5} step={0.05} value={calRatio} onChange={e => setCalRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Белок (соотношение): {proteinRatio}</label>
              <input type="range" min={0.5} max={1.5} step={0.05} value={proteinRatio} onChange={e => setProteinRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Вода (соотношение): {waterRatio}</label>
              <input type="range" min={0.5} max={1.5} step={0.05} value={waterRatio} onChange={e => setWaterRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Клетчатка (соотношение): {fiberRatio}</label>
              <input type="range" min={0.5} max={1.5} step={0.05} value={fiberRatio} onChange={e => setFiberRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Нагрузка (соотношение): {trainingLoadRatio}</label>
              <input type="range" min={0} max={2} step={0.05} value={trainingLoadRatio} onChange={e => setTrainingLoadRatio(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Субъективная усталость: {subjFatigue}/10</label>
              <input type="range" min={0} max={10} value={subjFatigue} onChange={e => setSubjFatigue(Number(e.target.value))} />
            </div>
          </div>

          {readinessResult && (
            <div className="card readiness-scores">
              <h3>Оценки готовности</h3>
              <div className="score-grid">
                <div className="score-item">
                  <span className="label">Восстановление</span>
                  <span className="value" style={{ color: readinessResult.recovery > 60 ? 'var(--success, #0a0)' : 'var(--danger, #e00)' }}>{readinessResult.recovery}</span>
                </div>
                <div className="score-item">
                  <span className="label">Питание</span>
                  <span className="value" style={{ color: readinessResult.nutrition > 60 ? 'var(--success, #0a0)' : 'var(--danger, #e00)' }}>{readinessResult.nutrition}</span>
                </div>
                <div className="score-item">
                  <span className="label">Поддержка</span>
                  <span className="value">{readinessResult.support}</span>
                </div>
                <div className="score-item">
                  <span className="label">Утомлённость</span>
                  <span className="value" style={{ color: readinessResult.fatigue < 50 ? 'var(--success, #0a0)' : 'var(--danger, #e00)' }}>{readinessResult.fatigue}</span>
                </div>
              </div>
              {readinessResult.isConservative && (
                <div className="conservative-warning" style={{ background: 'var(--warning, #f90)', padding: '8px', borderRadius: 4, marginTop: 8 }}>
                  Консервативный режим: {readinessResult.conservativeReason}
                </div>
              )}
              <div className="card volume-adjustment" style={{ marginTop: 12 }}>
                <h4>Влияние на объём тренировок</h4>
                <p>{readinessResult.recovery < 50 ? 'Объём снижен на 20% (восстановление < 50)' : readinessResult.recovery < 65 ? 'Объём снижен на 10%' : 'Полный объём'}</p>
                <p>{readinessResult.fatigue > 70 ? 'Объём снижен на 10% (утомлённость > 70)' : readinessResult.fatigue > 50 ? 'Объём снижен на 5%' : 'Без поправок на усталость'}</p>
                <p>{readinessResult.nutrition < 50 ? 'Объём снижен на 15% (питание < 50)' : readinessResult.nutrition < 65 ? 'Объём снижен на 5%' : 'Питание в норме'}</p>
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
              <table className="exercise-table">
                <thead>
                  <tr><th>Название</th><th>Тип</th><th>Оборудование</th><th>Сложность</th><th>Нагрузка на суставы</th><th>Усталость</th></tr>
                </thead>
                <tbody>
                  {exercises.map(ex => (
                    <tr key={ex.id}>
                      <td>{ex.name}</td>
                      <td>{ex.type}</td>
                      <td>{ex.equipment}</td>
                      <td>{ex.difficulty}</td>
                      <td>{ex.jointStress}</td>
                      <td>{ex.fatigueCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};