/**
 * armlift-session-rules.engine.ts — порядок и размещение хват-работы (PRO-5 D17).
 * Синтез: Saxon до Hub (strongshop — щипок устаёт первым); тяжёлое первым,
 * холды/керри после; экстензоры в конце; хват — в конце тренировки, не до тяг
 * (PoinT GO, NSCA); широкий щипок → узкий по мере отказа (StrongFirst).
 * Чистые функции.
 */
import type { ArmliftCorrection } from './armlift-correction.engine';

function orderRank(c: ArmliftCorrection): number {
  const id = c.exId;
  // Макс-сила первой: тяжёлые тройки/единички без холда.
  if (c.sets >= 4 && c.reps[1] <= 5 && c.holdSeconds == null) return 0;
  // Щипок: широкий → узкий (plate перед hub по ширине).
  if (/plate_pinch_hold|saxon_bar|country_crush/.test(id)) return 1;
  if (/hub_pinch|pinch_block_80|anvil_hub/.test(id)) return 2;
  // Crush-работа.
  if (/coc_|silver/.test(id)) return 3;
  // Холды и керри.
  if (c.holdSeconds != null || /farmer|towel|fat_gripz|inch_dumbbell|wrist_wrench|rolling_thunder|apollon|raptor|grandfather|excalibur|flask|napalm/.test(id)) return 4;
  // Экстензоры и рычаги — в конце.
  return 5;
}

/** Стабильный порядок упражнений в дне (исходный порядок — тай-брейк). */
export function orderCorrectionsForDay(corrections: ArmliftCorrection[]): ArmliftCorrection[] {
  return (corrections || [])
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => orderRank(a.c) - orderRank(b.c) || a.idx - b.idx)
    .map((x) => x.c);
}

/** Строка порядка + размещения (едет в мост и rationale плана). */
export function sessionOrderNote(corrections: ArmliftCorrection[]): string {
  const ids = (corrections || []).map((c) => c.exId);
  const bits: string[] = ['Хват — в конце тренировки, после тяг'];
  if (ids.includes('saxon_bar') && ids.includes('hub_pinch')) bits.push('Saxon до Hub');
  if (ids.includes('plate_pinch_hold')) bits.push('Щипок: широкий → узкий по мере отказа');
  if (ids.some((id) => /wrist_ext_bb|wrist_roller|reverse_ez_curl|lever_top/.test(id))) {
    bits.push('Экстензоры/рычаг — последними');
  }
  return bits.join(' · ');
}
