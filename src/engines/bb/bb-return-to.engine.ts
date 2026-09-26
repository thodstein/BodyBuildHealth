/**
 * bb-return-to.engine.ts — PRO-3 R2 + PRO-4 S3: возврат после стоп-флагов.
 *
 * Упрощённый parity ARM `buildRehabPlan`/return-to-pull: 3 ступени возврата
 * (техника → 50% → полный объём) при отсутствии боли. Скрининг, не реабилитация:
 * направление к врачу при stop уже даёт `bb-red-flags`.
 * S3: ступени несут исполняемые параметры (volumeMult/rirShift/bannedPatterns),
 * которые применяют инъекция и автосборка. Переход ступеней — только ручной
 * («боли нет N дней» ставит пользователь; автопереход по датам — враньё).
 * Чистый движок.
 */

export interface BbReturnToStage {
  stage: 1 | 2 | 3;
  title: string;
  volume: string;
  rir: string;
  note: string;
  /** S3: исполняемое действие ступени. */
  action: {
    /** 0 — без силового объёма (только техника), 0.5 — половина, 1 — полный. */
    volumeMult: number;
    /** Сдвиг RIR вставляемых/строящихся коррекций. */
    rirShift: number;
    /** Паттерны движений под запретом на ступени (подстроки имени, ru/en). */
    bannedPatterns: string[];
  };
}

export interface BbReturnToPlan {
  stages: BbReturnToStage[];
  text: string;
}

/** Активная ступень по ручному подтверждению (1–3, дефолт 1 — консервативно). */
export function activeReturnToStage(plan: BbReturnToPlan | null | undefined, confirmedStage?: number | null): BbReturnToStage | null {
  if (!plan || !plan.stages.length) return null;
  const n = Math.max(1, Math.min(3, Math.round(Number(confirmedStage) || 1)));
  return plan.stages[n - 1] ?? plan.stages[0];
}

export function buildReturnToPlan(
  flags: { active: boolean; blocked: boolean; items: string[] } | null | undefined,
): BbReturnToPlan | null {
  if (!flags || !flags.active) return null;
  const what = flags.items.length ? flags.items.join(', ') : 'флаги';
  return {
    stages: [
      {
        stage: 1,
        title: 'Неделя 1 — техника без нагрузки',
        volume: '0% силового объёма',
        rir: '—',
        note: `Причина: ${what}. Изометрия, резинки, суставная гимнастика. Боль = стоп и к врачу.`,
        action: { volumeMult: 0, rirShift: 0, bannedPatterns: ['жим', 'тяга', 'присед', 'press', 'row', 'pull', 'squat', 'deadlift'] },
      },
      {
        stage: 2,
        title: 'Недели 2–3 — половина объёма',
        volume: '50% объёма',
        rir: 'RIR+3',
        note: 'Только безболезненные движения, без отказа. Боль вернулась — назад на ступень 1.',
        action: { volumeMult: 0.5, rirShift: 3, bannedPatterns: [] },
      },
      {
        stage: 3,
        title: 'Неделя 4 — полный возврат',
        volume: '100% объёма',
        rir: 'по плану',
        note: 'При 2 неделях без боли. Первая тяжёлая — без отказа.',
        action: { volumeMult: 1, rirShift: 0, bannedPatterns: [] },
      },
    ],
    text: `Возврат после «${what}»: техника → 50% → полный объём за ~4 недели без боли`,
  };
}

/* ══ П2: измеримые КРИТЕРИИ ВЫХОДА из состояния (26.09.2026) ══
 *
 * Проблема (Н9 аддендума): ступени возврата были подсказкой — «ступень уехала в ББ-авто»,
 * но нечем было ПРОВЕРИТЬ, что пора. Ни одного измеримого критерия выхода не было.
 *
 * Источники (пороги не выдуманы — взяты из первоисточника):
 * - Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a
 *   pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy:
 *   a randomized controlled study. Am J Sports Med 2007;35(6):897-906 · PMID 17307888.
 *   Правило модели: продолжать, если боль ≤5/10; СТОП-сигналы — (а) боль не падает сразу
 *   после нагрузки, (б) не проходит к следующему утру, (в) растёт от недели к неделе.
 * - JOSPT / Silbernagel Program (инфографика программы): «Continue if pain ≤5/10, unless
 *   pain does not decrease immediately upon completion, does not subside by the next morning,
 *   or there is an increase in pain & stiffness week after week».
 * - Критерии входа в плиометрику (по протоколу Silbernagel, PMC8364697): «pain <5/10 for
 *   10 DL hops» — то есть плиометрика допускается только при боли <5/10 на 10 двойных
 *   прыжках.
 *
 * ЧЕСТНАЯ ОГОВОРКА (важна): порог «5/10» — широко применяемая клиническая эвристика, его
 * точный отсечный пункт НИКОГДА не валидировался на большой выборке. Поэтому движок:
 *  - НЕ ставит «диагноз» и НЕ двигает ступень автоматически (ступени остаются ручными —
 *    это зафиксировано выше как принцип, «автопереход по датам — враньё»);
 *  - различает met / not_met / no_data, чтобы «нет данных» НЕ читалось как «всё хорошо»;
 *  - прямо пишет, что решение о нагрузке — с пользователем и врачом.
 */
