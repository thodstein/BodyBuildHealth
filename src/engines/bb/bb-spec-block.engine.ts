/**
 * bb-spec-block.engine.ts — специализационный блок 8 нед для отстающих (MAX PRO).
 * Лесенка объёма факт+4 → +2/нед до MAV-верха (кап MRV), доноры на MV,
 * частота по 11-set rule (Bomerton: >10-11 сетов/мышца/сессия — режем),
 * целевая первой в сессии, делоад не трогаем. Без мутаций плана — чистый расчёт.
 */
import { getVolumeLandmarks } from '../volume-landmarks.engine';
import { canonicalMuscle } from './bb-specialization.engine';

export interface SpecBlockInput {
  weakZones: string[];
  factSets?: Record<string, number>;
  level?: string;
  weeks?: number;
  sex?: string;
}

export interface SpecWeekPlan {
  week: number;
  targetSets: Record<string, number>;
  donorSets: Record<string, number>;
  frequency: Record<string, number>;
  note: string;
}

export interface SpecBlock {
  weeks: SpecWeekPlan[];
  lengthWeeks: number;
  donors: string[];
  dayMap: Record<string, number[]>;
  rationale: string[];
}

const SMALL = new Set(['calves', 'forearms', 'abs', 'biceps', 'triceps', 'delt_mid', 'delt_rear', 'delt_front']);
const MEDIUM = new Set(['shoulders', 'chest_upper', 'chest_lower', 'chest', 'traps']);

function freqFor(zone: string): number {
  const z = String(zone).toLowerCase();
  if (SMALL.has(z)) return 5;
  if (MEDIUM.has(z)) return 4;
  return 3;
}

/** Разбить недельный объём на дни по 11-set rule (макс 10 сетов/мышца/сессия). */
export function splitSetsBySessions(weeklySets: number, frequency: number): number[] {
  const f = Math.max(1, Math.min(6, Math.round(frequency)));
  const per = Math.ceil(weeklySets / f);
  if (per <= 10) return Array.from({ length: f }, (_, i) => (i === f - 1 ? weeklySets - (per * (f - 1)) : per)).filter((v) => v > 0);
  const need = Math.ceil(weeklySets / 10);
  const ff = Math.min(6, Math.max(f, need));
  const pp = Math.ceil(weeklySets / ff);
  return Array.from({ length: ff }, (_, i) => (i === ff - 1 ? weeklySets - pp * (ff - 1) : pp)).filter((v) => v > 0);
}

export function buildSpecBlock(input: SpecBlockInput): SpecBlock {
  const zones = [...new Set((input.weakZones || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean))].slice(0, 2);
  const level = input.level || 'intermediate';
  const lengthWeeks = Math.max(4, Math.min(12, Math.round(input.weeks ?? 8)));
  const fact = input.factSets || {};
  const rationale: string[] = [];
  const weeks: SpecWeekPlan[] = [];

  const mavTop: Record<string, number> = {};
  const mrvCap: Record<string, number> = {};
  const mvFloor: Record<string, number> = {};
  for (const z of zones) {
    const canon = canonicalMuscle(z);
    const lm = getVolumeLandmarks(level, canon) || getVolumeLandmarks(level, z);
    const mav = lm ? lm.mav : 16;
    const mrv = lm ? lm.mrv : 22;
    const mev = lm ? lm.mev : 8;
    mavTop[z] = Math.min(mrv - 2, Math.round(mav * 1.15));
    mrvCap[z] = mrv;
    mvFloor[z] = Math.max(4, Math.round(mev * 0.6));
  }

  for (let w = 1; w <= lengthWeeks; w++) {
    const targetSets: Record<string, number> = {};
    const frequency: Record<string, number> = {};
    for (const z of zones) {
      const start = Math.max(mvFloor[z], Math.round((fact[z] ?? fact[canonicalMuscle(z)] ?? 8) + 4));
      const ramp = start + (w - 1) * 2;
      targetSets[z] = Math.max(start, Math.min(mavTop[z], Math.min(mrvCap[z], ramp)));
      frequency[z] = freqFor(z);
    }
    weeks.push({
      week: w,
      targetSets,
      donorSets: {},
      frequency,
      note: w === 1 ? 'Старт: факт+4, первым в сессии, lengthened первым' : w === lengthWeeks ? 'Пик блока → делоад, замер перепроверки' : `Прогрессия +2 сета (нед ${w}/${lengthWeeks})`,
    });
  }

  // Доноры: сильные крупные на MV (упрощённо — список кандидатов, конкретика в tradeoff)
  const donors = ['chest', 'back', 'quads'].filter((d) => !zones.includes(d) && !zones.map(canonicalMuscle).includes(d)).slice(0, 2);
  rationale.push(`Цели: ${zones.join(', ') || '—'} — ${lengthWeeks} нед к MAV-верха (${Object.entries(mavTop).map(([k, v]) => `${k} ${v}`).join(', ') || '—'})`);
  rationale.push(`Доноры на MV: ${donors.join(', ') || '—'} (освобождение 10-15 сетов/нед)`);
  rationale.push('11-set rule: >10 сетов/мышца/сессия режем на доп. день; целевая — первой в сессии');

  // dayMap: равномерное распределение частоты по дням недели 1..5
  const dayMap: Record<string, number[]> = {};
  for (const z of zones) {
    const f = freqFor(z);
    const days: number[] = [];
    for (let i = 0; i < f; i++) days.push(Math.min(5, 1 + Math.round((i * 4) / Math.max(1, f - 1))));
    dayMap[z] = [...new Set(days)];
    dayMap[canonicalMuscle(z)] = dayMap[z];
  }

  return { weeks, lengthWeeks, donors, dayMap, rationale };
}
