/**
 * lab-tier-two-sided.test.ts — проход 141: двусторонняя шкала не отдаёт советы
 * другой стороны.
 *
 * У `PLT`, `FERRITIN`, `CALCIUM` шкала двусторонняя (`direction:'both'`: норма и
 * «экстренно» есть с обеих сторон), а текст правила `TIER_RULES` был написан для
 * одной стороны. Вторая сторона получала его же:
 *  - ферритин 500 (перегрузка железа) → «Iron bisglycinate 30 мг + VitC»,
 *    ферритин 700 → «Iron ↑60 мг», то есть железо при перегрузке железом;
 *  - ферритин 1 (запасов нет) → «избыток железа. НЕ назначать железо»;
 *  - тромбоциты 120 (тромбоцитопения) → чеснок + омега-3 + натокиназа 200 мг, то
 *    есть антиагреганты при риске кровотечения;
 *  - тромбоциты 80 → «тромбоцитоз»;
 *  - кальций 2.9 (гиперкальциемия) → витамин D3 2000 МЕ + K2.
 *
 * Правило теперь может объявить содержание для другой стороны (`low`/`high`), а
 * `computeTierAdjustments` выбирает шаг по стороне шкалы, которую уже знает
 * `LAB_TIERS` (никаких новых порогов).
 */
import { describe, it, expect } from 'vitest';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { deriveTier } from '../lab-tier-ranges';

function calc(marker: string, value: number) {
  const adj = computeTierAdjustments({ [marker]: value } as never, 'male');
  return {
    tier: deriveTier(marker, value),
    subs: adj.addSubs.map(s => s.id),
    titrations: adj.titrations.map(t => t.id),
    alerts: adj.alerts.map(a => a.message).join(' '),
    actions: adj.nutrition.map(n => n.action).join(' '),
  };
}

describe('проход 141: сторона двусторонней шкалы решает, чей совет выдать', () => {
  it('ферритин высокой стороны не получает железо', () => {
    for (const v of [500, 700, 1200]) {
      const r = calc('FERRITIN', v);
      expect(r.subs, `ферритин ${v}`).not.toContain('iron_bisglycinate');
      expect(r.titrations, `ферритин ${v}`).not.toContain('iron_bisglycinate');
    }
    expect(calc('FERRITIN', 500).actions).toMatch(/Не железо/);
  });

  it('ферритин низкой стороны по-прежнему получает железо', () => {
    expect(calc('FERRITIN', 25).tier).toBe(1);
    expect(calc('FERRITIN', 25).subs).toContain('iron_bisglycinate');
  });

  it('глубокий дефицит железа не называется «избытком»', () => {
    expect(calc('FERRITIN', 1).tier).toBe(3);
    expect(calc('FERRITIN', 1).alerts).toMatch(/дефицит железа/);
    expect(calc('FERRITIN', 1).alerts).not.toMatch(/избыток/i);
  });

  it('перегрузка железа называется перегрузкой', () => {
    const a = calc('FERRITIN', 1200).alerts;
    expect(a).toMatch(/избыток железа/i);
    expect(a).not.toMatch(/дефицит/i);
  });

  it('тромбоцитопения не получает антиагреганты', () => {
    const low = calc('PLT', 120);
    expect(low.tier).toBe(2);
    for (const id of ['garlic', 'omega3', 'nattokinase']) {
      expect(low.subs, `PLT 120 / ${id}`).not.toContain(id);
    }
    expect(low.actions).toMatch(/Не антиагреганты/);
    // Высокая сторона работает как раньше.
    expect(calc('PLT', 500).subs).toEqual(expect.arrayContaining(['garlic', 'omega3', 'nattokinase']));
  });

  it('тромбоциты 80 — тромбоцитопения, а не тромбоцитоз', () => {
    const a = calc('PLT', 80);
    expect(a.tier).toBe(3);
    expect(a.alerts).toMatch(/тромбоцитопения/);
    expect(a.alerts).not.toMatch(/тромбоцитоз/);
  });

  it('высокий кальций не получает витамин D', () => {
    const hi = calc('CALCIUM', 2.9);
    expect(hi.tier).toBe(2);
    expect(hi.subs).not.toContain('vitamin_d3');
    expect(hi.subs).not.toContain('vitamin_k2');
    expect(hi.actions).toMatch(/Не витамин D/);
  });

  it('норма не обрастает советами', () => {
    for (const [m, v] of [['FERRITIN', 200], ['PLT', 250], ['CALCIUM', 2.4]] as const) {
      const r = calc(m, v);
      expect(r.tier, `${m} ${v}`).toBe(0);
      expect(r.subs).toHaveLength(0);
      expect(r.alerts).toBe('');
    }
  });

  it('односторонние шкалы не изменились (печень, липиды, витамин D)', () => {
    expect(calc('ALT', 120).tier).toBe(3);
    expect(calc('ALT', 120).alerts).toMatch(/прекратить AAS/i);
    expect(calc('LDL', 4.5).tier).toBe(2);
    expect(calc('VITAMIN_D', 8).tier).toBe(3);
    expect(calc('VITAMIN_D', 8).alerts).toMatch(/дефицит/i);
  });

  it('калий высокой стороны по-прежнему ограничивают, низкой — добавляют', () => {
    expect(calc('POTASSIUM', 6.2).actions).toMatch(/ОГРАНИЧИТЬ КАЛИЙ/);
    expect(calc('POTASSIUM', 3.2).actions).toMatch(/↑ калий/);
  });
});
