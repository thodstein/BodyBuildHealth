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
  refLow?: number;
  refHigh?: number;
  isAbnormal?: boolean;
}
export interface CourseEntry {
  id: string;
  substanceId: string;
  doseValue: number;
  doseUnit: string;
  frequency: number | string;
  startWeek: number;
  endWeek: number;
  startDate?: string;
  injectionDays?: number[];
}
export type UserRole = 'user' | 'coach' | 'doctor' | 'admin' | 'editor';
export type LabPhaseType = 'baseline' | 'course' | 'bridge' | 'pct';
export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  settings: UnifiedSettings & Record<string, any>;
}

/**
 * Единая структура данных пользователя — каждое поле существует ровно один раз.
 * Все потребители (тренировки, питание, риски, поддержка) читают отсюда.
 * Дневниковые/временные данные остаются в localStorage (сон, давление, инъекции, замеры, симптомы).
 */
export interface UnifiedSettings {
  // ─────────── 1. ЛИЧНЫЕ ДАННЫЕ ───────────
  personal: {
    age: number;
    sex: 'male' | 'female';
    height: number;           // см
    weight: number;           // кг — один для всех модулей
    bodyFat: number;          // % — один для тренировок/питания/рисков
    bloodType: string;        // I+, I-, II+, II-, III+, III-, IV+, IV-
    ethnicity?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    /** Girth fields (backward compat, will move to measurements log) */
    waistCm?: number;
    neckCm?: number;
    chestCm?: number;
    hipCm?: number;
    bicepCm?: number;
    thighCm?: number;
    forearmCm?: number;
    /** Антропометрия для геометрии техники (жим: длинные руки → уже хват; короткие → шире) */
    armSpanCm?: number;       // размах рук
    shoulderWidthCm?: number; // ширина плеч (биакром.)
    femurLengthCm?: number;   // длина бедра (для приседа/тяги)
    torsoLengthCm?: number;   // длина торса
    /** Предпочтения геометрии жима (перекрывают автоподсказку): 'auto' | 'narrow' | 'wide' etc. */
    benchGeometryPrefs?: {
      gripWidth?: 'auto' | 'narrow' | 'medium' | 'wide';
      elbowFlare?: 'auto' | 'tucked' | 'moderate' | 'flared';
      archLevel?: 'auto' | 'flat' | 'moderate' | 'high';
    };
  };

  // ─────────── 2. ТРЕНИРОВКИ ───────────
  training: {
    sportType: 'bodybuilding' | 'powerlifting' | 'crossfit' | 'fitness' | 'other';
    experience: number;           // лет стажа
    level: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
    daysPerWeek: number;
    minutesPerSession: number;
    primaryGoal: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'hypertrophy' | 'rehab' | 'recomposition' | 'health';
    weakPoints: string[];         // отстающие группы мышц
    pmSquat: number;              // 1RM присед
    pmBench: number;              // 1RM жим
    pmDeadlift: number;           // 1RM становая
    workMax: Record<string, number>;  // рабочие ПМ по группам (производное из workMaxByExercise)
    workMaxByExercise?: Record<string, number>;  // рабочие ПМ по конкретным упражнениям (id из EXERCISE_CATALOG)
    equipment: string[];          // доступный инвентарь
    recovery: number;             // 1-10
    motivation: number;           // 1-10
    doms: number;                 // 1-10
    favoriteExercises?: string[]; // любимые упражнения (id из EXERCISE_CATALOG)
    excludedExercises?: string[]; // исключённые упражнения (id из EXERCISE_CATALOG)
    avoidAxialLoad?: boolean;     // избегать осевой нагрузки на позвоночник
    loadStrategy?: string;        // стратегия прогрессии весов
    bodyweightCapability?: {      // способность к bodyweight-упражнениям
      pullUpsStrict?: number;
      chinUpsStrict?: number;
      dipsStrict?: number;
      pushUpsStrict?: number;
      weightedPullUpLoad?: number;
      assistedPullUpLoad?: number;
    };
    // График тренировок для привязки рациона к тренировке (планировщик питания).
    // 'weekly' — фиксированные дни недели; 'eod' — через день; 'pattern' — цикл work/off.
    schedule?: {
      enabled: boolean;           // привязать рацион к тренировке
      startTime: string;          // 'HH:MM' начало тренировки
      endTime: string;            // 'HH:MM' конец тренировки
      weeklyDays: boolean[];      // 7 элементов (Пн..Вс) для 'weekly'
      scheduleType: 'weekly' | 'eod' | 'pattern';
      pattern: { work: number; off: number }; // для 'pattern' (например 2+1)
    };
  };

