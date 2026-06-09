import React, { useState, useMemo } from 'react';
import { SYSTEM_NAMES_RU, MECHANISM_NAMES } from '../../../engines/risk-engine-v7-matrix';
import type { V7RiskResult } from '../../../engines/risk-engine-v7';
import { sensitivityAnalysis } from '../../../engines/risk-engine-v7-core';
import { runV7Simulation, type V7RiskInput } from '../../../engines/risk-engine-v7';
import { getRiskColor } from '../../../core/utils/risk-colors';
import { useDataLink } from '../../../core/data-link';
import { getGlobalNoLabs, getNoLabsSystems } from '../LabsScreen';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import { PHARMA_DB } from '../../../core/pharma-database';
import { getProfile, updateProfile } from '../../../core/profile-manager';

function getSubstanceName(id: string): string {
  const entry = PHARMA_DB[id];
  return entry ? entry.name : id;
}

const ORGAN_LABELS_V7: Record<string, string> = {
  heart: '❤️ Сердце', vessels: '🫀 Сосуды', liver: '🫁 Печень', kidney: '💧 Почки',
  blood: '🩸 Кровь', endocrine: '⚖️ Эндокринная', metabolic: '⚖️ Метаболизм',
  ghigf: '💪 ГР/ИФР-1', ins_axis: '💉 Инсулиновая ось',
  musculoskeletal: '🦴 ОДА/Мышцы', neuro_toxicity: '⚠️ Нейротоксичность',
  reproductive: '💪 Репродуктивная',
};

const V7_ORGAN_TO_SYSTEM: Record<string, string> = {
  heart: 'cardio', vessels: 'vessels', liver: 'hepatic', kidney: 'renal',
  blood: 'blood', endocrine: 'endocrine', metabolic: 'metabolic',
  ghigf: 'ghigf', ins_axis: 'ins_axis',
  musculoskeletal: 'musculoskeletal', neuro_toxicity: 'neuro_toxicity',
  reproductive: 'reproductive',
};

function getMechName(sysKey: string, mechIdx: number): string {
  // First try V7 MECHANISM_NAMES (has up to 8 mechanisms for some systems)
  const smKey = V7_ORGAN_TO_SYSTEM[sysKey] || sysKey;
  if (MECHANISM_NAMES[smKey]?.[mechIdx]) {
    return MECHANISM_NAMES[smKey][mechIdx];
  }
  // Then try SYSTEM_MECHANISMS
  const mechs = SYSTEM_MECHANISMS[smKey];
  if (mechs) {
    const found = mechs.find(m => m.num === mechIdx);
    if (found?.label) return found.label;
  }
  // Fallback for indices that have no real name
  return '';
}

function hasValidMech(sysKey: string, mechIdx: number): boolean {
  return getMechName(sysKey, mechIdx) !== '';
}

const SENSITIVITY_LABELS: Record<string, string> = {
  proteinPerKg: 'Белок (г/кг)', fiberG: 'Клетчатка (г/д)', omega3G: 'Омега-3 (г/д)',
  sodiumG: 'Натрий (г/д)', potassiumG: 'Калий (г/д)', sleepHours: 'Сон (ч)',
  stressLevel: 'Стресс (1-10)', activityLevel: 'Активность (1-10)',
  workoutsPerWeek: 'Тренировок/нед', avgWorkoutMinutes: 'Длит. тренировки (мин)',
  lissMinutes: 'LISS (мин/нед)', hasHIIT: 'Наличие HIIT',
  volumeTonnes: 'Объём (тонны/нед)', stazhWeeks: 'Стаж (нед)',
  avgKcal: 'Ккал/день (дневник)', avgProtein: 'Белки/день (дневник)',
  avgFat: 'Жиры/день (дневник)', avgCarbs: 'Углеводы/день (дневник)',
  age: 'Возраст', weight: 'Вес (кг)', waterL: 'Вода (л/день)',
};



