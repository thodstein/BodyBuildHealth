// Peptide Calculator Engine — full implementation
// Dilution, dosing, PK model, bioavailability, risk highlighting

export interface PeptideInfo {
  id: string;
  name: string;
  className: string;
  routes: string[];
  shortName: string;
  amountMg: number;
  bioavailability: Record<string, { min: number; max: number; avg: number }>;
  tHalfHours: number;
  mechanisms: string[];
  effects: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskNotes: string[];
}

export interface DilutionInput {
  amountValue: number;
  amountUnit: 'mg' | 'mcg';
  dilutionVolumeMl: number;
  doseValue: number;
  doseUnit: 'mg' | 'mcg';
  syringeType: 'U100_1ml' | 'U100_05ml' | 'U100_03ml' | 'U40_1ml';
}

export interface DilutionResult {
  amountMcg: number;
  doseMcg: number;
  concentrationMcgPerMl: number;
  doseVolumeMl: number;
  syringeUnits: number;
  syringeUnitsDisplay: string;
  dosesPerVial: number;
}

export interface BioavailabilityResult {
  effectiveMinMcg: number;
  effectiveAvgMcg: number;
  effectiveMaxMcg: number;
}

export interface PKInput {
  doseMcg: number;
  bioAvg: number;
  tHalfHours: number;
  scheduleDays: string[];
  totalDays: number;
}

export interface PKDay {
  day: number;
  weekday: string;
  inject: boolean;
  concentration: number;
}

export interface PKResult {
  days: PKDay[];
  maxConcentration: number;
  avgConcentration: number;
  steadyStateDay: number;
  eliminationRateDay: number;
  halfLifeDays: number;
}

