export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InteractionType = 'synergy' | 'conflict' | 'danger' | 'caution';
export type Onset = 'fast' | 'medium' | 'slow';
export type Decay = 'fast' | 'medium' | 'slow' | 'very_slow';
export type DoseResponse = 'linear' | 'sigmoid';

export interface DoseRequest {
  targetDoseMg?: number;
  bodyWeightKg?: number;
  targetDosePerKg?: number;
  concentrationMgPerMl: number;
  roundingStepMl?: number;
  syringeVolumeMl: number;
  vialVolumeMl?: number;
  divisionsPerMl?: number;
}

export interface DoseResult {
  volumeMl: number;
  divisions: number;
  dosesPerVial: number;
  flags: string[];
}
export type Route = 'oral' | 'sc' | 'intranasal' | 'im' | 'iv' | 'topical';

export interface MechanismWeight { name: string; weight: number; }
export interface OrganWeight { name: string; weight: number; }
export interface RiskWeight { name: string; weight: number; }
export interface SynergyFactor { effect: string; factor: number; }
export interface AntagonistFactor { effect: string; factor: number; }
export interface Duration { onset: Onset; peak: string; halfLife: string; decay: Decay; }
export interface PKPD { emax: number; ec50: number; doseResponse: DoseResponse; tissueDistribution: Record<string, number>; receptorAffinity: Record<string, number>; metabolism: string[]; elimination: string[]; }

export interface EffectEntry {
  id: string;
  effect: string;
  class: string;
  group: string;
  strengthBase: number;
  strengthMax: number;
  mechanisms: MechanismWeight[];
  organs: OrganWeight[];
  risks: RiskWeight[];
  synergy: SynergyFactor[];
  antagonists: AntagonistFactor[];
  duration: Duration;
  pkpd: PKPD;
  coverage: Record<string, number>;
  coverageScore: number;
  riskScore: number;
}
export interface SubstanceEntry {
  id: string;
  name: string;
  category?: string;
  route?: Route[];
  effects?: { effect: string; strength: number }[];
  tHalfHours?: number;
  bioavailability?: Record<string, { min: number; max: number; avg: number }>;
  mechanisms?: string[];
  risks?: string[];
  description?: string;
}
export interface InteractionEntry {
  substanceA: string;
  substanceB: string;
  type: InteractionType;
  severity: number;
  mechanisms: string[];
  description: string;
}
export interface GoalProfile {
  id: string;
  effectPriority: Record<string, number>;
  preferredGroups: string[];
  avoidGroups: string[];
  intensity: number;
}
export interface StackTemplate {
  id: string;
  description: string;
  rules: { minSubstances: number; maxSubstances: number; minEffects: number; maxEffects: number; allowConflicts: boolean; synergyMin: number; preferred_groups_boost?: number };
}
export interface StackEntry {
  id: string;
  effects: string[];
  substances: string[];
  synergyScore: number;
}

export interface AnalysisEntry {
  id: string;
  name: string;
  units: string;
  normalRange: [number, number];
  organTargets: string[];
  systemTargets: string[];
  mechanismsUp: string[];
  mechanismsDown: string[];
  riskIfHigh: string[];
  riskIfLow: string[];
}
export interface OrganEntry {
  id: string;
  name: string;
  systems: string[];
  description: string;
  keyBiomarkers: string[];
  riskTags: string[];
}
export interface SystemEntry {
  id: string;
  name: string;
  organs: string[];
  description: string;
  keyBiomarkers: string[];
  riskTags: string[];
}
export interface MechanismEntry {
  id: string;
  name: string;
  level: number;
  category?: string;
  description: string;
  organs: string[];
  systems: string[];
  biomarkers: string[];
  effectsPositive: string[];
  effectsNegative: string[];
  riskWeight: number;
}
export interface AxisEntry {
  id: string;
  name: string;
  organs: string[];
  description: string;
  mechanismUp: string;
  mechanismDown: string;
  riskUp: string;
  riskDown: string;
  pathway?: string;
  tags?: string[];
  type?: string;
}
export interface RiskEntry {
  id: string;
  title: string;
  text: string;
  level: Severity;
  triggerType: string;
  recId?: string;
}
export interface RecommendationEntry {
  recId: string;
  type: string;
  riskId: string;
  level: Severity;
  title: string;
  text: string;
}
export interface TagEntry {
  id: string;
  type: string;
  name: string;
}
export interface BrandEntry {
  id: string;
  name: string;
  country: string;
  description: string;
  tag: string;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
  water: number;
  fiber: number;
  micros: Record<string, number>;
}

