/**
 * planner-day-limits.ts — ЕДИНЫЙ источник порогов дневного плана.
 *
 * Раньше одни и те же пороги (полы цельного белка, капы клетчатки, минимум
 * pre-sleep, множитель жирового капа) были продублированы литералами в
 * ~7 перекрывающихся проходах `meal-plan-engine.ts` (и зеркалах корректора).
 * Здесь — единственные именованные значения; движок/корректор ссылаются на них.
 *
 * Контракт: значения подобраны так, чтобы поведение осталось байт-в-байт там,
 * где оно уже совпадало. РАСХОЖДЕНИЯ (разные числа для одной роли в разных
 * контекстах) НЕ унифицированы на этом шаге — они вынесены отдельными
 * константами с пометкой «РАСХОЖДЕНИЕ» и будут сведены в следующих шагах
 * рефактора (см. docs/NUTRITION-MACRO-SINGLE-SOURCE-PLAN.md).
 */

// ─────────────────────────────────────────────────────────────────────────────
// БЕЛОК — полы цельного белка (г)
// ─────────────────────────────────────────────────────────────────────────────

/** fixM (грубая итеративная коррекция): основной приём, цельный белок. */
export const PROTEIN_FLOOR_MAIN_G = 90;
/** fixM: перекус, цельный белок. */
export const PROTEIN_FLOOR_SNACK_G = 60;
/** MPS-порция порошка (сыворотка/казеин) в любом приёме. */
export const PROTEIN_FLOOR_POWDER_G = 20;
/** fixM: не-порошковый fast/slow (цельная молочка) — реальная порция. */
export const PROTEIN_FLOOR_FAST_SLOW_G = 60;

/** P4b (финальная белковая коррекция): пол цельного белка основного приёма, обычный день. */
export const PROTEIN_FLOOR_MAIN_SOFT_G = 80;
/** P4b: пол цельного белка перекуса, обычный день. */
export const PROTEIN_FLOOR_SNACK_SOFT_G = 50;
/**
 * P4b: полы на НИЗКОБЕЛКОВЫХ днях (цель белка ниже суммы полов приёмов + окна):
 * ужимаются, иначе день уходит за цель на +20-30%.
 */
export const PROTEIN_FLOOR_MAIN_LOW_G = 60;
export const PROTEIN_FLOOR_SNACK_LOW_G = 40;
/** P4b: HV-день с перебором белка (не экстрим) — мягкий пол основных приёмов. */
export const PROTEIN_FLOOR_MAIN_HV_G = 75;
export const PROTEIN_FLOOR_SNACK_HV_G = 50;
/** P4b: экстрим-углеводный день (≥8 г/кг У + плотная цель Б) — самые мягкие полы. */
export const PROTEIN_FLOOR_MAIN_EXTREME_G = 60;
export const PROTEIN_FLOOR_SNACK_EXTREME_G = 48;
/** P4b: цельная молочка pre-sleep — реальная ночная порция. */
export const PROTEIN_FLOOR_PRESLEEP_DAIRY_G = 100;

/**
 * reconciler (E0): пол белка ОСНОВНЫХ приёмов по весу (г).
 * РАСХОЖДЕНИЕ с PROTEIN_FLOOR_MAIN_SOFT_G (80): reconciler режет до 75/55/50/40.
 */
export function reconMainProteinFloorG(weightKg: number): number {
  return weightKg >= 80 ? 75 : weightKg >= 65 ? 55 : weightKg >= 60 ? 50 : 40;
}

/** reconciler: кап белка одного приёма (г). */
export const RECON_MEAL_PROTEIN_CAP_G = 58;

// ─────────────────────────────────────────────────────────────────────────────
// БЕЛОК — MPS-коридор приёма (г/кг LBM)
// ─────────────────────────────────────────────────────────────────────────────

