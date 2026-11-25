/**
 * lab-reference-presets.ts — референсы лабораторий РФ для ручного ввода анализов.
 *
 * Зачем: бланк главнее расчёта. Одна и та же цифра судится по-разному в разных
 * лабораториях (магний 0.66–1.07 и 0.75–1.0 — обе нормы, но разных лет и наборов),
 * поэтому у человека должен быть выбор источника границ:
 *   1) норма приложения (`UCUM_MAP` / `getLabNorm`) — как было;
 *   2) пресет лаборатории — только там, где число взято со страницы этой
 *      лаборатории и записаны код теста и URL (ни одного «примерно»);
 *   3) границы из бланка — два числа, которые человек переписал из своей распечатки.
 *
 * Пресеты намеренно неполные: пустой пресет честнее выдуманного числа. Если для
 * лаборатории чисел нет, интерфейс говорит «пресетов нет — введите границы из
 * бланка», а не подставляет норму приложения под именем лаборатории.
 *
 * Числа (взяты 2026-11-25 со страниц лаборатории, проверяемые цитаты — в `source`):
 *  - ПТГ: «19–110 лет 12–88 пг/мл» — helix.ru/kb/item/08-033
 *  - ОЖСС: «45,3 – 77,1 мкмоль/л» — helix.ru/kb/item/06-018
 *  - Трансферрин: «2 – 3,6 г/л» — helix.ru/kb/item/06-040
 *  - Калий: «3,5–5,1 ммоль/л» — helix.ru/kb/item/06-064
 *  - Кальций общий: «18–60 лет 2,15 – 2,5 ммоль/л» — helix.ru/kb/item/06-020
 */

import { tierMarkerKey } from './lab-tier-ranges';

/** Лаборатории, для которых заведён хотя бы один пресет. */
export type LabId = 'helix' | 'invitro' | 'kdl' | 'cmd';

/** Источник границ, выбранный на поле бланка. */
export type RefSource = 'app' | 'blank' | LabId;

export interface LabSourceInfo {
  id: LabId;
  label: string;
  /** Что человек увидит, если для этой лаборатории чисел нет. */
  note: string;
}

export const LAB_SOURCES: LabSourceInfo[] = [
  { id: 'helix', label: 'Хеликс', note: 'пресеты по страницам helix.ru' },
  { id: 'invitro', label: 'ИНВИТРО', note: 'пресетов нет — введите границы из бланка' },
  { id: 'kdl', label: 'КДЛ', note: 'пресетов нет — введите границы из бланка' },
  { id: 'cmd', label: 'CMD', note: 'пресетов нет — введите границы из бланка' },
];

export interface LabPresetRow {
  /** Нижняя граница референса в единице `unit`. */
  lln: number;
  /** Верхняя граница референса в единице `unit`. */
  uln: number;
  /** Единица, в которой напечатаны границы. */
  unit: string;
  /** Код теста и цитата страницы — печатается рядом с выбором. */
  source: string;
  sourceUrl: string;
  /** Ограничение применимости (возраст, пол), если числа не общие. */
  note?: string;
}

export const LAB_REFERENCE_PRESETS: Record<LabId, Record<string, LabPresetRow>> = {
  helix: {
    // Код каталога — `PARATHYROID` (15–65 пг/мл). Бланки печатают «ПТГ/PTH»,
    // а норма приложения от пресета отличается: Хеликс для взрослых 19–110 лет
    // даёт 12–88 пг/мл. Хеликс выбран потому, что его границы шире и он покрывает
    // верх, который приложение обрезало бы как «выше нормы».
    PARATHYROID: {
      lln: 12,
      uln: 88,
      unit: 'pg/mL',
      source: 'Хеликс 08-033 · «19–110 лет 12–88 пг/мл»',
      sourceUrl: 'https://helix.ru/kb/item/08-033',
      note: 'взрослые 19–110 лет',
    },
    TIBC: {
      lln: 45.3,
      uln: 77.1,
      unit: 'umol/L',
      source: 'Хеликс 06-018 · «Референсные значения: 45,3 – 77,1 мкмоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-018',
    },
    TRANSFERRIN: {
      lln: 2,
      uln: 3.6,
      unit: 'g/L',
      source: 'Хеликс 06-040 · «Референсные значения: 2 – 3,6 г/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-040',
    },
    POTASSIUM: {
      lln: 3.5,
      uln: 5.1,
      unit: 'mmol/L',
      source: 'Хеликс 06-064 · «Референсные значения: 3,5–5,1 ммоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-064',
    },
    CALCIUM: {
      lln: 2.15,
      uln: 2.5,
      unit: 'mmol/L',
      source: 'Хеликс 06-020 · «18–60 лет 2,15 – 2,5 ммоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-020',
      note: '18–60 лет; 60–90 лет верх 2,55',
    },
  },
  invitro: {},
  kdl: {},
  cmd: {},
};

