/**
 * cardio-pro-petebeg-24.ts — ГОТОВЫЙ ЦИКЛ: Pete Plan Beginner 24 недели.
 * Дословно по таблице источника: 3 ядра (дистанция / интервалы / дистанция)
 * + 2 опциональные в [скобках]. Дистанция растёт +500 м/нед до 10-12K,
 * затем скорость; пейсинг — по дневнику (прошлая похожая сессия ±1 с).
 * Опциональные кодированы как recovery-сессии с пометкой [доп].
 * Минуты — производные (гребля ~2:30/500 м новичка → м = метры/200).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const M_PER_MIN = 200;
const dist = (m: number, note: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: Math.round(m / M_PER_MIN), equipment: 'rowing', dayOfWeek: dow,
  purpose: `${m} м ровно. ${note}`,
});
const ints = (desc: string, workSec: number, restSec: number, reps: number, totalM: number, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: Math.round(totalM / M_PER_MIN), equipment: 'rowing', dayOfWeek: dow,
  purpose: `${desc}. Пейсинг по дневнику: прошлая похожая ±1 с; последний отрезок — быстрее.`,
  structured: [{ workSec, restSec, reps, target: 'pace', note: desc }],
});
const opt = (desc: string, min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'rowing', dayOfWeek: dow,
  purpose: `[Доп] ${desc} — только если есть силы/время; темп ниже ядер.`,
});

/** [день1-м, день2-интервалы, день3-м, доп4, доп5] дословно по источнику. */
const PLAN: Array<[number, string, number, string, string]> = [
  [5000, '6×500/2:00', 5000, '[20 мин]', '[2×10 мин/2:00]'],
  [5500, '4×750/2:00', 5500, '[20 мин]', '[3×8 мин/2:00]'],
  [6000, '2×2000/4:00', 6000, '[5000 м]', '[6×500/2:00]'],
  [6500, '3×1000/3:00', 6500, '[6000 м]', '[2×2500/2:00]'],
  [7000, '4×800/2:00', 7000, '[20 мин]', '[2×10 мин/2:00]'],
  [7500, '3×2000/4:00', 7500, '[5000 м]', '[6×500/2:00]'],
  [8000, '7×500/2:00', 8000, '[6000 м]', '[3×1500/3:00]'],
  [8500, '4×1500/3:00', 8000, '[25 мин]', '[3×1000/3:00]'],
  [9000, '4×800/2:00', 8000, '[8000 м]', '[2×10 мин/2:00]'],
  [9500, '3×2000/4:00', 8000, '[8000 м]', '[7×500/2:00]'],
  [10000, '8×500/2:00', 8000, '[25 мин]', '[4×1500/3:00]'],
  [10000, '4×1500/3:00', 0, '[8000 м]', '[4×800/2:00]'],
  [10000, '4×1000/3:00', 0, '[8000 м]', '[3×2000/4:00]'],
  [10000, '3×2000/4:00', 0, '[30 мин]', '[7×500/2:00]'],
  [10000, '5×750/2:00', 0, '[8000 м]', '[4×1500/3:00]'],
  [10500, '5×1500/3:00', 0, '[10000 м]', '[4×1000/3:00]'],
  [10500, '8×500/2:00', 0, '[30 мин]', '[4×8 мин/2:00]'],
  [11000, '4×2000/4:00', 0, '[10000 м]', '[4×1000/3:00]'],
  [10000, '5×800/2:00', 0, '[30 мин]', '[4×2000/4:00]'],
  [12000, '5×1500/3:00', 0, '[10000 м]', '[8×500/2:00]'],
  [10000, '4×1000/3:00', 0, '[12000 м]', '[5×1500/3:00]'],
  [12000, '4×2000/4:00', 0, '[3×10 мин/2:00]', '[5×800/2:00]'],
  [10000, '8×500/2:00', 0, '[10000 м]', '[4×2000/4:00]'],
  [12000, '5×1500/3:00', 0, '[2×15 мин/2:00]', '[4×1000/3:00]'],
];

