/**
 * support-plan/types.ts — ЕДИНСТВЕННЫЙ файл типов для движка поддержки.
 * Содержит все типы CalculatorState, CalculatorResult, PlanResult и утилиты.
 * Заменяет support-calculator.types.ts и типы из support-plan-engine.ts.
 */

import { SUPPORT_CATALOG_DATA, DEFAULT_DOSAGES } from '../../data/support-database';

// ═══════════════════════════════════════════════════════════════
//  БАЗОВЫЕ ТИПЫ
// ═══════════════════════════════════════════════════════════════

export type Sex = 'male' | 'female';
export type CoursePhase = 'course' | 'bridge' | 'pct' | 'base';
export type PowerLevel = 'basic' | 'mid' | 'max' | 'boost';

// ─── Block 1: User Profile ───
export interface UserProfileData {
  weight: number; age: number; sex: Sex;
  height?: number; bodyfat?: number;
  workoutsPerWeek: number; avgWorkoutMinutes: number;
  sleepHours: number; stressLevel: number;
  smoker: boolean; alcohol: 'never' | 'rare' | 'sometimes' | 'regular';
  caffeineMg: number;
}

// ─── Block 2: Neuro Status ───
export interface NeuroStatusData {
  dopamineScore: number;
  serotoninScore: number;
  gabaBalance: 'balance' | 'overexcited' | 'inhibited';
  memoryIssues: boolean; focusIssues: boolean; slowThinking: boolean;
  coordinationIssues: boolean;
  aggressionScore: number;
  headaches: boolean; weatherDependent: boolean;
  sleepQuality: 'good' | 'fair' | 'poor';
}

// ─── Block 3: Course Phase & Pharma Stack ───
export interface AASEntry {
  id: string; doseMgWeek: number; weeks: number; startWeek?: number; endWeek?: number;
}
export interface PharmaStackData {
  phase: CoursePhase;
  aas: AASEntry[];
  hasGH: boolean; hasIGF: boolean; hasInsulin: boolean;
  hasHCG: boolean; hasAI: boolean; hasCaber: boolean; hasSERM: boolean;
  hasSARMs: boolean; hasMGF: boolean; hasGLP1: boolean;
}

// ─── Block 4: Goals & Cycle ───
export interface GoalsData {
  healthMaintenance: boolean; competitionPrep: boolean; sleepRecovery: boolean;
  lipidCorrection: boolean; bloodThinning: boolean; liverDetox: boolean;
  bpControl: boolean;
  trainingCycle: 'mass' | 'cut' | 'maintenance' | 'endurance';
  cycleWeeks: number; previousCycles: number; timeSinceLastCycle: string;
}

// ─── Block 5: Hepatobiliary ───
export interface HepatobiliaryData {
  altAstElevation: string; ggtElevation: string; bilirubinElevation: string;
  fattyLiver: boolean; cholecystitis: boolean;
  alcoholHistory: string;
}

// ─── Block 6: Urinary ───
export interface UrinaryData {
  creatinineElevation: string; ureaElevation: string;
  proteinuria: boolean; nephrotoxicDrugs: boolean; hypertension: boolean; diabetes: boolean;
  urinationPattern: string;
}

// ─── Block 7: Cardiovascular ───
export interface CardiovascularData {
  bpStage: string; heartRate: number;
  ldlElevation: string; hdlLow: boolean; triglycerides: string;
  hctElevation: string; previousCVD: boolean; familyCVD: boolean;
}

// ─── Block 8: ODA ───
export interface ODAData {
  jointPain: string; ligamentIssues: boolean; backPain: boolean;
  injuries: string[];
}

// ─── Block 9: Lab Monitoring (3 slices, 4 panels) ───
export interface LabSlice {
  date: string;
  panelSex: Record<string, string>;
  panelBiochem: Record<string, string>;
  panelHematology: Record<string, string>;
  panelThyroid: Record<string, string>;
  panelLipid: Record<string, string>;
  panelIron: Record<string, string>;
  panelVitamin: Record<string, string>;
  panelCardiac: Record<string, string>;
  panelCoagulation: Record<string, string>;
  panelInflammatory: Record<string, string>;
  panelAdrenal: Record<string, string>;
  panelMineral: Record<string, string>;
  panelTumor: Record<string, string>;
  panelUrinalysis: Record<string, string>;
}

