/**
 * lab-tier-single-row.test.ts — проход 175: один анализ — одна строка порогов.
 *
 * `LAB_TIERS` держал девять анализов двумя полными строками с одинаковыми
 * числами (гемоглобин `HEMOGLOBIN`/`HGB`, эстрадиол `E2`/`ESTRADIOL`, …).
 * Копия стареет отдельно: правишь одну — вторая судит тем же анализом по
 * старым границам, а пользователь видит ошибку в зависимости от того, под
 * каким именем пришёл маркер.
 *
 * Гард держит контракт:
 *  1) у второго имени нет своих чисел — строка собрана из канонической;
 *  2) ступень (`deriveTier`) под обоими именами одинаковая для любого числа и пола;
 *  3) в `LAB_TIERS` не появляется новых пар строк с одинаковым содержимым —
 *     такая пара обязана быть объявлена в `TIER_SAME_ANALYSIS`.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, TIER_SAME_ANALYSIS, deriveTier, getLabEntry } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';

const NUMBERS = (row: (typeof LAB_TIERS)[string]) =>
  JSON.stringify([
    row.normal, row.borderline, row.treatment,
    row.emergencyLow ?? null, row.emergencyHigh ?? null,
    row.direction, row.unit,
  ]);

/** Клон определяем по числам И подписи: АЛТ и АСТ численно совпадают, но это разные анализы. */
const CLONE_SIGNATURE = (row: (typeof LAB_TIERS)[string]) => JSON.stringify([NUMBERS(row), row.label]);

