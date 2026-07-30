/**
 * phase-bridge.ts — мост между тремя системами фаз периодизации.
 *
 * Три источника фаз в коде:
 *  1. `Phase` (user-program.types.ts) — 4 значения: accumulation/intensification/deload/peaking.
 *     Каноническая фаза UserWeek — минимальный набор для ручного конструктора.
 *  2. `PhaseKey` (periodization-designer.engine.ts) — 10 значений для дизайнера макроцикла:
 *     добавлены technique/conditioning/power/gpp/transition и разделён accumulation на hypertrophy/strength.
 *  3. `MacroPhase` (lms/macrocycle.engine.ts) — 5 значений годового макроцикла ПЛ-авто:
 *     endurance/strength/peak/competition/transition.
 *
 * Этот модуль — единственное место преобразования. Существующие типы НЕ меняем,
 * `UserWeek.phase` остаётся каноническим (4 значения).
 */
import type { Phase } from '../user-program/user-program.types';
import type { PhaseKey } from '../periodization-designer.engine';
import type { MacroPhase } from '../lms/macrocycle.engine';

/** Маппинг PhaseKey дизайнера (10) → Phase (4). 6 ключей коллапсируют. */
export const DESIGNER_TO_PHASE: Record<PhaseKey, Phase> = {
  accumulation_hypertrophy: 'accumulation',
  accumulation_strength: 'accumulation',
  intensification: 'intensification',
  peaking: 'peaking',
  deload: 'deload',
  // 6 неканонических ключей коллапсируют в ближайшую по смыслу фазу:
  technique: 'accumulation',      // технический блок → накопление (объём лёгкой работы)
  conditioning: 'accumulation',   // кондиционный → накопление
  power: 'intensification',       // мощностной → интенсификация (высокая интенсивность)
  gpp: 'accumulation',            // общая подготовка → накопление
  transition: 'deload',            // переходный → разгрузка
};

/** Маппинг MacroPhase макроцикла (5) → Phase (4). */
export const MACRO_TO_PHASE: Record<MacroPhase, Phase> = {
  endurance: 'accumulation',     // выносливость → накопление (объём)
  strength: 'intensification',  // силовой → интенсификация
  peak: 'peaking',              // выход на пик → пик
  competition: 'peaking',       // соревнования → пик
  transition: 'deload',         // переход → разгрузка
};

/** Обратный маппинг Phase (4) → основная PhaseKey дизайнера. */
export const PHASE_TO_DESIGNER: Record<Phase, PhaseKey> = {
  accumulation: 'accumulation_hypertrophy',
  intensification: 'intensification',
  deload: 'deload',
  peaking: 'peaking',
};

/** Обратный маппинг Phase (4) → основная MacroPhase. */
export const PHASE_TO_MACRO: Record<Phase, MacroPhase> = {
  accumulation: 'endurance',
  intensification: 'strength',
  deload: 'transition',
  peaking: 'peak',
};

/** Преобразовать PhaseKey дизайнера → каноническую Phase. Fallback: 'accumulation'. */
export function designerPhaseToUserPhase(pk: PhaseKey): Phase {
  return DESIGNER_TO_PHASE[pk] ?? 'accumulation';
}

/** Преобразовать MacroPhase макроцикла → каноническую Phase. Fallback: 'accumulation'. */
export function macroPhaseToUserPhase(mp: MacroPhase): Phase {
  return MACRO_TO_PHASE[mp] ?? 'accumulation';
}

/** Является ли PhaseKey делод-подобной фазой (deload или transition). */
export function isDeloadLikePhaseKey(pk: PhaseKey): boolean {
  return pk === 'deload' || pk === 'transition';
}

/** Является ли MacroPhase делод-подобной фазой (transition). */
export function isDeloadLikeMacroPhase(mp: MacroPhase): boolean {
  return mp === 'transition';
}