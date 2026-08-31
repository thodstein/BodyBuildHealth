/**
 * planner-day-targets.ts — ЕДИНЫЙ расчёт фактических целей дня генерации (Эпик A,
 * план NUTRITION-PLANNER-QUALITY-PLAN.md, Aug 30 2026).
 *
 * Проблема, которую решает: `computePlannerTargets` (planner-targets.ts) считал полную
 * научную цепочку (TDEE → bulk surplus → фаза курса → ААС/инсулин/GLP → weight-adapt →
 * metabolic adapt → женский гейт ≤22%), но фактические цели генерации собирались в
 * IndividualPlanContext из пресета белка × флоор жиров × потолок углей — наука доезжала
 * только через углеводную цель. Профицит 5→25% не менял план, weight-adapt молчал.
 *
 * Новая семантика (auto):
 *   1. kcalTarget = calcTargets.kcal — ПОЛНАЯ научная цепочка (surplus/фаза/фарма/адаптации).
 *   2. Белок = пресет пользователя (г/кг) — явный оверрайд поверх науки.
 *   3. Жиры = пол 0.8 г/кг; при инсулине научный кап 0.5 г/кг сильнее пола.
 *   4. Углеводы = ОСТАТОК до kcalTarget (наука доезжает!), затем диетологический потолок
 *      (computeDieteticCarbTarget: bulk 6-10 г/кг по объёму, инсулин-флор, budget).
 *   5. kcal = Atwater(Б, Ж, У) — display == генерация.
 *
 * manual/profile режимы сохраняют прежнее поведение (обратно-совместимость с тестами).
 * Чистая функция, детерминированная, тестируемая. Breakdown[] — строки для UI.
 */

import { computeDieteticCarbTarget, plannerGoalCategory } from './planner-targets';
import type { PlannerTargets } from './planner-targets';

export interface DayTargetsInput {
  weightKg: number;
  presetGPerKg: number;          // пресет белка пользователя (1.6-2.6), v6
  fatFloorGPerKg: number;        // физиологический пол жиров (0.8)
  kbjuMode: 'auto' | 'manual' | 'profile';
  manual?: { kcal?: number | null; p?: number | null; f?: number | null; c?: number | null };
  /** Научная цепочка целиком (phase/pharma/weight-adapt/metabolic/female gate) — для auto. */
  calcTargets: PlannerTargets;
  /** Нейтральные цели профиля (maintenance, без модификаторов) — для mode 'profile'. */
  profileTargets: PlannerTargets;
  goal: string;
  trainingVolumeMinPerWeek?: number;
  budget?: string;
  insulinTotalUnits?: number;
}

export interface DayTargetsResult {
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
  /** Человекочитаемый разбор: TDEE → модификаторы → макросы. Для карточки в Settings/Results. */
  breakdown: string[];
}

const atwater = (p: number, f: number, c: number) => Math.round(p * 4 + f * 9 + c * 4);

