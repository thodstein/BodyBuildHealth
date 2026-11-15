/**
 * metabolic-hub-sex.test.ts — проход 94: HCT-лестница метаболического хаба знает пол.
 *
 * Было: `HematologyInput.sex` объявлен с самого начала и пробрасывался из
 * `MetabolicHub.tsx`, но `calcHematology` его не читал. Женщина видела мужскую
 * лестницу: «внимание» с 48 (вместо 44), флеботомия с 52 (вместо 49), стоп с 55
 * (вместо 53), критично с 61 (вместо 57), плюс мужские пороги воды, железа и
 * донации. Пороги в самом движке были литералами 60/54/51/48.
 *
 * Стало: ступени из резолвера — `HCT_STEPS[sex]` (♂ 51/54/58, ♀ 48/52/56) и
 * «внимание» на `HCT_CORRECTION_MARGIN` ниже верхней нормы (♂ 48, ♀ 44).
 * Пол уходит и в `clinicalFloorsForLabs`. Без sex — прежний мужской ряд.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calcHematology } from '../metabolic-hub.engine';

const hct = (value: number, sex?: 'male' | 'female') => calcHematology({ weight: 80, hct: value, sex });

describe('проход 94: HCT по полу в метаболическом хабе', () => {
  it('женщина: 43 норма, 44 внимание, 49 флеботомия, 53 стоп, 57 критично', () => {
    expect(hct(43, 'female').zone).toBe('normal');
    expect(hct(44, 'female').zone).toBe('attention');
    expect(hct(49, 'female').zone).toBe('phlebotomy');
    expect(hct(53, 'female').zone).toBe('stop');
    expect(hct(57, 'female').zone).toBe('critical');
  });

  it('женщина: HCT 50 — уже флеботомия, а по мужской лестнице было «внимание»', () => {
    expect(hct(50, 'female').zone).toBe('phlebotomy');
    expect(hct(50).zone).toBe('attention');
  });

  it('вода идут за порогами пола', () => {
    expect(hct(44, 'female').waterAdjMl).toBe(300);
    expect(hct(49, 'female').waterAdjMl).toBe(500);
    expect(hct(53, 'female').waterAdjMl).toBe(750);
  });

  it('железо: ZERO выше 48, кап в 44–48 — и подпись печатает её числа', () => {
    expect(hct(45, 'female').ironRec).toBe('cap_15');
    expect(hct(45, 'female').ironRecLabel).toContain('44-48');
    expect(hct(49, 'female').ironRec).toBe('zero');
    expect(hct(49, 'female').ironRecLabel).toContain('48');
  });

  it('донация: плановая с 49, в ближайшие дни с 51, срочная с 53', () => {
    expect(hct(49, 'female').donation.urgency).toBe('elective');
    expect(hct(51, 'female').donation.urgency).toBe('soon');
    expect(hct(53, 'female').donation.urgency).toBe('urgent');
  });

  it('мужской путь не изменился: без sex = male', () => {
    for (const v of [45, 49, 52, 55, 61]) {
      expect(hct(v, 'male')).toEqual(hct(v));
    }
  });

  it('источник: шкала из резолвера, пол уходит и в clinic-floors', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/metabolic-hub.engine.ts'), 'utf8');
    expect(src).toContain('const [hctErythrocytosis, hctBlock, hctCritical] = HCT_STEPS[sex];');
    expect(src).toContain('clinicalFloorsForLabs({ HCT: hct, HGB: hgb ?? undefined } as any, sex)');
    expect(src).not.toContain('hct > 54');
    expect(src).not.toContain('hct > 51');
    expect(src).not.toContain('HCT>60');
  });

  it('источник: шаг 4 п.п. и трёхступенчатый ряд живут в резолвере', () => {
    const norms = readFileSync(resolve(process.cwd(), 'src/engines/lab-norms.engine.ts'), 'utf8');
    expect(norms).toContain('export const HCT_CORRECTION_MARGIN = 4;');
    expect(norms).toContain('export const HCT_STEPS');

    const calc = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.labs-derived.ts'), 'utf8');
    expect(calc).toContain('export { HCT_CORRECTION_MARGIN };');
    expect(calc).not.toContain('export const HCT_CORRECTION_MARGIN = 4;');
  });
});