export interface LabPanelData {
  preCourse: LabSlice | null;
  midCourse: LabSlice | null;
  postPCT: LabSlice | null;
  fullPanel: LabSlice | null;
}

// ─── Block 10: Integrated Risk ───
export type RiskSystemId = 'cardio'|'hepatic'|'renal'|'neuro'|'endocrine'|'hematologic'|'reproductive'|'musculoskeletal';
export interface MechanismDetail { id: number; name: string; contribution: number; active: boolean; triggers: string[]; }
export interface SystemRisk { id: RiskSystemId; label: string; icon: string; rawScore: number; afterSupport: number; mechanisms: MechanismDetail[]; }

// ─── Block 11: Nutrition ───
export interface NutritionData {
  calories: number; proteinG: number; fatG: number; carbsG: number;
  waterL: number; saltIntake: string; omega3: boolean; fiberG: number;
  proteinGPerKg: number; sodiumMg: number; potassiumMg: number;
}

// ─── Block 12: Medical Contraindications ───
export interface ContraindicationsData {
  allergies: string;
  hasCVD: boolean; hasThrombophilia: boolean; hasGI: boolean; hasProstateIssues: boolean;
  hasDiabetes: boolean; hasEpilepsy: boolean; hasMentalIllness: boolean;
  hasLiverDisease: boolean; hasKidneyDisease: boolean;
}

// ─── Block 13: Negative Experience Journal ───
export interface NegativeExperience {
  substanceId: string;
  symptom: string;
  comment: string;
}
export interface ExperienceJournal {
  positive: Array<{ substanceId: string; marker: string; comment: string }>;
  negative: NegativeExperience[];
}

// ─── Epicrisis / Pharmacological History ───
export interface EpicrisisData {
  pastGyno: boolean; pastLibidoDrop: boolean; pastHctSpike: boolean;
  pastLiverIssues: boolean; pastKidneyIssues: boolean;
}

// ─── Toxic Load & Detox ───
export interface ToxicLoadData {
  hazardousWork: boolean; regularNSAIDs: boolean; otherHeavyDrugs: boolean;
  bowelFrequency: 'regular' | 'constipation';
}

// ─── Dental / Mineral ───
export interface DentalData {
  bleedingGums: boolean; looseTeeth: boolean; nightGrinding: boolean;
  boneFractures: boolean; cramps: boolean;
}

// ─── Genetic Polymorphisms ───
export interface GeneticData {
  cyp19a1: 'high' | 'normal' | 'unknown';
  srd5a2: 'hypersensitive' | 'normal' | 'unknown';
  arSensitivity: 'high' | 'normal' | 'low' | 'unknown';
  mthfr: 'c677t' | 'normal' | 'unknown';
}

// ─── GI Tract / Microbiome ───
export interface GIData {
  bloating: boolean; heartburn: boolean; diarrhea: boolean;
  constipation: boolean; diagnosedIBS: boolean;
  enzymeSupport: boolean; probioticUse: boolean;
}

// ─── Psychological Dependence ───
export interface PsychData {
  fearOfLoss: number;
  mirrorObsession: number;
  apathyOffCycle: number;
}

// ─── Injection Zone Monitoring ───
export interface InjectionData {
  glutes: string; quads: string; delts: string; localAreas: string;
}

