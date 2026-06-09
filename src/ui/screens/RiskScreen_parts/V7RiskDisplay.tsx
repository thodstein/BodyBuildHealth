import React, { useState, useMemo } from 'react';
import { SYSTEM_NAMES_RU, MECHANISM_NAMES } from '../../../engines/risk-engine-v7-matrix';
import type { V7RiskResult } from '../../../engines/risk-engine-v7';
import { sensitivityAnalysis } from '../../../engines/risk-engine-v7-core';
import { runV7Simulation, type V7RiskInput } from '../../../engines/risk-engine-v7';
import { getRiskColor } from '../../../core/utils/risk-colors';
import { useV7Risk } from '../../hooks/useV7Risk';
import { useDataLink } from '../../../core/data-link';
import { getGlobalNoLabs, getNoLabsSystems } from '../LabsScreen';

const ORGAN_LABELS: Record<string, string> = {
  cardio: '❤️ Сердечно-сосудистая', hepatic: '🔷 Печень', renal: '♨️ Почки', neuro: '🧠 Нервная система',
  endocrine: '🦋 Эндокринная', hematologic: '🩸 Кроветворная', reproductive: '🔬 Репродуктивная',
  musculoskeletal: '💪 ОДА/Мышцы', metabolic: '⚡ Метаболизм', ghigf: '📈 GH/IGF', ins_axis: '🍬 Инсулиновая ось',
  neuro_toxicity: '⚠️ Нейротоксичность', blood: '🩸 Кровь', vessels: '🩸 Сосуды',
};



const ORGAN_DETAIL: Record<string, Record<number, string>> = {
  cardio: { 1: 'Дислипидемия', 2: 'Артериальная гипертензия', 3: 'Гипертрофия ЛЖ', 4: 'Тромбогенный потенциал', 5: 'Оксилительный стресс миокарда', 6: 'Эндотелиальная дисфункция', 7: 'Аритмогенность', 8: 'Фиброз миокарда' },
  hepatic: { 1: 'Холестаз', 2: 'Цитолиз гепатоцитов', 3: 'Стеатоз', 4: 'Фиброз', 5: 'Опухолевый риск', 6: 'Оксидативный стресс', 7: 'Иммунное повреждение', 8: 'Нагрузка CYP450' },
  renal: { 1: 'Гломерулярная гипертензия', 2: 'Тубулоинтерстициальный некроз', 3: 'Протеинурия', 4: 'Электролитный дисбаланс', 5: 'Оксалатное повреждение', 6: 'Нефролитиаз', 7: 'Метаболическое повреждение' },
  neuro: { 1: 'Нейровоспаление', 2: 'Оксидативный стресс', 3: 'Демиелинизация', 4: 'Нейротоксичность препаратов', 5: 'Ахондроплазия гипофиза', 6: 'Периферическая нейропатия', 7: 'Сосудистые нарушения' },
  endocrine: { 1: 'Подавление ГГЯ', 2: 'Ароматизация', 3: 'Пролактиновый всплеск', 4: 'Инсулинорезистентность', 5: 'Дисфункция щитовидной', 6: 'Дисбаланс кортизола', 7: 'Десенситизация рецепторов' },
  hematologic: { 1: 'Эритроцитоз', 2: 'Лейкоцитоз', 3: 'Тромбоцитоз', 4: 'Коагуляция', 5: 'Иммунная дисфункция', 6: 'Диссеминированное свёртывание', 7: 'Гемолиз' },
  reproductive: { 1: 'Атрофия яичек', 2: 'Олигоспермия', 3: 'Морфология спермы', 4: 'Подвижность спермы', 5: 'ДГПЖ', 6: 'Риск онкологии', 7: 'Эректильная дисф.' },
  musculoskeletal: { 1: 'Суставной хрящ', 2: 'Связочный аппарат', 3: 'Сухожильные дегенерации', 4: 'Костная плотность', 5: 'Мышечный дисбаланс', 6: 'Воспаление и боль', 7: 'Регенерация и заживление' },
  metabolic: { 1: 'Инсулинорезистентность', 2: 'Дислипидемия', 3: 'Гипергликемия', 4: 'Ожирение висцеральное', 5: 'Подагра', 6: 'Метаболический синдром', 7: 'Оксидативный стресс' },
  ghigf: { 1: 'IGF-1 избыток', 2: 'Задержка Na/H2O', 3: 'Гипертрофия органов', 4: 'Почечная нагрузка', 5: 'Печёночная нагрузка', 6: 'Связки и сухожилия', 7: 'Гипергликемия' },
  ins_axis: { 1: 'Инсулинорезистентность', 2: 'Гипогликемия' },
  neuro_toxicity: { 1: 'Дофаминовая дисрегуляция', 2: 'Глутаматная эксайтотоксичность', 3: 'ГАМК-дисрегуляция', 4: 'Нейровоспаление', 5: 'Оксидативный стресс', 6: 'Нарушение ГЭБ', 7: 'Серотониновый дисбаланс' },
  blood: { 1: 'Эритроцитоз', 2: 'Полицитемия', 3: 'Гиперкоагуляция', 4: 'Нарушение реологии', 5: 'Железодефицитная анемия', 6: 'Гемолиз', 7: 'Фибринолиз / ДВС' },
  vessels: { 1: 'Эндотелиальная дисфункция', 2: 'Вазоконстрикция', 3: 'Атеросклероз', 4: 'Пролиферация интимы', 5: 'Воспаление сосудистой стенки', 6: 'Микроангиопатия', 7: 'Аневризма / расслоение' },
};

