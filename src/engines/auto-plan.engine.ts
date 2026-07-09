import { registry } from '../core/data/registry';
import { generateStack } from './stack-builder.engine';
import { PHARMA_DB } from '../core/pharma-database';
import { UCUM_MAP, DRUG_THRESHOLDS } from '../core/constants';
import { calculateDose } from './dosage.engine';
import type { GoalId, LabPoint, UserProfile } from '../core/types';

export interface TimeSlot {
  time: 'morning' | 'day' | 'evening' | 'night';
  substances: Array<{ id: string; name: string; dose: string; notes: string }>;
}

export interface DailyProtocol {
  date: string;
  slots: TimeSlot[];
  warnings: string[];
  adherenceScore: number;
}

export interface WeeklyProtocol {
  days: DailyProtocol[];
  trainingDays: number[];
  warnings: string[];
  overallAdherenceScore: number;
}

export interface LabAdjustment {
  substanceId: string;
  adjustedDose: string;
  note: string;
}

const HEPATOTOXIC_CLASSES = new Set(['oral_17aa']);
const ERYTHROPOIETIC_CLASSES = new Set(['testosterone', 'trenbolone', 'boldenone', 'nandrolone']);
const ANDROGENIC_CLASSES = new Set(['testosterone', 'trenbolone', 'nandrolone', 'oral_17aa', 'boldenone', 'primobolan']);

const PHASE_DOSE_MULTIPLIERS: Record<string, number> = {
  baseline: 0.5,
  course: 1.0,
  pct: 0.3,
  maintenance: 0.6,
  bridge: 0.4
};

const SUBSTANCE_MG_PER_KG: Record<string, { low: number; high: number; unit: string; frequency: string }> = {
  test_prop: { low: 2, high: 5, unit: 'mg/нед', frequency: 'через день' },
  test_enan: { low: 3, high: 7, unit: 'mg/нед', frequency: '2x/нед' },
  test_cyp: { low: 3, high: 7, unit: 'mg/нед', frequency: '2x/нед' },
  test_undec: { low: 4, high: 8, unit: 'mg/нед', frequency: '1x/2нед' },
  tren_acet: { low: 0.5, high: 2, unit: 'mg/нед', frequency: 'через день' },
  tren_enan: { low: 0.5, high: 2, unit: 'мг/нед', frequency: '2x/нед' },
  tren_hex: { low: 0.5, high: 2, unit: 'мг/нед', frequency: '2x/нед' },
  npp: { low: 1.5, high: 4, unit: 'мг/нед', frequency: 'через день' },
  deca: { low: 2, high: 6, unit: 'мг/нед', frequency: '1x/нед' },
  bold_undec: { low: 2, high: 5, unit: 'мг/нед', frequency: '1x/нед' },
  prim_enan: { low: 2, high: 5, unit: 'мг/нед', frequency: '2x/нед' },
  methand: { low: 0.3, high: 0.8, unit: 'мг/день', frequency: 'ежедневно' },
  oxan: { low: 0.2, high: 0.7, unit: 'мг/кг/день', frequency: 'ежедневно' },
  stan: { low: 0.2, high: 0.5, unit: 'мг/кг/день', frequency: 'ежедневно' },
  trena: { low: 0.2, high: 0.6, unit: 'мг/кг/день', frequency: 'ежедневно' },
  halo: { low: 0.05, high: 0.2, unit: 'мг/кг/день', frequency: 'ежедневно' },
  ostarine: { low: 0.05, high: 0.13, unit: 'мг/кг/день', frequency: 'ежедневно' },
  lgd: { low: 0.003, high: 0.012, unit: 'мг/кг/день', frequency: 'ежедневно' },
  rad140: { low: 0.003, high: 0.012, unit: 'мг/кг/день', frequency: 'ежедневно' },
  s23: { low: 0.003, high: 0.012, unit: 'мг/кг/день', frequency: 'ежедневно' },
  clomi: { low: 0.5, high: 1.5, unit: 'мг/кг/день', frequency: 'ежедневно' },
  tamox: { low: 0.3, high: 0.6, unit: 'мг/кг/день', frequency: 'ежедневно' },
  anastro: { low: 0.005, high: 0.01, unit: 'мг/кг/день', frequency: 'ежедневно' },
  letrozole: { low: 0.003, high: 0.008, unit: 'мг/кг/день', frequency: 'ежедневно' },
  caberg: { low: 0.001, high: 0.004, unit: 'мг/нед', frequency: '2x/нед' },
  nac: { low: 10, high: 20, unit: 'мг/кг/день', frequency: 'ежедневно' },
  tudca: { low: 10, high: 17, unit: 'мг/кг/день', frequency: 'ежедневно' },
  omega3: { low: 20, high: 40, unit: 'мг/кг EPA+DHA/день', frequency: 'с едой' },
  berberine: { low: 4, high: 7, unit: 'мг/кг/день', frequency: 'с едой 2-3x' },
  telmi: { low: 0, high: 0.1, unit: 'мг/кг/день', frequency: 'ежедневно' },
  nebivolol: { low: 0.03, high: 0.1, unit: 'мг/кг/день', frequency: 'ежедневно' },
  magnesium: { low: 5, high: 10, unit: 'мг/кг/день', frequency: 'на ночь' },
  mk677: { low: 0.1, high: 0.17, unit: 'мг/кг/день', frequency: 'на ночь' },
  cjc1295: { low: 0.001, high: 0.002, unit: 'мг/кг', frequency: '2x/день' },
  ghrp6: { low: 0.001, high: 0.003, unit: 'мг/кг', frequency: '3x/день' },
  ipamorelin: { low: 0.001, high: 0.003, unit: 'мг/кг', frequency: '3x/день' }
};

