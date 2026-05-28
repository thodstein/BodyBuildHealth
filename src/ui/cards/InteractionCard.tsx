import React from 'react';
import type { InteractionEntry } from '../../core/types';

interface Props { inter: InteractionEntry; }

export const InteractionCard: React.FC<Props> = ({ inter }) => {
  const severityColor = inter.type === 'danger' ? '#ff453a' : inter.type === 'conflict' ? '#ff9f0a' : '#30d158';
  return (
    <div className="card interaction" style={{ borderLeft: `4px solid ${severityColor}` }}>
      <div className="title">{inter.substanceA} × {inter.substanceB}</div>
      <div className="severity">{inter.type.toUpperCase()} ({inter.severity})</div>
      <div className="desc">{inter.description}</div>
    </div>
  );
};