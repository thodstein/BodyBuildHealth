/**
 * coach-mode.engine.ts — «Режим тренера» (п.9 аудита PL-auto), ОБЩИЙ слой.
 *
 * Зачем отдельный движок, а не фича PL-авто: тренер ведёт не только пауэрлифтинг.
 * Поэтому здесь нет ни одного PL-понятия — только реестр атлетов, выбор разделов
 * приложения и активный атлет. Пользуются этим и тренировки, и питание, и анализы.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ (важно не соврать в UI):
 *  • данные разделов (планы, дневники, анализы) по-прежнему живут в профиле
 *    устройства — этот движок НЕ делает изоляцию данных по атлетам. Он ведёт
 *    карточки атлетов, выбор разделов и активного атлета. Изоляция — следующий шаг,
 *    и UI обязан говорить это прямо, а не делать вид, что у каждого атлета свой план;
 *  • лимит 20 атлетов — требование продукта, а не техники: движок не даёт его
 *    превысить и возвращает причину, а не молча обрезает;
 *  • числовые поля (возраст/вес/рост) проверяются только на здравый смысл
 *    (опечатка/минус/мусор), это НЕ медицинские нормативы и не «норма»;
 *  • парсер терпимый: битый JSON, чужая версия и мусорные записи не роняют
 *    профиль, а невалидные атлеты просто не загружаются.
 */
import { localIsoDate } from '../../core/local-date';

export const COACH_STORE_KEY = 'he_coach_mode';
/** Требование продукта: тренер вносит до 20 атлетов. */
export const COACH_MAX_ATHLETES = 20;
const MAX_NAME_CHARS = 60;
const MAX_TEXT_CHARS = 240;
/** Здравый смысл полей, не нормативы. */
const AGE_MIN = 10;
const AGE_MAX = 100;
const WEIGHT_MIN = 20;
const WEIGHT_MAX = 400;
const HEIGHT_MIN = 80;
const HEIGHT_MAX = 260;

export type CoachSectionId = 'training' | 'nutrition' | 'labs' | 'risks' | 'pharma' | 'supplements';

export interface CoachSectionDef {
  id: CoachSectionId;
  label: string;
  hint: string;
  /** Ключ навигации приложения (NAV_TARGETS) для быстрого перехода. */
  nav: string;
}

/** Разделы = реальные направления приложения (нижняя навигация), не выдумка. */
export const COACH_SECTIONS: readonly CoachSectionDef[] = [
  { id: 'training', label: 'Тренировки', hint: 'План, дневник, объём', nav: 'training' },
  { id: 'nutrition', label: 'Питание', hint: 'КБЖУ, рацион, дневник', nav: 'nutrition' },
  { id: 'labs', label: 'Анализы', hint: 'Биохимия и динамика', nav: 'labs' },
  { id: 'risks', label: 'Риски', hint: 'Риски и противопоказания', nav: 'risks' },
  { id: 'pharma', label: 'Фарма', hint: 'Курсы и препараты', nav: 'pharma' },
  { id: 'supplements', label: 'БАДы', hint: 'Добавки и симптомы', nav: 'support' },
];

const SECTION_IDS: CoachSectionId[] = COACH_SECTIONS.map(s => s.id);

export type CoachSex = 'male' | 'female' | 'unspecified';

export interface CoachAthlete {
  id: string;
  name: string;
  sex: CoachSex;
  /** Возраст, лет (null — не указан). */
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  /** Направление/вид спорта свободным текстом (пауэрлифтинг, ББ, армреслинг…). */
  direction: string;
  /** Цель свободным текстом. */
  goal: string;
  /** Какие разделы тренер ведёт этому атлету. */
  sections: CoachSectionId[];
  /** Заметка тренера по атлету (короткая, не дневник). */
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachState {
  version: 1;
  enabled: boolean;
  /** Разделы, которые тренер выбрал для работы. Пусто — ничего не выбрано. */
  sections: CoachSectionId[];
  athletes: CoachAthlete[];
  activeAthleteId: string | null;
}

export function emptyCoachState(): CoachState {
  return { version: 1, enabled: false, sections: [], athletes: [], activeAthleteId: null };
}

const nowIso = (): string => new Date().toISOString();
const clampText = (v: unknown, max = MAX_TEXT_CHARS): string => String(v ?? '').trim().slice(0, max);
const numOrNull = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 10) / 10;
};

const isSectionId = (v: unknown): v is CoachSectionId => SECTION_IDS.includes(v as CoachSectionId);

/** Уникальные известные разделы в порядке каталога. */
export function normalizeCoachSections(raw: unknown): CoachSectionId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter(isSectionId));
  return SECTION_IDS.filter(id => set.has(id));
}

