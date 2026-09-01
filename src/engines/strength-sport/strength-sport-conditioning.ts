/**
 * strength-sport-conditioning.ts — кондиция для стронга/ТА (PRO, изолировано).
 * 3 системы: alactic (фосфаген 10с/50с), lactic (гликолитик 60с/90с), aerobic Zone2 30′
 * Портировано из combat-conditioning с адаптацией под carries/stone.
 */

export type ConditioningMode = 'alactic' | 'lactic' | 'aerobic' | 'mixed';

export interface ConditioningSession {
  system: ConditioningMode;
  protocol: string;
  durationMin: number;
  rpe: number;
  restS: number;
  note?: string;
}

const ALACTIC: ConditioningSession = { system: 'alactic', protocol: '8×10с спринт/тяга 50с пауза', durationMin: 12, rpe: 9, restS: 50, note: 'Фосфаген: sled 20м, prowler, yoke 10м' };
const LACTIC: ConditioningSession = { system: 'lactic', protocol: '5×60с AMRAP 90с пауза', durationMin: 15, rpe: 8, restS: 90, note: 'Гликолитик: tire flip, sandbag over bar, farmers 40м' };
const AEROBIC: ConditioningSession = { system: 'aerobic', protocol: 'Zone2 30′ @RPE 5-6', durationMin: 30, rpe: 5, restS: 0, note: 'Активное восстановление, HR 130-145' };

export function modalityForWeek(week: number, totalWeeks: number, mode: string): ConditioningMode {
  if (mode !== 'strongman') return 'aerobic';
  const ratio = week / totalWeeks;
  if (ratio < 0.30) return 'aerobic';
  if (ratio < 0.60) return 'mixed';
  if (ratio < 0.85) return 'lactic';
  return 'alactic';
}

export function conditioningForWeek(week: number, totalWeeks: number, mode: string, outsideHigh = false): ConditioningSession[] {
  if (outsideHigh) return [];
  const m = modalityForWeek(week, totalWeeks, mode);
  if (m === 'aerobic') return [AEROBIC];
  if (m === 'lactic') return [LACTIC];
  if (m === 'alactic') return [ALACTIC];
  return [AEROBIC, LACTIC];
}

export function buildConditioningRationale(week: number, totalWeeks: number, mode: string): string[] {
  const cs = conditioningForWeek(week, totalWeeks, mode);
  if (!cs.length) return ['Внезала high — кондиция пауза'];
  return cs.map(c=> `${c.system}: ${c.protocol} ${c.durationMin}′ RPE${c.rpe}`);
}
