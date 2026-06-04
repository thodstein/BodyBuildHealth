import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RISK_SYSTEMS, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell } from '../../core/types';
import { calculateRisks, calculateAggregatedRisks, type AggregatedRisk } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients, PenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import HumanBody3D from '../components/HumanBody3D';
import { getRiskColor } from '../../core/utils/risk-colors';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';

const RISK_MECHANISMS = Object.values(MECHANISM_INFO);

const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label.split(' ').slice(0, 2).join(' ')])
);

const SYSTEM_FULL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label])
);

const getCellColor = (raw: number, net: number): { bg: string; text: string } => {
  const v = net > 0 ? net : raw;
  if (v < 20) return { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' };
  if (v < 40) return { bg: 'rgba(132,204,22,0.15)', text: '#84cc16' };
  if (v < 60) return { bg: 'rgba(234,179,8,0.15)', text: '#eab308' };
  if (v < 80) return { bg: 'rgba(249,115,22,0.2)', text: '#f97316' };
  return { bg: 'rgba(239,68,68,0.2)', text: '#ef4444' };
};

type MatrixData = Record<string, MechanismCell>;

interface RiskSnapshot {
  date: string;
  overallRaw: number;
  overallNet: number;
  systems: Record<string, { raw: number; net: number }>;
}

const RISK_HISTORY_KEY = 'risk_history';
const MAX_HISTORY = 12;

function loadRiskHistory(): RiskSnapshot[] {
  try {
    const raw = localStorage.getItem(RISK_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveRiskSnapshot(snapshot: RiskSnapshot) {
  const history = loadRiskHistory();
  const lastWeek = history.length > 0 ? history[history.length - 1] : null;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (lastWeek && (new Date(snapshot.date).getTime() - new Date(lastWeek.date).getTime()) < weekMs) {
    history[history.length - 1] = snapshot;
  } else {
    history.push(snapshot);
  }
  while (history.length > MAX_HISTORY) history.shift();
  localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history));
}

type RiskTab = 'overview' | 'systems' | 'body' | 'mechanisms' | 'labs' | 'overtraining' | 'timeline' | 'details';

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [rawRiskResult, setRawRiskResult] = useState<RiskResult | null>(null);
  const [coverageMap, setCoverageMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ system: string; mechanism: number | null } | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [activeSubstances, setActiveSubstances] = useState<Record<string, { dosePerWeek: number }>>({});
  const [tab, setTab] = useState<RiskTab>('overview');
  const [penalty, setPenalty] = useState<PenaltyCoefficients | null>(null);
  const [graphSystem, setGraphSystem] = useState<string>('__overall');
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement>(null);
  const [labRisks, setLabRisks] = useState<Record<string, number>>({});
  const [labIndexDetails, setLabIndexDetails] = useState<Record<string, LabIndexDetail> | null>(null);
  const [aggregatedRisks, setAggregatedRisks] = useState<AggregatedRisk | null>(null);

  const matrixData = useMemo<MatrixData>(() => {
    if (!riskResult) return {};
    return riskResult.mechanismDetail || {};
  }, [riskResult]);

  useEffect(() => {
    const computeRisk = async () => {
      try {
        const prof = linked.profile;
        if (!prof || !prof.id) { setLoading(false); return; }
        const genetics: Record<string, string> = prof.settings?.genetics ?? {};
        const nutritionFactor = prof.settings?.nutritionFactor ?? 1.0;
        const trainingFactor = prof.settings?.trainingFactor ?? 1.0;
        const phase = prof.settings?.phase ?? 'baseline';
        const drugs = linked.activeDrugs;
        setActiveSubstances(drugs);
        const rawResult = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: drugs, supportCoverage: {} });
        setRawRiskResult(rawResult);
        const covMap = linked.supportCoverage;
        setCoverageMap(covMap);
        const labRiskResult = calculateRiskFromAnalyses(linked.labs);
        const labRaw: Record<string, number> = {};
        RISK_SYSTEMS.forEach((s) => { labRaw[s] = labRiskResult.systemContributions[s] ?? 0; });
        setLabRisks(labRaw);
        if (linked.labs.length > 0) {
          setLabIndexDetails(computeLabIndexDetails(linked.labs));
        }
        const finalResult = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: drugs, supportCoverage: covMap });
        if (finalResult.systemBreakdown) {
          for (const sys of RISK_SYSTEMS) {
            if (finalResult.systemBreakdown[sys]) {
              finalResult.systemBreakdown[sys].raw = Math.max(finalResult.systemBreakdown[sys].raw, labRaw[sys] ?? 0);
              finalResult.systemBreakdown[sys].net = Math.max(finalResult.systemBreakdown[sys].net, labRaw[sys] ?? 0);
            }
          }
          if (finalResult.mechanismDetail) {
            for (const key of Object.keys(finalResult.mechanismDetail)) {
              if (finalResult.mechanismDetail[key]) {
                const sys = key.split('_')[0];
                const labVal = labRaw[sys] ?? 0;
                if (labVal > 0) {
                  finalResult.mechanismDetail[key].net = Math.max(finalResult.mechanismDetail[key].net, labVal / 7);
                }
              }
            }
          }
        }
        const courseWeek = Math.max(0, Math.floor((Date.now() - new Date(prof.settings?.courseStartDate ?? Date.now()).getTime()) / (7*24*60*60*1000)));
        const { db } = await import('../../core/db');
        await db.init();
        const diagEntries = await db.getAll<{id:string;type?:string}>('diagnostics_log').catch(() => [] as {id:string;type?:string}[]);
        const diagsDone = diagEntries.map(d => d.type ?? d.id).filter(Boolean) as string[];
        const pen = calculatePenaltyCoefficients(phase, linked.labs, diagsDone, courseWeek, linked.course, prof.settings?.forceNoLabsPenalty);
        setPenalty(pen);
        const systemsSnap: Record<string, { raw: number; net: number }> = {};
        for (const sys of RISK_SYSTEMS) {
          systemsSnap[sys] = {
            raw: finalResult.systemBreakdown?.[sys]?.raw ?? 0,
            net: finalResult.systemBreakdown?.[sys]?.net ?? 0,
          };
        }
        saveRiskSnapshot({
          date: new Date().toISOString(),
          overallRaw: finalResult.overallRaw,
          overallNet: finalResult.overallNet,
          systems: systemsSnap,
        });
        if (pen.totalMultiplier > 1.0 && finalResult.systemBreakdown) {
          for (const sys of RISK_SYSTEMS) {
            if (finalResult.systemBreakdown[sys]) {
              finalResult.systemBreakdown[sys].raw = Math.min(100, finalResult.systemBreakdown[sys].raw * pen.totalMultiplier);
              finalResult.systemBreakdown[sys].net = Math.min(100, finalResult.systemBreakdown[sys].net * pen.totalMultiplier);
            }
          }
          finalResult.overallRaw = Math.min(100, finalResult.overallRaw * pen.totalMultiplier);
          finalResult.overallNet = Math.min(100, finalResult.overallNet * pen.totalMultiplier);
        }
        setRiskResult(finalResult);
        
        // Calculate aggregated risks from all sources
        // Use already computed values from above (trainingFactor, nutritionFactor, genetics are already defined)
        const trainingResult = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: {}, supportCoverage: {} });
        const nutritionResult = calculateRisks({ genetics, nutritionFactor, trainingFactor: 1.0, activeDrugs: {}, supportCoverage: {} });
        
        // Calculate diagnostics risk (based on completed diagnostics)
        let diagnosticsResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> } = {
          overallRaw: 0,
          overallNet: 0,
          systemBreakdown: {}
        };
        if (diagsDone.length > 0) {
          // Simple approximation: diagnostics reduce risk by showing awareness
          const reduction = Math.min(0.3, diagsDone.length * 0.05);
          diagnosticsResult = {
            overallRaw: finalResult.overallRaw * (1 - reduction),
            overallNet: finalResult.overallNet * (1 - reduction),
            systemBreakdown: {}
          };
        }
        
        const aggRisks = calculateAggregatedRisks(
          finalResult,
          labRiskResult,
          trainingResult,
          nutritionResult,
          diagnosticsResult
        );
        setAggregatedRisks(aggRisks);
      } catch (e) { console.error('Failed to calculate risk:', e); } finally { setLoading(false); }
    };
    computeRisk();
  }, [linked.profile, linked.labs, linked.course, linked.activeDrugs, linked.supportCoverage]);

  const getCellMitigations = useCallback((system: string, mechanism: number) => {
    const mechId = system + '_' + mechanism;
    const mitigations: { substance: string; effect: string; reduction: number }[] = [];
    for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
      const entry = effects[mechId as keyof typeof effects];
      if (entry !== undefined) { mitigations.push({ substance: subName, effect: mechId, reduction: entry }); }
    }
    return mitigations;
  }, []);

  const systemsFor3D = useMemo(() => {
    const result: Record<string, { raw: number; net: number }> = {};
    for (const sys of RISK_SYSTEMS) {
      result[sys] = {
        raw: rawRiskResult?.systemBreakdown?.[sys]?.raw ?? 0,
        net: riskResult?.systemBreakdown?.[sys]?.net ?? 0,
      };
    }
    return result;
  }, [riskResult, rawRiskResult]);

  const handleSystemSelect = useCallback((sys: string) => {
    setSelectedSystem(sys);
    setSelectedCell({ system: sys, mechanism: null });
  }, []);

  if (loading) return <div className="screen risk-screen"><div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Расчёт рисков...</div></div>;

  if (!riskResult || !rawRiskResult) {
    const defaultRisk: RiskResult = { overallRaw: 15, overallNet: 8, systemBreakdown: {
      hepatic: { raw: 15, net: 8 }, cardio: { raw: 12, net: 6 }, endocrine: { raw: 18, net: 10 },
      neuro: { raw: 8, net: 5 }, hematologic: { raw: 10, net: 6 }, reproductive: { raw: 14, net: 8 },
      renal: { raw: 6, net: 4 }, musculoskeletal: { raw: 10, net: 6 }
    }};
    return (
      <div className="screen risk-screen">
        <h2>Матрица рисков</h2>
        <div style={{ background: 'rgba(234,179,8,0.1)', borderRadius: 12, padding: 16, margin: '12px 0', fontSize: 13, color: 'var(--warning)' }}>
          Базовые риски показаны без данных анализов. Добавьте курс препаратов и результаты анализов для точного расчёта.
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ color: getCellColor(defaultRisk.overallRaw, defaultRisk.overallNet).text }}>Общий риск: {defaultRisk.overallNet}%</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {Object.entries(defaultRisk.systemBreakdown).map(([sys, data]) => (
              <div key={sys} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>{SYSTEM_LABELS[sys] || sys}</span>: <span style={{ fontWeight: 600, color: getCellColor(data.raw, data.net).text }}>{data.net}%</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>Фарма → Мой курс</span>
          <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>Анализы → Ввод</span>
        </div>
      </div>
    );
  }

  const drawTrendChart = useCallback(() => {
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const history = loadRiskHistory();
    if (history.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const padL = 36;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    ctx.clearRect(0, 0, w, h);
    const n = history.length;
    const xStep = n > 1 ? plotW / (n - 1) : plotW;
    const toX = (i: number) => padL + (n > 1 ? i * xStep : plotW / 2);
    const toY = (v: number) => padT + plotH - (v / 100) * plotH;
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= 100; v += 25) {
      const y = toY(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v + '%', padL - 4, y + 3);
    }
    history.forEach((snap, i) => {
      const x = toX(i);
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      const d = new Date(snap.date);
      ctx.fillText(d.getDate() + '.' + (d.getMonth() + 1), x, h - 4);
    });
    const drawLine = (values: number[], color: string, dash?: number[]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = toX(i);
        const y = toY(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      values.forEach((v, i) => {
        const x = toX(i);
        const y = toY(v);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
    };
    if (graphSystem === '__overall') {
      drawLine(history.map(s => s.overallRaw), 'rgba(239,68,68,0.85)');
      drawLine(history.map(s => s.overallNet), 'rgba(34,197,94,0.85)');
    } else {
      drawLine(history.map(s => s.systems[graphSystem]?.raw ?? 0), 'rgba(239,68,68,0.85)');
      drawLine(history.map(s => s.systems[graphSystem]?.net ?? 0), 'rgba(34,197,94,0.85)');
    }
  }, [graphSystem]);

  useEffect(() => { drawTrendChart(); }, [drawTrendChart]);

  useEffect(() => {
    const handleResize = () => drawTrendChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawTrendChart]);

  const overallReduction = rawRiskResult.overallRaw > 0 ? ((rawRiskResult.overallRaw - riskResult.overallNet) / rawRiskResult.overallRaw * 100) : 0;

  const selectedSysInfo = selectedSystem ? SYSTEM_INFO[selectedSystem] : null;

  const TAB_ITEMS: { key: RiskTab; label: string }[] = [
    { key: 'overview', label: 'Обзор' },
    { key: 'systems', label: 'Системы' },
    { key: 'body', label: '3D' },
    { key: 'mechanisms', label: 'Механизмы' },
    { key: 'labs', label: 'Анализы' },
    { key: 'overtraining', label: '∑' },
    { key: 'timeline', label: 'Таймлайн' },
    { key: 'details', label: 'Детализация' },
  ];

  const getDrugContributions = () => {
    const contributions: { name: string; dose: number; systems: string[] }[] = [];
    for (const [drugId, doseInfo] of Object.entries(activeSubstances)) {
      const pharmaEntry = Object.values(PHARMA_DB).find(p => p.id === drugId);
      const name = pharmaEntry?.name ?? drugId;
      const affectedSystems: string[] = [];
      if (pharmaEntry?.pd) {
        const pd = pharmaEntry.pd;
        const pdMap: Record<string, string> = {
          hepatotoxicity: 'hepatic', lipid_impact: 'cardio', hct_impact: 'hematologic',
          neuro_toxicity: 'neuro', aromatization: 'endocrine', progestogenic: 'reproductive',
        };
        for (const [pdKey, systemId] of Object.entries(pdMap)) {
          const val = (pd as any)[pdKey] as number;
          if (val && Math.abs(val) >= 0.3) affectedSystems.push(systemId);
        }
      }
      contributions.push({ name, dose: doseInfo.dosePerWeek, systems: affectedSystems });
    }
    return contributions.sort((a, b) => b.dose - a.dose);
  };

  const getSupportCoverageSummary = () => {
    let totalCells = 0;
    let coveredCells = 0;
    for (const sys of RISK_SYSTEMS) {
      for (let m = 1; m <= 7; m++) {
        totalCells++;
        const cellId = sys + '_' + m;
        if ((coverageMap[cellId] || 0) > 0) coveredCells++;
      }
    }
    return totalCells > 0 ? Math.round((coveredCells / totalCells) * 100) : 0;
  };

  const drugContribs = getDrugContributions();
  const supportPct = getSupportCoverageSummary();

  const calculateOvertrainingIndex = () => {
    const r = linked.readiness;
    const trainingFactor = r ? (r.recovery ?? 50) / 50 : 1.0;
    const fatigueFactor = r ? (1 - (r.recovery ?? 50) / 100) : 0.3;
    const recoveryFactor = r ? (r.recovery ?? 50) / 100 : 0.5;
    const loadRatio = linked.trainingLoadRatio > 0 ? linked.trainingLoadRatio : 1.0;
    const overtrainingIndex = Math.min(100, Math.max(0,
      Math.max(0, (loadRatio - 1)) * 40 + fatigueFactor * 35 + (1 - recoveryFactor) * 25 + (1 - Math.min(1.5, trainingFactor)) * 20
    ));
    return overtrainingIndex;
  };

  const overtrainingIndex = calculateOvertrainingIndex();
  const otTrainingLoad = linked.trainingLoadRatio > 0 ? linked.trainingLoadRatio : 1.0;
  const otFatigue = linked.readiness ? (1 - (linked.readiness.recovery ?? 50) / 100) : 0.3;
  const otRecovery = linked.readiness ? (linked.readiness.recovery ?? 50) / 100 : 0.5;
  const otAdaptation = linked.readiness ? (linked.readiness.nutrition ?? 50) / 50 : 1.0;

  return (
    <div className="screen risk-screen">
      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, minWidth: 50, padding: '8px 6px', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.key ? 'var(--accent-blue)' : 'var(--bg-secondary)',
            color: tab === t.key ? '#fff' : 'var(--text-dim)',
            transition: 'background 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: OVERVIEW ===== */}
      {tab === 'overview' && (
        <div>
          {/* Big risk number */}
          <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Общий риск</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: getRiskColor(riskResult.overallNet), lineHeight: 1 }}>{Math.round(riskResult.overallNet)}%</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Без поддержки</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: getRiskColor(rawRiskResult.overallRaw) }}>{Math.round(rawRiskResult.overallRaw)}%</div>
              </div>
            </div>
            {overallReduction > 0 && (
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                ↓ Снижение на {Math.round(overallReduction)}%
              </div>
            )}
          </div>

          {/* Aggregated Risks Block - from all sources */}
          {aggregatedRisks && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>⚠️ Все источники риска (агрегация)</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {/* Pharma Risk */}
                <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>💊 Препараты</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Базовый: {Math.round(aggregatedRisks.pharma.overallRaw)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{Math.round(aggregatedRisks.pharma.overallNet)}%</span>
                  </div>
                </div>
                {/* Labs Risk */}
                <div style={{ padding: '10px', background: 'rgba(249,115,22,0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>🧪 Анализы</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Отклонения: {Math.round(aggregatedRisks.labs.overallRaw)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>{Math.round(aggregatedRisks.labs.overallNet)}%</span>
                  </div>
                </div>
                {/* Training Risk */}
                <div style={{ padding: '10px', background: 'rgba(132,204,22,0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#84cc16', marginBottom: 4 }}>🏋️ Тренировки</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Перегрузка: {Math.round(aggregatedRisks.training.overallRaw)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#84cc16' }}>{Math.round(aggregatedRisks.training.overallNet)}%</span>
                  </div>
                </div>
                {/* Nutrition Risk */}
                <div style={{ padding: '10px', background: 'rgba(59,130,246,0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>🍎 Питание</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Дефициты: {Math.round(aggregatedRisks.nutrition.overallRaw)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{Math.round(aggregatedRisks.nutrition.overallNet)}%</span>
                  </div>
                </div>
                {/* Diagnostics Risk */}
                <div style={{ padding: '10px', background: 'rgba(168,85,247,0.1)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔍 Исследования</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Мониторинг: {Math.round(aggregatedRisks.diagnostics.overallRaw)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#a855f7' }}>{Math.round(aggregatedRisks.diagnostics.overallNet)}%</span>
                  </div>
                </div>
                {/* Overall Aggregated Risk */}
                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📊 Агрегированный риск (максимум из всех источников)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Базовый: {Math.round(aggregatedRisks.overallRaw)}%</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: getRiskColor(aggregatedRisks.overallNet) }}>{Math.round(aggregatedRisks.overallNet)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Penalty block */}
          {penalty && penalty.totalMultiplier > 1.0 && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: penalty.noLabsPenalty ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.10)', border: '1px solid ' + (penalty.noLabsPenalty ? '#ef4444' : '#f97316') }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: penalty.noLabsPenalty ? '#ef4444' : '#f97316', marginBottom: 4 }}>
                {penalty.noLabsPenalty ? '⛔ Без анализов' : '⚠️ Неполные анализы'} {penalty.noDiagnosticsPenalty ? '+ Без исследований' : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 4 }}>
                Штрафной коэффициент: ×{penalty.totalMultiplier.toFixed(2)} (лабы +{(penalty.labPenalty * 100).toFixed(0)}%, диагностика +{(penalty.diagnosticPenalty * 100).toFixed(0)}%)
              </div>
              {penalty.missingLabsForPhase.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  Не хватает: {penalty.missingLabsForPhase.slice(0, 8).join(', ')}{penalty.missingLabsForPhase.length > 8 ? ` +ещё ${penalty.missingLabsForPhase.length - 8}` : ''}
                </div>
              )}
            </div>
          )}

          {/* Top 3 drug contributions */}
          {drugContribs.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Препараты — вклад в риск</div>
              {drugContribs.slice(0, 3).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--border-color)' : 'none' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{d.dose.toFixed(0)} мг/нед</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.systems.slice(0, 3).map(s => (
                      <span key={s} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{SYSTEM_LABELS[s] || s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Support coverage summary */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Покрытие поддержки</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{ width: supportPct + '%', height: '100%', borderRadius: 5, background: supportPct > 60 ? '#22c55e' : supportPct > 30 ? '#eab308' : '#ef4444', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: getRiskColor(100 - supportPct) }}>{supportPct}%</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Ячеек матрицы рисков покрыто поддержкой</div>
          </div>

          {/* Mini readiness cards */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Готовность по системам</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {RISK_SYSTEMS.map(sys => {
                const raw = rawRiskResult.systemBreakdown?.[sys]?.raw ?? 0;
                const net = riskResult.systemBreakdown?.[sys]?.net ?? 0;
                const reduction = raw > 0 ? ((raw - net) / raw * 100) : 0;
                return (
                  <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-primary)', cursor: 'pointer' }} onClick={() => { setSelectedSystem(sys); setTab('systems'); }}>
                    <span style={{ fontSize: 16 }}>{SYSTEM_INFO[sys]?.icon || '❓'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SYSTEM_LABELS[sys]}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: getRiskColor(net), fontWeight: 700 }}>{Math.round(net)}%</span>
                        {reduction > 0 && <span style={{ fontSize: 9, color: '#22c55e' }}>−{Math.round(reduction)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== INDICES ON OVERVIEW ===== */}
      {tab === 'overview' && labIndexDetails && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 10px 0' }}>Лабораторные индексы</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {Object.entries(labIndexDetails).map(([key, idx]) => {
              const pct = Math.round(idx.value * 100);
              const color = idx.value < 0.2 ? '#22c55e' : idx.value < 0.4 ? '#86efac' : idx.value < 0.6 ? '#eab308' : idx.value < 0.8 ? '#f97316' : '#ef4444';
              return (
                <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{idx.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary, #1a1a2e)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{idx.interpretation}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4, lineHeight: 1.4 }}>{idx.mechanism.slice(0, 120)}{idx.mechanism.length > 120 ? '...' : ''}</div>
                  {idx.markers.filter(m => m.ratio > 0).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {idx.markers.filter(m => m.ratio > 0).map(m => (
                        <span key={m.code} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'var(--bg-tertiary, #1a1a2e)' }}>{m.code}: {m.value.toFixed(1)} ({Math.round(m.weight * 100)}%)</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== TAB: SYSTEMS ===== */}
      {tab === 'systems' && (
        <div>
          {RISK_SYSTEMS.map(system => {
            const sysInfo = SYSTEM_INFO[system];
            const sysRaw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const sysNet = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const reduction = sysRaw > 0 ? ((sysRaw - sysNet) / sysRaw * 100) : 0;
            const isExpanded = selectedSystem === system;
            const barWidth = Math.min(100, sysRaw);
            const netBarWidth = Math.min(100, sysNet);
            return (
              <div key={system} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => setSelectedSystem(isExpanded ? null : system)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{sysInfo?.icon || '❓'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sysInfo?.label || system}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(sysRaw) }}>{Math.round(sysRaw)}%</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(sysNet) }}>{Math.round(sysNet)}%</span>
                    {reduction > 0 && <span style={{ fontSize: 12, color: '#22c55e' }}>−{Math.round(reduction)}%</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {/* Raw→Net bar */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 36 }}>Сырой</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-primary)' }}>
                      <div style={{ width: barWidth + '%', height: '100%', borderRadius: 3, background: getRiskColor(sysRaw), transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 36 }}>Нетто</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-primary)' }}>
                      <div style={{ width: netBarWidth + '%', height: '100%', borderRadius: 3, background: getRiskColor(sysNet), transition: 'width 0.3s' }} />
                    </div>
                  </div>
                </div>
                {isExpanded && sysInfo && (
                  <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-light)', marginBottom: 10 }}>{sysInfo.description}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Что поражается</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.whatAffects.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Симптомы</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.symptoms.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Маркеры</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.keyMarkers.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Органы</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{(SYSTEM_ORGANS[system] || []).join(', ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Механизмы повреждения</div>
                    {RISK_MECHANISMS.map(m => {
                      const cellId = system + '_' + m.id;
                      const cell = matrixData[cellId] || { raw: 0, net: 0, coverage: 0 };
                      const mechInfo = MECHANISM_INFO[m.id];
                      const mits = getCellMitigations(system, m.id);
                      return (
                        <div key={m.id} style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '8px 10px', marginBottom: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setSelectedCell({ system, mechanism: m.id })}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 12, color: getRiskColor(cell.net) }}>{m.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{cell.net.toFixed(1)}% нетто</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {mits.slice(0, 3).map((mit, i) => (
                                <span key={i} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{mit.substance}</span>
                              ))}
                            </div>
                          </div>
                          {selectedCell?.system === system && selectedCell?.mechanism === m.id && mechInfo && (
                            <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: 'var(--text-light)' }}>
                              <div>{mechInfo.description}</div>
                              <div style={{ marginTop: 4 }}>
                                <span>Сыр. <strong style={{ color: getRiskColor(cell.raw) }}>{cell.raw.toFixed(1)}%</strong></span>
                                <span style={{ marginLeft: 8 }}>Нетто <strong style={{ color: getRiskColor(cell.net) }}>{cell.net.toFixed(1)}%</strong></span>
                                <span style={{ marginLeft: 8 }}>Покрытие <strong style={{ color: '#22c55e' }}>{(cell.coverage * 100).toFixed(0)}%</strong></span>
                              </div>
                              {mits.length > 0 && (
                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {mits.map((mit, i) => (
                                    <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>{mit.substance} −{(mit.reduction * 100).toFixed(0)}%</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== TAB: BODY (3D) ===== */}
      {tab === 'body' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>3D модель — нажмите на орган</h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <HumanBody3D
                systems={systemsFor3D}
                selectedSystem={selectedSystem}
                onSelectSystem={handleSystemSelect}
                size={320}
                selectedOrgan={selectedOrgan}
                onSelectOrgan={setSelectedOrgan}
              />
            </div>
            {selectedSysInfo && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selectedSysInfo.icon} {selectedSysInfo.label}</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-light)', marginBottom: 8 }}>{selectedSysInfo.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Что поражается:</strong> {selectedSysInfo.whatAffects.join(', ')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Симптомы:</strong> {selectedSysInfo.symptoms.join(', ')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Ключевые маркеры:</strong> {selectedSysInfo.keyMarkers.join(', ')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}><strong>Органы:</strong> {(SYSTEM_ORGANS[selectedSystem!] || []).join(', ')}</div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>Органы по системам</h3>
            {RISK_SYSTEMS.map(sys => {
              const organs = SYSTEM_ORGANS[sys] || [];
              const net = riskResult.systemBreakdown?.[sys]?.net ?? 0;
              const isSel = selectedSystem === sys;
              return (
                <div key={sys} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => { setSelectedSystem(isSel ? null : sys); setSelectedOrgan(null); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: isSel ? 700 : 500, fontSize: 13 }}>{SYSTEM_INFO[sys]?.icon} {SYSTEM_INFO[sys]?.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: getRiskColor(net) }}>{Math.round(net)}%</span>
                  </div>
                  {isSel && organs.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {organs.map((organ: string) => (
                        <span key={organ} onClick={() => setSelectedOrgan(organ)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: selectedOrgan === organ ? 'var(--accent-blue)' : 'var(--bg-primary)', color: selectedOrgan === organ ? '#fff' : 'var(--text-light)', cursor: 'pointer' }}>
                          {organ}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== TAB: MECHANISMS ===== */}
      {tab === 'mechanisms' && (
        <div>
          {RISK_MECHANISMS.map(mech => {
            const mid = mech.id;
            let totalRaw = 0;
            let totalNet = 0;
            let contributingDrugs: string[] = [];
            for (const sys of RISK_SYSTEMS) {
              const cellId = sys + '_' + mid;
              const cell = matrixData[cellId];
              if (cell) {
                totalRaw += cell.raw;
                totalNet += cell.net;
              }
            }
            for (const [drugId, doseInfo] of Object.entries(activeSubstances)) {
              const pharmaEntry = Object.values(PHARMA_DB).find(p => p.id === drugId);
              if (pharmaEntry?.pd) {
                const pd = pharmaEntry.pd as any;
                const pdMechMap: Record<string, string[]> = {
                  hepatotoxicity: ['hepatic_1', 'hepatic_3'],
                  lipid_impact: ['cardio_2', 'cardio_3', 'hepatic_2'],
                  hct_impact: ['hematologic_1', 'hematologic_6'],
                  neuro_toxicity: ['neuro_1', 'neuro_5'],
                  aromatization: ['endocrine_5', 'reproductive_5'],
                  progestogenic: ['endocrine_5', 'reproductive_5'],
                };
                for (const [pdKey, mechIds] of Object.entries(pdMechMap)) {
                  const val = pd[pdKey] as number;
                  if (val && Math.abs(val) >= 0.3 && mechIds.includes(`${RISK_SYSTEMS[0]}_${mid}`) || mechIds.some(mId => mId === `${RISK_SYSTEMS[0]}_${mid}`)) {
                    const anyMatch = mechIds.some(mId => mId.endsWith('_' + mid));
                    if (anyMatch && !contributingDrugs.includes(pharmaEntry.name)) {
                      contributingDrugs.push(pharmaEntry.name);
                    }
                  }
                }
              }
            }
            for (const [drugId] of Object.entries(activeSubstances)) {
              const pharmaEntry = Object.values(PHARMA_DB).find(p => p.id === drugId);
              if (pharmaEntry?.pd) {
                const pd = pharmaEntry.pd as any;
                const relevantPdKeys: Record<number, string[]> = {
                  1: ['hepatotoxicity', 'neuro_toxicity'],
                  2: ['lipid_impact'],
                  3: ['hepatotoxicity', 'lipid_impact'],
                  4: ['lipid_impact', 'neuro_toxicity'],
                  5: ['aromatization', 'progestogenic'],
                  6: ['hct_impact', 'lipid_impact'],
                  7: ['aromatization', 'hct_impact'],
                };
                const keys = relevantPdKeys[mid] || [];
                for (const k of keys) {
                  if (pd[k] && Math.abs(pd[k]) >= 0.5 && !contributingDrugs.includes(pharmaEntry.name)) {
                    contributingDrugs.push(pharmaEntry.name);
                  }
                }
              }
            }

            const mitigations: string[] = [];
            for (const [supName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
              for (const sys of RISK_SYSTEMS) {
                const cellId = sys + '_' + mid;
                const val = effects[cellId as keyof typeof effects];
                if (val !== undefined && !mitigations.includes(supName)) {
                  mitigations.push(supName);
                }
              }
            }

            const affectedOrgans: string[] = [];
            for (const sys of RISK_SYSTEMS) {
              const sysOrgans = SYSTEM_ORGANS[sys] || [];
              const cellId = sys + '_' + mid;
              const cell = matrixData[cellId];
              if (cell && cell.net > 1 && sysOrgans.length > 0) {
                affectedOrgans.push(...sysOrgans.slice(0, 2));
              }
            }

            return (
              <div key={mid} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{mid}. {mech.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', lineHeight: 1.5, marginTop: 4 }}>{mech.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Суммарный риск</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: getRiskColor(totalNet / 8) }}>{(totalNet / 8).toFixed(1)}%</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-dim)', marginBottom: 8 }}>
                  <strong>Механизм повреждения:</strong> {mech.howDamaged}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                  <strong>Примеры:</strong> {mech.examples.join('; ')}
                </div>

                {affectedOrgans.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}><strong>Затронутые органы:</strong></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {[...new Set(affectedOrgans)].slice(0, 8).map(o => (
                        <span key={o} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{o}</span>
                      ))}
                    </div>
                  </div>
                )}

                {contributingDrugs.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}><strong>Препараты — вклад в механизм:</strong></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {contributingDrugs.slice(0, 6).map(d => (
                        <span key={d} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {mitigations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}><strong>Поддержка — смягчение:</strong></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {mitigations.slice(0, 8).map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-system bars */}
                <div style={{ marginTop: 10 }}>
                  {RISK_SYSTEMS.filter(sys => {
                    const cellId = sys + '_' + mid;
                    const cell = matrixData[cellId];
                    return cell && cell.net > 0.5;
                  }).map(sys => {
                    const cellId = sys + '_' + mid;
                    const cell = matrixData[cellId];
                    if (!cell) return null;
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                        <span style={{ fontSize: 10, width: 80, flexShrink: 0, color: 'var(--text-dim)' }}>{SYSTEM_LABELS[sys]}</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-primary)' }}>
                          <div style={{ width: Math.min(100, cell.net) + '%', height: '100%', borderRadius: 3, background: getRiskColor(cell.net), transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: getRiskColor(cell.net), width: 36, textAlign: 'right' }}>{cell.net.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== TAB: LABS ===== */}
      {tab === 'labs' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>Лабораторные риски по системам</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>Вклад анализов в риски каждой системы на основе отклонений от референсных значений</p>
            {RISK_SYSTEMS.map(sys => {
              const labRisk = labRisks[sys] ?? 0;
              const sysNet = riskResult.systemBreakdown?.[sys]?.net ?? 0;
              const totalRisk = Math.max(sysNet, labRisk);
              const labPct = totalRisk > 0 ? (labRisk / totalRisk * 100) : 0;
              return (
                <div key={sys} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{SYSTEM_INFO[sys]?.icon || '❓'}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{SYSTEM_INFO[sys]?.label || sys}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Лаб. вклад:</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: getRiskColor(labRisk) }}>{labRisk.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 5, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                    <div style={{ width: Math.min(100, 100 - labPct) + '%', background: getRiskColor(sysNet - labRisk), borderRadius: labPct < 100 ? '5px 0 0 5px' : '5px', transition: 'width 0.3s' }} />
                    <div style={{ width: Math.min(100, labPct) + '%', background: 'rgba(249,115,22,0.7)', borderRadius: labPct > 0 ? '0 5px 5px 0' : '5px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                    <span>Фарма-риск</span>
                    <span>Лаб. риск</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                    <strong>Ключевые маркеры:</strong> {SYSTEM_INFO[sys]?.keyMarkers.join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(activeSubstances).length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Активные препараты</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Влияние препаратов на лабораторные риски</p>
              {Object.entries(activeSubstances).map(([drugId, doseInfo]) => {
                const pharmaEntry = Object.values(PHARMA_DB).find(p => p.id === drugId);
                const name = pharmaEntry?.name ?? drugId;
                const pd = pharmaEntry?.pd as any;
                return (
                  <div key={drugId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{doseInfo.dosePerWeek.toFixed(0)} мг/нед</span>
                    </div>
                    {pd && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {Object.entries(pd).filter(([, v]) => typeof v === 'number' && Math.abs(v) >= 0.3 && v !== 0).map(([k, v]) => {
                          const labelMap: Record<string, string> = {
                            hepatotoxicity: 'Гепатотокс.', lipid_impact: 'Липиды', hct_impact: 'Гематокрит',
                            neuro_toxicity: 'Нейротокс.', aromatization: 'Ароматиз.', progestogenic: 'Прогестаген.',
                            five_alpha_reduction: '5α-ред.', AR_affinity: 'АР-сродство',
                          };
                          const label = labelMap[k] || k;
                          const color = (v as number) > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';
                          const textColor = (v as number) > 0 ? '#ef4444' : '#22c55e';
                          return <span key={k} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: color, color: textColor }}>{label}</span>;
                        }).slice(0, 5)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: OVERTRAINING ===== */}
      {tab === 'overtraining' && (
        <div>
          <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Индекс перетренированности</h3>
            <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 12px auto' }}>
              <svg viewBox="0 0 180 180" style={{ width: '100%', height: '100%' }}>
                <circle cx="90" cy="90" r="75" fill="none" stroke="var(--bg-primary)" strokeWidth="14" />
                <circle cx="90" cy="90" r="75" fill="none" stroke={overtrainingIndex < 30 ? '#22c55e' : overtrainingIndex < 55 ? '#eab308' : overtrainingIndex < 75 ? '#f97316' : '#ef4444'} strokeWidth="14" strokeDasharray={`${(overtrainingIndex / 100) * 471} 471`} strokeLinecap="round" transform="rotate(-90 90 90)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                <text x="90" y="85" textAnchor="middle" style={{ fontSize: 36, fontWeight: 800, fill: overtrainingIndex < 30 ? '#22c55e' : overtrainingIndex < 55 ? '#eab308' : overtrainingIndex < 75 ? '#f97316' : '#ef4444' }}>{Math.round(overtrainingIndex)}</text>
                <text x="90" y="108" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-dim)' }}>из 100</text>
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: overtrainingIndex < 30 ? '#22c55e' : overtrainingIndex < 55 ? '#eab308' : overtrainingIndex < 75 ? '#f97316' : '#ef4444' }}>
              {overtrainingIndex < 30 ? 'Оптимальная нагрузка' : overtrainingIndex < 55 ? 'Умеренная нагрузка' : overtrainingIndex < 75 ? 'Риск перетренированности' : 'Высокий риск перетренированности'}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Факторы перетренированности</h4>
            {[
               { label: 'Тренировочная нагрузка', value: otTrainingLoad, desc: `Отношение текущей нагрузки к восстановительной ёмкости (${otTrainingLoad.toFixed(2)}). Норма < 1.0`, icon: '🏋️' },
               { label: 'Уровень усталости', value: otFatigue, desc: `Субъективная усталость (${(otFatigue*100).toFixed(0)}%). Норма < 30%`, icon: '😩' },
               { label: 'Восстановление', value: otRecovery, desc: `Качество восстановления (${(otRecovery*100).toFixed(0)}%). Норма > 70%`, icon: '😴' },
               { label: 'Адаптационный резерв', value: otAdaptation, desc: `Нутриционная и фарм. поддержка (${otAdaptation.toFixed(2)}). Норма > 0.8`, icon: '🛡️' },
            ].map((factor, i) => {
              const pct = i === 0 ? Math.min(100, factor.value * 50) : i === 1 ? Math.min(100, factor.value * 100) : i === 2 ? Math.min(100, (1 - factor.value) * 100) : Math.min(100, (1 - factor.value) * 100);
              const good = i === 0 ? factor.value <= 1.0 : i === 1 ? factor.value < 0.3 : i === 2 ? factor.value > 0.7 : factor.value > 0.8;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border-color)' : 'none' }}>
                  <span style={{ fontSize: 20 }}>{factor.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{factor.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: good ? '#22c55e' : '#f97316' }}>{factor.value.toFixed(2)}</span>
                    </div>
                    <div style={{ marginTop: 4, height: 5, borderRadius: 3, background: 'var(--bg-primary)' }}>
                      <div style={{ width: Math.min(100, pct) + '%', height: '100%', borderRadius: 3, background: good ? '#22c55e' : '#f97316', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{factor.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Рекомендации по снижению индекса</h4>
            {[
              { label: 'Снизить тренировочный объём на 15–20%', cond: overtrainingIndex >= 55 },
              { label: 'Добавить 1–2 дня полного отдыха', cond: overtrainingIndex >= 40 },
              { label: 'Увеличить калорийность на 10–15%', cond: overtrainingIndex >= 55 },
              { label: 'Оптимизировать сон (8+ часов)', cond: overtrainingIndex >= 30 },
              { label: 'Усилить поддержку: Омега-3, Магний, Витамин D', cond: overtrainingIndex >= 30 },
            ].filter(r => r.cond).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                <span style={{ color: '#f97316', fontWeight: 700 }}>!</span>
                <span style={{ color: 'var(--text-light)' }}>{r.label}</span>
              </div>
            ))}
            {overtrainingIndex < 30 && (
              <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', padding: 12 }}>Тренировочный режим оптимален. Продолжайте в том же духе!</div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: TIMELINE ===== */}
      {tab === 'timeline' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Тренд рисков по неделям</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={() => setGraphSystem('__overall')} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: graphSystem === '__overall' ? 'var(--accent-blue)' : 'var(--bg-secondary)', color: graphSystem === '__overall' ? '#fff' : 'var(--text-dim)', fontWeight: 600 }}>Общий</button>
              {RISK_SYSTEMS.map(sys => (
                <button key={sys} onClick={() => setGraphSystem(sys)} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: graphSystem === sys ? 'var(--accent-blue)' : 'var(--bg-secondary)', color: graphSystem === sys ? '#fff' : 'var(--text-dim)', fontWeight: 600 }}>{SYSTEM_INFO[sys]?.icon || ''} {SYSTEM_LABELS[sys] || sys}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              <span><span style={{ display: 'inline-block', width: 14, height: 4, borderRadius: 2, background: 'rgba(239,68,68,0.85)', marginRight: 4, verticalAlign: 'middle' }}></span>Сырой риск</span>
              <span><span style={{ display: 'inline-block', width: 14, height: 4, borderRadius: 2, background: 'rgba(34,197,94,0.85)', marginRight: 4, verticalAlign: 'middle' }}></span>Нетто риск</span>
            </div>
            <canvas ref={trendCanvasRef} style={{ width: '100%', height: 220, display: 'block', borderRadius: 8 }} />
            {(() => {
              const history = loadRiskHistory();
              if (history.length < 2) return (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-dim)', fontSize: 12 }}>
                  График появится после 2+ недель использования. Сейчас данных: {history.length} точка(и).
                </div>
              );
              return null;
            })()}
          </div>

          {/* Sparkline bars per system */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Сравнение систем — все недели</h3>
            {(() => {
              const history = loadRiskHistory();
              if (history.length === 0) return <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Нет сохранённых данных</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {RISK_SYSTEMS.map(sys => {
                    const values = history.map(h => h.systems[sys]?.net ?? 0);
                    const latest = values[values.length - 1] ?? 0;
                    const prev = values.length >= 2 ? values[values.length - 2] : undefined;
                    const trend = prev !== undefined ? latest - prev : 0;
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, width: 100, flexShrink: 0 }}>{SYSTEM_LABELS[sys] ?? sys}</span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
                          {values.map((v, i) => {
                            const barH = Math.max(3, (v / 100) * 22);
                            const color = v < 20 ? 'rgba(34,197,94,0.7)' : v < 40 ? 'rgba(132,204,22,0.7)' : v < 60 ? 'rgba(234,179,8,0.7)' : v < 80 ? 'rgba(249,115,22,0.7)' : 'rgba(239,68,68,0.7)';
                            return (
                              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
                                <div style={{ width: '100%', maxWidth: 20, height: barH, background: color, borderRadius: 2, transition: 'height 0.3s' }} title={`Нед ${i + 1}: ${Math.round(v)}%`} />
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ width: 55, textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: getRiskColor(latest) }}>{Math.round(latest)}%</span>
                          {trend !== 0 && <span style={{ fontSize: 10, marginLeft: 2, color: trend > 0 ? 'var(--danger)' : 'var(--success)' }}>{trend > 0 ? '+' : ''}{Math.round(trend)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 2, paddingLeft: 108, marginTop: 2 }}>
                    {history.map((h, i) => {
                      const d = new Date(h.date);
                      return <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>{d.getDate()}.{d.getMonth() + 1}</div>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Heatmap */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Тепловая карта систем × недели</h3>
            {(() => {
              const history = loadRiskHistory();
              if (history.length === 0) return <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Нет сохранённых данных</p>;
              return (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: 0, marginBottom: 4, paddingLeft: 108 }}>
                    {history.map((h, i) => {
                      const d = new Date(h.date);
                      return <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)', minWidth: 28 }}>{d.getDate()}.{d.getMonth() + 1}</div>;
                    })}
                  </div>
                  {RISK_SYSTEMS.map(sys => (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, width: 108, flexShrink: 0, paddingRight: 4, textAlign: 'right' }}>{SYSTEM_LABELS[sys] ?? sys}</span>
                      {history.map((h, i) => {
                        const val = h.systems[sys]?.net ?? 0;
                        const bg = val < 20 ? 'rgba(34,197,94,0.2)' : val < 40 ? 'rgba(132,204,22,0.2)' : val < 60 ? 'rgba(234,179,8,0.25)' : val < 80 ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.35)';
                        const tx = val < 20 ? '#22c55e' : val < 40 ? '#84cc16' : val < 60 ? '#eab308' : val < 80 ? '#f97316' : '#ef4444';
                        return (
                          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 0', background: bg, fontSize: 10, fontWeight: 600, color: tx, minWidth: 28, borderRadius: 2 }} title={`${SYSTEM_LABELS[sys]}: ${Math.round(val)}%`}>{Math.round(val)}</div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Trend button from overview */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Тренд рисков (недельный)</h3>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 3, borderRadius: 2, background: 'rgba(239,68,68,0.85)', marginRight: 4, verticalAlign: 'middle' }}></span>Сырой риск</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 3, borderRadius: 2, background: 'rgba(34,197,94,0.85)', marginRight: 4, verticalAlign: 'middle' }}></span>Нетто риск</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: DETAILS ===== */}
      {tab === 'details' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Детализация расчета рисков</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Здесь показано, как складываются все источники рисков: фарма, анализы, поддержка, тренировки и питание
            </p>
            
            {/* Overall Risk Breakdown */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Общий риск</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Сырой риск (без поддержки)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{Math.round(rawRiskResult.overallRaw)}%</div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.1)', padding: 8, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Нетто риск (с поддержкой)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{Math.round(riskResult.overallNet)}%</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-light)', padding: '8px 12', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                <span style={{ marginRight: 8 }}>Снижение:</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>-{Math.round(overallReduction)}%</span>
                <span style={{ marginLeft: 8, color: 'var(--text-dim)' }}>
                  ({rawRiskResult.overallRaw} → {riskResult.overallNet})
                </span>
              </div>
            </div>

            {/* Penalty Details */}
            {penalty && penalty.totalMultiplier > 1.0 && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Штрафные коэффициенты</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Лабораторные анализы</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: penalty.noLabsPenalty ? '#ef4444' : '#f97316' }}>
                      {penalty.noLabsPenalty ? '⛔ БЕЗ АНАЛИЗОВ' : '⚠️ НЕПОЛНЫЕ АНАЛИЗЫ'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>+{(penalty.labPenalty * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Исследования</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: penalty.noDiagnosticsPenalty ? '#ef4444' : '#f97316' }}>
                      {penalty.noDiagnosticsPenalty ? '⛔ БЕЗ ИССЛЕДОВАНИЙ' : '✅ ДОСТУПНО'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>+{(penalty.diagnosticPenalty * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: '8px 12', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Итоговый множитель</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316' }}>{'×'} {penalty.totalMultiplier.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                    <span style={{ marginRight: 4 }}>Итоговый штраф:</span>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>+{((penalty.totalMultiplier - 1) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Lab Risk Breakdown */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Вклад анализов</div>
              <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Риски отклонений лабораторных показателей от референсов</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {RISK_SYSTEMS.map(sys => {
                  const labRisk = labRisks[sys] ?? 0;
                  const net = riskResult.systemBreakdown?.[sys]?.net ?? 0;
                  const total = Math.max(net, labRisk);
                  const labPct = total > 0 ? Math.round((labRisk / total) * 100) : 0;
                  const color = labPct > 50 ? '#ef4444' : labPct > 25 ? '#f97316' : labPct > 0 ? '#eab308' : '#6b7280';
                  return (
                    <div key={sys} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 6', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{SYSTEM_LABELS[sys]}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color }}>
                        {labRisk.toFixed(1)}%
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 2 }}>лаб</span>
                      </div>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                        ({labPct}% от {total.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drug Contributions Summary */}
            {drugContribs.length > 0 && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Вклад препаратов</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {drugContribs.slice(0, 4).map((d, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{d.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{d.dose.toFixed(0)} мг/нед</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                        Влияет на: {d.systems.map(s => SYSTEM_LABELS[s] || s).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Coverage Summary */}
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Покрытие поддержкой</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                  <div style={{ width: supportPct + '%', height: '100%', borderRadius: 6, background: supportPct > 60 ? '#22c55e' : supportPct > 30 ? '#eab308' : '#ef4444', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: getRiskColor(100 - supportPct) }}>{supportPct}%</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                Ячеек матрицы рисков покрыто поддержкой из раздела «Поддержка»
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-light)' }}>
                <span style={{ marginRight: 8 }}>Механизмы защиты:</span>
                <span style={{ color: '#22c55e' }}>{supportPct > 50 ? 'Хорошее' : supportPct > 25 ? 'Умеренное' : 'Слабое'}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Always visible: System comparison ===== */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Сравнение: Без поддержки / С поддержкой</h3>
        <div className="risk-comparison-grid">
          {RISK_SYSTEMS.map(system => {
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const reduction = raw > 0 ? ((raw - net) / raw * 100) : 0;
            return (
              <div key={system} className="risk-comparison-row">
                <div className="risk-comparison-label">{SYSTEM_INFO[system]?.icon || ''} {SYSTEM_LABELS[system] || system}</div>
                <div className="risk-comparison-bars">
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Сыр.</div>
                    <div className="risk-comparison-bar-track">
                      <div className="risk-comparison-bar-fill" style={{ width: Math.min(100, raw) + '%', backgroundColor: getRiskColor(raw) }} />
                    </div>
                    <div className="risk-comparison-bar-value-sm">{Math.round(raw)}%</div>
                  </div>
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Нетто</div>
                    <div className="risk-comparison-bar-track">
                      <div className="risk-comparison-bar-fill" style={{ width: Math.min(100, net) + '%', backgroundColor: getRiskColor(net) }} />
                    </div>
                    <div className="risk-comparison-bar-value-sm">{Math.round(net)}%</div>
                  </div>
                </div>
                <div className="risk-comparison-reduction" style={{ color: reduction > 0 ? '#22c55e' : '#6b7280' }}>
                  {reduction > 0 ? '-' + Math.round(reduction) + '%' : '0%'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Поддержка по системам</h3>
        <div className="risk-mitigation-grid">
          {RISK_SYSTEMS.map(system => {
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const systemMitigations: { substance: string; effect: string; reduction: number }[] = [];
            for (let m = 1; m <= 7; m++) {
              const cellId = system + '_' + m;
              for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
                const val = effects[cellId as keyof typeof effects];
                if (val !== undefined) { systemMitigations.push({ substance: subName, effect: cellId, reduction: val }); }
              }
            }
            const uniqueSubs = [...new Map(systemMitigations.map(m => [m.substance, m])).values()];
            return (
              <div key={system} className="risk-mitigation-system">
                <div className="risk-mitigation-header">
                  <span className="risk-mitigation-name">{SYSTEM_INFO[system]?.icon || ''} {SYSTEM_LABELS[system] || system}</span>
                  <span className="risk-mitigation-values" style={{ color: getRiskColor(net) }}>
                    {Math.round(net)}%
                    <span style={{ color: '#6b7280', marginLeft: 4, fontSize: '0.85em' }}>({Math.round(raw)}% → {Math.round(net)}%)</span>
                  </span>
                </div>
                {uniqueSubs.length > 0 ? (
                  <div className="risk-mitigation-subs">
                    {uniqueSubs.map((mit, i) => (
                      <span key={i} className="risk-mitigation-pill" title={mit.substance + ': -' + (mit.reduction * 100).toFixed(0) + '%'}>
                        {mit.substance}
                        <span className="risk-mitigation-pill-reduction">-{(mit.reduction * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="risk-mitigation-none">Нет специфической поддержки</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};