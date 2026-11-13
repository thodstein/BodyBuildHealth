/**
 * mix-gates-registry.test.ts — проход 37: гейты миксов берут числа из реестра
 * `NUTRIENT_LIMITS_V2`, а не из литералов, и напоминают про медь.
 *
 * Было: `zinc > 40` и текст «UL 40 мг/сут» жёстко в коде (разойдётся с реестром
 * при смене значения), а при 25–40 мг цинка напоминания о меди не было вообще —
 * хотя кросс-кап и баннеры протоколов требуют медь уже с 25 мг/сут.
 */
import { describe, it, expect } from 'vitest';
import { mixSafetyGates, type MixGateCtx } from '../mix-safety-gates.engine';
import { NUTRIENT_LIMITS_V2 } from '../support-limits';

const baseCtx: MixGateCtx = { caffeineMg: 0, bwKg: 80, hasInsulin: false };
const codes = (stack: { id: string; mg: number }[], ctx: Partial<MixGateCtx> = {}) =>
  mixSafetyGates(stack, { ...baseCtx, ...ctx }).map(g => g.code);

describe('цинк: UL из реестра + медь с 25 мг', () => {
  it('выше UL — варн, число из реестра', () => {
    const g = mixSafetyGates([{ id: 'zinc', mg: 50 }], baseCtx);
    const ul = g.find(x => x.code === 'zinc_ul');
    expect(ul).toBeTruthy();
    expect(ul!.text).toContain(String(NUTRIENT_LIMITS_V2.zinc.value));
  });

  it('ровно UL — ещё не превышение', () => {
    expect(codes([{ id: 'zinc', mg: NUTRIENT_LIMITS_V2.zinc.value }])).not.toContain('zinc_ul');
  });

  it('25–40 мг — инфо про медь, без ложного «превышения»', () => {
    const c = codes([{ id: 'zinc', mg: 30 }]);
    expect(c).toContain('zinc_copper');
    expect(c).not.toContain('zinc_ul');
  });

  it('ниже 25 мг — молчим', () => {
    expect(codes([{ id: 'zinc', mg: 20 }])).not.toContain('zinc_copper');
  });
});

describe('витамин C: гейт ЖКТ называет UL реестра', () => {
  it('> 1 г — варн, в тексте UL 2000 мг', () => {
    const g = mixSafetyGates([{ id: 'vitamin_c', mg: 1500 }], baseCtx);
    const vc = g.find(x => x.code === 'vitc_ul');
    expect(vc).toBeTruthy();
    expect(vc!.text).toContain(String(NUTRIENT_LIMITS_V2.vitamin_c.value));
  });

  it('500 мг — без гейта', () => {
    expect(codes([{ id: 'vitamin_c', mg: 500 }])).not.toContain('vitc_ul');
  });
});
