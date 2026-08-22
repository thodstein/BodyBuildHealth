/** RirForecastHub.tsx — единый хаб RIR-калибровки + прогноза готовности.
 * Объединяет: RIRCalibrationCard (bias/коррекция RIR из дневника) + ReadinessForecastCard (Хольт-прогноз).
 * Структура как в MixHub / VolumeHub / PeriodizationTaperHub — единый расчёт, без дублей. */
import React, { useState } from 'react';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import { ReadinessForecastCard } from './ReadinessForecastCard';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type RirForecastHubMode = 'rir' | 'forecast';

const MODE_DEFS: Array<{ m: RirForecastHubMode; label: string; icon: string; desc: string }> = [
  { m: 'rir', label: 'RIR калибратор', icon: '🎯', desc: 'Bias RPE/RIR, топ-5 отклонений, коррекция плана' },
  { m: 'forecast', label: 'Прогноз', icon: '🔮', desc: 'Хольт-линия готовности, 95% ДИ, история' },
];

export const RirForecastHub: React.FC<{ initialMode?: RirForecastHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<RirForecastHubMode>(initialMode ?? 'rir');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🎯 RIR + Прогноз — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>RIR-калибратор</b> (факт RPE vs план RIR → bias и сдвиг RIR) + <b style={{ color: '#fff' }}>прогноз готовности</b> (Хольт, 3+ дня истории → 95% ДИ) — в одном месте. Ранее разнесены в `rir_calibration` и `readiness_forecast` с дублем логики дневника — теперь единый расчёт. Источники: Helms RPE/RIR, Zatsiorsky, Holt (1957) — без выдумок.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «RIR» — на сколько вы переоцениваете/недооцениваете RIR (bias, консистентность, топ-5). «Прогноз» — куда уйдёт готовность через 1-4 дня (Хольт, ДИ, предупреждения). Оба читают дневник (RPE/готовность) — единый источник.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
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

      {mode === 'rir' && <RIRCalibrationCard />}
      {mode === 'forecast' && <ReadinessForecastCard />}
    </div>
  );
};

export default RirForecastHub;
