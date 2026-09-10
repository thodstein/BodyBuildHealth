/**
 * bb-prep-post-show-log.engine.ts — PRO-2 P6: недельный лог восстановления post-show.
 *
 * Чистый движок + localStorage-слой (паттерн bb-prep-weekly-log): 6 недель после
 * шоу — вес/сон/голод/настроение/цикл/либидо-энергия/возврат силы. Маркеры
 * «восстановлено» (вес ≥+5% stage, сон ≥7, голод ≤3, цикл вернулся / тесто-симптомы
 * ушли). Comedown-памятка — только harm-reduction, БЕЗ доз (паритет с калькулятором
 * поддержки; PED/стимы/T3 — «тейпер вниз + врач»).
 */

export interface PostShowWeekEntry {
  /** Неделя после шоу 1..6. */
  week: 1 | 2 | 3 | 4 | 5 | 6;
  dateIso: string; // дата записи (ISO yyyy-mm-dd)
  weightKg?: number;
  sleepH?: number; // средний сон, ч
  hunger1_5?: number; // голод 1..5 (5 = волчий)
  mood1_5?: number; // настроение 1..5
  /** Женщины: цикл вернулся (регулярный), 'irregular' — нерегулярный, 'na' — неприменимо (муж). */
  cycle?: 'restored' | 'irregular' | 'absent' | 'na';
  libidoEnergy1_5?: number; // либидо/энергия 1..5
  strengthReturnPct?: number; // возврат силовых, % от препа (0..120)
  note?: string;
}

export interface PostShowRecoveryMarkers {
  weightRegained: boolean; // вес ≥ +5% stage weight
  sleepOk: boolean; // сон ≥7 ч
  hungerOk: boolean; // голод ≤3
  cycleOk: boolean; // цикл restored/na (муж — всегда true при заполненности)
  strengthOk: boolean; // сила ≥95% препа
  recoveredCount: number; // сколько из 5
  allRecovered: boolean;
}

export const POST_SHOW_LOG_KEY = 'he_prep_postshow_v1';
const POST_SHOW_LOG_CAP = 6; // 6 недель на план

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

type StoredLog = Record<string, PostShowWeekEntry[]>; // planId → записи

function readAll(): StoredLog {
  try {
    const raw = localStorage.getItem(POST_SHOW_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: StoredLog = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k !== 'string' || !Array.isArray(v)) continue;
      out[k] = (v as unknown[]).filter(isPostShowWeekEntry) as PostShowWeekEntry[];
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(store: StoredLog): void {
  try {
    localStorage.setItem(POST_SHOW_LOG_KEY, JSON.stringify(store));
  } catch { /* quota — молча, лог не критичен */ }
}

export function isPostShowWeekEntry(x: unknown): x is PostShowWeekEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    Number.isInteger(e.week) && (e.week as number) >= 1 && (e.week as number) <= 6 &&
    typeof e.dateIso === 'string' && isValidIsoDate(e.dateIso)
  );
}

/** Записи плана (новые сверху). Битый стор → []. */
export function getPostShowLog(planId: string): PostShowWeekEntry[] {
  if (!planId) return [];
  return readAll()[planId] ?? [];
}

