/**
 * bb-tendon-guard.engine.ts — PRO-3 R3: сухожильно-суставной скрининг (не диагноз).
 *
 * Parity с ARM (`checkUCLGuard/checkShoulderGuard/checkTendonGuard`): считаем недельный
 * объём тяжёлой тяговой/жимой работы из сессий дневника → уровни ok/warn/stop.
 * Пороги — эвристика скрининга (12/18 тяжёлых сетов/нед), задокументирована здесь;
 * боль в локте/провал OHS-плеча сразу дают stop. План не мутирует.
 */

export type BbTendonLevel = 'ok' | 'warn' | 'stop';

export interface BbTendonJoint {
  joint: 'elbow' | 'shoulder';
  heavySets: number;
  level: BbTendonLevel;
  text: string;
}

export interface BbTendonGuard {
  elbow: BbTendonJoint;
  shoulder: BbTendonJoint;
}

// Тяга/бицепс грузят дистальный бицепс и локоть; жимы над головой/брусья — плечо.
const ELBOW_RE = /станов|тяга|подтягиван|deadlift|row|pull-?up|pulldown|сгибание|бицепс|молот|curl|hammer/i;
const SHOULDER_RE = /жим стоя|армейск|overhead|ohp|брусья|dips|жим л[ёе]жа|bench|наклон|incline|махи|lateral/i;

function setsOf(ex: any): number {
  if (Array.isArray(ex?.sets)) return ex.sets.length;
  const n = Number(ex?.sets);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function countFor(sessions: any[], re: RegExp): number {
  let n = 0;
  if (!Array.isArray(sessions)) return 0;
  for (const s of sessions) {
    const list = Array.isArray(s?.exercises) ? s.exercises : [];
    for (const ex of list) {
      const name = `${ex?.exerciseName || ''} ${ex?.name || ''}`;
      if (re.test(name)) n += setsOf(ex);
    }
  }
  return n;
}

function levelFor(sets: number, pain: boolean): BbTendonLevel {
  if (pain) return 'stop';
  if (sets > 18) return 'stop';
  if (sets > 12) return 'warn';
  return 'ok';
}

export function assessBbTendonGuard(
  sessions: any[],
  opts: { elbowPain?: boolean; shoulderOhsFail?: boolean } = {},
): BbTendonGuard {
  const elbowSets = countFor(sessions, ELBOW_RE);
  const shoulderSets = countFor(sessions, SHOULDER_RE);
  const elbowLevel = levelFor(elbowSets, !!opts.elbowPain);
  const shoulderLevel = levelFor(shoulderSets, !!opts.shoulderOhsFail);
  const elbowText = elbowLevel === 'stop'
    ? `Локоть: стоп — ${elbowSets} тяж. сетов/нед${opts.elbowPain ? ' + боль' : ''}, только изометрия/ремень-техника`
    : elbowLevel === 'warn'
      ? `Локоть: осторожно — ${elbowSets} тяж. сетов/нед (>12), без разнохвата и читинга`
      : `Локоть: порядок — ${elbowSets} тяж. сетов/нед`;
  const shoulderText = shoulderLevel === 'stop'
    ? `Плечо: стоп — ${shoulderSets} жимовых сетов/нед${opts.shoulderOhsFail ? ' + провал плеча в присед-тесте' : ''}, жимы над головой убрать`
    : shoulderLevel === 'warn'
      ? `Плечо: осторожно — ${shoulderSets} жимовых сетов/нед (>12), контроль лопатки, без отказа`
      : `Плечо: порядок — ${shoulderSets} жимовых сетов/нед`;
  return {
    elbow: { joint: 'elbow', heavySets: elbowSets, level: elbowLevel, text: elbowText },
    shoulder: { joint: 'shoulder', heavySets: shoulderSets, level: shoulderLevel, text: shoulderText },
  };
}
