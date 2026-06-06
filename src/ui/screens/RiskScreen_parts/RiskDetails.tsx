import React from 'react';
import { PHARMA_DB } from '../../core/pharma-database';
import type { RiskResult } from '../../core/types';
import { RISK_SYSTEMS } from '../../core/constants';

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
}> = ({ riskResult }) => {
  return (
    <div className="risk-details">
      <div className="card">
        <h3>Детали по системам</h3>
        
        {RISK_SYSTEMS.map(sys => {
          const breakdown = riskResult.systemBreakdown[sys];
          if (!breakdown || breakdown.net === 0) return null;
          
          return (
            <div key={sys} style={{ marginBottom: 12, padding: 10, background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {sys} ({breakdown.net}%)
                <span style={{ 
                  marginLeft: 8, 
                  padding: '2px 8px', 
                  borderRadius: 4, 
                  fontSize: 10,
                  background: breakdown.net > 80 ? 'rgba(239,68,68,0.2)' : breakdown.net > 60 ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)',
                  color: breakdown.net > 80 ? '#ef4444' : breakdown.net > 60 ? '#f97316' : '#22c55e'
                }}>
                  {breakdown.net > 80 ? 'Критично' : breakdown.net > 60 ? 'Тревожно' : 'Норма'}
                </span>
              </div>
              <div style={{ fontSize: 12 }}>
                <div>Raw: {breakdown.raw}%</div>
                <div>Множители: {breakdown.multipliers.join(', ')}</div>
              </div>
              
              {/* Список препаратов/факторов, влияющих на систему */}
              {riskResult.sources.pharma && riskResult.sources.pharma.some(s => s.systems.includes(sys)) && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  <strong>Препараты:</strong>
                  {riskResult.sources.pharma.filter(s => s.systems.includes(sys)).map(s => (
                    <span key={s.id} style={{ display: 'inline-block', padding: '2px 6px', margin: '2px', background: 'rgba(0,230,138,0.1)', borderRadius: 4 }}>
                      {PHARMA_DB[s.id]?.name || s.id}
                    </span>
                  ))}
                </div>
              )}
              
              {riskResult.sources.labs && riskResult.sources.labs.some(s => s.systems.includes(sys)) && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  <strong>Анализы:</strong>
                  {riskResult.sources.labs.filter(s => s.systems.includes(sys)).map(s => (
                    <span key={s.id} style={{ display: 'inline-block', padding: '2px 6px', margin: '2px', background: 'rgba(100,150,255,0.1)', borderRadius: 4 }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Рекомендации</h3>
        {riskResult.recommendations.length > 0 ? (
          <ul style={{ paddingLeft: 20 }}>
            {riskResult.recommendations.map((rec, i) => (
              <li key={i} style={{ marginBottom: 6 }}>{rec}</li>
            ))}
          </ul>
        ) : (
          <div style={{ color: 'var(--text-dim)' }}>Нет специфических рекомендаций</div>
        )}
      </div>
    </div>
  );
};
