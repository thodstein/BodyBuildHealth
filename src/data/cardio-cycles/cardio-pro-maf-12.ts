/**
 * cardio-pro-maf-12.ts — ГОТОВЫЙ ЦИКЛ: MAF-аэробная база 12 недель
 * (Dr. Phil Maffetone). Дословно по методу источника:
 * формула 180 − возраст ± поправка (−10 болезнь/медикаменты/хроника;
 * −5 сбой/травма/регресс/новичок; +0 стабильные ≤2 лет; +5 >2 лет
 * с прогрессом; >65 и ≤16 — индивидуально/165); все тренировки
 * ≤ MAF-пульса (коридор MAF−10…MAF); MAF-тест ежемесячно:
 * разминка 12-15 мин + 3-5 миль на MAF-пульсе с записью сплитов;
 * критерии прогресса — темп растёт, разрыв 1-й/последней мили сужается.
 * Скорость запрещена весь цикл (минимум 3 мес базы).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const maf = (min: number, note: string, dow?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running',
  purpose: `Строго ≤ MAF-пульса (180 − возраст ± поправка). ${note}`, dayOfWeek: dow,
});
const mafTest = (dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: 60, equipment: 'running',
  purpose: 'MAF-ТЕСТ: разминка 12-15 мин + 3 мили на MAF-пульсе, записать сплиты каждой мили + заминка. Та же трасса/время/кроссовки.',
  dayOfWeek: dow,
  structured: [{ workSec: 480, restSec: 0, reps: 3, target: 'hr', note: 'Миля на MAF-пульсе ×3, сплиты записать' }],
});

const VOL = [150, 165, 180, 165, 195, 210, 225, 200, 240, 255, 270, 200];

function buildWeek(w: number): CardioTemplateWeek {
  const v = VOL[w - 1];
  const test = w === 1 || w === 4 || w === 8 || w === 12;
  const long = Math.round(v * 0.35);
  const mid = Math.round(v * 0.25);
  const easy = Math.max(30, Math.round((v - long - mid - (test ? 60 : 0)) / 2));
  const sessions: CardioTemplateSession[] = [
    maf(easy, 'Лёгкая.', 0),
    maf(mid, 'Средняя.', 2),
    maf(easy, 'Лёгкая/восстановительная.', 4),
    maf(long, 'Длинная в том же коридоре.', 6),
  ];
  if (test) sessions.push(mafTest(3));
  const deload = w === 4 || w === 8 || w === 12;
  return {
    sessions, phase: 'base', deload: deload || undefined,
    note: test ? `MAF-тест месяца (${w}-я нед): сравнить сплиты.` : `Объём ~${v} мин, всё ≤ MAF.`,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_MAF_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-maf-12',
    title: 'MAF-база — 12 недель (180 − возраст, без скорости)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut', 'recomp'],
    weeks: 12,
    sessionsPerWeek: 4,
    sessionsPerWeekMax: 5,
    level: ['beginner', 'intermediate'],
    sport: 'run',
    period: 'base',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Жиросжигающая база Маффетоуна: всё ≤ MAF-пульса 3+ мес, ежемесячный MAF-тест.',
    howItWorks: 'Считаете MAF (180 − возраст ± поправка), бегаете в коридоре MAF−10…MAF; тесты на 1/4/8/12-й; нет прогресса 1-2 мес — снижайте MAF и проверяйте стресс/питание.',
    conditions: ['Пульсометр', 'Терпение: сначала темп упадёт до шаркания', '4-5×/нед'],
    tags: ['run', 'base', 'maf', 'maffetone', 'fat-burn', 'pro'],
    deloadWeeks: [4, 8, 12],
    sourceLabel: 'Dr. Phil Maffetone MAF 180 Formula + MAF Test (philmaffetone.com)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 5, level: 'beginner', equipment: ['running'], periodizationModel: 'linear' },
  weeks,
};