/** Все разделы — «выбрать все» одним действием. */
export function allCoachSections(): CoachSectionId[] {
  return [...SECTION_IDS];
}

function normalizeSex(v: unknown): CoachSex {
  return v === 'male' || v === 'female' ? v : 'unspecified';
}

function normalizeAthlete(raw: unknown): CoachAthlete | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<CoachAthlete> & Record<string, unknown>;
  const id = clampText(a.id, 80);
  const name = clampText(a.name, MAX_NAME_CHARS);
  if (!id || !name) return null;
  const createdAt = clampText(a.createdAt, 40) || nowIso();
  const age = numOrNull(a.age, AGE_MIN, AGE_MAX);
  const ageNum = age === null ? null : Math.trunc(age);
  return {
    id,
    name,
    sex: normalizeSex(a.sex),
    age: ageNum,
    weightKg: numOrNull(a.weightKg, WEIGHT_MIN, WEIGHT_MAX),
    heightCm: numOrNull(a.heightCm, HEIGHT_MIN, HEIGHT_MAX),
    direction: clampText(a.direction, 80),
    goal: clampText(a.goal, MAX_TEXT_CHARS),
    sections: normalizeCoachSections(a.sections),
    note: clampText(a.note, MAX_TEXT_CHARS * 2),
    createdAt,
    updatedAt: clampText(a.updatedAt, 40) || createdAt,
  };
}

/** Терпимый парсер: чужая версия/битый JSON → пустое состояние. */
export function parseCoachState(raw: string | null | undefined): CoachState {
  if (!raw) return emptyCoachState();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachState();
    const obj = parsed as Partial<CoachState> & Record<string, unknown>;
    if (obj.version !== 1) return emptyCoachState();
    const seen = new Set<string>();
    const athletes: CoachAthlete[] = [];
    for (const row of Array.isArray(obj.athletes) ? obj.athletes : []) {
      const a = normalizeAthlete(row);
      if (!a || seen.has(a.id)) continue;
      seen.add(a.id);
      athletes.push(a);
      if (athletes.length >= COACH_MAX_ATHLETES) break;
    }
    const active = clampText(obj.activeAthleteId, 80);
    return {
      version: 1,
      enabled: obj.enabled === true,
      sections: normalizeCoachSections(obj.sections),
      athletes,
      activeAthleteId: active && seen.has(active) ? active : null,
    };
  } catch {
    return emptyCoachState();
  }
}

export function serializeCoachState(state: CoachState): string {
  return JSON.stringify({
    version: 1,
    enabled: state.enabled,
    sections: state.sections,
    athletes: state.athletes,
    activeAthleteId: state.activeAthleteId,
  });
}

export function readCoachState(storage: { getItem: (k: string) => string | null } | null | undefined): CoachState {
  if (!storage) return emptyCoachState();
  try {
    return parseCoachState(storage.getItem(COACH_STORE_KEY));
  } catch {
    return emptyCoachState();
  }
}

/** Сохранить состояние; квота/ошибка хранилища не роняет профиль. */
export function writeCoachState(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  state: CoachState,
): CoachState {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_STORE_KEY, serializeCoachState(state));
    } catch {
      /* ignore quota */
    }
  }
  return state;
}

/* ------------------------------------------------------------------ */
/* Переключатель и разделы                                             */
/* ------------------------------------------------------------------ */

/**
 * Включение режима тренера. Первое включение с пустым выбором разделов
 * подставляет ВСЕ разделы: «включил и не понял, почему пусто» — плохой старт,
 * а снять лишние дешевле, чем искать, где они выбираются.
 */
export function setCoachEnabled(state: CoachState, enabled: boolean): CoachState {
  const sections = enabled && state.sections.length === 0 ? allCoachSections() : state.sections;
  return { ...state, enabled, sections };
}

export function toggleCoachSection(state: CoachState, id: CoachSectionId): CoachState {
  if (!isSectionId(id)) return state;
  const has = state.sections.includes(id);
  const sections = has ? state.sections.filter(s => s !== id) : normalizeCoachSections([...state.sections, id]);
  return { ...state, sections };
}

export function setCoachSections(state: CoachState, ids: unknown): CoachState {
  return { ...state, sections: normalizeCoachSections(ids) };
}

export function selectAllCoachSections(state: CoachState): CoachState {
  return { ...state, sections: allCoachSections() };
}

/* ------------------------------------------------------------------ */
/* Атлеты                                                              */
/* ------------------------------------------------------------------ */

export type CoachAthleteError = 'limit' | 'name' | null;

export interface CoachAthletePatch {
  name?: string;
  sex?: CoachSex | string;
  age?: number | string | null;
  weightKg?: number | string | null;
  heightCm?: number | string | null;
  direction?: string;
  goal?: string;
  sections?: unknown;
  note?: string;
}

