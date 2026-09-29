/**
 * support-phase-e2e.test.ts — B2/B3 аудита docs/SUPPORT-CALCULATOR-PRO-AUDIT.md:
 *  B2 — resolvePlan по фазам PCT/bridge/fertility/TRT (раньше тестируется только course);
 *  B3 — женский HCT-гейт железа через полный resolvePlan (раньше — только в слое).
 *
 *  Регресс-лок проводки фаз: было — 'trt'/'fertility' от UI-селектора проваливались
 *  в 'course' (mapper-ctx знал только легаси 'base'), профильная fertility → 'base' (TRT).
 */
import { describe, expect, it } from 'vitest';
import { resolvePlan } from '../tz-mapper-engine';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { canonId } from '../support-plan/shared-constants';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';
import type { CalculatorState } from '../support-plan/types';

function phaseState(phase: string, overrides: Partial<CalculatorState> = {}): CalculatorState {
  return {
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: phase as any, aas: [] },
    ...overrides,
  } as CalculatorState;
}

const idsOf = (rec: { subs: Array<{ substanceId: string }> }) => new Set(rec.subs.map(s => canonId(s.substanceId)));

describe('B2 — resolvePlan по фазам (проводка mapper-ctx → PHASE_PROTOCOL)', () => {
  it('pct → rec.phase="pct"; AI (анастрозол) заблокирован блоклистом фазы', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('pct'), 'medium'));
    expect(rec.phase).toBe('pct');
    expect(idsOf(rec).has('anastrozole')).toBe(false);
    // обязательная категория фазы: гормональная поддержка присутствует
    expect(rec.subs.some(s => s.category === 'hormonal')).toBe(true);
  });

  it('bridge → rec.phase="bridge"', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('bridge'), 'medium'));
    expect(rec.phase).toBe('bridge');
  });

  it('trt (значение UI-селектора) → rec.phase="trt", НЕ course (регресс проводки)', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('trt'), 'medium'));
    expect(rec.phase).toBe('trt');
  });

  it('fertility (значение UI-селектора) → rec.phase="fertility"; AI заблокирован', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('fertility'), 'medium'));
    expect(rec.phase).toBe('fertility');
    expect(idsOf(rec).has('anastrozole')).toBe(false);
  });

  it('легаси "base" (hydrate-псевдоним TRT) → trt-протокол', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('base'), 'medium'));
    expect(rec.phase).toBe('trt');
  });

  it('course (дефолт) не изменился', () => {
    const rec = resolvePlan(buildMapperCtx(phaseState('course'), 'medium'));
    expect(rec.phase).toBe('course');
  });
});

describe('B3 — женский HCT-гейт железа через resolvePlan', () => {
  const femaleCourse = (hct: number, ferritin: number): CalculatorState => {
    const s = phaseState('course', {
      profile: { ...DEFAULT_STATE.profile, sex: 'female' },
      pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 250, weeks: 12 }] },
      labs: {
        ...DEFAULT_STATE.labs,
        fullPanel: { date: '2026-01-01', panelIron: { Ferritin: String(ferritin) }, panelHematology: { HCT: String(hct) } } as any,
      },
    } as any);
    return s;
  };

  it('female + ферритин 20 + HCT 45 → железо в плане, женский слой активен', () => {
    const rec = resolvePlan(buildMapperCtx(femaleCourse(45, 20), 'medium'));
    const ids = idsOf(rec);
    expect(ids.has('iron_bisglycinate') || ids.has('iron')).toBe(true);
    // женский слой добавил свои позиции поверх мужского набора
    expect(rec.femaleLayer?.added?.length ?? 0).toBeGreaterThan(0);
  });

  it('female + ферритин 20 + HCT 50 (гипервязкость) → железо ВЫРЕЗАНО, предупреждение есть', () => {
    const rec = resolvePlan(buildMapperCtx(femaleCourse(50, 20), 'medium'));
    const ids = idsOf(rec);
    expect(ids.has('iron_bisglycinate')).toBe(false);
    expect(ids.has('iron')).toBe(false);
    expect(rec.femaleLayer?.removed?.length ?? 0).toBeGreaterThan(0);
    expect((rec.protocolWarnings || []).some(w => w.includes('HCT ≥48%'))).toBe(true);
  });

  it('female без анализов ферритина → железо тихо не добавляется (lab-gate)', () => {
    const s = phaseState('course', {
      profile: { ...DEFAULT_STATE.profile, sex: 'female' },
      pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 250, weeks: 12 }] },
    } as any);
    const rec = resolvePlan(buildMapperCtx(s, 'medium'));
    expect(idsOf(rec).has('iron_bisglycinate')).toBe(false);
  });

  it('male контроль: тот же вход — женского слоя нет (vitex не добавляется)', () => {
    const s = phaseState('course', {
      profile: { ...DEFAULT_STATE.profile, sex: 'male' },
      pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 250, weeks: 12 }] },
      labs: {
        ...DEFAULT_STATE.labs,
        fullPanel: { date: '2026-01-01', panelIron: { Ferritin: '20' }, panelHematology: { HCT: '45' } } as any,
      },
    } as any);
    const rec = resolvePlan(buildMapperCtx(s, 'medium'));
    expect(idsOf(rec).has('vitex')).toBe(false);
    expect(rec.femaleLayer?.added?.length ?? 0).toBe(0);
  });
});
