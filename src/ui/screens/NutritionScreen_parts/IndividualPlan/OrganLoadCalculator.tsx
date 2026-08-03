import React, { useState, useMemo, useCallback, useEffect } from "react";
import { usePlanCtx } from "./IndividualPlanContext";
import {
  calcOrganLoad, compareScenarios, ORGAN_LABELS, ORGAN_KEYS,
  saveOrganLoadHistory, loadOrganLoadHistory, clearOrganLoadHistory,
  type OrganLoadInput, type OrganLoadResult, type OrganLoadScore, type OrganLoadHistoryEntry,
} from "../../../../engines/nutrition-organ-load.engine";
import { GlassCard, PillBtn, inputStyle } from "./ui";

type Mode = 'calc' | 'compare' | 'history';

const LEVEL_RU: Record<string, string> = {
  low: 'Низкая', moderate: 'Умеренная', elevated: 'Повышенная', high: 'Высокая', critical: 'Критическая',
};

const barBg: React.CSSProperties = {
  height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flex: 1,
};
const barFill = (pct: number, color: string): React.CSSProperties => ({
  width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.4s ease',
});
const statusBadge = (level: string, color: string): React.CSSProperties => ({
  fontSize: 8, padding: '2px 8px', borderRadius: 6, background: `${color}18`, color, fontWeight: 600, whiteSpace: 'nowrap',
});

