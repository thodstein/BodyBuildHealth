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
import { RiskMatrix } from './RiskScreen_parts/RiskMatrix';
import { RiskDetails } from './RiskScreen_parts/RiskDetails';
import { V7RiskDisplay } from './RiskScreen_parts/V7RiskDisplay';
import { WeeklyRiskChart } from './RiskScreen_parts/WeeklyRiskChart';
import { RiskInfo } from './RiskScreen_parts/RiskInfo';
import { calculateWeeklyRiskDynamics, type WeeklyRiskDynamics } from '../../engines/weekly-risk-dynamics.engine';
import { useV7Risk } from '../hooks/useV7Risk';

const RISK_HISTORY_KEY = 'risk_history';
const MAX_HISTORY = 12;

function loadRiskHistory(): { date: string; overallRaw: number; overallNet: number }[] {
  try { const raw = localStorage.getItem(RISK_HISTORY_KEY); if (!raw) return []; return JSON.parse(raw); } catch { return []; }
}

function saveRiskHistory(entry: { date: string; overallRaw: number; overallNet: number }) {
  try { const history = loadRiskHistory(); history.push(entry); localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
}

const TAB_LABELS: Record<string, string> = {
  overview: '?? Обзор',
  dynamics: '?? Динамика',
  matrix: '?? Матрица',
  details: '?? Детали',
  v7: '? Расчёт V7',
  info: '?? Инфо',
};

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'dynamics' | 'matrix' | 'details' | 'v7' | 'info'>('overview');
  const [tick, setTick] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekMode, setWeekMode] = useState<'week' | 'average'>('average');
  const { v7Result, legacyResult: v7Legacy } = useV7Risk();

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
    const interval = setInterval(() => setTick(t => t + 1), 1000);
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
    if (!pharmaRisk || !labRiskContributions) return null;
    const emptyLabContrib = { systemContributions: Object.fromEntries(ALL_RISK_SYSTEMS.map(s => [s, 0])), totalRisk: 0 };
    const emptyDiag = { overallRaw: 0, overallNet: 0, systemBreakdown: {} as Record<string, { raw: number; net: number }> };
    return calculateAggregatedRisks(
      pharmaRisk,
      labRiskContributions || emptyLabContrib,
      trainingRisk,
      nutritionRisk,
      emptyDiag
    );
  }, [pharmaRisk, labRiskContributions, trainingRisk, nutritionRisk]);

  // Merge pharma + lab + penalty
  const riskResult = useMemo<RiskResult | null>(() => {
    if (!pharmaRisk) return null;
    let result = pharmaRisk;
    if (hasLabs) {
      result = calculateRiskFromAnalyses(result, linked.labs);
    }
    if (shouldApplyPenalty) {
      result = applyPenaltyToResult(result);
    }
    return result;
  }, [pharmaRisk, hasLabs, labRiskContributions, shouldApplyPenalty, tick, noLabsSystems]);

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
    switch (tab) {
      case 'overview': return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
      case 'matrix': return <RiskMatrix riskResult={riskResult} />;
      case 'details': return <RiskDetails riskResult={riskResult} labRiskContributions={labRiskContributions} />;
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'dynamics': return <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} />;
      case 'info': return <RiskInfo />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  return (
    <div className="screen risk">
      <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(16, 4.5vw, 18)' }}>?? Риски</h2>
      <div className="tab-bar" style={{ gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {(['overview', 'dynamics', 'matrix', 'details', 'v7', 'info'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
