import React from 'react';
import type { RecommendationEntry } from '../../core/types';

interface Props { rec: RecommendationEntry; }

export const RecommendationCard: React.FC<Props> = ({ rec }) => (
  <div className="card recommendation">
    <div className="title">{rec.title}</div>
    <div className="text">{rec.text}</div>
    <div className="tag">{rec.trigger_type}</div>
  </div>
);