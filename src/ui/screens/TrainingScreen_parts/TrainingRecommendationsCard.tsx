import React, { useMemo } from 'react';
import { generateTrainingRecommendations, type TrainingRecommendation } from '../../../engines/training-recommendations.engine';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const SEV: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  info: { color: '#60a5fa', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', icon: 'ℹ️' },
  warn: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', icon: '⚠️' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)', icon: '🔴' },
};

export const TrainingRecommendationsCard: React.FC<{
  historyWorkouts: WorkoutLog[];
  level: string;
  weakPoints: string[];
  readinessHistory?: { date: string; recovery: number }[];
  acwr?: number;
  nutrition?: { kcal: number; protein: number; fat: number; carbs: number };
  bodyWeight?: number;
  labAnalysis?: { liverStress: number; cardioRisk: number; inflammation: number; kidneyStress: number; hormoneScore: number; homaIR: number | null };
  onCourse?: boolean;
  courseIntensity?: string;
}> = ({ historyWorkouts, level, weakPoints, readinessHistory, acwr, nutrition, bodyWeight, labAnalysis, onCourse, courseIntensity }) => {
  const recs: TrainingRecommendation[] = useMemo(
    () => generateTrainingRecommendations({ historyWorkouts, level, weakPoints, readinessHistory, acwr, nutrition, bodyWeight, labAnalysis, onCourse, courseIntensity }),
    [historyWorkouts, level, weakPoints, readinessHistory, acwr, nutrition, bodyWeight, labAnalysis, onCourse, courseIntensity]
  );
  const hasAlert = recs.some(r => r.severity !== 'info');

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid ' + (hasAlert ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'), marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: hasAlert ? '#f59e0b' : ACCENT, marginBottom: 8 }}>🤖 Рекомендации по тренировкам</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recs.map(r => {
          const s = SEV[r.severity];
          return (
            <div key={r.id} style={{ padding: '8px 10px', borderRadius: 8, background: s.bg, border: '1px solid ' + s.border, fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: s.color }}>{s.icon} </span>{r.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrainingRecommendationsCard;