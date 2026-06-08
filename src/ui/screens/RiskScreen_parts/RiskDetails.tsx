import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { RISK_SYSTEMS } from '../../../core/constants';

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
}> = ({ riskResult }) => {
  // Generate recommendations from risk data
  const recommendations: string[] = [];
  if (riskResult.overallNet > 60) recommendations.push('Общий риск высокий — рекомендуется консультация врача');
  for (const sys of RISK_SYSTEMS) {
    const bd = riskResult.systemBreakdown[sys];
    if (bd && bd.net > 70) {
      recommendations.push(`Система ${sys}: риск ${Math.round(bd.net)}% — необходим мониторинг и превентивные меры`);
    }
  }
  if (riskResult.overallNet < 30) recommendations.push('Общий риск низкий — продолжайте текущую стратегию');

  // Collect contributors from mechanism detail
  const contributorMap: Record<string, string[]> = {};
  if (riskResult.mechanismDetail) {
    for (const [key, cell] of Object.entries(riskResult.mechanismDetail)) {
      const sys = key.split('_')[0];
      if (!contributorMap[sys]) contributorMap[sys] = [];
      if (cell.contributors && cell.contributors.length > 0) {
        contributorMap[sys].push(...cell.contributors);
      }
    }
  }

  return (
    <div className="risk-details">
      <div className="card">
        <h3>Детали по системам</h3>
        
        {RISK_SYSTEMS.map((sys: string) => {
          const breakdown = riskResult.systemBreakdown[sys];
          if (!breakdown || breakdown.net === 0) return null;
          
          return (
            <div key={sys} style={{ marginBottom: 12, padding: 10, background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {sys} ({Math.round(breakdown.net)}%)
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
                <div>Raw: {Math.round(breakdown.raw)}%</div>
              </div>
              
              {contributorMap[sys] && contributorMap[sys].length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  <strong>Факторы:</strong>
                  {[...new Set(contributorMap[sys])].map((id: string) => (
                    <span key={id} style={{ display: 'inline-block', padding: '2px 6px', margin: '2px', background: 'rgba(0,230,138,0.1)', borderRadius: 4 }}>
                      {(PHARMA_DB as any)[id]?.name || id}
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
        {recommendations.length > 0 ? (
          <ul style={{ paddingLeft: 20 }}>
            {recommendations.map((rec: string, i: number) => (
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
