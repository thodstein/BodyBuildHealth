import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, SUBSYSTEM_MAP, SUBSYSTEM_PARENT, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell, LabPoint } from '../../core/types';
import { calculateRisks, calculateAggregatedRisks, type AggregatedRisk } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails } from '../../engines/labs-indices.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { getGlobalNoLabs, getNoLabsSystems } from './LabsScreen';
import { RiskOverview } from './RiskScreen_parts/RiskOverview';

import { RiskDetails } from './RiskScreen_parts/RiskDetails';
import { V7RiskDisplay } from './RiskScreen_parts/V7RiskDisplay';
import { WeeklyRiskChart } from './RiskScreen_parts/WeeklyRiskChart';
import { RiskInfo } from './RiskScreen_parts/RiskInfo';
import { Risk3DModel } from './RiskScreen_parts/Risk3DModel';
import { calculateWeeklyRiskDynamics, type WeeklyRiskDynamics } from '../../engines/weekly-risk-dynamics.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { getProfile, updateProfile } from '../../core/profile-manager';

const RISK_HISTORY_KEY = 'risk_history';
const MAX_HISTORY = 12;

function loadRiskHistory(): { date: string; overallRaw: number; overallNet: number }[] {
  try { const raw = localStorage.getItem(RISK_HISTORY_KEY); if (!raw) return []; return JSON.parse(raw); } catch { return []; }
}