  // ─────────── 3. ФАРМА / КУРС ───────────
  pharma: {
    phase: 'baseline' | 'course' | 'bridge' | 'pct' | 'post_pct' | 'fertility';
    courseStartDate: string;      // YYYY-MM-DD
    experience: 'none' | 'beginner' | 'intermediate' | 'advanced';
    totalCycles: number;
    yearsOnGear: number;
    monthsSinceLastCourse: number;
    hcgEnabled: boolean;
    aiEnabled: boolean;
    trainingCycleType: 'mass' | 'cut' | 'maintenance' | 'endurance';
    trainingCycleWeeks: number;
    previousCycles: number;
    timeSinceLastCycle: 'none' | '1-3mo' | '3-6mo' | '6-12mo' | '1y+';
    currentSubstances: PharmaSubstanceEntry[];
    // v6: дозы PED и флаги для калькулятора поддержки (ЭТАП 2)
    hasCaber?: boolean;
    hasGH?: boolean;
    hasIGF?: boolean;
    hasInsulin?: boolean;
    hasSERM?: boolean;
    hasSARMs?: boolean;
    hasMGF?: boolean;
    hasGLP1?: boolean;
    ghIU?: number;            // МЕ/день
    insulinIU?: number;       // МЕ/день
    igfMcg?: number;          // мкг/день
    clenMcg?: number;         // мкг/день
    t3Mcg?: number;           // мкг/день
  };

  // ─────────── 4. ЗДОРОВЬЕ ───────────
  health: {
    // Хронические
    chronicConditions: string[];
    contraindications: {
      diabetes: boolean; cvd: boolean; thrombophilia: boolean;
      liverDisease: boolean; kidneyDisease: boolean; giDisease: boolean;
      prostateIssues: boolean; epilepsy: boolean; mentalIllness: boolean;
    };
    // Генетика (SNP)
    genetics: Record<string, string>;
    // Травмы
    injuries: InjuryRecord[];
    // Кардио
    bpStage: 'normal' | 'prehypertension' | 'hypertension1' | 'hypertension2';
    hctElevation: 'none' | 'mild' | 'moderate' | 'severe';
    heartRate: number;
    ldlElevation: string;
    hdlLow: boolean;
    previousCVD: boolean;
    familyCVD: boolean;
    triglycerides: 'normal' | 'high';
    // ЖКТ
    bloating: boolean; heartburn: boolean; constipation: boolean;
    diarrhea: boolean; diagnosedIBS: boolean;
    enzymeSupport: boolean; probioticUse: boolean;
    // Неврология
    dopamineScore: number;        // 1-5
    serotoninScore: number;       // 1-5
    aggressionScore: number;      // 1-5
    memoryIssues: boolean;
    focusIssues: boolean;
    slowThinking: boolean;
    headaches: boolean;
    weatherDependent: boolean;
    // v6: дополнительные нейро-поля для калькулятора поддержки (ЭТАП 2)
    gabaBalance?: 'balance' | 'overexcited' | 'inhibited';
    coordinationIssues?: boolean;
    sleepQuality?: 'good' | 'fair' | 'poor';
    // Психология
    fearOfLoss: number;           // 1-5
    mirrorObsession: number;      // 1-5
    apathyOffCycle: number;       // 1-5
    // ОДА
    jointPain: boolean;
    ligamentIssues: boolean;
    backPain: boolean;
    // v6: детализация боли в суставах для калькулятора поддержки (ЭТАП 2)
    jointPainSeverity?: 'none' | 'mild' | 'moderate' | 'severe';
    // Стоматология
    bleedingGums: boolean;
    looseTeeth: boolean;
    cramps: boolean;
    // Эпикриз
    pastGyno: boolean;
    pastLibidoDrop: boolean;
    pastHctSpike: boolean;
    pastLiverIssues: boolean;
    pastKidneyIssues: boolean;
    // Токсическая нагрузка
    hazardousWork: boolean;
    regularNSAIDs: boolean;
    // Аллергии
    drugAllergies: string;
    // Исключения
    excludedSupplements: string[];  // id БАДов
    excludedMeds: string[];         // id лекарств
  };

