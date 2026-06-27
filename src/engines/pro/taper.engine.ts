/**
 * taper.engine.ts — P9: scientific taper/peak (проф. уровень). REUSE P7 taperCurve.
 * Объём ↓40-60% за 1-3 нед (по усталости), удержание интенсивности, нейромышечный прайминг,
 * peak-week протокол: прикиды (opener/2nd/3rd), тайминг последних тяжёлых, план соревновательного дня.
 */
import { taperCurve, type TaperWeek } from "./mesocycle-progression.engine";

export type AttemptStrategy = "conservative" | "balanced" | "aggressive";
export type Lift = "squat" | "bench" | "deadlift";

export interface AttemptSet { lift: Lift; opener: number; second: number; third: number; target: number; rpeNote: string; }
export interface PeakWeekAttempts { squat: AttemptSet; bench: AttemptSet; deadlift: AttemptSet; strategy: AttemptStrategy; }

export interface TaperSession { dayName: string; focus: string; daysUntilMeet: number; exercises: { lift: Lift; percent: number; reps: number; sets: number; note: string }[]; }
export interface TaperPlan {
  meetDate: string;
  taperWeeks: number;
  taperCurve: TaperWeek[];
  weeks: { week: number; sessions: TaperSession[] }[];
  lastHeavyDays: Record<Lift, number>;
  attempts: PeakWeekAttempts;
  meetDayInstructions: string[];
}

function r1(v: number) { return Math.round(v * 10) / 10; }
function r05(v: number) { return Math.round(v * 20) / 20; }

/** Длительность taper по усталости: 1 (низкая) / 2 (средняя) / 3 (высокая). */
export function taperWeeksForFatigue(fatigue: number): number {
  if (fatigue >= 70) return 3;
  if (fatigue >= 45) return 2;
  return 1;
}

/** Последние тяжёлые движения: deadlift раньше всех (самое taxing), bench позднее всех. */
export const LAST_HEAVY_DAYS: Record<Lift, number> = { squat: 8, bench: 4, deadlift: 12 };

/** Прикиды соревновательного дня (% от текущего 1RM). */
export function peakWeekAttempts(
  current1RM: Record<Lift, number>,
  strategy: AttemptStrategy = "balanced"
): PeakWeekAttempts {
  const pct = strategy === "conservative"
    ? { opener: 0.90, second: 0.955, third: 1.00 }
    : strategy === "aggressive"
    ? { opener: 0.93, second: 0.97, third: 1.05 }
    : { opener: 0.92, second: 0.96, third: 1.02 };
  const mk = (lift: Lift): AttemptSet => ({
    lift,
    opener: r05(current1RM[lift] * pct.opener),
    second: r05(current1RM[lift] * pct.second),
    third: r05(current1RM[lift] * pct.third),
    target: r05(current1RM[lift] * pct.third),
    rpeNote: strategy === "conservative" ? "Надёжный PR или повторение" : strategy === "aggressive" ? "Агрессивный PR" : "Сбалансированный PR",
  });
  return { squat: mk("squat"), bench: mk("bench"), deadlift: mk("deadlift"), strategy };
}

/** Разминочная последовательность блинов под опенер (REUSE gym-competition можно; здесь упрощённо). */
export function warmupSequence(opener: number): { percent: number; weight: number; reps: number }[] {
  const steps = [0.40, 0.55, 0.70, 0.80, 0.90];
  return steps.map(p => ({ percent: p, weight: r05(opener * p), reps: p < 0.7 ? 5 : p < 0.85 ? 3 : 1 }));
}

/** Полный taper-план: объём/интенсивность из P7 taperCurve + сессии прайминга + прикиды. */
export function taperPlan(
  meetDate: string,
  current1RM: Record<Lift, number>,
  fatigue: number,
  strategy: AttemptStrategy = "balanced"
): TaperPlan {
  const taperWeeks = taperWeeksForFatigue(fatigue);
  const tc = taperCurve(taperWeeks, 0.90);
  const weeks: { week: number; sessions: TaperSession[] }[] = [];

  for (let w = 1; w <= taperWeeks; w++) {
    const tw = tc[w - 1];
    const isLast = w === taperWeeks;
    const sessions: TaperSession[] = [];
    // Сессия 1: интенсивность-удержание (squat/bench тяжёлые синглы early, lighter к концу)
    const heavyPct = isLast ? 0.75 : 0.85 + (taperWeeks - w) * 0.02;
    const daysUntil = (taperWeeks - w) * 7 + 3;
    sessions.push({
      dayName: `Taper нед${w} день 1`, focus: isLast ? "Прайминг" : "Удержание интенсивности", daysUntilMeet: daysUntil,
      exercises: [
        { lift: "squat", percent: r05(heavyPct), reps: isLast ? 2 : 1, sets: isLast ? 2 : 3, note: heavyPct >= 0.85 ? "Тяжёлый сингл, удержание ЦНС" : "Лёгкий прайминг" },
        { lift: "bench", percent: r05(heavyPct + 0.02), reps: isLast ? 2 : 1, sets: isLast ? 2 : 3, note: "Bench переносит нагрузку дольше" },
      ],
    });
    // Сессия 2: скоростная (DE) при низкой интенсивности
    if (!isLast) {
      sessions.push({
        dayName: `Taper нед${w} день 2`, focus: "Dynamic effort / скорость", daysUntilMeet: daysUntil - 3,
        exercises: [
          { lift: "squat", percent: 0.55, reps: 2, sets: 6, note: "Скорость, без отказов" },
          { lift: "bench", percent: 0.55, reps: 2, sets: 6, note: "Скорость" },
          { lift: "deadlift", percent: 0.60, reps: 2, sets: 4, note: "Лёгкая тяга, активация" },
        ],
      });
    } else {
      // meet-week: один короткий прайминг-сет за 2-3 дня
      sessions.push({
        dayName: `Taper нед${w} день 2 (за 2д)`, focus: "Прайминг ЦНС", daysUntilMeet: 2,
        exercises: [
          { lift: "squat", percent: 0.60, reps: 1, sets: 2, note: "Один подъём — активация" },
          { lift: "bench", percent: 0.60, reps: 1, sets: 2, note: "Один подъём" },
        ],
      });
    }
    weeks.push({ week: w, sessions });
  }

  const meetDayInstructions = [
    "За 2 дня: полное восстановление, сон 8-9ч, гидратация.",
    "За 1 день: лёгкая мобилизация, проверка инвентаря, взвешивание (если весовая категория).",
    "Соревновательный день: разминка по графику warmupSequence(opener), подходы строго по стратегии, питание между подходами (быстрые углеводы).",
  ];

  return {
    meetDate,
    taperWeeks,
    taperCurve: tc,
    weeks,
    lastHeavyDays: LAST_HEAVY_DAYS,
    attempts: peakWeekAttempts(current1RM, strategy),
    meetDayInstructions,
  };
}
