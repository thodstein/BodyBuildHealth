/**
 * bb-scheme-comment-program-path.test.ts — итерация J.
 *
 * `programToBBPlan` (программа/цикл) применяет схему объёма внутри
 * `finalizeBBPlan`, а потом сам же правит план:
 *  - rehab режет сеты травмированных мышц,
 *  - недельный MRV-трим и сессионный кап режут объём,
 *  - множитель отдыха по уровню интенсивности меняет `restSeconds`,
 *  - `expandPlanToTargets` добивает сеты до целей.
 *
 * Обещание схемы в комментарии (`GVT 10×10 (5×10-10, отдых 75с)`) — это ТРИ
 * величины: сеты, диапазон повторов и отдых. До фикса программа-путь не сверял
 * ни одну: замер показал 13/13 упражнений со «отдых 75с» при 60с в плане.
 */
import { describe, expect, it } from 'vitest';
import { programToBBPlan } from '../cycle-to-plan';
import { reconcileSchemeComments } from '../bb-scheme-comment-reconcile';
import type { FullProgram } from '../../complete-program-library.engine';

const WM = { chest: 110, back: 130, shoulders: 65, quads: 150, hamstrings: 105, glutes: 145, biceps: 52, triceps: 62, calves: 85, traps: 75, forearms: 42 };

const CLAIM = /(GVT 10×10|FST-7|Gironda 8×8) \((\d+)(?:×(\d+)(?:-(\d+))?(?:, отдых (\d+)с)?)?/;

const day = (n: number, name: string, focus: string, exs: Array<[string, number]>) => ({
  day: n, name, focus, warmup: '',
  exercises: exs.map(([exName, sets]) => ({ name: exName, sets, reps: '10', rir: 2 })),
});

const program: FullProgram = {
  id: 'p', name: 'P', author: 't', type: 'bodybuilding', goal: 'bodybuilding', direction: 'bodybuilding',
  level: 'advanced', durationWeeks: 4, daysPerWeek: 4, sessionTimeMin: '70', description: '', targetAudience: '', equipmentNeeded: [],
  weeks: [1, 2, 3, 4].map((w) => ({
    week: w, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false,
    days: [
      day(1, 'Chest', 'chest', [['Жим штанги лёжа', 4], ['Разводка гантелями', 3], ['Кроссовер на блоке', 3], ['Жим в тренажёре (грудь)', 3]]),
      day(2, 'Legs', 'legs', [['Гакк-присед', 4], ['Разгибания ног в тренажёре', 3], ['Сгибания ног сидя', 3], ['Жим ногами (45°)', 3]]),
      day(3, 'Shoulders', 'shoulders', [['Жим гантелей стоя', 4], ['Махи гантелями в стороны', 3], ['Махи в наклоне', 3]]),
      day(4, 'Arms', 'arms', [['Подъём гантелей на бицепс стоя', 3], ['Французский жим лёжа', 3], ['Молотки (нейтральный хват)', 3]]),
    ],
  })),
  progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
};

function build(extra: Record<string, unknown> = {}) {
  return programToBBPlan(program, {
    workMax: WM, level: 'advanced', mode: 'adapt', volumeScheme: 'gvt', ...extra,
  } as any) as any;
}

/** Расхождения «обещание схемы ≠ факт» по всем трём величинам. */
function mismatches(plan: any) {
  const rows: string[] = [];
  let schemeExercises = 0;
  const aspects = { sets: 0, reps: 0, rest: 0 };
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    const m = CLAIM.exec(String(e.comment || ''));
    if (!m) continue;
    schemeExercises += 1;
    const bad: string[] = [];
    if (Number(m[2]) !== Number(e.sets)) { aspects.sets += 1; bad.push(`сеты ${m[2]}→${e.sets}`); }
    if (m[3] && e.repsRange && (Number(m[3]) !== Number(e.repsRange[0]) || Number(m[4]) !== Number(e.repsRange[1]))) {
      aspects.reps += 1; bad.push(`повторы ${m[3]}-${m[4]}→${e.repsRange[0]}-${e.repsRange[1]}`);
    }
    if (m[5] && e.restSeconds && Number(m[5]) !== Number(e.restSeconds)) { aspects.rest += 1; bad.push(`отдых ${m[5]}→${e.restSeconds}`); }
    if (bad.length) rows.push(`нед ${w.week} ${e.name}: ${bad.join(', ')}`);
  }
  return { rows, schemeExercises, aspects };
}

const ex = (over: Record<string, unknown> = {}) => ({
  muscle: 'chest',
  name: 'Разводка гантелями',
  role: 'accessory',
  character: 'памп',
  sets: 5,
  repsRange: [10, 10],
  restSeconds: 75,
  comment: 'GVT 10×10 (5×10-10, отдых 75с)',
  workSets: [],
  schemeAssignedSets: 5,
  schemeLabel: 'GVT 10×10',
  ...over,
});

