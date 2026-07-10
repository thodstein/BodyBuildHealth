import React, { useState, useEffect } from 'react';
import { calculateDose } from '../../../engines/dosage.engine';
import { SYRINGE_SPECS, DRUG_THRESHOLDS } from '../../../core/constants';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { useDataLink } from '../../../core/data-link';
import type { DoseRequest, NutritionInput } from '../../../core/types';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14,
  background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
  marginBottom: 10,
};
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };
const SEL: React.CSSProperties = { ...IN, fontSize: 11, appearance: 'none' as const, cursor: 'pointer' };
const BTN: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 11, minHeight: 38 };
const RES: React.CSSProperties = { marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 11, lineHeight: 1.5 };
const PAL_OPTIONS = [
  { value: 1.2, label: 'Сидячий (1.2)' },
  { value: 1.375, label: 'Легкий (1.375)' },
  { value: 1.55, label: 'Умеренный (1.55)' },
  { value: 1.725, label: 'Высокий (1.725)' },
  { value: 1.9, label: 'Экстремальный (1.9)' },
];
const DRUG_OPTIONS = Object.keys(DRUG_THRESHOLDS);

const CalcBlock: React.FC<{ title: string; desc: string; children: React.ReactNode }> = ({ title, desc, children }) => (
  <div style={CARD}>
    <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 2 }}>{title}</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>{desc}</div>
    {children}
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', minWidth: 100 }}>{label}</span>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

