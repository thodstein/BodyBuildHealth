/**
 * PlateCalcTab.tsx — ЕДИНСТВЕННЫЙ калькулятор блинов проекта.
 * Все фичи: метрические/имперские, 8 типов грифов, пресеты, 1ПМ-%,
 * кастомные блины, SVG-визуализация, раскладка, порядок, разминка,
 * экспорт отчёта, Apply в план.
 * Движок: gym-competition.engine (calculatePlates / getPlateLoadingOrder / warmupPlateSequence).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { calculatePlates, getPlateLoadingOrder, warmupPlateSequence, type WeightUnit } from '../../../engines/gym-competition.engine';
import { PopupNumber, PopupSelect, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

type Unit = 'metric' | 'imperial';

const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

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
    { id: 'men_olympic', label: 'Мужской олимпийский (45 фн)', weight: 45 },
    { id: 'women_olympic', label: 'Женский олимпийский (35 фн)', weight: 35 },
    { id: 'ez_curl', label: 'EZ-гриф (15 фн)', weight: 15 },
    { id: 'technique', label: 'Технический гриф (10 фн)', weight: 10 },
    { id: 'standard', label: 'Стандартный гриф (15 фн)', weight: 15 },
    { id: 'trap_bar', label: 'Трэп/Хекс-гриф (55 фн)', weight: 55 },
  ],
};

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

const KG_TO_LB = 2.20462262;
function kgToLb(kg: number) { return Math.round(kg * KG_TO_LB * 10) / 10; }
function lbToKg(lb: number) { return Math.round(lb / KG_TO_LB * 10) / 10; }

const unitOpts = [
  { id: 'metric', label: 'Метрические (кг)', desc: 'кг · блины 25/20/15/10/5/2.5/1.25 кг' },
  { id: 'imperial', label: 'Имперские (фн)', desc: 'фн · блины 45/35/25/10/5/2.5 фн' },
];

export interface PlateCalcTabProps {
  /** Начальный вес из плана (синхронизируется при изменении) */
  initialWeight?: number;
  /** Колбэк: применить фактический доступный вес к плану */
  onApply?: (actualWeight: number, exerciseId?: string) => void;
  /** Метка для кнопки Apply (зависит от контекста) */
  applyLabel?: string;
  /** Упражнения текущей сессии (проведение тренировки): id, название, рабочий вес */
  exerciseOptions?: { id: string; label: string; weight?: number }[];
}

