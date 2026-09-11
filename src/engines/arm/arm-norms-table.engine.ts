/**
 * arm-norms-table.engine.ts — нормы по классу (PRO-3 P3).
 * Без выдуманных чисел: только WAF-классы 2025 (Senior М11/Ж8 + Masters/Junior/Youth сетки
 * из официального PDF WAF) + существующие WR-ориентиры (`arm-platform`, `arm-force-capture`).
 * Side/Back %bw и бенчмарки — внутренние ориентиры хаба, маркируются как `internal:true`.
 */
import { platformWrFor } from './arm-platform.engine';
import { getRtWorldClass } from './arm-force-capture.engine';

export const WAF_CLASSES_MALE = [55, 60, 65, 70, 75, 80, 85, 90, 100, 110] as const;
export const WAF_CLASSES_FEMALE = [50, 55, 60, 65, 70, 80, 90] as const;

export interface WafClassInfo {
  /** '85' или '110+' / '90+'. */
  cls: string;
  /** Верхняя граница класса (кг) или null для открытой. */
  limit: number | null;
  /** Кг до следующей границы (сгонка/набор) или null в открытой. */
  toNext: number | null;
  /** Полная строка класса: 'М-85' / 'Ж-65'. */
  label: string;
}

function isFemale(sex?: string): boolean {
  return (sex || '').toLowerCase() === 'female';
}

/** Класс WAF по весу и полу (Senior; Masters/Junior/Youth — те же границы, свой зачёт). */
export function wafClassFor(bwKg: number, sex?: string): WafClassInfo {
  const bw = Number.isFinite(bwKg) && bwKg > 30 ? bwKg : 80;
  const fem = isFemale(sex);
  const classes: readonly number[] = fem ? WAF_CLASSES_FEMALE : WAF_CLASSES_MALE;
  const tag = fem ? 'Ж' : 'М';
  for (const c of classes) {
    if (bw <= c) {
      const toNext = Math.round((c - bw) * 10) / 10;
      return { cls: String(c), limit: c, toNext: toNext > 0 ? toNext : 0, label: `${tag}-${c}` };
    }
  }
  const open = classes[classes.length - 1];
  return { cls: `${open}+`, limit: null, toNext: null, label: `${tag}-${open}+` };
}

export interface ArmliftNorm {
  implement: string;
  /** Мировой ориентир (кг) или null (Excalibur — классовая таблица SAR, к числу не сводится). */
  wrKg: number | null;
  /** Подпись-источник для UI. */
  source: string;
  /** true → внутренний ориентир хаба, не норма федерации. */
  internal: boolean;
}

/** Нормы снарядов армлифтинга по полу (через существующий PLATFORM_WR + RT-канон). */
export function armliftNormsFor(sex?: string): ArmliftNorm[] {
  const sx = isFemale(sex) ? 'female' : 'male';
  return [
    { implement: 'rolling_thunder', wrKg: getRtWorldClass(sx), source: 'IronMind WR', internal: false },
    { implement: 'apollon_axle', wrKg: platformWrFor('apollon_axle', sx), source: 'Apollon WR', internal: false },
    { implement: 'saxon_bar', wrKg: platformWrFor('saxon_bar', sx), source: 'Saxon-ориентир', internal: true },
    { implement: 'pinch_block', wrKg: null, source: 'норма 10 с (внутренний ориентир)', internal: true },
    { implement: 'excalibur', wrKg: null, source: 'норматив SAR по весовой (ред. 01.07.2025)', internal: false },
  ];
}

/** % от WR (null — нет числового ориентира). */
export function normPct(valueKg: number, wrKg: number | null): number | null {
  if (!Number.isFinite(valueKg) || valueKg <= 0 || wrKg == null || wrKg <= 0) return null;
  return Math.round((valueKg / wrKg) * 1000) / 10;
}
