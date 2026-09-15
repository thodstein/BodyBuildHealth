/**
 * lab-norms.engine.ts — Л8 (фаза 2 женского слоя): ЕДИНЫЙ резолвер лабораторных норм с учётом пола.
 *
 * Единый источник чисел (без дублирования таблиц):
 *  - базовые/мужские нормы — UCUM_MAP (core/constants) 1-в-1 (мужской путь байт-в-байт);
 *  - женские — LAB_REFERENCES_FEMALE (risk-engine-v7-matrix, §6.2) ×100 только для Hct:
 *    HCT 36–48, Hb 120–150, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ULN 31, креатинин ≤97, ферритин ≤200.
 *
 * Правило проекта: без sex/male getLabNorm возвращает ровно пару UCUM_MAP (lln/uln).
 */
import { UCUM_MAP } from '../core/constants';
import { LAB_REFERENCES_FEMALE } from './risk-engine-v7-matrix';

export interface LabNorm {
  lln: number;
  uln: number;
  unit: string;
  /** ♀ Норма взята из женского слоя (шейп строки «♀»). */
  female: boolean;
}

/** Достаёт запись UCUM_MAP без учёта регистра (как в LabsScreen). */
function ucumEntry(code: string): { prefUnit: string; uln: number; lln: number; name: string } | undefined {
  const raw = String(code || '').trim();
  if (!raw) return undefined;
  const map = UCUM_MAP as Record<string, any>;
  return map[raw.toUpperCase()] ?? map[raw] ?? map[raw.toLowerCase()] ??
    (Object.entries(map).find(([k]) => k.toLowerCase() === raw.toLowerCase())?.[1] as any);
}

/**
 * Женские границы отображения (единый источник — LAB_REFERENCES_FEMALE).
 * Hct в V7 хранится долей (0.36–0.48) — конвертируем ×100 в проценты UCUM.
 */
const FEMALE_SOURCE_CODES: Record<string, keyof typeof LAB_REFERENCES_FEMALE> = {
  HCT: 'Hct',
  HGB: 'Hb',
  RBC: 'RBC',
  ALT: 'ALT',
  AST: 'AST',
  GGT: 'GGT',
  CREATININE: 'Creatinine',
  FERRITIN: 'Ferritin',
};

export const FEMALE_LAB_BOUNDS: Record<string, { lln: number; uln: number }> = (() => {
  const out: Record<string, { lln: number; uln: number }> = {};
  for (const [code, src] of Object.entries(FEMALE_SOURCE_CODES)) {
    const ref = LAB_REFERENCES_FEMALE[src as string] as { uln?: number; lln?: number } | undefined;
    if (!ref || ref.uln === undefined) continue;
    const scale = code === 'HCT' ? 100 : 1;
    out[code] = {
      lln: Math.round(((ref.lln ?? 0) * scale) * 100) / 100,
      uln: Math.round((ref.uln * scale) * 100) / 100,
    };
  }
  return out;
})();

/** Есть ли у кода женские границы (для бейджа «♀»). */
export function hasFemaleLabBound(code: string): boolean {
  return !!FEMALE_LAB_BOUNDS[String(code || '').trim().toUpperCase()];
}

/**
 * Единый резолвер норм: без sex/male — UCUM_MAP байт-в-байт; female — женские границы.
 * Возвращает null, если код неизвестен.
 */
export function getLabNorm(code: string, sex?: 'male' | 'female'): LabNorm | null {
  const entry = ucumEntry(code);
  if (!entry) return null;
  if (sex === 'female') {
    const fem = FEMALE_LAB_BOUNDS[String(code || '').trim().toUpperCase()];
    if (fem) return { lln: fem.lln, uln: fem.uln, unit: entry.prefUnit || '', female: true };
  }
  return { lln: entry.lln, uln: entry.uln, unit: entry.prefUnit || '', female: false };
}

/** Л9: общая легенда женских порогов (показывается только при sex=female). */
export const FEMALE_LABS_NOTE =
  '♀ Пороги по полу: HCT 36–48%, Hb 120–150 г/л, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ≤31, креатинин ≤97, ферритин ≤200. ' +
  'Полные нормы — Поддержка → «Женщины и ААС» → Лабы.';

/** Л10: короткая строка-пометка для панелей/дневника (та же формулировка в 4 точках). */
export const FEMALE_LABS_TAB_NOTE =
  '♀ Женские пороги активны (профиль: женщина). Отклонения считаются по женским границам; полная таблица — Поддержка → «Женщины и ААС» → Лабы.';
