/**
 * arm-tendon-fuel.engine.ts — TOP T6a: tendon-топливо (тайминг, не рацион).
 *
 * Источник: Shaw G et al., Am J Clin Nutr 2017;105(1):136–143 (PMID 27852613) —
 * 15 г желатина с витамином C за ~1 ч до интермиттирующей нагрузки удваивали
 * PINP (синтез коллагена I). Точная доза витамина C в абстракте не указана —
 * 200 мг ниже верхнего безопасного уровня и помечены как практическая доза,
 * а не как цифра из исследования. Белок 2.2 г/кг — практика StrengthLog для арм.
 */

export interface TendonFuelInput {
  bodyWeightKg?: number;
  tableSession?: boolean; // сегодня стол/тяжёлый хват
  proteinPerKg?: number;
}

export interface TendonFuelPlan {
  collagenG: number;
  vitCMg: number;
  timingMin: string;
  proteinTargetG: number;
  hydrationL: number;
  checklist: string[];
  note: string;
}

export function buildTendonFuel(input: TendonFuelInput = {}): TendonFuelPlan {
  const bw = Number(input.bodyWeightKg ?? 80);
  const bwSafe = Number.isFinite(bw) && bw > 30 && bw < 250 ? bw : 80;
  const ppk = Number(input.proteinPerKg ?? 2.2);
  const ppkSafe = Number.isFinite(ppk) && ppk > 0 ? ppk : 2.2;
  const proteinTargetG = Math.round(bwSafe * ppkSafe);
  const hydrationL = Math.round((bwSafe * 0.04 + (input.tableSession ? 0.5 : 0)) * 10) / 10;
  const checklist = [
    'Коллаген/желатин 15 г + витамин C за ~60 мин до стола/тяжёлого хвата (Shaw 2017, PMID 27852613).',
    `Белок ${proteinTargetG}г/день (${ppkSafe} г/кг) — синтез связок идёт на профиците белка.`,
    `Вода ≈${hydrationL}л/день (+0.5л в день стола).`,
  ];
  if (ppkSafe < 1.6) checklist.push('Белок <1.6 г/кг — штраф синтезу коллагена, поднять.');
  return {
    collagenG: 15,
    vitCMg: 200,
    timingMin: '30–60 мин до',
    proteinTargetG,
    hydrationL,
    checklist,
    note: input.tableSession
      ? `Стол сегодня: коллаген 15г+VitC за 30–60 мин + белок ${proteinTargetG}г + вода ${hydrationL}л.`
      : `База: белок ${proteinTargetG}г/день, вода ${hydrationL}л; коллаген — только в дни стола/хвата.`,
  };
}
