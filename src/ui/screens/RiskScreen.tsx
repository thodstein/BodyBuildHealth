import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO } from '../../core/risk-info';
import type { RiskResult, MechanismCell } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink } from '../../core/data-link';
import { RiskOverview } from './RiskScreen_parts/RiskOverview';
import { RiskMatrix } from './RiskScreen_parts/RiskMatrix';
import { RiskDetails } from './RiskScreen_parts/RiskDetails';

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

  const hasLabs = linked.labs && linked.labs.length > 0;

  const riskResult = useMemo<RiskResult | null>(() => {
    if (!linked.profile) return null;
    
    const genetics = linked.profile.settings.genetics ?? {};
    const riskInput = {
      genetics,
      nutritionFactor: linked.profile.settings.nutritionFactor ?? 0.8,
      trainingFactor: linked.profile.settings.trainingFactor ?? 0.7,
      activeDrugs: linked.activeDrugs,
      supportCoverage: linked.supportCoverage,
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
    const phase = linked.profile?.settings.phase || 'baseline';
    const penalty = calculatePenaltyCoefficients(
      phase,
      linked.labs || [],
      [],
      1,
      linked.course,
      forceNoLabs
    );
    const totalMultiplier = 1.0 + penalty.labPenalty + penalty.diagnosticPenalty;
    
    const finalResult: RiskResult = { ...result, systemBreakdown: { ...result.systemBreakdown } };
    
    if (finalResult.systemBreakdown) {
      for (const sys of RISK_SYSTEMS) {
        const sb = finalResult.systemBreakdown[sys];
        if (sb) {
          finalResult.systemBreakdown[sys] = {
            raw: Math.min(100, sb.raw * totalMultiplier),
            net: Math.min(100, sb.net * totalMultiplier),
          };
        }
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
