import React from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { RISK_SYSTEMS } from '../../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import type { RiskResult, MechanismCell } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface LabRiskContribution {
  systemContributions: Record<string, number>;
  totalRisk: number;
}

function getSystemIcon(sys: string): string {
  return SYSTEM_INFO[sys]?.icon || '⚠️';
}

function getSystemLabel(sys: string): string {
  return SYSTEM_INFO[sys]?.label || sys;
}

function getSystemDescription(sys: string): string {
  return SYSTEM_INFO[sys]?.description || '';
}

function getSystemWhatAffects(sys: string): string[] {
  return SYSTEM_INFO[sys]?.whatAffects || [];
}

function getSystemSymptoms(sys: string): string[] {
  return SYSTEM_INFO[sys]?.symptoms || [];
}

function getMechanismInfo(mechNum: number): { label: string; description: string; howDamaged: string; examples: string[] } | null {
  const info = MECHANISM_INFO[mechNum];
  if (!info) return null;
  return {
    label: info.label,
    description: info.description,
    howDamaged: info.howDamaged,
    examples: info.examples || [],
  };
}

export const RiskDetails: React.FC<{
  riskResult: RiskResult;
  labRiskContributions: LabRiskContribution | null;
}> = ({ riskResult, labRiskContributions }) => {

  // Generate recommendations from risk data
  const recommendations: { text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (riskResult.overallNet > 60) {
    recommendations.push({ text: '⚠️ Общий риск ВЫСОКИЙ — обязательная консультация врача', priority: 'high' });
  }
  if (riskResult.overallNet > 40) {
    recommendations.push({ text: 'Рекомендуется расширенный чек-ап анализов', priority: 'medium' });
  }

  for (const sys of RISK_SYSTEMS) {
    const bd = riskResult.systemBreakdown[sys];
    if (bd && bd.net > 70) {
      recommendations.push({
        text: `${getSystemIcon(sys)} ${getSystemLabel(sys)}: риск ${Math.round(bd.net)}% — необходим мониторинг и превентивные меры`,
        priority: 'high'
      });
    } else if (bd && bd.net > 50) {
      recommendations.push({
        text: `${getSystemIcon(sys)} ${getSystemLabel(sys)}: риск ${Math.round(bd.net)}% — рекомендуется контроль`,
        priority: 'medium'
      });
    }
  }

  if (riskResult.overallNet < 30) {
    recommendations.push({ text: '✅ Общий риск низкий — продолжайте текущую стратегию защиты', priority: 'low' });
  }

  // Collect contributors from mechanism detail
  const contributorMap: Record<string, string[]> = {};
  const mitigationMap: Record<string, { substance: string; reduction: number }[]> = {};
  if (riskResult.mechanismDetail) {
    for (const [key, cell] of Object.entries(riskResult.mechanismDetail)) {
      const sys = key.split('_')[0];
      if (!contributorMap[sys]) contributorMap[sys] = [];
      if (!mitigationMap[sys]) mitigationMap[sys] = [];
      if (cell.contributors && cell.contributors.length > 0) {
        contributorMap[sys].push(...cell.contributors);
      }
      if (cell.mitigations && cell.mitigations.length > 0) {
        mitigationMap[sys].push(...cell.mitigations);
      }
    }
  }

  // Deduplicate contributors
  for (const sys of Object.keys(contributorMap)) {
    contributorMap[sys] = [...new Set(contributorMap[sys])];
  }

  return (
    <div className="risk-details">
      {/* Per-system detailed breakdown */}
      <div className="card">
        <h3>📋 Детали по системам</h3>

        {RISK_SYSTEMS.map((sys: string) => {
          const bd = riskResult.systemBreakdown[sys];
          if (!bd) return null;
          const icon = getSystemIcon(sys);
          const label = getSystemLabel(sys);
          const description = getSystemDescription(sys);
          const whatAffects = getSystemWhatAffects(sys);
          const symptoms = getSystemSymptoms(sys);
          const labContrib = labRiskContributions?.systemContributions?.[sys] || 0;

          // Get mechanisms for this system
          const sysMechanisms: { mechNum: number; cell: MechanismCell }[] = [];
          if (riskResult.mechanismDetail) {
            for (const [key, cell] of Object.entries(riskResult.mechanismDetail)) {
              if (key.startsWith(sys + '_')) {
                const mechNum = parseInt(key.split('_')[1], 10);
                sysMechanisms.push({ mechNum, cell });
              }
            }
          }

          return (
            <div key={sys} style={{ marginBottom: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                    {description && <div style={{ fontSize: 10, color: 'var(--text-dim)', maxWidth: 300 }}>{description.substring(0, 100)}...</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(bd.net) }}>{Math.round(bd.net)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Raw: {Math.round(bd.raw)}%</div>
                  {labContrib > 0 && <div style={{ fontSize: 10, color: '#f97316' }}>Лабы: +{Math.round(labContrib)}%</div>}
                </div>
              </div>

              {/* Risk bar */}
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 10, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${Math.min(100, bd.net)}%`, height: '100%', background: getRiskColor(bd.net), borderRadius: 4, transition: 'width 0.3s' }} />
              </div>

              {/* Status badge */}
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  background: bd.net > 80 ? 'rgba(239,68,68,0.2)' : bd.net > 60 ? 'rgba(249,115,22,0.2)' : bd.net > 40 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                  color: bd.net > 80 ? '#ef4444' : bd.net > 60 ? '#f97316' : bd.net > 40 ? '#eab308' : '#22c55e',
                }}>
                  {bd.net > 80 ? '⛔ Критично' : bd.net > 60 ? '🔴 Тревожно' : bd.net > 40 ? '⚡ Умеренно' : '✅ Норма'}
                </span>
              </div>

              {/* Mechanisms breakdown */}
              {sysMechanisms.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Механизмы:</div>
                  {sysMechanisms.map(({ mechNum, cell }) => {
                    const mechInfo = getMechanismInfo(mechNum);
                    return (
                      <div key={mechNum} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                        <span>{mechInfo?.label || `Механизм ${mechNum}`}</span>
                        <span style={{ color: getRiskColor(cell.net) }}>{Math.round(cell.net)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Contributors (drugs) */}
              {contributorMap[sys] && contributorMap[sys].length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Факторы риска:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[...new Set(contributorMap[sys])].map((id: string) => (
                      <span key={id} style={{ background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 10, color: '#f97316' }}>
                        {(PHARMA_DB as any)[id]?.name || id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mitigations (support) */}
              {mitigationMap[sys] && mitigationMap[sys].length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Защита:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[...new Map(mitigationMap[sys].map(m => [m.substance, m])).values()].map((m) => (
                      <span key={m.substance} style={{ background: 'rgba(0,230,138,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 10, color: 'var(--accent)' }}>
                        {m.substance} (−{Math.round(m.reduction * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* What affects */}
              {whatAffects.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    <strong>Влияет на:</strong> {whatAffects.join(', ')}
                  </div>
                </div>
              )}

              {/* Symptoms */}
              {symptoms.length > 0 && bd.net > 40 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    <strong>Симптомы:</strong> {symptoms.join(', ')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>💡 Рекомендации</h3>
        {recommendations.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: 8,
                borderRadius: 6,
                background: rec.priority === 'high' ? 'rgba(239,68,68,0.15)' : rec.priority === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                fontSize: 12,
              }}>
                {rec.text}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>
            Нет специфических рекомендаций — риски в пределах нормы
          </div>
        )}
      </div>

      {/* Risk history note */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>ℹ️ Оценка рисков</h3>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          <p><strong>Raw</strong> — риск без учёта поддержки (препараты + тренировки + генетика).</p>
          <p><strong>Net</strong> — итоговый риск с учётом поддержки (БАДы, препараты поддержки, образ жизни).</p>
          <p>Риск рассчитывается по 8 системам и 7 механизмам повреждения для каждого препарата.</p>
          <p style={{ marginTop: 8, fontSize: 11 }}><em>Данные носят информационный характер и не заменяют консультацию врача.</em></p>
        </div>
      </div>
    </div>
  );
};
