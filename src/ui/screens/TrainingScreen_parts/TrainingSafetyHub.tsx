import React, { useMemo } from 'react';
import { analyzeTrainingSafety } from '../../../engines/training-safety.engine';
import type { TrainingSafetyInput, TrainingSafetyReport } from '../../../engines/training-safety.types';

const COLORS = { safe: '#22c55e', caution: '#f59e0b', dangerous: '#ef4444', blocked: '#dc2626' } as const;
const LABELS = { safe: 'Безопасно', caution: 'Требует внимания', dangerous: 'Опасно', blocked: 'Заблокировано' } as const;

export interface TrainingSafetyHubProps {
  input: TrainingSafetyInput;
  compact?: boolean;
  onReport?: (report: TrainingSafetyReport) => void;
}

export const TrainingSafetyHub: React.FC<TrainingSafetyHubProps> = ({ input, compact = false, onReport }) => {
  const report = useMemo(() => analyzeTrainingSafety(input), [input]);
  React.useEffect(() => { onReport?.(report); }, [onReport, report]);
  const color = COLORS[report.level];
  const critical = report.issues.filter(issue => issue.severity === 'critical');
  const warnings = report.issues.filter(issue => issue.severity === 'warning');

  return (
    <section aria-label="Единая безопасность тренировок" style={{ marginTop: 8, padding: 10, borderRadius: 12, border: `1px solid ${color}55`, background: `${color}0d`, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>🛡 Безопасность тренировки</div>
        <div style={{ color, fontSize: 13, fontWeight: 800 }}>{report.score}/100 · {LABELS[report.level]}</div>
      </div>
      {critical.length > 0 && (
        <div role="alert" style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(220,38,38,0.14)', color: '#fca5a5', fontSize: 11 }}>
          <b>Критические ограничения:</b>
          {critical.slice(0, compact ? 2 : 5).map(issue => <div key={`${issue.code}-${issue.exerciseId || issue.message}`}>• {issue.message}</div>)}
        </div>
      )}
      {warnings.length > 0 && !compact && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#fbbf24', lineHeight: 1.4 }}>
          {warnings.slice(0, 6).map(issue => <div key={`${issue.code}-${issue.exerciseId || issue.message}`}>⚠ {issue.message}</div>)}
        </div>
      )}
      {!compact && report.recommendations.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          <b>Рекомендации:</b>
          {report.recommendations.slice(0, 5).map((recommendation, index) => <div key={index}>• {recommendation}</div>)}
        </div>
      )}
      {report.adjustments.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#93c5fd' }}>
          Корректировки: {report.adjustments.map(adjustment => `${adjustment.kind}=${adjustment.value}`).join(' · ')}
        </div>
      )}
    </section>
  );
};

export default TrainingSafetyHub;
