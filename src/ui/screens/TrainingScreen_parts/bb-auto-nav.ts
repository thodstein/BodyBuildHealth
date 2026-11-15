/**
 * bb-auto-nav.ts — политика навигации ББ-авто: какой шаг показать при открытии
 * конструктора и когда внешний план имеет право увести пользователя на «План».
 *
 * Вынесено из `BbAutoConstructor.tsx` (god-компонент, jsdom-рендер виснет) — так
 * правило проверяется обычным unit-тестом.
 *
 * Жалоба, из которой модуль и появился: «экран в бб авто перескакивает часто на
 * другой». Причина — три места ставили шаг без участия пользователя
 * (`setStep('plan')` на монтировании, `setStep('contest')` при приёме годового
 * контекста, `setStep('plan')` на внешнем `he-bb-plan-saved`), а сам шаг при этом
 * нигде не сохранялся.
 */
import type { Step } from './bb-auto-constructor-shared';

/** Полный порядок шагов конструктора (совпадает с `Step`). */
export const BB_AUTO_STEPS: readonly Step[] = [
  'params', 'ped', 'split', 'plan', 'weights', 'quality', 'adjust', 'contest', 'annual', 'tools',
];

/** Шаги, которые бессмысленны без собранного плана (зеркало `stepLockReason`). */
const NEEDS_PLAN: ReadonlySet<Step> = new Set<Step>(['plan', 'weights', 'quality', 'adjust', 'contest']);

/** Шаги, состояние которых живёт только в памяти: восстанавливать их после
 *  перезагрузки нельзя (введённые веса пропали — форма выглядела бы пустой). */
const TRANSIENT: ReadonlySet<Step> = new Set<Step>(['weights']);

/**
 * Шаги, на которых пользователь что-то вводит/настраивает. Внешний план
 * (годовой планировщик, диагностика) обновляет данные, но НЕ имеет права
 * уводить с такого шага: это и есть «экран сам перескочил».
 *
 * `annual` здесь по делу: годовой планировщик встроен прямо в этот шаг
 * (`BbAutoConstructor` → `MacrocyclePanel`), и его кнопка «🚀 В ББ-авто» шлёт то
 * самое событие `he-bb-plan-saved` внутри того же документа.
 */
export const BB_EDITING_STEPS: ReadonlySet<Step> = new Set<Step>([
  'params', 'ped', 'split', 'contest', 'annual', 'tools',
]);

export function isBbAutoStep(v: unknown): v is Step {
  return typeof v === 'string' && (BB_AUTO_STEPS as readonly string[]).includes(v);
}

/** Шаг, допустимый для текущего состояния конструктора, либо `null`. */
export function validBbAutoStep(
  v: unknown,
  opts: { hasPlan: boolean; programMode?: boolean },
): Step | null {
  if (!isBbAutoStep(v)) return null;
  if (NEEDS_PLAN.has(v) && !opts.hasPlan) return null;
  // В режиме «Программы» шага «Сплит» в ленте нет (шаг пропускается).
  if (v === 'split' && opts.programMode) return null;
  return v;
}

/**
 * Шаг, с которого открывать конструктор: сохранённая позиция пользователя,
 * иначе — «1 Параметры». Никогда не «прыгает» на «План» сам.
 */
export function resolveBbAutoOpenStep(
  v: unknown,
  opts: { hasPlan: boolean; programMode?: boolean },
): Step {
  const step = validBbAutoStep(v, opts);
  if (!step) return 'params';
  if (TRANSIENT.has(step)) return opts.hasPlan ? 'plan' : 'params';
  return step;
}

/**
 * Нужно ли уводить пользователя на «План» после внешнего обновления плана.
 * Да — только если он не занят настройкой/правками.
 */
export function shouldFollowExternalPlan(currentStep: Step): boolean {
  return !BB_EDITING_STEPS.has(currentStep);
}

/** Сколько живёт контекст передачи блока годового плана. */
export const ANNUAL_CTX_TTL_MS = 24 * 60 * 60_000;

/**
 * Свежий ли контекст передачи блока (`he_bb_plan_saved_ctx`). Признаки:
 * `ts` контекста, иначе дата сохранённого плана. Старый контекст — «чужой
 * хвост» в хранилище: пик-неделу по нему предзаполнять нельзя (это выглядело бы
 * как самопроизвольный переход в «🏁 Contest prep»).
 */
export function annualBlockCtxIsFresh(
  ctx: { ts?: unknown } | null | undefined,
  planDateIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  let at = Number(ctx?.ts);
  if (!Number.isFinite(at) || at <= 0) {
    const parsed = planDateIso ? Date.parse(planDateIso) : NaN;
    at = Number.isFinite(parsed) ? parsed : NaN;
  }
  if (!Number.isFinite(at)) return false;
  const age = nowMs - at;
  // Небольшой допуск на расхождение часов; всё, что старше суток, — не hand-off.
  return age >= -5 * 60_000 && age <= ANNUAL_CTX_TTL_MS;
}

/** Неделя плана для восстановления позиции: 1..totalWeeks (мусор → 1). */
export function clampBbWeek(v: unknown, totalWeeks: number): number {
  const total = Number.isFinite(totalWeeks) && totalWeeks > 0 ? Math.floor(totalWeeks) : 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  const week = Math.round(n);
  return total > 0 ? Math.min(week, total) : week;
}

/**
 * Реагировать ли навигацией на `storage`-событие (смена трека планировщика /
 * вкладки тренировок).
 *
 * Событие, отправленное в СВОЁМ документе (`window.dispatchEvent(new StorageEvent(…))`),
 * имеет `isTrusted === false` — это осознанный клик по кнопке, его отрабатываем.
 * Настоящее кросс-оконное событие — чужое действие в другой вкладке/окне: пока у
 * нас открыто окно конструктора, оно не имеет права ни подменить трек, ни
 * закрыть окно (это и читалось как «экран сам перескакивает»). Выбор всё равно
 * лежит в localStorage и применится при следующем открытии конструктора.
 */
export function shouldNavigateOnStorageEvent(opts: { isTrusted?: boolean; page: string }): boolean {
  if (!opts.isTrusted) return true;
  return opts.page !== 'constructor';
}
