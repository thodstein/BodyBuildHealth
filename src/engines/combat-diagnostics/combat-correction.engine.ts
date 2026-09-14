/**
 * combat-correction.engine.ts — P7 причины/ранжир/симуляция/спец-блок/аудит.
 * Контракты 1-в-1 с TA/SM-цепочкой, но компактно в одном файле:
 * weak-cause → correction-rank (топ-3) → simulator (Δ) → spec-block → plan-audit.
 * Чистые функции.
 */
import type { CombatStrikePoint } from './combat-strike-biomech.engine';
import type { CombatTakedownPoint } from './combat-takedown.engine';

export type CombatWeakCause = 'technique' | 'strength' | 'mobility' | 'fatigue' | 'asymmetry';

export interface CombatCause {
  point: string;
  cause: CombatWeakCause;
  causeRu: string;
  text: string;
}

export function combatWeakCause(
  point: string, opts: { lowSpeed: boolean; lowMass: boolean; asymFix: boolean; acwrBad: boolean; mobilityMissing: boolean },
): CombatCause {
  if (opts.asymFix) return { point, cause: 'asymmetry', causeRu: 'Асимметрия', text: `${point}: ведёт асимметрия ≥12% — добивка слабой стороны` };
  if (opts.lowMass) return { point, cause: 'technique', causeRu: 'Техника', text: `${point}: масса не включается — цепь снизу и жёсткий контакт` };
  if (opts.lowSpeed) return { point, cause: 'strength', causeRu: 'Скорость/мощь', text: `${point}: не хватает скорости — плио и расслабление до контакта` };
  if (opts.acwrBad) return { point, cause: 'fatigue', causeRu: 'Усталость', text: `${point}: на фоне перегруза — сначала делод, потом техника` };
  if (opts.mobilityMissing) return { point, cause: 'mobility', causeRu: 'Мобильность', text: `${point}: проверьте мобильность (плечо/ТЗС) — скриннинг в recovery` };
  return { point, cause: 'technique', causeRu: 'Техника', text: `${point}: точечная работа по фазам` };
}

export interface CombatCorrection {
  point: string;
  title: string;
  dose: string;
  priority: number;
}

/** Топ-3 коррекции: асимметрия > техника > скорость. Детерминированный порядок. */
export function rankCombatCorrections(
  causes: CombatCause[],
): CombatCorrection[] {
  const weight: Record<CombatWeakCause, number> = { asymmetry: 0, technique: 1, strength: 2, mobility: 3, fatigue: 4 };
  const dose: Record<CombatWeakCause, string> = {
    asymmetry: 'Унилатеральная добивка слабой +15–25% в пределах MRV',
    technique: 'Дриллы по фазам 3×3 мин + лапы 2×/нед',
    strength: 'Медбол/кувалда 2×/нед + спринты 10 м',
    mobility: 'Мобильность плеча/ТЗС 10 мин ежедневно + retest',
    fatigue: 'Делод неделю, техника — после',
  };
  return [...causes]
    .sort((a, b) => weight[a.cause] - weight[b.cause])
    .slice(0, 3)
    .map((c, i) => ({ point: c.point, title: c.text, dose: dose[c.cause], priority: i + 1 }));
}

/** Δ-симуляция: честный ориентир (не предсказание) — сколько снимет топ-коррекция. */
export function simulateCombatCorrection(score: number, corrections: CombatCorrection[]): { delta: number; text: string } {
  const delta = Math.min(20, corrections.length * 5);
  return { delta, text: `Ориентир: топ-${corrections.length} могут дать +${delta} к скору (не гарантия)` };
}

export interface CombatSpecBlock {
  weeks: number;
  focus: string[];
  dayMap: Record<string, number[]>;
  rationale: string;
}

/** Спец-блок 4–8 нед: фокус-точки + дни вставки (1 и 3 — тяжёлые, без пятницы-пика). */
export function buildCombatSpecBlock(
  focus: string[], weeks = 6,
): CombatSpecBlock {
  const w = Math.min(8, Math.max(4, weeks));
  const dayMap: Record<string, number[]> = {};
  for (const f of focus) dayMap[f] = [1, 3];
  return { weeks: w, focus, dayMap, rationale: `Спец-блок ${w} нед: ${focus.join(', ')} — дни 1 и 3, объём в пределах MRV` };
}

export interface CombatPlanAudit {
  covered: string[];
  uncovered: string[];
  text: string;
}

/** Аудит покрытия точек: какие точки уже в замерах, какие пустые. */
export function auditCombatCoverage(
  measured: string[], all: string[],
): CombatPlanAudit {
  const set = new Set(measured);
  const covered = all.filter(a => set.has(a));
  const uncovered = all.filter(a => !set.has(a));
  return {
    covered, uncovered,
    text: uncovered.length ? `Не замерены: ${uncovered.join(', ')}` : 'Все точки замерены',
  };
}

export type { CombatStrikePoint, CombatTakedownPoint };