const FOOD_REQUIREMENTS: Record<string, 'with_food' | 'empty_stomach' | 'any'> = {
  methand: 'with_food',
  oxan: 'with_food',
  stan: 'with_food',
  trena: 'with_food',
  halo: 'with_food',
  mk677: 'empty_stomach',
  cjc1295: 'empty_stomach',
  ghrp6: 'empty_stomach',
  ipamorelin: 'empty_stomach',
  berberine: 'with_food',
  omega3: 'with_food',
  magnesium: 'any',
  nac: 'any',
  tudca: 'any',
  telmi: 'any',
  nebivolol: 'any'
};

const SUPPLEMENT_OFF_DAYS = new Set(['nac', 'tudca', 'omega3', 'berberine', 'magnesium']);

function getLabValue(labs: LabPoint[], code: string): number | undefined {
  const entry = labs.find(l => l.code.toUpperCase() === code.toUpperCase());
  return entry ? entry.value : undefined;
}

function getULN(code: string): number {
  const entry = UCUM_MAP[code.toUpperCase()];
  return entry ? entry.uln : Infinity;
}

function getLLN(code: string): number {
  const entry = UCUM_MAP[code.toUpperCase()];
  return entry ? entry.lln : -Infinity;
}

export function adjustForLabs(
  labs: LabPoint[]
): { adjustments: LabAdjustment[]; warnings: string[]; addedSubstances: Array<{ id: string; name: string; dose: string; reason: string }> } {
  const adjustments: LabAdjustment[] = [];
  const warnings: string[] = [];
  const addedSubstances: Array<{ id: string; name: string; dose: string; reason: string }> = [];

  const alt = getLabValue(labs, 'ALT');
  const ast = getLabValue(labs, 'AST');
  const altUln = getULN('ALT');
  const astUln = getULN('AST');

  if (alt !== undefined && alt > altUln * 1.5) {
    warnings.push(`АЛТ ${alt} U/L превышает 1.5x ВНП (${(altUln * 1.5).toFixed(0)} U/L) — снижение гепатотоксичных субстанций`);
    for (const [id, sub] of Object.entries(PHARMA_DB)) {
      if (sub.pd.hepatotoxicity >= 2) {
        adjustments.push({
          substanceId: id,
          adjustedDose: '50%',
          note: `Снижено из-за АЛТ ${alt} U/L`
        });
      }
    }
    addedSubstances.push({ id: 'tudca', name: 'TUDCA', dose: '500 мг 2x/день', reason: `АЛТ ${alt} U/L > 1.5x ВНП` });
    addedSubstances.push({ id: 'nac', name: 'NAC', dose: '600 мг 2x/день', reason: `АЛТ ${alt} U/L > 1.5x ВНП` });
  }

  if (ast !== undefined && ast > astUln * 1.5 && alt === undefined) {
    warnings.push(`АСТ ${ast} U/L превышает 1.5x ВНП — снижение гепатотоксичных субстанций`);
    for (const [id, sub] of Object.entries(PHARMA_DB)) {
      if (sub.pd.hepatotoxicity >= 2) {
        adjustments.push({
          substanceId: id,
          adjustedDose: '50%',
          note: `Снижено из-за АСТ ${ast} U/L`
        });
      }
    }
    addedSubstances.push({ id: 'tudca', name: 'TUDCA', dose: '500 мг 2x/день', reason: `АСТ ${ast} U/L > 1.5x ВНП` });
    addedSubstances.push({ id: 'nac', name: 'NAC', dose: '600 мг 2x/день', reason: `АСТ ${ast} U/L > 1.5x ВНП` });
  }

  const hct = getLabValue(labs, 'HCT');
  if (hct !== undefined && hct > 52) {
    warnings.push(`Гематокрит ${hct}% > 52% — снижение эритропоэтических субстанций, необходимо кровопускание`);
    for (const [id, sub] of Object.entries(PHARMA_DB)) {
      if (sub.pd.hct_impact >= 3 && ERYTHROPOIETIC_CLASSES.has(sub.class)) {
        adjustments.push({
          substanceId: id,
          adjustedDose: '75%',
          note: `Снижено из-за HCT ${hct}%`
        });
      }
    }
    addedSubstances.push({ id: '_phlebotomy', name: 'Кровопускание', dose: '450 мл 1x/нед', reason: `HCT ${hct}% > 52%` });
  }

  const ldl = getLabValue(labs, 'LDL');
  const hdl = getLabValue(labs, 'HDL');
  if (ldl !== undefined && hdl !== undefined && hdl > 0) {
    const ratio = ldl / hdl;
    if (ratio > 4) {
      warnings.push(`LDL/HDL коэффициент ${ratio.toFixed(1)} > 4 — добавление Омега-3, снижение андрогенных субстанций`);
      for (const [id, sub] of Object.entries(PHARMA_DB)) {
        if (ANDROGENIC_CLASSES.has(sub.class) && sub.pd.lipid_impact < -0.3) {
          adjustments.push({
            substanceId: id,
            adjustedDose: '75%',
            note: `Снижено из-за LDL/HDL ${ratio.toFixed(1)}`
          });
        }
      }
      addedSubstances.push({ id: 'omega3', name: 'Омега-3 (EPA/DHA)', dose: '2000-4000 мг EPA+DHA/день', reason: `LDL/HDL ${ratio.toFixed(1)} > 4` });
    }
  }

  const glu = getLabValue(labs, 'GLU');
  const ins = getLabValue(labs, 'INS');
  let homaIr = getLabValue(labs, 'HOMA');
  if (homaIr === undefined && glu !== undefined && ins !== undefined) {
    homaIr = (glu * ins) / 22.5;
  }
  if (homaIr !== undefined && homaIr > 2.7) {
    warnings.push(`HOMA-IR ${homaIr.toFixed(1)} > 2.7 — инсулинорезистентность, добавление берберина, снижение углеводов`);
    addedSubstances.push({ id: 'berberine', name: 'Берберин', dose: '500 мг 2-3x/день с едой', reason: `HOMA-IR ${homaIr.toFixed(1)} > 2.7` });
  }

  return { adjustments, warnings, addedSubstances };
}

