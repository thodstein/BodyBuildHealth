/**
 * arm-acwr.engine.ts — ACWR для армдневника, с отдельным tendon-ACWR (сухожилия 3× медленнее).
 * Использует toDailyLoads/acuteChronicRatio из training-load.engine.
 * D2: + per-muscle ACWR из дневника тренировок (нагрузка дня = сумма сетов),
 * parity BB `computePerMuscleACWR` + PL ACWR-зоны ok <1.3 / caution 1.3–1.5 / danger ≥1.5.
 */
import { toDailyLoads, acuteChronicRatio } from '../pro/training-load.engine';
import type { ArmPlan } from './arm-types';

export interface ArmAcwrInput {
  sessions: Array<{ dateIso: string; sRpe: number; durationMin: number; isTendon?: boolean; isTable?: boolean }>;
}
export interface ArmAcwrResult {
  overall: { ratio: number };
  tendon: { ratio: number } | null;
  tablePct: number;
  advice: string[]; // факт, без оценки риска
}

const TENDON_MUSCLES = new Set(['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators']);

export function isTendonSession(exercises: Array<{ muscle: string }>): boolean {
  return exercises.some(e => TENDON_MUSCLES.has(e.muscle));
}

export function calcTendonAcwr(plan?: ArmPlan, srpeSessions?: Array<{ date: string; sRpe: number; minutes?: number; durationMin?: number; exercises?: any[] }>): { ratio: number } | null {
  if (!srpeSessions || srpeSessions.length < 3) return null;
  const norm = srpeSessions.map(s => ({ ...s, durationMin: (s as any).durationMin ?? (s as any).minutes ?? 60, sRPE: (s as any).sRpe ?? (s as any).sRPE }));
  const tendonLoads = toDailyLoads(norm.filter(s => {
    if (!(s as any).exercises) return true;
    return isTendonSession((s as any).exercises);
  }) as any);
  if (tendonLoads.length < 5) return null;
  const r = acuteChronicRatio(tendonLoads as any);
  return { ratio: Math.round(r.ratio * 100) / 100 };
}

export function buildArmAcwr(input: ArmAcwrInput): ArmAcwrResult {
  const daily = toDailyLoads(input.sessions.map(s => ({ date: s.dateIso, sRPE: s.sRpe, durationMin: s.durationMin } as any)) as any);
  const overallRaw = daily.length >= 2 ? acuteChronicRatio(daily as any) : { ratio: 1 } as any;
  const overall = { ratio: Math.round(overallRaw.ratio * 100) / 100 };
  const tendonSessions = input.sessions.filter(s => s.isTendon);
  const tendonDaily = toDailyLoads(tendonSessions.map(s => ({ date: s.dateIso, sRPE: s.sRpe, durationMin: s.durationMin } as any)) as any);
  let tendon: ArmAcwrResult['tendon'] = null;
  if (tendonDaily.length >= 5) {
    const tr = acuteChronicRatio(tendonDaily as any);
    tendon = { ratio: Math.round(tr.ratio * 100) / 100 };
  }
  const tableCount = input.sessions.filter(s => s.isTable).length;
  const tablePct = input.sessions.length ? Math.round((tableCount / input.sessions.length) * 100) : 0;
  const advice: string[] = [];
  advice.push(`ACWR ${overall.ratio} — факт`);
  if (tendon) advice.push(`Tendon ACWR ${tendon.ratio} — факт`);
  advice.push(`Table ${tablePct}% — факт`);
  return { overall, tendon, tablePct, advice };
}

export function acwrAdviceForPlan(acwr: ArmAcwrResult | null): string {
  if (!acwr) return 'нет данных (нужен дневник sRPE ≥2 сесс.)';
  return `ACWR ${acwr.overall.ratio} — факт`;
}

// ── D2: per-muscle ACWR ──

export type ArmAcwrZone = 'ok' | 'caution' | 'danger';

