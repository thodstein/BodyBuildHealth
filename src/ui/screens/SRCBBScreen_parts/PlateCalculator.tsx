/**
 * PlateCalculator.tsx — T4: калькулятор блинов для рабочего веса (Этап INT2).
 * REUSE gym-competition.engine: calculatePlates / getPlateLoadingOrder / warmupPlateSequence.
 * Mobile-first, dark theme, green accent. Самодостаточный компонент (стили локальные).
 */
import React, { useMemo, useState } from 'react';
import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence, WeightUnit } from '../../../engines/gym-competition.engine';
import { PopupNumber } from './TrainingPopups';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '6px 0 3px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

const BAR_PRESETS: Record<string, { kg: number; lbs: number }> = {
  'olympic': { kg: 20, lbs: 44 },
  'weightlifting': { kg: 15, lbs: 33 },
  'ez_bar': { kg: 10, lbs: 22 },
  'standard': { kg: 12.5, lbs: 27 },
};

export interface PlateCalculatorProps {
  initialWeight?: number;
  barWeight?: number;
}

export const PlateCalculator: React.FC<PlateCalculatorProps> = ({ initialWeight = 100, barWeight = 20 }) => {
  const [weight, setWeight] = useState<number>(initialWeight);
  const [bar, setBar] = useState<number>(barWeight);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [barPreset, setBarPreset] = useState<string>('olympic');

  React.useEffect(() => { if (initialWeight > 0) setWeight(initialWeight); }, [initialWeight]);

  const handlePresetChange = (preset: string) => {
    setBarPreset(preset);
    setBar(BAR_PRESETS[preset][unit]);
  };

  const plates = useMemo(() => calculatePlates(weight, bar, unit), [weight, bar, unit]);
  const order = useMemo(() => getPlateLoadingOrder(weight, bar), [weight, bar]);
  const warmup = useMemo(() => warmupPlateSequence(weight), [weight]);

  const devColor = Math.abs(plates.deviation) < 0.5 ? ACCENT : Math.abs(plates.deviation) > 2 ? '#ef4444' : '#f59e0b';

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {(['kg', 'lbs'] as WeightUnit[]).map(u => (
            <button 
              key={u} 
              onClick={() => setUnit(u)} 
              style={{ 
                flex: 1, padding: '6px', borderRadius: 6, border: 'none', 
                background: unit === u ? ACCENT : 'rgba(255,255,255,0.1)', 
                color: unit === u ? '#000' : '#fff', fontWeight: 600, cursor: 'pointer' 
              }}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PopupNumber label="Рабочий вес" value={weight} min={bar} max={1000} suffix={` ${unit}`} hint="Целевой вес штанги на рабочем подходе." onChange={v => setWeight(Math.max(0, v))} />
        <PopupNumber label="Гриф" value={bar} min={5} max={100} suffix={` ${unit}`} hint="Вес пустого грифа." onChange={v => setBar(Math.max(5, v))} />
      </div>
      
      <div style={{ marginTop: 8, display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
        {Object.entries(BAR_PRESETS).map(([key, val]) => (
          <button 
            key={key} 
            onClick={() => handlePresetChange(key)} 
            style={{ 
              padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', 
              background: barPreset === key ? 'rgba(0,230,138,0.2)' : 'transparent', 
              color: barPreset === key ? ACCENT : '#fff', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {key === 'olympic' ? 'Олимпийский' : key === 'weightlifting' ? 'Тяжёлая атл.' : key === 'ez_bar' ? 'EZ-гриф' : 'Стандарт'}
          </button>
        ))}
      </div>

      <div style={CARD}>
        <div style={H}>🧮 Раскладка блинов</div>
        {plates.platesPerSide.length === 0 ? (
          <div style={SMALL}>Вес {weight} {unit} ≤ гриф {bar} {unit} — блины не нужны.</div>
        ) : (
          <>
            <div style={ROW}><span>На сторону:</span><span style={{ color: ACCENT, fontWeight: 700 }}>
              {plates.platesPerSide.map(p => `${p.plate}×${p.count}`).join(' + ')}
            </span></div>
            <div style={ROW}><span>Всего блинов:</span><span>{plates.totalPlates} шт</span></div>
            <div style={ROW}><span>Фактический вес:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{plates.actualWeight} {unit}</span></div>
            <div style={ROW}><span>Отклонение:</span><span style={{ color: devColor, fontWeight: 700 }}>
              {plates.deviation > 0 ? '+' : ''}{plates.deviation.toFixed(2)} {unit}
            </span></div>
          </>
        )}
      </div>

      <div style={CARD}>
        <div style={H}>📐 Порядок навешивания</div>
        {order.map((s, i) => <div key={i} style={{ ...SMALL, padding: '2px 0' }}>{s}</div>)}
      </div>

      <div style={CARD}>
        <div style={H}>🔥 Разминка к рабочему весу</div>
        {warmup.map(w => (
          <div key={w.set} style={ROW}>
            <span>Сет {w.set}: <b style={{ color: ACCENT }}>{w.weight} {unit}</b> × {w.reps}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{w.plates} · отдых {w.restMin} мин</span>
          </div>
        ))}
        <div style={{ ...SMALL, marginTop: 6 }}>Рабочий: <b style={{ color: ACCENT }}>{weight} {unit}</b></div>
      </div>
    </div>
  );
};

export default PlateCalculator;
