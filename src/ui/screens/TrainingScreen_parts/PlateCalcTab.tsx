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
  const [oneRM, setOneRM] = useState<number>(0);
  const [savedPresets, setSavedPresets] = useState<Array<{ id: number; name: string; unit: string; barWeight: number; targetWeight: number; plates?: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_plate_presets') || '[]'); } catch { return []; } });

  const availablePlates = useMemo(
    () => customPlates.trim() ? customPlates.split(/[\s,]+/).map(Number).filter(n => n > 0) : (unit === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES),
    [unit, customPlates]
  );

  // При смене системы или грифа: пересчитать вес грифа; если имперский → вес в lb
  const barOptions = useMemo(() => BAR_TYPES[unit].map(b => ({ id: b.id, label: b.label, desc: `${b.weight} ${unit === 'metric' ? 'кг' : 'lb'}` })), [unit]);

  const BAR_PRESETS_BOTH: Record<string, { kg: number; lb: number }> = {
    men_olympic: { kg: 20, lb: 45 },
    women_olympic: { kg: 15, lb: 35 },
    ez_curl: { kg: 10, lb: 15 },
    standard: { kg: 7, lb: 15 },
    trap_bar: { kg: 25, lb: 55 },
    ssb: { kg: 20, lb: 45 },
    swiss_bar: { kg: 15, lb: 35 },
    technique: { kg: 5, lb: 10 },
  };

  const applyBar = (id: string) => {
    setBarId(id);
    const b = BAR_TYPES[unit].find(x => x.id === id);
    if (b) setBarWeight(b.weight);
  };

  const applyBarPreset = (id: string) => {
    setBarId(id);
    const p = BAR_PRESETS_BOTH[id];
    if (p) setBarWeight(unit === 'metric' ? p.kg : p.lb);
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
  const sideWeight = Math.round(((targetWeight - barWeight) / 2) * 10) / 10;
  const platesPerSideSum = plates.platesPerSide.reduce((s, p) => s + p.plate * p.count, 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧮 Калькулятор блинов (метрические / имперские)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Расчёт набора блинов на гриф под рабочий вес. Поддержка метрических (кг) и имперских (lb) систем,
        8 типов грифов (олимпийские мужские/женские, EZ, SSB, трап, Swiss, техн., стандарт), быстрые пресеты,
        настраиваемый набор доступных блинов, 1ПМ-калькулятор, SVG-визуализация грифа, разминочная последовательность
        и порядок навешивания, сохранение пресетов, экспорт отчёта.
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
        {/* Быстрые пресеты грифов */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: DIM, marginBottom: 3 }}>Быстрый выбор грифа</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['men_olympic', 'women_olympic', 'ez_curl', 'trap_bar', 'ssb', 'swiss_bar', 'technique', 'standard'].map(id => {
              const p = BAR_PRESETS_BOTH[id];
              const w = unit === 'metric' ? p.kg : p.lb;
              const label = id === 'men_olympic' ? 'Ол.' : id === 'women_olympic' ? 'Жен.' : id === 'ez_curl' ? 'EZ' : id === 'trap_bar' ? 'Трап' : id === 'ssb' ? 'SSB' : id === 'swiss_bar' ? 'Swiss' : id === 'technique' ? 'Техн.' : 'Станд.';
              return (
                <button key={id} onClick={() => applyBarPreset(id)}
                  style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: barId === id ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: barId === id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: barId === id ? ACCENT : 'rgba(255,255,255,0.7)' }}>
                  {label} {w}
                </button>
              );
            })}
          </div>
        </div>
        {/* Quick presets by %1RM */}
        <div style={{ marginBottom: 8, padding: 8, background: 'rgba(59,130,246,0.04)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="number" min={0} max={1000} placeholder={`1PM (${unitLabel})`} value={oneRM || ''} onChange={e => setOneRM(+e.target.value || 0)} style={{ width: 70, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 6px', fontSize: 10, textAlign: 'center' }} />
            <span style={{ fontSize: 9, color: DIM }}>1ПМ для расчёта % рабочего веса</span>
          </div>
          {oneRM > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[{ p: 0.50, l: '50%' }, { p: 0.60, l: '60%' }, { p: 0.65, l: '65%' }, { p: 0.70, l: '70%' }, { p: 0.75, l: '75%' }, { p: 0.80, l: '80%' }, { p: 0.85, l: '85%' }, { p: 0.90, l: '90%' }, { p: 0.95, l: '95%' }].map(p => (
                <button key={p.l} onClick={() => setTargetWeight(Math.max(barWeight, Math.round(oneRM * p.p * 10) / 10))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{p.l}</button>
              ))}
            </div>
          )}
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

      {/* SVG bar visualization */}
      {plates.platesPerSide.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏋️ Визуализация грифа</div>
          <svg width="100%" height="64" viewBox="0 0 320 64" style={{ overflow: 'visible' }}>
            {(() => {
              const barW = 200, barH = 6, cx = 160, cy = 32;
              const platesList = plates.platesPerSide;
              const plateColor = (p: number) => p >= 20 ? '#ef4444' : p >= 10 ? '#f59e0b' : '#3b82f6';
              const plateW = (p: number) => p >= 25 ? 10 : p >= 15 ? 8 : p >= 5 ? 6 : 4;
              const elements: React.ReactNode[] = [];
              let xLeft = cx - barW / 2;
              let xRight = cx + barW / 2;
              const sleeveW = 8;
              elements.push(<rect key="bar" x={cx - barW / 2} y={cy - barH / 2} width={barW} height={barH} fill="rgba(255,255,255,0.25)" rx={2} />);
              elements.push(<rect key="sleeveL" x={xLeft - sleeveW} y={cy - barH / 2 - 4} width={sleeveW} height={barH + 8} fill="rgba(255,255,255,0.15)" />);
              elements.push(<rect key="sleeveR" x={xRight} y={cy - barH / 2 - 4} width={sleeveW} height={barH + 8} fill="rgba(255,255,255,0.15)" />);
              xLeft -= sleeveW;
              xRight += sleeveW;
              platesList.forEach((p, idx) => {
                const w = plateW(p.plate);
                for (let j = 0; j < p.count; j++) {
                  xLeft -= w;
                  elements.push(<rect key={`pl-${idx}-${j}`} x={xLeft} y={cy - 14} width={w} height={28} fill={plateColor(p.plate)} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} rx={1} />);
                  if (p.plate >= 5) {
                    elements.push(<text key={`txt-${idx}-${j}`} x={xLeft + w / 2} y={cy + 2} textAnchor="middle" fill="#fff" fontSize={5} fontWeight={700}>{p.plate}</text>);
                  }
                  xRight += w;
                  elements.push(<rect key={`pr-${idx}-${j}`} x={xRight - w} y={cy - 14} width={w} height={28} fill={plateColor(p.plate)} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} rx={1} />);
                  if (p.plate >= 5) {
                    elements.push(<text key={`txtr-${idx}-${j}`} x={xRight - w / 2} y={cy + 2} textAnchor="middle" fill="#fff" fontSize={5} fontWeight={700}>{p.plate}</text>);
                  }
                }
              });
              elements.push(<text x={cx} y={58} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8}>Гриф весом {barWeight} {unitLabel} · {plates.totalPlates} × 2 = {plates.totalPlates * 2} блинов</text>);
              return elements;
            })()}
          </svg>
        </div>
      )}

      {/* Формула расчёта */}
      <div style={{ ...CARD, background: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.15)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📐 Формула</div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
          {targetWeight} {unitLabel} = гриф {barWeight} {unitLabel} + {sideWeight} {unitLabel}/сторона
        </div>
        <div style={{ ...SMALL, marginTop: 4 }}>
          {plates.platesPerSide.length > 0
            ? `Блины на сторону: ${plates.platesPerSide.map(p => `${p.plate} ${unitLabel} × ${p.count}`).join(' + ')} = ${platesPerSideSum} ${unitLabel} · всего блинов: ${plates.totalPlates} шт`
            : 'Вес ≤ вес грифа: блины не нужны.'}
        </div>
        <div style={{ ...SMALL, marginTop: 2, color: devColor }}>
          Фактический вес: {plates.actualWeight} {unitLabel} (отклонение: {plates.deviation > 0 ? '+' : ''}{plates.deviation} {unitLabel})
        </div>
      </div>

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

      {/* Save presets + export */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>💾 Пресеты и экспорт</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button onClick={() => {
            const name = prompt('Название пресета:', `Вес ${targetWeight} ${unitLabel}`);
            if (!name) return;
            const item = { id: Date.now(), name, unit, barWeight, targetWeight, plates: customPlates };
            const arr = [item, ...savedPresets].slice(0, 20);
            setSavedPresets(arr);
            try { localStorage.setItem('he_plate_presets', JSON.stringify(arr)); } catch { /* ignore */ }
          }} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${ACCENT}33`, background: `${ACCENT}0d`, color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>＋ Сохранить</button>
          <button onClick={() => {
            const lines: string[] = [];
            lines.push('=== Калькулятор блинов — Отчёт ===');
            lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
            lines.push(`Система: ${unit === 'metric' ? 'Метрические (кг)' : 'Имперские (lb)'}`);
            lines.push(`Гриф: ${barWeight} ${unitLabel}`);
            lines.push(`Целевой вес: ${targetWeight} ${unitLabel} (≈ ${displayAlt})`);
            lines.push(`Фактический вес: ${plates.actualWeight} ${unitLabel}`);
            lines.push(`Отклонение: ${plates.deviation > 0 ? '+' : ''}${plates.deviation} ${unitLabel}`);
            if (plates.platesPerSide.length > 0) {
              lines.push('Блины на сторону:');
              plates.platesPerSide.forEach(p => lines.push(`  ${p.plate} ${unitLabel} × ${p.count}`));
              lines.push(`Всего: ${plates.totalPlates} × 2 = ${plates.totalPlates * 2} блинов`);
            }
            lines.push('');
            lines.push('Разминка:');
            warmup.forEach(w => lines.push(`  Сет ${w.set}: ${w.weight} ${unitLabel} × ${w.reps}`));
            navigator.clipboard?.writeText(lines.join('\n')).then(() => { /* ok */ }).catch(() => { /* ignore */ });
          }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>📋 Экспорт</button>
        </div>
        {savedPresets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {savedPresets.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 6, background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                <button onClick={() => {
                  if (p.unit === 'metric' && unit !== 'metric') { setUnit('metric'); setBarWeight(p.barWeight); setTargetWeight(p.targetWeight); }
                  else if (p.unit === 'imperial' && unit !== 'imperial') { setUnit('imperial'); setBarWeight(p.barWeight); setTargetWeight(p.targetWeight); }
                  else { setBarWeight(p.barWeight); setTargetWeight(p.targetWeight); }
                  if (p.plates) setCustomPlates(p.plates);
                }} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                  <strong style={{ color: ACCENT }}>{p.name}</strong>
                  <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>{p.targetWeight} {p.unit === 'metric' ? 'кг' : 'lb'} · гриф {p.barWeight}</span>
                </button>
                <button onClick={() => {
                  const arr = savedPresets.filter(x => x.id !== p.id);
                  setSavedPresets(arr);
                  try { localStorage.setItem('he_plate_presets', JSON.stringify(arr)); } catch { /* ignore */ }
                }} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 9 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 9, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        Жадный алгоритм выбирает блины большего номинала сначала (минимум общего числа блинов). Если отклонение &gt; 2 {unitLabel} — попробуйте добавить блины мелких номиналов (1.25 {unitLabel} или 2.5 {unitLabel}) в поле «Доступные блины».
      </div>
    </div>
  );
};

export default PlateCalcTab;