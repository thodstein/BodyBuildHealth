/**
 * PlateCalcTab.tsx — Калькулятор блинов: вес → набор блинов на гриф (метрические/имперские, разные грифы).
 * REUSE gym-competition.engine: calculatePlates, getPlateLoadingOrder, warmupPlateSequence.
 * standalone компаньон встроенного PlateCalculator в SRCBBScreen.
 */
import React, { useMemo, useState } from 'react';
import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence, type WeightUnit } from '../../../engines/gym-competition.engine';
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

type Unit = 'metric' | 'imperial';

const BAR_TYPES: Record<Unit, { id: string; label: string; weight: number }[]> = {
  metric: [
    { id: 'men_olympic', label: 'Мужской олимпийский (20 кг)', weight: 20 },
    { id: 'women_olympic', label: 'Женский олимпийский (15 кг)', weight: 15 },
    { id: 'ez_curl', label: 'EZ-гриф (10 кг)', weight: 10 },
    { id: 'technique', label: 'Технический (5 кг)', weight: 5 },
    { id: 'standard', label: 'Стандартный (7 кг)', weight: 7 },
    { id: 'trap_bar', label: 'Трап-гриф (25 кг)', weight: 25 },
    { id: 'ssb', label: 'SSB Safety Squat Bar (20 кг)', weight: 20 },
    { id: 'swiss_bar', label: 'Swiss/Multi-grip (15 кг)', weight: 15 },
  ],
  imperial: [
    { id: 'men_olympic', label: 'Men\'s Olympic (45 lb)', weight: 45 },
    { id: 'women_olympic', label: 'Women\'s Olympic (35 lb)', weight: 35 },
    { id: 'ez_curl', label: 'EZ-Curl Bar (15 lb)', weight: 15 },
    { id: 'technique', label: 'Technique Bar (10 lb)', weight: 10 },
    { id: 'standard', label: 'Standard Bar (15 lb)', weight: 15 },
    { id: 'trap_bar', label: 'Trap/Hex Bar (55 lb)', weight: 55 },
  ],
};

const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

// Функция конвертации кг↔lb
const KG_TO_LB = 2.20462262;
function kgToLb(kg: number) { return Math.round(kg * KG_TO_LB * 10) / 10; }
function lbToKg(lb: number) { return Math.round(lb / KG_TO_LB * 10) / 10; }

const unitOpts = [
  { id: 'metric', label: 'Метрические (кг)', desc: 'кг · блины 25/20/15/10/5/2.5/1.25 кг' },
  { id: 'imperial', label: 'Имперские (lb)', desc: 'lb · блины 45/35/25/10/5/2.5 lb' },
];

