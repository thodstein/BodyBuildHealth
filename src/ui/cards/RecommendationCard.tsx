import React from 'react';
import type { RecommendationEntry } from '../../core/types';

interface Props { rec: RecommendationEntry; }

export const RecommendationCard: React.FC<Props> = ({ rec }) => {
  const levelColor = rec.level === 'HIGH' || rec.level === 'CRITICAL' ? 'var(--danger)' : rec.level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div className="title" style={{ fontSize:14, fontWeight:600 }}>{rec.title}</div>
        <span style={{ fontSize:10, fontWeight:600, color:levelColor, background:`${levelColor}22`, padding:'2px 8px', borderRadius:6 }}>{rec.level}</span>
      </div>
      <div className="desc">{rec.text}</div>
      <div className="tag" style={{ marginTop:8 }}>{rec.riskId}</div>
    </div>
  );
};