  // ─────────── 5. ПИТАНИЕ ───────────
  nutrition: {
    dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
    mealsPerDay: number;
    cookingSkill: 'none' | 'basic' | 'intermediate' | 'advanced';
    foodAllergies: string[];
    foodIntolerances: string[];
    excludedFoods: string[];
    preferredFoods: string[];
    preferredByMeal?: Record<string, string[]>;
    histamineSensitive: boolean;
    proteinPerKg: number;         // г/кг
    fiberG: number;               // г/день
    omega3G: number;              // г/день
    sodiumG: number;              // г/день
    potassiumG: number;           // г/день
    alcoholPerWeek: number;       // стандартных дринков
    /** КБЖУ: режим выбора целей (auto = по профилю, manual = ручные цифры) */
    kbjuMode?: 'auto' | 'manual';
    /** Ручные цели КБЖУ (если kbjuMode='manual') */
    manualTargets?: { kcal: number; protein: number; fat: number; carbs: number };
    /** Ручной г/кг белка (override proteinPerKg) */
    manualGPerKg?: number;
    /** Ручной г/кг (полный split: protein/fat/carbs) — пишет планировщик питания.
     *  Отдельно от proteinPerKg (число), чтобы объект не ломал numeric-потребителей. */
    manualGPerKgSplit?: { protein?: number; fat?: number; carbs?: number };
    /** Низкоуглеводный вечерний приём */
    eveningLowCarb?: boolean;
    /** Процент суперкомпенсации (5-15%) */
    surplusPct?: number;
    /** Жёсткость разнообразия плана */
    varietyStrictness?: 'low' | 'medium' | 'high';
    /** Специфичность (общая/индивидуальная) */
    specificity?: 'generic' | 'specific';
    /** Вкусовой профиль */
    tasteProfile?: string[];
    /** Исключённые категории */
    excludedCategories?: string[];
    /** Заблокированные продукты (для планировщика) */
    lockedFoods?: string[];
    /** Заметки по питанию */
    dietNotes?: string;
    currentSupplements: SupplementEntry[];
    currentMedications: MedicationEntry[];
    /** Зеркало текущего плана поддержки (he_support_plan_result) — единая БД «что пьёт пользователь» */
    supplementStack?: {
      subs: { id: string; name: string; dose: string; timing: string }[];
      generatedAt?: string;
    };
  };

  // ─────────── 8. ЦЕЛИ ───────────
  /** Консолидированные цели: тренировочная + цикл-курс (из he_autocalc_state.goals) + BioStack */
  goals: {
    primaryGoal: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'hypertrophy' | 'rehab' | 'recomposition' | 'health';
    cycleGoal?: string;            // цель курса (масса/сушка/сила/рельеф)
    cycleWeeks?: number;           // длительность курса
    previousCycles?: number;       // сколько курсов было
    timeSinceLastCycle?: 'none' | '1-3mo' | '3-6mo' | '6-12mo' | '1y+';
    secondaryGoals?: string[];     // доп. цели
    targetWeight?: number;         // кг
    targetBodyFat?: number;        // %
    goalTimelineWeeks?: number;    // срок достижения
    /** Категория ББ (например, Men's Physique) */
    bbCategory?: string;
    /** Peak week (да/нет) */
    peakWeek?: boolean;
    /** Дата шоу (для peak week) */
    peakShowDay?: string;
    /** JSON-конфиг тапера ББ (bb-contest-prep.engine) — единая система пикинга. */
    bbPeakConfig?: string;
    /** JSON единого версионированного плана contest prep (BBContestPrepPlan). */
    bbContestPrepPlan?: string;
    /** Этап жизни (детокс/набор/поддержание/сушка) */
    lifeStage?: string;
  };

