/**
 * outside-load.engine.ts — учёт внешней (внезальной) нагрузки.
 *
 * Спортсмен тренируется вне зала: татами/ринг/поле/манеж.
 * Наш конструктор отвечает ТОЛЬКО за силовую часть в зале,
 * но должен учитывать внешнюю нагрузку как фоновый стресс
 * (интерференция, недовосстановление, конфликт дней).
 *
 * Модель: OutsideLoad — декларация атлета (сессии/нед × длительность × RPE).
 * Из неё считаем weeklyLoad и мультипликаторы объёма/частоты.
 */

export type OutsideInterference = 'low' | 'medium' | 'high';
export type OutsideType = 'mat' | 'ring' | 'field' | 'mixed' | 'other';

export interface OutsideLoad {
  /** Сессий вне зала в неделю (0-7) */
  sessionsPerWeek: number;
  /** Средняя длительность внешней сессии, мин (30-240) */
  avgDurationMin: number;
  /** Средний RPE внешней сессии 1-10 (или sRPE) */
  avgSRPE: number;
  /** Тип внешней работы */
  type?: OutsideType;
  /** Дни недели с высокой внешней нагрузкой (0=Пн .. 6=Вс) */
  highIntensityDays?: number[];
  /** Уровень интерференции с силовой (единоборства=high, ТА/low, стронг/low) */
  interference?: OutsideInterference;
  /** Примечание */
  note?: string;
}

export interface OutsideLoadMetrics {
  weeklyLoad: number;            // sessions * duration * sRPE
  dailyAvgLoad: number;
  volumeMultiplier: number;       // 0.6-1.0 — на сколько резать объём зала
  frequencyPenalty: number;       // 0-1 — снижать ли частоту ног/спины
  highDays: number[];             // нормализованные 0-6
  interference: OutsideInterference;
  rationale: string[];
}

/** Нормализация OutsideLoad с клампами */
export function normalizeOutsideLoad(input: OutsideLoad | null | undefined): OutsideLoad | null {
  if (!input) return null;
  const s = Math.max(0, Math.min(7, Math.round(Number(input.sessionsPerWeek) || 0)));
  if (s === 0) return null;
  const d = Math.max(30, Math.min(240, Math.round(Number(input.avgDurationMin) || 90)));
  const r = Math.max(1, Math.min(10, Number(input.avgSRPE) || 6));
  const type: OutsideType = (input.type as OutsideType) || 'mixed';
  const interference: OutsideInterference = (input.interference as OutsideInterference) || (s >= 4 ? 'high' : s >= 2 ? 'medium' : 'low');
  const highDays = Array.isArray(input.highIntensityDays)
    ? [...new Set(input.highIntensityDays.map(n => Math.max(0, Math.min(6, Math.round(Number(n))))))].sort((a, b) => a - b)
    : [];
  return { sessionsPerWeek: s, avgDurationMin: d, avgSRPE: r, type, highIntensityDays: highDays, interference, note: input.note };
}

/** Недельная нагрузка вне зала */
export function outsideWeeklyLoad(load: OutsideLoad | null | undefined): number {
  const n = normalizeOutsideLoad(load);
  if (!n) return 0;
  return n.sessionsPerWeek * n.avgDurationMin * n.avgSRPE;
}

/** Мультипликатор объёма зала из внешней нагрузки.
 *  high 5×/нед ×90мин×7 = 3150 → ×0.62
 *  medium 3×/нед ×90×6=1620 → ×0.78
 *  low 1×/нед ×60×5=300 → ×0.95
 */
export function outsideVolumeMultiplier(load: OutsideLoad | null | undefined): number {
  const n = normalizeOutsideLoad(load);
  if (!n) return 1.0;
  const wl = outsideWeeklyLoad(n);
  // базовая кривая по wl
  let m = 1.0;
  if (wl >= 2500) m = 0.60;
  else if (wl >= 1800) m = 0.70;
  else if (wl >= 1200) m = 0.80;
  else if (wl >= 600) m = 0.90;
  else m = 0.95;
  // интерференция уточняет: high режет сильнее
  if (n.interference === 'high') m = Math.min(m, m * 0.92);
  else if (n.interference === 'low') m = Math.min(1.0, m * 1.06);
  return Math.max(0.55, Math.min(1.0, Math.round(m * 100) / 100));
}

