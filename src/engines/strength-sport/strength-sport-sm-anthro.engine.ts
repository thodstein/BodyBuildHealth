/**
 * strength-sport-sm-anthro.engine.ts — АНТРОПОМЕТРИЯ СТРОНГМЕНА (SM PRO)
 *
 * Рост/размах vs высота платформы камня (120-150см):
 * высоким легче загрузка (меньше triple extension), но тяжелее пикап (длиннее рычаг);
 * низким наоборот. Плюс ориентир tacky-height = platform − 10см + (рост−178)×0.2.
 * Parity с TA ta-anthro (diff + advice + notes), SM-специфика — платформа.
 * Источники: Hindle stone (sex/anthro diff — hip-flexion у женщин/низких больше),
 * Harris anterior moment, stoneHeightForAthlete.
 *
 * Чистый движок, без UI/storage.
 */

export interface SMAnthroInput {
  heightCm?: number | null;
  armSpanCm?: number | null;
  platformCm?: number | null; // высота платформы контеста
}

export interface SMAnthroResult {
  diffCm: number | null; // размах − рост
  build: 'long' | 'short' | 'average' | 'unknown';
  platformAdvantage: 'tall' | 'short' | 'neutral' | 'unknown';
  loadAdvice: string;
  pickupAdvice: string;
  tackyHeightCm: number | null;
  notes: string[];
}

export function diagnoseSMAnthro(input: SMAnthroInput): SMAnthroResult | null {
  const h = input.heightCm;
  const s = input.armSpanCm;
  const p = input.platformCm;
  if ((h == null || !Number.isFinite(h) || h <= 0) && (p == null || !Number.isFinite(p as number))) return null;
  const height = h != null && Number.isFinite(h) && h > 0 ? h : 178;
  let diffCm: number | null = null;
  let build: SMAnthroResult['build'] = 'unknown';
  if (s != null && Number.isFinite(s) && s > 0 && h != null && Number.isFinite(h) && h > 0) {
    diffCm = Math.round(s - h);
    build = diffCm > 5 ? 'long' : diffCm < -5 ? 'short' : 'average';
  }
  const platform = p != null && Number.isFinite(p) && (p as number) > 0 ? (p as number) : 140;
  // Преимущество платформы: высоким (≥185) загрузка на 140 легче, низким (≤175) пикап легче
  let platformAdvantage: SMAnthroResult['platformAdvantage'] = 'neutral';
  if (height >= 185) platformAdvantage = 'tall';
  else if (height <= 175) platformAdvantage = 'short';
  const tackyHeightCm = Math.round(platform - 10 + (height - 178) * 0.2);
  let loadAdvice: string;
  if (platformAdvantage === 'tall') {
    loadAdvice = `Рост ${height}см + платформа ${platform}см: загрузка легче (меньше extension) — ставь на скорость secondPull, pop-техника.`;
  } else if (platformAdvantage === 'short') {
    loadAdvice = `Рост ${height}см + платформа ${platform}см: загрузка выше груди — нужен мощный triple extension + lap 2с, grind допустим.`;
  } else {
    loadAdvice = `Рост ${height}см + платформа ${platform}см: нейтрально — lap 2с + взрыв бёдрами.`;
  }
  let pickupAdvice: string;
  if (build === 'long') {
    pickupAdvice = `Длинные руки (+${diffCm}см): обхват камня глубже, high-hips как RDL — не приседай низко.`;
  } else if (build === 'short') {
    pickupAdvice = `Короткие руки (${diffCm}см): садись ниже к камню, пальцы глубже под сферу, tacky на предплечья.`;
  } else {
    pickupAdvice = 'Пропорции средние: high-hips старт, пальцы под камень, руки-крюки (не тянуть).';
  }
  const notes = [
    `Tacky-высота ≈ ${tackyHeightCm}см (платформа −10см + поправка роста).`,
    'Руки всегда прямые на камне/шине — сгибание = distal biceps риск (Heazlewood 11%).',
  ];
  return { diffCm, build, platformAdvantage, loadAdvice, pickupAdvice, tackyHeightCm, notes };
}
