/**
 * coach-program-bundle.test.ts — программа как объект тренера.
 *
 * Проверяем обещания, а не геттеры:
 *  • сбор идёт только по программным ключам, дневники/анализы НЕ уезжают;
 *  • выдача заменяет программу целиком (никаких «хвостов» старого блока);
 *  • круг «снял → выдал» сохраняет байты значений;
 *  • битые/огромные/чужие файлы отклоняются и НЕ трогают пространство атлета;
 *  • библиотека терпима к мусору и не даёт молча перезаписать программу.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_PROGRAMS_MAX,
  addCoachProgram,
  coachProgramErrorText,
  emptyCoachPrograms,
  markCoachProgramIssued,
  parseCoachPrograms,
  removeCoachProgram,
  renameCoachProgram,
  serializeCoachPrograms,
} from '../coach-program-library.engine';
import {
  PROGRAM_KEYS,
  applyProgramBundle,
  collectProgramBundle,
  describeProgramBundle,
  normalizeProgramBundle,
  programBundleErrorText,
  type CoachProgramBundle,
} from '../coach-program-bundle.engine';
import { toPhysicalKey } from '../../../core/data-space';

const NOW = '2026-11-05T10:00:00.000Z';

/** Простое хранилище с сырыми ключами (шов не нужен: ключи физические). */
function makeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

function makeBundle(keys: Partial<Record<(typeof PROGRAM_KEYS)[number], string>>): CoachProgramBundle {
  return {
    app: 'bodybuildhealth',
    kind: 'coach-program',
    version: 1,
    createdAt: NOW,
    keys,
  } as CoachProgramBundle;
}

const PL = 'he_pl_macro';
const BB = 'he_bb_macro';
const DESIGN = 'he_macrocycle_designs';

describe('сбор программы', () => {
  it('берёт только программные ключи пространства, дневники остаются', () => {
    const sid = 'asp_a1';
    const storage = makeStorage({
      [toPhysicalKey(sid, PL)]: JSON.stringify({ v: 7, b: ['присед'], t: 12 }),
      [toPhysicalKey(sid, DESIGN)]: JSON.stringify([{ id: 'd1' }]),
      [toPhysicalKey(sid, 'he_diary_v2')]: JSON.stringify({ secret: 'вес и самочувствие' }),
      [toPhysicalKey(sid, 'he_labs_log')]: JSON.stringify([{ secret: true }]),
    });
    const bundle = collectProgramBundle(storage, sid, { createdAt: NOW });
    expect(Object.keys(bundle.keys).sort()).toEqual([BB, DESIGN, PL].filter(k => k in bundle.keys).sort());
    expect(bundle.keys[PL]).toContain('присед');
    expect(JSON.stringify(bundle)).not.toContain('вес и самочувствие');
    expect(bundle.sourceSpaceId).toBe(sid);
  });

  it('home читается без префикса пространства', () => {
    const storage = makeStorage({ [PL]: '{"a":1}' });
    const bundle = collectProgramBundle(storage, 'home', { createdAt: NOW });
    expect(bundle.keys[PL]).toBe('{"a":1}');
  });

  it('пустое пространство даёт пустой набор, а не выдумку', () => {
    const bundle = collectProgramBundle(makeStorage(), 'asp_empty', { createdAt: NOW });
    expect(bundle.keys).toEqual({});
    expect(describeProgramBundle(bundle)).toMatchObject({ keys: 0, chars: 0, parts: [] });
  });

  it('описание перечисляет разделы человеческими словами', () => {
    const d = describeProgramBundle(makeBundle({ [PL]: '{"a":1}', [DESIGN]: '[{"b":2}]' }));
    expect(d.keys).toBe(2);
    expect(d.parts).toContain('Макроцикл пауэрлифтинга');
    expect(d.parts).toContain('Сохранённые макроциклы');
  });
});

