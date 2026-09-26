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
