/**
 * lms-to-pl.ts — единая конвертация LMS-цикла в формат PL-программы/расписания.
 *
 * F4.4: до этого 4 разных места кода (manual-constructor.plLmsScheduleDays,
 * PLContextPanel, PLEditor immutable, Calc.mapper LMS) обрабатывали LMS-цикл
 * по-своему — с разной логикой explicit vs repeated weeks. Здесь — единый
 * источник правды.
 */
import type { SRDaySpec, SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import { getCycleById } from '../../data/lms-cycles/lms-cycle-index';

export interface PLScheduledDay {
  label: string;
  dowLabel: string;
  exercises: Array<{ name: string; muscleGroup: string; sets: Array<{ sets: number; reps: number; pct: number; weight: number; rir: number }> }>;
}

/** Поднимает week1 + weeks[1..N] (если есть), иначе повторяет week1 N раз. */
export function expandCycleWeeks(cycle: SRCycleTemplate): SRDaySpec[][] {
  const out: SRDaySpec[][] = [];
  if (!cycle.week1) return out;
  out.push(cycle.week1);
  if (cycle.weeks && cycle.weeks.length > 0) {
    for (let i = 1; i < cycle.weeks.length; i++) out.push(cycle.weeks[i]);
  } else {
    for (let w = 1; w < cycle.meta.weeks; w++) out.push(cycle.week1);
  }
  return out;
}

/** Детектит lift по названию/группе упражнения (для расчёта веса из ПМ). */
export function detectLift(name: string, group: string): 'squat' | 'bench' | 'dead' | null {
  const haystack = (name || '') + ' ' + (group || '');
  if (/жим/i.test(haystack)) return 'bench';
  if (/тяг|стан/i.test(haystack)) return 'dead';
  if (/прис|скв/i.test(haystack)) return 'squat';
  return null;
}

/** Раскладывает LMS-цикл в расписание дней с расчётом весов из workMax. */
export function lmsCycleToSchedule(
  cycleId: string,
  workMax: { squat?: number; bench?: number; dead?: number } = {},
  dayOfWeekBySession: Record<number, number> = {},
): PLScheduledDay[] {
  const cycle = getCycleById(cycleId);
  if (!cycle) return [];
  const wm = workMax;
  const weeks = expandCycleWeeks(cycle);
  // Берём week1 как основной шаблон (anchor)
  const week1Days = weeks[0] ?? [];
  return week1Days.map((day, idx) => {
    const dow = dayOfWeekBySession[idx] ?? idx;
    const dowLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return {
      label: `День ${idx + 1}`,
      dowLabel: dowLabels[dow % 7] ?? '',
      exercises: (day.exercises ?? []).map((e) => {
        const lift = detectLift(e.name, e.group);
        const pmVal = lift ? (wm[lift] ?? 0) : 0;
        return {
          name: e.name,
          muscleGroup: e.group ?? '',
          sets: (e.sets ?? []).map((st) => {
            const pct = st.pct ?? 0;
            const weight = pmVal > 0 ? Math.round((pmVal * pct) / 2.5) * 2.5 : 0;
            return {
              sets: st.sets ?? 1,
              reps: st.reps ?? 5,
              pct,
              weight,
              rir: st.rir ?? 2,
            };
          }),
        };
      }),
    };
  });
}
