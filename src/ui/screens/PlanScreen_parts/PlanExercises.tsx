import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { GROUP_LABELS, MUSCLE_GROUPS } from './PlanConstants';

export const PlanExercises: React.FC = () => {
  const exerciseGroups = React.useMemo(() => {
    const groups: Record<string, typeof EXERCISE_CATALOG> = {};
    for (const ex of EXERCISE_CATALOG) {
      if (!groups[ex.group]) groups[ex.group] = [];
      groups[ex.group].push(ex);
    }
    return groups;
  }, []);

  return (
    <div className="plan-exercises">
      {Object.entries(exerciseGroups).map(([group, exercises]) => (
        <div key={group} className="card exercise-group">
          <h3>{GROUP_LABELS[group] || group}</h3>
          {exercises.map((ex: any, i: number) => (
            <div key={i} style={{ padding: '8px 10px', marginBottom: 4, background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{ex.name}</span>
                  <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: ex.type === 'compound' ? 'rgba(0,230,138,0.12)' : 'rgba(100,150,255,0.12)' }}>
                    {ex.type === 'compound' ? '' : ''}
                  </span>
                </div>
                <span style={{ fontSize: 10 }}>{ex.equipment} | {ex.difficulty} | {ex.jointStress}</span>
              </div>
              {ex.targetMuscle && <div style={{ fontSize: 11, color: 'var(--accent)' }}>{ex.targetMuscle}</div>}
              {ex.technique && <div style={{ fontSize: 11, marginTop: 2 }}>{ex.technique}</div>}
              {ex.comments && <div style={{ fontSize: 10, marginTop: 2 }}>{ex.comments}</div>}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {ex.pauseSeconds && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(234,179,8,0.12)' }}>РџР°СѓР·Р° {ex.pauseSeconds}СЃ</span>}
                {ex.peakContraction && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.12)' }}>РџРёРє СЃРѕРєСЂР°С‰РµРЅРёСЏ</span>}
                {ex.stretchPhase && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.12)' }}>Р Р°СЃС‚СЏР¶РєР°</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
