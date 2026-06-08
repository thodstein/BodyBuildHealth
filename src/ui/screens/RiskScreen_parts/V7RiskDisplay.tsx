import React, { useState } from 'react';
import { SYSTEM_NAMES_RU, MECHANISM_NAMES } from '../../../engines/risk-engine-v7-matrix';
import type { V7RiskResult } from '../../../engines/risk-engine-v7';
import { getRiskColor } from '../../../core/utils/risk-colors';

const ORGAN_LABELS: Record<string, string> = {
  heart: '❤️ Сердце', vessels: '🩸 Сосуды', liver: '🫁 Печень', kidney: '🫘 Почки',
  metabolic: '⚡ Метаболизм', ghigf: '📈 GH/IGF', ins_axis: '🍬 Инсулиновая ось',
  neuro_toxicity: '🧠 Нейротоксичность', endocrine: '🦋 Эндокринная',
  hematologic: '🩸 Кроветворная', reproductive: '🔬 Репродуктивная',
};

const ORGAN_DETAIL: Record<string, Record<number, string>> = {
  heart: { 1: 'Хрон. гемодинамика', 2: 'AR/mTOR гипертрофия', 3: 'Вязкость/тромбоз', 4: 'NaH₂O/объём', 5: 'Атеросклероз', 6: 'Окисл. стресс', 7: 'Интегральный' },
  vessels: { 1: 'Атерогенез', 2: 'Эндотелий', 3: 'Коагуляция', 4: 'Окислительный', 5: 'Фиброз' },
  liver: { 1: '17α + алкоголь', 2: 'Стеатоз', 3: 'Воспаление', 4: 'Фиброз' },
  kidney: { 1: 'Гемодинамика', 2: 'Фильтрация', 3: 'Воспаление' },
  metabolic: { 1: 'IR', 2: 'Липиды', 3: 'GH/IGF' },
  ghigf: { 1: 'Анаболизм', 2: 'NaH₂O' },
  ins_axis: { 1: 'IR', 2: 'Гипогликемия' },
  neuro_toxicity: { 1: 'Дофамин', 2: 'Глутамат', 3: 'ГАМК', 4: 'Нейровоспаление', 5: 'Окисл. стресс', 6: 'ГЭБ', 7: 'Серотонин' },
  endocrine: { 1: 'ГГЯ подавление', 2: 'Ароматизация', 3: 'Пролактин', 4: 'IR', 5: 'Щитовидная', 6: 'Кортизол', 7: 'Десенситизация' },
  hematologic: { 1: 'Эритроцитоз', 2: 'Тромбоцитоз', 3: 'Лейкоцитоз', 4: 'Реология', 5: 'Дефицит Fe', 6: 'Свёртывание', 7: 'Гемолиз' },
  reproductive: { 1: 'Атрофия яичек', 2: 'Олигоспермия', 3: 'Морфология', 4: 'Подвижность', 5: 'ДГПЖ', 6: 'Рак простаты', 7: 'Эректильная дисф.' },
};

