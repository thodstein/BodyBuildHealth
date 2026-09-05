/**
 * arm-tendon-fuel.engine.ts — TOP T6a: tendon-топливо (тайминг, не рацион).
 *
 * Источник: StrengthLog (коллаген 15г + VitC за 30–60 мин до нагрузки —
 * синтез коллагена связок; белок 2.2 г/кг для арм). Рацион — reuse
 * IndividualPlan, здесь только престол-тайминг + гидратация.
 * Чистый модуль.
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
    'Коллаген 15г + VitC 200мг за 30–60 мин до стола/тяжёлого хвата.',
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