export interface AliasMap { [key: string]: string; }
export interface GroupMap { [key: string]: string[]; }

export interface MasterDB {
  effects: EffectEntry[];
  substances: SubstanceEntry[];
  interactions: InteractionEntry[];
  goals: GoalProfile[];
  stackTemplates: StackTemplate[];
  stacks: StackEntry[];
  analyses: AnalysisEntry[];
  organs: OrganEntry[];
  systems: SystemEntry[];
  mechanisms: MechanismEntry[];
  axes: AxisEntry[];
  risks: RiskEntry[];
  recommendations: RecommendationEntry[];
  tags: TagEntry[];
  bands: BandEntry[];
  brands: BrandEntry[];
  aliases: AliasMap;
  substanceGroups: GroupMap;
  effectGroups: GroupMap;
  synergyMatrix: Record<string, Record<string, number>>;
  conflictMatrix: Record<string, Record<string, number>>;
}

export interface PK {
  ka: number;
  k10: number;
  k12: number;
  k21: number;
  Vd: number;
  bioavailability: number;
  halfLifeHours: number;
}
export interface PD {
  AR_affinity: number;
  aromatization: number;
  five_alpha_reduction: number;
  progestogenic: number;
  hepatotoxicity: number;
  lipid_impact: number;
  hct_impact: number;
  neuro_toxicity: number;
}


export interface FertilityInput {
  volumeMl: number;
  concentrationMlMln: number;
  totalCountMln: number;
  prPercent: number;
  morphologyPercent: number;
  ph: number;
  viscosity?: boolean;
  marPercent?: number;
  leukocytesMlMln?: number;
  agglutination?: boolean;
}

export interface FertilityResult {
  ifScore: number;
  interpretation: string;
  forecast6w: number;
  forecast12w: number;
}


export interface GamificationState {
  diaryFillRate: number;
  nutritionAdherence: number;
  labMatchRate: number;
  trainerFeedback: number;
  xp?: number;
}

export interface TrustResult {
  score: number;
  level: string;
  volumeMultiplier: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  condition: (state: GamificationState) => boolean;
  xp: number;
}

/* Missing interfaces */
export interface ExportData {
  readiness: any[];
  labs: LabPoint[];
}
export interface PharmaSubstance {
  id: string;
  name: string;
  category?: string;
  route?: Route[];
  effects?: { effect: string; strength: number }[];
  tHalfHours?: number;
  bioavailability?: Record<string, { min: number; max: number; avg: number }>;
  mechanisms?: string[];
  risks?: string[];
  description?: string;
  class: string;
     esters?: string[];
  pk: PK;
  pd: PD;
  ec50: number;
  n_hill: number;
  maxEffect: number;
}
export interface UserContext {
  id?: string;
  role?: UserRole;
  phase?: string;
  courseStartDate?: string;
  settings?: any;
}
export interface BayesianState {
  mean?: number;
  variance?: number;
  clearanceK?: number;
  ec50Shift?: number;
  lastUpdateWeek?: number;
}
export interface RiskResult {
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  mechanismBreakdown?: Record<string, number>;
}