export const PlateCalcTab: React.FC = () => {
  const [unit, setUnit] = useState<Unit>('metric');
  const [barId, setBarId] = useState('men_olympic');
  const [barWeight, setBarWeight] = useState(20);
  const [targetWeight, setTargetWeight] = useState(100);
  const [customPlates, setCustomPlates] = useState<string>('');

  const availablePlates = useMemo(
    () => customPlates.trim() ? customPlates.split(/[\s,]+/).map(Number).filter(n => n > 0) : (unit === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES),
    [unit, customPlates]
  );

  // При смене системы или грифа: пересчитать вес грифа; если имперский → вес в lb
  const barOptions = useMemo(() => BAR_TYPES[unit].map(b => ({ id: b.id, label: b.label, desc: `${b.weight} ${unit === 'metric' ? 'кг' : 'lb'}` })), [unit]);

  const applyBar = (id: string) => {
    setBarId(id);
    const b = BAR_TYPES[unit].find(x => x.id === id);
    if (b) setBarWeight(b.weight);
  };

  // Симметричный прайминг на гриф: равные блины по каждой стороне
  const wUnit: WeightUnit = unit === 'metric' ? 'kg' : 'lbs';
  const plates = useMemo(() => calculatePlates(targetWeight, barWeight, wUnit, availablePlates), [targetWeight, barWeight, wUnit, availablePlates]);
  const order = useMemo(() => getPlateLoadingOrder(targetWeight, barWeight), [targetWeight, barWeight]);
  const warmup = useMemo(() => warmupPlateSequence(targetWeight), [targetWeight]);

  // Конвертация кросс-unit отображения
  const displayAlt = unit === 'metric' ? `${kgToLb(targetWeight)} lb` : `${lbToKg(targetWeight)} кг`;

  const devColor = Math.abs(plates.deviation) < 0.5 ? ACCENT : Math.abs(plates.deviation) > 2 ? '#ef4444' : '#f59e0b';
  const unitLabel = unit === 'metric' ? 'кг' : 'lb';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧮 Калькулятор блинов (метрические / имперские)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Расчёт набора блинов на гриф под рабочий вес. Поддержка метрических (кг) и имперских (lb) систем,
        разные типы грифов (олимпийские мужские/женские, EZ, SSB, трап, Swiss), настраиваемый набор доступных блинов,
        разминочная последовательность и порядок навешивания.
      </div>

      {/* Единицы + гриф */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Система единиц" value={unit} options={unitOpts} onChange={v => { setUnit(v as Unit); setTargetWeight(100); }} />
          <PopupSelect label="Тип грифа" value={barId} options={barOptions} onChange={v => applyBar(v as string)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label={`Рабочий вес (${unitLabel})`} value={targetWeight} min={barWeight} max={800} suffix={` ${unitLabel}`} onChange={setTargetWeight} />
          <div>
            <div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Вес грифа ({unitLabel})</div>
            <input type="number" min={1} max={60} value={barWeight} onChange={e => setBarWeight(+e.target.value || 0)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Доступные блины (через запятую, {unitLabel}) — по умолчанию стандартный набор</div>
          <input type="text" value={customPlates} placeholder="напр.: 25,20,15,10,5,2.5" onChange={e => setCustomPlates(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 }} />
        </div>
        <div style={{ ...SMALL, marginTop: 6, color: ACCENT }}>≈ альтернативная система: {displayAlt}</div>
      </div>

      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricCard title="Целевой вес" icon="🎯" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{targetWeight}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
        <MetricCard title="Фактический вес" icon="✅" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{plates.actualWeight}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
        <MetricCard title="Отклонение" icon="📊" accent={devColor}>
          <div style={{ fontSize: 20, fontWeight: 800, color: devColor }}>{plates.deviation > 0 ? '+' : ''}{plates.deviation}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
      </div>

      {/* Раскладка блинов */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📐 Раскладка блинов на сторону</div>
        {plates.platesPerSide.length === 0 ? (
          <div style={SMALL}>Вес ≤ вес грифа: блины не нужны.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {plates.platesPerSide.map((p, i) => (
              <div key={i} style={{ ...ROW, borderBottom: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 28, height: 28, borderRadius: '50%', background: p.plate >= 20 ? '#ef4444' : p.plate >= 10 ? '#f59e0b' : '#3b82f6', border: '2px solid rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: '24px', fontSize: 9, fontWeight: 800, color: '#fff' }}>{p.plate}</span>
                  <span>Блин {p.plate} {unitLabel}</span>
                </span>
                <b style={{ color: ACCENT }}>×{p.count} на сторону</b>
              </div>
            ))}
            <div style={{ ...ROW, borderBottom: 'none', marginTop: 4 }}>
              <span>Всего блинов:</span><b>{plates.totalPlates} шт</b>
            </div>
          </div>
        )}
      </div>

      {/* Порядок навешивания */}
      <ExpandableCard title="📐 Порядок навешивания (пошагово)" accent={ACCENT} short="Порядок навешивания блинов на гриф по шагам">
        {order.map((s, i) => <div key={i} style={{ ...SMALL, padding: '3px 0' }}>{s}</div>)}
      </ExpandableCard>

      {/* Разминка */}
      <ExpandableCard title="🔥 Разминка к рабочему весу" accent={ACCENT} short="Разминочные подходы к рабочему весу">
        {warmup.map(w => (
          <div key={w.set} style={ROW}>
            <span>Сет {w.set}: <b style={{ color: ACCENT }}>{w.weight} {unitLabel}</b> × {w.reps}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{w.plates} · отдых {w.restMin} мин</span>
          </div>
        ))}
        <div style={{ ...SMALL, marginTop: 6 }}>Рабочий: <b style={{ color: ACCENT }}>{targetWeight} {unitLabel}</b></div>
      </ExpandableCard>

      <div style={{ fontSize: 9, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        Жадный алгоритм выбирает блины большего номинала сначала (минимум общего числа блинов). Если отклонение &gt; 2 {unitLabel} — попробуйте добавить блины мелких номиналов (1.25 {unitLabel} или 2.5 {unitLabel}) в поле «Доступные блины».
      </div>
    </div>
  );
};

export default PlateCalcTab;