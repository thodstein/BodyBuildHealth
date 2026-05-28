import React from 'react';
import { SubstanceCard } from '../cards/SubstanceCard';
import { registry } from '../../core/data/registry';
import { generateStack } from '../../engines/stack-builder.engine';

export const PlanScreen: React.FC<{ goal: string }> = ({ goal }) => {
  const db = registry.getDB();
  const stack = generateStack(goal, 'balanced');
  
  const morning = stack.substances.filter(s => ['stimulants', 'nootropics'].includes(s.category));
  const day = stack.substances.filter(s => ['metabolic', 'cardio', 'immune'].includes(s.category));
  const evening = stack.substances.filter(s => ['anti_stress', 'sleep', 'hormones'].includes(s.category));

  return (
    <div className="screen plan">
      <h2>Утренний приём</h2>
      {morning.map(s => <SubstanceCard key={s.id} sub={s} />)}
      <h2>Дневной приём</h2>
      {day.map(s => <SubstanceCard key={s.id} sub={s} />)}
      <h2>Вечерний приём</h2>
      {evening.map(s => <SubstanceCard key={s.id} sub={s} />)}
    </div>
  );
};