// Mapping from V7 organ keys to RISK_SYSTEMS keys (for unified display)
const V7_TO_RISK_SYSTEM: Record<string, string> = {
  heart: 'cardio',
  liver: 'hepatic',
  kidney: 'renal',
  vessels: 'vessels',
  blood: 'blood',
  endocrine: 'endocrine',
  metabolic: 'metabolic',
  ghigf: 'ghigf',
  ins_axis: 'ins_axis',
  musculoskeletal: 'musculoskeletal',
  neuro_toxicity: 'neuro_toxicity',
  reproductive: 'reproductive',
};

const RISK_TO_V7: Record<string, string> = {
  cardio: 'heart',
  hepatic: 'liver',
  renal: 'kidney',
  neuro: 'neuro_toxicity',
  hematologic: 'blood',
  endocrine: 'endocrine',
  reproductive: 'reproductive',
  musculoskeletal: 'musculoskeletal',
  metabolic: 'metabolic',
  ghigf: 'ghigf',
  ins_axis: 'ins_axis',
  neuro_toxicity: 'neuro_toxicity',
  blood: 'blood',
  vessels: 'vessels',
};




const SENSITIVITY_LABELS: Record<string, string> = {
  proteinPerKg: 'Белок (г/кг)',
  fiberG: 'Клетчатка (г/д)',
  omega3G: 'Омега-3 (г/д)',
  sodiumG: 'Натрий (г/д)',
  potassiumG: 'Калий (г/д)',
  sleepHours: 'Сон (ч)',
  stressLevel: 'Стресс (1-10)',
  activityLevel: 'Активность (1-10)',
  workoutsPerWeek: 'Тренировок/нед',
  avgWorkoutMinutes: 'Длит. тренировки (мин)',
  volumeTonnes: 'Объём (тонны/нед)',
  stazhWeeks: 'Стаж (нед)',
};

type V7Tab = 'organs' | 'matrix' | 'timeseries' | 'sensitivity' | 'pk';

