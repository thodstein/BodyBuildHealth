/**
 * arm-force-capture.engine.ts — фиксация силы хвата/давления (как Force Sensors в sportsjournal 2024).
 * PRO: grip force (RT/Axle/Pinch) + table force (side/back), векторы, сравнение с нормами.
 */
import { GRIP_IMPLEMENTS } from './arm-grip.engine';

export interface GripForceRecord {
  rtKg?: number;
  axleKg?: number;
  pinchSec?: number; // pinch hold sec
  pinchKg?: number; // если есть вес
  sideKg?: number; // боковое давление кг (оценочно, через вес на блоке)
  backKg?: number; // тяга на себя кг
  dateIso?: string;
}

export interface ForceVector {
  gripSupport: number; // 0..100 (RT vs World Class 113)
  gripPinch: number; // 0..100 (pinch 10с = 100%)
  sidePressure: number; // 0..100 (side vs bodyweight)
  backPressure: number; // 0..100
  totalScore: number; // среднее
}

const RT_WORLD_CLASS = 113; // kg, из godsofgrip
const RT_AVG = 55;
const AXLE_WORLD_CLASS = 150; // оценка (Axle тяжелее, но без вращения)
const PINCH_GOOD_SEC = 15; // 15с = хорошо

export function recordGripForce(r: GripForceRecord): GripForceRecord {
  return { ...r, dateIso: r.dateIso || new Date().toISOString().slice(0, 10) };
}

export function estimateForceVector(r: GripForceRecord & { bodyWeightKg?: number }): ForceVector {
  const gripSupport = r.rtKg != null ? Math.max(0, Math.min(100, ((r.rtKg - RT_AVG) / (RT_WORLD_CLASS - RT_AVG)) * 50 + 50)) : r.axleKg != null ? Math.max(0, Math.min(100, (r.axleKg / AXLE_WORLD_CLASS) * 100)) : 0;
  const gripPinch = r.pinchSec != null ? Math.max(0, Math.min(100, (r.pinchSec / PINCH_GOOD_SEC) * 100)) : r.pinchKg != null ? Math.max(0, Math.min(100, (r.pinchKg / 30) * 100)) : 0;
  // Side/back нормируем на bodyWeight *0.6 (PRO, как BB armProgression)
  const bw = r.bodyWeightKg && r.bodyWeightKg > 30 ? r.bodyWeightKg : 80;
  const sideRef = Math.max(30, bw * 0.6);
  const backRef = Math.max(40, bw * 0.8);
  const sidePressure = r.sideKg != null ? Math.max(0, Math.min(100, (r.sideKg / sideRef) * 100)) : 0;
  const backPressure = r.backKg != null ? Math.max(0, Math.min(100, (r.backKg / backRef) * 100)) : 0;
  const vals = [gripSupport, gripPinch, sidePressure, backPressure].filter(v => v > 0);
  const totalScore = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  return { gripSupport: Math.round(gripSupport), gripPinch: Math.round(gripPinch), sidePressure: Math.round(sidePressure), backPressure: Math.round(backPressure), totalScore };
}

export function forceAdvice(v: ForceVector): string[] {
  const adv: string[] = [];
  if (v.gripSupport < 30) adv.push('Support слаб (<30) — Rolling Thunder 3×/нед, 60мм, DOH');
  else if (v.gripSupport < 60) adv.push('Support средний — добавить Axle 58мм, 1×/нед тяж');
  if (v.gripPinch < 30) adv.push('Pinch слаб — Saxon 76мм, hub, 15с hold');
  if (v.sidePressure < 30) adv.push('Side слаб — боковое на подушке RIR≥2, ≤10%/нед (humerus)');
  if (v.backPressure < 30) adv.push('Back слаб — lat drag ремнём к запястью, 5×5');
  if (adv.length === 0) adv.push('✓ Силовой профиль сбалансирован');
  return adv;
}

export function gripImplementForForce(r: GripForceRecord): string {
  if (r.rtKg != null) return GRIP_IMPLEMENTS.rolling_thunder.name;
  if (r.axleKg != null) return GRIP_IMPLEMENTS.apollon_axle.name;
  if (r.pinchSec != null) return GRIP_IMPLEMENTS.saxon_bar.name;
  return '—';
}
