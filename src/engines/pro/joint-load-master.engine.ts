/**
 * joint-load-master.engine.ts — ЕДИНЫЙ МАСТЕР СУСТАВНО-СВЯЗОЧНОГО АППАРАТА (проф).
 *
 * Объединяет ВСЕ ортопедические калькуляторы проекта в один lift×joint агрегатор:
 *  - orthopedic-load-engines.ts (INJURY_PATTERN_BLACKLIST, ROM_LIMITS, jointStressLimits, phase)
 *  - bb-mobility.engine.ts (MOBILITY_PATTERNS, isMobilityRestricted)
 *  - federation-grip-mobility.engine.ts (GRIP_PROTOCOLS, MOBILITY_FLOWS, POSTURE_ASSESSMENTS)
 *  - mobility-assessment.engine.ts (MOBILITY_TESTS 0-12, he_mobility_assessments, weakestTests)
 *  - mobility-protocol.engine.ts (MOBILITY_LIBRARY, he_mobility_protocols)
 *  - injury-cycle-blood.engine.ts (prehab)
 *  - bb-injury-prevention (graded)
 *  - warmup-joints.engine.ts
 *  - autoregulation/bb-fatigue (jointFatigue, joint cost)
 *
 * Опасные зоны явно выделены: поясница (L4-S1 диск/фасетка), плечо (labrum/rotator), колено (ACL/мениск/пателла),
 * таз (labrum), локоть (сухожилие), запястье, голеностоп (ахилл).
 * Чистый движок, без UI/storage (кроме чтения mobility ограничений из профиля).
 */
import type { Lift } from '../lms/weakpoint-pl';
import { computeOrthopedicConstraints } from '../orthopedic-load-engines';
import { isMobilityRestricted, MOBILITY_PATTERNS } from '../bb/bb-mobility.engine';
import { getMobilityFlows, getPostureAssessments } from '../federation-grip-mobility.engine';
import { MOBILITY_TESTS, latestAssessment, summarizeAssessment } from '../mobility-assessment.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

// ── Типы ──

export type JointId = 'shoulder' | 'elbow' | 'wrist' | 'spine' | 'hip' | 'knee' | 'ankle';
export type JointRiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

export interface JointMeta {
  id: JointId;
  label: string;
  icon: string;
  /** Опасные структуры зоны */
  dangerous: string[];
  description: string;
  relatedLifts: Lift[];
  /** Тест мобильности, связанный с суставом */
  mobilityTestId?: string;
}

export interface JointOption {
  id: string;
  joint: JointId;
  lifts: Lift[]; // к каким движениям относится (пустой = все)
  label: string;
  description: string;
  method: string;
  assistance: string[]; // из EXERCISE_CATALOG
  protocol: { sets: number; reps: number; pct?: number; rir: number; tempo?: string; rest?: string; note?: string };
  rationale: string;
  references: string[];
  level: JointRiskLevel;
}

// ── Мета опасных зон (поясница отдельно выделена как spine) ──

