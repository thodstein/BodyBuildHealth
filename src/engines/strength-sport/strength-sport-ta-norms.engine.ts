/**
 * strength-sport-ta-norms.engine.ts — НОРМЫ yMax ПО ВЕСОВОЙ + ЖЕНСКИЕ УРОВНИ (V6 PRO-v4)
 *
 * Tunçel et al. 2025 (ЧМ-2010, Ariel): Hmax растёт с весовой категорией —
 * абсолютный yMax без весовой вводит в заблуждение; LWC — выше относительная
 * мощность второй тяги. Slobozhanskyi 2025 (female 52, Dartfish, 60% max):
 * финал-ускорение 1.10→0.89с, таз в амортизации 93→137°, колено в подседе
 * 126→75° по квалификации. Ориентиры, не диагноз.
 * Чистый движок, без UI/storage.
 */

export type TaLevel3 = 'novice' | 'intermediate' | 'advanced';

/** Ориентир Hmax рывка по весовой (см, Tunçel 2025: растёт с категорией). */
export function ymaxNormForBodyweight(bwKg: number | null | undefined, sex: string | null | undefined): { lo: number; hi: number } | null {
  if (bwKg == null || !Number.isFinite(bwKg) || bwKg <= 0) return null;
  const s = String(sex || 'male').toLowerCase();
  // Грубая лестница: лёгкие ниже, тяжёлые выше (коридор ±8 см).
  const base = s === 'female'
    ? (bwKg <= 55 ? 108 : bwKg <= 64 ? 115 : bwKg <= 76 ? 122 : 130)
    : (bwKg <= 67 ? 115 : bwKg <= 81 ? 123 : bwKg <= 96 ? 130 : 138);
  return { lo: base - 8, hi: base + 8 };
}

export function ymaxVerdict(yMaxCm: number, bwKg: number | null | undefined, sex: string | null | undefined): string | null {
  const norm = ymaxNormForBodyweight(bwKg, sex);
  if (!norm || !Number.isFinite(yMaxCm) || yMaxCm <= 0) return null;
  if (yMaxCm < norm.lo) return `yMax ${yMaxCm} см — низко для весовой (норма ${norm.lo}–${norm.hi}): плюс — быстро уходишь под бар (Tunçel 2025)`;
  if (yMaxCm > norm.hi) return `yMax ${yMaxCm} см — высоко для весовой (норма ${norm.lo}–${norm.hi}): проверь turnover — бар «перетягиваешь»`;
  return `yMax ${yMaxCm} см — в норме весовой (${norm.lo}–${norm.hi})`;
}

export interface FemalePhaseNorm {
  finalAccS: [number, number];
  hipAmortDeg: [number, number];
  kneeCatchDeg: [number, number];
}

/** Женские нормы фаз рывка по уровню (Slobozhanskyi 2025, 60% max, Dartfish). */
export function femalePhaseNorm(level: TaLevel3): FemalePhaseNorm {
  if (level === 'novice') return { finalAccS: [1.0, 1.2], hipAmortDeg: [88, 100], kneeCatchDeg: [118, 132] };
  if (level === 'intermediate') return { finalAccS: [0.93, 1.05], hipAmortDeg: [105, 120], kneeCatchDeg: [95, 115] };
  return { finalAccS: [0.83, 0.95], hipAmortDeg: [130, 143], kneeCatchDeg: [68, 83] };
}

export function femaleLevelOf(planLevel: string | null | undefined): TaLevel3 {
  const l = String(planLevel || '').toLowerCase();
  if (l === 'advanced' || l === 'elite' || l === 'enhanced') return 'advanced';
  if (l === 'beginner' || l === 'novice') return 'novice';
  return 'intermediate';
}

/**
 * V4-добой: вердикт факта против нормы уровня (Slobozhanskyi 2025).
 * Оба входа опциональны; пусто → null. Допуск: время ±0.06с, углы ±8°.
 */
export function femalePhaseVerdict(
  level: TaLevel3,
  finalAccS: number | null | undefined,
  hipDeg: number | null | undefined,
): string | null {
  const n = femalePhaseNorm(level);
  const parts: string[] = [];
  let ok = true;
  if (finalAccS != null && Number.isFinite(finalAccS) && finalAccS > 0) {
    if (finalAccS > n.finalAccS[1] + 0.06) { ok = false; parts.push(`финал-ускорение ${finalAccS}с дольше нормы ${n.finalAccS.join('–')}с — взрыв/turnover`); }
    else if (finalAccS < n.finalAccS[0] - 0.06) { parts.push(`финал-ускорение ${finalAccS}с быстрее нормы — отлично`); }
    else { parts.push(`финал-ускорение ${finalAccS}с в норме`); }
  }
  if (hipDeg != null && Number.isFinite(hipDeg) && hipDeg > 0) {
    if (hipDeg < n.hipAmortDeg[0] - 8) { ok = false; parts.push(`таз ${hipDeg}° меньше нормы ${n.hipAmortDeg.join('–')}° — глубина амортизации`); }
    else { parts.push(`таз ${hipDeg}° в норме`); }
  }
  if (!parts.length) return null;
  return `${ok ? '✓' : '⚠'} ♀ ${parts.join(' · ')} (уровень ${level})`;
}
