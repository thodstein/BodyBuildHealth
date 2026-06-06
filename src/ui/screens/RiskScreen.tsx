import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell } from '../../core/types';
import { calculateRisks, type AggregatedRisk } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients, PenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import HumanBody3D from '../components/HumanBody3D';
import { getRiskColor } from '../../core/utils/risk-colors';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYNERGY_PAIRS, type SynergyPair } from '../../engines/support.engine';
import { RiskOverview } from './RiskScreen_parts/RiskOverview';
import { RiskMatrix } from './RiskScreen_parts/RiskMatrix';
import { RiskDetails } from './RiskScreen_parts/RiskDetails';

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

const RISK_HISTORY_KEY = 'risk_history';
const MAX_HISTORY = 12;

function loadRiskHistory(): { date: string; overallRaw: number; overallNet: number }[] {
  try {
    const raw = localStorage.getItem(RISK_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRiskHistory(history: { date: string; overallRaw: number; overallNet: number }[]) {
  try {
    localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {}
}

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'matrix' | 'details'>('overview');
  const [forceNoLabs, setForceNoLabs] = useState(false);

  useEffect(() => {
    const history = loadRiskHistory();
    if (history.length > 0) {
      console.log('Risk history loaded:', history.length, 'entries');
    }
  }, []);

  const hasLabs = linked.labs && linked.labs.length > 0;

  const riskResult = useMemo<RiskResult | null>(() => {
    if (!linked.profile) return null;
    
    const riskInput = {
      profile: linked.profile,
      labs: linked.labs,
      course: linked.course,
      readiness: linked.readiness,
      activeDrugs: linked.activeDrugs,
      supportCoverage: linked.supportCoverage,
      pharmaRisks: linked.pharmaRisks,
      supportRisks: linked.supportRisks,
      trainingRisks: linked.trainingRisks,
      nutritionRisks: linked.nutritionRisks,
    };
    
    const rawResult = calculateRisks(riskInput);
    
    if (hasLabs) {
      const analyses = linked.labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
      return calculateRiskFromAnalyses(rawResult, analyses);
    }
    
    if (forceNoLabs) {
      return applyPenaltyToResult(rawResult);
    }
    
    return rawResult;
  }, [linked, hasLabs, forceNoLabs]);

  function applyPenaltyToResult(result: RiskResult): RiskResult {
    const penalty = calculatePenaltyCoefficients(linked.labs, linked.course);
    const totalMultiplier = 1.0 + penalty.labPenalty + penalty.diagnosticPenalty;
    
    const finalResult = { ...result };
    
    if (finalResult.systemBreakdown) {
      for (const sys of RISK_SYSTEMS) {
        finalResult.systemBreakdown[sys].raw = Math.min(100, result.systemBreakdown[sys].raw * totalMultiplier);
        finalResult.systemBreakdown[sys].net = Math.min(100, result.systemBreakdown[sys].net * totalMultiplier);
      }
    }
    
    finalResult.overallRaw = Math.min(100, result.overallRaw * totalMultiplier);
    finalResult.overallNet = Math.min(100, result.overallNet * totalMultiplier);
    
    return finalResult;
  }

  const renderContent = () => {
    if (!riskResult) return <div>Загрузка...</div>;
    
    switch (tab) {
      case 'overview': return <RiskOverview riskResult={riskResult} forceNoLabs={forceNoLabs} setForceNoLabs={setForceNoLabs} />;
      case 'matrix': return <RiskMatrix riskResult={riskResult} />;
      case 'details': return <RiskDetails riskResult={riskResult} />;
      default: return <RiskOverview riskResult={riskResult} forceNoLabs={forceNoLabs} setForceNoLabs={setForceNoLabs} />;
    }
  };

  return (
    <div className="screen risk">
      <div className="tab-bar">
        {(['overview', 'matrix', 'details'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Обзор' : t === 'matrix' ? 'Матрица' : 'Детали'}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