export function calculatePersonalizedDose(
  substanceId: string,
  bodyWeightKg: number,
  phase: string = 'course'
): string {
  const range = SUBSTANCE_MG_PER_KG[substanceId];
  if (!range) return 'Standard';
  const multiplier = PHASE_DOSE_MULTIPLIERS[phase] ?? 1.0;
  const lowDose = range.low * bodyWeightKg * multiplier;
  const highDose = range.high * bodyWeightKg * multiplier;
  if (range.unit.includes('/нед')) {
    return `${lowDose.toFixed(0)}-${highDose.toFixed(0)} ${range.unit} | ${range.frequency}`;
  }
  return `${lowDose.toFixed(1)}-${highDose.toFixed(1)} ${range.unit} | ${range.frequency}`;
}

export function checkTimeSlotConflicts(
  slots: TimeSlot[]
): { adjustedSlots: TimeSlot[]; warnings: string[] } {
  const warnings: string[] = [];
  const adjusted = slots.map(s => ({ ...s, substances: [...s.substances] }));
  const stimulantIds = new Set(['methand', 'trena', 'stan', 'halo', 'mk677', 'cjc1295', 'ghrp6', 'ipamorelin', 'rad140']);
  const sedativeIds = new Set(['magnesium', 'caberg', 'bromocriptine']);

  const morningIdx = adjusted.findIndex(s => s.time === 'morning');
  const eveningIdx = adjusted.findIndex(s => s.time === 'evening');
  const dayIdx = adjusted.findIndex(s => s.time === 'day');

  if (eveningIdx >= 0) {
    const toMove: TimeSlot['substances'] = [];
    const remaining: TimeSlot['substances'] = [];
    for (const sub of adjusted[eveningIdx].substances) {
      if (stimulantIds.has(sub.id)) {
        toMove.push({ ...sub, notes: sub.notes ? `${sub.notes}; перенесено с вечера на утро (стимулянт)` : 'Перенесено с вечера на утро (стимулянт)' });
        warnings.push(`${sub.name} — стимулянт, перенесён с вечера на утро`);
      } else {
        remaining.push(sub);
      }
    }
    adjusted[eveningIdx].substances = remaining;
    if (toMove.length > 0 && morningIdx >= 0) {
      adjusted[morningIdx].substances.push(...toMove);
    } else if (toMove.length > 0 && dayIdx >= 0) {
      adjusted[dayIdx].substances.push(...toMove);
    }
  }

  if (morningIdx >= 0) {
    const toMove: TimeSlot['substances'] = [];
    const remaining: TimeSlot['substances'] = [];
    for (const sub of adjusted[morningIdx].substances) {
      if (sedativeIds.has(sub.id)) {
        toMove.push({ ...sub, notes: sub.notes ? `${sub.notes}; перенесено с утра на вечер (седативный)` : 'Перенесено с утра на вечер (седативный)' });
        warnings.push(`${sub.name} — седативный препарат, перенесён с утра на вечер`);
      } else {
        remaining.push(sub);
      }
    }
    adjusted[morningIdx].substances = remaining;
    if (toMove.length > 0 && eveningIdx >= 0) {
      adjusted[eveningIdx].substances.push(...toMove);
    } else if (toMove.length > 0 && dayIdx >= 0) {
      adjusted[dayIdx].substances.push(...toMove);
    }
  }

  for (const slot of adjusted) {
    for (const sub of slot.substances) {
      const foodReq = FOOD_REQUIREMENTS[sub.id];
      if (foodReq === 'empty_stomach' && (slot.time === 'day' || slot.time === 'evening')) {
        sub.notes = sub.notes ? `${sub.notes}; принимать натощак (30 мин до еды)` : 'Принимать натощак (30 мин до еды)';
      } else if (foodReq === 'with_food') {
        sub.notes = sub.notes ? `${sub.notes}; принимать с едой` : 'Принимать с едой';
      }
    }
  }

  return { adjustedSlots: adjusted, warnings };
}

