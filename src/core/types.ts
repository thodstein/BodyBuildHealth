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
  npPercent?: number;
  immotilePercent?: number;
  viabilityPercent?: number;
  dfi?: number;
  fructose?: number;
  zincMmol?: number;
  lh?: number;
  fsh?: number;
  tt?: number;
  ft?: number;
  e2?: number;
  prl?: number;
  shbg?: number;
  inhb?: number;
  amh?: number;
  prog?: number;
  varicocele?: 'none' | 'grade1' | 'grade2' | 'grade3';
}

export interface FertilityResult {
  ifScore: number;
  interpretation: string;
  forecast6w: number;
  forecast12w: number;
  spermIndex?: number;
  hormonalIndex?: number;
  structuralIndex?: number;
  warnings?: string[];
}

export interface InjuryRecord {
  id: string;
  type: 'joint' | 'muscle' | 'bone' | 'ligament' | 'tendon' | 'nerve';
  location: string;
  painLevel: number;
  movementLimit: 'none' | 'mild' | 'moderate' | 'severe' | 'full_restriction';
  side: 'left' | 'right' | 'both';
  chronic: boolean;
  date?: string;
  notes?: string;
}

export interface SupplementEntry {
  id: string;
  name: string;
  doseMg: number;
  doseUnit: 'mg' | 'mcg' | 'IU' | 'g';
  notes?: string;
}

