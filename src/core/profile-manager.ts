import { UserRole, UserProfile, UnifiedSettings, getDefaultSettings } from "./types";
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { broadcastProfileChange } from './profile-events';

const STORAGE_KEY = "he_profile_v2";
const MIGRATED_FLAG = 'he_profile_migrated_v2';
const REMOVED_BIOSTACK_KEYS = [
  'he_biostack_stacks_v2', 'he_biostack_active_idx', 'he_biostack_active',
  'he_biostack_favorites', 'he_biostack_gate_cache', 'he_biostack_to_plan',
  'he_biostack_compliance', 'he_biostack_start_date', 'he_biostack_tab',
  'he_biostack_profile', 'he_biostack_reminders',
];

function cleanupRemovedBioStackStorage(): void {
  try {
    for (const key of REMOVED_BIOSTACK_KEYS) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('he_biostack_name_')) localStorage.removeItem(key);
    }
  } catch {}
}

/** Очистка легаси-ключей выполняется один раз за сессию (перебор ВСЕХ ключей localStorage дорогой). */
let bioStackCleanupDone = false;
function ensureBioStackCleanup(): void {
  if (bioStackCleanupDone) return;
  bioStackCleanupDone = true;
  cleanupRemovedBioStackStorage();
}

type ProfileListener = () => void;
const listeners: Set<ProfileListener> = new Set();

/* ── Версионирование для granular подписок ── */
let profileVersion = 0;
const sectionVersions: Record<string, number> = {
  personal: 0, training: 0, pharma: 0, health: 0,
  nutrition: 0, lifestyle: 0, system: 0, goals: 0, labs: 0, symptoms: 0,
};

