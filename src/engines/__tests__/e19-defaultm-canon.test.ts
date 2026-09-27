/**
 * E1.9 / B9 — `defaultM` как вторая (мёртвая) таблица m_i.
 *
 * Дефект: у каждого из 28 механизмов в `SYSTEMS` было поле `defaultM`, которого
 * никто не читал. Реальный расчёт шёл по локальному `baseDefaults` внутри
 * `getMiFromLab`, и эти две таблицы расходились ровно по 10 механизмам —
 * то есть поле было не просто мёртвым, а actively misleadющим при чтении кода.
 *
 * Почему здесь source-guard, а не поведенческий тест: инвариант — «у m_i
 * ровно один источник», а обе таблицы приватные (не экспортируются). Поведенчески
 * разницу увидеть нельзя, потому что мёртвое поле по определению ничего не
 * меняло. Значит единственная честная проверка — структурная.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'risk-engine-tz-spec.ts'), 'utf8');

/** id-шники расходившихся механизмов (замерено сравнением двух таблиц) */
const DIVERGED = ['cv2', 'cv4', 'liv1', 'cns1', 'cns2', 'rep1', 'rep2', 'rep3', 'rep5', 'hem1'];

describe('E1.9 / B9: defaultM удалён, m_i имеет один источник', () => {
  it('в MechDef больше нет поля defaultM', () => {
    const iface = SRC.slice(SRC.indexOf('interface MechDef'), SRC.indexOf('interface SysDef'));
    expect(iface).toContain('id: string');
    expect(iface).not.toContain('defaultM');
  });

  it('в SYSTEMS (28 записей) нет ни одного литерала defaultM:', () => {
    const start = SRC.indexOf('const SYSTEMS: SysDef[]');
    expect(start).toBeGreaterThan(-1);
    const systems = SRC.slice(start, SRC.indexOf('const MECH_WEIGHTS', start));
    expect(systems).not.toMatch(/defaultM\s*:/);
  });

  it('getMiFromLab читает модульную M_I_BASE_DEFAULTS, а не локальную таблицу', () => {
    const fn = SRC.slice(SRC.indexOf('function getMiFromLab'));
    expect(fn).toContain('M_I_BASE_DEFAULTS[mechId]');
    // локального `baseDefaults` быть не должно — именно он был вторым источником
    expect(fn.slice(0, 600)).not.toContain('const baseDefaults');
  });

  it('M_I_BASE_DEFAULTS — единственная таблица, покрывает все 28 механизмов', () => {
    const block = SRC.slice(
      SRC.indexOf('const M_I_BASE_DEFAULTS'),
      SRC.indexOf('const SYSTEMS: SysDef[]'),
    );
    // несколько id на строку — берём все вхождения, а не по одному на строку
    const keys = [...block.matchAll(/([a-z]+\d+):\s*[\d.]+/g)].map(m => m[1]);
    expect(keys).toHaveLength(28);
    expect(new Set(keys).size).toBe(28);
    // все расходившиеся id присутствуют в новом источнике
    for (const id of DIVERGED) expect(keys).toContain(id);
  });

  it('расхождение таблиц было ровно на 10 из 28 (фиксирует находку аудита)', () => {
    expect(DIVERGED).toHaveLength(10);
  });
});
