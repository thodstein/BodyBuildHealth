import React from 'react';
import type { RiskEntry } from '../../core/types';

interface Props { risk: RiskEntry; }

export const RiskCard: React.FC<Props> = ({ risk }) => {
  const colors: Record<string, string> = { LOW: '#30d158', MEDIUM: '#ff9f0a', HIGH: '#ff453a', CRITICAL: '#ff2d55' };
  return (
    <div className="card risk" style={{ borderLeft: `4px solid ${colors[risk.level] || '#ccc'}` }}>
      <div className="title">{risk.title}</div>
      <div className="level">{risk.level}</div>
      <div className="desc">{risk.text}</div>
    </div>
  );
};