export function onProfileChange(fn: ProfileListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyAll(changedSections?: string[]) {
  profileVersion++;
  listeners.forEach(fn => { try { fn(); } catch {} });
  // Триггерим event-bus — модули с onProfileSectionChange/onAnyProfileChange получают сигнал
  // Если передан changedSections — используем его (точные данные).
  // Иначе собираем все секции, у которых version > 0 (накопительно с последнего сброса).
  const changed = changedSections && changedSections.length > 0
    ? changedSections
    : (() => {
        const list: string[] = [];
        for (const sec of Object.keys(sectionVersions)) {
          if (sectionVersions[sec] > 0) list.push(sec);
        }
        return list;
      })();
  try { broadcastProfileChange(changed); } catch {}
}

export function getProfileVersion(): number { return profileVersion; }
export function getSectionVersion(section: keyof UnifiedSettings): number {
  return sectionVersions[section] || 0;
}

/* ── Backward-compat: old flat paths → nested ── */
const FLAT_TO_NESTED: Record<string, string[]> = {
  age:['personal','age'], weight:['personal','weight'], height:['personal','height'],
  sex:['personal','sex'], bodyFat:['personal','bodyFat'], bloodType:['personal','bloodType'],
  emergencyName:['personal','emergencyName'], emergencyPhone:['personal','emergencyPhone'],
  sportType:['training','sportType'], trainingExperience:['training','experience'],
  trainingLevel:['training','level'], workoutsPerWeek:['training','daysPerWeek'],
  avgWorkoutMinutes:['training','minutesPerSession'],
  primaryGoal:['training','primaryGoal'], goal:['training','primaryGoal'],
  weakPoints:['training','weakPoints'], pmSquat:['training','pmSquat'],
  pmBench:['training','pmBench'], pmDead:['training','pmDeadlift'],
  workMax:['training','workMax'], equipment:['training','equipment'],
  recovery:['training','recovery'], motivation:['training','motivation'],
  doms:['training','doms'],
  phase:['pharma','phase'], courseStartDate:['pharma','courseStartDate'],
  pharmaExperience:['pharma','experience'], totalCycles:['pharma','totalCycles'],
  trainingCycleGoal:['pharma','trainingCycleType'], cycleWeeks:['pharma','trainingCycleWeeks'],
  previousCycles:['pharma','previousCycles'], timeSinceLastCycle:['pharma','timeSinceLastCycle'],
  yearsOnGear:['pharma','yearsOnGear'], monthsSinceLastCourse:['pharma','monthsSinceLastCourse'],
  hcgEnabled:['pharma','hcgEnabled'], aiEnabled:['pharma','aiEnabled'],
  chronicConditions:['health','chronicConditions'], genetics:['health','genetics'],
  injuries:['health','injuries'], excludedSupplements:['health','excludedSupplements'],
  excludedMeds:['health','excludedMeds'], allergyNotes:['health','drugAllergies'],
  drugAllergies:['health','drugAllergies'],
  dietType:['nutrition','dietType'], mealsPerDay:['nutrition','mealsPerDay'],
  cookingSkill:['nutrition','cookingSkill'], foodAllergies:['nutrition','foodAllergies'],
  foodIntolerances:['nutrition','foodIntolerances'], excludedFoods:['nutrition','excludedFoods'],
  preferredFoods:['nutrition','preferredFoods'], proteinPerKg:['nutrition','proteinPerKg'],
  fiberG:['nutrition','fiberG'], omega3G:['nutrition','omega3G'],
  sodiumG:['nutrition','sodiumG'], potassiumG:['nutrition','potassiumG'],
  alcoholPerWeek:['nutrition','alcoholPerWeek'], currentSupplements:['nutrition','currentSupplements'],
  currentMedications:['nutrition','currentMedications'],
  baselineSleepHours:['lifestyle','sleepHours'], sleepHours:['lifestyle','sleepHours'],
  baselineSleepQuality:['lifestyle','sleepQuality'], sleepQuality:['lifestyle','sleepQuality'],
  chronotype:['lifestyle','chronotype'], bedtime:['lifestyle','bedtime'],
  wakeTime:['lifestyle','wakeTime'], baselineHrvRatio:['lifestyle','baselineHrvRatio'],
  hrvRatio:['lifestyle','baselineHrvRatio'], fatigueLevel:['lifestyle','fatigueLevel'],
  baselineStressLevel:['lifestyle','stressLevel'], stressLevel:['lifestyle','stressLevel'],
  dailySteps:['lifestyle','dailySteps'], dailyWaterLiters:['lifestyle','dailyWaterLiters'],
  smoke:['lifestyle','smoke'], activityLevel:['lifestyle','activityLevel'],
  nightAwakenings:['lifestyle','nightAwakenings'],
  mcRuns:['system','mcRuns'], forceNoLabsPenalty:['system','forceNoLabsPenalty'],
  preferredUnits:['system','preferredUnits'], notificationsEnabled:['system','notificationsEnabled'],
  privacyLevel:['system','privacyLevel'], nutritionFactor:['system','nutritionFactor'],
  trainingFactor:['system','trainingFactor'], hasHIIT:['system','hasHIIT'],
  volumeTonnes:['system','volumeTonnes'], lissMinutesPerWeek:['system','lissMinutesPerWeek'],
  targetWeight:['system','targetWeight'],
  targetBodyFat:['system','targetBodyFat'], email:['system','email'],
  goalTimelineWeeks:['system','goalTimelineWeeks'], secondaryGoals:['system','secondaryGoals'],
};

const NESTED_SECTIONS = ['personal','training','pharma','health','nutrition','lifestyle','system'] as const;

function makeSettingsProxy(s: UnifiedSettings): UnifiedSettings {
  for (const sec of NESTED_SECTIONS) {
    if ((s as any)[sec] === undefined || (s as any)[sec] === null) {
      (s as any)[sec] = {};
    }
  }
  return new Proxy(s, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && FLAT_TO_NESTED[prop]) {
        const [section, field] = FLAT_TO_NESTED[prop];
        const sec = (target as any)[section];
        return sec !== undefined ? sec[field] : undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'string' && FLAT_TO_NESTED[prop]) {
        const [section, field] = FLAT_TO_NESTED[prop];
        const sec = (target as any)[section];
        if (sec !== undefined) { sec[field] = value; return true; }
      }
      return Reflect.set(target, prop, value, receiver);
    },
  }) as UnifiedSettings;
}

/** Поля, которые должны быть массивами — нормализуем при чтении.
 *  ВАЖНО: сюда нельзя добавлять объекты/строки (напр. health.genetics — Record,
 *  personal.bloodType — string) — normalize заменит их на [] и УНИЧТОЖИТ данные. */
const ARRAY_FIELDS: Record<string, string[]> = {
  health: ['injuries', 'chronicConditions', 'excludedSupplements', 'excludedMeds'],
  nutrition: ['foodAllergies', 'foodIntolerances', 'excludedFoods', 'preferredFoods', 'excludedCategories', 'lockedFoods', 'tasteProfile'],
  training: ['weakPoints', 'equipment', 'daysOfWeek'],
  symptoms: ['recent'],
};

function normalizeArrayFields(settings: any): void {
  if (!settings || typeof settings !== 'object') return;
  for (const [section, fields] of Object.entries(ARRAY_FIELDS)) {
    const sec = settings[section];
    if (!sec || typeof sec !== 'object') continue;
    for (const field of fields) {
      const v = sec[field];
      if (v === undefined || v === null) continue;
      // Только если значение — «плохой массив» (не массив и не объект).
      // Объекты (Record) не трогаем — они легитимные данные.
      if (!Array.isArray(v) && typeof v !== 'object') {
        sec[field] = [];
      }
    }
  }
}

