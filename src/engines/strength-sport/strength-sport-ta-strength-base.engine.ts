/**
 * strength-sport-ta-strength-base.engine.ts — СИЛОВОЙ КРОСС-ЧЕК ЗАЯВОК (W7 PRO-v3)
 *
 * Sandau & Kipp 2025, JSCR 39(1) (29 элитных ТА, penLR):
 * - 1RM рывок: 1RM рывковая тяга + 3RM присед + 1RM жим стоя + вес (RMSE ≈3–9 кг);
 * - 1RM толчок: 1RM толчковая тяга + 3RM фронт-присед + 1RM жим стоя + вес (RMSE ≈3–7 кг).
 * Коэффициенты регрессии в хабе НЕ зашиваем (зависят от выборки) — вместо этого:
 * 1) полоса RMSE вокруг модельной базы (минимум диапазона — консервативно);
 * 2) флаг расхождения ручной заявки vs модельной базы >RMSE → «сила есть/техники
 *    нет» (или наоборот), идёт в diagnoseTAWeakCause как сигнал;
 * 3) список предикторов для контекста тренера.
 * Чистый движок, без UI/storage.
 */

/** Консервативные RMSE (минимум диапазона Sandau&Kipp 2025). */
export const TA_BASE_RMSE_SNATCH = 3;
export const TA_BASE_RMSE_CJ = 3;

/** Предикторы результата (порядок важности, Sandau&Kipp 2025). */
export const SNATCH_PREDICTORS: string[] = ['1RM рывковая тяга', '3RM присед', '1RM жим стоя', 'вес'];
export const CJ_PREDICTORS: string[] = ['1RM толчковая тяга', '3RM фронт-присед', '1RM жим стоя', 'вес'];

export interface BaseDivergence {
  divergent: boolean;
  diffKg: number | null;
  rmseKg: number;
  text: string | null;
}

/**
 * Расхождение ручной заявки vs модельной базы (FvR).
 * null-входы → {divergent:false} (нечего сравнивать — не флаг).
 */
export function attemptBaseDivergence(
  fvrBaseKg: number | null | undefined,
  declaredKg: number | null | undefined,
  lift: 'snatch' | 'cj' = 'snatch',
): BaseDivergence {
  const rmseKg = lift === 'cj' ? TA_BASE_RMSE_CJ : TA_BASE_RMSE_SNATCH;
  if (fvrBaseKg == null || declaredKg == null || !Number.isFinite(fvrBaseKg) || !Number.isFinite(declaredKg) || fvrBaseKg <= 0 || declaredKg <= 0) {
    return { divergent: false, diffKg: null, rmseKg, text: null };
  }
  const diff = Math.round((declaredKg - fvrBaseKg) * 10) / 10;
  if (Math.abs(diff) <= rmseKg) {
    return { divergent: false, diffKg: diff, rmseKg, text: null };
  }
  const dir = diff > 0
    ? 'Заявка выше модели: сила/техника тяги не подтверждает — проверь предикторы (тяга/присед/жим).'
    : 'Модель выше заявки: силовой запас есть — likely техника/скорость, можно смелее.';
  return { divergent: true, diffKg: diff, rmseKg, text: `${dir} (±RMSE ${rmseKg}кг, Sandau&Kipp 2025).` };
}
