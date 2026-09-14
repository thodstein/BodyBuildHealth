/**
 * risk-parity-contours.test.ts — P0-1 аудита калькулятора (дубль Д10).
 *
 * Канон: buildTzInput(state, subs+процедуры) + calculateTzSpecRisk.
 * Фиксируем:
 *  - составы движка (`calculateSupportTZ().selectedSubstances`) и UI-контура (`resolvePlan().subs`)
 *    совпадают (canonId-множества) — исходные данные у обоих расчётов одни;
 *  - математика едина: при отсутствии пик-патча (короткий однопрепаратный курс) риск
 *    движка == rec-based расчёту;
 *  - после пик-патча `tzSpecResult` внутренне однороден (органы и overall = пик) —
 *    P0-фикс этого раунда; верхняя карточка показывает пик курса (labeled).
 */
import { describe, expect, it } from 'vitest';
import { calculateSupportTZ } from '../support-plan/engine';
import { resolvePlan } from '../tz-mapper-engine';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { buildTzInput } from '../support-plan/engine-helpers';
import { calculateTzSpecRisk } from '../risk-engine-tz-spec';
import { canonId } from '../support-plan/shared-constants';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function stateWith(ids: string[], overrides: any = {}) {
  return {
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: ids.map((id) => ({ id, doseMgWeek: 500, weeks: 12 })) },
    ...overrides,
  } as any;
}

function recBasedRisk(state: any) {
  const rec = resolvePlan(buildMapperCtx(state, 'medium'));
  const procedureIds = (rec.procedures || [])
    .filter((p) => p.id === 'erythrocytapheresis' || p.id === 'phlebotomy')
    .map((p) => p.id);
  const inp = buildTzInput(state, [...rec.subs.map((s) => s.substanceId), ...procedureIds]);
  return { rec, risk: inp ? calculateTzSpecRisk(inp) : null };
}

const canonSet = (ids: string[]) => new Set(ids.map((x) => canonId(x)).filter(Boolean));

describe('risk-parity-contours: составы контуров совпадают', () => {
  const fixtures: Array<[string, any]> = [
    ['test 500', stateWith(['test_enan'])],
    ['test+tren+nand', stateWith(['test_enan', 'tren_enan', 'nandrolone_decanoate'])],
    ['female deca 50', stateWith(['deca'], { profile: { ...DEFAULT_STATE.profile, sex: 'female' } })],
  ];
  it('selectedSubstances == rec.subs (canonId, обе стороны)', () => {
    for (const [name, state] of fixtures) {
      const eng = calculateSupportTZ(state);
      const { rec } = recBasedRisk(state);
      const engSet = canonSet(eng.selectedSubstances || []);
      const recSet = canonSet(rec.subs.map((s) => s.substanceId));
      const recNotEng = [...recSet].filter((x) => !engSet.has(x));
      const engNotRec = [...engSet].filter((x) => !recSet.has(x));
      expect(recNotEng, `${name}: rec ∖ engine`).toEqual([]);
      expect(engNotRec, `${name}: engine ∖ rec`).toEqual([]);
    }
  });
});

describe('risk-parity-contours: математика едина (без пик-патча)', () => {
  it('test 500: риск движка == rec-based (before/after)', () => {
    const state = stateWith(['test_enan']);
    const eng = calculateSupportTZ(state);
    const { risk } = recBasedRisk(state);
    expect(risk).not.toBeNull();
    expect(eng.overallRiskBefore).toBe(risk!.overallRaw);
    expect(eng.overallRiskAfter).toBe(risk!.overallAfter);
  });
});

describe('risk-parity-contours: пик-патч и внутренняя однородность', () => {
  it('test+tren+nand: tzSpecResult.overall == overallRisk* (органы уже пиковые)', () => {
    const state = stateWith(['test_enan', 'tren_enan', 'nandrolone_decanoate']);
    const eng = calculateSupportTZ(state);
    expect(eng.tzSpecResult).toBeTruthy();
    expect(eng.tzSpecResult!.overallRaw).toBe(eng.overallRiskBefore);
    expect(eng.tzSpecResult!.overallAfter).toBe(eng.overallRiskAfter);
    expect(eng.peakWeek).toBeGreaterThanOrEqual(1);
  });
  it('пик ≥ текущий raw, и пик честно отличается от rec-based при расхождении', () => {
    const state = stateWith(['test_enan', 'tren_enan', 'nandrolone_decanoate']);
    const eng = calculateSupportTZ(state);
    const { risk } = recBasedRisk(state);
    expect(eng.overallRiskBefore).toBeGreaterThanOrEqual(risk!.overallRaw);
  });
  it('женский контур: паритет составов + однородность tzSpecResult', () => {
    const state = stateWith(['deca'], { profile: { ...DEFAULT_STATE.profile, sex: 'female' } });
    const eng = calculateSupportTZ(state);
    expect(eng.tzSpecResult!.overallRaw).toBe(eng.overallRiskBefore);
    expect(eng.tzSpecResult!.overallAfter).toBe(eng.overallRiskAfter);
    // составы обоих контуров совпадают (включая женский слой, если он прошёл лимиты)
    const { rec } = recBasedRisk(state);
    expect(canonSet(eng.selectedSubstances || [])).toEqual(canonSet(rec.subs.map((s) => s.substanceId)));
  });
});