/* Читает профиль из localStorage с backward-compat proxy для settings. */
export function getProfile(): UserProfile {
  try {
    ensureBioStackCleanup();
    const saved = localStorage.getItem(STORAGE_KEY);
    const p: UserProfile = saved ? JSON.parse(saved) : getDefaultProfile();
    p.settings = makeSettingsProxy(p.settings);
    normalizeArrayFields(p.settings);
    return p;
  } catch { return getDefaultProfile(); }
}

/* ── Кэш парсинга профиля: один JSON.parse на все подписки за один notify ── */
let parsedProfile: UserProfile | null = null;
let parsedProfileVersion = -1;
function getCachedProfile(): UserProfile {
  if (!parsedProfile || parsedProfileVersion !== profileVersion) {
    parsedProfile = getProfile();
    parsedProfileVersion = profileVersion;
  }
  return parsedProfile;
}

/**
 * Сохраняет профиль.
 * При первом сохранении после миграции (MIGRATED_FLAG есть) удаляет старые дублирующие хранилища.
 */
export function updateProfile(ctx: Partial<UserProfile>): UserProfile {
  const current = getProfile();
  const updated = { ...current, ...ctx };
  // Если обновляются только настройки — инкрементим только их версию
  if (ctx.settings) {
    const prev = (current.settings || {}) as any;
    const next = ctx.settings as any;
    for (const sec of Object.keys(sectionVersions)) {
      if (next[sec] !== undefined && next[sec] !== prev[sec]) {
        sectionVersions[sec]++;
      }
    }
  } else {
    // Без settings — инкрементим все (любое изменение профиля)
    for (const sec of Object.keys(sectionVersions)) sectionVersions[sec]++;
  }
  // Защита от QuotaExceededError: если localStorage переполнен — очищаем snapshots и пробуем снова.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try { clearSnapshots(); } catch {}
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e2: any) {
        console.error('[updateProfile] QuotaExceeded after clearing snapshots:', e2);
        throw e2;
      }
    } else {
      throw e;
    }
  }
  // При первом сохранении после миграции — зачистка старых хранилищ
  if (localStorage.getItem(MIGRATED_FLAG) && !localStorage.getItem('he_profile_cleanup_done')) {
    try { localStorage.removeItem('he_training_profile'); } catch {}
    try { localStorage.removeItem('he_autocalc_state'); } catch {}
    try { localStorage.removeItem('he_biostack_profile'); } catch {}
    localStorage.setItem('he_profile_cleanup_done', '1');
  }
  // Собираем список изменённых секций для broadcast
  const changedSections: string[] = [];
  if (ctx.settings) {
    const prev = (current.settings || {}) as any;
    const next = ctx.settings as any;
    for (const sec of Object.keys(sectionVersions)) {
      if (next[sec] !== undefined && next[sec] !== prev[sec]) {
        changedSections.push(sec);
      }
    }
  } else {
    // Без settings — все секции считаются изменёнными
    for (const sec of Object.keys(sectionVersions)) changedSections.push(sec);
  }
  notifyAll(changedSections);
  return updated;
}

/**
 * Точечное обновление одной секции настроек.
 * Не вызывает полный notifyAll — подписчики granular хуков получают обновления
 * через sectionVersions.
 */
export function updateSection<K extends keyof UnifiedSettings>(
  section: K,
  patch: Partial<UnifiedSettings[K]>
): UserProfile {
  const current = getProfile();
  const currentSection = (current.settings as any)[section] || {};
  const updated = {
    ...current,
    settings: {
      ...current.settings,
      [section]: { ...currentSection, ...patch },
    },
  };
  sectionVersions[section]++;
  // Защита от QuotaExceededError
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try { clearSnapshots(); } catch {}
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); }
      catch (e2) { console.error('[updateSection] QuotaExceeded after clear:', e2); throw e2; }
    } else { throw e; }
  }
  notifyAll([section as string]);
  return updated;
}

/**
 * Snapshot профиля для undo.
 */
export interface ProfileSnapshot {
  version: number;
  timestamp: number;
  settings: UnifiedSettings;
  name?: string;
  role?: UserRole;
}

const SNAPSHOTS_KEY = 'he_profile_snapshots_v1';
const SNAPSHOTS_MAX = 10;

export function pushSnapshot(): void {
  try {
    const p = getProfile();
    const snap: ProfileSnapshot = {
      version: profileVersion,
      timestamp: Date.now(),
      settings: JSON.parse(JSON.stringify(p.settings)) as UnifiedSettings,
      name: p.name,
      role: p.role,
    };
    const existing = getSnapshots();
    existing.push(snap);
    if (existing.length > SNAPSHOTS_MAX) existing.shift();
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
  } catch {}
}

