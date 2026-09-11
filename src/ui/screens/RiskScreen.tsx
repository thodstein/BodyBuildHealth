import React, { useState, useMemo, useEffect } from 'react';
import { HeroImg } from '../HeroImg';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, SUBSYSTEM_MAP, SUBSYSTEM_PARENT, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE, UCUM_MAP } from '../../core/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { SYSTEM_INFO, SYSTEM_INFO_ALL, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell, LabPoint, CourseEntry } from '../../core/types';
import { calculateAggregatedRisks, type AggregatedRisk } from '../../engines/risk.engine';
import { calculateTZRisk, toCompatibleResult, type TZRiskResult } from '../../engines/risk-engine-tz';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink, notifyDataChange } from '../../core/data-link';
import { getGlobalNoLabs, getNoLabsSystems } from './LabsScreen';
import { RiskOverview } from './RiskScreen_parts/RiskOverview';

import { RiskDetails } from './RiskScreen_parts/RiskDetails';
import { V7RiskDisplay } from './RiskScreen_parts/V7RiskDisplay';
import { WeeklyRiskChart } from './RiskScreen_parts/WeeklyRiskChart';
import { RiskInfo } from './RiskScreen_parts/RiskInfo';
import { runMDSS, type MDSSInput, type MDSSOutput, type BiomarkerInput } from '../../engines/mdss-engine';
import { RiskSpecMethod } from './RiskScreen_parts/RiskSpecMethod';
import { HysteresisChart } from './RiskScreen_parts/HysteresisChart';
import { PredictiveAnalytics } from './RiskScreen_parts/PredictiveAnalytics';
import { calculateWeeklyRiskDynamics, type WeeklyRiskDynamics } from '../../engines/weekly-risk-dynamics.engine';
import { useV7Risk } from '../hooks/useV7Risk';
import { getProfile, updateProfile } from '../../core/profile-manager';
import { analyzeWithCompliance, type ComplianceReport, getComplianceStatus } from '../../engines/compliance-engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { interpretLabs, computeHOMA_IR, type LabCompositeResult } from '../../engines/lab-analysis.engine';
import { validateDiagnostics, getDiagnosticSummary } from '../../engines/diagnostics.engine';
import { readRiskBridge, type RiskBridgeData } from '../../engines/risk-bridge';
import { LABS_CARD, labsWithAlpha } from './LabsScreen_parts/LabsUI';
import { NativeIcon, type NativeIconName } from '../native/NativeIcons';
import { isNativeApp } from '../../core/app-platform';
import { copyOrShareText, saveTextFileApk, shareOutcomeLabel } from '../../core/apk-share';

/** RiskHeroStats — нетто/брутто риск в hero, ТОЛЬКО APK (isNativeApp гейт). */
const RiskHeroStats: React.FC<{ net: number | null; raw: number | null }> = ({ net, raw }) => {
  const level = net === null ? 'нет данных' : net < 25 ? 'низкий' : net < 50 ? 'умеренный' : net < 75 ? 'высокий' : 'критический';
  return (
    <div className="risk-hero-stats" aria-label="Сводка рисков">
      <div className="risk-hero-stat">
        <span className="risk-hero-stat-v">{net === null ? '—' : `${Math.round(net)}%`}</span>
        <span className="risk-hero-stat-l">нетто · {level}</span>
      </div>
      <div className="risk-hero-stat">
        <span className="risk-hero-stat-v">{raw === null ? '—' : `${Math.round(raw)}%`}</span>
        <span className="risk-hero-stat-l">брутто</span>
      </div>
      <div className="risk-hero-stat">
        <span className="risk-hero-stat-v">6 / 28</span>
        <span className="risk-hero-stat-l">систем / механизмов</span>
      </div>
    </div>
  );
};

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
  mdss: '🏥 MDSS',
  compliance: '✅ Комплаенс',
  clinical: '🩺 Клиника',
  info: 'ℹ️ Инфо',
  tz_spec: '🧬 Механизм-ориентированная',
  tz_3d: '🧊 3D модель',
};

/** ⚠️ Дисклеймер расчётов — APK PRO: белый текст 12px, тач-зона норм. */
const RiskDisclaimer: React.FC = () => (
  <div className="risk-disclaimer" style={{ margin:'10px 0', padding: '12px 14px', borderRadius: 16, background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.30)', boxShadow:'0 8px 22px rgba(0,0,0,0.16)' }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 5 }}>⚠️ Ознакомительная информация</div>
    <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.55 }}>
      Расчёты не являются медицинским инструментом и не заменяют врачебную оценку. Риски ориентировочные: они учитывают только текущее введённое состояние и построены на математических моделях и обобщённых данных — врачебного заключения они не дают. Для более точного расчёта добавьте результаты анализов (лабораторные показатели). Все действия и рекомендации выполняйте только под контролем врача.
    </div>
  </div>
);

