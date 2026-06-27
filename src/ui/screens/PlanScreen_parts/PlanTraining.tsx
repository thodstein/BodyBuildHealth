import React from 'react';
import type { TrainingOutput, Exercise } from '../../../core/types';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import type { SplitCandidate } from '../../../engines/split-selector.engine';
import type { ProgressionRule } from '../../../engines/progression.engine';
import { calcSuggestedWeight } from '../../../engines/progression.engine';
import { getExerciseById } from '../../../core/exercise-catalog';
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
          {buildDayPlan(trainingResult, daysPerWeek, weakPoints, bestSplit?.groupsPerDay).map((day) => (
            <div key={day.day} className="day-block">
              <h4>{day.day} день {day.name}</h4>
              {day.exercises.length === 0 ? (
                <p>Отдых, восстановление, массаж</p>
              ) : (
                <table className="exercise-table">
                  <thead>
                    <tr><th>Упражнение</th><th>Подходы</th><th>Повторения</th><th>RIR</th><th>Отдых</th><th>Вес</th></tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((ex: Exercise, i: number) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 180 }}>
                          <div style={{ fontWeight: 600 }}>{ex.name}</div>
                          {ex.targetMuscle && <div style={{ fontSize: 10 }}>{ex.targetMuscle}</div>}
                        </td>
                        <td>{ex.sets}</td>
                        <td>{ex.reps}</td>
                        <td>{ex.rir}</td>
                        <td>{ex.rest}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>?</div>
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
