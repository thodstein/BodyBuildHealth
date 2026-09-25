/**
 * ss-bulgarian-gate.test.ts — P0-контракт безопасности болгарского daily-max.
 *
 * Контекст: гейт жил только в раннере (rankSSCycle/bulgarianGate) и обходился
 * прямым buildSSCyclePlan — из годового плана (buildAnnualFromSSCycles) и из
 * сохранённого cycleId (вариант/мост), где раннер не участвует. Итог: новичку
 * или атлету 50+ без согласия 6-дневный протокол максимумов собирался молча,
 * а rationale утверждал «согласие получено».
 *
 * Здесь гейт — fail-closed в самом билдере. Тест держит три инварианта:
 *   1) заблокированный daily-max НЕ собирается (4 комбинации блокировки);
 *   2) раннер и билдер решают одинаково (паритет — иначе гейт снова обойдут);
 *   3) гейт УЗКИЙ: обычные циклы и валидный daily-max собираются как раньше.
 */
import { describe, it, expect } from 'vitest';
import { buildSSCyclePlan } from '../strength-sport-ss-cycle-to-plan.engine';
import { rankSSCycle, bulgarianGate } from '../strength-sport-ss-selector.engine';
import { buildAnnualFromSSCycles } from '../strength-sport-ss-annual.engine';

const WM = { snatch: 80, cleanJerk: 100, frontSquat: 120, backSquat: 140, deadlift: 180 } as any;
const BUL = 'ss-ta-bulgarian';

/** Валидный вход: advanced + явное согласие + ACWR не cautionary. */
const ok = (over: any = {}) => ({
  mode: 'weightlifting', goal: 'strength', level: 'advanced',
  weeks: 8, daysPerWeek: 6, workMax: WM, cycleConsent: true, ...over,
}) as any;

describe('P0: болгарский daily-max — fail-closed гейт в билдере', () => {
  it('1) новичку без согласия daily-max НЕ собирается (раньше — молча)', () => {
    expect(() => buildSSCyclePlan(BUL, ok({ level: 'beginner', cycleConsent: false }))).toThrow(/daily-max/i);
  });

  it('2) advanced без ЯВНОГО согласия — отказ (undefined ≠ согласие)', () => {
    expect(() => buildSSCyclePlan(BUL, ok({ cycleConsent: undefined }))).toThrow(/согласие/i);
    expect(() => buildSSCyclePlan(BUL, ok({ cycleConsent: false }))).toThrow(/согласие/i);
  });

  it('3) masters 50+ — отказ даже с согласием (суставы/восстановление)', () => {
    expect(() => buildSSCyclePlan(BUL, ok({ age: 50 }))).toThrow(/50\+/);
    expect(() => buildSSCyclePlan(BUL, ok({ age: 61 }))).toThrow(/50\+/);
  });

  it('4) ACWR caution/dangerous — отказ даже с согласием', () => {
    expect(() => buildSSCyclePlan(BUL, ok({ acwr: { ratio: 1.35, zone: 'caution' } }))).toThrow(/ACWR/);
    expect(() => buildSSCyclePlan(BUL, ok({ acwr: { ratio: 1.6, zone: 'dangerous' } }))).toThrow(/ACWR/);
  });

  it('5) валидный вход (advanced + согласие) — план собирается, ошибок нет', () => {
    const plan = buildSSCyclePlan(BUL, ok());
    expect(plan.weeksData.length).toBe(8);
    expect(plan.validation.errors.length).toBe(0);
    expect(plan.validation.ok).toBe(true);
  });

  it('6) rationale обещает согласие ТОЛЬКО когда оно реально есть', () => {
    const line = buildSSCyclePlan(BUL, ok()).rationale.join(' | ');
    expect(line).toMatch(/согласие получено/);
    // Раньше та же строка печаталась безусловно — в блокированных случаях её нет,
    // потому что план не собирается вовсе (никакого «согласие получено» врёт).
    let blockedLine = '';
    try { blockedLine = buildSSCyclePlan(BUL, ok({ cycleConsent: false })).rationale.join(' | '); } catch { /* отказ — ожидаемо */ }
    expect(blockedLine).not.toMatch(/согласие получено/);
  });

  it('7) ПАРИТЕТ: раннер помечает blocked ⇔ билдер отказывает (все комбинации)', () => {
    const matrix: any[] = [
      { level: 'beginner', cycleConsent: false },
      { level: 'beginner', cycleConsent: true },
      { level: 'intermediate', cycleConsent: true },
      { level: 'advanced', cycleConsent: false },
      { level: 'advanced', cycleConsent: true },
      { level: 'enhanced', cycleConsent: true },
      { level: 'advanced', cycleConsent: true, age: 49 },
      { level: 'advanced', cycleConsent: true, age: 50 },
      { level: 'advanced', cycleConsent: true, acwr: { ratio: 1.3, zone: 'caution' } },
      { level: 'advanced', cycleConsent: true, acwr: { ratio: 1.5, zone: 'dangerous' } },
      { level: 'advanced', cycleConsent: true, acwr: { ratio: 0.9, zone: 'optimal' } },
    ];
    for (const over of matrix) {
      const input = ok(over);
      const rankIn = {
        mode: input.mode, level: input.level, daysPerWeek: input.daysPerWeek, weeks: input.weeks,
        acwrZone: input.acwr?.zone || null, cycleConsent: input.cycleConsent, age: input.age,
      };
      const ranked = rankSSCycle(rankIn).find(r => r.cycle.meta.id === BUL);
      // precondition: цикл вообще участвует в раннере для этого режима
      expect(ranked, `раннер не вернул ${BUL} для ${JSON.stringify(over)}`).toBeDefined();
      const gateSays = !!ranked!.blocked;
      let builderRefused = false;
      try { buildSSCyclePlan(BUL, input); } catch { builderRefused = true; }
      expect(builderRefused, `паритет нарушен для ${JSON.stringify(over)}: гейт=${gateSays}, билдер отказал=${builderRefused}`).toBe(gateSays);
    }
  });

  it('8) второй вектор обхода закрыт: год из болгарского без согласия — отказ', () => {
    expect(() => buildAnnualFromSSCycles([BUL], ok({ cycleConsent: false }))).toThrow(/daily-max/i);
  });

  it('9) год из болгарного С согласием — собирается (гейт не ломает легитимный путь)', () => {
    const ann = buildAnnualFromSSCycles([BUL], ok());
    expect(ann.totalWeeks).toBe(8);
    expect(ann.blocks.length).toBeGreaterThan(0);
  });

  it('10) гейт УЗКИЙ: обычные циклы новичку без согласия собираются как раньше', () => {
    for (const id of ['ss-ta-general-8', 'ss-ta-soviet-8', 'ss-sm-start-12']) {
      const plan = buildSSCyclePlan(id, ok({ level: 'beginner', cycleConsent: false, weeks: 4, daysPerWeek: 3 }));
      expect(plan.weeksData.length, id).toBeGreaterThan(0);
      expect(plan.validation.errors.length, id).toBe(0);
    }
  });

  it('11) гейт-канон не разъехался: bulgarianGate даёт те же 4 причины', () => {
    expect(bulgarianGate({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 6, weeks: 8, cycleConsent: true })).toMatch(/advanced/);
    expect(bulgarianGate({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: false })).toMatch(/согласие/);
    expect(bulgarianGate({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: true, age: 50 })).toMatch(/50\+/);
    expect(bulgarianGate({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: true, acwrZone: 'caution' })).toMatch(/ACWR/);
    expect(bulgarianGate({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 6, weeks: 8, cycleConsent: true })).toBeNull();
  });
});
