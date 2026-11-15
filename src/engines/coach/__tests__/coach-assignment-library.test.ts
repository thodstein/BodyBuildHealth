/**
 * coach-assignment-library.test.ts — библиотека назначений тренера.
 *
 * Проверяем обещания:
 *  • шаблон нельзя сохранить без имени и без плана;
 *  • одинаковые названия внутри типа не размножаются (питание и БАДы — отдельно);
 *  • битые шаблоны в хранилище пропускаются, остальные остаются;
 *  • «выдано» считается только после реальной выдачи.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_ASSIGNMENTS_MAX,
  addCoachAssignment,
  coachAssignmentErrorText,
  emptyCoachAssignments,
  filterCoachAssignments,
  findCoachAssignment,
  markCoachAssignmentIssued,
  parseCoachAssignments,
  removeCoachAssignment,
  renameCoachAssignment,
  serializeCoachAssignments,
} from '../coach-assignment-library.engine';
import {
  ASSIGNMENT_BUNDLE_KIND,
  type CoachAssignmentBundle,
} from '../coach-assignment-bundle.engine';

const NOW = '2026-11-15T10:00:00.000Z';

const bundle = (kind: 'nutrition' | 'supplements', keys: Record<string, string>): CoachAssignmentBundle =>
  ({
    app: 'bodybuildhealth',
    kind: ASSIGNMENT_BUNDLE_KIND,
    version: 1,
    assignmentKind: kind,
    createdAt: NOW,
    keys,
  } as CoachAssignmentBundle);

const NUTRITION = () => bundle('nutrition', { he_saved_nutrition_plans: '[{"id":1}]' });
const SUPPLEMENTS = () => bundle('supplements', { he_support_plan_result: '["mag"]' });

describe('сохранение шаблона', () => {
  it('без имени и без плана не сохраняется', () => {
    expect(addCoachAssignment(emptyCoachAssignments(), { name: '   ', bundle: NUTRITION() }).error).toBe('name');
    expect(addCoachAssignment(emptyCoachAssignments(), { name: 'Сушка', bundle: {} }).error).toBe('empty');
  });

  it('сохраняет тип, источник и нулевой счётчик выдачи', () => {
    const res = addCoachAssignment(
      emptyCoachAssignments(),
      { name: 'Сушка 2100', bundle: NUTRITION(), sourceLabel: 'Иван', note: ' люблю  ' },
      { now: NOW, id: 't1' },
    );
    expect(res.error).toBeNull();
    expect(res.template).toMatchObject({
      id: 't1',
      kind: 'nutrition',
      name: 'Сушка 2100',
      sourceLabel: 'Иван',
      note: 'люблю',
      issuedCount: 0,
      lastIssuedAt: null,
    });
  });

  it('одинаковое имя внутри одного типа запрещено, между типами — можно', () => {
    const first = addCoachAssignment(emptyCoachAssignments(), { name: 'База', bundle: NUTRITION() }, { now: NOW, id: 't1' });
    expect(addCoachAssignment(first.store, { name: 'база', bundle: NUTRITION() }).error).toBe('duplicate');
    const second = addCoachAssignment(first.store, { name: 'База', bundle: SUPPLEMENTS() }, { now: NOW, id: 't2' });
    expect(second.error).toBeNull();
  });

  it('потолок библиотеки объясняется в тексте ошибки', () => {
    let store = emptyCoachAssignments();
    for (let i = 0; i < COACH_ASSIGNMENTS_MAX; i++) {
      store = addCoachAssignment(
        store,
        { name: `Шаблон ${i}`, bundle: NUTRITION() },
        { now: NOW, id: `t${i}` },
      ).store;
    }
    expect(addCoachAssignment(store, { name: 'Лишний', bundle: NUTRITION() }).error).toBe('limit');
    expect(coachAssignmentErrorText('limit')).toContain(String(COACH_ASSIGNMENTS_MAX));
  });
});

describe('правки библиотеки', () => {
  it('переименование не даёт двух одинаковых имён в типе', () => {
    let store = addCoachAssignment(emptyCoachAssignments(), { name: 'A', bundle: NUTRITION() }, { now: NOW, id: 't1' }).store;
    store = addCoachAssignment(store, { name: 'B', bundle: NUTRITION() }, { now: NOW, id: 't2' }).store;
    expect(renameCoachAssignment(store, 't2', 'a').error).toBe('duplicate');
    const ok = renameCoachAssignment(store, 't2', 'Cушка', { now: NOW });
    expect(ok.error).toBeNull();
    expect(findCoachAssignment(ok.store, 't2')?.name).toBe('Cушка');
  });

  it('удаление убирает только нужный шаблон', () => {
    let store = addCoachAssignment(emptyCoachAssignments(), { name: 'A', bundle: NUTRITION() }, { now: NOW, id: 't1' }).store;
    store = addCoachAssignment(store, { name: 'B', bundle: SUPPLEMENTS() }, { now: NOW, id: 't2' }).store;
    const next = removeCoachAssignment(store, 't1');
    expect(next.items.map(t => t.id)).toEqual(['t2']);
    expect(removeCoachAssignment(next, 't1')).toBe(next);
  });

  it('«выдано» считается после выдачи и хранится', () => {
    const store = addCoachAssignment(emptyCoachAssignments(), { name: 'A', bundle: NUTRITION() }, { now: NOW, id: 't1' }).store;
    const issued = markCoachAssignmentIssued(store, 't1', { now: NOW });
    expect(findCoachAssignment(issued, 't1')).toMatchObject({ issuedCount: 1, lastIssuedAt: NOW });
    expect(parseCoachAssignments(serializeCoachAssignments(issued))).toEqual(issued);
    expect(markCoachAssignmentIssued(issued, 'нет-такого')).toBe(issued);
  });

  it('фильтр по типу не показывает чужие шаблоны', () => {
    let store = addCoachAssignment(emptyCoachAssignments(), { name: 'A', bundle: NUTRITION() }, { now: NOW, id: 't1' }).store;
    store = addCoachAssignment(store, { name: 'B', bundle: SUPPLEMENTS() }, { now: NOW, id: 't2' }).store;
    expect(filterCoachAssignments(store, 'nutrition').map(t => t.id)).toEqual(['t1']);
    expect(filterCoachAssignments(store, 'supplements').map(t => t.id)).toEqual(['t2']);
  });
});

describe('терпимость хранилища', () => {
  it('битые и чужие шаблоны пропускаются, остальные остаются', () => {
    const good = JSON.stringify(
      addCoachAssignment(emptyCoachAssignments(), { name: 'A', bundle: NUTRITION() }, { now: NOW, id: 't1' }).template,
    );
    const parsed = parseCoachAssignments(
      `{"version":1,"items":[${good},null,{"id":"x"},{"id":"t2","name":"Чужой","bundle":{"app":"x"}}]}`,
    );
    expect(parsed.items.map(t => t.id)).toEqual(['t1']);
  });

  it('не JSON и старая версия — пустая библиотека, а не падение', () => {
    expect(parseCoachAssignments('{{').items).toEqual([]);
    expect(parseCoachAssignments('{"version":0,"items":[]}').items).toEqual([]);
    expect(parseCoachAssignments(null).items).toEqual([]);
  });
});
