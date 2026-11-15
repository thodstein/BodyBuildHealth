/**
 * coach-assignment-sheet.test.ts — лист назначения атлету.
 *
 * Проверяем обещания:
 *  • в лист попадает то, что реально лежит в пространстве: без дневников и веса;
 *  • «нет данных» печатается словами, а не пустым блоком;
 *  • КБЖУ рациона берётся из сохранённого плана, а не пересчитывается;
 *  • пользовательский текст экранируется в HTML (имя, комментарий);
 *  • экранный текст и HTML говорят одно и то же.
 */
import { describe, expect, it } from 'vitest';
import {
  assignmentSheetFileName,
  athleteFacts,
  buildAssignmentSheetHtml,
  buildAssignmentSheetText,
  collectAssignmentSheetSources,
  type AssignmentSheetInput,
} from '../coach-assignment-sheet.engine';
import { toPhysicalKey } from '../../../core/data-space';

function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return { getItem: (k: string) => map.get(k) ?? null };
}

const athlete: AssignmentSheetInput['athlete'] = {
  name: 'Иван',
  sex: 'male',
  age: 27,
  weightKg: 82,
  heightCm: 178,
  direction: 'пауэрлифтинг',
  goal: 'присед 200',
  group: 'вечерняя',
  contact: '@ivan',
  startedAt: '2026-01-10',
};

const baseInput = (patch: Partial<AssignmentSheetInput> = {}): AssignmentSheetInput => ({
  athlete,
  date: '2026-11-15',
  training: { parts: ['Макроцикл пауэрлифтинга'] },
  nutrition: {
    plans: [{ name: 'База 2500', date: '2026-11-10', kcal: 2500, protein: 180, fat: 70, carbs: 280 }],
    total: 1,
    targets: { kcal: 2500, protein: 180, fat: 70, carbs: 280 },
    notes: ['Исключено продуктов: 3'],
  },
  supplements: ['Омега-3', 'Витамин D3'],
  course: {
    startDate: '2026-11-20',
    lines: ['Тестостерон энантат 500 мг · 2/нед · недели 1–12'],
  },
  labs: [{ markers: ['АЛТ', 'Ферритин'], dueDate: '2026-12-01', comment: 'натощак', done: false }],
  coachNote: 'Созвон в среду.',
  ...patch,
});

describe('сбор источников листа', () => {
  it('берёт программу, рацион и протокол из пространства атлета', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, 'he_pl_macro')]: JSON.stringify({ v: 7 }),
      [toPhysicalKey(sid, 'he_saved_nutrition_plans')]: JSON.stringify([
        {
          id: 1,
          name: 'База 2500',
          date: '2026-11-10',
          dayPlan: { totals: { kcal: 2500, p: 180, f: 70, c: 280 } },
        },
      ]),
      [toPhysicalKey(sid, 'he_plan_kbju_targets')]: JSON.stringify({
        kcal: 2500,
        protein: 180,
        fats: 70,
        carbs: 280,
      }),
      [toPhysicalKey(sid, 'he_support_plan_result')]: JSON.stringify(['mag', 'd3', 'mag']),
      [toPhysicalKey(sid, 'he_excluded_foods')]: JSON.stringify(['сахар', 'майонез']),
      [toPhysicalKey(sid, 'he_diary_v2')]: JSON.stringify({ secret: 'не должно попасть в лист' }),
      [toPhysicalKey(sid, 'he_weight_log')]: JSON.stringify([{ kg: 82 }]),
    });

    const s = collectAssignmentSheetSources(storage, sid);
    expect(s.training?.parts).toContain('Макроцикл пауэрлифтинга');
    expect(s.nutrition?.plans[0]).toMatchObject({ name: 'База 2500', kcal: 2500, protein: 180 });
    expect(s.nutrition?.targets).toEqual({ kcal: 2500, protein: 180, fat: 70, carbs: 280 });
    expect(s.nutrition?.notes).toContain('Исключено продуктов: 2');
    expect(s.supplementIds).toEqual(['mag', 'd3']);
    expect(JSON.stringify(s)).not.toContain('не должно попасть');
  });

  it('пустое пространство даёт null, а не пустые блоки', () => {
    const s = collectAssignmentSheetSources(makeStorage(), 'asp_empty');
    expect(s).toEqual({ training: null, nutrition: null, supplementIds: [], courseStartDate: '' });
  });

  it('дата старта курса читается сырой строкой, а не JSON', () => {
    const sid = 'asp_a1';
    const s = collectAssignmentSheetSources(
      makeStorage({ [toPhysicalKey(sid, 'he_course_start_date')]: '2026-11-20' }),
      sid,
    );
    expect(s.courseStartDate).toBe('2026-11-20');
  });

  it('битый JSON в ключе не ломает сбор', () => {
    const sid = 'asp_a1';
    const s = collectAssignmentSheetSources(
      makeStorage({ [toPhysicalKey(sid, 'he_saved_nutrition_plans')]: '{{{' }),
      sid,
    );
    expect(s.nutrition).toBeNull();
  });

  it('показывает три последних рациона и честно говорит, сколько осталось', () => {
    const sid = 'asp_a1';
    const plans = [1, 2, 3, 4, 5].map(i => ({
      id: i,
      name: `Рацион ${i}`,
      date: `2026-11-0${i}`,
      dayPlan: { totals: { kcal: 2000 + i } },
    }));
    const s = collectAssignmentSheetSources(
      makeStorage({ [toPhysicalKey(sid, 'he_saved_nutrition_plans')]: JSON.stringify(plans) }),
      sid,
    );
    expect(s.nutrition?.plans.map(p => p.name)).toEqual(['Рацион 5', 'Рацион 4', 'Рацион 3']);
    expect(s.nutrition?.total).toBe(5);
  });
});

