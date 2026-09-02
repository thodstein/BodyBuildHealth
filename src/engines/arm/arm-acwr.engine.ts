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
  overall: { ratio: number; zone: 'optimal' | 'caution' | 'dangerous' };
  tendon: { ratio: number; zone: 'optimal' | 'caution' | 'dangerous' } | null;
  tablePct: number;
  advice: string[];
}

const TENDON_MUSCLES = new Set(['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators']);

export function isTendonSession(exercises: Array<{ muscle: string }>): boolean {
  return exercises.some(e => TENDON_MUSCLES.has(e.muscle));
}

export function calcTendonAcwr(plan?: ArmPlan, srpeSessions?: Array<{ date: string; sRpe: number; minutes: number; exercises?: any[] }>): { ratio: number; zone: string } | null {
  if (!srpeSessions || srpeSessions.length < 3) return null;
  // tendon-only daily loads
  const tendonLoads = toDailyLoads(srpeSessions.filter(s => {
    if (!s.exercises) return true; // если нет разметки — считаем tendon
    return isTendonSession(s.exercises);
  }) as any);
  if (tendonLoads.length < 5) return null;
  // для сухожилий — более длинное окно: используем тот же acuteChronicRatio но с порогами мягче (tendon адаптируется медленнее)
  const r = acuteChronicRatio(tendonLoads as any);
  // ужесточаем зоны для tendon: optimal <1.3, caution 1.3-1.5, dangerous >1.5 (vs muscle 1.0-1.5)
  let zone: 'optimal'|'caution'|'dangerous' = 'optimal';
  if (r.ratio > 1.5) zone = 'dangerous';
  else if (r.ratio > 1.3) zone = 'caution';
  return { ratio: Math.round(r.ratio * 100) / 100, zone };
}

export function buildArmAcwr(input: ArmAcwrInput): ArmAcwrResult {
  const daily = toDailyLoads(input.sessions.map(s => ({ date: s.dateIso, sRPE: s.sRpe, durationMin: s.durationMin } as any)) as any);
  const overall = daily.length >= 2 ? acuteChronicRatio(daily as any) : { ratio: 1, zone: 'optimal' as const };
  const tendonSessions = input.sessions.filter(s => s.isTendon);
  const tendonDaily = toDailyLoads(tendonSessions.map(s => ({ date: s.dateIso, sRPE: s.sRpe, durationMin: s.durationMin } as any)) as any);
  let tendon: ArmAcwrResult['tendon'] = null;
  if (tendonDaily.length >= 5) {
    const tr = acuteChronicRatio(tendonDaily as any);
    let zone: 'optimal'|'caution'|'dangerous' = 'optimal';
    if (tr.ratio > 1.5) zone = 'dangerous';
    else if (tr.ratio > 1.3) zone = 'caution';
    tendon = { ratio: Math.round(tr.ratio * 100) / 100, zone };
  }
  const tableCount = input.sessions.filter(s => s.isTable).length;
  const tablePct = input.sessions.length ? Math.round((tableCount / input.sessions.length) * 100) : 0;
  const advice: string[] = [];
  if (overall.zone === 'dangerous') advice.push('ACWR danger >1.5 — делод ×0.65, tendon ×0.55, RIR+2');
  else if (overall.zone === 'caution') advice.push('ACWR caution 1.3-1.5 — объём ×0.85, снизить stress недели');
  if (tendon && tendon.zone === 'dangerous') advice.push('Tendon ACWR danger >1.5 — сухожилия перегруз (Kemp 3× медленнее), side×0.5, pron/sup high-rep 15-20');
  if (tendon && tendon.zone === 'caution') advice.push('Tendon caution — добавить 48ч между тяж, extensor band');
  if (tablePct < 30) advice.push('Table <30% — мало стола (Кузнецов VIII ≥50%)');
  if (!advice.length) advice.push('ACWR optimal — держи курс, тейпер 0.65/0.45 по плану');
  return { overall: { ratio: Math.round(overall.ratio * 100) / 100, zone: overall.zone as any }, tendon, tablePct, advice };
}

export function acwrAdviceForPlan(acwr: ArmAcwrResult | null): string {
  if (!acwr) return 'нет данных (нужен дневник sRPE ≥2 сесс.)';
  if (acwr.overall.zone === 'dangerous') return 'снизь объём ×0.65, RIR+2, делод';
  if (acwr.overall.zone === 'caution') return '×0.85, RIR+1';
  return 'оптимум — держи курс (taper 0.65/0.45)';
}
