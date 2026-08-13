/** training-plan-save.engine.ts — сохранение тренировочных миксов и пресетов здоровья.
 *  Единый слой для: дневник тренировок (he_training_mixes), избранное БАД (he_support_favorites),
 *  рекомендации (he_support_fav_recommendations) и очередь в калькулятор поддержки
 *  (he_training_mix_plan_queue). Анализ препаратов микса → структурированные рекомендации. */

import { SUPPORT_CATALOG_DATA, type SupportCatalogEntry } from '../data/support-catalog-data';

export const MIX_DIARY_KEY = 'he_training_mixes';
export const FAVORITES_KEY = 'he_support_favorites';
export const FAV_REC_KEY = 'he_support_fav_recommendations';
export const PLAN_QUEUE_KEY = 'he_training_mix_plan_queue';

export const MIX_DIARY_CAP = 20;
export const FAV_REC_CAP = 20;
export const PLAN_QUEUE_CAP = 10;

export type MixKind = 'mix' | 'preset';

/** Элемент микса/пресета (приводится к этому виду из MixRenderItem / MixTemplateItem). */
export interface PlanSubstance {
  id: string;
  name: string;
  dose: string;
  unit: string;
  mg: number;
  note?: string;
  timing?: 'pre' | 'intra' | 'post';
}

/** Рекомендация по одному веществу микса. */
export interface SubstanceAdvice {
  id: string;
  name: string;
  found: boolean;
  dose: string;
  timing: string;
  advice: string;
  warnings: string[];
  monitoring: string[];
}

/** Конфликт внутри набора микса. */
export interface MixConflictPair {
  a: string;
  b: string;
  effect: string;
  severity: string;
}

/** Полная рекомендация по сохранённому миксу/пресету. */
export interface TrainingPlanRecommendation {
  id: string;
  title: string;
  kind: MixKind;
  goal: string;
  timing?: string;
  score?: number;
  label?: string;
  weightKg?: number;
  substances: SubstanceAdvice[];
  interactions: MixConflictPair[];
  general: string[];
  ts: number;
}

/** Запись в дневнике тренировок (расширение he_training_mixes). */
export interface DiaryMixRecord {
  id: string;
  title: string;
  kind: MixKind;
  goal: string;
  timing?: string;
  score?: number;
  label?: string;
  substances: PlanSubstance[];
  recommendations: TrainingPlanRecommendation | null;
  date: string;
  ts: number;
}

/** Запись в очереди калькулятора поддержки. */
export interface SupportPlanQueueEntry {
  recId: string;
  title: string;
  kind: MixKind;
  goal: string;
  ids: string[];
  ts: number;
}

export interface SaveMixInput {
  title: string;
  kind: MixKind;
  goal: string;
  timing?: 'pre' | 'intra' | 'post';
  score?: number;
  label?: string;
  weightKg?: number;
  substances: PlanSubstance[];
  /** Активная фарма курса (AAS/инсулин/GH и т.д.) — учитывается в рекомендациях. */
  course?: { id: string; name?: string }[];
}

export interface SaveMixResult {
  record: DiaryMixRecord;
  rec: TrainingPlanRecommendation;
  addedFavCount: number;
}

// ─── утилиты ───

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [] as T[];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as T[]) : ([] as T[]);
  } catch {
    return [] as T[];
  }
}

function writeJson(key: string, arr: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch { /* ignore quota */ }
}