export const RiskScreen: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const linked = useDataLink();
  const labAnalysis = linked.labAnalysis;
  const readinessData = linked.readiness;
  const [mainTab, setMainTab] = useState<'hero' | 'calculations' | 'clinical' | 'info' | 'tz_spec'>('hero');
  const [subTab, setSubTab] = useState<'overview' | 'dynamics' | 'mechanisms' | 'v7' | 'info' | 'reports' | 'mdss' | 'compliance' | 'clinical' | 'labs_risks'>('overview');

  useEffect(() => {
    try {
      if (localStorage.getItem('he_nav_risks') === '1') {
        localStorage.removeItem('he_nav_risks');
        setMainTab('calculations');
        setSubTab('overview');
      }
    } catch {}
  }, []);

  // Force subTab when mainTab changes (но не переопределяем явный переход «Отчёты по рискам»)
  useEffect(() => {
    if (mainTab === 'info' && subTab !== 'reports') setSubTab('info');
    else if (mainTab === 'clinical' || (mainTab === 'calculations' && calcPage === 'clinical')) setSubTab('clinical');
  }, [mainTab]);

  // Глубокий переход «Отчёт по рискам» из Профиля → открываем страницу отчётов, а не hero.
  useEffect(() => {
    if (initialSubTab === 'reports') {
      setMainTab('info');
      setSubTab('reports');
    }
  }, [initialSubTab]);
  const [calcPage, setCalcPage] = useState<'hero' | 'basic' | 'montecarlo' | 'mdss' | 'clinical'>('hero');
  const [basicPage, setBasicPage] = useState<'main' | 'dynamics' | 'mechanisms' | 'key_risks' | 'history'>('main');
  const [mcPage, setMcPage] = useState<'main' | 'organs' | 'dynamics' | 'sensitivity' | 'pk'>('main');
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
  const [riskReportGenerated, setRiskReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_risk_report_current')) setRiskReportGenerated(true); } catch {} }, []);
  const [riskArchive, setRiskArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_risk_reports') || '[]'); } catch { return []; }
  });
  const [reportIo, setReportIo] = useState<string | null>(null);
  const flashReportIo = (msg: string) => {
    setReportIo(msg);
    try { setTimeout(() => setReportIo(null), 2500); } catch {}
  };

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

  // Load support substance IDs from the support plan (for calculating support effect on risk)
  const supportSubstanceIds = useMemo<string[]>(() => {
    try {
      const sr = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
      if (sr && Array.isArray(sr.subs)) return sr.subs.map((id: string) => id.toLowerCase());
    } catch {}
    return [];
  }, [tick]);

  // Compute pharma risk — using TZ engine (single source of truth)
  // WITH support substances applied → overallRaw = raw risk, overallNet = risk after support reduction
  const pharmaRisk = useMemo<RiskResult | null>(() => {
    if (!linked.profile) return null;
    try {
      const s = linked.profile.settings;
      const tzResult: TZRiskResult = calculateTZRisk({
        course: linked.course || [],
        labs: linked.labs || [],
        genetics: (s.genetics || {}) as any,
        nutrition: {
          proteinPerKg: (s.weight || 80) > 0 ? ((s.nutritionFactor ?? 0.8) * 160) / (s.weight || 80) : 1.8,
          fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, waterL: 2, calories: 2500,
        },
        training: {
          hasHIIT: (s.workoutsPerWeek ?? 3) >= 4,
          weeklyMinutes: (s.workoutsPerWeek ?? 3) * (s.avgWorkoutMinutes ?? 60),
          volumeTonnes: 8000, lissMinutesPerWeek: 60,
        },
        weight: s.weight ?? 80, age: s.age ?? 30,
        sex: (s.sex ?? 'male') as 'male' | 'female',
        supportSubstances: supportSubstanceIds,
      });
      const compat = toCompatibleResult(tzResult);
      return {
        overallRaw: tzResult.overallRaw,
        overallNet: tzResult.overallNet,
        systemBreakdown: compat.systemBreakdown,
        mechanismBreakdown: compat.mechanismBreakdown as any,
        mechanismDetail: compat.mechanismDetail as any,
      } as unknown as RiskResult;
    } catch { return null; }
  }, [linked.profile, linked.course, linked.labs, supportSubstanceIds]);

  // Compute lab risk contributions
  const labRiskContributions = useMemo(() => {
    if (!hasLabs) return null;
    const labData = (linked?.labs || []).map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
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
      return Math.exp(l / Math.max(arr.length, 1));
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
    // C18: Merge bridge data from SupportScreen (single source of truth for support-adjusted risk)
    const bridge = readRiskBridge();
    if (bridge && bridge.systemBreakdown) {
      const bridgeBreakdown: Record<string, { raw: number; net: number }> = {};
      for (const [sys, v] of Object.entries(bridge.systemBreakdown)) {
        bridgeBreakdown[sys] = { raw: v.raw, net: v.net };
      }
      result = {
        ...result,
        overallRaw: bridge.riskBefore,
        overallNet: bridge.riskAfter,
        systemBreakdown: { ...result.systemBreakdown, ...bridgeBreakdown },
      };
    }
    // Покрытие поддержкой из data-link: без этого riskResult.coverageMap всегда
    // пуст и секция «Покрытие поддержкой» показывала нули при любой поддержке.
    result = { ...result, coverageMap: (linked.supportCoverage || {}) as Record<string, number> };
    return result;
  }, [pharmaRisk, hasLabs, shouldApplyPenalty, noLabsSystems, trainingRisk, nutritionRisk, linked.supportCoverage]);

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
      const today = new Date().toISOString().split('T')[0];
      const existing = loadRiskHistory();
      if (!existing.some(h => h.date === today)) {
        saveRiskHistory({ date: today, overallRaw: riskResult.overallRaw, overallNet: riskResult.overallNet });
      }
    }
  }, [tick, riskResult]);

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

  // tick в зависимостях: записи сохраняются по ходу сессии, без него
  // страница истории не видела новые точки до перемонтирования.
  const riskHistory = useMemo(() => loadRiskHistory(), [tick]);

  const renderRiskReports = () => {
    const saveArchive = (report: any) => {
      const updated = [report, ...riskArchive].slice(0, 20);
      setRiskArchive(updated);
      try { localStorage.setItem('he_risk_reports', JSON.stringify(updated)); } catch {}
    };

    const generateRiskReport = () => {
      const report = {
        id: Date.now().toString(),
        date: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        overallRaw: riskResult?.overallRaw || 0,
        overallNet: riskResult?.overallNet || 0,
        systems: riskResult?.systemBreakdown ? Object.entries(riskResult.systemBreakdown).map(([k,v]) => ({
          system: k, raw: v.raw, net: v.net
        })) : [],
        pharmaRisk: pharmaRisk?.overallRaw || 0,
        trainingRisk: trainingRisk.overallRaw,
        nutritionRisk: nutritionRisk.overallRaw,
        labRisk: labRiskContributions ? 'вкл' : 'нет',
        aggregates: aggregatedRisk ? {
          overall: aggregatedRisk.overallNet,
          pharma: aggregatedRisk.pharma.overallNet,
          labs: aggregatedRisk.labs.overallNet,
          training: aggregatedRisk.training.overallNet,
          nutrition: aggregatedRisk.nutrition.overallNet,
        } : null,
        timestamp: Date.now(),
      };
      saveArchive(report);
      try { localStorage.setItem('he_risk_report_current', JSON.stringify(report)); } catch {}
      setRiskReportGenerated(true);
    };

    const riskReportText = (): string => {
      const cur = (() => { try { return JSON.parse(localStorage.getItem('he_risk_report_current') || 'null'); } catch { return null; } })();
      const src: any = cur || {
        overallRaw: riskResult?.overallRaw || 0,
        overallNet: riskResult?.overallNet || 0,
        systems: riskResult?.systemBreakdown ? Object.entries(riskResult.systemBreakdown).map(([k, v]: any) => ({ system: k, raw: v.raw, net: v.net })) : [],
      };
      const lines = [
        `Отчёт по рискам ${src.date || new Date().toISOString().slice(0, 10)} · net ${Math.round(src.overallNet || 0)}% · raw ${Math.round(src.overallRaw || 0)}%`,
        ...(Array.isArray(src.systems) ? src.systems.map((s: any) => `• ${s.system}: raw ${Math.round(s.raw || 0)}% → net ${Math.round(s.net || 0)}%`) : []),
      ];
      return lines.join('\n');
    };

    return (
      <div className="risk-reports" style={{ padding:'0 12px 80px' }}>
        <h3 style={{ fontSize:17, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>📄 Отчёты по рискам</h3>
        <p style={{ fontSize:12, color:'#fff', margin:'0 0 12px', lineHeight:1.5 }}>Полный отчёт по рискам: все системы, источники, динамика</p>

        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <button onClick={generateRiskReport} style={{
            minHeight:48, padding:'12px 20px', borderRadius:999, cursor:'pointer', fontWeight:800, fontSize:14,
            background:'var(--accent)', color:'#000', border:'none', flex:1, boxShadow:'0 8px 22px rgba(0,230,138,0.25)',
          }}>📄 Сгенерировать отчёт</button>
          <button onClick={() => { try { localStorage.removeItem('he_risk_reports'); localStorage.removeItem('he_risk_report_current'); setRiskArchive([]); setRiskReportGenerated(false); } catch {} }}
            style={{ minHeight:48, padding:'12px 18px', borderRadius:999, cursor:'pointer', fontWeight:800, fontSize:13,
              background:'rgba(239,68,68,0.10)', color:'#fff', border:'1px solid rgba(239,68,68,0.26)' }}>
            🗑 Очистить архив
          </button>
        </div>

        {riskReportGenerated && (
          <div style={{ borderRadius:18, padding:16, marginBottom:12, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:10 }}>
              <h4 style={{ margin:0, fontSize:14, fontWeight:800, color:'#fff' }}>✅ Отчёт сгенерирован</h4>
              <span style={{ fontSize:11, color:'#fff' }}>{new Date().toLocaleString()}</span>
            </div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.6 }}>
              <b>Общий риск (raw):</b> {Math.round(riskResult?.overallRaw||0)}%<br/>
              <b>Общий риск (net):</b> {Math.round(riskResult?.overallNet||0)}%<br/>
              <b>Фарма риск:</b> {Math.round(pharmaRisk?.overallRaw||0)}% · <b>Тренировки:</b> {Math.round(trainingRisk.overallRaw)}% · <b>Питание:</b> {Math.round(nutritionRisk.overallRaw)}% · <b>Лабы:</b> {labRiskContributions ? `${Math.round(labRiskContributions.totalRisk||0)}%` : 'нет данных'}<br/>
              <b>Агрегированный:</b> {aggregatedRisk ? `${Math.round(aggregatedRisk.overallNet)}%` : '—'}
            </div>

            {riskResult?.systemBreakdown && (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:2 }}>Риск по системам:</div>
                {Object.entries(riskResult.systemBreakdown).filter(([_,v]) => (v as any).net > 0).sort(([_,a],[__,b]) => (b as any).net - (a as any).net).map(([k,v]) => {
                  const sys = v as any;
                  return (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, padding:'8px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', fontSize:12 }}>
                      <span style={{ color:'#fff', fontWeight:700, minWidth:0 }}>{({cardio:'Сердечно-сосудистая',hepatic:'Печень',renal:'Почки',neuro:'Нервная',endocrine:'Эндокринная',hematologic:'Кровь',reproductive:'Репродуктивная',musculoskeletal:'Опорно-двиг.',metabolic:'Метаболизм'})[k] || k}</span>
                      <span style={{ fontWeight:800, color:'#fff', whiteSpace:'nowrap' }}>
                        raw: {Math.round(sys.raw)}% · net: {Math.round(sys.net)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize:12, color:'#fff', textAlign:'center', marginTop:10 }}>
              Отчёт сохранён в архив. Доступен в Профиле → Отчёты.
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              <button onClick={() => { void copyOrShareText(riskReportText(), 'Отчёт по рискам').then(o => flashReportIo(shareOutcomeLabel(o))); }} style={{
                flex:1, minHeight:44, padding:'10px 14px', borderRadius:12, cursor:'pointer', fontWeight:800, fontSize:12,
                background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.30)', color:'#fff',
              }}>📋 Копия / Share</button>
              <button onClick={() => {
                const cur = (() => { try { return JSON.parse(localStorage.getItem('he_risk_report_current') || 'null'); } catch { return null; } })();
                const payload = JSON.stringify(cur || { text: riskReportText() }, null, 2);
                void saveTextFileApk(`risk-report-${new Date().toISOString().slice(0, 10)}.json`, payload, 'application/json;charset=utf-8').then(o => flashReportIo(shareOutcomeLabel(o)));
              }} style={{
                flex:1, minHeight:44, padding:'10px 14px', borderRadius:12, cursor:'pointer', fontWeight:800, fontSize:12,
                background:'rgba(21,38,66,0.60)', border:'1px solid rgba(140,190,255,0.14)', color:'#fff',
              }}>📥 JSON</button>
            </div>
            {reportIo && <div role="status" style={{ fontSize:11, color:'#fff', textAlign:'center', marginTop:6 }}>{reportIo}</div>}
          </div>
        )}

        {riskArchive.length > 0 && (
          <div>
            <h4 style={{ fontSize:14, fontWeight:800, color:'#fff', margin:'0 0 10px' }}>📦 Архив отчётов ({riskArchive.length})</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {riskArchive.map((r: any) => (
                <div key={r.id} style={{ borderRadius:14, padding:'12px 14px', background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Отчёт от {r.date}</span>
                    <span style={{ fontSize:14, color:'#fff', fontWeight:800, padding:'4px 12px', borderRadius:999, background: r.overallNet > 50 ? 'rgba(239,68,68,0.14)' : r.overallNet > 25 ? 'rgba(245,158,11,0.14)' : 'rgba(34,197,94,0.12)', border:'1px solid rgba(255,255,255,0.10)' }}>
                      {Math.round(r.overallNet)}%
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:6 }}>
                    Систем: {r.systems?.length||0} · Фарма: {Math.round(r.pharmaRisk)}% · Тренировки: {Math.round(r.trainingRisk)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!riskReportGenerated && riskArchive.length === 0 && (
          <div style={{ textAlign:'center', padding:40, fontSize:13, color:'#fff', lineHeight:1.5 }}>
            Нажмите «Сгенерировать отчёт» для создания полного отчёта по рискам
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (!riskResult) return <div style={{ textAlign: 'center', padding: 40, color: '#fff' }}>Загрузка...</div>;
    const effectiveLabContrib = labRiskContributions || syntheticLabContrib;
    const isSyntheticLab = !hasLabs && shouldApplyPenalty; // lab contrib came from penalty, not real labs
    switch (subTab) {
      case 'overview': return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={effectiveLabContrib} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} weeklyDynamics={weeklyDynamics} />;
      case 'mechanisms': return <RiskDetails riskResult={riskResult} labRiskContributions={effectiveLabContrib} isSyntheticLab={isSyntheticLab} />;
      case 'v7': return v7Result ? <V7RiskDisplay result={v7Result} organWeek={organWeek} onWeekChange={setOrganWeek} mcEnabled={mcEnabled} onToggleMC={toggleMC} /> : <div style={{ textAlign: 'center', padding: 40, color: '#fff' }}>Загрузка V7...</div>;

      case 'dynamics': return weeklyDynamics ? <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} /> : <div style={{ textAlign:'center', padding:40, color:'#fff' }}>Нет данных для динамики</div>;
      case 'info': return <RiskInfo />;
      case 'reports': return renderRiskReports();
      case 'mdss': return <MDSSRiskDisplay />;
      case 'compliance': return <ComplianceDisplay />;
      case 'clinical': return <ClinicalRiskDisplay />;
      case 'labs_risks': return <LabsRisksTab />;
      default: return <RiskOverview riskResult={riskResult} globalNoLabs={globalNoLabs} noLabsSystems={noLabsSystems} labRiskContributions={effectiveLabContrib} riskHistory={riskHistory} aggregatedRisk={aggregatedRisk} />;
    }
  };

  const CALC_SUBTABS = ['overview','dynamics','mechanisms','v7','mdss'] as const;
  const CLINICAL_SUBTABS = ['compliance','clinical','labs_risks'] as const;

  const SUBTAB_LABELS: Record<string, string> = {
    overview: '📊 Обзор', dynamics: '📈 Динамика', mechanisms: '⚙️ Механизмы',
    v7: '🧬 Монте Карло', mdss: '🏥 MDSS',
    compliance: '✅ Комплаенс', clinical: '🩺 Клиника', info: 'ℹ️ Инфо',
    labs_risks: '🩸 Анализы', reports: '📄 Отчёты',
    main: '📋 Главная',
    organs: '🧬 Органы и Матрицы',
    sensitivity: '📊 Чувствительность',
    pk: '💊 Фармакокинетика',
    key_risks: '🔑 Ключевые',
    history: '📜 История и пороги',
    tz_3d: '🧊 3D модель',
    analyses: '🔬 Анализы',
  };

  const SYSTEM_ICONS_V2: Record<string, string> = {
    cardio:'❤️', hepatic:'🫁', renal:'🫘', neuro:'🧠', endocrine:'⚖️', hematologic:'🩸',
    reproductive:'🧬', musculoskeletal:'💪', metabolic:'⚡', ghigf:'📈', ins_axis:'🍬',
    neuro_toxicity:'⚠️', blood:'🩸', vessels:'🩸', immunity:'🛡️', thyroid:'🦋', prostate:'🔴', skin:'🧴'
  };

  // Basic Calc — multi-page view
  const renderBasicCalc = () => {
    if (!riskResult) return <div style={{ textAlign:'center', padding:40, color:'#fff' }}>Загрузка...</div>;
    const effectiveLabContrib = labRiskContributions || syntheticLabContrib;
    const isSyntheticLab = !hasLabs && shouldApplyPenalty;

    // ── Main page: cards ──
    if (basicPage === 'main') {
      const cardDefs = [
        { key:'dynamics', icon:'chart' as NativeIconName, title:'Динамика рисков', desc:'График изменения рисков по неделям', color:'#3b82f6' },
        { key:'mechanisms', icon:'sliders' as NativeIconName, title:'Системы и механизмы', desc:'Риски по всем системам организма с описанием механизмов', color:'#a855f7' },
        { key:'key_risks', icon:'zap' as NativeIconName, title:'Ключевые риски', desc:'Основные факторы риска по каждой системе', color:'#ef4444' },
        { key:'history', icon:'clock' as NativeIconName, title:'История и пороги препаратов', desc:'Динамика рисков и пороговые дозы всей фармакологии', color:'#f97316' },
      ];
      return (
        <div>
          {/* Общий Риск — APK PRO: крупный, белый, тач 44px */}
          <div className="risk-overall" style={{ ...LABS_CARD, marginBottom:12, padding:18, textAlign:'center', background:'linear-gradient(135deg, rgba(0,230,138,0.12) 0%, rgba(20,22,30,0.60) 100%)', border:'1px solid rgba(0,230,138,0.22)', backdropFilter:'blur(14px)', borderRadius:18, boxShadow:'0 14px 34px rgba(0,0,0,0.22)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}><span style={{ width:34, height:34, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', color:'#4ade80' }}><NativeIcon name="chart" size={17} /></span><span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Общий риск</span><span style={{ fontSize:12, padding:'5px 10px', borderRadius:999, background: riskResult.overallNet>50?'rgba(239,68,68,0.14)':'rgba(0,230,138,0.14)', border:`1px solid ${riskResult.overallNet>50?'rgba(239,68,68,0.20)':'rgba(0,230,138,0.20)'}`, color: riskResult.overallNet>50?'#f87171':'#00e68a', fontWeight:800 }}>{riskResult.overallNet<25?'низкий':riskResult.overallNet<50?'умеренный':riskResult.overallNet<75?'высокий':'критический'}</span></div>
            <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:120, padding:'12px 10px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, color:'#fff', fontWeight:700 }}>С поддержкой</div>
                <div style={{ fontSize:30, fontWeight:900, color:getRiskColor(riskResult.overallNet), lineHeight:1, marginTop:4 }}>{Math.round(riskResult.overallNet)}%</div>
              </div>
              <div style={{ flex:1, minWidth:120, padding:'12px 10px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Без поддержки</div>
                <div style={{ fontSize:30, fontWeight:900, color:getRiskColor(riskResult.overallRaw), lineHeight:1, marginTop:4 }}>{Math.round(riskResult.overallRaw)}%</div>
              </div>
            </div>
            <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden', marginBottom:8 }}>
              <div style={{ width:`${Math.min(100, riskResult.overallNet)}%`, height:'100%', background:getRiskColor(riskResult.overallNet), borderRadius:999, transition:'width 0.5s' }} />
            </div>
            <div style={{ fontSize:12, color:'#fff', fontWeight:600 }}>
              {riskResult.overallNet < 25 ? 'Низкий риск' : riskResult.overallNet < 50 ? 'Умеренный риск' : riskResult.overallNet < 75 ? 'Высокий риск' : 'Критический риск'}
            </div>
            {/* ── Penalty toggle button ── */}
            <button onClick={toggleForceNoLabs} style={{
              marginTop: 10, minHeight: 44, padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer',
              background: forceNoLabs ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.10)',
              border: forceNoLabs ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(59,130,246,0.28)',
              color: forceNoLabs ? '#f87171' : '#60a5fa', transition: 'all 0.2s'
            }}>
              {forceNoLabs ? '✅ Штраф без анализов' : '🚫 БЕЗ АНАЛИЗОВ (Штраф)'}
            </button>
            {forceNoLabs && (
              <div style={{ fontSize: 12, color: '#fff', marginTop: 8, background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: 8, border:'1px solid rgba(239,68,68,0.18)' }}>
                ⚠ Применён штраф к расчёту рисков. Введите данные анализов для точной оценки.
              </div>
            )}
          </div>

          {/* Риск по системам и Эффективность поддержки — удалены, относятся к вероятностной модели */}
          {/* Синхронизация с калькулятором — удалена, не относится к методам расчёта риска */}

          {/* 4 nav cards — APK PRO: 56px+, белый текст */}
          <div className="risk-navcards" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {cardDefs.map(c => (
              <button key={c.key} onClick={() => setBasicPage(c.key as any)} aria-label={c.title} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 14px', borderRadius:18, cursor:'pointer', textAlign:'left', width:'100%', minHeight:64,
                background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', backdropFilter:'blur(14px)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)', transition:'transform 0.18s, border-color 0.18s',
              }} onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor=c.color+'66'; (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)'; }} onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.09)'; (e.currentTarget as HTMLButtonElement).style.transform='translateY(0)'; }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:c.color+'1c', border:`1px solid ${c.color}30`, color: c.color }}><NativeIcon name={c.icon as NativeIconName} size={22} /></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, marginBottom:3, color:'#fff', lineHeight:1.2 }}>{c.title}</div>
                  <div style={{ fontSize:12, color:'#fff', lineHeight:1.4 }}>{c.desc}</div>
                </div>
                <span style={{ color:'#fff', fontSize:14, fontWeight:800, minWidth:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:999, background:c.color+'20', border:`1px solid ${c.color}30` }}>→</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── Dynamics page ──
    if (basicPage === 'dynamics') {
      if (!weeklyDynamics) return <div style={{ textAlign:'center', padding:40, color:'#fff' }}>Нет данных для динамики</div>;
      return <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={selectedWeek} onWeekSelect={setSelectedWeek} mode={weekMode} onModeChange={setWeekMode} />;
    }

    // ── Mechanisms page (vessels → Сосуды) ──
    if (basicPage === 'mechanisms') {
      return <RiskDetails riskResult={riskResult} labRiskContributions={effectiveLabContrib} isSyntheticLab={isSyntheticLab} />;
    }

    // ── Key Risks page ──
    if (basicPage === 'key_risks') {
      const sorted = ALL_RISK_SYSTEMS.map(sys => ({
        sys, label: SYSTEM_INFO[sys]?.label || SYSTEM_INFO_ALL[sys]?.label || sys,
        raw: riskResult.systemBreakdown?.[sys]?.raw ?? 0,
        net: riskResult.systemBreakdown?.[sys]?.net ?? 0,
      })).sort((a, b) => b.net - a.net);
      return (
        <div className="risk-keyrisks">
          <div className="card" style={{ marginBottom:10, padding:14, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:10, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width:30, height:30, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.24)', color:'#f87171' }}><NativeIcon name="zap" size={15} /></span> Ключевые риски по системам</div>
            {sorted.filter(s => s.net > 5).map(s => (
              <div key={s.sys} style={{ marginBottom:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{SYSTEM_ICONS_V2[s.sys] || ''} {s.label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:getRiskColor(s.net) }}>{Math.round(s.net)}%</span>
                </div>
                <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden' }}>
                  <div style={{ width:`${s.net}%`, height:'100%', background:getRiskColor(s.net), borderRadius:999 }} />
                </div>
                <div style={{ display:'flex', gap:8, marginTop:5, fontSize:12, color:'#fff' }}>
                  <span>Без поддержки: {Math.round(s.raw)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── History + Drug Thresholds page ──
    if (basicPage === 'history') {
      // All pharmacology EXCEPT support supplements
      const SUPPORT_IDS = new Set([
        'telmi','nebivolol','nac','tudca','omega3','magnesium','berberine','aspirin',
        'milk_thistle','curcumin_sup','alpha_lipoic','coq10','phosphatidylcholine',
        'ashwagandha','tongkat_ali','fadogia','shilajit','ginseng_sup','saw_palmetto',
        'probiotics_sup','taurine_sup','vitamin_d3','vitamin_k2','zinc_sup','boron',
        'selenium_sup','vitamin_b6','vitamin_b12','folate',
      ]);
      const drugEntries = Object.entries(DRUG_THRESHOLDS)
        .filter(([k]) => !SUPPORT_IDS.has(k) && PHARMA_DB[k]?.name)
        .map(([k, v]) => ({ id: k, name: PHARMA_DB[k]!.name, dosePerWeek: v.dosePerWeek, androgenicity: v.androgenicity }));
      // Dedup by name (keep first)
      const seen = new Set<string>();
      const deduped = drugEntries.filter(d => { if (seen.has(d.name)) return false; seen.add(d.name); return true; })
        .sort((a, b) => b.androgenicity - a.androgenicity);
      return (
        <div className="risk-history">
          {/* Risk History */}
          <div className="card" style={{ marginBottom:10, padding:14, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:10, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width:30, height:30, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:'#4ade80' }}><NativeIcon name="clock" size={15} /></span> История рисков</div>
            {riskHistory.length === 0 ? (
              <div style={{ fontSize:12, color:'#fff', textAlign:'center', padding:14 }}>Нет сохранённой истории</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {riskHistory.map((h: any, i: number) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', fontSize:12 }}>
                    <span style={{ color:'#fff', fontWeight:700 }}>{h.date}</span>
                    <span style={{ color:getRiskColor(h.overallNet), fontWeight:800 }}>С поддержкой: {Math.round(h.overallNet)}%</span>
                    <span style={{ color:getRiskColor(h.overallRaw), fontWeight:700 }}>Без: {Math.round(h.overallRaw)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drug Thresholds — only AAS/GH/Insulin, Russian names, no duplicates */}
          <div className="card" style={{ marginBottom:10, padding:14, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:10, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width:30, height:30, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.24)', color:'#a78bfa' }}><NativeIcon name="pill" size={15} /></span> Препараты и пороги (ААС, ГР, инсулины)</div>
            <div style={{ display:'grid', gap:8 }}>
              {deduped.map(d => {
                const anColor = d.androgenicity < 0.3 ? '#22c55e' : d.androgenicity < 0.7 ? '#eab308' : d.androgenicity < 1.2 ? '#f97316' : '#ef4444';
                return (
                  <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{d.name}</div>
                      <div style={{ fontSize:12, color:'#fff', marginTop:2 }}>{d.dosePerWeek}/нед</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:11, color:'#fff' }}>Андрог.</div>
                      <div style={{ fontSize:16, fontWeight:800, color:anColor }}>{d.androgenicity.toFixed(1)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Monte Carlo multi-page view
  const renderMonteCarlo = () => {
    if (!v7Result) return <div style={{ textAlign:'center', padding:40, color:'#fff' }}>Загрузка V7...</div>;

    // Main page: MC toggle + 4 nav cards
    if (mcPage === 'main') {
      const mcCards = [
        { key:'organs', icon:'layers' as NativeIconName, title:'Органы и Матрицы', desc:'Матрица рисков по органам и системам с временным срезом', color:'#8b5cf6' },
        { key:'dynamics', icon:'chart' as NativeIconName, title:'Динамика', desc:'Временной ряд рисков по дням на 12 недель', color:'#3b82f6' },
        { key:'sensitivity', icon:'target' as NativeIconName, title:'Чувствительность', desc:'Анализ чувствительности к параметрам образа жизни', color:'#f97316' },
        { key:'pk', icon:'pill' as NativeIconName, title:'Фармакокинетика', desc:'PK/PD симуляция концентрации препаратов', color:'#22c55e' },
      ];
      return (
        <div className="risk-mc">
          {/* MC Toggle card */}
          <div className="card risk-overall" style={{ marginBottom:10, padding:16, textAlign:'center', borderRadius:18,
            background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.28)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:10 }}>🎲 Монте Карло (V7)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:10 }}>
              <div style={{ padding:'12px 8px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Без поддержки</div>
                <div style={{ fontSize:28, fontWeight:900, color:getRiskColor(v7Result.globalRiskRaw), marginTop:4 }}>{Math.round(v7Result.globalRiskRaw)}%</div>
              </div>
              <div style={{ padding:'12px 8px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, color:'#fff', fontWeight:700 }}>С поддержкой</div>
                <div style={{ fontSize:28, fontWeight:900, color:getRiskColor(v7Result.globalRiskNet), marginTop:4 }}>{Math.round(v7Result.globalRiskNet)}%</div>
              </div>
            </div>
            <button onClick={toggleMC} style={{
              minHeight:48, padding:'12px 24px', borderRadius:999, fontSize:14, fontWeight:800, cursor:'pointer',
              background:mcEnabled?'linear-gradient(135deg,#8b5cf6,#6d28d9)':'rgba(255,255,255,0.06)',
              border:mcEnabled?'1px solid #8b5cf6':'1px solid rgba(255,255,255,0.12)',
              color:'#fff',
              boxShadow:mcEnabled?'0 0 18px rgba(139,92,246,0.40)':'none',
              transition:'all 0.3s',
            }}>{mcEnabled ? '✅ MC включён' : '▶ Включить Монте Карло'}</button>
          </div>

          {/* 4 nav cards */}
          <div className="risk-navcards" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {mcCards.map(c => (
              <button key={c.key} onClick={() => setMcPage(c.key as any)} aria-label={c.title} style={{
                display:'flex', alignItems:'center', gap:12, padding:'14px 14px', borderRadius:18, minHeight:64,
                cursor:'pointer', textAlign:'left', width:'100%',
                background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', boxShadow:'0 10px 26px rgba(0,0,0,0.20)',
              }}>
                <div style={{ width:48, height:48, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, background:c.color+'1c', border:`1px solid ${c.color}30`, color: c.color }}><NativeIcon name={c.icon as NativeIconName} size={22} /></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, marginBottom:3, color:'#fff' }}>{c.title}</div>
                  <div style={{ fontSize:12, color:'#fff', lineHeight:1.4 }}>{c.desc}</div>
                </div>
                <span style={{ color:'#fff', fontSize:14, fontWeight:800, minWidth:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:999, background:c.color+'20', border:`1px solid ${c.color}30` }}>→</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Sub-pages: render V7RiskDisplay with forcedTab for specific content
    const tabForPage: Record<string, string> = { organs:'organs', dynamics:'dynamics', sensitivity:'sensitivity', pk:'pk' };
    return <V7RiskDisplay result={v7Result} organWeek={organWeek} onWeekChange={setOrganWeek} mcEnabled={mcEnabled} onToggleMC={toggleMC} forcedTab={tabForPage[mcPage] || ''} />;
  };

  const mainTabLabel = mainTab === 'calculations' ? 'Другие методы расчета' :
    mainTab === 'clinical' ? 'Клиника (уст.)' : mainTab === 'info' ? 'Общая информация' : mainTab === 'tz_spec' ? 'Механизм-ориентированная модель' : '';

  return (
    <div className="screen risk" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>
      {/* ─── HERO PAGE — на весь экран, без стекла, как в БАД/Статьи/Профиль ─── */}
      {mainTab === 'hero' && (
        <div className="risk-hero" style={{ position:'fixed', inset:0, width:'100%', height:'100dvh', minHeight:'100dvh', zIndex:100, display:'flex', flexDirection:'column', overflow:'hidden', background:'#07070a' }}>
          <HeroImg webp="/risk-hero.webp?v=20250827h" src="/risk-hero.png?v=20250827h" alt="" onError={e=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} className="hero-fullscreen-img" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center center', background:'#07070a', filter:'brightness(1.06) saturate(1.04)' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 78%, rgba(0,0,0,0.06) 88%, rgba(0,0,0,0.18) 100%)' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'12px 12px calc(102px + env(safe-area-inset-bottom,0px))', gap:10, overflowY:'auto' }}>
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:20, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.22)', color:'#ef4444', fontSize:9, fontWeight:800, letterSpacing:'0.4px' }}>
                <span style={{ width:5, height:5, borderRadius:5, background:'#ef4444', boxShadow:'0 0 8px rgba(239,68,68,0.6)', display:'inline-block' }} /> РИСКИ
              </div>
              <h1 className="risk-hero-title" style={{ fontSize:22, fontWeight:900, color:'#fff', margin:'8px 0 4px', textShadow:'0 2px 12px rgba(0,0,0,0.9)', letterSpacing:'-0.6px', lineHeight:1 }}>Оценка рисков</h1>
              <p className="risk-hero-sub" style={{ fontSize:11, color:'#fff', margin:0, lineHeight:1.4, textShadow:'0 1px 6px rgba(0,0,0,0.8)', maxWidth:480 }}>Механизм-ориентированная модель ТЗ, вероятностные методы, клиника и справочник — всё в одном хабе</p>
              {isNativeApp() && (
                <RiskHeroStats
                  net={riskResult ? riskResult.overallNet : null}
                  raw={riskResult ? riskResult.overallRaw : null}
                />
              )}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>6 систем</span>
                <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>28 механизмов</span>
                <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, background:'rgba(18,18,20,0.55)', border:'1px solid rgba(239,68,68,0.16)', color:'#ef4444' }}>ТЗ-модель</span>
              </div>
            </div>
            <div className="risk-hero-cards native-fade-up" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { id: 'tz_spec', icon: 'layers' as NativeIconName, title: 'Механизм-ориентированная', desc: '6 систем · 28 механизмов · полуколичественная шкала · верификация анализами.', color: '#8b5cf6' },
                { id: 'calculations', icon: 'cpu' as NativeIconName, title: 'Другие методы расчёта', desc: 'Вероятностная, Монте-Карло V7, MDSS, клиника — все модели в одном месте.', color: '#22c55e' },
                { id: 'info', icon: 'message' as NativeIconName, title: 'Общая информация', desc: 'Формулы, механизмы, пороги препаратов и справочные данные.', color: '#a855f7' },
              ].map((card, ci) => (
                <div key={card.id} role="button" tabIndex={0} onClick={() => { setMainTab(card.id as any); setSubTab(card.id === 'info' ? 'info' : card.id === 'tz_spec' ? 'overview' : 'overview'); }} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); (e.currentTarget as HTMLDivElement).click(); }}} onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.borderColor=`${card.color}30`; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 6px 16px rgba(0,0,0,0.22), 0 0 0 1px ${card.color}14 inset`; }} onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.08)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 3px 10px rgba(0,0,0,0.16)'; }} className="risk-hero-card native-fade-up" data-id={card.id} style={{ animationDelay: `${ci * 55}ms`, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 3px 10px rgba(0,0,0,0.16)', background:'rgba(255,255,255,0.06)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease' }}>
                  <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`linear-gradient(135deg, ${card.color}22, ${card.color}10)`, border:`1px solid ${card.color}28`, color: card.color, boxShadow:`0 3px 10px ${card.color}20`, position:'relative' }}><NativeIcon name={card.icon} size={19} /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, marginBottom:2, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{card.title}</div>
                    <div style={{ fontSize:10.5, color:'#fff', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${card.color}12`, border:`1px solid ${card.color}18`, color:card.color, fontSize:13, flexShrink:0, fontWeight:700 }}>→</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9, color:'#fff', textAlign:'center', lineHeight:1.3 }}>Нажми на раздел — откроются инструменты и данные</div>
          </div>
        </div>
      )}

      {/* ─── TOP NAV BAR — APK PRO: 56px, тач 44px, белый текст ─── */}
      {mainTab !== 'hero' && (
        <div className="risk-topnav" style={{ position:'sticky', top:0, zIndex:20, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', background:'rgba(10,12,18,0.86)', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10, padding:'8px 12px', flexShrink:0, minHeight:56 }}>
          <button onClick={() => setMainTab('hero')} aria-label="Назад к обзору рисков" style={{ minHeight:44, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.07)', borderRadius:999, display:'flex', alignItems:'center', gap:6 }}>← Обзор</button>
          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.10)', flexShrink:0 }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
            <span style={{ width:40, height:40, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: mainTab==='tz_spec'?'rgba(139,92,246,0.16)':'rgba(34,197,94,0.16)', border:`1px solid ${mainTab==='tz_spec'?'rgba(139,92,246,0.28)':'rgba(34,197,94,0.28)'}`, color: mainTab==='tz_spec' ? '#a78bfa' : mainTab==='info' ? '#c4b5fd' : '#4ade80' }}>{mainTab==='tz_spec'? <NativeIcon name="layers" size={18} /> : mainTab==='info' ? <NativeIcon name="message" size={18} /> : <NativeIcon name="cpu" size={18} />}</span>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{mainTab==='tz_spec'?'Механизм-модель': mainTab==='info'?'Информация': mainTab==='calculations'?'Другие методы':'Риски'}</div>
              <div style={{ fontSize:11, color:'#fff', lineHeight:1.2, marginTop:2 }}>{riskResult? `NET ${Math.round(riskResult.overallNet)}% · RAW ${Math.round(riskResult.overallRaw)}%` : 'нет данных'}</div>
            </div>
            {riskResult && (
              <span className="risk-topnav-badge" style={{ flexShrink:0, fontSize:13, fontWeight:900, padding:'8px 12px', borderRadius:999, background:`${getRiskColor(riskResult.overallNet)}1a`, border:`1px solid ${getRiskColor(riskResult.overallNet)}44`, color:getRiskColor(riskResult.overallNet) }}>{Math.round(riskResult.overallNet)}%</span>
            )}
          </div>
        </div>
      )}

      {/* ─── SCROLLABLE CONTENT — увеличен отступ чтобы дашборд не перекрывал ─── */}
      {mainTab !== 'hero' && (
        <div className="risk-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0 calc(20px + 72px + env(safe-area-inset-bottom,0px))' }}>
          <div style={{ padding:'0 12px' }}>

          {/* ───── COMPLEX CALCULATIONS SUB-HERO ───── */}
          {mainTab === 'calculations' && calcPage === 'hero' && (
            <div className="risk-calc-hero" style={{ padding:14, borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(20,22,30,0.45)', backdropFilter:'blur(12px)' }}>
              <div style={{ position:'relative' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:2, textAlign:'center' }}>Другие методы расчёта</div>
              <div style={{ fontSize:12, color:'#fff', marginBottom:10, textAlign:'center', lineHeight:1.4 }}>Вероятностная · Монте-Карло · MDSS · Клиника — выбери модель</div>
              {/* Summary card */}
              <div className="risk-overall" style={{ marginTop: 6, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, rgba(0,230,138,0.10) 0%, rgba(20,22,30,0.60) 100%)', border: '1px solid rgba(0,230,138,0.20)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width:30, height:30, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', color: '#4ade80' }}><NativeIcon name="chart" size={15} /></span> Средний риск курса
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: 'Вероятностная', icon: 'file' as NativeIconName, net: Math.round(riskResult?.overallNet ?? 0), raw: Math.round(riskResult?.overallRaw ?? 0), color: '#22c55e' },
                    { label: 'Монте-Карло', icon: 'cpu' as NativeIconName, net: v7Result ? Math.round(v7Result.globalRiskNet) : null, raw: v7Result ? Math.round(v7Result.globalRiskRaw) : null, color: '#8b5cf6' },
                    { label: 'MDSS', icon: 'heart' as NativeIconName, net: mdssResult ? Math.round(mdssResult.overallMaxRisk) : null, raw: null, color: '#f97316' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      flex: '1 1 30%', minWidth: 140, textAlign: 'center', padding: '12px 8px', borderRadius: 14,
                      background: item.color + '12', border: `1px solid ${item.color}30`,
                    }}>
                      <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><NativeIcon name={item.icon} size={12} /> {item.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: item.net != null ? getRiskColor(item.net) : '#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:4 }}>
                        <span>{item.net != null ? `${item.net}%` : '—'}</span>
                        <span style={{ fontSize:14, color:'#fff', fontWeight:400 }}>/</span>
                        <span style={{ fontSize:18, color: item.raw != null ? getRiskColor(item.raw) : '#fff' }}>{item.raw != null ? `${item.raw}%` : '—'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#fff', marginTop: 2 }}>с поддержкой / без</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="risk-navcards" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { id: 'basic', icon: 'file' as NativeIconName, title: 'Вероятностная модель', desc: 'Мультипликативная вероятностная модель риска. Обзор, динамика, механизмы.', color: '#22c55e', subs: 'Обзор • Динамика • Механизмы' },
                  { id: 'montecarlo', icon: 'cpu' as NativeIconName, title: 'Монте Карло (V7)', desc: 'Органы, матрица рисков, временной ряд, чувствительность, фармакокинетика.', color: '#8b5cf6', subs: '5 подвкладок' },
                  { id: 'mdss', icon: 'heart' as NativeIconName, title: 'MDSS', desc: 'Medical Decision Support System — Hill+MC+Sigmoid модель прогнозирования.', color: '#f97316', subs: '' },
                  { id: 'clinical', icon: 'cross' as NativeIconName, title: 'Клиника', desc: '3D модель, комплаенс, клинические риски и анализы.', color: '#3b82f6', subs: '3D • Комплаенс • Патологии • Анализы' },
                ].map(card => (
                  <button key={card.id} onClick={() => {
                    setCalcPage(card.id as any);
                    if (card.id === 'basic') { setBasicPage('main'); setSubTab('overview'); }
                    else if (card.id === 'montecarlo') { setMcPage('main'); setSubTab('v7'); }
                    else if (card.id === 'clinical') { setSubTab('clinical'); }
                    else setSubTab('mdss');
                  }} aria-label={card.title} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: 18, cursor: 'pointer', textAlign: 'left', width: '100%', minHeight:64,
                    background: 'rgba(20,22,30,0.55)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', transition: 'all 0.2s', boxShadow:'0 10px 26px rgba(0,0,0,0.20)',
                  }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: card.color + '1c', border:`1px solid ${card.color}30`, color: card.color }}>
                      <NativeIcon name={card.icon as NativeIconName} size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth:0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3, color: '#fff' }}>{card.title}</div>
                      <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4 }}>{card.desc}</div>
                      {card.subs && <div style={{ fontSize: 11, color: '#fff', marginTop: 3 }}>{card.subs}</div>}
                    </div>
                    <span style={{ color:'#fff', fontSize: 14, fontWeight:800, minWidth:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:999, background:card.color+'20', border:`1px solid ${card.color}30` }}>→</span>
                  </button>
                ))}
              </div>
            </div>
            </div>
          )}

          {/* ───── REGULAR SUB-TAB NAVIGATION ───── */}
          {(mainTab !== 'calculations' || calcPage !== 'hero') && (
            <>
              {/* Sub-tab pills + back button for calculations — APK PRO: липкая лента, тач 44px */}
              <div className="risk-subtabs" style={{ display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden', padding: '10px 12px', margin: '0 -12px', scrollbarWidth: 'none', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'nowrap' as const, position: 'sticky', top: 56, zIndex: 15, background: 'rgba(10,12,18,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                {mainTab === 'calculations' && (
                  <button onClick={() => {
                    if (basicPage !== 'main') { setBasicPage('main'); return; }
                    if (mcPage !== 'main') { setMcPage('main'); return; }
                    if (calcPage === 'clinical') { setCalcPage('hero'); setSubTab('overview'); return; }
                    setCalcPage('hero'); setSubTab('overview');
                  }} aria-label="Назад" style={{
                    minHeight: 44, padding: '10px 16px', borderRadius: 999, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 800,
                  }}>← Назад</button>
                )}
        {(mainTab === 'calculations'
            ? (calcPage === 'basic'
              ? (basicPage === 'main' ? ['main'] as const : [basicPage] as const)
              : calcPage === 'montecarlo'
              ? (mcPage === 'main' ? ['main'] as const : [mcPage] as const)
              : calcPage === 'clinical' ? CLINICAL_SUBTABS as readonly string[]
              : calcPage === 'mdss' ? ['mdss'] as const
              : ['overview'] as const)
            : mainTab === 'tz_spec' ? ['overview', 'tz_3d', 'analyses'] as const
            : mainTab === 'clinical' ? CLINICAL_SUBTABS as readonly string[]
            : ['info', 'reports'] as readonly string[]
          ).map(t => (
          <button key={t} onClick={() => {
            if (mainTab === 'calculations') {
              if (calcPage === 'basic') setBasicPage(t as any);
              else if (calcPage === 'montecarlo') setMcPage(t as any);
              else setSubTab(t as any);
            } else {
              setSubTab(t as any);
            }
          }} className="risk-subtab" data-active={subTab === t || basicPage === t || mcPage === t} style={{
            minHeight: 44, padding: '10px 16px', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.16s ease',
            background: (subTab === t || basicPage === t || mcPage === t) ? 'linear-gradient(135deg, rgba(139,92,246,0.30), rgba(139,92,246,0.12))' : 'rgba(255,255,255,0.06)',
            border: (subTab === t || basicPage === t || mcPage === t) ? '1px solid rgba(139,92,246,0.55)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: (subTab === t || basicPage === t || mcPage === t) ? '0 0 14px rgba(139,92,246,0.30)' : 'none',
            borderRadius: 999, marginBottom: 0,
            color: '#fff',
          }}>
            {SUBTAB_LABELS[t] || t}
          </button>
        ))}
              </div>
              {/* ⚠️ Дисклеймер — вверху «Другие методы расчёта» и «Механизм-ориентированной модели» */}
              {(mainTab === 'calculations' || mainTab === 'tz_spec') && <RiskDisclaimer />}
              {/* BASIC CALC — multi-page */}
              {mainTab === 'calculations' && calcPage === 'basic' && riskResult && renderBasicCalc()}
              {/* MONTE CARLO — multi-page */}
              {mainTab === 'calculations' && calcPage === 'montecarlo' && renderMonteCarlo()}
              {/* Hysteresis — PK/PD simulation visible in Monte Carlo */}
              {mainTab === 'calculations' && calcPage === 'montecarlo' && (mcPage === 'main' || mcPage === 'pk') && <HysteresisChart />}
              {/* Predictive Analytics — ARIMA + Holt-Winters */}
              {mainTab === 'calculations' && calcPage === 'montecarlo' && (mcPage === 'main') && <PredictiveAnalytics />}
              {/* CLINICAL — внутри Другие методы расчета */}
              {mainTab === 'calculations' && calcPage === 'clinical' && renderContent()}
              {/* TZ SPEC METHOD — новая вкладка */}
              {mainTab === 'tz_spec' && <RiskSpecMethod subTab={subTab} />}
              {/* All other content */}
              {!((mainTab === 'calculations' && (calcPage === 'basic' || calcPage === 'montecarlo' || calcPage === 'clinical')) || mainTab === 'tz_spec') && renderContent()}
            </>
          )}
      </div>
         </div>
       )}

     </div>
   );
};

// ── MDSS Risk Display Component ──
export const MDSSRiskDisplay: React.FC = () => {
  const linked = useDataLink();
  const courseWeeks = Math.max(1, (linked.course || []).reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 4));
  const [tWeeks, setTWeeks] = useState(courseWeeks);
  // Курс/профиль подгружаются из IndexedDB позже маунта: подтягиваем значения
  // только пока пользователь не трогал поля (иначе затёрли бы ручной ввод).
  const [tWeeksTouched, setTWeeksTouched] = useState(false);
  useEffect(() => { if (!tWeeksTouched) setTWeeks(courseWeeks); }, [courseWeeks]);
  const [genetics, setGenetics] = useState<string[]>([]);
  const [mdssResult, setMdssResult] = useState<MDSSOutput | null>(null);
  const [autoRun, setAutoRun] = useState(false);

  // Auto-fill genetics from profile (dep, а не []: профиль тоже приезжает позже)
  useEffect(() => {
    const s = linked.profile?.settings;
    const genMap = Object.keys(s?.genetics || {}).filter(k => !!(s?.genetics as any)?.[k]);
    if (genMap.length > 0) setGenetics(genMap);
  }, [linked.profile]);

  // Compute weeksSinceLab from linked dates — memo + округление до часа:
  // сырой float от Date.now() менялся каждый рендер и вместе с setMdssResult
  // в эффекте ниже давал бесконечный цикл при включённом авто-режиме.
  const weeksSinceLab = useMemo(() => {
    const labs = linked.labs || [];
    if (!labs.length) return 52;
    const dates = labs.map(l => l.date).filter(Boolean).sort().reverse();
    if (!dates[0]) return 52;
    const ms = Date.now() - new Date(dates[0]).getTime();
    return Math.round(Math.max(0, ms / (7 * 24 * 3600 * 1000)) * 24) / 24;
  }, [linked.labs]);

  // Auto-run: labs в зависимостях — иначе правка анализов при включённом
  // авто-режиме молча оставляла старый расчёт (linked.labs из стора стабилен
  // по ссылке, лишних пересчётов нет).
  useEffect(() => {
    if (!autoRun) return;
    handleRun();
  }, [autoRun, tWeeks, genetics, weeksSinceLab, linked.labs]);

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
    // NOTE: минимум 1 неделя — очищенное поле даёт 0, движок ждёт tWeeks >= 1.
    setMdssResult(runMDSS({ tWeeks: Math.max(1, tWeeks), weeksSinceLab, genetics, markers }));
  };

  const ZONE_COLORS: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };

  return (
    <div className="risk-mdss">
      <div className="card" style={{ marginBottom: 12, padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize:15, fontWeight:800, color:'#fff' }}>🧬 MDSS — Medical Decision Support System</h3>
        <p style={{ fontSize: 12, color: '#fff', margin: '0 0 4px 0', lineHeight:1.5 }}>
          Hill → Monte Carlo (10K) → Logistic Sigmoid. Прогноз необратимого отказа органов.
        </p>
        <p style={{ fontSize: 12, color: '#fff', margin: 0 }}>
          ⚡ Работает в браузере (TypeScript). Python-сервер не требуется.
        </p>
      </div>

      {!autoRun ? (
        <div className="card" style={{ marginBottom: 12, padding:16, textAlign: 'center', borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
          <p style={{ fontSize: 13, color: '#fff', marginBottom: 12, lineHeight:1.5 }}>
            Нажмите кнопку для запуска анализа. Можно без ввода данных — использует консервативные значения.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap:'wrap' }}>
            <button onClick={() => { setAutoRun(true); setTimeout(handleRun, 50); }} style={{
              minHeight:48, padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 800, fontSize: 14, boxShadow:'0 0 18px rgba(139,92,246,0.40)',
            }}>▶ Запустить анализ</button>
            <button onClick={() => { setAutoRun(false); handleRun(); }} style={{
              minHeight:48, padding: '12px 24px', borderRadius: 999, border: '1px solid rgba(139,92,246,0.45)', cursor: 'pointer',
              background: 'rgba(139,92,246,0.10)', color: '#fff', fontWeight: 800, fontSize: 14,
            }}>Запустить один раз</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12, padding:14, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight:700, color: '#fff' }}>Недель экспозиции</label>
              <input type="number" min={0} max={100} value={tWeeks} onChange={e => { setTWeeksTouched(true); setTWeeks(parseFloat(e.target.value) || 0); }}
                style={{ width: '100%', minHeight:44, marginTop:4, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontSize: 16, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight:700, color: '#fff' }}>Генетика (через запятую)</label>
              <input type="text" value={genetics.join(', ')} onChange={e => setGenetics(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="APOL1_mutation, COMT_slow..."
                style={{ width: '100%', minHeight:44, marginTop:4, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontSize: 16, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleRun} style={{
              flex: 1, minHeight:44, padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(139,92,246,0.40)', cursor: 'pointer',
              background: 'rgba(139,92,246,0.14)', color: '#fff', fontWeight: 800, fontSize: 13,
            }}>🔄 Пересчитать</button>
            <button onClick={() => setAutoRun(false)} style={{
              minHeight:44, padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontWeight:800,
            }}>Выкл авто</button>
          </div>
          {linked.labs?.length === 0 && (
            <div style={{ fontSize: 12, color: '#fff', marginTop: 8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.24)', borderRadius:10, padding:'8px 10px' }}>⚠ Без анализов — консервативные оценки. Введите данные для точного прогноза.</div>
          )}
          {linked.labs?.length > 0 && (
            <div style={{ fontSize: 12, color: '#fff', marginTop: 8 }}>✅ Использовано {linked.labs.length} анализов из вашего профиля</div>
          )}
        </div>
      )}

      {mdssResult && (
        <>
          {/* Compliance penalty banner */}
          {mdssResult.compliancePenalty > 1 && (
            <div className="card" style={{
              marginBottom: 12, padding: '10px 14px', borderRadius:14, background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.20)', borderLeft: '4px solid #ef4444',
            }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, lineHeight:1.5 }}>
                ⚠ Штраф за просрочку анализов: ×{mdssResult.compliancePenalty}
                ({mdssResult.weeksSinceLastLab} нед без анализов)
              </div>
            </div>
          )}

          {/* Overall risk */}
          <div className="card" style={{ marginBottom: 12, padding:16, textAlign: 'center', borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize: 13, fontWeight:700, color: '#fff', marginBottom: 6 }}>
              Максимальный риск по всем 14 системам
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight:1, color: ZONE_COLORS[mdssResult.overallAlertLevel] }}>
              {mdssResult.overallMaxRisk}%
            </div>
            <div style={{ fontSize: 12, color: '#fff', marginTop: 6 }}>
              {mdssResult.allMarkersUsed.length} биомаркеров · {Object.keys(mdssResult.organSystemsReport).length} систем
            </div>
          </div>

          {/* Sorted organs */}
          {mdssResult.sortedOrgans.map(r => (
            <div key={r.organKey} className="card risk-mdss-organ" style={{
              marginBottom: 10, padding:'12px 14px', borderRadius:16, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', borderLeft: `4px solid ${ZONE_COLORS[r.alertLevel]}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color:'#fff', minWidth:0 }}>{r.organName}</span>
                <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 999, background: `${ZONE_COLORS[r.alertLevel]}22`, border:`1px solid ${ZONE_COLORS[r.alertLevel]}44`, color: '#fff', fontWeight: 800, whiteSpace:'nowrap', flexShrink:0 }}>
                  {Math.round(r.riskPercentage)}% — {r.status.split('(')[0].trim()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, fontSize: 12, color: '#fff', marginBottom: 8 }}>
                <div>Hill: {r.hillScore} · MC P95: {r.severity95}</div>
                <div>Z: {r.zTotal} · Gen: ×{r.geneticFactor}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, r.riskPercentage)}%`, height: '100%', background: ZONE_COLORS[r.alertLevel], borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 12, color: '#fff', marginTop: 6, lineHeight:1.5 }}>
                Маркеры ({r.markersUsed.length}): {r.markersUsed.join(', ')}
              </div>
            </div>
          ))}

          {/* Missing markers */}
          {mdssResult.markersNotFound.length > 0 && (
            <div className="card" style={{
              marginBottom: 12, padding: '12px 14px', borderRadius:16, background: 'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                🧪 Не сдано ({mdssResult.markersNotFound.length}): сдайте эти маркеры для точного прогноза
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mdssResult.markersNotFound.map(m => (
                  <span key={m} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color: '#fff', fontSize: 12, fontWeight:600 }}>
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
export const ComplianceDisplay: React.FC = () => {
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

  const [cycleStart, setCycleStart] = useState(courseStartDate);
  useEffect(() => { setCycleStart(courseStartDate); }, [courseStartDate]);

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

  // Auto-run — use latestLabDate directly, no stale state
  useEffect(() => {
    if (!cycleStart || !latestLabDate) return;
    const result = analyzeWithCompliance({
      cycleStartDate: cycleStart,
      latestLabDate,
      currentDate: today,
      genetics,
      markers,
      kAggressionOverride: kAgg,
      zCritOverride: zCrit,
    });
    setReport(result);
    // NOTE: зависимость — весь markers, а не markers.length: правка значения
    // анализа при том же количестве иначе не пересчитывала отчёт.
  }, [cycleStart, latestLabDate, markers, genetics]);

  const msPerWeek = 7 * 24 * 3600 * 1000;
  const weeksSinceLab = Math.max(0, (new Date(today).getTime() - new Date(latestLabDate).getTime()) / msPerWeek);
  const compliance = getComplianceStatus(weeksSinceLab);
  const complianceColors: Record<string, string> = { compliant:'#00e68a', overdue:'#f97316', critical:'#ef4444' };

  return (
    <div className="risk-compliance">
      {/* Info card */}
      <div style={{ marginBottom:12, padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
        <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width:32, height:32, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:'#4ade80' }}><NativeIcon name="clock" size={16} /></span> Комплаенс — Data Decay Engine</div>
        <div style={{ fontSize:12, color:'#fff', lineHeight:1.55 }}>
          Отслеживание дисциплины сдачи анализов. Штрафной коэффициент за устаревшие данные. Даты вычисляются автоматически из курса и анализов.
        </div>
      </div>

      {/* Auto dates card */}
      <div style={{ marginBottom:12, padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4 }}>Дата начала курса (авто)</div>
            <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontSize:13, fontWeight:700 }}>
              🔒 {courseStartDate}
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4 }}>Последние анализы (авто)</div>
            <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color:'#fff', fontSize:13, fontWeight:700 }}>
              🔒 {latestLabDate}
            </div>
          </div>
        </div>

        {/* Compliance status */}
        <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:6, padding:'12px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4 }}>Статус комплаенса</div>
            <div style={{ fontSize:15, fontWeight:800, color:complianceColors[compliance] }}>
              {compliance === 'compliant' ? '✅ В норме' : compliance === 'overdue' ? '⚠️ Просрочен' : '🔴 Критический'}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Недель с анализов</div>
            <div style={{ fontSize:22, fontWeight:800, color:complianceColors[compliance] }}>{weeksSinceLab.toFixed(1)}</div>
          </div>
        </div>

        {/* Missing markers warning */}
        {missingMarkers.length > 0 && (
          <div style={{ marginTop:10, padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.24)' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:4 }}>⚠️ Не хватает маркеров ({missingMarkers.length})</div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.55 }}>
              {missingMarkers.slice(0, 10).join(', ')}{missingMarkers.length > 10 ? ` +${missingMarkers.length - 10}` : ''}
            </div>
            <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>
              Штраф за неполные анализы будет применён к соответствующим системам
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {report && (
        <>
          <div style={{ marginBottom:12, padding:'12px 14px', borderRadius:16, borderLeft:'4px solid ' + complianceColors[report.systemWarnings.complianceStatus],
            background: report.systemWarnings.complianceStatus === 'compliant' ? 'rgba(0,230,138,0.07)' : report.systemWarnings.complianceStatus === 'critical' ? 'rgba(239,68,68,0.09)' : 'rgba(249,115,22,0.07)',
            borderTop:'1px solid rgba(255,255,255,0.09)', borderRight:'1px solid rgba(255,255,255,0.09)', borderBottom:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:6 }}>⚠️ Системные предупреждения</div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.55, marginBottom:8 }}>{report.systemWarnings.disclaimer}</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>
              {report.systemWarnings.penaltyStatus}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:6, fontSize:12, fontWeight:600, color:'#fff' }}>
              <span>{report.systemWarnings.weeksOnCycle} нед на курсе</span>
              <span>{report.systemWarnings.weeksSinceLastLab} нед с анализов</span>
            </div>
          </div>

          <div style={{ padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:10 }}>📊 Анализ с штрафом</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, textAlign:'center', marginBottom:10 }}>
              <div style={{ padding:'14px 10px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Коэффициент штрафа</div>
                <div style={{ fontSize:28, fontWeight:900, marginTop:4, color:report.riskAnalysis.penaltyMultiplierApplied > 1 ? '#ef4444' : '#00e68a' }}>
                  {report.riskAnalysis.penaltyMultiplierApplied.toFixed(1)}×
                </div>
              </div>
              <div style={{ padding:'14px 10px', borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Вероятность отказа</div>
                <div style={{ fontSize:28, fontWeight:900, marginTop:4, color:report.riskAnalysis.probabilityPercent >= 80 ? '#ef4444' : report.riskAnalysis.probabilityPercent >= 50 ? '#f97316' : '#00e68a' }}>
                  {Math.round(report.riskAnalysis.probabilityPercent)}%
                </div>
              </div>
            </div>
            <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100,report.riskAnalysis.probabilityPercent)}%`, height:'100%', background:report.riskAnalysis.probabilityPercent >= 80 ? '#ef4444' : report.riskAnalysis.probabilityPercent >= 50 ? '#f97316' : '#00e68a', borderRadius:999, transition:'width 0.5s' }} />
            </div>
          </div>
        </>
      )}

      {!report && (
        <div style={{ textAlign:'center', padding:30, color:'#fff', fontSize:13 }}>
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
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ analyzeClinicalRisks }, { mapStackToPathologies }, { SYSTEM_GROUPS, CLINICAL_PATHOLOGIES }] = await Promise.all([
        import('../../engines/clinical-analyzer.engine'),
        import('../../engines/drug-mapper.engine'),
        import('../../data/clinical-pathology-db'),
      ]);

      const compounds = course.map(c => (c.substanceId||'').toLowerCase());
      const markers = labs.map(l => ({ code: l.code || l.name, value: l.value }));
      const genetics = Object.keys(s?.genetics || {}).filter(k => !!(s?.genetics as any)?.[k]);
      const labDates = labs.map(l => l.date).filter(Boolean).sort().reverse();
      const weeksSinceLab = labDates[0] ? (Date.now() - new Date(labDates[0]).getTime()) / (7 * 24 * 3600 * 1000) : 52;
      const tWeeks = course.length > 0 ? course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0) : 4;

      // Run clinical analysis
      const clinical = analyzeClinicalRisks({ compounds, markers, tWeeks: Math.max(1, tWeeks), weeksSinceLab, genetics });

      // Also run drug mapper to capture ALL drug-based pathologies
      const mapperDrugs = course.map(c => ({ name: (c.substanceId||'').toLowerCase(), dosageMg: c.doseValue }));
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
    } catch (e) { setError('Ошибка загрузки модулей. Попробуйте перезагрузить.'); console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (!result && !error) handleAnalyze(); }, []);

  const zoneColors: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' };

  return (
    <div className="risk-clinical">
      <div className="card" style={{ marginBottom: 12, padding:16, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize:15, fontWeight:800, color:'#fff' }}>🏥 Клинические патологии</h3>
        <p style={{ fontSize: 12, color: '#fff', margin: 0, lineHeight:1.5 }}>
          28 патологий в 8 системах. Hill → MC (10K) → Sigmoid.
        </p>
      </div>

      {labs.length === 0 && course.length === 0 && !result && (
        <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.26)', marginBottom: 12, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 1.5 }}>
          ⚠️ Для расчёта клинических рисков необходимы данные анализов и/или активный курс. Перейдите на вкладку <b>«Анализы»</b>, чтобы добавить лабораторные данные.
        </div>
      )}

      {!result && (
        <button onClick={handleAnalyze} disabled={loading} style={{ width: '100%', minHeight:52, padding: '12px 16px', borderRadius: 999, border: 'none', cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 10, boxShadow:'0 8px 22px rgba(139,92,246,0.35)' }}>
          {loading ? '⏳ Анализ...' : course.length === 0 && labs.length === 0 ? '▶ Запустить (нет данных курса)' : '▶ Запустить клинический анализ'}
        </button>
      )}
      {error && <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.24)', color: '#fff', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</div>}

      {result && (
        <>
          <div className="card" style={{ marginBottom: 12, padding:16, textAlign: 'center', borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ fontSize: 13, fontWeight:700, color: '#fff', marginBottom:6 }}>Максимальный риск</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight:1, color: result.overallMaxRisk >= 80 ? '#ef4444' : result.overallMaxRisk >= 50 ? '#f97316' : '#22c55e' }}>
              {result.overallMaxRisk}%
            </div>
            <div style={{ fontSize: 12, color: '#fff', marginTop:6 }}>{result.markersAnalyzed} маркеров · {result.results.length} патологий</div>
          </div>
          <button onClick={handleAnalyze} style={{ width: '100%', minHeight:44, padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight:800, marginBottom: 10 }}>
            🔄 Пересчитать
          </button>

          {result.systems.map((system: any) => (
            <details key={system.systemKey} className="risk-clinical-system" style={{ marginBottom: 10, borderRadius:16, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', overflow:'hidden' }}>
              <summary style={{ padding: '12px 14px', minHeight:56, borderRadius: 0, cursor: 'pointer', background: 'transparent', border: 'none', borderBottom:'1px solid rgba(255,255,255,0.07)', fontSize: 14, fontWeight: 800, color:'#fff', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                {system.icon} {system.systemName}
                <span style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 999, fontSize: 12, background: system.maxRisk >= 80 ? 'rgba(239,68,68,0.14)' : system.maxRisk >= 50 ? 'rgba(249,115,22,0.14)' : 'rgba(0,230,138,0.10)', border:`1px solid ${system.maxRisk >= 80 ? 'rgba(239,68,68,0.30)' : system.maxRisk >= 50 ? 'rgba(249,115,22,0.30)' : 'rgba(0,230,138,0.24)'}`, color: '#fff', fontWeight: 800 }}>
                  {Math.round(system.maxRisk)}%
                </span>
              </summary>
              <div style={{ padding: '10px 10px 12px' }}>
                {system.pathologies.map((r: any) => (
                  <div key={r.pathologyId} className="card" style={{ marginBottom: 8, borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderLeft: `4px solid ${zoneColors[r.alertLevel]}`, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:8, fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color:'#fff', minWidth:0 }}>{r.pathologyName}</span>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: `${zoneColors[r.alertLevel]}22`, border:`1px solid ${zoneColors[r.alertLevel]}44`, color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace:'nowrap' }}>{r.riskPercent}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6, fontSize: 12, color: '#fff' }}>
                      <div>Hill: {r.hillScore}</div><div>MC95: {r.severity95}</div><div>Маркеры: {r.markersUsed.length}</div>
                    </div>
                    {r.contributingCompounds.length > 0 && (
                      <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>Препараты: {r.contributingCompounds.join(', ')}</div>
                    )}
                    {r.alertLevel >= 2 && <div style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>🔬 {r.instrumental}</div>}
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
export const LabsRisksTab: React.FC = () => {
  const linked = useDataLink();
  const labs = linked.labs || [];
  const hasLabs = labs.length > 0;
  const [riskSections, setRiskSections] = useState<Record<string,boolean>>({ pharma:true, indices:true, systems:true, markers:true });

  // NOTE: объявлено ДО labRisks — useMemo-фабрика выполняется синхронно при
  // рендере, позже в коде константа уходила бы в TDZ (ReferenceError глотался
  // try/catch → labRisks всегда null при реальных анализах).
  const LAB_SYSTEM_GROUPS: Record<string,string[]> = {
    hepatic:['ALT','AST','GGT','ALP','BILIRUBIN_TOTAL','BIL','ALB'], renal:['CREATININE','BUN','EGFR','PROTEIN_TOTAL','TP','UA','UACR'],
    endocrine:['TSH','FT3','FT4','TESTOSTERONE','TT','E2','ESTRADIOL','PRL','PROLACTIN','CORTISOL','LH','FSH','SHBG','IGF1'],
    hematologic:['HGB','HCT','PLT','WBC','FERRITIN'], cardio:['LDL','HDL','TG','CRP','HOMOCYSTEINE'],
    metabolic:['GLU','GLUCOSE','HBA1C','INSULIN','INS','HOMA','VITD'], reproductive:['PSA','INHB','AMH'], neuro:['HOMOCYSTEINE'], other:[]
  };

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
    if (v===null) return '#fff';
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
      const ref = UCUM_MAP[lab.code] || UCUM_MAP[lab.code.toUpperCase()];
      if (!ref?.uln || !ref?.lln) continue;
      const coeff = ref.coeff || 1;
      const norm = lab.value * coeff;
      // Prefer stored reference ranges from parsed lab forms
      const uln = lab.refHigh !== undefined ? lab.refHigh * coeff : ref.uln;
      const lln = lab.refLow !== undefined ? lab.refLow * coeff : ref.lln;
      let deviation = 0;
      if (norm > uln) deviation = (norm - uln) / uln;
      else if (norm < lln) deviation = -((lln - norm) / lln);
      if (Math.abs(deviation) > 0.01) {
        let sys = 'other';
        for (const [s, codes] of Object.entries(LAB_SYSTEM_GROUPS)) {
          if (codes.includes(lab.code.toUpperCase())) { sys = s; break; }
        }
        devs.push({ code: lab.code, name: ref.name || lab.code, value: lab.value, uln, lln, deviation: Math.round(deviation*100), system: sys });
      }
    }
    devs.sort((a,b) => Math.abs(b.deviation)-Math.abs(a.deviation));
    return { systemBreakdown: sb, markerDeviations: devs, deviationCount: devs.length };
    } catch { return null; }
  }, [hasLabs, labs]);

  const sysColors: Record<string,string> = {
    hepatic:'#22c55e', renal:'#3b82f6', endocrine:'#a855f7', hematologic:'#ef4444',
    cardio:'#f97316', metabolic:'#eab308', reproductive:'#ec4899', neuro:'#14b8a6', other:'#6b7280'
  };

  return (
    <div className="risk-labs">
      {!hasLabs && (
        <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.26)', marginBottom: 12, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 1.5 }}>
          ⚠️ Для расчёта рисков по анализам необходимо добавить лабораторные данные. Перейдите в раздел <b>«Анализы»</b> в главной навигации, чтобы внести результаты.
        </div>
      )}
      {[
        {key:'pharma',icon:'pill' as NativeIconName,title:'Лабораторно-фармацевтические риски',
         body: labPharmaAlerts.length>0 ? <div style={{display:'grid',gap:8}}>{labPharmaAlerts.map((a,i)=>
          <div key={i} style={{padding:'10px 12px',borderRadius:12,background:a.severity==='critical'?'rgba(239,68,68,0.09)':a.severity==='high'?'rgba(249,115,22,0.09)':'rgba(234,179,8,0.09)',border:`1px solid ${a.severity==='critical'?'rgba(239,68,68,0.26)':a.severity==='high'?'rgba(249,115,22,0.26)':'rgba(234,179,8,0.26)'}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:800,color:'#fff'}}>{a.marker} × {a.drugCause?.join(', ')}</span>
              <span style={{fontSize:11,fontWeight:800,padding:'4px 10px',borderRadius:999,background:a.severity==='critical'?'#ef4444':a.severity==='high'?'#f97316':'#eab308',color:'#fff',whiteSpace:'nowrap'}}>{a.severity==='critical'?'КРИТ':a.severity==='high'?'ВЫСОК':'МОНИТ'}</span>
            </div><div style={{color:'#fff',fontSize:12,marginTop:4,lineHeight:1.5}}>{a.recommendation}</div></div>)}</div> :
          <div style={{fontSize:12,color:'#fff',textAlign:'center',padding:'14px 0'}}>{hasLabs?'Не обнаружены':'Нет данных анализов — показаны базовые риски'}</div>},
        {key:'indices',icon:'grid' as NativeIconName,title:'Композитные индексы здоровья',
         body:<div style={{display:'grid',gap:8}}>{[{label:'ASI (Анаболический синтез)',desc:'Способность к анаболизму',val:ASI,inv:true},{label:'HMI (Гепатический метаболизм)',desc:'Стресс печени',val:HMI,inv:false},{label:'CR (Кардиориск)',desc:'Липиды + воспаление',val:CR,inv:false}].map(item=>
          <div key={item.label} style={{padding:'12px',borderRadius:14,background:item.val!==null?`rgba(${item.inv?(item.val>=70?'34,197,94':item.val>=40?'234,179,8':'239,68,68'):(item.val<=30?'34,197,94':item.val<=60?'234,179,8':'239,68,68')},0.08)`:'rgba(255,255,255,0.04)',border:item.val!==null?`1px solid rgba(${item.inv?(item.val>=70?'34,197,94':item.val>=40?'234,179,8':'239,68,68'):(item.val<=30?'34,197,94':item.val<=60?'234,179,8':'239,68,68')},0.24)`:'1px solid rgba(255,255,255,0.09)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
              <div><div style={{fontSize:13,fontWeight:800,color:'#fff'}}>{item.label}</div><div style={{fontSize:11,color:'#fff',marginTop:3}}>{item.desc}</div></div>
              {item.val!==null ? <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:22,fontWeight:900,color:statusColor(item.val,item.inv)}}>{item.val}%</div><div style={{fontSize:11,color:'#fff',fontWeight:700}}>{statusLabel(item.val,item.inv)}</div></div> : <div style={{fontSize:12,color:'#fff'}}>Нет данных</div>}
            </div></div>)}</div>},
        {key:'systems',icon:'alertTriangle' as NativeIconName,title:'Риски по системам организма',
         body: labRisks && Object.values(labRisks.systemBreakdown).some(v=>v.net>0) ? <div style={{display:'grid',gap:8}}>{Object.entries(labRisks.systemBreakdown).filter(([,v])=>v.net>0).sort(([,a],[,b])=>b.net-a.net).map(([sys,val])=>{
          const lvl=val.net<=25?'low':val.net<=50?'medium':val.net<=75?'high':'critical';
          const lc={low:{bg:'rgba(34,197,94,0.08)',text:'#22c55e',bar:'#22c55e'},medium:{bg:'rgba(234,179,8,0.08)',text:'#eab308',bar:'#eab308'},high:{bg:'rgba(249,115,22,0.08)',text:'#f97316',bar:'#f97316'},critical:{bg:'rgba(239,68,68,0.08)',text:'#ef4444',bar:'#ef4444'}}[lvl];
          return <div key={sys} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:12,background:lc.bg,border:`1px solid ${lc.bg.replace('0.08','0.18')}`}}>
            <span style={{fontSize:12,fontWeight:800,minWidth:64,color:'#fff'}}>{sysLabels[sys]||sys}</span>
            <div style={{flex:1,height:8,background:'rgba(255,255,255,0.08)',borderRadius:999,overflow:'hidden'}}><div style={{width:`${Math.min(100,val.net)}%`,height:'100%',background:lc.bar,borderRadius:999,transition:'width 0.4s ease'}}/></div>
            <span style={{fontSize:13,fontWeight:800,color:lc.text,minWidth:40,textAlign:'right'}}>{Math.round(val.net)}%</span></div>})}</div> :
          <div style={{fontSize:12,color:'#fff',textAlign:'center',padding:'14px 0'}}>{hasLabs?'Все системы в норме':'Нет данных анализов — отображаются базовые значения'}</div>},
        {key:'markers',icon:'flask' as NativeIconName,title:'Маркеры с отклонениями',
         body: labRisks && labRisks.deviationCount>0 ? <div style={{display:'grid',gap:3}}>{labRisks.markerDeviations.map(m=>{
          const isHigh=m.deviation>0; const absDev=Math.abs(m.deviation);
          const dl=absDev<=20?'low':absDev<=50?'medium':absDev<=100?'high':'critical';
          const dc={low:{bg:'rgba(34,197,94,0.06)',text:'#22c55e'},medium:{bg:'rgba(234,179,8,0.06)',text:'#eab308'},high:{bg:'rgba(249,115,22,0.06)',text:'#f97316'},critical:{bg:'rgba(239,68,68,0.06)',text:'#ef4444'}}[dl];
          return <div key={m.code+m.value} style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,padding:'10px',borderRadius:12,background:dc.bg,border:`1px solid ${dc.bg.replace('0.06','0.14')}`}}>
            <span style={{fontSize:11,color:'#fff',fontWeight:700,minWidth:52}}>{sysLabels[m.system]||m.system}</span>
            <span style={{fontSize:13,fontWeight:800,flex:1,minWidth:0,color:'#fff'}}>{m.name}</span>
            <span style={{fontSize:11,color:'#fff'}}>{m.lln}–{m.uln}</span>
            <span style={{fontSize:13,fontWeight:800,color:dc.text}}>{m.value} <span style={{fontSize:11,padding:'3px 8px',borderRadius:999,fontWeight:800,background:dc.text+'26',color:'#fff', border:`1px solid ${dc.text}44`}}>{isHigh?'↑':'↓'}{absDev}%</span></span></div>})}</div> :
          <div style={{fontSize:12,color:'#fff',textAlign:'center',padding:'14px 0'}}>{hasLabs?'Все маркеры в норме':'Нет данных анализов — добавьте анализы для просмотра отклонений'}</div>},
      ].map(b => (
        <div key={b.key} className="card risk-labs-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
          <button onClick={() => setRiskSections(s => ({...s, [b.key]: !s[b.key]}))} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight:56, padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
            background: riskSections[b.key] ? 'rgba(255,255,255,0.04)' : 'transparent', border: 'none', borderBottom: riskSections[b.key] ? '1px solid rgba(255,255,255,0.07)' : 'none', color: '#fff', fontSize: 14, fontWeight: 800,
          }}>
            <span style={{ display: 'inline-flex', transition: 'transform 0.2s', transform: riskSections[b.key] ? 'rotate(90deg)' : 'rotate(0deg)', color: '#fff', width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)' }}><NativeIcon name="chevronRight" size={13} /></span>
            <span style={{ display: 'inline-flex', color: '#fff' }}><NativeIcon name={b.icon} size={15} /></span> {b.title}
          </button>
          {riskSections[b.key] && <div style={{ padding: '12px 12px 14px' }}>{b.body}</div>}
        </div>
      ))}
      {!hasLabs && <div className="card" style={{ textAlign: 'center', padding: 20, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ marginBottom: 8, color: '#fff', display: 'flex', justifyContent: 'center' }}><NativeIcon name="flask" size={30} /></div>
        <div style={{ fontSize: 14, fontWeight:800, color: '#fff', marginBottom: 6 }}>Нет данных анализов</div>
        <div style={{ fontSize: 12, color: '#fff', lineHeight:1.5 }}>Отображаются базовые риски без точных лабов. Для расчёта штрафа используйте кнопку «Без анализов» в общем обзоре.</div></div>}
    </div>
  );
};