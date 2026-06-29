/**
 * WhatIfCard.tsx — what-if сценарий: как изменение калорий/сна/препаратов
 * повлияет на риск и готовность. Использует runWhatIf из predictive.engine.
 */
import React, { useMemo, useState } from 'react';
import { runWhatIf } from '../../../engines/predictive.engine';
import { PopupNumber, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };

export const WhatIfCard: React.FC<{ baseRisk: number; baseReadiness: number }> = ({ baseRisk, baseReadiness }) => {
  const [calDelta, setCalDelta] = useState(0);     // -500..+500 ккал
  const [sleepDelta, setSleepDelta] = useState(0); // -2..+2 ч
  const [aasMult, setAasMult] = useState(1);       // 0 отмена / 1 / 1.5 / 2

  const res = useMemo(() => runWhatIf(baseRisk, baseReadiness, {
    calorieChange: calDelta,
    sleepChange: sleepDelta,
    drugChange: aasMult !== 1 ? { AAS: aasMult } : undefined,
  }), [baseRisk, baseReadiness, calDelta, sleepDelta, aasMult]);

  const riskColor = res.riskDelta > 0 ? '#ef4444' : res.riskDelta < 0 ? '#22c55e' : 'var(--text-dim)';
  const readColor = res.readinessDelta > 0 ? '#22c55e' : res.readinessDelta < 0 ? '#ef4444' : 'var(--text-dim)';

  return (
    <div className="card" style={{ padding: '12px 14px', background: 'rgba(20,22,30,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 8 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13, color: ACCENT }}>🔮 What-if сценарий (прогноз риск/готовность)</h3>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 10 }}>База: риск {Math.round(baseRisk)}, готовность {Math.round(baseReadiness)}. Меняйте параметры — увидите дельту.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupNumber label="Δ калории (ккал/день)" value={calDelta} min={-500} max={500} step={50} onChange={v => setCalDelta(v)} />
        <PopupNumber label="Δ сон (ч)" value={sleepDelta} min={-2} max={2} step={1} onChange={v => setSleepDelta(v)} />
        <PopupNumber label="AAS множитель" value={aasMult} min={0} max={2} step={0.5} suffix="×" onChange={v => setAasMult(v)} />
      </div>
      <MetricCard title="Прогноз изменения" icon="🔮">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Δ Риск</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: riskColor }}>{res.riskDelta > 0 ? '+' : ''}{res.riskDelta}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{Math.round(baseRisk + res.riskDelta)} итог</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Δ Готовность</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: readColor }}>{res.readinessDelta > 0 ? '+' : ''}{res.readinessDelta}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{Math.round(baseReadiness + res.readinessDelta)} итог</div>
          </div>
        </div>
        <div style={{ ...SMALL, marginTop: 8, padding: 6, background: 'rgba(0,230,138,0.04)', borderRadius: 6 }}>{res.note}</div>
      </MetricCard>
    </div>
  );
};

export default WhatIfCard;