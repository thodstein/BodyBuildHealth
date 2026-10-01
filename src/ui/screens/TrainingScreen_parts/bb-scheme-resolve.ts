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

const SCHEME_RU: Record<string, string> = {
  gvt: 'GVT (10×10)',
  gironda: 'Gironda 8×8',
  fst7: 'FST-7 (7-сетовые финишеры)',
};

/**
 * Заметка в rationale плана: какая схема/методика именной системы реально применена
 * (только если она взята из meta цикла, а не выбрана пользователем). null — если нечего.
 */
export function namedSystemNote(
  cycleMeta: NamedCycleDefaults | null | undefined,
  effectiveScheme: BBVolumeScheme,
  effectiveMethodology: SessionMethodology,
  userScheme: BBVolumeScheme,
  userMethodology: SessionMethodology,
): string | null {
  const parts: string[] = [];
  if (cycleMeta?.volumeScheme && cycleMeta.volumeScheme === effectiveScheme && userScheme === 'standard') {
    parts.push(`схема «${SCHEME_RU[effectiveScheme] ?? effectiveScheme}»`);
  }
  if (cycleMeta?.methodology && cycleMeta.methodology === effectiveMethodology && userMethodology === 'compound_first') {
    parts.push(`методика «${String(effectiveMethodology).replace(/_/g, ' ')}»`);
  }
  return parts.length ? `🎛 Именная система: применены ${parts.join(' + ')} (дефолт цикла).` : null;
}