/** Штраф частоты: при высокой внешней нагрузке ноги/тяж. тяги не 3×/нед */
export function outsideFrequencyPenalty(load: OutsideLoad | null | undefined): number {
  const n = normalizeOutsideLoad(load);
  if (!n) return 0;
  if (n.interference === 'high' && n.sessionsPerWeek >= 4) return 1;
  if (n.interference === 'medium' && n.sessionsPerWeek >= 5) return 1;
  if (outsideWeeklyLoad(n) >= 1800) return 1;
  return 0;
}

/** Полные метрики */
export function computeOutsideMetrics(load: OutsideLoad | null | undefined): OutsideLoadMetrics | null {
  const n = normalizeOutsideLoad(load);
  if (!n) return null;
  const wl = outsideWeeklyLoad(n);
  const vm = outsideVolumeMultiplier(n);
  const fp = outsideFrequencyPenalty(n);
  const rationale: string[] = [];
  rationale.push(`Вне зала: ${n.sessionsPerWeek}×/нед × ${n.avgDurationMin} мин × RPE ${n.avgSRPE} = ${wl} load`);
  rationale.push(`Интерференция: ${n.interference} → объём зала ×${vm}`);
  if (fp) rationale.push('Частота ног/тяги снижена: внешняя нагрузка высокая');
  if (n.highIntensityDays && n.highIntensityDays.length) {
    rationale.push(`Нагрузочные дни вне зала: ${n.highIntensityDays.map(d => ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d]).join(', ')} — тяж. зал не ставим накануне`);
  }
  return {
    weeklyLoad: wl,
    dailyAvgLoad: Math.round(wl / 7),
    volumeMultiplier: vm,
    frequencyPenalty: fp,
    highDays: n.highIntensityDays || [],
    interference: n.interference as OutsideInterference,
    rationale,
  };
}

/** Конфликт дня зала с внешним high-днём (за день до) */
export function isDayConflictWithOutside(dayIndex: number, outside: OutsideLoad | null | undefined): boolean {
  const n = normalizeOutsideLoad(outside);
  if (!n || !n.highIntensityDays?.length) return false;
  // если завтра — high вне зала, сегодня тяж ног/спины нежелателен
  const tomorrow = (dayIndex + 1) % 7;
  return n.highIntensityDays.includes(tomorrow);
}

/** Подсказка для UI */
export function outsideLoadSummary(load: OutsideLoad | null | undefined): string {
  const m = computeOutsideMetrics(load);
  if (!m) return 'Вне зала: нет данных — объём зала 100%';
  return `Вне зала ${m.weeklyLoad} load/нед → объём зала ×${m.volumeMultiplier}${m.frequencyPenalty ? ' · частота ↓' : ''}`;
}

/** Дефолты по дисциплинам */
export function defaultOutsideLoadFor(discipline: string): OutsideLoad | null {
  const d = (discipline || '').toLowerCase();
  if (d === 'boxing' || d === 'бокс') return { sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7, type: 'ring', interference: 'high', highIntensityDays: [1, 3, 5] };
  if (d === 'mma' || d === 'мма') return { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 7.5, type: 'mat', interference: 'high', highIntensityDays: [1, 2, 4] };
  if (d === 'wrestling' || d === 'борьба') return { sessionsPerWeek: 5, avgDurationMin: 90, avgSRPE: 7, type: 'mat', interference: 'high', highIntensityDays: [0, 2, 4] };
  if (d === 'kickboxing' || d === 'кик') return { sessionsPerWeek: 4, avgDurationMin: 90, avgSRPE: 7, type: 'ring', interference: 'high', highIntensityDays: [1, 3, 5] };
  if (d === 'weightlifting' || d === 'та' || d === 'тяжелая') return { sessionsPerWeek: 1, avgDurationMin: 60, avgSRPE: 5, type: 'field', interference: 'low', highIntensityDays: [] };
  if (d === 'strongman' || d === 'стронг') return { sessionsPerWeek: 1, avgDurationMin: 90, avgSRPE: 6, type: 'field', interference: 'low', highIntensityDays: [] };
  return null;
}
