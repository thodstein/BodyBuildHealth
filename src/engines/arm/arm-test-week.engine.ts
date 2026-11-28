/**
 * arm-test-week.engine.ts — тестовая неделя (аудит 2026-11, roadmap P1-7).
 *
 * Проблема: бенчмарки (`arm-benchmarks`) считаются, но план никогда не планирует
 * замеры — прогресс виден только по дневнику, а workMax остаётся ручным.
 *
 * Решение: раз в N недель (по умолчанию 8) в РАБОЧУЮ неделю добавляется короткий
 * тестовый блок (5ПМ кисти, холды пронации/бокового, сингл RT). Это практика
 * калибровки (RIR/RPE-шкала Zourdos 2016), не медицинское предписание; объём
 * намеренно малый (1–2 сета), чтобы не ломать недельный план.
 *
 * Модуль чистый: правит копию плана, не читает localStorage.
 */
import type { ArmExercise, ArmPlan } from './arm-types';
import { perExerciseCap, sessionLimitsForArm } from './arm-volume.engine';

export interface ArmTestWeekOptions {
  every?: number; // 0 = выключено
  level?: string;
  /** Цель плана: в endurance добавляется 5-й замер (3×20 с). */
  goal?: string;
  /** Явные номера недель (например, калибровочная неделя 1) — приоритетнее every. */
  targets?: number[];
}

export interface ArmTestWeekResult {
  plan: ArmPlan;
  applied: number;
  notes: string[];
}

/** Номера тестовых недель (8, 16, 24 …) в пределах плана. */
export function planArmTestWeeks(weeks: number, every = 8): number[] {
  const total = Math.max(0, Math.round(Number(weeks) || 0));
  const step = Math.round(Number(every) || 0);
  if (step <= 0) return [];
  const out: number[] = [];
  for (let w = step; w <= total; w += step) out.push(w);
  return out;
}

/**
 * Тестовый блок: 4 замера (5-й — энда-холд в endurance-цели), малый объём.
 * Вес 0 — пользователь вводит фактический, движок не выдумывает килограммы.
 */
export function buildArmTestExercises(level = 'intermediate', opts: { goal?: string } = {}): ArmExercise[] {
  const lvl = String(level || 'intermediate').toLowerCase();
  const hard = lvl === 'advanced' || lvl === 'enhanced';
  const base = (muscle: string, name: string, sets: number, reps: number, holdSeconds?: number): ArmExercise => ({
    muscle: muscle as any,
    name,
    role: 'accessory',
    character: 'техника',
    sets,
    repsRange: [reps, reps],
    rir: hard ? 1 : 2,
    workSets: Array.from({ length: sets }, () => ({
      reps,
      rir: hard ? 1 : 2,
      weight: 0,
      restSeconds: holdSeconds ? 120 : 150,
      ...(holdSeconds ? { holdSeconds } : {}),
    })),
    isStatic: !!holdSeconds,
    holdSeconds,
    movementPattern: 'test' as any,
    substitutionGroup: 'test',
    loadMode: 'tool',
    provenance: 'diagnostic',
    provenanceSource: 'arm-test-week',
    comment: '🧪 Тест: записать фактический вес/время — это калибровка workMax.',
  });
  const core = [
    base('wrist_flexors', 'Тест: сгибание кисти 5ПМ', 2, 5),
    base('pronators', 'Тест: пронация — холд', 1, 1, 15),
    base('side_pressure', 'Тест: боковое — холд', 1, 1, 10),
    base('grip_support', 'Тест: Rolling Thunder — сингл', 1, 1),
  ];
  // Endurance-цель: пятый замер — «долгая схватка» 3×20 с изометрия.
  // Это практика клуба, а НЕ валидированный тест: число не выдаётся за норму.
  if (String(opts.goal || '').toLowerCase() === 'endurance') {
    core.push({
      ...base('side_pressure', 'Тест: долгая схватка — 3×20 с изометрия', 3, 1, 20),
      comment: '🧪 Энда-тест (практика, не валидирован): 3×20 с изометрия в рабочей позиции — записать вес/время.',
    });
  }
  return core;
}

/**
 * Вставляет тестовый блок в рабочую неделю ближе к цели (если целевая неделя
 * делод/тейпер/пик — берём последнюю рабочую перед ней). Тесты не идут в
 * делод/тейпер/пик.
 */
