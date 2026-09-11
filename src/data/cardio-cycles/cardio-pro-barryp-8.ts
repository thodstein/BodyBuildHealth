/**
 * cardio-pro-barryp-8.ts — ГОТОВЫЙ ЦИКЛ: BarryP 3-2-1 (Slowtwitch),
 * 8 недель частотного бега. Канон источника: недельный объём делится
 * на 6 пробежек — 3 короткие по 10%, 2 средние по 20%, 1 длинная 30%;
 * средняя/длинная никогда не подряд; почти всё легко; объём растёт
 * медленно при той же структуре. Пример закодирован от 30 км/нед
 * (+10%/нед до ~55 км): масштабируйте от СВОЕГО текущего объёма,
 * сохраняя пропорции 3-2-1.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const KM_MIN = 6; // мин/км лёгкого бега
const km = (d: number, note: string, dow?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: Math.round(d * KM_MIN), equipment: 'running',
  purpose: `${d} км легко. ${note}`, dayOfWeek: dow,
});

/** Недельный объём в км. */
const VOLUME = [30, 33, 36, 33, 40, 44, 48, 40];

function buildWeek(w: number): CardioTemplateWeek {
  const v = VOLUME[w - 1];
  const r = (x: number): number => Math.round((v * x) * 2) / 2;
  const deload = w === 4 || w === 8;
  return {
    sessions: [
      km(r(0.1), 'Короткая 10%.', 0),
      km(r(0.2), 'Средняя 20% (не после длинной).', 1),
      km(r(0.1), 'Короткая 10%.', 2),
      km(r(0.2), 'Средняя 20%.', 4),
      km(r(0.1), 'Короткая 10%.', 5),
      km(r(0.3), 'Длинная 30% — самая лёгкая по темпу.', 6),
    ],
    phase: deload ? 'base' : 'build',
    deload: deload || undefined,
    note: `Объём ${v} км/нед (3-2-1).${deload ? ' Откат.' : ''}`,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 8 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_BARRY_P_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-barryp-8',
    title: 'BarryP 3-2-1 — 8 недель (частотная база)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 8,
    sessionsPerWeek: 6,
    level: ['beginner', 'intermediate'],
    sport: 'run',
    period: 'base',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Аэробная база частотой 6×/нед: короткие 10% + средние 20% + длинная 30%, всё легко.',
    howItWorks: 'Возьмите СВОЙ недельный объём и разложите 3-2-1; пример закодирован от 30 км; средняя/длинная не подряд; скорость — только strides по желанию после 6 мес базы.',
    conditions: ['Бегаете 6×/нед (можно короткие по 10-15 мин)', 'Всё легко, без скорости'],
    tags: ['run', 'base', 'frequency', 'barryp', 'pro'],
    deloadWeeks: [4, 8],
    sourceLabel: 'BarryP running plan (Slowtwitch): структура 3×10% + 2×20% + 30%',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 6, level: 'beginner', equipment: ['running'], periodizationModel: 'linear' },
  weeks,
};
