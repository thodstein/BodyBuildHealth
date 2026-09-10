/**
 * bb-return-to.engine.ts — PRO-3 R2: лёгкий return-to-план после стоп-флагов.
 *
 * Упрощённый parity ARM `buildRehabPlan`/return-to-pull: 3 ступени возврата
 * (техника → 50% → полный объём) при отсутствии боли. Скрининг, не реабилитация:
 * направление к врачу при stop уже даёт `bb-red-flags`. Чистый движок.
 */

export interface BbReturnToStage {
  stage: 1 | 2 | 3;
  title: string;
  volume: string;
  rir: string;
  note: string;
}

export interface BbReturnToPlan {
  stages: BbReturnToStage[];
  text: string;
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
      },
      {
        stage: 2,
        title: 'Недели 2–3 — половина объёма',
        volume: '50% объёма',
        rir: 'RIR+3',
        note: 'Только безболезненные движения, без отказа. Боль вернулась — назад на ступень 1.',
      },
      {
        stage: 3,
        title: 'Неделя 4 — полный возврат',
        volume: '100% объёма',
        rir: 'по плану',
        note: 'При 2 неделях без боли. Первая тяжёлая — без отказа.',
      },
    ],
    text: `Возврат после «${what}»: техника → 50% → полный объём за ~4 недели без боли`,
  };
}
