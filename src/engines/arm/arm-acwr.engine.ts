/**
 * arm-acwr.engine.ts — ACWR для армдневника, с отдельным tendon-ACWR (сухожилия 3× медленнее).
 * Использует toDailyLoads/acuteChronicRatio из training-load.engine.
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