describe('проверка файла программы', () => {
  it('чужой/битый/другой версии — понятная причина', () => {
    expect(normalizeProgramBundle(null).error).toBe('not-object');
    expect(normalizeProgramBundle([]).error).toBe('not-object');
    expect(normalizeProgramBundle({ app: 'other', kind: 'coach-program', version: 1, keys: {} }).error).toBe('kind');
    expect(normalizeProgramBundle({ app: 'bodybuildhealth', kind: 'coach-program', version: 99, keys: {} }).error).toBe('version');
    expect(normalizeProgramBundle({ app: 'bodybuildhealth', kind: 'coach-program', version: 1, keys: {} }).error).toBe('empty');
  });

  it('не-PROGRAM ключи игнорируются, а не протаскиваются', () => {
    const r = normalizeProgramBundle({
      app: 'bodybuildhealth', kind: 'coach-program', version: 1,
      keys: { [PL]: '{"a":1}', he_diary_v2: '{"secret":1}' },
    });
    expect(r.error).toBeNull();
    expect(Object.keys(r.bundle!.keys)).toEqual([PL]);
  });

  it('битое значение отклоняется: движки не должны «молча проглотить» выдачу', () => {
    const r = normalizeProgramBundle({
      app: 'bodybuildhealth', kind: 'coach-program', version: 1,
      keys: { [PL]: '{это не json' },
    });
    expect(r.error).toBe('value');
  });

  it('огромное значение отклоняется по потолку', () => {
    const r = normalizeProgramBundle({
      app: 'bodybuildhealth', kind: 'coach-program', version: 1,
      keys: { [PL]: JSON.stringify({ pad: 'x'.repeat(1_500_001) }) },
    });
    expect(r.error).toBe('size');
  });

  it('тексты ошибок человеческие', () => {
    expect(programBundleErrorText('value')).toMatch(/битые/);
    expect(programBundleErrorText('empty')).toMatch(/нет ни одного плана/);
    expect(programBundleErrorText(null)).toBe('');
  });
});

describe('выдача программы атлету', () => {
  const source = makeBundle({
    [PL]: JSON.stringify({ v: 7, b: ['присед', 'жим'], t: 12 }),
    [DESIGN]: JSON.stringify([{ id: 'd1', name: 'База 12 недель' }]),
  });

  it('replace снимает старые программные ключи и пишет новые', () => {
    const sid = 'asp_b2';
    const storage = makeStorage({
      [toPhysicalKey(sid, PL)]: '{"old":true}',
      [toPhysicalKey(sid, BB)]: '{"oldBB":true}',
      [toPhysicalKey(sid, 'he_diary_v2')]: '{"keep":true}',
    });
    const r = applyProgramBundle(storage, sid, source, { mode: 'replace' });
    expect(r).toMatchObject({ written: 2, removed: 1, error: null });
    expect(storage.getItem(toPhysicalKey(sid, PL))).toBe(source.keys[PL]);
    expect(storage.getItem(toPhysicalKey(sid, BB))).toBeNull();
    // дневник атлета выдача не трогает
    expect(storage.getItem(toPhysicalKey(sid, 'he_diary_v2'))).toBe('{"keep":true}');
  });

  it('merge не удаляет старое, но перезаписывает совпавшие ключи', () => {
    const sid = 'asp_b3';
    const storage = makeStorage({ [toPhysicalKey(sid, BB)]: '{"oldBB":true}' });
    const r = applyProgramBundle(storage, sid, source, { mode: 'merge' });
    expect(r).toMatchObject({ written: 2, removed: 0, error: null });
    expect(storage.getItem(toPhysicalKey(sid, BB))).toBe('{"oldBB":true}');
  });

  it('круг «снял у A → выдал B» сохраняет значения байт в байт', () => {
    const a = 'asp_a9';
    const b = 'asp_b9';
    const storage = makeStorage({
      [toPhysicalKey(a, PL)]: JSON.stringify({ v: 7, b: ['тяга'], t: 9 }),
      [toPhysicalKey(a, BB)]: JSON.stringify({ days: [1, 2, 3] }),
    });
    const bundle = collectProgramBundle(storage, a, { createdAt: NOW });
    expect(applyProgramBundle(storage, b, bundle).error).toBeNull();
    const back = collectProgramBundle(storage, b, { createdAt: NOW });
    expect(back.keys[PL]).toBe(bundle.keys[PL]);
    expect(back.keys[BB]).toBe(bundle.keys[BB]);
  });

  it('битый файл не пишет ничего и не стирает старое', () => {
    const sid = 'asp_c1';
    const storage = makeStorage({ [toPhysicalKey(sid, PL)]: '{"old":true}' });
    const r = applyProgramBundle(storage, sid, { app: 'x' });
    expect(r).toMatchObject({ written: 0, removed: 0, error: 'invalid' });
    expect(storage.getItem(toPhysicalKey(sid, PL))).toBe('{"old":true}');
  });

  it('пустой набор — отдельная причина, а не «выдано»', () => {
    const r = applyProgramBundle(makeStorage(), 'asp_c2', makeBundle({}));
    expect(r.error).toBe('empty');
  });
});

