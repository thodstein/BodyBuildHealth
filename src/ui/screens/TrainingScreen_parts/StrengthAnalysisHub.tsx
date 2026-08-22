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

const MODE_DEFS: Array<{ m: StrengthAnalysisHubMode; label: string; icon: string; desc?: string }> = [
  { m: '1rm', label: '1RM', icon: '🎯', desc: '7 формул, консенсус' },
  { m: 'vbt', label: 'VBT', icon: '⚡', desc: 'Скорость штанги' },
  { m: 'relstr', label: 'Отн. сила', icon: '⚖️', desc: '×BW по движениям + DOTS' },
  { m: 'norms', label: 'Единый', icon: '🏆', desc: 'Нормативы+очки+категория' },
  { m: 'analytics', label: 'Аналитика', icon: '📊', desc: 'Процентили, объёмы' }
];

export const StrengthAnalysisHub: React.FC<{ initialMode?: StrengthAnalysisHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<StrengthAnalysisHubMode>(initialMode ?? '1rm');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🏋️ Анализ силы — единый центр</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>1RM</b> (7 формул, консенсус) + <b style={{ color: '#fff' }}>VBT</b> (скорость штанги) + <b style={{ color: '#fff' }}>Отн. сила</b> (×BW + DOTS/Wilks/IPF GL) + <b style={{ color: '#fff' }}>Единый</b> (нормативы по полу/категории/федерации + очки + прогресс) + <b style={{ color: '#fff' }}>Аналитика</b> — один расчёт, детализация той же модели (канон <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>estimate1rm + relative-strength + pl-norms</code>).
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc || ''} style={{
            padding: '8px 12px', borderRadius: 8,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 64,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
            {desc && <span style={{ fontSize: 8, color: mode === m ? ACCENT : 'rgba(255,255,255,0.35)', fontWeight: 400 }}>{desc}</span>}
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
