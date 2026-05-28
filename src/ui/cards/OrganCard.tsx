import React from 'react';
import type { OrganEntry } from '../../core/types';

interface Props { organ: OrganEntry; }

export const OrganCard: React.FC<Props> = ({ organ }) => (
  <div className="card organ">
    <div className="title">{organ.name}</div>
    <div className="score">Biomarkers: {organ.keyBiomarkers.join(', ') || '—'}</div>
    <div className="desc">{organ.description}</div>
  </div>
);