function parseInts(desc: string): { workSec: number; restSec: number; reps: number; totalM: number } {
  const m = desc.match(/(\d+)\s*×\s*(\d+)\s*\/\s*(\d+):?(\d*)/);
  if (!m) return { workSec: 120, restSec: 120, reps: 4, totalM: 3000 };
  const reps = Number(m[1]);
  const len = Number(m[2]);
  const rest = m[4] ? Number(m[3]) * 60 + Number(m[4]) : Number(m[3]) * 60;
  const work = len >= 1000 ? 240 : len >= 750 ? 180 : len >= 500 ? 110 : 60;
  return { workSec: work, restSec: rest, reps, totalM: reps * len };
}

function parseOpt(desc: string): { min: number; label: string } {
  const mm = desc.match(/\[(\d+)\s*(мин|min)/);
  if (mm) return { min: Number(mm[1]), label: desc };
  const tm = desc.match(/\[(\d+)\s*×\s*(\d+)\s*(мин|min)/);
  if (tm) return { min: Number(tm[1]) * Number(tm[2]), label: desc };
  const dm = desc.match(/\[(\d+)\s*м\]/);
  if (dm) return { min: Math.round(Number(dm[1]) / M_PER_MIN), label: desc };
  return { min: 25, label: desc };
}

function buildWeek(w: number): CardioTemplateWeek {
  const [d1, d2, d3, o4, o5] = PLAN[w - 1];
  const core = w <= 11 ? 'дистанция' : w <= 15 ? 'дистанция 10K, темп прогрессирует' : 'over-distance + скорость';
  const sessions: CardioTemplateSession[] = [
    dist(d1, w === 1 ? 'Техника + расслабление + эффективность. Темп ровный.' : 'Темп прошлой такой сессии.', 0),
    (() => { const p = parseInts(d2); return ints(d2, p.workSec, p.restSec, p.reps, p.totalM, 2); })(),
  ];
  if (d3 > 0) {
    sessions.push(dist(d3, w === 1 ? 'Темп первой дистанции недели, не быстрее.' : 'Negative split: первую половину ровно, вторую быстрее.', 4));
  } else {
    const p4 = parseOpt(o4);
    sessions.push({ type: 'miss', durationMin: p4.min, equipment: 'rowing', dayOfWeek: 4, purpose: `${p4.label} — длинные отрезки с коротким отдыхом (≤1/4 работы).` });
  }
  const p4 = parseOpt(o4);
  const p5 = parseOpt(o5);
  if (d3 > 0) sessions.push(opt(`${o4} легко, гребок ≤24`, p4.min, 5));
  sessions.push(opt(`${o5} — ориентир по дневнику`, p5.min, 6));
  return {
    sessions, phase: w <= 11 ? 'base' : 'build',
    note: w === 1 ? `Ядра: ${core}. Опции — по желанию.` : w === 11 ? 'Рубеж 10K!' : w === 24 ? 'Финал: 12K + 5×1500.' : undefined,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 24 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_PETE_BEGINNER_24: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-petebeg-24',
    title: 'Pete Beginner — 24 недели (гребля с нуля)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 24,
    sessionsPerWeek: 3,
    sessionsPerWeekMax: 5,
    level: ['beginner', 'intermediate'],
    sport: 'row',
    period: 'base',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'От 5K до 12K за полгода: 3 ядра + 2 опции, дистанция +500 м/нед, пейсинг по дневнику.',
    howItWorks: 'День1 дистанция, День2 интервалы, День3 дистанция/темп; опции в скобках — по желанию; темп ≤24 spm на steady.',
    conditions: ['Гребной тренажёр', '3 д/нед (+2 опции)', 'Дневник сплитов'],
    tags: ['row', 'erg', 'pete', 'beginner', 'low-impact', 'pro'],
    sourceLabel: 'The Pete Plan Beginner Training 24 weeks (таблица недель дословно)',
  },
  preset: { goal: 'health', totalWeeks: 24, daysAvailable: 5, level: 'beginner', equipment: ['rowing'], lowImpact: true },
  weeks,
};
