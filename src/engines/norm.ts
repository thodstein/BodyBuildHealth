/**
 * norm.ts — shared normalization helper for exercise/muscle name fuzzy matching.
 *
 * Lowercases, replaces 'ё'→'е', trims whitespace, guards against null/undefined.
 * Consolidates 4 previous duplicate implementations (lms-builder, diary-autoreg,
 * nutrition-periodization, biostack-clinical-v2) into one canonical version.
 *
 * The null-guard + trim (from diary-autoreg) is the safest superset of all variants.
 */
export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/ё/g, 'е').trim();
}
