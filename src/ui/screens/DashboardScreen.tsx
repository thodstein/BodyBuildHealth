import React, { useEffect, useState } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { SystemCard } from '../cards/SystemCard';
import { RiskCard } from '../cards/RiskCard';
import { RecommendationCard } from '../cards/RecommendationCard';
import { registry } from '../../core/data/registry';
import type { MasterDB } from '../../core/types';

export const DashboardScreen: React.FC = () => {
  const [db, setDb] = useState<MasterDB | null>(null);

  useEffect(() => {
    const data = registry.getDB();
    setDb(data);
  }, []);

  if (!db) return <div className="screen dashboard">Загрузка...</div>;

  return (
    <div className="screen dashboard">
      <SummaryCard totalRisk={15} riskAfterSupport={8} riskLevel="LOW" />
      <h2>Системы организма</h2>
      <div className="grid systems">
        {db.systems.slice(0, 4).map(s => <SystemCard key={s.id} system={s} />)}
      </div>
      <h2>Ключевые риски</h2>
      <div className="grid risks">
        {db.risks.slice(0, 3).map(r => <RiskCard key={r.id} risk={r} />)}
      </div>
      <h2>Главные рекомендации</h2>
      <div className="grid recs">
        {db.recommendations.slice(0, 5).map(r => <RecommendationCard key={r.recId} rec={r} />)}
      </div>
    </div>
  );
};