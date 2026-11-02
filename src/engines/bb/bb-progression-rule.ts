/**
 * bb-progression-rule.ts — «как прогрессировать» на уровне упражнения (итерация C, D-1).
 *
 * До этого пользователь видел только «3×10 @ 80 кг RIR 2»: правило двойной
 * прогрессии было зашито в билдер, но не показано, поэтому непонятно, что делать,
 * когда верх диапазона повторений достигнут, и почему у слабой мышцы вес растёт сам.
 *
 * Здесь — чистые текстовые правила, согласованные с фактической механикой движка:
 *  - делод: RIR 3-4, меньше подходов, вес ниже рабочего (после — назад к рабочему);
 *  - пик: вес держим, объём снижен;
 *  - спец-мышца (weak/focus): +2 %/нед внутри фазы, кап +6 % (`loadProgressMult`);
 *  - остальные: двойная прогрессия по повторам, затем +2.5 кг
 *    (`prescribeLoad` / `weightForRepMax` + rep-buildup по неделям).
 *
 * Текст не обещает того, чего движок не делает (в частности, шаг веса зависит от
 * инвентаря — формулировка «плюс минимальный шаг веса» там, где это неизвестно).
 */
import type { BBExercise } from './bb-builder.engine';

export interface ProgressionRuleCtx {
  phase?: string;
  /** Неделя — разгрузка (флаг недели или фаза deload). */
  isDeload?: boolean;
  /** Мышца в специализации: weak-point или focus group. */
  isSpecMuscle?: boolean;
  trainingFocus?: string;
}

/**
 * Правило прогрессии для одного упражнения. Возвращает одну-две фразы,
 * которые можно показать в плане и напечатать в листе для зала.
 */
export function buildProgressionRule(
  ex: Pick<BBExercise, 'role' | 'character' | 'repsRange' | 'rir'>,
  ctx: ProgressionRuleCtx = {},
): string {
  const lo = Math.max(1, Math.round(ex.repsRange?.[0] ?? 8));
  const hi = Math.max(lo, Math.round(ex.repsRange?.[1] ?? 12));
  const rir = Number.isFinite(ex.rir as number) ? Math.round(ex.rir as number) : 2;
  const phase = String(ctx.phase || '');

  if (ctx.isDeload || phase === 'deload') {
    return 'Разгрузка: RIR 3-4, меньше подходов, вес ниже рабочего (насколько — по типу разгрузки). После делода вернитесь к весу прошлой рабочей недели: накопленная адаптация не потеряна.';
  }
  if (phase === 'peaking') {
    return 'Пик: вес держим, объём и повторы снижены — новый вес в пике не гоняем, форма важнее цифры.';
  }
  const isStrength = ctx.trainingFocus === 'strength';
  const strengthTail = isStrength ? ' Силовой фокус: RIR 1-2, вес важнее повторов.' : '';

  if (ctx.isSpecMuscle) {
    return `Спец-мышца: +2 % веса к следующей неделе фазы при тех же повторах (кап +6 % за фазу), затем двойная прогрессия — все подходы до ${hi} повторов на RIR ${rir} → минимальный шаг веса вверх и вернуться к ${lo}.${strengthTail}`;
  }
  const isPump = ex.character === 'памп' || (ex.role === 'accessory' && hi >= 12);
  if (isPump) {
    return `Двойная прогрессия: прибавляйте 1 повтор в неделю; дошли до ${hi} повторов на RIR ${rir} → минимальный шаг веса вверх и вернитесь к ${lo} повторам.${strengthTail}`;
  }
  return `Двойная прогрессия: все подходы до ${hi} повторов на RIR ${rir} → минимальный шаг веса вверх, вернуться к ${lo} повторам.${strengthTail}`;
}
