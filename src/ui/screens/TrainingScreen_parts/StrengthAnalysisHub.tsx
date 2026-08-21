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

export const StrengthAnalysisHub: React.FC = () => {
  const [mode, setMode] = useState<StrengthAnalysisHubMode>('1rm');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🏋️ Анализ силы — единый центр</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Оценка максимума, скорость штанги, относительная сила, нормативы и аналитика. <b style={{ color: '#fff' }}>Вкладка «Единый»</b> — главный калькулятор разрядных нормативов: собраны все инструменты из приложения (нормативы по полу/категории/федерации + DOTS/Wilks/IPF GL + прогресс-бары + пояснения к каждому графику). Остальные вкладки — детализация той же модели (VBT, 1RM, аналитика).
        <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)', color: '#f59e0b', fontSize: 9 }}>План: если «Единый» покрывает все сценарии, старые разрозненные калькуляторы (Отн. сила отдельно, Нормативы отдельно) будут убраны — решение по итогу тестирования.</span>
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