export const JOINTS: JointMeta[] = [
  { id: 'shoulder', label: 'Плечо', icon: '🫁', dangerous: ['rotator cuff', 'labrum', 'AC-сустав', 'бурса'], description: 'Импинджмент при широком/высоком жиме, жиме из-за головы, upright row выше сосков. Узкий хват + локти 30-45° бережёт.', relatedLifts: ['bench','ohp','incline_press','pulldown'], mobilityTestId: 'shoulder_flexion' },
  { id: 'elbow', label: 'Локоть', icon: '💪', dangerous: ['сухожилие трицепса/бицепса', 'латеральный эпикондилит'], description: 'Перегруз французскими, узким хватом, молотками без прогрессии. Нейтральный хват + RIR контроль.', relatedLifts: ['bench','biceps'], mobilityTestId: undefined },
  { id: 'wrist', label: 'Запястье', icon: '🤚', dangerous: ['TFCC', 'сухожилие сгибателей'], description: 'Залом назад (кисть) — bulldog хват, гриф на подушке ладони. Толстый гриф без подготовки — риск.', relatedLifts: ['bench','ohp','biceps'], mobilityTestId: undefined },
  { id: 'spine', label: 'Поясница (L4-S1)', icon: '🦴', dangerous: ['диск L4-S1', 'фасетка', 'крестцово-подвздошный сустав', 'разгибатели'], description: 'Округление, клевок таза, тяга в наклоне на прямых ногах, осевая нагрузка. Нейтраль + брейсинг + ограничение глубины.', relatedLifts: ['squat','deadlift','sumo','row'], mobilityTestId: 'toe_touch' },
  { id: 'hip', label: 'Тазобедренный', icon: '🦵', dangerous: ['labrum', 'импинджмент FAI', 'сгибатели бедра'], description: 'Глубокий присед ATG без мобильности голеностопа → клевок таза. Ширина + носки 15-30°.', relatedLifts: ['squat','sumo','deadlift'], mobilityTestId: 'thomas' },
  { id: 'knee', label: 'Колено', icon: '🦵', dangerous: ['ACL', 'мениск', 'пателлярное сухожилие', 'хрящ'], description: 'Вальгус внутрь, глубокий присед без контроля, объём без делода. Трекинг над носками + лента.', relatedLifts: ['squat','deadlift'], mobilityTestId: 'deep_squat' },
  { id: 'ankle', label: 'Голеностоп', icon: '🦶', dangerous: ['ахилл', 'дельтовидная связка'], description: 'Жёсткий голеностоп → пятки отрываются, компенсация поясницей. Мобилизация с лентой, пятка остаётся.', relatedLifts: ['squat'], mobilityTestId: 'deep_squat' },
];

export const JOINT_MAP: Record<JointId, JointMeta> = Object.fromEntries(JOINTS.map(j=>[j.id,j])) as Record<JointId, JointMeta>;

// ── Опции (проф) — каждая ссылается на реальные упражнения каталога ──

