import React from 'react';
import { HYPERTROPHY_PILLARS, VOLUME_LANDMARKS, REP_RANGES, RIR_RANGES, TEMPO, REST_SEC, type BBLevel } from '../../../engines/bb/bb-foundation.engine';

const CARD: React.CSSProperties = { padding: 12, borderRadius: 10, background: 'rgba(24,24,27,0.45)', border: '1px solid rgba(255,255,255,0.08)', marginTop: 8 };

export const BBFoundationCard: React.FC<{ level?: BBLevel }> = ({ level = 'intermediate' }) => {
  const vm = VOLUME_LANDMARKS[level];
  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#a78bfa' }}>🏛 Основа бодибилдинга — 5 пилларов</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>Schoenfeld · Israetel · Helms — единая модель для всех 4 маршрутов BB-auto</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 6, marginTop: 8 }}>
        {HYPERTROPHY_PILLARS.map(p => (
          <div key={p.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)' }}>
            <div style={{ fontSize: 11, fontWeight: 800 }}>{p.icon} {p.label}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#22c55e' }}>📊 Объёмные ориентиры ({level}) — прямые сеты/нед</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: 6, marginTop: 6 }}>
          {Object.entries(vm).map(([m, lm]) => (
            <div key={m} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{m}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{lm.mev} · {lm.mavLow}-{lm.mavHigh} · {lm.mrv}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>MEV · MAV · MRV — цель внутри MAV, enhanced выше</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Повторы / RIR / Темп</div>
          {(Object.keys(REP_RANGES) as (keyof typeof REP_RANGES)[]).map(ph => (
            <div key={ph} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              <b style={{ textTransform: 'capitalize', color: '#fff' }}>{ph}:</b> {REP_RANGES[ph].heavy.join('-')}/{REP_RANGES[ph].pump.join('-')} · RIR {RIR_RANGES[ph].join('-')} · {TEMPO[ph]} · отдых {REST_SEC[ph].heavy}/{REST_SEC[ph].pump}с
            </div>
          ))}
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Частота</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>1× новичок → 2× продв./enhanced (Schoenfeld 2016). Ни одна мышца кроме икр/пресса не остаётся 1× без специализации.</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Аудит: тяж 40-60% от сетов, иначе warning</div>
        </div>
      </div>
    </div>
  );
};
export default BBFoundationCard;
