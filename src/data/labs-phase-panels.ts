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
  baseline: ['cbc', 'liver_extended', 'kidney', 'electrolytes', 'lipids', 'thyroid', 'glucose', 'iron_studies', 'hormones_androgens', 'adrenal'],
  on_cycle: ['cbc', 'liver_extended', 'kidney', 'electrolytes', 'lipids', 'hormones_androgens', 'glucose', 'iron_studies', 'prostate', 'bone_markers'],
  pct: ['cbc', 'liver', 'kidney', 'lipids', 'hormones_axis', 'prolactin', 'thyroid', 'adrenal', 'iron_studies'],
  bridge: ['cbc', 'liver', 'kidney', 'lipids', 'thyroid', 'bone_markers', 'iron_studies'],
  fertility: ['cbc', 'hormones_fertility', 'semen', 'thyroid', 'iron_studies', 'electrolytes', 'prostate']
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
    label: 'Липиды + гомоцистеин',
    weight: 1,
    markers: [
      { id: 'ldl', label: 'ЛПНП', unit: 'mmol/L', ref: [0, 3], importance: 'critical', ucumCode: 'LDL' },
      { id: 'hdl', label: 'ЛПВП', unit: 'mmol/L', ref: [1, 2.5], importance: 'important', ucumCode: 'HDL' },
      { id: 'tg', label: 'Триглицериды', unit: 'mmol/L', ref: [0.4, 1.7], importance: 'important', ucumCode: 'TG' },
      { id: 'homocysteine', label: 'Гомоцистеин', unit: 'umol/L', ref: [5, 15], importance: 'important', ucumCode: 'HOMOCYSTEINE' }
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
    label: 'Андрогены + ИФР-1',
    weight: 1,
    markers: [
      { id: 'tt', label: 'Тестостерон', unit: 'ng/dL', ref: [300, 1000], importance: 'important', ucumCode: 'TT' },
      { id: 'e2', label: 'Эстрадиол', unit: 'pg/mL', ref: [10, 40], importance: 'important', ucumCode: 'E2' },
      { id: 'igf1', label: 'ИФР-1', unit: 'ng/mL', ref: [100, 250], importance: 'important', ucumCode: 'IGF1' }
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
  },
  hormones_fertility: {
    id: 'hormones_fertility',
    label: 'Гормоны фертильности',
    weight: 1.1,
    markers: [
      { id: 'lh', label: 'ЛГ', unit: 'mIU/mL', ref: [1.5, 9.3], importance: 'critical', ucumCode: 'LH' },
      { id: 'fsh', label: 'ФСГ', unit: 'mIU/mL', ref: [1.4, 18.1], importance: 'critical', ucumCode: 'FSH' },
      { id: 'tt', label: 'Тестостерон общий', unit: 'ng/dL', ref: [300, 1000], importance: 'important', ucumCode: 'TT' },
      { id: 'ft', label: 'Тестостерон свободный', unit: 'pg/mL', ref: [8, 30], importance: 'important', ucumCode: 'FT' },
      { id: 'e2', label: 'Эстрадиол', unit: 'pg/mL', ref: [10, 40], importance: 'important', ucumCode: 'E2' },
      { id: 'prl', label: 'Пролактин', unit: 'ng/mL', ref: [2, 15], importance: 'important', ucumCode: 'PRL' },
      { id: 'shbg', label: 'ГСПГ', unit: 'nmol/L', ref: [15, 60], importance: 'important', ucumCode: 'SHBG' },
      { id: 'inhb', label: 'Ингибин Б', unit: 'pg/mL', ref: [80, 340], importance: 'critical', ucumCode: 'INHB' },
      { id: 'amh', label: 'АМГ', unit: 'ng/mL', ref: [1.0, 15.0], importance: 'important', ucumCode: 'AMH' },
      { id: 'prog', label: 'Прогестерон', unit: 'ng/mL', ref: [0.1, 1.2], importance: 'optional', ucumCode: 'PROG' }
    ]
  },
  semen: {
    id: 'semen',
    label: 'Спермограмма расширенная',
    weight: 1.2,
    markers: [
      { id: 'volume', label: 'Объём', unit: 'mL', ref: [1.5, 5], importance: 'important' },
      { id: 'concentration', label: 'Концентрация', unit: 'млн/мл', ref: [16, 150], importance: 'critical' },
      { id: 'total', label: 'Общее кол-во', unit: 'млн', ref: [39, 500], importance: 'critical' },
      { id: 'pr', label: 'PR подвижность', unit: '%', ref: [30, 80], importance: 'critical' },
      { id: 'np', label: 'NP подвижность', unit: '%', ref: [10, 30], importance: 'important' },
      { id: 'immotile', label: 'Неподвижные', unit: '%', ref: [0, 30], importance: 'important' },
      { id: 'morphology', label: 'Морфология', unit: '%', ref: [4, 15], importance: 'critical' },
      { id: 'viability', label: 'Жизнеспособность', unit: '%', ref: [58, 100], importance: 'important' },
      { id: 'dfi', label: 'DFI', unit: '%', ref: [0, 15], importance: 'critical' },
      { id: 'ph', label: 'pH', unit: '', ref: [7.2, 8.0], importance: 'optional' }
    ]
  },
  electrolytes: {
    id: 'electrolytes',
    label: 'Электролиты',
    weight: 0.9,
    markers: [
      { id: 'k', label: 'Калий', unit: 'mmol/L', ref: [3.5, 5.1], importance: 'critical', ucumCode: 'K' },
      { id: 'na', label: 'Натрий', unit: 'mmol/L', ref: [135, 145], importance: 'critical', ucumCode: 'NA' },
      { id: 'ca', label: 'Кальций', unit: 'mmol/L', ref: [2.1, 2.6], importance: 'important', ucumCode: 'CA' },
      { id: 'p', label: 'Фосфор', unit: 'mmol/L', ref: [0.8, 1.5], importance: 'important', ucumCode: 'P' },
      { id: 'mg', label: 'Магний', unit: 'mmol/L', ref: [0.7, 1.1], importance: 'important', ucumCode: 'MG' }
    ]
  },
  iron_studies: {
    id: 'iron_studies',
    label: 'Железо + транспорт',
    weight: 0.9,
    markers: [
      { id: 'ferritin', label: 'Ферритин', unit: 'ug/L', ref: [30, 300], importance: 'critical', ucumCode: 'FERRITIN' },
      { id: 'iron', label: 'Железо сыв.', unit: 'umol/L', ref: [10, 30], importance: 'important', ucumCode: 'IRON' },
      { id: 'tibc', label: 'ОЖСС', unit: 'umol/L', ref: [45, 70], importance: 'important', ucumCode: 'TIBC' },
      { id: 'uibc', label: 'Лат. ЖСС', unit: 'umol/L', ref: [20, 45], importance: 'important', ucumCode: 'UIBC' },
      { id: 'transferrin', label: 'Трансферрин', unit: 'g/L', ref: [2.0, 3.8], importance: 'important', ucumCode: 'TRANSFERRIN' },
      { id: 'hgb', label: 'Гемоглобин', unit: 'g/L', ref: [130, 170], importance: 'important', ucumCode: 'HGB' }
    ]
  },
  liver_extended: {
    id: 'liver_extended',
    label: 'Печень расширенная',
    weight: 1,
    markers: [
      { id: 'alt', label: 'АЛТ', unit: 'U/L', ref: [0, 40], importance: 'critical', ucumCode: 'ALT' },
      { id: 'ast', label: 'АСТ', unit: 'U/L', ref: [0, 40], importance: 'critical', ucumCode: 'AST' },
      { id: 'ggt', label: 'ГГТ', unit: 'U/L', ref: [0, 60], importance: 'important', ucumCode: 'GGT' },
      { id: 'alb', label: 'Альбумин', unit: 'g/L', ref: [35, 50], importance: 'important', ucumCode: 'ALB' },
      { id: 'tp', label: 'Общий белок', unit: 'g/L', ref: [60, 80], importance: 'important', ucumCode: 'TP' },
      { id: 'bil', label: 'Билирубин общий', unit: 'umol/L', ref: [3.4, 17.1], importance: 'important', ucumCode: 'BIL' },
      { id: 'dbil', label: 'Билирубин прямой', unit: 'umol/L', ref: [0, 5], importance: 'optional', ucumCode: 'DBIL' },
      { id: 'alp', label: 'Щёлочная фосфатаза', unit: 'U/L', ref: [40, 130], importance: 'important', ucumCode: 'ALP' }
    ]
  },
  bone_markers: {
    id: 'bone_markers',
    label: 'Костные маркеры',
    weight: 0.8,
    markers: [
      { id: 'ca', label: 'Кальций', unit: 'mmol/L', ref: [2.1, 2.6], importance: 'important', ucumCode: 'CA' },
      { id: 'p', label: 'Фосфор', unit: 'mmol/L', ref: [0.8, 1.5], importance: 'important', ucumCode: 'P' },
      { id: 'alp', label: 'Щёлочная фосфатаза', unit: 'U/L', ref: [40, 130], importance: 'important', ucumCode: 'ALP' },
      { id: 'vitd', label: 'Витамин D', unit: 'ng/mL', ref: [30, 100], importance: 'important', ucumCode: 'VITD' },
      { id: 'cortisol', label: 'Кортизол', unit: 'nmol/L', ref: [100, 550], importance: 'optional', ucumCode: 'CORTISOL' }
    ]
  },
  prostate: {
    id: 'prostate',
    label: 'Простата',
    weight: 0.85,
    markers: [
      { id: 'psa', label: 'ПСА', unit: 'ng/mL', ref: [0, 4], importance: 'critical', ucumCode: 'PSA' },
      { id: 'tt', label: 'Тестостерон', unit: 'ng/dL', ref: [300, 1000], importance: 'important', ucumCode: 'TT' },
      { id: 'ft', label: 'Тестостерон свободный', unit: 'pg/mL', ref: [8, 30], importance: 'important', ucumCode: 'FT' },
      { id: 'shbg', label: 'ГСПГ', unit: 'nmol/L', ref: [15, 60], importance: 'optional', ucumCode: 'SHBG' }
    ]
  },
  adrenal: {
    id: 'adrenal',
    label: 'Надпочечники',
    weight: 0.8,
    markers: [
      { id: 'cortisol', label: 'Кортизол', unit: 'nmol/L', ref: [100, 550], importance: 'important', ucumCode: 'CORTISOL' },
      { id: 'dhea_s', label: 'ДГЭА-С', unit: 'ug/dL', ref: [80, 560], importance: 'important', ucumCode: 'DHEA_S' }
    ]
  }
};
