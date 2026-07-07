// ════════════════════════════════════════════════════════════════════════════
//  TZ-BRIDGE-PHASE — фазно-зависимый протокол поддержки
//
//  5 фаз ТЗ: course | bridge | pct | fertility | trt
//  Каждая фаза:
//    - mandatory[]   — обязательные категории (всегда добавляются)
//    - suppressed[]  — подавляемые категории (не добавляются автоматически)
//    - allowBoosters — допустимы ли бустеры (Neuro/Joints/Stack)
//    - doseTier      — множитель срока для доз
//    - coreMechs     — приоритетные механизмы фазы
//
//  detectPhase(ctx) — главная функция: автоопределение фазы из drug/labs контекста
// ════════════════════════════════════════════════════════════════════════════

import type { TzMechId } from './tz-bridge-marker';
import type { TzCategory } from './tz-bridge-mechanism';

export type PhaseKey = 'course' | 'bridge' | 'pct' | 'fertility' | 'trt';

export interface PhaseProtocol {
  key: PhaseKey;
  label: string;             // русское название
  description: string;       // клиническое описание фазы
  mandatory: TzCategory[];   // обязательные категории (включать всегда)
  suppressed: TzCategory[];  // подавляемые (не добавлять автоматически)
  allowBoosters: boolean;    // можно ли добавлять бустеры
  doseTier: number;           // множитель периода курса (1.0 = базовый)
  coreMechs: TzMechId[];     // приоритетные механизмы фазы
  algorithm: string;          // описание алгоритма назначения (для UI)
}

