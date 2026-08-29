/**
 * strength-sport-split-patterns.ts — сплиты для ТА/стронга (как bb-split-patterns).
 * Ротация 7 дней, характер тяж/памп/лёг, sessionTag — доменные.
 */
import type { StrengthSportMode } from './strength-sport.types';

export type SlotKind = 'тренировка' | 'отдых';
export interface ScheduleDay {
  kind: SlotKind;
  character: 'тяж' | 'памп' | 'лёг' | null;
  sessionTag?: string;
}

export interface StrengthSportPattern {
  id: string;
  name: string;
  mode: StrengthSportMode | 'any';
  rotationDays: number;
  sessionsPerRotation: number;
  schedule: ScheduleDay[];
  level: string[];
  description: string;
}

export const STRENGTH_SPORT_PATTERNS: StrengthSportPattern[] = [
  // ——— WEIGHTLIFTING ———
  {
    id: 'wl_3',
    name: 'ТА 3×/нед — база',
    mode: 'weightlifting',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Рывок → Толчок → Присед+Тяги. Классика 3×/нед для совместимости с внезальной нагрузкой.',
  },
  {
    id: 'wl_4',
    name: 'ТА 4×/нед — расширенный',
    mode: 'weightlifting',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'technique_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Рывок / Толчок / Присед-тяж / Техника-памп (50-70%).',
  },
  {
    id: 'wl_5',
    name: 'ТА 5×/нед — частота',
    mode: 'weightlifting',
    rotationDays: 7, sessionsPerRotation: 5,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'technique_day' },
      { kind: 'тренировка', character: 'лёг', sessionTag: 'pull_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['advanced', 'enhanced'],
    description: 'Высокая частота: 2 тяж классики + сила + техника + тяги.',
  },
  {
    id: 'wl_6',
    name: 'ТА 6×/нед — сборная',
    mode: 'weightlifting',
    rotationDays: 7, sessionsPerRotation: 6,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'technique_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'pull_day' },
      { kind: 'тренировка', character: 'лёг', sessionTag: 'accessory_day' },
      { kind: 'отдых', character: null },
    ],
    level: ['enhanced'],
    description: '6×/нед только для высокой восстанавливаемости. Не ставить при outside high.',
  },
  // ——— STRONGMAN ———
  {
    id: 'sm_3',
    name: 'Стронг 3×/нед — база',
    mode: 'strongman',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'overhead_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'deadlift_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'event_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Жим стоя/лог → Тяга/присед → Ивенты (фермер/йок/камни).',
  },
  {
    id: 'sm_4',
    name: 'Стронг 4×/нед — объём',
    mode: 'strongman',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'overhead_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'deadlift_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'squat_day' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'event_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Лог → Тяга → Присед → Ивенты-памп.',
  },
  {
    id: 'sm_2',
    name: 'Стронг 2×/нед — минимум',
    mode: 'strongman',
    rotationDays: 7, sessionsPerRotation: 2,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'overhead_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'deadlift_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    description: 'Минимум для совместимости с field-работой. Ивенты — по возможности в deadlift_day.',
  },
  // ——— HYBRID ———
  {
    id: 'hyb_3',
    name: 'Гибрид 3×/нед',
    mode: 'hybrid',
    rotationDays: 7, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'oly_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'event_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Олимпийка → Сила → Стронг-ивенты. Без спец-снарядов — замены.',
  },
  {
    id: 'hyb_4',
    name: 'Гибрид 4×/нед',
    mode: 'hybrid',
    rotationDays: 7, sessionsPerRotation: 4,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'squat_day' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'event_day' },
      { kind: 'отдых', character: null },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Рывок / Толчок / Присед / Ивенты.',
  },
  // ——— ROLLING (как BB 3/1) ———
  {
    id: 'wl_rolling_3_1',
    name: 'ТА Rolling 3/1',
    mode: 'weightlifting',
    rotationDays: 4, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'snatch_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'clean_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'strength_day' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Rolling 3/1: 3 тяж → 1 отдых → циклом, без привязки к неделе.',
  },
  {
    id: 'sm_rolling_3_1',
    name: 'Стронг Rolling 3/1',
    mode: 'strongman',
    rotationDays: 4, sessionsPerRotation: 3,
    schedule: [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'overhead_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'deadlift_day' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'event_day' },
      { kind: 'отдых', character: null },
    ],
    level: ['intermediate', 'advanced', 'enhanced'],
    description: 'Rolling 3/1 для стронга — ивенты каждые 4 дня.',
  },
];

export function getStrengthSportPattern(id: string): StrengthSportPattern | undefined {
  return STRENGTH_SPORT_PATTERNS.find(p => p.id === id);
}

export function patternsForMode(mode: StrengthSportMode): StrengthSportPattern[] {
  return STRENGTH_SPORT_PATTERNS.filter(p => p.mode === mode || p.mode === 'any');
}

export function recommendStrengthSportPattern(mode: StrengthSportMode, daysPerWeek: number, level: string, goal?: string, equipment?: string[]): StrengthSportPattern {
  const pool = patternsForMode(mode);
  // PRO: goal учитывается (technique нужен 4×, peaking 3×), equipment без specialty не рекомендует SM 3×
  let scored = pool.map(p => {
    let score = 0;
    if (p.sessionsPerRotation === daysPerWeek) score += 10;
    else score -= Math.abs(p.sessionsPerRotation - daysPerWeek) * 2;
    if (p.level.includes(level)) score += 5;
    if (goal === 'technique' && p.sessionsPerRotation >= 4) score += 3;
    if (goal === 'peaking' && p.sessionsPerRotation <= 4) score += 2;
    const hasSpecialty = equipment?.includes('other') || equipment?.includes('specialty') || (equipment && equipment.length === 0);
    if (!hasSpecialty && p.mode === 'strongman' && p.sessionsPerRotation >= 3) score -= 3;
    if (hasSpecialty && p.mode === 'strongman') score += 1;
    return { p, score };
  });
  scored.sort((a,b)=> b.score - a.score);
  if (scored.length) return scored[0].p;
  let best = pool[0];
  let bestDiff = Math.abs(pool[0].sessionsPerRotation - daysPerWeek);
  for (const p of pool) {
    const d = Math.abs(p.sessionsPerRotation - daysPerWeek);
    if (d < bestDiff) { best = p; bestDiff = d; }
  }
  return best;
}

export function validateStrengthSportPatterns(): string[] {
  const errs: string[] = [];
  for (const p of STRENGTH_SPORT_PATTERNS) {
    if (p.schedule.length !== p.rotationDays) errs.push(`${p.id}: schedule.length ${p.schedule.length} !== rotationDays ${p.rotationDays}`);
    const training = p.schedule.filter(d => d.kind === 'тренировка').length;
    if (training !== p.sessionsPerRotation) errs.push(`${p.id}: training ${training} !== sessionsPerRotation ${p.sessionsPerRotation}`);
  }
  return errs;
}