export function injectArmTestWeek(plan: ArmPlan, opts: ArmTestWeekOptions = {}): ArmTestWeekResult {
  const result: ArmTestWeekResult = { plan, applied: 0, notes: [] };
  const copy: ArmPlan = {
    ...plan,
    weeks: plan.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s, exercises: [...s.exercises] })) })),
  };
  result.plan = copy;
  if ((copy as any)._testWeekApplied) return result;
  (copy as any)._testWeekApplied = true;

  const targets =
    Array.isArray(opts.targets) && opts.targets.length
      ? opts.targets.map((w) => Math.round(Number(w) || 0)).filter((w) => w >= 1 && w <= copy.weeks.length)
      : planArmTestWeeks(copy.weeks.length, opts.every ?? 8);
  if (targets.length === 0) return result;
  const level = String(opts.level || copy.level || 'intermediate');
  const template = buildArmTestExercises(level, { goal: opts.goal || String((copy as any).goal || '') });

  const isWorking = (w: any): boolean => !w.deload && !w.taper && w.phase !== 'deload' && w.phase !== 'peaking';
  for (const target of targets) {
    // Целевая неделя, иначе последняя рабочая перед ней (не дальше 2 недель).
    let wk = copy.weeks.find((w) => w.week === target && isWorking(w));
    if (!wk) {
      for (let back = 1; back <= 2 && !wk; back++) {
        wk = copy.weeks.find((w) => w.week === target - back && isWorking(w));
      }
    }
    if (!wk) {
      result.notes.push(`🧪 Тест Н${target}: рабочей недели рядом нет — тест не вставлен.`);
      continue;
    }
    // Тестовый блок — отдельная сессия «Test» (4 упражнения, 5 сетов): не отнимает
    // место у рабочих сессий и не зависит от их заполненности.
    let added = 0;
    const block: typeof template = [];
    const skippedTests: string[] = [];
    for (const ex of template) {
      // Не переполняем MRV мышцы тестовыми сетами (учитываем уже принятые замеры).
      let weekly = block.filter((b) => b.muscle === ex.muscle).reduce((a, b) => a + (Number(b.sets) || 0), 0);
      for (const s of wk.sessions) for (const e of s.exercises) if (e.muscle === ex.muscle) weekly += e.sets;
      const mrv = Number(copy.mrvByMuscle?.[ex.muscle] ?? 99);
      if (weekly + ex.sets > mrv) {
        skippedTests.push(`${ex.name}: MRV ${ex.muscle} (${weekly}+${ex.sets}>${mrv})`);
        continue;
      }
      if (ex.sets > perExerciseCap(String(ex.muscle), level)) {
        skippedTests.push(`${ex.name}: per-exercise cap ${ex.muscle}`);
        continue;
      }
      block.push({ ...ex });
      added++;
    }
    if (skippedTests.length) {
      result.notes.push(`🧪 Тест Н${wk.week}: пропущено — ${skippedTests.join('; ')}.`);
    }
    if (block.length > 0) {
      const limits = sessionLimitsForArm({ level, discipline: copy.discipline, sessionTag: 'Test' });
      // Свободный день недели: Test не должен делить номер дня с рабочей сессией
      // (два блока «День 7» в печати, review 2026-11).
      const usedDays = new Set(wk.sessions.map((s) => Number(s.day) || 0));
      let day = 0;
      for (let d = 1; d <= 7; d++) {
        if (!usedDays.has(d)) {
          day = d;
          break;
        }
      }
      if (!day) day = Math.min(7, Math.max(0, ...wk.sessions.map((s) => Number(s.day) || 0)) + 1);
      wk.sessions.push({
        day,
        weekOffset: wk.week - 1,
        character: 'техника',
        sessionTag: 'Test',
        tableTime: false,
        exercises: block.slice(0, limits.maxExercises),
        note: '🧪 Тест: замеры для калибровки workMax (малый объём, не до отказа).',
      });
      added = Math.min(added, limits.maxExercises);
      wk.note =
        `${wk.note ? `${wk.note} ` : ''}🧪 Тестовая неделя: ${added} замер(ов) — запишите факт для калибровки.`.trim();
      result.applied += added;
      result.notes.push(`🧪 Тест Н${wk.week}: ${added} замера (сессия Test).`);
    } else {
      result.notes.push(`🧪 Тест Н${wk.week}: MRV/лимит не позволяют — тест не вставлен.`);
    }
  }
  return result;
}
