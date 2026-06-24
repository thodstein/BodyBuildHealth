/**
 * lms-metrics.engine.ts — метрики тренировочной нагрузки по методикам LMS
 * (Фунтиков / Черняк / Бондаренко), восстановленные из cell-формул cycle1.xlsm (Этап A0/A2).
 *
 * Восстановленные формулы (cell references cycle1, лист "1 в день"):
 *  - Тоннаж (AE)  = (Σ по подходам: вес×пов×под) × Множ(F)
 *  - КПШ (AJ)     = Σ по подходам: пов×под
 *  - Средний вес (AF) = Тоннаж / КПШ
 *  - Инт.отн (AG) = Средний вес / (PM × Множ)            (относительная интенсивность)
 *  - Инт.Ф+Б (AI) = Σ по подходам: k(вес/PM) × вес × пов × под × Множ × Коэф(E),
 *                   где k — коэффициент Фунтикова (таблица %1RM → k, лист "F" A1:B101)
 *  - УОИ (E-агрегат) = Σ(КПШ × Коэф.тяжести) / ΣКПШ       (усреднённая относительная интенсивность)
 *  - PM (AH)      = предельный максимум упражнения (вход, с недельной прогрессией — lms-progression)
 *
 * Примечание: 2D-таблица Бонданенко (F!P21:AB33, %1RM×Коэф→коэф) в cycle1 пуста —
 * соответствующая метрика (AK) не используется; Инт.Ф+Б считается через 1D таблицу Фунтикова.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Таблица Фунтикова: %1RM (0..1) → коэффициент интенсивности k (0..25).
// Восстановлена из листа "F" (A1:B101) cycle1.xlsm.
// ═══════════════════════════════════════════════════════════════════════════
export const FUNCTIKOV_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0, -0.001], [0.01, 0], [0.02, 0.001], [0.03, 0.002], [0.04, 0.003], [0.05, 0.004],
  [0.06, 0.005], [0.07, 0.006], [0.08, 0.007], [0.09, 0.008], [0.1, 0.009], [0.11, 0.01],
  [0.12, 0.011], [0.13, 0.012], [0.14, 0.015], [0.15, 0.018], [0.16, 0.021], [0.17, 0.024],
  [0.18, 0.027], [0.19, 0.03], [0.2, 0.03], [0.21, 0.04], [0.22, 0.05], [0.23, 0.06],
  [0.24, 0.07], [0.25, 0.08], [0.26, 0.09], [0.27, 0.1], [0.28, 0.11], [0.29, 0.12],
  [0.3, 0.13], [0.31, 0.14], [0.32, 0.16], [0.33, 0.18], [0.34, 0.2], [0.35, 0.22],
  [0.36, 0.24], [0.37, 0.26], [0.38, 0.28], [0.39, 0.3], [0.4, 0.32], [0.41, 0.34],
  [0.42, 0.36], [0.43, 0.38], [0.44, 0.4], [0.45, 0.42], [0.46, 0.44], [0.47, 0.46],
  [0.48, 0.47], [0.49, 0.48], [0.5, 0.5], [0.51, 0.51], [0.52, 0.53], [0.53, 0.54],
  [0.54, 0.56], [0.55, 0.58], [0.56, 0.6], [0.57, 0.62], [0.58, 0.65], [0.59, 0.68],
  [0.6, 0.7], [0.61, 0.71], [0.62, 0.73], [0.63, 0.75], [0.64, 0.78], [0.65, 0.8],
  [0.66, 0.82], [0.67, 0.84], [0.68, 0.87], [0.69, 0.89], [0.7, 0.9], [0.71, 0.95],
  [0.72, 1], [0.73, 1.07], [0.74, 1.14], [0.75, 1.2], [0.76, 1.27], [0.77, 1.34],
  [0.78, 1.4], [0.79, 1.47], [0.8, 1.53], [0.81, 1.6], [0.82, 1.67], [0.83, 1.74],
  [0.84, 1.82], [0.85, 1.9], [0.86, 2.05], [0.87, 2.2], [0.88, 2.4], [0.89, 2.6],
  [0.9, 2.8], [0.91, 3], [0.92, 3.2], [0.93, 3.6], [0.94, 4], [0.95, 4.5], [0.96, 5],
  [0.97, 7.5], [0.98, 12], [0.99, 18], [1, 25],
];

/** Коэффициент Фунтикова для доли от 1RM (линейная интерполяция таблицы). */
export function functikovCoefficient(pct1RM: number): number {
  const p = Math.max(0, Math.min(1, pct1RM));
  for (let i = 0; i < FUNCTIKOV_TABLE.length - 1; i++) {
    const [x0, y0] = FUNCTIKOV_TABLE[i];
    const [x1, y1] = FUNCTIKOV_TABLE[i + 1];
    if (p >= x0 && p <= x1) {
      if (x1 === x0) return y0;
      return y0 + ((y1 - y0) * (p - x0)) / (x1 - x0);
    }
  }
  const last = FUNCTIKOV_TABLE[FUNCTIKOV_TABLE.length - 1];
  return p >= last[0] ? last[1] : FUNCTIKOV_TABLE[0][1];
}

