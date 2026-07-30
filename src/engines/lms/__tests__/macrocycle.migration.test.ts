import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serializeMacro, deserializeMacro, buildMacrocycle, type Macrocycle } from '../macrocycle.engine';

const STORAGE_KEY = 'he_pl_macro';

/**
 * Тесты миграции storage MacrocyclePanel.
 * Функция migrateStorage не экспортирована из MacrocyclePanel (внутренняя),
 * но тестируем через roundtrip serialize/deserialize и симуляцию v1-данных.
 */

describe('macrocycle storage migration', () => {
  beforeEach(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  });
  afterEach(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  });

  it('roundtrip: serialize → deserialize восстанавливает макроцикл', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 16 });
    const s = serializeMacro(macro);
    const restored = deserializeMacro(s);
    expect(restored).toBeTruthy();
    expect(restored!.blocks).toHaveLength(5);
    expect(restored!.totalWeeks).toBe(16);
    expect(restored!.blocks[0].phase).toBe('endurance');
    expect(restored!.blocks[0].kind).toBe('BB'); // bodybuilding → BB для endurance
  });

  it('v1-данные без kind: deserialize возвращает валидный макроцикл (kind из массива)', () => {
    // v1 формат: блоки без kind (или kind=undefined)
    // Сериализуем вручную в v1-стиле: [phase, weeks, weekOffset, kind?, cycleId, description]
    const v1Data = JSON.stringify({
      b: [
        ['endurance', 4, 1, null, null, 'ББ-мезо (endurance)'],      // kind=null (v1)
        ['strength', 8, 5, null, 'cycle-01', 'СРЦ «XYZ»'],            // kind=null (v1)
        ['peak', 2, 13, 'SRC', 'cycle-02', 'СРЦ «Пик»'],             // kind='SRC' (v2)
        ['competition', 1, 15, 'SRC', 'cycle-03', 'СРЦ «Соревн»'],
        ['transition', 1, 16, null, null, 'Переход'],
      ],
      t: 16,
      c: 15,
      d: null,
      r: [],
    });
    const restored = deserializeMacro(v1Data);
    expect(restored).toBeTruthy();
    expect(restored!.blocks).toHaveLength(5);
    // kind может быть undefined/null для v1 — не крашит
    expect(restored!.blocks[0].phase).toBe('endurance');
    expect(restored!.blocks[2].kind).toBe('SRC');
  });

  it('невалидные данные → null (не крашит)', () => {
    expect(deserializeMacro('not-json')).toBeNull();
    expect(deserializeMacro('{}')).toBeNull();
    expect(deserializeMacro(JSON.stringify({ b: 'not-array' }))).toBeNull();
    expect(deserializeMacro(null as any)).toBeNull();
  });
});