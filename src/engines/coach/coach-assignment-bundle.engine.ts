/**
 * coach-assignment-bundle.engine.ts — назначение тренером РАЦИОНА, ПРОТОКОЛА
 * БАДов и КУРСА (фармы).
 *
 * ЗАЧЕМ. Тренировку тренер уже выдаёт как объект (`coach-program-bundle.engine`),
 * а питание и БАДы до этого передавались только «зайди в его пространство и
 * настрой руками»: пять одинаковых рационов — пять раз пройти планировщик.
 * Здесь ровно та же механика, что и у программы:
 *
 *   • не пересчитываем и не переписываем формат — копируем СЫРЫЕ значения ключей;
 *   • поэтому планировщик питания, движки поддержки и их версии не затрагиваются;
 *   • проверяем то, что можем проверить честно: размер, «это JSON», известный ключ.
 *
 * КУРС — особый случай: его препараты живут в IndexedDB (`course_log`), поэтому
 * в bundle едет `coursePlan` (см. `coach-course.engine`), а строки в базу атлета
 * пишет отдельный тонкий модуль после успешной проверки.
 *
 * ГРАНИЦЫ (важно, и это не осторожность ради осторожности):
 *   • Питание — это план и его рамки (цели КБЖУ, ограничения), но НЕ дневник
 *     питания: дневник — факт человека, его переносить нельзя.
 *   • БАДы — это выбранный протокол (`he_support_plan_result`) и внешние добавки,
 *     но НЕ дневник приёма: «принял/не принял» — факт атлета.
 *   • Курс — это план препаратов и дата старта, но НЕ дневник инъекций.
 *   • Профиль (`he_profile_v2`) целиком не переносим: вес, аллергии и болезни —
 *     данные человека, а не назначение. Рацион их учитывает у него на месте.
 */
import { toPhysicalKey } from '../../core/data-space';
import { PROGRAM_BUNDLE_MAX_CHARS, PROGRAM_KEY_MAX_CHARS } from './coach-program-bundle.engine';
import {
  describeCoursePlan,
  normalizeCoursePlan,
  type CoachCoursePlan,
} from './coach-course.engine';

export const ASSIGNMENT_BUNDLE_KIND = 'coach-assignment';
export const ASSIGNMENT_BUNDLE_VERSION = 1;
/** Потолок одного файла/шаблона: 4 МБ — тот же, что у программы. */
export const ASSIGNMENT_BUNDLE_MAX_CHARS = PROGRAM_BUNDLE_MAX_CHARS;
/** Потолок одного значения (как у PL-бэкапа). */
export const ASSIGNMENT_VALUE_MAX_CHARS = PROGRAM_KEY_MAX_CHARS;

export type AssignmentKind = 'nutrition' | 'supplements' | 'course';

/**
 * Что именно едет в назначении. Порядок = порядок показа в выписке.
 * Список намеренно короткий и объяснимый: всё, чего здесь нет, — либо факт
 * человека (дневники), либо его личные предпочтения вкуса.
 */
export const ASSIGNMENT_KEYS: Record<AssignmentKind, readonly string[]> = {
  nutrition: [
    'he_saved_nutrition_plans',
    'he_nutrition_plan',
    'he_plan_kbju_targets',
    'he_meal_target_overrides',
    'he_special_meals',
    'he_excluded_foods',
    'he_excluded_categories',
    'he_food_allergens',
    'he_intolerances',
  ],
  supplements: ['he_support_plan_result', 'he_support_external_subs'],
  // Курс: в localStorage едет только дата старта, препараты — в `coursePlan`.
  course: ['he_course_start_date'],
};

export const ASSIGNMENT_LABELS: Record<AssignmentKind, string> = {
  nutrition: 'Питание',
  supplements: 'БАДы',
  course: 'Курс',
};