function canonSubId(id: string): string {
  return String(id || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function findEntry(id: string): SupportCatalogEntry | null {
  const canon = canonSubId(id);
  if (SUPPORT_CATALOG_DATA[id]) return SUPPORT_CATALOG_DATA[id];
  for (const k of Object.keys(SUPPORT_CATALOG_DATA)) {
    if (canonSubId(k) === canon) return SUPPORT_CATALOG_DATA[k];
  }
  return null;
}

function cut(s: unknown, max: number): string {
  if (s == null) return '';
  if (typeof s !== 'string') s = String(s);
  const t = (s as string).trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// ─── анализ препаратов микса ───

/** Анализ использования веществ микса: каталог-описания, дозы, предупреждения,
 *  мониторинг, конфликты и синергии внутри набора. */
export function analyzeMixUsage(input: SaveMixInput): TrainingPlanRecommendation {
  const idBase = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const substances: SubstanceAdvice[] = [];
  const interactions: MixConflictPair[] = [];
  const general: string[] = [];

  const entries = new Map<string, SupportCatalogEntry | null>();

  for (const s of input.substances) {
    const entry = findEntry(s.id);
    entries.set(s.id, entry);
    const found = Boolean(entry);
    const name = entry?.nameRu || entry?.name || s.name || s.id;
    const timing =
      s.timing === 'pre' ? 'Принимать за 30–60 мин до тренировки' :
      s.timing === 'intra' ? 'Принимать во время тренировки' :
      s.timing === 'post' ? 'Принимать сразу после тренировки' :
      (entry?.dosage?.timing) || '';
    const dose = s.mg > 0 ? (s.mg >= 1000 ? `${(s.mg / 1000).toFixed(1).replace(/\.0$/, '')} г` : `${s.mg} мг`) : `${s.dose}${s.unit}`;
    const advice = cut(entry?.bestForCourse || entry?.description, 260);
    const warnings: string[] = [];
    const monitoring: string[] = [];
    if (entry?.contraindications?.length) {
      warnings.push(...entry.contraindications.slice(0, 2).map(x => cut(String(x), 120)));
    }
    if (entry?.specialInstructions?.length) {
      warnings.push(...entry.specialInstructions.slice(0, 2).map(x => cut(String(x), 120)));
    }
    if (entry?.monitoring?.length) {
      monitoring.push(...entry.monitoring.slice(0, 3).map((m: { what?: string; when?: string; targetRange?: string }) => {
        const target = m.targetRange ? ` (цель: ${m.targetRange})` : '';
        return cut(`${m.what || m.when || 'Мониторинг'}${target}`, 140);
      }));
    }
    substances.push({
      id: canonSubId(s.id),
      name,
      found,
      dose,
      timing,
      advice,
      warnings,
      monitoring,
    });
  }

  // конфликты внутри набора
  const idsInSet = new Set(substances.map(x => x.id));
  for (const [id, entry] of entries.entries()) {
    if (!entry) continue;
    for (const c of entry.conflicts || []) {
      const other = canonSubId(String(c.with || ''));
      if (!other || !idsInSet.has(other)) continue;
      interactions.push({
        a: canonSubId(id),
        b: other,
        effect: cut(c.effect || 'несовместимость', 200),
        severity: c.severity || 'MEDIUM',
      });
    }
  }
  // дедуп пар
  const seenPairs = new Set<string>();
  interactions.sort((x, y) => (x.severity === 'HIGH' ? -1 : 0) - (y.severity === 'HIGH' ? -1 : 0));
  for (const p of [...interactions]) {
    const k = [p.a, p.b].sort().join('|');
    if (seenPairs.has(k)) {
      interactions.splice(interactions.indexOf(p), 1);
      continue;
    }
    seenPairs.add(k);
  }

  // синергии внутри набора
  const synNotes: string[] = [];
  for (const [id, entry] of entries.entries()) {
    if (!entry) continue;
    for (const syn of entry.synergies || []) {
      const other = canonSubId(String(syn.with || ''));
      if (!other || !idsInSet.has(other)) continue;
      const aName = substances.find(x => x.id === canonSubId(id))?.name || id;
      const bName = substances.find(x => x.id === other)?.name || other;
      synNotes.push(`${aName} + ${bName}: ${cut(syn.effect || 'синергия', 160)}`);
    }
  }
  const uniqSyn = [...new Set(synNotes)].slice(0, 5);

  if (interactions.length > 0) {
    const hi = interactions.filter(x => x.severity === 'HIGH');
    general.push(
      hi.length > 0
        ? `⚠️ Обнаружена несовместимость высокого уровня: ${hi.map(x => `${x.a} ↔ ${x.b}`).join(', ')}. Проверьте разделение приёма или исключите один из препаратов.`
        : `Внутри набора есть пары с конфликтом (${interactions.length}): ${interactions.slice(0, 3).map(x => `${x.a} ↔ ${x.b}`).join(', ')} — соблюдайте разнесение приёма.`,
    );
  }
  if (uniqSyn.length > 0) {
    general.push(`✅ Полезные синергии набора: ${uniqSyn.join('; ')}.`);
  }

  // ── взаимодействие с фармой курса ──
  const courseList = (input.course || []).filter(c => c && c.id);
  if (courseList.length > 0) {
    const courseConflicts: string[] = [];
    for (const sub of substances) {
      const entry = findEntry(sub.id);
      if (!entry) continue;
      for (const c of [...(entry.conflicts || []), ...(entry.cautions || [])]) {
        const cw = canonSubId(String(c.with || ''));
        const hit = courseList.find(crs => canonSubId(crs.id) === cw);
        if (!hit) continue;
        const crsName = hit.name || hit.id;
        const severityMark = (c.severity || 'MEDIUM') === 'HIGH' ? '⚠️' : 'ℹ️';
        const msg = `${severityMark} ${sub.name} ↔ фарма курса (${crsName}): ${cut(c.effect || 'взаимодействие', 140)}`;
        sub.warnings.push(msg);
        courseConflicts.push(msg);
      }
    }
    if (courseConflicts.length > 0) {
      general.push(`⚠️ Учтена фарма курса (${courseList.length} препарат.): обнаружены взаимодействия — ${courseConflicts.slice(0, 3).join('; ')}.`);
    } else {
      general.push(`ℹ️ Учтена фарма курса (${courseList.length} препарат.) — конфликтов с миксам не выявлено.`);
    }
  }

  if (input.weightKg) {
    general.push(`Дозировки рассчитаны на вес ${input.weightKg} кг — при изменении веса на 10+ кг пересчитайте микс.`);
  }
  general.push('Перед началом приёма — базовая лаборатория (ОАК, ALT/AST, креатинин) и консультация врача при хронических заболеваниях.');

  const title = input.title || `${input.kind === 'preset' ? 'Пресет' : 'Микс'}: ${input.goal}`;
  return {
    id: `rec_${idBase}`,
    title,
    kind: input.kind,
    goal: input.goal,
    timing: input.timing,
    score: input.score,
    label: input.label,
    weightKg: input.weightKg,
    substances,
    interactions,
    general,
    ts: Date.now(),
  };
}

// ─── дневник тренировок ───

/** Прочитать записи миксов/пресетов из дневника. */
export function readDiaryMixes(): DiaryMixRecord[] {
  return readJson<DiaryMixRecord>(MIX_DIARY_KEY);
}

/** Сохранить микс/пресет в дневник тренировок (prepend, cap 20). date — опционально (тесты/бэкфилл). */
export function saveMixToDiary(input: SaveMixInput, date?: string): DiaryMixRecord {
  const record: DiaryMixRecord = {
    id: `mix_${Date.now().toString(36)}`,
    title: input.title || `${input.kind === 'preset' ? 'Пресет' : 'Микс'}: ${input.goal}`,
    kind: input.kind,
    goal: input.goal,
    timing: input.timing,
    score: input.score,
    label: input.label,
    substances: input.substances,
    recommendations: null,
    date: date || new Date().toISOString().slice(0, 10),
    ts: Date.now(),
  };
  const arr = readDiaryMixes();
  arr.unshift(record);
  writeJson(MIX_DIARY_KEY, arr.slice(0, MIX_DIARY_CAP));
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('he-training-mix-saved'));
  } catch { /* ignore */ }
  return record;
}

/** Удалить запись микса/пресета из дневника. */
export function deleteDiaryMix(id: string): void {
  const arr = readDiaryMixes().filter(x => x.id !== id);
  writeJson(MIX_DIARY_KEY, arr);
}

// ─── избранное БАД ───

/** Добавить вещества микса в избранное БАД (дедуп, канонизация). Возвращает число добавленных. */
export function addSubstancesToFavorites(ids: string[]): number {
  const favs = new Set(readJson<string>(FAVORITES_KEY).map(canonSubId));
  let added = 0;
  for (const raw of ids || []) {
    const c = canonSubId(raw);
    if (!c || favs.has(c)) continue;
    favs.add(c);
    added++;
  }
  if (added > 0) writeJson(FAVORITES_KEY, [...favs]);
  return added;
}

// ─── рекомендации в избранном ───

export function readFavRecommendations(): TrainingPlanRecommendation[] {
  return readJson<TrainingPlanRecommendation>(FAV_REC_KEY);
}

/** Сохранить рекомендацию в избранном (prepend, cap 20). */
export function saveRecommendationToFavorites(rec: TrainingPlanRecommendation): TrainingPlanRecommendation {
  const arr = readFavRecommendations();
  arr.unshift(rec);
  writeJson(FAV_REC_KEY, arr.slice(0, FAV_REC_CAP));
  return rec;
}

export function deleteFavRecommendation(id: string): void {
  const arr = readFavRecommendations().filter(x => x.id !== id);
  writeJson(FAV_REC_KEY, arr);
}

// ─── очередь в калькулятор поддержки ───

export function readSupportPlanQueue(): SupportPlanQueueEntry[] {
  return readJson<SupportPlanQueueEntry>(PLAN_QUEUE_KEY);
}

/** Внести микс/пресет в очередь калькулятора поддержки (по согласию пользователя). */
export function queueMixToSupportPlan(rec: TrainingPlanRecommendation): SupportPlanQueueEntry {
  const entry: SupportPlanQueueEntry = {
    recId: rec.id,
    title: rec.title,
    kind: rec.kind,
    goal: rec.goal,
    ids: rec.substances.filter(x => x.found).map(x => x.id),
    ts: Date.now(),
  };
  if (entry.ids.length === 0) return entry;
  const arr = readSupportPlanQueue().filter(x => x.recId !== entry.recId);
  arr.unshift(entry);
  writeJson(PLAN_QUEUE_KEY, arr.slice(0, PLAN_QUEUE_CAP));
  notifyPlanQueueChanged();
  return entry;
}

export function removeFromSupportPlanQueue(recId: string): void {
  const arr = readSupportPlanQueue().filter(x => x.recId !== recId);
  writeJson(PLAN_QUEUE_KEY, arr);
  notifyPlanQueueChanged();
}

/** Событие изменения очереди плана поддержки (для зеркала в he_general_plan и карточки калькулятора). */
export const PLAN_QUEUE_EVENT = 'he-training-mix-plan-changed';

function notifyPlanQueueChanged(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PLAN_QUEUE_EVENT));
  } catch { /* ignore */ }
}

