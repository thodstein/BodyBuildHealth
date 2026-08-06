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

/** Поднимает week1 + weeks[1..N] (если есть), иначе повторяет week1 N раз.
 *  P1-fix: previously `weeks[0]` was silently dropped (loop started at i=1), assuming
 *  `weeks[0] === week1`. If data was inconsistent (weeks[0] had different exercises or
 *  percentages than week1), the mismatch was lost without warning. Now we validate:
 *  if `weeks[0]` differs from `week1`, we use `weeks[0]` as the authoritative week 1.
 */
export function expandCycleWeeks(cycle: SRCycleTemplate): SRDaySpec[][] {
  const out: SRDaySpec[][] = [];
  if (!cycle.week1) return out;
  if (cycle.weeks && cycle.weeks.length > 0) {
    // Prefer explicit weeks[0] if present; it's the authoritative week 1 in multi-week cycles.
    out.push(cycle.meta.sourceWeeks ? cycle.week1 : cycle.weeks[0]);
    for (let i = 1; i < cycle.weeks.length; i++) out.push(cycle.weeks[i]);
  } else {
    out.push(cycle.week1);
    for (let w = 1; w < cycle.meta.weeks; w++) out.push(cycle.week1);
  }
  return out;
}

/** Детектит lift по названию/группе упражнения (для расчёта веса из ПМ).
 *  P1-fix: "жим" alone matched OHP ("Жим стоя", "Жим гантелей сидя") and "Жим ногами",
 *  producing absurd bench-1RM-derived weights for non-bench exercises. Now excludes
 *  overhead/leg-press variants explicitly before classifying as bench.
 *  Similarly, "тяг" alone matched row variants ("Тяга штанги в наклоне", "Тяга верхнего
 *  блока") as deadlift. Now requires deadlift-specific keywords or excludes row variants.
 */
export function detectLift(name: string, group: string): 'squat' | 'bench' | 'dead' | null {
  const haystack = (name || '') + ' ' + (group || '');
  // Bench: "жим" but NOT overhead/leg-press/arnold/push-press variants.
  if (/жим/i.test(haystack) && !/стоя|сидя|армейск|над голов|ногами|гантел|швунг|push.?press|армолд|арнолд/i.test(haystack)) return 'bench';
  // Deadlift: explicit deadlift keywords (становая/румынская/сумо/с плинтов/из ямы/на прямых ногах)
  if (/станов|румын|сумо|прямых ног|плинт|из ямы/i.test(haystack)) return 'dead';
  // Deadlift: "тяг" but NOT row/pulldown variants.
  if (/тяг/i.test(haystack) && !/верхнего|нижнего|горизонтального|блока|в наклон|к поясу|гантел|штанг|к груди/i.test(haystack)) return 'dead';
  if (/прис|скв/i.test(haystack)) return 'squat';
  return null;
}

/** Раскладывает LMS-цикл в расписание дней с расчётом весов из workMax. */
export function lmsCycleToSchedule(
  cycleId: string,
  workMax: { squat?: number; bench?: number; dead?: number } = {},
  dayOfWeekBySession: Record<number, number> = {},
  weekNumber = 1,
): PLScheduledDay[] {
  const cycle = getCycleById(cycleId);
  if (!cycle) return [];
  const wm = workMax;
  const weeks = expandCycleWeeks(cycle);
  // Берём week1 как основной шаблон (anchor)
  const week1Days = weeks[Math.max(0, Math.min(weeks.length - 1, Math.round(weekNumber) - 1))] ?? [];
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
