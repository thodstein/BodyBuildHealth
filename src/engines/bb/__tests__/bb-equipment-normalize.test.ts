/**
 * Итерация N: оборудование на входе движка + отсутствие «выдуманных»
 * упражнений в плане.
 *
 * 1) Каталог использует единственное число (`dumbbell`, `band`), а UI/старые
 *    профили присылали `dumbbells`/`bands` — точное сравнение строк в фильтре
 *    пула означало, что «Резинки» молча не находили ни одного упражнения, а при
 *    единственном таком снаряде пул мышцы пустел.
 * 2) Когда пул пуст, билдер подставлял `{ name: muscle }` — в плане появлялась
 *    строка `delt_front`, которой нет в каталоге (валидатор ловил её как
 *    `equipment_unknown_exercise`). Теперь мышца честно остаётся без прямых
 *    упражнений в этой сессии.
 */
import { buildBBPlan } from '../bb-builder.engine';
import { normalizeEquipmentIds, equipmentAllows } from '../bb-equipment';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const CATALOG_NAMES = new Set((EXERCISE_CATALOG as any[]).map((e) => String(e.name || '')));

describe('normalizeEquipmentIds', () => {
  it('множественное число и локальные имена приводятся к именам каталога', () => {
    expect(normalizeEquipmentIds(['dumbbells', 'Bands', 'barbells', 'тренажёр'])).toEqual(['dumbbell', 'band', 'barbell', 'machine']);
  });

  it('дубли/пустые значения убираются, неизвестные сохраняются как есть', () => {
    expect(normalizeEquipmentIds(['dumbbell', 'Dumbbell', ' ', '', 'bench'])).toEqual(['dumbbell', 'bench']);
  });

  it('пустой вход — пустой список (без ограничений)', () => {
    expect(normalizeEquipmentIds(undefined)).toEqual([]);
    expect(normalizeEquipmentIds([])).toEqual([]);
  });

  it('equipmentAllows: bodyweight разрешён всегда, пустой список = без ограничений', () => {
    expect(equipmentAllows([], ['barbell'])).toBe(true);
    expect(equipmentAllows(['dumbbell'], ['bodyweight'])).toBe(true);
    expect(equipmentAllows(['dumbbell'], ['barbell'])).toBe(false);
    expect(equipmentAllows(['dumbbell'], ['dumbbell'])).toBe(true);
  });
});

describe('оборудование доезжает до пула', () => {
  it('«bands» и «band» дают одинаковый план', () => {
    const a: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM, equipment: ['bands', 'barbell', 'bodyweight'] });
    const b: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM, equipment: ['band', 'barbell', 'bodyweight'] });
    const names = (p: any) => p.weeks[0].sessions.map((s: any) => s.exercises.map((e: any) => e.name));
    expect(names(a)).toEqual(names(b));
  });

  it('«dumbbells» и «dumbbell» дают одинаковый план', () => {
    const a: any = buildBBPlan({ patternId: 'ppl_6', level: 'beginner', goal: 'mass', weeks: 1, workMax: WM, equipment: ['dumbbells', 'bodyweight'] });
    const b: any = buildBBPlan({ patternId: 'ppl_6', level: 'beginner', goal: 'mass', weeks: 1, workMax: WM, equipment: ['dumbbell', 'bodyweight'] });
    const names = (p: any) => p.weeks[0].sessions.map((s: any) => s.exercises.map((e: any) => e.name));
    expect(names(a)).toEqual(names(b));
  });
});

describe('в плане нет упражнений, которых нет в каталоге', () => {
  const equipVariants: Array<{ tag: string; equipment: string[] }> = [
    { tag: 'dumbbell', equipment: ['dumbbell', 'bodyweight'] },
    { tag: 'band', equipment: ['band'] },
    { tag: 'plate', equipment: ['plate', 'bodyweight'] },
    { tag: 'none', equipment: [] },
  ];

  it('каждое имя упражнения есть в каталоге (включая скудное оборудование)', () => {
    const splits = SPLIT_PATTERNS.filter((s) => ['fullbody_3', 'ppl_6'].includes(s.id));
    let checked = 0;
    for (const split of splits) {
      for (const eq of equipVariants) {
        const plan: any = buildBBPlan({ patternId: split.id, level: 'beginner', goal: 'mass', weeks: 1, workMax: WM, equipment: eq.equipment });
        for (const week of plan.weeks) {
          for (const session of week.sessions) {
            for (const ex of session.exercises) {
              if (ex.warmupActivator) continue;
              expect(CATALOG_NAMES.has(String(ex.name)), `${split.id}/${eq.tag}: «${ex.name}» нет в каталоге`).toBe(true);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 600000);

  it('имя упражнения никогда не равно имени мышцы', () => {
    for (const split of SPLIT_PATTERNS.slice(0, 6)) {
      const plan: any = buildBBPlan({ patternId: split.id, level: 'beginner', goal: 'mass', weeks: 1, workMax: WM, equipment: ['plate', 'bodyweight'] });
      for (const week of plan.weeks) {
        for (const session of week.sessions) {
          for (const ex of session.exercises) {
            expect(String(ex.name)).not.toBe(String(ex.muscle));
          }
        }
      }
    }
  }, 600000);
});