export function subscribePlanQueueChanged(cb: () => void): () => void {
  try {
    window.addEventListener(PLAN_QUEUE_EVENT, cb);
    return () => window.removeEventListener(PLAN_QUEUE_EVENT, cb);
  } catch {
    return () => {};
  }
}

/** Плоский уникальный список id из очереди (для добавления в план поддержки). */
export function getSupportPlanQueueIds(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of readSupportPlanQueue()) {
    for (const id of e.ids) {
      const c = canonSubId(id);
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(id);
      }
    }
  }
  return out;
}

// ─── комплексное сохранение ───

/** Полный цикл: анализ → дневник + избранное + рекомендация.
 *  Не добавляет в очередь плана поддержки — это делает queueMixToSupportPlan по согласию. */
export function saveMixToDiaryAndFavorites(input: SaveMixInput): SaveMixResult {
  const rec = analyzeMixUsage(input);
  const record = saveMixToDiary(input);
  record.recommendations = rec;
  // обновить рекомендацию внутри записи дневника
  const arr = readDiaryMixes();
  const idx = arr.findIndex(x => x.id === record.id);
  if (idx >= 0) {
    arr[idx].recommendations = rec;
    writeJson(MIX_DIARY_KEY, arr);
  }
  const addedFavCount = addSubstancesToFavorites(input.substances.map(x => x.id));
  saveRecommendationToFavorites(rec);
  return { record, rec, addedFavCount };
}

