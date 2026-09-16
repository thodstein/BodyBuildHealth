/**
 * strength-sport-sm-log-window.engine.ts — ЛОГ: dip-окно под диаметр + поправка нагрузки (SM movement P4)
 *
 * Renals 2018 (JSCR, 65% 1RM): малый лог +6% мощность/+2% скорость/+5% импульс vs большой;
 * штанга выше обоих; dip у штанги глубже при той же длительности — большой диаметр крадёт
 * глубину (грудной прогиб + ЦМ назад). Хаб уже диагностирует дип 8–12см (diagnoseLogDip)
 * и классы диаметра (≤26/27–30/≥31). Этот движок: окно дипа под диаметр + поправка %1RM.
 *
 * Чистый движок, без UI/storage.
 */

import { logDiameterClass, type LogDiameterClass } from './strength-sport-sm-log-diameter.engine';

export interface SMLogWindowResult {
  valid: boolean;
  verdict: 'ok' | 'warn';
  dipWindowCm: [number, number];
  loadCorrPct: number; // поправка к рабочему весу, %
  text: string;
}

/** Окно дипа: большой лог мельче (грудной блок), малый — глубже. */
export function logDipWindowFor(diameterCm: number | null | undefined): [number, number] | null {
  const cls: LogDiameterClass | null = logDiameterClass(diameterCm);
  if (cls == null) return null;
  if (cls === 'large') return [7, 10];
  if (cls === 'small') return [9, 13];
  return [8, 12];
}

/** Поправка нагрузки: большой −3%, малый +2% к стандарту (Renals, ориентир). */
export function logLoadCorrectionPct(diameterCm: number | null | undefined): number | null {
  const cls = logDiameterClass(diameterCm);
  if (cls == null) return null;
  if (cls === 'large') return -3;
  if (cls === 'small') return 2;
  return 0;
}

export function diagnoseLogWindow(
  diameterCm: number | null | undefined,
  dipCm?: number | null,
): SMLogWindowResult | null {
  const win = logDipWindowFor(diameterCm);
  const corr = logLoadCorrectionPct(diameterCm);
  if (win == null || corr == null) return null;
  const d = dipCm != null && Number.isFinite(dipCm) && (dipCm as number) > 0 ? (dipCm as number) : null;
  let verdict: SMLogWindowResult['verdict'] = 'ok';
  let text = `Диаметр ${diameterCm}см: окно дипа ${win[0]}–${win[1]}см, нагрузка ${corr >= 0 ? '+' : ''}${corr}% (Renals 2018, ориентир)`;
  if (d != null) {
    if (d >= win[0] && d <= win[1]) text += ` — дип ${d}см в окне`;
    else { verdict = 'warn'; text += ` — дип ${d}см вне окна: SSB jerk-dip to pin 3×3`; }
  }
  return { valid: true, verdict, dipWindowCm: win, loadCorrPct: corr, text };
}
