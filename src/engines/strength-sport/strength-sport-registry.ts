/**
 * strength-sport-registry.ts — единый реестр для ТА/стронга (single source)
 * Объединяет POOL_BY_TAG, SS_ANGLE_CLASSES, SS_STRICT_GROUPS, EVENT_META, STRONG_FALLBACK, STRONG_FALLBACK_COEFF
 * Добавление нового ивента = 1 файл: сюда + EVENT_META + workMax
 */
export { POOL_BY_TAG, OLY_IDS, STRONG_IDS, isOly, isStrong, STRONG_FALLBACK, filterPool, gentleFactor, basePmFor, getExerciseMeta, SS_EX_META, SS_TECHNIQUE } from './strength-sport-pool.engine';
export { SS_ANGLE_CLASSES, SS_STRICT_GROUPS, strictGroupFor, groupMembers, filterByTier, filterByInjury, selectDiverse } from './strength-sport-selection';
export { EVENT_META, STRONG_FALLBACK_COEFF, isCarry } from './strength-sport-event-types';
export { CONTEST_PRESETS } from './strength-sport-contest.types';
