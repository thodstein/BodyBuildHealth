import React, { useState, useMemo, useEffect } from 'react';
import { RISK_SYSTEMS, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, MechanismCell, LabPoint } from '../../core/types';
import { calculateRisks, type AggregatedRisk } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails } from '../../engines/labs-indices.engine';
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

function saveRiskHistory(entry: { date: string; overallRaw: number; overallNet: number }) {
  try {
    const history = loadRiskHistory();
    history.push(entry);
    localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {}
}

export const RiskScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'overview' | 'matrix' | 'details'>('overview');
  const [forceNoLabs, setForceNoLabs] = useState(false);

  const hasLabs = linked.labs && linked.labs.length > 0;

  // Compute pharma risk from the main engine
  const pharmaRisk = useMemo<RiskResult | null>(() => {
    if (!linked.profile) return null;
    const genetics = linked.profile.settings.genetics ?? {};
    const riskInput = {
      genetics,
      nutritionFactor: linked.profile.settings.nutritionFactor ?? 0.8,
      trainingFactor: linked.profile.settings.trainingFactor ?? 0.7,
      activeDrugs: linked.activeDrugs,
      supportCoverage: linked.supportCoverage,
    };
    return calculateRisks(riskInput);
  }, [linked.profile, linked.activeDrugs, linked.supportCoverage]);

  // Compute lab risk contributions
  const labRiskContributions = useMemo(() => {
    if (!hasLabs) return null;
    const labData = linked.labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    return calculateRiskFromAnalyses(labData);
  }, [hasLabs, linked.labs]);

  // Merge pharma risk with lab contributions
  const riskResult = useMemo<RiskResult | null>(() => {
    if (!pharmaRisk) return null;

    let result = pharmaRisk;

    // Merge lab contributions if available
    if (hasLabs && labRiskContributions) {
      result = calculateRiskFromAnalyses(result, linked.labs);
    }

    // Apply penalty if needed
    if (forceNoLabs || (!hasLabs && forceNoLabs)) {
      result = applyPenaltyToResult(result);
    }

    return result;
  }, [pharmaRisk, hasLabs, labRiskContributions, forceNoLabs, linked.labs]);

  // Save risk history
  useEffect(() => {
    if (riskResult) {
      saveRiskHistory({
        date: new Date().toISOString().split('T')[0],
        overallRaw: riskResult.overallRaw,
        overallNet: riskResult.overallNet,
      });
    }
  }, [riskResult?.overallRaw, riskResult?.overallNet]);

  function applyPenaltyToResult(result: RiskResult): RiskResult {
    const phase = linked.profile?.settings?.phase || 'baseline';
    const penalty = calculatePenaltyCoefficients(
      phase,
      linked.labs || [],
      [],
      1,
      linked.course,
      forceNoLabs
    );
    const totalMultiplier = 1.0 + penalty.labPenalty + penalty.diagnosticPenalty;

    const finalResult: RiskResult = {
      ...result,
      systemBreakdown: { ...result.systemBreakdown },
    };

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

  // Load history for display
  const riskHistory = useMemo(() => loadRiskHistory(), []);

  const renderContent = () => {
    if (!riskResult) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Загрузка данных...</div>;

    switch (tab) {
      case 'overview': return <RiskOverview riskResult={riskResult} forceNoLabs={forceNoLabs} setForceNoLabs={setForceNoLabs} penalty={forceNoLabs ? applyPenaltyToResult(riskResult) : null} riskHistory={riskHistory} labRiskContributions={labRiskContributions} />;
      case 'matrix': return <RiskMatrix riskResult={riskResult} />;
      case 'details': return <RiskDetails riskResult={riskResult} labRiskContributions={labRiskContributions} />;
      default: return <RiskOverview riskResult={riskResult} forceNoLabs={forceNoLabs} setForceNoLabs={setForceNoLabs} penalty={null} riskHistory={riskHistory} labRiskContributions={labRiskContributions} />;
    }
  };

  return (
    <div className="screen risk">
      <div className="tab-bar">
        {(['overview', 'matrix', 'details'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Обзор' : t === 'matrix' ? '🔬 Матрица' : '📋 Детали'}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};