export type ReturnCriterionId = 'pain_load' | 'pain_next_morning' | 'morning_stiffness' | 'plyo';
export type ReturnCriterionState = 'met' | 'not_met' | 'no_data';

export interface ReturnCriteriaInput {
  /** Боль при нагрузке, 0–10 (NPRS/VAS). undefined = не введено. */
  painDuringLoad?: number | null;
  /** Боль на следующее утро после нагрузки, 0–10. */
  painNextMorning?: number | null;
  /** Утренняя скованность от недели к неделе. */
  morningStiffness?: 'better' | 'same' | 'worse' | null;
  /** Плиометрика терпится: боль <5/10 на 10 двойных прыжках (true) / нет (false). */
  plyoTolerated?: boolean | null;
}

export interface ReturnCriterion {
  id: ReturnCriterionId;
  label: string;
  /** Что именно считаем — чтобы «met» было проверяемым, а не «по ощущениям». */
  rule: string;
  state: ReturnCriterionState;
  source: string;
}

export interface ReturnCriteriaResult {
  criteria: ReturnCriterion[];
  metCount: number;
  total: number;
  /** Все критерии met → можно обсуждать следующую ступень (не авто-переход!). */
  allMet: boolean;
  /** Есть ли хоть один провал → ступень назад. */
  blocked: boolean;
  /** Что введено пользователем (для честной плашки «нет данных»). */
  filled: number;
  text: string;
  note: string;
}

/** Порог допустимой боли при нагрузке (≤5/10) и утром (<5/10) — Silbernagel 2007 / JOSPT. */
export const RETURN_PAIN_MAX_LOAD = 5;
export const RETURN_PAIN_MAX_MORNING = 4; // «<5» на следующее утро → 4 как максимум целых

const num = (v: unknown): number | null => {
  // null/undefined/'' — это «не введено», а НЕ 0: Number(null) === 0 и Number('') === 0,
  // из-за чего незаполненное поле читалось бы как «боль 0 → критерий met» (поймал UI-тест).
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function evaluateReturnToCriteria(input: ReturnCriteriaInput | null | undefined): ReturnCriteriaResult {
  const srcPain = 'Silbernagel 2007, PMID 17307888 · JOSPT Silbernagel Program';
  const srcPlyo = 'Silbernagel Program (критерии входа в плиометрику), PMC8364697';
  const srcStiff = 'Silbernagel 2007, PMID 17307888 (боль/скованность не растут от недели к неделе)';

  const load = num(input?.painDuringLoad);
  const morning = num(input?.painNextMorning);
  const stiff = input?.morningStiffness ?? null;
  const plyo = input?.plyoTolerated;

  const criteria: ReturnCriterion[] = [
    {
      id: 'pain_load',
      label: 'Боль при нагрузке',
      rule: `≤${RETURN_PAIN_MAX_LOAD}/10 во время работы с сухожилием`,
      state: load == null ? 'no_data' : load <= RETURN_PAIN_MAX_LOAD ? 'met' : 'not_met',
      source: srcPain,
    },
    {
      id: 'pain_next_morning',
      label: 'Боль на следующее утро',
      rule: `<${RETURN_PAIN_MAX_MORNING + 1}/10 к утру (то есть не вернулась к высокой)`,
      state: morning == null ? 'no_data' : morning < RETURN_PAIN_MAX_MORNING + 1 ? 'met' : 'not_met',
      source: srcPain,
    },
    {
      id: 'morning_stiffness',
      label: 'Утренняя скованность',
      rule: 'не растёт от недели к неделе',
      state: stiff == null ? 'no_data' : stiff === 'worse' ? 'not_met' : 'met',
      source: srcStiff,
    },
    {
      id: 'plyo',
      label: 'Плиометрика',
      rule: 'боль <5/10 на 10 двойных прыжках',
      state: plyo == null ? 'no_data' : plyo ? 'met' : 'not_met',
      source: srcPlyo,
    },
  ];

  const metCount = criteria.filter(c => c.state === 'met').length;
  const filled = criteria.filter(c => c.state !== 'no_data').length;
  const blocked = criteria.some(c => c.state === 'not_met');
  const allMet = filled === criteria.length && !blocked;

  const bad = criteria.filter(c => c.state === 'not_met').map(c => c.label);
  const text = allMet
    ? 'Все 4 критерия закрыты — можно обсуждать следующую ступень (переход остаётся за вами).'
    : blocked
      ? `Провал: ${bad.join(', ')} — по pain-monitoring это повод СНИЗИТЬ нагрузку / вернуться на предыдущую ступень.`
      : `Заполнено ${filled} из ${criteria.length} критериев. Пустые — это «нет данных», а не «всё хорошо».`;

  return {
    criteria, metCount, total: criteria.length, allMet, blocked, filled, text,
    note: 'Критерии — из pain-monitoring модели Silbernagel (Порог 5/10 — широко применяемая эвристика; '
      + 'точный отсечный пункт на большой выборке не валидировался). Это инструмент наблюдения, '
      + 'НЕ диагноз и НЕ автопереход: решение о нагрузке — с вами и врачом.',
  };
}
