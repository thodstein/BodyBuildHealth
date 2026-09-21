/**
 * bb-quality-v2.engine.ts — V2-оценка для ББ-авто (Quality Hub PRO, продолжение).
 *
 * S5 (`buildBBQualityReport`: validation/balance/rotation/fatigue/safety) — НЕ тронут,
 * считается и показывается как раньше. Этот модуль — АДДИТИВНАЯ V2-панель:
 * берёт деривацию `bbPlanToQualityInput` (sessionMax/имена/RIR/глубина делода/плечо/длина),
 * прогоняет S1 ради шкалированных MEV/MAV/MRV (mrvByMuscle плана) и собирает канон V2.
 * Без дневника нагрузка не штрафуется; без данных — null (карточка не рендерится).
 */
import { bbPlanToQualityInput, validatePlanQuality } from '../plan-quality.engine';
import {
  composeQualityScoreV2,
  type QualityScoreV2,
  type QualityV2Issue,
  type V2ComposerInput,
} from '../quality-score-v2.engine';

export interface BBQualityV2Opts {
  level: string;
  specTargets?: string[];
  maintenanceMuscles?: string[];
  acwrRatio?: number | null;
  /** Монотония Foster (sRPEAdjustment). null — нет данных. */
  monotony?: number | null;
  hasDiary?: boolean;
}

/** V2-оценка ББ-плана. null — нет данных (пустой план / нет мышц). Не бросает исключений. */
export function bbPlanQualityV2(
  plan: {
    weeks: { sessions: { exercises: { muscle: string; sets: number; name: string }[] }[]; phase?: string; deload?: boolean }[];
    mrvByMuscle?: Record<string, number>;
    pattern?: { id?: string; name?: string };
    inputSnapshot?: any;
  },
  opts: BBQualityV2Opts,
): QualityScoreV2 | null {
  try {
    const qInput = bbPlanToQualityInput(plan as any, {
      level: opts.level,
      specTargets: opts.specTargets,
      maintenanceMuscles: opts.maintenanceMuscles,
    });
    const s1 = validatePlanQuality(qInput);
    if (!s1.muscles.length) return null;
    const weeklySets: Record<string, number> = {};
    const frequency: Record<string, number> = {};
    const mev: Record<string, number> = {};
    const mav: Record<string, number> = {};
    const mrv: Record<string, number> = {};
    for (const m of s1.muscles) {
      weeklySets[m.muscle] = m.weeklySets;
      frequency[m.muscle] = m.frequency;
      mev[m.muscle] = m.mev;
      mav[m.muscle] = m.mav;
      mrv[m.muscle] = m.mrv;
    }
    const v2input: V2ComposerInput = {
      level: opts.level,
      weeklySets,
      frequency,
      mev,
      mav,
      mrv,
      sessionMaxByMuscle: qInput.sessionMaxByMuscle,
      namesByMuscle: qInput.namesByMuscle,
      rir: qInput.rirStats,
      deload: qInput.hasDeload || (qInput.totalWeeks || 0) >= 6 || qInput.deloadDepth != null
        ? {
          hasDeload: !!qInput.hasDeload,
          totalWeeks: qInput.totalWeeks || 0,
          deloadWeeks: qInput.deloadWeeks || [],
          depthVolume: qInput.deloadDepth?.depthVolume,
          rirShift: qInput.deloadDepth?.rirShift,
          loadDrop: qInput.deloadDepth?.loadDrop,
          phaseTag: qInput.deloadDepth?.phaseTag ?? 'deload',
        }
        : null,
      shoulder: qInput.shoulder,
      lengthShare: qInput.lengthShare,
      load: opts.hasDiary || opts.acwrRatio != null || opts.monotony != null
        ? { acwr: opts.acwrRatio ?? null, monotony: opts.monotony ?? null, hasDiary: !!opts.hasDiary }
        : null,
      specTargets: opts.specTargets,
      // Аудит 2026-09: при активной специализации все НЕ-целевые мышцы плана —
      // сознательное поддержание (MV-режим). Без этого V2 штрафовал за
      // «недогруз» групп, объём которых уменьшен намеренно (жалоба: заметки не
      // под настройки пользователя).
      maintenanceMuscles: opts.maintenanceMuscles ?? (opts.specTargets && opts.specTargets.length > 0
        ? s1.muscles.map(m => m.muscle).filter(m => m !== 'shouldersΣ' && !opts.specTargets!.includes(m))
        : undefined),
      exerciseNames: qInput.exerciseNames,
    };
    return composeQualityScoreV2(v2input);
  } catch {
    return null;
  }
}

/** RU-подписи мышц для сообщений V2 (движок отдаёт EN-ключи). */
const V2_MUSCLE_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', quads: 'Квадрицепсы', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы',
  shoulders: 'Плечи', 'shouldersΣ': 'Плечи Σ', delt_front: 'Передняя дельта', delt_mid: 'Средняя дельта',
  delt_rear: 'Задняя дельта', biceps: 'Бицепс', triceps: 'Трицепс', calves: 'Икры', abs: 'Пресс',
  traps: 'Трапеции', forearms: 'Предплечья', legs: 'Ноги', lower_back: 'Поясница',
};

/** Заменяет EN-ключи мышц в сообщении V2 на русские подписи (для UI-карточки). */
export function localizeV2Issue(message: string): string {
  return String(message || '').replace(
    /\b(chest|back|quads|hamstrings|glutes|shouldersΣ|shoulders|delt_front|delt_mid|delt_rear|biceps|triceps|calves|abs|traps|forearms|legs|lower_back)\b/g,
    m => V2_MUSCLE_RU[m] || m,
  );
}

/** Префиксы, уже покрытые S1/S5 (объём/наличие делода/ноль-частота) — не дублируем в V2-панели. */
const COVERED_PREFIXES = [
  'vol_over_', 'vol_high_', 'vol_low_',
  'freq_zero_', 'freq_once_ok_', 'no_deload', 'deload_rare',
];

/**
 * Только НОВЫЙ сигнал V2 для ББ-панели: session-кап, split-частота, RIR,
 * делод-призрак, плечо-v2, длина, нагрузка, MV-поддержание.
 */
export function v2OnlyIssues(v2: QualityScoreV2 | null): QualityV2Issue[] {
  if (!v2) return [];
  return v2.issues.filter(i => !COVERED_PREFIXES.some(p => i.id.startsWith(p)));
}

/** Мышцы с перегрузом → целевой MAV (для моста volume-fix, если хаб захочет). */
export function v2OverloadFix(v2: QualityScoreV2 | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v2) return out;
  for (const m of v2.perMuscle) {
    if (m.status === 'exceeding_mrv') out[m.muscle] = m.mav;
  }
  return out;
}
