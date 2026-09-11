/**
 * bb-tendon-guard.engine.ts — PRO-3 R3 + PRO-4 S1: сухожильно-суставной скрининг (не диагноз).
 *
 * Parity с ARM (`checkUCLGuard/checkShoulderGuard/checkTendonGuard`): считаем недельный
 * объём тяжёлой тяговой/жимой работы из сессий дневника → уровни ok/warn/stop.
 * S1: деление по нагрузке — свободные веса/тело ×1.0, трос/тренажёр ×0.5 (ниже пиковая
 * нагрузка на сухожилие; без данных о снаряде — ×1.0 консервативно). Сеты без веса
 * (голая цифра) считаются ×1.0 — честно, без занижения. План не мутирует.
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

/** Трос/тренажёры — половинный вес сета (маркер в id/имени). */
const MACHINE_RE = /кабел|cable|блок|кроссовер|машин|machine|тренаж|смит|smith|hammer strength|hummer/i;

/** Эквивалент сета: свободный вес/свой вес ×1.0, трос/тренажёр ×0.5, пустой сет — 0. */
function setEquiv(name: string, set: any): number {
  if (set != null && typeof set === 'object') {
    const r = Number((set as any).reps);
    if (Number.isFinite(r) && r <= 0) return 0; // пустой сет
  }
  return MACHINE_RE.test(name) ? 0.5 : 1.0;
}

function countFor(sessions: any[], re: RegExp): number {
  let n = 0;
  if (!Array.isArray(sessions)) return 0;
  for (const s of sessions) {
    const list = Array.isArray(s?.exercises) ? s.exercises : [];
    for (const ex of list) {
      const name = `${ex?.exerciseName || ''} ${ex?.name || ''}`;
      if (!re.test(name)) continue;
      if (Array.isArray(ex?.sets)) {
        for (const st of ex.sets) n += setEquiv(name, st);
      } else {
        n += setsOf(ex); // голая цифра — данных нет, ×1.0 консервативно
      }
    }
  }
  return Math.round(n * 2) / 2;
}

function levelFor(sets: number, pain: boolean, warnAt: number, stopAt: number): BbTendonLevel {
  if (pain) return 'stop';
  if (sets > stopAt) return 'stop';
  if (sets > warnAt) return 'warn';
  return 'ok';
}

/**
 * Пороги — эвристика скрининга, масштабируется уровнем (новичок раньше упирается
 * в потолок восстановления; прецедент — MRV-лесенка volume-landmarks).
 */
const LEVEL_CAPS: Record<string, { warn: number; stop: number }> = {
  beginner: { warn: 8, stop: 12 },
  intermediate: { warn: 12, stop: 18 },
  advanced: { warn: 15, stop: 22 },
  enhanced: { warn: 15, stop: 22 },
};

export function assessBbTendonGuard(
  sessions: any[],
  opts: { elbowPain?: boolean; shoulderOhsFail?: boolean; level?: string } = {},
): BbTendonGuard {
  const caps = LEVEL_CAPS[String(opts.level || 'intermediate').toLowerCase()] || LEVEL_CAPS.intermediate;
  const elbowSets = countFor(sessions, ELBOW_RE);
  const shoulderSets = countFor(sessions, SHOULDER_RE);
  const elbowLevel = levelFor(elbowSets, !!opts.elbowPain, caps.warn, caps.stop);
  const shoulderLevel = levelFor(shoulderSets, !!opts.shoulderOhsFail, caps.warn, caps.stop);
  const elbowText = elbowLevel === 'stop'
    ? `Локоть: стоп — ${elbowSets} тяж. сетов/нед${opts.elbowPain ? ' + боль' : ''}, только изометрия/ремень-техника`
    : elbowLevel === 'warn'
      ? `Локоть: осторожно — ${elbowSets} тяж. сетов/нед (>${caps.warn}), без разнохвата и читинга`
      : `Локоть: порядок — ${elbowSets} тяж. сетов/нед`;
  const shoulderText = shoulderLevel === 'stop'
    ? `Плечо: стоп — ${shoulderSets} жимовых сетов/нед${opts.shoulderOhsFail ? ' + провал плеча в присед-тесте' : ''}, жимы над головой убрать`
    : shoulderLevel === 'warn'
      ? `Плечо: осторожно — ${shoulderSets} жимовых сетов/нед (>${caps.warn}), контроль лопатки, без отказа`
      : `Плечо: порядок — ${shoulderSets} жимовых сетов/нед`;
  return {
    elbow: { joint: 'elbow', heavySets: elbowSets, level: elbowLevel, text: elbowText },
    shoulder: { joint: 'shoulder', heavySets: shoulderSets, level: shoulderLevel, text: shoulderText },
  };
}