export const JOINT_OPTIONS: JointOption[] = [
  // ПЛЕЧО — детальная проработка как у тазобедренного/коленного
  { id:'shoulder_wide_flared', joint:'shoulder', lifts:['bench','incline_press'], label:'Широкий + разведённые локти → импинджмент', description:'81см + 70-80° локти перегружает AC и rotator cuff.', method:'Сузить до 1.3× + локти 45-60°, пауза+Spoto: 4×5 @70% RIR2', assistance:['Жим средним хватом','Жим Спото (пауза над грудью)','Сведение в кроссовере (сверху)'], protocol:{sets:4,reps:5,rir:2,tempo:'2-0-1-0',rest:'2 мин',note:'до 81см, предплечья вертикальны'}, rationale:'Сужение и tuck разгружают плечо, сохраняя грудь.', references:['Fees 2022','Barnett 1995'], level:'high' },
  { id:'shoulder_overhead', joint:'shoulder', lifts:['ohp'], label:'Жим стоя: жим из-за головы / upright высоко', description:'Behind neck + upright выше сосков — импинджмент.', method:'Только перед грудью + upright до сосков: 3×8 @65% RIR2', assistance:['Армейский жим стоя','Тяга штанги к подбородку'], protocol:{sets:3,reps:8,rir:2,rest:'90 с',note:'не выше сосков'}, rationale:'За голову — только при идеальной мобильности.', references:['Kolber 2013'], level:'critical' },
  { id:'shoulder_lateral_volume', joint:'shoulder', lifts:['bench','ohp','incline_press'], label:'Объём жимов + махи без ротации → перегруз ротаторов', description:'Частые жимы + боковые/передние махи без внешней ротации.', method:'Добавить 2× внешнюю ротацию + face-pull, жимы ×0.85: 3×10 @60% RIR2', assistance:['Тяга к лицу (face pull)','Разведение в наклоне (задняя дельта)','Внешняя ротация с гантелью'], protocol:{sets:3,reps:12,rir:2,tempo:'2-1-1-0',rest:'75 с',note:'лопатки сведены'}, rationale:'Баланс ротаторов + снять импинджмент.', references:['Reinold 2009'], level:'moderate' },
  { id:'shoulder_bench_heavy', joint:'shoulder', lifts:['bench'], label:'Тяжёлые синглы/тройки без пауз → AC-сустав', description:'Постоянные 1-3 повт @RIR0-1 без пауз — AC и бурса.', method:'Пауза 1с на груди + Spoto, RIR≥2: 4×3 @75% RIR2', assistance:['Жим с паузой','Жим Спото','Отжимания на брусьях (глубоко)'], protocol:{sets:4,reps:3,rir:2,tempo:'3-1-1-0',rest:'2-3 мин',note:'пауза без отбива'}, rationale:'Пауза убирает инерцию и щадит AC.', references:['Calatayud 2015'], level:'moderate' },
  // ЛОКОТЬ
  { id:'elbow_french_volume', joint:'elbow', lifts:['bench','biceps'], label:'Объём французских + узкого без прогрессии', description:'Тендинит трицепса/бицепса от резкого объёма.', method:'Объём ×0.7, RIR+2, темп 3-1-1-0: 3×8 @65% RIR2', assistance:['Разгибание с канатной рукоятью (латеральная головка)','Сгибание кисти со штангой'], protocol:{sets:3,reps:8,rir:2,tempo:'3-1-1-0',rest:'90 с'}, rationale:'Снижаем tensile на сухожилие.', references:['Schoenfeld 2021'], level:'moderate' },
  { id:'elbow_biceps_curl_overuse', joint:'elbow', lifts:['biceps'], label:'Сгибания с читингом + узкий хват → бицепс-сухожилие', description:'Читинг, лямки, узкий хват EZ — перегруз дистального сухожилия бицепса.', method:'Строго, нейтральный/молот, темп 2-1-1-0: 3×10 @65% RIR2', assistance:['Сгибание молот','Сгибание на скамье Скотта (широко)','Сгибание с канатом'], protocol:{sets:3,reps:10,rir:2,tempo:'2-1-1-0',rest:'75 с'}, rationale:'Нейтральный хват + контроль убирают пик.', references:['Schoenfeld 2021'], level:'high' },
  { id:'elbow_triceps_lockout', joint:'elbow', lifts:['bench'], label:'Локаут трицепса — узкий жим/брусья в отказ', description:'Постоянный локаут в отказ — латеральный эпикондилит.', method:'Не дожимать до блока, RIR 2, темп 2-0-1-0: 3×8 @68%', assistance:['Отжимания на брусьях','Жим узким хватом','Разгибание в наклоне'], protocol:{sets:3,reps:8,rir:2,tempo:'2-0-1-0',rest:'90 с',note:'локаут мягкий'}, rationale:'Мягкий локаут бережёт локоть.', references:['Martin 2020'], level:'moderate' },
  // ЗАПЯСТЬЕ
  { id:'wrist_bent', joint:'wrist', lifts:['bench','ohp','biceps'], label:'Залом кисти назад (грип)', description:'Гриф на пальцах, не на подушке — TFCC.', method:'Bulldog: 4×6 @68% RIR2 + удержания', assistance:['Сгибание кисти со штангой','Жим средним хватом'], protocol:{sets:4,reps:6,rir:2,rest:'90 с',note:'гриф на основании ладони'}, rationale:'Нейтраль держит предплечье вертикально.', references:['Calatayud 2014'], level:'moderate' },
  { id:'wrist_forearm_pump', joint:'wrist', lifts:['biceps','bench'], label:'Памп предплечий + толстый гриф → зажим запястья', description:'Толстый гриф, молотки, обратный хват без прогрессии.', method:'Стандартный гриф, объём ×0.8, кисть нейтрально: 3×12 @60% RIR3', assistance:['Сгибание кисти обратным хватом','Разгибание кисти','Молот с канатом'], protocol:{sets:3,reps:12,rir:3,tempo:'2-1-1-0',rest:'60 с'}, rationale:'Нейтраль + дозированный объём.', references:['Seitz 2018'], level:'moderate' },
  { id:'wrist_front_rack', joint:'wrist', lifts:['squat','ohp'], label:'Фронт-присед/швунг — запястье в экстензии', description:'Фронт-стойка с заломом 70° — TFCC + сгибатели.', method:'Растяжка предплечий + фронт на 2 пальца/лямки: 3×5 @65% RIR2', assistance:['Фронтальный присед (лямки)','Жим стоя (хват шире)','Тяга штанги к подбородку'], protocol:{sets:3,reps:5,rir:2,rest:'90 с',note:'кисть нейтрально'}, rationale:'Лямки/шире хват снимают экстензию.', references:['Helms 2022'], level:'low' },
  // ПОЯСНИЦА — ключевая опасная зона
  { id:'spine_rounding_dead', joint:'spine', lifts:['deadlift','row'], label:'Округление поясницы в тяге/наклонной тяге', description:'Диск L4-S1 shear при округлении + высоком тазу.', method:'Нейтраль + брейсинг, клин, гриф к голени: 4×3 @72% RIR1, пояс по желанию', assistance:['Становая тяга с паузой ниже колен','Гиперэкстензия (45°)','Планка'], protocol:{sets:4,reps:3,rir:1,tempo:'2-1-1-0',rest:'2-3 мин',note:'Valsalva в живот'}, rationale:'Нейтраль + клин убирают shear.', references:['McGill 2014','Hales 2010'], level:'critical' },
  { id:'spine_butt_wink', joint:'spine', lifts:['squat'], label:'Клевок таза в глубоком приседе', description:'Глубокий присед без мобильности голеностопа → поясница округляется.', method:'Ограничить глубину до параллели + ящик: 4×5 @70% RIR2', assistance:['Присед на ящик','Глубокий присед с удержанием','Мобилизация голеностопа с лентой'], protocol:{sets:4,reps:5,rir:2,tempo:'3-1-1-0',rest:'2 мин',note:'таз не ниже колена без нейтрали'}, rationale:'Ящик держит нейтраль.', references:['Schoenfeld 2020'], level:'high' },
  { id:'spine_axial_overload', joint:'spine', lifts:['squat','deadlift'], label:'Частая осевая нагрузка без разгрузки', description:'Ежедневный наклон/присед → накопление компрессии.', method:'Неделя разгрузки: объём ×0.5, RIR+2, замена на присед с поясом/жим ногами: 2×/нед', assistance:['Жим ногами (45°)','Гакк-приседания'], protocol:{sets:3,reps:8,rir:2,rest:'2 мин'}, rationale:'Снимаем осевую нагрузку, сохраняя ноги.', references:['Helms 2017'], level:'moderate' },
  { id:'spine_bracing_deficit', joint:'spine', lifts:['squat','deadlift','row','bench'], label:'Слабый брейсинг — поясница уходит в прогиб/округление', description:'Живот не надут, поясница нестабильна под нагрузкой.', method:'Обучение Valsalva + планка 3×40с + пояс на тяж: 3×5 @68% RIR2', assistance:['Планка','Становая с паузой','Жим стоя с поясом'], protocol:{sets:3,reps:5,rir:2,tempo:'2-1-1-0',rest:'90 с',note:'вдох в живот'}, rationale:'Брейсинг стабилизирует L4-S1.', references:['McGill 2015'], level:'moderate' },
  // ТАЗ
  { id:'hip_impingement', joint:'hip', lifts:['squat','sumo'], label:'Импинджмент таза (FAI) при глубокой/широкой стойке', description:'Глубоко + широко + носки наружу 45° → labrum.', method:'Сузить/угол 15-30° + Thomas-тест: 3×8 @65% RIR2 + couch stretch', assistance:['Приседания со штангой','Выпады с гантелями'], protocol:{sets:3,reps:8,rir:2,rest:'90 с'}, rationale:'Индивидуальная стойка под бедро.', references:['Fry 2003'], level:'moderate' },
  { id:'hip_flexor_tight', joint:'hip', lifts:['squat','deadlift','row'], label:'Жёсткие сгибатели бедра → передний наклон таза', description:'Сидячий образ + частые приседы без растяжки.', method:'Couch stretch 2×45с + Thomas + ягодичный мост: 3×10 @60% RIR2', assistance:['Ягодичный мост','Выпады с гантелями','Приседания со штангой'], protocol:{sets:3,reps:10,rir:2,tempo:'2-1-1-0',rest:'75 с'}, rationale:'Растяжка + активация ягодичных выравнивают таз.', references:['Contreras 2013'], level:'moderate' },
  { id:'hip_adductor_strain', joint:'hip', lifts:['squat','sumo'], label:'Приводящие — резкая ширина без подготовки', description:'Сумо/широкий присед без прогрессии приведения.', method:'Сужать постепенно + Copenhagen 3×20с + приведение: 3×12 @60%', assistance:['Приведение в тренажёре','Сумо-тяга (лёгкая)','Выпады в сторону'], protocol:{sets:3,reps:12,rir:2,rest:'75 с'}, rationale:'Прогрессия приводящих + изометрия.', references:['Thorborg 2019'], level:'moderate' },
  // КОЛЕНО
  { id:'knee_valgus', joint:'knee', lifts:['squat'], label:'Вальгус коленей внутрь', description:'Приводящие/слабые ягодичные + плохая проприоцепция.', method:'Лента + трекинг: 3×8 @65% + lateral band walk', assistance:['Приседания со штангой','Выпады с гантелями','Мобилизация голеностопа с лентой'], protocol:{sets:3,reps:8,rir:2,tempo:'2-0-1-0',rest:'90 с',note:'колени над 2-3 пальцем'}, rationale:'Разведение + трекинг.', references:['Bell-Jenje 2016'], level:'high' },
  { id:'knee_patellar_overuse', joint:'knee', lifts:['squat','deadlift'], label:'Пателлярное сухожилие — объём без пауз', description:'Частый присед без делода → тендинопатия.', method:'Темп 3-1-1-0 + изометрия Spanish squat 30-45с: 3×6 @65%', assistance:['Разгибания ног в тренажёре','Присед на ящик (box squat)'], protocol:{sets:3,reps:6,rir:2,tempo:'3-1-1-0',rest:'90 с'}, rationale:'Изометрия лечит пателлу.', references:['Rio 2015'], level:'moderate' },
  { id:'knee_meniscus_shear', joint:'knee', lifts:['squat','deadlift'], label:'Мениск — глубокий присед с ротацией', description:'Глубоко + колено уходит внутрь + ротация голени.', method:'Параллель, трекинг, темп 3-0-1-0: 3×6 @68% RIR2', assistance:['Жим ногами (стопы средне)','Гакк-приседания','Сгибания ног лёжа'], protocol:{sets:3,reps:6,rir:2,tempo:'3-0-1-0',rest:'90 с',note:'без ротации'}, rationale:'Нейтральный трекинг бережёт мениск.', references:['Escamilla 2001'], level:'high' },
  // ГОЛЕНОСТОП
  { id:'ankle_stiff', joint:'ankle', lifts:['squat'], label:'Жёсткий голеностоп → пятки отрываются', description:'Ограничение dorsiflexion → компенсация поясницей.', method:'Мобилизация с лентой 2×10 + пятка на блине 1см: 3×5 @68%', assistance:['Приседания со штангой','Мобилизация голеностопа с лентой'], protocol:{sets:3,reps:5,rir:2,rest:'90 с'}, rationale:'Пятка остаётся, глубина сохраняется.', references:['Bell-Jenje 2016'], level:'moderate' },
  { id:'ankle_achilles_overload', joint:'ankle', lifts:['squat','deadlift'], label:'Ахилл — частые подъёмы на носки/прыжки + приседы', description:'Объём икр без пауз → тендинопатия ахилла.', method:'Эксцентрик 3×12 @60% + изометрия 30с, объём ×0.7', assistance:['Подъёмы на носки стоя','Подъёмы на носки сидя','Мобилизация голеностопа'], protocol:{sets:3,reps:12,rir:2,tempo:'3-1-1-0',rest:'75 с',note:'медленно вниз'}, rationale:'Эксцентрик лечит ахилл.', references:['Alfredson 1998'], level:'moderate' },
];

