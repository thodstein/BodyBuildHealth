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
  if (!trainingResult) return <div>Р—Р°РіСЂСѓР·РєР°...</div>;

  const rirForGoal = getRIR(goalState, level, trainingResult.isDeload);

  return (
    <div className="plan-training">
      <div className="card input-form">
        <h3>РќР°СЃС‚СЂРѕР№РєРё С‚СЂРµРЅРёСЂРѕРІРѕРє</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Р¦РµР»СЊ</label>
            <select value={goalState} onChange={(e) => {}} disabled>
              <option value="bulk">РќР°Р±РѕСЂ РјС‹С€РµС‡РЅРѕР№ РјР°СЃСЃС‹</option>
              <option value="cut">РЎСѓС€РєР°</option>
              <option value="maintenance">РџРѕРґРґРµСЂР¶Р°РЅРёРµ</option>
              <option value="strength">РЎРёР»Р°</option>
              <option value="recomp">РџРµСЂРµРєРѕРјРїРѕР·РёС†РёСЏ</option>
              <option value="rehab">Р РµР°Р±РёР»РёС‚Р°С†РёСЏ</option>
            </select>
          </div>
          <div className="form-group">
            <label>РЈСЂРѕРІРµРЅСЊ</label>
            <select value={level} onChange={(e) => {}} disabled>
              <option value="beginner">РќР°С‡РёРЅР°СЋС‰РёР№</option>
              <option value="intermediate">РЎСЂРµРґРЅРёР№</option>
              <option value="advanced">РџСЂРѕРґРІРёРЅСѓС‚С‹Р№</option>
            </select>
          </div>
          <div className="form-group">
            <label>Р”РЅРµР№/РЅРµРґРµР»СЋ: {daysPerWeek}</label>
            <input type="range" min={2} max={6} value={daysPerWeek} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ: {recovery}%</label>
            <input type="range" min={0} max={100} value={recovery} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>РЈСЃС‚Р°Р»РѕСЃС‚СЊ: {fatigue ?? 0}%</label>
            <input type="range" min={0} max={100} value={fatigue ?? 0} onChange={(e) => {}} disabled />
          </div>
          <div className="form-group">
            <label>РџРёС‚Р°РЅРёРµ: {nutritionScore ?? 0}%</label>
            <input type="range" min={0} max={100} value={nutritionScore ?? 0} onChange={(e) => {}} disabled />
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Р”РЅРё СЃР»Р°Р±С‹С… РјРµСЃС‚: {weakPoints.map(g => g).join(', ') || ''}
        </div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          PAL: {palForDisplay} | РўСЂРµРЅРёСЂРѕРІРєРё: {daysPerWeek}/РЅРµРґ | Р’СЂРµРјСЏ: {avgWorkoutMinutes ?? 60} РјРёРЅ
        </div>
      </div>

      <div className="card summary">
        <h3>{trainingResult.splitName}</h3>
        <p>{trainingResult.splitDesc}</p>
        <div className="row"><span className="label">RIR</span><span className="value">{rirForGoal}</span></div>
        <div className="row"><span className="label">PAL</span><span className="value">{palForDisplay}</span></div>
        <div className="row"><span className="label">РџСЂРѕРіСЂРµСЃСЃРёСЏ</span><span>{progressionRule.name}</span></div>
        {trainingResult.isDeload && (
          <div className="deload-badge" style={{ background: 'var(--warning, #f90)', padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
            Р”РµР»РѕРі: {trainingResult.deloadReason}
          </div>
        )}
        {deloadRec.shouldDeload && (
          <div style={{ background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: 6, marginTop: 8 }}>
            Р РµРєРѕРјРµРЅРґР°С†РёСЏ: {deloadRec.reason}
          </div>
        )}
      </div>

      {splitOptions && splitOptions.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Р’Р°СЂРёР°РЅС‚С‹ СЃРїР»РёС‚Р°</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {splitOptions.map((split: SplitCandidate, idx: number) => (
              <div key={idx} style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: bestSplit && split.id === bestSplit.id ? '1px solid var(--accent)' : 'none' }}>
                <div style={{ fontWeight: 600 }}>{split.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatSplitGroups(split.groupsPerDay)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11 }}>
                  <span>РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ: {Math.round(split.score * 100)}%</span>
                  <span>Р’РѕСЃСЃС‚.: {Math.round(split.score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>РџСЂРѕРіСЂРµСЃСЃРёСЏ: {progressionRule.name}</h3>
        <div>{progressionRule.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>Р’РµСЃ/РЅРµРґРµР»СЋ</div>
            <div>{progressionRule.weeklyWeightIncrement} РєРі</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>Р”РµР»РѕРі</div>
            <div>{progressionRule.deloadTrigger.plateauWeeks} РЅРµРґ</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>РћР±СЉРµРј</div>
            <div>{Math.round(progressionRule.deloadProtocol.volumeMultiplier * 100)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px' }}>
            <div>RIR+</div>
            <div>+{progressionRule.deloadProtocol.rirAdd}</div>
          </div>
        </div>
      </div>

      <div className="card volume-table">
        <h3>РћР±СЉРµРј (РїРѕРґС…РѕРґС‹/РЅРµРґ) РґР»СЏ MV-MRV</h3>
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
              <h4>{day.day} РґРµРЅСЊ {day.name}</h4>
              {day.exercises.length === 0 ? (
                <p>РћС‚РґС‹С…, РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ, РјР°СЃСЃР°Р¶</p>
              ) : (
                <table className="exercise-table">
                  <thead>
                    <tr><th>РЈРїСЂР°Р¶РЅРµРЅРёРµ</th><th>РџРѕРґС…РѕРґС‹</th><th>РџРѕРІС‚РѕСЂРµРЅРёСЏ</th><th>RIR</th><th>РћС‚РґС‹С…</th><th>Р’РµСЃ</th></tr>
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
          <h3>Р“РµРЅРµСЂР°С†РёСЏ РјР°РєСЂРѕС†РёРєР»Р° (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)</h3>
          <button onClick={() => setMacrocycle(null as any)} style={{ width: '100%', padding: 8 }}>
            РЎРѕР·РґР°С‚СЊ РјР°РєСЂРѕС†РёРєР»
          </button>
        </div>
      )}

      {macrocycle && (
        <>
          <button onClick={() => setMacrocycle(null)} style={{ background: 'var(--danger)', color: '#fff', marginBottom: 12 }}>РћС‚РјРµРЅР° РјР°РєСЂРѕС†РёРєР»Р°</button>
          <div className="card">
            <h4>РњР°РєСЂРѕС†РёРєР» ({macrocycle.totalWeeks} РЅРµРґ.)</h4>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
              {macrocycle.mesocycles.map((meso: any) => (
                <div key={meso.type}>
                  {Array.from({ length: meso.weeks }, (_: any, i: number) => {
                    const wk = meso.microcycles[i];
                    return (
                      <div key={wk.weekNumber} onClick={() => setSelectedWeek(wk.weekNumber)} style={{ padding: 4, borderRadius: 4, fontSize: 10 }}>
                        <div>РќРµРґ {wk.weekNumber}</div>
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