/** Сохранить/обновить запись недели (идемпотентно по week). */
export function savePostShowEntry(planId: string, entry: PostShowWeekEntry): PostShowWeekEntry[] {
  if (!planId || !isPostShowWeekEntry(entry)) return getPostShowLog(planId);
  const store = readAll();
  const list = (store[planId] ?? []).filter(e => e.week !== entry.week);
  const clean: PostShowWeekEntry = {
    week: entry.week,
    dateIso: entry.dateIso,
    ...(Number.isFinite(entry.weightKg) ? { weightKg: entry.weightKg } : {}),
    ...(Number.isFinite(entry.sleepH) ? { sleepH: clamp(entry.sleepH as number, 0, 14) } : {}),
    ...(Number.isFinite(entry.hunger1_5) ? { hunger1_5: clamp(Math.round(entry.hunger1_5 as number), 1, 5) } : {}),
    ...(Number.isFinite(entry.mood1_5) ? { mood1_5: clamp(Math.round(entry.mood1_5 as number), 1, 5) } : {}),
    ...(entry.cycle ? { cycle: entry.cycle } : {}),
    ...(Number.isFinite(entry.libidoEnergy1_5)
      ? { libidoEnergy1_5: clamp(Math.round(entry.libidoEnergy1_5 as number), 1, 5) }
      : {}),
    ...(Number.isFinite(entry.strengthReturnPct)
      ? { strengthReturnPct: clamp(entry.strengthReturnPct as number, 0, 120) }
      : {}),
    ...(entry.note ? { note: String(entry.note).slice(0, 500) } : {}),
  };
  list.unshift(clean);
  list.sort((a, b) => a.week - b.week);
  store[planId] = list.slice(0, POST_SHOW_LOG_CAP);
  writeAll(store);
  return store[planId];
}

/** Удалить запись недели. */
export function removePostShowEntry(planId: string, week: number): PostShowWeekEntry[] {
  if (!planId) return [];
  const store = readAll();
  store[planId] = (store[planId] ?? []).filter(e => e.week !== week);
  writeAll(store);
  return store[planId];
}

/**
 * Маркеры восстановления по последней записи (Buechel/Chappell: вес, сон, голод,
 * цикл/гормоны, сила). stageWeightKg — вес сцены (для +5% regain-гейта).
 */
export function postShowRecoveryMarkers(
  entry: PostShowWeekEntry | null | undefined,
  stageWeightKg?: number,
): PostShowRecoveryMarkers {
  const empty: PostShowRecoveryMarkers = {
    weightRegained: false, sleepOk: false, hungerOk: false,
    cycleOk: false, strengthOk: false, recoveredCount: 0, allRecovered: false,
  };
  if (!entry) return empty;
  const weightRegained =
    Number.isFinite(entry.weightKg) && Number.isFinite(stageWeightKg) && (stageWeightKg as number) > 0
      ? (entry.weightKg as number) >= (stageWeightKg as number) * 1.05
      : false;
  const sleepOk = Number.isFinite(entry.sleepH) ? (entry.sleepH as number) >= 7 : false;
  const hungerOk = Number.isFinite(entry.hunger1_5) ? (entry.hunger1_5 as number) <= 3 : false;
  const cycleOk = entry.cycle === 'restored' || entry.cycle === 'na';
  const strengthOk = Number.isFinite(entry.strengthReturnPct)
    ? (entry.strengthReturnPct as number) >= 95
    : false;
  const recoveredCount = [weightRegained, sleepOk, hungerOk, cycleOk, strengthOk].filter(Boolean).length;
  return { weightRegained, sleepOk, hungerOk, cycleOk, strengthOk, recoveredCount, allRecovered: recoveredCount === 5 };
}

/**
 * Comedown-памятка post-show (harm-reduction, БЕЗ дозировок — паритет с калькулятором
 * поддержки; конкретику назначает только врач). Возвращает строки для UI/печати.
 */
export function postShowComedownNotes(): string[] {
  return [
    '☕ Стимуляторы (кофеин/предтрены): тейпер вниз 1–2 нед — сон и АД восстанавливаются первыми.',
    '🦋 T3/тиреоиды (если применялись): только тейпер под контролем врача + контроль TSH/T4 — резкая отмена бьёт по весу.',
    '💉 PED-comedown: конкретику решает врач; еда и сон — главный анаболик этого периода, а не дозы.',
    '👨‍⚕️ Красные флаги к врачу: цикл не вернулся за 3–4 мес, либидо/энергия на нуле >6 нед, отёки/АД, депрессивные эпизоды.',
    '🧠 Психика: +5–10% веса сцены — план, а не срыв (Buechel 2025). Оставайтесь на связи с тренером — «брошенность» главный риск.',
  ];
}
