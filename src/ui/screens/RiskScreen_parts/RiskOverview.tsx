import React from 'react';
import { RISK_SYSTEMS, DRUG_THRESHOLDS } from '../../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { RISKS_DB } from '../../../data/risks';
import { RECOMMENDATIONS_DB } from '../../../data/recommendations';
import type { RiskResult } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';

interface LabRiskContribution { systemContributions: Record<string, number>; totalRisk: number; }

function getSystemIcon(sys: string): string { return SYSTEM_INFO[sys]?.icon || '⚠️'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || sys; }

const SYSTEM_LABELS_SHORT: Record<string, string> = {
  cardio: '❤️ Сердце', hepatic: '🫁 Печень', renal: '🫘 Почки',
  neuro: '🧠 Нервная', endocrine: '🦋 Эндокр.', hematologic: '🩸 Кровь',
  reproductive: '🔬 Репрод.', musculoskeletal: '💪 ОДА',
  metabolic: '⚡ Метаб.', ghigf: '📈 GH/IGF', ins_axis: '🍬 Инсулин',
  neuro_toxicity: '🧠 Нейротокс.', blood: '🩸 Кровь', vessels: '🫀 Сосуды',
};

export const RiskOverview: React.FC<{
  riskResult: RiskResult;
  globalNoLabs: boolean;
  noLabsSystems: string[];
  riskHistory?: { date: string; overallRaw: number; overallNet: number }[];
  labRiskContributions: LabRiskContribution | null;
}> = ({ riskResult, globalNoLabs, noLabsSystems, riskHistory, labRiskContributions }) => {

  const overallStatus = riskResult.overallNet < 30 ? 'Низкий' : riskResult.overallNet < 50 ? 'Умеренный' : riskResult.overallNet < 70 ? 'Повышенный' : riskResult.overallNet < 85 ? 'Высокий' : 'Критический';
  const overallColor = getRiskColor(riskResult.overallNet);

  // Get relevant risks for current risk level
  const relevantRisks = RISKS_DB.filter(r => {
    const sysBd = riskResult.systemBreakdown[r.system] || riskResult.systemBreakdown[mapRiskSystem(r.system)];
    if (!sysBd) return false;
    return sysBd.net > 20;
  }).slice(0, 8);

  // Get relevant recommendations
  const relevantRecs = RECOMMENDATIONS_DB.filter(rec => {
    const sysBd = riskResult.systemBreakdown[mapRiskSystem(rec.riskId.split('_')[0].toLowerCase())];
    return true; // show top recs
  }).slice(0, 6);

  const anyNoLabs = globalNoLabs || noLabsSystems.length > 0;

  return (
    <div className="risk-overview">
      {/* Overall Score */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📊 Общий риск</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '8px 6px', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Raw</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: getRiskColor(riskResult.overallRaw) }}>{Math.round(riskResult.overallRaw)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '8px 6px', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Net</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: overallColor }}>{Math.round(riskResult.overallNet)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '8px 6px', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Статус</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: overallColor }}>{overallStatus}</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 8, background: 'var(--bg-secondary)', borderRadius: 6, height: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, riskResult.overallRaw)}%`, background: getRiskColor(riskResult.overallRaw), borderRadius: 6, opacity: 0.35 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, riskResult.overallNet)}%`, background: overallColor, borderRadius: 6 }} />
          <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#000', textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>
            {Math.round(riskResult.overallNet)}%
          </div>
        </div>
      </div>

      {/* Penalty info (read-only — managed from LabsScreen) */}
      {anyNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.12)', padding: 10, borderRadius: 8, marginBottom: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#ef4444', marginBottom: 4 }}>🚫 Штраф за отсутствие анализов</div>
          {globalNoLabs ? (
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Глобальный штраф на все системы. Управление — вкладка «Анализы».</div>
          ) : (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Штраф по системам:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {noLabsSystems.map(sys => (
                  <span key={sys} style={{ background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 9, color: '#f97316' }}>
                    {getSystemLabel(sys)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System breakdown */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>🫀 Системные риски</h3>
        <div style={{ display: 'grid', gap: 4 }}>
          {RISK_SYSTEMS.filter(sys => riskResult.systemBreakdown[sys]).map((sys) => {
            const bd = riskResult.systemBreakdown[sys];
            if (!bd) return null;
            const isPenalized = noLabsSystems.includes(sys) || globalNoLabs;
            return (
              <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{getSystemIcon(sys)}</span>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{getSystemLabel(sys)}</span>
                  {isPenalized && <span style={{ fontSize: 8, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 4px', borderRadius: 3 }}>штраф</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 45, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, bd.net)}%`, height: '100%', background: getRiskColor(bd.net), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 11, color: getRiskColor(bd.net), minWidth: 28, textAlign: 'right' }}>{Math.round(bd.net)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Risks */}
      {relevantRisks.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>⚠️ Ключевые риски</h3>
          <div style={{ display: 'grid', gap: 5 }}>
            {relevantRisks.map(risk => {
              const levelColor = risk.levels.includes('HIGH') ? '#ef4444' : risk.levels.includes('MEDIUM') ? '#eab308' : '#22c55e';
              return (
                <div key={risk.id} style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 6, borderLeft: `3px solid ${levelColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{risk.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: levelColor, background: `${levelColor}22`, padding: '2px 6px', borderRadius: 4 }}>{risk.levels[risk.levels.length - 1]}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{risk.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {relevantRecs.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>💡 Рекомендации</h3>
          <div style={{ display: 'grid', gap: 5 }}>
            {relevantRecs.map(rec => {
              const levelColor = rec.level === 'HIGH' || rec.level === 'CRITICAL' ? '#ef4444' : rec.level === 'MEDIUM' ? '#eab308' : '#22c55e';
              return (
                <div key={rec.recId} style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{rec.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: levelColor, background: `${levelColor}22`, padding: '2px 6px', borderRadius: 4 }}>{rec.level}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{rec.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk History */}
      {riskHistory && riskHistory.length > 1 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📈 История</h3>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
            {riskHistory.slice(-8).map((entry, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', background: getRiskColor(entry.overallNet), height: `${Math.max(4, entry.overallNet * 0.45)}px`, borderRadius: 2 }} />
                <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
                  {new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drug Thresholds */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>💊 Пороги</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
          {Object.entries(DRUG_THRESHOLDS).slice(0, 6).map(([id, thresh]) => (
            <div key={id} style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
              <div style={{ fontWeight: 500 }}>{id.replace(/_/g, ' ')}</div>
              <div style={{ color: 'var(--text-dim)' }}>{thresh.dosePerWeek} мг/нед</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function mapRiskSystem(riskSystem: string): string {
  const map: Record<string, string> = {
    structural: 'hepatic', bile: 'hepatic', lab: 'hepatic', toxic: 'hepatic',
    infectious: 'hepatic', autoimmune: 'hepatic', functional: 'hepatic',
    inflammatory: 'musculoskeletal', degenerative: 'musculoskeletal',
    vascular: 'cardio', skin: 'hematologic', vision: 'neuro',
    hormonal: 'endocrine', psychological: 'neuro',
  };
  return map[riskSystem] || riskSystem;
}