// ─── Complete Calculator State ───
export interface CalculatorState {
  profile: UserProfileData;
  neuro: NeuroStatusData;
  pharma: PharmaStackData;
  goals: GoalsData;
  hepatobiliary: HepatobiliaryData;
  urinary: UrinaryData;
  cardio: CardiovascularData;
  oda: ODAData;
  labs: LabPanelData;
  nutrition: NutritionData;
  contraindications: ContraindicationsData;
  journal: ExperienceJournal;
  epicrisis: EpicrisisData;
  toxicLoad: ToxicLoadData;
  dental: DentalData;
  genetics: GeneticData;
  gi: GIData;
  psych: PsychData;
  injection: InjectionData;
  powerLevel: PowerLevel;
  courseWeek?: number;
  boostEnabled?: boolean;
  jointMode?: boolean;
  reproMode?: boolean;
  neuroMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  OUTPUT: CalculatorResult (результат движка)
// ═══════════════════════════════════════════════════════════════

export interface SynergyRecommendation {
  candidateId: string;
  candidateName: string;
  synergiesWith: string[];
  synergyScore: number;
  newSystemCoverage: number;
  totalSystemCoverage: number;
  reason: string;
  effect: string;
  severity: string;
}

export interface CalculatorResult {
  risk: { systems: SystemRisk[]; overallRaw: number; overallAfterSupport: number; timestamp: string };
  schedule: ScheduleItem[];
  selectedSubstances: string[];
  jointSubs?: string[];
  neuroSubs?: string[];
  synergyIdsUsed: SynergyId[];
  titrationApplied: Record<string, number>;
  labDeltas: LabDelta[];
  overallRiskBefore: number;
  overallRiskAfter: number;
  contraindicationAlerts: string[];
  negativeBlocks: string[];
  comparisonBeforeAfter: { system: string; before: number; after: number }[];
  timeline?: TimelineWeekData[];
  peakWeek?: number;
  selectedWeekRaw?: number;
  selectedWeekAfter?: number;
  synergyRecommendations?: SynergyRecommendation[];
  boostAdded?: string[];
  timestamp: string;
  /** Нутрициологические предупреждения */
  depletionWarnings?: Array<{ depleter: string; depleted: string; mechanism: string; severity: string; recommendation: string }>;
  ulWarnings?: Array<{ substanceId: string; currentDoseMg: number; ulMg: number; percentUL: number; risk: string; recommendation: string }>;
  dailyLoad?: Record<string, { totalMg: number; contributors: string[]; hasUL: boolean; ulMg?: number }>;
}

export interface TimelineWeekData {
  week: number;
  activeDrugs: string[];
  drugConcentrations: Record<string, number>;
  organPercents: Record<string, number>;
  organAfterPercents: Record<string, number>;
  overallRaw: number;
  overallAfter: number;
}

// ─── Schedule ───
export type TimeBlock = 'morning' | 'afternoon' | 'evening';
export interface ScheduleItem { substanceId: string; name: string; dose: string; timeBlock: TimeBlock; instructions: string; synergyGroup?: SynergyId; }

// ─── Lab Deltas ───
export interface LabDelta { marker: string; sliceValues: (string|undefined)[]; trend: 'stable'|'improving'|'worsening'|'critical'; }

// ─── Synergy_ID Groups ───
export type SynergyId =
  'HEPATIC_GSH'|'HEPATIC_BILE'|'CARDIO_LIPID'|'CARDIO_BP'|'CARDIO_ANTIAGG'
  |'RENAL_PROTECT'|'NEURO_DOPAMINE'|'NEURO_GABA'|'NEURO_SEROTONIN'
  |'IMMUNE'|'ANTIOXIDANT'|'METHYLATION'|'BONE_JOINT'|'ENDOCRINE'|'LIVER_DETOX'
  |'MAGNESIUM'|'ZINC'|'OMEGA3'|'VITAMIN_D'|'VITAMIN_B';

export const SYNERGY_ID_LABELS: Record<SynergyId, string> = {
  HEPATIC_GSH:'Глутатион', HEPATIC_BILE:'Желчеотток', CARDIO_LIPID:'Липиды',
  CARDIO_BP:'Давление', CARDIO_ANTIAGG:'Антиагреганты', RENAL_PROTECT:'Нефро',
  NEURO_DOPAMINE:'Дофамин', NEURO_GABA:'ГАМК', NEURO_SEROTONIN:'Серотонин',
  IMMUNE:'Иммунитет', ANTIOXIDANT:'Антиоксиданты', METHYLATION:'Метилирование',
  BONE_JOINT:'Кости/суставы', ENDOCRINE:'Эндокринная', LIVER_DETOX:'Детокс печени',
  MAGNESIUM:'Магний', ZINC:'Цинк', OMEGA3:'Омега-3', VITAMIN_D:'D3', VITAMIN_B:'B-комплекс',
};

export const SYNERGY_ID_SUBSTANCES: Record<SynergyId, string[]> = {
  HEPATIC_GSH:['nac','alpha_lipoic','tudca'], HEPATIC_BILE:['tudca','artichoke','bile_acids'],
  CARDIO_LIPID:['omega3','coq10','bergamot','red_yeast'], CARDIO_BP:['telmisartan','nebivolol','magnesium'],
  CARDIO_ANTIAGG:['aspirin','nattokinase','bromelain'], RENAL_PROTECT:['astragalus','celery_extract','potassium'],
  NEURO_DOPAMINE:['tyrosine','l_dopa','vitamin_b6','magnesium'], NEURO_GABA:['glycine','theanine','magnesium','gaba'],
  NEURO_SEROTONIN:['x5htp','vitamin_b6','magnesium','omega3'], IMMUNE:['vitamin_c','zinc','vitamin_d3','probiotics'],
  ANTIOXIDANT:['alpha_lipoic','vitamin_c','vitamin_e','glutathione'], METHYLATION:['betaine','folate','vitamin_b12','vitamin_b6'],
  BONE_JOINT:['vitamin_d3','vitamin_k2','calcium','magnesium','boron'], ENDOCRINE:['zinc','magnesium','vitamin_d3','boron','ashwagandha'],
  LIVER_DETOX:['nac','milk_thistle','alpha_lipoic','selenium'], MAGNESIUM:['magnesium'], ZINC:['zinc'],
  OMEGA3:['omega3'], VITAMIN_D:['vitamin_d3'], VITAMIN_B:['vitamin_b12','vitamin_b6','folate'],
};

export const TITRATION_RULES: Record<string, { doses: number[]; conditions: string[] }> = {
  telmisartan: { doses: [40,80,120], conditions: ['BP>130/80','BP>140/90','BP>160/100'] },
  nebivolol: { doses: [2.5,5,7.5], conditions: ['HR>75','HR>85','HR>95'] },
  anastrozole: { doses: [0.5,1,1.5], conditions: ['E2>80пмоль на 500+мг теста','E2>120пмоль','E2>150пмоль'] },
  cabergoline: { doses: [0.25,0.5,0.75], conditions: ['Пролактин>20нг/мл','Пролактин>35нг/мл','Пролактин>50нг/мл'] },
};

// ═══════════════════════════════════════════════════════════════
//  PLAN TYPES (из support-plan-engine.ts)
// ═══════════════════════════════════════════════════════════════

export interface PlanSubstance {
  id: string; name: string; doseMg: number; doseDisplay: string; timing: string;
  category: string[]; tier: string; targetSystems: string[];
  comment: string; mechanismReason: string;
  fromJoint: boolean; fromBoost: boolean;
}

export interface PlanMechanism {
  mechKey: string; mechLabel: string; systemLabel: string;
  substances: string[]; riskBefore: number; riskAfter: number;
}

export interface PlanResult {
  substances: PlanSubstance[];
  dosages: Record<string, { mg: number; timing: string }>;
  schedule: Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }>;
  systems: Record<string, { raw: number; net: number; mechanisms: string[] }>;
  mechanisms: PlanMechanism[];
  coveragePercent: number;
  synergyComment: string;
  monitoring: string[];
  specialInstructions: string[];
  riskDynamics: Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }>;
  overallRiskBefore: number;
  overallRiskAfter: number;
  labFindings: Array<{ marker: string; name: string; value: string; threshold: string; organ: string; suggestedSubs: string[] }>;
  uncoveredMechanisms: Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }>;
  coverageGaps: Array<{ system: string; label: string; raw: number; net: number; gapPercent: number }>;
  weekScale: number;
  stackRecommendations: StackRecommendation[];
  conflicts: Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string; mechanism: string; separationAdvice: string }>;
  riskBreakdown: Record<string, string[]>;
  /** Нутрициологические данные */
  depletionWarnings?: Array<{ depleter: string; depleterName: string; depleted: string; depletedName: string; mechanism: string; severity: string; recommendation: string }>;
  cumulativeLoad?: Array<{ nutrientId: string; nutrientName: string; totalMg: number; ulMg?: number; percentUL?: number; isOverUL: boolean; contributors: string[] }>;
  pillBurden?: { totalSubstances: number; estimatedPillsPerDay: number; morningPills: number; afternoonPills: number; eveningPills: number; feasibility: string; message: string };
}