export const ASSIGNMENT_KEY_LABELS: Record<string, string> = {
  he_saved_nutrition_plans: 'Сохранённые рационы',
  he_nutrition_plan: 'Текущий рацион',
  he_plan_kbju_targets: 'Цели КБЖУ',
  he_meal_target_overrides: 'Ручные цели по приёмам',
  he_special_meals: 'Особые приёмы (загрузки, разгрузки)',
  he_excluded_foods: 'Исключённые продукты',
  he_excluded_categories: 'Исключённые категории',
  he_food_allergens: 'Аллергены',
  he_intolerances: 'Непереносимости',
  he_support_plan_result: 'Протокол БАДов',
  he_support_external_subs: 'Внешние добавки',
  he_course_start_date: 'Дата старта курса',
};

export interface CoachAssignmentBundle {
  app: 'bodybuildhealth';
  kind: typeof ASSIGNMENT_BUNDLE_KIND;
  version: typeof ASSIGNMENT_BUNDLE_VERSION;
  assignmentKind: AssignmentKind;
  createdAt: string;
  /** Только для читаемости файла; на применение не влияет. */
  name?: string;
  /** Пространство, откуда сняли назначение (диагностика). */
  sourceSpaceId?: string;
  keys: Partial<Record<string, string>>;
  /** План курса: есть только у `assignmentKind: 'course'`. */
  coursePlan?: CoachCoursePlan;
}

export type AssignmentBundleError = 'not-object' | 'kind' | 'version' | 'empty' | 'size' | 'value' | null;

export interface AssignmentBundleParse {
  bundle: CoachAssignmentBundle | null;
  error: AssignmentBundleError;
}

export interface AssignmentStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const isKind = (v: unknown): v is AssignmentKind =>
  v === 'nutrition' || v === 'supplements' || v === 'course';

/**
 * Ключи, которые приложение хранит СЫРОЙ строкой, а не JSON. Их нельзя
 * проверять через `JSON.parse` и нельзя переписывать в JSON: экран курса читает
 * `he_course_start_date` как строку даты.
 */
const RAW_VALUE_KEYS: ReadonlySet<string> = new Set(['he_course_start_date']);

const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** `15.11.2026` из `YYYY-MM-DD` — для описания назначения. */
const ruDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

const keysFor = (kind: AssignmentKind): readonly string[] => ASSIGNMENT_KEYS[kind];

/**
 * Дата старта живёт в двух местах: в плане и в ключе `he_course_start_date`
 * (его читает экран курса). Для курса ключ обязан совпадать с планом, иначе
 * сохранился бы чужой старый старт этого атлета.
 */
function withPlanStartDate(
  kind: AssignmentKind,
  keys: Partial<Record<string, string>>,
  plan: CoachCoursePlan | undefined,
): Partial<Record<string, string>> {
  if (kind !== 'course') return keys;
  if (!plan?.startDate) return keys;
  return { ...keys, he_course_start_date: plan.startDate };
}

/** Собрать назначение из пространства. Пустые ключи не попадают в набор. */
export function collectAssignmentBundle(
  storage: AssignmentStorageLike | null | undefined,
  spaceId: string,
  kind: AssignmentKind,
  opts: { createdAt?: string; name?: string; coursePlan?: CoachCoursePlan } = {},
): CoachAssignmentBundle {
  const keys: Partial<Record<string, string>> = {};
  if (storage) {
    for (const key of keysFor(kind)) {
      try {
        const raw = storage.getItem(toPhysicalKey(spaceId, key));
        if (typeof raw === 'string' && raw.length) keys[key] = raw;
      } catch {
        /* один недоступный ключ не должен ломать выписку */
      }
    }
  }
  return {
    app: 'bodybuildhealth',
    kind: ASSIGNMENT_BUNDLE_KIND,
    version: ASSIGNMENT_BUNDLE_VERSION,
    assignmentKind: kind,
    createdAt: opts.createdAt ?? new Date().toISOString(),
    ...(opts.name ? { name: opts.name } : {}),
    sourceSpaceId: spaceId,
    keys: withPlanStartDate(kind, keys, opts.coursePlan),
    ...(kind === 'course' && opts.coursePlan ? { coursePlan: opts.coursePlan } : {}),
  };
}