const wrap = (exercise: any) => ({ weeks: [{ sessions: [{ exercises: [exercise] }] }] });

describe('J: сверка схемы чинит все три обещания (сеты, повторы, отдых)', () => {
  it('сеты: только цифра в обещании меняется, причина — от вызывающего', () => {
    const e = ex({ sets: 4 });
    const r = reconcileSchemeComments(wrap(e) as any);
    expect(r.fixed).toBe(1);
    expect(r.aspects).toEqual({ sets: 1, reps: 0, rest: 0 });
    expect(e.comment).toBe('GVT 10×10 (4×10-10, отдых 75с) · схема урезана бюджетом недели: 4 из 5 сетов');
  });

  it('отдых: 75с в обещании → 60с по факту (множитель интенсивности)', () => {
    const e = ex({ restSeconds: 60 });
    const r = reconcileSchemeComments(wrap(e) as any);
    expect(r.fixed).toBe(1);
    expect(r.aspects).toEqual({ sets: 0, reps: 0, rest: 1 });
    expect(e.comment).toBe('GVT 10×10 (5×10-10, отдых 60с) · схема обновлена после назначения: отдых 60с');
  });

  it('повторы: диапазон из DUP/оверлея приводится к факту', () => {
    const e = ex({ repsRange: [12, 15] });
    const r = reconcileSchemeComments(wrap(e) as any);
    expect(r.fixed).toBe(1);
    expect(r.aspects).toEqual({ sets: 0, reps: 1, rest: 0 });
    expect(e.comment).toBe('GVT 10×10 (5×12-15, отдых 75с) · схема обновлена после назначения: повторы 12-15');
  });

  it('комбинация: сеты + отдых в одном хвосте причины', () => {
    const e = ex({ sets: 3, restSeconds: 60 });
    reconcileSchemeComments(wrap(e) as any, { reason: (a, m) => `тапер: ${a} из ${m} сетов` });
    expect(e.comment).toBe('GVT 10×10 (3×10-10, отдых 60с) · тапер: 3 из 5 сетов, отдых 60с');
  });

  it('идемпотентно: повторный проход ничего не меняет', () => {
    const e = ex({ sets: 4, restSeconds: 60 });
    const first = reconcileSchemeComments(wrap(e) as any);
    const snapshot = e.comment;
    const second = reconcileSchemeComments(wrap(e) as any);
    expect(first.fixed).toBe(1);
    expect(second.fixed).toBe(0);
    expect(e.comment).toBe(snapshot);
  });

  it('старый формат без отдыха не обрастает новой величиной', () => {
    const e = ex({ comment: 'GVT 10×10 (5×10)', sets: 4, restSeconds: 60 });
    reconcileSchemeComments(wrap(e) as any);
    // отдых в обещании не упоминался — не выдумываем его задним числом
    expect(e.comment).toBe('GVT 10×10 (4×10) · схема урезана бюджетом недели: 4 из 5 сетов');
  });

  it('совпадающий комментарий не трогается', () => {
    const e = ex();
    const r = reconcileSchemeComments(wrap(e) as any);
    expect(r.fixed).toBe(0);
    expect(e.comment).toBe('GVT 10×10 (5×10-10, отдых 75с)');
  });
});

describe('J: программа-путь больше не оставляет схему с чужим обещанием', () => {
  it('множитель отдыха по интенсивности: 0 расхождений, причина в rationale', () => {
    for (const intensityLevel of ['high', 'light'] as const) {
      const plan = build({ intensityLevel });
      const { rows, schemeExercises } = mismatches(plan);
      expect(schemeExercises, 'схема объёма должна примениться в фикстуре').toBeGreaterThan(0);
      expect(rows, `${intensityLevel}: ${rows.slice(0, 5).join('; ')}`).toEqual([]);
      // До фикса ломался именно отдых: пояснение это фиксирует.
      expect(plan.rationale.join('\n')).toMatch(/Схема объёма: у \d+ упр\. .*отдых/);
    }
  });

  it('rehab режет сеты травмированной мышцы — обещание приведено к факту', () => {
    const plan = build({ rehabMuscles: ['chest', 'quads'] });
    const { rows, schemeExercises } = mismatches(plan);
    expect(schemeExercises).toBeGreaterThan(0);
    expect(rows, rows.slice(0, 5).join('; ')).toEqual([]);
    // До фикса rehab резал сеты, а обещание схемы оставалось прежним.
    expect(plan.rationale.join('\n')).toMatch(/Схема объёма: у \d+ упр\. .*сеты/);
  });

  it('без пост-проходов схема уже консистентна и пояснение не добавляется', () => {
    const plan = build();
    const { rows, schemeExercises } = mismatches(plan);
    expect(schemeExercises).toBeGreaterThan(0);
    expect(rows).toEqual([]);
    expect(plan.rationale.join('\n')).not.toMatch(/Схема объёма: у/);
  });
});
