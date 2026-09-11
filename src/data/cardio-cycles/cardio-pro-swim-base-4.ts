/**
 * cardio-pro-swim-base-4.ts — ГОТОВЫЙ ЦИКЛ: базовая плавательная
 * прогрессия 4 недели (8 сессий Utah Tech, 1000→1500 ярдов).
 * Дословно по порядку источника: техника/интервалы/дыхание/повороты,
 * 2 сессии в неделю. Минуты — производные (ярды/45), ярды и сеты
 * каноничны и лежат в purpose.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const YD_MIN = 45;
const swim = (yd: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: Math.round(yd / YD_MIN), equipment: 'swimming', dayOfWeek: dow,
  purpose: `${yd} ярдов. ${desc}`,
});

const SESSIONS: Array<[number, string]> = [
  [1000, 'Разминка 200 кроль + 4×50 (25 легко/25 спринт, :15) + 4×100 комплекс :30 + заминка 200.'],
  [1000, 'Разминка 100 + 4×50 (25 батт/25 кроль :30) + 4×50 (25 спина/25 кроль :30) + 4×50 (25 брасс/25 кроль :30) + 4×50 (25 спринт/25 легко :30) + заминка 100.'],
  [1200, 'Разминка 300 + 4×50 кроль на задержке дыхания :15 + повороты + 4×50 на выбор :15 + заминка 300.'],
  [1200, 'Разминка 200 + 200 без дыхания у борта + повороты + 4×100 кроль :15 + 4×50 на выбор :15 + заминка 200.'],
  [1200, 'Разминка 200 + кик 150 + 9×50 кроль 1:15 (легко/средне/жёстко по кругу) + 4×50 кик 1:40 + заминка 200.'],
  [1350, 'Легко 200 + pull 100 + 2×50 build 1:10 + 100 быстро (×3) + 50 легко + 2×50 спринт 1:00 + 4×25 спринт :40 + заминка 200.'],
  [1350, 'Кроль 100 + не-кроль 200 + 5×150 кроль (дыхание 3-5-7 по схеме) + 8×25 спринт :40 + заминка 200.'],
  [1500, 'Кик 8×25 :40 + 4×50 (кроль/спина 1:10) + спринт-кик 8×25 :40 + 8×25 кроль :30 + 4×50 кроль 1:00 + кик/спринт 8×25 :40 + заминка 100.'],
];

function buildWeek(w: number): CardioTemplateWeek {
  const [yd1, d1] = SESSIONS[(w - 1) * 2];
  const [yd2, d2] = SESSIONS[(w - 1) * 2 + 1];
  return {
    sessions: [swim(yd1, d1, 1), swim(yd2, d2, 4)],
    phase: 'base',
    note: w === 4 ? 'Финиш: 1500 ярдов с техникой и спринтами.' : `Прогрессия ярдов ${yd1}→${yd2}.`,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 4 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_SWIM_BASE_4: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-swim-base-4',
    title: 'Плавание база — 4 недели (1000→1500 ярдов)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'recomp'],
    weeks: 4,
    sessionsPerWeek: 2,
    level: ['beginner'],
    sport: 'mixed',
    period: 'base',
    equipment: ['swimming'],
    lowImpact: true,
    kind: 'explicit',
    description: '8 прогрессивных сессий: кроль + комплекс + кик + дыхание + спринты, 1000→1500 ярдов.',
    howItWorks: '2 сессии в неделю строго по порядку; инвентарь (доска/колобашка/ласты) — по желанию; техника важнее скорости.',
    conditions: ['Умеете держаться на воде', 'Бассейн 25 ярдов/м', '2×/нед'],
    tags: ['swim', 'beginner', 'technique', 'low-impact', 'pro'],
    sourceLabel: 'Utah Tech HPC Beginner Workouts 1-8 (ярды и сеты дословно)',
  },
  preset: { goal: 'health', totalWeeks: 4, daysAvailable: 2, level: 'beginner', equipment: ['swimming'], lowImpact: true },
  weeks,
};