export function applyLabAdjustments(
  substances: Array<{ id: string; name: string; dose: string; notes: string }>,
  adjustments: LabAdjustment[]
): Array<{ id: string; name: string; dose: string; notes: string }> {
  return substances.map(sub => {
    const adj = adjustments.find(a => a.substanceId === sub.id);
    if (adj) {
      const baseDose = sub.dose;
      let newDose = adj.adjustedDose;
      const noteParts = [sub.notes, adj.note].filter(Boolean);
      if (baseDose !== 'Standard' && adj.adjustedDose.endsWith('%')) {
        const pct = parseInt(adj.adjustedDose) / 100;
        const numericMatch = baseDose.match(/([\d.]+)/);
        if (numericMatch) {
          const originalVal = parseFloat(numericMatch[1]);
          newDose = `${(originalVal * pct).toFixed(1)} ${baseDose.replace(numericMatch[1], '').trim()}`;
        }
      }
      return { ...sub, dose: newDose, notes: noteParts.join('; ') };
    }
    return sub;
  });
}

export function generateDailyProtocol(
  goalId: GoalId,
  labs: LabPoint[] = [],
  blacklist: string[] = []
): DailyProtocol {
  const db = registry.getDB();
  const goal = db.goals.find(g => g.id === goalId);
  const goalEffects = goal ? Object.keys(goal.effectPriority) : [];
  const stackResult = generateStack(goalEffects, blacklist);
  const warnings: string[] = [...stackResult.errors, ...stackResult.warnings];

  const labResult = adjustForLabs(labs);
  warnings.push(...labResult.warnings);

  const morning: TimeSlot['substances'] = [];
  const day: TimeSlot['substances'] = [];
  const evening: TimeSlot['substances'] = [];
  const night: TimeSlot['substances'] = [];

  const morningTags = ['stimulants', 'nootropics', 'thyroid_support', 'energy'];
  const dayTags = ['metabolic', 'cardio_support', 'immune_support', 'gi_healing', 'fatty_acids'];
  const eveningTags = ['anti_stress', 'recovery', 'hormone_balance', 'minerals'];
  const nightTags = ['sleep_regulators'];

  stackResult.substances.forEach(sub => {
    const adjustedDose = labResult.adjustments.find(a => a.substanceId === sub.id)
      ? calculatePersonalizedDose(sub.id, 80, 'course')
      : 'Standard';
    const item = { id: sub.id, name: sub.name, dose: adjustedDose, notes: '' };
    const cat = (sub.category || '').toLowerCase();
    if (morningTags.some(t => cat.includes(t))) morning.push(item);
    else if (dayTags.some(t => cat.includes(t))) day.push(item);
    else if (eveningTags.some(t => cat.includes(t))) evening.push(item);
    else if (nightTags.some(t => cat.includes(t))) night.push(item);
    else day.push(item);
  });

  for (const added of labResult.addedSubstances) {
    if (added.id.startsWith('_')) continue;
    const pharmaSub = PHARMA_DB[added.id];
    const cat = pharmaSub ? pharmaSub.class.toLowerCase() : 'support';
    const item = { id: added.id, name: added.name, dose: added.dose, notes: added.reason };
    if (cat.includes('support') || cat.includes('fatty')) evening.push(item);
    else if (cat.includes('sleep')) night.push(item);
    else if (cat.includes('stimul')) morning.push(item);
    else day.push(item);
  }

  let allSlots: TimeSlot[] = [
    { time: 'morning', substances: morning },
    { time: 'day', substances: day },
    { time: 'evening', substances: evening },
    { time: 'night', substances: night }
  ];

  const conflictResult = checkTimeSlotConflicts(allSlots);
  allSlots = conflictResult.adjustedSlots;
  warnings.push(...conflictResult.warnings);

  allSlots = allSlots.map(slot => ({
    ...slot,
    substances: applyLabAdjustments(slot.substances, labResult.adjustments)
  }));

  return {
    date: new Date().toISOString().slice(0, 10),
    slots: allSlots,
    warnings,
    adherenceScore: stackResult.score
  };
}

