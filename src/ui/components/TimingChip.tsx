import React from 'react';
import type { TimingInfo } from '../../engines/interactions-calculator';

const FOOD_LABELS: Record<NonNullable<TimingInfo['withFood']>, string> = {
  fasting: '⏰ Натощак',
  before_meal: '⏰ До еды',
  with_meal: '🍽 С едой',
  after_meal: '⏰ После еды',
  any: '⏰ Любое время',
};

const TIME_OF_DAY_LABELS: Record<NonNullable<TimingInfo['timeOfDay']>, string> = {
  morning: '🌅 Утром',
  noon: '☀️ Днём',
  evening: '🌆 Вечером',
  bedtime: '🛌 Перед сном',
};

interface ChipDef {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const TimingChip: React.FC<{ timing?: TimingInfo }> = ({ timing }) => {
  if (!timing) return null;
  const chips: ChipDef[] = [];

  if (timing.intervalHours !== undefined) {
    chips.push({
      label: `⏰ Интервал ${timing.intervalHours}ч`,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.10)',
      border: 'rgba(59,130,246,0.25)',
    });
  }
  if (timing.withFood) {
    chips.push({
      label: FOOD_LABELS[timing.withFood],
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.25)',
    });
  }
  if (timing.timeOfDay) {
    chips.push({
      label: TIME_OF_DAY_LABELS[timing.timeOfDay],
      color: '#06b6d4',
      bg: 'rgba(6,182,212,0.10)',
      border: 'rgba(6,182,212,0.25)',
    });
  }
  if (timing.monitoringPeriod) {
    chips.push({
      label: `📅 ${timing.monitoringPeriod}`,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.10)',
      border: 'rgba(167,139,250,0.25)',
    });
  }
  if (timing.durationDays) {
    chips.push({
      label: `⏳ Курс ${timing.durationDays}`,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(16,185,129,0.25)',
    });
  }
  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {chips.map((c, i) => (
        <span
          key={i}
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '3px 7px',
            borderRadius: 5,
            background: c.bg,
            color: c.color,
            border: `1px solid ${c.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
};
