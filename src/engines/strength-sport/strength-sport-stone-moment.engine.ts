/**
 * strength-sport-stone-moment.engine.ts — anterior load moment для камня (Harris 2018 PeerJ)
 * moment = load × (0.25 + sleeve) × sin(torsoAngle) ; sleeve зависит от диаметра камня 35-55см
 * Используется для axialOverload per-height и рекомендации tacky/belt height
 */

export interface StoneMomentInput { loadKg: number; diameterCm?: number; torsoAngleDeg?: number; heightCm?: number; athleteHeightCm?: number; }
export interface StoneMomentResult { momentNm: number; horizDistM: number; risk: 'ok'|'warn'|'high'; tackyHeightCm: number; note: string; }

export function stoneMoment(input: StoneMomentInput): StoneMomentResult | null {
  if (!input || !Number.isFinite(input.loadKg) || input.loadKg <=0) return null;
  const diam = input.diameterCm ?? 40;
  const sleeve = diam / 100 / 2; // радиус камня
  const torso = (input.torsoAngleDeg ?? 45) * Math.PI/180;
  const horiz = 0.25 + sleeve; // 0.25м до камня + радиус
  const moment = Math.round(input.loadKg * 9.81 * horiz * Math.sin(torso));
  let risk: StoneMomentResult['risk'] = 'ok';
  if (moment > 350) risk = 'high';
  else if (moment > 250) risk = 'warn';
  const platform = input.heightCm ?? 140;
  const athleteH = input.athleteHeightCm ?? 178;
  // tacky height = platform -10см, но для высоких атлетов выше
  const heightDiff = athleteH - 178;
  const tackyHeightCm = Math.round(platform - 10 + heightDiff*0.2);
  const note = `moment ${moment}Н·м horiz ${horiz.toFixed(2)}м ${risk==='high'?'⛔ high >350':risk==='warn'?'⚠️ warn':'✅ ok'} · tacky ${tackyHeightCm}см`;
  return { momentNm: moment, horizDistM: Math.round(horiz*100)/100, risk, tackyHeightCm, note };
}

export function stoneHeightForAthlete(platformCm: number, athleteHeightCm: number): number {
  const base = platformCm;
  const diff = athleteHeightCm - 178;
  return Math.round(base + diff*0.15);
}
