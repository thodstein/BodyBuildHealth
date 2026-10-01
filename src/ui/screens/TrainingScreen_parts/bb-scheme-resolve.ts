import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';

/**
 * Резолвер схемы объёма/методики для ББ-авто.
 *
 * Профессиональная библиотека (docs/BB-AUTO-PROFESSIONAL-CYCLES-PLAN.md):
 * именные циклы (GVT/Gironda/FST-7/Mountain Dog) несут свою схему/методику в meta,
 * и планировщик применяет её как дефолт. Чистая функция — тестируется без UI.
 *
 * Приоритет: явный выбор пользователя → дефолт meta цикла → standard/compound_first.
 * В generic-режиме cycleMeta НЕ передаётся → поведение прежнее (схема пользователя).
 */

export type BBVolumeScheme = 'standard' | 'gvt' | 'fst7' | 'gironda';

export interface NamedCycleDefaults {
  volumeScheme?: BBVolumeScheme;
  methodology?: SessionMethodology;
}

/**
 * @param userScheme выбор пользователя в UI
 * @param trainingVolumeMode 'standard' | 'high' (high форсит GVT, как было)
 * @param cycleMeta meta выбранного цикла (только в ПРОФ-цикл-ветке; в generic — undefined)
 */
export function resolveEffectiveVolumeScheme(
  userScheme: BBVolumeScheme,
  trainingVolumeMode: string,
  cycleMeta?: NamedCycleDefaults | null,
): BBVolumeScheme {
  // Объёмный режим: high + standard → GVT (прежнее поведение, приоритет выше meta).
  if (trainingVolumeMode === 'high' && userScheme === 'standard') return 'gvt';
  // Явный выбор пользователя приоритетнее дефолта цикла.
  if (userScheme !== 'standard') return userScheme;
  // Дефолт именного цикла (только ПРОФ-цикл-ветка).
  return cycleMeta?.volumeScheme ?? 'standard';
}

export function resolveEffectiveMethodology(
  userMethodology: SessionMethodology,
  cycleMeta?: NamedCycleDefaults | null,
): SessionMethodology {
  if (userMethodology !== 'compound_first') return userMethodology;
  return cycleMeta?.methodology ?? userMethodology;
}
