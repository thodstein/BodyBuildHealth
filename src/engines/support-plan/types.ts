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
}

// ═══════════════════════════════════════════════════════════════
//  OUTPUT: CalculatorResult (результат движка)
// ═══════════════════════════════════════════════════════════════

export interface CalculatorResult {
  risk: { systems: SystemRisk[]; overallRaw: number; overallAfterSupport: number; timestamp: string };
  schedule: ScheduleItem[];
  selectedSubstances: string[];
  jointSubs?: string[];
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
  timestamp: string;
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
  conflicts: Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string }>;
  riskBreakdown: Record<string, string[]>;
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
