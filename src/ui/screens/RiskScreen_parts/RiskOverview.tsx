import React from 'react';
import { RISK_SYSTEMS, DRUG_THRESHOLDS } from '../../../core/constants';
import { SYSTEM_INFO, SYSTEM_ORGANS } from '../../../core/risk-info';
import type { RiskResult } from '../../../core/types';
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

function getSystemKeyMarkers(sys: string): string[] {
  return SYSTEM_INFO[sys]?.keyMarkers || [];
}

export const RiskOverview: React.FC<{
  riskResult: RiskResult;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
  penalty: RiskResult | null;
  riskHistory: { date: string; overallRaw: number; overallNet: number }[];
  labRiskContributions: LabRiskContribution | null;
}> = ({ riskResult, forceNoLabs, setForceNoLabs, penalty, riskHistory, labRiskContributions }) => {

  const overallStatus = riskResult.overallNet < 30 ? 'Низкий' : riskResult.overallNet < 50 ? 'Умеренный' : riskResult.overallNet < 70 ? 'Повышенный' : riskResult.overallNet < 85 ? 'Высокий' : 'Критический';
  const overallColor = getRiskColor(riskResult.overallNet);

  return (
    <div className="risk-overview">
      {/* Overall Score */}
      <div className="card">
        <h3>📊 Общий риск</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Raw (без защиты)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: getRiskColor(riskResult.overallRaw) }}>{Math.round(riskResult.overallRaw)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Net (с защитой)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: overallColor }}>{Math.round(riskResult.overallNet)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Статус</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: overallColor }}>{overallStatus}</div>
          </div>
        </div>

        {/* Risk bar */}
        <div style={{ marginTop: 12, background: 'var(--bg-secondary)', borderRadius: 8, height: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, riskResult.overallRaw)}%`, background: getRiskColor(riskResult.overallRaw), borderRadius: 8, opacity: 0.4 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, riskResult.overallNet)}%`, background: overallColor, borderRadius: 8, transition: 'width 0.5s' }} />
          <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: '#000', textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>
            {Math.round(riskResult.overallNet)}%
          </div>
        </div>
      </div>

      {/* Penalty warning */}
      {forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 8, margin: '8px 0' }}>
          <strong>🚫 Применен штраф за отсутствие анализов</strong>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-dim)' }}>
            Множитель риска увеличен. Рекомендуется сдать анализы для точной оценки.
          </div>
        </div>
      )}

      <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{ width: '100%', padding: 10, background: forceNoLabs ? 'var(--accent)' : '#ef4444', color: forceNoLabs ? '#000' : '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, marginTop: 4 }}>
        {forceNoLabs ? '✅ Штраф применён — нажми для отмены' : '🚫 БЕЗ АНАЛИЗОВ (Применить штраф)'}
      </button>

      {/* Systems overview */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>🫀 Системы организма</h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {RISK_SYSTEMS.map((sys: string) => {
            const bd = riskResult.systemBreakdown[sys];
            if (!bd) return null;
            const label = getSystemLabel(sys);
            const icon = getSystemIcon(sys);
            const netColor = getRiskColor(bd.net);
            const labContribution = labRiskContributions?.systemContributions?.[sys] || 0;

            return (
              <div key={sys} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        Raw: {Math.round(bd.raw)}%
                        {labContribution > 0 && <span style={{ color: '#f97316' }}> • Лабы: +{Math.round(labContribution)}%</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: netColor }}>{Math.round(bd.net)}%</div>
                  </div>
                </div>
                {/* Risk bar */}
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, bd.net)}%`, height: '100%', background: netColor, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk History */}
      {riskHistory.length > 1 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>📈 История рисков</h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
            {riskHistory.slice(-8).map((entry, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', background: getRiskColor(entry.overallNet), height: `${Math.max(5, entry.overallNet * 0.5)}px`, borderRadius: 2 }} />
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                  {new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Drug Thresholds */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>💊 Пороги препаратов</h3>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
          Пороговые дозы, при которых риск значительно возрастает
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {Object.entries(DRUG_THRESHOLDS).slice(0, 8).map(([id, thresh]) => (
            <div key={id} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 500 }}>{id.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                Порог: {thresh.dosePerWeek} мг/нед • Андрогенность: {thresh.androgenicity}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Organs */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>🫀 Органы по системам</h3>
        {Object.entries(SYSTEM_ORGANS).slice(0, 6).map(([sys, organs]) => (
          <div key={sys} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>
              {getSystemIcon(sys)} {getSystemLabel(sys)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {organs.map((organ: string, i: number) => (
                <span key={i} style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                  {organ}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

