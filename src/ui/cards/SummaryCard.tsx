import React from 'react';

interface Props { totalRisk: number; riskAfterSupport: number; riskLevel: string; }

export const SummaryCard: React.FC<Props> = ({ totalRisk, riskAfterSupport, riskLevel }) => {
  const levelColor = riskLevel === 'HIGH' ? 'var(--danger)' : riskLevel === 'MEDIUM' ? 'var(--warning)' : 'var(--success)';
  const levelBg = riskLevel === 'HIGH' ? 'var(--danger-dim)' : riskLevel === 'MEDIUM' ? 'var(--warning-dim)' : 'var(--success-dim)';
  return (
    <div className="card summary">
      <h3>Общий профиль риска</h3>
      <div className="row">
        <span className="label">Общий риск</span>
        <span className="value" style={{ color:'var(--danger)' }}>{totalRisk}</span>
      </div>
      <div className="row">
        <span className="label">С поддержкой</span>
        <span className="value" style={{ color:'var(--success)' }}>{riskAfterSupport}</span>
      </div>
      <div className="row">
        <span className="label">Уровень</span>
        <span className="value" style={{ color:levelColor, background:levelBg, padding:'2px 10px', borderRadius:6, fontSize:12, fontWeight:700 }}>{riskLevel}</span>
      </div>
    </div>
  );
};