describe('текст листа', () => {
  it('содержит все блоки и факты атлета', () => {
    const text = buildAssignmentSheetText(baseInput());
    expect(text).toContain('ЛИСТ НАЗНАЧЕНИЯ · 15.11.2026');
    expect(text).toContain('Иван');
    expect(text).toContain('27 лет');
    expect(text).toContain('муж');
    expect(text).toContain('82 кг');
    expect(text).toContain('ТРЕНИРОВКА');
    expect(text).toContain('Макроцикл пауэрлифтинга');
    expect(text).toContain('База 2500');
    expect(text).toContain('2500 ккал');
    expect(text).toContain('Омега-3');
    expect(text).toContain('КУРС');
    expect(text).toContain('Старт: 20.11.2026');
    expect(text).toContain('Тестостерон энантат 500 мг');
    expect(text).toContain('АЛТ, Ферритин');
    expect(text).toContain('срок 01.12.2026');
    expect(text).toContain('натощак');
    expect(text).toContain('КОММЕНТАРИЙ ТРЕНЕРА');
    expect(text).toContain('Созвон в среду.');
    expect(text).toContain('не медицинское назначение');
  });

  it('пустые блоки названы словами, а не пропущены', () => {
    const text = buildAssignmentSheetText(
      baseInput({ training: null, nutrition: null, supplements: [], course: null, labs: [], coachNote: '' }),
    );
    expect(text).toContain('ТРЕНИРОВКА\nНе назначена.');
    expect(text).toContain('ПИТАНИЕ\nНе назначено.');
    expect(text).toContain('БАДЫ\nНе назначены.');
    expect(text).toContain('КУРС\nНе назначен.');
    expect(text).toContain('АНАЛИЗЫ\nНе назначены.');
    expect(text).not.toContain('КОММЕНТАРИЙ ТРЕНЕРА');
  });

  it('«ещё N рационов» появляется только когда их правда больше трёх', () => {
    const nutrition = {
      plans: [{ name: 'A', date: '', kcal: 2000, protein: null, fat: null, carbs: null }],
      total: 4,
      targets: null,
      notes: [],
    };
    expect(buildAssignmentSheetText(baseInput({ nutrition }))).toContain('…и ещё 3');
  });
});

describe('HTML листа', () => {
  it('экранирует имя и комментарий: пользовательский текст — не разметка', () => {
    const html = buildAssignmentSheetHtml(
      baseInput({
        athlete: { ...athlete, name: '<img src=x onerror=alert(1)>', goal: 'a & b' },
        coachNote: '<script>alert(1)</script>\nвторая строка',
      }),
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&lt;script&gt;');
    // Перенос строки комментария остаётся переносом, а не склейкой.
    expect(html).toContain('<br/>');
  });

  it('печатает те же данные, что и текст', () => {
    const html = buildAssignmentSheetHtml(baseInput());
    for (const needle of ['Лист назначения', '15.11.2026', 'Иван', 'База 2500', '2500 ккал', 'Омега-3', 'Тестостерон энантат', 'АЛТ', 'натощак']) {
      expect(html).toContain(needle);
    }
    expect(html).toContain('@page');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('имя файла безопасно и узнаваемо', () => {
    expect(assignmentSheetFileName('Иван Петров', '2026-11-15')).toBe('assignment-Иван_Петров-2026-11-15.html');
    expect(assignmentSheetFileName('', '2026-11-15')).toBe('assignment-атлет-2026-11-15.html');
    expect(assignmentSheetFileName('a/b\\c:d', '2026-11-15')).toBe('assignment-a_b_c_d-2026-11-15.html');
  });

  it('факты атлета не выдумывают того, чего нет', () => {
    expect(athleteFacts({ ...athlete, age: null, weightKg: null, heightCm: null, group: '', sex: 'unspecified' })).toEqual([]);
    expect(athleteFacts(athlete)).toEqual(['муж', '27 лет', '82 кг', '178 см', 'группа: вечерняя']);
  });
});
