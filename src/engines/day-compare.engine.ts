/**
 * day-compare.engine.ts — сравнение «день vs день» (доп. функция 11).
 *
 * Сопоставляет два дневных отчёта (DailyDietReport): калории, DIAAS, гликемическая
 * нагрузка, микро-дефициты и флаги. Возвращает дельты, «лучший» день и подсказку.
 */
import type { DailyDietReport } from './product-usefulness-v2.engine';

export interface DayCompareResult {
  kcalDelta: number;
  diaasDelta: number;
  giLoadDelta: number;
  microDeficitDelta: number;
  flagDelta: number;
  betterDay: 0 | 1 | 'equal';
  rationale: string;
}

const countFlags = (r: DailyDietReport): number => {
  let n = 0;
  if (r.giLoadWarning) n++;
  if (r.ammoniaRisk) n++;
  if (r.electrolyteRisk) n++;
  if (r.insulinRicohet) n++;
  if (r.cortisolRisk) n++;
  if (r.pralWarning === 'Закисление') n++;
  if (r.homaIr !== null && r.homaIr > 2.5) n++;
  if (!r.mtorTriggered) n++;
  return n;
};

export function compareDays(a: DailyDietReport, b: DailyDietReport): DayCompareResult {
  const kcalDelta = Math.round(a.totalKcal - b.totalKcal);
  const diaasDelta = Math.round((a.diaas - b.diaas) * 100) / 100;
  const giLoadDelta = Math.round(a.giLoad - b.giLoad);
  const microDeficitDelta = a.microDeficits.length - b.microDeficits.length;
  const flagDelta = countFlags(a) - countFlags(b);

  // качество: выше DIAAS + ниже дефициты/флаги → лучше
  const scoreA = a.diaas * 2 - countFlags(a) * 1.5 - a.microDeficits.length * 0.5;
  const scoreB = b.diaas * 2 - countFlags(b) * 1.5 - b.microDeficits.length * 0.5;
  const betterDay: DayCompareResult['betterDay'] = scoreA > scoreB + 0.01 ? 0 : scoreB > scoreA + 0.01 ? 1 : 'equal';

  const rationale = `Калории: ${kcalDelta >= 0 ? '+' : ''}${kcalDelta} ккал · DIAAS: ${diaasDelta >= 0 ? '+' : ''}${diaasDelta} · GL: ${giLoadDelta >= 0 ? '+' : ''}${giLoadDelta} · Дефициты: ${microDeficitDelta >= 0 ? '+' : ''}${microDeficitDelta} · Флаги: ${flagDelta >= 0 ? '+' : ''}${flagDelta}. Лучше: ${betterDay === 0 ? 'день 1' : betterDay === 1 ? 'день 2' : 'равны'}.`;

  return { kcalDelta, diaasDelta, giLoadDelta, microDeficitDelta, flagDelta, betterDay, rationale };
}