export function generateDailyProtocolWithProfile(
  goalId: GoalId,
  labs: LabPoint[] = [],
  blacklist: string[] = [],
  profile?: UserProfile,
  phase?: string
): DailyProtocol {
  const db = registry.getDB();
  const goal = db.goals.find(g => g.id === goalId);
  const goalEffects = goal ? Object.keys(goal.effectPriority) : [];
  const stackResult = generateStack(goalEffects, blacklist);
  const warnings: string[] = [...stackResult.errors, ...stackResult.warnings];

  const effectivePhase = phase || (profile?.settings as any)?.pharma?.phase || 'course';
  const bodyWeight = (profile?.settings as any)?.personal?.weight ?? 80;

  const labResult = adjustForLabs(labs);
  warnings.push(...labResult.warnings);

  const morning: TimeSlot['substances'] = [];
  const day: TimeSlot['substances'] = [];
  const evening: TimeSlot['substances'] = [];
  const night: TimeSlot['substances'] = [];

  const morningTags = ['stimulants', 'nootropics', 'thyroid_support', 'energy'];
  const dayTags = ['metabolic', 'cardio_support', 'immune_support', 'gi_healing', 'fatty_acids'];
  const eveningTags = ['anti_stress', 'recovery', 'hormone_balance', 'minerals'];
  const nightTags = ['sleep_regulators'];

  stackResult.substances.forEach(sub => {
    const adjustment = labResult.adjustments.find(a => a.substanceId === sub.id);
    let dose = calculatePersonalizedDose(sub.id, bodyWeight, effectivePhase);
    let notes = '';
    if (adjustment) {
      notes = adjustment.note;
      const pct = parseInt(adjustment.adjustedDose) / 100;
      if (!isNaN(pct) && dose !== 'Standard') {
        const numericMatch = dose.match(/([\d.]+)/);
        if (numericMatch) {
          const originalVal = parseFloat(numericMatch[1]);
          dose = `${(originalVal * pct).toFixed(1)} ${dose.replace(numericMatch[1], '').trim()}`;
        }
      } else if (adjustment.adjustedDose.endsWith('%')) {
        dose = adjustment.adjustedDose;
      }
    }
    const item = { id: sub.id, name: sub.name, dose, notes };
    const cat = (sub.category || '').toLowerCase();
    if (morningTags.some(t => cat.includes(t))) morning.push(item);
    else if (dayTags.some(t => cat.includes(t))) day.push(item);
    else if (eveningTags.some(t => cat.includes(t))) evening.push(item);
    else if (nightTags.some(t => cat.includes(t))) night.push(item);
    else day.push(item);
  });

  for (const added of labResult.addedSubstances) {
    if (added.id.startsWith('_')) continue;
    const pharmaSub = PHARMA_DB[added.id];
    const cat = pharmaSub ? pharmaSub.class.toLowerCase() : 'support';
    const item = { id: added.id, name: added.name, dose: added.dose, notes: added.reason };
    if (cat.includes('support') || cat.includes('fatty')) evening.push(item);
    else if (cat.includes('sleep')) night.push(item);
    else if (cat.includes('stimul')) morning.push(item);
    else day.push(item);
  }

  let allSlots: TimeSlot[] = [
    { time: 'morning', substances: morning },
    { time: 'day', substances: day },
    { time: 'evening', substances: evening },
    { time: 'night', substances: night }
  ];

  const conflictResult = checkTimeSlotConflicts(allSlots);
  allSlots = conflictResult.adjustedSlots;
  warnings.push(...conflictResult.warnings);

  return {
    date: new Date().toISOString().slice(0, 10),
    slots: allSlots,
    warnings,
    adherenceScore: stackResult.score
  };
}

