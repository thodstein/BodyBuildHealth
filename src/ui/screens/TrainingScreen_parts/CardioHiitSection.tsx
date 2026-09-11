/**
 * CardioHiitSection.tsx — именные HIIT-протоколы (P0-4): Norwegian 4×4,
 * Billat 30-30, Tabata. Калибровка (HRmax / 6-мин тест) + кнопка
 * «＋ В неделю 1» → onAdd(presetId, opts). Сессия собирается родителем.
 */
import React, { useState } from 'react';
import { CARDIO_INTERVAL_PRESETS } from '../../../engines/lms/cardio-interval-presets.engine';
import { CARD, ROW, LABEL, BTN_PRIMARY, HINT_SM, NumberInput } from './CardioUI';

export const CardioHiitSection: React.FC<{
  onAdd: (presetId: string, opts: { hrMax?: number; sixMinDistanceM?: number }) => void;
  disabled?: boolean;
}> = ({ onAdd, disabled }) => {
  const [hrMax, setHrMax] = useState('');
  const [sixMin, setSixMin] = useState('');
  const opts = () => ({
    hrMax: Number(hrMax) >= 120 && Number(hrMax) <= 220 ? Math.round(Number(hrMax)) : undefined,
    sixMinDistanceM: Number(sixMin) > 500 && Number(sixMin) < 5000 ? Math.round(Number(sixMin)) : undefined,
  });
  return (
    <div style={CARD}>
      <div style={LABEL}>⚡ HIIT-протоколы</div>
      <div style={HINT_SM}>4×4 — по HRmax; 30-30 — по 6-мин тесту (дистанция/12 на отрезок); Tabata — только вело/гребля. Сессия добавляется в неделю 1.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <NumberInput label="HRmax" value={hrMax} onChange={setHrMax} min={120} max={220} step={1} placeholder="190" ariaLabel="HRmax для 4×4" width={90} suffix="уд/мин" />
        <NumberInput label="6-мин тест" value={sixMin} onChange={setSixMin} min={500} max={5000} step={10} placeholder="1720" ariaLabel="Дистанция 6-мин теста" width={100} suffix="м" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
        {CARDIO_INTERVAL_PRESETS.map(p => (
          <div key={p.id} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{p.title}</div>
            <div style={{ fontSize: 11.5, color: '#fff', lineHeight: 1.5 }}>{p.protocol}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{p.calibration} · {p.frequency}</div>
            <div style={ROW}>
              <button style={{ ...BTN_PRIMARY, minHeight: 44, flex: 1 }} disabled={disabled} onClick={() => onAdd(p.id, opts())}
                aria-label={`Добавить ${p.title} в неделю 1`}>＋ В неделю 1</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
