/**
 * female-support-layer.test.ts — этап «женский слой» (B): аддитивное усиление плана поддержки.
 *
 * Гарантии:
 *  - мужской путь: слой не активен, тот же объект rec, ничего не добавлено;
 *  - женский: добавляет поверх мужского (ничего не удаляя), уважает TOTAL_LIMIT,
 *    не мутирует кэшированную рекомендацию; флаги риска идут в protocolWarnings.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFemaleSupport, FEMALE_LAYER_SUBS, FEMALE_BONE_SUBS, FEMALE_LAB_GATED_SUBS,
  FEMALE_ALL_LAYER_SUBS, femaleIronGate, hctAtOrAbove48, IRON_FAMILY_IDS,
} from '../female-support-layer';
import { SUPPORT_DOSING } from '../../data/support-dosing';
import { resolvePlan } from '../tz-mapper-engine';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { canonId } from '../support-plan/shared-constants';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function mkState(aas: Array<{ id: string; mgPerWeek: number; form?: string }>, sex: 'male' | 'female', fp?: any) {
  return {
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, sex },
    labs: { ...DEFAULT_STATE.labs, fullPanel: fp ?? null },
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: aas.map((a) => ({ id: a.id, doseMgWeek: a.mgPerWeek, form: a.form || 'inject' })),
    },
  } as any;
}

/** Анализы: ферритин + гематокрит (панели реального калькулятора). */
const ironLabs = (ferritin: string, hct: string) => ({
  date: '2026-09-01',
  panelIron: { Ferritin: ferritin, Iron: '12' },
  panelHematology: { HCT: hct },
});

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
  it('female + курс → новый объект: усиление + BONE-набор, оригинал не мутирован', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    expect(out).not.toBe(rec);
    expect(rec.subs.length).toBe(0);
    const ids = out.subs.map((s: any) => s.substanceId);
    for (const id of ['vitex', 'inositol', 'calcium', 'vitamin_d3', 'vitamin_k2', 'magnesium']) {
      expect(ids, id).toContain(id);
    }
    expect((out as any).femaleLayer.added).toEqual(['vitex', 'inositol', 'calcium', 'vitamin_d3', 'vitamin_k2', 'magnesium']);
    expect((out as any).femaleLayer.labels?.join(' ')).toContain('Кальций');
    expect(out.rationale).toContain('♀ Женский слой');
    // без анализов железо НЕ добавляется (тихо)
    expect(ids).not.toContain('iron_bisglycinate');
  });
  it('дедуп: если мужская ветка уже дала vitex — добавляется только инозитол из усиления', () => {
    const rec = baseRec([{ substanceId: 'vitex', category: 'hormonal', k: 0.1, q: 'B', reason: 'x', mechsCovered: [] }]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    const ids = out.subs.map((s: any) => s.substanceId);
    expect(ids.filter((i: string) => i === 'vitex').length).toBe(1);
    expect((out as any).femaleLayer.added).toContain('inositol');
    expect((out as any).femaleLayer.added).not.toContain('vitex');
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
  it('категорийный лимит: hormonal заполнен (base=1) → витекс пропущен, инозитол добавлен', () => {
    const rec = baseRec([{ substanceId: 'hcg', category: 'hormonal', k: 0.2, q: 'A', reason: 'x', mechsCovered: [] }]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'base' } as any);
    const ids = out.subs.map((s: any) => s.substanceId);
    expect(ids).not.toContain('vitex');
    expect(ids).toContain('inositol');
    expect((out as any).femaleLayer.added).toContain('inositol');
  });
  it('категорийный лимит: hormonal 2/2 на medium → витекс пропущен', () => {
    const rec = baseRec([
      { substanceId: 'hcg', category: 'hormonal', k: 0.2, q: 'A', reason: 'x', mechsCovered: [] },
      { substanceId: 'anastrozole', category: 'hormonal', k: 0.3, q: 'A', reason: 'x', mechsCovered: [] },
    ]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium' } as any);
    expect(out.subs.map((s: any) => s.substanceId)).not.toContain('vitex');
  });
  it('состав слоя: усиление 2 + BONE 4 + лаб-гейтед 1', () => {
    expect(FEMALE_LAYER_SUBS.map((s) => s.substanceId)).toEqual(['vitex', 'inositol']);
    expect(FEMALE_BONE_SUBS.map((s) => s.substanceId)).toEqual(['calcium', 'vitamin_d3', 'vitamin_k2', 'magnesium']);
    expect(FEMALE_LAB_GATED_SUBS.map((s) => s.substanceId)).toEqual(['iron_bisglycinate']);
    expect(FEMALE_ALL_LAYER_SUBS.length).toBe(7);
    // лаб-гейт есть только у условных позиций
    expect(FEMALE_LAB_GATED_SUBS.every((s) => typeof s.labGate === 'function')).toBe(true);
    expect(FEMALE_LAYER_SUBS.every((s) => !s.labGate)).toBe(true);
    expect(FEMALE_BONE_SUBS.every((s) => !s.labGate)).toBe(true);
  });
  it('все женские добавки имеют запись дозировки в реестре SUPPORT_DOSING (полнота приложения)', () => {
    for (const s of FEMALE_ALL_LAYER_SUBS) {
      const rec = SUPPORT_DOSING[s.substanceId];
      expect(rec, s.substanceId).toBeTruthy();
      expect(rec.doseRange.min, s.substanceId).toBeGreaterThan(0);
      expect(rec.doseRange.max, s.substanceId).toBeGreaterThanOrEqual(rec.doseRange.min);
    }
  });
});

describe('female-support-layer: железо по анализам (жёсткий гейт HCT<48)', () => {
  it('femaleIronGate: ферритин<30 + HCT<48 → true', () => {
    expect(femaleIronGate({ FERRITIN: 20, HEMATOCRIT: 44 })).toBe(true);
    expect(femaleIronGate({ FERRITIN: 25, HCT: 47 })).toBe(true);
  });
  it('femaleIronGate: HCT ≥48 → false (гипервязкость на курсе)', () => {
    expect(femaleIronGate({ FERRITIN: 20, HEMATOCRIT: 48 })).toBe(false);
    expect(femaleIronGate({ FERRITIN: 20, HEMATOCRIT: 52 })).toBe(false);
  });
  it('femaleIronGate: ферритин ≥30, отсутствие анализов, мусор → false', () => {
    expect(femaleIronGate({ FERRITIN: 30, HEMATOCRIT: 44 })).toBe(false);
    expect(femaleIronGate({ FERRITIN: 120, HEMATOCRIT: 44 })).toBe(false);
    expect(femaleIronGate({ HEMATOCRIT: 44 })).toBe(false);           // ферритина нет
    expect(femaleIronGate({ FERRITIN: 20 })).toBe(false);             // HCT нет
    expect(femaleIronGate(undefined)).toBe(false);
    expect(femaleIronGate({ FERRITIN: NaN, HEMATOCRIT: 44 })).toBe(false);
    expect(femaleIronGate({ FERRITIN: 20, HEMATOCRIT: 0 })).toBe(false);
  });
  it('unit: анализы дефицита → железо добавлено, метка человекочитаемая', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium', labs: { FERRITIN: 20, HEMATOCRIT: 44 } } as any);
    const ids = out.subs.map((s: any) => s.substanceId);
    expect(ids).toContain('iron_bisglycinate');
    expect((out as any).femaleLayer.added).toContain('iron_bisglycinate');
    expect((out as any).femaleLayer.labels?.some((l: string) => l.includes('Железо'))).toBe(true);
    expect(out.rationale).toContain('Железо');
  });
  it('unit: HCT 49 → железо НЕ добавлено (даже при ферритине 20)', () => {
    const rec = baseRec();
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium', labs: { FERRITIN: 20, HEMATOCRIT: 49 } } as any);
    expect(out.subs.map((s: any) => s.substanceId)).not.toContain('iron_bisglycinate');
    expect((out as any).femaleLayer?.added || []).not.toContain('iron_bisglycinate');
  });
  it('жёсткий гейт: HCT 50 + железо уже в плане (lab-tier) → ИСКЛЮЧЕНО + флаг', () => {
    const rec = baseRec([{ substanceId: 'iron_bisglycinate', category: 'mineral', k: 0.1, q: 'B', reason: 'tier', mechsCovered: [] }]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium', labs: { FERRITIN: 20, HEMATOCRIT: 50 } } as any);
    expect(out.subs.map((s: any) => s.substanceId)).not.toContain('iron_bisglycinate');
    expect((out as any).femaleLayer.removed).toEqual(['iron_bisglycinate']);
    expect(out.protocolWarnings?.join(' ')).toContain('HCT ≥48');
    expect(out.rationale).toContain('ЖЁСТКИЙ ГЕЙТ');
    // исходный объект не мутирован
    expect(rec.subs.length).toBe(1);
  });
  it('жёсткий гейт: HCT 47 + железо в плане → остаётся (без removal)', () => {
    const rec = baseRec([{ substanceId: 'iron_bisglycinate', category: 'mineral', k: 0.1, q: 'B', reason: 'tier', mechsCovered: [] }]);
    const out = applyFemaleSupport(rec, { sex: 'female', onCourse: true, level: 'medium', labs: { FERRITIN: 20, HEMATOCRIT: 47 } } as any);
    expect(out.subs.map((s: any) => s.substanceId)).toContain('iron_bisglycinate');
    expect((out as any).femaleLayer.removed).toEqual([]);
  });
  it('hctAtOrAbove48 / IRON_FAMILY_IDS: все формы железа под гейтом', () => {
    expect(hctAtOrAbove48({ HEMATOCRIT: 48 })).toBe(true);
    expect(hctAtOrAbove48({ HCT: 52 })).toBe(true);
    expect(hctAtOrAbove48({ HEMATOCRIT: 47.9 })).toBe(false);
    expect(hctAtOrAbove48({})).toBe(false);
    expect(hctAtOrAbove48(undefined)).toBe(false);
    expect(hctAtOrAbove48({ HEMATOCRIT: NaN })).toBe(false);
    for (const id of ['iron', 'iron_bisglycinate', 'iron_sulfate', 'iron_fumarate', 'iron_lipofer', 'iron_supplement']) {
      expect(IRON_FAMILY_IDS.has(id), id).toBe(true);
    }
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

  it('интеграция: женский + анализы (ферритин 20, HCT 44) → железо в плане', () => {
    const female = resolvePlan(buildMapperCtx(mkState(stack, 'female', ironLabs('20', '44')), 'medium'));
    const ids = new Set(female.subs.map((s) => canonId(s.substanceId)));
    expect(ids.has(canonId('iron_bisglycinate'))).toBe(true);
    expect((female as any).femaleLayer.removed || []).toEqual([]);
  });

  it('интеграция: женский + HCT 50 → железо вычищено гейтом; мужской путь байт-в-байт (железо остаётся)', () => {
    const female = resolvePlan(buildMapperCtx(mkState(stack, 'female', ironLabs('20', '50')), 'medium'));
    expect(female.subs.map((s) => canonId(s.substanceId))).not.toContain(canonId('iron_bisglycinate'));
    expect((female as any).femaleLayer.removed).toContain('iron_bisglycinate');
    expect(female.protocolWarnings?.join(' ')).toContain('ЖЁСТКИЙ ГЕЙТ');
    // Мужской путь НЕ затронут: layer отсутствует, поведение tier-конвейера прежнее
    const male = resolvePlan(buildMapperCtx(mkState(stack, 'male', ironLabs('20', '50')), 'medium'));
    expect((male as any).femaleLayer).toBeUndefined();
    expect(male.subs.map((s) => canonId(s.substanceId))).toContain(canonId('iron_bisglycinate'));
    // без анализов — тихо: ни добавления, ни удаления
    const noLabs = resolvePlan(buildMapperCtx(mkState(stack, 'female'), 'medium'));
    expect((noLabs as any).femaleLayer.removed || []).toEqual([]);
  });
});
