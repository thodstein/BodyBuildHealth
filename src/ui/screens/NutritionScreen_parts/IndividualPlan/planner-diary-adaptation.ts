/**
 * planner-diary-adaptation.ts — Адаптация плана питания по фактическому дневнику.
 *
 * Если пользователь недобрал/перебрал вчера (localStorage 'nutrition_diary'),
 * сегодня компенсируется часть отклонения (50%, с капом ±15% ккал / ±10% белка /
 * ±15% жиров / ±20% углеводов от цели). Это даёт «плавающее» восстановление
 * недельного баланса без экстремальных разовых скачков.
 *
 * Источник данных дневника: localStorage 'nutrition_diary'
 *   { [dateISO]: { meals: { [mealType]: [{ name, kcal, p, f, c, ... }] } } }
  */

import { formatDate } from '../../../../core/utils/date-utils';
import { readDiaryV2 } from '../diary-storage-v2';

export interface DiaryDaySummary {
  date: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  entries: number;
}

export interface MacroTargets {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface CompensationResult {
  applied: boolean;
  yesterday: DiaryDaySummary | null;
  target: MacroTargets;
  /** Дельта, прибавляемая к сегодняшней цели (positive = увеличить, negative = урезать). */
  delta: MacroTargets;
  note: string;
  severity: 'low' | 'medium' | 'high';
}

// Компенсируем половину отклонения — остальное «списываем»,
// чтобы не загнать пользователя в качели.
const COMPENSATION_RATIO = 0.5;
const KCAL_CAP_PCT = 0.15;   // ±15% от цели по ккал
const PROTEIN_CAP_PCT = 0.10; // ±10% от цели по белку (белок стабилен)
const FAT_CAP_PCT = 0.15;     // ±15% от цели по жирам
const CARB_CAP_PCT = 0.20;    // ±20% от цели по углеводам (углеводы — главный рычаг)

/** Прочитать сводку дня из localStorage 'nutrition_diary' по ISO-дате (YYYY-MM-DD). */
export function getDiaryDaySummary(dateISO: string): DiaryDaySummary | null {
  try {
    const data = readDiaryV2();
    const day = data?.[dateISO];
    if (!day || !day.meals) return null;
    let kcal = 0, p = 0, f = 0, c = 0, entries = 0;
    for (const mealItems of Object.values(day.meals) as any[][]) {
      if (!Array.isArray(mealItems)) continue;
      for (const it of mealItems) {
        if (!it) continue;
        kcal += Number(it.kcal) || 0;
        p += Number(it.p) || 0;
        f += Number(it.f) || 0;
        c += Number(it.c) || 0;
        entries++;
      }
    }
    if (entries === 0) return null;
    return {
      date: dateISO,
      kcal: Math.round(kcal),
      p: Math.round(p),
      f: Math.round(f),
      c: Math.round(c),
      entries,
    };
  } catch {
    return null;
  }
}

/** Сводка вчерашнего дня (по локальной дате). */
export function getYesterdaySummary(): DiaryDaySummary | null {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const iso = formatDate(d);
  return getDiaryDaySummary(iso);
}

function fmt(n: number): string {
  const r = Math.round(Math.abs(n));
  return r.toString();
}

/**
 * Вычислить компенсацию для сегодняшней цели на основе вчерашнего факта.
 * deficit = target - actual (positive = недобор → сегодня увеличиваем).
 */
export function computeCompensation(
  target: MacroTargets,
  actual: DiaryDaySummary | null,
): CompensationResult {
  const empty: CompensationResult = {
    applied: false,
    yesterday: actual,
    target,
    delta: { kcal: 0, p: 0, f: 0, c: 0 },
    note: '',
    severity: 'low',
  };
  if (!actual || actual.entries === 0) return empty;

  const deficit: MacroTargets = {
    kcal: target.kcal - actual.kcal,
    p: target.p - actual.p,
    f: target.f - actual.f,
    c: target.c - actual.c,
  };

  // Тривиальное отклонение — компенсация не нужна.
  const trivial =
    Math.abs(deficit.kcal) < 50 &&
    Math.abs(deficit.p) < 5 &&
    Math.abs(deficit.f) < 3 &&
    Math.abs(deficit.c) < 10;
  if (trivial) {
    return { ...empty, note: 'Вчера в пределах цели — компенсация не требуется.' };
  }

  const apply = (def: number, capPct: number, base: number): number => {
    const cap = Math.abs(base) * capPct;
    const raw = def * COMPENSATION_RATIO;
    return Math.sign(raw) * Math.min(Math.abs(raw), cap);
  };

  const delta: MacroTargets = {
    kcal: Math.round(apply(deficit.kcal, KCAL_CAP_PCT, target.kcal)),
    p: Math.round(apply(deficit.p, PROTEIN_CAP_PCT, target.p)),
    f: Math.round(apply(deficit.f, FAT_CAP_PCT, target.f)),
    c: Math.round(apply(deficit.c, CARB_CAP_PCT, target.c)),
  };

  // Severity по относительной величине отклонения ккал.
  const relKcal = Math.abs(deficit.kcal) / Math.max(1, target.kcal);
  const severity: CompensationResult['severity'] =
    relKcal >= 0.15 ? 'high' : relKcal >= 0.05 ? 'medium' : 'low';

  // Текстовая заметка.
  const parts: string[] = [];
  if (Math.abs(deficit.kcal) >= 50) {
    parts.push(
      deficit.kcal > 0
        ? `недобор ${fmt(deficit.kcal)} ккал`
        : `перебор ${fmt(deficit.kcal)} ккал`,
    );
  }
  if (Math.abs(deficit.p) >= 5) {
    parts.push(
      deficit.p > 0 ? `белок −${fmt(deficit.p)}г` : `белок +${fmt(deficit.p)}г`,
    );
  }
  if (Math.abs(deficit.c) >= 10) {
    parts.push(
      deficit.c > 0 ? `углеводы −${fmt(deficit.c)}г` : `углеводы +${fmt(deficit.c)}г`,
    );
  }
  const ypart = parts.length > 0 ? `Вчера: ${parts.join(', ')}. ` : '';
  const todayParts: string[] = [];
  if (delta.kcal !== 0) todayParts.push(`${delta.kcal > 0 ? '+' : ''}${delta.kcal} ккал`);
  if (delta.p !== 0) todayParts.push(`${delta.p > 0 ? '+' : ''}${delta.p}г белка`);
  if (delta.f !== 0) todayParts.push(`${delta.f > 0 ? '+' : ''}${delta.f}г жиров`);
  if (delta.c !== 0) todayParts.push(`${delta.c > 0 ? '+' : ''}${delta.c}г углеводов`);
  const tpart = todayParts.length > 0 ? `Сегодня: ${todayParts.join(', ')}.` : 'Сегодня: без корректировки.';

  return {
    applied: delta.kcal !== 0 || delta.p !== 0 || delta.f !== 0 || delta.c !== 0,
    yesterday: actual,
    target,
    delta,
    note: `${ypart}${tpart}`,
    severity,
  };
}


/**
 * #6 Rolling 7-day компенсация: учитывает не только вчера, но и накопленный
 * дефицит/профицит за предыдущие дни (2..daysBack). Вчера — 50% (основная
 * компенсация), старшие дни — 25% от среднего дневного отклонения (плавное
 * выравнивание недельного баланса без рывков).
 */
export function computeRollingCompensation(
  target: MacroTargets,
  daysBack = 7,
): CompensationResult {
  const yesterday = getYesterdaySummary();
  const diary = readDiaryV2();
  const summaries: { day: number; s: DiaryDaySummary | null }[] = [];
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = formatDate(d);
    const day = diary?.[iso];
    summaries.push({ day: i, s: day?.meals ? getDiaryDaySummary(iso) : null });
  }
  const empty: CompensationResult = {
    applied: false, yesterday, target,
    delta: { kcal: 0, p: 0, f: 0, c: 0 }, note: '', severity: 'low',
  };
  const haveData = summaries.some(x => x.s && x.s.entries > 0);
  if (!haveData) return empty;

