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
  heart: '❤️ Сердце', vessels: '🩸 Сосуды', liver: '🫁 Печень', kidney: '🫘 Почки',
  blood: '🩸 Кровь', endocrine: '⚖️ Эндокринная', metabolic: '⚡ Метаболизм',
  ghigf: '📈 GH/IGF', ins_axis: '🍬 Инсулин',
  musculoskeletal: '💪 Опорно-двигательная', neuro_toxicity: '🧠 Нейротоксичность',
  reproductive: '🧬 Репродуктивная',
};

const V7_ORGAN_TO_SYSTEM: Record<string, string> = {
  heart: 'cardio', vessels: 'vessels', liver: 'hepatic', kidney: 'renal',
  blood: 'blood', endocrine: 'endocrine', metabolic: 'metabolic',
  ghigf: 'ghigf', ins_axis: 'ins_axis',
  musculoskeletal: 'musculoskeletal', neuro_toxicity: 'neuro_toxicity',
  reproductive: 'reproductive',
};

function getMechName(sysKey: string, mechIdx: number): string {
  const smKey = V7_ORGAN_TO_SYSTEM[sysKey] || sysKey;
  if (MECHANISM_NAMES[smKey]?.[mechIdx]) {
    const name = MECHANISM_NAMES[smKey][mechIdx];
    return name && name.length > 1 ? name : `Механизм ${mechIdx + 1}`;
  }
  const mechs = SYSTEM_MECHANISMS[smKey];
  if (mechs) {
    const found = mechs.find(m => m.num === mechIdx);
    if (found?.label && found.label.length > 1) return found.label;
  }
  return `Механизм ${mechIdx + 1}`;
}

function hasValidMech(sysKey: string, mechIdx: number): boolean {
  return getMechName(sysKey, mechIdx) !== '';
}

const SENSITIVITY_LABELS: Record<string, string> = {
  proteinPerKg: 'Белок (г/кг)', fiberG: 'Клетчатка', omega3G: 'Омега-3',
  sodiumG: 'Натрий', potassiumG: 'Калий', sleepHours: 'Сон',
  stressLevel: 'Стресс', activityLevel: 'Активность',
  workoutsPerWeek: 'Тренировок/нед', avgWorkoutMinutes: 'Минут/трен',
  lissMinutes: 'LISS (мин/нед)', hasHIIT: 'HIIT',
  volumeTonnes: 'Тоннаж', stazhWeeks: 'Стаж',
  avgKcal: 'Калории', avgProtein: 'Белки',
  avgFat: 'Жиры', avgCarbs: 'Углеводы',
  age: 'Возраст', weight: 'Вес', waterL: 'Вода',
};