/** Верхняя граница MPS-коридора основного приёма (Schoenfeld & Aragon 2018). */
export const MPS_CEIL_LBM_G_PER_KG = 0.62;
/** Нижний MPS-пол приёма — неприкосновенен. */
export const MPS_FLOOR_LBM_G_PER_KG = 0.22;
/** Минимум белка ОСНОВНОГО приёма (0.225 г/кг LBM) — MPS-минимум мейна. */
export const MPS_MAIN_MIN_LBM_G_PER_KG = 0.225;
/** P6: жёсткий пол порции мяса при ужатии к MPS-потолку (порошок — PROTEIN_FLOOR_POWDER_G). */
export function p6HardProteinFloorG(weightKg: number): number {
  return Math.max(40, Math.round((weightKg || 80) * 0.5));
}
/** ultra-P-бюджет (500Б / ≥3.5 г/кг): MPS-потолок и часть полов не применяются. */
export function isUltraPProtein(goalProteinG: number, weightKg: number): boolean {
  return (goalProteinG || 0) >= 350 || (goalProteinG || 0) / Math.max(40, weightKg || 80) >= 3.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SLEEP — ночной белок (г)
// ─────────────────────────────────────────────────────────────────────────────

/** Множитель веса для бюджета ночного приёма (ISSN 2017: 0.4 г/кг). */
export const PRESLEEP_PROTEIN_G_PER_KG = 0.4;
/** Пол бюджета ночного приёма (г) — нижняя граница вес-зависимого 0.4 г/кг. */
export const PRESLEEP_PROTEIN_MIN_G = 20;
/** Потолок бюджета ночного приёма (г). */
export const PRESLEEP_PROTEIN_MAX_G = 45;
/**
 * Шаг 5: пол ночного приёма на УЖАТЫХ низкобелковых днях (цель дня ниже суммы полов
 * приёмов + окна). РАСХОЖДЕНИЕ с PRESLEEP_PROTEIN_MIN_G (20) — 18 г: это НЕ тот же порог.
 * 20 — нижняя граница бюджета 0.4 г/кг (для веса <50 кг); 18 — минимум цели/пола
 * buildPreSleep + reconciler на ужатых днях. Попытка свести к 20 (шаг 5) дала РЕГРЕСС
 * (F60-1500 T s1: frag 1→2, planner-meal-consolidation «анти-регресс»), поэтому значения
 * оставлены раздельными осознанно — роли разные. Не унифицировать без ре-калибровки.
 */
export const PRESLEEP_PROTEIN_UPSCALED_MIN_G = 18;

// ─────────────────────────────────────────────────────────────────────────────
// ЖИР — множитель капа относительно цели
// ─────────────────────────────────────────────────────────────────────────────

/** kcal-догон жиром и P4c-кламп: не выводить жиры дня за цель × FAT_CAP_MULT. */
export const FAT_CAP_MULT = 1.1;
/**
 * РАСХОЖДЕНИЕ: fat-deficit-догон использует ×1.08 (было ×1.10 у kcal-догона).
 * Свести в шаге 2 (слияние двух жировых проходов).
 */
export const FAT_DEFICIT_CAP_MULT = 1.08;
/** Комната роста жира в поздних доборах (не выводить день за цель ×1.08). */
export const FAT_ROOM_CAP_MULT = 1.08;
/** Дополнительный кламп жира по весу (P4c): weightKg × 0.8 × ×1.05. */
export const FAT_CAP_WEIGHT_G_PER_KG = 0.8;
export const FAT_CAP_WEIGHT_MULT = 1.05;

// ─────────────────────────────────────────────────────────────────────────────
// КЛЕТЧАТКА — капы дня (г)
// ─────────────────────────────────────────────────────────────────────────────

/** Базовая формула клетчатки: 14 г на 1000 ккал, кламп 25–50. */
export function FIBER_CAP_G(kcal: number): number {
  return Math.max(25, Math.min(50, Math.round((kcal || 0) / 1000 * 14)));
}
/** Жёсткий реализм-кап клетчатки дня (независимо от ккал). */
export const FIBER_HARD_CAP_G = 85;
/** Г/1000 ккал для HV-ступеней и P4-realism (14). */
export const FIBER_KCAL_PER_1000_G = 14;
/** HV-ступени капа по углеводам дня (700У+ / 500-700У / иначе). */
export const FIBER_HV_CAP_MAX_G = 115;
export const FIBER_HV_CAP_MID_G = 65;
export const FIBER_HV_CAP_MIN_G = 50;
export const FIBER_HV_TIER_FLOOR_MAX_G = 105;
export const FIBER_HV_TIER_FLOOR_MID_G = 60;
/** HV-ступени капа по углеводам дня: 700У+ → 115, 500-700У → 65, иначе 50. */
export function fiberHvStepCapG(goalCarbsG: number): number {
  return goalCarbsG >= 700 ? FIBER_HV_CAP_MAX_G : goalCarbsG >= 500 ? FIBER_HV_CAP_MID_G : FIBER_HV_CAP_MIN_G;
}
/** HV-tier пол капа по углеводам (не даёт капу упасть ниже неизбежной клетчатки). */
export function fiberHvTierFloorG(goalCarbsG: number): number {
  return goalCarbsG >= 700 ? FIBER_HV_TIER_FLOOR_MAX_G : goalCarbsG >= 500 ? FIBER_HV_TIER_FLOOR_MID_G : 0;
}
/** P4-realism: HV-дни (≥1000У) ≤ max(50, 14 г/1000 ккал). */
export function fiberP4CapG(kcal: number): number {
  return Math.max(50, Math.round(((kcal || 0) / 1000) * FIBER_KCAL_PER_1000_G));
}
