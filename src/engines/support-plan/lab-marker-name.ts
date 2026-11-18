/**
 * support-plan/lab-marker-name.ts — как называется анализ.
 *
 * Проход 136/137: одно и то же поле формы читают три контура — план поддержки
 * (`mapper-ctx`), риск-модель (`engine-helpers`) и динамика анализов
 * (`calcLabDeltas`). Имя маркера в `LabSlice` — это подпись поля («Total T»,
 * «Vitamin D (25-OH)»), а словари (`LAB_TIERS`, мост механизмов, риск-модель)
 * ждут канон (`TESTOSTERONE`, `VITAMIN_D`). Таблица перевода живёт здесь одна:
 * раньше она была приватной копией в `mapper-ctx`, и любой другой путь получал
 * имена полей вместо канона.
 */

/** Панели бланка — в том порядке, как они идут в форме. */
export const LAB_PANEL_KEYS = [
  'panelBiochem', 'panelSex', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal',
  'panelMineral', 'panelTumor', 'panelUrinalysis',
] as const;

/** Подписи полей, чей канон не совпадает с механической заменой пробелов. */
export const LAB_MARKER_RENAME: Record<string, string> = {
  'Total T': 'TESTOSTERONE', 'Free T': 'FREE_TESTOSTERONE', 'E2': 'ESTRADIOL',
  'Bilirubin': 'BILIRUBIN', 'Uric acid': 'URIC_ACID', 'HCT': 'HEMATOCRIT',
  'Hemoglobin': 'HEMOGLOBIN', 'Total Cholesterol': 'TOTAL_CHOLESTEROL',
  'Triglycerides': 'TRIGLYCERIDES', 'T3 free': 'T3_FREE', 'T4 free': 'T4_FREE',
  'Anti-TPO': 'ANTI_TPO', 'Anti-TG': 'ANTI_TG', 'Vitamin D (25-OH)': 'VITAMIN_D',
  'Transferrin Sat': 'TRANSFERRIN_SAT', 'CK-MB': 'CK_MB', 'D-dimer': 'D_DIMER',
  'IL-6': 'IL_6', 'TNF-alpha': 'TNF_ALPHA', 'DHEA-S': 'DHEA_S', '3a-ADG': '3A_ADG',
  'PSA total': 'PSA_TOTAL', 'PSA free': 'PSA_FREE', 'CA-125': 'CA_125', 'Lp(a)': 'LP_A',
};

/** Имя маркера в каноне словарей. */
export function labMarkerCanon(marker: string): string {
  return LAB_MARKER_RENAME[marker] || marker.toUpperCase().replace(/\s+/g, '_');
}
