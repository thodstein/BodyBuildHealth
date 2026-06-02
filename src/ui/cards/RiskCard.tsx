import React from 'react';
import type { RiskEntry } from '../../core/types';

interface Props { risk: RiskEntry; }

export const RiskCard: React.FC<Props> = ({ risk }) => {
  const levelClass = risk.level === 'HIGH' || risk.level === 'CRITICAL' ? 'risk-high' : risk.level === 'MEDIUM' ? 'risk-medium' : 'risk-low';
  const levelColor = risk.level === 'HIGH' || risk.level === 'CRITICAL' ? 'var(--danger)' : risk.level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)';
  return (
    <div className={`card ${levelClass}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div className="title" style={{ fontSize:14, fontWeight:600 }}>{risk.title}</div>
        <span style={{ fontSize:11, fontWeight:700, color:levelColor, background:`${levelColor}22`, padding:'2px 8px', borderRadius:6 }}>{risk.level}</span>
      </div>
      <div className="desc">{risk.text}</div>
    </div>
  );
};