// ─── SVG Radar Chart ───
const RadarChart: React.FC<{ scores: Array<{ label: string; score: number; color: string; icon: string }>; size?: number }> = ({ scores, size = 260 }) => {
  const cx = size / 2, cy = size / 2, radius = size / 2 - 40, levels = 5;
  const n = scores.length;
  if (n < 3) return null;
  const angleSlice = (2 * Math.PI) / n;
  const point = (i: number, r: number): [number, number] => [
    cx + r * Math.cos(angleSlice * i - Math.PI / 2),
    cy + r * Math.sin(angleSlice * i - Math.PI / 2),
  ];
  const gridLines: React.ReactNode[] = [];
  for (let l = 1; l <= levels; l++) {
    const r = (radius * l) / levels;
    const pts = Array.from({ length: n }, (_, i) => point(i, r).join(',')).join(' ');
    gridLines.push(<polygon key={`grid-${l}`} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />);
  }
  const axisLines: React.ReactNode[] = [];
  scores.forEach((_, i) => {
    const [x, y] = point(i, radius);
    axisLines.push(<line key={`axis-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />);
  });
  const dataPts = Array.from({ length: n }, (_, i) => point(i, Math.max(4, radius * Math.min(100, Math.max(0, scores[i].score)) / 100)).join(',')).join(' ');
  const labelRadius = radius + 16;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {gridLines}
      {axisLines}
      <polygon points={dataPts} fill="rgba(0,230,138,0.12)" stroke="#00e68a" strokeWidth={1.5} strokeLinejoin="round" />
      {scores.map((s, i) => {
        const [x, y] = point(i, Math.max(4, radius * Math.min(100, Math.max(0, s.score)) / 100));
        return <circle key={`dot-${i}`} cx={x} cy={y} r={3} fill={s.color} />;
      })}
      {scores.map((s, i) => {
        const [x, y] = point(i, labelRadius);
        const align = x < cx - 20 ? 'end' : x > cx + 20 ? 'start' : 'middle';
        return (
          <text key={`lab-${i}`} x={x} y={y} textAnchor={align} dominantBaseline="central"
            fill="rgba(255,255,255,0.7)" fontSize={7} fontWeight={600}>
            {s.icon} {s.score}
          </text>
        );
      })}
    </svg>
  );
};

// ─── Organ Row ───
const OrganRow: React.FC<{
  organ: string; score: OrganLoadScore; detail?: React.ReactNode; advice?: string;
  open: boolean; onToggle: () => void;
}> = ({ organ, score, detail, advice, open, onToggle }) => {
  const meta = ORGAN_LABELS[organ] || { label: organ, icon: '🔬' };
  return (
    <div style={{ marginBottom: 3 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', cursor: 'pointer' }}>
        <span style={{ fontSize: 13 }}>{meta.icon}</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#fff', minWidth: 80 }}>{meta.label}</span>
        <div style={barBg}>
          <div style={barFill(score.score, score.color)} />
        </div>
        <span style={{ fontSize: 8, fontWeight: 700, color: score.color, minWidth: 24, textAlign: 'right' }}>{score.score}</span>
        <span style={statusBadge(score.level, score.color)}>{LEVEL_RU[score.level]}</span>
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginLeft: 19, padding: '6px 8px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
          {detail}
          {advice && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, marginTop: detail ? 4 : 0 }}>{advice}</div>}
        </div>
      )}
    </div>
  );
};

// ─── Manual Input Fields ───
const ManualFields: React.FC<{
  values: Record<string, number>; setters: Record<string, (v: number) => void>;
}> = ({ values, setters }) => {
  const fields = [
    { key: 'protein',  label: 'Белки (г)',       color: '#f97316', half: true },
    { key: 'fat',      label: 'Жиры (г)',        color: '#f59e0b', half: true },
    { key: 'satFat',   label: 'Насыщ. жиры (г)',  color: '#f97316', half: true },
    { key: 'transFat', label: 'Трансжиры (г)',    color: '#ef4444', half: true },
    { key: 'carbs',    label: 'Углеводы (г)',     color: '#60a5fa', half: true },
    { key: 'sugar',    label: 'Сахар (г)',        color: '#a855f7', half: true },
    { key: 'fiber',    label: 'Клетчатка (г)',    color: '#22c55e', half: true },
    { key: 'omega3',   label: 'Омега-3 (мг)',     color: '#06b6d4', half: true },
    { key: 'chol',     label: 'Холестерин (мг)',  color: '#ef4444', half: true },
    { key: 'sodium',   label: 'Натрий (мг)',      color: '#3b82f6', half: true },
    { key: 'potassium',label: 'Калий (мг)',       color: '#22c55e', half: true },
    { key: 'water',    label: 'Вода (мл)',        color: '#60a5fa', half: true },
    { key: 'weight',   label: 'Вес (кг)',         color: '#fff',    styleKey: true },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
      {fields.map(f => (
        <div key={f.key} style={f.styleKey ? { gridColumn: '1/-1' } : undefined}>
          <div style={{ fontSize: 7, color: f.color, marginBottom: 1, fontWeight: 600 }}>{f.label}</div>
          <input type="number" value={values[f.key] ?? ''} onChange={e => setters[f.key]?.(Number(e.target.value) || 0)}
            style={{ ...inputStyle, padding: '5px 8px', fontSize: 10 }} />
        </div>
      ))}
    </div>
  );
};

// ─── MAIN COMPONENT ───

export const OrganLoadCalculator: React.FC = () => {
  const ctx = usePlanCtx();

  // ── Input state ──
  const [useCtx, setUseCtx] = useState(true);
  const [manualP, setManualP] = useState(ctx.effectiveP || 150);
  const [manualF, setManualF] = useState(ctx.effectiveF || 70);
  const [manualC, setManualC] = useState(ctx.effectiveC || 250);
  const [manualSat, setManualSat] = useState(30);
  const [manualTrans, setManualTrans] = useState(1);
  const [manualSug, setManualSug] = useState(60);
  const [manualFib, setManualFib] = useState(25);
  const [manualO3, setManualO3] = useState(500);
  const [manualChol, setManualChol] = useState(300);
  const [manualNa, setManualNa] = useState(2000);
  const [manualK, setManualK] = useState(3500);
  const [manualWater, setManualWater] = useState(2100);
  const [manualWeight, setManualWeight] = useState(ctx.weight || 70);
  const [manualHeight, setManualHeight] = useState(175);
  const [manualTrain, setManualTrain] = useState(0);
  const [manualMeals, setManualMeals] = useState(4);

  const [showConditions, setShowConditions] = useState(false);
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<Mode>('calc');
  const [historyList, setHistoryList] = useState<OrganLoadHistoryEntry[]>([]);

  const bw = useCtx ? (ctx.weight || 70) : manualWeight;
  const protein = useCtx ? (ctx.effectiveP || 150) : manualP;
  const fat     = useCtx ? (ctx.effectiveF || 70) : manualF;
  const carbs   = useCtx ? (ctx.effectiveC || 250) : manualC;
  // P2-fix: улучшены эвристики для sat/trans в useCtx mode.
  // Раньше sat=fat*0.3 (всегда 30%) и trans=1г (всегда 1г) — неточно для разных диет.
  // Теперь sat оценивается по категории плана (cutting → ниже, mass → выше),
  // а trans — 0.5г для чистых диет, 1.5г для budget=low (больше processed food).
  const planSatRatio = ctx?.budget === 'low' ? 0.35 : ctx?.budget === 'max' || ctx?.budget === 'enhanced' ? 0.25 : 0.3;
  const sat     = useCtx ? (fat * planSatRatio) : manualSat;
  const trans   = useCtx ? (ctx?.budget === 'low' ? 1.5 : 0.5) : manualTrans;
  const sugar   = useCtx ? (carbs * 0.25) : manualSug;
  const fiber   = useCtx ? 25 : manualFib;
  const omega3  = useCtx ? 500 : manualO3;
  const chol    = manualChol;
  const sodium  = manualNa;
  const potass  = manualK;
  const water   = manualWater;
  const height  = manualHeight;
  const train   = useCtx ? 0 : manualTrain;
  const meals   = useCtx ? 4 : manualMeals;

  const totalKcal = protein * 4 + fat * 9 + carbs * 4;

  const conditionsList = useMemo(() => {
    const h = (ctx.healthIssues || []) as string[];
    const map: Record<string, string> = {
      diabetes: 'diabetes', gi_issues: 'ibs', hypertension: 'hypertension',
      kidney_stones: 'ckd', gout: 'gout', lactose_intolerance: 'ibs',
    };
    return [...new Set(h.map(x => map[x]).filter(Boolean))];
  }, [ctx.healthIssues]);

  const buildInput = useCallback((): OrganLoadInput => ({
    proteinG: protein, fatG: fat, satFatG: sat, transFatG: trans,
    carbsG: carbs, sugarG: sugar, fiberG: fiber, omega3Mg: omega3,
    cholesterolMg: chol, sodiumMg: sodium, potassiumMg: potass,
    waterMl: water, bodyWeightKg: bw, heightCm: height, leanMassKg: bw * 0.75,
    trainingHours: train, mealsPerDay: meals, totalKcal,
    conditions: conditionsList.length > 0 ? conditionsList : undefined,
  }), [protein, fat, sat, trans, carbs, sugar, fiber, omega3, chol, sodium, potass, water, bw, height, train, meals, totalKcal, conditionsList]);

  const result = useMemo(() => calcOrganLoad(buildInput()), [buildInput]);

  // Save on change
  useEffect(() => {
    if (activeMode === 'calc') {
      const t = setTimeout(() => saveOrganLoadHistory(buildInput()), 800);
      return () => clearTimeout(t);
    }
  }, [buildInput, activeMode]);

  const toggleOrgan = (key: string) => setExpandedOrgan(expandedOrgan === key ? null : key);

  // ── Radar Data ──
  const radarData = useMemo(() => ORGAN_KEYS.map(k => {
    const s = (result as any)[k] as OrganLoadScore;
    const meta = ORGAN_LABELS[k];
    return { label: meta.label, score: s?.score ?? 0, color: s?.color ?? '#fff', icon: meta.icon };
  }), [result]);

  // ── Comparison state ──
  const [compB, setCompB] = useState<OrganLoadInput | null>(null);
  const [scenB, setScenB] = useState({ protein: 120, fat: 50, satFat: 15, transFat: 0, carbs: 300, sugar: 50, fiber: 30, omega3: 2000, chol: 200, sodium: 1500, potassium: 4700, water: 2800, weight: 70 });
  const setFieldB = (k: string) => (v: number) => setScenB(prev => ({ ...prev, [k]: v }));
  const comparison = useMemo(() => {
    if (!compB) return null;
    return compareScenarios(buildInput(), compB);
  }, [buildInput, compB]);

  const buildBFromScen = (): OrganLoadInput => ({
    proteinG: scenB.protein, fatG: scenB.fat, satFatG: scenB.satFat, transFatG: scenB.transFat,
    carbsG: scenB.carbs, sugarG: scenB.sugar, fiberG: scenB.fiber, omega3Mg: scenB.omega3,
    cholesterolMg: scenB.chol, sodiumMg: scenB.sodium, potassiumMg: scenB.potassium,
    waterMl: scenB.water, bodyWeightKg: scenB.weight || bw, heightCm: height, leanMassKg: (scenB.weight || bw) * 0.75,
    trainingHours: train, mealsPerDay: meals, totalKcal: scenB.protein * 4 + scenB.fat * 9 + scenB.carbs * 4,
  });

  const renderComparisonDeltas = () => {
    if (!comparison) return null;
    return comparison.deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5).map(d => (
      <div key={d.organ} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', borderRadius: 3,
        background: d.improved ? 'rgba(0,230,138,0.04)' : 'rgba(239,68,68,0.04)' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{ORGAN_LABELS[d.organ]?.icon} {ORGAN_LABELS[d.organ]?.label}</span>
        <span style={{ color: d.improved ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {d.aScore} → {d.bScore} ({d.delta > 0 ? '+' : ''}{d.delta})
        </span>
      </div>
    ));
  };

  // ── What-if sliders ──
  const [deltaP, setDeltaP] = useState(0);
  const [deltaC, setDeltaC] = useState(0);
  const [deltaFb, setDeltaFb] = useState(0);
  const whatIfInput = useMemo<OrganLoadInput>(() => ({
    ...buildInput(),
    proteinG: Math.max(0, protein + deltaP),
    carbsG: Math.max(0, carbs + deltaC),
    fiberG: Math.max(0, fiber + deltaFb),
    totalKcal: (Math.max(0, protein + deltaP)) * 4 + fat * 9 + (Math.max(0, carbs + deltaC)) * 4,
  }), [buildInput, deltaP, deltaC, deltaFb, protein, carbs, fiber, fat]);
  const whatIfResult = useMemo(() => calcOrganLoad(whatIfInput), [whatIfInput]);

  // ── History ──
  useEffect(() => { setHistoryList(loadOrganLoadHistory()); }, [activeMode]);

  // ── Render helpers ──
  const renderOrganDetail = (key: string) => {
    const item = (result as any)[key] as any;
    if (!item) return null;
    switch (key) {
      case 'liver':
        return item.breakdown ? (
          <div style={{ display: 'flex', gap: 8, fontSize: 7, marginBottom: 2 }}>
            <span style={{ color: '#f97316' }}>Б: {item.breakdown.protein}</span>
            <span style={{ color: '#f59e0b' }}>Ж: {item.breakdown.fat}</span>
            <span style={{ color: '#60a5fa' }}>У: {item.breakdown.carbs}</span>
            {item.breakdown.fructose != null && <span style={{ color: '#a855f7' }}>Фрукт: {item.breakdown.fructose}</span>}
            <span style={{ color: '#ef4444' }}>NH₃: {item.ammoniaMgH} г/ч</span>
          </div>
        ) : null;
      case 'kidneys':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          RSL: {item.rslMosm} мОсм · PRAL: {item.pralMEq > 0 ? '+' : ''}{item.pralMEq} мЭкв · Вода: {water} мл ({Math.round(water/bw)} мл/кг)
        </div>;
      case 'pancreas':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          Инсулин: ~{item.insulinDemandU} ЕД · ГН: {item.glycemicLoad} · Углев. плотность: {item.carbDensityPct}%
        </div>;
      case 'gallbladder':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          Желчь: {item.bileDemandMg} мг · Жиров на приём: {item.fatPerMealG} г
        </div>;
      case 'cardiovascular':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          АИ: {item.atherogenicIndex} · Ω6/3: {item.omegaRatio}:1 · Нас.жиры: {sat.toFixed(0)} г · Транс: {trans.toFixed(1)} г
        </div>;
      case 'giTract':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          SCFA: {item.fermentationG} г/сут · Транзит: ~{item.transitHours} ч · Клетчатка: {fiber} г
        </div>;
      case 'adipose':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          {item.surplusKcal > 0 ? `Профицит: +${item.surplusKcal} ккал` : `Дефицит: ${item.surplusKcal} ккал`} · Липогенез: {item.storageRateGH} г/ч
        </div>;
      case 'bones':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          PRAL: {item.pralNet > 0 ? '+' : ''}{item.pralNet} мЭкв · Ca баланс: {item.calciumBalanceMg} мг · K: {potass} мг
        </div>;
      case 'cns':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          Δ гликемии: {item.glycemicSwing} · Сахар: {sugar} г
        </div>;
      case 'endocrine':
        return <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
          Инсул. нагрузка: {item.insulinLoad} ч/сут · Грелин: {item.ghrelinSuppressionH} ч
        </div>;
      default: return null;
    }
  };

  // ── MAIN RENDER ──
  const topScore = result.totalMetabolicLoad;

  return (
    <div style={{ paddingBottom: 80, maxWidth: 540, margin: '0 auto' }}>
      {/* ── Mode tabs ── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {[
          { key: 'calc' as Mode, label: 'Расчёт', icon: '🧬' },
          { key: 'compare' as Mode, label: 'Сравнение', icon: '⚖️' },
          { key: 'history' as Mode, label: 'История', icon: '📈' },
        ].map(m => (
          <PillBtn key={m.key} active={activeMode === m.key} onClick={() => setActiveMode(m.key)} color="#8b5cf6">
            {m.icon} {m.label}
          </PillBtn>
        ))}
      </div>

      {/* ════════════════════ CALC MODE ════════════════════ */}
      {activeMode === 'calc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ── Data Source ── */}
          <GlassCard title="Нагрузка БЖУ на органы" icon="🧬" color="#8b5cf6">
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.4 }}>
              Оценка метаболической нагрузки макронутриентов на 10 систем органов.
              Физиология пищеварения, гепатология, нефрология, эндокринология, нейрофизиология.
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <PillBtn active={useCtx} onClick={() => setUseCtx(true)} color="#00e68a">📋 Данные плана</PillBtn>
              <PillBtn active={!useCtx} onClick={() => setUseCtx(false)} color="#8b5cf6">✏️ Ручной ввод</PillBtn>
              <PillBtn active={showConditions} onClick={() => setShowConditions(!showConditions)} color="#ef4444" style={{ fontSize: 8 }}>
                🏥
              </PillBtn>
            </div>

            {useCtx ? (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                Б{Math.round(protein)} / Ж{Math.round(fat)} / У{Math.round(carbs)} г · {Math.round(totalKcal)} ккал · {bw} кг
              </div>
            ) : (
              <ManualFields
                values={{ protein: manualP, fat: manualF, satFat: manualSat, transFat: manualTrans, carbs: manualC, sugar: manualSug, fiber: manualFib, omega3: manualO3, chol: manualChol, sodium: manualNa, potassium: manualK, water: manualWater, weight: manualWeight }}
                setters={{
                  protein: setManualP, fat: setManualF, satFat: setManualSat, transFat: setManualTrans,
                  carbs: setManualC, sugar: setManualSug, fiber: setManualFib, omega3: setManualO3,
                  chol: setManualChol, sodium: setManualNa, potassium: setManualK, water: setManualWater, weight: setManualWeight,
                }}
              />
            )}

            {showConditions && conditionsList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
                {conditionsList.map(c => (
                  <span key={c} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    🏥 {c === 'diabetes' ? 'Диабет' : c === 'nafld' ? 'Жировой гепатоз' : c === 'ckd' ? 'ХБП' : c === 'hypertension' ? 'Гипертония' : c === 'gallstones' ? 'ЖКБ' : c === 'ibs' ? 'СРК' : c === 'gout' ? 'Подагра' : c}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>

          {/* ── Integral Score ── */}
          <GlassCard title="Интегральная нагрузка" icon="🎯" color={topScore.color}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${topScore.color}20`, border: `3px solid ${topScore.color}` }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: topScore.color }}>{topScore.score}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: topScore.color }}>{LEVEL_RU[topScore.level]} метаболическая нагрузка</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>{result.metabolicProfile} профиль</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  {result.systemCoverage.slice(0, 3).map(s => `${ORGAN_LABELS[s.organ]?.label}: ${s.pctContribution}%`).join(' · ')}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* ── Radar Chart ── */}
          <GlassCard title="Радар систем органов" icon="🕸️" color="#00e68a">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RadarChart scores={radarData} size={260} />
            </div>
          </GlassCard>

          {/* ── Organ Bars ── */}
          <GlassCard title="Детализация по органам" icon="🔬" color="#60a5fa">
            {ORGAN_KEYS.map(k => (
              <OrganRow key={k} organ={k} score={(result as any)[k] as OrganLoadScore}
                detail={renderOrganDetail(k)} advice={(result as any)[k]?.advice}
                open={expandedOrgan === k} onToggle={() => toggleOrgan(k)} />
            ))}
          </GlassCard>

          {/* ── What-if Sliders ── */}
          <GlassCard title="What-if: изменить макросы" icon="🎛️" color="#f59e0b">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Δ Белки', value: deltaP, set: setDeltaP, step: 10, min: -150, max: 150, color: '#f97316', unit: 'г' },
                { label: 'Δ Углеводы', value: deltaC, set: setDeltaC, step: 20, min: -250, max: 250, color: '#60a5fa', unit: 'г' },
                { label: 'Δ Клетчатка', value: deltaFb, set: setDeltaFb, step: 5, min: -25, max: 50, color: '#22c55e', unit: 'г' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: s.color, marginBottom: 2 }}>
                    <span>{s.label}</span><span>{s.value > 0 ? '+' : ''}{s.value} {s.unit}</span>
                  </div>
                  <input type="range" value={s.value} min={s.min} max={s.max} step={s.step}
                    onChange={e => s.set(Number(e.target.value))}
                    style={{ width: '100%', accentColor: s.color, height: 4 }} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 8, marginTop: 2 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Интегральная после изменений:</span>
                <span style={{ fontWeight: 800, color: whatIfResult.totalMetabolicLoad.color }}>
                  {whatIfResult.totalMetabolicLoad.score}
                  {whatIfResult.totalMetabolicLoad.score !== topScore.score && (
                    <span style={{ fontSize: 7, marginLeft: 4, color: whatIfResult.totalMetabolicLoad.score < topScore.score ? '#22c55e' : '#ef4444' }}>
                      {whatIfResult.totalMetabolicLoad.score < topScore.score ? '↓' : '↑'}{Math.abs(whatIfResult.totalMetabolicLoad.score - topScore.score)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* ── Protein / kg ── */}
          <GlassCard title="Белок / кг веса" icon="🥩" color="#f97316">
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
              {protein} г / {bw} кг = <strong style={{ color: '#f97316' }}>{(protein / bw).toFixed(1)} г/кг</strong>
            </div>
            <div style={barBg}>
              <div style={barFill(Math.min(100, protein / bw * 14), protein / bw > 2.4 ? '#ef4444' : protein / bw > 1.6 ? '#f59e0b' : '#22c55e')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              <span>0</span><span>1.6-2.2 г/кг</span><span>3.5+</span>
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {protein / bw > 2.4 ? '⚠️ Высокий белок — контроль RSL и гидратации' : protein / bw > 1.6 ? '✅ Оптимально для спортсменов' : protein / bw > 1.0 ? '🟡 Умеренно' : '🔴 Низкий — риск саркопении'}
            </div>
          </GlassCard>

          {/* ── Recommendations ── */}
          <GlassCard title="Рекомендации нутрициолога" icon="📋" color="#00e68a">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ORGAN_KEYS.map(k => {
                const s = (result as any)[k] as OrganLoadScore;
                if (!s || s.score <= 35) return null;
                const meta = ORGAN_LABELS[k];
                return (
                  <div key={k} style={{ fontSize: 7, padding: '4px 6px', borderRadius: 6, background: `${s.color}08`, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                    {meta.icon} <strong style={{ color: s.color }}>{meta.label} ({s.score})</strong>: {(result as any)[k]?.advice}
                  </div>
                );
              })}
              {ORGAN_KEYS.every(k => ((result as any)[k] as OrganLoadScore)?.score <= 35) && (
                <div style={{ fontSize: 8, color: '#22c55e' }}>✅ Все 10 систем в пределах нормы. Отличный баланс макронутриентов.</div>
              )}
            </div>
          </GlassCard>

          {/* ── Key Factors ── */}
          <GlassCard title="Факторы влияния" icon="⚖️" color="#8b5cf6">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 7, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
              <div><strong style={{ color: '#60a5fa' }}>Вода:</strong> при RSL {'>'} 600 мОсм — ≥{Math.round(bw * 40)} мл/сут. Сейчас: {water} мл ({Math.round(water/bw)} мл/кг)</div>
              <div><strong style={{ color: '#22c55e' }}>Клетчатка:</strong> +5 г снижает ГН на ~15%, связывает жёлчные кислоты</div>
              <div><strong style={{ color: '#f97316' }}>Белок:</strong> 0.4-0.55 г/кг на приём снижает пиковую RSL</div>
              <div><strong style={{ color: '#f59e0b' }}>Омега-3:</strong> ≥2 г EPA+DHA/сут снижают АИ на 15-30%</div>
              <div><strong style={{ color: '#a855f7' }}>K/Na баланс:</strong> K ≥3500 мг нейтрализует PRAL и снижает АД</div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ════════════════════ COMPARE MODE ════════════════════ */}
      {activeMode === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GlassCard title="Сравнение сценариев" icon="⚖️" color="#f59e0b">
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.4 }}>
              Сценарий A — текущие настройки. Задайте сценарий B для сравнения метаболической нагрузки.
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: '#00e68a', marginBottom: 4 }}>Сценарий A (текущий): Б{Math.round(protein)}/Ж{Math.round(fat)}/У{Math.round(carbs)} · {Math.round(totalKcal)} ккал</div>
            </div>
            {!compB ? (
              <div>
                <div style={{ fontSize: 8, fontWeight: 600, color: '#60a5fa', marginBottom: 4 }}>Сценарий B (редактируемый):</div>
                <ManualFields
                  values={{ protein: scenB.protein, fat: scenB.fat, satFat: scenB.satFat, transFat: scenB.transFat, carbs: scenB.carbs, sugar: scenB.sugar, fiber: scenB.fiber, omega3: scenB.omega3, chol: scenB.chol, sodium: scenB.sodium, potassium: scenB.potassium, water: scenB.water, weight: scenB.weight }}
                  setters={{
                    protein: setFieldB('protein'), fat: setFieldB('fat'), satFat: setFieldB('satFat'), transFat: setFieldB('transFat'),
                    carbs: setFieldB('carbs'), sugar: setFieldB('sugar'), fiber: setFieldB('fiber'), omega3: setFieldB('omega3'),
                    chol: setFieldB('chol'), sodium: setFieldB('sodium'), potassium: setFieldB('potassium'), water: setFieldB('water'), weight: setFieldB('weight'),
                  }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => {
                    const newScen = { protein: 120, fat: 50, satFat: 15, transFat: 0, carbs: 300, sugar: 50, fiber: 30, omega3: 2000, chol: 200, sodium: 1500, potassium: 4700, water: 2800, weight: bw };
                    setScenB(newScen);
                    setCompB({ proteinG: 120, fatG: 50, satFatG: 15, transFatG: 0, carbsG: 300, sugarG: 50,
                      fiberG: 30, omega3Mg: 2000, cholesterolMg: 200, sodiumMg: 1500, potassiumMg: 4700,
                      waterMl: 2800, bodyWeightKg: bw, heightCm: height, leanMassKg: bw * 0.75,
                      trainingHours: train, mealsPerDay: meals, totalKcal: 120 * 4 + 50 * 9 + 300 * 4 });
                  }} style={{ fontSize: 8, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: '#60a5fa', border: 'none', color: '#000', fontWeight: 700 }}>
                    🥗 ЗОЖ-сценарий
                  </button>
                  <button onClick={() => {
                    const newScen = { protein: Math.round(bw * 2.2), fat: Math.round(bw * 1.4), satFat: Math.round(bw * 0.5), transFat: 2, carbs: Math.round(bw * 2.5), sugar: Math.round(bw), fiber: 15, omega3: 300, chol: 600, sodium: 3500, potassium: 2500, water: Math.round(bw * 25), weight: bw };
                    setScenB(newScen);
                    setCompB({ proteinG: bw * 2.2, fatG: bw * 1.4, satFatG: bw * 0.5, transFatG: 2, carbsG: bw * 2.5, sugarG: bw,
                      fiberG: 15, omega3Mg: 300, cholesterolMg: 600, sodiumMg: 3500, potassiumMg: 2500,
                      waterMl: bw * 25, bodyWeightKg: bw, heightCm: height, leanMassKg: bw * 0.75,
                      trainingHours: train, mealsPerDay: 3, totalKcal: bw * 2.2 * 4 + bw * 1.4 * 9 + bw * 2.5 * 4 });
                  }} style={{ fontSize: 8, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700 }}>
                    🍔 Массонабор
                  </button>
                  <button onClick={() => setCompB(buildBFromScen())} style={{ fontSize: 8, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: '#f59e0b', border: 'none', color: '#000', fontWeight: 700 }}>
                    ✅ Применить B
                  </button>
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  Отредактируйте поля выше и нажмите «Применить B» для сравнения, либо выберите готовый сценарий.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: '#60a5fa' }}>Сценарий B: Б{Math.round(compB.proteinG)}/Ж{Math.round(compB.fatG)}/У{Math.round(compB.carbsG)} · {Math.round(compB.totalKcal ?? 0)} ккал</div>
                <button onClick={() => setCompB(null)} style={{ fontSize: 8, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}>✕ Сбросить</button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${comparison?.a.totalMetabolicLoad.color ?? '#fff'}20`, border: `2px solid ${comparison?.a.totalMetabolicLoad.color ?? '#fff'}`, margin: '0 auto' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: comparison?.a.totalMetabolicLoad.color ?? '#fff' }}>{comparison?.a.totalMetabolicLoad.score ?? 0}</span>
                      </div>
                      <span style={{ fontSize: 7, color: '#00e68a' }}>A (текущий)</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>vs</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${comparison?.b.totalMetabolicLoad.color ?? '#fff'}20`, border: `2px solid ${comparison?.b.totalMetabolicLoad.color ?? '#fff'}`, margin: '0 auto' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: comparison?.b.totalMetabolicLoad.color ?? '#fff' }}>{comparison?.b.totalMetabolicLoad.score ?? 0}</span>
                      </div>
                      <span style={{ fontSize: 7, color: '#60a5fa' }}>B</span>
                    </div>

                </div>
                 <div style={{ fontSize: 8, color: (comparison?.deltas?.reduce((a, d) => a + (d?.delta ?? 0), 0) ?? 0) < 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                   {(comparison?.deltas?.reduce((a, d) => a + (d?.delta ?? 0), 0) ?? 0) < 0 ? '✅ Сценарий B снижает общую метаболическую нагрузку' : '⚠️ Сценарий B увеличивает метаболическую нагрузку'}
                 </div>
                 {renderComparisonDeltas()}

              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ════════════════════ HISTORY MODE ════════════════════ */}
      {activeMode === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GlassCard title="История измерений" icon="📈" color="#8b5cf6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>{historyList.length} записей (макс 30)</span>
              {historyList.length > 0 && (
                <button onClick={() => { clearOrganLoadHistory(); setHistoryList([]); }}
                  style={{ fontSize: 7, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  ✕ Очистить
                </button>
              )}
            </div>
            {historyList.length === 0 ? (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                История пуста. Перейдите на вкладку «Расчёт» — данные сохраняются автоматически.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* SVG trend line */}
                <svg width="100%" height="80" style={{ overflow: 'visible', marginBottom: 4 }}>
                  {(() => {
                    const points = historyList.slice(0, 30).reverse();
                    if (points.length < 2) return null;
                    const max = 100, min = 0, w = 500, h = 70, pad = 10;
                    const xStep = (w - pad * 2) / (points.length - 1);
                    const line = points.map((p, i) => {
                      const x = pad + i * xStep;
                      const y = h - ((p.result.totalMetabolicLoad.score - min) / (max - min) * (h - pad * 2) + pad);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');
                    const fillLine = line + ` L ${pad + (points.length - 1) * xStep} ${h} L ${pad} ${h} Z`;
                    return (
                      <>
                        <path d={fillLine} fill="rgba(0,230,138,0.06)" />
                        <path d={line} fill="none" stroke="#00e68a" strokeWidth={1.5} strokeLinejoin="round" />
                        {points.map((p, i) => (
                          <circle key={i} cx={pad + i * xStep} cy={h - ((p.result.totalMetabolicLoad.score - min) / (max - min) * (h - pad * 2) + pad)}
                            r={2.5} fill={p.result.totalMetabolicLoad.color} />
                        ))}
                      </>
                    );
                  })()}
                </svg>
                {/* List */}
                {historyList.slice(0, 15).map((entry, idx) => (
                  <div key={idx} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: '#fff' }}>{entry.date}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: entry.result.totalMetabolicLoad.color }}>
                        {entry.result.totalMetabolicLoad.score} · {LEVEL_RU[entry.result.totalMetabolicLoad.level]}
                      </span>
                    </div>
                    <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)' }}>
                      Б{Math.round(entry.input.proteinG)}/Ж{Math.round(entry.input.fatG)}/У{Math.round(entry.input.carbsG)} г · {Math.round(entry.input.totalKcal ?? 0)} ккал · {entry.result.metabolicProfile}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};
