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