/** Проверить bundle из файла/шаблона. Ничего не пишет. */
export function normalizeAssignmentBundle(value: unknown): AssignmentBundleParse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { bundle: null, error: 'not-object' };
  const obj = value as Record<string, unknown>;
  if (obj.app !== 'bodybuildhealth' || obj.kind !== ASSIGNMENT_BUNDLE_KIND) return { bundle: null, error: 'kind' };
  if (obj.version !== ASSIGNMENT_BUNDLE_VERSION) return { bundle: null, error: 'version' };
  if (!isKind(obj.assignmentKind)) return { bundle: null, error: 'kind' };
  const kind = obj.assignmentKind;
  const rawKeys = obj.keys;
  if (!rawKeys || typeof rawKeys !== 'object' || Array.isArray(rawKeys)) return { bundle: null, error: 'value' };
  const allowed = new Set(keysFor(kind));
  const keys: Partial<Record<string, string>> = {};
  let total = 0;
  for (const [k, v] of Object.entries(rawKeys as Record<string, unknown>)) {
    // Ключ не из этого типа назначения — не «терпим», а отбрасываем: иначе файл
    // питания мог бы притащить протокол БАДов под чужим названием.
    if (!allowed.has(k)) continue;
    if (typeof v !== 'string' || !v.length) return { bundle: null, error: 'value' };
    if (v.length > ASSIGNMENT_VALUE_MAX_CHARS) return { bundle: null, error: 'size' };
    if (RAW_VALUE_KEYS.has(k)) {
      // Дата старта — сырая строка; проверяем формат, а не JSON.
      if (k === 'he_course_start_date' && !isIsoDate(v)) return { bundle: null, error: 'value' };
    } else {
      try {
        JSON.parse(v);
      } catch {
        // Битое значение не должно попасть в пространство атлета: планировщик его
        // «терпимо» проигнорирует, а тренер будет думать, что рацион выдан.
        return { bundle: null, error: 'value' };
      }
    }
    total += v.length;
    if (total > ASSIGNMENT_BUNDLE_MAX_CHARS) return { bundle: null, error: 'size' };
    keys[k] = v;
  }
  let coursePlan: CoachCoursePlan | undefined;
  if (kind === 'course') {
    const parsed = normalizeCoursePlan(obj.coursePlan);
    if (parsed.error || !parsed.plan) {
      return { bundle: null, error: parsed.error === 'limit' ? 'size' : 'value' };
    }
    coursePlan = parsed.plan;
    // Дата старта живёт и в плане, и в ключе: экран курса читает ключ.
    if (coursePlan.startDate && !keys['he_course_start_date']) {
      keys['he_course_start_date'] = coursePlan.startDate;
    }
  }
  if (!Object.keys(keys).length && !coursePlan) return { bundle: null, error: 'empty' };
  return {
    bundle: {
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: ASSIGNMENT_BUNDLE_VERSION,
      assignmentKind: kind,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
      ...(typeof obj.name === 'string' && obj.name ? { name: obj.name } : {}),
      ...(typeof obj.sourceSpaceId === 'string' && obj.sourceSpaceId ? { sourceSpaceId: obj.sourceSpaceId } : {}),
      keys,
      ...(coursePlan ? { coursePlan } : {}),
    },
    error: null,
  };
}

export interface AssignmentBundleSummary {
  kind: AssignmentKind;
  keys: number;
  chars: number;
  /** Что именно внутри — чтобы тренер видел, а не верил названию. */
  parts: string[];
}