export interface StackRecommendation {
  stack: any;
  score: number;
  coveragePercent: number;
  coveredSystems: string[];
  coveredMechanisms: string[];
  synergyBonus: number;
  wasteSubstances: string[];
  reason: string;
}

// ═══════════════════════════════════════════════════════════════
//  МЕТАДАННЫЕ СИСТЕМ (RU)
// ═══════════════════════════════════════════════════════════════

export const SYSTEM_LABELS_RU: Record<string, { name: string; emoji: string }> = {
  cardio:         { name: 'Сердечно-сосудистая', emoji: '❤️' },
  hepatic:        { name: 'Печень',               emoji: '🫁' },
  renal:          { name: 'Почки',                emoji: '💧' },
  neuro:          { name: 'Нервная система',      emoji: '🧠' },
  endocrine:      { name: 'Эндокринная',          emoji: '⚖️' },
  hematologic:    { name: 'Кроветворная',         emoji: '🩸' },
  reproductive:   { name: 'Репродуктивная',       emoji: '💪' },
  musculoskeletal:{ name: 'ОДА / Мышцы',          emoji: '🦴' },
  cns:            { name: 'Нервная система',      emoji: '🧠' },
};

export const SYS_ORDER: RiskSystemId[] = [
  'cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal',
];

// ═══════════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sysName(sys: string): string {
  return SYSTEM_LABELS_RU[sys]?.name
    || SYSTEM_LABELS_RU[sys === 'cns' ? 'neuro' : sys]?.name
    || sys;
}

