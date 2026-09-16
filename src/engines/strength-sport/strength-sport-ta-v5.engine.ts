/**
 * strength-sport-ta-v5.engine.ts — V5: turnover/catch, глубокий толчок,
 * баланс тяг, баллистик-оговорка, анти-смешивание (Torokhtiy).
 *
 * Все функции чистые, null-safe: нет данных → null (не гадаем).
 * Пороги-ориентиры подписаны источниками; жёстких «норм» без литературы нет.
 */

export interface TurnoverInput {
  yMaxCm?: number | null;
  turnoverMs?: number | null;
  catchKneeDeg?: number | null;
  lift?: string | null;
}

export interface TurnoverResult {
  turnover: 'fast' | 'ok' | 'slow' | null;
  catch: 'deep' | 'power' | 'high' | null;
  overpull: boolean;
  text: string;
}

/**
 * V1: уход под штангу + приём (белый лист V3/V4: тяги покрыты, turnover — нет).
 * turnover: <350мс быстрый / 350–550 норма / >550 медленный (рабочие, не норматив);
 * сед по колену: <80° глубокий / 80–110° силовой / >110° высокий.
 * overpull: высокий бар + медленный уход = «перетягиваешь» (Tunçel 2025: низкий
 * Hmax + быстрый уход — маркер успеха).
 */
export function turnoverDiag(inp: TurnoverInput): TurnoverResult | null {
  const y = inp.yMaxCm != null && Number.isFinite(inp.yMaxCm) && (inp.yMaxCm as number) > 0 ? (inp.yMaxCm as number) : null;
  const t = inp.turnoverMs != null && Number.isFinite(inp.turnoverMs) && (inp.turnoverMs as number) > 0 ? (inp.turnoverMs as number) : null;
  const k = inp.catchKneeDeg != null && Number.isFinite(inp.catchKneeDeg) && (inp.catchKneeDeg as number) > 0 ? (inp.catchKneeDeg as number) : null;
  if (y == null && t == null && k == null) return null;
  const turnover: TurnoverResult['turnover'] = t == null ? null : t < 350 ? 'fast' : t <= 550 ? 'ok' : 'slow';
  const catchV: TurnoverResult['catch'] = k == null ? null : k < 80 ? 'deep' : k <= 110 ? 'power' : 'high';
  const overpull = y != null && y > 130 && turnover === 'slow';
  const parts: string[] = [];
  if (turnover === 'fast') parts.push(`уход ${t}мс — быстрый, отлично`);
  else if (turnover === 'ok') parts.push(`уход ${t}мс — в рабочем коридоре 350–550`);
  else if (turnover === 'slow') parts.push(`уход ${t}мс — медленный, бар успевает упасть`);
  if (catchV === 'deep') parts.push(`приём глубокий (колено ${k}°)`);
  else if (catchV === 'power') parts.push(`приём силовой (колено ${k}°)`);
  else if (catchV === 'high') parts.push(`приём высокий (колено ${k}°) — не дожимаешь сед`);
  if (overpull) parts.push('перетягиваешь: высокий бар + медленный уход (Tunçel 2025: успех = низкий Hmax + быстрый уход)');
  else if (y != null && y <= 122 && turnover === 'fast') parts.push('связка «низкий бар + быстрый уход» — маркер успеха (Tunçel 2025)');
  return { turnover, catch: catchV, overpull, text: parts.join(' · ') || 'Данных мало для вердикта' };
}

export interface JerkDriveInput {
  dipCm?: number | null;
  dipMs?: number | null;
  /** Заднее смещение грифа в catch, см (Nagao 2026: больше = лучше). */
  catchBackCm?: number | null;
  /** Взрывное разгибание таза-корпуса в drive (глаз тренера). */
  hipFast?: boolean | null;
  /** Быстрое сгибание коленей в dip (глаз тренера) — маркер провала. */
  dipFast?: boolean | null;
}

/**
 * V2: глубокий толчок (Nagao 2026, сборная Японии: успех = широкое заднее
 * смещение в catch + амплитуда/скорость разгибания в drive; провал = быстрый dip).
 * Числовых нормативов catchBack нет в литературе — только направление «больше лучше»,
 * поэтому вердикт качественный, без выдуманных коридоров.
 */
export function jerkDriveDiag(inp: JerkDriveInput): string | null {
  const parts: string[] = [];
  const cb = inp.catchBackCm != null && Number.isFinite(inp.catchBackCm) ? (inp.catchBackCm as number) : null;
  if (cb != null) {
    if (cb > 0) parts.push(`увод назад ${cb}см — маркер успеха ножниц (Nagao 2026)`);
    else parts.push('увода назад нет — доводи бар за линию ушей (Nagao 2026)');
  }
  if (inp.hipFast === true) parts.push('разгибание таза-корпуса взрывное — держи');
  if (inp.dipFast === true) parts.push('⚠ быстрое сгибание коленей в dip — снижает успех, dip короче и жёстче (Nagao 2026)');
  if (!parts.length) return null;
  return parts.join(' · ');
}