export interface AddCoachAthleteResult {
  state: CoachState;
  athlete: CoachAthlete | null;
  error: CoachAthleteError;
}

function nextAthleteId(existing: CoachAthlete[], now: string): string {
  const base = `a_${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
  let id = base;
  let i = 1;
  while (existing.some(a => a.id === id)) id = `${base}_${++i}`;
  return id;
}

/**
 * Добавить атлета. Лимит 20 — жёсткий: при переполнении возвращаем `limit`
 * и НЕ трогаем состояние (никакого «вытесним самого старого» — это чужие данные).
 */
export function addCoachAthlete(
  state: CoachState,
  input: CoachAthletePatch,
  opts: { id?: string; now?: string } = {},
): AddCoachAthleteResult {
  const name = clampText(input.name, MAX_NAME_CHARS);
  if (!name) return { state, athlete: null, error: 'name' };
  if (state.athletes.length >= COACH_MAX_ATHLETES) return { state, athlete: null, error: 'limit' };
  const now = opts.now ?? nowIso();
  const athlete: CoachAthlete = normalizeAthlete({
    id: opts.id ?? nextAthleteId(state.athletes, now),
    name,
    sex: input.sex,
    age: input.age,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    direction: input.direction,
    goal: input.goal,
    sections: input.sections ?? state.sections,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  }) as CoachAthlete;
  const next: CoachState = {
    ...state,
    athletes: [...state.athletes, athlete],
    activeAthleteId: state.activeAthleteId ?? athlete.id,
  };
  return { state: next, athlete, error: null };
}

export function updateCoachAthlete(
  state: CoachState,
  id: string,
  patch: CoachAthletePatch,
  opts: { now?: string } = {},
): CoachState {
  const idx = state.athletes.findIndex(a => a.id === id);
  if (idx < 0) return state;
  const prev = state.athletes[idx];
  const merged = normalizeAthlete({
    ...prev,
    name: patch.name === undefined ? prev.name : clampText(patch.name, MAX_NAME_CHARS),
    sex: patch.sex === undefined ? prev.sex : patch.sex,
    age: patch.age === undefined ? prev.age : patch.age,
    weightKg: patch.weightKg === undefined ? prev.weightKg : patch.weightKg,
    heightCm: patch.heightCm === undefined ? prev.heightCm : patch.heightCm,
    direction: patch.direction === undefined ? prev.direction : clampText(patch.direction, 80),
    goal: patch.goal === undefined ? prev.goal : clampText(patch.goal, MAX_TEXT_CHARS),
    sections: patch.sections === undefined ? prev.sections : patch.sections,
    note: patch.note === undefined ? prev.note : clampText(patch.note, MAX_TEXT_CHARS * 2),
    updatedAt: opts.now ?? nowIso(),
  });
  if (!merged) return state; // пустое имя не сохраняем: атлет без имени бесполезен
  const athletes = [...state.athletes];
  athletes[idx] = merged;
  return { ...state, athletes };
}

export function removeCoachAthlete(state: CoachState, id: string): CoachState {
  const athletes = state.athletes.filter(a => a.id !== id);
  if (athletes.length === state.athletes.length) return state;
  return {
    ...state,
    athletes,
    activeAthleteId: state.activeAthleteId === id ? null : state.activeAthleteId,
  };
}

export function setActiveCoachAthlete(state: CoachState, id: string | null): CoachState {
  if (id === null) return { ...state, activeAthleteId: null };
  if (!state.athletes.some(a => a.id === id)) return state;
  return { ...state, activeAthleteId: id };
}

export function coachActiveAthlete(state: CoachState): CoachAthlete | null {
  if (!state.activeAthleteId) return null;
  return state.athletes.find(a => a.id === state.activeAthleteId) ?? null;
}

export interface CoachLimits {
  count: number;
  max: number;
  canAdd: boolean;
  remaining: number;
}

export function coachLimits(state: CoachState): CoachLimits {
  const max = COACH_MAX_ATHLETES;
  const count = state.athletes.length;
  return { count, max, canAdd: count < max, remaining: Math.max(0, max - count) };
}

/** Короткая подпись для карточки профиля. */
export function coachSummary(state: CoachState): string {
  if (!state.enabled) return 'Выключен · карточки атлетов, разделы и активный атлет';
  const parts = [`${state.athletes.length}/${COACH_MAX_ATHLETES} атлетов`, `${state.sections.length} разделов`];
  const active = coachActiveAthlete(state);
  if (active) parts.push(`активный: ${active.name}`);
  return parts.join(' · ');
}

/** Дефолтная дата для новых записей (нужна UI, чтобы не тащить канон в компонент). */
export function coachToday(): string {
  return localIsoDate();
}