export function sysEmoji(sys: string): string {
  return SYSTEM_LABELS_RU[sys]?.emoji
    || SYSTEM_LABELS_RU[sys === 'cns' ? 'neuro' : sys]?.emoji
    || '📌';
}

export function catalogEntry(id: string): any {
  return SUPPORT_CATALOG_DATA[id]
    || SUPPORT_CATALOG_DATA[id.toUpperCase()]
    || SUPPORT_CATALOG_DATA[id.toLowerCase()]
    || null;
}

export function defaultDosage(id: string): { mg: number; timing: string } | undefined {
  return DEFAULT_DOSAGES[id];
}

// ═══════════════════════════════════════════════════════════════
//  НУТРИЦИОЛОГИЧЕСКИЕ КОНСТАНТЫ (UL, depletion, t½, meal-context)
// ═══════════════════════════════════════════════════════════════

/** Верхний допустимый уровень потребления (UL) — суммарно из всех источников, мг/сут.
 *  Источники: EFSA 2024, IOM (NASEM), JECFA. */
export const NUTRIENT_UL: Record<string, number> = {
  zinc: 40,          // мг/сут (IOM 2001, EFSA 2006)
  magnesium: 350,    // мг/сут — только из добавок (не из пищи); диарея при превышении
  calcium: 2500,     // мг/сут (IOM 2011)
  iron: 45,          // мг/сут (IOM 2001)
  selenium: 400,     // мкг/сут (IOM 2000)
  vitamin_b6: 100,   // мг/сут (IOM 1998)
  vitamin_c: 2000,   // мг/сут (IOM 2000)
  vitamin_d3: 100,   // мкг/сут = 4000 МЕ (IOM 2011)
  vitamin_e: 1000,   // мг/сут альфа-токоферол (IOM 2000)
  vitamin_k2: 1000,  // мкг/сут (нет установленного UL, ориентир)
  vitamin_b12: 2000, // мкг/сут (нет UL, ориентир)
  folate: 1000,      // мкг/сут (IOM 1998)
  boron: 20,         // мг/сут (IOM 2001)
  potassium: 3700,   // мг/сут — только из добавок
  copper: 10,        // мг/сут (IOM 2001)
  iodine: 1100,      // мкг/сут (IOM 2001)
  manganese: 11,     // мг/сут (IOM 2001)
  molybdenum: 2000,  // мкг/сут (IOM 2001)
  chromium: 1000,    // мкг/сут (IOM 2001)
  nac: 2400,         // мг/сут (клинический ориентир; тошнота/головная боль)
  alpha_lipoic: 1800,// мг/сут (клинический ориентир; GI)
  coq10: 3000,       // мг/сут (клинический ориентир)
  betaine: 4000,     // мг/сут (клинический ориентир)
  glycine: 60000,    // мг/сут (~1 г/кг, клинический ориентир)
  taurine: 10000,    // мг/сут (клинический ориентир)
  inositol: 18000,   // мг/сут (клинический ориентир)
  curcumin: 8000,    // мг/сут (гепатотоксичность при >8g)
};

/** Каскады истощения: вещество X в высокой дозе → истощает Y.
 *  Каждая запись: [истощающее, истощаемое, порог мг/сут для истощения, механизм] */
