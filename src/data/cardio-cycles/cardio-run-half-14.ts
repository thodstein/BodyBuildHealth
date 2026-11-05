/**
 * cardio-run-half-14.ts — Half-marathon 14 недель (Nike NRC).
 * Разметка по Nike Half-Marathon Training Plan: 5×/нед —
 * recovery + intervals (темпы 5к/мили/10к) + fartlek + long (5к → 21к).
 * Прогрессия long и интервалов задана массивами (дословно по плану).
 */
import type { CardioCycleTemplate, CardioStructuredBlock, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const rec = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'recovery', durationMin: d, equipment: 'running', purpose: p, dayOfWeek: dow });
const easy = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'running', purpose: p, dayOfWeek: dow });
const speed = (d: number, p: string, blocks: CardioStructuredBlock[], dow?: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: d, equipment: 'running', purpose: p, dayOfWeek: dow,
  structured: blocks.map(b => ({ ...b, target: 'pace' as const, note: p })),
});
const fartlek = (d: number, p: string, dow?: number): CardioTemplateSession => ({
  type: 'miss', durationMin: d, equipment: 'running', purpose: p, dayOfWeek: dow,
  structured: [{ workSec: 60, restSec: 120, reps: Math.max(4, Math.round(d / 4)), target: 'rpe', note: 'Чередование 1 мин жёстко / 2 мин легко' }],
});

/**
 * Структура скоростных сессий — ПО ТЕКСТУ недели, а не одна на весь план.
 *
 * Раньше buildWeek передавал всем неделям `120/90 × 6`, хотя текст недели 1
 * обещает «8×1 мин», недели 3 — «4×1:30 + 1×1:30», недели 7 — «3×8 мин».
 * Таймер/экспорт получали интервалы, которых в плане нет. Здесь каждая неделя
 * получает ровно то, что написано; где отдых в тексте не назван — restSec 0.
 */
const SPEED_BLOCKS: CardioStructuredBlock[][] = [
  [{ workSec: 60, restSec: 60, reps: 8 }],
  // Лестница 1 / 2 / 3 / 2 / 1 мин (миля → 5к → 10к → 5к → миля), без пауз в тексте.
  [{ workSec: 60, restSec: 0, reps: 1 }, { workSec: 120, restSec: 0, reps: 1 }, { workSec: 180, restSec: 0, reps: 1 }, { workSec: 120, restSec: 0, reps: 1 }, { workSec: 60, restSec: 0, reps: 1 }],
  [{ workSec: 90, restSec: 45, reps: 5 }],
  [{ workSec: 120, restSec: 90, reps: 6 }],
  [{ workSec: 180, restSec: 120, reps: 5 }],
  [{ workSec: 300, restSec: 150, reps: 4 }],
  [{ workSec: 480, restSec: 180, reps: 3 }],
  [{ workSec: 120, restSec: 120, reps: 4 }],
  [{ workSec: 240, restSec: 120, reps: 6 }],
  [{ workSec: 300, restSec: 150, reps: 5 }],
  [{ workSec: 360, restSec: 120, reps: 4 }],
  [{ workSec: 300, restSec: 180, reps: 3 }],
  [{ workSec: 120, restSec: 120, reps: 4 }],
  [{ workSec: 120, restSec: 120, reps: 4 }], // нед.14 — не используется: день старта заменён ниже
];

/** Длинные по неделям (км): 5 → 6.5 → 8 → 10 → 11 → 13 → 15 → 12 → 16 → 18 → 19 → 15 → 10 → 21.1. */
const LONG_KM = [5, 6.5, 8, 10, 11, 13, 15, 12, 16, 18, 19, 15, 10, 21.1];
const longMin = (km: number): number => Math.round(km * 6.5);

