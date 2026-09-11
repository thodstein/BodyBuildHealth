/**
 * BbQualityV2Card.tsx — V2-панель качества в шаге «План» ББ-авто (Quality Hub PRO, продолжение).
 * S5 («🛡 Единое качество плана») НЕ тронут — эта карточка рендерится ВНУТРИ него ниже,
 * показывает только НОВЫЙ сигнал V2 (без дублей объёма): session-кап, split-частота,
 * RIR, делод-призрак, плечо-v2, длина, нагрузка, MV. Read-only, мостов нет
 * (исправления — в хабе «Качество» через QualityActions).
 */
import React, { useMemo } from 'react';
import type { QualityScoreV2 } from '../../../engines/quality-score-v2.engine';
import { v2OnlyIssues } from '../../../engines/bb/bb-quality-v2.engine';

const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export const BbQualityV2Card: React.FC<{ v2: QualityScoreV2 | null; todayBadge?: string | null }> = ({ v2, todayBadge }) => {
  const only = useMemo(() => v2OnlyIssues(v2), [v2]);
  if (!v2) return null;
  const color = v2.score >= 85 ? '#00e68a' : v2.score >= 65 ? '#fbbf24' : v2.score >= 45 ? '#fb923c' : '#f87171';
  const bars: Array<[string, number, number]> = [
    ['Объём', v2.breakdown.volume, 40],
    ['Частота', v2.breakdown.frequency, 15],
    ['RIR', v2.breakdown.rir, 10],
    ['Делод', v2.breakdown.deload, 10],
    ['Плечо', v2.breakdown.shoulder, 10],
    ['Длина', v2.breakdown.length, 10],
    ['Нагрузка', v2.breakdown.load, 5],
  ];
  return (
    <div data-bb="quality-v2" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}30` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>⭐ V2-качество {v2.grade}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color, ...NUM }}>{v2.score}<span style={{ fontSize: 10, opacity: 0.6 }}>/100</span></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {bars.map(([label, got, max]) => {
          const pct = Math.round((got / max) * 100);
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#fff' }}>
              <span style={{ minWidth: 56, fontWeight: 700 }}>{label}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#00e68a' : pct >= 50 ? '#fbbf24' : '#f87171', borderRadius: 3 }} />
              </div>
              <span style={{ ...NUM, minWidth: 40, textAlign: 'right' }}>{got}/{max}</span>
            </div>
          );
        })}
      </div>
      {!v2.meta.hasDiary && (
        <div style={{ fontSize: 9, color: '#fff', opacity: 0.75, marginBottom: 4 }}>
          Нагрузка: нет дневника sRPE — слой ACWR не штрафует (запишите тренировки для точности).
        </div>
      )}
      {v2.meta.hasDiary && todayBadge && (
        <div data-bb="quality-v2-today" style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          {todayBadge}
        </div>
      )}
      {only.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {only.slice(0, 6).map(i => (
            <div key={i.id} style={{ fontSize: 9, padding: '4px 6px', borderRadius: 6, background: i.severity === 'critical' ? 'rgba(248,113,113,0.10)' : 'rgba(251,191,36,0.08)', color: i.severity === 'critical' ? '#fca5a5' : '#fcd34d', border: '1px solid rgba(255,255,255,0.08)' }}>
              • {i.message}
            </div>
          ))}
          {only.length > 6 && <div style={{ fontSize: 9, color: '#fff', opacity: 0.7 }}>…и ещё {only.length - 6} (полный список — в хабе «Качество»)</div>}
        </div>
      ) : (
        <div style={{ fontSize: 9, color: '#6ee7b7' }}>✓ Новых V2-замечаний нет — частота/RIR/делод/плечо/длина в норме.</div>
      )}
    </div>
  );
};

export default BbQualityV2Card;
