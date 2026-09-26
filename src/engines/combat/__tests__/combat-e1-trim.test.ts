/**
 * combat-e1-trim.test.ts — E1.7: `trimToMRV` не режет сквозь сессии.
 *
 * ЗАЧЕМ ФАЙЛ. Пункт E1.7 в плане описывал три дефекта старой версии:
 *   (а) `flatMap` по всем сессиям недели — сет мог срезаться у сессии;
 *   (б) пол `>2` без объяснения;
 *   (в) магические `*4` и `120`.
 * Код всё это уже починил (per-session обход, пол 2, границ нет), но ПОКРЫТИЯ
 * не было: проверено мутацией — возврат `flatMap` даёт 683/683 зелёных,
 * то есть регресс прошёл бы молча. Это тест на контракт, а не на реализацию.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { inCombatGroup, weekGroupSets } from '../combat-groups';
import { COMBAT_LANDMARKS } from '../combat-volume';
import type { CombatInput } from '../combat.types';

const base: CombatInput = {
  discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 8, daysPerWeek: 4,
  workMax: { chest: 100, back: 140, legs: 180, shoulders: 50, arms: 40 } as any,
} as CombatInput;

const build = (over: Partial<CombatInput> = {}) =>
  finalizeCombatPlan(buildCombatPlan({ ...base, ...over } as CombatInput));

const GROUPS = ['neck', 'grip', 'rotational', 'plyo', 'unilateral'] as const;

describe('E1.7.1 — инварианты после трима', () => {
  it('workSets всегда синхронны с sets (иначе валидатор ловит sets_mismatch)', () => {
    const plan = build();
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          expect(ex.workSets.length, `нед ${wk.week} ${ex.id}`).toBe(ex.sets);
        }
      }
    }
  });

  it('ни одно упражнение не опущено ниже пола в 2 сета', () => {
    const plan = build();
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          expect(ex.sets, `${ex.id} в неделе ${wk.week}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('сессии не превышают свой maxSets после трима', () => {
    const plan = build();
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        const maxSets = (sess as any).maxSets;
        if (typeof maxSets !== 'number') continue;   // не у всех сессий поле есть
        const sets = sess.exercises.reduce((a, e) => a + e.sets, 0);
        expect(sets, `нед ${wk.week}`).toBeLessThanOrEqual(maxSets);
      }
    }
  });
});

describe('E1.7.2 — группы не превышают MRV после трима', () => {
  it('для каждой группы недели сет <= MRV уровня', () => {
    const plan = build();
    for (const wk of plan.weeksData) {
      const lm = COMBAT_LANDMARKS[plan.level as keyof typeof COMBAT_LANDMARKS] as any;
      for (const g of GROUPS) {
        const sets = weekGroupSets(wk.sessions, g);
        if (sets === 0) continue;
        expect(sets, `нед ${wk.week} группа ${g}`).toBeLessThanOrEqual(lm[g].mrv);
      }
    }
  });

  it('тест не вакуумный: MRV групп реально достижим (иначе трим не срабатывает)', () => {
    const plan = build();
    const lm = COMBAT_LANDMARKS[plan.level as keyof typeof COMBAT_LANDMARKS] as any;
    for (const g of GROUPS) {
      expect(lm[g].mrv, `MRV группы ${g}`).toBeGreaterThan(0);
      expect(lm[g].mrv, `MRV группы ${g} должен быть >= MEV`).toBeGreaterThanOrEqual(lm[g].mev);
    }
  });

  it('inCombatGroup реально что-то относит к группам (иначе трим — пустышка)', () => {
    const plan = build();
    let tagged = 0;
    for (const wk of plan.weeksData) {
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          if (GROUPS.some((g) => inCombatGroup(ex.id, g))) tagged++;
        }
      }
    }
    expect(tagged).toBeGreaterThan(0);
  });

  // ── НАХОДКА аудита, зафиксирована честно ──────────────────────────────
  // На момент этого раунда билдер НЕ добавляет упражнения rotational и plyo
  // ни при каком fightStyle (проверено на hybrid/striker/grappler). То есть их
  // MEV/MAV/MRV и trimToMRV для них — числа и код без упражнений за собой.
  //
  // ВАЖНО: этот тест НЕ закрепляет пустоту как норму. Он падает, если группы
  // начнут наполняться — тогда тест удаляется/переписывается, и это будет
  // сигналом, что находка закрыта. Пока намеренного «0» тут быть не должно:
  // пустые группы не считаются находкой сами по себе, находкой считается
  // расхождение «есть MRV — нет упражнений», и оно вынесено в план.
  it('НАХОДКА: rotational и plyo сейчас пусты во всех fightStyle (см. план §E1.7)', () => {
    const counts: Record<string, Set<string>> = {};
    for (const style of ['striker', 'grappler', 'hybrid'] as const) {
      const p = build({ fightStyle: style });
      for (const g of GROUPS) {
        if (!counts[g]) counts[g] = new Set();
        for (const wk of p.weeksData) {
          for (const sess of wk.sessions) {
            for (const ex of sess.exercises) if (inCombatGroup(ex.id, g)) counts[g].add(ex.id);
          }
        }
      }
    }
    // наполняются
    expect(counts.neck.size, 'neck должен наполняться').toBeGreaterThan(0);
    expect(counts.grip.size, 'grip должен наполняться').toBeGreaterThan(0);
    expect(counts.unilateral.size, 'unilateral должен наполняться').toBeGreaterThan(0);
    // эти — нет; если тест упал ниже проверок выше, значит их починили
    expect({ rotational: counts.rotational.size, plyo: counts.plyo.size }).toEqual({
      rotational: 0, plyo: 0,
    });
  });
});

describe('E1.7.3 — контракт в коде (source-guard)', () => {
  const src = readFileSync('src/engines/combat/combat-finalize.engine.ts', 'utf8');
  // граница — до закрытия самой функции: `return total;` встречается и раньше
  // (в `if (total <= mrv) return total;`), поэтому ищем конец объявления
  const start = src.indexOf('const trimToMRV');
  const body = src.slice(start, src.indexOf('\n    };', start));

  it('обход идёт ПО СЕССИЯМ, а не по плоскому списку упражнений', () => {
    expect(body).toMatch(/for \(const sess of wk\.sessions\)/);
    // плоский сбор ВСЕХ упражнений недели — это ровно тот дефект (a)
    expect(body).not.toMatch(/wk\.sessions\.flatMap/);
  });

  it('срез берётся из упражнений своей сессии', () => {
    expect(body).toMatch(/sess\.exercises\.filter\(e => inCombatGroup/);
  });

  it('внутрисессионная сортировка: самые объёмные первыми', () => {
    expect(body).toMatch(/\.sort\(\(a, b\) => b\.sets - a\.sets\)/);
  });

  it('пол 2 зафиксирован в коде, а не зашит магией', () => {
    expect(body).toMatch(/ex\.sets > 2/);
  });

  it('магических границ прохода (*4 / лимиты итераций) больше нет', () => {
    // Ловим ЛЮБОЙ счётчик с числовым потолком, а не только ровно `idx > 120`:
    // первая версия guard'а пропустила `idxCounter > 120` (проверено мутацией).
    expect(body).not.toMatch(/\*\s*4\b/);
    expect(body).not.toMatch(/\b(idx|i|n|k|iter|step|counter|guard)\w*\s*>\s*\d{2,}/i);
  });

  it('workSets синхронизируется при каждом срезе', () => {
    expect(body).toMatch(/ex\.workSets = ex\.workSets\.slice\(0, ex\.sets\)/);
  });
});