export function generateWeeklyProtocol(
  goalId: GoalId,
  labs: LabPoint[] = [],
  blacklist: string[] = [],
  profile?: UserProfile,
  phase?: string,
  trainingDays: number[] = [1, 3, 5]
): WeeklyProtocol {
  const dailyBase = generateDailyProtocolWithProfile(goalId, labs, blacklist, profile, phase);
  const allWarnings: string[] = [...dailyBase.warnings];
  const days: DailyProtocol[] = [];
  const effectivePhase = phase || (profile?.settings as any)?.pharma?.phase || 'course';
  const bodyWeight = (profile?.settings as any)?.personal?.weight ?? 80;

  const today = new Date();
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  for (let d = 0; d < 7; d++) {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() + d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const dayOfWeek = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
    const isTrainingDay = trainingDays.includes(dayOfWeek);
    const isWeekend = dayOfWeek >= 5;

    const daySlots: TimeSlot[] = dailyBase.slots.map(slot => ({
      time: slot.time,
      substances: slot.substances.map(sub => {
        let dose = sub.dose;
        let notes = sub.notes;

        if (isTrainingDay && effectivePhase === 'course') {
          const range = SUBSTANCE_MG_PER_KG[sub.id];
          if (range) {
            dose = calculatePersonalizedDose(sub.id, bodyWeight, effectivePhase);
            notes = notes ? `${notes}; тренировочный день` : 'Тренировочный день';
          }
        }

        if (isWeekend && SUPPLEMENT_OFF_DAYS.has(sub.id)) {
          dose = 'Выходной';
          notes = notes ? `${notes}; выходной день — приём пропускается` : 'Выходной день — приём пропускается';
        }

        if (!isTrainingDay) {
          const pharmaSub = PHARMA_DB[sub.id];
          if (pharmaSub && ['ins_short', 'ins_aspart', 'igf1_lr3', 'igf1_des', 'mgf'].includes(sub.id)) {
            dose = 'Выходной';
            notes = notes ? `${notes}; день отдыха — пропуск` : 'День отдыха — пропуск';
          }
        }

        return { id: sub.id, name: sub.name, dose, notes };
      }).filter(sub => sub.dose !== 'Выходной' || !SUPPLEMENT_OFF_DAYS.has(sub.id) || !isWeekend)
    }));

    days.push({
      date: dateStr,
      slots: daySlots.filter(s => s.substances.length > 0),
      warnings: [],
      adherenceScore: dailyBase.adherenceScore
    });
  }

  return {
    days,
    trainingDays,
    warnings: allWarnings,
    overallAdherenceScore: Math.round(days.reduce((sum, d) => sum + d.adherenceScore, 0) / days.length)
  };
}