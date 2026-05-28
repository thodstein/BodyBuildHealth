import React from 'react';
import type { SystemEntry } from '../../core/types';

interface Props { system: SystemEntry; onClick?: () => void; }

export const SystemCard: React.FC<Props> = ({ system, onClick }) => {
  const levelColor = system.risk_tags.some(t => t.includes('высок')) ? '#ff453a' :
                     system.risk_tags.some(t => t.includes('средн')) ? '#ff9f0a' : '#30d158';
  return (
    <div className="card system" style={{ borderLeft: `4px solid ${levelColor}`, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="title">{system.name}</div>
      <div className="organs">{system.organs.join(', ')}</div>
      <div className="desc">{system.description}</div>
      <div className="tags">{system.risk_tags.join(' • ')}</div>
    </div>
  );
};