describe('библиотека программ тренера', () => {
  it('сохранение, переименование, удаление', () => {
    let store = emptyCoachPrograms();
    const add = addCoachProgram(store, { name: '  База 12 недель  ', bundle: makeBundle({ [PL]: '{"a":1}' }), sourceLabel: 'Иван' }, { id: 'p1', now: NOW });
    expect(add.error).toBeNull();
    expect(add.template?.name).toBe('База 12 недель');
    store = add.store;
    expect(store.items).toHaveLength(1);

    const ren = renameCoachProgram(store, 'p1', 'База (осень)', { now: NOW });
    expect(ren.error).toBeNull();
    expect(ren.store.items[0].name).toBe('База (осень)');
    store = ren.store;

    expect(removeCoachProgram(store, 'p1').items).toHaveLength(0);
  });

  it('пустое имя и дубль названия отклоняются', () => {
    let store = addCoachProgram(emptyCoachPrograms(), { name: 'Одна', bundle: makeBundle({ [PL]: '{"a":1}' }) }, { id: 'p1', now: NOW }).store;
    expect(addCoachProgram(store, { name: '   ', bundle: makeBundle({ [PL]: '{"a":1}' }) }, { id: 'p2', now: NOW }).error).toBe('name');
    expect(addCoachProgram(store, { name: 'одна', bundle: makeBundle({ [PL]: '{"a":1}' }) }, { id: 'p2', now: NOW }).error).toBe('duplicate');
    expect(addCoachProgram(store, { name: 'Две', bundle: makeBundle({}) }, { id: 'p2', now: NOW }).error).toBe('empty');
    expect(store.items).toHaveLength(1);
  });

  it('лимит библиотеки — технический и объясняется', () => {
    let store = emptyCoachPrograms();
    for (let i = 0; i < COACH_PROGRAMS_MAX; i++) {
      store = addCoachProgram(store, { name: `Программа ${i}`, bundle: makeBundle({ [PL]: `{"i":${i}}` }) }, { id: `p${i}`, now: NOW }).store;
    }
    const over = addCoachProgram(store, { name: 'Лишняя', bundle: makeBundle({ [PL]: '{"i":-1}' }) }, { id: 'px', now: NOW });
    expect(over.error).toBe('limit');
    expect(coachProgramErrorText('limit')).toContain(String(COACH_PROGRAMS_MAX));
  });

  it('счётчик выдач растёт только по факту', () => {
    const store = addCoachProgram(emptyCoachPrograms(), { name: 'Одна', bundle: makeBundle({ [PL]: '{"a":1}' }) }, { id: 'p1', now: NOW }).store;
    const after = markCoachProgramIssued(store, 'p1', { now: '2026-11-06T10:00:00.000Z' });
    expect(after.items[0].issuedCount).toBe(1);
    expect(after.items[0].lastIssuedAt).toBe('2026-11-06T10:00:00.000Z');
    expect(markCoachProgramIssued(after, 'нет-такого')).toBe(after);
  });

  it('парсер терпим: мусор пропускается, валидные остаются', () => {
    const good = addCoachProgram(emptyCoachPrograms(), { name: 'Живая', bundle: makeBundle({ [PL]: '{"a":1}' }) }, { id: 'p1', now: NOW }).template!;
    const raw = JSON.stringify({
      version: 1,
      items: [
        good,
        { id: 'broken', name: 'Битая', bundle: { app: 'x' } },
        { id: 'no-name', bundle: good.bundle },
        'мусор',
        { ...good, id: 'dup' },
      ],
    });
    const store = parseCoachPrograms(raw);
    expect(store.items.map(t => t.name)).toEqual(['Живая']);
    expect(parseCoachPrograms('{не json').items).toEqual([]);
    expect(parseCoachPrograms(null).items).toEqual([]);
  });

  it('сериализация переживает круг', () => {
    const store = addCoachProgram(emptyCoachPrograms(), { name: 'Одна', bundle: makeBundle({ [BB]: '{"a":1}' }) }, { id: 'p1', now: NOW }).store;
    expect(parseCoachPrograms(serializeCoachPrograms(store)).items[0].bundle.keys[BB]).toBe('{"a":1}');
  });
});
