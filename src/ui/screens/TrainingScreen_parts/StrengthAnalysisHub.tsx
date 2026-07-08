/** StrengthAnalysisHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: 1RM, VBT, Относит., Нормативы, Аналитика.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { OneRmCalcTab } from './OneRmCalcTab';
import { VBTCalcTab } from './VBTCalcTab';
import { RelativeStrengthCalcTab } from './RelativeStrengthCalcTab';
import { PlNormsCalcTab } from './PlNormsCalcTab';
import { StrengthAnalyticsCard } from './StrengthAnalyticsCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type StrengthAnalysisHubMode = '1rm' | 'vbt' | 'relstr' | 'norms' | 'analytics';

const MODE_DEFS: Array<{ m: StrengthAnalysisHubMode; label: string; icon: string }> = [
  { m: '1rm', label: '1RM', icon: '🎯' },
  { m: 'vbt', label: 'VBT', icon: '⚡' },
  { m: 'relstr', label: 'Относит.', icon: '⚖️' },
  { m: 'norms', label: 'Нормативы', icon: '📋' },
  { m: 'analytics', label: 'Аналитика', icon: '📊' }
];

export const StrengthAnalysisHub: React.FC = () => {
  const [mode, setMode] = useState<StrengthAnalysisHubMode>('1rm');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🏋️ Анализ силы</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>Оценка максимума, скорость штанги, относительная сила, нормативы и аналитика прогресса.</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon }) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 16px', borderRadius: 8,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === '1rm' && <OneRmCalcTab />}
      {mode === 'vbt' && <VBTCalcTab />}
      {mode === 'relstr' && <RelativeStrengthCalcTab />}
      {mode === 'norms' && <PlNormsCalcTab />}
      {mode === 'analytics' && <StrengthAnalyticsCard />}
    </div>
  );
};

export default StrengthAnalysisHub;