export const DEPLETION_CASCADES: Array<{
  depleter: string; depleted: string; thresholdMg: number;
  mechanism: string; severity: 'HIGH' | 'MEDIUM' | 'LOW';
}> = [
  { depleter: 'zinc', depleted: 'copper', thresholdMg: 30, mechanism: 'Индукция металлотионеина в энтероцитах → связывание Cu → ↓ всасывания Cu на 50-70%', severity: 'HIGH' },
  { depleter: 'zinc', depleted: 'iron', thresholdMg: 50, mechanism: 'Конкуренция за DMT1-транспортёр в дуоденальных энтероцитах', severity: 'MEDIUM' },
  { depleter: 'calcium', depleted: 'magnesium', thresholdMg: 1000, mechanism: 'Конкуренция за парацеллюлярный транспорт в толстом кишечнике; Ca >1000 мг ↓ Mg на 30%', severity: 'MEDIUM' },
  { depleter: 'vitamin_d3', depleted: 'magnesium', thresholdMg: 0.1, mechanism: 'D3 активирует кальбиндин → ↑ потребность в Mg как кофакторе CYP2R1/CYP27B1; Mg расходуется на гидроксилирование', severity: 'MEDIUM' },
  { depleter: 'calcium', depleted: 'iron', thresholdMg: 500, mechanism: 'Ca ингибирует гемовое и негемовое всасывание Fe на 40-60% при совместном приёме', severity: 'HIGH' },
  { depleter: 'iron', depleted: 'zinc', thresholdMg: 25, mechanism: 'Конкуренция за DMT1; Fe >25 мг ↓ Zn всасывание на 30%', severity: 'MEDIUM' },
  { depleter: 'vitamin_c', depleted: 'copper', thresholdMg: 1500, mechanism: 'Аскорбат восстанавливает Cu²⁺→Cu⁺, снижая доступность для церулоплазмина', severity: 'LOW' },
  { depleter: 'omega3', depleted: 'vitamin_e', thresholdMg: 3000, mechanism: 'ПНЖК ↑ перекисное окисление → ↑ расход вит.E как антиоксиданта; соотношение 0.4-0.6 мг вит.E/г ПНЖК', severity: 'MEDIUM' },
  { depleter: 'selenium', depleted: 'zinc', thresholdMg: 0.4, mechanism: 'Селенометионин конкурирует с метионином → ↓ синтез MT → изменённый Zn-гомеостаз', severity: 'LOW' },
  { depleter: 'selenium', depleted: 'copper', thresholdMg: 0.8, mechanism: 'Высокие дозы Se ↑ синтез металлотионеина → связывание Cu', severity: 'MEDIUM' },
];

/** Категории периодов полувыведения для планирования кратности приёма. */
export type HalfLifeCategory = 'ultra_short' | 'short' | 'medium' | 'long' | 'ultra_long';
export const SUBSTANCE_HALF_LIFE: Record<string, HalfLifeCategory> = {
  nac: 'short',          // t½ ≈ 2h → 2-3×/день
  alpha_lipoic: 'short', // t½ ≈ 30min → 2-3×/день
  vitamin_c: 'short',    // t½ ≈ 30-60min → 2×/день
  theanine: 'short',     // t½ ≈ 1-3h → 2×/день
  tyrosine: 'short',     // t½ ≈ 1.5h → 2-3×/день
  x5htp: 'short',        // t½ ≈ 2h → 2×/день
  glycine: 'short',      // t½ ≈ 1-2h → 2×/день
  magnesium: 'short',    // t½ ≈ 4h → 2×/день
  zinc: 'medium',        // t½ ≈ 12h → 1-2×/день
  coq10: 'medium',       // t½ ≈ 33h → 1×/день (лучше 2× для ↑биодоступности)
  vitamin_b6: 'medium',  // t½ ≈ 3-4h → 2×/день
  vitamin_b12: 'long',   // t½ ≈ 6 дней → 1×/день
  vitamin_d3: 'long',    // t½ ≈ 25 дней → 1×/день
  vitamin_k2: 'short',   // t½ ≈ 1-2h → 2×/день
  omega3: 'long',        // t½ ≈ 37h → 1×/день
  ashwagandha: 'medium', // t½ ≈ 2-4h → 2×/день
  curcumin: 'short',     // t½ ≈ 2h → 2×/день
  berberine: 'short',    // t½ ≈ 0.5-1.5h → 3×/день
  milk_thistle: 'medium',// t½ ≈ 2-3h → 2-3×/день
  tudca: 'medium',       // t½ ≈ 4-8h → 2×/день
  melatonin: 'short',    // t½ ≈ 30-50min → 1×/день (на ночь)
  gaba: 'short',         // t½ ≈ 1h → 2×/день
  potassium: 'short',    // t½ ≈ 4h → 2×/день
  taurine: 'medium',     // t½ ≈ 1.5-3h → 2×/день
  inositol: 'short',     // t½ ≈ 3h → 2×/день
  folate: 'medium',      // t½ ≈ 3-4h → 2×/день
  selenium: 'long',      // t½ ≈ 20 дней → 1×/день
  betaine: 'short',      // t½ ≈ 0.5h → 2-3×/день
};

