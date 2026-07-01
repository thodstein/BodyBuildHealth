import React, { useState, useMemo, useCallback } from 'react';
import type { CalculatorState, CalculatorResult, LabSlice } from '../../../engines/support-calculator.types';
import { calculateSupportTZ, hydrateState } from '../../../engines/support-calculator.engine';
import { SYNERGY_ID_LABELS } from '../../../engines/support-calculator.types';
import { getDrugsToNormalizeMarker, getMarkerName } from '../../../data/support-lab-effects';
import { UCUM_MAP } from '../../../core/constants';
import { RiskTimelineChart } from './RiskTimelineChart';

interface SupportCalculatorProps {
  onApply: (result: { level: string; subs: string[]; result: CalculatorResult }) => void;
  embedded?: boolean;
  courseWeek?: number;
}

const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 12 };
const BADGE = (bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 6px', borderRadius: 6, fontSize: 8, fontWeight: 700, background: bg, color: '#000' });

interface ChecklistItem {
  key: string;
  label: string;
  icon: string;
  source: string;
  check: (s: Partial<CalculatorState>) => boolean;
  detail: (s: Partial<CalculatorState>) => string;
}

const CHECKLIST: ChecklistItem[] = [
  { key: 'profile', label: 'Профиль', icon: '👤', source: 'Профиль → Данные калькулятора', check: s => !!(s.profile && s.profile.weight), detail: s => s.profile ? `${s.profile.weight}кг, ${s.profile.age}лет, ${s.profile.sex === 'male' ? 'М' : 'Ж'}` : '—' },
  { key: 'pharma', label: 'Фарма / Курс', icon: '💉', source: 'Фарма → Курс', check: s => !!(s.pharma && (s.pharma.aas?.length > 0 || s.pharma.phase)), detail: s => s.pharma ? `${s.pharma.aas?.length || 0} ААС, фаза: ${s.pharma.phase || '—'}` : '—' },
  { key: 'labs', label: 'Анализы', icon: '🧪', source: 'Анализы / Лаборатория', check: s => !!(s.labs && (s.labs.fullPanel || s.labs.preCourse || s.labs.midCourse)), detail: s => s.labs ? (s.labs.fullPanel ? 'Полный спектр' : [s.labs.preCourse, s.labs.midCourse, s.labs.postPCT].filter(Boolean).length + ' среза') : '—' },
  { key: 'neuro', label: 'Неврология', icon: '🧠', source: 'Профиль → Данные калькулятора', check: s => !!(s.neuro && s.neuro.dopamineScore), detail: s => s.neuro ? `ДА-${s.neuro.dopamineScore}/5, СР-${s.neuro.serotoninScore}/5` : '—' },
  { key: 'hepatic', label: 'Гепатобилиарная', icon: '🫁', source: 'Профиль → Данные калькулятора', check: s => !!(s.hepatobiliary && s.hepatobiliary.altAstElevation), detail: s => s.hepatobiliary ? `АЛТ/АСТ: ${s.hepatobiliary.altAstElevation}` : '—' },
  { key: 'cardio', label: 'ССС', icon: '❤️', source: 'Профиль → Данные калькулятора', check: s => !!(s.cardio && s.cardio.bpStage), detail: s => s.cardio ? `АД: ${s.cardio.bpStage}, ЧСС: ${s.cardio.heartRate}` : '—' },
  { key: 'renal', label: 'Мочевыделительная', icon: '💧', source: 'Профиль → Данные калькулятора', check: s => !!(s.urinary && s.urinary.creatinineElevation), detail: s => s.urinary ? `Креатинин: ${s.urinary.creatinineElevation}` : '—' },
  { key: 'nutrition', label: 'Питание', icon: '🥗', source: 'Профиль → Данные калькулятора', check: s => !!(s.nutrition && s.nutrition.calories), detail: s => s.nutrition ? `${s.nutrition.calories} ккал, Б:${s.nutrition.proteinG}г` : '—' },
  { key: 'contraindications', label: 'Противопоказания', icon: '🩺', source: 'Профиль → Данные калькулятора', check: s => !!(s.contraindications), detail: s => s.contraindications ? (s.contraindications.allergies || (Object.values(s.contraindications).some(Boolean) ? 'Есть ограничения' : 'Нет')) : '—' },
  { key: 'genetics', label: 'Генетика', icon: '🧬', source: 'Профиль → Данные калькулятора', check: s => !!(s.genetics && (s.genetics.cyp19a1 !== 'unknown' || s.genetics.mthfr !== 'normal' || s.genetics.srd5a2 !== 'unknown')), detail: s => s.genetics ? `CYP19A1: ${s.genetics.cyp19a1}, MTHFR: ${s.genetics.mthfr}` : '—' },
  { key: 'gi', label: 'ЖКТ', icon: '🫀', source: 'Профиль → Данные калькулятора', check: s => !!(s.gi), detail: s => s.gi ? (Object.values(s.gi).some(Boolean) ? 'Есть симптомы' : 'Норма') : '—' },
  { key: 'goals', label: 'Цели / Цикл', icon: '🎯', source: 'Профиль → Данные калькулятора', check: s => !!(s.goals && s.goals.trainingCycle), detail: s => s.goals ? `${s.goals.trainingCycle}, ${s.goals.cycleWeeks}нед` : '—' },
];

export const SupportCalculator: React.FC<SupportCalculatorProps> = ({ onApply, embedded, courseWeek: propWeek }) => {
  const [hydrated, setHydrated] = useState<Partial<CalculatorState> | null>(null);
  const [collected, setCollected] = useState(false);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [level, setLevel] = useState<'basic' | 'mid' | 'max'>('mid');
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const doCollect = useCallback(() => {
    const h = hydrateState();
    setHydrated(h);
    setCollected(true);
  }, []);

  const state = useMemo<CalculatorState | null>(() => {
    if (!hydrated) return null;
    const base: CalculatorState = {
      profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100, ...(hydrated.profile || {}) },
      neuro: { dopamineScore: 1, serotoninScore: 1, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 1, headaches: false, weatherDependent: false, sleepQuality: 'good', ...(hydrated.neuro || {}) },
      pharma: { phase: 'course', aas: [], hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false, hasMGF: false, hasGLP1: false, ...(hydrated.pharma || {}) },
      goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none', ...(hydrated.goals || {}) },
      hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none', ...(hydrated.hepatobiliary || {}) },
      urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal', ...(hydrated.urinary || {}) },
      cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false, ...(hydrated.cardio || {}) },
      oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [], ...(hydrated.oda || {}) },
      labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null, ...(hydrated.labs || {}) },
      nutrition: { calories: 2500, proteinG: 160, fatG: 80, carbsG: 300, waterL: 2, saltIntake: 'normal', omega3: false, fiberG: 25, proteinGPerKg: 1.8, sodiumMg: 3500, potassiumMg: 4500, ...(hydrated.nutrition || {}) },
      contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false, ...(hydrated.contraindications || {}) },
      journal: { positive: [], negative: [], ...(hydrated.journal || {}) },
      epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false, ...(hydrated.epicrisis || {}) },
      toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular', ...(hydrated.toxicLoad || {}) },
      dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false, ...(hydrated.dental || {}) },
      genetics: { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'normal', ...(hydrated.genetics || {}) },
      gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false, ...(hydrated.gi || {}) },
      psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1, ...(hydrated.psych || {}) },
      injection: { glutes: '', quads: '', delts: '', localAreas: '', ...(hydrated.injection || {}) },
      powerLevel: level,
      courseWeek: propWeek || hydrated.goals?.cycleWeeks || 1,
    };
    return base;
  }, [hydrated, level, propWeek]);

  const doCalculate = useCallback(() => {
    if (!state) return;
    const res = calculateSupportTZ({ ...state, powerLevel: level });
    setResult(res);
    onApply({ level, subs: res.selectedSubstances, result: res });
  }, [state, level, onApply]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    const lines = [
      `🧬 КАЛЬКУЛЯТОР ПОДДЕРЖКИ — ОТЧЁТ`,
      `📅 ${new Date().toLocaleString('ru-RU')}`,
      `📊 РИСК: ${result.overallRiskBefore}% → ${result.overallRiskAfter}% (ур: ${level})`,
      ``,
      `💊 ПЛАН (${result.schedule.length} позц.):`,
      ...result.schedule.map(item => `  ${item.timeBlock === 'morning' ? '🌅' : item.timeBlock === 'afternoon' ? '☀️' : '🌙'} ${item.name} — ${item.dose}`),
      ``,
      `🔗 Синергии: ${result.synergyIdsUsed.map(id => SYNERGY_ID_LABELS[id]).join(', ')}`,
    ];
    if (result.contraindicationAlerts.length > 0) lines.push(``, `⚠ Противопоказания:`, ...result.contraindicationAlerts);
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }, [result, level]);

  const filledCount = useMemo(() => {
    if (!hydrated) return 0;
    return CHECKLIST.filter(item => item.check(hydrated)).length;
  }, [hydrated]);

  const missingItems = useMemo(() => {
    if (!hydrated) return CHECKLIST;
    return CHECKLIST.filter(item => !item.check(hydrated));
  }, [hydrated]);

  return (
    <div style={embedded ? {} : { padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      {!embedded && <div style={{ marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🧮 Калькулятор поддержки</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>Подбор поддержки на основе данных профиля, анализов и курса</div>
      </div>}

      {/* ═══ ШАГ 1: СОБРАТЬ ДАННЫЕ ═══ */}
      <div style={{ ...GLASS, marginBottom: 8, padding: 14, border: '2px solid rgba(0,230,138,0.25)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          📥 Шаг 1: Сбор данных
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>
          Данные берутся из профиля, анализов и курса автоматически. Заполните карточки в Профиле → Данные калькулятора.
        </div>

        {!collected ? (
          <button onClick={doCollect} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: '2px solid var(--accent)', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,198,83,0.05))', color: '#00e68a', fontWeight: 800, fontSize: 13,
          }}>
            📥 Собрать данные
          </button>
        ) : (
          <div>
            {/* Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
              {CHECKLIST.map(item => {
                const ok = item.check(hydrated!);
                return (
                  <div key={item.key} style={{
                    padding: '6px 8px', borderRadius: 8,
                    background: ok ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                    border: ok ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 9,
                  }}>
                    <span style={{ fontSize: 11 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: ok ? 'var(--text)' : 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                      <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ok ? item.detail(hydrated!) : `нет данных`}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: ok ? '#00e68a' : '#f59e0b' }}>{ok ? '✓' : '○'}</span>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.15)', fontSize: 9, color: 'var(--text-dim)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>Готово: <b style={{ color: filledCount === CHECKLIST.length ? '#00e68a' : filledCount > 6 ? '#fbbf24' : '#ef4444' }}>{filledCount}/{CHECKLIST.length}</b></span>
              {missingItems.length > 0 && <span style={{ color: '#f59e0b' }}>Не хватает: {missingItems.map(m => m.label).join(', ')}</span>}
            </div>

            {/* Missing data links */}
            {missingItems.length > 0 && (
              <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', fontSize: 8, color: '#f59e0b', marginBottom: 8, lineHeight: 1.4 }}>
                💡 Заполните данные в: Профиль → Данные калькулятора, Фарма → Курс, Анализы
              </div>
            )}

            {/* Toggle details */}
            <button onClick={() => setShowDetails(!showDetails)} style={{ width: '100%', padding: '4px', fontSize: 8, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 4 }}>
              {showDetails ? '▲ Скрыть детали' : '▼ Показать детали данных'}
            </button>
            {showDetails && (
              <div style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.6, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.1)', marginBottom: 6 }}>
                {CHECKLIST.map(item => (
                  <div key={item.key}>{item.icon} <b>{item.label}</b>: {item.check(hydrated!) ? item.detail(hydrated!) : 'нет данных'} <span style={{ fontSize: 7, opacity: 0.5 }}>({item.source})</span></div>
                ))}
              </div>
            )}

            <button onClick={doCollect} style={{ width: '100%', padding: '6px', borderRadius: 8, fontSize: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)', color: '#60a5fa' }}>
              🔄 Обновить данные
            </button>
          </div>
        )}
      </div>

      {/* ═══ ШАГ 2: УРОВЕНЬ + РАСЧЁТ ═══ */}
      {collected && (
        <div style={{ ...GLASS, marginBottom: 8, padding: 14, border: '2px solid rgba(0,230,138,0.25)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            🧮 Шаг 2: Расчёт поддержки
          </div>

          {/* Level selector */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Уровень поддержки:</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { id: 'basic', label: 'Базовый', desc: '65% порог', color: '#22c55e' },
                { id: 'mid', label: 'Средний', desc: '45% порог', color: '#fbbf24' },
                { id: 'max', label: 'Максимум', desc: '30% порог', color: '#ef4444' },
              ] as const).map(l => (
                <button key={l.id} onClick={() => setLevel(l.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  background: level === l.id ? `rgba(${l.id === 'basic' ? '34,197,94' : l.id === 'mid' ? '251,191,36' : '239,68,68'},0.12)` : 'rgba(255,255,255,0.03)',
                  border: level === l.id ? `1px solid ${l.color}` : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: level === l.id ? l.color : 'var(--text-dim)' }}>{l.label}</div>
                  <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Calculate button */}
          <button onClick={doCalculate} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: '2px solid var(--accent)', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,198,83,0.05))', color: '#00e68a', fontWeight: 800, fontSize: 13, marginBottom: 6,
          }}>
            🧮 Рассчитать поддержку
          </button>
        </div>
      )}

      {/* ═══ РЕЗУЛЬТАТ ═══ */}
      {result && (
        <div style={{ ...GLASS, marginBottom: 8, padding: 14, border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            📊 Результат расчёта
            <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: 'var(--accent)' }}>
              {copied ? '✓' : '📋 Копировать'}
            </button>
          </div>

          {/* Risk summary — peak week */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Риск до (пик)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: result.overallRiskBefore > 50 ? '#ef4444' : result.overallRiskBefore > 25 ? '#fbbf24' : '#22c55e' }}>{result.overallRiskBefore}%</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 16, color: 'var(--text-dim)' }}>→</div>
            <div style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>После поддержки</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: result.overallRiskAfter > 50 ? '#ef4444' : result.overallRiskAfter > 25 ? '#fbbf24' : '#22c55e' }}>{result.overallRiskAfter}%</div>
            </div>
          </div>
          {result.peakWeek ? (
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 6 }}>
              Пиковая неделя: <b style={{ color: 'var(--accent)' }}>{result.peakWeek}</b>{result.timeline ? ` из ${result.timeline.length}` : ''}
            </div>
          ) : null}

          {/* Systems risk bars */}
          <div style={{ marginBottom: 8 }}>
            {result.risk.systems.filter(s => s.rawScore > 0).map(sys => {
              const c = sys.rawScore >= 60 ? '#ef4444' : sys.rawScore >= 30 ? '#fbbf24' : '#22c55e';
              return (
                <div key={sys.id} style={{ marginBottom: 2, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{sys.icon} {sys.label}</span>
                    <span style={{ color: c, fontWeight: 700 }}>{sys.rawScore}% → {sys.afterSupport}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(sys.rawScore, 100)}%`, background: c, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline dynamics chart */}
          {result.timeline && result.timeline.length > 1 && (
            <RiskTimelineChart timeline={result.timeline} />
          )}

          {/* Substances count + synergies */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={BADGE('rgba(0,230,138,0.15)')}>{result.schedule.length} веществ</span>
            <span style={BADGE('rgba(129,140,248,0.15)')}>{result.synergyIdsUsed.length} синергий</span>
            {result.negativeBlocks.length > 0 && <span style={BADGE('rgba(239,68,68,0.15)')}>{result.negativeBlocks.length} заблокировано</span>}
          </div>

          {/* Schedule */}
          <div style={{ marginBottom: 6 }}>
            {(['morning', 'afternoon', 'evening'] as const).map(block => {
              const items = result.schedule.filter(s => s.timeBlock === block);
              if (items.length === 0) return null;
              const title = block === 'morning' ? '🌅 Утро' : block === 'afternoon' ? '☀️ День' : '🌙 Вечер';
              return (
                <div key={block} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                  {items.map(item => (
                    <div key={item.substanceId} style={{ padding: '4px 8px', marginBottom: 2, borderRadius: 6, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10 }}>💊</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                        <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{item.instructions}</div>
                      </div>
                      <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.dose}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Lab-based suggestions */}
          {(() => {
            if (!state?.labs?.fullPanel) return null;
            const fp = state.labs.fullPanel;
            const panelMap: Array<[keyof LabSlice, Record<string, string>]> = [
              ['panelBiochem', fp.panelBiochem], ['panelHematology', fp.panelHematology],
              ['panelLipid', fp.panelLipid], ['panelSex', fp.panelSex],
              ['panelThyroid', fp.panelThyroid], ['panelMineral', fp.panelMineral],
              ['panelCoagulation', fp.panelCoagulation], ['panelCardiac', fp.panelCardiac],
            ];
            const markerMap: Record<string, string> = {
              ALT:'ALT', AST:'AST', GGT:'GGT', 'Bilirubin':'BIL', 'Glucose':'GLU', 'Creatinine':'CREATININE', 'CRP':'CRP', 'Homocysteine':'HOMOCYSTEINE',
              HCT:'HCT', Hemoglobin:'HGB', Platelets:'PLT',
              LDL:'LDL', HDL:'HDL', Triglycerides:'TG',
              'Total T':'TT', E2:'E2', Prolactin:'PRL', LH:'LH', FSH:'FSH',
              TSH:'TSH', 'T4 free':'FT4',
              Potassium:'K', Sodium:'NA', Magnesium:'MG',
              'D-dimer':'D_DIMER', Fibrinogen:'FIBRINOGEN',
              'NT-proBNP':'NT_PROBNP',
            };
            const deviations: Array<{ marker: string; name: string; value: number; isHigh: boolean }> = [];
            for (const [, panel] of panelMap) {
              if (!panel) continue;
              for (const [key, val] of Object.entries(panel)) {
                const ucumKey = markerMap[key];
                if (!ucumKey) continue;
                const numVal = parseFloat(val);
                if (isNaN(numVal)) continue;
                const ref = UCUM_MAP[ucumKey];
                if (!ref) continue;
                const norm = numVal * (ref.coeff || 1);
                if (norm > ref.uln) deviations.push({ marker: ucumKey, name: ref.name || key, value: norm, isHigh: true });
                else if (norm < ref.lln) deviations.push({ marker: ucumKey, name: ref.name || key, value: norm, isHigh: false });
              }
            }
            if (deviations.length === 0) return null;
            const plannedIds = new Set(result.selectedSubstances.map((s: string) => s.toLowerCase()));
            return (
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🩸 Лабораторные отклонения и рекомендации</div>
                {deviations.slice(0, 6).map(d => {
                  const drugs = getDrugsToNormalizeMarker(d.marker, d.isHigh).slice(0, 4);
                  const inPlan = drugs.filter(d2 => plannedIds.has(d2.drugId.toLowerCase()));
                  const notInPlan = drugs.filter(d2 => !plannedIds.has(d2.drugId.toLowerCase()));
                  return (
                    <div key={d.marker} style={{ marginBottom: 4, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: d.isHigh ? '#ef4444' : '#3b82f6' }}>
                        {d.name} {d.isHigh ? '↑' : '↓'} {d.value}
                      </div>
                      {inPlan.length > 0 && (
                        <div style={{ fontSize: 7, color: '#00e68a', marginTop: 2 }}>
                          ✓ В плане: {inPlan.map(d2 => d2.drugId).join(', ')}
                        </div>
                      )}
                      {notInPlan.length > 0 && (
                        <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 1 }}>
                          💡 Доп.: {notInPlan.map(d2 => d2.drugId).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Contraindications */}
          {result.contraindicationAlerts.length > 0 && (
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', marginBottom: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>⚠ Противопоказания</div>
              {result.contraindicationAlerts.map((a, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text)', marginBottom: 1 }}>{a}</div>)}
            </div>
          )}

          {/* Apply button */}
          <button onClick={() => onApply({ level, subs: result.selectedSubstances, result })} style={{
            width: '100%', padding: '10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', border: 'none', marginTop: 4,
          }}>
            ✅ Применить расчёт
          </button>
        </div>
      )}

      {copied && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 12, padding: '8px 16px', fontSize: 10, color: 'var(--accent)', zIndex: 999 }}>📋 Скопировано</div>}
    </div>
  );
};

export default SupportCalculator;
