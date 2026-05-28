import React from 'react';
import type { SubstanceEntry } from '../../core/types';

interface Props { sub: SubstanceEntry; }

export const SubstanceCard: React.FC<Props> = ({ sub }) => (
  <div className="card substance">
    <div className="title">{sub.name}</div>
    <div className="category">{sub.category}</div>
    <div className="effects">{sub.effects.map(e => `${e.effect} (${e.strength})`).join(', ')}</div>
  </div>
);