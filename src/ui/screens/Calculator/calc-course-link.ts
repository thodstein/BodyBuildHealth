// calc-course-link.ts — P2-Д12 аудита: единый маппер «активный курс → AAS-патч».
// Раньше логика была продублирована в AutoCalculator (эффект монтирования и «Фарма курс»);
// чистая функция покрыта юнит-тестами, оба пути дают одинаковый патч.
import { PHARMA_DB } from '../../../core/pharma-database';

export interface CourseLinkedEntry {
  substanceId: string;
  doseValue?: number | string;
  frequency?: number | string;
  startWeek?: number;
  endWeek?: number;
}

export interface CourseAasRow {
  id: string;
  doseMgWeek: number;
  weeks: number;
  startWeek: number;
  endWeek: number;
}

export interface CourseLinkFlags {
  hasHCG: boolean;
  hasAI: boolean;
  hasSERM: boolean;
  hasCaber: boolean;
  hasGH: boolean;
  hasIGF: boolean;
  hasInsulin: boolean;
  hasSARMs: boolean;
  hasMGF: boolean;
}

export interface CourseLinkPatch {
  aas: CourseAasRow[];
  flags: CourseLinkFlags;
  doses: { ghIU: number; insulinIU: number; igfMcg: number; clenMcg: number; t3Mcg: number };
}

// AAS/SARM/пептиды из PHARMA_DB + препараты без записи в PHARMA_DB (HCG/AI/SERM/caberg/clen/T3/GH/инсулин/IGF/MGF).
const AAS_CLASSES = [
  'testosterone', 'nandrolone', 'trenbolone', 'oral_17aa', 'dht', 'dht_inject', 'dht_derivative', 'sarm',
  'drostanolone', 'boldenone', 'primobolan', 'peptide_ghrh', 'peptide_ghrp', 'peptide_gnrh',
  'peptide_fat_loss', 'peptide_other', 'igf1', 'mgf', 'insulin',
];
const EXTRA_IDS = new Set([
  'hcg', 'caberg', 'cabergoline',
  'anastrozole', 'anastro', 'letrozole', 'exemestane',
  'tamoxifen', 'clomiphene', 'enclomiphene',
  'clenbuterol', 'clen', 't3', 'liothyronine',
  'somatropin', 'hgh', 'gh',
  'ins_short', 'ins_long', 'ins_aspart', 'ins_detemir',
  'igf1_lr3', 'igf1_des', 'mgf',
]);
const INSULIN_IDS = ['ins_short', 'ins_long', 'ins_aspart', 'ins_detemir'];
const SARM_IDS = ['ostarine', 'lgd', 'rad140', 's23', 'andarine'];

/** Частота приёма из строки («2x/wk», «2/нед», «3») → число инъекций в неделю (мин. 1). */
export function courseFrequency(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, value);
  const match = String(value ?? '').match(/\d+(?:[.,]\d+)?/);
  return match ? Math.max(1, Number(match[0].replace(',', '.'))) : 1;
}

/**
 * Единый маппер курса. null — нет валидных записей (пустой/битый список).
 * Доза AAS — мг/нед (доза × частота); недели клампятся ≥1 (UI и так не даёт start≥end).
 */
export function deriveCourseLinkPatch(courseLinked: CourseLinkedEntry[] | undefined | null): CourseLinkPatch | null {
  if (!Array.isArray(courseLinked) || courseLinked.length === 0) return null;
  const linkedAas: CourseAasRow[] = courseLinked
    .filter(c => c && typeof c.substanceId === 'string')
    .filter(c => {
      const ph = PHARMA_DB[c.substanceId];
      if (ph?.class && AAS_CLASSES.includes(ph.class)) return true;
      return EXTRA_IDS.has(c.substanceId.toLowerCase());
    })
    .map(c => ({
      id: c.substanceId,
      doseMgWeek: (Number(c.doseValue) || 0) * courseFrequency(c.frequency),
      weeks: Math.max(1, (Number(c.endWeek) || 12) - (Number(c.startWeek) || 0)),
      startWeek: Number(c.startWeek) || 1,
      endWeek: Number(c.endWeek) || 12,
    }));
  if (linkedAas.length === 0) return null;

  const ids = new Set(courseLinked.map(c => c.substanceId));
  const flags: CourseLinkFlags = {
    hasHCG: ids.has('hcg'),
    hasAI: ['anastrozole', 'anastro', 'letrozole', 'exemestane'].some(id => ids.has(id)),
    hasSERM: ['tamoxifen', 'clomiphene', 'enclomiphene'].some(id => ids.has(id)),
    hasCaber: ids.has('caberg') || ids.has('cabergoline'),
    hasGH: ids.has('somatropin') || ids.has('hgh') || ids.has('gh'),
    hasIGF: ids.has('igf1_lr3') || ids.has('igf1_des'),
    hasInsulin: INSULIN_IDS.some(id => ids.has(id)),
    hasSARMs: SARM_IDS.some(id => ids.has(id)),
    hasMGF: ids.has('mgf'),
  };

  let ghIU = 0, insulinIU = 0, igfMcg = 0, clenMcg = 0, t3Mcg = 0;
  for (const c of courseLinked) {
    const dose = Number(c.doseValue) || 0;
    const id = c.substanceId;
    if (id === 'somatropin' || id === 'hgh' || id === 'gh') ghIU += dose;
    if (INSULIN_IDS.includes(id)) insulinIU += dose;
    if (id === 'igf1_lr3' || id === 'igf1_des') igfMcg += dose;
    if (id === 'clenbuterol' || id === 'clen') clenMcg += dose;
    if (id === 't3' || id === 'liothyronine') t3Mcg += dose;
  }

  return { aas: linkedAas, flags, doses: { ghIU, insulinIU, igfMcg, clenMcg, t3Mcg } };
}
