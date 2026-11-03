/**
 * bb-scheme-comment-reconcile.ts — приведение комментария схемы объёма к факту.
 *
 * Схемы объёма (`VOLUME_SCHEMES`: FST-7 = 7 сетов, GVT = 5+5, Gironda 8×8 = 5+5)
 * назначаются в `applyVolumeScheme`, но ПОСЛЕ них план ещё режут и пересчитывают:
 * недельный бюджет/MRV (внутри buildBBPlan), авто-регуляция объёма по готовности
 * (`applyPostPhaseProcessing`), prep-кривая (`bb-prep-cycle`). Комментарий при этом
 * продолжал обещать исходное число — пользователь видел в одном упражнении
 * «GVT 10×10 (5×10)» и 4 сета в плане.
 *
 * История:
 *  - D-1b — фикс только для FST-7 (метка была захардкожена);
 *  - G   — схема-агностичный фикс по `schemeLabel`, только в сторону уменьшения;
 *  - H   — вынесено в отдельный модуль (иначе bb-autocoach ↔ bb-finalize дают
 *          цикл импортов), причина параметризуема, работает в ОБЕ стороны
 *          (авто-регуляция умеет и ×1.1), идемпотентно через `schemeBaseComment`.
 *
 * Вызывать в самом конце каждого прохода, который меняет `sets`.
 */
import { REP_SCHEMES } from './bb-rep-schemes.engine';

/** Минимум, который нужен от плана: недели → сессии → упражнения. */
export interface SchemePlanLike {
  weeks: Array<{ sessions: Array<{ exercises: any[] }> }>;
}

export interface SchemeReconcileOpts {
  /**
   * Своя формулировка причины (у авто-регуляции и prep-кривой причины разные).
   * По умолчанию — «бюджет недели» для уменьшения и «объём увеличен» для роста.
   */
  reason?: (actual: number, assigned: number, label: string) => string;
}

export interface SchemeReconcileResult {
  fixed: number;
  byLabel: Record<string, number>;
}

const FST7_LABEL = REP_SCHEMES.fst7.nameRu;

/** Хвостовой сегмент причины, который пишет этот модуль: всегда ` · <текст>:
 *  N из M сетов`. Снимается перед повторной подстановкой, чтобы причина не
 *  дублировалась в планах, где `schemeBaseComment` ещё не был записан. */
const REASON_TAIL = /(?:^| · )[^·]*: \d+ из \d+ сетов$/;

function stripReason(comment: string): string {
  const m = REASON_TAIL.exec(comment);
  return m ? comment.slice(0, m.index) : comment;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultReason(actual: number, assigned: number, label: string): string {
  if (actual < assigned) {
    const who = label === FST7_LABEL ? 'финишер урезан' : 'схема урезана';
    return `${who} бюджетом недели: ${actual} из ${assigned} сетов`;
  }
  return `объём увеличен после назначения схемы: ${actual} из ${assigned} сетов`;
}

/**
 * Сверить обещание схемы в комментарии с фактическим числом сетов.
 *
 * Идемпотентно: если цифра уже совпадает — ничего не делает. Возвращает число
 * исправленных упражнений по меткам схем, чтобы вызывающий мог объяснить это в
 * rationale плана.
 */
export function reconcileSchemeComments(
  plan: SchemePlanLike,
  opts?: SchemeReconcileOpts,
): SchemeReconcileResult {
  const byLabel: Record<string, number> = {};
  let fixed = 0;
  for (const week of plan.weeks || []) {
    for (const session of week.sessions || []) {
      for (const ex of session.exercises || []) {
        const assigned = Number((ex as any).schemeAssignedSets);
        if (!Number.isFinite(assigned) || assigned <= 0) continue;
        const actual = Number(ex.sets) || 0;
        if (actual <= 0) continue;
        const label = String((ex as any).schemeLabel || FST7_LABEL);
        // База = комментарий без нашей причины. Новые планы несут её явно,
        // старые — снимаем регуляркой.
        const base = stripReason(String((ex as any).schemeBaseComment ?? ex.comment ?? ''));
        const m = new RegExp(`${escapeRe(label)} \\((\\d+)×`).exec(base);
        if (!m) continue;
        if (Number(m[1]) === actual) continue;
        const reason = opts?.reason?.(actual, assigned, label) ?? defaultReason(actual, assigned, label);
        ex.comment = `${base.replace(m[0], `${label} (${actual}×`)} · ${reason}`;
        (ex as any).schemeBaseComment = base;
        byLabel[label] = (byLabel[label] || 0) + 1;
        fixed += 1;
      }
    }
  }
  return { fixed, byLabel };
}

/** То же, но для массива недель: подготовка/тапер работают на клонах недель. */
export function reconcileSchemeCommentsIn(
  weeks: any[],
  opts?: SchemeReconcileOpts,
): SchemeReconcileResult {
  return reconcileSchemeComments({ weeks: weeks || [] } as SchemePlanLike, opts);
}
