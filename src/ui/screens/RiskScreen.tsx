import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, SUBSYSTEM_MAP, SUBSYSTEM_PARENT, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell, LabPoint, CourseEntry } from '../../core/types';
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
import { runMDSS, type MDSSInput, type MDSSOutput, type BiomarkerInput } from '../../engines/mdss-engine';
import { Risk3DModel } from './RiskScreen_parts/Risk3DModel';
import { calculateWeeklyRiskDynamics, type WeeklyRiskDynamics } from '../../engines/weekly-risk-dynamics.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { getProfile, updateProfile } from '../../core/profile-manager';
import { analyzeWithCompliance, type ComplianceReport, getComplianceStatus } from '../../engines/compliance-engine';
import { validateDiagnostics, getDiagnosticSummary } from '../../engines/diagnostics.engine';

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
  v7: '🧬 V7',
  model: '🧮 Модель',
  mdss: '🏥 MDSS',
  compliance: '✅ Комплаенс',
  clinical: '🩺 Клиника',
  info: 'ℹ️ Инфо',
};

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const labAnalysis = linked.labAnalysis;
  const readinessData = linked.readiness;
  const [tab, setTab] = useState<'overview' | 'dynamics' | 'mechanisms' | 'v7' | 'model' | 'info' | 'mdss' | 'compliance' | 'clinical'>('overview');
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

  // Lab analysis risk — from lab-analysis.engine (HOMA-IR, liver, cardio, etc.)
  const labAnalysisRisk = useMemo(() => {
    if (!labAnalysis) return null;
    const breakdown: Record<string, { raw: number; net: number }> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      let r = 0;
      if (sys === 'hepatic') r = labAnalysis.liverStress;
      else if (sys === 'cardio') r = labAnalysis.cardioRisk;
      else if (sys === 'renal') r = labAnalysis.kidneyStress;
      else if (sys === 'endocrine') r = labAnalysis.hormoneScore;
      else if (sys === 'hematologic') r = labAnalysis.inflammation * 5;
      else r = (labAnalysis.liverStress + labAnalysis.cardioRisk + labAnalysis.kidneyStress + labAnalysis.hormoneScore) / 8;
      breakdown[sys] = { raw: Math.min(100, r), net: Math.min(100, r * 0.7) };
    }
    const overall = Math.min(100, (labAnalysis.liverStress + labAnalysis.cardioRisk + labAnalysis.kidneyStress + labAnalysis.hormoneScore + labAnalysis.inflammation * 5) / 5);
    return { overallRaw: overall, overallNet: overall * 0.7, systemBreakdown: breakdown };
  }, [labAnalysis]);

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
    if (labAnalysisRisk) {
      result = mergeRiskSource(result, labAnalysisRisk);
    }
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
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} organWeek={organWeek} onWeekChange={setOrganWeek} mcEnabled={mcEnabled} onToggleMC={toggleMC} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'model': return v7Result ? <Risk3DModel result={v7Result} mcEnabled={mcEnabled} onToggleMC={toggleMC} organWeek={organWeek} onWeekChange={setOrganWeek} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'dynamics': return <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} />;
      case 'info': return <RiskInfo />;
      case 'mdss': return <MDSSRiskDisplay />;
      case 'compliance': return <ComplianceDisplay />;
      case 'clinical': return <ClinicalRiskDisplay />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  return (
    <div className="screen risk">
      <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(16, 4.5vw, 18)' }}>⚠️ Риски</h2>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {(['overview', 'dynamics', 'mechanisms', 'v7', 'model', 'mdss', 'compliance', 'clinical', 'info'] as const).map(t => (
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

// ── MDSS Risk Display Component ──
const MDSSRiskDisplay: React.FC = () => {
  const linked = useDataLink();
  const [tWeeks, setTWeeks] = useState(Math.max(1, (linked.course || []).reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 4)));
  const [genetics, setGenetics] = useState<string[]>([]);
  const [mdssResult, setMdssResult] = useState<MDSSOutput | null>(null);
  const [autoRun, setAutoRun] = useState(false);

  // Auto-fill genetics from profile
  useEffect(() => {
    const s = linked.profile?.settings;
    const genMap = Object.keys(s?.genetics || {}).filter(k => !!(s?.genetics as any)?.[k]);
    if (genMap.length > 0) setGenetics(genMap);
  }, []);

  // Compute weeksSinceLab from linked dates
  const weeksSinceLab = (() => {
    const labs = linked.labs || [];
    if (!labs.length) return 52;
    const dates = labs.map(l => l.date).filter(Boolean).sort().reverse();
    if (!dates[0]) return 52;
    const ms = Date.now() - new Date(dates[0]).getTime();
    return Math.max(0, ms / (7 * 24 * 3600 * 1000));
  })();

  // Auto-run on mount
  useEffect(() => {
    if (!autoRun) return;
    handleRun();
  }, [autoRun, tWeeks, genetics, weeksSinceLab]);

  const handleRun = () => {
    const labs = linked.labs || [];
    const markers: BiomarkerInput[] = [];
    const LAB_MAP: Record<string, { name: string; ec50: number; inverted?: boolean }> = {
      'ALT': { name: 'ALT', ec50: 50 }, 'AST': { name: 'AST', ec50: 45 },
      'GGT': { name: 'GGT', ec50: 60 }, 'Creatinine': { name: 'Creatinine', ec50: 120 },
      'Cystatin_C': { name: 'Cystatin_C', ec50: 1.2 },
      'SHBG': { name: 'SHBG', ec50: 30, inverted: true },
      'LH': { name: 'LH', ec50: 5 }, 'FSH': { name: 'FSH', ec50: 5 },
      'PRL': { name: 'Prolactin', ec50: 20 }, 'PSA': { name: 'PSA', ec50: 3 },
      'TT': { name: 'DHT', ec50: 600 }, 'NT-proBNP': { name: 'NT-proBNP', ec50: 125 },
      'TSH': { name: 'Cortisol_night', ec50: 500 }, 'HDL': { name: 'oxLDL', ec50: 60 },
      'hsCRP': { name: 'hs-CRP', ec50: 3 }, 'KIM1': { name: 'KIM-1', ec50: 2 },
      'UACR': { name: 'UACR', ec50: 30 },
    };
    for (const lab of labs) {
      const map = LAB_MAP[lab.code] || LAB_MAP[lab.name];
      if (map) markers.push({ name: map.name, value: lab.value, ec50: map.ec50, isInverted: map.inverted });
    }
    // Без анализов — используем консервативные оценки по системам
    if (markers.length === 0) {
      markers.push(
        { name: 'ALT', value: 30, ec50: 50 },
        { name: 'AST', value: 25, ec50: 45 },
        { name: 'Creatinine', value: 80, ec50: 120 },
        { name: 'PSA', value: 1.0, ec50: 3 },
        { name: 'LH', value: 3.0, ec50: 5 },
        { name: 'Cortisol_night', value: 50, ec50: 500 },
        { name: 'hs-CRP', value: 1.5, ec50: 3 },
      );
    }
    setMdssResult(runMDSS({ tWeeks, weeksSinceLab, genetics, markers }));
  };

  const ZONE_COLORS: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🧬 MDSS — Medical Decision Support System</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 4px 0' }}>
          Hill → Monte Carlo (10K) → Logistic Sigmoid. Прогноз необратимого отказа органов.
        </p>
        <p style={{ fontSize: 10, color: 'var(--accent)', margin: 0 }}>
          ⚡ Работает в браузере (TypeScript). Python-сервер не требуется.
        </p>
      </div>

      {!autoRun ? (
        <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            Нажмите кнопку для запуска анализа. Можно без ввода данных — использует консервативные значения.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => { setAutoRun(true); setTimeout(handleRun, 50); }} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: 14,
            }}>▶ Запустить анализ</button>
            <button onClick={() => { setAutoRun(false); handleRun(); }} style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer',
              background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 14,
            }}>Запустить один раз</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недель экспозиции</label>
              <input type="number" min={0} max={100} value={tWeeks} onChange={e => { setTWeeks(+e.target.value); }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Генетика (через запятую)</label>
              <input type="text" value={genetics.join(', ')} onChange={e => setGenetics(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="APOL1_mutation, COMT_slow..."
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={handleRun} style={{
              flex: 1, padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 600, fontSize: 12,
            }}>🔄 Пересчитать</button>
            <button onClick={() => setAutoRun(false)} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-dim)', fontSize: 12,
            }}>Выкл авто</button>
          </div>
          {linked.labs?.length === 0 && (
            <div style={{ fontSize: 9, color: '#ff9100', marginTop: 4 }}>⚠ Без анализов — консервативные оценки. Введите данные для точного прогноза.</div>
          )}
          {linked.labs?.length > 0 && (
            <div style={{ fontSize: 9, color: '#22c55e', marginTop: 4 }}>✅ Использовано {linked.labs.length} анализов из вашего профиля</div>
          )}
        </div>
      )}

      {mdssResult && (
        <>
          {/* Compliance penalty banner */}
          {mdssResult.compliancePenalty > 1 && (
            <div className="card" style={{
              marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
              borderLeft: '3px solid #ef4444',
            }}>
              <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>
                ⚠ Штраф за просрочку анализов: ×{mdssResult.compliancePenalty}
                ({mdssResult.weeksSinceLastLab} нед без анализов)
              </div>
            </div>
          )}

          {/* Overall risk */}
          <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              Максимальный риск по всем 14 системам
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: ZONE_COLORS[mdssResult.overallAlertLevel] }}>
              {mdssResult.overallMaxRisk}%
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
              {mdssResult.allMarkersUsed.length} биомаркеров · {Object.keys(mdssResult.organSystemsReport).length} систем
            </div>
          </div>

          {/* Sorted organs */}
          {mdssResult.sortedOrgans.map(r => (
            <div key={r.organKey} className="card" style={{
              marginBottom: 8, borderLeft: `4px solid ${ZONE_COLORS[r.alertLevel]}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{r.organName}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${ZONE_COLORS[r.alertLevel]}22`, color: ZONE_COLORS[r.alertLevel], fontWeight: 600 }}>
                  {Math.round(r.riskPercentage)}% — {r.status.split('(')[0].trim()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                <div>Hill: {r.hillScore}</div>
                <div>MC P95: {r.severity95}</div>
                <div>Z: {r.zTotal}</div>
                <div>Gen: ×{r.geneticFactor}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, r.riskPercentage)}%`, height: '100%', background: ZONE_COLORS[r.alertLevel], borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
                Маркеры ({r.markersUsed.length}): {r.markersUsed.join(', ')}
              </div>
            </div>
          ))}

          {/* Missing markers */}
          {mdssResult.markersNotFound.length > 0 && (
            <div className="card" style={{
              marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
                🧪 Не сдано ({mdssResult.markersNotFound.length}): сдайте эти маркеры для точного прогноза
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {mdssResult.markersNotFound.map(m => (
                  <span key={m} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontSize: 9 }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Compliance Display Component ──
const ComplianceDisplay: React.FC = () => {
  const linked = useDataLink();
  const profile = linked.profile;
  const s = profile?.settings;
  const labs = linked.labs || [];
  const course = linked.course || [];

  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  // Dates — recompute when labs/course change
  const today = new Date().toISOString().slice(0, 10);

  const latestLabDate = useMemo(() => {
    if (labs.length === 0) {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().slice(0, 10);
    }
    const dates = labs.map(l => l.date || '').filter(Boolean).sort().reverse();
    return dates[0] || today;
  }, [labs]);

  const courseStartDate = useMemo(() => {
    if (course.length > 0) {
      const starts = course.map(c => c.startWeek || 0);
      const minStart = Math.min(...starts);
      if (minStart <= 0 && course.length === 1 && course[0].startWeek === 0) {
        // Course just started — use today minus a few days
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d.toISOString().slice(0, 10);
      }
      const d = new Date();
      d.setDate(d.getDate() - 7 * Math.max(1, minStart));
      return d.toISOString().slice(0, 10);
    }
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  }, [course]);

  const [cycleStart, setCycleStart] = useState('');
  const [lastLab, setLastLab] = useState('');
  const [kAgg, setKAgg] = useState(0.4);
  const [zCrit, setZCrit] = useState(12.0);

  // Sync state with memoized values
  useEffect(() => { setCycleStart(courseStartDate); }, [courseStartDate]);
  useEffect(() => { setLastLab(latestLabDate); }, [latestLabDate]);

  const genetics = useMemo(() => {
    const g = (s?.genetics as Record<string, boolean | string>) || {};
    return Object.keys(g).filter(k => !!g[k]);
  }, [s]);

  const markers = useMemo(() => {
    if (!labs.length) return [];
    return labs.map(l => ({
      name: l.code || l.name || '',
      value: l.value || 0,
      ec50: l.code === 'ALT' ? 50 : l.code === 'AST' ? 45 : l.code === 'GGT' ? 60
        : l.code === 'Creatinine' ? 120 : l.code === 'Cystatin_C' ? 1.2
        : l.code === 'PSA' ? 4 : l.code === 'Hematocrit' ? 52
        : l.code === 'HDL' ? 1.0 : l.code === 'LDL' ? 4.0
        : l.code === 'Glucose' ? 6.0 : l.code === 'LH' ? 5 : 3,
      isInverted: l.code === 'SHBG' || l.code === 'HDL' || l.code === 'eGFR' || l.code === 'Testosterone_Total',
    }));
  }, [labs]);

  // Run analysis when dates are ready
  useEffect(() => {
    if (!cycleStart || !lastLab) return;
    runAnalysis();
  }, [cycleStart, lastLab, markers.length, kAgg, zCrit]);

  const runAnalysis = () => {
    if (!cycleStart || !lastLab) return;
    const result = analyzeWithCompliance({
      cycleStartDate: cycleStart,
      latestLabDate: lastLab,
      currentDate: today,
      genetics,
      markers,
      kAggressionOverride: kAgg,
      zCritOverride: zCrit,
    });
    setReport(result);
  };

  const msPerWeek = 7 * 24 * 3600 * 1000;
  const weeksSinceLab = Math.max(0, (new Date(today).getTime() - new Date(lastLab).getTime()) / msPerWeek);
  const compliance = getComplianceStatus(weeksSinceLab);

  const complianceColors: Record<string, string> = {
    compliant: '#00e68a',
    overdue: '#f97316',
    critical: '#ef4444',
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🕒 Комплаенс — Data Decay & Uncertainty Engine</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          Отслеживание дисциплины сдачи анализов. Data Decay — штрафной коэффициент за устаревшие данные.
          <br />
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>
            ⚡ Работает в браузере. Сервер не нужен.
          </span>
        </p>
      </div>

      {/* Input card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дата начала курса</label>
            <input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Последние анализы</label>
            <input type="date" value={lastLab} onChange={e => setLastLab(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>k_aggression</label>
            <input type="number" value={kAgg} step={0.1} min={0.1} max={2} onChange={e => setKAgg(+e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Z_crit</label>
            <input type="number" value={zCrit} step={1} min={1} max={50} onChange={e => setZCrit(+e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={runAnalysis} style={{
          width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', fontWeight: 700, fontSize: 14,
        }}>▶ Анализ с комплаенс-контролем</button>

        <div style={{ display: 'flex', gap: 2, marginTop: 6, fontSize: 9, color: 'var(--text-dim)', justifyContent: 'space-between' }}>
          <span>Анализов: {labs.length}</span>
          <span>Генетика: {genetics.length > 0 ? genetics.join(',') : ''}</span>
          <span style={{ color: complianceColors[compliance], fontWeight: 600 }}>Статус: {compliance}</span>
        </div>
      </div>

      {/* Results */}
      {report && (
        <>
          {/* Compliance warning */}
          <div className="card" style={{
            marginBottom: 12, padding: '10px 14px',
            background: report.systemWarnings.complianceStatus === 'compliant'
              ? 'rgba(0,230,138,0.06)'
              : report.systemWarnings.complianceStatus === 'critical'
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(249,115,22,0.06)',
            borderLeft: `3px solid ${complianceColors[report.systemWarnings.complianceStatus]}`,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
              ⚠ Системные предупреждения
            </div>
            <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
              {report.systemWarnings.disclaimer}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: report.systemWarnings.complianceStatus === 'compliant' ? '#00e68a' : '#f97316',
            }}>
              {report.systemWarnings.penaltyStatus}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
              <span>{report.systemWarnings.weeksOnCycle} нед на курсе</span>
              <span>{report.systemWarnings.weeksSinceLastLab} нед с анализов</span>
            </div>
          </div>

          {/* Risk analysis card */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              📊 Анализ рисков с штрафом
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Штрафной коэфф.</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: report.riskAnalysis.penaltyMultiplierApplied > 1 ? '#ef4444' : '#00e68a' }}>
                  {report.riskAnalysis.penaltyMultiplierApplied}x
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вероятность отказа</div>
                <div style={{
                  fontSize: 24, fontWeight: 800,
                  color: report.riskAnalysis.probabilityPercent >= 80 ? '#ef4444'
                    : report.riskAnalysis.probabilityPercent >= 50 ? '#f97316'
                    : report.riskAnalysis.probabilityPercent >= 20 ? '#eab308'
                    : '#00e68a',
                }}>
                  {report.riskAnalysis.probabilityPercent}%
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>
              <div>Hill: {report.riskAnalysis.worstHillScore}</div>
              <div>Sev95: {report.riskAnalysis.severity95th}</div>
              <div>Z_raw: {report.riskAnalysis.zTotalRaw}</div>
              <div>Z_adj: {report.riskAnalysis.zTotalAdjusted}</div>
              <div>Генетика: {report.riskAnalysis.active19NorPenalty ? '19-nor штраф активен' : 'без доп. штрафа'}</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                {report.riskAnalysis.clinicalStatus}
              </div>
            </div>
          </div>

          {/* Per-organ breakdown */}
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-dim)' }}>⬇ Пер-орган с штрафом</div>
          {Object.entries(report.organDetails).map(([key, r]) => {
            const zoneColor = r.riskPercent >= 80 ? '#ef4444' : r.riskPercent >= 50 ? '#f97316' : r.riskPercent >= 20 ? '#eab308' : '#00e68a';
            return (
              <div key={key} className="card" style={{
                marginBottom: 6, borderLeft: `4px solid ${zoneColor}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{r.organName}</span>
                  <span style={{ padding: '2px 6px', borderRadius: 4, background: `${zoneColor}22`, color: zoneColor, fontSize: 10, fontWeight: 600 }}>
                    {r.riskPercent}% — {r.status}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${Math.min(100, r.riskPercent)}%`, height: '100%', background: zoneColor, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                  <span>Hill: {r.hillScore}</span>
                  <span>Z_adj: {r.zTotalAdjusted}</span>
                  <span>×{r.penaltyFactor} штраф</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {!report && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🕒</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {labs.length > 0
              ? 'Отчёт ещё не сформирован. Запустите расчёт или дождитесь обновления данных.'
              : 'Нет данных курса и анализов для клинического отчёта.'}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Clinical Risk Display ──
const ClinicalRiskDisplay: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const labs = linked.labs || [];
  const s = linked.profile?.settings;
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const [{ analyzeClinicalRisks }, { mapStackToPathologies }, { SYSTEM_GROUPS, CLINICAL_PATHOLOGIES }] = await Promise.all([
        import('../../engines/clinical-analyzer.engine'),
        import('../../engines/drug-mapper.engine'),
        import('../../data/clinical-pathology-db'),
      ]);

      const compounds = course.map(c => c.substanceId.toLowerCase());
      const markers = labs.map(l => ({ code: l.code || l.name, value: l.value }));
      const genetics = Object.keys(s?.genetics || {}).filter(k => !!(s?.genetics as any)?.[k]);
      const labDates = labs.map(l => l.date).filter(Boolean).sort().reverse();
      const weeksSinceLab = labDates[0] ? (Date.now() - new Date(labDates[0]).getTime()) / (7 * 24 * 3600 * 1000) : 52;
      const tWeeks = course.length > 0 ? course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0) : 4;

      // Run clinical analysis
      const clinical = analyzeClinicalRisks({ compounds, markers, tWeeks: Math.max(1, tWeeks), weeksSinceLab, genetics });

      // Also run drug mapper to capture ALL drug-based pathologies
      const mapperDrugs = course.map(c => ({ name: c.substanceId.toLowerCase(), dosageMg: c.doseValue }));
      const mapper = mapStackToPathologies(mapperDrugs);

      // Merge mapper pathologies into clinical results
      const existingIds = new Set(clinical.results.map((r: any) => r.pathologyId));
      const newResults = [...clinical.results];

      for (const mp of mapper.activePathologies) {
        if (!existingIds.has(mp.pathologyId)) {
          // Find matching clinical pathology or create one
          const cp = CLINICAL_PATHOLOGIES[mp.pathologyId];
          if (cp) {
            newResults.push({
              pathologyId: mp.pathologyId,
              pathologyName: cp.name,
              systemName: cp.systemName,
              systemIcon: cp.systemIcon,
              hillScore: 0,
              severity95: 0,
              riskPercent: Math.min(80, Math.round(mp.cumulativeTriggerStrength * 25 * 10) / 10),
              status: mp.cumulativeTriggerStrength >= 2 ? 'высокий риск' : mp.cumulativeTriggerStrength >= 1.2 ? 'умеренный риск' : 'низкий риск',
              alertLevel: mp.cumulativeTriggerStrength >= 2 ? 2 : mp.cumulativeTriggerStrength >= 1.2 ? 1 : 0,
              markersUsed: [],
              pharmaTriggers: mp.contributingDrugs,
              instrumental: cp.instrumentalVerification,
              contributingCompounds: mp.contributingDrugs,
            });
          }
        }
      }

      // Re-sort
      newResults.sort((a: any, b: any) => b.riskPercent - a.riskPercent);

      // Rebuild systems
      const systemMap = new Map<string, any[]>();
      for (const r of newResults) {
        const sysKey = SYSTEM_GROUPS.find(g => g.pathologyIds.includes(r.pathologyId))?.systemKey || 'other';
        if (!systemMap.has(sysKey)) systemMap.set(sysKey, []);
        systemMap.get(sysKey)!.push(r);
      }

      const systems = SYSTEM_GROUPS.map(g => ({
        systemKey: g.systemKey,
        systemName: g.systemName,
        icon: g.icon,
        maxRisk: Math.max(0, ...(systemMap.get(g.systemKey) || []).map((r: any) => r.riskPercent)),
        pathologies: systemMap.get(g.systemKey) || [],
      })).filter((s: any) => s.pathologies.length > 0);

      setResult({
        ...clinical,
        results: newResults,
        systems,
        overallMaxRisk: newResults.length > 0 ? newResults[0].riskPercent : 0,
        mapperPathologies: mapper.activePathologies.length,
      } as any);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { handleAnalyze(); }, []);

  const zoneColors: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🏥 Клинические патологии</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          28 патологий в 8 системах. Hill → MC (10K) → Sigmoid. Связь препарат→патология из клинической базы.
        </p>
      </div>

      {!result && (
        <button onClick={handleAnalyze} disabled={loading} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: loading ? 'wait' : 'pointer', background: loading ? 'var(--border)' : 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          {loading ? '⏳ Анализ...' : '▶ Запустить клинический анализ'}
        </button>
      )}

      {result && (
        <>
          <div className="card" style={{ marginBottom: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Максимальный риск</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: result.overallMaxRisk >= 80 ? '#ef4444' : result.overallMaxRisk >= 50 ? '#f97316' : '#22c55e' }}>
              {result.overallMaxRisk}%
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{result.markersAnalyzed} маркеров · {result.results.length} патологий</div>
          </div>
          <button onClick={handleAnalyze} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, marginBottom: 8 }}>
            🔄 Пересчитать
          </button>

          {result.systems.map((system: any) => (
            <details key={system.systemKey} style={{ marginBottom: 8 }}>
              <summary style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                {system.icon} {system.systemName}
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, fontSize: 10, background: system.maxRisk >= 80 ? 'rgba(239,68,68,0.12)' : system.maxRisk >= 50 ? 'rgba(249,115,22,0.12)' : 'rgba(0,230,138,0.08)', color: system.maxRisk >= 80 ? '#ef4444' : system.maxRisk >= 50 ? '#f97316' : '#00e68a', fontWeight: 600 }}>
                  {Math.round(system.maxRisk)}%
                </span>
              </summary>
              <div style={{ padding: '4px 0 0 4px' }}>
                {system.pathologies.map((r: any) => (
                  <div key={r.pathologyId} className="card" style={{ marginBottom: 4, borderLeft: `3px solid ${zoneColors[r.alertLevel]}`, padding: '6px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{r.pathologyName}</span>
                      <span style={{ padding: '1px 5px', borderRadius: 3, background: `${zoneColors[r.alertLevel]}18`, color: zoneColors[r.alertLevel], fontWeight: 600, fontSize: 9 }}>{r.riskPercent}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, fontSize: 8, color: 'var(--text-dim)' }}>
                      <div>Hill: {r.hillScore}</div><div>MC95: {r.severity95}</div><div>Маркеры: {r.markersUsed.length}</div>
                    </div>
                    {r.contributingCompounds.length > 0 && (
                      <div style={{ fontSize: 8, color: '#8b5cf6', marginTop: 2 }}>Препараты: {r.contributingCompounds.join(', ')}</div>
                    )}
                    {r.alertLevel >= 2 && <div style={{ fontSize: 8, color: '#f97316', marginTop: 2 }}>🔬 {r.instrumental}</div>}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </div>
  );
};
