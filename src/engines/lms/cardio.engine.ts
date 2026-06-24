/**
 * cardio.engine.ts — кардио для рельефа/восстановления/ЖСС (Этап T7, NEW).
 * Zone 2 (липолиз, восстановление) и HIIT (короткий высокий стимул).
 * Интеграция с PAL/nutrition.engine — READ-only (сожжённые ккал).
 */

export type CardioType = 'zone2' | 'hiit' | 'miss' | 'recovery';

export interface CardioSession {
  type: CardioType;
  durationMin: number;
  weeklyFrequency: number;
  intensity: 'low' | 'moderate' | 'high';
  kcalPerSession: number;   // оценочно
  purpose: string;
}

export interface CardioPlan {
  sessions: CardioSession[];
  totalKcalPerWeek: number;
  rationale: string[];
}

/** Оценка расхода ккал/мин по типу (для ~80кг атлета, поправка через вес). */
const KCAL_PER_MIN: Record<CardioType, number> = { zone2: 7, miss: 10, hiit: 14, recovery: 5 };

export function kcalForCardio(type: CardioType, durationMin: number, bodyWeight: number = 80): number {
  const base = KCAL_PER_MIN[type] * durationMin;
  return Math.round(base * (bodyWeight / 80));
}

export interface CardioInput {
  goal: 'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery';
  bodyWeight?: number;
  daysAvailable?: number;     // сколько дней можно дать кардио (поверх трени)
  recoveryLow?: boolean;
}

export function buildCardioPlan(input: CardioInput): CardioPlan {
  const bw = input.bodyWeight || 80;
  const sessions: CardioSession[] = [];
  const rationale: string[] = [];
  const add = (type: CardioType, dur: number, freq: number, purpose: string) => {
    sessions.push({ type, durationMin: dur, weeklyFrequency: freq, intensity: type === 'hiit' ? 'high' : type === 'zone2' ? 'moderate' : type === 'recovery' ? 'low' : 'moderate', kcalPerSession: kcalForCardio(type, dur, bw), purpose });
  };
  if (input.goal === 'cut') {
    add('zone2', 45, 3, 'Липолиз, сохранение мышц, восстановление между трени');
    add('hiit', 15, 1, 'Метаболический стимул, EPOC, ЖСС без большого объёма');
    rationale.push('Сушка: zone2 3×45мин (липолиз без нагрузки на восстановление) + 1 HIIT 15мин (EPOC).');
  } else if (input.goal === 'recomp' || input.goal === 'maintenance') {
    add('zone2', 30, 2, 'Здоровье ССС, восстановление');
    rationale.push('Поддержание/рекомпозиция: умеренное zone2 для ССС и восстановления.');
  } else if (input.goal === 'mass') {
    add('recovery', 20, 1, 'Активное восстановление, не мешает массонабору');
    rationale.push('Массонабор: минимум кардио — только восстановление, чтобы не конкурировать с ростом.');
  } else {
    add('recovery', 30, 3, 'Активное восстановление, мобильность');
    rationale.push('Восстановление: лёгкое кардио для кровотока и мобильности.');
  }
  if (input.recoveryLow) { sessions.forEach(s => { if (s.type === 'hiit') s.weeklyFrequency = 0; }); rationale.push('Низкое восстановление → HIIT убран.'); }
  const total = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { sessions, totalKcalPerWeek: total, rationale };
}