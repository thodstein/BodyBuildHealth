/**
 * arm-calendar.engine.ts — TOP T8: Super Series календарь + весогонка-синк.
 *
 * Источники: WAF Worlds (всегда последние 2 недели сентября), East-vs-West
 * supermatch-серия (пик под дату), Armlifting Super Series (этапы по имплементам),
 * план весогонки 0.5/0.4 %/нед (своя — reuse идеей, не импортом).
 *
 * Вход: дата старта + приоритет (A/B/C) + вес/цель. Выход: обратный отсчёт,
 * фаза, тейпер-окно, весогонка-статус, календарные вехи.
 * Чистый модуль без импортов.
 */

export type CalPriority = 'A' | 'B' | 'C';
export type CalPhase = 'base' | 'strength' | 'taper' | 'peak' | 'past';
export type CalSeries = 'waf_worlds' | 'east_vs_west' | 'super_series' | 'local';

export interface ArmCalendarInput {
  startIso?: string; // дата старта
  fromIso?: string; // откуда считаем (по умолчанию сегодня)
  priority?: string; // A/B/C
  series?: string;
  startKg?: number;
  targetKg?: number;
  sex?: string;
}

export interface ArmCalendar {
  weeksOut: number; // ≥0; 0 = старт прошёл/эта неделя
  phase: CalPhase;
  taperWeeks: number; // длина тейпера (A=3, B=2, C=0 встроен)
  taperNote: string;
  cut: { lossKg: number; weeklyLossKg: number; ratePct: number; targetRate: number; status: string; note: string };
  milestones: string[];
  note: string;
}

const DAY = 86400000;

function num(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

export function calWeeksOut(fromIso?: string, startIso?: string): number {
  try {
    const from = fromIso ? new Date(fromIso) : new Date();
    const to = startIso ? new Date(startIso) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 8;
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (7 * DAY)));
  } catch {
    return 8;
  }
}

function normPrio(v: unknown): CalPriority {
  const s = String(v || 'B').toUpperCase();
  return s === 'A' ? 'A' : s === 'C' ? 'C' : 'B';
}

function normSeries(v: unknown): CalSeries {
  const s = String(v || 'local').toLowerCase();
  if (s.includes('waf') || s.includes('world')) return 'waf_worlds';
  if (s.includes('east') || s.includes('west') || s.includes('supermatch')) return 'east_vs_west';
  if (s.includes('super_series') || s.includes('super-series') || s.includes('armlift')) return 'super_series';
  return 'local';
}

function taperFor(p: CalPriority): number {
  return p === 'A' ? 3 : p === 'B' ? 2 : 0;
}

function phaseFor(weeksOut: number, taperWeeks: number): CalPhase {
  if (weeksOut <= 0) return 'past';
  if (weeksOut <= 1) return 'peak';
  if (weeksOut <= 1 + taperWeeks) return 'taper';
  if (weeksOut <= 8) return 'strength';
  return 'base';
}

function cutStatus(rate: number, target: number, lossKg: number): string {
  if (lossKg <= 0) return 'no_data';
  if (rate > target * 1.3) return 'too_fast';
  if (rate < target * 0.55) return 'too_slow';
  return 'on_track';
}

export function buildArmCalendar(input: ArmCalendarInput = {}): ArmCalendar {
  const prio = normPrio(input.priority);
  const series = normSeries(input.series);
  const weeksOut = calWeeksOut(input.fromIso, input.startIso);
  const taperWeeks = taperFor(prio);
  const phase = phaseFor(weeksOut, taperWeeks);
  // Весогонка (паритет planWeightCut, без импорта)
  const start = num(input.startKg, 0);
  const target = num(input.targetKg, 0);
  const sex = String(input.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const targetRate = sex === 'female' ? 0.4 : 0.5;
  let lossKg = 0;
  let weeklyLossKg = 0;
  let ratePct = 0;
  if (start > target && target > 0 && weeksOut > 0) {
    lossKg = Math.round((start - target) * 10) / 10;
    weeklyLossKg = Math.round((lossKg / Math.max(1, weeksOut)) * 100) / 100;
    ratePct = Math.round(((weeklyLossKg / start) * 100) * 100) / 100;
  }
  const status = cutStatus(ratePct, targetRate, lossKg);
  const cutNote =
    status === 'no_data'
      ? 'Нет сгонки: вес в категории или нет цели.'
      : status === 'too_fast'
        ? `Темп ${ratePct}%/нед выше цели ${targetRate}% — риск силы, добавить ккал.`
        : status === 'too_slow'
          ? `Темп ${ratePct}%/нед ниже цели — не успеете, начать раньше.`
          : `Сгонка ${lossKg} кг за ${weeksOut} нед (−${weeklyLossKg} кг/нед) — в плане.`;
  const taperNote =
    prio === 'C'
      ? 'Приоритет C: встроен в подготовку, отдельного тейпера нет.'
      : `Тейпер ${taperWeeks} нед (${prio}): объём ×0.65→×0.45, RIR+1/+2, side минимум, contest-sim в конце.`;
  const seriesNote =
    series === 'waf_worlds'
      ? 'WAF Worlds: взвешивание за 24–30ч без допуска, L/R — разные дни.'
      : series === 'east_vs_west'
        ? 'East-vs-West: supermatch best-of-5/6, drain-план на поздние раунды.'
        : series === 'super_series'
          ? 'Super Series: этапы по имплементам — лестница + попытки 90/96/102 на каждый.'
          : 'Локальный старт: обкатка процедуры + Table-IQ журнал.';
  const milestones = [
    `T-${weeksOut} нед: фаза ${phase} (${seriesNote})`,
    taperWeeks > 0 ? `Тейпер последние ${taperWeeks} нед.` : 'Без отдельного тейпера (C).',
    lossKg > 0 ? `Вес: ${cutNote}` : 'Вес: в категории.',
    'Финал: contest-sim неделя + чеклист (магnezия/ремень/60с на выход).',
  ];
  return {
    weeksOut,
    phase,
    taperWeeks,
    taperNote,
    cut: { lossKg, weeklyLossKg, ratePct, targetRate, status, note: cutNote },
    milestones,
    note: `До старта ${weeksOut} нед (${phase}, ${prio}) · ${taperNote} ${cutNote}`,
  };
}