  // Вчера — основная компенсация (50%).
  const yDeficit = yesterday ? {
    kcal: target.kcal - yesterday.kcal, p: target.p - yesterday.p,
    f: target.f - yesterday.f, c: target.c - yesterday.c,
  } : { kcal: 0, p: 0, f: 0, c: 0 };

  // Старшие дни (2..daysBack) — накопленный дефицит, компенсируем 25% от среднего.
  let olderCount = 0;
  const olderDeficit = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const { day, s } of summaries) {
    if (day === 1 || !s || s.entries === 0) continue;
    // #15: алкоголь — «пустые» ккал не компенсируем белком. Если в дне много ккал
    // при низком белке/жире/углеводах — вероятен алкоголь; корректируем kcal-дефицит.
    const macroKcal = s.p * 4 + s.f * 9 + s.c * 4;
    const alcoholKcal = Math.max(0, s.kcal - macroKcal);
    const effKcal = s.kcal - alcoholKcal; // не считаем алкоголь against макро-цели
    olderDeficit.kcal += target.kcal - effKcal;
    olderDeficit.p += target.p - s.p;
    olderDeficit.f += target.f - s.f;
    olderDeficit.c += target.c - s.c;
    olderCount++;
  }
  const olderAvg = olderCount > 0 ? {
    kcal: olderDeficit.kcal / olderCount,
    p: olderDeficit.p / olderCount,
    f: olderDeficit.f / olderCount,
    c: olderDeficit.c / olderCount,
  } : { kcal: 0, p: 0, f: 0, c: 0 };

  const apply = (def: number, capPct: number, base: number, ratio: number): number => {
    const cap = Math.abs(base) * capPct;
    const raw = def * ratio;
    return Math.sign(raw) * Math.min(Math.abs(raw), cap);
  };

  // Вчера 50% + старшие 25% от среднего. Кап общий = тот же (±cap от цели).
  const delta: MacroTargets = {
    kcal: Math.round(apply(yDeficit.kcal, KCAL_CAP_PCT, target.kcal, COMPENSATION_RATIO) + apply(olderAvg.kcal, KCAL_CAP_PCT, target.kcal, 0.25)),
    p: Math.round(apply(yDeficit.p, PROTEIN_CAP_PCT, target.p, COMPENSATION_RATIO) + apply(olderAvg.p, PROTEIN_CAP_PCT, target.p, 0.25)),
    f: Math.round(apply(yDeficit.f, FAT_CAP_PCT, target.f, COMPENSATION_RATIO) + apply(olderAvg.f, FAT_CAP_PCT, target.f, 0.25)),
    c: Math.round(apply(yDeficit.c, CARB_CAP_PCT, target.c, COMPENSATION_RATIO) + apply(olderAvg.c, CARB_CAP_PCT, target.c, 0.25)),
  };
  // Финальный кап (сумма могла превысить одиночный кап)
  delta.kcal = Math.sign(delta.kcal) * Math.min(Math.abs(delta.kcal), target.kcal * KCAL_CAP_PCT * 1.5);
  delta.p = Math.sign(delta.p) * Math.min(Math.abs(delta.p), target.p * PROTEIN_CAP_PCT * 1.5);
  delta.f = Math.sign(delta.f) * Math.min(Math.abs(delta.f), target.f * FAT_CAP_PCT * 1.5);
  delta.c = Math.sign(delta.c) * Math.min(Math.abs(delta.c), target.c * CARB_CAP_PCT * 1.5);

  const relKcal = yesterday ? Math.abs(yDeficit.kcal) / Math.max(1, target.kcal) : 0;
  const severity: CompensationResult['severity'] = relKcal >= 0.15 ? 'high' : relKcal >= 0.05 ? 'medium' : 'low';

  const parts: string[] = [];
  if (yesterday && yesterday.entries > 0) {
    if (yDeficit.kcal > 50) parts.push(`вчера недобор ${fmt(yDeficit.kcal)} ккал`);
    else if (yDeficit.kcal < -50) parts.push(`вчера перебор ${fmt(yDeficit.kcal)} ккал`);
  }
  if (olderCount > 0 && Math.abs(olderAvg.kcal) > 100) {
    parts.push(`накоплено за ${olderCount} дн: ${olderAvg.kcal > 0 ? 'дефицит' : 'профицит'} ${fmt(olderAvg.kcal)} ккал/день`);
  }
  const todayParts: string[] = [];
  if (delta.kcal) todayParts.push(`${delta.kcal > 0 ? '+' : ''}${delta.kcal} ккал`);
  if (delta.p) todayParts.push(`${delta.p > 0 ? '+' : ''}${delta.p}г белка`);
  if (delta.c) todayParts.push(`${delta.c > 0 ? '+' : ''}${delta.c}г углев`);
  const note = (parts.length ? `(${parts.join('; ')}) ` : '') + (todayParts.length ? `сегодня: ${todayParts.join(', ')}` : 'сегодня: без корректировки');

  return {
    applied: delta.kcal !== 0 || delta.p !== 0 || delta.f !== 0 || delta.c !== 0,
    yesterday, target, delta, note, severity,
  };
}
