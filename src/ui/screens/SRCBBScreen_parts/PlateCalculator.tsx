/**
 * PlateCalculator.tsx — T4: калькулятор блинов для рабочего веса (Этап INT2).
 * REUSE gym-competition.engine: calculatePlates / getPlateLoadingOrder / warmupPlateSequence.
 * Mobile-first, dark theme, green accent. Самодостаточный компонент (стили локальные).
 */
import React, { useMemo, useState } from 'react';
import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence } from '../../../engines/gym-competition.engine';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '6px 0 3px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

export interface PlateCalculatorProps {
  /** Начальный рабочий вес (кг). Если нет — 100. */
  initialWeight?: number;
  /** Вес грифа (кг), по умолчанию 20. */
  barWeight?: number;
}

export const PlateCalculator: React.FC<PlateCalculatorProps> = ({ initialWeight = 100, barWeight = 20 }) => {
  const [weight, setWeight] = useState<number>(initialWeight);
  const [bar, setBar] = useState<number>(barWeight);

  // Пересчёт при изменении initialWeight извне (например, при выборе упражнения из плана)
  React.useEffect(() => { if (initialWeight > 0) setWeight(initialWeight); }, [initialWeight]);

  const plates = useMemo(() => calculatePlates(weight, bar), [weight, bar]);
  const order = useMemo(() => getPlateLoadingOrder(weight, bar), [weight, bar]);
  const warmup = useMemo(() => warmupPlateSequence(weight), [weight]);

  const devColor = Math.abs(plates.deviation) < 0.5 ? ACCENT : Math.abs(plates.deviation) > 2 ? '#ef4444' : '#f59e0b';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={LABEL}>Рабочий вес, кг</div>
          <input style={IN} type="number" min={bar} max={500} value={weight || ''} onChange={e => setWeight(Math.max(0, +e.target.value))} />
        </div>
        <div>
          <div style={LABEL}>Гриф, кг</div>
          <input style={IN} type="number" min={5} max={30} value={bar || ''} onChange={e => setBar(Math.max(5, +e.target.value))} />
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>🧮 Раскладка блинов</div>
        {plates.platesPerSide.length === 0 ? (
          <div style={SMALL}>Вес {weight} кг ≤ гриф {bar} кг — блины не нужны.</div>
        ) : (
          <>
            <div style={ROW}><span>На сторону:</span><span style={{ color: ACCENT, fontWeight: 700 }}>
              {plates.platesPerSide.map(p => `${p.plate}×${p.count}`).join(' + ')}
            </span></div>
            <div style={ROW}><span>Всего блинов:</span><span>{plates.totalPlates} шт</span></div>
            <div style={ROW}><span>Фактический вес:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{plates.actualWeight} кг</span></div>
            <div style={ROW}><span>Отклонение:</span><span style={{ color: devColor, fontWeight: 700 }}>
              {plates.deviation > 0 ? '+' : ''}{plates.deviation.toFixed(2)} кг
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
            <span>Сет {w.set}: <b style={{ color: ACCENT }}>{w.weight} кг</b> × {w.reps}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{w.plates} · отдых {w.restMin} мин</span>
          </div>
        ))}
        <div style={{ ...SMALL, marginTop: 6 }}>Рабочий: <b style={{ color: ACCENT }}>{weight} кг</b></div>
      </div>
    </div>
  );
};

export default PlateCalculator;