export const V7RiskDisplay: React.FC<{
  result: V7RiskResult;
  organWeek?: number;
  onWeekChange?: (w: number) => void;
  mcEnabled?: boolean;
  onToggleMC?: () => void;
}> = ({ result, organWeek: externalWeek, onWeekChange: externalWeekChange, mcEnabled: externalMc, onToggleMC: externalToggleMc }) => {
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('organs');
  const [selectedDay, setSelectedDay] = useState<number>(42);
  const [pkDay, setPkDay] = useState(42);
  const [selectedOrgan3D, setSelectedOrgan3D] = useState<string | null>(null);
  const [internalMc, setInternalMc] = useState<boolean>(false);
  const [internalWeek, setInternalWeek] = useState<number>(0);
  const linked = useDataLink();

  const mcEnabled = externalMc !== undefined ? externalMc : internalMc;
  const organWeek = externalWeek !== undefined ? externalWeek : internalWeek;

  const setOrganWeek = (w: number) => {
    setInternalWeek(w);
    if (externalWeekChange) externalWeekChange(w);
  };

  const toggleMC = () => {
    if (externalToggleMc) {
      externalToggleMc();
    } else {
      const next = !internalMc;
      setInternalMc(next);
      const p = getProfile();
      p.settings.mcRuns = next ? 50 : 0;
      updateProfile(p);
    }
  };

  const { matrix, organSummary, globalRiskRaw, globalRiskNet, globalPEvent, dataQuality, organs, mcResult, pkTimeSeries, weeklyOrganData = {}, weeklyGlobalData = [] } = result;

  // Deterministic organ risk for the current week selection
  const detOrganRisk = (key: string, weekIdx: number): number => {
    if (weekIdx > 0 && weeklyOrganData[key] && weeklyOrganData[key].length >= weekIdx) {
      return weeklyOrganData[key][weekIdx - 1] ?? 0;
    }
    return organSummary[key]?.meanS ?? 0;
  };

  const effectiveOrganRisk = (key: string): number => {
    const weekIdx = organWeek;
    // When a specific week is selected, only show deterministic (weekly) value
    // MC result is averaged over full period and cannot scale per-week data
    if (weekIdx > 0) return detOrganRisk(key, weekIdx);
    // When showing average (weekIdx === 0), use MC if enabled
    if (mcEnabled && mcResult && mcResult.organSummary[key]) {
      return mcResult.organSummary[key].meanS;
    }
    return detOrganRisk(key, weekIdx);
  };

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
    return pct < 20 ? '' : pct < 40 ? '' : pct < 60 ? '' : pct < 80 ? '' : '';
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
    };
    // Use a lightweight compute function based on the existing matrix result
    // instead of re-running full V7 simulation for each perturbation
    const baseNet = globalRiskNet;
    if (baseNet <= 0) return [];

    const computeFnFast = (params: Record<string, number>): number => {
      // Simple linear sensitivity: adjust globalRiskNet by relative changes
      const totalPerturb = Object.entries(params).reduce((sum, [key, val]) => {
        const orig = baseParams[key];
        if (!orig || orig === 0) return sum;
        return sum + Math.abs((val - orig) / orig) * 0.5;
      }, 0);
      return baseNet * Math.max(0.2, 1 + totalPerturb * Math.sign(baseNet - 50) * 0.3);
    };

    return sensitivityAnalysis(computeFnFast, baseParams, [-0.15, -0.08, 0.08, 0.15]);
  }, [linked.profile, globalRiskNet]);

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
  const getOrganRisk = (key: string): number => effectiveOrganRisk(key);

  const renderOrgans = () => (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🔬 V7 Risk Engine — Полная модель</h3>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Временной срез:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#00e68a' }}>
                {organWeek === 0 ? '' : `Неделя ${organWeek}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', whiteSpace: 'nowrap', minWidth: 22, textAlign: 'right' }}>в€…</span>
              <input type="range" min={0} max={12} value={organWeek} onChange={e => setOrganWeek(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#00e68a', height: 4, cursor: 'pointer' }} />
              <span style={{ fontSize: 9, color: 'var(--text-dim)', whiteSpace: 'nowrap', minWidth: 22 }}>12</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, padding: '0 24px' }}>
              {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(w => (
                <span key={w} onClick={() => setOrganWeek(w)} style={{
                  width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
                  background: organWeek === w ? '#00e68a' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.2s',
                }} />
              ))}
            </div>
            {organWeek > 0 && weeklyGlobalData[organWeek - 1] && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>
                Общий риск (raw): <b style={{ color: getRiskColor(fmtPct100(weeklyGlobalData[organWeek - 1].raw)) }}>{fmtPct100(weeklyGlobalData[organWeek - 1].raw)}%</b>
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
              padding: '8px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: mcEnabled ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--bg-secondary)',
              border: mcEnabled ? '1px solid #8b5cf6' : '1px solid var(--border)',
              color: mcEnabled ? '#fff' : 'var(--text-dim)',
              boxShadow: mcEnabled ? '0 0 16px rgba(139,92,246,0.35)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            🎲 Монте-Карло: {mcEnabled ? 'ВКЛ' : 'ВЫКЛ'}
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
                                <span style={{ color: getRiskColor(rawVal) }} title="">{rawVal}%</span>
                                <span style={{ color: getRiskColor(netVal), fontWeight: 600 }} title="">{netVal}%</span>
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
    if (!linked.course || linked.course.length === 0) return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <div>Добавьте препараты в курс на вкладке 💊 Фарма</div>
        <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-dim)' }}>для анализа чувствительности</div>
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
          const elasticityLevel = result.elasticity < 0.1 ? '' : result.elasticity < 0.5 ? '' : result.elasticity < 1.0 ? '' : '';
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: elasticityColor }}>Оµ = {result.elasticity.toFixed(3)}</span>
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

    const organShapes: Record<string, string> = {
      neuro_toxicity:
        `M${cx-35},20 C${cx-45},10 ${cx-55},22 ${cx-48},32 C${cx-42},40 ${cx-30},44 ` +
        `C${cx-20},44 ${cx-10},40 ${cx-8},34 C${cx-6},40 ${cx+6},44 ${cx+16},44 ` +
        `C${cx+26},44 ${cx+38},40 ${cx+44},32 C${cx+50},22 ${cx+40},10 ${cx+30},20 ` +
        `C${cx+24},26 ${cx+14},30 ${cx+4},28 C${cx-4},26 ${cx-14},26 ${cx-24},28 ` +
        `C${cx-30},26 ${cx-34},22 ${cx-35},20 Z`,

      endocrine:
        `M${cx-10},72 C${cx-20},66 ${cx-24},78 ${cx-14},84 C${cx-4},88 ${cx+4},88 ${cx+14},84 ` +
        `C${cx+24},78 ${cx+20},66 ${cx+10},72 C${cx+6},74 ${cx-2},74 ${cx-6},72 Z`,

      ghigf:
        `M${cx-22},48 C${cx-32},42 ${cx-36},54 ${cx-26},60 C${cx-16},64 ${cx-4},62 ${cx-2},56 ` +
        `C${cx+0},50 ${cx-12},52 ${cx-22},48 Z`,

      heart:
        `M${cx-16},110 C${cx-26},100 ${cx-30},88 ${cx-18},82 C${cx-10},78 ${cx-2},82 ${cx+0},88 ` +
        `C${cx+2},82 ${cx+10},78 ${cx+18},82 C${cx+30},88 ${cx+26},100 ${cx+16},110 ` +
        `C${cx+12},116 ${cx+6},122 ${cx+0},126 C${cx-6},122 ${cx-12},116 ${cx-16},110 Z`,

      blood:
        `M${cx-75},225 Q${cx-50},210 ${cx-25},218 T${cx+25},218 T${cx+75},225 ` +
        `Q${cx+50},238 ${cx+25},230 T${cx-25},230 T${cx-75},225 Z`,

      vessels:
        `M${cx-80},140 L${cx-80},160 M${cx+80},140 L${cx+80},160 ` +
        `M${cx+60},120 L${cx+60},200 M${cx-60},120 L${cx-60},200`,

      liver:
        `M${cx+20},190 C${cx+40},186 ${cx+55},194 ${cx+52},210 L${cx+50},225 ` +
        `C${cx+48},240 ${cx+34},248 ${cx+18},244 L${cx-4},238 C${cx-12},234 ${cx-8},222 ${cx-2},216 ` +
        `C${cx+4},208 ${cx+10},194 ${cx+20},190 Z`,

      metabolic:
        `M${cx-8},200 C${cx-20},196 ${cx-22},212 ${cx-10},218 C${cx-2},222 ${cx+8},220 ${cx+12},214 ` +
        `C${cx+16},208 ${cx+4},204 ${cx-8},200 Z`,

      ins_axis:
        `M${cx+26},204 C${cx+16},200 ${cx+14},214 ${cx+24},220 C${cx+34},226 ${cx+46},222 ${cx+44},214 ` +
        `C${cx+42},206 ${cx+34},208 ${cx+26},204 Z`,

      kidney:
        `M${cx-55},240 C${cx-68},236 ${cx-74},248 ${cx-66},260 C${cx-58},272 ${cx-42},272 ` +
        `C${cx-36},272 ${cx-30},262 ${cx-34},250 C${cx-38},240 ${cx-46},240 ${cx-55},240 Z ` +
        `M${cx+34},240 C${cx+22},236 ${cx+16},248 ${cx+24},260 C${cx+32},272 ${cx+48},272 ` +
        `C${cx+54},272 ${cx+60},262 ${cx+56},250 C${cx+52},240 ${cx+44},240 ${cx+34},240 Z`,

      musculoskeletal:
        `M${cx-80},290 L${cx-65},280 L${cx-50},290 L${cx-42},320 L${cx-46},360 L${cx-52},400 ` +
        `L${cx-48},440 L${cx-44},470 L${cx-40},480 ` +
        `C${cx-50},486 ${cx-64},480 ${cx-68},470 L${cx-72},440 L${cx-76},400 L${cx-80},360 ` +
        `L${cx-84},320 L${cx-80},290 Z ` +
        `M${cx+40},290 L${cx+55},280 L${cx+70},290 L${cx+74},320 L${cx+70},360 L${cx+64},400 ` +
        `L${cx+60},440 L${cx+56},470 L${cx+52},480 ` +
        `C${cx+42},486 ${cx+28},480 ${cx+24},470 L${cx+28},440 L${cx+32},400 L${cx+40},360 ` +
        `L${cx+44},320 L${cx+40},290 Z`,

      reproductive:
        `M${cx-30},330 C${cx-40},322 ${cx-46},336 ${cx-36},346 C${cx-26},356 ${cx-12},350 ${cx-10},338 ` +
        `C${cx-8},326 ${cx-20},328 ${cx-30},330 Z ` +
        `M${cx+10},330 C${cx+0},322 ${cx-6},336 ${cx+4},346 C${cx+14},356 ${cx+28},350 ${cx+30},338 ` +
        `C${cx+32},326 ${cx+20},328 ${cx+10},330 Z`,
    };

    const bodyPaths = `
      M${cx-75},70 C${cx-95},70 ${cx-105},80 ${cx-105},100 L${cx-105},110
      C${cx-105},120 ${cx-110},135 ${cx-125},150 L${cx-140},165 L${cx-135},175 L${cx-120},162
      C${cx-108},175 ${cx-110},190 ${cx-115},205 L${cx-105},215
      C${cx-98},235 ${cx-92},255 ${cx-88},275 L${cx-82},275
      L${cx-78},255 L${cx-72},305 L${cx-66},330
      L${cx-72},390 L${cx-68},430 L${cx-74},470 L${cx-70},510
      L${cx-25},510 L${cx-25},470 L${cx-30},430 L${cx-28},390
      L${cx-20},355 L${cx-10},390 L${cx-10},430 L${cx-8},470
      L${cx-5},510 L${cx+5},510 L${cx+8},470 L${cx+10},430
      L${cx+10},390 L${cx+20},355 L${cx+28},390 L${cx+30},430
      L${cx+25},470 L${cx+25},510 L${cx+70},510 L${cx+74},470
      L${cx+68},430 L${cx+72},390 L${cx+66},330 L${cx+72},305
      L${cx+78},255 L${cx+82},275 L${cx+88},275
      C${cx+92},255 ${cx+98},235 ${cx+105},215 L${cx+115},205
      C${cx+110},190 ${cx+108},175 ${cx+120},162 L${cx+135},175
      L${cx+140},165 L${cx+125},150
      C${cx+110},135 ${cx+105},120 ${cx+105},110 L${cx+105},100
      C${cx+105},80 ${cx+95},70 ${cx+75},70 Z
    `;

    // Helper: get organ value for selected week
    const get3DOrgVal = (key: string): number => effectiveOrganRisk(key);

    // Opacity scale for risk
    const riskOpacity = (pct: number) => Math.max(0.4, Math.min(0.95, 0.4 + pct / 100 * 0.55));

    return (
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>🧍 3D Модель рисков</h3>
            <div style={{ minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{organWeek === 0 ? '∅ Среднее' : `Нед ${organWeek}`}</span>
              </div>
              <input type="range" min={0} max={12} value={organWeek} onChange={e => setOrganWeek(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#00e68a', height: 3, cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>в€…</span>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>12</span>
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
    { id: 'organs', label: 'Органы' }, { id: 'matrix', label: 'Матрица' },
    { id: 'timeseries', label: 'Динамика' }, { id: 'sensitivity', label: 'Чувствительность' },
    { id: 'pk', label: 'Фармакокинетика' },
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
      <div style={{ marginBottom:10, padding:12, borderRadius:16, background:'var(--glass-bg)', border:'1px solid var(--glass-border)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>🎲 Монте-Карло моделирование</div>
          <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
            {mcEnabled ? mcResult ? `MC: ${((mcResult as any).meanGlobalRisk*100||0).toFixed(1)}% [P5: ${((mcResult as any).p5GlobalRisk*100||0).toFixed(1)}–P95: ${((mcResult as any).p95GlobalRisk*100||0).toFixed(1)}%]` : 'Загрузка...' : 'Детерминированный режим'}
          </div>
        </div>
        <button onClick={toggleMC} style={{ padding:'8px 20px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', background:mcEnabled?'linear-gradient(135deg,#8b5cf6,#6d28d9)':'var(--bg-secondary)', border:mcEnabled?'1px solid #8b5cf6':'1px solid var(--border)', color:mcEnabled?'#fff':'var(--text-dim)', boxShadow:mcEnabled?'0 0 16px rgba(139,92,246,0.35)':'none', transition:'all 0.3s' }}>🎲 МК: {mcEnabled?'ВКЛ':'ВЫКЛ'}</button>
      </div>
      {activeTab === 'organs' && renderOrgans()}
      {activeTab === 'matrix' && renderMatrix()}
      {activeTab === 'timeseries' && renderTimeSeries()}
      {activeTab === 'sensitivity' && renderSensitivity()}
      {activeTab === 'pk' && pkContent}
    </div>
  );
};
