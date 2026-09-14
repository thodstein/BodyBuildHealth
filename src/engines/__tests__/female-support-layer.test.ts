/**
 * female-support-layer.test.ts — этап «женский слой» (B): аддитивное усиление плана поддержки.
 *
 * Гарантии:
 *  - мужской путь: слой не активен, тот же объект rec, ничего не добавлено;
 *  - женский: добавляет поверх мужского (ничего не удаляя), уважает TOTAL_LIMIT,
 *    не мутирует кэшированную рекомендацию; флаги риска идут в protocolWarnings.
 */
import { describe, expect, it } from 'vitest';
import { applyFemaleSupport, FEMALE_LAYER_SUBS } from '../female-support-layer';
import { resolvePlan } from '../tz-mapper-engine';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { canonId } from '../support-plan/shared-constants';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function mkState(aas: Array<{ id: string; mgPerWeek: number; form?: string }>, sex: 'male' | 'female') {
  return {
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, sex },
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: aas.map((a) => ({ id: a.id, doseMgWeek: a.mgPerWeek, form: a.form || 'inject' })),
    },
  } as any;
}

const baseRec = (subs: any[] = []) => ({
  level: 'medium', phase: 'course', phaseLabel: '', subs,
  suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [],
  boosters: [], activatedMechs: [], summary: 's', rationale: 'r',
} as any);

describe('female-support-layer: unit', () => {
  it('мужской ctx → тот же объект (байт-в-байт)', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'male', onCourse: true, level: 'medium' } as any);
    expect(out).toBe(rec);
  });
  it('ctx без sex → тот же объект', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { onCourse: true, level: 'medium' } as any);
    expect(out).toBe(rec);
  });
  it('female без курса → тот же объект', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: false, level: 'medium' } as any);
    expect(out).toBe(rec);
  });
  it('female + курс → новый объект: витекс+инозитол, оригинал не мутирован', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    expect(out).not.toBe(rec);
    expect(rec.subs.length).toBe(0);
    const ids = out.subs.map((s: any) => s.substanceId);
    expect(ids).toContain('vitex');
    expect(ids).toContain('inositol');
    expect((out as any).femaleLayer.added).toEqual(['vitex', 'inositol']);
    expect(out.rationale).toContain('♀ Женский слой');
  });
  it('дедуп: если мужская ветка уже дала vitex — добавляется только инозитол', () => {
    const rec = baseRec([{ substanceId: 'vitex', category: 'hormonal', k: 0.1, q: 'B', reason: 'x', mechsCovered: [] }]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    const ids = out.subs.map((s: any) => s.substanceId);
    expect(ids.filter((i: string) => i === 'vitex').length).toBe(1);
    expect((out as any).femaleLayer.added).toEqual(['inositol']);
  });
  it('флаги женского риска идут в protocolWarnings', () => {
    const rec = baseRec();
    rec.pedRisk = { femaleFlags: ['♀ АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ: Тренболон — женщинам нельзя'] };
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    expect(out.protocolWarnings?.join(' ')).toContain('АБСОЛЮТНОЕ');
    expect((out as any).femaleLayer.flags.length).toBe(1);
  });
  it('слой не превышает TOTAL_LIMIT уровня', () => {
    const rec = baseRec();
    (rec as any).level = 'base';
    // Заполняем base-лимит (28) заглушками
    for (let i = 0; i < 28; i++) {
      rec.subs.push({ substanceId: `stub_${i}`, category: 'other', k: 0, q: 'C', reason: '', mechsCovered: [] });
    }
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'base' } as any);
    expect(out.subs.length).toBeLessThanOrEqual(28);
    expect((out as any).femaleLayer).toBeUndefined(); // нечего добавить, флагов нет → исходный объект
  });
  it('состав слоя: 2 позиции, обе OTC-усилители', () => {
    expect(FEMALE_LAYER_SUBS.length).toBe(2);
    expect(FEMALE_LAYER_SUBS.map((s) => s.substanceId)).toEqual(['vitex', 'inositol']);
  });
});

describe('female-support-layer: integration через resolvePlan', () => {
  const stack = [{ id: 'nandrolone_decanoate', mgPerWeek: 50, form: 'inject' }];

  it('мужской план — без женского слоя; женский — с ним, мужской набор сохранён', () => {
    const male = resolvePlan(buildMapperCtx(mkState(stack, 'male'), 'medium'));
    const female = resolvePlan(buildMapperCtx(mkState(stack, 'female'), 'medium'));
    expect((male as any).femaleLayer).toBeUndefined();
    expect(male.subs.map((s) => s.substanceId)).not.toContain('vitex');
    const femIds = new Set(female.subs.map((s) => canonId(s.substanceId)));
    expect(femIds.has(canonId('vitex'))).toBe(true);
    expect(femIds.has(canonId('inositol'))).toBe(true);
    // Мужской набор целиком сохранён в женском
    for (const s of male.subs) {
      expect(femIds.has(canonId(s.substanceId)), s.substanceId).toBe(true);
    }
  });

  it('кэш не протекает: male → female → male (женский слой не мутирует базу)', () => {
    const maleCtx = buildMapperCtx(mkState(stack, 'male'), 'medium');
    const first = resolvePlan(maleCtx);
    resolvePlan(buildMapperCtx(mkState(stack, 'female'), 'medium'));
    const third = resolvePlan(buildMapperCtx(mkState(stack, 'male'), 'medium'));
    expect(third.subs.map((s) => s.substanceId)).not.toContain('vitex');
    expect((third as any).femaleLayer).toBeUndefined();
    expect(third.subs.length).toBe(first.subs.length);
  });

  it('женский тренболон: флаг противопоказания в protocolWarnings', () => {
    const female = resolvePlan(buildMapperCtx(mkState([{ id: 'tren_acet', mgPerWeek: 50 }], 'female'), 'medium'));
    expect(female.protocolWarnings?.some((w) => w.includes('АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ'))).toBe(true);
    const male = resolvePlan(buildMapperCtx(mkState([{ id: 'tren_acet', mgPerWeek: 50 }], 'male'), 'medium'));
    expect(male.protocolWarnings?.some((w) => w.includes('♀'))).toBe(false);
  });

  it('женский без курса → слоя нет', () => {
    const rec = resolvePlan(buildMapperCtx(mkState([], 'female'), 'medium'));
    expect((rec as any).femaleLayer).toBeUndefined();
    expect(rec.subs.map((s) => s.substanceId)).not.toContain('vitex');
  });
});