  // ─────────── 9. АНАЛИЗЫ (зеркало сводки из IndexedDB labs_log) ───────────
  /** Не храним историю — только сводку последнего ввода для карточки в Профиле */
  labs: {
    lastEnteredDate?: string;      // YYYY-MM-DD последнего ввода
    enteredCount?: number;         // число введённых маркеров
    status: 'none' | 'partial' | 'complete';
    summary: Record<string, { value: number; date: string; unit?: string }>;
  };

  // ─────────── 10. СИМПТОМЫ (зеркало сводки из he_symptom_diary) ───────────
  symptoms: {
    lastEntryDate?: string;
    activeCount?: number;          // число активных (severity>0) симптомов
    recent: Record<string, { score: number; date: string }>;
  };

  // ─────────── 6. ОБРАЗ ЖИЗНИ ───────────
  lifestyle: {
    sleepHours: number;           // часов — один для readiness/восстановления/рисков
    sleepQuality: 'good' | 'fair' | 'poor';
    chronotype: 'lark' | 'owl' | 'mixed';
    stressLevel: number;          // 1-10 — один
    fatigueLevel: number;         // 1-10 — один
    baselineHrvRatio: number;
    dailySteps: number;
    dailyWaterLiters: number;
    smoke: boolean;
    activityLevel: number;        // 1-10
    morningHRV: number;
    restingHR: number;
    bedtime?: string;
    wakeTime?: string;
    nightAwakenings: number;
    lastPeriodStart?: string;      // YYYY-MM-DD — дата последней менструации
    cycleLengthDays?: number;      // длина цикла 21-35 (default 28)
  };

  // ─────────── 7. СИСТЕМНЫЕ ───────────
  system: {
    mcRuns: number;               // Monte Carlo runs
    forceNoLabsPenalty: boolean;
    preferredUnits: 'metric' | 'imperial';
    notificationsEnabled: boolean;
    privacyLevel: 'private' | 'friends' | 'public';
    nutritionFactor: number;
    trainingFactor: number;
    hasHIIT: boolean;
    volumeTonnes: number;
    lissMinutesPerWeek: number;
    email?: string;
  };
}

export interface PharmaSubstanceEntry {
  id: string;
  name: string;
  doseMg: number;
  unit: string;
  route: 'inject' | 'oral';
  startWeek: number;
  endWeek: number;
}

