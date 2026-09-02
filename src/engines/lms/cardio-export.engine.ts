/**
 * cardio-export.engine.ts — вынос экспортов из god-file cardio.engine.ts (Epic H, B1).
 * Единый слой экспорта: ICS / TCX / ZWO / Print / Text.
 * cardio.engine.ts re-export остаётся для обратной совместимости.
 */
export {
  buildCardioIcs,
  buildCardioTcx,
  buildCardioZwo,
  buildCardioPrintHtml,
  buildCardioSummaryText,
} from './cardio.engine';