// ═══════════════════════════════════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════════════════════════════════

/** Один рабочий подход: вес (кг), повторения, подходы (количество). */
export interface SRSet {
  weight: number; // фактический/расчётный вес (кг)
  reps: number;   // повторения
  sets: number;   // количество подходов с этими параметрами
}

/** Группа упражнения (классификация LMS): ЖМ/ПР/ТГ/Ср/... */
export type SRGroup = 'ЖМ' | 'ПР' | 'ТГ' | 'Ср' | string;

/** Упражнение в тренировочном дне СРЦ. */
export interface SRExercise {
  name: string;
  group: SRGroup;          // группа (ЖМ=жимовые, ПР=приседания, ТГ=тягловые, Ср=средние)
  coef: number;            // Коэф. тяжести (одно-/многосуставное): 1.2 / 1.0 / 0.3 ...
  mnosz: number;           // Множ (множитель нагрузки): обычно 1
  pm: number;              // предельный максимум упражнения (кг)
  sets: SRSet[];           // рабочие подходы
  load?: 'Тяжелая' | 'Средняя' | 'Легкая'; // Нагрузка дня
}

export interface SRExerciseMetrics {
  tonnage: number;   // Тоннаж (кг)
  kpsh: number;      // КПШ (количество подъёмов штанги)
  avgWeight: number; // Средний вес (кг)
  relIntensity: number;  // Инт.отн (Черняк) = ср.вес / (PM × Множ)
  intFB: number;     // Инт.Ф+Б (Фунтиков+Бондаренко)
  uoiContribution: number; // КПШ × Коэф (вклад в УОИ)
}

// ═══════════════════════════════════════════════════════════════════════════
// Расчёт по упражнению
// ═══════════════════════════════════════════════════════════════════════════

/** Тоннаж упражнения = (Σ вес×пов×под) × Множ. */
export function calcTonnage(ex: SRExercise): number {
  const raw = ex.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0) * (st.sets || 0), 0);
  return raw * (ex.mnosz ?? 1);
}

/** КПШ упражнения = Σ пов×под (без Множ — raw подъёмы). */
export function calcKPSH(ex: SRExercise): number {
  return ex.sets.reduce((s, st) => s + (st.reps || 0) * (st.sets || 0), 0);
}

/** Средний вес = Тоннаж / КПШ. */
export function calcAvgWeight(ex: SRExercise): number {
  const kpsh = calcKPSH(ex);
  if (kpsh <= 0) return 0;
  return calcTonnage(ex) / kpsh;
}

/** Инт.отн (Черняк) = Средний вес / (PM × Множ). */
export function calcRelIntensity(ex: SRExercise): number {
  const denom = (ex.pm || 0) * (ex.mnosz ?? 1);
  if (denom <= 0) return 0;
  return calcAvgWeight(ex) / denom;
}

/** Инт.Ф+Б = Σ k(вес/PM) × вес × пов × под × Множ × Коэф. */
export function calcFunctikovBondarenko(ex: SRExercise): number {
  if (!ex.pm || ex.pm <= 0) return 0;
  const mnosz = ex.mnosz ?? 1;
  const coef = ex.coef ?? 1;
  let sum = 0;
  for (const st of ex.sets) {
    const pct = (st.weight || 0) / ex.pm;
    const k = functikovCoefficient(pct);
    sum += k * (st.weight || 0) * (st.reps || 0) * (st.sets || 0);
  }
  return sum * mnosz * coef;
}

