/**
 * arm-force-capture.engine.ts — фиксация силы хвата/давления (как Force Sensors в sportsjournal 2024).
 * PRO: grip force (RT/Axle/Pinch) + table force (side/back), векторы, сравнение с нормами.
 */
import { GRIP_IMPLEMENTS } from './arm-grip.engine';
import { localIsoDate } from '../../core/local-date';
import { platformWrFor, platformIsInternal } from './arm-platform.engine';

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
  gripSupport: number; // 0..100 (RT vs World Class 130.5 M / 80.0 F)
  gripPinch: number; // 0..100 (pinch 10с = 100%)
  sidePressure: number; // 0..100 (side vs bodyweight*0.6)
  backPressure: number; // 0..100 (back vs bodyweight*0.8)
  totalScore: number; // среднее по имеющимся векторам
  /** PRO-3 P2: сколько векторов реально заполнено (0-4). total честен только при ≥2. */
  filledCount: number;
  /** PRO-3 P2: totalScore можно показывать только если true (иначе «недостаточно данных»). */
  scoreReliable: boolean;
  asymmetryPct?: number; // если передан left/right
  /** Аудит 2026-10: знаменатель щипка (pinch_block) — внутренний ориентир, не WR. */
  pinchRefKg?: number;
  pinchRefInternal?: boolean;
  /** Аудит 2026-10: аксель считался от внутреннего ориентира (Saxon), но подписывался как WR. */
  axleInternal?: boolean;
}

// Аудит 2026-10 было→стало: 77.2 (Гайдученко 22.09.2012) — рекорд побит: Hafsa Mason 80.0 кг,
// West Coast Arm Sports «Hands of Doom II», 21.08.2024 (Wikipedia, ред. 24.12.2025). Женщина на
// уровне мирового рекорда получала 96.5/100 — «world class» была недостижима.
// 14.10.2026: третья копия чисел RT демонтирована — читается из канона PLATFORM_WR
// (ironmind.com на ту же дату всё ещё числит 77.2, поэтому note показывает оба факта).
export const RT_WORLD_CLASS_M = platformWrFor('rolling_thunder', 'male');
export const RT_WORLD_CLASS_F = platformWrFor('rolling_thunder', 'female');
const RT_WORLD_CLASS = RT_WORLD_CLASS_M; // backward compat
const RT_AVG = 55;
// 26.10.2026: AXLE_WORLD_CLASS удалён как второй знаменатель акселя — единый
// канон platformWrFor('apollon_axle'|'saxon_bar', sex). Оставлен экспортом с
// @deprecated-пометкой (внешние потребители/тесты не ломались).
/** @deprecated знаменатель акселя — используйте platformWrFor(implement, sex). */
export const AXLE_WORLD_CLASS = 237.5; // Apollon's Axle WR, IronMind 2022
const PINCH_GOOD_SEC = 15; // 15с = хорошо (15с hold = 100%)

// Wave-1 Э1.5: экспорт `WAF_WEIGHT_CLASSES` УДАЛЁН — это была третья копия весовых классов
// WAF в проекте (первая — `WAF_CLASSES_FEMALE` в arm-norms-table, вторая — удалённая
// `wafWeightClassFor` с мужской сеткой). Удаление выбрано, а не вывод из канона, намеренно:
// arm-norms-table УЖЕ импортирует из этого файла (getRtWorldClass), поэтому импорт обратно
// создал бы цикл и TDZ на верхнем уровне модуля. Потребителей у константы не было.

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
  // 26.10.2026: локальная дата (UTC давал «вчера» в вечерние часы UTC+X)
  return { ...r, dateIso: r.dateIso || localIsoDate() };
}

