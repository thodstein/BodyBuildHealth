/**
 * course-sync.ts — чистые функции синхронизации course_log → profile.currentSubstances.
 * Вынесены из data-link.ts для тестируемости без React/IndexedDB/risk-engine зависимостей.
 */
import type { CourseEntry, PharmaSubstanceEntry } from './types';
import { PHARMA_DB } from './pharma-database';

/** Маппинг CourseEntry[] (course_log) → PharmaSubstanceEntry[] (profile.currentSubstances). */
export function mapCourseToSubstances(course: CourseEntry[]): PharmaSubstanceEntry[] {
  return course
    .filter(c => c && typeof c.substanceId === 'string' && c.substanceId.length > 0)
    .map(c => {
      const meta = PHARMA_DB[c.substanceId];
      const isOral = meta?.pk?.bioavailability !== undefined && meta.pk.bioavailability < 0.9 && !meta.esters?.length;
      return {
        id: c.substanceId,
        name: meta?.name ?? c.substanceId,
        doseMg: Number.isFinite(Number(c.doseValue)) ? Number(c.doseValue) : 0,
        unit: c.doseUnit || (meta?.class === 'insulin' || c.substanceId === 'hcg' ? 'IU' :
                             c.substanceId === 'igf1_lr3' || c.substanceId === 'mgf' ? 'mcg' : 'mg'),
        route: (isOral || c.substanceId === 'hcg' ? 'oral' : 'inject') as 'inject' | 'oral',
        startWeek: Number.isFinite(Number(c.startWeek)) ? Number(c.startWeek) : 0,
        endWeek: Number.isFinite(Number(c.endWeek)) ? Number(c.endWeek) : 12,
      };
    });
}

/** Проверяет, есть ли новые/удалённые вещества в course_log по сравнению с currentSubstances. */
export function hasCourseDiff(course: CourseEntry[], currentSubstances: PharmaSubstanceEntry[]): boolean {
  if (!Array.isArray(course) || course.length === 0) return false;
  const existingIds = new Set(currentSubstances.map(s => s.id));
  const courseIds = new Set(course.map(c => c.substanceId));
  const hasNew = course.some(c => !existingIds.has(c.substanceId));
  const hasRemoved = currentSubstances.some(s => !courseIds.has(s.id));
  return hasNew || hasRemoved;
}

/** Вывод PED-флагов и доз из course_log для полей UnifiedSettings.pharma. */
export function derivePedFlagsFromCourse(course: CourseEntry[]): Partial<{
  hasCaber: boolean; hasGH: boolean; hasIGF: boolean; hasInsulin: boolean;
  hasSERM: boolean; hasSARMs: boolean; hasMGF: boolean; hasGLP1: boolean;
  ghIU: number; insulinIU: number; igfMcg: number; clenMcg: number; t3Mcg: number;
}> {
  const ids = new Set(course.map(c => c.substanceId));
  const result: any = {};
  if (ids.has('caberg') || ids.has('cabergoline')) result.hasCaber = true;
  if (ids.has('somatropin') || ids.has('hgh') || ids.has('gh')) result.hasGH = true;
  if (ids.has('igf1_lr3') || ids.has('igf1_des')) result.hasIGF = true;
  if (ids.has('ins_short') || ids.has('ins_long') || ids.has('ins_aspart') || ids.has('ins_detemir')) result.hasInsulin = true;
  if (ids.has('tamoxifen') || ids.has('clomiphene') || ids.has('enclomiphene')) result.hasSERM = true;
  if (ids.has('ostarine') || ids.has('lgd') || ids.has('rad140') || ids.has('s23') || ids.has('andarine')) result.hasSARMs = true;
  if (ids.has('mgf')) result.hasMGF = true;

  let ghIU = 0, insulinIU = 0, igfMcg = 0, clenMcg = 0, t3Mcg = 0;
  for (const c of course) {
    const dose = Number.isFinite(Number(c.doseValue)) ? Number(c.doseValue) : 0;
    if (c.substanceId === 'somatropin' || c.substanceId === 'hgh' || c.substanceId === 'gh') ghIU += dose;
    if (['ins_short','ins_long','ins_aspart','ins_detemir'].includes(c.substanceId)) insulinIU += dose;
    if (['igf1_lr3','igf1_des'].includes(c.substanceId)) igfMcg += dose;
    if (c.substanceId === 'clenbuterol' || c.substanceId === 'clen') clenMcg += dose;
    if (c.substanceId === 't3' || c.substanceId === 'liothyronine') t3Mcg += dose;
  }
  if (ghIU > 0) result.ghIU = ghIU;
  if (insulinIU > 0) result.insulinIU = insulinIU;
  if (igfMcg > 0) result.igfMcg = igfMcg;
  if (clenMcg > 0) result.clenMcg = clenMcg;
  if (t3Mcg > 0) result.t3Mcg = t3Mcg;
  return result;
}

/** Вывод PED-флагов и доз из profile.currentSubstances (зеркало course_log). */
export function derivePedFlagsFromSubstances(substances: PharmaSubstanceEntry[]): Partial<{
  hasAI: boolean; hasCaber: boolean; hasGH: boolean; hasIGF: boolean; hasInsulin: boolean;
  hasSERM: boolean; hasSARMs: boolean; hasMGF: boolean;
  ghIU: number; insulinIU: number; igfMcg: number; clenMcg: number; t3Mcg: number;
}> {
  const ids = new Set(substances.map(s => s.id));
  const result: any = {};
  if (['anastrozole','anastro','letrozole','exemestane'].some(id => ids.has(id))) result.hasAI = true;
  if (ids.has('caberg') || ids.has('cabergoline')) result.hasCaber = true;
  if (ids.has('somatropin') || ids.has('hgh') || ids.has('gh')) result.hasGH = true;
  if (ids.has('igf1_lr3') || ids.has('igf1_des')) result.hasIGF = true;
  if (['ins_short','ins_long','ins_aspart','ins_detemir'].some(id => ids.has(id))) result.hasInsulin = true;
  if (['tamoxifen','clomiphene','enclomiphene'].some(id => ids.has(id))) result.hasSERM = true;
  if (['ostarine','lgd','rad140','s23','andarine'].some(id => ids.has(id))) result.hasSARMs = true;
  if (ids.has('mgf')) result.hasMGF = true;

  let ghIU = 0, insulinIU = 0, igfMcg = 0, clenMcg = 0, t3Mcg = 0;
  for (const s of substances) {
    const dose = Number(s.doseMg) || 0;
    if (s.id === 'somatropin' || s.id === 'hgh' || s.id === 'gh') ghIU += dose;
    if (['ins_short','ins_long','ins_aspart','ins_detemir'].includes(s.id)) insulinIU += dose;
    if (s.id === 'igf1_lr3' || s.id === 'igf1_des') igfMcg += dose;
    if (s.id === 'clenbuterol' || s.id === 'clen') clenMcg += dose;
    if (s.id === 't3' || s.id === 'liothyronine') t3Mcg += dose;
  }
  if (ghIU > 0) result.ghIU = ghIU;
  if (insulinIU > 0) result.insulinIU = insulinIU;
  if (igfMcg > 0) result.igfMcg = igfMcg;
  if (clenMcg > 0) result.clenMcg = clenMcg;
  if (t3Mcg > 0) result.t3Mcg = t3Mcg;
  return result;
}