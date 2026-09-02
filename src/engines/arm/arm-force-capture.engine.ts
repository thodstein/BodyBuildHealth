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
  gripSupport: number; // 0..100 (RT vs World Class 130.5 M / 77.2 F)
  gripPinch: number; // 0..100 (pinch 10с = 100%)
  sidePressure: number; // 0..100 (side vs bodyweight*0.6)
  backPressure: number; // 0..100 (back vs bodyweight*0.8)
  totalScore: number; // среднее по имеющимся векторам
  asymmetryPct?: number; // если передан left/right
}

export const RT_WORLD_CLASS_M = 130.5; // Tyukalov 2013, IronMind WR
export const RT_WORLD_CLASS_F = 77.2; // Gaiduchenko 2012
const RT_WORLD_CLASS = RT_WORLD_CLASS_M; // backward compat
const RT_AVG = 55;
const AXLE_WORLD_CLASS = 133; // ArmliftingUSA Saxon/Apollon ~133 inspir., оценка (Axle тяжелее RT но без вращения)
const PINCH_GOOD_SEC = 15; // 15с = хорошо (15с hold = 100%)
export const WAF_WEIGHT_CLASSES = [-55, -60, -65, -70, -75, -80, -85, -90, -100, -110] as const;

export function getRtWorldClass(sex?: string): number {
  return (sex || '').toLowerCase() === 'female' ? RT_WORLD_CLASS_F : RT_WORLD_CLASS_M;
}
export function getSideRef(bwKg: number, weightClass?: string): number {
  const bw = bwKg && bwKg > 30 ? bwKg : 80;
  // линейный скейл: -55кг → 0.55×, 110кг → 0.65× (тяжи тянут больше на кг массы)
  let k = 0.6;
  if (weightClass) {
    const v = parseInt(weightClass.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(v)) k = 0.55 + Math.min(0.1, Math.max(0, (v - 55) / 550));
  } else {
    k = 0.55 + Math.min(0.1, Math.max(0, (bw - 55) / 550));
  }
  return Math.max(30, bw * k);
}
export function getBackRef(bwKg: number): number {
  const bw = bwKg && bwKg > 30 ? bwKg : 80;
  return Math.max(40, bw * 0.8);
}

export function recordGripForce(r: GripForceRecord): GripForceRecord {
  return { ...r, dateIso: r.dateIso || new Date().toISOString().slice(0, 10) };
}

export function estimateForceVector(r: GripForceRecord & { bodyWeightKg?: number; sex?: string; weightClass?: string; leftKg?: number; rightKg?: number }): ForceVector {
  const wc = (r.weightClass || '').toString();
  const world = getRtWorldClass(r.sex);
  const gripSupport = r.rtKg != null ? Math.max(0, Math.min(100, ((r.rtKg - RT_AVG) / (world - RT_AVG)) * 50 + 50)) : r.axleKg != null ? Math.max(0, Math.min(100, (r.axleKg / AXLE_WORLD_CLASS) * 100)) : 0;
  const gripPinch = r.pinchSec != null ? Math.max(0, Math.min(100, (r.pinchSec / PINCH_GOOD_SEC) * 100)) : r.pinchKg != null ? Math.max(0, Math.min(100, (r.pinchKg / 30) * 100)) : 0;
  const bw = r.bodyWeightKg && r.bodyWeightKg > 30 ? r.bodyWeightKg : 80;
  const sideRef = getSideRef(bw, wc);
  const backRef = getBackRef(bw);
  const sidePressure = r.sideKg != null ? Math.max(0, Math.min(100, (r.sideKg / sideRef) * 100)) : 0;
  const backPressure = r.backKg != null ? Math.max(0, Math.min(100, (r.backKg / backRef) * 100)) : 0;
  const vals = [gripSupport, gripPinch, sidePressure, backPressure].filter(v => v > 0);
  const totalScore = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  let asymmetryPct: number | undefined;
  if (r.leftKg != null && r.rightKg != null && r.leftKg > 0 && r.rightKg > 0) {
    const mx = Math.max(r.leftKg, r.rightKg);
    const mn = Math.min(r.leftKg, r.rightKg);
    asymmetryPct = Math.round(((mx - mn) / mx) * 100);
  }
  return { gripSupport: Math.round(gripSupport), gripPinch: Math.round(gripPinch), sidePressure: Math.round(sidePressure), backPressure: Math.round(backPressure), totalScore, asymmetryPct };
}

export function forceAdvice(v: ForceVector): string[] {
  const adv: string[] = [];
  // факт без оценки слаб/средний — механизм-ориентированно
  adv.push(`Support ${v.gripSupport}/100 — факт (RT ${v.gripSupport} vs WR)`);
  adv.push(`Pinch ${v.gripPinch}/100 — факт`);
  adv.push(`Side ${v.sidePressure}/100 — факт (WAF)`);
  adv.push(`Back ${v.backPressure}/100 — факт`);
  if (v.asymmetryPct != null) adv.push(`Асимметрия ${v.asymmetryPct}% — факт`);
  // нейтральные рекомендации по технике (без уровня)
  if (v.gripSupport < 60) adv.push('→ Rolling Thunder/Axle — техника хвата');
  if (v.gripPinch < 60) adv.push('→ Saxon/Hub pinch — удержание');
  if (v.sidePressure < 60) adv.push('→ Боковое на подушке — техника');
  if (v.backPressure < 60) adv.push('→ Lat drag — тяга на себя');
  return adv;
}

export function gripImplementForForce(r: GripForceRecord): string {
  if (r.rtKg != null) return GRIP_IMPLEMENTS.rolling_thunder.name;
  if (r.axleKg != null) return GRIP_IMPLEMENTS.apollon_axle.name;
  if (r.pinchSec != null) return GRIP_IMPLEMENTS.saxon_bar.name;
  return '—';
}