export interface MedicationEntry {
  id: string;
  name: string;
  doseMg: number;
  doseUnit: 'mg' | 'mcg' | 'ml';
  frequency: 'daily' | '2x_day' | '1x_week' | 'prn';
  notes?: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  angle: 'front' | 'side' | 'back';
  blob?: Blob;
  supabaseUrl?: string;
  weightKg?: number;
  bodyFatPct?: number;
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
export interface PharmaSynergy {
  with: string;
  type: 'synergistic' | 'antagonistic' | 'complementary';
  desc: string;
}

export interface SideEffect {
  effect: string;
  frequency: 'common' | 'rare' | 'very_rare';
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
  synergies?: PharmaSynergy[];
  conflicts?: { with: string; effect: string; mechanism: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[];
  specialInstructions?: string[];
  contraindications?: string[];
  sideEffects?: SideEffect[];
  dosageRange?: { min: number; max: number; unit: string; frequency: string };
  // NEW: organ/system/mechanism/risk mapping
  targetSystems?: string[];
  targetMechanisms?: string[];
  linkedRisks?: { system: string; direction: 'up' | 'down' | 'both'; strength: number }[];
  linkedSubstances?: { id: string; type: 'synergy' | 'anti_synergy'; mechanism: string; strength: number }[];
  cvProfile?: {
    bloodPressure: 'up' | 'down' | 'neutral';
    heartRate: 'up' | 'down' | 'neutral';
    vascularTone: 'constrict' | 'dilate' | 'neutral';
    thrombosisRisk: 'low' | 'medium' | 'high';
    cnsLoad: 'low' | 'medium' | 'high';
  };
  labMarkers?: string[];
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
export interface MechanismCell {
  raw: number;
  net: number;
  coverage: number;
  contributors: string[];
  mitigations: { substance: string; reduction: number }[];
}

export interface RiskResult {
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  mechanismBreakdown?: Record<string, number>;
  mechanismDetail?: Record<string, MechanismCell>;
  coverageMap?: Record<string, number>;
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
  archived?: boolean;
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
      dateOfBirth?: string;
      age?: number;
      sex: 'male' | 'female';
      ethnicity?: string;
      height?: number;
      weight: number;
      bodyFat?: number;
      waistCm?: number;
      neckCm?: number;
      chestCm?: number;
      hipCm?: number;
      forearmCm?: number;
      bicepCm?: number;
      thighCm?: number;
      
       // Goals and objectives
       primaryGoal?: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'endurance' | 'recomposition' | 'fitness' | 'health' | 'hypertrophy' | 'rehab';
       goal?: string;
       phase?: string;
       courseStartDate?: string;
       secondaryGoals?: ('bulk' | 'cut' | 'maintenance' | 'strength' | 'endurance' | 'recomposition' | 'fitness' | 'health' | 'hypertrophy' | 'rehab')[];
      targetWeight?: number;
      targetBodyFat?: number;
      goalTimelineWeeks?: number;
      
      baselineSleepHours?: number;
      baselineSleepQuality?: number;
      baselineHrvRatio?: number;
      baselineStressLevel?: number;
      fatigueLevel?: number;
      dailySteps?: number;
      dailyWaterLiters?: number;
      nightAwakenings?: number;
      bedtime?: string;
      wakeTime?: string;
      chronotype?: 'lark' | 'owl' | 'mixed';
      trainingLevel?: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
      workoutsPerWeek?: number;
      avgWorkoutMinutes?: number;
      pharmaExperience?: 'none' | 'beginner' | 'intermediate' | 'advanced';
      
      typicalLabValues?: Record<string, number>;
      
      strengthBaselines?: Record<string, number>;
      enduranceBaselines?: Record<string, number>;
      
      currentSupplements?: SupplementEntry[];
      currentMedications?: MedicationEntry[];
      allergies?: string[];
      medicalConditions?: string[];
      injuries?: InjuryRecord[];
      weakPoints?: string[];

      dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
      foodAllergies?: string[];
      foodIntolerances?: string[];
      excludedFoods?: string[];
      preferredFoods?: string[];
      dietRestrictions?: string[];
      mealsPerDay?: number;
      cookingSkill?: 'none' | 'basic' | 'intermediate' | 'advanced';

       genetics?: Record<string, string>;

       email?: string;

      nutritionFactor?: number;
      trainingFactor?: number;
      

      // Nutrition inputs for V7 risk engine
      proteinPerKg?: number;      // g/kg bodyweight (default 1.8)
      fiberG?: number;             // g/day (default 25)
      omega3G?: number;            // g/day (default 1.5)
      sodiumG?: number;            // g/day (default 3.5)
      potassiumG?: number;         // g/day (default 3.0)
      alcoholPerWeek?: number;     // standard drinks/week (default 0)
      smoke?: boolean;             // smoking status (default false)
      totalCycles?: number;        // number of completed AAS cycles
      hasHIIT?: boolean;          // includes HIIT in training
      volumeTonnes?: number;      // weekly training volume in tonnes
      lissMinutesPerWeek?: number;// low-intensity steady state min/week
      sleepHours?: number;        // actual sleep hours
      stressLevel?: number;       // 1-10 stress level
      activityLevel?: number;     // 1-10 activity level
      preferredUnits?: 'metric' | 'imperial';
      notificationsEnabled?: boolean;
      privacyLevel?: 'private' | 'friends' | 'public';
      
      // Penalty override flags (manual user choice)
      forceNoLabsPenalty?: boolean; // Force apply penalty when no labs are entered
      mcRuns?: number; // Monte Carlo simulation runs (0 = disabled, 50+ = enabled)
      
      // Extended profile fields
      sportType?: string;           // bodybuilding, powerlifting, crossfit, fitness, other
      trainingExperience?: number;  // years of training
      bloodType?: string;          // I+, I-, II+, II-, III+, III-, IV+, IV-
      allergyNotes?: string;       // free-text allergies
      chronicConditions?: string[]; // hypertension, diabetes, asthma, etc
      emergencyName?: string;      // emergency contact name
      emergencyPhone?: string;     // emergency contact phone
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
  micros?: Record<string, number>;
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
  chronotype?: 'lark' | 'owl' | 'mixed';
  bedtime?: string;
  wakeTime?: string;
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

export interface BlockDefinition {
  id: string;
  name: string;
  durationWeeks: number;
  primaryQuality: 'volume' | 'intensity' | 'peak';
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirTarget: string;
  frequencyMod: number;
  exerciseRotation: boolean;
  deconditioningRisk: string;
}

export interface TrainingInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  recovery: number;
  fatigue: number;
  nutrition: number;
  weakPoints: string[];
  injuries?: InjuryRecord[];
  experience?: string;
  sessionDuration?: number;
  rir?: number;
  exercises?: Exercise[];
  splitType?: string;
  periodizationType?: 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate';
  cycleType?: string;
  blockSequence?: BlockDefinition[];
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
  periodizationType?: string;
  progressionModel?: string;
}

export type IntensityTechnique =
  | 'straight_set'
  | 'superset'
  | 'rest_pause'
  | 'cluster'
  | 'myo_rep'
  | 'drop_set'
  | 'backoff_set'
  | 'forced_rep'
  | 'negative'
  | 'pre_exhaust'
  | 'post_exhaust'
  | 'giant_set'
  | 'pyramid';

export interface SetFormat {
  technique: IntensityTechnique;
  exercises: string[];
  restBetweenExercises?: number;
  intraSetRest?: number;
  activationReps?: number;
  miniSetReps?: number;
  miniSetRestSeconds?: number;
  clusterReps?: string;
  dropWeightPct?: number;
  negativeTempo?: string;
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
  targetMuscle?: string;
  order?: number;
  substitutionGroup?: string;
  canReplace?: string[];
  cannotReplace?: string[];
  technique?: string;
  pauseSeconds?: number;
  peakContraction?: boolean;
  stretchPhase?: boolean;
  dropSet?: boolean;
  dropSetReps?: string;
  backoffSet?: boolean;
  setFormat?: SetFormat;
  comments?: string;
}

export interface ExerciseSubstitution {
  exerciseId: string;
  substitutes: { id: string; reason: string; priority: number }[];
  forbidden?: { id: string; reason: string }[];
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

export interface StrengthLogEntry {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  sets: { weight: number; reps: number; rir: number; rpe?: number }[];
  totalVolume: number;
  estimated1RM: number;
  isCompound: boolean;
  weekNumber?: number;
  mesocycleId?: string;
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  date: string;
  duration: number;
  exercises: StrengthLogEntry[];
  overallRPE: number;
  recoveryBefore: number;
  split: string;
  weekNumber?: number;
  mesocycleId?: string;
  notes?: string;
}

// ══ Training Domain — New Types (ULTRA) ══

export type MovementPattern =
  | 'squat' | 'hinge' | 'horizontal_push' | 'horizontal_pull'
  | 'vertical_push' | 'vertical_pull' | 'lunge' | 'carry'
  | 'rotation' | 'anti_rotation' | 'core';

export type ExerciseSlotRole = 'main' | 'secondary' | 'accessory' | 'rehab' | 'warmup';

export interface ExerciseSlot {
  slotType: ExerciseSlotRole;
  exerciseId: string;
  variationId?: string;
  pattern: MovementPattern;
  equipment: string[];
  riskScore: number;
  techniqueMatchScore: number;
  targetWeakPoint?: string;
  targetMuscle?: string;
}

export type RepPatternType = 'normal' | 'pause' | 'cluster' | 'rest_pause' | 'tempo' | 'explosive' | 'slow' | 'partial';

export interface RepPatternConfig {
  pattern: RepPatternType;
  minReps: number;
  maxReps: number;
  restBetweenRepsSec?: number;
  pausePosition?: 'bottom' | 'top' | 'mid';
  pauseSec?: number;
}

export interface TempoProfile {
  eccentricSec: number;
  pauseBottomSec: number;
  concentricSec: number;
  pauseTopSec: number;
  label: string;
}

export type SetSchemeType =
  | 'straight' | 'pyramid' | 'reverse_pyramid' | 'top_backoff'
  | 'wave' | 'cluster' | 'emom' | 'density' | 'myo_rep';

export interface SetScheme {
  schemeType: SetSchemeType;
  totalSets: number;
  workingSets: number;
  progressionModel: 'linear' | 'double' | 'autoregulated' | 'rpe';
  metadata: Record<string, number>;
}

export interface WarmupBlock {
  type: 'general' | 'mobility' | 'activation' | 'specific';
  durationSec: number;
  exercises: { exerciseId: string; sets: number; reps: number; intensityPct?: number }[];
  notes?: string;
}

export interface CooldownBlock {
  type: 'stretch' | 'breathing' | 'mobility';
  durationSec: number;
  exercises: { exerciseId: string; durationSec: number }[];
}

export interface ExerciseOrderItem {
  exerciseId: string;
  role: ExerciseSlotRole;
  pattern: MovementPattern;
  difficulty: number;
  jointStress: number;
  priorityScore: number;
  rationale: string;
}

export interface NutritionDiaryEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: { foodId: string; name: string; weight: number; kcal: number; p: number; f: number; c: number; fiber?: number }[];
  totalKcal: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
}
