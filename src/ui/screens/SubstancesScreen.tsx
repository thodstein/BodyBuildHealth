import React from 'react';
import { SubstanceCard } from '../cards/SubstanceCard';
import { registry } from '../../core/data/registry';

export const SubstancesScreen: React.FC = () => {
  const substances = registry.getDB().substances;
  return (
    <div className="screen substances">
      <h2>База веществ</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:12 }}>Всего: {substances.length}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {substances.map(s => <SubstanceCard key={s.id} sub={s} />)}
      </div>
    </div>
  );
};