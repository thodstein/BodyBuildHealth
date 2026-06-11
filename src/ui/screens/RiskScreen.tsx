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
  mdss: '🧬 MDSS',
  info: 'ℹ️ Инфо',
};

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'dynamics' | 'mechanisms' | 'v7' | 'model' | 'info' | 'mdss'>('overview');
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
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} organWeek={organWeek} onWeekChange={setOrganWeek} mcEnabled={mcEnabled} onToggleMC={toggleMC} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'model': return v7Result ? <Risk3DModel result={v7Result} mcEnabled={mcEnabled} onToggleMC={toggleMC} organWeek={organWeek} onWeekChange={setOrganWeek} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'dynamics': return <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} />;
      case 'info': return <RiskInfo />;
      case 'mdss': return <MDSSRiskDisplay />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  return (
    <div className="screen risk">
      <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(16, 4.5vw, 18)' }}>⚠️ Риски</h2>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {(['overview', 'dynamics', 'mechanisms', 'v7', 'model', 'mdss', 'info'] as const).map(t => (
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
  const [tWeeks, setTWeeks] = useState(Math.max(0, (linked.course || []).reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 12)));
  const [genetics, setGenetics] = useState<string[]>([]);
  const [mdssResult, setMdssResult] = useState<MDSSOutput | null>(null);

  const handleRun = () => {
    const s = linked.profile?.settings;
    const labs = linked.labs || [];
    const markers: BiomarkerInput[] = [];
    // Map common lab markers to MDSS biomarkers
    const LAB_MAP: Record<string, { name: string; ec50: number; inverted?: boolean }> = {
      'ALT': { name: 'ALT', ec50: 50 },
      'AST': { name: 'AST', ec50: 45 },
      'GGT': { name: 'GGT', ec50: 60 },
      'Creatinine': { name: 'Creatinine', ec50: 120 },
      'Cystatin_C': { name: 'Cystatin_C', ec50: 1.2 },
      'SHBG': { name: 'SHBG', ec50: 30, inverted: true },
      'LH': { name: 'LH', ec50: 5 },
      'FSH': { name: 'FSH', ec50: 5 },
      'PRL': { name: 'Prolactin', ec50: 20 },
      'PSA': { name: 'PSA', ec50: 3 },
      'TT': { name: 'DHT', ec50: 600 },
      'NT-proBNP': { name: 'NT-proBNP', ec50: 125 },
      'TSH': { name: 'Cortisol_night', ec50: 500 },
      'HDL': { name: 'oxLDL', ec50: 60 },
      'hsCRP': { name: 'hs-CRP', ec50: 3 },
      'KIM1': { name: 'KIM-1', ec50: 2 },
      'UACR': { name: 'UACR', ec50: 30 },
    };
    for (const lab of labs) {
      const map = LAB_MAP[lab.code] || LAB_MAP[lab.name];
      if (map) {
        markers.push({ name: map.name, value: lab.value, ec50: map.ec50, isInverted: map.inverted });
      }
    }
    if (markers.length === 0) {
      // Demo markers
      markers.push(
        { name: 'ALT', value: 45, ec50: 50 },
        { name: 'AST', value: 38, ec50: 45 },
        { name: 'Creatinine', value: 95, ec50: 120 },
        { name: 'PSA', value: 1.2, ec50: 3 },
        { name: 'LH', value: 2.1, ec50: 5 },
      );
    }
    const result = runMDSS({ tWeeks, genetics, markers });
    setMdssResult(result);
  };

  const ZONE_COLORS: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>🔬 MDSS — Medical Decision Support System</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          Hill → Monte Carlo (10K) → Logistic Sigmoid. Прогноз необратимого отказа органов.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недель экспозиции</label>
            <input type="number" min={0} max={100} value={tWeeks} onChange={e => setTWeeks(+e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Генетика (через запятую)</label>
            <input type="text" value={genetics.join(', ')} onChange={e => setGenetics(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="APOL1_mutation, COMT_slow..."
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={handleRun} style={{
          width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: 14,
        }}>▶ Запустить MDSS анализ</button>
      </div>

      {mdssResult && (
        <>
          <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Максимальный риск</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: ZONE_COLORS[mdssResult.overallAlertLevel] }}>
              {mdssResult.overallMaxRisk}%
            </div>
          </div>

          {Object.entries(mdssResult.organSystemsReport).map(([key, r]) => (
            <div key={key} className="card" style={{
              marginBottom: 8, borderLeft: `4px solid ${ZONE_COLORS[r.alertLevel]}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{r.organName}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${ZONE_COLORS[r.alertLevel]}22`, color: ZONE_COLORS[r.alertLevel], fontWeight: 600 }}>
                  {Math.round(r.riskPercentage)}% — {r.status.split('(')[0].trim()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                <div>Hill: {r.hillScore.toFixed(2)}</div>
                <div>MC P95: {r.severity95.toFixed(2)}</div>
                <div>Z_total: {r.zTotal.toFixed(1)}</div>
                <div>Gen: ×{r.geneticFactor.toFixed(1)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, r.riskPercentage)}%`, height: '100%', background: ZONE_COLORS[r.alertLevel], borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
                Маркеры: {r.markersUsed.join(', ')}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
