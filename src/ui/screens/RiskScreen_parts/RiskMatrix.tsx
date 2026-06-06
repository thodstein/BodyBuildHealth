import React from 'react';
import type { MechanismCell, RiskResult } from '../../core/types';
import { SYSTEM_INFO, MECHANISM_INFO } from '../../core/risk-info';

export const RiskMatrix: React.FC<{
  riskResult: RiskResult;
}> = ({ riskResult }) => {
  const cells: MechanismCell[] = React.useMemo(() => {
    const result: MechanismCell[] = [];
    const systems = Object.keys(MECHANISM_INFO);
    for (const sys of systems) {
      for (const mech of Object.keys(MECHANISM_INFO[sys].mechanisms)) {
        const cell = riskResult.mechanisms[mech];
        if (cell) {
          result.push({
            mechanism: mech,
            system: sys,
            description: MECHANISM_INFO[sys].mechanisms[mech],
            raw: cell.raw,
            net: cell.net,
            isRelevant: cell.net > 0,
          });
        }
      }
    }
    return result;
  }, [riskResult.mechanisms]);

  const getCellColor = (raw: number, net: number): string => {
    const v = net > 0 ? net : raw;
    if (v < 20) return 'rgba(34,197,94,0.15)';
    if (v < 40) return 'rgba(132,204,22,0.15)';
    if (v < 60) return 'rgba(234,179,8,0.15)';
    if (v < 80) return 'rgba(249,115,22,0.2)';
    return 'rgba(239,68,68,0.2)';
  };

  return (
    <div className="risk-matrix">
      <div className="card">
        <h3>Матрица механизмов</h3>
        <div className="risk-matrix-grid">
          <div className="risk-header">Механизм</div>
          <div className="risk-header">Описание</div>
          <div className="risk-header">Raw</div>
          <div className="risk-header">Net</div>
          <div className="risk-header">Статус</div>
          
          {cells.map((cell, i) => (
            <React.Fragment key={cell.mechanism}>
              <div className="risk-cell">{cell.mechanism}</div>
              <div className="risk-cell">{cell.description}</div>
              <div className="risk-cell" style={{ background: getCellColor(cell.raw, 0) }}>{cell.raw}%</div>
              <div className="risk-cell" style={{ background: getCellColor(cell.raw, cell.net) }}>{cell.net}%</div>
              <div className="risk-cell">
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  fontSize: 10, 
                  background: cell.isRelevant ? getCellColor(cell.raw, cell.net) : 'var(--bg-secondary)',
                  color: cell.isRelevant ? (cell.net < 50 ? '#fff' : '#000') : 'var(--text-dim)'
                }}>
                  {cell.isRelevant ? '❗ Внимание' : '✓ Стабильно'}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