export const HealthCalculatorsTab: React.FC = () => {
  const linked = useDataLink();

  // BMI
  const [bmiW, setBmiW] = useState(70);
  const [bmiH, setBmiH] = useState(175);
  const [bmiR, setBmiR] = useState<number | null>(null);

  // BMR Mifflin
  const [bmrW, setBmrW] = useState(70);
  const [bmrH, setBmrH] = useState(175);
  const [bmrA, setBmrA] = useState(25);
  const [bmrS, setBmrS] = useState<'male' | 'female'>('male');
  const [bmrR, setBmrR] = useState<number | null>(null);

  // BMR Katch-McArdle
  const [kmW, setKmW] = useState(70);
  const [kmBF, setKmBF] = useState(15);
  const [kmR, setKmR] = useState<number | null>(null);

  // TDEE
  const [teeBmr, setTeeBmr] = useState(1700);
  const [teePal, setTeePal] = useState(1.55);
  const [teeR, setTeeR] = useState<number | null>(null);

  // Dosage
  const [doseT, setDoseT] = useState(200);
  const [doseC, setDoseC] = useState(250);
  const [doseS, setDoseS] = useState<number>(1.0);
  const [doseR, setDoseR] = useState<{ volumeMl: number; divisions: number; dosesPerVial: number; flags: string[] } | null>(null);

  // Androgen index
  const [aiE, setAiE] = useState<{ drug: string; doseMgWeek: number }[]>([{ drug: 'testosterone_enanthate', doseMgWeek: 300 }]);
  const [aiR, setAiR] = useState<number | null>(null);

  // Deficit
  const [defT, setDefT] = useState(2500);
  const [defG, setDefG] = useState(2000);
  const [defR, setDefR] = useState<{ deficit: number; rateKgWeek: number } | null>(null);

  // Macros
  const [macW, setMacW] = useState(70);
  const [macH, setMacH] = useState(175);
  const [macA, setMacA] = useState(25);
  const [macS, setMacS] = useState<'male' | 'female'>('male');
  const [macP, setMacP] = useState(1.55);
  const [macG, setMacG] = useState('maintenance');
  const [macR, setMacR] = useState<{ kcal: number; protein: number; fats: number; carbs: number; water: number; fiber: number } | null>(null);

  // HOMA-IR
  const [homG, setHomG] = useState(5.0);
  const [homI, setHomI] = useState(10);
  const [homR, setHomR] = useState<{ index: number; resistant: boolean } | null>(null);

  // Corrected calcium
  const [caT, setCaT] = useState(2.2);
  const [caA, setCaA] = useState(35);
  const [caR, setCaR] = useState<number | null>(null);

  // Atherogenic index
  const [athTC, setAthTC] = useState(5.0);
  const [athHDL, setAthHDL] = useState(1.2);
  const [athR, setAthR] = useState<{ index: number; highRisk: boolean } | null>(null);

  // Grip strength
  const [gripK, setGripK] = useState(45);
  const [gripS, setGripS] = useState<'male' | 'female'>('male');
  const [gripA, setGripA] = useState(30);
  const [gripR, setGripR] = useState<{ percentile: number; level: string } | null>(null);

  // HRV stress
  const [hrvV, setHrvV] = useState(50);
  const [strR, setStrR] = useState<{ stress: number; level: string } | null>(null);

  useEffect(() => {
    const s: any = linked.profile?.settings;
    if (!s) return;
    const pw = s.personal?.weight || 70;
    const ph = s.personal?.height || 175;
    const pa = s.personal?.age || 25;
    const ps = s.personal?.sex || 'male';
    const pg = s.training?.primaryGoal || 'maintenance';
    setBmiW(pw); setBmiH(ph);
    setBmrW(pw); setBmrH(ph); setBmrA(pa); setBmrS(ps);
    setKmW(pw); if (s.personal?.bodyFat) setKmBF(s.personal.bodyFat);
    setMacW(pw); setMacH(ph); setMacA(pa); setMacS(ps); setMacG(pg);
    setGripS(ps); setGripA(pa);
  }, [linked]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 4px' }}>🏥 Калькуляторы здоровья</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Антропометрия, метаболизм, лабораторные индексы, производительность и фармакология.</div>

      {/* ── Раздел 1: Антропометрия и метаболизм ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📐 Антропометрия и метаболизм</div>

      <CalcBlock title="Индекс массы тела (BMI)" desc="Вес / Рост² — оценка массы тела">
        <Row label="Вес (кг)"><input type="number" value={bmiW} onChange={e => setBmiW(+e.target.value)} style={IN} /></Row>
        <Row label="Рост (см)"><input type="number" value={bmiH} onChange={e => setBmiH(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const hm = bmiH / 100; setBmiR(bmiW / (hm * hm)); }} style={BTN}>Рассчитать</button>
        {bmiR !== null && <div style={RES}>BMI: <b>{bmiR.toFixed(1)}</b> — {bmiR < 18.5 ? 'Дефицит' : bmiR < 25 ? 'Норма' : bmiR < 30 ? 'Избыток' : 'Ожирение'}</div>}
      </CalcBlock>

      <CalcBlock title="BMR (Миффлин-Сан Жеор)" desc="10×вес + 6.25×рост − 5×возраст ± 161 — базовый метаболизм">
        <Row label="Вес (кг)"><input type="number" value={bmrW} onChange={e => setBmrW(+e.target.value)} style={IN} /></Row>
        <Row label="Рост (см)"><input type="number" value={bmrH} onChange={e => setBmrH(+e.target.value)} style={IN} /></Row>
        <Row label="Возраст"><input type="number" value={bmrA} onChange={e => setBmrA(+e.target.value)} style={IN} /></Row>
        <Row label="Пол"><select value={bmrS} onChange={e => setBmrS(e.target.value as any)} style={SEL}><option value="male">Мужской</option><option value="female">Женский</option></select></Row>
        <button onClick={() => { setBmrR(bmrS === 'male' ? 10 * bmrW + 6.25 * bmrH - 5 * bmrA + 5 : 10 * bmrW + 6.25 * bmrH - 5 * bmrA - 161); }} style={BTN}>Рассчитать</button>
        {bmrR !== null && <div style={RES}>BMR: <b>{bmrR.toFixed(0)} ккал/день</b></div>}
      </CalcBlock>

      <CalcBlock title="BMR (Кэтч-Мкардл)" desc="370 + 21.6 × LBM — для людей с известным % жира">
        <Row label="Вес (кг)"><input type="number" value={kmW} onChange={e => setKmW(+e.target.value)} style={IN} /></Row>
        <Row label="% жира"><input type="number" value={kmBF} onChange={e => setKmBF(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const lbm = kmW * (100 - kmBF) / 100; setKmR(370 + 21.6 * lbm); }} style={BTN}>Рассчитать</button>
        {kmR !== null && <div style={RES}>BMR (Katch-McArdle): <b>{kmR.toFixed(0)} ккал/день</b> — LBM: {(kmW * (100 - kmBF) / 100).toFixed(1)} кг</div>}
      </CalcBlock>

      <CalcBlock title="TDEE" desc="BMR × PAL — общий дневной расход энергии">
        <Row label="BMR (ккал)"><input type="number" value={teeBmr} onChange={e => setTeeBmr(+e.target.value)} style={IN} /></Row>
        <Row label="Активность"><select value={teePal} onChange={e => setTeePal(+e.target.value)} style={SEL}>{PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Row>
        <button onClick={() => setTeeR(teeBmr * teePal)} style={BTN}>Рассчитать</button>
        {teeR !== null && <div style={RES}>TDEE: <b>{teeR.toFixed(0)} ккал/день</b></div>}
      </CalcBlock>

      <CalcBlock title="Калорийный дефицит" desc="TDEE − целевые ккал → скорость потери веса">
        <Row label="TDEE (ккал/д)"><input type="number" value={defT} onChange={e => setDefT(+e.target.value)} style={IN} /></Row>
        <Row label="Цель (ккал/д)"><input type="number" value={defG} onChange={e => setDefG(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const d = defT - defG; setDefR({ deficit: d, rateKgWeek: d / 7700 }); }} style={BTN}>Рассчитать</button>
        {defR !== null && <div style={RES}>Дефицит: <b>{defR.deficit} ккал/день</b> · Потеря: <b>{defR.rateKgWeek.toFixed(2)} кг/нед</b> — {defR.deficit <= 0 ? 'Нет дефицита' : defR.deficit < 500 ? 'Мягкий' : defR.deficit < 1000 ? 'Умеренный' : 'Агрессивный'}</div>}
      </CalcBlock>

      <CalcBlock title="Макросы (БЖУ)" desc="Полный расчёт БЖУ, воды и клетчатки по движку nutrition">
        <Row label="Вес (кг)"><input type="number" value={macW} onChange={e => setMacW(+e.target.value)} style={IN} /></Row>
        <Row label="Рост (см)"><input type="number" value={macH} onChange={e => setMacH(+e.target.value)} style={IN} /></Row>
        <Row label="Возраст"><input type="number" value={macA} onChange={e => setMacA(+e.target.value)} style={IN} /></Row>
        <Row label="Пол"><select value={macS} onChange={e => setMacS(e.target.value as any)} style={SEL}><option value="male">Мужской</option><option value="female">Женский</option></select></Row>
        <Row label="PAL"><select value={macP} onChange={e => setMacP(+e.target.value)} style={SEL}>{PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Row>
        <Row label="Цель"><select value={macG} onChange={e => setMacG(e.target.value)} style={SEL}><option value="bulk">Набор массы</option><option value="cut">Снижение веса</option><option value="maintenance">Поддержание</option><option value="recomp">Рекомпозиция</option><option value="rehab">Реабилитация</option></select></Row>
        <button onClick={() => { const t = calcNutrition({ weightKg: macW, heightCm: macH, age: macA, sex: macS, pal: macP, goal: macG } as NutritionInput); setMacR({ kcal: t.kcal, protein: t.protein, fats: t.fats, carbs: t.carbs, water: t.water, fiber: t.fiber }); }} style={BTN}>Рассчитать</button>
        {macR !== null && <div style={RES}>Ккал: <b>{macR.kcal}</b> · Белки: <b>{macR.protein} г</b> · Жиры: <b>{macR.fats} г</b> · Углеводы: <b>{macR.carbs} г</b> · Вода: <b>{macR.water} л</b> · Клетчатка: <b>{macR.fiber} г</b></div>}
      </CalcBlock>

      {/* ── Раздел 2: Лабораторные индексы ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>🔬 Лабораторные индексы</div>

      <CalcBlock title="HOMA-IR" desc="(Глюкоза × Инсулин) / 22.5 — индекс инсулинорезистентности">
        <Row label="Глюкоза (ммоль/л)"><input type="number" step="0.1" value={homG} onChange={e => setHomG(+e.target.value)} style={IN} /></Row>
        <Row label="Инсулин (μЕ/мл)"><input type="number" step="0.1" value={homI} onChange={e => setHomI(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const idx = (homG * homI) / 22.5; setHomR({ index: idx, resistant: idx > 2.5 }); }} style={BTN}>Рассчитать</button>
        {homR !== null && <div style={RES}>HOMA-IR: <b>{homR.index.toFixed(2)}</b> — {homR.resistant ? '⚡ Инсулинорезистентность (>2.5)' : '✅ Норма'}</div>}
      </CalcBlock>

      <CalcBlock title="Кальций скорректированный" desc="Ca_общ + 0.8 × (4.0 − альбумин)">
        <Row label="Общий Ca (ммоль/л)"><input type="number" step="0.01" value={caT} onChange={e => setCaT(+e.target.value)} style={IN} /></Row>
        <Row label="Альбумин (г/дл)"><input type="number" step="0.1" value={caA} onChange={e => setCaA(+e.target.value)} style={IN} /></Row>
        <button onClick={() => setCaR(caT + 0.8 * (4.0 - caA))} style={BTN}>Рассчитать</button>
        {caR !== null && <div style={RES}>Ca корр.: <b>{caR.toFixed(2)} ммоль/л</b> — {caR < 2.1 ? 'Гипокальциемия' : caR > 2.6 ? 'Гиперкальциемия' : 'Норма'}</div>}
      </CalcBlock>

      <CalcBlock title="Атерогенный индекс" desc="(Общий ХС − HDL) / HDL — риск атеросклероза">
        <Row label="Общий ХС (ммоль/л)"><input type="number" step="0.01" value={athTC} onChange={e => setAthTC(+e.target.value)} style={IN} /></Row>
        <Row label="HDL (ммоль/л)"><input type="number" step="0.01" value={athHDL} onChange={e => setAthHDL(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const idx = (athTC - athHDL) / athHDL; setAthR({ index: idx, highRisk: idx > 3 }); }} style={BTN}>Рассчитать</button>
        {athR !== null && <div style={RES}>Индекс: <b>{athR.index.toFixed(2)}</b> — {athR.highRisk ? '⚠ Высокий риск (>3)' : '✅ Допустимый'}</div>}
      </CalcBlock>

      {/* ── Раздел 3: Производительность ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>💪 Производительность</div>

      <CalcBlock title="Сила хвата" desc="Оценка общей силы по кистевой динамометрии">
        <Row label="Сила хвата (кг)"><input type="number" value={gripK} onChange={e => setGripK(+e.target.value)} style={IN} /></Row>
        <Row label="Пол"><select value={gripS} onChange={e => setGripS(e.target.value as any)} style={SEL}><option value="male">Мужской</option><option value="female">Женский</option></select></Row>
        <Row label="Возраст"><input type="number" value={gripA} onChange={e => setGripA(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const ref = gripS === 'male' ? 50 - (gripA - 30) * 0.3 : 30 - (gripA - 30) * 0.2; const pct = Math.min(100, Math.max(0, (gripK / ref) * 100)); setGripR({ percentile: Math.round(pct), level: pct >= 80 ? 'Высокий' : pct >= 60 ? 'Средний' : pct >= 40 ? 'Ниже среднего' : 'Низкий' }); }} style={BTN}>Оценить</button>
        {gripR !== null && <div style={RES}>Процентиль: <b>{gripR.percentile}%</b> — {gripR.level}</div>}
      </CalcBlock>

      <CalcBlock title="Стресс (HRV)" desc="Оценка стресса по вариабельности сердечного ритма">
        <Row label="RMSSD/HRV (мс)"><input type="number" value={hrvV} onChange={e => setHrvV(+e.target.value)} style={IN} /></Row>
        <button onClick={() => { const s = Math.max(0, Math.min(100, 100 - (hrvV - 20) * 2)); setStrR({ stress: Math.round(s), level: s >= 70 ? 'Высокий стресс' : s >= 30 ? 'Умеренный' : 'Низкий стресс' }); }} style={BTN}>Оценить</button>
        {strR !== null && <div style={RES}>Уровень стресса: <b>{strR.stress}%</b> — {strR.level}</div>}
      </CalcBlock>

      {/* ── Раздел 4: Фармакология ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>💉 Фармакология</div>

      <CalcBlock title="Дозировка препарата" desc="Расчёт объёма инъекции по дозе и концентрации">
        <Row label="Доза (мг)"><input type="number" value={doseT} onChange={e => setDoseT(+e.target.value)} style={IN} /></Row>
        <Row label="Концентрация (мг/мл)"><input type="number" value={doseC} onChange={e => setDoseC(+e.target.value)} style={IN} /></Row>
        <Row label="Шприц (мл)"><select value={doseS} onChange={e => setDoseS(+e.target.value)} style={SEL}>{Object.keys(SYRINGE_SPECS).map(k => <option key={k} value={k}>{k} мл</option>)}</select></Row>
        <button onClick={() => { setDoseR(calculateDose({ targetDoseMg: doseT, concentrationMgPerMl: doseC, syringeVolumeMl: doseS } as DoseRequest)); }} style={BTN}>Рассчитать</button>
        {doseR !== null && <div style={RES}>Объём: <b>{doseR.volumeMl} мл</b> · Деления: <b>{doseR.divisions}</b> · Доз во флаконе: <b>{doseR.dosesPerVial}</b>{doseR.flags.length > 0 && <span style={{ color: '#ef4444' }}> ⚠ {doseR.flags.join(', ')}</span>}</div>}
      </CalcBlock>

      <CalcBlock title="Андрогенный индекс стека" desc="Σ (доза × AR_affinity / 100) — суммарная андрогенная нагрузка">
        {aiE.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            <select value={e.drug} onChange={v => { const n = [...aiE]; n[i] = { ...n[i], drug: v.target.value }; setAiE(n); }} style={{ ...SEL, flex: 1 }}>{DRUG_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select>
            <input type="number" value={e.doseMgWeek} onChange={v => { const n = [...aiE]; n[i] = { ...n[i], doseMgWeek: +v.target.value }; setAiE(n); }} style={{ ...IN, maxWidth: 80 }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>мг/нед</span>
            {aiE.length > 1 && <button onClick={() => setAiE(aiE.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button onClick={() => setAiE([...aiE, { drug: 'testosterone_enanthate', doseMgWeek: 300 }])} style={{ ...BTN, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', flex: 1 }}>+ Добавить</button>
          <button onClick={() => { let total = 0; aiE.forEach(e => { const dt = DRUG_THRESHOLDS[e.drug]; if (dt) total += e.doseMgWeek * dt.androgenicity / 100; }); setAiR(total); }} style={BTN}>Рассчитать</button>
        </div>
        {aiR !== null && <div style={RES}>Андрогенный индекс: <b>{aiR.toFixed(2)}</b> — {aiR > 3 ? 'Высокий' : aiR > 1.5 ? 'Умеренный' : 'Низкий'}</div>}
      </CalcBlock>

    </div>
  );
};

export default HealthCalculatorsTab;