export interface PullBalanceInput {
  yMaxCm?: number | null;
  normLo?: number | null;
  normHi?: number | null;
  /** Мощность второй тяги, Вт (факт замера; порогов-норм нет — только связка с Hmax). */
  secondPullW?: number | null;
  bwKg?: number | null;
}

/**
 * V3: баланс тяг (Tunçel 2025: низкий Hmax + высокая мощность второй тяги =
 * маркер успеха). Без выдуманных Вт-норм: классифицируем только Hmax против
 * нормы весовой, мощность показываем как Вт/кг фактом.
 */
export function pullPowerBalance(inp: PullBalanceInput): string | null {
  const y = inp.yMaxCm != null && Number.isFinite(inp.yMaxCm) && (inp.yMaxCm as number) > 0 ? (inp.yMaxCm as number) : null;
  if (y == null) return null;
  const lo = inp.normLo != null && Number.isFinite(inp.normLo) ? (inp.normLo as number) : null;
  const hi = inp.normHi != null && Number.isFinite(inp.normHi) ? (inp.normHi as number) : null;
  const yDir: 'low' | 'ok' | 'high' | null = lo != null && hi != null ? (y < lo ? 'low' : y > hi ? 'high' : 'ok') : null;
  const w = inp.secondPullW != null && Number.isFinite(inp.secondPullW) && (inp.secondPullW as number) > 0 ? (inp.secondPullW as number) : null;
  const bw = inp.bwKg != null && Number.isFinite(inp.bwKg) && (inp.bwKg as number) > 0 ? (inp.bwKg as number) : null;
  const rel = w != null && bw != null ? Math.round((w / bw) * 10) / 10 : null;
  const wPart = w != null ? `мощность второй тяги ${w}Вт${rel != null ? ` (${rel} Вт/кг)` : ''}` : null;
  if (yDir === 'low' && wPart) return `Hmax ${y}см (низко) + ${wPart} — связка «низкий бар + мощность» = маркер успеха (Tunçel 2025)`;
  if (yDir === 'high' && wPart) return `Hmax ${y}см (высоко) + ${wPart} — тяни мощнее, садись быстрее: успех = низкий бар при той же мощности (Tunçel 2025)`;
  if (wPart) return `${wPart} · Hmax ${y}см`;
  return null;
}

/**
 * V4: баллистик-оговорка лёгким весам (Thompson et al. 2025: тормозная фаза
 * занижает скорость лёгких весов не-баллистики; пара — прыжковый аналог до 50–60%).
 * Только текст-флаг, математику LVP не трогаем. Не-баллистика: присед/жим/тяги
 * строгие (деривативы рывка/взятия — баллистика, молчим).
 */
const NON_BALLISTIC_RE = /(squat|присед|bench|жим|press|deadlift|становая|row(?![\w]*pull)|тяга штанги в наклоне)/i;
export function lvpBallisticNote(lift: string | null | undefined, lightestPct: number | null | undefined): string | null {
  if (!lift || lightestPct == null || !Number.isFinite(lightestPct)) return null;
  if (lightestPct > 60) return null;
  if (!NON_BALLISTIC_RE.test(String(lift))) return null;
  return `Лёгкая точка ${lightestPct}% не-баллистики (${lift}) занижена тормозной фазой — парой бери прыжковый аналог до 50–60% (Thompson 2025)`;
}

/** V7: движение слабой фазы (для группировки волны; Torokhtiy: snatch/clean не смешивать). */
export type TAMovement = 'snatch' | 'clean' | 'jerk' | 'base';
export function movementOfWeak(wp: string | null | undefined): TAMovement {
  const w = String(wp || '').toLowerCase();
  if (w.startsWith('snatch_')) return 'snatch';
  if (w.startsWith('clean_')) return 'clean';
  if (w.startsWith('jerk_') || w.startsWith('split_') || w === 'dip') return 'jerk';
  return 'base';
}

export const TA_MOVEMENT_RU: Record<TAMovement, string> = {
  snatch: 'Рывок',
  clean: 'Взятие',
  jerk: 'Толчок',
  base: 'База',
};

/**
 * V7: честное предупреждение волны (Torokhtiy 2025: разный hip-contact/bar-path/
 * timing — рывок и взятие в одних неделях/днях не смешиваем).
 * Пусто или одно движение → null (молчим).
 */
export function mixedWaveNote(weakPoints: Array<string | null | undefined>): string | null {
  const movs = new Set((weakPoints || []).map(movementOfWeak));
  movs.delete('base');
  if (movs.has('snatch') && movs.has('clean')) {
    return 'Волна смешивает рывок + взятие — разноси по дням: вис/блоки одного движения в шаге, не вперемешку (Torokhtiy 2025)';
  }
  return null;
}
