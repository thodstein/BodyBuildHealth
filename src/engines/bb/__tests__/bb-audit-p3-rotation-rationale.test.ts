/**
 * Аудит 2026-11 (продолжение P3-7): строки «⚠ Ротация: …» в rationale.
 *
 * Было: `rotation.issues.slice(0, 20)` в порядке выдачи анализатора — сначала
 * шли локальные повторы угла изоляции по мышцам в порядке недель, поэтому в
 * плане с 41 замечанием методическая строка «нет ротации весь план» и смена
 * базы внутри фазы в текст не попадали вовсе, а пользователь видел 20 почти
 * одинаковых строк про изоляцию.
 *
 * Стало: приоритет (смена базы → нет ротации весь план → локальный повтор),
 * предел 20 на все строки и честная строка «…и ещё N предупреждений».
 */
import { describe, expect, it } from 'vitest';
import {
  ROTATION_LINE_PREFIX,
  ROTATION_RATIONALE_LIMIT,
  rotationRationaleLines,
  refreshBBPlanSnapshots,
} from '../bb-plan-snapshot.engine';

const MUSCLES = [
  'chest', 'back', 'quads', 'hamstrings', 'shoulders',
  'biceps', 'triceps', 'glutes', 'calves', 'abs',
  'traps', 'forearms', 'adductors', 'abductors', 'lower_back', 'serratus',
];

const GROUP_OF: Record<string, string> = {
  chest: 'chest', back: 'back', quads: 'legs', hamstrings: 'legs',
  shoulders: 'shoulders', biceps: 'arms', triceps: 'arms',
  glutes: 'legs', calves: 'legs', abs: 'core',
  traps: 'traps', forearms: 'arms', adductors: 'legs', abductors: 'legs',
  lower_back: 'back', serratus: 'core',
};

function accessory(muscle: string, name: string) {
  return {
    muscle,
    name,
    group: GROUP_OF[muscle],
    type: 'isolation',
    role: 'accessory',
    character: 'памп',
    sets: 2,
    workSets: [
      { reps: 12, rir: 3, weight: 15 },
      { reps: 12, rir: 3, weight: 15 },
    ],
  };
}

function primary(muscle: string, name: string) {
  return {
    muscle,
    name,
    group: GROUP_OF[muscle],
    type: 'compound',
    role: 'primary',
    sets: 3,
    workSets: [
      { reps: 8, rir: 2, weight: 60 },
      { reps: 8, rir: 2, weight: 60 },
      { reps: 8, rir: 2, weight: 60 },
    ],
  };
}

/** 6 недель, три фазы по 2 недели: изоляция каждой мышцы повторяется в каждой
 *  фазе (3×16 замечаний, но текст по мышце одинаков → после схлопывания дублей
 *  16), у всех мышц один и тот же паттерн на весь план (16 «нет ротации»), а
 *  смена базы стоит ПОСЛЕДНЕЙ в порядке анализатора. */
function makePlan() {
  const phases = ['accumulation', 'accumulation', 'peaking', 'peaking', 'intensification', 'intensification'];
  const weeks = phases.map((phase, index) => {
    const week = index + 1;
    const exercises: any[] = MUSCLES.map(m => accessory(m, `Изоляция ${m}`));
    if (week === 5) exercises.push(primary('abs', 'Скручивания с весом (база A)'));
    if (week === 6) exercises.push(primary('abs', 'Скручивания с весом (база B)'));
    return { week, phase, sessions: [{ day: 1, exercises }] };
  });
  return {
    pattern: {},
    rationale: [] as string[],
    weeks,
    priorityMuscles: [] as string[],
  } as any;
}

const rotationLines = (plan: any): string[] =>
  ((plan.rationale || []) as string[]).filter(line => String(line).startsWith(ROTATION_LINE_PREFIX));

