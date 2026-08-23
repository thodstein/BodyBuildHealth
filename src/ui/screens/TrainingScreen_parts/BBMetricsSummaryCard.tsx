/**
 * BBMetricsSummaryCard.tsx — структурированная сводка метрик BB-плана.
 *
 * Заменяет «сырой» вывод explainBBMetrics (английский текст одной строкой) на
 * шаге «Качество» ББ-авто: плитки по ротации, разбивка по мышцам с русскими
 * названиями, статусом против MEV/MAV/MRV, hard-сетами и предупреждениями.
 *
 * Актуализировано под текущий движок (bb-metrics.engine):
 * - метрики считаются по ПИКОВОЙ неделе (макс. объём), а не первой;
 * - частота — средняя за мезоцикл (×/нед), не только пик-ротация;
 * - отдельно direct / effective сеты (эффективные с учётом межмышечной работы);
 * - MRV уже скорректирован PED-множителем и volumeLandmarks плана.
 */
import React from 'react';
import type { BBPlanMetrics, BBMuscleVolume } from '../../../engines/bb/bb-metrics.engine';
import { GROUP_RU } from './program-types';
import { CARD } from './training-ui';

const ACCENT = '#00e68a';

const STATUS_RU: Record<BBMuscleVolume['status'], { label: string; color: string }> = {
  below_mev: { label: 'Недотрен', color: '#60a5fa' },
  optimal: { label: 'Оптимум', color: '#22c55e' },
  approaching_mrv: { label: 'Около MRV', color: '#f59e0b' },
  exceeding_mrv: { label: 'Перегруз', color: '#ef4444' },
};

const Tile: React.FC<{ label: string; value: string; color?: string; hint?: string }> = ({ label, value, color = 'rgba(255,255,255,0.9)', hint }) => (
  <div style={{ padding: '8px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', minWidth: 0 }}>
    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    {hint && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{hint}</div>}
  </div>
);

export const BBMetricsSummaryCard: React.FC<{ metrics: BBPlanMetrics | null }> = ({ metrics }) => {
  if (!metrics) return null;
  const лёгPct = Math.max(0, 100 - metrics.тяжPct * 100 - metrics.пампPct * 100);
  const rows = [...metrics.perMuscle].sort((a, b) => b.totalSets - a.totalSets);
  return (
    <div style={{ ...CARD, marginTop: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>📊 Сводка плана</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>
            Метрики по пиковой неделе · {metrics.sessionsPerRotation} сессий/ротацию
          </div>
        </div>
        {metrics.mrvMultiplier > 1 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
            💉 MRV ×{metrics.mrvMultiplier.toFixed(2)}
          </span>
        )}
      </div>

      {/* Плитки-показатели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
        <Tile label="Сетов/ротацию" value={String(metrics.totalSets)} color="#fff" hint="direct, пик-неделя" />
        <Tile label="Тяж" value={(metrics.тяжPct * 100).toFixed(0) + '%'} color="#ef4444" />
        <Tile label="Памп" value={(metrics.пампPct * 100).toFixed(0) + '%'} color="#60a5fa" />
        <Tile label="Лёг" value={лёгPct.toFixed(0) + '%'} color="rgba(255,255,255,0.85)" />
        <Tile label="Ср. RIR" value={metrics.avgRir.toFixed(1)} color="#f59e0b" />
        <Tile
          label="Hard-сеты"
          value={String(metrics.hardSets)}
          color={metrics.hardSetWarning ? '#ef4444' : '#22c55e'}
          hint="RIR < 1 (до отказа)"
        />
      </div>

      {/* Предупреждение по hard-сетам */}
      {metrics.hardSetWarning && (
        <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 10, color: '#f87171', lineHeight: 1.45 }}>
          {metrics.hardSetWarning}
        </div>
      )}

      {/* Разбивка по мышцам */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
        Объём на мышцу (vs MEV/MAV/MRV)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(m => {
          const st = STATUS_RU[m.status];
          const ru = GROUP_RU[m.muscle] || m.muscle;
          return (
            <div key={m.muscle} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', minWidth: 0 }}>{ru}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: st.color, background: st.color + '14', border: '1px solid ' + st.color + '30', padding: '1px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                  {st.label} · {m.effectiveSets}с
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
                <span>direct {m.directSets}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: '#ef4444' }}>тяж {m.тяжSets}</span>
                <span style={{ color: '#60a5fa' }}>памп {m.пампSets}</span>
                <span style={{ opacity: 0.7 }}>лёг {m.лёгSets}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>RIR {m.avgRir.toFixed(1)}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{m.frequencyPerRotation}×/нед</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: '#22c55e' }}>MEV {m.mev}</span>
                <span style={{ color: '#f59e0b' }}>MAV {m.mav}</span>
                <span style={{ color: '#ef4444' }}>MRV {m.mrv}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BBMetricsSummaryCard;