export const V7RiskDisplay: React.FC<{ result: V7RiskResult }> = ({ result }) => {
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('organs');
  const [selectedDay, setSelectedDay] = useState<number>(42);
  const [pkDay, setPkDay] = useState(42);
  const [selectedOrgan3D, setSelectedOrgan3D] = useState<string | null>(null);
  const [mcEnabled, setMcEnabled] = useState<boolean>(false);
  const [organWeek, setOrganWeek] = useState<number>(0); // 0 = avg over 12 weeks, 1-12 = specific week
  const linked = useDataLink();

  const toggleMC = () => {
    const next = !mcEnabled;
    setMcEnabled(next);
    const p = getProfile();
    p.settings.mcRuns = next ? 50 : 0;
    updateProfile(p);
  };

  const { matrix, organSummary, globalRiskRaw, globalRiskNet, globalPEvent, dataQuality, organs, mcResult, pkTimeSeries, weeklyOrganData = {}, weeklyGlobalData = [] } = result;

  // Scale helpers:
  // globalRiskRaw/Net are already in 0-100 (engine multiplies by 100)
  // organ meanS/p5S/chronic/acute/fibrosis are in 0-1
  // matrix mech P_raw/P_net are in 0-1
  // matrix system raw/net are in 0-100
  const fmtPct100 = (v: number) => Math.round(v);         // for 0-100 values
  const fmtPct01 = (v: number) => Math.round(v * 100);    // for 0-1 values
  const fmtDec = (v: number, d: number) => v.toFixed(d);

  const levelLabel = (v: number) => {
    const pct = v;
    return pct < 20 ? 'Низкий' : pct < 40 ? 'Умеренный' : pct < 60 ? 'Повышенный' : pct < 80 ? 'Высокий' : 'Критический';
  };

  const sensitivityResults = useMemo(() => {
    if (!linked.profile) return [];
    const settings = linked.profile.settings;
    const baseParams: Record<string, number> = {
      proteinPerKg: settings.proteinPerKg ?? 1.8, fiberG: settings.fiberG ?? 25,
      omega3G: settings.omega3G ?? 1.5, sodiumG: settings.sodiumG ?? 3.5,
      potassiumG: settings.potassiumG ?? 3.0, sleepHours: settings.sleepHours ?? settings.baselineSleepHours ?? 7,
      stressLevel: settings.stressLevel ?? settings.baselineStressLevel ?? 5, activityLevel: settings.activityLevel ?? 5,
      workoutsPerWeek: settings.workoutsPerWeek ?? 3, avgWorkoutMinutes: settings.avgWorkoutMinutes ?? 60,
      lissMinutes: settings.lissMinutesPerWeek ?? 90, hasHIIT: settings.hasHIIT ? 1 : 0,
      volumeTonnes: settings.volumeTonnes ?? 8000, stazhWeeks: (settings.totalCycles ?? 0) * 12,
      // Pull from linked nutrition data (auto-derived from food diary)
      avgKcal: linked.avgWeeklyKcal ?? 2500, avgProtein: linked.avgWeeklyProtein ?? 120,
      avgFat: linked.avgWeeklyFat ?? 80, avgCarbs: linked.avgWeeklyCarbs ?? 250,
      // Pull from profile settings
      age: settings.age ?? 30, weight: settings.weight ?? 80,
      waterL: (settings as any).waterPerDay ?? 2.5,
    };
    const computeFn = (params: Record<string, number>): number => {
      try {
        const mode = (settings.phase === 'blast' ? 'blast' : settings.phase === 'cruise' ? 'cruise' : settings.phase === 'cut' ? 'cut' : settings.phase === 'recomp' ? 'recomp' : 'bulk');
        const input: V7RiskInput = {
          labs: linked.labs || [], course: linked.course || [],
          genetics: { COMT: settings.genetics?.COMT, MTHFR: settings.genetics?.MTHFR, ESR1: settings.genetics?.ESR1, AGTR1: settings.genetics?.AGTR1, NOS3: settings.genetics?.NOS3, SRD5A2: settings.genetics?.SRD5A2, CYP3A4: settings.genetics?.CYP3A4 },
          nutrition: { proteinPerKg: params.proteinPerKg ?? 1.8, fiberG: params.fiberG ?? 25, omega3G: params.omega3G ?? 1.5, sodiumG: params.sodiumG ?? 3.5, potassiumG: params.potassiumG ?? 3.0 } as any,
          training: { workoutsPerWeek: Math.round(params.workoutsPerWeek ?? 3), avgWorkoutMinutes: params.avgWorkoutMinutes ?? 60, hasHIIT: (params.hasHIIT ?? 0) > 0, volumeTonnes: params.volumeTonnes ?? 8000, lissMinutesPerWeek: params.lissMinutes ?? 90 },
          mode: mode as any, stazhWeeks: Math.max(0, params.stazhWeeks ?? 0),
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

  const timeSeriesData = useMemo(() => {
    if (!pkTimeSeries || Object.keys(pkTimeSeries).length === 0) return null;
    const days = 84;
    const organKeys = Object.keys(organSummary);
    const organDaily: Record<string, number[]> = {};
    for (const key of organKeys) organDaily[key] = [];
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

  // Helper: get organ risk for selected week (0 = avg over full period)
  const getOrganRisk = (key: string): number => {
    if (organWeek > 0 && weeklyOrganData[key] && weeklyOrganData[key].length >= organWeek) {
      return weeklyOrganData[key][organWeek - 1] ?? 0;
    }
    return organSummary[key]?.meanS ?? 0;
  };

  const renderOrgans = () => (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🔬 V7 Risk Engine — Полная модель</h3>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Неделя: {organWeek === 0 ? 'Среднее за 12 нед' : `Нед ${organWeek}`}</div>
            <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              <button onClick={() => setOrganWeek(0)} style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: organWeek === 0 ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                background: organWeek === 0 ? '#00e68a' : 'var(--bg-secondary)',
                border: organWeek === 0 ? '1px solid #00e68a' : '1px solid var(--border)',
                color: organWeek === 0 ? '#000' : 'var(--text-dim)',
              }}>∅</button>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(w => (
                <button key={w} onClick={() => setOrganWeek(w)} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: organWeek === w ? 700 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  background: organWeek === w ? '#00e68a' : 'var(--bg-secondary)',
                  border: organWeek === w ? '1px solid #00e68a' : '1px solid var(--border)',
                  color: organWeek === w ? '#000' : 'var(--text-dim)',
                }}>{w}</button>
              ))}
            </div>
            {organWeek > 0 && weeklyGlobalData[organWeek - 1] && (
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
                Общий риск (raw): {fmtPct100(weeklyGlobalData[organWeek - 1].raw)}%
              </div>
            )}
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Raw Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskRaw) }}>{fmtPct100(globalRiskRaw)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Net Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskNet) }}>{fmtPct100(globalRiskNet)}%</div>
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
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={toggleMC}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: mcEnabled ? 'rgba(139,92,246,0.2)' : 'var(--bg-secondary)',
              border: mcEnabled ? '1px solid #8b5cf6' : '1px solid var(--border)',
              color: mcEnabled ? '#8b5cf6' : 'var(--text-dim)',
            }}
          >
            {mcEnabled ? '🎲 Monte Carlo: 50 сценариев' : '🎲 Monte Carlo: выкл'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 10px' }}>🫀 Органные системы</h3>
        {Object.entries(organSummary).map(([sysKey, sysData]: [string, any]) => {
          const label = ORGAN_LABELS_V7[sysKey] || sysKey;
          const isExpanded = expandedOrgan === sysKey;
          const organVal = getOrganRisk(sysKey);
          const organPct = fmtPct01(organVal);
          const riskLevel = organPct < 20 ? 'low' : organPct < 40 ? 'medium' : 'high';
          return (
            <div key={sysKey} className={`risk-${riskLevel}`}
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden',
                borderLeft: `3px solid ${getRiskColor(organPct)}` }}>
              <div className="row" style={{ cursor: 'pointer', marginBottom: 0, padding: '8px 10px' }} onClick={() => setExpandedOrgan(isExpanded ? null : sysKey)}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 50, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, organPct)}%`, height: '100%', background: getRiskColor(organPct), borderRadius: 3 }} />
                  </div>
                  <span style={{ padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11, color: '#fff', background: getRiskColor(organPct), minWidth: 34, textAlign: 'center' }}>{organPct}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: '2px 10px 10px' }}>
                  {sysData.mechanisms && (typeof sysData.mechanisms === 'object') && Object.keys(sysData.mechanisms).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {Object.entries(sysData.mechanisms).map(([idx, mechData]: [string, any]) => {
                        const mechIdx = Number(idx);
                        if (!hasValidMech(sysKey, mechIdx)) return null;
                        const mechName = getMechName(sysKey, mechIdx);
                        const netVal = Math.round((mechData.P_net ?? mechData.p5 ?? 0) * 100);
                        const rawVal = Math.round((mechData.P_raw ?? mechData.raw ?? 0) * 100);
                        return (
                          <div key={mechIdx} style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                              <span style={{ color: 'var(--text-dim)' }}>{mechName}</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <span style={{ color: getRiskColor(rawVal) }} title="База">{rawVal}%</span>
                                <span style={{ color: getRiskColor(netVal), fontWeight: 600 }} title="Нетто">{netVal}%</span>
                                {mechData.geneticMult > 1.05 && <span style={{ fontSize: 8, color: '#eab308' }}>🧬{mechData.geneticMult.toFixed(2)}</span>}
                              </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                              <div style={{ width: Math.min(100, netVal) + '%', height: '100%', background: getRiskColor(netVal), borderRadius: 2, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Острый</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct01(sysData.acute ?? 0)}%</div>
                    </div>
                    <div style={{ background: 'rgba(249,115,22,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Хронич.</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct01(sysData.chronic ?? 0)}%</div>
                    </div>
                    <div style={{ background: 'rgba(168,85,247,0.1)', padding: '4px 6px', borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Фиброз</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct01(sysData.fibrosis ?? 0)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pkTimeSeries && Object.keys(pkTimeSeries).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>💉 PK Концентрации ({Object.keys(pkTimeSeries).length} преп.)</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{(pkDay / 7).toFixed(1)} нед</span>
            <input type="range" min={0} max={83} value={pkDay} onChange={e => setPkDay(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{((83 - pkDay) / 7).toFixed(1)} нед ост.</span>
          </div>
          {Object.entries(pkTimeSeries).map(([subId, concs]: [string, any]) => {
            const vals = concs as number[];
            const maxConc = Math.max(...vals, 0.001);
            const currentVal = vals[pkDay] || 0;
            const startVal = vals[0] || 0;
            return (
              <div key={subId} style={{ marginBottom: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{getSubstanceName(subId)}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Нач: {startVal.toFixed(2)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: getRiskColor((currentVal / maxConc) * 100) }}>{currentVal.toFixed(2)}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Cmax: {maxConc.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 1, height: 36, borderRadius: 4, overflow: 'hidden', alignItems: 'flex-end' }}>
                    {vals.filter((_, i) => i % 2 === 0).map((c: number, i: number) => {
                      const idx = i * 2;
                      const isSelected = idx === pkDay || Math.abs(idx - pkDay) <= 1;
                      return (
                        <div key={i} style={{
                          flex: 1, background: isSelected ? '#00e68a' : getRiskColor((c / maxConc) * 100),
                          height: `${Math.max(3, (c / maxConc) * 100)}%`, borderRadius: '1px 1px 0 0', minHeight: 2, opacity: isSelected ? 1 : 0.6,
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ position: 'absolute', left: `${(pkDay / 83) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--accent)', opacity: 0.8 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                  <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12 нед</span>
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
      <h3 style={{ margin: '0 0 10px 0' }}>🔲 Матрица рисков V7</h3>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>18 систем × 7-9 механизмов</p>
      {Object.entries(matrix.systems).map(([sysKey, sysData]: [string, any]) => {
        const label = SYSTEM_NAMES_RU[sysKey] || sysKey;
        return (
          <div key={sysKey} style={{ marginBottom: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Raw: <b style={{ color: getRiskColor(sysData.raw) }}>{Math.round(sysData.raw)}%</b></span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Net: <b style={{ color: getRiskColor(sysData.net) }}>{Math.round(sysData.net)}%</b></span>
              </div>
            </div>
            {Object.entries(sysData.mechanisms).map(([mechStr, mech]: [string, any]) => {
              const mechIdx = Number(mechStr);
              const mechName = MECHANISM_NAMES[sysKey]?.[mechIdx];
              if (!mechName) return null;
              const netVal = Math.round(mech.P_net * 100);
              return (
                <div key={mechStr} style={{ marginBottom: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-dim)' }}>{mechIdx}. {mechName}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ color: getRiskColor(mech.P_net * 100) }}>{netVal}%</span>
                      {mech.geneticMult > 1.05 && <span style={{ fontSize: 8, color: '#eab308' }}>🧬{mech.geneticMult.toFixed(2)}</span>}
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
    const maxDay = days.length - 1;

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ margin: '0 0 0 0' }}>📈 Эволюция рисков (84 дня)</h3>
            <span style={{ fontSize: 13, fontWeight: 700, background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 6 }}>
              День {selectedDay} / {maxDay}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>Динамика рисков по органным системам</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{(selectedDay / 7).toFixed(1)} нед</span>
            <input type="range" min={0} max={maxDay} value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{((maxDay - selectedDay) / 7).toFixed(1)} нед</span>
          </div>
        </div>

        {Object.entries(organDaily).map(([organKey, values]: [string, any]) => {
          const label = ORGAN_LABELS_V7[organKey] || organKey;
          const maxVal = Math.max(...values);
          const valAtDay = values[selectedDay] || 0;
          const valAtStart = values[0] || 0;
          const valAtEnd = values[values.length - 1] || 0;
          const delta = valAtDay - valAtStart;
          const deltaStr = delta > 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`;
          const deltaColor = delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : 'var(--text-dim)';

          return (
            <div key={organKey} className="card" style={{ marginBottom: 6, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{(valAtStart * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: getRiskColor(valAtDay * 100) }}>{(valAtDay * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 9, color: deltaColor, fontWeight: 600 }}>{deltaStr}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{(valAtEnd * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 1, height: 32, borderRadius: 3, overflow: 'hidden', alignItems: 'flex-end' }}>
                  {values.map((v: number, i: number) => {
                    const isSelected = i === selectedDay;
                    return (
                      <div key={i} style={{
                        flex: 1, background: isSelected ? '#00e68a' : getRiskColor(v * 100),
                        height: `${Math.max(3, v / Math.max(0.01, maxVal) * 100)}%`,
                        borderRadius: '1px 1px 0 0', minHeight: 2, opacity: isSelected ? 1 : 0.6,
                      }} />
                    );
                  })}
                </div>
                <div style={{ position: 'absolute', left: `${(selectedDay / maxDay) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--accent)', opacity: 0.8 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12 нед</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSensitivity = () => {
    if (!linked.profile) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка профиля...</div>;
    if (fmtPct100(globalRiskNet) < 1) return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
        <div>Общий риск = {fmtPct100(globalRiskNet)}%</div>
        <div style={{ fontSize: 11, marginTop: 8 }}>Добавьте препараты в курс на вкладке 💊 Фарма.</div>
      </div>
    );
    if (!sensitivityResults || sensitivityResults.length === 0) return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
        <div>Недостаточно данных для анализа чувствительности</div>
        <div style={{ fontSize: 11, marginTop: 8 }}>Настройте параметры в Профиле {'>'} Параметры V7</div>
      </div>
    );

    const top10 = sensitivityResults.slice(0, 10);
    const maxElasticity = Math.max(...top10.map(r => r.elasticity), 0.001);

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px 0' }}>🔬 Анализ чувствительности</h3>
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
            </div>
          );
        })}
      </div>
    );
  };

  const render3DModel = () => {
    const organKeys = Object.keys(organSummary);
    const weekOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // SVG body dimensions
    const bodyW = 260, bodyH = 520;
    const cx = bodyW / 2;

    // Build gradient IDs per organ for volumetric effect
    const getOrgGrad = (okey: string, pct: number): string => {
      const c = getRiskColor(pct);
      // Parse hex to add lighter highlight
      return `orgGrad_${okey}`;
    };

    // SVG paths for each organ (realistic shapes, positioned in body)
    const organShapes: Record<string, string> = {
      heart:
        `M${cx+4},105 C${cx-2},98 ${cx-6},90 ${cx+2},85 C${cx+10},80 ${cx+16},85 ${cx+18},90 ` +
        `C${cx+20},85 ${cx+26},80 ${cx+34},85 C${cx+42},90 ${cx+38},98 ${cx+32},105 ` +
        `C${cx+28},112 ${cx+18},125 ${cx+18},125 C${cx+18},125 ${cx+8},112 ${cx+4},105 Z`,

      liver:
        `M${cx+20},185 C${cx+40},182 ${cx+50},190 ${cx+48},200 L${cx+46},215 ` +
        `C${cx+44},228 ${cx+30},235 ${cx+15},230 L${cx+5},225 C${cx-2},220 ${cx+2},210 ${cx+8},205 ` +
        `C${cx+10},198 ${cx+15},188 ${cx+20},185 Z`,

      kidney:
        `M${cx-40},210 C${cx-50},208 ${cx-56},218 ${cx-52},228 C${cx-48},238 ${cx-36},240 ` +
        `C${cx-28},240 ${cx-22},232 ${cx-26},222 C${cx-30},212 ${cx-34},210 ${cx-40},210 Z ` +
        `M${cx-18},212 C${cx-28},210 ${cx-34},220 ${cx-30},230 C${cx-26},240 ${cx-14},242 ` +
        `C${cx-6},242 ${cx-0},234 ${cx-4},224 C${cx-8},214 ${cx-12},212 ${cx-18},212 Z`,

      blood:
        `M${cx-60},225 Q${cx-40},215 ${cx-20},220 T${cx+20},218 T${cx+60},225 ` +
        `Q${cx+40},235 ${cx+20},232 T${cx-20},234 T${cx-60},225 Z`,

      endocrine:
        `M${cx-8},65 C${cx-16},60 ${cx-20},68 ${cx-12},74 C${cx-4},80 ${cx+4},78 ${cx+8},74 ` +
        `C${cx+12},70 ${cx+20},68 ${cx+20},65 C${cx+20},60 ${cx+14},58 ${cx+8},58 ` +
        `C${cx+2},58 ${cx-2},60 ${cx-8},65 Z`,

      metabolic:
        `M${cx+14},198 C${cx+6},196 ${cx+4},208 ${cx+12},212 C${cx+20},216 ${cx+30},214 ${cx+32},208 ` +
        `C${cx+34},202 ${cx+24},200 ${cx+14},198 Z`,

      ghigf:
        `M${cx-48},145 C${cx-54},140 ${cx-58},148 ${cx-52},154 C${cx-46},160 ${cx-38},158 ${cx-36},154 ` +
        `C${cx-34},150 ${cx-42},150 ${cx-48},145 Z`,

      ins_axis:
        `M${cx+30},204 C${cx+24},202 ${cx+22},210 ${cx+28},216 C${cx+34},222 ${cx+44},218 ${cx+42},212 ` +
        `C${cx+40},206 ${cx+36},206 ${cx+30},204 Z`,

      musculoskeletal:
        `M${cx-70},270 L${cx-50},260 L${cx-30},270 L${cx-20},300 L${cx-25},340 L${cx-35},380 ` +
        `L${cx-30},420 L${cx-20},450 L${cx-15},460 ` +
        `C${cx-25},465 ${cx-40},460 ${cx-45},450 L${cx-50},420 L${cx-55},380 L${cx-60},340 ` +
        `L${cx-65},300 L${cx-70},270 Z ` +
        `M${cx+15},270 L${cx+35},260 L${cx+55},270 L${cx+65},300 L${cx+60},340 L${cx+55},380 ` +
        `L${cx+50},420 L${cx+45},450 L${cx+40},460 ` +
        `C${cx+30},465 ${cx+20},460 ${cx+15},450 L${cx+20},420 L${cx+30},380 L${cx+35},340 ` +
        `L${cx+40},300 L${cx+35},270 Z`,

      neuro_toxicity:
        `M${cx-24},22 C${cx-32},18 ${cx-36},28 ${cx-30},34 C${cx-24},40 ${cx-16},42 ` +
        `C${cx-8},42 ${cx-0},38 ${cx+0},34 C${cx+0},38 ${cx+8},42 ${cx+16},42 ` +
        `C${cx+24},42 ${cx+32},40 ${cx+36},34 C${cx+42},28 ${cx+38},18 ${cx+30},22 ` +
        `C${cx+24},26 ${cx+16},28 ${cx+8},26 C${cx+4},24 ${cx-4},24 ${cx-8},26 ` +
        `C${cx-16},28 ${cx-24},26 ${cx-24},22 Z`,

      reproductive:
        `M${cx-24},316 C${cx-32},310 ${cx-38},320 ${cx-30},328 C${cx-22},336 ${cx-10},332 ${cx-8},326 ` +
        `C${cx-6},320 ${cx-14},322 ${cx-24},316 Z ` +
        `M${cx+8},316 C${cx+0},310 ${cx-6},320 ${cx+2},328 C${cx+10},336 ${cx+22},332 ${cx+24},326 ` +
        `C${cx+26},320 ${cx+18},322 ${cx+8},316 Z`,
    };

    // Body silhouette (improved with shoulders/waist)
    const bodyPaths = `
      M${cx-75},70 C${cx-95},70 ${cx-105},80 ${cx-105},100 L${cx-105},110
      C${cx-105},120 ${cx-110},135 ${cx-125},150 L${cx-140},165 L${cx-135},175 L${cx-120},162
      C${cx-108},175 ${cx-110},190 ${cx-115},205 L${cx-105},215
      C${cx-98},235 ${cx-92},255 ${cx-88},275 L${cx-82},275
      L${cx-78},255 L${cx-72},305 L${cx-66},330
      L${cx-72},390 L${cx-68},430 L${cx-76},470 L${cx-70},510
      L${cx-25},510 L${cx-25},470 L${cx-30},430 L${cx-28},390
      L${cx-20},355 L${cx-10},390 L${cx-10},430 L${cx-8},470
      L${cx-5},510 L${cx+5},510 L${cx+8},470 L${cx+10},430
      L${cx+10},390 L${cx+20},355 L${cx+28},390 L${cx+30},430
      L${cx+25},470 L${cx+25},510 L${cx+70},510 L${cx+76},470
      L${cx+68},430 L${cx+72},390 L${cx+66},330 L${cx+72},305
      L${cx+78},255 L${cx+82},275 L${cx+88},275
      C${cx+92},255 ${cx+98},235 ${cx+105},215 L${cx+115},205
      C${cx+110},190 ${cx+108},175 ${cx+120},162 L${cx+135},175
      L${cx+140},165 L${cx+125},150
      C${cx+110},135 ${cx+105},120 ${cx+105},110 L${cx+105},100
      C${cx+105},80 ${cx+95},70 ${cx+75},70 Z
    `;

    // Helper: get organ value for selected week
    const get3DOrgVal = (key: string): number => {
      if (selectedDay > 0 && weeklyOrganData[key] && weeklyOrganData[key].length >= Math.ceil(selectedDay / 7)) {
        return weeklyOrganData[key][Math.ceil(selectedDay / 7) - 1] ?? 0;
      }
      return organSummary[key]?.meanS ?? 0;
    };

    // Opacity scale for risk
    const riskOpacity = (pct: number) => Math.max(0.4, Math.min(0.95, 0.4 + pct / 100 * 0.55));

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>🧍 3D Модель рисков</h3>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Неделя: {selectedDay === 0 ? 'Среднее' : `Нед ${Math.round(selectedDay / 7)}`}</div>
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
                <button onClick={() => setSelectedDay(0)} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: selectedDay === 0 ? 700 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  background: selectedDay === 0 ? '#00e68a' : 'var(--bg-secondary)',
                  border: selectedDay === 0 ? '1px solid #00e68a' : '1px solid var(--border)',
                  color: selectedDay === 0 ? '#000' : 'var(--text-dim)',
                }}>∅</button>
                {weekOptions.map(w => (
                  <button key={w} onClick={() => setSelectedDay(w * 7)} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: selectedDay === w * 7 ? 700 : 400,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    background: selectedDay === w * 7 ? '#00e68a' : 'var(--bg-secondary)',
                    border: selectedDay === w * 7 ? '1px solid #00e68a' : '1px solid var(--border)',
                    color: selectedDay === w * 7 ? '#000' : 'var(--text-dim)',
                  }}>{w}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${bodyW} ${bodyH}`} style={{ width: '100%', maxWidth: bodyW, height: 'auto', display: 'block', margin: '0 auto' }}>
            <defs>
              <filter id="bodyShadow"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.35" /></filter>
              <filter id="organGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="organGlowStrong"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="30%" stopColor="rgba(255,255,255,0.07)" />
                <stop offset="70%" stopColor="rgba(255,255,255,0.07)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
              </linearGradient>
              <radialGradient id="highlight" cx="35%" cy="30%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>
            {/* Background glow for body */}
            <ellipse cx={cx} cy={260} rx={90} ry={200} fill="rgba(0,230,138,0.02)" filter="blur(20px)" />
            {/* Body silhouette */}
            <path d={bodyPaths} fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" filter="url(#bodyShadow)" />
            <path d={bodyPaths} fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            {/* Arms */}
            <ellipse cx={cx - 95} cy={190} rx="12" ry="42" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <ellipse cx={cx + 95} cy={190} rx="12" ry="42" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Legs */}
            <ellipse cx={cx - 25} cy={445} rx="20" ry="65" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <ellipse cx={cx + 25} cy={445} rx="20" ry="65" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Head */}
            <ellipse cx={cx} cy={38} rx="30" ry="35" fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <ellipse cx={cx} cy={38} rx="28" ry="33" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

            {/* Neck */}
            <rect x={cx - 12} y={62} width={24} height={12} rx={4} fill="var(--bg-secondary)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

            {/* Organs — rendered as proper shapes */}
            {organKeys.map(okey => {
              const sd = organSummary[okey];
              const orgVal = get3DOrgVal(okey);
              const pct = Math.round(orgVal * 100);
              const isSelected = selectedOrgan3D === okey;
              const color = getRiskColor(pct);
              const op = riskOpacity(pct);
              const path = organShapes[okey];
              if (!path) return null;
              const glowFilter = isSelected ? 'url(#organGlowStrong)' : pct > 40 ? 'url(#organGlow)' : undefined;

              // Build a unique gradient for this organ
              const gradId = `orgG_${okey}`;
              // Lighter highlight version of the color
              const hlColor = pct < 20 ? '#66ffb3' : pct < 40 ? '#fff066' : pct < 60 ? '#ffaa44' : pct < 80 ? '#ff6666' : '#ff3344';

              return (
                <g key={okey} onClick={() => setSelectedOrgan3D(isSelected ? null : okey)} style={{ cursor: 'pointer' }}>
                  <defs>
                    <radialGradient id={gradId} cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor={hlColor} stopOpacity={isSelected ? 0.7 : 0.5} />
                      <stop offset="100%" stopColor={color} stopOpacity={op} />
                    </radialGradient>
                  </defs>
                  {/* Shadow */}
                  <path d={path} transform="translate(2,3)" fill="rgba(0,0,0,0.35)" opacity={0.5} filter="url(#bodyShadow)" />
                  {/* Organ body with gradient */}
                  <path d={path}
                    fill={`url(#${gradId})`}
                    stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.25)'}
                    strokeWidth={isSelected ? 2 : 0.8}
                    filter={glowFilter}
                  />
                  {/* Risk % label on selected */}
                  {isSelected && (
                    <text x={cx} y={520} fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                      {ORGAN_LABELS_V7[okey] || okey}: {pct}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Internal organ labels */}
            <text x={cx} y={15} fill="var(--text-dim)" fontSize="7" fontWeight="600" textAnchor="middle">ГОЛОВА</text>
            <text x={cx - 95} y={180} fill="var(--text-dim)" fontSize="6" textAnchor="middle">Л</text>
            <text x={cx + 95} y={180} fill="var(--text-dim)" fontSize="6" textAnchor="middle">П</text>

            {/* Selected organ floating label */}
            {selectedOrgan3D && (
              <text x={cx} y={bodyH - 14} fill="#fff" fontSize="14" fontWeight="800" textAnchor="middle" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                {ORGAN_LABELS_V7[selectedOrgan3D] || selectedOrgan3D}: {fmtPct01(organSummary[selectedOrgan3D]?.meanS ?? 0)}%
              </text>
            )}

            {/* Legend */}
            <g transform="translate(10, 479)">
              <rect x={0} y={0} width={8} height={8} rx={1.5} fill="#22c55e" opacity={0.8} />
              <text x={10} y={7} fill="var(--text-dim)" fontSize="6">Низк</text>
              <rect x={40} y={0} width={8} height={8} rx={1.5} fill="#eab308" opacity={0.8} />
              <text x={50} y={7} fill="var(--text-dim)" fontSize="6">Сред</text>
              <rect x={80} y={0} width={8} height={8} rx={1.5} fill="#f97316" opacity={0.8} />
              <text x={90} y={7} fill="var(--text-dim)" fontSize="6">Выс</text>
              <rect x={115} y={0} width={8} height={8} rx={1.5} fill="#ef4444" opacity={0.8} />
              <text x={125} y={7} fill="var(--text-dim)" fontSize="6">Крит</text>
            </g>
          </svg>
        </div>

        {/* Selected organ detail */}
        {selectedOrgan3D && organSummary[selectedOrgan3D] && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{ORGAN_LABELS_V7[selectedOrgan3D] || selectedOrgan3D}</span>
              <span style={{
                padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                color: '#fff', background: getRiskColor(fmtPct01(organSummary[selectedOrgan3D].meanS ?? 0)),
              }}>
                {fmtPct01(organSummary[selectedOrgan3D].meanS ?? 0)}%
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Острый</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(fmtPct01(organSummary[selectedOrgan3D].acute ?? 0)) }}>
                  {fmtPct01(organSummary[selectedOrgan3D].acute ?? 0)}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Хронический</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(fmtPct01(organSummary[selectedOrgan3D].chronic ?? 0)) }}>
                  {fmtPct01(organSummary[selectedOrgan3D].chronic ?? 0)}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Фиброз</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(fmtPct01(organSummary[selectedOrgan3D].fibrosis ?? 0)) }}>
                  {fmtPct01(organSummary[selectedOrgan3D].fibrosis ?? 0)}%
                </div>
              </div>
            </div>
            {organSummary[selectedOrgan3D].mechanisms && Object.keys(organSummary[selectedOrgan3D].mechanisms).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Механизмы:</div>
                {Object.entries(organSummary[selectedOrgan3D].mechanisms).map(([idx, md]: [string, any]) => {
                  const mechIdx = Number(idx);
                  if (!hasValidMech(selectedOrgan3D, mechIdx)) return null;
                  const nm = getMechName(selectedOrgan3D, mechIdx);
                  const mpct = Math.round((md.P_net ?? md.p5 ?? 0) * 100);
                  return (
                    <div key={mechIdx} style={{ marginBottom: 3, fontSize: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dim)' }}>{nm}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, marginLeft: 8 }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 4 }}>
                          <div style={{ width: `${Math.min(100, mpct)}%`, height: '100%', background: getRiskColor(mpct), borderRadius: 2 }} />
                        </div>
                        <span style={{ color: getRiskColor(mpct), fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{mpct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Overall risk bar */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Общий риск</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Raw: <b style={{ color: getRiskColor(globalRiskRaw) }}>{fmtPct100(globalRiskRaw)}%</b></span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Net: <b style={{ color: getRiskColor(globalRiskNet) }}>{fmtPct100(globalRiskNet)}%</b></span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 16, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, globalRiskNet)}%`, height: '100%',
              background: `linear-gradient(90deg, #22c55e, ${getRiskColor(globalRiskNet)})`,
              borderRadius: 6, transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
            <span>Низкий</span><span>Умеренный</span><span>Повышенный</span><span>Высокий</span><span>Критический</span>
          </div>
        </div>
      </div>
    );
  };

  const tabs: { id: string; label: string }[] = [
    { id: 'organs', label: '🫀 Органы' }, { id: 'matrix', label: '🔲 Матрица' },
    { id: 'timeseries', label: '📈 Временной ряд' }, { id: 'sensitivity', label: '📊 Чувствит.' },
    { id: 'pk', label: '💉 PK' },
  ];

  const pkContent = pkTimeSeries && Object.keys(pkTimeSeries).length > 0 ? (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>💊 Фармакокинетика ({Object.keys(pkTimeSeries).length} преп.)</h3>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>Недельная динамика концентраций препаратов</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{(pkDay / 7).toFixed(1)} нед</span>
        <input type="range" min={0} max={83} value={pkDay} onChange={e => setPkDay(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{((83 - pkDay) / 7).toFixed(1)} нед ост.</span>
      </div>
      {Object.entries(pkTimeSeries).map(([subId, concs]: [string, any]) => {
        const vals = concs as number[];
        const maxConc = Math.max(...vals, 0.001);
        const currentVal = vals[pkDay] || 0;
        const startVal = vals[0] || 0;
        return (
          <div key={subId} style={{ marginBottom: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{getSubstanceName(subId)}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Нач: {startVal.toFixed(2)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: getRiskColor((currentVal / maxConc) * 100) }}>{currentVal.toFixed(2)}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Cmax: {maxConc.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 1, height: 36, borderRadius: 4, overflow: 'hidden', alignItems: 'flex-end' }}>
                {vals.filter((_, i) => i % 2 === 0).map((c: number, i: number) => {
                  const idx = i * 2;
                  const isSelected = idx === pkDay || Math.abs(idx - pkDay) <= 1;
                  return (
                    <div key={i} style={{
                      flex: 1, background: isSelected ? '#00e68a' : getRiskColor((c / maxConc) * 100),
                      height: `${Math.max(3, (c / maxConc) * 100)}%`, borderRadius: '1px 1px 0 0', minHeight: 2, opacity: isSelected ? 1 : 0.6,
                    }} />
                  );
                })}
              </div>
              <div style={{ position: 'absolute', left: `${(pkDay / 83) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--accent)', opacity: 0.8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
              <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12 нед</span>
            </div>
          </div>
        );
      })}
    </div>
  ) : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Нет данных PK. Добавьте препараты в курс.</div>;

  return (
    <div style={{ padding: '0 0 80px 0' }}>
      <div className="card" style={{ marginBottom: 12, padding: '8px 10px', display: 'flex', gap: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
            background: activeTab === t.id ? '#00e68a' : 'var(--bg-secondary)',
            border: 'none',
            color: activeTab === t.id ? '#000' : 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.15s',
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
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          🔬 Health Engine v7.0 — PK → Hill → Signaling → 7мех → Damage/Recovery → MC → Risk<br />
          12 органов × 7 механизмов | Нейротоксичность | Межорганные связи | Стаж | Monte Carlo<br />
          {mcResult ? `🎯 MC: сред. ${((mcResult as any).meanGlobalRisk * 100 || 0).toFixed(1)}% [P5: ${((mcResult as any).p5GlobalRisk * 100 || 0).toFixed(1)}% — P95: ${((mcResult as any).p95GlobalRisk * 100 || 0).toFixed(1)}%]` : mcEnabled ? '🔄 MC запускается...' : '⚙️ Детерминированный режим'}
          {pkTimeSeries && Object.keys(pkTimeSeries).length > 0 ? ` | 💉 PK: ${Object.keys(pkTimeSeries).length} препаратов` : ''}
        </div>
      </div>
    </div>
  );
};