/**
 * Написание бланка → код каталога, когда коды расходятся.
 *
 * `PTH` — так подписано поле формы и так печатают бланки, а в каталоге запись
 * называется `PARATHYROID`. Без перевода выбор пресета на поле «PTH» молча
 * отвечал бы «пресета нет», хотя число есть.
 */
const PRESET_CODE_ALIAS: Record<string, string> = { PTH: 'PARATHYROID' };

/** Лаборатории, у которых есть хотя бы один пресет (для списка выбора). */
export function labsWithPresets(): LabId[] {
  return (Object.keys(LAB_REFERENCE_PRESETS) as LabId[]).filter(
    (id) => Object.keys(LAB_REFERENCE_PRESETS[id]).length > 0,
  );
}

/** Пресет лаборатории для кода маркера; `null` — пресета нет. */
export function labPreset(lab: LabId | null | undefined, code: string): LabPresetRow | null {
  if (!lab) return null;
  const table = LAB_REFERENCE_PRESETS[lab];
  if (!table) return null;
  // Человек вводит код так, как он напечатан в бланке: «K», «ОЖСС», «PTH».
  // Пресеты подписаны канонами каталога (`POTASSIUM`), поэтому написание
  // приводится тем же правилом, что и шкалы ступеней, — иначе пресет молча
  // «не находится» на самом частом написании.
  const raw = String(code || '')
    .trim()
    .toUpperCase();
  if (!raw) return null;
  const canon = PRESET_CODE_ALIAS[raw] ?? raw;
  return table[canon] ?? table[tierMarkerKey(canon)] ?? null;
}

/**
 * Единицы считаются одной величиной, если совпадают после нормализации записи
 * (`µmol/L` = `umol/L` = `мкмоль/л`). Отдельная копия правила не нужна: интерфейс
 * сравнивает то же, что и чтение бланка.
 */
function unitKey(u: string): string {
  return String(u || '')
    .toLowerCase()
    .replace(/μ|µ/g, 'u')
    .replace(/мкмоль\/л/g, 'umol/l')
    .replace(/ммоль\/л/g, 'mmol/l')
    .replace(/г\/л/g, 'g/l')
    .replace(/пг\/мл/g, 'pg/ml')
    .replace(/\s+/g, '');
}

export type PresetCheck =
  { ok: true; lln: number; uln: number; unit: string; source: string; note?: string } | { ok: false; reason: string };

/**
 * Можно ли применить пресет к введённому значению.
 *
 * Единица введённого числа — часть данных: пресет в другой единице не пересчитывается
 * молча. Нет единицы — пресет её и подставит (это лучше, чем гадать).
 */
export function presetForEntry(code: string, lab: LabId | null | undefined, unit: string): PresetCheck {
  const preset = labPreset(lab, code);
  if (!preset) {
    const source = LAB_SOURCES.find((s) => s.id === lab);
    return {
      ok: false,
      reason: source
        ? `пресета ${source.label} для кода ${String(code || '').toUpperCase()} нет — введите границы из бланка`
        : 'пресета нет — введите границы из бланка',
    };
  }
  const entered = unitKey(unit);
  if (entered && entered !== unitKey(preset.unit)) {
    return {
      ok: false,
      reason: `единица бланка (${unit}) не совпадает с единицей пресета (${preset.unit}) — введите границы из бланка`,
    };
  }
  return {
    ok: true,
    lln: preset.lln,
    uln: preset.uln,
    unit: preset.unit,
    source: preset.source,
    note: preset.note,
  };
}

export type BlankRange = { ok: true; refLow: number; refHigh: number } | { ok: false; reason: string };

/**
 * Границы, переписанные из бланка. Интервал — это два числа: одна граница не
 * интервал, и «нижней нет» нельзя подменять нулём.
 */
export function blankRange(lo: string, hi: string): BlankRange {
  const parse = (v: string): number | null => {
    const t = String(v ?? '')
      .trim()
      .replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const l = parse(lo);
  const h = parse(hi);
  if (l === null && h === null) return { ok: false, reason: 'введите обе границы из бланка' };
  if (l === null || h === null) return { ok: false, reason: 'нужны обе границы: нижняя и верхняя' };
  if (!(l < h)) return { ok: false, reason: 'нижняя граница должна быть меньше верхней' };
  return { ok: true, refLow: l, refHigh: h };
}

/** Подпись выбранного источника для карточки анализа. */
export function refSourceLabel(source: RefSource, code: string): string {
  if (source === 'app') return 'норма приложения';
  if (source === 'blank') return 'границы из бланка';
  const preset = labPreset(source, code);
  const lab = LAB_SOURCES.find((s) => s.id === source);
  return preset ? `${lab?.label ?? source} · ${preset.source}` : `${lab?.label ?? source} (пресета нет)`;
}