function saveRiskHistory(entry: { date: string; overallRaw: number; overallNet: number }) {
  try { const history = loadRiskHistory(); history.push(entry); localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
}

const TAB_LABELS: Record<string, string> = {
  overview: '📊 Обзор',
  dynamics: '📈 Динамика',
  mechanisms: '⚙️ Механизмы',
  v7: '🔬 Симуляция',
  model: '🧍 3D Модель',
  info: 'ℹ️ Инфо',
};

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'dynamics' | 'mechanisms' | 'v7' | 'model' | 'info'>('overview');
  const [tick, setTick] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekMode, setWeekMode] = useState<'week' | 'average'>('average');
  const [organWeek, setOrganWeek] = useState(0);
  const { v7Result, legacyResult: v7Legacy } = useV7Risk();

  // MC toggle at RiskScreen level
  const [mcEnabled, setMcEnabled] = useState(() => {
    try { return (getProfile().settings.mcRuns ?? 0) > 0; } catch { return false; }
  });
  const toggleMC = () => {
    const next = !mcEnabled;
    setMcEnabled(next);
    const p = getProfile();
    p.settings.mcRuns = next ? 50 : 0;
    updateProfile(p);
  };

  // Calculate weekly risk dynamics from course
  const weeklyDynamics = useMemo<WeeklyRiskDynamics | null>(() => {
    if (!linked.profile || !linked.activeDrugs) return null;
    const genetics = linked.profile.settings.genetics ?? {};
    return calculateWeeklyRiskDynamics(
      {
        genetics,
        nutritionFactor: linked.profile.settings.nutritionFactor ?? 0.8,
        trainingFactor: linked.profile.settings.trainingFactor ?? 0.7,
        activeDrugs: linked.activeDrugs,
        supportCoverage: linked.supportCoverage,
      },
      linked.course || [],
    );
  }, [linked.profile, linked.activeDrugs, linked.supportCoverage, linked.course]);

  // Read penalty state from LabsScreen's global storage
  const [globalNoLabsState, setGlobalNoLabsState] = useState(getGlobalNoLabs());
  const [noLabsSystemsState, setNoLabsSystemsState] = useState(getNoLabsSystems());
  const [forceNoLabs, setForceNoLabs] = useState<boolean>(getGlobalNoLabs());
  const globalNoLabs = forceNoLabs || globalNoLabsState;
  const noLabsSystems = noLabsSystemsState;

  // Toggle forceNoLabs
  const toggleForceNoLabs = () => {
    const next = !forceNoLabs;
    setForceNoLabs(next);
    setGlobalNoLabsState(next);
    if (next) setNoLabsSystemsState([]);
    notifyDataChange();
  };

  // Listen for labs screen changes
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalNoLabsState(getGlobalNoLabs());
      setNoLabsSystemsState(getNoLabsSystems());
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  const hasLabs = linked.labs && linked.labs.length > 0;

  // Listen for changes from LabsScreen
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Determine if penalty should be applied
  const shouldApplyPenalty = globalNoLabs || noLabsSystems.length > 0;

  // Compute pharma risk
  const pharmaRisk = useMemo<RiskResult | null>(() => {
    if (!linked.profile) return null;
    const genetics = linked.profile.settings.genetics ?? {};
    return calculateRisks({
      genetics,
      nutritionFactor: linked.profile.settings.nutritionFactor ?? 0.8,
      trainingFactor: linked.profile.settings.trainingFactor ?? 0.7,
      activeDrugs: linked.activeDrugs,
      supportCoverage: linked.supportCoverage,
    });
  }, [linked.profile, linked.activeDrugs, linked.supportCoverage]);

  // Compute lab risk contributions
  const labRiskContributions = useMemo(() => {
    if (!hasLabs) return null;
    const labData = linked.labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    return calculateRiskFromAnalyses(labData);
  }, [hasLabs, linked.labs]);

  // Training risk (from workouts per week)
  const trainingRisk = useMemo(() => {
    const workoutsPerWeek = linked.profile?.settings?.workoutsPerWeek ?? 3;
    const avgWorkoutMinutes = linked.profile?.settings?.avgWorkoutMinutes ?? 60;
    const trainingLoadRatio = Math.min(1.5, (workoutsPerWeek * avgWorkoutMinutes) / 420);
    const risk = Math.min(100, trainingLoadRatio * 25);
    const systemBreakdown: Record<string, { raw: number; net: number }> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const sysRisk = ['cardio', 'musculoskeletal', 'neuro'].includes(sys) ? risk * 1.2 :
                      ['endocrine', 'metabolic'].includes(sys) ? risk * 0.8 : risk * 0.5;
      systemBreakdown[sys] = { raw: sysRisk, net: sysRisk * 0.7 };
    }
    return { overallRaw: risk, overallNet: risk * 0.7, systemBreakdown };
  }, [linked.profile]);

  // Nutrition risk (from nutrition factor)
  const nutritionRisk = useMemo(() => {
    const nutritionFactor = linked.profile?.settings?.nutritionFactor ?? 0.8;
    const risk = Math.min(100, (1 - nutritionFactor) * 30);
    const systemBreakdown: Record<string, { raw: number; net: number }> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const sysRisk = ['hepatic', 'metabolic', 'endocrine', 'ins_axis'].includes(sys) ? risk * 1.3 : risk * 0.6;
      systemBreakdown[sys] = { raw: sysRisk, net: sysRisk * 0.8 };
    }
    return { overallRaw: risk, overallNet: risk * 0.8, systemBreakdown };
  }, [linked.profile]);

  // Aggregated risk (pharma + labs + training + nutrition + diagnostics)
  const aggregatedRisk = useMemo<AggregatedRisk | null>(() => {
    if (!pharmaRisk) return null;
    const emptyDiag = { overallRaw: 0, overallNet: 0, systemBreakdown: {} as Record<string, { raw: number; net: number }> };

    // Build lab contribution: real labs if available, else synthetic from penalty
    let labContribForAgg: { systemContributions: Record<string, number>; totalRisk: number };
    if (hasLabs) {
      labContribForAgg = labRiskContributions || { systemContributions: Object.fromEntries(ALL_RISK_SYSTEMS.map(s => [s, 0])), totalRisk: 0 };
    } else if (shouldApplyPenalty) {
      const phase = linked.profile?.settings?.phase || 'baseline';
      const pen = calculatePenaltyCoefficients(phase, [], [], 1, linked.course, globalNoLabs);
      const totalMultiplier = 1.0 + pen.labPenalty + pen.diagnosticPenalty;
      const penaltyPct = Math.min(100, (totalMultiplier - 1) * 100);
      const penaltyContrib = Object.fromEntries(ALL_RISK_SYSTEMS.map(s => [s, penaltyPct * 0.5]));
      labContribForAgg = { systemContributions: penaltyContrib, totalRisk: penaltyPct };
    } else {
      labContribForAgg = { systemContributions: Object.fromEntries(ALL_RISK_SYSTEMS.map(s => [s, 0])), totalRisk: 0 };
    }

    return calculateAggregatedRisks(pharmaRisk, labContribForAgg, trainingRisk, nutritionRisk, emptyDiag);
  }, [pharmaRisk, labRiskContributions, trainingRisk, nutritionRisk, shouldApplyPenalty, hasLabs, linked.profile, linked.course, globalNoLabs]);

  // Merge a risk source (training/nutrition) into a RiskResult
  const mergeRiskSource = (base: RiskResult, source: { systemBreakdown?: Record<string, { raw: number; net: number }>; overallRaw?: number; overallNet?: number }): RiskResult => {
    if (!source.systemBreakdown) return base;
    const newBreakdown: Record<string, { raw: number; net: number }> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const baseVal = base.systemBreakdown[sys] || { raw: 0, net: 0 };
      const srcVal = source.systemBreakdown[sys] || { raw: 0, net: 0 };
      newBreakdown[sys] = {
        raw: Math.min(100, baseVal.raw + srcVal.raw),
        net: Math.min(100, Math.max(0, baseVal.net + srcVal.net - (baseVal.net * srcVal.net / 100))),
      };
    }
    const rawValues = ALL_RISK_SYSTEMS.map(sys => newBreakdown[sys].raw);
    const netValues = ALL_RISK_SYSTEMS.map(sys => newBreakdown[sys].net);
    const geom = (arr: number[]) => {
      if (!arr.length) return 0;
      const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
      return Math.exp(l / arr.length);
    };
    return {
      ...base,
      systemBreakdown: newBreakdown,
      overallRaw: Math.min(100, Math.max(0, geom(rawValues))),
      overallNet: Math.min(100, Math.max(0, geom(netValues))),
    };
  };

  // Merge pharma + labs + training + nutrition + penalty
  const riskResult = useMemo<RiskResult | null>(() => {
    if (!pharmaRisk) return null;
    let result = pharmaRisk;
    if (hasLabs) {
      result = calculateRiskFromAnalyses(result, linked.labs);
    }
    // Merge training risk
    result = mergeRiskSource(result, trainingRisk);
    // Merge nutrition risk
    result = mergeRiskSource(result, nutritionRisk);
    if (shouldApplyPenalty) {
      result = applyPenaltyToResult(result);
    }
    return result;
  }, [pharmaRisk, hasLabs, shouldApplyPenalty, noLabsSystems, trainingRisk, nutritionRisk]);

  // Build synthetic lab risk contribution from penalty when no labs exist
  const syntheticLabContrib = useMemo(() => {
    if (hasLabs) return null;
    if (!shouldApplyPenalty) return null;
    const phase = linked.profile?.settings?.phase || 'baseline';
    const pen = calculatePenaltyCoefficients(phase, linked.labs || [], [], 1, linked.course, globalNoLabs);
    const totalMultiplier = 1.0 + pen.labPenalty + pen.diagnosticPenalty;
    const penaltyPct = Math.min(100, (totalMultiplier - 1) * 100);
    const penalties = Object.fromEntries(
      ALL_RISK_SYSTEMS.map(s => [s, penaltyPct])
    );
    return { systemContributions: penalties, totalRisk: penaltyPct };
  }, [hasLabs, shouldApplyPenalty, linked.profile, linked.labs, linked.course, globalNoLabs]);

  useEffect(() => {
    if (riskResult) {
      saveRiskHistory({ date: new Date().toISOString().split('T')[0], overallRaw: riskResult.overallRaw, overallNet: riskResult.overallNet });
    }
  }, [riskResult?.overallRaw, riskResult?.overallNet]);

  function applyPenaltyToResult(result: RiskResult): RiskResult {
    const phase = linked.profile?.settings?.phase || 'baseline';
    const penalty = calculatePenaltyCoefficients(phase, linked.labs || [], [], 1, linked.course, globalNoLabs);
    const totalMultiplier = 1.0 + penalty.labPenalty + penalty.diagnosticPenalty;

    const finalResult: RiskResult = { ...result, systemBreakdown: { ...result.systemBreakdown } };

    if (finalResult.systemBreakdown) {
      for (const sys of ALL_RISK_SYSTEMS) {
        const sb = finalResult.systemBreakdown[sys];
        if (sb) {
          // If per-system penalty, only apply to selected systems
          const sysMultiplier = (noLabsSystems.includes(sys) || globalNoLabs) ? totalMultiplier : 1.0;
          finalResult.systemBreakdown[sys] = {
            raw: Math.min(100, sb.raw * sysMultiplier),
            net: Math.min(100, sb.net * sysMultiplier),
          };
        }
      }
    }

    finalResult.overallRaw = Math.min(100, result.overallRaw * totalMultiplier);
    finalResult.overallNet = Math.min(100, result.overallNet * totalMultiplier);
    return finalResult;
  }

  const riskHistory = useMemo(() => loadRiskHistory(), []);

  const renderContent = () => {
    if (!riskResult) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка...</div>;
    const effectiveLabContrib = labRiskContributions || syntheticLabContrib;
    const isSyntheticLab = !hasLabs && shouldApplyPenalty; // lab contrib came from penalty, not real labs
    switch (tab) {
      case 'overview': return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={effectiveLabContrib} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} weeklyDynamics={weeklyDynamics} />;
      case 'mechanisms': return <RiskDetails riskResult={riskResult} labRiskContributions={effectiveLabContrib} isSyntheticLab={isSyntheticLab} />;
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'model': return v7Result ? <Risk3DModel result={v7Result} mcEnabled={mcEnabled} onToggleMC={toggleMC} organWeek={organWeek} onWeekChange={setOrganWeek} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'dynamics': return <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} />;
      case 'info': return <RiskInfo />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  return (
    <div className="screen risk">
      <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(16, 4.5vw, 18)' }}>⚠️ Риски</h2>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {(['overview', 'dynamics', 'mechanisms', 'v7', 'model', 'info'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: '0 0 auto', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: tab === t ? 700 : 400,
            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
            background: tab === t ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            color: tab === t ? '#00e68a' : 'var(--text-dim)',
            border: tab === t ? '1px solid #00e68a' : '1px solid var(--border)',
            boxShadow: tab === t ? '0 1px 6px rgba(0,230,138,0.15)' : 'none',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
