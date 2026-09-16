/**
 * bb-bench-screen.engine.ts — скрининг жима лёжа для бодибилдинга (чистые функции, без стора).
 *
 * Канон: Noteboom 2024 Front Physiol (10 опытных атлетов, 21 вариация, OpenSim):
 *  - хват <1.5 биакромиальных ширин (BAW) снижает АК-компрессию и задний шир GH;
 *  - 2 BAW — максимум суставных нагрузок (trade-off «вес vs риск»);
 *  - 1 BAW повышает верхний шир GH (слишком узко — локти/манжета);
 *  - ретракция лопатки снижает задний шир и активность манжеты.
 * Клинический ориентир (GRSM 2025): хват ≤1.5×ширины плеч; локти не ниже скамьи.
 *
 * Скрининг техники, НЕ диагноз и не лечение боли: боль → техника + боль-мониторинг (R2), >2 нед — врач.
 */

export const BENCH_GRIP_BAW_MAX = 1.5;
export const BENCH_GRIP_BAW_MIN = 1.2;

export type BenchTouchPoint = 'nipple' | 'upper_abs' | 'neck';
export type BenchScapula = 'retracted' | 'neutral' | 'released';
export type BenchLevel = 'ok' | 'watch' | 'fix' | 'not_tested';

export interface BenchScreenInput {
  gripCm?: number | null;
  biacromialCm?: number | null;
  /** Если BAW посчитан вне (например, из профиля) — приоритетнее пары см. */
  gripBaw?: number | null;
  touchPoint?: BenchTouchPoint | '' | null;
  scapula?: BenchScapula | '' | null;
  /** Угол отведения плеча (градусы, ориентир 45–70° по Noteboom). */
  abductionDeg?: number | null;
  /** true = локоть уходит ниже скамьи (провал). */
  elbowsBelowBench?: boolean;
  pain?: boolean;
}

export interface BenchScreenVerdict {
  tested: boolean;
  level: BenchLevel;
  gripBaw: number | null;
  /** Замечания уровня watch (не требуют срочной правки). */
  issues: string[];
  /** Правки уровня fix (сделать в первую очередь). */
  fixes: string[];
  text: string;
}

export const BENCH_DISCLAIMER =
  'Скрининг техники жима по биомеханике (Noteboom 2024): хват ≤1.5 ширины плеч снижает нагрузку на плечо/АК; это не диагноз и не лечение боли';

const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

/** Хват в биакромиальных ширинах (BAW). null — не хватает данных. */
export function benchGripBaw(gripCm?: number | null, biacromialCm?: number | null): number | null {
  const g = finite(gripCm);
  const b = finite(biacromialCm);
  if (g == null || b == null || g <= 0 || b <= 0) return null;
  return Math.round((g / b) * 100) / 100;
}

export function benchScreenVerdict(s: BenchScreenInput): BenchScreenVerdict {
  const issues: string[] = [];
  const fixes: string[] = [];
  const gripCm = finite(s.gripCm);
  const baw = finite(s.gripBaw) ?? benchGripBaw(s.gripCm, s.biacromialCm);
  const hasAny =
    baw != null || gripCm != null || !!s.touchPoint || !!s.scapula ||
    finite(s.abductionDeg) != null || !!s.elbowsBelowBench || !!s.pain;

  if (!hasAny) {
    return { tested: false, level: 'not_tested', gripBaw: null, issues: [], fixes: [], text: 'Жим: не проверялся' };
  }

  // ── Хват (BAW) ──
  if (baw != null) {
    if (baw > BENCH_GRIP_BAW_MAX) {
      fixes.push(`Хват ${baw} BAW (>1.5) — сузь до 1.2–1.5: меньше компрессия АК и задний шир манжеты (Noteboom 2024)`);
    } else if (baw < 1.0) {
      fixes.push(`Хват ${baw} BAW (<1.0) — слишком узко: верхний шир GH и нагрузка на локти; цель 1.2–1.5`);
    } else if (baw < BENCH_GRIP_BAW_MIN) {
      issues.push(`Хват ${baw} BAW — на границе узкого: следи за локтями, ориентир 1.2–1.5`);
    }
  } else if (gripCm != null) {
    issues.push('Хват: ширина плеч не введена — BAW не посчитан (введи плечи в «Пропорциях»)');
  }

  // ── Точка касания ──
  if (s.touchPoint === 'neck') {
    fixes.push('Касание у шеи — смести на линию сосков/нижней груди (стресс переднего плеча и АК)');
  } else if (s.touchPoint === 'upper_abs') {
    issues.push('Касание высоко на животе — ок при арке, но проверь отведение локтей 45–70°');
  }

  // ── Лопатки ──
  if (s.scapula === 'released') {
    fixes.push('Лопатки не сведены (released) — сведи и опусти: меньше задний шир GH и активность манжеты (Noteboom 2024)');
  } else if (s.scapula === 'neutral') {
    issues.push('Лопатки нейтрально — для жима сведи стабильно и держи на протяжении сета');
  }

  // ── Отведение ──
  const abd = finite(s.abductionDeg);
  if (abd != null) {
    if (abd > 80) issues.push(`Отведение плеча ${abd}° (>80) — момент на плечо растёт: держи ~45–70°`);
    else if (abd > 0 && abd < 30) issues.push(`Отведение ${abd}° (<30) — узко: больше локти/трицепс, проверь комфорт локтя`);
  }

  // ── Локоть ниже скамьи ──
  if (s.elbowsBelowBench) {
    fixes.push('Локоть уходит ниже скамьи — плечо в уязвимой позиции: останови на уровне скамьи (без «добора» глубины)');
  }

  // ── Боль ──
  if (s.pain) {
    fixes.push('Боль в жиме: техника + правило боли (≤5/10 днём, <5 утра); вес не гнать, при >2 нед — врач');
  }

  const level: BenchLevel = fixes.length ? 'fix' : issues.length ? 'watch' : 'ok';
  const text = fixes.length
    ? `Жим: ${fixes[0]}${fixes.length > 1 ? ` (+${fixes.length - 1} правк.)` : ''}`
    : issues.length
      ? `Жим: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1})` : ''}`
      : 'Жим: хват и техника в ориентирах (≤1.5 BAW, лопатки сведены, локти не ниже скамьи)';
  return { tested: true, level, gripBaw: baw, issues, fixes, text };
}

/** Строки правок для моста/печати (fixes первыми, максимум 4). */
export function benchCorrections(v: BenchScreenVerdict): string[] {
  if (!v.tested) return [];
  return [...v.fixes, ...v.issues].slice(0, 4);
}
