/**
 * arm-diary-autoreg.engine.ts — дневник → авторегуляция (эпик G PRO-плана).
 *
 * Зеркало BB/PL diary-autoreg для сухожильных групп:
 * sRPE + боль (0-10) + VBT-потеря → множитель объёма, сдвиг RIR, замены.
 * Боль ≥4 в локте/запястье: side → изометрия, pron heavy → pulses.
 */

export interface ArmDiaryDay {
  dateIso: string;
  srpe?: number; // 1-10
  elbowPain?: number; // 0-10
  wristPain?: number; // 0-10
  velocityLossPct?: number | null;
}

export interface ArmAutoregResult {
  volumeMult: number; // 0.5-1.0
  rirShift: number; // 0..+2
  replaceSideWithIso: boolean;
  replaceHeavyPronWithPulses: boolean;
  extraRestDays: number;
  note: string;
}

export function armAcwrZone(avg7: number, avg28: number): 'ok' | 'caution' | 'danger' {
  if (!Number.isFinite(avg7) || !Number.isFinite(avg28) || avg28 <= 0) return 'ok';
  const ratio = avg7 / avg28;
  if (ratio >= 1.5) return 'danger';
  if (ratio >= 1.3) return 'caution';
  return 'ok';
}

export function autoregArmFromDiary(days: ArmDiaryDay[]): ArmAutoregResult {
  const last = days.slice(-7);
  const maxPain = last.reduce((m, d) => Math.max(m, Number(d.elbowPain ?? 0), Number(d.wristPain ?? 0)), 0);
  const maxSrpe = last.reduce((m, d) => Math.max(m, Number(d.srpe ?? 0)), 0);
  const maxLoss = last.reduce((m, d) => Math.max(m, Number(d.velocityLossPct ?? 0)), 0);
  let volumeMult = 1;
  let rirShift = 0;
  let extraRestDays = 0;
  // sRPE-правило
  if (maxSrpe >= 9) {
    volumeMult = Math.min(volumeMult, 0.65);
    rirShift = Math.max(rirShift, 2);
    extraRestDays = Math.max(extraRestDays, 1);
  } else if (maxSrpe >= 8) {
    volumeMult = Math.min(volumeMult, 0.85);
    rirShift = Math.max(rirShift, 1);
  }
  // VBT-правило (tendon)
  if (maxLoss >= 30) {
    volumeMult = Math.min(volumeMult, 0.65);
    rirShift = Math.max(rirShift, 2);
    extraRestDays = Math.max(extraRestDays, 1);
  } else if (maxLoss >= 20) {
    volumeMult = Math.min(volumeMult, 0.85);
    rirShift = Math.max(rirShift, 1);
  }
  // Боль-правило (сустав)
  const replaceSideWithIso = maxPain >= 4;
  const replaceHeavyPronWithPulses = maxPain >= 4;
  if (maxPain >= 7) {
    volumeMult = Math.min(volumeMult, 0.5);
    rirShift = Math.max(rirShift, 2);
    extraRestDays = Math.max(extraRestDays, 2);
  } else if (maxPain >= 4) {
    volumeMult = Math.min(volumeMult, 0.7);
    rirShift = Math.max(rirShift, 1);
    extraRestDays = Math.max(extraRestDays, 1);
  }
  const notes: string[] = [];
  if (volumeMult < 1) notes.push(`Объём ×${volumeMult}`);
  if (rirShift > 0) notes.push(`RIR+${rirShift}`);
  if (replaceSideWithIso) notes.push('Side → изометрия');
  if (replaceHeavyPronWithPulses) notes.push('Pron heavy → pulses');
  if (extraRestDays > 0) notes.push(`+${extraRestDays} день отдыха`);
  return {
    volumeMult: Math.round(volumeMult * 100) / 100,
    rirShift,
    replaceSideWithIso,
    replaceHeavyPronWithPulses,
    extraRestDays,
    note: notes.length ? notes.join(' · ') : 'Дневник в норме — план без изменений.',
  };
}
