import React from 'react';
import type { RiskResult } from '../../core/types';
import { RISK_SYSTEMS } from '../../core/constants';

export const RiskOverview: React.FC<{
  riskResult: RiskResult;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ riskResult, forceNoLabs, setForceNoLabs }) => {
  return (
    <div className="risk-overview">
      <div className="card">
        <h3>Обзор рисков</h3>
        <div className="score-grid">
          <div className="score-item">
            <span className="label">Общий риск (raw)</span>
            <span className="value" style={{ color: riskResult.overallRaw > 80 ? 'var(--danger)' : riskResult.overallRaw > 60 ? 'var(--warning)' : 'var(--success)' }}>
              {riskResult.overallRaw}%
            </span>
          </div>
          <div className="score-item">
            <span className="label">Общий риск (net)</span>
            <span className="value" style={{ color: riskResult.overallNet > 80 ? 'var(--danger)' : riskResult.overallNet > 60 ? 'var(--warning)' : 'var(--success)' }}>
              {riskResult.overallNet}%
            </span>
          </div>
          <div className="score-item">
            <span className="label">Статус</span>
            <span className="value">
              {riskResult.overallNet < 50 ? 'Критический' : riskResult.overallNet < 70 ? 'Тревожный' : 'Удовлетворительный'}
            </span>
          </div>
          <div className="score-item">
            <span className="label">Источники</span>
            <span className="value">
              {Object.keys(riskResult.sources).length} источника(ов)
            </span>
          </div>
        </div>
        {forceNoLabs && (
          <div style={{ background: 'rgba(239,68,68,0.15)', padding: 8, borderRadius: 6, marginTop: 8 }}>
            ⚠️ Применен штраф за отсутствие анализов
          </div>
        )}
        <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{ marginTop: 8, width: '100%', padding: 8, background: forceNoLabs ? 'var(--accent)' : 'var(--danger)', color: forceNoLabs ? '#000' : '#fff' }}>
          {forceNoLabs ? '✅ Применён штраф' : '🚫 БЕЗ АНАЛИЗОВ (Штраф)'}
        </button>
      </div>

      <div className="card">
        <h3>Системы</h3>
        <div className="grid risk-grid">
          {RISK_SYSTEMS.map(sys => (
            <div key={sys} className="risk-system">
              <div className="risk-bar">
                <div className="risk-fill" style={{ width: `${riskResult.systemBreakdown[sys].net}%`, background: getRiskColor(riskResult.systemBreakdown[sys].net) }}></div>
              </div>
              <div className="risk-label">{sys}</div>
              <div className="risk-value">{riskResult.systemBreakdown[sys].net}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function getRiskColor(v: number): string {
  if (v < 20) return '#22c55e';
  if (v < 40) return '#84cc16';
  if (v < 60) return '#eab308';
  if (v < 80) return '#f97316';
  return '#ef4444';
}
