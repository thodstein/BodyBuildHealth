import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, SUBSYSTEM_MAP, SUBSYSTEM_PARENT, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE, UCUM_MAP } from '../../core/constants';
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
const Risk3DModel = React.lazy(() => import('./RiskScreen_parts/Risk3DModel').then(m => ({ default: m.Risk3DModel })));
import { calculateWeeklyRiskDynamics, type WeeklyRiskDynamics } from '../../engines/weekly-risk-dynamics.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { getProfile, updateProfile } from '../../core/profile-manager';
import { analyzeWithCompliance, type ComplianceReport, getComplianceStatus } from '../../engines/compliance-engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { interpretLabs, computeHOMA_IR, type LabCompositeResult } from '../../engines/lab-analysis.engine';
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
  const [mainTab, setMainTab] = useState<'hero' | 'calculations' | 'clinical' | 'info'>('hero');
  const [subTab, setSubTab] = useState<'overview' | 'dynamics' | 'mechanisms' | 'v7' | 'model' | 'info' | 'mdss' | 'compliance' | 'clinical' | 'labs_risks'>('overview');
  const [calcPage, setCalcPage] = useState<'hero' | 'basic' | 'montecarlo' | 'mdss'>('hero');
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

  // MDSS result for summary card
  const mdssResult = useMemo(() => {
    try {
      const labs = linked.labs || [];
      const markers: BiomarkerInput[] = labs.slice(0, 20).map(l => ({
        code: l.code, name: l.name, value: l.value, unit: l.unit, date: l.date, ec50: 1.0,
      }));
      const course = linked.course || [];
      const weeks = course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 4);
      return runMDSS({
        markers,
        tWeeks: Math.max(1, weeks),
        weeksSinceLab: 12,
        genetics: Object.keys(linked.profile?.settings?.genetics || {}).filter(k => !!(linked.profile?.settings?.genetics as any)?.[k]).slice(0, 3),
      });
    } catch { return null; }
  }, [linked.labs, linked.course, linked.profile, linked.activeDrugs, linked.supportCoverage]);

  const riskHistory = useMemo(() => loadRiskHistory(), []);

  const renderContent = () => {
    if (!riskResult) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка...</div>;
    const effectiveLabContrib = labRiskContributions || syntheticLabContrib;
    const isSyntheticLab = !hasLabs && shouldApplyPenalty; // lab contrib came from penalty, not real labs
    switch (subTab) {
      case 'overview': return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={effectiveLabContrib} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} weeklyDynamics={weeklyDynamics} />;
      case 'mechanisms': return <RiskDetails riskResult={riskResult} labRiskContributions={effectiveLabContrib} isSyntheticLab={isSyntheticLab} />;
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} organWeek={organWeek} onWeekChange={setOrganWeek} mcEnabled={mcEnabled} onToggleMC={toggleMC} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>;
      case 'model': return <React.Suspense fallback={<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка 3D модели...</div>}>
        {v7Result ? <Risk3DModel result={v7Result} mcEnabled={mcEnabled} onToggleMC={toggleMC} organWeek={organWeek} onWeekChange={setOrganWeek} /> : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка V7...</div>}
      </React.Suspense>;
      case 'dynamics': return weeklyDynamics ? <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} /> : <div style={{ textAlign:'center', padding:40, color:'var(--text-dim)' }}>Нет данных для динамики</div>;
      case 'info': return <RiskInfo />;
      case 'mdss': return <MDSSRiskDisplay />;
      case 'compliance': return <ComplianceDisplay />;
      case 'clinical': return <ClinicalRiskDisplay />;
      case 'labs_risks': return <LabsRisksTab />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={labRiskContributions} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  const CALC_SUBTABS = ['overview','dynamics','mechanisms','v7','mdss'] as const;
  const CLINICAL_SUBTABS = ['model','compliance','clinical','labs_risks'] as const;

  const SUBTAB_LABELS: Record<string, string> = {
    overview: '📊 Обзор', dynamics: '📈 Динамика', mechanisms: '⚙️ Механизмы',
    v7: '🧬 Монте Карло', model: '🧮 3D Модель', mdss: '🏥 MDSS',
    compliance: '✅ Комплаенс', clinical: '🩺 Клиника', info: 'ℹ️ Инфо',
    labs_risks: '🩸 Анализы',
  };

  const mainTabLabel = mainTab === 'calculations' ? 'Комплексные расчеты' :
    mainTab === 'clinical' ? 'Клиника' : mainTab === 'info' ? 'Общая информация' : '';

  return (
    <div className="screen risk" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
      {/* ─── HERO PAGE ─── */}
      {mainTab === 'hero' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 70px' }}>
          {/* Hero image */}
          <div style={{ position: 'relative', margin: '-16px -16px 12px -16px' }}>
            <img src="/risk-hero.png" alt="" style={{
              width: '100%', height: 'auto', maxHeight: '55vh', display: 'block',
              objectFit: 'cover', objectPosition: 'center top',
            }} />
            <div style={{ position: 'absolute', bottom: 10, left: 16, right: 16 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>Оценка рисков</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.3, textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
                Комплексный анализ — расчёты, клинические модели и справочная информация
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'calculations', icon: '🧮', title: 'Комплексные расчеты', desc: 'Базовый расчёт, Монте Карло (V7), MDSS — все аналитические модели рисков.', color: '#22c55e' },
              { id: 'clinical', icon: '🏥', title: 'Клиника', desc: '3D модель, комплаенс, клинические риски и анализы.', color: '#3b82f6' },
              { id: 'info', icon: 'ℹ️', title: 'Общая информация', desc: 'Формулы, механизмы, пороги препаратов и справочные данные.', color: '#a855f7' },
              ].map(card => (
              <button key={card.id} onClick={() => { setMainTab(card.id as any); setSubTab(card.id === 'info' ? 'info' : 'overview'); }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                transition: 'all 0.2s',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: card.color + '18', fontSize: 20 }}>
                  {card.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>{card.desc}</div>
                </div>
                <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR ─── */}
      {mainTab !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setMainTab('hero')} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14, color: 'var(--text-dim)',
            border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
          }}>← Назад</button>
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT ─── */}
      {mainTab !== 'hero' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 70px' }}>

          {/* ───── COMPLEX CALCULATIONS SUB-HERO ───── */}
          {mainTab === 'calculations' && calcPage === 'hero' && (
            <div>
              {/* Summary card */}
              <div style={{ marginTop: 10, padding: 14, borderRadius: 16, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textAlign: 'center' }}>
                  📊 Средний риск курса
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { label: 'Базовый', icon: '📋', net: Math.round(riskResult?.overallNet ?? 0), raw: Math.round(riskResult?.overallRaw ?? 0), color: '#22c55e' },
                    { label: 'Монте-Карло', icon: '🎲', net: v7Result ? Math.round(v7Result.globalRiskNet) : null, raw: v7Result ? Math.round(v7Result.globalRiskRaw) : null, color: '#8b5cf6' },
                    { label: 'MDSS', icon: '🏥', net: mdssResult ? Math.round(mdssResult.overallMaxRisk) : null, raw: null, color: '#f97316' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      textAlign: 'center', padding: '10px 6px', borderRadius: 12,
                      background: item.color + '0d', border: `1px solid ${item.color}22`,
                    }}>
                      <div style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.icon} {item.label}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: item.net != null ? getRiskColor(item.net) : 'var(--text-dim)' }}>
                          {item.net != null ? `${item.net}%` : '—'}
                        </span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: item.raw != null ? getRiskColor(item.raw) : 'var(--text-dim)' }}>
                          {item.raw != null ? `${item.raw}%` : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>net · raw</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Nav cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[
                  { id: 'basic', icon: '📋', title: 'Базовый расчёт', desc: 'Обзор, динамика и механизмы рисков по системам организма.', color: '#22c55e', subs: 'Обзор • Динамика • Механизмы' },
                  { id: 'montecarlo', icon: '🎲', title: 'Монте Карло (V7)', desc: 'Органы, матрица рисков, временной ряд, чувствительность, фармакокинетика.', color: '#8b5cf6', subs: '5 подвкладок' },
                  { id: 'mdss', icon: '🏥', title: 'MDSS', desc: 'Medical Decision Support System — Hill+MC+Sigmoid модель прогнозирования.', color: '#f97316', subs: '' },
                ].map(card => (
                  <button key={card.id} onClick={() => {
                    setCalcPage(card.id as any);
                    if (card.id === 'basic') setSubTab('overview');
                    else if (card.id === 'montecarlo') setSubTab('v7');
                    else setSubTab('mdss');
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', transition: 'all 0.2s',
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: card.color + '18', fontSize: 22 }}>
                      {card.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>{card.desc}</div>
                      {card.subs && <div style={{ fontSize: 9, color: card.color, marginTop: 3, opacity: 0.7 }}>{card.subs}</div>}
                    </div>
                    <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ───── REGULAR SUB-TAB NAVIGATION ───── */}
          {(mainTab !== 'calculations' || calcPage !== 'hero') && (
            <>
              {/* Sub-tab pills + back button for calculations */}
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 4px', scrollbarWidth: 'none', alignItems: 'center' }}>
                {mainTab === 'calculations' && (
                  <button onClick={() => { setCalcPage('hero'); setSubTab('overview'); }} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', flexShrink: 0,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 600,
                  }}>← Назад</button>
                )}
                {(mainTab === 'calculations'
                  ? (calcPage === 'basic' ? ['overview','dynamics','mechanisms'] : calcPage === 'montecarlo' ? ['v7'] : ['mdss']) as readonly string[]
                  : mainTab === 'clinical' ? CLINICAL_SUBTABS as readonly string[]
                  : ['info'] as readonly string[]
                ).map(t => (
                  <button key={t} onClick={() => setSubTab(t as any)} style={{
                    padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                    whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                    background: subTab === t ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: subTab === t ? '#000' : 'var(--text-dim)',
                    border: `1px solid ${subTab === t ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                    {SUBTAB_LABELS[t] || t}
                  </button>
                ))}
              </div>
              {renderContent()}
            </>
          )}
        </div>
      )}
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
  const s = linked.profile?.settings;
  const labs = linked.labs || [];
  const course = linked.course || [];

  const [report, setReport] = useState<ComplianceReport | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Auto-computed dates from real data
  const latestLabDate = useMemo(() => {
    if (labs.length === 0) {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      return d.toISOString().slice(0, 10);
    }
    const dates = labs.map(l => l.date || '').filter(Boolean).sort().reverse();
    return dates[0] || today;
  }, [labs]);

  const courseStartDate = useMemo(() => {
    if (course.length > 0) {
      const starts = course.map(c => c.startWeek || 0);
      const minStart = Math.min(...starts);
      const d = new Date();
      d.setDate(d.getDate() - 7 * Math.max(1, minStart));
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(); d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  }, [course]);

  const [cycleStart] = useState(courseStartDate);
  const [lastLab] = useState(latestLabDate);

  // Sync auto-values
  useEffect(() => { /* dates auto-computed, no input needed */ }, []);

  const genetics = useMemo(() => {
    const g = (s?.genetics as Record<string, boolean | string>) || {};
    return Object.keys(g).filter(k => !!g[k]);
  }, [s]);

  // Required lab markers for compliance
  const REQUIRED_MARKERS = ['ALT','AST','GGT','HCT','HGB','TT','E2','LH','FSH','LDL','HDL','TG','GLU','INS','CRP','CREATININE'];

  const markers = useMemo(() => {
    if (!labs.length) return [];
    return labs.map(l => ({
      name: l.code || l.name || '',
      value: l.value || 0,
      ec50: l.code === 'ALT' ? 50 : l.code === 'AST' ? 45 : l.code === 'GGT' ? 60 : l.code === 'HCT' ? 52 : l.code === 'HGB' ? 170 : l.code === 'TT' ? 30 : l.code === 'E2' ? 160 : l.code === 'LH' ? 5 : l.code === 'FSH' ? 5 : l.code === 'LDL' ? 4 : l.code === 'HDL' ? 1 : l.code === 'TG' ? 2 : l.code === 'GLU' ? 6 : l.code === 'INS' ? 25 : l.code === 'CRP' ? 5 : l.code === 'CREATININE' ? 120 : 3,
      isInverted: l.code === 'HDL' || l.code === 'SHBG',
    }));
  }, [labs]);

  // Missing markers
  const missingMarkers = useMemo(() => {
    const present = new Set(markers.map(m => m.name.toUpperCase()));
    return REQUIRED_MARKERS.filter(m => !present.has(m));
  }, [markers]);

  const kAgg = 0.4;
  const zCrit = 12.0;

  // Auto-run
  useEffect(() => {
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
  }, [cycleStart, lastLab, markers.length]);

  const msPerWeek = 7 * 24 * 3600 * 1000;
  const weeksSinceLab = Math.max(0, (new Date(today).getTime() - new Date(lastLab).getTime()) / msPerWeek);
  const compliance = getComplianceStatus(weeksSinceLab);
  const complianceColors: Record<string, string> = { compliant:'#00e68a', overdue:'#f97316', critical:'#ef4444' };

  return (
    <div>
      {/* Info card */}
      <div style={{ marginBottom:10, padding:14, borderRadius:16, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>🕒 Комплаенс — Data Decay Engine</div>
        <div style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5 }}>
          Отслеживание дисциплины сдачи анализов. Штрафной коэффициент за устаревшие данные. Даты вычисляются автоматически из курса и анализов.
        </div>
      </div>

      {/* Auto dates card */}
      <div style={{ marginBottom:10, padding:14, borderRadius:16, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Дата начала курса (авто)</div>
            <div style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--accent)', fontSize:12, fontWeight:600, opacity:0.8 }}>
              🔒 {courseStartDate}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Последние анализы (авто)</div>
            <div style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--accent)', fontSize:12, fontWeight:600, opacity:0.8 }}>
              🔒 {latestLabDate}
            </div>
          </div>
        </div>

        {/* Compliance status */}
        <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:4 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>Статус комплаенса</div>
            <div style={{ fontSize:14, fontWeight:700, color:complianceColors[compliance] }}>
              {compliance === 'compliant' ? '✅ В норме' : compliance === 'overdue' ? '⚠️ Просрочен' : '🔴 Критический'}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>Недель с анализов</div>
            <div style={{ fontSize:18, fontWeight:700, color:complianceColors[compliance] }}>{weeksSinceLab.toFixed(1)}</div>
          </div>
        </div>

        {/* Missing markers warning */}
        {missingMarkers.length > 0 && (
          <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#ef4444', marginBottom:4 }}>⚠️ Не хватает маркеров ({missingMarkers.length})</div>
            <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
              {missingMarkers.slice(0, 10).join(', ')}{missingMarkers.length > 10 ? ` +${missingMarkers.length - 10}` : ''}
            </div>
            <div style={{ fontSize:8, color:'#f97316', marginTop:4 }}>
              Штраф за неполные анализы будет применён к соответствующим системам
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {report && (
        <>
          <div style={{ marginBottom:10, padding:12, borderRadius:14, borderLeft:'3px solid ' + complianceColors[report.systemWarnings.complianceStatus],
            background: report.systemWarnings.complianceStatus === 'compliant' ? 'rgba(0,230,138,0.06)' : report.systemWarnings.complianceStatus === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.06)',
            border:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', marginBottom:4 }}>⚠️ Системные предупреждения</div>
            <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.5, marginBottom:6 }}>{report.systemWarnings.disclaimer}</div>
            <div style={{ fontSize:11, fontWeight:700, color:report.systemWarnings.complianceStatus==='compliant'?'#00e68a':'#f97316' }}>
              {report.systemWarnings.penaltyStatus}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:4, fontSize:9, color:'var(--text-dim)' }}>
              <span>{report.systemWarnings.weeksOnCycle} нед на курсе</span>
              <span>{report.systemWarnings.weeksSinceLastLab} нед с анализов</span>
            </div>
          </div>

          <div style={{ padding:14, borderRadius:16, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:8 }}>📊 Анализ с штрафом</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, textAlign:'center', marginBottom:8 }}>
              <div style={{ padding:12, borderRadius:12, background:'var(--bg-secondary)' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)' }}>Коэффициент штрафа</div>
                <div style={{ fontSize:24, fontWeight:800, color:report.riskAnalysis.penaltyMultiplierApplied > 1 ? '#ef4444' : '#00e68a' }}>
                  {report.riskAnalysis.penaltyMultiplierApplied.toFixed(1)}×
                </div>
              </div>
              <div style={{ padding:12, borderRadius:12, background:'var(--bg-secondary)' }}>
                <div style={{ fontSize:9, color:'var(--text-dim)' }}>Вероятность отказа</div>
                <div style={{ fontSize:24, fontWeight:800, color:report.riskAnalysis.probabilityPercent >= 80 ? '#ef4444' : report.riskAnalysis.probabilityPercent >= 50 ? '#f97316' : '#00e68a' }}>
                  {Math.round(report.riskAnalysis.probabilityPercent)}%
                </div>
              </div>
            </div>
            <div style={{ height:8, background:'var(--bg-secondary)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100,report.riskAnalysis.probabilityPercent)}%`, height:'100%', background:report.riskAnalysis.probabilityPercent >= 80 ? '#ef4444' : report.riskAnalysis.probabilityPercent >= 50 ? '#f97316' : '#00e68a', borderRadius:4, transition:'width 0.5s' }} />
            </div>
          </div>
        </>
      )}

      {!report && (
        <div style={{ textAlign:'center', padding:30, color:'var(--text-dim)', fontSize:12 }}>
          Загрузка анализа комплаенса...
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

// ── Labs Risks Tab (Анализы sub-tab in Clinical) ──
const LabsRisksTab: React.FC = () => {
  const linked = useDataLink();
  const labs = linked.labs || [];
  const hasLabs = labs.length > 0;
  const [riskSections, setRiskSections] = useState<Record<string,boolean>>({ pharma:true, indices:true, systems:true, markers:true });

  const sysLabels: Record<string,string> = {
    cardio:'Сердечно-сосудистая', hepatic:'Печень', renal:'Почки', neuro:'Нервная',
    endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репродуктивная', musculoskeletal:'Мышечная', metabolic:'Метаболизм', other:'Прочее'
  };

  const labPharmaAlerts = useMemo(() => {
    if (!hasLabs || linked.course.length === 0) return [] as LabDrugAlert[];
    return analyzeLabDrugCorrelation(labs, linked.course, linked.profile?.settings?.phase || 'on_cycle');
  }, [hasLabs, labs, linked.course]);

  const labAnalysisRes = useMemo(() => {
    if (!hasLabs) return null;
    return interpretLabs(labs);
  }, [hasLabs, labs]);

  const r = labAnalysisRes;
  const ASI = r ? Math.max(0, Math.round(100 - ((r.hormoneScore||0)*0.4 + Math.min(100, (r.inflammation||0)/6*50)*0.3 + (r.kidneyStress||0)*0.3))) : null;
  const HMI = r ? Math.round(Math.min(100, (r.liverStress||0) * 1.2 + (r.inflammation||0) * 0.5)) : null;
  const CR = r ? Math.round(Math.min(100, (r.cardioRisk||0) * 1.1 + (r.inflammation||0) * 0.6)) : null;
  const statusColor = (v: number|null, inv: boolean) => {
    if (v===null) return 'var(--text-dim)';
    if (inv) return v>=70 ? '#22c55e' : v>=40 ? '#eab308' : '#ef4444';
    return v<=30 ? '#22c55e' : v<=60 ? '#eab308' : '#ef4444';
  };
  const statusLabel = (v: number|null, inv: boolean) => {
    if (v===null) return 'Н/Д';
    if (inv) return v>=70 ? 'Хорошо' : v>=40 ? 'Умеренно' : 'Плохо';
    return v<=30 ? 'Хорошо' : v<=60 ? 'Умеренно' : 'Повышен';
  };

  const labRisks = useMemo(() => {
    if (!hasLabs) return null;
    try {
    const contribs = calculateRiskFromAnalyses(labs) as any;
    const sb: Record<string,{raw:number;net:number}> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const c = contribs.systemContributions?.[sys] || 0;
      sb[sys] = { raw: c, net: c };
    }
    const devs: { code:string; name:string; value:number; uln:number; lln:number; deviation:number; system:string }[] = [];
    for (const lab of labs) {
      const ref = UCUM_MAP[lab.code];
      if (!ref?.uln || !ref?.lln) continue;
      const norm = lab.value * (ref.coeff || 1);
      let deviation = 0;
      if (norm > ref.uln) deviation = (norm - ref.uln) / ref.uln;
      else if (norm < ref.lln) deviation = -((ref.lln - norm) / ref.lln);
      if (Math.abs(deviation) > 0.01) {
        let sys = 'other';
        for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
          if (codes.includes(lab.code.toUpperCase())) { sys = s; break; }
        }
        devs.push({ code: lab.code, name: ref.name || lab.code, value: lab.value, uln: ref.uln, lln: ref.lln, deviation: Math.round(deviation*100), system: sys });
      }
    }
    devs.sort((a,b) => Math.abs(b.deviation)-Math.abs(a.deviation));
    return { systemBreakdown: sb, markerDeviations: devs, deviationCount: devs.length };
    } catch { return null; }
  }, [hasLabs, labs]);

  const penalty = useMemo(() => {
    return calculatePenaltyCoefficients('baseline', labs, [], 1, linked.course, false);
  }, [labs, linked.course]);

  const sysColors: Record<string,string> = {
    hepatic:'#22c55e', renal:'#3b82f6', endocrine:'#a855f7', hematologic:'#ef4444',
    cardio:'#f97316', metabolic:'#eab308', reproductive:'#ec4899', neuro:'#14b8a6', other:'#6b7280'
  };

  const LAB_SYSTEM_GROUPS: Record<string,string[]> = {
    hepatic:['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB'], renal:['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR'],
    endocrine:['TSH','FT3','FT4','TESTOSTERONE','TT','E2','ESTRADIOL','PRL','PROLACTIN','CORTISOL','LH','FSH','SHBG','IGF1'],
    hematologic:['HGB','HCT','PLT','WBC','FERRITIN'], cardio:['LDL','HDL','TG','CRP','HOMOCYSTEINE'],
    metabolic:['GLU','GLUCOSE','HBA1C','INSULIN','INS','HOMA','VITD'], reproductive:['PSA','INHB','AMH'], neuro:['HOMOCYSTEINE'], other:[]
  };

  return (
    <div>
      {[
        {key:'pharma',icon:'🧬',title:'Лабораторно-фармацевтические риски',
         body: labPharmaAlerts.length>0 ? <div style={{display:'grid',gap:3}}>{labPharmaAlerts.map((a,i)=>
          <div key={i} style={{padding:'6px 8px',borderRadius:6,background:a.severity==='critical'?'rgba(239,68,68,0.08)':a.severity==='high'?'rgba(249,115,22,0.08)':'rgba(234,179,8,0.08)',border:`1px solid ${a.severity==='critical'?'rgba(239,68,68,0.2)':a.severity==='high'?'rgba(249,115,22,0.2)':'rgba(234,179,8,0.2)'}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:9,fontWeight:600,color:a.severity==='critical'?'#ef4444':a.severity==='high'?'#f97316':'#eab308'}}>{a.marker} × {a.drugCause?.join(', ')}</span>
              <span style={{fontSize:7,fontWeight:700,padding:'1px 5px',borderRadius:3,background:a.severity==='critical'?'#ef4444':a.severity==='high'?'#f97316':'#eab308',color:'#fff'}}>{a.severity==='critical'?'КРИТ':a.severity==='high'?'ВЫСОК':'МОНИТ'}</span>
            </div><div style={{color:'var(--text-dim)',fontSize:8}}>{a.recommendation}</div></div>)}</div> :
          <div style={{fontSize:10,color:'var(--text-dim)',textAlign:'center',padding:'12px 0'}}>{hasLabs?'Не обнаружены':'Введите анализы'}</div>},
        {key:'indices',icon:'📊',title:'Композитные индексы здоровья',
         body:<div style={{display:'grid',gap:6}}>{[{label:'ASI (Анаболический синтез)',desc:'Способность к анаболизму',val:ASI,inv:true},{label:'HMI (Гепатический метаболизм)',desc:'Стресс печени',val:HMI,inv:false},{label:'CR (Кардиориск)',desc:'Липиды + воспаление',val:CR,inv:false}].map(item=>
          <div key={item.label} style={{padding:8,borderRadius:8,background:item.val!==null?`rgba(${item.inv?(item.val>=70?'34,197,94':item.val>=40?'234,179,8':'239,68,68'):(item.val<=30?'34,197,94':item.val<=60?'234,179,8':'239,68,68')},0.06)`:'var(--bg-secondary)',border:item.val!==null?`1px solid rgba(${item.inv?(item.val>=70?'34,197,94':item.val>=40?'234,179,8':'239,68,68'):(item.val<=30?'34,197,94':item.val<=60?'234,179,8':'239,68,68')},0.2)`:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:10,fontWeight:600}}>{item.label}</div><div style={{fontSize:8,color:'var(--text-dim)',marginTop:2}}>{item.desc}</div></div>
              {item.val!==null ? <div style={{textAlign:'right'}}><div style={{fontSize:18,fontWeight:700,color:statusColor(item.val,item.inv)}}>{item.val}%</div><div style={{fontSize:8,color:statusColor(item.val,item.inv),fontWeight:600}}>{statusLabel(item.val,item.inv)}</div></div> : <div style={{fontSize:10,color:'var(--text-dim)'}}>Нет данных</div>}
            </div></div>)}</div>},
        {key:'systems',icon:'⚠️',title:'Риски по системам организма',
         body: labRisks && Object.values(labRisks.systemBreakdown).some(v=>v.net>0) ? <div style={{display:'grid',gap:3}}>{Object.entries(labRisks.systemBreakdown).filter(([,v])=>v.net>0).sort(([,a],[,b])=>b.net-a.net).map(([sys,val])=>{
          const lvl=val.net<=25?'low':val.net<=50?'medium':val.net<=75?'high':'critical';
          const lc={low:{bg:'rgba(34,197,94,0.08)',text:'#22c55e',bar:'#22c55e'},medium:{bg:'rgba(234,179,8,0.08)',text:'#eab308',bar:'#eab308'},high:{bg:'rgba(249,115,22,0.08)',text:'#f97316',bar:'#f97316'},critical:{bg:'rgba(239,68,68,0.08)',text:'#ef4444',bar:'#ef4444'}}[lvl];
          return <div key={sys} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:6,background:lc.bg,border:`1px solid ${lc.bg.replace('0.08','0.15')}`}}>
            <span style={{fontSize:9,fontWeight:600,minWidth:60,color:lc.text}}>{sysLabels[sys]||sys}</span>
            <div style={{flex:1,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${Math.min(100,val.net)}%`,height:'100%',background:lc.bar,borderRadius:3,transition:'width 0.4s ease'}}/></div>
            <span style={{fontSize:11,fontWeight:700,color:lc.text,minWidth:28,textAlign:'right'}}>{Math.round(val.net)}%</span></div>})}</div> :
          <div style={{fontSize:10,color:'var(--text-dim)',textAlign:'center',padding:'12px 0'}}>{hasLabs?'Все системы в норме':'Введите анализы'}</div>},
        {key:'markers',icon:'🔬',title:'Маркеры с отклонениями',
         body: labRisks && labRisks.deviationCount>0 ? <div style={{display:'grid',gap:3}}>{labRisks.markerDeviations.map(m=>{
          const isHigh=m.deviation>0; const absDev=Math.abs(m.deviation);
          const dl=absDev<=20?'low':absDev<=50?'medium':absDev<=100?'high':'critical';
          const dc={low:{bg:'rgba(34,197,94,0.06)',text:'#22c55e'},medium:{bg:'rgba(234,179,8,0.06)',text:'#eab308'},high:{bg:'rgba(249,115,22,0.06)',text:'#f97316'},critical:{bg:'rgba(239,68,68,0.06)',text:'#ef4444'}}[dl];
          return <div key={m.code+m.value} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:6,background:dc.bg,border:`1px solid ${dc.bg.replace('0.06','0.12')}`}}>
            <span style={{fontSize:8,color:'var(--text-dim)',minWidth:46}}>{sysLabels[m.system]||m.system}</span>
            <span style={{fontSize:10,fontWeight:600,flex:1,color:'var(--text)'}}>{m.name}</span>
            <span style={{fontSize:8,color:'var(--text-dim)'}}>{m.lln}–{m.uln}</span>
            <span style={{fontSize:10,fontWeight:700,color:dc.text}}>{m.value} <span style={{fontSize:8,padding:'1px 4px',borderRadius:3,fontWeight:600,background:dc.text+'22',color:dc.text}}>{isHigh?'↑':'↓'}{absDev}%</span></span></div>})}</div> :
          <div style={{fontSize:10,color:'var(--text-dim)',textAlign:'center',padding:'12px 0'}}>{hasLabs?'Все маркеры в норме':'Введите анализы'}</div>},
      ].map(b => (
        <div key={b.key} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
          <button onClick={() => setRiskSections(s => ({...s, [b.key]: !s[b.key]}))} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
            background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700,
          }}>
            <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: riskSections[b.key] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            {b.icon} {b.title}
          </button>
          {riskSections[b.key] && <div style={{ padding: '0 12px 12px' }}>{b.body}</div>}
        </div>
      ))}
      {!hasLabs && <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Нет данных анализов</div></div>}
    </div>
  );
};
