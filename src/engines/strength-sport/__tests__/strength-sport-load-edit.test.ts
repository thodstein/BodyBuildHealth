/**
 * strength-sport-load-edit.test.ts — AUDIT-2026-10 (раунд 4).
 *
 * Дефект: правка веса в плане пересчитывала % ПМ по ЦЕПОЧКЕ ДОГАДОК
 * «id упражнения → чей максимум взять базой»:
 *   - log_press/axle_press падали в ветку `overheadPress || bench || logPress || 60`
 *     → жим лёжа становился базой для жима лога;
 *   - акссессуары (махи, икры, предплечья) не матчились ни одной веткой → base=100,
 *     и мах 25 кг получал честное «25% ПМ»;
 *   - потолка не было: правка могла выдать 143% (program-store валидирует 30–110%,
 *     PCT_RANGE) → правка молча ломала экспорт в ручной режим.
 * А правка ОДНОГО подхода (updateSet) не пересчитывала pct вовсе — подход
 * продолжал заявлять старый процент при новом весе.
 *
 * Фикс: база берётся ОТНОСИТЕЛЬНО собственной строки (её вес / её %).
 * Каждый пункт ниже = тест на дефект.
 */
import { describe, it, expect } from 'vitest';
import {
  pctForEditedWeight, pctAnchorOf, editedSetPct, isSanePct, PCT_MIN, PCT_MAX,
} from '../strength-sport-load-edit.engine';
import { readFileSync } from 'fs';

describe('AUDIT-2026-10 load-edit: коридор % ПМ', () => {
  it('коридор совпадает с валидатором program-store (30–110%)', () => {
    expect(PCT_MIN).toBe(30);
    expect(PCT_MAX).toBe(110);
    // program-store валидирует ДОЛЮ 0.3–1.1 = 30–110% (в тесте целые числа —
    // 0.3*100 в JS даёт 30.000000000000004, это шум арифметики, не расхождение).
    expect(isSanePct(30)).toBe(true);
    expect(isSanePct(110)).toBe(true);
    expect(isSanePct(29)).toBe(false);
    expect(isSanePct(111)).toBe(false);
  });
});

describe('AUDIT-2026-10 load-edit: относительный пересчёт (не догадка про максимум)', () => {
  it('для плана билдера восстанавливается ровно его база (140кг@85% → +10кг = 91%)', () => {
    const pct = pctForEditedWeight({ weight: 140, pct: 85 }, 150);
    expect(pct).toBe(91); // base = 140/0.85 = 164.7 → 150/164.7 = 91.1%
  });

  it('вес без изменения сохраняет процент', () => {
    expect(pctForEditedWeight({ weight: 140, pct: 85 }, 140)).toBe(85);
  });

  it('логи не считают базой жим лёжа: % берётся из своей строки', () => {
    // ДО фикса цепочка давала base = overheadPress || bench || logPress || 60,
    // т.е. при ПМ жима лёжа 100 и логе 100 кг — «100%», при логе 143 кг — «143%».
    const anchor = { weight: 100, pct: 100 }; // лог реально шёл со 100% своего ПМ
    expect(pctForEditedWeight(anchor, 110)).toBe(110);   // ровно +10% к своему весу
    expect(pctForEditedWeight(anchor, 143)).toBe(110);   // кламп вместо «143%» (ломал экспорт)
  });

  it('акссессуары: мах 25 кг больше не получает «25%» от выдуманной сотни', () => {
    // ДО фикса: махи не матчились ни одной веткой → base=100 → 31 кг = «31%».
    const row = [{ weight: 25, pct: 40 }]; // движок поставил 40% от реальной базы 62.5
    expect(pctForEditedWeight(pctAnchorOf(row), 31)).toBe(50);
    expect(pctAnchorOf(row)).toEqual({ weight: 25, pct: 40 });
  });

  it('кламп в коридор: скачок веса не рвёт валидацию экспорта', () => {
    expect(pctForEditedWeight({ weight: 100, pct: 100 }, 300)).toBe(PCT_MAX);
    expect(pctForEditedWeight({ weight: 100, pct: 100 }, 10)).toBe(PCT_MIN);
  });

  it('нет базовой пары → undefined (честное «не оценивается», не выдуманный процент)', () => {
    expect(pctForEditedWeight(null, 100)).toBeUndefined();
    expect(pctForEditedWeight({ weight: 0, pct: 80 }, 100)).toBeUndefined();
    expect(pctForEditedWeight({ weight: 100, pct: 143 }, 120)).toBeUndefined();
    expect(pctForEditedWeight({ weight: 100, pct: 80 }, 0)).toBeUndefined();
  });

  it('якорь пропускает строки без pct / с нереалистичным pct / с нулевым весом', () => {
    expect(pctAnchorOf([{ weight: 100 }, { weight: 100, pct: 0 }])).toBeNull();
    expect(pctAnchorOf([{ weight: 0, pct: 80 }])).toBeNull();
    expect(pctAnchorOf([{ weight: 100, pct: 20 }, { weight: 140, pct: 85 }]))
      .toEqual({ weight: 140, pct: 85 });
    expect(pctAnchorOf(undefined)).toBeNull();
  });

  it('правка одного подхода пересчитывает его pct (раньше оставался старый)', () => {
    expect(editedSetPct({ weight: 140, pct: 85 }, 150)).toBe(91);
    expect(editedSetPct({ weight: 140 }, 150)).toBeUndefined();
  });
});

describe('AUDIT-2026-10 load-edit: конструктор использует честный пересчёт', () => {
  const src = readFileSync('src/ui/screens/strength-sport/StrengthSportConstructor.tsx', 'utf8');

  it('цепочка догадок «id → чей максимум» удалена из конструктора', () => {
    // Все маркеры устранённой цепочки (жим лёжа базой для лога, 100 по умолчанию).
    expect(src).not.toContain("wmAny.snatch || 60");
    expect(src).not.toContain("wmAny.overheadPress || wmAny.bench || wmAny.logPress || 60");
    expect(src).not.toContain("let base = 100");
  });

  it('оба пути правки (строка и подход) идут через движок', () => {
    expect(src).toContain('pctForEditedWeight(pctAnchorOf(ex.workSets), patch.weight)');
    expect(src).toContain('editedSetPct(ex.workSets[setIdx], patch.weight)');
  });

  it('отказ экспорта больше не молчаливый', () => {
    // Раньше: `try { saveUserProgram(prog); setMsg(...) } catch {}` — клик без
    // эффекта и без объяснения (квота/приватный режим выглядят как «ничего не нажалось»).
    const exp = src.slice(src.indexOf('exportToUserProgram'), src.indexOf('exportToUserProgram') + 1400);
    expect(exp).toContain('saveUserProgram(prog)');
    // именно ветка сохранения в библиотеку получила обработку (прочие try/catch
    // в функции — пред-существующие и к этому дефекту не относятся);
    expect(exp).toMatch(/setMsg\('✦ Экспортировано в библиотеку'\);[^}]*\} catch \(e\)/);
    expect(exp).toContain('Экспорт НЕ сохранён');
  });
});
