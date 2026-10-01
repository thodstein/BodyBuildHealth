/**
 * WeeklyReviewCard.tsx — «📅 Недельный разбор» (PRO): план → факт → коррекция.
 * Приверженность + тренд веса за окно + ОДНА рекомендация (калории ±150). Только подача.
 */
import React, { useMemo } from 'react';
import { GlassCard } from './ui';
import { buildWeeklyReview, type WeeklyReviewDay } from './planner-weekly-review.engine';

interface Props {
  days: WeeklyReviewDay[];
  targetKcal: number;
  targetProteinG: number;
  weightLog: { date: string; weightKg: number }[];
  goal: string;
}

const VERDICT_COLOR: Record<string, string> = { on_track: '#22c55e', too_slow: '#f59e0b', too_fast: '#f97316', no_data: '#60a5fa' };
const VERDICT_LABEL: Record<string, string> = { on_track: '✅ В цели', too_slow: '🐢 Медленно', too_fast: '🐇 Быстро', no_data: '📭 Мало данных' };

export const WeeklyReviewCard: React.FC<Props> = ({ days, targetKcal, targetProteinG, weightLog, goal }) => {
  const r = useMemo(() => buildWeeklyReview({ days, targetKcal, targetProteinG, weightLog, goal }), [days, targetKcal, targetProteinG, weightLog, goal]);
  if (r.loggedDays === 0) return null;
  const color = VERDICT_COLOR[r.verdict] || '#60a5fa';
  const rate = r.weightRatePctPerWeek;
  return (
    <GlassCard title="Недельный разбор" icon="📅" color={color}>
      <div data-weekly-review="1" data-verdict={r.verdict}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span data-wr-chip="adherence" style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: `${color}18`, border: `1px solid ${color}44`, color: '#fff' }}>{VERDICT_LABEL[r.verdict]}</span>
          <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff' }}>📆 {r.loggedDays}/{r.windowDays} дн.</span>
          <span data-wr-chip="adherence-pct" style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#fff' }}>🎯 приверженность {r.adherencePct}%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#fff' }}>Средние за окно</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{r.avgKcal} ккал · Б {r.avgProteinG}</div>
            <div style={{ fontSize: 9.5, color: '#fff' }}>цель {targetKcal} · Б {targetProteinG}</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#fff' }}>Вес (тренд)</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {r.weightEndKg != null ? `${r.weightEndKg} кг` : '—'}
              {r.weightDeltaKg != null && <span style={{ color: r.weightDeltaKg < 0 ? '#22c55e' : '#f59e0b', fontWeight: 800 }}>{` (${r.weightDeltaKg > 0 ? '+' : ''}${r.weightDeltaKg})`}</span>}
            </div>
            <div style={{ fontSize: 9.5, color: '#fff' }}>{rate != null ? `${rate}%/нед (цель ${r.targetRatePctPerWeek}%)` : 'нет данных веса'}</div>
          </div>
        </div>
        <div data-wr-reco style={{ fontSize: 10.5, lineHeight: 1.5, color: '#fff' }}>
          {r.kcalAdjust !== 0 && <span style={{ fontWeight: 800, color: '#f59e0b' }}>{r.kcalAdjust > 0 ? `+${r.kcalAdjust}` : r.kcalAdjust} ккал/день · </span>}
          {r.recommendation}
        </div>
      </div>
    </GlassCard>
  );
};