export interface PeptideRisk {
  system: string;
  label: string;
  riskPercent: number;
  notes: string[];
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const RISK_SYSTEM_MAP: Record<string, { system: string; label: string }> = {
  igf1_axis_modulation: { system: 'endocrine', label: 'IGF-1 ось' },
  fluid_retention: { system: 'cardio', label: 'Задержка жидкости' },
  glucose_tolerance_shift: { system: 'endocrine', label: 'Толерантность к глюкозе' },
  cell_proliferation: { system: 'hematologic', label: 'Клеточная пролиферация' },
  prolactin_increase: { system: 'endocrine', label: 'Пролактин' },
  cortisol_shift: { system: 'endocrine', label: 'Кортизол' },
  appetite_increase: { system: 'neuro', label: 'Аппетит' },
  gh_axis_modulation: { system: 'endocrine', label: 'GH ось' },
  water_retention: { system: 'cardio', label: 'Задержка воды' },
  angiogenesis_modulation: { system: 'hematologic', label: 'Ангиогенез' },
  mitochondrial_signaling_shift: { system: 'hepatic', label: 'Митохондриальный сигнал' },
  cns_modulation: { system: 'neuro', label: 'ЦНС' },
  sleep_architecture_modulation: { system: 'neuro', label: 'Архитектура сна' },
  melanocortin_axis_modulation: { system: 'endocrine', label: 'Меланокортин' },
  nausea_possible: { system: 'neuro', label: 'Тошнота' },
};

export const SYRINGE_TYPES: Record<string, { label: string; unitsPerMl: number; maxMl: number; maxUnits: number }> = {
  U100_1ml: { label: 'U-100 1 мл', unitsPerMl: 100, maxMl: 1.0, maxUnits: 100 },
  U100_05ml: { label: 'U-100 0.5 мл', unitsPerMl: 100, maxMl: 0.5, maxUnits: 50 },
  U100_03ml: { label: 'U-100 0.3 мл', unitsPerMl: 100, maxMl: 0.3, maxUnits: 30 },
  U40_1ml: { label: 'U-40 1 мл', unitsPerMl: 40, maxMl: 1.0, maxUnits: 40 },
};

export const ROUTE_LABELS: Record<string, string> = {
  sc: 'Подкожно (SC)',
  im: 'Внутримышечно (IM)',
  intranasal: 'Интраназально',
  sublingual: 'Сублингвально',
};

export function computeDilution(input: DilutionInput): DilutionResult {
  if (!input) return { amountMcg: 0, doseMcg: 0, concentrationMcgPerMl: 0, doseVolumeMl: 0, syringeUnits: 0, syringeUnitsDisplay: '—', dosesPerVial: 0 };
  const syringe = SYRINGE_TYPES[input.syringeType];
  if (!syringe) return { amountMcg: 0, doseMcg: 0, concentrationMcgPerMl: 0, doseVolumeMl: 0, syringeUnits: 0, syringeUnitsDisplay: '—', dosesPerVial: 0 };
  const amountMcg = input.amountValue * (input.amountUnit === 'mg' ? 1000 : 1);
  const doseMcg = input.doseValue * (input.doseUnit === 'mg' ? 1000 : 1);
  const dilVol = input.dilutionVolumeMl > 0 ? input.dilutionVolumeMl : 1;
  const concentrationMcgPerMl = amountMcg / dilVol;
  const doseVolumeMl = doseMcg / concentrationMcgPerMl;

  const syringeUnits = doseVolumeMl * syringe.unitsPerMl;

  let syringeUnitsDisplay = '';
  if (syringeUnits > syringe.maxUnits) {
    syringeUnitsDisplay = `⚠ Превышает максимум шприца (${syringe.maxUnits} ед)`;
  } else {
    syringeUnitsDisplay = `${syringeUnits.toFixed(1)} ед (${((syringeUnits / syringe.maxUnits) * 100).toFixed(0)}% шкалы)`;
  }

  const dosesPerVial = doseVolumeMl > 0 ? dilVol / doseVolumeMl : 0;

  return {
    amountMcg,
    doseMcg,
    concentrationMcgPerMl,
    doseVolumeMl,
    syringeUnits,
    syringeUnitsDisplay,
    dosesPerVial,
  };
}

export function computeEffectiveDose(doseMcg: number, bio: { min: number; max: number; avg: number }): BioavailabilityResult {
  if (!bio) return { effectiveMinMcg: doseMcg, effectiveAvgMcg: doseMcg, effectiveMaxMcg: doseMcg };
  return {
    effectiveMinMcg: doseMcg * ((bio.min || 0) / 100),
    effectiveAvgMcg: doseMcg * ((bio.avg || 0) / 100),
    effectiveMaxMcg: doseMcg * ((bio.max || 0) / 100),
  };
}

export function computePK(input: PKInput): PKResult {
  if (!input) return { days: [], maxConcentration: 0, avgConcentration: 0, steadyStateDay: 0, eliminationRateDay: 0, halfLifeDays: 0 };
  const kDay = input.tHalfHours > 0 ? (0.693 / input.tHalfHours) * 24 : 0;
  const F = (input.bioAvg || 100) / 100;
  const D = (input.doseMcg || 0) * F;
  const scheduleDays = input.scheduleDays || [];

  let C = 0;
  const days: PKDay[] = [];
  let maxC = 0;
  let sumC = 0;
  const totalDays = Math.max(1, input.totalDays || 30);

  for (let day = 1; day <= totalDays; day++) {
    const weekday = WEEK[(day - 1) % 7];
    const inject = scheduleDays.includes(weekday);

    C = C * Math.exp(-kDay * 1);
    if (inject) C += D;
    if (C > maxC) maxC = C;
    sumC += C;

    days.push({ day, weekday, inject, concentration: C });
  }

  const avgC = sumC / totalDays;
  const steadyStateDay = Math.min(totalDays, Math.ceil(5 * (input.tHalfHours || 0) / 24));

  return {
    days,
    maxConcentration: maxC,
    avgConcentration: avgC,
    steadyStateDay,
    eliminationRateDay: kDay,
    halfLifeDays: (input.tHalfHours || 0) / 24,
  };
}

export function computePeptideRisks(peptide: PeptideInfo): PeptideRisk[] {
  if (!peptide) return [];
  const riskPercent = peptide.riskLevel === 'high' ? 35 : peptide.riskLevel === 'medium' ? 20 : 10;
  return (peptide.riskNotes || []).map(noteKey => {
    const mapped = RISK_SYSTEM_MAP[noteKey];
    if (mapped) {
      return { system: mapped.system, label: mapped.label, riskPercent, notes: [noteKey] };
    }
    return { system: 'neuro', label: String(noteKey || '').replace(/_/g, ' '), riskPercent: riskPercent / 2, notes: [noteKey] };
  });
}

export const PEPTIDE_DB: Record<string, PeptideInfo> = {
  gh: {
    id: 'gh', name: 'Growth Hormone', className: 'pituitary', routes: ['sc'],
    shortName: 'GH', amountMg: 10,
    bioavailability: { sc: { min: 70, max: 90, avg: 80 } },
    tHalfHours: 4, mechanisms: ['GH_UP', 'IGF1_UP'],
    effects: ['muscle_growth', 'fat_loss', 'recovery', 'gh_igf_axis'],
    riskLevel: 'high', riskNotes: ['igf1_axis_modulation', 'fluid_retention', 'glucose_tolerance_shift'],
  },
  igf1: {
    id: 'igf1', name: 'IGF-1 LR3', className: 'growth_factor', routes: ['sc'],
    shortName: 'IGF-1', amountMg: 1,
    bioavailability: { sc: { min: 75, max: 95, avg: 85 } },
    tHalfHours: 6, mechanisms: ['IGF1_UP', 'CELL_GROWTH'],
    effects: ['muscle_growth', 'recovery', 'gh_igf_axis'],
    riskLevel: 'high', riskNotes: ['cell_proliferation', 'glucose_tolerance_shift'],
  },
  ghrp2: {
    id: 'ghrp2', name: 'GHRP-2', className: 'gh_secretagogue', routes: ['sc'],
    shortName: 'GHRP-2', amountMg: 5,
    bioavailability: { sc: { min: 75, max: 90, avg: 82 } },
    tHalfHours: 2, mechanisms: ['GH_UP'],
    effects: ['gh_igf_axis', 'muscle_growth', 'recovery'],
    riskLevel: 'medium', riskNotes: ['prolactin_increase', 'cortisol_shift'],
  },
  ghrp6: {
    id: 'ghrp6', name: 'GHRP-6', className: 'gh_secretagogue', routes: ['sc'],
    shortName: 'GHRP-6', amountMg: 5,
    bioavailability: { sc: { min: 75, max: 90, avg: 82 } },
    tHalfHours: 2, mechanisms: ['GH_UP'],
    effects: ['gh_igf_axis', 'muscle_growth', 'recovery', 'appetite_increase'],
    riskLevel: 'medium', riskNotes: ['appetite_increase', 'prolactin_increase'],
  },
  ipamorelin: {
    id: 'ipamorelin', name: 'Ipamorelin', className: 'gh_secretagogue', routes: ['sc'],
    shortName: 'Ipamorelin', amountMg: 2,
    bioavailability: { sc: { min: 75, max: 95, avg: 85 } },
    tHalfHours: 2, mechanisms: ['GH_UP'],
    effects: ['gh_igf_axis', 'recovery', 'muscle_growth'],
    riskLevel: 'medium', riskNotes: ['gh_axis_modulation'],
  },
  cjc1295: {
    id: 'cjc1295', name: 'CJC-1295 (no DAC)', className: 'gh_releasing_hormone', routes: ['sc'],
    shortName: 'CJC-1295', amountMg: 2,
    bioavailability: { sc: { min: 70, max: 90, avg: 80 }, intranasal: { min: 15, max: 35, avg: 25 } },
    tHalfHours: 6, mechanisms: ['GH_UP', 'IGF1_UP'],
    effects: ['gh_igf_axis', 'recovery', 'muscle_growth'],
    riskLevel: 'medium', riskNotes: ['gh_axis_modulation', 'water_retention'],
  },
  bpc157: {
    id: 'bpc157', name: 'BPC-157', className: 'healing', routes: ['sc', 'oral'],
    shortName: 'BPC-157', amountMg: 5,
    bioavailability: { sc: { min: 85, max: 100, avg: 95 }, oral: { min: 30, max: 50, avg: 40 } },
    tHalfHours: 4, mechanisms: ['ANGIOGENESIS', 'TISSUE_REPAIR'],
    effects: ['gi_healing', 'recovery', 'anti_inflammation'],
    riskLevel: 'low', riskNotes: ['angiogenesis_modulation'],
  },
  tb500: {
    id: 'tb500', name: 'TB-500', className: 'healing', routes: ['sc'],
    shortName: 'TB-500', amountMg: 5,
    bioavailability: { sc: { min: 80, max: 98, avg: 90 } },
    tHalfHours: 4, mechanisms: ['CELL_MIGRATION', 'TISSUE_REPAIR'],
    effects: ['recovery', 'tissue_healing', 'anti_inflammation'],
    riskLevel: 'medium', riskNotes: ['angiogenesis_modulation'],
  },
  mots_c: {
    id: 'mots_c', name: 'MOTS-c', className: 'mitochondrial', routes: ['sc'],
    shortName: 'MOTS-c', amountMg: 10,
    bioavailability: { sc: { min: 80, max: 98, avg: 90 } },
    tHalfHours: 8, mechanisms: ['MITO_UP', 'AMPK_UP'],
    effects: ['mitochondria', 'fat_loss', 'insulin_sensitivity', 'energy'],
    riskLevel: 'medium', riskNotes: ['mitochondrial_signaling_shift'],
  },
  ss31: {
    id: 'ss31', name: 'SS-31 (Elamipretide)', className: 'mitochondrial', routes: ['sc'],
    shortName: 'SS-31', amountMg: 40,
    bioavailability: { sc: { min: 70, max: 90, avg: 80 } },
    tHalfHours: 2, mechanisms: ['MITO_REPAIR', 'CARDIOLIPIN_STABILIZE'],
    effects: ['mitochondria', 'cardio_support', 'recovery'],
    riskLevel: 'medium', riskNotes: ['mitochondrial_signaling_shift'],
  },
  selank: {
    id: 'selank', name: 'Selank', className: 'anxiolytic', routes: ['intranasal'],
    shortName: 'Selank', amountMg: 3,
    bioavailability: { intranasal: { min: 60, max: 80, avg: 70 } },
    tHalfHours: 3, mechanisms: ['GABA_UP', 'NEURO_SIGNALING'],
    effects: ['anti_stress', 'mood', 'focus'],
    riskLevel: 'low', riskNotes: ['cns_modulation'],
  },
  semax: {
    id: 'semax', name: 'Semax', className: 'nootropic', routes: ['intranasal'],
    shortName: 'Semax', amountMg: 3,
    bioavailability: { intranasal: { min: 60, max: 85, avg: 72 } },
    tHalfHours: 4, mechanisms: ['BDNF_UP', 'NEUROPROTECTION'],
    effects: ['focus', 'memory', 'energy'],
    riskLevel: 'low', riskNotes: ['cns_modulation'],
  },
  dsip: {
    id: 'dsip', name: 'DSIP', className: 'sleep', routes: ['sc'],
    shortName: 'DSIP', amountMg: 5,
    bioavailability: { sc: { min: 80, max: 100, avg: 90 } },
    tHalfHours: 1, mechanisms: ['SLEEP_UP', 'CORTISOL_DOWN'],
    effects: ['sleep', 'anti_stress'],
    riskLevel: 'low', riskNotes: ['sleep_architecture_modulation'],
  },
  melanotan2: {
    id: 'melanotan2', name: 'Melanotan II', className: 'melanocortin', routes: ['sc'],
    shortName: 'MT2', amountMg: 10,
    bioavailability: { sc: { min: 80, max: 100, avg: 90 } },
    tHalfHours: 1, mechanisms: ['MELANIN_UP', 'LIBIDO_UP'],
    effects: ['mood', 'libido_modulation'],
    riskLevel: 'medium', riskNotes: ['melanocortin_axis_modulation', 'nausea_possible'],
  },
  hexarelin: {
    id: 'hexarelin', name: 'Гексарелин', className: 'ghrp', routes: ['subq', 'im'],
    shortName: 'Гексарелин', amountMg: 2,
    bioavailability: { subq: { min: 80, max: 95, avg: 88 }, im: { min: 85, max: 98, avg: 92 } },
    tHalfHours: 1.5, mechanisms: ['ghrelin_agonist', 'gh_release', 'cardioprotective'],
    effects: ['gh_igf_axis', 'muscle_growth', 'recovery', 'cardio_support'],
    riskLevel: 'medium', riskNotes: ['Рецепторная десенситизация через 2-3 недели. Нужны перерывы'],
  },
  cjc1295_dac: {
    id: 'cjc1295_dac', name: 'CJC-1295 с DAC', className: 'ghrh', routes: ['subq', 'im'],
    shortName: 'CJC-DAC', amountMg: 2,
    bioavailability: { subq: { min: 75, max: 90, avg: 82 }, im: { min: 80, max: 92, avg: 86 } },
    tHalfHours: 168, mechanisms: ['ghrh_analog', 'gh_release_sustained', 'albumin_binding'],
    effects: ['gh_igf_axis', 'fat_loss', 'recovery', 'muscle_growth'],
    riskLevel: 'medium', riskNotes: ['DAC-версия с T1/2=7д. Не для длительного применения из-за GH-bleed'],
  },
  sermorelin: {
    id: 'sermorelin', name: 'Серморелин (GRF 1-29)', className: 'ghrh', routes: ['subq', 'im'],
    shortName: 'Серморелин', amountMg: 2,
    bioavailability: { subq: { min: 70, max: 85, avg: 78 }, im: { min: 75, max: 90, avg: 82 } },
    tHalfHours: 0.2, mechanisms: ['ghrh_analog', 'gh_release', 'natural'],
    effects: ['gh_igf_axis', 'sleep', 'antiaging', 'recovery'],
    riskLevel: 'low', riskNotes: ['Самый короткий T1/2. Рецептурный (США)'],
  },
  tesamorelin: {
    id: 'tesamorelin', name: 'Тесаморелин (Эгрифта)', className: 'ghrh', routes: ['subq'],
    shortName: 'Тесаморелин', amountMg: 1,
    bioavailability: { subq: { min: 75, max: 90, avg: 82 } },
    tHalfHours: 0.5, mechanisms: ['ghrh_analog', 'visceral_fat_reduction', 'gh_release'],
    effects: ['fat_loss', 'gh_igf_axis', 'recovery'],
    riskLevel: 'low', riskNotes: ['Одобрен FDA для липодистрофии при ВИЧ'],
  },
  igf1_lr3: {
    id: 'igf1_lr3', name: 'IGF-1 LR3 (Long R3)', className: 'igf1', routes: ['subq', 'im'],
    shortName: 'IGF-1 LR3', amountMg: 0.1,
    bioavailability: { subq: { min: 75, max: 95, avg: 85 }, im: { min: 80, max: 98, avg: 90 } },
    tHalfHours: 20, mechanisms: ['igf1_receptor_agonist', 'hyperplasia', 'anabolic'],
    effects: ['muscle_growth', 'recovery', 'gh_igf_axis'],
    riskLevel: 'medium', riskNotes: ['Длительное применение ведёт к десенситизации. Цикл 4-6 нед'],
  },
  igf1_des: {
    id: 'igf1_des', name: 'IGF-1 DES (1-3)', className: 'igf1', routes: ['im'],
    shortName: 'IGF-1 DES', amountMg: 0.1,
    bioavailability: { im: { min: 85, max: 98, avg: 92 } },
    tHalfHours: 0.5, mechanisms: ['igf1_receptor_agonist', 'local_growth', 'site_specific'],
    effects: ['muscle_growth', 'recovery'],
    riskLevel: 'medium', riskNotes: ['Только IM в целевую мышцу. Очень короткий T1/2 (30 мин)'],
  },
  mgf: {
    id: 'mgf', name: 'MGF (Механо-фактор роста)', className: 'mgf', routes: ['im'],
    shortName: 'MGF', amountMg: 1,
    bioavailability: { im: { min: 80, max: 95, avg: 88 } },
    tHalfHours: 0.1, mechanisms: ['satellite_cell_activation', 'hyperplasia', 'tissue_repair'],
    effects: ['muscle_growth', 'recovery', 'tissue_healing'],
    riskLevel: 'low', riskNotes: ['Только IM сразу после тренировки в целевую мышцу'],
  },
  peg_mgf: {
    id: 'peg_mgf', name: 'PEG-MGF (Пегилированный MGF)', className: 'mgf', routes: ['subq', 'im'],
    shortName: 'PEG-MGF', amountMg: 1,
    bioavailability: { subq: { min: 75, max: 90, avg: 82 }, im: { min: 80, max: 95, avg: 88 } },
    tHalfHours: 48, mechanisms: ['satellite_cell_activation', 'hyperplasia', 'pegylated'],
    effects: ['muscle_growth', 'recovery', 'tissue_healing'],
    riskLevel: 'low', riskNotes: ['Пегилированная форма с T1/2=48ч. Для восстановления в дни отдыха'],
  },
  bpc157_oral: {
    id: 'bpc157_oral', name: 'BPC-157 (оральный)', className: 'healing', routes: ['oral'],
    shortName: 'BPC-157 Oral', amountMg: 0.5,
    bioavailability: { oral: { min: 30, max: 50, avg: 40 } },
    tHalfHours: 4, mechanisms: ['ANGIOGENESIS', 'gut_healing', 'anti_ulcer', 'nitric_oxide'],
    effects: ['gi_healing', 'anti_inflammation', 'recovery'],
    riskLevel: 'low', riskNotes: ['Аргинатная соль, стабильна в желудке. Для ЖКТ и системного эффекта'],
  },
  bpc157_inj: {
    id: 'bpc157_inj', name: 'BPC-157 (инъекционный)', className: 'healing', routes: ['subq', 'im'],
    shortName: 'BPC-157 Inj', amountMg: 5,
    bioavailability: { subq: { min: 85, max: 100, avg: 95 }, im: { min: 88, max: 100, avg: 96 } },
    tHalfHours: 4, mechanisms: ['ANGIOGENESIS', 'tendon_healing', 'NEUROPROTECTION', 'nitric_oxide'],
    effects: ['recovery', 'tissue_healing', 'anti_inflammation', 'gi_healing'],
    riskLevel: 'low', riskNotes: ['Локальные инъекции в место травмы. Ацетатная соль для инъекций'],
  },
  aod9604: {
    id: 'aod9604', name: 'AOD-9604 (фрагмент ГР 177-191)', className: 'fat_loss', routes: ['subq'],
    shortName: 'AOD-9604', amountMg: 2,
    bioavailability: { subq: { min: 75, max: 90, avg: 82 } },
    tHalfHours: 0.5, mechanisms: ['lipolysis', 'fat_oxidation', 'gh_fragment'],
    effects: ['fat_loss', 'insulin_sensitivity'],
    riskLevel: 'low', riskNotes: ['Фрагмент ГР без анаболического эффекта. Только липолиз'],
  },
  fragment_176_191: {
    id: 'fragment_176_191', name: 'Фрагмент ГР 176-191', className: 'fat_loss', routes: ['subq'],
    shortName: 'ГР 176-191', amountMg: 2,
    bioavailability: { subq: { min: 70, max: 88, avg: 80 } },
    tHalfHours: 0.5, mechanisms: ['lipolysis', 'fat_oxidation', 'anticatabolic'],
    effects: ['fat_loss', 'anti_inflammation'],
    riskLevel: 'low', riskNotes: ['Натощак перед кардио для максимального липолиза'],
  },
  cerebrolysin: {
    id: 'cerebrolysin', name: 'Церебролизин', className: 'nootropic', routes: ['im', 'iv'],
    shortName: 'Церебролизин', amountMg: 215,
    bioavailability: { im: { min: 85, max: 98, avg: 92 }, iv: { min: 95, max: 100, avg: 98 } },
    tHalfHours: 2, mechanisms: ['NEUROGENESIS', 'NEUROPROTECTION', 'BDNF_UP', 'synaptic_plasticity'],
    effects: ['memory', 'focus', 'recovery', 'antiaging'],
    riskLevel: 'low', riskNotes: ['Нейропептиды мозга свиньи. Ампулы 215 мг/мл. Курс 10-20 дней'],
  },
  pt141: {
    id: 'pt141', name: 'Бремеланотид (PT-141)', className: 'sexual', routes: ['subq'],
    shortName: 'PT-141', amountMg: 10,
    bioavailability: { subq: { min: 80, max: 98, avg: 90 } },
    tHalfHours: 2.5, mechanisms: ['melanocortin_agonist', 'mc4r_activation', 'sexual_arousal'],
    effects: ['libido_modulation', 'mood'],
    riskLevel: 'medium', riskNotes: ['Без тошноты (в отличие от MT-2). Только либидо, без загара'],
  },
  epitalon: {
    id: 'epitalon', name: 'Эпиталон (Epitalon)', className: 'antiaging', routes: ['subq'],
    shortName: 'Эпиталон', amountMg: 10,
    bioavailability: { subq: { min: 75, max: 92, avg: 84 } },
    tHalfHours: 2, mechanisms: ['telomerase_activation', 'ANTI_AGING', 'pineal_regulation', 'circadian'],
    effects: ['sleep', 'antiaging', 'immune_boost'],
    riskLevel: 'low', riskNotes: ['Тетрапептид эпифиза. Активация теломеразы. Курс 10-20 дней 1-2 раза в год'],
  },
  thymalin: {
    id: 'thymalin', name: 'Тималин', className: 'immune', routes: ['im'],
    shortName: 'Тималин', amountMg: 10,
    bioavailability: { im: { min: 80, max: 95, avg: 88 } },
    tHalfHours: 2, mechanisms: ['IMMUNOMODULATOR', 'thymus_regeneration', 'ANTI_AGING'],
    effects: ['immune_boost', 'antiaging', 'recovery'],
    riskLevel: 'low', riskNotes: ['Пептид тимуса. Восстанавливает функцию вилочковой железы'],
  },
  ghk_cu: {
    id: 'ghk_cu', name: 'GHK-Cu (Медный пептид)', className: 'healing', routes: ['subq', 'topical'],
    shortName: 'GHK-Cu', amountMg: 0.05,
    bioavailability: { subq: { min: 75, max: 92, avg: 84 }, topical: { min: 10, max: 30, avg: 20 } },
    tHalfHours: 1, mechanisms: ['copper_peptide', 'COLLAGEN_SYNTH', 'ANGIOGENESIS', 'wound_healing'],
    effects: ['skin', 'recovery', 'tissue_healing', 'hair'],
    riskLevel: 'low', riskNotes: ['Медный пептид для кожи и заживления. Можно топикально и инъекционно'],
  },
};

export const PEPTIDE_LIST = Object.values(PEPTIDE_DB);

export const PEPTIDE_SYNERGY: Record<string, Record<string, number>> = {
  gh: { gh: 0, igf1: 2, ghrp2: 1, ghrp6: 1, ipamorelin: 1, cjc1295: 2 },
  igf1: { gh: 2, igf1: 0, ghrp2: 1, ghrp6: 1, ipamorelin: 1, cjc1295: 1 },
  ghrp2: { gh: 1, igf1: 1, ghrp2: 0, ghrp6: 1, ipamorelin: 1, cjc1295: 2 },
  ghrp6: { gh: 1, igf1: 1, ghrp2: 1, ghrp6: 0, ipamorelin: 1, cjc1295: 2 },
  ipamorelin: { gh: 1, igf1: 1, ghrp2: 1, ghrp6: 1, ipamorelin: 0, cjc1295: 2 },
  cjc1295: { gh: 2, igf1: 1, ghrp2: 2, ghrp6: 2, ipamorelin: 2, cjc1295: 0, cjc1295_dac: 1, hexarelin: 1, sermorelin: 1, tesamorelin: 1 },
  cjc1295_dac: { gh: 1, igf1: 1, ghrp2: 1, ghrp6: 1, ipamorelin: 1, cjc1295: 1, cjc1295_dac: 0 },
  hexarelin: { gh: 1, ghrp2: 1, ghrp6: 1, ipamorelin: 1, cjc1295: 1, cjc1295_dac: 1 },
  tesamorelin: { gh: 1, cjc1295: 1 },
  igf1_lr3: { gh: 2, igf1: 1, cjc1295: 1, igf1_des: 1, mgf: 1 },
  igf1_des: { igf1_lr3: 1, mgf: 1 },
  mgf: { igf1_lr3: 1, igf1_des: 1, peg_mgf: 1 },
  peg_mgf: { mgf: 1, igf1_lr3: 1 },
  bpc157_oral: { tb500: 1, bpc157_inj: 1, ghk_cu: 1 },
  bpc157_inj: { tb500: 2, bpc157: 1, bpc157_oral: 1, mots_c: 1, ghk_cu: 1 },
  bpc157: { bpc157: 0, tb500: 2, mots_c: 1, ss31: 1, bpc157_oral: 1, bpc157_inj: 1, ghk_cu: 1 },
  tb500: { bpc157: 2, tb500: 0, mots_c: 1, ss31: 1, bpc157_inj: 2 },
  ghk_cu: { bpc157: 1, bpc157_inj: 1, tb500: 1 },
  aod9604: { fragment_176_191: 1, gh: 1, cjc1295: 1 },
  fragment_176_191: { aod9604: 1, gh: 1 },
  cerebrolysin: { semax: 2, selank: 1 },
  pt141: { melanotan2: 1 },
  epitalon: { thymalin: 1, dsip: 1 },
  thymalin: { epitalon: 1 },
  semax: { semax: 0, selank: 1, cerebrolysin: 2 },
};

export const PEPTIDE_CONFLICTS: Record<string, Record<string, number>> = {
  gh: { gh: 0, igf1: 1 },
  igf1: { gh: 1, igf1: 0 },
  ghrp2: { ghrp2: 0, ghrp6: 1 },
  ghrp6: { ghrp2: 1, ghrp6: 0 },
};

export const PEPTIDE_GOAL_PROFILES: Record<string, {
  preferredPeptides: string[];
  avoidPeptides: string[];
  effectPriority: Record<string, number>;
}> = {
  muscle_growth: {
    preferredPeptides: ['gh', 'igf1', 'igf1_lr3', 'igf1_des', 'cjc1295', 'ipamorelin', 'ghrp2', 'hexarelin', 'mgf', 'peg_mgf'],
    avoidPeptides: [],
    effectPriority: { muscle_growth: 1.0, gh_igf_axis: 0.9, recovery: 0.8, fat_loss: 0.6 },
  },
  fat_loss: {
    preferredPeptides: ['mots_c', 'gh', 'cjc1295', 'aod9604', 'fragment_176_191', 'tesamorelin'],
    avoidPeptides: [],
    effectPriority: { fat_loss: 1.0, mitochondria: 0.9, insulin_sensitivity: 0.8, energy: 0.7 },
  },
  recovery: {
    preferredPeptides: ['bpc157', 'bpc157_inj', 'tb500', 'gh', 'cjc1295', 'ghk_cu', 'bpc157_oral'],
    avoidPeptides: [],
    effectPriority: { recovery: 1.0, anti_inflammation: 0.9, tissue_healing: 0.9, gi_healing: 0.7 },
  },
  gi_healing: {
    preferredPeptides: ['bpc157', 'bpc157_oral', 'bpc157_inj'],
    avoidPeptides: [],
    effectPriority: { gi_healing: 1.0, anti_inflammation: 0.9, recovery: 0.7 },
  },
  mitochondria: {
    preferredPeptides: ['mots_c', 'ss31'],
    avoidPeptides: [],
    effectPriority: { mitochondria: 1.0, energy: 0.8, cardio_support: 0.7 },
  },
  focus: {
    preferredPeptides: ['semax', 'selank', 'cerebrolysin'],
    avoidPeptides: [],
    effectPriority: { focus: 1.0, memory: 0.9, anti_stress: 0.7, mood: 0.6 },
  },
  sleep: {
    preferredPeptides: ['dsip', 'selank', 'epitalon'],
    avoidPeptides: [],
    effectPriority: { sleep: 1.0, anti_stress: 0.9, mood: 0.6 },
  },
};

export function scorePeptideStack(peptideIds: string[], goal: string): number {
  if (!Array.isArray(peptideIds)) return 0;
  const profile = PEPTIDE_GOAL_PROFILES[goal];
  if (!profile) return 0;
  let score = 0;
  for (const id of peptideIds) {
    const p = PEPTIDE_DB[id];
    if (!p) continue;
    for (const eff of (p.effects || [])) {
      score += profile.effectPriority?.[eff] ?? 0;
    }
  }
  for (let i = 0; i < peptideIds.length; i++) {
    for (let j = i + 1; j < peptideIds.length; j++) {
      const a = peptideIds[i], b = peptideIds[j];
      const syn = PEPTIDE_SYNERGY[a]?.[b] ?? 0;
      if (syn) score += syn;
    }
  }
  for (let i = 0; i < peptideIds.length; i++) {
    for (let j = i + 1; j < peptideIds.length; j++) {
      const a = peptideIds[i], b = peptideIds[j];
      const conflict = PEPTIDE_CONFLICTS[a]?.[b] ?? 0;
      if (conflict === 2) score -= 10;
      if (conflict === 1) score -= 3;
      if (conflict === 0.5) score -= 1;
    }
  }
  return Math.max(0, score);
}

export function generatePeptideProtocol(goal: string): { goal: string; peptides: PeptideInfo[]; synergyScore: number } | null {
  const profile = PEPTIDE_GOAL_PROFILES[goal];
  if (!profile) return null;
  const peptides = profile.preferredPeptides.map(id => PEPTIDE_DB[id]).filter(Boolean);
  const score = scorePeptideStack(profile.preferredPeptides, goal);
  return { goal, peptides, synergyScore: score };
}

export function getPeptideSynergiesFor(id: string): { partner: string; partnerName: string; strength: number }[] {
  const row = PEPTIDE_SYNERGY[id];
  if (!row) return [];
  return Object.entries(row)
    .filter(([k, v]) => k !== id && v > 0)
    .map(([k, v]) => ({ partner: k, partnerName: PEPTIDE_DB[k]?.shortName || k, strength: v }));
}

export function getPeptideConflictsFor(id: string): { partner: string; partnerName: string; severity: number }[] {
  const row = PEPTIDE_CONFLICTS[id];
  if (!row) return [];
  return Object.entries(row)
    .filter(([k, v]) => k !== id && v > 0)
    .map(([k, v]) => ({ partner: k, partnerName: PEPTIDE_DB[k]?.shortName || k, severity: v }));
}
