import React, { useState, useEffect } from 'react';
import type { TrainingOutput, Exercise } from '../../../core/types';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import type { SplitCandidate } from '../../../engines/split-selector.engine';
import type { ProgressionRule } from '../../../engines/progression.engine';
import { calcSuggestedWeight } from '../../../engines/progression.engine';
import { getExerciseById } from '../../../core/exercise-catalog';
import { recommendTempo, formatTempo, TEMPO_PRESETS } from '../../../engines/rep-tempo.engine';
import { getRIR, formatSplitGroups, buildDayPlan } from './PlanUtils';

export const PlanTraining: React.FC<{
  goalState: string;
  level: string;
  daysPerWeek: number;
  weakPoints: string[];
  recovery: number;
  trainingResult: TrainingOutput | null;
  bestSplit: SplitCandidate | null;
  splitOptions: SplitCandidate[];
  progressionRule: ProgressionRule;
  deloadRec: { shouldDeload: boolean; reason: string };
  palForDisplay: number;
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  setMacrocycle: (m: MacrocyclePlan | null) => void;
  setSelectedWeek: (w: number) => void;
  fatigue?: number;
  nutritionScore?: number;
  avgWorkoutMinutes?: number;
}> = ({
  goalState, level, daysPerWeek, weakPoints, recovery,
  trainingResult, bestSplit, splitOptions, progressionRule, deloadRec,
  palForDisplay, macrocycle, selectedWeek, setMacrocycle, setSelectedWeek,
  fatigue, nutritionScore, avgWorkoutMinutes
}) => {
  if (!trainingResult) return <div>Загрузка...</div>;

  const rirForGoal = getRIR(goalState, level, trainingResult.isDeload);

  const [clipboardDay, setClipboardDay] = useState<any>(null);
  const [localPlan, setLocalPlan] = useState<any[]>([]);
  const [massScale, setMassScale] = useState({ weight: 0, volume: 0 });

  const SET_PRESETS: Record<string, { sets: number, reps: number }> = {
    '5x5': { sets: 5, reps: 5 },
    '3x8': { sets: 3, reps: 8 },
    '4x10': { sets: 4, reps: 10 },
    'AMRAP': { sets: 1, reps: 0 },
    'Myo-rep': { sets: 1, reps: 12 },
  };

  useEffect(() => {
    if (trainingResult) {
      setLocalPlan(buildDayPlan(trainingResult, daysPerWeek, weakPoints, bestSplit?.groupsPerDay));
    }
  }, [trainingResult, daysPerWeek, weakPoints, bestSplit]);

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof Exercise, value: any) => {
    const newPlan = [...localPlan];
    newPlan[dayIndex].exercises[exIndex] = {
      ...newPlan[dayIndex].exercises[exIndex],
      [field]: value
    };
    setLocalPlan(newPlan);
  };

  const applyMassEdit = (type: 'weight' | 'volume') => {
    const factor = 1 + (massScale[type] / 100);
    const newPlan = localPlan.map(day => ({
      ...day,
      exercises: day.exercises.map((ex: Exercise) => {
        if (type === 'weight') {
          return { ...ex, weight: Math.round((ex.weight || 0) * factor) };
        } else {
          return { ...ex, sets: Math.round((ex.sets || 0) * factor) };
        }
      })
    }));
    setLocalPlan(newPlan);
  };
  return (
    <div className="plan-training">
      <div className="card input-form">
        <h3>Настройки тренировок</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Цель</label>
            <select value={goalState} onChange={(e) => {}} disabled>
              <option value="bulk">Набор мышечной массы</option>
              <option value="cut">Сушка</option>
              <option value="maintenance">Поддержание</option>
              <option value="strength">Сила</option>
              <option value="recomp">Перекомпозиция</option>
              <option value="rehab">Реабилитация</option>
            </select>
          </div>
          <div className="form-group">
            <label>Уровень</label>
            <select value={level} onChange={(e) => {}} disabled>
              <option value="beginner">Начинающий</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>
          <div className="form-group">
            <label>Дней/неделю: {daysPerWeek}</label>
            <input type="range" min={2} max={6} value={daysPerWeek} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>Восстановление: {recovery}%</label>
            <input type="range" min={0} max={100} value={recovery} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>Усталость: {fatigue ?? 0}%</label>
            <input type="range" min={0} max={100} value={fatigue ?? 0} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>Питание: {nutritionScore ?? 0}%</label>
            <input type="range" min={0} max={100} value={nutritionScore ?? 0} onChange={(e) => {}} disabled />
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Дни слабых мест: {weakPoints.map(g => g).join(', ') || ''}
        </div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          PAL: {palForDisplay} | Тренировки: {daysPerWeek}/нед | Время: {avgWorkoutMinutes ?? 60} мин
        </div>
      </div>

      <div className="card summary">
        <h3>{trainingResult.splitName}</h3>
        <p>{trainingResult.splitDesc}</p>
        <div className="row"><span className="label">RIR</span><span className="value">{rirForGoal}</span></div>
        <div className="row"><span className="label">PAL</span><span className="value">{palForDisplay}</span></div>
        <div className="row"><span className="label">Прогрессия</span><span>{progressionRule.name}</span></div>
        {trainingResult.isDeload && (
          <div className="deload-badge" style={{ background: 'var(--warning, #f90)', padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
            Делог: {trainingResult.deloadReason}
          </div>
        )}
        {deloadRec.shouldDeload && (
          <div style={{ background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: 6, marginTop: 8 }}>
            Рекомендация: {deloadRec.reason}
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Массовое редактирование (%)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>Вес:</span>
              <input type="number" value={massScale.weight} onChange={e => setMassScale({...massScale, weight: parseFloat(e.target.value)||0})} style={{ width: 40, fontSize: 10 }} />
              <button onClick={() => applyMassEdit('weight')} style={{ fontSize: 10 }}>Применить</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>Объем:</span>
              <input type="number" value={massScale.volume} onChange={e => setMassScale({...massScale, volume: parseFloat(e.target.value)||0})} style={{ width: 40, fontSize: 10 }} />
              <button onClick={() => applyMassEdit('volume')} style={{ fontSize: 10 }}>Применить</button>
            </div>
          </div>
        </div>
      </div>

      {splitOptions && splitOptions.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Варианты сплита</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {splitOptions.map((split: SplitCandidate, idx: number) => (
              <div key={idx} style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: bestSplit && split.id === bestSplit.id ? '1px solid var(--accent)' : 'none' }}>
                <div style={{ fontWeight: 600 }}>{split.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatSplitGroups(split.groupsPerDay)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11 }}>
                  <span>Совместимость: {Math.round(split.score * 100)}%</span>
                  <span>Восст.: {Math.round(split.score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Прогрессия: {progressionRule.name}</h3>
        <div>{progressionRule.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>Вес/неделю</div>
            <div>{progressionRule.weeklyWeightIncrement} кг</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>Делог</div>
            <div>{progressionRule.deloadTrigger.plateauWeeks} нед</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>Объем</div>
            <div>{Math.round(progressionRule.deloadProtocol.volumeMultiplier * 100)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>RIR+</div>
            <div>+{progressionRule.deloadProtocol.rirAdd}</div>
          </div>
        </div>
      </div>

      <div className="card volume-table">
        <h3>Объем (подходы/нед) для MV-MRV</h3>
        <div className="grid volume-grid">
          {Object.entries(trainingResult.volumePerGroup).map(([g, v]) => (
            <div key={g} className={`volume-item ${weakPoints.includes(g) ? 'accent' : ''}`}>
              <span className="label">{g}</span>
              <span className="value">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {!macrocycle && (
        <div className="card week-plan">
          <p>{trainingResult.weekPlan}</p>
          {localPlan.map((day, dayIndex) => (
            <div key={day.day} className="day-block">
              <div className="day-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>{day.day} день {day.name}</h4>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => {
                    setClipboardDay(day.exercises);
                  }} style={{ padding: '2px 8px', fontSize: 10 }}>Копировать</button>
                  {clipboardDay && (
                    <button onClick={() => {
                      const newPlan = [...localPlan];
                      newPlan[dayIndex].exercises = [...clipboardDay];
                      setLocalPlan(newPlan);
                    }} style={{ padding: '2px 8px', fontSize: 10 }}>Вставить</button>
                  )}
                </div>
              </div>
              {day.exercises.length === 0 ? (
                <p>Отдых, восстановление, массаж</p>
              ) : (
                <table className="exercise-table">
                  <thead>
                    <tr><th></th><th>Упражнение</th><th>Подходы</th><th>Повторения</th><th>RIR</th><th>Отдых</th><th>Темп</th><th>Вес</th></tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((ex: Exercise, i: number) => (
                      <tr key={i}>
                        <td style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => {
                            const newPlan = [...localPlan];
                            const exercises = newPlan[dayIndex].exercises;
                            if(i > 0) {
                                [exercises[i], exercises[i-1]] = [exercises[i-1], exercises[i]];
                                setLocalPlan(newPlan);
                            }
                          }}>↑</button>
                          <button onClick={() => {
                            const newPlan = [...localPlan];
                            const exercises = newPlan[dayIndex].exercises;
                            if(i < exercises.length - 1) {
                                [exercises[i], exercises[i+1]] = [exercises[i+1], exercises[i]];
                                setLocalPlan(newPlan);
                            }
                          }}>↓</button>
                        </td>
                        <td style={{ maxWidth: 180 }}>
                          <div style={{ fontWeight: 600 }}>{ex.name}</div>
                          {ex.targetMuscle && <div style={{ fontSize: 10 }}>{ex.targetMuscle}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <input type="number" value={ex.sets || 0} onChange={(e) => updateExercise(dayIndex, i, 'sets', parseInt(e.target.value))} style={{width: 30}} />
                            <select 
                              style={{ fontSize: 9, width: 50 }} 
                              onChange={(e) => {
                                const preset = SET_PRESETS[e.target.value];
                                if (preset) {
                                  updateExercise(dayIndex, i, 'sets', preset.sets);
                                  updateExercise(dayIndex, i, 'reps', preset.reps);
                                }
                              }}
                              value=""
                            >
                              <option value="" disabled>Шаблон</option>
                              {Object.entries(SET_PRESETS).map(([name, val]) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <input type="number" value={ex.reps || 0} onChange={(e) => updateExercise(dayIndex, i, 'reps', parseInt(e.target.value))} style={{width: 30}} />
                        </td>
                        <td>{ex.rir}</td>
                        <td>{ex.rest}</td>
                        <td>
                          {(() => {
                            const isCompound = ['chest','back','quads','hamstrings','shoulders','legs'].includes(ex.group?.toLowerCase() || ex.targetMuscle?.toLowerCase() || '');
                            const tKey = recommendTempo(goalState, isCompound ? 'compound' : 'isolation');
                            const preset = TEMPO_PRESETS[tKey];
                            return <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }} title={preset?.nameRu}>{formatTempo(preset?.tempo)}</span>;
                          })()}</td>
                        <td>
                          <input type="number" value={ex.weight || 0} onChange={(e) => updateExercise(dayIndex, i, 'weight', parseFloat(e.target.value))} style={{width: 40}} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {!macrocycle && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Генерация макроцикла (опционально)</h3>
          <button onClick={() => setMacrocycle(null as any)} style={{ width: '100%', padding: 8 }}>
            Создать макроцикл
          </button>
        </div>
      )}

      {macrocycle && (
        <>
          <button onClick={() => setMacrocycle(null)} style={{ background: 'var(--danger)', color: '#fff', marginBottom: 12 }}>Отмена макроцикла</button>
          <div className="card">
            <h4>Макроцикл ({macrocycle.totalWeeks} нед.)</h4>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
              {macrocycle.mesocycles.map((meso: any) => (
                <div key={meso.type}>
                  {Array.from({ length: meso.weeks }, (_: any, i: number) => {
                    const wk = meso.microcycles[i];
                    return (
                      <div key={wk.weekNumber} onClick={() => setSelectedWeek(wk.weekNumber)} style={{ padding: 4, borderRadius: 4, fontSize: 10 }}>
                        <div>Нед {wk.weekNumber}</div>
                        <div>{wk.isDeload ? '' : meso.type}</div>
                        <div>RIR {wk.rirRange.join('-')}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
