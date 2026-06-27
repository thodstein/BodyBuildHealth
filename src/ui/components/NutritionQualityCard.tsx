import React, { useMemo, useState } from 'react';
import { analyzeNutrition } from '../../engines/score-nutrition';
import type { ModuleResult } from '../../engines/score-engine';

interface NutritionQualityCardProps {
  meals: Array<{ foods: Array<{ id: string; name: string; grams: number; protein: number; fat: number; carbs: number; kcal: number; fiber: number }> }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  goal?: 'cut' | 'maintain' | 'bulk';
  activityLevel?: 'low' | 'moderate' | 'high';
}

const G: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: 10,
};
const LEVEL_META: Record<string, { icon: string; color: string }> = {
  low: { icon: '🟢', color: '#22c55e' },
  moderate: { icon: '🟡', color: '#fbbf24' },
  high: { icon: '🔴', color: '#ef4444' },
};

export const NutritionQualityCard: React.FC<NutritionQualityCardProps> = ({ meals, weight, age, sex, goal, activityLevel }) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo<ModuleResult>(() => analyzeNutrition({ meals, weight, age, sex, goal, activityLevel }), [meals, weight, age, sex, goal, activityLevel]);
  if (meals.length === 0 || meals.every(m => m.foods.length === 0)) return null;
  const overall = result.overallRaw;
  const details = result.details as any;
  const display = expanded ? result.systems : result.systems.slice(0, 4);

  return (
    <div style={{ ...G, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        🥗 Качество питания
        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
          background: overall >= 60 ? 'rgba(239,68,68,0.15)' : overall >= 30 ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
          color: overall >= 60 ? '#ef4444' : overall >= 30 ? '#fbbf24' : '#22c55e',
        }}>{overall}%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {display.map(sys => {
          const meta = LEVEL_META[sys.level];
          return (
            <div key={sys.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9 }}>{sys.icon}</span>
              <span style={{ fontSize: 8, color: 'var(--text)', flex: 1 }}>{sys.label}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: meta.color }}>{sys.weightedScore}%</span>
              <div style={{ width: 40, height: 3, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(sys.weightedScore, 100)}%`, background: meta.color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
      {result.systems.length > 4 && (
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 8, cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>
          {expanded ? '▲ Свернуть' : `▼ Ещё ${result.systems.length - 4} измерений`}
        </button>
      )}
      {details && (
        <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 3 }}>{details.calories}/{details.tdee} ккал · Б {details.protein}г · Ж {details.fat}г · У {details.carbs}г · {details.fiber}г клетчатки</div>
      )}
      {result.recommendations.length > 0 && (
        <div style={{ fontSize: 8, color: '#fbbf24', marginTop: 4 }}>{result.recommendations[0]}</div>
      )}
    </div>
  );
};

export default NutritionQualityCard;
