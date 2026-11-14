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

/**
 * ♀ Производные пороги, которых нет в таблицах норм. Единая точка для всех
 * поверхностей (уведомления, PDF для врача), чтобы ULN+4 и 2.5×ULN не
 * расползались литералами по файлам.
 *  - HCT: ULN — «терапия», ULN+4 — «ургент» (градация приложения);
 *  - АЛТ: 2.5× ULN — порог гепатотоксичности.
 */
export const FEMALE_HCT_THERAPY = getLabNorm('HCT', 'female')?.uln ?? 48;
export const FEMALE_HCT_URGENT = FEMALE_HCT_THERAPY + 4;
export const FEMALE_ALT_2_5_ULN = Math.round((getLabNorm('ALT', 'female')?.uln ?? 31) * 2.5);

/**
 * Пороги гематокрита — ОДНА шкала на всё приложение (проход 39, перенесено
 * сюда в проходе 43: резолвер норм — самое лёгкое место, его уже тянут
 * уведомления и PDF без поддержко-каталога).
 *  - `erythrocytosis` — начало эритроцитоза (♂ 51, ♀ 48 — верх нормы WADA);
 *  - `block` — порог флеботомии/отмены (Endocrine Society: ♂ >54%, ♀ >52%).
 * Градация калькулятора (`hctCuts`), баннер, уведомления и PDF считают от
 * этих чисел, а не от литералов.
 */
export const HCT_THRESHOLDS = {
  male: { erythrocytosis: 51, block: 54 },
  female: { erythrocytosis: FEMALE_HCT_THERAPY, block: FEMALE_HCT_URGENT },
} as const;

/**
 * Пороги гемоглобина (г/л) — пара к `HCT_THRESHOLDS`: тот же эритроцитоз, та же
 * шкала «верх нормы → флеботомия/отмена».
 *  - `upper` — верх нормы: из резолвера (♂ 170, ♀ 150), а не литерал;
 *  - `block` — порог вмешательства: ♂ 185 (Endocrine Society: HCT >54% ≈ Hb 18.5 г/дл),
 *    ♀ 165 (женский протокол: «>165 → флеботомия + отмена», `supportProtocolWomenData`).
 *
 * Зачем: таблицы мониторинга (`LAB_MONITOR_DB`) и протоколы печатали только
 * мужское «<170 г/л» — женщина читала порог, к ней не относящийся (её 150).
 */
export const HGB_THRESHOLDS = {
  male: { upper: getLabNorm('HGB', 'male')?.uln ?? 170, block: 185 },
  female: { upper: getLabNorm('HGB', 'female')?.uln ?? 150, block: 165 },
} as const;

/**
 * Пороги печёночных трансаминаз (Ед/л) — пара к `HCT_THRESHOLDS`/`HGB_THRESHOLDS`:
 * у женщины ВГН ниже (31), а таблицы мониторинга и системные панели печатали
 * мужские «<40 Ед/л» как общий порог. Женщина с АЛТ 35 читала «норма», хотя её
 * ВГН — 31.
 *  - `male`/`female` — верх нормы из резолвера полов (`FEMALE_LAB_BOUNDS`);
 *  - кратные ступени (2×/3×/5×ВГН) считаются от своего пола, а не от литерала.
 */
export const LFT_ULN = {
  ALT: { male: getLabNorm('ALT', 'male')?.uln ?? 40, female: getLabNorm('ALT', 'female')?.uln ?? 31 },
  AST: { male: getLabNorm('AST', 'male')?.uln ?? 40, female: getLabNorm('AST', 'female')?.uln ?? 31 },
} as const;

/** ВГН трансаминазы с обоими полами: «♂ <40 / ♀ <31». Одна формулировка на всё приложение. */
export function lftUlnText(marker: 'ALT' | 'AST'): string {
  const t = LFT_ULN[marker];
  return `♂ <${t.male} / ♀ <${t.female}`;
}

/** Л9: общая легенда женских порогов (показывается только при sex=female). */
export const FEMALE_LABS_NOTE =
  '♀ Пороги по полу: HCT 36–48%, Hb 120–150 г/л, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ≤31, креатинин ≤97, ферритин ≤200. ' +
  'Полные нормы — Поддержка → «Женщины и ААС» → Лабы.';

/** Л10: короткая строка-пометка для панелей/дневника (та же формулировка в 4 точках). */
export const FEMALE_LABS_TAB_NOTE =
  '♀ Женские пороги активны (профиль: женщина). Отклонения считаются по женским границам; полная таблица — Поддержка → «Женщины и ААС» → Лабы.';