// ─── эффект пресета через неделю ───

export interface PresetEffect {
  type: 'sleep' | 'weight';
  label: string;
  before: number;
  after: number;
  delta: number;
  samplesBefore: number;
  samplesAfter: number;
}

interface SleepEntry { date: string; hours?: number }
interface WeightEntry { date: string; weight?: number }

/** Среднее за N дней до и после даты пресета по дневникам сна/веса.
 *  sleep → часы сна (goal: sleep), weight → масса тела (goal: fat_loss). */
export function analyzePresetEffect(record: DiaryMixRecord, windowDays = 7): PresetEffect | null {
  const base = new Date(record.date + 'T00:00:00').getTime();
  if (Number.isNaN(base)) return null;
  const inWindow = (d: string) => {
    const t = new Date(d + 'T00:00:00').getTime();
    return !Number.isNaN(t);
  };
  const pick = record.kind === 'preset' && (record.goal === 'sleep' || record.goal === 'fat_loss' || record.goal === 'hydration');
  if (!pick) return null;

  const isSleep = record.goal === 'sleep';
  try {
    const raw: Array<SleepEntry | WeightEntry> = isSleep
      ? (JSON.parse(localStorage.getItem('he_sleep_diary') || '[]') as SleepEntry[])
      : (JSON.parse(localStorage.getItem('he_weight_log') || '[]') as WeightEntry[]);
    if (!Array.isArray(raw)) return null;
    const vals = raw
      .filter(e => inWindow(e.date) && (isSleep ? typeof (e as SleepEntry).hours === 'number' : typeof (e as WeightEntry).weight === 'number'))
      .map(e => ({ t: new Date(e.date + 'T00:00:00').getTime(), v: (isSleep ? (e as SleepEntry).hours : (e as WeightEntry).weight) as number }))
      .filter(e => !Number.isNaN(e.t) && e.v > 0)
      .sort((a, b) => a.t - b.t);
    const before = vals.filter(e => e.t < base && e.t >= base - windowDays * 86400000).map(e => e.v);
    const after = vals.filter(e => e.t > base && e.t <= base + windowDays * 86400000).map(e => e.v);
    if (before.length < 3) return null;
    const avg = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
    const bAvg = avg(before);
    const aAvg = after.length > 0 ? avg(after) : bAvg;
    return {
      type: isSleep ? 'sleep' : 'weight',
      label: isSleep ? 'сон' : 'вес',
      before: Math.round(bAvg * 10) / 10,
      after: Math.round(aAvg * 10) / 10,
      delta: Math.round((aAvg - bAvg) * 10) / 10,
      samplesBefore: before.length,
      samplesAfter: after.length,
    };
  } catch {
    return null;
  }
}