export interface RiskInput {
   genetics?: Record<string, string>;
   nutritionFactor?: number;
   trainingFactor?: number;
   activeDrugs?: Record<string, { dosePerWeek: number }>;
   supportCoverage?: Record<string, number>;
   // MRR/HGI/RIR fields for enhanced risk calculation
   biomarkerValues?: Record<string, number>;      // Current biomarker values normalized to optimal=1.0
   hgiMarkers?: Record<string, number>;         // Hemostasis/Immune function markers
   interventionResponse?: number;               // 0-1 scale of intervention effectiveness
   overallBiomarkerValue?: number;              // Overall biomarker composite
   overallHgiMarkers?: Record<string, number>;  // Overall HGI markers
   overallInterventionResponse?: number;        // Overall intervention response
}
export interface LabPoint {
  id: string;
  code: string;
  name: string;
  value: number;
  unit: string;
  date: string;
  phase: string;
  source?: string;
  patientId?: string;
}
export interface CourseEntry {
  id: string;
  substanceId: string;
  doseValue: number;
  doseUnit: string;
  frequency: number | string;
  startWeek: number;
  endWeek: number;
}
export type UserRole = 'user' | 'coach' | 'doctor' | 'admin' | 'editor';
export type LabPhaseType = 'baseline' | 'course' | 'bridge' | 'pct';
export interface UserProfile {
   id: string;
   name: string;
   role: UserRole;
   settings: {
     // Demographics
     dateOfBirth?: string; // YYYY-MM-DD format
     age?: number; // Calculated from dateOfBirth if provided
     sex: 'male' | 'female';
     ethnicity?: string;
     height?: number; // in cm
     weight: number; // in kg
     bodyFat?: number; // percentage
     
      // Goals and objectives
      primaryGoal?: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'endurance' | 'recomposition' | 'fitness' | 'health';
      goal?: string; // legacy / shorthand
      phase?: string; // e.g. baseline, course, bridge, pct
      courseStartDate?: string;
      secondaryGoals?: ('bulk' | 'cut' | 'maintenance' | 'strength' | 'endurance' | 'recomposition' | 'fitness' | 'health')[];
     targetWeight?: number; // target weight in kg
     targetBodyFat?: number; // target body fat percentage
     goalTimelineWeeks?: number; // weeks to achieve goal
     
     // Readiness and recovery baselines (used when current data not available)
     baselineSleepHours?: number;
     baselineSleepQuality?: number; // 0-1 scale
     baselineHrvRatio?: number; // HRV ratio baseline
     baselineStressLevel?: number; // 0-10 scale
     
     // Lab baselines (typical values for user when no data available)
     typicalLabValues?: Record<string, number>; // lab code -> typical value
     
     // Fitness and strength baselines
     strengthBaselines?: Record<string, number>; // exercise -> weight/reps
     enduranceBaselines?: Record<string, number>; // activity -> time/distance
     
     // Supplementation and medication summary
     currentSupplements?: string[]; // list of supplement names
     currentMedications?: string[]; // list of medication names
     allergies?: string[]; // known allergies
     medicalConditions?: string[]; // known medical conditions
     
      // Genetics / SNP data
      genetics?: Record<string, string>;

      // Contact
      email?: string;

      // Lifestyle factors
     nutritionFactor?: number; // 0-2 scale (0.5 = poor, 1.0 = average, 1.5 = good)
     trainingFactor?: number; // 0-2 scale (0.5 = poor, 1.0 = average, 1.5 = good)
     
     // Preferences and settings
     preferredUnits?: 'metric' | 'imperial';
     notificationsEnabled?: boolean;
     privacyLevel?: 'private' | 'friends' | 'public';
   };
}

export interface Article {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  likes: number;
  views: number;
  isPinned: boolean;
  status: ArticleStatus;
  authorId: string;
  authorName?: string;
  category?: string;
  title: string;
  teaser: string;
  tags: string[];
  content: string;
  publishedAt?: string;
}

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export type GoalId = string;

export interface CorrelationInput {
  labs: { code: string; value: number }[];
  symptoms: string[];
  readiness: { recovery: number; nutrition: number };
  risks: {
    systemBreakdown: Record<string, { net: number }>;
    overallNet: number;
  };
}

export interface CorrelationOutput {
  actions: {
    id: string;
    title: string;
    impact: string;
    effort: string;
    reason: string;
  }[];
  flags: string[];
}

export interface DiagnosticEntry {
  id: string;
  name: string;
  value?: number;
  unit?: string;
  date?: string;
  type?: string;
  findings?: string;
  keyMetrics?: Record<string, number>;
}




export interface BandEntry {
  id: string;
  name: string;
  country: string;
  description: string;
  tag: string;
}

export interface ParsedLabData {
  marker: string;
  value: number;
  unit: string;
  confidence?: number;
  rawText?: string;
  code?: string;
  name?: string;
  date?: string;
  source?: string;
}

export interface LabCheckpoint {
  id: string;
  type: string;
  weekOffset: number;
  status: string;
  dueDate: string;
  requiredMarkers: string[];
}