// ════════════════════════════════════════════════════════════════════════════
//  ОПРЕДЕЛЕНИЯ 5 ФАЗ
// ════════════════════════════════════════════════════════════════════════════
export const PHASE_PROTOCOL: Record<PhaseKey, PhaseProtocol> = {
  // ─── КУРС ───
  course: {
    key: 'course',
    label: 'Курс ААС',
    description: 'Фаза активного приёма ААС/GH/инсулина. HPTA подавлена, эстрадиол/arоматизация растёт, риски по ССС/печень/почки/гематология максимальны.',
    mandatory: ['hepatoprotector', 'cardioprotector', 'antioxidant'],
    suppressed: ['hormonal'],  // T-бустеры не нужны — HPTA и так подавлена экзогенным T
    allowBoosters: true,
    doseTier: 1.0,
    coreMechs: ['cv1', 'cv2', 'cv4', 'liv1', 'liv2', 'hem1', 'rep1', 'rep2'],
    algorithm: 'Курс: 1) гепатопротектор (NAC/TUDCA) — обязательно, liv1/liv2. 2) кардиопротектор (телмисартан/омега-3) — cv2/cv3. 3) антиоксидант (АЛЬК/CoQ10). 4) hCG 500 МЕ 2р/нед (репродуктивная защита). 5) AI по показаниям (E2>60 pg/mL). T-бустеры подавлены.',
  },
  // ─── МОСТ ───
  bridge: {
    key: 'bridge',
    label: 'Мост',
    description: 'Фаза между курсами (мост/крейз). Низкая доза TESTO (TRT-уровень). Риски снижены, но HPTA по-прежнему подавлена.',
    mandatory: ['hepatoprotector', 'cardioprotector'],
    suppressed: [], // на мосту можно T-бустеры (soft PCT)
    allowBoosters: true,
    doseTier: 0.6,
    coreMechs: ['cv2', 'cv1', 'liv1', 'rep5'],
    algorithm: 'Мост: 1) гепато- и кардиопротекция (но более лайт, доза ×0.6). 2) опционально адаптогены. 3) T-бустеры допустимы (мягкая поддержка HPTA). 4) контроль липидов и АЛТ/АСТ каждые 6 нед.',
  },
  // ─── ПКТ ───
  pct: {
    key: 'pct',
    label: 'ПКТ (восстановление)',
    description: 'Фаза восстановления HPTA после курса. Срочная необходимость в сермах (тамокс/клом), hCG 500-1000 МЕ, T-бустеры.',
    mandatory: ['hormonal', 'antioxidant', 'adaptogen'],
    suppressed: [], // ПКТ нужна гормональная поддержка
    allowBoosters: true,
    doseTier: 0.8,
    coreMechs: ['rep1', 'rep2', 'rep3', 'rep4', 'rep5', 'cns1', 'cns4'],
    algorithm: 'ПКТ: 1) SERM (тамоксифен 20 мг/день или кломифен 25-50 мг/день) — rep4/rep5. 2) hCG 500-1000 МЕ 2р/нед (если не было на курсе) — rep1/rep2/rep3. 3) T-бустеры (ашваганда, цинк, форсколин) после SERM. 4) адаптогены (аобработы) — cns1. 5) сохраняем гепато/кардиопротекцию. Длительность 4-6 нед.',
  },
  // ─── ФЕРТИЛЬНОСТЬ ───
  fertility: {
    key: 'fertility',
    label: 'Фертильность',
    description: 'Фаза целенаправленного восстановления сперматогенеза. Приоритет hCG + рФСГ или антиэстрогены, интенсивная репротективная поддержка.',
    mandatory: ['hormonal', 'antioxidant', 'vitamin', 'mineral'],
    suppressed: [],
    allowBoosters: false, // строгая фаза — меньше вмешательств
    doseTier: 1.0,
    coreMechs: ['rep1', 'rep2', 'rep3', 'rep4', 'rep5'],
    algorithm: 'Фертильность: 1) hCG 1500-2500 МЕ 2-3р/нед (интенсивнее чем ПКТ) — rep1/rep2/rep3. 2) SERM (кломифен 25 мг/день) — rep1/rep5. 3) антиоксиданты для сперматогенеза (NAC, витамин C/E, селений, цинк). 4) фолат 400 мкг, цинк 15 мг — репродуктивная защита. 5) исключить анаболические стероиды и SUPPRESSновые T-бустеры (трибулус может ↑эстроген). Длительность 8-12 нед.',
  },
  // ─── TRT ───
  trt: {
    key: 'trt',
    label: 'ЗГТ (TRT)',
    description: 'Фаза заместительной гормональной терапии (TRT) — постоянный приём терапевтических доз тестостерона. HPTA подавлена хронически.',
    mandatory: ['cardioprotector', 'hepatoprotector'],
    suppressed: ['hormonal'], // на TRT T-бустеры не нужны
    allowBoosters: true,
    doseTier: 1.0,
    coreMechs: ['cv2', 'cv1', 'cv3', 'hem1', 'rep1', 'rep2', 'rep4'],
    algorithm: 'TRT: 1) кардиопротектор (телмисартан 40-80 мг — ↓АД + ↓гипертрофия ЛЖ) — cv1/cv3. 2) гепатопротектор (NAC + TUDCA) если оралы. 3) контроль гематокрита (<54%) — при ↑ кровопускание. 4) AI по E2 показаниям. 5) не назначать T-бустеры (HPTA уже на ZGT). Постоянный протокол.',
  },
};

// Стандартный порядок фаз
export const PHASE_ORDER: PhaseKey[] = ['course', 'bridge', 'pct', 'fertility', 'trt'];

// ════════════════════════════════════════════════════════════════════════════
//  КОНТЕКСТ для автоопределения фазы
// ════════════════════════════════════════════════════════════════════════════
export interface PhaseContext {
  // drug context
  usingAAS?: boolean;          // принимает ли ААС на текущий момент
  usingTRT?: boolean;          // терапевтический тестостерон (лекарственный, <250 мг/нед)
  usingBridgeAAS?: boolean;    // сниженная доза между курсами
  inFertilityProgram?: boolean; // целенаправленное восстановление спермы
  weeksAfterCourse?: number;   // недель после последней инъекции ААС
  esterHalfLifeHours?: number; // период полувыведения lastIndex эфира
  // labs context
  testosteroneLevel?: number;     // общий T (ммоль/л или ng/dL)
  lhLevel?: number;                // ЛГ
  lhSuppressed?: boolean;         // LH<1.7
  spermCount?: number;             // M/ml
  spermCountLow?: boolean;         // <15 M/ml
  // clinical context
  onPCTDrug?: boolean;            // принимает тамокс/клом
  explicitPhase?: PhaseKey;       // прописан пользователем вручную
}