// ─── фазы приёма микса (общий слой дневников: тренировки ↔ поддержка) ───

const SUPPORT_DIARY_KEY = 'he_support_diary';

interface SupportDiaryEntryLike {
  date: string;
  mixIntake?: Record<string, Record<string, boolean>>;
}

/** Текущие отметки фаз приёма микса на дату (из дневника поддержки). */
export function getMixIntake(date: string): Record<string, Record<string, boolean>> {
  try {
    const arr = JSON.parse(localStorage.getItem(SUPPORT_DIARY_KEY) || '[]') as SupportDiaryEntryLike[];
    const entry = (Array.isArray(arr) ? arr : []).find(e => e.date === date);
    return (entry && entry.mixIntake) || {};
  } catch {
    return {};
  }
}

/** Отметить/снять фазу приёма микса на дату (единая запись he_support_diary).
 *  Возвращает обновлённый mixIntake для этой даты. */
export function toggleMixPhaseIntake(date: string, mixId: string, phase: string): Record<string, Record<string, boolean>> {
  let arr: SupportDiaryEntryLike[] = [];
  try {
    arr = JSON.parse(localStorage.getItem(SUPPORT_DIARY_KEY) || '[]');
    if (!Array.isArray(arr)) arr = [];
  } catch {
    arr = [];
  }
  let idx = arr.findIndex(e => e.date === date);
  if (idx < 0) {
    arr.unshift({ date, mixIntake: {} });
    idx = 0;
  }
  const entry = arr[idx];
  const cur = (entry.mixIntake || {});
  const phases = { ...(cur[mixId] || {}) };
  phases[phase] = !phases[phase];
  const mixIntake = { ...cur, [mixId]: phases };
  arr[idx] = { ...entry, mixIntake };
  try { localStorage.setItem(SUPPORT_DIARY_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  return mixIntake;
}

// ─── эффективность миксов: микс-дни → качество сессии ───

export interface MixEffectiveness {
  withMix: { sessions: number; avgRpe: number; avgVolume: number; avgDuration: number };
  withoutMix: { sessions: number; avgRpe: number; avgVolume: number; avgDuration: number };
  rpeDelta: number;
  volumeDelta: number;
}

interface EffectivenessWorkout {
  date: string;
  overallRPE?: number;
  duration?: number;
  totalVolume?: number;
  exercises?: { totalVolume?: number }[];
}

function avgOf(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((s, x) => s + x, 0) / nums.length;
}

/** Корреляция «принял микс → качество сессии»: сравнивает средние RPE/объём/длительность
 *  тренировок в дни с приёмом микса (любая фаза) против дней без микса. */
export function analyzeMixEffectiveness(workouts: EffectivenessWorkout[]): MixEffectiveness | null {
  if (!Array.isArray(workouts) || workouts.length === 0) return null;
  const withMix = { sessions: 0, rpes: [] as number[], volumes: [] as number[], durations: [] as number[] };
  const withoutMix = { sessions: 0, rpes: [] as number[], volumes: [] as number[], durations: [] as number[] };
  for (const w of workouts) {
    const intake = getMixIntake(w.date);
    const anyTaken = Object.values(intake).some(m => Object.values(m || {}).some(v => v));
    const bucket = anyTaken ? withMix : withoutMix;
    bucket.sessions++;
    if (typeof w.overallRPE === 'number' && w.overallRPE > 0) bucket.rpes.push(w.overallRPE);
    const vol = w.totalVolume ?? (w.exercises || []).reduce((s, e) => s + (e.totalVolume || 0), 0);
    if (vol > 0) bucket.volumes.push(vol);
    if (typeof w.duration === 'number' && w.duration > 0) bucket.durations.push(w.duration);
  }
  if (withMix.sessions === 0 || withoutMix.sessions === 0) return null;
  const rpeDelta = Math.round((avgOf(withMix.rpes) - avgOf(withoutMix.rpes)) * 10) / 10;
  const volumeDelta = Math.round(avgOf(withMix.volumes) - avgOf(withoutMix.volumes));
  return {
    withMix: {
      sessions: withMix.sessions,
      avgRpe: Math.round(avgOf(withMix.rpes) * 10) / 10,
      avgVolume: Math.round(avgOf(withMix.volumes)),
      avgDuration: Math.round(avgOf(withMix.durations)),
    },
    withoutMix: {
      sessions: withoutMix.sessions,
      avgRpe: Math.round(avgOf(withoutMix.rpes) * 10) / 10,
      avgVolume: Math.round(avgOf(withoutMix.volumes)),
      avgDuration: Math.round(avgOf(withoutMix.durations)),
    },
    rpeDelta,
    volumeDelta,
  };
}
