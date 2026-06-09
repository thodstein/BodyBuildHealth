import React, { useState } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, DRUG_THRESHOLDS } from '../../../core/constants';
import { PHARMA_DB } from '../../../core/pharma-database';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import { RISKS_DB, RISK_SYSTEM_MAP } from '../../../data/risks';
import { RECOMMENDATIONS_DB } from '../../../data/recommendations';
import type { RiskResult } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';
import type { AggregatedRisk } from '../../../engines/risk.engine';
import type { WeeklyRiskDynamics } from '../../../engines/weekly-risk-dynamics.engine';
import { WeeklyRiskChart } from './WeeklyRiskChart';

function getThresholdName(id: string): string {
  const direct = PHARMA_DB[id];
  if (direct) return direct.name;
  const normId = id.replace(/[_\-\s]/g, '').toLowerCase();
  for (const [key, val] of Object.entries(PHARMA_DB)) {
    const normKey = key.replace(/[_\-\s]/g, '').toLowerCase();
    if (normKey === normId) return val.name;
    if (normKey.includes(normId) || normId.includes(normKey)) return val.name;
  }
  return id.replace(/_/g, ' ');
}

interface LabRiskContribution { systemContributions: Record<string, number>; totalRisk: number; }

function getSystemIcon(sys: string): string { return SYSTEM_INFO[sys]?.icon || '⚠️'; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || sys; }

const SYSTEM_LABELS_SHORT: Record<string, string> = {
  cardio: '❤️ Сердце', hepatic: '🫁 Печень', renal: '💧 Почки',
  neuro: '🧠 Нервная', endocrine: '⚖️ Эндокр.', hematologic: '🩸 Кровь',
  reproductive: '💪 Репрод.', musculoskeletal: '🦴 ОДА',
  metabolic: '⚖️ Метаб.', ghigf: '💪 ГР/ИФР-1', ins_axis: '💉 Инсулин',
  neuro_toxicity: '⚠️ Нейротокс.', blood: '🩸 Кровь', vessels: '🫀 Сосуды',
  immunity: '🛡️ Иммун.', thyroid: '🦋 Щитов.', prostate: '🔬 Простата', skin: '🧴 Кожа',
};

function mapRiskSystem(riskSystem: string): string {
  return RISK_SYSTEM_MAP[riskSystem] || riskSystem;
}

