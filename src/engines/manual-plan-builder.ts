/**
 * manual-plan-builder.ts — единый источник injury-хелперов для BB-генераторов.
 *
 * Ранее содержал полный auto-генератор buildPlanDays (~500 строк) для плоского
 * PlanEx/PlanDay (старый ручной конструктор). Сейчас он удалён, т.к.
 * дублировал логику bb-builder.engine. Плоский тип PlanEx/PlanDay остался
 * только в `program-types.ts` как ProjectType.
 *
 * KEEP: Injury type + 4 helper'а (getInjuryVolumeFactor, getActiveInjuries,
 * getExcludedMuscles, getGradedInjuries). Используются bb-builder и
 * cycle-to-plan.
 */
export interface Injury {
  muscle: string;
  from: string;
  to?: string;
  weightPct?: number;
  volumePct?: number;
  repsCap?: number;
  exclude?: boolean;
}

/** Коэффициент объёма травмы с постинсультной реабилитацией:
 *  если `to` прошла → 50% → 75% → 100% за 3 недели после, иначе volumePct или 0.6. */
export function getInjuryVolumeFactor(inj: Injury, today: string): number {
  if (inj.to && inj.to < today) {
    const weeksPast = Math.max(0, Math.floor((new Date(today).getTime() - new Date(inj.to).getTime()) / (7 * 86400000)));
    if (weeksPast >= 3) return 1.0;
    if (weeksPast >= 1) return 0.75;
    return 0.5;
  }
  return inj.volumePct ?? (inj.exclude ? 0 : 0.6);
}

/** Список активных травм на сегодня (from ≤ today < to или to не указано). */
export function getActiveInjuries(injuries: Injury[], today: string): Injury[] {
  return injuries.filter(inj =>
    (!inj.from || inj.from <= today) &&
    (!inj.to || inj.to > today)
  );
}

/** Мышцы для полного исключения (exclude=true). */
export function getExcludedMuscles(injuries: Injury[], today: string): Set<string> {
  return new Set(
    injuries
      .filter(inj => (!inj.from || inj.from <= today) && (!inj.to || inj.to >= today))
      .filter(inj => inj.exclude !== false)
      .map(inj => inj.muscle)
  );
}

/** Травмированные мышцы для градуированной нагрузки (exclude=false + gradation). */
export function getGradedInjuries(injuries: Injury[], today: string): Injury[] {
  return injuries
    .filter(inj => (!inj.from || inj.from <= today) && (!inj.to || inj.to >= today))
    .filter(inj => inj.exclude === false);
}