export function describeAssignmentBundle(bundle: CoachAssignmentBundle): AssignmentBundleSummary {
  const present = keysFor(bundle.assignmentKind).filter(
    k => typeof bundle.keys[k] === 'string' && bundle.keys[k],
  );
  let chars = 0;
  for (const k of present) chars += (bundle.keys[k] ?? '').length;
  if (bundle.assignmentKind === 'course') {
    // У курса главное — препараты, а не ключи: показываем их, а не «Дата старта».
    const plan = bundle.coursePlan;
    if (!plan) return { kind: 'course', keys: present.length, chars, parts: ['Курс без препаратов'] };
    const summary = describeCoursePlan(plan);
    const parts = [`Курс: ${summary.items} преп. · ${summary.weeks} нед`];
    parts.push(...summary.lines.slice(0, 3));
    if (summary.lines.length > 3) parts.push(`…и ещё ${summary.lines.length - 3}`);
    if (plan.startDate) parts.push(`Старт ${ruDate(plan.startDate)}`);
    return { kind: 'course', keys: present.length, chars, parts };
  }
  return {
    kind: bundle.assignmentKind,
    keys: present.length,
    chars,
    parts: present.map(k => ASSIGNMENT_KEY_LABELS[k] ?? k),
  };
}

export type AssignmentApplyMode = 'replace' | 'merge';

export interface AssignmentApplyResult {
  written: number;
  removed: number;
  error: 'empty' | 'invalid' | 'storage' | null;
}

/**
 * Записать назначение в пространство атлета.
 *
 * `replace` (по умолчанию) сначала снимает ВСЕ ключи этого типа: иначе остался бы
 * «хвост» старого рациона и два плана смешались бы в списке. Ключи другого типа
 * (например, протокол БАДов при выдаче питания) не трогаем.
 *
 * Для курса здесь пишется только дата старта: препараты живут в IndexedDB, их
 * записывает `coach-course-store` после успешной проверки плана.
 */
export function applyAssignmentBundle(
  storage: AssignmentStorageLike | null | undefined,
  spaceId: string,
  value: unknown,
  opts: { mode?: AssignmentApplyMode } = {},
): AssignmentApplyResult {
  if (!storage) return { written: 0, removed: 0, error: 'storage' };
  const parsed = normalizeAssignmentBundle(value);
  if (!parsed.bundle) {
    return { written: 0, removed: 0, error: parsed.error === 'empty' ? 'empty' : 'invalid' };
  }
  const bundle = parsed.bundle;
  const mode = opts.mode ?? 'replace';
  let removed = 0;
  if (mode === 'replace') {
    for (const key of keysFor(bundle.assignmentKind)) {
      if (bundle.keys[key]) continue;
      const physical = toPhysicalKey(spaceId, key);
      try {
        if (storage.getItem(physical) !== null) {
          storage.removeItem(physical);
          removed++;
        }
      } catch {
        return { written: 0, removed, error: 'storage' };
      }
    }
  }
  let written = 0;
  for (const key of keysFor(bundle.assignmentKind)) {
    const raw = bundle.keys[key];
    if (!raw) continue;
    try {
      storage.setItem(toPhysicalKey(spaceId, key), raw);
      written++;
    } catch {
      // Частичная запись честно сообщается как ошибка: тренер повторит или
      // выберет другого атлета, а не будет думать, что всё хорошо.
      return { written, removed, error: 'storage' };
    }
  }
  return { written, removed, error: null };
}

/** Понятное человеку сообщение об ошибке формата. */
export function assignmentBundleErrorText(error: AssignmentBundleError): string {
  switch (error) {
    case 'not-object':
      return 'Это не файл назначения.';
    case 'kind':
      return 'Файл другого типа: нужно назначение питания, БАДов или курса.';
    case 'version':
      return 'Файл сделан другой версией приложения — обновите его.';
    case 'empty':
      return 'В назначении нет ни одного плана.';
    case 'size':
      return 'Назначение слишком большое, чтобы его сохранить.';
    case 'value':
      return 'Внутри назначения битые данные — выдача отменена.';
    default:
      return '';
  }
}