// ── Агрегатор ──

export interface JointLoadInput {
  joint: JointId;
  lifts?: Lift[];
  injuries?: string[];
  mobilityRestrictions?: string[];
  currentPain?: string[];
  jointLimitations?: Record<string,'none'|'mild'|'moderate'|'severe'>;
}

export interface JointLoadDiagnosis {
  joint: JointMeta;
  phase: ReturnType<typeof computeOrthopedicConstraints>['phase'];
  allowedPatterns: string[];
  blockedPatterns: string[];
  romLimits: Record<string,{min:number;max:number}>;
  stressLimits: Record<string,number>;
  mobilityTests: typeof MOBILITY_TESTS;
  weakest: ReturnType<typeof summarizeAssessment>['weakest'];
  flows: ReturnType<typeof getMobilityFlows>;
  options: JointOption[];
}

export function jointLoadDiagnosis(input: JointLoadInput): JointLoadDiagnosis {
  const joint = JOINT_MAP[input.joint] ?? JOINTS[0];
  const ortho = computeOrthopedicConstraints({
    injuryHistory: input.injuries ?? [],
    jointLimitations: input.jointLimitations ?? { [input.joint]: 'none' },
    techniqueIssues: [],
    currentPain: input.currentPain ?? [],
  });
  const mobTests = MOBILITY_TESTS.filter(t => !joint.mobilityTestId || t.id === joint.mobilityTestId);
  const latest = latestAssessment();
  const weakest = summarizeAssessment(latest).weakest.filter(w => !joint.mobilityTestId || w.test.id === joint.mobilityTestId);
  const flows = getMobilityFlows().filter(f => f.targetAreas.some(a => joint.label.includes(a) || a.toLowerCase().includes(joint.label.toLowerCase()))).slice(0,2);
  // опции по суставу + лифту
  const options = JOINT_OPTIONS.filter(o => o.joint === input.joint && (o.lifts.length===0 || o.lifts.some(l=> (input.lifts??joint.relatedLifts).includes(l))));
  return {
    joint,
    phase: ortho.phase,
    allowedPatterns: ortho.allowedPatterns,
    blockedPatterns: ortho.blockedPatterns,
    romLimits: ortho.romLimits,
    stressLimits: ortho.jointStressLimits,
    mobilityTests: mobTests,
    weakest,
    flows,
    options,
  };
}

export function isExerciseRestrictedForJoint(exName: string, joint: JointId, restrictions?: string[]): boolean {
  return isMobilityRestricted({ name: exName } as any, restrictions);
}

// План чистки старых калькуляторов (если мастер покрывает — прячем, не удаляем сразу)
export const DEPRECATED_JOINT_CALCULATORS = [
  'orthopedic-load-engines (прямой вызов — заменить на joint-load-master)',
  'mobility-assessment отдельный экран — вливается в блок 7 JointMaster',
  'mobility-protocol отдельный — вливается в блок 6 JointMaster',
  'warmup-joints — вливается в блок 6',
] as const;