export const V7RiskDisplay: React.FC<{ result: V7RiskResult }> = ({ result }) => {
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const { matrix, organSummary, globalRiskRaw, globalRiskNet, globalPEvent, dataQuality, organs, mcResult, pkTimeSeries } = result;

  const getLevel = (v: number) => v < 20 ? 'Низкий' : v < 40 ? 'Умеренный' : v < 60 ? 'Повышенный' : v < 80 ? 'Высокий' : 'Критический';
  const fmtPct = (v: number) => Math.round(v);
  const fmtDec = (v: number, d: number) => v.toFixed(d);

  return (
    <div style={{ padding: '0 0 80px 0' }}>
      {/* Global Risk */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🔬 V7 Risk Engine</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Raw Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskRaw) }}>{fmtPct(globalRiskRaw)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Net Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalRiskNet) }}>{fmtPct(globalRiskNet)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>P(event)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: getRiskColor(globalPEvent * 100) }}>{fmtDec(globalPEvent * 100, 1)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Data Quality</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtPct(dataQuality * 100)}%</div>
          </div>
        </div>
        {/* MC Confidence Intervals */}
        {mcResult && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>p5 Risk</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: getRiskColor(mcResult.p5GlobalRisk) }}>{fmtPct(mcResult.p5GlobalRisk)}%</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Mean Risk</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: getRiskColor(mcResult.meanGlobalRisk) }}>{fmtPct(mcResult.meanGlobalRisk)}%</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>p95 Risk</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: getRiskColor(mcResult.p95GlobalRisk) }}>{fmtPct(mcResult.p95GlobalRisk)}%</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: getRiskColor(globalRiskNet) + '30', color: getRiskColor(globalRiskNet) }}>
            {getLevel(globalRiskNet)} — {result.mode === 'bulk' ? 'Набор' : result.mode === 'cut' ? 'Сушка' : result.mode === 'recomp' ? 'Рекомп.' : result.mode === 'cruise' ? 'Круиз' : 'Бласт'}
          </span>
        </div>
      </div>

      {/* Organ States */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🏥 Состояние органов</h3>
        {Object.entries(organSummary).map(([key, summary]: [string, any]) => {
          const label = ORGAN_LABELS[key] || key;
          const net = Math.round(summary.meanS * 100);
          const isExpanded = expandedOrgan === key;
          const org = organs[key as keyof typeof organs];
          const mechs = org?.mechanisms || [];
          return (
            <div key={key} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setExpandedOrgan(isExpanded ? null : key)}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                    🟠{fmtDec(summary.acute * 100, 0)}% 🔴{fmtDec(summary.chronic * 100, 0)}% 🟣{fmtDec(summary.fibrosis * 100, 0)}%
                  </span>
                  <span style={{ fontWeight: 700, color: getRiskColor(net), fontSize: 16 }}>{net}%</span>
                  <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, margin: '0 8px 4px 8px', overflow: 'hidden' }}>
                <div style={{ width: Math.min(100, net) + '%', height: '100%', background: getRiskColor(net), borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              {isExpanded && mechs.length > 0 && (
                <div style={{ padding: '0 8px 8px 8px' }}>
                  {mechs.map((m: any) => {
                    const detail = ORGAN_DETAIL[key];
                    const name = detail ? detail[m.index] : ('М' + m.index);
                    const dmg = Math.round(m.damage * 100);
                    return (
                      <div key={m.index} style={{ marginBottom: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: 'var(--text-dim)' }}>{m.index}. {name}</span>
                          <span style={{ color: getRiskColor(dmg), fontWeight: 600 }}>{dmg}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                          <div style={{ flex: m.lambdaAcute, background: '#f97316', borderRadius: 2 }} title={'Острый: ' + fmtDec(m.lambdaAcute * 100, 0) + '%'} />
                          <div style={{ flex: m.lambdaChronic, background: '#ef4444', borderRadius: 2 }} title={'Хрон: ' + fmtDec(m.lambdaChronic * 100, 0) + '%'} />
                          <div style={{ flex: Math.max(0.01, 1 - m.lambdaAcute - m.lambdaChronic), background: '#8b5cf6', borderRadius: 2 }} title={'Фиброз: ' + fmtDec((1 - m.lambdaAcute - m.lambdaChronic) * 100, 0) + '%'} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                    CumRisk: {fmtDec(summary.meanCumRisk, 3)} | P(event): {fmtDec(summary.meanPEvent * 100, 1)}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-dim)', textAlign: 'center' }}>
          🟠 Острый | 🔴 Хронический | 🟣 Фиброз — нажмите для деталей
        </div>
      </div>

      {/* Matrix */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>📊 7×7 Матрица</h3>
        {Object.entries(matrix.systems).map(([sysKey, sysData]: [string, any]) => {
          const label = SYSTEM_NAMES_RU[sysKey] || sysKey;
          return (
            <div key={sysKey} style={{ marginBottom: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Raw: <b style={{ color: getRiskColor(sysData.raw) }}>{fmtPct(sysData.raw)}%</b></span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Net: <b style={{ color: getRiskColor(sysData.net) }}>{fmtPct(sysData.net)}%</b></span>
                </div>
              </div>
              {Object.entries(sysData.mechanisms).map(([mechStr, mech]: [string, any]) => {
                const mechIdx = Number(mechStr);
                const mechNames = MECHANISM_NAMES[sysKey];
                const mechName = mechNames ? mechNames[mechIdx] : ('М' + mechIdx);
                const netVal = Math.round(mech.P_net * 100);
                return (
                  <div key={mechStr} style={{ marginBottom: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: 'var(--text-dim)' }}>{mechName}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ color: getRiskColor(mech.P_net * 100) }}>{netVal}%</span>
                        {mech.geneticMult > 1.05 && <span style={{ fontSize: 8, color: '#eab308' }}>⚠️×{mech.geneticMult.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: Math.min(100, netVal) + '%', height: '100%', background: getRiskColor(mech.P_net * 100), borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Engine Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          🔬 Health Engine v7.0 — PK→Hill→Signaling→7мех→Damage/Recovery→MC→Risk<br />
          {mcResult ? 'MC: ✓ сценариев' : 'Детерминированный режим'}
          {pkTimeSeries && Object.keys(pkTimeSeries).length > 0 ? ' | PK: ' + Object.keys(pkTimeSeries).length + ' препаратов' : ''}
        </div>
      </div>
    </div>
  );
};