export function getSnapshots(): ProfileSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
  } catch { return []; }
}

export function undoLastSnapshot(): boolean {
  const snaps = getSnapshots();
  if (snaps.length === 0) return false;
  const last = snaps[snaps.length - 1];
  try {
    const cur = getProfile();
    const restored: UserProfile = {
      ...cur,
      settings: last.settings,
      name: last.name ?? cur.name,
      role: last.role ?? cur.role,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    // Сравниваем со старым состоянием — инкрементим только реально изменённые секции
    const prevSettings = (cur.settings || {}) as any;
    const nextSettings = (last.settings || {}) as any;
    for (const sec of Object.keys(sectionVersions)) {
      if (JSON.stringify(prevSettings[sec]) !== JSON.stringify(nextSettings[sec])) {
        sectionVersions[sec]++;
      }
    }
    notifyAll();
    return true;
  } catch { return false; }
}

export function clearSnapshots(): void {
  try { localStorage.removeItem(SNAPSHOTS_KEY); } catch {}
}

export function setRole(role: UserRole): void {
  const current = getProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, role }));
  notifyAll();
}

function getDefaultProfile(): UserProfile {
  return {
    name: "",
    id: "",
    role: "user",
    settings: getDefaultSettings(),
  };
}

export function useProfileRefresh(): UserProfile {
  const getSnapshot = useCallback(() => getCachedProfile(), []);
  return useSyncExternalStore(onProfileChange, getSnapshot);
}

/* ── Кэш снапшотов секций: секция перерисовывается ТОЛЬКО при изменении своей версии ── */
const sectionSnapshots: Record<string, { version: number; value: any }> = {};

/**
 * Granularный хук: подписка на одну секцию настроек.
 * Перерендеривается ТОЛЬКО при изменении этой секции (сравнение по sectionVersions),
 * снапшот кэшируется по ссылке — соседние секции не перерисовываются.
 */
export function useProfileSection<K extends keyof UnifiedSettings>(
  section: K
): [UnifiedSettings[K], (patch: Partial<UnifiedSettings[K]>) => void] {
  const getSnapshot = useCallback((): UnifiedSettings[K] => {
    const v = getSectionVersion(section);
    const cached = sectionSnapshots[section as string];
    if (!cached || cached.version !== v) {
      const p = getCachedProfile();
      sectionSnapshots[section as string] = {
        version: v,
        value: ((p.settings as any)[section] || {}) as UnifiedSettings[K],
      };
    }
    return sectionSnapshots[section as string].value;
  }, [section]);

  const value = useSyncExternalStore(onProfileChange, getSnapshot);

  const setter = useCallback((patch: Partial<UnifiedSettings[K]>) => {
    updateSection(section, patch);
  }, [section]);

  return [value, setter];
}

/**
 * Granularный хук: подписка на одно поле внутри секции.
 * Перерендеривается ТОЛЬКО при изменении этого поля.
 */
export function useProfileField<K extends keyof UnifiedSettings, F extends keyof UnifiedSettings[K]>(
  section: K,
  field: F
): [UnifiedSettings[K][F], (v: UnifiedSettings[K][F]) => void] {
  const [sectionValue] = useProfileSection(section);
  const value = (sectionValue as any)[field];
  const setter = useCallback((v: UnifiedSettings[K][F]) => {
    updateSection(section, { [field]: v } as any);
  }, [section, field]);
  return [value, setter];
}

/**
 * Хук для auto-save с debounce (НЕ рекомендуется — используйте useSectionState).
 * @param delay мс (по умолчанию 500)
 */
export function useProfileAutoSave(delay = 500): {
  scheduleSave: (settings: UnifiedSettings) => void;
  flush: () => void;
  pending: React.MutableRefObject<UnifiedSettings | null>;
} {
  const pending = useRef<UnifiedSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRef = useRef(true);

  const scheduleSave = useCallback((next: UnifiedSettings) => {
    // Skip первый save (initial state)
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current) {
        try { pushSnapshot(); } catch {}
        try { updateProfile({ settings: pending.current }); } catch {}
        pending.current = null;
      }
    }, delay);
  }, [delay]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) {
      try { pushSnapshot(); } catch {}
      try { updateProfile({ settings: pending.current }); } catch {}
      pending.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // flush на unmount
      if (timer.current) {
        clearTimeout(timer.current);
        if (pending.current) {
          try { updateProfile({ settings: pending.current }); } catch {}
        }
      }
    };
  }, []);

  return { scheduleSave, flush, pending };
}