const SPEED_NOTES = [
  'Интервалы 8×1 мин в темпе 5к / 1 мин трусцой + разминка 5 мин.',
  'Лестница 1 мин (миля) / 2 мин (5к) / 3 мин (10к) / 2 мин (5к) / 1 мин (миля).',
  'Интервалы 4×1:30 в темпе 5к + 1×1:30 в темпе мили / 45с-1 мин.',
  'Интервалы 6×2 мин в темпе 5к / 90 с трусцой.',
  'Интервалы 5×3 мин в темпе 10к / 2 мин трусцой.',
  'Интервалы 4×5 мин в темпе 10к / 2.5 мин трусцой.',
  'Интервалы 3×8 мин в пороге / 3 мин трусцой.',
  'Лёгкая неделя: 4×2 мин в темпе 10к / 2 мин.',
  'Интервалы 6×4 мин в темпе 10к / 2 мин.',
  'Интервалы 5×5 мин в пороге / 2.5 мин.',
  'Интервалы 4×6 мин в темпе 10к / 2 мин — пик.',
  'Сброс: 3×5 мин в пороге / 3 мин.',
  'Предстарт: 4×2 мин легко-быстро / 2 мин.',
  'СТАРТ: полумарафон 21.1 км!',
];

function buildWeek(w: number): CardioTemplateWeek {
  const deload = w === 8 || w === 12;
  const peak = w === 14;
  const taper = w === 13;
  const phase = peak ? 'peak' : taper || deload ? 'taper' : w <= 4 ? 'base' : 'build';
  const longKm = LONG_KM[w - 1];
  const isRaceWeek = w === 14;
  return {
    phase,
    deload: deload || undefined,
    taper: taper || peak || undefined,
    sessions: [
      rec(w <= 4 ? 15 : 25, 'Восстановительный бег 15-35 мин.', 0),
      // Нед.14: «скоростная» сессия — уже не интервалы, а предстартовая раскатка.
      isRaceWeek
        ? { type: 'recovery', durationMin: 20, equipment: 'running', dayOfWeek: 1, purpose: 'Предстарт: 15 мин легко + 4×30 с бодро / полный отдых. Старт через 5 дней.' }
        : speed(30 + Math.min(20, w * 2), SPEED_NOTES[w - 1], SPEED_BLOCKS[w - 1], 1),
      rec(25 + Math.min(10, w), 'Восстановительный бег.', 3),
      isRaceWeek
        ? { type: 'recovery', durationMin: 15, equipment: 'running', dayOfWeek: 4, purpose: 'За 2 дня до старта: 15 мин совсем легко, ноги «прокрутить».' }
        : fartlek(26 + Math.min(14, w), 'Фартлек: чередование жёстко/легко.', 4),
      // День старта — гонка, а не «длинная Z2» и не интервалы: один отсчёт,
      // дистанция реальная (21.1 км), темп по ощущениям.
      isRaceWeek
        ? { type: 'miss', durationMin: longMin(21.1), equipment: 'running', dayOfWeek: 6, purpose: 'СТАРТ: полумарафон 21.1 км! Темп — по ощущениям первой половины; не гонитесь за планом на первых 5 км.' }
        : easy(longMin(longKm), `Длинный ${longKm} км в разговорном темпе.`, 6),
    ],
    note: peak ? 'День старта!' : deload ? 'Сброс объёма −30%.' : taper ? 'Подводка.' : undefined,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 14 }, (_, i) => buildWeek(i + 1));

export const CARDIO_RUN_HALF_14: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-half-14',
    title: 'Полумарафон — 14 недель (Nike NRC, 5 д/нед)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 14,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'От уверенных 10 км до полумарафона: интервалы в темпах 5к/мили/10к, фартлек, long 5 → 21 км.',
    howItWorks: 'Неделя = recovery + speed + recovery + fartlek + long; нед.8/12 — сброс; нед.13 — подводка; нед.14 — старт.',
    conditions: ['Бегаете 60 мин непрерывно', '5 д/нед', 'Знаете темп 5к/10к (или пульс Z3/Z4)'],
    tags: ['run', 'half-marathon', 'intermediate', 'intervals', 'fartlek', 'long'],
    deloadWeeks: [8, 12],
    taperWeeks: [13, 14],
    sourceLabel: 'Nike Run Club Half-Marathon Training Plan (14 недель)',
  },
  preset: { goal: 'health', totalWeeks: 14, daysAvailable: 5, level: 'intermediate', equipment: ['running'], periodizationModel: 'pyramidal' },
  weeks,
};