export interface PenaltyResult {
  score: number;
  missingLabs: string[];
  missingDiagnostics: string[];
  action: string;
  affectsTrust: boolean;
}

export interface PurchaseOption {
  platform: string;
  url: string;
  price: number;
  currency: string;
  deliveryDays: number;
  offerId?: string;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  category: string;
  dailyDose?: string;
  mechanisms?: string[];
  synergy?: string;
  purchaseOptions: PurchaseOption[];
}

export interface NutritionInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  pal: number;
  goal: string;
  bodyFatPercent?: number;
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
  fiber?: number;
  water?: number;
  steps?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber?: number;
  water?: number;
  serving?: number;
  unit?: string;
}

export interface ReadinessInput {
  sleepHours: number;
  sleepQuality: number;
  nightAwakenings: number;
  hrvRatio: number;
  doms: number;
  stress: number;
  riskCoverageMap?: Record<string, number>;
  calRatio: number;
  proteinRatio: number;
  waterRatio: number;
  fiberRatio: number;
  omega3Flag?: boolean;
  trainingLoadRatio: number;
  subjFatigue: number;
  hrIncrease: number;
  recovery?: number;
  nutrition?: number;
  support?: number;
  fatigue?: number;
}

export interface ReadinessScores {
  recovery: number;
  nutrition: number;
  support: number;
  fatigue: number;
  isConservative?: boolean;
  conservativeReason?: string;
  stress?: number;
  sleep?: number;
  timestamp?: string;
}

export interface TrainingInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  recovery: number;
  fatigue: number;
  nutrition: number;
  weakPoints: string[];
  injuries?: string[];
  experience?: string;
  sessionDuration?: number;
  rir?: number;
  exercises?: Exercise[];
}

export interface TrainingOutput {
  splitName: string;
  splitDesc: string;
  volumePerGroup: Record<string, number>;
  rir: string;
  isDeload: boolean;
  deloadReason: string;
  weekPlan: string;
  plan?: TrainingDay[];
  weeklyVolume?: number;
  estimatedProgress?: number;
}

export interface Exercise {
  id: string;
  name: string;
  group: string;
  type: string;
  equipment: string;
  difficulty: string;
  jointStress: string;
  fatigueCost: number;
  sets?: number;
  reps?: number;
  rest?: number;
  weight?: number;
  rir?: number;
}

export interface TrainingDay {
  day: number;
  name: string;
  exercises: Exercise[];
  duration: number;
  intensity: number;
}

export interface ConcentrationPoint {
  week: number;
  cp: number;
  tol: number;
  effect: number;
}

export interface LabHysteresis {
  history: number[];
  baseline: number;
  tauDays: number;
}

export interface DynamicRefRange {
  code: string;
  baselineMin: number;
  baselineMax: number;
  courseMin: number;
  courseMax: number;
  pctMin: number;
  pctMax: number;
  bridgeMin: number;
  bridgeMax: number;
  baseULN: number;
  baseLLN: number;
  ageFactor: (age: number) => number;
  sexFactor: (sex: 'male' | 'female') => number;
  phaseFactor: (phase: string) => number;
}

export interface PCTSchedule {
  startDate: string;
  taperWeeks: { week: number; drugId: string; dosePercent: number; note: string }[];
  pctStartWeek: number;
  pctProtocol: { drug: string; dose: string; durationWeeks: number; startDayOffset: number }[];
  supportStack: { id: string; name: string; dose: string; durationWeeks: number }[];
  warnings: string[];
}

export interface PCTWeek {
  week: number;
  substances: { id: string; name: string; dose: string; frequency: string }[];
  notes?: string;
}

export interface RiskCalculationResult {
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  mechanismBreakdown: Record<string, number>;
  liver?: number;
  kidney?: number;
  glucose?: number;
  lipids?: number;
  hormones?: number;
  coverageMap?: Record<string, number>;
}

export interface Article {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  likes: number;
  views: number;
  isPinned: boolean;
  status: ArticleStatus;
  authorId: string;
  authorName?: string;
  category?: string;
  title: string;
  teaser: string;
  tags: string[];
  content: string;
  publishedAt?: string;
}