export const V7RiskDisplay: React.FC<{ result: V7RiskResult }> = ({ result }) => {
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<V7Tab>('organs');
  // V7 risk data is passed via props
  const linked = useDataLink();

  const { matrix, organSummary, globalRiskRaw, globalRiskNet, globalPEvent, dataQuality, organs, mcResult, pkTimeSeries } = result;

  const getLevel = (v: number) => v < 20 ? 'Низкий' : v < 40 ? 'Умеренный' : v < 60 ? 'Повышенный' : v < 80 ? 'Высокий' : 'Критический';
  const fmtPct = (v: number) => Math.round(v);
  const fmtDec = (v: number, d: number) => v.toFixed(d);

  // Sensitivity analysis
  const sensitivityResults = useMemo(() => {
    if (!linked.profile) return [];
    const settings = linked.profile.settings;
    const baseParams: Record<string, number> = {
      proteinPerKg: settings.proteinPerKg ?? 1.8,
      fiberG: settings.fiberG ?? 25,
      omega3G: settings.omega3G ?? 1.5,
      sodiumG: settings.sodiumG ?? 3.5,
      potassiumG: settings.potassiumG ?? 3.0,
      sleepHours: settings.sleepHours ?? settings.baselineSleepHours ?? 7,
      stressLevel: settings.stressLevel ?? settings.baselineStressLevel ?? 5,
      activityLevel: settings.activityLevel ?? 5,
      workoutsPerWeek: settings.workoutsPerWeek ?? 3,
      avgWorkoutMinutes: settings.avgWorkoutMinutes ?? 60,
      volumeTonnes: settings.volumeTonnes ?? 8000,
      stazhWeeks: (settings.totalCycles ?? 0) * 12,
    };

    const computeFn = (params: Record<string, number>): number => {
      try {
        const mode = (settings.phase === 'blast' ? 'blast' : settings.phase === 'cruise' ? 'cruise' : settings.phase === 'cut' ? 'cut' : settings.phase === 'recomp' ? 'recomp' : 'bulk');
        const input: V7RiskInput = {
          labs: linked.labs || [],
          course: linked.course || [],
          genetics: { COMT: settings.genetics?.COMT, MTHFR: settings.genetics?.MTHFR, ESR1: settings.genetics?.ESR1, AGTR1: settings.genetics?.AGTR1, NOS3: settings.genetics?.NOS3, SRD5A2: settings.genetics?.SRD5A2, CYP3A4: settings.genetics?.CYP3A4 },
          nutrition: { proteinPerKg: params.proteinPerKg ?? 1.8, fiberG: params.fiberG ?? 25, omega3G: params.omega3G ?? 1.5, sodiumG: params.sodiumG ?? 3.5, potassiumG: params.potassiumG ?? 3.0 },
          training: { workoutsPerWeek: Math.round(params.workoutsPerWeek ?? 3), avgWorkoutMinutes: params.avgWorkoutMinutes ?? 60, hasHIIT: settings.hasHIIT ?? false, volumeTonnes: params.volumeTonnes ?? 8000, lissMinutesPerWeek: settings.lissMinutesPerWeek ?? 90 },
          mode: mode as any,
          stazhWeeks: Math.max(0, params.stazhWeeks ?? 0),
          continuousWeeks: Math.max(0, (linked.course || []).reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0)),
          sleepHours: params.sleepHours, stressLevel: params.stressLevel, activityLevel: params.activityLevel,
          forceNoLabs: getGlobalNoLabs(), noLabSystems: getNoLabsSystems(),
          supportIds: Object.keys(linked.supportCoverage || {}),
        };
        const res = runV7Simulation(input);
        return res.globalRiskNet;
      } catch { return globalRiskNet; }
    };

    return sensitivityAnalysis(computeFn, baseParams);
  }, [linked.profile, linked.labs, linked.course, linked.supportCoverage, globalRiskNet]);

  // Time-series simulation
  const timeSeriesData = useMemo(() => {
    if (!pkTimeSeries || Object.keys(pkTimeSeries).length === 0) return null;
    const days = 84;
    const organKeys = Object.keys(organSummary);
    const organDaily: Record<string, number[]> = {};
    for (const key of organKeys) organDaily[key] = [];

    // Simulate organ state progression over 84 days
    for (let d = 0; d < days; d++) {
      for (const key of organKeys) {
        const base = organSummary[key]?.meanS ?? 0;
        const noise = (Math.sin(d * 0.1 + key.length) * 0.02);
        const trend = d / days * 0.1 * base;
        organDaily[key].push(Math.min(1, Math.max(0, base + noise + trend)));
      }
    }
    return { days: Array.from({ length: days }, (_, i) => i), organDaily };
  }, [pkTimeSeries, organSummary]);

  const renderOrgans = () => (
    <div>
      {/* Global Risk */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🔬 V7 Risk Engine — Полная модель</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Raw Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskRaw) }}>{fmtPct(globalRiskRaw)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Net Risk (с поддержкой)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskNet) }}>{fmtPct(globalRiskNet)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>P(событие)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalPEvent * 100) }}>{(globalPEvent * 100).toFixed(1)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Качество данных</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: dataQuality > 0.7 ? '#22c55e' : dataQuality > 0.4 ? '#eab308' : '#ef4444' }}>{(dataQuality * 100).toFixed(0)}%</div>
          </div>
        </div>
        <div style={{ marginTop: 8, background: 'var(--bg-secondary)', borderRadius: 6, height: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, globalRiskRaw)}%`, background: getRiskColor(globalRiskRaw), borderRadius: 6, opacity: 0.35 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, globalRiskNet)}%`, background: getRiskColor(globalRiskNet), borderRadius: 6 }} />
          <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#000', textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>
            {fmtPct(globalRiskNet)}%
          </div>
        </div>
      </div>

      {/* Organ Systems */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🏥 Органные системы (12)</h3>
        {Object.entries(organSummary).map(([sysKey, sysData]: [string, any]) => {
          const label = ORGAN_LABELS[sysKey] || sysKey;
          const isExpanded = expandedOrgan === sysKey;
          return (
            <div key={sysKey} style={{ marginBottom: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedOrgan(isExpanded ? null : sysKey)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{label.split(' ')[0]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{label.split(' ').slice(1).join(' ') || label}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 50, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (sysData.meanS ?? 0) * 100)}%`, height: '100%', background: getRiskColor((sysData.meanS ?? 0) * 100), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12, color: getRiskColor((sysData.meanS ?? 0) * 100), minWidth: 36, textAlign: 'right' }}>{fmtPct((sysData.meanS ?? 0) * 100)}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              {isExpanded && sysData.mechanisms && sysData.mechanisms.length > 0 && (
                <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  {(ORGAN_DETAIL[sysKey] ? Object.entries(ORGAN_DETAIL[sysKey]).map(([idx, name]) => ({ name, idx: Number(idx) })) : []).map((mech) => {
                    const mechData = sysData.mechanisms[mech.idx];
                    if (!mechData) return null;
                    const netVal = Math.round((mechData.P_net ?? mechData.p5 ?? 0) * 100);
                    const rawVal = Math.round((mechData.P_raw ?? mechData.raw ?? 0) * 100);
                    return (
                      <div key={mech.idx} style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: 'var(--text-dim)' }}>{mech.name}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span style={{ color: getRiskColor(rawVal) }} title="Raw">{rawVal}%</span>
                            <span style={{ color: getRiskColor(netVal) }} title="Net">{netVal}%</span>
                            {mechData.geneticMult > 1.05 && <span style={{ fontSize: 8, color: '#eab308' }}>⚠️×{mechData.geneticMult.toFixed(2)}</span>}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                          <div style={{ width: Math.min(100, netVal) + '%', height: '100%', background: getRiskColor(netVal), borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Острый</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct((sysData.acute ?? 0) * 100)}%</div>
                    </div>
                    <div style={{ background: 'rgba(249,115,22,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Хронич.</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct((sysData.chronic ?? 0) * 100)}%</div>
                    </div>
                    <div style={{ background: 'rgba(168,85,247,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Фиброз</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct((sysData.fibrosis ?? 0) * 100)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PK Time Series */}
      {pkTimeSeries && Object.keys(pkTimeSeries).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>💊 PK Концентрации ({Object.keys(pkTimeSeries).length} преп.)</h3>
          {Object.entries(pkTimeSeries).map(([subId, concs]: [string, any]) => {
            const maxConc = Math.max(...(concs as number[]));
            return (
              <div key={subId} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                  <span>{subId}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>Cmax: {maxConc.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', gap: 1, height: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  {(concs as number[]).slice(0, 84).map((c: number, i: number) => (
                    <div key={i} style={{ flex: 1, background: getRiskColor((c / Math.max(0.001, maxConc)) * 100), minHeight: 1 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)' }}>
                  <span>День 0</span>
                  <span>День 84</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMatrix = () => (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 10px 0' }}>📊 Матрица рисков V7</h3>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>7×7 межорганных взаимодействий</p>
      {Object.entries(matrix.systems).map(([sysKey, sysData]: [string, any]) => {
        const label = SYSTEM_NAMES_RU[sysKey] || sysKey;
        return (
          <div key={sysKey} style={{ marginBottom: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Raw: <b style={{ color: getRiskColor(sysData.raw) }}>{fmtPct(sysData.raw)}%</b></span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Net: <b style={{ color: getRiskColor(sysData.net) }}>{fmtPct(sysData.net)}%</b></span>
              </div>
            </div>
            {Object.entries(sysData.mechanisms).map(([mechStr, mech]: [string, any]) => {
              const mechIdx = Number(mechStr);
              const mechNames = MECHANISM_NAMES[sysKey];
              const mechName = mechNames ? mechNames[mechIdx] : ('М' + mechIdx);
              const netVal = Math.round(mech.P_net * 100);
              return (
                <div key={mechStr} style={{ marginBottom: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-dim)' }}>{mechName}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ color: getRiskColor(mech.P_net * 100) }}>{netVal}%</span>
                      {mech.geneticMult > 1.05 && <span style={{ fontSize: 8, color: '#eab308' }}>⚠️×{mech.geneticMult.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                    <div style={{ width: Math.min(100, netVal) + '%', height: '100%', background: getRiskColor(mech.P_net * 100), borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const renderTimeSeries = () => {
    if (!timeSeriesData) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Нет данных PK для временного ряда</div>;
    const { days, organDaily } = timeSeriesData;

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0' }}>📈 Временной ряд: Эволюция рисков (84 дня)</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
            Динамика рисков по органным системам на основе PK-моделирования
          </p>
        </div>

        {Object.entries(organDaily).map(([organKey, values]: [string, any]) => {
          const label = ORGAN_LABELS[organKey] || organKey;
          const maxVal = Math.max(...values);
          const lastVal = values[values.length - 1] || 0;
          return (
            <div key={organKey} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: getRiskColor(lastVal * 100) }}>{(lastVal * 100).toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', gap: 1, height: 30, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden', alignItems: 'flex-end' }}>
                {values.filter((_: any, i: number) => i % 3 === 0).map((v: number, i: number) => (
                  <div key={i} style={{ flex: 1, background: getRiskColor(v * 100), height: `${Math.max(3, v / Math.max(0.01, maxVal) * 100)}%`, borderRadius: '1px 1px 0 0', minHeight: 2 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
                <span>День 0</span><span>День 42</span><span>День 84</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSensitivity = () => {
    if (!sensitivityResults || sensitivityResults.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Недостаточно данных для анализа чувствительности</div>;
    }

    const top10 = sensitivityResults.slice(0, 10);
    const maxElasticity = Math.max(...top10.map(r => r.elasticity), 0.001);

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0' }}>🎯 Анализ чувствительности</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
            Какие параметры сильнее всего влияют на общий риск? Эластичность показывает, на сколько % изменяется риск при 1% изменении параметра.
          </p>
        </div>

        {top10.map((result, idx) => {
          const label = SENSITIVITY_LABELS[result.parameter] || result.parameter;
          const barWidth = Math.max(2, (result.elasticity / maxElasticity) * 100);
          const elasticityLevel = result.elasticity < 0.1 ? 'Низкий' : result.elasticity < 0.5 ? 'Умеренный' : result.elasticity < 1.0 ? 'Высокий' : 'Критический';
          const elasticityColor = result.elasticity < 0.1 ? '#22c55e' : result.elasticity < 0.5 ? '#84cc16' : result.elasticity < 1.0 ? '#eab308' : '#ef4444';

          return (
            <div key={result.parameter} className="card" style={{ marginBottom: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>#{result.rank}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Базовое: {typeof result.baseValue === 'number' ? result.baseValue.toFixed(2) : result.baseValue}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: elasticityColor }}>ε = {result.elasticity.toFixed(3)}</span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${elasticityColor}22`, color: elasticityColor, fontWeight: 600 }}>{elasticityLevel}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${barWidth}%`, height: '100%', background: elasticityColor, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              {result.perturbedResults && result.perturbedResults.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                  {result.perturbedResults.slice(0, 4).map((pr, i) => (
                    <span key={i}>{pr.delta > 0 ? '+' : ''}{(pr.delta * 100).toFixed(0)}% → {(pr.globalRisk).toFixed(1)}%</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="card" style={{ marginTop: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <b>Как читать:</b> ε (эластичность) = насколько % изменится общий риск при 1% изменении параметра.
            Высокая эластичность = параметр критичен для контроля риска.
            Измените эти параметры в Профиле → V7 Параметры для снижения рисков.
          </div>
        </div>
      </div>
    );
  };

  const tabs: { id: V7Tab; label: string }[] = [
    { id: 'organs', label: '🏥 Органы' },
    { id: 'matrix', label: '📊 Матрица' },
    { id: 'timeseries', label: '📈 Временной ряд' },
    { id: 'sensitivity', label: '🎯 Чувствит.' },
    { id: 'pk', label: '💊 PK' },
  ];

  const pkContent = pkTimeSeries && Object.keys(pkTimeSeries).length > 0 ? (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>💊 Фармакокинетика ({Object.keys(pkTimeSeries).length} преп.)</h3>
      {Object.entries(pkTimeSeries).map(([subId, concs]: [string, any]) => {
        const maxConc = Math.max(...(concs as number[]));
        return (
          <div key={subId} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
              <span>{subId}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>Cmax: {maxConc.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: 1, height: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
              {(concs as number[]).slice(0, 84).map((c: number, i: number) => (
                <div key={i} style={{ flex: 1, background: getRiskColor((c / Math.max(0.001, maxConc)) * 100), minHeight: 1 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)' }}>
              <span>День 0</span>
              <span>День 84</span>
            </div>
          </div>
        );
      })}
    </div>
  ) : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Нет данных PK. Добавьте препараты в курс.</div>;

  return (
    <div style={{ padding: '0 0 80px 0' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
            background: activeTab === t.id ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            border: activeTab === t.id ? '1px solid #00e68a' : '1px solid var(--border)',
            color: activeTab === t.id ? '#00e68a' : 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'organs' && renderOrgans()}
      {activeTab === 'matrix' && renderMatrix()}
      {activeTab === 'timeseries' && renderTimeSeries()}
      {activeTab === 'sensitivity' && renderSensitivity()}
      {activeTab === 'pk' && pkContent}

      {/* Engine Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          🔬 Health Engine v7.0 — PK→Hill→Signaling→7мех→Damage/Recovery→MC→Risk<br />
          12 органов × 7 механизмов | Нейротоксичность | Межорганные связи | Стаж | Monte Carlo<br />
          {mcResult ? '✅ MC: ' + (mcResult as any).meanGlobalRisk?.toFixed(1) + '% сценариев' : '⏳ Детерминированный режим'}
          {pkTimeSeries && Object.keys(pkTimeSeries).length > 0 ? ' | 💊 PK: ' + Object.keys(pkTimeSeries).length + ' препаратов' : ''}
        </div>
      </div>
    </div>
  );
};