/** Полные метрики упражнения. */
export function calcExerciseMetrics(ex: SRExercise): SRExerciseMetrics {
  const tonnage = calcTonnage(ex);
  const kpsh = calcKPSH(ex);
  const avgWeight = kpsh > 0 ? tonnage / kpsh : 0;
  return {
    tonnage,
    kpsh,
    avgWeight,
    relIntensity: calcRelIntensity(ex),
    intFB: calcFunctikovBondarenko(ex),
    uoiContribution: kpsh * (ex.coef ?? 1),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Агрегаты (тренировочный день / микроцикл)
// ═══════════════════════════════════════════════════════════════════════════

export interface SRSessionMetrics {
  tonnage: number;
  kpsh: number;
  avgWeight: number;       // Тоннаж / КПШ по сессии
  relIntensity: number;    // Σ(Инт.отн × КПШ) / ΣКПШ (Черняк за тренировку)
  intFB: number;           // Σ Инт.Ф+Б
  uoi: number;             // УОИ = Σ(КПШ × Коэф) / ΣКПШ
  exerciseCount: number;
}

/** Метрики тренировочного дня (сессии). */
export function calcSessionMetrics(exercises: SRExercise[]): SRSessionMetrics {
  let tonnage = 0, kpsh = 0, relIntWeighted = 0, intFB = 0, uoiNum = 0;
  for (const ex of exercises) {
    const m = calcExerciseMetrics(ex);
    tonnage += m.tonnage;
    kpsh += m.kpsh;
    relIntWeighted += m.relIntensity * m.kpsh;
    intFB += m.intFB;
    uoiNum += m.uoiContribution;
  }
  return {
    tonnage,
    kpsh,
    avgWeight: kpsh > 0 ? tonnage / kpsh : 0,
    relIntensity: kpsh > 0 ? relIntWeighted / kpsh : 0,
    intFB,
    uoi: kpsh > 0 ? uoiNum / kpsh : 0,
    exerciseCount: exercises.length,
  };
}

export interface SRCycleMetrics {
  tonnage: number;
  kpsh: number;
  avgWeight: number;
  relIntensity: number;
  intFB: number;
  uoi: number;
  sessions: number;
  perSession: SRSessionMetrics[];
}

/** Метрики микроцикла (по списку сессий). */
export function calcCycleMetrics(sessions: SRExercise[][]): SRCycleMetrics {
  const perSession = sessions.map(s => calcSessionMetrics(s));
  let tonnage = 0, kpsh = 0, relIntWeighted = 0, intFB = 0, uoiNum = 0;
  for (const s of perSession) {
    tonnage += s.tonnage;
    kpsh += s.kpsh;
    relIntWeighted += s.relIntensity * s.kpsh;
    intFB += s.intFB;
    uoiNum += s.uoi * s.kpsh;
  }
  return {
    tonnage, kpsh,
    avgWeight: kpsh > 0 ? tonnage / kpsh : 0,
    relIntensity: kpsh > 0 ? relIntWeighted / kpsh : 0,
    intFB,
    uoi: kpsh > 0 ? uoiNum / kpsh : 0,
    sessions: sessions.length,
    perSession,
  };
}

/**
 * Время на тренировку (метод Бонданенко, приближение).
 * Из cycle1: коэффициенты 0.75 / 0.32 / 0.13 по зонам интенсивности.
 * Приближённая формула: время(мин) ≈ КПШ×k_зоны, k зависит от средней интенсивности.
 * Точная таблица в cycle1 неполная — используется как оценка.
 */
export function calcSessionTimeMinutes(session: SRSessionMetrics): number {
  // Зоны по Инт.отн: >0.8 → 0.13/подъём (тяж, длинный отдых), 0.6-0.8 → 0.32, <0.6 → 0.75
  const ri = session.relIntensity;
  const k = ri >= 0.8 ? 0.13 : ri >= 0.6 ? 0.32 : 0.75;
  return Math.round(session.kpsh * k);
}