// ════════════════════════════════════════════════════════════════════════════
//  detectPhase — главная функция
//  Приоритет:
//    1. explicitPhase — если пользователь явно указал
//    2. fertility     — программа фертильности активна
//    3. pct           — принимает SERM или после курса <6 нед
//    4. trt           — TRT, низкая доза, без серм, длительно
//    5. bridge        — сниженная доза, между курсами
//    6. course        — стандартный активный курс ААС
//    7. course по умолчанию (если ничего не подходит)
// ════════════════════════════════════════════════════════════════════════════
export function detectPhase(ctx: PhaseContext): PhaseKey {
  // 1. явное указание
  if (ctx.explicitPhase) return ctx.explicitPhase;

  // 2. фертильность
  if (ctx.inFertilityProgram) return 'fertility';

  // 3. ПКТ
  if (ctx.onPCTDrug) return 'pct';
  // после курса: если прошёл 1-6 недель с учётом эфира
  if (ctx.usingAAS === false && ctx.weeksAfterCourse != null) {
    const halfLifeWeeks = ctx.esterHalfLifeHours ? ctx.esterHalfLifeHours / 168 : 2;
    // уровень снижается до уровня ПКТ через ~5× полураспада
    const pctThreshold = halfLifeWeeks * 5;
    if (ctx.weeksAfterCourse >= pctThreshold && ctx.weeksAfterCourse <= pctThreshold + 6) {
      return 'pct';
    }
    // если ещё не достигли порога — формально ещё на курсе
    if (ctx.weeksAfterCourse < pctThreshold) return 'course';
    // >6 нед после ПКТ → смотрим на TRT/bridge
  }
  // лабораторный указатель ПКТ: LH подавлен и INFO не на TRT
  if (ctx.lhSuppressed && !ctx.usingTRT && ctx.usingAAS === false) return 'pct';

  // 4. TRT
  if (ctx.usingTRT) return 'trt';

  // 5. bridge
  if (ctx.usingBridgeAAS) return 'bridge';

  // 6. активный курс
  if (ctx.usingAAS) return 'course';

  // 7. fallback
  return 'course';
}

// ════════════════════════════════════════════════════════════════════════════
//  Утилиты
// ════════════════════════════════════════════════════════════════════════════
export function getPhaseProtocol(key: PhaseKey): PhaseProtocol {
  return PHASE_PROTOCOL[key];
}

// Категории, обязательные на фазе
export function getMandatoryCategories(key: PhaseKey): TzCategory[] {
  return PHASE_PROTOCOL[key].mandatory.slice();
}

// Категории, подавляемые на фазе (не добавлять автоматически)
export function getSuppressedCategories(key: PhaseKey): TzCategory[] {
  return PHASE_PROTOCOL[key].suppressed.slice();
}

// Доступна ли категория на фазе (не подавлена)
export function isCategoryAllowed(key: PhaseKey, cat: TzCategory): boolean {
  return !PHASE_PROTOCOL[key].suppressed.includes(cat);
}

// Приоритетные механизмы фазы для отбора веществ
export function getPhaseCoreMechs(key: PhaseKey): TzMechId[] {
  return PHASE_PROTOCOL[key].coreMechs.slice();
}

// Допустимы ли бустеры на фазе
export function areBoostersAllowed(key: PhaseKey): boolean {
  return PHASE_PROTOCOL[key].allowBoosters;
}

// Описание алгоритма для UI
export function getPhaseAlgorithm(key: PhaseKey): string {
  return PHASE_PROTOCOL[key].algorithm;
}

// Все 5 фаз с метаданными для UI
export function getAllPhases(): PhaseProtocol[] {
  return PHASE_ORDER.map(k => PHASE_PROTOCOL[k]);
}