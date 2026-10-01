/**
 * arm-weekly-checkin.engine.ts — P1-10: недельный чек-ин арм-атлета.
 *
 * Закрывает остаток профессионального контура: план-факт по сетам уже есть
 * (arm-plan-feedback), но самооценка (вес/сон/энергия/боль) жила только в голове.
 * Здесь: хранение чек-инов (кап 26 = полгода), тренд веса (слишком быстро/медленно),
 * средняя боль/энергия последних недель и честные строки. Боль ≥4 две недели подряд
 * — сигнал разгрузки (потребитель: билдер, `checkins` → первая неделя разгрузочная).
 *
 * Формат: чистые функции + storage-хелперы (прецедент arm-force-history.store).
 */
import type { ArmWeeklyCheckin } from './arm-types';

export const ARM_CHECKIN_KEY = 'he_arm_checkins_v1';
export const ARM_CHECKIN_CAP = 26;

function isCheckin(v: any): v is ArmWeeklyCheckin {
  return !!v && typeof v === 'object'
    && typeof v.id === 'string' && v.id.length > 0
    && Number.isFinite(Number(v.week)) && Number(v.week) >= 1
    && typeof v.dateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.dateIso);
}

function cleanEntry(raw: any): ArmWeeklyCheckin | null {
  if (!isCheckin(raw)) return null;
  const num = (v: any, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : undefined;
  };
  return {
    id: String(raw.id),
    week: Math.max(1, Math.round(Number(raw.week))),
    dateIso: String(raw.dateIso),
    ...(num(raw.weightKg, 20, 300) != null ? { weightKg: num(raw.weightKg, 20, 300)! } : {}),
    ...(num(raw.sleepHours, 0, 16) != null ? { sleepHours: num(raw.sleepHours, 0, 16)! } : {}),
    ...(num(raw.energy010, 0, 10) != null ? { energy010: num(raw.energy010, 0, 10)! } : {}),
    ...(num(raw.elbowPain010, 0, 10) != null ? { elbowPain010: num(raw.elbowPain010, 0, 10)! } : {}),
    ...(typeof raw.note === 'string' && raw.note.trim() ? { note: raw.note.trim().slice(0, 300) } : {}),
  };
}

export function loadArmCheckins(): ArmWeeklyCheckin[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ARM_CHECKIN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(cleanEntry).filter((x): x is ArmWeeklyCheckin => !!x)
      .sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1))
      .slice(0, ARM_CHECKIN_CAP);
  } catch { return []; }
}

/** Upsert по неделе (повторный чек-ин недели заменяет старый), кап 26, порядок — новейшие. */
export function saveArmCheckin(entry: ArmWeeklyCheckin): ArmWeeklyCheckin[] {
  const clean = cleanEntry(entry) || entry;
  const next = [clean, ...loadArmCheckins().filter((c) => c.week !== clean.week)]
    .sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1))
    .slice(0, ARM_CHECKIN_CAP);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(ARM_CHECKIN_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

export function removeArmCheckin(id: string): ArmWeeklyCheckin[] {
  const next = loadArmCheckins().filter((c) => c.id !== id);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(ARM_CHECKIN_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

export function clearArmCheckins(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(ARM_CHECKIN_KEY); } catch { /* noop */ }
}

/* ── Тренд ───────────────────────────────────────────────────────────────── */

export interface ArmCheckinTrend {
  weeks: number;
  weightDeltaKg: number | null;
  weeklyRatePct: number | null;
  rateStatus: 'on_track' | 'too_fast' | 'too_slow' | 'no_data';
  painAvgLast2: number | null;
  painWarn: boolean;
  energyAvg: number | null;
  energyWarn: boolean;
  notes: string[];
}

/**
 * Тренд по чек-инам (ожидает порядок новейшие→старые, но сортирует сам).
 * `targetWeightKg` — потолок категории: ниже цели темп оценивается на недобор.
 */
export function armCheckinTrend(entries: ArmWeeklyCheckin[], opts?: { targetWeightKg?: number }): ArmCheckinTrend {
  const list = (entries || []).filter(isCheckin).slice().sort((a, b) => (a.dateIso < b.dateIso ? -1 : 1));
  const notes: string[] = [];
  const out: ArmCheckinTrend = { weeks: list.length, weightDeltaKg: null, weeklyRatePct: null, rateStatus: 'no_data', painAvgLast2: null, painWarn: false, energyAvg: null, energyWarn: false, notes };
  if (list.length === 0) { notes.push('Чек-инов нет — сохраните первую неделю.'); return out; }

  const weighted = list.filter((c) => Number(c.weightKg) > 0) as Array<ArmWeeklyCheckin & { weightKg: number }>;
  if (weighted.length >= 2) {
    const first = weighted[0];
    const last = weighted[weighted.length - 1];
    const spanWeeks = Math.max(1, last.week - first.week);
    const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10;
    const rate = Math.round(((delta / first.weightKg) * 100 / spanWeeks) * 100) / 100;
    out.weightDeltaKg = delta;
    out.weeklyRatePct = rate;
    const hasTarget = opts?.targetWeightKg != null && Number(opts.targetWeightKg) > 0;
    if (hasTarget && last.weightKg > Number(opts.targetWeightKg)) {
      if (Math.abs(rate) < 0.1) { out.rateStatus = 'too_slow'; notes.push(`Вес стоит (${last.weightKg} кг при цели ${opts!.targetWeightKg}): −0.1…−0.7%/нед для сгонки.`); }
      else if (rate > 0) { out.rateStatus = 'too_fast'; notes.push(`Вес растёт (${delta > 0 ? '+' : ''}${delta} кг): до старта нужен дефицит, не профицит.`); }
      else if (rate < -0.75) { out.rateStatus = 'too_fast'; notes.push(`Темп −${rate}%/нед быстрее 0.75% — риск силы и сухожилий, добавьте ккал.`); }
      else { out.rateStatus = 'on_track'; notes.push(`Сгонка ${rate}%/нед — в целевом коридоре.`); }
    } else {
      if (Math.abs(rate) > 0.9) { out.rateStatus = 'too_fast'; notes.push(`Вес меняется ${rate}%/нед — быстрее 0.9%/нед, проверьте питание/воду.`); }
      else { out.rateStatus = 'on_track'; notes.push(`Вес ${delta > 0 ? '+' : ''}${delta} кг за ${spanWeeks} нед — ровный тренд.`); }
    }
  }

  const pains = list.filter((c) => Number.isFinite(Number(c.elbowPain010))).slice(-2) as Array<ArmWeeklyCheckin & { elbowPain010: number }>;
  if (pains.length) {
    out.painAvgLast2 = Math.round((pains.reduce((a, c) => a + c.elbowPain010, 0) / pains.length) * 10) / 10;
    out.painWarn = out.painAvgLast2 >= 4;
    notes.push(out.painWarn
      ? `⛔ Боль локтя ${out.painAvgLast2}/10 две недели — разгрузка и контроль (PMM).`
      : `Боль локтя ${out.painAvgLast2}/10 — контроль в норме.`);
  }
  const energies = list.filter((c) => Number.isFinite(Number(c.energy010)));
  if (energies.length) {
    out.energyAvg = Math.round((energies.reduce((a, c) => a + Number(c.energy010), 0) / energies.length) * 10) / 10;
    out.energyWarn = out.energyAvg <= 4;
    if (out.energyWarn) notes.push(`Энергия ${out.energyAvg}/10 — проверьте сон/ккал, объём под контроль.`);
  }
  return out;
}
