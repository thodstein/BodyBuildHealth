/**
 * calc-labs-female-p2.test.ts — §6.2 (P2): женские ветки производных анализов калькулятора.
 * Мужской путь без sex — байт-в-байт; женские пороги HCT (48/52/56) паритетны движку.
 */
import { describe, it, expect } from 'vitest';
import { deriveStateFromLabs, hctGradationLabel, hctSymptomCuts, hgbSymptomCut } from '../Calc.labs-derived';

const fp = (hct: string) => ({ date: '2026-09-01', panelHematology: { HCT: hct } }) as never;

describe('hctGradationLabel', () => {
  it('мужские пороги 48/52/57', () => {
    expect(hctGradationLabel(47)).toContain('норма');
    expect(hctGradationLabel(48)).toContain('коррекция');
    expect(hctGradationLabel(52)).toContain('терапия');
    expect(hctGradationLabel(57)).toContain('ургент');
  });
  it('женские пороги 44/48/52', () => {
    expect(hctGradationLabel(43, 'female')).toContain('норма');
    expect(hctGradationLabel(44, 'female')).toContain('коррекция');
    expect(hctGradationLabel(48, 'female')).toContain('терапия');
    expect(hctGradationLabel(52, 'female')).toContain('ургент');
    // 50 у женщины уже терапия (муж — ещё нет)
    expect(hctGradationLabel(50, 'male')).toContain('коррекция');
    expect(hctGradationLabel(50, 'female')).toContain('терапия');
  });
});

describe('hctSymptomCuts / hgbSymptomCut (доменная карта гематологии)', () => {
  it('♂ — прежние пороги: HCT 48/52, Hb 175', () => {
    expect(hctSymptomCuts('male')).toEqual({ correction: 48, therapy: 52 });
    expect(hctSymptomCuts()).toEqual({ correction: 48, therapy: 52 });
    expect(hgbSymptomCut('male')).toBe(175);
  });

  it('♀ — от женских норм: HCT 44/48 (ULN 48), Hb 150', () => {
    expect(hctSymptomCuts('female')).toEqual({ correction: 44, therapy: 48 });
    expect(hgbSymptomCut('female')).toBe(150);
  });
});

describe('deriveStateFromLabs: женские пороги HCT', () => {
  it('мужской путь по умолчанию байт-в-байт', () => {
    expect(JSON.stringify(deriveStateFromLabs(fp('54')))).toBe(JSON.stringify(deriveStateFromLabs(fp('54'), 'male')));
  });

  it('женщина: те же значения дают более высокую градацию', () => {
    expect(deriveStateFromLabs(fp('50')).cardio.hctElevation).toBe('none');
    expect(deriveStateFromLabs(fp('50'), 'female').cardio.hctElevation).toBe('mild');
    expect(deriveStateFromLabs(fp('54')).cardio.hctElevation).toBe('mild');
    expect(deriveStateFromLabs(fp('54'), 'female').cardio.hctElevation).toBe('moderate');
    expect(deriveStateFromLabs(fp('57')).cardio.hctElevation).toBe('moderate');
    expect(deriveStateFromLabs(fp('57'), 'female').cardio.hctElevation).toBe('severe');
    // derivedFields маркер на месте в обоих путях
    expect(deriveStateFromLabs(fp('54'), 'female').derivedFields).toContain('cardio.hctElevation');
  });
});

describe('deriveStateFromLabs: печень/почки — те же ULN, что на экране «Анализы»', () => {
  const bio = (panelBiochem: Record<string, string>) => ({ date: '2026-09-01', panelBiochem }) as never;

  it('АЛТ 35: у мужчины норма, у женщины — mild (ULN 40 / 31)', () => {
    expect(deriveStateFromLabs(bio({ ALT: '35' }), 'male').hepatobiliary.altAstElevation).toBe('none');
    expect(deriveStateFromLabs(bio({ ALT: '35' }), 'female').hepatobiliary.altAstElevation).toBe('mild');
  });

  it('ГГТ 40: у мужчины норма, у женщины — mild (ULN 55 / 31)', () => {
    expect(deriveStateFromLabs(bio({ GGT: '40' }), 'male').hepatobiliary.ggtElevation).toBe('none');
    expect(deriveStateFromLabs(bio({ GGT: '40' }), 'female').hepatobiliary.ggtElevation).toBe('mild');
  });

  it('креатинин 100: у мужчины норма, у женщины — mild (ULN 110 / 97)', () => {
    expect(deriveStateFromLabs(bio({ Creatinine: '100' }), 'male').urinary.creatinineElevation).toBe('none');
    expect(deriveStateFromLabs(bio({ Creatinine: '100' }), 'female').urinary.creatinineElevation).toBe('mild');
  });

  it('билирубин 19: выше ULN (17.1) — mild, а не «норма» по литералу 21', () => {
    expect(deriveStateFromLabs(bio({ Bilirubin: '19' }), 'male').hepatobiliary.bilirubinElevation).toBe('mild');
  });
});
