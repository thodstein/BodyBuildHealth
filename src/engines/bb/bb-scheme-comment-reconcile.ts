/**
 * bb-scheme-comment-reconcile.ts — приведение комментария схемы объёма к факту.
 *
 * Схемы объёма (`VOLUME_SCHEMES`: FST-7 = 7 сетов, GVT = 5+5, Gironda 8×8 = 5+5)
 * назначаются в `applyVolumeScheme`, но ПОСЛЕ них план ещё режут и пересчитывают:
 * недельный бюджет/MRV (внутри buildBBPlan), авто-регуляция объёма по готовности
 * (`applyPostPhaseProcessing`), prep-кривая (`bb-prep-cycle`), программа-путь
 * (`cycle-to-plan`: rehab, трим по MRV, множитель отдыха по интенсивности).
 * Комментарий при этом продолжал обещать исходное число — пользователь видел в
 * одном упражнении «GVT 10×10 (5×10)» и 4 сета в плане.
 *
 * История:
 *  - D-1b — фикс только для FST-7 (метка была захардкожена);
 *  - G   — схема-агностичный фикс по `schemeLabel`, только в сторону уменьшения;
 *  - H   — вынесено в отдельный модуль (иначе bb-autocoach ↔ bb-finalize дают
 *          цикл импортов), причина параметризуема, работает в ОБЕ стороны
 *          (авто-регуляция умеет и ×1.1), идемпотентно через `schemeBaseComment`;
 *  - I   — подключено к движку подготовки (overreach/тапер/prepVolumeMult);
 *  - J   — обещание схемы это три величины: `N×A-B, отдых Rс`. Программа-путь
 *          менял не только сеты (rehab, недельный трим), но и отдых (множитель по
 *          уровню интенсивности) и повторы (DUP-оверлей). Сверка чинит все три,
 *          иначе «отдых 75с» в комментарии врёт при 60с в упражнении.
 *
 * Вызывать в самом конце каждого прохода, который меняет `sets`/`repsRange`/`restSeconds`.
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

/** Какие именно аспекты обещания пришлось править. */
export interface SchemeReconcileAspects {
  sets: number;
  reps: number;
  rest: number;
}

export interface SchemeReconcileResult {
  fixed: number;
  byLabel: Record<string, number>;
  /** Разбивка по аспектам — для честного rationale («правили отдых, а не сеты»). */
  aspects: SchemeReconcileAspects;
}

const FST7_LABEL = REP_SCHEMES.fst7.nameRu;

/** Хвост, который пишет этот модуль: ` · <причина>: <аспекты>`. Аспекты — только
 *  наши маркеры (`N из M сетов`, `повторы A-B`, `отдых Rс`), поэтому хвост
 *  снимается без риска съесть пользовательский текст комментария. */
const REASON_TAIL = new RegExp(
  '(?:^| · )[^·]*: (?:(?:\\d+ из \\d+ сетов|повторы \\d+-\\d+|отдых \\d+с)(?:, )?)+$',
);

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
 * Сверить обещание схемы в комментарии с фактом: сеты, диапазон повторов, отдых.
 *
 * Идемпотентно: если всё уже совпадает — ничего не делает. Возвращает число
 * исправленных упражнений по меткам схем и разбивку по аспектам, чтобы вызывающий
 * мог объяснить это в rationale плана.
 */
export function reconcileSchemeComments(
  plan: SchemePlanLike,
  opts?: SchemeReconcileOpts,
): SchemeReconcileResult {
  const byLabel: Record<string, number> = {};
  const aspects: SchemeReconcileAspects = { sets: 0, reps: 0, rest: 0 };
  let fixed = 0;
  for (const week of plan.weeks || []) {
    for (const session of week.sessions || []) {
      for (const ex of session.exercises || []) {
        const assigned = Number((ex as any).schemeAssignedSets);
        if (!Number.isFinite(assigned) || assigned <= 0) continue;
        const actualSets = Number(ex.sets) || 0;
        if (actualSets <= 0) continue;
        const label = String((ex as any).schemeLabel || FST7_LABEL);
        // База = комментарий без нашей причины. Новые планы несут её явно,
        // старые — снимаем регуляркой.
        const base = stripReason(String((ex as any).schemeBaseComment ?? ex.comment ?? ''));
        // Обещание схемы: `<метка> (N×A[-B][, отдых Rс])`.
        const m = new RegExp(
          `${escapeRe(label)} \\((\\d+)×(\\d+)((?:-\\d+)?)(, отдых (\\d+)с)?\\)`,
        ).exec(base);
        if (!m) continue;

        const claimSets = Number(m[1]);
        const claimRepMin = Number(m[2]);
        const claimRepMax = m[3] ? Number(m[3].slice(1)) : claimRepMin;
        const claimRest = m[5] ? Number(m[5]) : null;

        const repsArr = Array.isArray(ex.repsRange) && ex.repsRange.length === 2 ? ex.repsRange : null;
        const repA = repsArr ? Number(repsArr[0]) : NaN;
        const repB = repsArr ? Number(repsArr[1]) : NaN;
        const restNum = Number(ex.restSeconds);
        const actualRest = Number.isFinite(restNum) && restNum > 0 ? Math.round(restNum) : null;

        const setsChanged = claimSets !== actualSets;
        const repsChanged = Number.isFinite(repA) && Number.isFinite(repB)
          && (repA !== claimRepMin || repB !== claimRepMax);
        const restChanged = claimRest !== null && actualRest !== null && claimRest !== actualRest;
        if (!setsChanged && !repsChanged && !restChanged) continue;

        // 1) Само обещание: подменяем только разошедшиеся величины, форматирование
        //    исходной строки (наличие диапазона/отдыха) сохраняем.
        let claim = `${label} (${setsChanged ? actualSets : claimSets}×`;
        claim += repsChanged ? `${repA}-${repB}` : `${m[2]}${m[3]}`;
        if (claimRest !== null) claim += `, отдых ${restChanged ? actualRest : claimRest}с`;
        claim += ')';

        // 2) Причина: формулировка про сеты — от вызывающего, тихие аспекты
        //    (повторы/отдых) называем сами, чтобы читатель понял, что изменилось.
        const extras: string[] = [];
        if (repsChanged) extras.push(`повторы ${repA}-${repB}`);
        if (restChanged) extras.push(`отдых ${actualRest}с`);
        let reason: string;
        if (setsChanged) {
          reason = opts?.reason?.(actualSets, assigned, label) ?? defaultReason(actualSets, assigned, label);
          if (extras.length) reason = `${reason}, ${extras.join(', ')}`;
        } else {
          reason = `схема обновлена после назначения: ${extras.join(', ')}`;
        }

        const newClaim = base.replace(m[0], claim);
        ex.comment = `${newClaim} · ${reason}`;
        // База = комментарий без нашей причины, но уже с ФАКТОМ: иначе повторный
        // проход снова увидит расхождение с исходным обещанием (не идемпотентно).
        (ex as any).schemeBaseComment = newClaim;
        byLabel[label] = (byLabel[label] || 0) + 1;
        if (setsChanged) aspects.sets += 1;
        if (repsChanged) aspects.reps += 1;
        if (restChanged) aspects.rest += 1;
        fixed += 1;
      }
    }
  }
  return { fixed, byLabel, aspects };
}

/** То же, но для массива недель: подготовка/тапер работают на клонах недель. */
export function reconcileSchemeCommentsIn(
  weeks: any[],
  opts?: SchemeReconcileOpts,
): SchemeReconcileResult {
  return reconcileSchemeComments({ weeks: weeks || [] } as SchemePlanLike, opts);
}