describe('P3-7 (ротация): приоритет, предел и честный счётчик', () => {
  it('снимок: методическое «нет ротации» не вытесняется 20 локальными повторами', () => {
    const plan = makePlan();
    refreshBBPlanSnapshots(plan, { refreshRotationRationale: true });

    const issues = plan.rotationReport.issues as any[];
    // Фикстура хуже прежнего предела: в порядке анализатора «no_accessory_rotation»
    // стоит после 48 повторов, а всего замечаний — 65.
    expect(issues.length).toBeGreaterThan(ROTATION_RATIONALE_LIMIT + 10);
    const analyzerOrder = issues.findIndex((issue: any) => issue.code === 'no_accessory_rotation');
    expect(analyzerOrder).toBeGreaterThanOrEqual(ROTATION_RATIONALE_LIMIT);

    const lines = rotationLines(plan);
    // Предел 20 строк + честная строка о скрытом.
    expect(lines.length).toBe(ROTATION_RATIONALE_LIMIT + 1);
    expect(lines[0]).toContain('нет ротации изоляции');
    expect(lines[lines.length - 1]).toMatch(/…и ещё \d+ предупреждени/);
    // Дубли (одна и та же претензия в разных фазах) в «ещё N» не считаются.
    const uniqueNonPrimary = new Set(issues
      .filter((issue: any) => issue.code !== 'primary_changed')
      .map((issue: any) => `${issue.code}|${issue.message}`)).size;
    expect(uniqueNonPrimary).toBeGreaterThan(ROTATION_RATIONALE_LIMIT);
    const hidden = uniqueNonPrimary - ROTATION_RATIONALE_LIMIT;
    expect(lines[lines.length - 1]).toContain(`…и ещё ${hidden} `);
  });

  it('помощник: смена базы внутри фазы — первой, скрытое посчитано честно', () => {
    const issues = [
      ...Array.from({ length: 20 }, (_, i) => ({
        code: 'accessory_repeated', muscle: `m${i}`, phase: 'accumulation',
        message: `Мышца ${i}: паттерн изоляции повторяется подряд.`,
      })),
      { code: 'no_accessory_rotation', muscle: 'calves', message: 'Икры: нет ротации изоляции.' },
      { code: 'primary_changed', muscle: 'chest', phase: 'peaking', message: 'Грудь: основное движение сменилось внутри фазы.' },
    ];
    const lines = rotationRationaleLines(issues, ROTATION_LINE_PREFIX);
    expect(lines[0]).toBe(`${ROTATION_LINE_PREFIX} Грудь: основное движение сменилось внутри фазы.`);
    expect(lines[1]).toBe(`${ROTATION_LINE_PREFIX} Икры: нет ротации изоляции.`);
    expect(lines.length).toBe(ROTATION_RATIONALE_LIMIT + 1);
    expect(lines[lines.length - 1]).toContain('…и ещё 2 ');
  });

  it('идемпотентен: повторный снимок не плодит и не теряет строки', () => {
    const plan = makePlan();
    refreshBBPlanSnapshots(plan, { refreshRotationRationale: true });
    const first = rotationLines(plan);
    refreshBBPlanSnapshots(plan, { refreshRotationRationale: true });
    expect(rotationLines(plan)).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('не дублирует одинаковые замечания и не считает дубли в «ещё N»', () => {
    const same = { code: 'accessory_repeated', message: 'Руки: поворот', muscle: 'biceps', phase: 'accumulation' };
    const issues = [
      same,
      { ...same },
      { code: 'no_accessory_rotation', message: 'Икры: нет ротации', muscle: 'calves' },
    ];
    const lines = rotationRationaleLines(issues, ROTATION_LINE_PREFIX);
    expect(lines).toEqual([
      `${ROTATION_LINE_PREFIX} Икры: нет ротации`,
      `${ROTATION_LINE_PREFIX} Руки: поворот`,
    ]);
  });

  it('один общий предел: строки, оставленные финализатором, съедают место у прочих', () => {
    const plan = makePlan();
    refreshBBPlanSnapshots(plan, { refreshRotationRationale: true });
    const primaryIssue = (plan.rotationReport.issues as any[])
      .find((issue: any) => issue.code === 'primary_changed');
    const primaryLine = `${ROTATION_LINE_PREFIX} ${primaryIssue.message}`;
    // Финализатор решил показать смену базы (reorder=false) — снимок её сохраняет
    // и срезает столько же локальных строк, чтобы список не разрастался.
    const plan2 = makePlan();
    plan2.rationale = [primaryLine];
    refreshBBPlanSnapshots(plan2, { refreshRotationRationale: true });
    const lines = rotationLines(plan2);
    expect(lines[0]).toBe(primaryLine);
    expect(lines.filter(line => line === primaryLine).length).toBe(1);
    expect(lines.length).toBe(ROTATION_RATIONALE_LIMIT + 1);
  });
});