export const RiskOverview: React.FC<{
  riskResult: RiskResult;
  globalNoLabs: boolean;
  noLabsSystems: string[];
  riskHistory?: { date: string; overallRaw: number; overallNet: number }[];
  labRiskContributions: LabRiskContribution | null;
  aggregatedRisk?: AggregatedRisk | null;
  weeklyDynamics?: WeeklyRiskDynamics | null;
}> = ({ riskResult, globalNoLabs, noLabsSystems, riskHistory, labRiskContributions, aggregatedRisk, weeklyDynamics }) => {
  const [chartSelectedWeek, setChartSelectedWeek] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'week' | 'average'>('average');

  const overallStatus = riskResult.overallNet < 30 ? 'Низкий' : riskResult.overallNet < 50 ? 'Умеренный' : riskResult.overallNet < 70 ? 'Повышенный' : riskResult.overallNet < 85 ? 'Высокий' : 'Критический';
  const overallColor = getRiskColor(riskResult.overallNet);

  // Filter risks that belong to systems with elevated risk (>20%), deduplicate by system
  const relevantRisks = React.useMemo(() => {
    const seenSystems = new Set<string>();
    return RISKS_DB.filter(r => {
      const mappedSystem = mapRiskSystem(r.system);
      const sysBd = riskResult.systemBreakdown[mappedSystem];
      if (!sysBd || sysBd.net <= 20) return false;
      if (seenSystems.has(mappedSystem)) return false;
      seenSystems.add(mappedSystem);
      return true;
    }).slice(0, 8);
  }, [riskResult.systemBreakdown]);

  // Get recommendations matching actual risk levels for each system
  const relevantRecs = React.useMemo(() => {
    const riskLevel = (net: number): string => {
      if (net >= 70) return 'HIGH';
      if (net >= 40) return 'MEDIUM';
      if (net >= 20) return 'LOW';
      return 'NONE';
    };

    const systemMapped: Record<string, string> = {};
    for (const [sys, bd] of Object.entries(riskResult.systemBreakdown)) {
      if (!bd || bd.net <= 20) continue;
      const level = riskLevel(bd.net);
      let found = false;
      for (const rec of RECOMMENDATIONS_DB) {
        if (found) break;
        if (rec.type !== 'RISK') continue;
        const mappedSystem = mapRiskSystem(rec.riskId.split('_')[0].toLowerCase());
        if (mappedSystem === sys && rec.level === level) {
          if (!systemMapped[sys]) systemMapped[sys] = rec.recId;
          found = true;
        }
      }
      if (!found) {
        const fallbacks = RECOMMENDATIONS_DB.filter(r =>
          r.type === 'RISK' && mapRiskSystem(r.riskId.split('_')[0].toLowerCase()) === sys
        );
        if (fallbacks.length > 0) systemMapped[sys] = fallbacks[fallbacks.length - 1].recId;
      }
    }
    const matchingRecs = RECOMMENDATIONS_DB.filter(r => Object.values(systemMapped).includes(r.recId));
    const seenTypes = new Set<string>();
    return matchingRecs.filter(r => {
      if (seenTypes.has(r.riskId)) return false;
      seenTypes.add(r.riskId);
      return true;
    }).slice(0, 6);
  }, [riskResult.systemBreakdown]);

  const anyNoLabs = globalNoLabs || noLabsSystems.length > 0;

  return (
    <div className="risk-overview">
      {/* Общий риск */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 'clamp(13, 4vw, 15)' }}>📊 Общий риск</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 4 }}>
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

      {/* Penalty info */}
      {anyNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.12)', padding: 10, borderRadius: 8, marginBottom: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#ef4444' }}>🚫 Штраф за отсутствие анализов</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {globalNoLabs ? 'Штраф применён ко всем системам' : `Штраф применён к: ${noLabsSystems.map(s => getSystemLabel(s)).join(', ')}`}
          </div>
        </div>
      )}

      {/* Понедельная динамика рисков */}
      {weeklyDynamics && (
        <WeeklyRiskChart
          dynamics={weeklyDynamics}
          selectedWeek={chartSelectedWeek}
          onWeekSelect={setChartSelectedWeek}
          mode={chartMode}
          onModeChange={setChartMode}
        />
      )}

      {/* Системные риски */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 15 }}>🫀 Риски по системам</h3>
        <div style={{ display: 'grid', gap: 5 }}>
          {ALL_RISK_SYSTEMS.map((sys: string) => {
            const bd = riskResult.systemBreakdown[sys];
            if (!bd) return null;
            const label = SYSTEM_LABELS_SHORT[sys] || getSystemLabel(sys);
            const netPct = Math.round(bd.net);
            return (
              <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px 8px' }}>
                <span style={{ fontSize: 11, minWidth: 70, color: netPct > 30 ? getRiskColor(bd.net) : 'var(--text-dim)', fontWeight: netPct > 30 ? 600 : 400 }}>{label}</span>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, bd.net)}%`, height: '100%', background: getRiskColor(bd.net), borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ padding: '1px 6px', borderRadius: 3, fontWeight: 700, fontSize: 10, color: '#fff', background: getRiskColor(bd.net), minWidth: 24, textAlign: 'center' }}>{netPct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ключевые риски */}
      {relevantRisks.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>⚡ Ключевые риски</h3>
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


      {/* Источники рисков */}
      {aggregatedRisk && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>🔍 Источники рисков</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>💊 Фарма</div>
              <div style={{ fontWeight: 700, color: getRiskColor(aggregatedRisk.pharma.overallNet) }}>{Math.round(aggregatedRisk.pharma.overallNet)}%</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>🧪 Анализы</div>
              <div style={{ fontWeight: 700, color: getRiskColor(aggregatedRisk.labs.overallNet) }}>
                {anyNoLabs ? `🚫 ${Math.round(aggregatedRisk.labs.overallNet)}%` : `${Math.round(aggregatedRisk.labs.overallNet)}%`}
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>🏋️ Тренировки</div>
              <div style={{ fontWeight: 700, color: getRiskColor(aggregatedRisk.training.overallNet) }}>{Math.round(aggregatedRisk.training.overallNet)}%</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>🥗 Питание</div>
              <div style={{ fontWeight: 700, color: getRiskColor(aggregatedRisk.nutrition.overallNet) }}>{Math.round(aggregatedRisk.nutrition.overallNet)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Рекомендации */}
      {relevantRecs.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>✅ Рекомендации</h3>
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

      {/* История */}
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

      {/* Пороги */}
      {/* Пороги препаратов */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>💊 Пороги препаратов</h3>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>Максимальная рекомендуемая дозировка — превышение значительно увеличивает риски</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 10 }}>
          {Object.entries(DRUG_THRESHOLDS).slice(0, 8).map(([id, thresh]) => {
            const name = getThresholdName(id);
            const entry = PHARMA_DB[id];
            const drugClass = entry ? entry.class : "";
            return (
              <div key={id} style={{ background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: 4 }}>
                <div style={{ fontWeight: 500 }}>{name}</div>
                <div style={{ color: "var(--text-dim)" }}>{thresh.dosePerWeek} мг/нед · Андрогенность: {thresh.androgenicity.toFixed(1)}</div>
                {drugClass && <div style={{ fontSize: 8, color: "var(--accent)", opacity: 0.7 }}>{drugClass}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};