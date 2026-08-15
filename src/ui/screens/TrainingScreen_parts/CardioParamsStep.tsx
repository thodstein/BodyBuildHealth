/**
 * CardioParamsStep.tsx — шаг 1 мастера кардио: цель, горизонт, доступные дни,
 * уровень восстановления. Карточки целей с описаниями вместо голых чипов.
 */
import React from 'react';
import { CARDIO_GOAL_LABELS, type CardioGoal } from '../../../engines/lms/cardio.engine';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40,
};
const GOAL_CARD: React.CSSProperties = {
  flex: '1 1 140px', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)',
};
const GOAL_CARD_ACTIVE: React.CSSProperties = {
  ...GOAL_CARD, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
};

const GOAL_DESC: Record<CardioGoal, string> = {
  health: '2-3× Zone 2, аэробная база для здоровья ССС',
  mass: 'Минимум кардио — только восстановление, не мешает росту',
  cut: 'Прогрессия Zone 2 2×30 → 3×45 + HIIT, делоды каждые 4 нед',
  recomp: 'Умеренное Zone 2 2×25-30, здоровье без вреда для набора',
  maintenance: 'Стабильное Zone 2 2×30, поддержание ССС',
  recovery: 'Лёгкое кардио 2-3× для кровотока и мобильности',
};

export const CardioParamsStep: React.FC<{
  goal: CardioGoal;
  setGoal: (g: CardioGoal) => void;
  totalWeeks: number;
  setTotalWeeks: (n: number) => void;
  daysAvailable: number;
  setDaysAvailable: (n: number) => void;
  recoveryLow: boolean;
  setRecoveryLow: (v: boolean) => void;
}> = ({ goal, setGoal, totalWeeks, setTotalWeeks, daysAvailable, setDaysAvailable, recoveryLow, setRecoveryLow }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={CARD}>
        <div style={LABEL}>🎯 Цель цикла</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(CARDIO_GOAL_LABELS) as CardioGoal[]).map(g => (
            <div key={g} style={goal === g ? GOAL_CARD_ACTIVE : GOAL_CARD} onClick={() => setGoal(g)} role="button" aria-label={`Цель: ${CARDIO_GOAL_LABELS[g]}`}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{CARDIO_GOAL_LABELS[g]}</div>
              <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.35, opacity: 0.75 }}>{GOAL_DESC[g]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>⏱ Горизонт</div>
        <div style={ROW}>
          <span style={LABEL}>Недель</span>
          <button style={BTN} onClick={() => setTotalWeeks(Math.max(1, totalWeeks - 1))} aria-label="Меньше недель">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 34, textAlign: 'center' }}>{totalWeeks}</span>
          <button style={BTN} onClick={() => setTotalWeeks(Math.min(52, totalWeeks + 1))} aria-label="Больше недель">+</button>
          <span style={{ ...LABEL, marginLeft: 12 }}>Дней в неделю</span>
          <button style={BTN} onClick={() => setDaysAvailable(Math.max(0, daysAvailable - 1))} aria-label="Меньше дней">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{daysAvailable}</span>
          <button style={BTN} onClick={() => setDaysAvailable(Math.min(7, daysAvailable + 1))} aria-label="Больше дней">+</button>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
          Горизонт цикла и сколько дней можно выделить под кардио поверх силовых тренировок.
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>🧘 Восстановление</div>
        <div style={ROW}>
          <button
            style={recoveryLow ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setRecoveryLow(!recoveryLow)}
          >
            {recoveryLow ? '🧘 Низкое восстановление (HIIT убран)' : '🟢 Восстановление в норме'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          При низком восстановлении (сон/HRV/ACWR) интенсивные сессии исключаются из цикла.
        </div>
      </div>
    </div>
  );
};