export interface ArmMuscleAcwr {
  muscle: string;
  acute: number;
  chronic: number;
  ratio: number;
  zone: ArmAcwrZone;
}

export interface ArmAcwrDaySession {
  date: string;
  exercises: Array<{ muscleGroup?: string; muscle?: string; sets: Array<unknown> }>;
}

function dayNum(iso: string): number {
  const t = new Date(iso + 'T12:00:00').getTime();
  return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN;
}

function muscleOf(ex: { muscleGroup?: string; muscle?: string }): string | null {
  const m = String((ex as any)?.muscleGroup || (ex as any)?.muscle || '').toLowerCase().trim();
  return m || null;
}

export function armAcwrZoneFor(ratio: number | null): ArmAcwrZone {
  if (ratio == null || !Number.isFinite(ratio)) return 'ok';
  if (ratio >= 1.5) return 'danger';
  if (ratio >= 1.3) return 'caution';
  return 'ok';
}

/** Дневные нагрузки по мышцам за последние 28д: muscle → dayIdx(0=сегодня) → сеты. */
export function armDailyLoadsByMuscle(sessions: ArmAcwrDaySession[], referenceIso?: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  try {
    const ref = referenceIso ? dayNum(referenceIso.slice(0, 10)) : Math.floor(Date.now() / 86400000);
    if (!Number.isFinite(ref)) return out;
    for (const s of sessions || []) {
      const d = dayNum(String((s as any)?.date || '').slice(0, 10));
      if (!Number.isFinite(d)) continue;
      const age = ref - d;
      if (age < 0 || age >= 28) continue;
      for (const ex of (s as any)?.exercises || []) {
        const m = muscleOf(ex as any);
        if (!m) continue;
        const cnt = Array.isArray((ex as any)?.sets) ? (ex as any).sets.length : 0;
        if (!out[m]) out[m] = new Array(28).fill(0);
        out[m][age] += cnt;
      }
    }
  } catch { /* noop */ }
  return out;
}

export function computeArmPerMuscleACWR(sessions: ArmAcwrDaySession[], referenceIso?: string): Record<string, ArmMuscleAcwr> {
  const out: Record<string, ArmMuscleAcwr> = {};
  const loads = armDailyLoadsByMuscle(sessions, referenceIso);
  for (const [m, days] of Object.entries(loads)) {
    const acuteDays = days.slice(0, 7);
    const acute = acuteDays.reduce((a, b) => a + b, 0) / 7;
    const chronic = days.reduce((a, b) => a + b, 0) / 28;
    if (chronic <= 0) continue;
    const ratio = Math.round((acute / chronic) * 100) / 100;
    out[m] = { muscle: m, acute: Math.round(acute * 100) / 100, chronic: Math.round(chronic * 100) / 100, ratio, zone: armAcwrZoneFor(ratio) };
  }
  return out;
}

/** Худшая зона среди мышц точки (для diagnoseArmWeakCause). Нет данных → null. */
export function worstArmAcwrZone(map: Record<string, ArmMuscleAcwr>, muscles: string[]): ArmAcwrZone | null {
  let worst: ArmAcwrZone | null = null;
  const rank: Record<ArmAcwrZone, number> = { ok: 0, caution: 1, danger: 2 };
  for (const m of muscles || []) {
    const z = map[m]?.zone;
    if (!z) continue;
    if (worst == null || rank[z] > rank[worst]) worst = z;
  }
  return worst;
}

/** Сводка для UI: сколько мышц в caution/danger. */
export function armAcwrSummary(map: Record<string, ArmMuscleAcwr>): { danger: string[]; caution: string[] } {
  const danger: string[] = [];
  const caution: string[] = [];
  for (const [m, v] of Object.entries(map)) {
    if (v.zone === 'danger') danger.push(m);
    else if (v.zone === 'caution') caution.push(m);
  }
  return { danger, caution };
}
