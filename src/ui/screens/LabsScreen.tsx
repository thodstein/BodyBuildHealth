import React, { useState, useMemo } from 'react';
import { RISK_SYSTEMS } from '../../core/constants';
import type { RiskResult } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYNERGY_PAIRS } from '../../engines/support.engine';
import { LabsOverview } from './LabsScreen_parts/LabsOverview';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsCatalog } from './LabsScreen_parts/LabsCatalog';

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'results' | 'schedule' | 'catalog'>('results');
  const [forceNoLabs, setForceNoLabs] = useState(false);

  const hasLabs = linked.labs && linked.labs.length > 0;

  const labRisks = useMemo(() => {
    if (!hasLabs || !linked.labs) return [];
    const labs = linked.labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    return calculateRiskFromAnalyses({ overallRaw: 0, overallNet: 0, systemBreakdown: {}, mechanisms: {} } as RiskResult, labs);
  }, [hasLabs, linked.labs]);

  const labIndexDetails = useMemo<LabIndexDetail[]>(() => {
    if (!hasLabs || !linked.labs) return [];
    return computeLabIndexDetails(linked.labs);
  }, [hasLabs, linked.labs]);

  const renderContent = () => {
    switch (tab) {
      case 'results': return <LabsResults labs={linked.labs || []} />;
      case 'schedule': return <LabsSchedule />;
      case 'catalog': return <LabsCatalog />;
      default: return <LabsResults labs={linked.labs || []} />;
    }
  };

  return (
    <div className="screen labs">
      <div className="tab-bar">
        {(['results', 'schedule', 'catalog'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'results' ? 'Результаты' : t === 'schedule' ? 'График' : 'Каталог'}
          </button>
        ))}
      </div>
      <div className="screen-content">
        {renderContent()}
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Риски из анализов</h3>
          {labRisks && labRisks.overallNet > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                <div className="label">Общий риск</div>
                <div className="value" style={{ color: getRiskColor(labRisks.overallNet) }}>{labRisks.overallNet}%</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                <div className="label">Источников</div>
                <div className="value">{labRisks.sources.labs?.length || 0}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Нет данных анализов для оценки рисков</div>
          )}
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Индексы</h3>
          {labIndexDetails.length > 0 ? (
            <div className="grid index-grid">
              {labIndexDetails.map((detail, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                  <div className="label">{detail.name}</div>
                  <div className="value" style={{ color: getRiskColor(detail.score) }}>{detail.score}</div>
                  <div className="reference">Норма: {detail.refMin} - {detail.refMax}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Нет индексов для отображения</div>
          )}
        </div>
        {!hasLabs && !forceNoLabs && (
          <div style={{ background: 'rgba(239,68,68,0.15)', padding: 8, borderRadius: 6, marginTop: 8 }}>
            ⚠️ Базовые риски показаны без данных анализов
          </div>
        )}
        <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{ width: '100%', padding: 8, background: forceNoLabs ? 'var(--accent)' : 'var(--danger)', color: forceNoLabs ? '#000' : '#fff', marginTop: 8 }}>
          {forceNoLabs ? '✅ Штраф снят' : '🚫 БЕЗ АНАЛИЗОВ (Штраф)'}
        </button>
      </div>
    </div>
  );
};
