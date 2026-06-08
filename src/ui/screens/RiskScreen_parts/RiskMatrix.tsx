import React from 'react';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { MECHANISM_INFO } from '../../../core/risk-info';

interface MatrixRow {
  mechanismKey: string;
  systemKey: string;
  label: string;
  description: string;
  raw: number;
  net: number;
}

export const RiskMatrix: React.FC<{
  riskResult: RiskResult;
}> = ({ riskResult }) => {
  const rows: MatrixRow[] = React.useMemo(() => {
    const result: MatrixRow[] = [];
    const mechDetail = riskResult.mechanismDetail || {};
    
    for (const [key, cell] of Object.entries(mechDetail)) {
      const parts = key.split('_');
      const sysKey = parts[0];
      const mechNum = parseInt(parts[1], 10);
      const mechInfo = MECHANISM_INFO[mechNum];
      
      result.push({
        mechanismKey: key,
        systemKey: sysKey,
        label: mechInfo ? mechInfo.label : `Механизм ${mechNum}`,
        description: mechInfo ? mechInfo.description : '',
        raw: cell.raw,
        net: cell.net,
      });
    }
    
    return result;
  }, [riskResult.mechanismDetail]);

  const getCellColor = (value: number): string => {
    if (value < 20) return 'rgba(34,197,94,0.15)';
    if (value < 40) return 'rgba(132,204,22,0.15)';
    if (value < 60) return 'rgba(234,179,8,0.15)';
    if (value < 80) return 'rgba(249,115,22,0.2)';
    return 'rgba(239,68,68,0.2)';
  };

  return (
    <div className="risk-matrix">
      <div className="card">
        <h3>Матрица механизмов</h3>
        <div className="risk-matrix-grid">
          <div className="risk-header">Механизм</div>
          <div className="risk-header">Система</div>
          <div className="risk-header">Raw</div>
          <div className="risk-header">Net</div>
          <div className="risk-header">Статус</div>
          
          {rows.map((row) => (
            <React.Fragment key={row.mechanismKey}>
              <div className="risk-cell">{row.label}</div>
              <div className="risk-cell">{row.systemKey}</div>
              <div className="risk-cell" style={{ background: getCellColor(row.raw) }}>{Math.round(row.raw)}%</div>
              <div className="risk-cell" style={{ background: getCellColor(row.net) }}>{Math.round(row.net)}%</div>
              <div className="risk-cell">
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  fontSize: 10, 
                  background: row.net > 0 ? getCellColor(row.net) : 'var(--bg-secondary)',
                  color: row.net > 0 ? (row.net < 50 ? '#fff' : '#000') : 'var(--text-dim)'
                }}>
                  {row.net > 0 ? '❗ Внимание' : '✓ Стабильно'}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