/** Множители биодоступности по форме (из SupportBioavailability). */
export const FORM_BIOAVAIL_MULT: Record<string, number> = {
  mg_oxide: 0.04, mg_citrate: 0.25, mg_glycinate: 0.45, mg_malate: 0.30,
  mg_threonate: 0.35, mg_taurate: 0.30, mg_chloride: 0.35, mg_sulfate: 0.10,
  zn_oxide: 0.20, zn_citrate: 0.45, zn_glycinate: 0.55, zn_picolinate: 0.50,
  zn_monomethionine: 0.50, zn_sulfate: 0.35, zn_gluconate: 0.40,
  ca_carbonate: 0.25, ca_citrate: 0.35, ca_malate: 0.30,
  fe_sulfate: 0.20, fe_bisglycinate: 0.45, fe_fumarate: 0.25,
  se_selenomethionine: 0.85, se_selenite: 0.50, se_selenate: 0.70,
  vitE_natural: 1.0, vitE_synthetic: 0.50,
  vitK2_mk4: 0.20, vitK2_mk7: 0.95,
  vitD3_oil: 0.80, vitD3_powder: 0.50,
  curcumin_standard: 0.02, curcumin_phytosome: 0.30, curcumin_liposomal: 0.50,
  coq10_ubiquinone: 0.05, coq10_ubiquinol: 0.25, coq10_liposomal: 0.50,
  omega3_ee: 0.70, omega3_tg: 0.85, omega3_pl: 0.95,
};

/** Рекомендуемый интервал между конкурентными минералами (часы). */
export const MINERAL_SEPARATION_HOURS: Record<string, number> = {
  'zinc||calcium': 2, 'zinc||iron': 2, 'zinc||magnesium': 1,
  'calcium||iron': 4, 'calcium||magnesium': 2, 'iron||magnesium': 2,
  'calcium||zinc': 2, 'iron||zinc': 2, 'magnesium||zinc': 1,
  'iron||calcium': 4, 'magnesium||calcium': 2, 'magnesium||iron': 2,
  'zinc||copper': 6,
};

/** Правила контекста приёма пищи для веществ. */
export interface MealContextRule {
  substanceId: string;
  requireWithFood: boolean;   // нужно с едой
  requireFat: boolean;         // нужно с жирной пищей
  emptyStomach: boolean;       // натощак
  avoidCa: boolean;            // не с кальцием/молочкой
  avoidFiber: boolean;         // не с клетчаткой
  avoidCaffeine: boolean;      // не с кофеином
}
export const MEAL_CONTEXT_RULES: MealContextRule[] = [
  { substanceId: 'vitamin_d3', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'vitamin_k2', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'coq10', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'omega3', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'curcumin', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'zinc', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: true, avoidFiber: true, avoidCaffeine: false },
  { substanceId: 'iron', requireWithFood: false, requireFat: false, emptyStomach: true, avoidCa: true, avoidFiber: true, avoidCaffeine: true },
  { substanceId: 'calcium', requireWithFood: false, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: true, avoidCaffeine: false },
  { substanceId: 'magnesium', requireWithFood: false, requireFat: false, emptyStomach: false, avoidCa: true, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'nac', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'tudca', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'berberine', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'vitamin_e', requireWithFood: true, requireFat: true, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'selenium', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
  { substanceId: 'potassium', requireWithFood: true, requireFat: false, emptyStomach: false, avoidCa: false, avoidFiber: false, avoidCaffeine: false },
];
