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
 *
 * Проход 139: подпись поля сама по себе ещё не однозначна — «Glucose» есть и в
 * крови, и в моче. Для мочи канон выбирается по панели (`LAB_PANEL_RENAME`).
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

/**
 * Подписи полей, которые совпадают со «кровяными», но значат другой анализ.
 *
 * Проход 139: в общем анализе мочи есть `Glucose`, `Ketones`, `Leukocytes`,
 * `Nitrite`, `pH` — и все они механически получали канон крови (`GLUCOSE`,
 * `KETONES`, …). Одна и та же карта `labSliceToValues` кормит мост механизмов
 * и ступени, поэтому глюкоза мочи 2.8 перезаписывала глюкозу крови и выдавала
 * «⛔ тяжёлая гипогликемия/кетоацидоз, ОТМЕНИТЬ GH и инсулин» из данных мочи;
 * лейкоциты мочи 10 становились лейкоцитами крови. Теперь у мочи свои имена
 * (`URINE_*`), как в каталоге приоритетов (`lab-priority-map`), а белок мочи
 * остаётся `PROTEIN_URINE` — это его канон с прохода 130.
 */
export const LAB_PANEL_RENAME: Record<string, Record<string, string>> = {
  panelUrinalysis: {
    'pH': 'URINE_PH',
    'Protein': 'PROTEIN_URINE',
    'Glucose': 'URINE_GLUCOSE',
    'Ketones': 'URINE_KETONES',
    'Leukocytes': 'URINE_LEUKOCYTES',
    'Nitrite': 'URINE_NITRITE',
  },
};

/**
 * Имя маркера в каноне словарей.
 *
 * `panel` нужен только там, где одна подпись значит разные анализы в разных
 * панелях (моча); без панели поведение прежнее.
 */
export function labMarkerCanon(marker: string, panel?: string): string {
  const byPanel = panel ? LAB_PANEL_RENAME[panel]?.[marker] : undefined;
  if (byPanel) return byPanel;
  return LAB_MARKER_RENAME[marker] || marker.toUpperCase().replace(/\s+/g, '_');
}
