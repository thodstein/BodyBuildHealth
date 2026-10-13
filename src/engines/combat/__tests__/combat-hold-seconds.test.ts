/**
 * combat-hold-seconds.test.ts — холд (удержание) перестал быть write-only.
 *
 * Дефект раунда: `CombatExercise.holdSeconds` / `CombatSet.holdSeconds` /
 * `UserSet.holdSeconds` во всех трёх контурах существовали и заполнялись движком,
 * но НИ ОДНА поверхность их не показывала и не редактировала:
 *   - CombatPlanView печатал «Сеты: 1×— RIR3 · 1×— RIR3» без секунд;
 *   - правка повторов шла через ПУСТУЮ ветку `if (/с|c/i.test(raw)) {}`, т.е.
 *     заменить «20с» на «30с» было невозможно, а строка с латинской 'c' вообще
 *     молча игнорировала правку;
 *   - ручной конструктор (ArmEditor ← combat-экспорт) терял холд полностью.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { parseHoldSeconds } from '../combat-core.engine';
import { combatPlanToUserProgram } from '../combat-integration.engine';
import { buildCombatPrintHtml } from '../combat-print.engine';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('канон parseHoldSeconds — цифра перед «с», иначе не холд', () => {
  it('холды распознаются', () => {
    for (const r of ['20с', '30с', '20 с', '15с/стор', '20-30с']) {
      expect(parseHoldSeconds(r), r).not.toBeNull();
    }
  });

  it('повторы с «/сторону» и прочие НЕ становятся холдом', () => {
    for (const r of ['8-10/сторону', '12/стор', '10-15', '8', 'AMRAP', '']) {
      expect(parseHoldSeconds(r), r).toBeNull();
    }
  });

  it('сборка даёт холд на изометрии шеи и кора', () => {
    const p = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, bodyweight: 80 } as any));
    const withHold = p.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.filter(e => e.holdSeconds != null)));
    expect(withHold.length).toBeGreaterThan(0);
    for (const e of withHold) {
      expect(e.holdSeconds!).toBeGreaterThan(0);
      // инвариант: reps сета = 1, когда это холд
      for (const ws of e.workSets) {
        expect(ws.reps).toBe(1);
        expect(ws.holdSeconds).toBe(e.holdSeconds);
      }
    }
  });
});

describe('потребители холда', () => {
  it('CombatPlanView показывает холд в заголовке и в по-сетовой строке', () => {
    const src = read('src/ui/screens/combat/CombatPlanView.tsx');
    expect(src).toContain('ex.holdSeconds');
    expect(src).toContain('холд {ex.holdSeconds}с');
    expect(src).toContain('s.holdSeconds != null');
  });

  it('печать несёт холд в колонке «Сеты×Повт»', () => {
    const p = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, bodyweight: 80 } as any));
    const html = buildCombatPrintHtml(p);
    expect(html).toContain('холд');
    expect(html).toMatch(/холд \d+с/);
  });

  it('правка повторов резолвит холд КАНОНОМ на месте вызова, а не локальной копией', () => {
    const src = read('src/ui/screens/combat/CombatConstructor.tsx');
    // пункт назначения обязан звать канон; проверка именно строки вызова —
    // иначе «импорт есть, но копия логики inline» проходит гард (проверено мутацией).
    expect(src).toMatch(/const hold = parseHoldSeconds\(raw\)/);
    // пустой hold-ветки и хрупкой проверки на латиницу больше нет
    expect(src).not.toMatch(/test\(raw\)\) \{\s*\}/);
    expect(src).not.toMatch(/\/[^/\n]*c\/i\.test/);
    // и правка реально доезжает до holdSeconds
    expect(src).toMatch(/ex\.holdSeconds = hold/);
  });
});

describe('экспорт в ручной конструктор не теряет холд', () => {
  it('UserSet несёт holdSeconds из combat-плана', () => {
    const p = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, bodyweight: 80 } as any));
    const prog: any = combatPlanToUserProgram(p);
    const exHold = p.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.filter(e => e.holdSeconds != null)));
    expect(exHold.length).toBeGreaterThan(0);
    // в первый сет соответствующего блока холд доехал
    const blocks = prog.combat.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.blocks || []));
    const withHold = blocks.filter((b: any) => (b.sets || []).some((st: any) => st.holdSeconds != null));
    expect(withHold.length).toBeGreaterThan(0);
  });

  it('тип UserSet уже объявляет holdSeconds (контракт не изобретается)', () => {
    const src = read('src/engines/user-program/user-program.types.ts');
    expect(src).toMatch(/holdSeconds\?: number/);
  });

  it('SetEditor рендерит и редактирует холд', () => {
    const src = read('src/ui/screens/TrainingScreen_parts/ProgramEditorComponents.tsx');
    // тумблер включения холда + поле секунд + aria-label
    expect(src).toContain('aria-pressed={sets.length > 0 && sets.every(s => s.holdSeconds != null)}');
    expect(src).toContain('Удержание подхода ${i + 1} в секундах');
    expect(src).toContain('holdSeconds: s.holdSeconds ?? 20');
    // колонка «Холд» в шапке таблицы
    expect(src).toContain('>Холд<');
    // копирование с 1-го сета теперь тащит и холд
    expect(src).toContain('Копировать RIR/темп/отдых/холд с 1-го');
  });
});

describe('инварианты не сломаны', () => {
  it('hold-упражнение: sets === workSets.length, reps сета = 1', () => {
    const p = finalizeCombatPlan(buildCombatPlan({ discipline: 'wrestling', goal: 'power', level: 'advanced', weeks: 6, daysPerWeek: 3, bodyweight: 85 } as any));
    for (const w of p.weeksData) for (const s of w.sessions) for (const e of s.exercises) {
      expect(e.sets).toBe(e.workSets.length);
      if (e.holdSeconds != null) for (const ws of e.workSets) expect(ws.reps).toBe(1);
    }
  });

  it('сохранённый план переживает roundtrip с холдом', () => {
    const p = finalizeCombatPlan(buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, bodyweight: 80 } as any));
    const back: any = JSON.parse(JSON.stringify(p));
    const before = p.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.filter(e => e.holdSeconds != null).map(e => `${e.id}:${e.holdSeconds}`))).sort();
    const after = back.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.filter((e: any) => e.holdSeconds != null).map((e: any) => `${e.id}:${e.holdSeconds}`))).sort();
    expect(after).toEqual(before);
    expect(before.length).toBeGreaterThan(0);
  });
});
