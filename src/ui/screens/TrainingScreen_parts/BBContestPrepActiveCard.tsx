/**
 * BBContestPrepActiveCard.tsx — сводная карточка активного contest prep
 * на главном экране тренировок: текущая фаза, отсчёт до шоу, недели/taper,
 * режим подготовки, калории. Клик — переход в BB-планировщик.
 * Читает профиль (goals.bbContestPrepPlan → legacy bbPeakConfig → legacy поля).
 */
import React, { useMemo } from 'react';
import { getProfile } from '../../../core/profile-manager';
import {
  planFromStored, prepPhaseForDate, isoToday, isoDiffDays,
  PREP_PHASE_LABELS, PREP_PHASE_COLORS, CONTEST_CATEGORY_LABELS,
  type BBContestPrepPlan,
} from '../../../engines/bb/bb-contest-prep.engine';

export const BBContestPrepActiveCard: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const plan: BBContestPrepPlan | null = useMemo(() => {
    try {
      const s = getProfile().settings as any;
      return planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    } catch { return null; }
  }, []);

  const phaseNow = useMemo(() => {
    if (!plan) return null;
    try { return prepPhaseForDate(plan, isoToday()); } catch { return null; }
  }, [plan]);

  const daysLeft = useMemo(() => {
    if (!plan) return null;
    try { return isoDiffDays(isoToday(), plan.showDate); } catch { return null; }
  }, [plan]);

  if (!plan) return null;

  const countdown = daysLeft == null ? null
    : daysLeft < 0 ? { text: `🎬 прошло (${-daysLeft} дн)`, color: '#94a3b8' }
      : daysLeft === 0 ? { text: '🎬 сегодня!', color: '#fbbf24' }
        : daysLeft <= 7 ? { text: `⏳ ${daysLeft} дн`, color: '#f87171' }
          : { text: `⏳ ${daysLeft} дн`, color: '#4ade80' };

  return (
    <div style={{
      marginBottom: 8, padding: 10, borderRadius: 12, cursor: onOpen ? 'pointer' : 'default',
      background: 'linear-gradient(135deg, rgba(236,72,153,0.10), rgba(24,24,27,0.5))',
      border: '1px solid rgba(236,72,153,0.25)', fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5,
    }} onClick={onOpen} role={onOpen ? 'button' : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ fontSize: 13 }}>🏁</span>
        <b style={{ color: '#ec4899' }}>Contest prep</b>
        {countdown && (
          <span style={{ fontSize: 10, fontWeight: 800, color: countdown.color, padding: '1px 8px', borderRadius: 999, background: countdown.color + '18', border: `1px solid ${countdown.color}44` }}>
            {countdown.text}
          </span>
        )}
        {phaseNow && (
          <span style={{ fontSize: 10, fontWeight: 800, color: PREP_PHASE_COLORS[phaseNow.key], padding: '1px 8px', borderRadius: 999, background: PREP_PHASE_COLORS[phaseNow.key] + '22', border: `1px solid ${PREP_PHASE_COLORS[phaseNow.key]}55` }}>
            📍 {PREP_PHASE_LABELS[phaseNow.key]}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: 'rgba(255,255,255,0.85)' }}>
        <span>Шоу <b style={{ color: '#fff' }}>{plan.showDate}</b> · {CONTEST_CATEGORY_LABELS[plan.category] ?? plan.category}</span>
        <span>Подготовка <b style={{ color: '#fff' }}>{plan.preparation.weeks}</b> нед</span>
        <span>Taper <b style={{ color: '#fff' }}>{plan.taper.weeks}</b> нед</span>
        <span>Режим: объём <b style={{ color: '#fff' }}>{Math.round((plan.preparation.volumeMult ?? 1) * 100)}%</b></span>
        <span>Темп <b style={{ color: '#fff' }}>{plan.preparation.targetRatePctPerWeek}%/нед</b></span>
        <span>Ккал <b style={{ color: '#fff' }}>{plan.preparation.currentCalories}</b></span>
      </div>
      {onOpen && (
        <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#ec4899' }}>
          ⚙️ Открыть планировщик (шаг «🏁 Contest Prep») →
        </div>
      )}
    </div>
  );
};

export default BBContestPrepActiveCard;