export const PlateCalcTab: React.FC<PlateCalcTabProps> = ({ initialWeight, onApply, applyLabel, exerciseOptions }) => {
  const [unit, setUnit] = useState<Unit>('metric');
  const [barId, setBarId] = useState('men_olympic');
  const [barWeight, setBarWeight] = useState(20);
  const [targetWeight, setTargetWeight] = useState(100);
  const [customPlates, setCustomPlates] = useState<string>('');
  const [oneRM, setOneRM] = useState<number>(0);
  const [applied, setApplied] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [savedPresets, setSavedPresets] = useState<Array<{ id: number; name: string; unit: string; barWeight: number; targetWeight: number; plates?: string }>>(() => { try { return JSON.parse(localStorage.getItem('he_plate_presets') || '[]'); } catch { return []; } });

  useEffect(() => {
    if (initialWeight && initialWeight > 0) setTargetWeight(initialWeight);
  }, [initialWeight]);

  // Синхронизация селектора упражнений (проведение тренировки)
  useEffect(() => {
    if (!exerciseOptions || exerciseOptions.length === 0) return;
    setSelectedExercise(prev => (exerciseOptions.some(o => o.id === prev) ? prev : exerciseOptions[0].id));
  }, [exerciseOptions]);

  const selectedOpt = exerciseOptions?.find(o => o.id === selectedExercise);
  useEffect(() => {
    if (selectedOpt && selectedOpt.weight && selectedOpt.weight > 0) setTargetWeight(selectedOpt.weight);
  }, [selectedOpt]);

  const availablePlates = useMemo(
    () => customPlates.trim() ? customPlates.split(/[\s,]+/).map(Number).filter(n => n > 0) : (unit === 'metric' ? METRIC_PLATES : IMPERIAL_PLATES),
    [unit, customPlates]
  );

  const barOptions = useMemo(() => BAR_TYPES[unit].map(b => ({ id: b.id, label: b.label, desc: `${b.weight} ${unit === 'metric' ? 'кг' : 'фн'}` })), [unit]);

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

  const wUnit: WeightUnit = unit === 'metric' ? 'kg' : 'lbs';
  const plates = useMemo(() => calculatePlates(targetWeight, barWeight, wUnit, availablePlates), [targetWeight, barWeight, wUnit, availablePlates]);
  const order = useMemo(() => getPlateLoadingOrder(targetWeight, barWeight, wUnit), [targetWeight, barWeight, wUnit]);
  const warmup = useMemo(() => warmupPlateSequence(targetWeight, barWeight, wUnit, availablePlates), [targetWeight, barWeight, wUnit, availablePlates]);
  const displayAlt = unit === 'metric' ? `${kgToLb(targetWeight)} фн` : `${lbToKg(targetWeight)} кг`;
  const deviation = Math.abs(plates.deviation);
  const devColor = deviation < 0.5 ? ACCENT : deviation > 2 ? '#ef4444' : '#f59e0b';
  const unitLabel = unit === 'metric' ? 'кг' : 'фн';
  const sideWeight = Math.round(((targetWeight - barWeight) / 2) * 10) / 10;
  const platesPerSideSum = plates.platesPerSide.reduce((s, p) => s + p.plate * p.count, 0);

  const handleApply = useCallback(() => {
    if (!onApply) return;
    setApplied(true);
    onApply(plates.actualWeight, exerciseOptions ? selectedExercise : undefined);
    setTimeout(() => setApplied(false), 1800);
  }, [onApply, plates.actualWeight, exerciseOptions, selectedExercise]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      {/* Заголовок + Apply */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={H}>🧮 Калькулятор блинов</div>
        {onApply && (
          <button onClick={handleApply} disabled={applied}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: applied ? 'default' : 'pointer', background: applied ? 'rgba(0,230,138,0.2)' : ACCENT, color: applied ? ACCENT : '#000', transition: 'all .2s' }}>
            {applied ? '✓ Применено' : (applyLabel || '✅ Применить к плану')}
          </button>
        )}
      </div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Расчёт набора блинов на гриф под рабочий вес. Все системы единиц, 8 типов грифов,
        1ПМ-пресеты, SVG-визуализация, разминка, порядок навешивания, экспорт.
        {initialWeight && <span style={{ color: ACCENT }}> · Вес из плана: {initialWeight} {unitLabel}</span>}
        {selectedOpt && <span style={{ color: ACCENT }}> · Упражнение: {selectedOpt.label}</span>}
      </div>

      {/* ⚙️ Параметры */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>⚙️ Параметры</div>
        {exerciseOptions && exerciseOptions.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <PopupSelect
              label="Упражнение текущей сессии"
              value={selectedExercise}
              options={exerciseOptions.map(o => ({ id: o.id, label: o.label, desc: o.weight && o.weight > 0 ? `рабочий вес ${o.weight} ${unitLabel}` : 'вес тела/без веса' }))}
              onChange={v => setSelectedExercise(v as string)}
            />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupSelect label="Система единиц" value={unit} options={unitOpts} onChange={v => { setUnit(v as Unit); setTargetWeight(100); }} />
          <PopupSelect label="Тип грифа" value={barId} options={barOptions} onChange={v => applyBar(v as string)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <PopupNumber label={`Рабочий вес (${unitLabel})`} value={targetWeight} min={barWeight} max={800} suffix={` ${unitLabel}`} onChange={setTargetWeight} />
          <PopupNumber label={`Вес грифа (${unitLabel})`} value={barWeight} min={1} max={60} suffix={` ${unitLabel}`} onChange={v => setBarWeight(v || 0)} />
        </div>
        {/* Быстрые пресеты грифов */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>Быстрый выбор грифа</div>
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
        {/* 1ПМ-% пресеты */}
        <div style={{ marginBottom: 8, padding: 8, background: 'rgba(59,130,246,0.04)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="number" min={0} max={1000} placeholder={`1ПМ (${unitLabel})`} value={oneRM || ''} onChange={e => setOneRM(+e.target.value || 0)} style={{ width: 70, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 6px', fontSize: 10, textAlign: 'center' }} />
            <span style={{ fontSize: 10, color: DIM }}>1ПМ для расчёта рабочего веса по проценту</span>
            {oneRM > 0 && <button onClick={() => setOneRM(0)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>}
          </div>
          {oneRM > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[{ p: 0.50, l: '50%' }, { p: 0.60, l: '60%' }, { p: 0.65, l: '65%' }, { p: 0.70, l: '70%' }, { p: 0.75, l: '75%' }, { p: 0.80, l: '80%' }, { p: 0.85, l: '85%' }, { p: 0.90, l: '90%' }, { p: 0.95, l: '95%' }].map(p => (
                <button key={p.l} onClick={() => setTargetWeight(Math.max(barWeight, Math.round(oneRM * p.p * 10) / 10))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{p.l}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 3 }}>Доступные блины (через запятую, {unitLabel})</div>
            <input type="text" value={customPlates} placeholder="напр.: 25,20,15,10,5,2.5" onChange={e => setCustomPlates(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 }} />
          </div>
          {customPlates.trim() && <button onClick={() => setCustomPlates('')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}>Сброс</button>}
        </div>
        <div style={{ ...SMALL, marginTop: 6, color: ACCENT }}>≈ альтернативная система: {displayAlt}</div>
      </div>

      {/* 🎯 Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricCard title="Целевой вес" icon="🎯" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{targetWeight}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
        <MetricCard title="Фактический" icon="✅" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{plates.actualWeight}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
        <MetricCard title="Отклонение" icon="📊" accent={devColor}>
          <div style={{ fontSize: 20, fontWeight: 800, color: devColor }}>{plates.deviation > 0 ? '+' : ''}{plates.deviation}</div>
          <div style={SMALL}>{unitLabel}</div>
        </MetricCard>
      </div>

      {/* 📐 Раскладка блинов */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📐 Раскладка блинов на сторону</div>
        {plates.platesPerSide.length === 0 ? (
          <div style={SMALL}>Вес ≤ вес грифа: блины не нужны.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {plates.platesPerSide.map((p, i) => (
              <div key={i} style={{ ...ROW, borderBottom: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 28, height: 28, borderRadius: '50%', background: p.plate >= 20 ? '#ef4444' : p.plate >= 10 ? '#f59e0b' : '#3b82f6', border: '2px solid rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: '24px', fontSize: 10, fontWeight: 800, color: '#fff' }}>{p.plate}</span>
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

      {/* 📐 Порядок навешивания */}
      <ExpandableCard title="📐 Порядок навешивания (пошагово)" accent={ACCENT} short="Порядок навешивания блинов на гриф по шагам">
        {order.map((s, i) => <div key={i} style={{ ...SMALL, padding: '3px 0' }}>{s}</div>)}
      </ExpandableCard>

      {/* 🏋️ SVG-визуализация */}
      {plates.platesPerSide.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏋️ Визуализация грифа</div>
          <svg width="100%" height="64" viewBox="0 0 320 64" style={{ overflow: 'visible' }}>
            {(() => {
              const barW = 200, barH = 6, cx = 160, cy = 32;
              const platesList = plates.platesPerSide;
              const plateColor = (p: number) => p >= 20 ? '#ef4444' : p >= 10 ? '#f59e0b' : '#3b82f6';
              const plateW = (p: number) => p >= 25 ? 10 : p >= 15 ? 8 : p >= 5 ? 6 : 4;
              const els: React.ReactNode[] = [];
              let xL = cx - barW / 2, xR = cx + barW / 2;
              const sl = 8;
              els.push(<rect key="bar" x={cx - barW / 2} y={cy - barH / 2} width={barW} height={barH} fill="rgba(255,255,255,0.25)" rx={2} />);
              els.push(<rect key="slL" x={xL - sl} y={cy - barH / 2 - 4} width={sl} height={barH + 8} fill="rgba(255,255,255,0.15)" />);
              els.push(<rect key="slR" x={xR} y={cy - barH / 2 - 4} width={sl} height={barH + 8} fill="rgba(255,255,255,0.15)" />);
              xL -= sl; xR += sl;
              platesList.forEach((p, idx) => {
                const w = plateW(p.plate);
                for (let j = 0; j < p.count; j++) {
                  xL -= w;
                  els.push(<rect key={`pl-${idx}-${j}`} x={xL} y={cy - 14} width={w} height={28} fill={plateColor(p.plate)} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} rx={1} />);
                  if (p.plate >= 5) els.push(<text key={`tx-${idx}-${j}`} x={xL + w / 2} y={cy + 2} textAnchor="middle" fill="#fff" fontSize={5} fontWeight={700}>{p.plate}</text>);
                  xR += w;
                  els.push(<rect key={`pr-${idx}-${j}`} x={xR - w} y={cy - 14} width={w} height={28} fill={plateColor(p.plate)} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} rx={1} />);
                  if (p.plate >= 5) els.push(<text key={`txr-${idx}-${j}`} x={xR - w / 2} y={cy + 2} textAnchor="middle" fill="#fff" fontSize={5} fontWeight={700}>{p.plate}</text>);
                }
              });
              els.push(<text key="bar-label" x={cx} y={58} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8}>Гриф {barWeight} {unitLabel} · {plates.totalPlates} × 2 = {plates.totalPlates * 2} блинов</text>);
              return els;
            })()}
          </svg>
        </div>
      )}

      {/* 📐 Формула */}
      <div style={{ ...CARD, background: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.15)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📐 Формула</div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
          {targetWeight} {unitLabel} = гриф {barWeight} {unitLabel} + {sideWeight} {unitLabel}/сторона
        </div>
        <div style={{ ...SMALL, marginTop: 4 }}>
          {plates.platesPerSide.length > 0
            ? `Блины на сторону: ${plates.platesPerSide.map(p => `${p.plate} ${unitLabel} × ${p.count}`).join(' + ')} = ${platesPerSideSum} ${unitLabel} · всего: ${plates.totalPlates} шт`
            : 'Вес ≤ вес грифа: блины не нужны.'}
        </div>
        <div style={{ ...SMALL, marginTop: 2, color: devColor }}>
          Фактический: {plates.actualWeight} {unitLabel} (отклонение: {plates.deviation > 0 ? '+' : ''}{plates.deviation} {unitLabel})
        </div>
      </div>

      {/* 🔥 Разминка */}
      <ExpandableCard title="🔥 Разминка к рабочему весу" accent={ACCENT} short="Разминочные подходы к рабочему весу">
        {warmup.map(w => (
          <div key={w.set} style={ROW}>
            <span>Сет {w.set}: <b style={{ color: ACCENT }}>{w.weight} {unitLabel}</b> × {w.reps}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{w.plates} · отдых {w.restMin} мин</span>
          </div>
        ))}
        <div style={{ ...SMALL, marginTop: 6 }}>Рабочий: <b style={{ color: ACCENT }}>{targetWeight} {unitLabel}</b></div>
      </ExpandableCard>

      {/* 💾 Пресеты и экспорт */}
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
            lines.push(`Система: ${unit === 'metric' ? 'Метрические (кг)' : 'Имперские (фн)'}`);
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
            navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
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
                  <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>{p.targetWeight} {p.unit === 'metric' ? 'кг' : 'фн'} · гриф {p.barWeight}</span>
                </button>
                <button onClick={() => {
                  const arr = savedPresets.filter(x => x.id !== p.id);
                  setSavedPresets(arr);
                  try { localStorage.setItem('he_plate_presets', JSON.stringify(arr)); } catch { /* ignore */ }
                }} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: DIM, marginTop: 12, lineHeight: 1.4 }}>
        Жадный алгоритм: блин большего номинала — первым (минимум числа блинов).
        Если отклонение &gt; 2 {unitLabel} — добавьте блины мелких номиналов (1.25 {unitLabel} или 2.5 {unitLabel}).
      </div>
    </div>
  );
};

export default PlateCalcTab;
