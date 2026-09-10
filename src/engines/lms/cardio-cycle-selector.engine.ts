/**
 * cardio-cycle-selector.engine.ts — ранжирование шаблонов библиотеки
 * под атлета (цель × уровень × дни × суставы × оборудование).
 * Аналог rankCycles (lms-selector) / proLevelsFor: детерминированный
 * скоринг, stable sort держит порядок каталога при равных баллах.
 */
import type { CardioCycleTemplate } from '../../data/cardio-cycles/cardio-cycle-types';
import { CARDIO_CYCLES } from '../../data/cardio-cycles/cardio-cycle-index';
import type { CardioEquipment, CardioGoal, CardioLevel } from './cardio.engine';

export interface CardioSelectorInput {
  goal?: CardioGoal;
  level?: CardioLevel;
  daysPerWeek?: number;
  /** true = нужны только lowImpact-шаблоны (суставы). */
  lowImpact?: boolean;
  equipment?: CardioEquipment[];
  sport?: 'run' | 'row' | 'bike' | 'mixed' | 'hiit' | 'all';
}

export interface RankedCardioTemplate {
  template: CardioCycleTemplate;
  score: number;
  reasons: string[];
}

/** Совместимость уровня фильтра с LMS-шкалой (для каталога). */
export function cardioLevelMatches(templateLevels: CardioLevel[], want?: CardioLevel): boolean {
  if (!want) return true;
  return templateLevels.includes(want);
}

export function scoreCardioTemplate(tpl: CardioCycleTemplate, q: CardioSelectorInput): RankedCardioTemplate {
  let score = 0;
  const reasons: string[] = [];
  const m = tpl.meta;
  if (q.goal) {
    if (m.goal === q.goal) { score += 30; reasons.push('точная цель'); }
    else if (m.goalFit?.includes(q.goal)) { score += 18; reasons.push('подходит под цель'); }
    else { score -= 12; reasons.push('другая цель'); }
  }
  if (q.level) {
    if (m.level.includes(q.level)) { score += 20; reasons.push('свой уровень'); }
    else { score -= 8; reasons.push('чужой уровень'); }
  }
  if (q.daysPerWeek != null) {
    const lo = m.sessionsPerWeek;
    const hi = m.sessionsPerWeekMax ?? m.sessionsPerWeek;
    if (q.daysPerWeek >= lo && q.daysPerWeek <= hi) { score += 15; reasons.push('дни 1-в-1'); }
    else {
      const dist = q.daysPerWeek < lo ? lo - q.daysPerWeek : q.daysPerWeek - hi;
      score -= Math.min(15, 5 * dist);
      reasons.push(`дни ±${dist}`);
    }
  }
  if (q.lowImpact) {
    if (m.lowImpact) { score += 15; reasons.push('щадит суставы'); }
    else { score -= 20; reasons.push('ударная нагрузка'); }
  }
  if (q.equipment && q.equipment.length > 0) {
    const hit = m.equipment.filter(e => q.equipment!.includes(e)).length;
    if (hit > 0) { score += 5 * Math.min(2, hit); reasons.push('оборудование есть'); }
    else { score -= 10; reasons.push('нет оборудования'); }
  }
  if (q.sport && q.sport !== 'all') {
    if (m.sport === q.sport) { score += 10; reasons.push('свой вид'); }
    else if (m.sport === 'mixed') { score += 4; reasons.push('универсальный'); }
    else { score -= 6; reasons.push('другой вид'); }
  }
  return { template: tpl, score, reasons };
}

/** Ранжировать библиотеку (по умолчанию — вся). Топ-N через slice у вызывающего. */
export function rankCardioCycles(
  q: CardioSelectorInput = {},
  pool: CardioCycleTemplate[] = CARDIO_CYCLES,
): RankedCardioTemplate[] {
  return pool
    .map((t, i) => ({ r: scoreCardioTemplate(t, q), i }))
    .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
    .map(x => x.r);
}

/** Лучший шаблон под запрос (null при пустом пуле — честно, без fallback). */
export function pickCardioTemplate(
  q: CardioSelectorInput = {},
  pool: CardioCycleTemplate[] = CARDIO_CYCLES,
): RankedCardioTemplate | null {
  const ranked = rankCardioCycles(q, pool);
  return ranked[0] ?? null;
}
