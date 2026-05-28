import React from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { SystemCard } from '../cards/SystemCard';
import { OrganCard } from '../cards/OrganCard';
import { RiskCard } from '../cards/RiskCard';
import { RecommendationCard } from '../cards/RecommendationCard';
import { InteractionCard } from '../cards/InteractionCard';
import { registry } from '../../core/data/registry';

export const ReportScreen: React.FC = () => {
  const db = registry.getDB();
  return (
    <div className="screen report">
      <SummaryCard totalRisk={12} riskAfterSupport={5} riskLevel="LOW" />
      <h2>Системы</h2>
      <div className="grid">{db.systems.map(s => <SystemCard key={s.id} system={s} />)}</div>
      <h2>Органы</h2>
      <div className="grid">{db.organs.map(o => <OrganCard key={o.id} organ={o} />)}</div>
      <h2>Риски</h2>
      <div className="grid">{db.risks.map(r => <RiskCard key={r.id} risk={r} />)}</div>
      <h2>Взаимодействия</h2>
      <div className="grid">{db.interactions.slice(0, 5).map(i => <InteractionCard key={i.substanceA + i.substanceB} inter={i} />)}</div>
      <h2>Рекомендации</h2>
      <div className="grid">{db.recommendations.map(r => <RecommendationCard key={r.recId} rec={r} />)}</div>
    </div>
  );
};