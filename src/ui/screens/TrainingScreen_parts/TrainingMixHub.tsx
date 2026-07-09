/** TrainingMixHub.tsx — унифицированный калькулятор тренировочных миксов.
 * Объединяет: Пресеты (готовые составы по цели) + Калькулятор (скоринг с учётом курса/лаб).
 * Структура как в других хабах (ExerciseLab и т.д.). */
import React, { useState } from 'react';
import { MixPresetsCard } from './MixPresetsCard';
import { TrainingMixTab } from './TrainingMixTab';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

type MixMode = 'presets' | 'calculator';

const MODE_DEFS: Array<{ m: MixMode; label: string; icon: string }> = [
  { m: 'presets', label: 'Пресеты', icon: '🧪' },
  { m: 'calculator', label: 'Калькулятор', icon: '📊' },
];

export const TrainingMixHub: React.FC = () => {
  const [mode, setMode] = useState<MixMode>('presets');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🧪 Тренировочные миксы</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 12 }}>
        Готовые пресеты (pre/intra/post по цели) и продвинутый калькулятор миксов с скорингом, учётом курса и лабораторных данных.
      </div>

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

      {mode === 'presets' && <MixPresetsCard />}
      {mode === 'calculator' && <TrainingMixTab />}
    </div>
  );
};

export default TrainingMixHub;