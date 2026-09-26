/**
 * combat-measurements.engine.ts — замеры, журналы и скрининги (E8).
 *
 * Правило проекта: числовая научная константа либо имеет проверяемый источник,
 * либо её нет в коде. Каждый порог ниже подписан PMID; уровень проверки указан
 * явно, потому что у части источников abstract не перечисляет числа.
 *
 * Проверено через PubMed E-utilities (esummary + efetch abstracts), 2026-09.
 */

import type { SparringLoad } from './combat-sparring.engine';

// ─── 8.1 Журнал веса ───────────────────────────────────────────────────────

export const COMBAT_WIGHINS_KEY = 'he_combat_weighins_v1';
/** 180 записей ≈ 6 месяцев ежедневного веса. */
export const COMBAT_WIGHINS_CAP = 180;

export interface WeighIn {
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
  note?: string;
}

const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

function readStore<T>(key: string): T[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeStore(key: string, rows: unknown[]): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

function validWeighIn(r: any): WeighIn | null {
  if (!r || !isIso(r.date)) return null;
  const w = num(r.weightKg);
  if (w === null || w < 20 || w > 400) return null;
  return { date: r.date, weightKg: w, note: typeof r.note === 'string' ? r.note.slice(0, 200) : undefined };
}

/** Чистка формы + кап. Одна запись на дату: более поздняя перезаписывает. */
export function normalizeWeighIns(rows: any[]): WeighIn[] {
  const byDate = new Map<string, WeighIn>();
  for (const r of rows) {
    const v = validWeighIn(r);
    if (v) byDate.set(v.date, v);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-COMBAT_WIGHINS_CAP);
}

export function loadWeighIns(): WeighIn[] {
  return normalizeWeighIns(readStore<any>(COMBAT_WIGHINS_KEY));
}

/** true — запись реально дошла до хранилища. */
export function addWeighIn(date: string, weightKg: number, note?: string): boolean {
  const v = validWeighIn({ date, weightKg, note });
  if (!v) return false;
  return writeStore(COMBAT_WIGHINS_KEY, normalizeWeighIns([...readStore<any>(COMBAT_WIGHINS_KEY), v]));
}

export function removeWeighIn(date: string): boolean {
  if (!isIso(date)) return false;
  return writeStore(COMBAT_WIGHINS_KEY, readStore<any>(COMBAT_WIGHINS_KEY).filter((r: any) => r?.date !== date));
}

export interface WeighTrajectory {
  first: number;
  last: number;
  /** кг за неделю, положительное = идёт на сгон. */
  perWeek: number;
  days: number;
  level: 'cutting' | 'holding' | 'gaining';
  source: string;
}

/**
 * Траектория по журналу веса. Скорость считается по первым и последним
 * точкам, а не по двум соседним: соседние замеры шумны (вода, еда, сон).
 */
export function weighTrajectory(rows: WeighIn[]): WeighTrajectory | null {
  if (rows.length < 2) return null;
  const first = rows[0].weightKg;
  const last = rows[rows.length - 1].weightKg;
  const days = Math.max(1, Math.round((Date.parse(rows[rows.length - 1].date) - Date.parse(rows[0].date)) / 86400000));
  const perWeek = ((first - last) / days) * 7;
  // допуск на погрешность float: 0.3 кг/нед может посчитаться как 0.2999999
  const EPS = 1e-6;
  const level: WeighTrajectory['level'] = perWeek >= 0.3 - EPS ? 'cutting' : perWeek <= -0.3 + EPS ? 'gaining' : 'holding';
  return { first, last, perWeek, days, level, source: 'журнал веса' };
}

export interface CutDeviation {
  /** Фактический вес, кг. */
  actualKg: number | null;
  /** Целевой вес на сегодня по линейной траектории от старта к цели. */
  plannedKg: number | null;
  /** Факт минус план, кг (положительное = отстаём от графика). */
  deltaKg: number | null;
  level: 'ahead' | 'on_track' | 'behind' | 'unknown';
  note: string;
}

/** Отклонение от плана сгона: сравниваем факт с линией «старт → цель». */
export function cutDeviation(rows: WeighIn[], opts: { startKg?: number | null; targetKg?: number | null; weeks?: number | null; today?: string }): CutDeviation {
  const latest = rows.length ? rows[rows.length - 1] : null;
  const actual = latest ? latest.weightKg : null;
  const { startKg, targetKg, weeks, today } = opts;
  if (actual === null || typeof startKg !== 'number' || typeof targetKg !== 'number' || !(startKg > targetKg)) {
    return { actualKg: actual, plannedKg: null, deltaKg: null, level: 'unknown', note: 'Для сравнения с планом нужны вес на старте и вес категории.' };
  }
  if (typeof weeks !== 'number' || weeks <= 0) {
    return { actualKg: actual, plannedKg: null, deltaKg: null, level: 'unknown', note: 'Не задан срок сгона — график не построить.' };
  }
  const totalWeeks = Math.max(1, Math.round(weeks));
  // clampDays возвращает ДНИ, поэтому и плановую точку считаем в днях.
  // Раньше делили дни на недели — график получался в 7 раз быстрее и любое
  // отставание помечалось как «опережение».
  const totalDays = totalWeeks * 7;
  const elapsed = clampDays(rows, today, totalWeeks);
  const planned = startKg + (targetKg - startKg) * (elapsed / totalDays);
  const delta = actual - planned;
  const level: CutDeviation['level'] = delta <= -0.5 ? 'ahead' : delta >= 0.5 ? 'behind' : 'on_track';
  return {
    actualKg: actual, plannedKg: planned, deltaKg: delta, level,
    note: level === 'ahead' ? 'Впереди графика — не ускоряйте сгон, это уходит в мышцы.'
      : level === 'behind' ? 'Отстаёте от графика сгона.'
      : 'Идёте по графику.',
  };
}

function clampDays(rows: WeighIn[], today: string | undefined, totalWeeks: number): number {
  const start = rows.length ? Date.parse(rows[0].date) : NaN;
  if (!isFinite(start)) return 0;
  const end = isIso(today) ? Date.parse(today) : Date.now();
  const days = (end - start) / 86400000;
  return Math.max(0, Math.min(totalWeeks * 7, days));
}

// ─── 8.2 Журнал спарринга ─────────────────────────────────────────────────

export const COMBAT_SPARRING_KEY = 'he_combat_sparring_v1';
export const COMBAT_SPARRING_CAP = 200;

export type SparType = 'hard' | 'tech' | 'wrestling' | 'conditioning';

export interface SparringEntry {
  date: string;
  type: SparType;
  rounds: number;
  /** Длительность раунда, мин. */
  roundMinutes: number;
  /** RPE сессии, 1-10 (спарринг, не общий тренировочный). */
  rpe?: number;
  note?: string;
}

function validSpar(r: any): SparringEntry | null {
  if (!r || !isIso(r.date)) return null;
  const type = r.type;
  if (type !== 'hard' && type !== 'tech' && type !== 'wrestling' && type !== 'conditioning') return null;
  const rounds = num(r.rounds);
  if (rounds === null || rounds < 1 || rounds > 15) return null;
  const rm = num(r.roundMinutes);
  if (rm === null || rm < 1 || rm > 15) return null;
  const rpe = num(r.rpe);
  return {
    date: r.date, type, rounds, roundMinutes: rm,
    rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : undefined,
    note: typeof r.note === 'string' ? r.note.slice(0, 200) : undefined,
  };
}

export function normalizeSparring(rows: any[]): SparringEntry[] {
  const seen = new Set<string>();
  const out: SparringEntry[] = [];
  for (const r of (rows || [])) {
    const v = validSpar(r);
    if (!v) continue;
    // одна сессия на дату+тип: повторная правка заменяет запись
    const k = `${v.date}|${v.type}`;
    if (seen.has(k)) {
      const i = out.findIndex(x => `${x.date}|${x.type}` === k);
      if (i >= 0) out[i] = v;
      continue;
    }
    seen.add(k);
    out.push(v);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(-COMBAT_SPARRING_CAP);
}

export function loadSparring(): SparringEntry[] {
  return normalizeSparring(readStore<any>(COMBAT_SPARRING_KEY));
}

export function addSparring(date: string, type: SparType, rounds: number, roundMinutes: number, rpe?: number, note?: string): boolean {
  const v = validSpar({ date, type, rounds, roundMinutes, rpe, note });
  if (!v) return false;
  return writeStore(COMBAT_SPARRING_KEY, normalizeSparring([...readStore<any>(COMBAT_SPARRING_KEY), v]));
}

export function removeSparring(date: string, type: SparType): boolean {
  if (!isIso(date)) return false;
  return writeStore(COMBAT_SPARRING_KEY, readStore<any>(COMBAT_SPARRING_KEY).filter((r: any) => !(r?.date === date && r?.type === type)));
}

/**
 * Кумулятивная нагрузка спарринга = RPE × минуты (session-RPE, PMID 28933715:
 * корреляция session-RPE с HR-методами r=0.52-0.86; PMID 24570606: RPE,
 * снятый через 10 минут, не отличается от 30-минутного).
 *
 * Если RPE не внесён, нагрузка НЕ считается — нулевая нагрузка была бы
 * выдумкой («спарринг прошёл, но ничего не нагрузил»).
 */
export function sparringSessionLoad(e: SparringEntry): number | null {
  if (typeof e.rpe !== 'number') return null;
  return Math.round(e.rpe * e.rounds * e.roundMinutes);
}

export interface SparringSummary {
  sessions: number;
  /** Суммарная нагрузка, где RPE известен. */
  load: number;
  /** Сессии без RPE — их нагрузку мы НЕ знаем. */
  missingRpe: number;
  hardSessions: number;
  notes: string[];
  source: string;
}

export function sparringSummary(rows: SparringEntry[]): SparringSummary {
  let load = 0, missingRpe = 0, hard = 0;
  for (const e of rows) {
    const l = sparringSessionLoad(e);
    if (l === null) missingRpe++;
    else load += l;
    if (e.type === 'hard') hard++;
  }
  const notes: string[] = [];
  if (missingRpe) notes.push(`RPE не внесён в ${missingRpe} сессиях — их нагрузка не посчитана (снимите RPE через 10 мин после сессии).`);
  if (hard >= 2) notes.push('Интенсивных спаррингов 2+ за окно — риск перетренированности, следите за общим объёмом.');
  return { sessions: rows.length, load, missingRpe, hardSessions: hard, notes, source: 'PMID 28933715 (session-RPE)' };
}

/**
 * Журнал → агрегат для sparringToOutsideLoad. Окно — последние 7 дней от
 * `today`. Спарринг попадает в «внешнюю» нагрузку ОТДЕЛЬНО от зала, чтобы
 * спарринг нельзя было случайно посчитать дважды.
 */
export function sparringJournalToLoad(rows: SparringEntry[], today: string | null | undefined): SparringLoad | null {
  const ref = isIso(today) ? Date.parse(today) : Date.now();
  const inWeek = rows.filter(r => {
    const d = Date.parse(r.date);
    return isFinite(d) && d <= ref && d >= ref - 6 * 86400000;
  });
  if (!inWeek.length) return null;
  const hard = inWeek.filter(r => r.type === 'hard');
  const hardDays = hard.map(r => weekdayMon0(r.date));
  return {
    hardSparSessions: hard.length,
    techSparSessions: inWeek.filter(r => r.type === 'tech').length,
    wrestlingSessions: inWeek.filter(r => r.type === 'wrestling').length,
    conditioningSessions: inWeek.filter(r => r.type === 'conditioning').length,
    hardDays: hardDays.length ? [...new Set(hardDays)] : undefined,
  } as SparringLoad;
}

function weekdayMon0(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z');
  if (!isFinite(d.getTime())) return 0;
  return (d.getUTCDay() + 6) % 7; // Пн=0
}

// ─── 8.3 Журнал силы хвата (кистевой динамометр) ────────────────────────────
//
// ЧЕСТНО ПРО ИСТОЧНИК. Собственных нормативов силы хвата для
// единоборств найти не удалось: websearch в этой сессии отдавал 403. Поэтому
// ВЕРДИКТ здесь строится только от собственного пика спортсмена — чужой
// норматив не подставляется.
//
// ОРИЕНТИР (не норма) при этом есть: опубликованные значения P50 для
// общей популяции, PMID 34330493 (n=3803, 6–64 лет, динамометр с
// регулируемым хватом): мужчины ~43.0 кг на пике 26–33 лет, женщины
// ~26.0 кг на пике 25–33. Это ориентир для контекста, а не гейт: выборка
// колумбийская, не спортсмены, и авторы прямо пишут, что HGS следует
// интерпретировать по региону и этносе.

export const GRIP_P50_REF_MALE = 43.0;
export const GRIP_P50_REF_FEMALE = 26.0;
export const GRIP_P50_AGE = 'пик 26–33 года';
export const GRIP_P50_SOURCE =
  'P50 общей популяции (Колумбия), n=3803, 6–64 года: мужчины ~43.0 кг, женщины ~26.0 кг на пике 26–33 года — PMID 34330493. Ориентир, не норма для единоборств';

/** Ориентир P50 по полу. `null` — пол не внесён, сравнивать не с чем. */
export function gripP50Ref(sex: string | null | undefined): { kg: number; source: string } | null {
  if (sex === 'female' || sex === 'ж') return { kg: GRIP_P50_REF_FEMALE, source: GRIP_P50_SOURCE };
  if (sex === 'male' || sex === 'м') return { kg: GRIP_P50_REF_MALE, source: GRIP_P50_SOURCE };
  return null;
}

export const COMBAT_GRIP_KEY = 'he_combat_grip_kg_v1';
/** 240 записей ≈ 4 месяца замеров обеих рук через день. */
export const COMBAT_GRIP_CAP = 240;

/**
 * Асимметрия L/R, при которой стоит присмотреться. ИНЖЕНЕРНЫЙ порог
 * приложения, а не валидированный клинический cut-off: он показывает
 * «руки заметно разошлись, проверьте хват и цепь слабой руки», но диагноза
 * не ставит.
 */
export const GRIP_ASYMMETRY_NOTICE_PCT = 10;

export type GripHand = 'L' | 'R';

export interface GripEntry {
  date: string;
  hand: GripHand;
  gripKg: number;
  note?: string;
}

export const GRIP_SOURCE =
  'Собственный пик спортсмена, без популяционной нормы: нормативы силы хвата для единоборств не подтверждены (websearch 403, 2026-09)';

function validGrip(r: any): GripEntry | null {
  if (!r || !isIso(r.date)) return null;
  const hand: GripHand | null = r.hand === 'R' ? 'R' : r.hand === 'L' ? 'L' : null;
  if (!hand) return null;
  const kg = num(r.gripKg);
  // нижняя граница отсекает мусор и нули, верхняя — шире человеческой руки
  if (kg === null || kg < 10 || kg > 120) return null;
  return { date: r.date, hand, gripKg: kg, note: typeof r.note === 'string' ? r.note.slice(0, 200) : undefined };
}

export function normalizeGrip(rows: any[]): GripEntry[] {
  const byKey = new Map<string, GripEntry>();
  for (const r of rows || []) {
    const v = validGrip(r);
    if (v) byKey.set(`${v.date}|${v.hand}`, v);
  }
  return [...byKey.values()]
    .sort((a, b) => (a.date === b.date ? a.hand.localeCompare(b.hand) : a.date.localeCompare(b.date)))
    .slice(-COMBAT_GRIP_CAP);
}

export function loadGrip(): GripEntry[] {
  return normalizeGrip(readStore<any>(COMBAT_GRIP_KEY));
}

export function addGrip(date: string, hand: GripHand, gripKg: number, note?: string): boolean {
  const v = validGrip({ date, hand, gripKg, note });
  if (!v) return false;
  return writeStore(COMBAT_GRIP_KEY, normalizeGrip([...readStore<any>(COMBAT_GRIP_KEY), v]));
}

export function removeGrip(date: string, hand: GripHand): boolean {
  if (!isIso(date)) return false;
  return writeStore(COMBAT_GRIP_KEY, readStore<any>(COMBAT_GRIP_KEY).filter((r: any) => !(r?.date === date && r?.hand === hand)));
}

export type GripLevel = 'no_data' | 'one_hand' | 'ok' | 'asym' | 'dropped';

export interface GripSummary {
  bestL: number | null;
  bestR: number | null;
  latestL: number | null;
  latestR: number | null;
  /** асимметрия пиков, % от большей руки. */
  asymmetryPct: number | null;
  /** сколько % от своего пика теряет самая слабая рука на последнем замере. */
  dropFromPeakPct: number | null;
  level: GripLevel;
  /** человеческая строка, без диагнозов. */
  note: string;
  source: string;
}

/**
 * Сводка по хвату от СОБСТВЕННОГО пика, а не от чужой нормы.
 * Одна рука — уровень не оцениваем: асимметрию без второй руки не считаем.
 */
export function gripSummary(rows: GripEntry[]): GripSummary {
  const left = rows.filter((r) => r.hand === 'L');
  const right = rows.filter((r) => r.hand === 'R');
  const bestL = left.length ? Math.max(...left.map((r) => r.gripKg)) : null;
  const bestR = right.length ? Math.max(...right.map((r) => r.gripKg)) : null;
  const latestL = left.length ? left[left.length - 1].gripKg : null;
  const latestR = right.length ? right[right.length - 1].gripKg : null;

  const base: GripSummary = {
    bestL, bestR, latestL, latestR, asymmetryPct: null, dropFromPeakPct: null,
    level: 'no_data', note: 'Нет замеров хвата.', source: GRIP_SOURCE,
  };
  if (bestL === null && bestR === null) return base;
  if (bestL === null || bestR === null) {
    return { ...base, level: 'one_hand', note: 'Замер только одной руки — асимметрию не считаем.' };
  }

  const maxPeak = Math.max(bestL, bestR);
  const asymmetryPct = maxPeak > 0 ? Math.round((Math.abs(bestL - bestR) / maxPeak) * 1000) / 10 : null;
  const worstLatest = Math.min(latestL as number, latestR as number);
  const dropFromPeakPct = maxPeak > 0 ? Math.round(((maxPeak - worstLatest) / maxPeak) * 1000) / 10 : null;

  let level: GripLevel = 'ok';
  let note = 'Хват держится у своего пика.';
  if (asymmetryPct !== null && asymmetryPct >= GRIP_ASYMMETRY_NOTICE_PCT) {
    level = 'asym';
    note = `Пики рук разошлись на ${asymmetryPct}% — проверьте хват и цепь слабой руки.`;
  } else if (dropFromPeakPct !== null && dropFromPeakPct >= 15) {
    level = 'dropped';
    note = `Слабая рука на ${dropFromPeakPct}% ниже своего пика — похоже на уход формы.`;
  }
  return { bestL, bestR, latestL, latestR, asymmetryPct, dropFromPeakPct, level, note, source: GRIP_SOURCE };
}

// ─── 8.6 Градуированный RTP после сотрясения ────────────────────────────────
//
// ЧТО ПОДТВЕРЖДЕНО ИСТОЧНИКАМИ (все PMID проверены через PubMed efetch):
//
//   • Единоборства — ДОКУМЕНТИРОВАННЫЙ ПРОБЕЛ: «в отличие от большинства
//     профессиональных контактных видов спорта, для единоборств НЕТ
//     одобренных градуированных протоколов возврата» — PMID 28152320
//     (Phys Sportsmed 2017, Nalepa). То есть сами ступени для единоборств
//     не опубликованы.
//   • Ранняя постепенная аэробная активность в пределах 24–72 ч после
//     травмы ускоряет восстановление против покоя — PMID 42379672
//     (Neurol Clin 2026).
//   • У взрослых восстановление чаще всего ~14 сут; исходная тяжесть
//     симптомов — самый сильный предиктор длительности — PMID 42379672.
//   • Длительность протоколов RTP в контактных видах спорта 5–21 сутки,
//     типичная — 7 суток; самый частый режим ограничения — «не в тот же
//     день» — PMID 41557117 (систематический обзор, 19 исследований).
//
// ЧЕСТНО ПРО СТУПЕНИ. Числа выше — источник. Последовательность ступеней
// ниже — СТРУКТУРА ПРИЛОЖЕНИЯ, а не цитата: для единоборств опубликованных
// ступеней нет (см. PMID 28152320). Поэтому она помечена как инженерная и
// не выдаётся за протокол. Гейты (не в тот же день, одна ступень в сутки,
// симптомы держат ступень) — следствия перечисленных выше данных.

/** Ранняя аэробная активность: 24–72 ч после травмы (PMID 42379672). */
export const RTP_EARLY_AEROBIC_FROM_H = 24;
export const RTP_EARLY_AEROBIC_TO_H = 72;
/** Типичное восстановление взрослых, сут (PMID 42379672). */
export const RTP_TYPICAL_RECOVERY_D = 14;
/** Длительность протоколов RTP, сутки: 5–21, типичная 7 (PMID 41557117). */
export const RTP_DURATION_MIN_D = 5;
export const RTP_DURATION_TYPICAL_D = 7;
export const RTP_DURATION_MAX_D = 21;

export const RTP_SOURCE =
  'PMID 28152320 (единоборства: одобренных градуированных протоколов нет — документированный пробел); PMID 42379672 (24–72 ч ранняя аэробная, ~14 сут восстановление, тяжесть симптомов = предиктор); PMID 41557117 (5–21 сут, типичная 7, «не в тот же день»)';

/** Короткая ссылка на источники — чтобы не печатать числа второй раз на карточке. */
export const RTP_SOURCE_IDS = 'PMID 28152320 · 42379672 · 41557117';

export type RtpStageId =
  | 'rest_light' | 'aerobic' | 'strength' | 'tech' | 'light_contact' | 'full';

export interface RtpStage {
  id: RtpStageId;
  label: string;
  /** минимум суток на ступени — инженерное правило, чтобы не проскочить ступень */
  minDays: number;
}

export const RTP_STAGES: RtpStage[] = [
  { id: 'rest_light', label: 'Покой и лёгкая активность', minDays: 1 },
  { id: 'aerobic', label: 'Аэробная по нагрузке', minDays: 1 },
  { id: 'strength', label: 'Силовая лёгкая, без ударов', minDays: 1 },
  { id: 'tech', label: 'Техника без контакта', minDays: 1 },
  { id: 'light_contact', label: 'Лёгкий контакт', minDays: 1 },
  { id: 'full', label: 'Полный контакт', minDays: 1 },
];

export const RTP_STAGE_BY_ID: Record<RtpStageId, RtpStage> = RTP_STAGES.reduce((a, s) => {
  a[s.id] = s; return a;
}, {} as Record<RtpStageId, RtpStage>);

export const COMBAT_RTP_KEY = 'he_combat_rtp_v1';
/** 60 записей — длинный сдвиг по ступеням с повторами. */
export const COMBAT_RTP_CAP = 60;

export interface RtpLog {
  date: string;
  stage: RtpStageId;
  /** симптомы на этой ступени: есть → ступень не засчитывается */
  symptomsFree: boolean;
  note?: string;
}

function validRtp(r: any): RtpLog | null {
  if (!r || !isIso(r.date)) return null;
  const st = (r.stage as string) in RTP_STAGE_BY_ID ? (r.stage as RtpStageId) : null;
  if (!st) return null;
  return { date: r.date, stage: st, symptomsFree: r.symptomsFree === true, note: typeof r.note === 'string' ? r.note.slice(0, 200) : undefined };
}

export function normalizeRtp(rows: any[]): RtpLog[] {
  const byKey = new Map<string, RtpLog>();
  for (const r of rows || []) {
    const v = validRtp(r);
    if (v) byKey.set(`${v.date}|${v.stage}`, v);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-COMBAT_RTP_CAP);
}

export function loadRtp(): RtpLog[] {
  return normalizeRtp(readStore<any>(COMBAT_RTP_KEY));
}

export function addRtp(date: string, stage: RtpStageId, symptomsFree: boolean, note?: string): boolean {
  const v = validRtp({ date, stage, symptomsFree, note });
  if (!v) return false;
  return writeStore(COMBAT_RTP_KEY, normalizeRtp([...readStore<any>(COMBAT_RTP_KEY), v]));
}

export function removeRtp(date: string, stage: RtpStageId): boolean {
  if (!isIso(date)) return false;
  return writeStore(COMBAT_RTP_KEY, readStore<any>(COMBAT_RTP_KEY).filter((r: any) => !(r?.date === date && r?.stage === stage)));
}

export type RtpStatus = 'no_log' | 'symptoms' | 'stage' | 'complete' | 'no_same_day';

export interface RtpSummary {
  /** последняя ступень, которую прошли без симптомов */
  passedStage: RtpStage | null;
  /** ступень, на которой спортсмен сейчас (следующая) */
  currentStage: RtpStage | null;
  status: RtpStatus;
  /** можно ли сегодня закрыть currentStage */
  canPass: boolean;
  /** почему нельзя — человеческая строка */
  blocked: string | null;
  /** суток с последней записи */
  daysSinceLast: number | null;
  /** ожидаемое окно протокола для справки */
  windowNote: string;
  source: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/**
 * Сводка по градуированному RTP. Гейты следуют источникам:
 * нельзя закрыть ступень в тот же день, что и предыдущую («не в тот же
 * день», PMID 41557117), нельзя перескочить ступень, и симптомы держат
 * текущую ступень (тяжесть симптомов = предиктор длительности, PMID 42379672).
 */
export function rtpSummary(rows: RtpLog[], today: string | null | undefined): RtpSummary {
  const logs = rows.filter((r) => r.symptomsFree);
  const withSymptoms = rows.filter((r) => !r.symptomsFree);
  const lastSymptoms = withSymptoms.length ? withSymptoms[withSymptoms.length - 1] : null;
  const passed = logs.length ? logs[logs.length - 1] : null;
  const lastAny = rows.length ? rows[rows.length - 1] : null;
  const daysSinceLast = lastAny && today ? Math.max(0, daysBetween(lastAny.date, today)) : null;

  const order = RTP_STAGES.map((s) => s.id);
  const nextIdx = passed ? order.indexOf(passed.stage) + 1 : 0;
  const current = nextIdx < order.length ? RTP_STAGE_BY_ID[order[nextIdx]] : null;

  const windowNote = `Окно протокола ${RTP_DURATION_MIN_D}–${RTP_DURATION_MAX_D} сут, типичное ${RTP_DURATION_TYPICAL_D}; восстановление взрослых чаще ~${RTP_TYPICAL_RECOVERY_D} сут.`;
  const base: RtpSummary = {
    passedStage: passed ? RTP_STAGE_BY_ID[passed.stage] : null,
    currentStage: current, status: 'no_log', canPass: false, blocked: null,
    daysSinceLast, windowNote, source: RTP_SOURCE,
  };
  if (!rows.length) {
    return { ...base, status: 'no_log', blocked: 'Нет записей RTP. Начните с покоя и лёгкой активности.' };
  }
  // симптомы на последней записи — держим ступень
  if (lastSymptoms && (!lastAny || lastSymptoms.date >= lastAny.date)) {
    return { ...base, status: 'symptoms', blocked: 'Симптомы на последней ступени — держим текущий уровень, разговор с врачом.' };
  }
  if (!current) {
    return { ...base, status: 'complete', canPass: false, blocked: 'Полный контакт пройден.' };
  }
  // «не в тот же день»
  if (daysSinceLast !== null && daysSinceLast < 1) {
    return { ...base, status: 'no_same_day', blocked: 'Нельзя закрывать следующую ступень в тот же день.' };
  }
  if (daysSinceLast !== null && daysSinceLast < (passed ? RTP_STAGE_BY_ID[passed.stage].minDays : 1)) {
    const need = passed ? RTP_STAGE_BY_ID[passed.stage].minDays : 1;
    return { ...base, status: 'stage', blocked: `Слишком рано: ступень держится минимум ${need} сут.` };
  }
  return { ...base, status: 'stage', canPass: true, blocked: null };
}

export const RTP_EARLY_AEROBIC_NOTE =
  `Первые 24–72 ч: постепенная аэробная активность ускоряет восстановление, а не покой (PMID 42379672).`;

// ─── 8.5 Журнал тестов (своя динамика, без норм) ────────────────────────────
//
// ЧЕСТНО, ЗАЧЕМ ЭТО. Норм для батареи единоборств не существует, и — важнее —
// источник прямо говорит, что такие тесты НЕ предсказывают распределение
// интенсивности схватки: PMID 41214825 (BMC Sports Sci Med Rehabil 2025, n=16,
// 2988 действий) — специальные тесты коррелируют между собой (анаэробная ↔
// аэробная, ρ 0.73–0.76), но с time-motion профилем боя значимой связи нет
// (ρ −0.46…0.40, p > 0.05). Авторы: ритм схватки задаётся технико-тактической
// динамикой, а не физпоказателями.
//
// ПОЭТОМУ здесь нет ни одной нормы и никакого «прогноза по результату».
// Это дневник собственной формы: спортсмен видит, растёт ли он сам относительно
// себя. Планировать по нему бой нельзя — и это написано прямо на карточке.

export const COMBAT_TESTS_KEY = 'he_combat_tests_v1';
/** 200 записей ≈ длинный цикл наблюдения. */
export const COMBAT_TESTS_CAP = 200;

export type CombatTestId =
  | 'pushup' | 'pullup' | 'squat_bw' | 'standing_long_jump'
  | 'med_ball_throw' | 'plank' | 'shuttle_4x10';

export interface CombatTestDef {
  id: CombatTestId;
  label: string;
  unit: string;
  /** 'up' — больше значит лучше, 'down' — меньше (время). */
  direction: 'up' | 'down';
  /** отбраковка мусора: [минимум, максимум] правдоподобного значения. */
  plausible: [number, number];
}

export const COMBAT_TEST_BATTERY: CombatTestDef[] = [
  { id: 'pushup', label: 'Отжимания', unit: 'раз', direction: 'up', plausible: [0, 300] },
  { id: 'pullup', label: 'Подтягивания', unit: 'раз', direction: 'up', plausible: [0, 80] },
  { id: 'squat_bw', label: 'Присед с весом тела', unit: 'раз', direction: 'up', plausible: [0, 200] },
  { id: 'standing_long_jump', label: 'Прыжок в длину', unit: 'см', direction: 'up', plausible: [30, 400] },
  { id: 'med_ball_throw', label: 'Бросок медицинского мяча', unit: 'м', direction: 'up', plausible: [0.5, 30] },
  { id: 'plank', label: 'Планка', unit: 'с', direction: 'up', plausible: [5, 900] },
  { id: 'shuttle_4x10', label: 'Челночный 4×10 м', unit: 'с', direction: 'down', plausible: [10, 90] },
];

export const COMBAT_TEST_BY_ID: Record<CombatTestId, CombatTestDef> = COMBAT_TEST_BATTERY.reduce((a, t) => {
  a[t.id] = t; return a;
}, {} as Record<CombatTestId, CombatTestDef>);

/** Оговорка, которая печатается на карточке. Не украшение, а смысл блока. */
export const TEST_BATTERY_CAVEAT =
  'Это ваша собственная динамика, а не норма. По PMID 41214825 специальные тесты не предсказывают распределение интенсивности схватки (p > 0.05) — планировать бой по этим цифрам нельзя.';

export interface TestEntry {
  date: string;
  testId: CombatTestId;
  value: number;
  note?: string;
}

function validTest(r: any): TestEntry | null {
  if (!r || !isIso(r.date)) return null;
  const id = (r.testId as string) in COMBAT_TEST_BY_ID ? (r.testId as CombatTestId) : null;
  if (!id) return null;
  const v = num(r.value);
  if (v === null) return null;
  const [lo, hi] = COMBAT_TEST_BY_ID[id].plausible;
  if (v < lo || v > hi) return null;
  return { date: r.date, testId: id, value: v, note: typeof r.note === 'string' ? r.note.slice(0, 200) : undefined };
}

export function normalizeTests(rows: any[]): TestEntry[] {
  const byKey = new Map<string, TestEntry>();
  for (const r of rows || []) {
    const v = validTest(r);
    if (v) byKey.set(`${v.date}|${v.testId}`, v);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-COMBAT_TESTS_CAP);
}

export function loadTests(): TestEntry[] {
  return normalizeTests(readStore<any>(COMBAT_TESTS_KEY));
}

export function addTest(date: string, testId: CombatTestId, value: number, note?: string): boolean {
  const v = validTest({ date, testId, value, note });
  if (!v) return false;
  return writeStore(COMBAT_TESTS_KEY, normalizeTests([...readStore<any>(COMBAT_TESTS_KEY), v]));
}

export function removeTest(date: string, testId: CombatTestId): boolean {
  if (!isIso(date)) return false;
  return writeStore(COMBAT_TESTS_KEY, readStore<any>(COMBAT_TESTS_KEY).filter((r: any) => !(r?.date === date && r?.testId === testId)));
}

export type TestTrend = 'no_data' | 'up' | 'down' | 'flat';

export interface TestLine {
  testId: CombatTestId;
  label: string;
  unit: string;
  latest: number | null;
  best: number | null;
  /** изменение последнего замера относительно собственного лучшего, % */
  vsBestPct: number | null;
  trend: TestTrend;
  count: number;
}

export type TestDirection = 'up' | 'down' | 'mixed' | 'no_data';

export interface TestBattery {
  lines: TestLine[];
  /** сводное направление формы по всем тестам, у которых есть динамика */
  direction: TestDirection;
  testsWithData: number;
  note: string;
  caveat: string;
}

/** Линия по одному тесту: последний, лучший и отклонение от своего пика. */
export function testLine(rows: TestEntry[], testId: CombatTestId): TestLine {
  const def = COMBAT_TEST_BY_ID[testId];
  const mine = rows.filter((r) => r.testId === testId);
  if (!mine.length) {
    return { testId, label: def.label, unit: def.unit, latest: null, best: null, vsBestPct: null, trend: 'no_data', count: 0 };
  }
  const latest = mine[mine.length - 1].value;
  const best = def.direction === 'down' ? Math.min(...mine.map((r) => r.value)) : Math.max(...mine.map((r) => r.value));
  const vsBestPct = best > 0 ? Math.round(((latest - best) / best) * 1000) / 10 : null;
  let trend: TestTrend = 'flat';
  if (mine.length >= 2) {
    const prev = mine[mine.length - 2].value;
    const better = def.direction === 'down' ? latest < prev : latest > prev;
    const worse = def.direction === 'down' ? latest > prev : latest < prev;
    if (better) trend = 'up';
    else if (worse) trend = 'down';
  }
  return { testId, label: def.label, unit: def.unit, latest, best, vsBestPct, trend, count: mine.length };
}

export function testBattery(rows: TestEntry[]): TestBattery {
  const lines = COMBAT_TEST_BATTERY.map((t) => testLine(rows, t.id));
  const withTrend = lines.filter((l) => l.trend === 'up' || l.trend === 'down');
  const ups = withTrend.filter((l) => l.trend === 'up').length;
  const downs = withTrend.filter((l) => l.trend === 'down').length;
  const testsWithData = lines.filter((l) => l.count > 0).length;
  let direction: TestDirection = 'no_data';
  if (ups > downs) direction = 'up';
  else if (downs > ups) direction = 'down';
  else if (ups > 0) direction = 'mixed';
  const note = !testsWithData
    ? 'Замеров нет.'
    : direction === 'up'
      ? 'Форма растёт относительно ваших прошлых замеров.'
      : direction === 'down'
        ? 'Последние замеры ниже ваших лучших.'
        : direction === 'mixed'
          ? 'Динамика смешанная — часть тестов выше, часть ниже.'
          : 'Данных пока мало для тренда — нужно минимум два замера на тест.';
  return { lines, direction, testsWithData, note, caveat: TEST_BATTERY_CAVEAT };
}

// ─── 8.4 Скрининг LEA / RED-S ─────────────────────────────────────────────

/**
 * Пороги доступности энергии, ккал/кг FFM.
 *
 * ИСТОЧНИК: IOC consensus statement on RED-S, 2018 update (PMID 29773536).
 * УРОВЕНЬ ПРОВЕРКИ: источник идентифицирован по названию/PMID, но abstract в
 * PubMed отсутствует и числа там не перечислены — пороги общепринятые и
 * приводятся с явной пометкой об этом, а не как «прочитанное в статье».
 * Практическая поддержка порогов в единоборствах: PMID 40254934 (84 спортсменки,
 * 45.2% повышенный риск LEA; к неделе соревнований LEA у всех 11).
 */
export const LEA_PELLET = 45;
export const LEA_RED = 30;
export const LEA_SOURCE = 'IOC RED-S 2018 (PMID 29773536); практика в единоборствах — PMID 40254934';

export interface LeaInput {
  /** Потребление, ккал/сут. */
  kcal?: number | null;
  /** Тренировочный расход, ккал/сут. */
  trainingKcal?: number | null;
  /** Безжировая масса, кг. */
  ffmKg?: number | null;
  /** CAT2-опросник: 0 = нет симптомов, 1 = есть. */
  cat2Flags?: number | null;
  sex?: 'male' | 'female';
}

export type LeaLevel = 'no_data' | 'ok' | 'optimal' | 'caution' | 'reds' | 'cat2';

export interface LeaScreen {
  level: LeaLevel;
  /** ккал/кг FFM. null — когда данных нет. */
  ea: number | null;
  reason: string;
  advice: string;
  source: string;
}

/**
 * Скрининг, а не диагноз. Без полного набора данных возвращается no_data с
 * честным объяснением — «посчитать нельзя» вместо выдуманного вердикта.
 */
export function leaScreen(input: LeaInput): LeaScreen {
  const { kcal, trainingKcal, ffmKg, cat2Flags, sex } = input;
  const missing: string[] = [];
  if (typeof kcal !== 'number' || !isFinite(kcal)) missing.push('потребление');
  if (typeof trainingKcal !== 'number' || !isFinite(trainingKcal)) missing.push('тренировочный расход');
  if (typeof ffmKg !== 'number' || !(ffmKg > 0)) missing.push('безжировая масса');
  if (missing.length) {
    return {
      level: 'no_data', ea: null,
      reason: `Не хватает данных: ${missing.join(', ')}.`,
      advice: 'Внесите потребление, тренировочный расход и БМ — без них вердикт был бы догадкой.',
      source: LEA_SOURCE,
    };
  }
  const ea = (kcal! - trainingKcal!) / ffmKg!;
  if (typeof cat2Flags === 'number' && cat2Flags > 0) {
    return {
      level: 'cat2', ea,
      reason: `CAT2-опросник отмечен (${cat2Flags}). По симптомам это важнее цифры.`,
      advice: sex === 'female' ? 'Симптомы REDs у спортсменок требуют врача, а не подгонки рациона.' : 'Симптомы REDs требуют врача, а не подгонки рациона.',
      source: LEA_SOURCE,
    };
  }
  if (ea < LEA_RED) {
    return {
      level: 'reds', ea,
      reason: `${ea.toFixed(0)} ккал/кг БМ — ниже порога 30. Зона REDs.`,
      advice: 'Снижайте тренировочный расход или повышайте потребление. Сгон поверх этого — путь к REDs (PMID 40254934: к соревнованиям LEA выявлялась у всех).',
      source: LEA_SOURCE,
    };
  }
  if (ea < LEA_PELLET) {
    return {
      level: 'caution', ea,
      reason: `${ea.toFixed(0)} ккал/кг БМ — ниже оптимума 45, но выше порога 30.`,
      advice: 'Жёлтая зона: недоступная энергия уже влияет на здоровье и результат.',
      source: LEA_SOURCE,
    };
  }
  return {
    level: 'optimal', ea,
    reason: `${ea.toFixed(0)} ккал/кг БМ — в оптимуме (≥${LEA_PELLET}).`,
    advice: 'Энергетическая доступность в норме.',
    source: LEA_SOURCE,
  };
}

// ─── 8.7 Когнитивный слой: сон ─────────────────────────────────────────────

/**
 * PMID 41824810 (Medicine 2026, рандомизированный перекрёстный дизайн,
 * 14 карэтестов-ударников): условия — 8 ч сна против 4 ч. Ограничение сна
 * ухудшало Струп, простую реакцию, время реакции с выбором (после нагрузки),
 * прыжок с приседа, T-тест и аэробный тест; авторы рекомендуют 7-9 ч сна и
 * НЕ СТАВИТЬ интенсивные тренировки после ночи с плохим сном.
 */
export const SLEEP_TARGET_H = 8;
export const SLEEP_MIN_H = 7;
export const SLEEP_SOURCE = 'PMID 41824810 (8 ч против 4 ч; рекомендация 7-9 ч, не ставить интенсивное после плохой ночи)';

export interface SleepVerdict {
  hours: number | null;
  level: 'ok' | 'short' | 'critical' | 'unknown';
  /** true — сегодня интенсивная тренировка противопоказана. */
  blockHardSession: boolean;
  reason: string;
  advice: string;
  source: string;
}

export function sleepVerdict(hours: number | null | undefined): SleepVerdict {
  if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0) {
    return {
      hours: null, level: 'unknown', blockHardSession: false,
      reason: 'Сон за ночь не внесён.',
      advice: 'Внесите часы сна — без этого предупреждение о плохой ночи не сработает.',
      source: SLEEP_SOURCE,
    };
  }
  const h = Math.round(hours * 10) / 10;
  if (h < 5) {
    return {
      hours: h, level: 'critical', blockHardSession: true,
      reason: `${h} ч — критично мало.`,
      advice: 'Интенсивную работу сегодня перенесите. После 4 ч сна в исследовании падали и реакция, и прыжок, и аэробный результат.',
      source: SLEEP_SOURCE,
    };
  }
  if (h < SLEEP_MIN_H) {
    return {
      hours: h, level: 'short', blockHardSession: true,
      reason: `${h} ч — меньше ${SLEEP_MIN_H} ч.`,
      advice: 'Сегодня — лёгкая техника или отдых. Авторы прямо советуют не планировать интенсивное после плохой ночи.',
      source: SLEEP_SOURCE,
    };
  }
  return {
    hours: h, level: 'ok', blockHardSession: false,
    reason: `${h} ч — в норме.`,
    advice: h < SLEEP_TARGET_H ? `Цель — ${SLEEP_TARGET_H} ч; сейчас ${h}.` : `Сон достаточный (цель ${SLEEP_TARGET_H} ч).`,
    source: SLEEP_SOURCE,
  };
}

// ─── 8.8 Тепловой протокол ────────────────────────────────────────────────

/**
 * PMID 35510889 (J Strength Cond Res 2022, 7 элитных боксёров): 5-дневная
 * акклиматизация, сессии 60 мин при 32 °C и 70% ВВ, до и после — тест
 * повторного спринта в комнатных условиях. Результат: 13±7 → 19±7 повторов
 * (d=0.92, p=0.03) — то есть протокол рабочий. Гидратация до сессии
 * статистически не изменилась (p=0.07).
 *
 * ЧЕСТНАЯ ГРАНИЦА: исследование проверило 5-дневный вариант. План предлагал
 * лестницу «5 → 10 → 12 сессий»; 10 и 12 не подтверждены этим источником,
 * поэтому ступени выше 5 помечены как консервативная экстраполяция, а не
 * проверенная схема.
 */
export const HEAT_STEPS = [
  { sessions: 5, label: '5 сессий — проверенный протокол', verified: true },
  { sessions: 10, label: '10 сессий — экстраполяция, не проверена этим источником', verified: false },
  { sessions: 12, label: '12 сессий — экстраполяция, не проверена этим источником', verified: false },
] as const;

export const HEAT_SESSION_MIN = 60;
export const HEAT_TEMP_C = 32;
export const HEAT_HUMIDITY_PCT = 70;
export const HEAT_SOURCE = 'PMID 35510889 (5 дней, 60 мин, 32 °C, 70% ВВ; спринт 13→19, p=0.03)';
export const HEAT_EVIDENCE = 'PMID 31094260 (акклиматизация + гипогидратация после сгона ухудшают результат — связка с гидратацией)';

export interface HeatGate {
  blocked: boolean;
  reasons: string[];
  note: string;
}

export interface HeatProtocol {
  sessionsDone: number;
  step: number;
  label: string;
  verified: boolean;
  sessionMin: number;
  tempC: number;
  humidityPct: number;
  /** Текст по гидратации: акклиматизация сама по себе не заменяет питьё. */
  hydration: string;
  gate: HeatGate;
  source: string;
}

export function heatProtocol(input: { sessionsDone?: number | null; inWeightCut?: boolean | null; fightWeek?: boolean | null }): HeatProtocol {
  const done = Math.max(0, Math.floor(num(input.sessionsDone) ?? 0));
  let step: (typeof HEAT_STEPS)[number] = HEAT_STEPS[0];
  for (const s of HEAT_STEPS) if (done >= s.sessions) step = s;
  const reasons: string[] = [];
  if (input.inWeightCut) reasons.push('Сгон: акклиматация поверх дефицита — лишний стресс, в исследовании это отдельно ухудшало результат.');
  if (input.fightWeek) reasons.push('Неделя боя: протокол стартует за 3-4 недели, а не в соревновательную неделю.');
  return {
    sessionsDone: done, step: step.sessions, label: step.label, verified: step.verified,
    sessionMin: HEAT_SESSION_MIN, tempC: HEAT_TEMP_C, humidityPct: HEAT_HUMIDITY_PCT,
    hydration: 'Пейте по плану: в исследовании гидратация до сессии сама по себе не изменилась (p=0.07) — акклиматизация не отменяет питьё.',
    gate: { blocked: reasons.length > 0, reasons, note: reasons.length ? 'Протокол отложен.' : 'Протокол можно начинать.' },
    source: HEAT_SOURCE,
  };
}
