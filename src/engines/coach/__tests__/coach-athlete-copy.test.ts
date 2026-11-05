import { describe, expect, it } from 'vitest';
import {
  ATHLETE_COPY_KIND,
  ATHLETE_COPY_MAX_BYTES,
  applyAthleteCopyKeys,
  athleteCopyErrorText,
  collectAthleteCopy,
  describeAthleteCopy,
  normalizeAthleteCopy,
} from '../coach-athlete-copy.engine';
import { spaceKeyPrefix } from '../../../../src/core/data-space';

function memoryStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    get length() {
      return map.size;
    },
    key(i: number) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k: string) {
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    dump: () => map,
  };
}

const SID = 'asp_a1';
const PREFIX = spaceKeyPrefix(SID);

describe('сбор копии', () => {
  it('берёт только ключи этого пространства и снимает префикс', () => {
    const storage = memoryStorage({
      [`${PREFIX}he_weight_log`]: '[{"date":"2026-11-04","weight":82}]',
      [`${PREFIX}he_pl_macro`]: '{"v":7}',
      'he_ath_asp_other__he_weight_log': '[{"weight":99}]',
      'he_profile_v2': '{"name":"тренер"}',
      'he_sync_state': '{"x":1}',
    });
    const { copy } = collectAthleteCopy({
      storage,
      spaceId: SID,
      stores: { training_log: [{ id: 'l1' }], empty: [] },
      label: 'Иван',
      createdAt: '2026-11-05T10:00:00.000Z',
    });
    expect(Object.keys(copy.keys).sort()).toEqual(['he_pl_macro', 'he_weight_log']);
    expect(copy.keys.he_weight_log).toContain('82');
    expect(copy.stores).toEqual({ training_log: [{ id: 'l1' }] });
    expect(copy.app).toBe('bodybuildhealth');
    expect(copy.kind).toBe(ATHLETE_COPY_KIND);
    expect(copy.label).toBe('Иван');
  });

  it('служебные he_sync_ внутри пространства не тащим', () => {
    const storage = memoryStorage({ [`${PREFIX}he_sync_pending`]: '[]' });
    const { copy } = collectAthleteCopy({ storage, spaceId: SID, stores: {}, label: 'X' });
    expect(copy.keys).toEqual({});
  });
});

describe('проверка файла', () => {
  const good = () => ({
    app: 'bodybuildhealth',
    kind: ATHLETE_COPY_KIND,
    version: 1,
    createdAt: '2026-11-05T10:00:00.000Z',
    label: 'Иван',
    keys: { he_weight_log: '[]' },
    stores: { training_log: [{ id: 'l1' }] },
  });

  it('правильная копия проходит', () => {
    const r = normalizeAthleteCopy(good());
    expect(r.error).toBeNull();
    expect(r.copy?.keys.he_weight_log).toBe('[]');
    expect(describeAthleteCopy(r.copy!)).toEqual({ keys: 1, records: 1, stores: 1 });
  });

  it('чужая структура, чужой вид и чужая версия отклоняются', () => {
    expect(normalizeAthleteCopy('x').error).toBe('not-object');
    expect(normalizeAthleteCopy({ ...good(), kind: 'coach-program' }).error).toBe('kind');
    expect(normalizeAthleteCopy({ ...good(), app: 'other' }).error).toBe('kind');
    expect(normalizeAthleteCopy({ ...good(), version: 2 }).error).toBe('version');
  });

  it('пустая копия не притворяется данными', () => {
    expect(normalizeAthleteCopy({ ...good(), keys: {}, stores: {} }).error).toBe('empty');
    expect(athleteCopyErrorText('empty')).toContain('нет данных');
  });

  it('слишком большая копия отклоняется с объяснением', () => {
    const big = { ...good(), keys: { he_big: 'x'.repeat(ATHLETE_COPY_MAX_BYTES + 1000) } };
    const r = normalizeAthleteCopy(big);
    expect(r.error).toBe('size');
    expect(athleteCopyErrorText('size')).toContain('4 МБ');
  });

  it('нестроковое значение ключа — не копия', () => {
    expect(normalizeAthleteCopy({ ...good(), keys: { he_weight_log: 42 } }).error).toBe('empty');
  });
});

describe('восстановление в НОВОЕ пространство', () => {
  it('ключи ложатся под префикс целевого пространства, а не исходного', () => {
    const storage = memoryStorage();
    const target = 'asp_new';
    const n = applyAthleteCopyKeys(storage, target, {
      app: 'bodybuildhealth',
      kind: ATHLETE_COPY_KIND,
      version: 1,
      createdAt: '2026-11-05T10:00:00.000Z',
      label: 'Иван',
      keys: { he_weight_log: '[{"weight":82}]', he_pl_macro: '{"v":7}' },
      stores: {},
    });
    expect(n).toBe(2);
    const dump = storage.dump();
    expect(dump.get(`${spaceKeyPrefix(target)}he_weight_log`)).toContain('82');
    expect(dump.has(`${PREFIX}he_weight_log`)).toBe(false);
  });

  it('сбой записи одного ключа не срывает остальные', () => {
    let calls = 0;
    const storage = {
      setItem: () => {
        calls++;
        if (calls === 1) throw new Error('quota');
      },
    };
    const n = applyAthleteCopyKeys(storage, 'asp_new', {
      app: 'bodybuildhealth',
      kind: ATHLETE_COPY_KIND,
      version: 1,
      createdAt: '',
      label: '',
      keys: { a: '1', b: '2', c: '3' },
      stores: {},
    });
    expect(n).toBe(2);
  });
});
