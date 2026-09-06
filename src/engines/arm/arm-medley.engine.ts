/**
 * arm-medley.engine.ts — медли/форматы ArmliftingUSA (ротация + симуляция).
 *
 * Источники: armliftingusa.com/rules (минимум 2 из 4 дисциплин: RT one-arm DL,
 * Axle DOH, Saxon, Hub/LBH/Blockbuster/Country Crush и др.; промах = выбыл;
 * 60с на попытку с объявления; unlimited attempts на рекордах),
 * 2026 кейсы (Worlds: 60mm Axle max + SSE Anvil + 2"×5" Saxon medley;
 * Arnold: Rogue Axle DOH + 3"×4" Saxon + Grandfather Clock; Super Series:
 * one-hand + 3"×4" Saxon + Hub freestyle), форматы Last Man Standing /
 * Flights+Rounds.
 *
 * Чистый модуль без импортов.
 */

export type MedleyFormat = 'last_man' | 'flights_rounds' | 'max_single';

export interface MedleyEvent {
  implement: string; // rolling_thunder | apollon_axle | saxon_bar | hub | ...
  mode: 'max' | 'medley' | 'hold';
  attempts: number; // заявок/раундов
}

export interface MedleyTemplate {
  id: string;
  name: string;
  events: MedleyEvent[];
  format: MedleyFormat;
  clockSec: number;
  note: string;
}

export const ARM_MEDLEYS: MedleyTemplate[] = [
  {
    id: 'worlds_2026', name: 'Worlds 2026 (Axle + Anvil + Saxon medley)',
    events: [
      { implement: 'apollon_axle', mode: 'max', attempts: 3 },
      { implement: 'anvil', mode: 'max', attempts: 3 },
      { implement: 'saxon_bar', mode: 'medley', attempts: 3 },
    ],
    format: 'flights_rounds', clockSec: 60,
    note: '60мм Axle max + SSE Anvil max + Saxon 2"×5" medley. Промах = стоп в событии.',
  },
  {
    id: 'arnold_2026', name: 'Arnold 2026 (Rogue Axle + Saxon + Clock)',
    events: [
      { implement: 'apollon_axle', mode: 'max', attempts: 3 },
      { implement: 'saxon_bar', mode: 'max', attempts: 3 },
      { implement: 'grandfather_clock', mode: 'max', attempts: 3 },
    ],
    format: 'flights_rounds', clockSec: 60,
    note: 'Rogue Axle DOH + Saxon 3"×4" + Grandfather Clock. 60с с объявления.',
  },
  {
    id: 'super_series_2026', name: 'Super Series 2026 (one-hand + Saxon + Hub)',
    events: [
      { implement: 'rolling_thunder', mode: 'max', attempts: 3 },
      { implement: 'saxon_bar', mode: 'max', attempts: 3 },
      { implement: 'hub', mode: 'max', attempts: 3 },
    ],
    format: 'last_man', clockSec: 60,
    note: 'One-hand + Saxon 3"×4" + Hub freestyle. Last Man Standing по желанию.',
  },
  {
    id: 'rt_saxon_hub', name: 'Классика (RT + Saxon + Hub)',
    events: [
      { implement: 'rolling_thunder', mode: 'max', attempts: 3 },
      { implement: 'saxon_bar', mode: 'max', attempts: 3 },
      { implement: 'hub', mode: 'hold', attempts: 2 },
    ],
    format: 'max_single', clockSec: 60,
    note: 'Базовая тройка USA: support → pinch → hub. Hub — удержание на время.',
  },
];

export function getMedley(id: string): MedleyTemplate | undefined {
  return ARM_MEDLEYS.find((m) => m.id === id);
}

export interface MedleyAttempt {
  eventIdx: number;
  weightKg: number;
  success: boolean;
}

/**
 * Симуляция медли: промах закрывает событие (miss = выбыл), сумма — по лучшим.
 * Возвращает best по событиям + общий скор + строку.
 */
export function simulateMedley(
  medleyId: string,
  attempts: MedleyAttempt[],
): { best: number[]; total: number; done: boolean[]; note: string } {
  const m = getMedley(medleyId);
  if (!m) return { best: [], total: 0, done: [], note: 'Медли не найден.' };
  const best = m.events.map(() => 0);
  const done = m.events.map(() => false);
  const sorted = (attempts || []).slice().sort((a, b) => a.eventIdx - b.eventIdx);
  for (const a of sorted) {
    const i = Math.round(Number(a.eventIdx));
    if (i < 0 || i >= m.events.length || done[i]) continue;
    const w = Number(a.weightKg || 0);
    if (a.success && w > 0) best[i] = Math.max(best[i], w);
    else done[i] = true; // промах = выбыл из события
  }
  const total = Math.round(best.reduce((s, v) => s + v, 0) * 10) / 10;
  return {
    best, total, done,
    note: `${m.name}: лучшие ${best.join(' + ')} = ${total} (${m.format === 'last_man' ? 'Last Man Standing' : m.format === 'flights_rounds' ? 'Flights+Rounds' : 'Max single'}, ${m.clockSec}с на выход).`,
  };
}

/** Ротация снарядов по неделям под медли (support → pinch → hub/crush цикл). */
export function medleyRotationForWeek(medleyId: string, week: number): string {
  const m = getMedley(medleyId);
  if (!m || !m.events.length) return 'rolling_thunder';
  const idx = ((Math.max(1, Math.round(week)) - 1) % m.events.length + m.events.length) % m.events.length;
  return m.events[idx].implement;
}