export function getDefaultSettings(): UnifiedSettings {
  return {
    personal: {
      age: 30, sex: 'male', height: 175, weight: 70, bodyFat: 15,
      bloodType: 'I+', ethnicity: undefined, emergencyName: undefined, emergencyPhone: undefined,
    },
    training: {
      sportType: 'bodybuilding', experience: 3, level: 'intermediate',
      daysPerWeek: 3, minutesPerSession: 60, primaryGoal: 'hypertrophy',
      weakPoints: [], pmSquat: 120, pmBench: 100, pmDeadlift: 140,
      workMax: { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60 },
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
      recovery: 7, motivation: 7, doms: 3,
      favoriteExercises: [], excludedExercises: [], avoidAxialLoad: false,
      loadStrategy: 'double_progression',
    },
    pharma: {
      phase: 'baseline', courseStartDate: new Date().toISOString().slice(0, 10),
      experience: 'none', totalCycles: 0, yearsOnGear: 0, monthsSinceLastCourse: 0,
      hcgEnabled: false, aiEnabled: false,
      trainingCycleType: 'mass', trainingCycleWeeks: 12, previousCycles: 0,
      timeSinceLastCycle: 'none', currentSubstances: [],
    },
    health: {
      chronicConditions: [],
      contraindications: {
        diabetes: false, cvd: false, thrombophilia: false,
        liverDisease: false, kidneyDisease: false, giDisease: false,
        prostateIssues: false, epilepsy: false, mentalIllness: false,
      },
      genetics: {},
      injuries: [],
      bpStage: 'normal', hctElevation: 'none', heartRate: 72,
      ldlElevation: '', hdlLow: false, previousCVD: false, familyCVD: false,
      triglycerides: 'normal',
      bloating: false, heartburn: false, constipation: false,
      diarrhea: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false,
      dopamineScore: 3, serotoninScore: 3, aggressionScore: 3,
      memoryIssues: false, focusIssues: false, slowThinking: false,
      headaches: false, weatherDependent: false,
      fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1,
      jointPain: false, ligamentIssues: false, backPain: false,
      bleedingGums: false, looseTeeth: false, cramps: false,
      pastGyno: false, pastLibidoDrop: false, pastHctSpike: false,
      pastLiverIssues: false, pastKidneyIssues: false,
      hazardousWork: false, regularNSAIDs: false,
      drugAllergies: '', excludedSupplements: [], excludedMeds: [],
    },
    nutrition: {
      dietType: 'omnivore', mealsPerDay: 3, cookingSkill: 'basic',
      foodAllergies: [], foodIntolerances: [], excludedFoods: [], preferredFoods: [],
      preferredByMeal: undefined, histamineSensitive: false,
      proteinPerKg: 1.8, fiberG: 25, omega3G: 1.5, sodiumG: 3.5, potassiumG: 3.0,
      alcoholPerWeek: 0,
      kbjuMode: 'auto', manualTargets: undefined, manualGPerKg: undefined,
      eveningLowCarb: false, surplusPct: 10,
      varietyStrictness: 'medium', specificity: 'specific',
      tasteProfile: [], excludedCategories: [], lockedFoods: [], dietNotes: undefined,
      currentSupplements: [], currentMedications: [], supplementStack: undefined,
    },
    lifestyle: {
      sleepHours: 7, sleepQuality: 'fair', chronotype: 'mixed',
      stressLevel: 3, fatigueLevel: 3, baselineHrvRatio: 1.0,
      dailySteps: 6000, dailyWaterLiters: 2, smoke: false,
      activityLevel: 5, morningHRV: 0, restingHR: 0,
      bedtime: undefined, wakeTime: undefined, nightAwakenings: 1,
    },
    system: {
      mcRuns: 0, forceNoLabsPenalty: false,
      preferredUnits: 'metric', notificationsEnabled: false,
      privacyLevel: 'private', nutritionFactor: 1, trainingFactor: 1,
      hasHIIT: false, volumeTonnes: 0, lissMinutesPerWeek: 0,
      email: undefined,
    },
    goals: {
      primaryGoal: 'hypertrophy', cycleGoal: undefined, cycleWeeks: undefined,
      previousCycles: undefined, timeSinceLastCycle: undefined, secondaryGoals: undefined,
      targetWeight: undefined, targetBodyFat: undefined, goalTimelineWeeks: undefined,
    },
    labs: {
      lastEnteredDate: undefined, enteredCount: 0, status: 'none', summary: {},
    },
    symptoms: {
      lastEntryDate: undefined, activeCount: 0, recent: {},
    },
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
  mixQualityScore?: number;
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
  movementPattern?: MovementPattern;
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
  /** Тип движения: 'competition_lift' (павэрлифтинг/Олимпия), 'bb_compound', 'bb_isolation', 'accessory', 'prehab' */
  movementType?: string;
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
  sets: { weight: number; reps: number; rir: number; rpe?: number; techniqueScore?: number }[];
  totalVolume: number;
  estimated1RM: number;
  isCompound: boolean;
  weekNumber?: number;
  mesocycleId?: string;
  notes?: string;
  /** Структурный суперсет (не кодируется в имени упражнения). */
  supersetGroup?: number;
  /** Заметка к упражнению (не кодируется в имени упражнения). */
  note?: string;
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
  | 'rotation' | 'anti_rotation' | 'core'
  | 'incline_push' | 'dip_push' | 'decline_push'
  | 'isolation_chest' | 'isolation_shoulders' | 'isolation_back'
  | 'isolation_arms' | 'isolation_legs_quad' | 'isolation_legs_ham'
  | 'isolation_calves' | 'isolation_glutes' | 'glute_squat';

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
  exercises: { exerciseId: string; sets: number; reps: number; intensityPct?: number; note?: string }[];
  notes?: string;
}

export interface CooldownBlock {
  type: 'stretch' | 'breathing' | 'mobility' | 'cardio';
  durationSec: number;
  exercises: { exerciseId: string; durationSec: number; note?: string }[];
  /** Пояснение блока (например, «Растяжка рабочих зон: грудь, спина»). */
  notes?: string;
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
