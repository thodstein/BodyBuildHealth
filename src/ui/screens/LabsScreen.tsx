import React, { useState, useMemo } from 'react';
import { RISK_SYSTEMS } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { computeLabIndexDetails } from '../../engines/labs-indices.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink } from '../../core/data-link';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsCatalog } from './LabsScreen_parts/LabsCatalog';

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'results' | 'schedule' | 'catalog'>('results');
  const [forceNoLabs, setForceNoLabs] = useState(false);

  const hasLabs = linked.labs && linked.labs.length > 0;
  const labs: LabPoint[] = linked.labs || [];

  const labRisks = useMemo<RiskResult | null>(() => {
    if (!hasLabs) return null;
    const labData = labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    return calculateRiskFromAnalyses(labData) as unknown as RiskResult;
  }, [hasLabs, labs]);

  const labIndexDetails = useMemo(() => {
    if (!hasLabs) return {} as Record<string, ReturnType<typeof computeLabIndexDetails>[string]>;
    return computeLabIndexDetails(labs);
  }, [hasLabs, labs]);

  const indexEntries = useMemo(() => {
    return Object.entries(labIndexDetails).map(([key, detail]) => ({
      key,
      name: detail.label,
      score: Math.round(detail.value * 100),
      interpretation: detail.interpretation,
    }));
  }, [labIndexDetails]);

  const renderContent = () => {
    switch (tab) {
      case 'results': return <LabsResults labs={labs} />;
      case 'schedule': return <LabsSchedule />;
      case 'catalog': return <LabsCatalog />;
      default: return <LabsResults labs={labs} />;
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
                <div className="value">{labRisks.systemBreakdown ? Object.keys(labRisks.systemBreakdown).filter(k => labRisks.systemBreakdown[k].raw > 0).length : 0}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)' }}>Нет данных анализов для оценки рисков</div>
          )}
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Индексы</h3>
          {indexEntries.length > 0 ? (
            <div className="grid index-grid">
              {indexEntries.map((detail) => (
                <div key={detail.key} style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                  <div className="label">{detail.name}</div>
                  <div className="value" style={{ color: getRiskColor(detail.score) }}>{detail.score}%</div>
                  <div className="reference">{detail.interpretation}</div>
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
