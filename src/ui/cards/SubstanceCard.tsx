import React from 'react';
import type { SubstanceEntry } from '../../core/types';

interface Props { sub: SubstanceEntry; }

export const SubstanceCard: React.FC<Props> = ({ sub }) => (
  <div className="card">
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
      <div className="title" style={{ fontSize:14, fontWeight:600 }}>{sub.name}</div>
      {sub.category && <span className="tag">{sub.category}</span>}
    </div>
    <div className="effects">
      {(sub.effects ?? []).length > 0
        ? (sub.effects ?? []).slice(0,3).map(e => `${e.effect} (${e.strength})`).join(' · ')
        : 'Нет данных по эффектам'}
    </div>
  </div>
);