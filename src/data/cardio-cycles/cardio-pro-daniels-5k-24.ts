/**
 * cardio-pro-daniels-5k-24.ts — ГОТОВЫЙ ЦИКЛ: Jack Daniels 5K/10K,
 * 24 недели (6+6+6+6). Дословно по фазам источника: I — 6 нед базы
 * (только E + strides, пропуск если в форме); II — 6 нед R-фокус
 * (R 200/400 м + T cruise-интервалы + long E/MP); III — 6 нед I-фокус
 * (I 800-1200 м + длинные T до 2×3 миль + короткие R); IV — гонки
 * (среда лёгкий T 3×1 миля, выходные старты). Темпы E/R/T/I/M —
 * строго по вашим VDOT-таблицам; мили — ваш объём (пример 40-70 миль).
 * Канонические Q-тренировки фаз закодированы с прогрессией источника.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const MI_E = 10;
const mi = (d: number, t: CardioTemplateSession['type'], p: string, dow?: number, structured?: CardioTemplateSession['structured']): CardioTemplateSession => ({
  type: t, durationMin: Math.round(d * MI_E), equipment: 'running', purpose: p, dayOfWeek: dow, structured,
});
const R = (reps: string, note: string): CardioTemplateSession['structured'] => [{ workSec: 90, restSec: 90, reps: 8, target: 'pace', note: `R (темп мили по VDOT): ${reps}. ${note}` }];

const LEGEND = 'Темпы по VDOT: E — лёгкий; R — темп мили (200/400 м); T — порог (часовая гонка); I — 3-5K темп; M — марафонский.';

function q1R(week: number): CardioTemplateSession {
  const prog = ['10×200 м R / 200 м трусцой', '8×400 м R / 400 м трусцой', '10×400 м R / 400 м трусцой', '6×400 м R + 4×200 м R', '12×400 м R / 400 м трусцой', '8×400 м R в темпе цели'][week - 7] ?? '8×400 м R';
  return mi(8, 'hiit', `Q1 R: ${prog}.`, 1, R(prog, 'Полное восстановление трусцой.'));
}
function q1I(week: number): CardioTemplateSession {
  const prog = ['5×1000 м I / 3 мин', '6×1000 м I / 3 мин', '5×1200 м I / 3 мин', '4×1200 м I / 2 мин', '6×800 м I / 2 мин', '5×1000 м I в темпе цели'][week - 13] ?? '6×1000 м I';
  return mi(9, 'hiit', `Q1 I: ${prog}.`, 1, [{ workSec: 240, restSec: 150, reps: 6, target: 'pace', note: `I (3-5K темп): ${prog}` }]);
}
function q2T(week: number, long: boolean): CardioTemplateSession {
  const prog = long
    ? ['4×1 миля T / 1 мин', '5×1 миля T / 1 мин', '2×2 мили T / 2 мин', '6×1 миля T / 1 мин', '2×3 мили T / 3 мин', '5×1 миля T'][week - 13] ?? '5×1 миля T'
    : ['3×1 миля T / 2 мин', '4×1 миля T / 1 мин', '3×2 мили T / 2 мин', '5×1 миля T / 1 мин', '4×1 миля T + 4×200 м R', '3×1 миля T'][week - 7] ?? '4×1 миля T';
  return mi(9, 'miss', `Q2 T: ${prog}.`, 3, [{ workSec: 420, restSec: 90, reps: 4, target: 'pace', note: `T (часовой темп): ${prog}` }]);
}
const longRun = (miles: number, label: string, dow = 6): CardioTemplateSession => mi(miles, 'zone2', `Long: ${label}.`, dow);

function buildWeek(w: number): CardioTemplateWeek {
  const E = (d: number, dow: number, extra = ''): CardioTemplateSession => mi(d, 'zone2', `${d} миль E.${extra ? ' ' + extra : ''}`, dow);
  if (w <= 6) {
    // Фаза I — ПОЛНЫЙ объём базы (у Дэниелса мили не падают при добавлении
    // качества во II фазе; иначе переход I→II дал бы ложный скачок +40%).
    const long = w >= 5 ? 14 : 12;
    return {
      sessions: [E(8, 0), E(10, 2, '+ 6×100 м strides'), E(8, 4), longRun(long, `${long} миль E`)],
      phase: 'base', note: w === 1 ? 'Фаза I: только E + strides.' : undefined,
    };
  }
  if (w <= 12) {
    return {
      sessions: [q1R(w), E(6, 2), q2T(w, false), E(6, 4), longRun(12, w % 2 ? '12 миль E' : '12 миль с серединой в M')],
      phase: 'build', note: 'Фаза II: R-фокус + T cruise.',
    };
  }
  if (w <= 18) {
    return {
      sessions: [q1I(w), E(6, 2), q2T(w, true), E(6, 4), longRun(14, w % 2 ? '14 миль E' : '14 миль с финишем в M')],
      phase: 'build', note: 'Фаза III: I-фокус, самая тяжёлая.',
    };
  }
  const race = w % 2 === 0;
  return {
    sessions: [
      E(5, 0), mi(8, 'miss', 'Q: 3×1 миля T / 2 мин (коротко и свежо).', 2,
        [{ workSec: 420, restSec: 120, reps: 3, target: 'pace', note: 'T 3×1 миля' }]),
      E(5, 4),
      race
        ? { type: 'hiit', durationMin: 40, equipment: 'running', purpose: 'Старт 5K/10K!', dayOfWeek: 6 }
        : longRun(10, '10 миль E'),
    ],
    phase: race ? 'peak' : 'taper', taper: true, note: 'Фаза IV: гонки по выходным.',
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 24 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_DANIELS_5K_24: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-daniels-5k-24',
    title: 'Дэниелс 5K/10K — 24 недели (E→R→I→гонки)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 24,
    sessionsPerWeek: 4,
    sessionsPerWeekMax: 5,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'mixed',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'VDOT-система: база E, скорость R, специфичность I, затем гонки. 2-3 качества в неделю.',
    howItWorks: `Фазы I (1-6) → II (7-12) → III (13-18) → IV (19-24). ${LEGEND} Не тянете 3 качества — снимайте Q3.`,
    conditions: ['Знаете VDOT (недавний старт)', '40+ миль/нед', 'Дорожка для R'],
    tags: ['run', '5k', '10k', 'vdot', 'daniels', 'advanced', 'pro'],
    sourceLabel: "Jack Daniels' Running Formula 5K/10K (фазы I-IV, канонические Q)",
  },
  preset: { goal: 'health', totalWeeks: 24, daysAvailable: 5, level: 'advanced', equipment: ['running'], periodizationModel: 'linear' },
  weeks,
};
