/** Phase-based lab panels (from MODULELABS healthlabs.data.js). */
export type LabImportance = 'critical' | 'important' | 'optional';

export interface LabPanelMarker {
  id: string;
  label: string;
  unit: string;
  ref: [number, number];
  importance: LabImportance;
  ucumCode?: string;
}

export interface LabPanel {
  id: string;
  label: string;
  weight: number;
  markers: LabPanelMarker[];
}

export const LABS_PHASES = [
  { id: 'baseline', label: 'Базовая' },
  { id: 'on_cycle', label: 'Курс' },
  { id: 'pct', label: 'ПКТ' },
  { id: 'bridge', label: 'Мост' },
  { id: 'fertility', label: 'Фертильность' }
] as const;

export const PHASE_REQUIRED_PANELS: Record<string, string[]> = {
  baseline: ['cbc', 'liver', 'kidney', 'lipids', 'thyroid', 'glucose'],
  on_cycle: ['cbc', 'liver', 'kidney', 'lipids', 'hormones_androgens', 'glucose'],
  pct: ['cbc', 'liver', 'kidney', 'lipids', 'hormones_axis', 'prolactin'],
  bridge: ['cbc', 'liver', 'kidney', 'lipids', 'thyroid'],
  fertility: ['cbc', 'hormones_fertility', 'semen']
};

export const LAB_PANELS: Record<string, LabPanel> = {
  cbc: {
    id: 'cbc',
    label: 'ОАК',
    weight: 1,
    markers: [
      { id: 'hgb', label: 'Гемоглобин', unit: 'g/L', ref: [130, 170], importance: 'important', ucumCode: 'HGB' },
      { id: 'wbc', label: 'Лейкоциты', unit: '10^9/L', ref: [4, 9], importance: 'critical', ucumCode: 'WBC' },
      { id: 'plt', label: 'Тромбоциты', unit: '10^9/L', ref: [150, 400], importance: 'important', ucumCode: 'PLT' }
    ]
  },
  liver: {
    id: 'liver',
    label: 'Печень',
    weight: 1,
    markers: [
      { id: 'alt', label: 'АЛТ', unit: 'U/L', ref: [0, 40], importance: 'critical', ucumCode: 'ALT' },
      { id: 'ast', label: 'АСТ', unit: 'U/L', ref: [0, 40], importance: 'critical', ucumCode: 'AST' },
      { id: 'ggt', label: 'ГГТ', unit: 'U/L', ref: [0, 60], importance: 'important', ucumCode: 'GGT' }
    ]
  },
  kidney: {
    id: 'kidney',
    label: 'Почки',
    weight: 1,
    markers: [
      { id: 'creatinine', label: 'Креатинин', unit: 'umol/L', ref: [60, 115], importance: 'critical', ucumCode: 'CREATININE' }
    ]
  },
  lipids: {
    id: 'lipids',
    label: 'Липиды',
    weight: 1,
    markers: [
      { id: 'ldl', label: 'ЛПНП', unit: 'mmol/L', ref: [0, 3], importance: 'critical', ucumCode: 'LDL' },
      { id: 'hdl', label: 'ЛПВП', unit: 'mmol/L', ref: [1, 2.5], importance: 'important', ucumCode: 'HDL' },
      { id: 'tg', label: 'Триглицериды', unit: 'mmol/L', ref: [0.4, 1.7], importance: 'important', ucumCode: 'TG' }
    ]
  },
  thyroid: {
    id: 'thyroid',
    label: 'Щитовидная',
    weight: 0.9,
    markers: [
      { id: 'tsh', label: 'ТТГ', unit: 'mIU/L', ref: [0.4, 4], importance: 'important', ucumCode: 'TSH' },
      { id: 'ft4', label: 'Св. T4', unit: 'pmol/L', ref: [10, 22], importance: 'important', ucumCode: 'FT4' }
    ]
  },
  glucose: {
    id: 'glucose',
    label: 'Глюкоза',
    weight: 0.9,
    markers: [
      { id: 'glu', label: 'Глюкоза', unit: 'mmol/L', ref: [3.9, 5.5], importance: 'critical', ucumCode: 'GLU' },
      { id: 'hba1c', label: 'HbA1c', unit: '%', ref: [4, 5.6], importance: 'important', ucumCode: 'HbA1c' }
    ]
  },
  hormones_androgens: {
    id: 'hormones_androgens',
    label: 'Андрогены',
    weight: 1,
    markers: [
      { id: 'tt', label: 'Тестостерон', unit: 'ng/dL', ref: [300, 1000], importance: 'important', ucumCode: 'TT' },
      { id: 'e2', label: 'Эстрадиол', unit: 'pg/mL', ref: [10, 40], importance: 'important', ucumCode: 'E2' }
    ]
  },
  hormones_axis: {
    id: 'hormones_axis',
    label: 'Ось ГГЯ',
    weight: 1,
    markers: [
      { id: 'lh', label: 'ЛГ', unit: 'mIU/mL', ref: [1.5, 9.3], importance: 'critical', ucumCode: 'LH' },
      { id: 'fsh', label: 'ФСГ', unit: 'mIU/mL', ref: [1.4, 18.1], importance: 'critical', ucumCode: 'FSH' },
      { id: 'tt', label: 'Тестостерон', unit: 'ng/dL', ref: [300, 1000], importance: 'important', ucumCode: 'TT' }
    ]
  },
  prolactin: {
    id: 'prolactin',
    label: 'Пролактин',
    weight: 0.7,
    markers: [
      { id: 'prl', label: 'Пролактин', unit: 'ng/mL', ref: [2, 15], importance: 'important', ucumCode: 'PRL' }
    ]
  }
};
