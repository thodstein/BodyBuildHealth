/**
 * support-hub-aas-timing.engine.ts — AAS-тайминг отдельной зоной.
 * Калькулятор поддержки не тронут. Чистые функции, без UI.
 *
 * Строго из данных PHARMA_DB: pk.halfLifeHours + dosageRange.frequency
 * (через getPharmaDetail) + specialInstructions verbatim. Новых чисел ноль:
 * частоты — явная эвристика по T½ с подписью «ориентир, не назначение».
 * Дисклеймер снижения вреда — в AAS_TIMING_DISCLAIMER.
 */

export type AasRoute = 'inject' | 'oral' | 'other';

const INJECT_CLASSES = new Set([
  'testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'primobolan',
  'drostanolone', 'dht_inject',
  'peptide_ghrh', 'peptide_ghrp', 'peptide_gnrh', 'peptide_fat_loss', 'peptide_other',
  'igf1', 'mgf', 'gh', 'insulin', 'glp1',
]);

const ORAL_CLASSES = new Set([
  'oral_17aa', 'sarm', 'sarm_s23', 'sarms',
  'dht_derivative', 'clenbuterol', 'thyroid',
]);

export const AAS_TIMING_DISCLAIMER =
  'Информация снижения вреда, не назначение. Частоты — ориентир по периоду полувыведения из базы; дозы и схемы — только врач и канон курса. Оральные 17aa гепатотоксичны: контроль АЛТ/АСТ, без алкоголя.';

export function aasRouteOf(cls: string, routeField?: unknown): AasRoute {
  if (Array.isArray(routeField)) {
    const r = routeField.map(String).join(' ').toLowerCase();
    if (/inject|injection|injek|в\/м|п\/к|sc\b|intramuscular|subcutaneous/.test(r)) return 'inject';
    if (/oral|peror|внутрь|табл|капс|perorally/.test(r)) return 'oral';
  } else if (typeof routeField === 'string') {
    const r = routeField.toLowerCase();
    if (/inject|injek|в\/м|п\/к|\bsc\b|intramuscular|subcutaneous/.test(r)) return 'inject';
    if (/oral|peror|внутрь|табл|капс/.test(r)) return 'oral';
  }
  const c = (cls || '').toLowerCase();
  if (INJECT_CLASSES.has(c)) return 'inject';
  if (ORAL_CLASSES.has(c)) return 'oral';
  return 'other';
}

export interface AasFrequency {
  label: string;
  detail: string;
}

/**
 * Ориентир частоты по T½ (явная эвристика: интервал короче T½ для ровного фона).
 * null T½ = данных нет, только частота из справочника/назначения.
 */
export function suggestAasFrequency(tHalfHours: number | null | undefined, route: AasRoute): AasFrequency {
  if (route === 'oral') {
    return {
      label: '2 приёма в день с едой',
      detail: 'Оральные формы с коротким T½: суточную дозу делят на утро/вечер с едой (ЖКТ-переносимость). 17aa — плюс контроль печени.',
    };
  }
  if (route !== 'inject') {
    return {
      label: 'По справочнику',
      detail: 'Путь введения не инъекционный/оральный — частота только из dosageRange базы или назначения.',
    };
  }
  if (tHalfHours === null || tHalfHours === undefined || !Number.isFinite(tHalfHours) || tHalfHours <= 0) {
    return {
      label: 'По справочнику',
      detail: 'T½ в базе нет — ориентира по периоду полувыведения нет, только частота из справочника/назначения.',
    };
  }
  const h = tHalfHours;
  if (h < 24) return { label: 'ED (ежедневно)', detail: `T½ ≈ ${fmtHalfLife(h)}: короткие эфиры требуют ежедневных инъекций для ровного фона.` };
  if (h < 72) return { label: 'EOD (через день)', detail: `T½ ≈ ${fmtHalfLife(h)}: интервал через день держит пик/впадину узкими.` };
  if (h < 168) return { label: 'EOD – 2×/нед', detail: `T½ ≈ ${fmtHalfLife(h)}: через день либо дважды в неделю.` };
  if (h < 336) return { label: '2×/нед', detail: `T½ ≈ ${fmtHalfLife(h)}: дважды в неделю (напр. пн/чт).` };
  return { label: '1–2×/нед', detail: `T½ ≈ ${fmtHalfLife(h)}: длинные эфиры держат фон неделю и дольше.` };
}

export function fmtHalfLife(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '—';
  if (h < 48) return `${Math.round(h)} ч`;
  const d = h / 24;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} дн`;
}

export interface AasTimingInfo {
  id: string;
  name: string;
  cls: string;
  route: AasRoute;
  halfLifeHours: number | null;
  dbFrequency: string | null;
  suggested: string;
  suggestedDetail: string;
  splitNote: string | null;
  instructions: string[];
  hasData: boolean;
}

export function aasTimingFor(input: {
  id: string;
  name: string;
  cls: string;
  routeField?: unknown;
  tHalfHours?: number | null;
  dbFrequency?: string | null;
  instructions?: string[];
}): AasTimingInfo {
  const route = aasRouteOf(input.cls, input.routeField);
  const half = typeof input.tHalfHours === 'number' && Number.isFinite(input.tHalfHours) && input.tHalfHours > 0
    ? input.tHalfHours
    : null;
  const freq = suggestAasFrequency(half, route);
  const instructions = Array.isArray(input.instructions) ? input.instructions.filter(s => typeof s === 'string' && s.trim()) : [];
  const splitNote = route === 'oral'
    ? 'Суточную дозу — на 2 приёма (утро/вечер) с едой.'
    : null;
  return {
    id: input.id,
    name: input.name,
    cls: input.cls,
    route,
    halfLifeHours: half,
    dbFrequency: input.dbFrequency || null,
    suggested: freq.label,
    suggestedDetail: freq.detail,
    splitNote,
    instructions: instructions.slice(0, 4),
    hasData: half !== null || !!input.dbFrequency || instructions.length > 0,
  };
}