describe('проход 175: один анализ — одна строка порогов', () => {
  it('второе имя читает строку канонического анализа', () => {
    for (const [alias, { canon }] of Object.entries(TIER_SAME_ANALYSIS)) {
      const row = LAB_TIERS[alias];
      const base = LAB_TIERS[canon];
      expect(base, `нет канонической строки ${canon}`).toBeTruthy();
      expect(row, `нет строки ${alias}`).toBeTruthy();
      expect(NUMBERS(row)).toBe(NUMBERS(base));
      expect(row.marker, 'имя анализа остаётся своим').toBe(alias);
      expect(row.direction).toBe(base.direction);
    }
  });

  it('ступень под обоими именами одинаковая (оба пола)', () => {
    const probes = (row: (typeof LAB_TIERS)[string]) => {
      const nums = [
        ...row.normal, ...row.borderline, ...row.treatment,
        row.emergencyLow, row.emergencyHigh,
      ].filter((n): n is number => typeof n === 'number');
      // Границы и серединки между ними — точки, где шкала меняет ступень.
      const mids = nums.slice(0, -1).map((n, i) => (n + nums[i + 1]) / 2);
      return [...nums, ...mids];
    };
    for (const [alias, { canon }] of Object.entries(TIER_SAME_ANALYSIS)) {
      for (const sex of [undefined, 'male', 'female'] as const) {
        for (const value of probes(LAB_TIERS[canon])) {
          expect(deriveTier(alias, value, sex), `${alias} ≠ ${canon} при ${value} (${sex})`)
            .toBe(deriveTier(canon, value, sex));
        }
      }
    }
  });

  it('женщине мужская гормональная лестница не выдаётся под любым именем', () => {
    // До прохода 175 `TOTAL_T` и `PROLACTIN` не были в списке мужских имён:
    // женщина с тестостероном 6 нмоль/л под именем TOTAL_T получала ступень
    // «лечение» с советом про hCG.
    for (const name of ['TESTOSTERONE', 'TOTAL_T']) {
      expect(deriveTier(name, 6, 'female'), name).toBe(0);
      expect(deriveTier(name, 6, 'male'), name).toBeGreaterThan(0);
    }
    for (const name of ['PRL', 'PROLACTIN']) {
      expect(deriveTier(name, 50, 'female'), name).toBe(0);
      expect(deriveTier(name, 50, 'male'), name).toBeGreaterThan(0);
    }
  });

  it('женщине второе имя тестостерона даёт женский бэнд, а не тишину', () => {
    // TOTAL_T — то же «тестостерон общий» в словарях маркеров, но ветки в
    // `femaleHormoneAlert`/`femaleHormoneSteps` у него не было: женщина с 200 нг/дл
    // под этим именем молчала.
    const r = computeTierAdjustments({ TOTAL_T: 200 }, 'female');
    const text = [...r.alerts.map((a) => a.message), ...r.nutrition.map((n) => `${n.action} ${n.target}`)].join(' ');
    expect(text).toContain('Вирилизация');
    expect(r.alerts.length + r.nutrition.length).toBeGreaterThan(0);
  });

  it('getLabEntry второго имени отдаёт лестницу своего анализа', () => {
    expect(getLabEntry('HGB')?.normal[1]).toBe(getLabEntry('HEMOGLOBIN')?.normal[1]);
    expect(getLabEntry('TOTAL_T')?.normal[0]).toBe(getLabEntry('TESTOSTERONE')?.normal[0]);
    expect(getLabEntry('HSCRP')?.label).toBe('hs-СРБ');
  });

  it('ступень под вторым именем даёт тот же совет, что под каноном', () => {
    const canon = computeTierAdjustments({ HEMOGLOBIN: 190 }, 'male');
    for (const alias of ['HGB']) {
      const r = computeTierAdjustments({ [alias]: 190 }, 'male');
      expect(r.tierSummary.length, `${alias}: находка не потеряна`).toBe(1);
      expect(r.tierSummary[0].tier).toBe(canon.tierSummary[0].tier);
      expect(JSON.stringify(r.alerts)).toBe(JSON.stringify(canon.alerts));
      expect(r.nutrition.length).toBe(canon.nutrition.length);
    }
    for (const [alias, canonName, probe] of [
      ['ESTRADIOL', 'E2', 900],
      ['PROLACTIN', 'PRL', 900],
      ['TOTAL_T', 'TESTOSTERONE', 1], // тестостерон — низкая сторона шкалы
    ] as const) {
      const a = computeTierAdjustments({ [alias]: probe }, 'male');
      const b = computeTierAdjustments({ [canonName]: probe }, 'male');
      expect(a.tierSummary.length, `${alias}: находка не потеряна`).toBeGreaterThan(0);
      expect(a.tierSummary[0].tier, `${alias}: ступень`).toBe(b.tierSummary[0].tier);
      expect(a.titrations.length + a.addSubs.length, `${alias}: действия`).toBe(b.titrations.length + b.addSubs.length);
    }
  });

  it('два написания в одной карте — одна находка; вчСРБ рядом с СРБ — две', () => {
    const twice = computeTierAdjustments({ HGB: 190, HEMOGLOBIN: 190 }, 'male');
    expect(twice.tierSummary.filter((s) => /H(EMOGLOBIN|GB)/.test(s.marker))).toHaveLength(1);
    const crpPair = computeTierAdjustments({ CRP: 12, HSCRP: 12 }, 'male');
    expect(crpPair.tierSummary.filter((s) => /CRP/.test(s.marker))).toHaveLength(2);
  });

  it('новых пар-копий в LAB_TIERS нет — только объявленные', () => {
    const groups = new Map<string, string[]>();
    for (const [key, row] of Object.entries(LAB_TIERS)) {
      const sig = CLONE_SIGNATURE(row);
      groups.set(sig, [...(groups.get(sig) ?? []), key]);
    }
    const declared = new Map<string, Set<string>>();
    for (const [alias, { canon }] of Object.entries(TIER_SAME_ANALYSIS)) {
      const set = declared.get(canon) ?? new Set<string>([canon]);
      set.add(alias);
      declared.set(canon, set);
    }
    const unexpected: string[] = [];
    for (const keys of groups.values()) {
      if (keys.length < 2) continue;
      const group = new Set(keys);
      const allowed = [...declared.values()].some(
        (set) => set.size === group.size && [...group].every((k) => set.has(k)),
      );
      if (!allowed) unexpected.push(keys.join(' = '));
    }
    expect(unexpected, `строки-копии без объявления:\n${unexpected.join('\n')}`).toEqual([]);
  });
});
