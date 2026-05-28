import React from 'react';
import { SubstanceCard } from '../cards/SubstanceCard';
import { registry } from '../../core/data/registry';

export const SubstancesScreen: React.FC = () => {
  const substances = registry.getDB().substances;
  return (
    <div className="screen substances">
      <h2>База веществ</h2>
      <div className="grid">
        {substances.map(s => <SubstanceCard key={s.id} sub={s} />)}
      </div>
    </div>
  );
};