export function buildDayTargets(input: DayTargetsInput): DayTargetsResult {
  const weight = Math.max(30, Math.min(300, Number(input.weightKg) || 80));
  const preset = Math.max(1.2, Math.min(3.5, Number(input.presetGPerKg) || 2.0));
  const fatFloor = Math.max(0.4, Math.min(2.0, Number(input.fatFloorGPerKg) || 0.8));
  const insulinUnits = Math.max(0, Number(input.insulinTotalUnits) || 0);
  const mode = input.kbjuMode || 'auto';
  const manual = input.manual || {};
  const fallback: PlannerTargets = { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 };
  const base = input.calcTargets || fallback;
  const prof = input.profileTargets || fallback;

  // ─── manual: прежнее поведение (обратно-совместимо) ─────────────────────────
  if (mode === 'manual') {
    const p = Math.max(0, Math.round(Number(manual.p) || 0));
    const f = Math.max(Math.round(weight * fatFloor), Math.max(0, Math.round(Number(manual.f) || 0)));
    let c: number;
    if (manual.c !== null && manual.c !== undefined && Number(manual.c) > 0) {
      c = Math.round(Number(manual.c));
    } else if (Number(manual.kcal) > 0 && p > 0 && Number(manual.f) > 0) {
      c = Math.max(0, Math.round((Number(manual.kcal) - p * 4 - Number(manual.f) * 9) / 4));
    } else {
      c = 0;
    }
    const kcal = Number(manual.kcal) > 0 ? Math.round(Number(manual.kcal)) : atwater(p, f, c);
    return { kcal, protein: p, fats: f, carbs: c, breakdown: [`Ручной режим: ${kcal} ккал · Б ${p} · Ж ${f} · У ${c}`] };
  }

  // ─── profile: нейтральные цели профиля + диетпотолок (прежнее поведение) ────
  if (mode === 'profile') {
    const p = Math.max(0, Math.round(prof.protein || 0));
    const f = Math.max(Math.round(weight * fatFloor), Math.max(0, Math.round(prof.fats || 0)));
    const vol = Math.max(0, Number(input.trainingVolumeMinPerWeek) || 0);
    const c = computeDieteticCarbTarget({
      weightKg: weight, rawCarbsG: Math.max(0, Math.round(prof.carbs || 0)), insulinTotalUnits: insulinUnits,
      goalPhase: plannerGoalCategory(input.goal || ''), trainingVolumeMinPerWeek: vol, budget: input.budget,
    });
    const kcal = atwater(p, f, c);
    return {
      kcal, protein: p, fats: f, carbs: c,
      breakdown: [`Профиль (без модификаторов): ${kcal} ккал · Б ${p} · Ж ${f} · У ${c} (потолок углей применён)`],
    };
  }

  // ─── auto: наука = источник калорий, пресет = белок, угли = остаток ─────────
  const protein = Math.round(weight * preset);
  // Инсулин: научный кап жира 0.5 г/кг СИЛЬНЕЕ пола (planner-targets правило 6).
  const fatFloorAbs = Math.round(weight * fatFloor);
  const fats = insulinUnits > 0
    ? Math.max(20, Math.min(fatFloorAbs, Math.round(weight * 0.5)))
    : Math.max(fatFloorAbs, Math.max(0, Math.round(base.fats || 0)));
  const kcalTarget = Math.max(1200, Math.round(base.kcal || 0));
  const carbsRaw = Math.max(0, (kcalTarget - protein * 4 - fats * 9) / 4);
  const vol = Math.max(0, Number(input.trainingVolumeMinPerWeek) || 0);
  const goalPhase = plannerGoalCategory(input.goal || '');
  const carbs = computeDieteticCarbTarget({
    weightKg: weight, rawCarbsG: carbsRaw, insulinTotalUnits: insulinUnits,
    goalPhase, trainingVolumeMinPerWeek: vol, budget: input.budget,
  });
  const kcal = atwater(protein, fats, carbs);

  const breakdown: string[] = [];
  breakdown.push(`TDEE ${Math.round(base.tdee || 0)} ккал → с фазой/фармой/адаптациями ${kcalTarget} ккал`);
  if (base.adjustment) breakdown.push(`Коррекция движка питания: ${base.adjustment > 0 ? '+' : ''}${Math.round(base.adjustment)} ккал`);
  // Эпик 2: предупреждения согласованности (цель vs фарма-фаза) — в карточке целей.
  if (Array.isArray((base as any).warnings)) (base as any).warnings.forEach((w: string) => breakdown.push(w));
  breakdown.push(`Белок: пресет ${preset} г/кг → ${protein} г`);
  if (base.protein > protein * 1.12) breakdown.push(`Научный белок ${Math.round(base.protein)} г выше пресета — пресет приоритетен (поднимите «🥩 Пресет белка» при необходимости)`);
  breakdown.push(insulinUnits > 0
    ? `Жиры: ${fats} г (инсулин: кап 0.5 г/кг сильнее пола)`
    : `Жиры: ${fats} г (пол ${fatFloor} г/кг)`);
  breakdown.push(`Углеводы: остаток до ${kcalTarget} ккал → ${carbs} г (диетологический потолок ${goalPhase})`);
  breakdown.push(`Итог дня: ${kcal} ккал = Б ${protein}×4 + Ж ${fats}×9 + У ${carbs}×4`);
  if (kcal < kcalTarget * 0.92) breakdown.push(`⚠ Потолок углей срезал ${Math.round(kcalTarget - kcal)} ккал — увеличьте объём тренировок или бюджет («💰»), либо снимите потолок`);
  return { kcal, protein, fats, carbs, breakdown };
}
