import React from 'react';
import type { SystemEntry } from '../../core/types';

interface Props { system: SystemEntry; onClick?: () => void; }

export const SystemCard: React.FC<Props> = ({ system, onClick }) => {
  const riskTags = system.riskTags ?? [];
  const levelColor = riskTags.some(t => t.includes('высок')) ? 'var(--danger)' :
                     riskTags.some(t => t.includes('средн')) ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="card" style={{ borderLeft:`4px solid ${levelColor}`, cursor:onClick?'pointer':'default' }} onClick={onClick}>
      <div className="title" style={{ fontSize:14, fontWeight:600 }}>{system.name}</div>
      <div className="organs">{system.keyBiomarkers?.slice(0,3).join(' · ') ?? system.description.slice(0,40)}</div>
      <div className="desc" style={{ marginTop:4 }}>{system.description.slice(0,60)}</div>
    </div>
  );
};