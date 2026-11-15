/**
 * coach-assignment-bundle.test.ts — назначение рациона и протокола БАДов.
 *
 * Проверяем обещания, а не геттеры:
 *  • в набор попадают ТОЛЬКО ключи своего типа: дневники, вес и профиль не уезжают;
 *  • выдача заменяет план целиком и не трогает ключи другого типа;
 *  • круг «снял → выдал» сохраняет байты значений;
 *  • чужой/битый/огромный файл отклоняется и НЕ пишет в пространство атлета.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_BUNDLE_KIND,
  ASSIGNMENT_KEYS,
  applyAssignmentBundle,
  assignmentBundleErrorText,
  collectAssignmentBundle,
  describeAssignmentBundle,
  normalizeAssignmentBundle,
  type CoachAssignmentBundle,
} from '../coach-assignment-bundle.engine';
import { toPhysicalKey } from '../../../core/data-space';
import { COURSE_PLAN_VERSION, type CoachCoursePlan } from '../coach-course.engine';

const NOW = '2026-11-15T10:00:00.000Z';

function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function makeBundle(
  kind: 'nutrition' | 'supplements' | 'course',
  keys: Record<string, string>,
): CoachAssignmentBundle {
  return {
    app: 'bodybuildhealth',
    kind: ASSIGNMENT_BUNDLE_KIND,
    version: 1,
    assignmentKind: kind,
    createdAt: NOW,
    keys,
  } as CoachAssignmentBundle;
}

const PLANS = 'he_saved_nutrition_plans';
const TARGETS = 'he_plan_kbju_targets';
const SUPPORT = 'he_support_plan_result';
const EXTERNAL = 'he_support_external_subs';
const DIARY = 'he_diary_v2';
const PROFILE = 'he_profile_v2';

describe('сбор назначения', () => {
  it('питание: берёт план и цели, но не дневник и не профиль', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, PLANS)]: JSON.stringify([{ id: 1, name: 'База 2500' }]),
      [toPhysicalKey(sid, TARGETS)]: JSON.stringify({ kcal: 2500, protein: 180, fats: 70, carbs: 280 }),
      [toPhysicalKey(sid, DIARY)]: JSON.stringify({ secret: 'съел всё' }),
      [toPhysicalKey(sid, PROFILE)]: JSON.stringify({ weight: 82 }),
    });
    const bundle = collectAssignmentBundle(storage, sid, 'nutrition', { createdAt: NOW });
    expect(Object.keys(bundle.keys).sort()).toEqual([PLANS, TARGETS].sort());
    expect(JSON.stringify(bundle)).not.toContain('съел всё');
    expect(JSON.stringify(bundle)).not.toContain('"weight"');
    expect(bundle.sourceSpaceId).toBe(sid);
  });

  it('БАДы: берёт протокол и внешние добавки, дневник приёма остаётся', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, SUPPORT)]: JSON.stringify(['mag', 'd3']),
      [toPhysicalKey(sid, EXTERNAL)]: JSON.stringify([{ name: 'Своё' }]),
      [toPhysicalKey(sid, 'he_support_diary')]: JSON.stringify([{ taken: true }]),
    });
    const bundle = collectAssignmentBundle(storage, sid, 'supplements', { createdAt: NOW });
    expect(Object.keys(bundle.keys).sort()).toEqual([EXTERNAL, SUPPORT].sort());
    expect(JSON.stringify(bundle)).not.toContain('taken');
  });

  it('home читается без префикса пространства', () => {
    const storage = makeStorage({ [PLANS]: '[]' });
    const bundle = collectAssignmentBundle(storage, 'home', 'nutrition', { createdAt: NOW });
    expect(bundle.keys[PLANS]).toBe('[]');
  });

  it('пустое пространство даёт пустой набор, а не выдумку', () => {
    const bundle = collectAssignmentBundle(makeStorage(), 'asp_empty', 'nutrition', { createdAt: NOW });
    expect(bundle.keys).toEqual({});
    expect(describeAssignmentBundle(bundle)).toMatchObject({ keys: 0, chars: 0, parts: [] });
  });

  it('описание перечисляет разделы человеческими словами', () => {
    const d = describeAssignmentBundle(
      makeBundle('nutrition', { [PLANS]: '[{"id":1}]', [TARGETS]: '{"kcal":2500}' }),
    );
    expect(d.kind).toBe('nutrition');
    expect(d.keys).toBe(2);
    expect(d.parts).toContain('Сохранённые рационы');
    expect(d.parts).toContain('Цели КБЖУ');
  });
});

describe('проверка файла назначения', () => {
  it('чужой/битый/другой версии — понятная причина', () => {
    expect(normalizeAssignmentBundle(null).error).toBe('not-object');
    expect(normalizeAssignmentBundle([]).error).toBe('not-object');
    expect(
      normalizeAssignmentBundle({ app: 'other', kind: ASSIGNMENT_BUNDLE_KIND, version: 1, keys: {} }).error,
    ).toBe('kind');
    expect(
      normalizeAssignmentBundle({
        app: 'bodybuildhealth',
        kind: ASSIGNMENT_BUNDLE_KIND,
        version: 99,
        assignmentKind: 'nutrition',
        keys: {},
      }).error,
    ).toBe('version');
    expect(
      normalizeAssignmentBundle({
        app: 'bodybuildhealth',
        kind: ASSIGNMENT_BUNDLE_KIND,
        version: 1,
        assignmentKind: 'nutrition',
        keys: {},
      }).error,
    ).toBe('empty');
  });

  it('ключи чужого типа отбрасываются, а не протаскиваются', () => {
    const r = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'nutrition',
      keys: { [PLANS]: '[{"id":1}]', [SUPPORT]: '["mag"]', [DIARY]: '{"secret":1}' },
    });
    expect(r.error).toBeNull();
    expect(Object.keys(r.bundle?.keys ?? {})).toEqual([PLANS]);
  });

  it('битое значение внутри — отказ, а не «полу-назначение»', () => {
    const r = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'supplements',
      keys: { [SUPPORT]: '[{"broken":' },
    });
    expect(r.error).toBe('value');
    expect(r.bundle).toBeNull();
  });

  it('сообщения об ошибках объясняют, что делать', () => {
    expect(assignmentBundleErrorText('version')).toContain('обновите');
    expect(assignmentBundleErrorText('empty')).toContain('нет ни одного плана');
    expect(assignmentBundleErrorText('value')).toContain('выдача отменена');
    expect(assignmentBundleErrorText(null)).toBe('');
  });
});

describe('выдача назначения', () => {
  it('replace снимает прежний план целиком и пишет новый', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, PLANS)]: '[{"old":true}]',
      [toPhysicalKey(sid, TARGETS)]: '{"old":true}',
      [toPhysicalKey(sid, DIARY)]: '{"keep":true}',
    });
    const res = applyAssignmentBundle(storage, sid, makeBundle('nutrition', { [PLANS]: '[{"new":1}]' }));
    expect(res).toMatchObject({ written: 1, removed: 1, error: null });
    expect(storage.getItem(toPhysicalKey(sid, PLANS))).toBe('[{"new":1}]');
    expect(storage.getItem(toPhysicalKey(sid, TARGETS))).toBeNull();
    // Дневник атлета не наш — остаётся как был.
    expect(storage.getItem(toPhysicalKey(sid, DIARY))).toBe('{"keep":true}');
  });

  it('выдача питания не трогает протокол БАДов и наоборот', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, SUPPORT)]: '["mag"]',
      [toPhysicalKey(sid, PLANS)]: '[{"old":true}]',
    });
    applyAssignmentBundle(storage, sid, makeBundle('nutrition', { [PLANS]: '[{"new":1}]' }));
    expect(storage.getItem(toPhysicalKey(sid, SUPPORT))).toBe('["mag"]');

    applyAssignmentBundle(storage, sid, makeBundle('supplements', { [SUPPORT]: '["d3"]' }));
    expect(storage.getItem(toPhysicalKey(sid, PLANS))).toBe('[{"new":1}]');
    expect(storage.getItem(toPhysicalKey(sid, SUPPORT))).toBe('["d3"]');
  });

  it('merge оставляет ключи, которых нет в новом назначении', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({ [toPhysicalKey(sid, TARGETS)]: '{"kcal":2400}' });
    const res = applyAssignmentBundle(storage, sid, makeBundle('nutrition', { [PLANS]: '[{"n":1}]' }), {
      mode: 'merge',
    });
    expect(res).toMatchObject({ written: 1, removed: 0, error: null });
    expect(storage.getItem(toPhysicalKey(sid, TARGETS))).toBe('{"kcal":2400}');
  });

  it('круг «снял → выдал» сохраняет байты значений', () => {
    const from = 'asp_a1';
    const to = 'asp_a2';
    const plan = JSON.stringify([{ id: 7, name: 'Сушка', dayPlan: { totals: { kcal: 2100 } } }]);
    const targets = JSON.stringify({ kcal: 2100, protein: 190, fats: 60, carbs: 200 });
    const storage = makeStorage({
      [toPhysicalKey(from, PLANS)]: plan,
      [toPhysicalKey(from, TARGETS)]: targets,
    });
    const bundle = collectAssignmentBundle(storage, from, 'nutrition', { createdAt: NOW });
    const res = applyAssignmentBundle(storage, to, bundle);
    expect(res.error).toBeNull();
    expect(storage.getItem(toPhysicalKey(to, PLANS))).toBe(plan);
    expect(storage.getItem(toPhysicalKey(to, TARGETS))).toBe(targets);
  });

  it('битый файл не пишет ничего и не стирает прежний план', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({ [toPhysicalKey(sid, PLANS)]: '[{"old":true}]' });
    const res = applyAssignmentBundle(storage, sid, {
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'nutrition',
      keys: { [PLANS]: 'not json{' },
    });
    expect(res).toMatchObject({ written: 0, removed: 0, error: 'invalid' });
    expect(storage.getItem(toPhysicalKey(sid, PLANS))).toBe('[{"old":true}]');
  });

  it('без хранилища честно сообщает об ошибке', () => {
    expect(applyAssignmentBundle(null, 'asp_a1', makeBundle('nutrition', { [PLANS]: '[]' }))).toMatchObject({
      error: 'storage',
    });
  });

  it('ключи типа остаются закрытым списком: посторонний ключ не попадёт даже через API', () => {
    const all = [...ASSIGNMENT_KEYS.nutrition, ...ASSIGNMENT_KEYS.supplements];
    expect(all).not.toContain(DIARY);
    expect(all).not.toContain(PROFILE);
    expect(all).not.toContain('he_labs_log');
  });
});

describe('курс как тип назначения', () => {
  const START = 'he_course_start_date';
  const COURSE_PLAN: CoachCoursePlan = {
    version: COURSE_PLAN_VERSION,
    startDate: '2026-11-20',
    note: '',
    items: [
      {
        substanceId: 'test_e',
        name: 'Тестостерон энантат',
        doseValue: 500,
        doseUnit: 'мг',
        frequency: 2,
        startWeek: 1,
        endWeek: 12,
      },
    ],
  };

  it('сбор берёт дату из плана, а не старую дату атлета', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, START)]: '2026-01-01',
      [toPhysicalKey(sid, PLANS)]: '[{"id":1}]',
    });
    const bundle = collectAssignmentBundle(storage, sid, 'course', { createdAt: NOW, coursePlan: COURSE_PLAN });
    expect(Object.keys(bundle.keys)).toEqual([START]);
    expect(bundle.keys[START]).toBe('2026-11-20');
    expect(bundle.coursePlan?.items).toHaveLength(1);
    // Рацион в курс не подмешивается даже при сборе из того же пространства.
    expect(bundle.keys[PLANS]).toBeUndefined();
  });

  it('описание курса говорит препаратами и сроком', () => {
    const d = describeAssignmentBundle({
      ...makeBundle('course', { [START]: '2026-11-20' }),
      coursePlan: COURSE_PLAN,
    });
    expect(d.kind).toBe('course');
    expect(d.parts[0]).toContain('Курс: 1 преп.');
    expect(d.parts.join(' ')).toContain('Тестостерон энантат');
    expect(d.parts.join(' ')).toContain('20.11.2026');
  });

  it('нормализация: план обязателен, а дата старта — сырая строка', () => {
    const ok = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'course',
      keys: { [START]: '2026-11-20' },
      coursePlan: COURSE_PLAN,
    });
    expect(ok.error).toBeNull();
    expect(ok.bundle?.keys[START]).toBe('2026-11-20');

    const noPlan = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'course',
      keys: { [START]: '2026-11-20' },
    });
    expect(noPlan.error).toBe('value');
    expect(noPlan.bundle).toBeNull();
  });

  it('битая дата курса отклоняется, а не пишется в пространство', () => {
    const r = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'course',
      keys: { [START]: '20.11.2026' },
      coursePlan: COURSE_PLAN,
    });
    expect(r.error).toBe('value');
  });

  it('план без ключей допустим: дата берётся из плана', () => {
    const r = normalizeAssignmentBundle({
      app: 'bodybuildhealth',
      kind: ASSIGNMENT_BUNDLE_KIND,
      version: 1,
      assignmentKind: 'course',
      keys: {},
      coursePlan: COURSE_PLAN,
    });
    expect(r.error).toBeNull();
    expect(r.bundle?.keys[START]).toBe('2026-11-20');
  });

  it('выдача курса пишет дату старта и не трогает рацион и БАДы', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, PLANS)]: '[{"old":true}]',
      [toPhysicalKey(sid, SUPPORT)]: '["mag"]',
      [toPhysicalKey(sid, START)]: '2026-01-01',
    });
    const bundle = collectAssignmentBundle(makeStorage(), 'home', 'course', {
      coursePlan: COURSE_PLAN,
      createdAt: NOW,
    });
    const res = applyAssignmentBundle(storage, sid, bundle);
    expect(res).toMatchObject({ written: 1, error: null });
    expect(storage.getItem(toPhysicalKey(sid, START))).toBe('2026-11-20');
    expect(storage.getItem(toPhysicalKey(sid, PLANS))).toBe('[{"old":true}]');
    expect(storage.getItem(toPhysicalKey(sid, SUPPORT))).toBe('["mag"]');
  });
});