export function estimateForceVector(r: GripForceRecord & { bodyWeightKg?: number; sex?: string; weightClass?: string; leftKg?: number; rightKg?: number; axleImplement?: string }): ForceVector {
  const wc = (r.weightClass || '').toString();
  const world = getRtWorldClass(r.sex);
  // 26.10.2026 было→стало: axle считался от Saxon-ориентира 133, тогда как хаб
  // армлифтинга и помост дают %WR от IronMind Apollon (237.5 M / 137.9 F) — один и
  // тот же результат получал две разные оценки «world class» (90 vs 50).
  // Теперь знаменатель берётся из общего канона platformWrFor (Apollon WR, Saxon 133).
  const axleImpl = String(r.axleImplement || 'apollon_axle');
  const axleWorld = platformWrFor(axleImpl, r.sex || 'male');
  const axleInternal = platformIsInternal(axleImpl);
  const gripSupport = r.rtKg != null ? Math.max(0, Math.min(100, ((r.rtKg - RT_AVG) / (world - RT_AVG)) * 50 + 50)) : r.axleKg != null ? Math.max(0, Math.min(100, (r.axleKg / axleWorld) * 100)) : 0;
  // Аудит 2026-10 было→стало: знаменатель щипка был фиксированный 30 кг — любой атлет выше
  // промежуточного уровня видел 100/100, вектор переставал различать. Теперь единый канон
  // pinch_block (80/45 — ВНУТРЕННИЙ ориентир хаба для блоков разной ширины; действующий
  // WR канонического IronMind Block — 51.40/31.55, см. platformWrRef).
  const pinchRef = platformWrFor('pinch_block', r.sex || 'male');
  const gripPinch = r.pinchSec != null ? Math.max(0, Math.min(100, (r.pinchSec / PINCH_GOOD_SEC) * 100)) : r.pinchKg != null ? Math.max(0, Math.min(100, (r.pinchKg / pinchRef) * 100)) : 0;
  const bw = r.bodyWeightKg && r.bodyWeightKg > 30 ? r.bodyWeightKg : 80;
  const sideRef = getSideRef(bw, wc);
  const backRef = getBackRef(bw);
  const sidePressure = r.sideKg != null ? Math.max(0, Math.min(100, (r.sideKg / sideRef) * 100)) : 0;
  const backPressure = r.backKg != null ? Math.max(0, Math.min(100, (r.backKg / backRef) * 100)) : 0;
  const vals = [gripSupport, gripPinch, sidePressure, backPressure].filter(v => v > 0);
  const totalScore = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  // PRO-3 P2: один вектор 100 давал total 100 — честно только при ≥2 заполненных
  const filledCount = vals.length;
  const scoreReliable = filledCount >= 2;
  let asymmetryPct: number | undefined;
  if (r.leftKg != null && r.rightKg != null && r.leftKg > 0 && r.rightKg > 0) {
    const mx = Math.max(r.leftKg, r.rightKg);
    const mn = Math.min(r.leftKg, r.rightKg);
    // PRO-3 P12: 1 знак — паритет с bilateral (было целое)
    asymmetryPct = Math.round(((mx - mn) / mx) * 1000) / 10;
  }
  return {
    gripSupport: Math.round(gripSupport),
    gripPinch: Math.round(gripPinch),
    sidePressure: Math.round(sidePressure),
    backPressure: Math.round(backPressure),
    totalScore,
    filledCount,
    scoreReliable,
    asymmetryPct,
    pinchRefKg: pinchRef,
    pinchRefInternal: platformIsInternal('pinch_block'),
    axleInternal,
  };
}

/**
 * Факт-строки силы. Аудит 2026-10 было→стало: в скобках печатался СКОР («Support 85/100 —
 * факт (RT 85 vs WR)»), чего не измеряли; теперь — реальные кг замера и честная пометка
 * внутреннего ориентира (Apollon = WR, Saxon/pinch_block = внутренний ориентир хаба).
 * Префикс ✓ — факт (UI не эскалирует в warn), → — нейтральная техническая подсказка.
 */
export function forceAdvice(v: ForceVector, r?: (GripForceRecord & { axleImplement?: string; sex?: string; bodyWeightKg?: number })): string[] {
  const adv: string[] = [];
  if (r?.rtKg != null) adv.push(`✓ Support ${v.gripSupport}/100 — RT ${r.rtKg}кг vs WR ${getRtWorldClass(r?.sex)}кг`);
  else if (r?.axleKg != null) {
    const impl = String(r.axleImplement || 'apollon_axle');
    const note = platformIsInternal(impl) ? ' (ориентир, не WR)' : ' (WR)';
    adv.push(`✓ Support ${v.gripSupport}/100 — Axle ${r.axleKg}кг${note}`);
  } else adv.push(`✓ Support ${v.gripSupport}/100 — нет замера RT/Axle`);
  if (r?.pinchSec != null) adv.push(`✓ Pinch ${v.gripPinch}/100 — удержание ${r.pinchSec}с`);
  else if (r?.pinchKg != null) adv.push(`✓ Pinch ${v.gripPinch}/100 — ${r.pinchKg}кг (внутренний ориентир ${v.pinchRefKg ?? '—'}кг, единого WR нет)`);
  else adv.push(`✓ Pinch ${v.gripPinch}/100 — нет замера`);
  if (r?.sideKg != null) adv.push(`✓ Side ${v.sidePressure}/100 — ${r.sideKg}кг (ориентир по массе тела)`);
  else adv.push(`✓ Side ${v.sidePressure}/100 — нет замера`);
  if (r?.backKg != null) adv.push(`✓ Back ${v.backPressure}/100 — ${r.backKg}кг (ориентир по массе тела)`);
  else adv.push(`✓ Back ${v.backPressure}/100 — нет замера`);
  // асимметрия печатается отдельной находкой отчёта с уровнями (>=7 warn, >=12 critical) —
  // здесь её дубль уводил тест/UI на 'ok' вместо настоящего уровня.
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
