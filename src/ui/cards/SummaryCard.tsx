import React from 'react';

interface Props { totalRisk: number; riskAfterSupport: number; riskLevel: string; }

export const SummaryCard: React.FC<Props> = ({ totalRisk, riskAfterSupport, riskLevel }) => {
  const levelColor = riskLevel === 'HIGH' ? '#ff453a' : riskLevel === 'MEDIUM' ? '#ff9f0a' : '#30d158';
  return (
    <div className="card summary">
      <div className="row"><span className="label">Общий риск</span><span className="value">{totalRisk}</span></div>
      <div className="row"><span className="label">После поддержки</span><span className="value">{riskAfterSupport}</span></div>
      <div className="row"><span className="label">Уровень</span><span className="value" style={{ color: levelColor }}>{riskLevel}</span></div>
    </div>
  );
};