import React, { useState, useMemo } from 'react';
import { RISK_SYSTEMS } from '../../core/constants';
import type { RiskResult, LabPoint } from '../../core/types';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calculatePenaltyCoefficients } from '../../engines/labs-penalty.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { getRiskColor } from '../../core/utils/risk-colors';
import { useDataLink } from '../../core/data-link';
import { LabsOverview } from './LabsScreen_parts/LabsOverview';
import { LabsResults } from './LabsScreen_parts/LabsResults';
import { LabsSchedule } from './LabsScreen_parts/LabsSchedule';
import { LabsCatalog } from './LabsScreen_parts/LabsCatalog';

export const LabsScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState<'results' | 'schedule' | 'catalog'>('results');
  const [forceNoLabs, setForceNoLabs] = useState(false);

  const hasLabs = linked.labs && linked.labs.length > 0;
  const labs: LabPoint[] = linked.labs || [];

  // Lab risk calculation using overload that takes (RiskResult, LabPoint[]) => RiskResult
  const labRisks = useMemo<RiskResult | null>(() => {
    if (!hasLabs) return null;
    const labData = labs.map(l => ({ ...l, date: l.date || new Date().toISOString().split('T')[0] }));
    // Use base RiskResult then add lab contributions
    const baseRisk: RiskResult = {
      overallRaw: 0,
      overallNet: 0,
      systemBreakdown: {},
    };
    return calculateRiskFromAnalyses(baseRisk, labData);
  }, [hasLabs, labs]);

  // Lab index details: computeLabIndexDetails returns Record<string, LabIndexDetail>
  const labIndexDetails = useMemo(() => {
    if (!hasLabs) return {} as Record<string, LabIndexDetail>;
    return computeLabIndexDetails(labs);
  }, [hasLabs, labs]);

  // Convert to array for rendering
  const indexEntries = useMemo(() => {
    return Object.entries(labIndexDetails).map(([key, detail]) => ({
      key,
      label: detail.label,
      value: Math.round(detail.value * 100),
      interpretation: detail.interpretation,
      mechanism: detail.mechanism,
      markers: detail.markers,
    }));
  }, [labIndexDetails]);

  // Penalty info
  const penalty = useMemo(() => {
    const phase = linked.profile?.settings?.phase || 'baseline';
    return calculatePenaltyCoefficients(
      phase,
      labs,
      [],
      1,
      linked.course,
      forceNoLabs
    );
  }, [linked.profile, labs, linked.course, forceNoLabs]);

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
        {/* Overview Stats */}
        <LabsOverview labs={labs} hasLabs={hasLabs} forceNoLabs={forceNoLabs} setForceNoLabs={setForceNoLabs} />

        {/* Tab Content */}
        {renderContent()}

        {/* Lab-derived Risks */}
        <div className="card" style={{ marginTop: 12 }}>
          <h3>🔬 Риски из анализов</h3>
          {labRisks && labRisks.overallNet > 0 ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Общий риск</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(labRisks.overallNet) }}>
                    {Math.round(labRisks.overallNet)}%
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Систем с отклонениями</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {labRisks.systemBreakdown
                      ? Object.keys(labRisks.systemBreakdown).filter(k => labRisks.systemBreakdown[k].net > 0).length
                      : 0}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Анализов</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{labs.length}</div>
                </div>
              </div>
              {/* Per-system breakdown */}
              {labRisks.systemBreakdown && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(labRisks.systemBreakdown)
                    .filter(([, bd]) => bd.net > 0)
                    .sort(([, a], [, b]) => b.net - a.net)
                    .map(([sys, bd]) => (
                      <div key={sys} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>{sys}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: getRiskColor(bd.net) }}>{Math.round(bd.net)}%</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>
              Нет данных анализов для оценки рисков.<br/>
              <small>Перейдите на вкладку «Результаты» для ввода данных.</small>
            </div>
          )}
        </div>

        {/* Lab Indices */}
        <div className="card" style={{ marginTop: 12 }}>
          <h3>📊 Индексы здоровья</h3>
          {indexEntries.length > 0 ? (
            <div className="grid index-grid">
              {indexEntries.map((detail) => (
                <div key={detail.key} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{detail.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: getRiskColor(detail.value) }}>{detail.value}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{detail.interpretation}</div>
                  {/* Marker details */}
                  {detail.markers && detail.markers.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
                      {detail.markers.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
                          <span>{m.name || m.code}</span>
                          <span>{typeof m.value === 'number' ? m.value.toFixed(1) : m.value} (×{m.weight})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Mechanism */}
                  {detail.mechanism && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                      {detail.mechanism.substring(0, 120)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>
              Нет индексов для отображения.<br/>
              <small>Введите данные анализов для расчёта индексов.</small>
            </div>
          )}
        </div>

        {/* Penalty Info */}
        {(forceNoLabs || !hasLabs) && (
          <div className="card" style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <h3>⚠️ Штраф за отсутствие анализов</h3>
            <div style={{ fontSize: 12 }}>
              <div>Штраф за лабы: <strong>{(penalty.labPenalty * 100).toFixed(0)}%</strong> (множитель ×{penalty.totalMultiplier.toFixed(2)})</div>
              <div>Штраф за диагностику: <strong>{(penalty.diagnosticPenalty * 100).toFixed(0)}%</strong></div>
              {penalty.missingLabsForPhase.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <strong>Недостающие анализы ({penalty.missingLabsForPhase.length}):</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {penalty.missingLabsForPhase.slice(0, 12).map(code => (
                      <span key={code} style={{ background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{code}</span>
                    ))}
                    {penalty.missingLabsForPhase.length > 12 && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>+{penalty.missingLabsForPhase.length - 12} ещё</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{ width: '100%', padding: 8, background: forceNoLabs ? 'var(--accent)' : 'var(--danger)', color: forceNoLabs ? '#000' : '#fff', marginTop: 8, borderRadius: 6, border: 'none', cursor: 'pointer' }}>
              {forceNoLabs ? '✅ Штраф применён — нажми для отмены' : '🚫 БЕЗ АНАЛИЗОВ (Применить штраф)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
