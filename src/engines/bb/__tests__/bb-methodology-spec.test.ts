/**
 * bb-methodology-spec.test.ts — итерация A: «методика = протокол».
 *
 * Проверяем не текст ради текста, а три вещи:
 *  1) у каждой методики есть полный спек (иначе UI/билдер расходятся);
 *  2) протокольные поля (схема объёма, финишер, отдых) заполнены там, где
 *     методика их обещает, и пусты там, где не обещает;
 *  3) подписи UI собираются из спека (честная оговорка не теряется).
 */
import { describe, expect, it } from 'vitest';
import { METHODOLOGY_SPECS, methodologyLabelRu, methodologyOptions, methodologySpecFor } from '../bb-methodology-spec';
import type { SessionMethodology } from '../bb-session-order.engine';

const ALL: SessionMethodology[] = ['compound_first', 'pre_exhaust', 'post_exhaust', 'mountain_dog', 'fst7', 'hyperemia'];

describe('METHODOLOGY_SPEC: полнота', () => {
  it('каждая из 6 методик описана полным спеком', () => {
    for (const id of ALL) {
      const spec = METHODOLOGY_SPECS[id];
      expect(spec, id).toBeTruthy();
      expect(spec.id).toBe(id);
      expect(spec.labelRu.length, id).toBeGreaterThan(3);
      expect(spec.orderNote.length, id).toBeGreaterThan(20);
      expect(spec.honestNote.length, id).toBeGreaterThan(20);
      expect(spec.evidence.length, id).toBeGreaterThan(5);
      expect(Number.isFinite(spec.restDeltaSec), id).toBe(true);
      expect(spec.restFloorSec, id).toBeGreaterThanOrEqual(30);
    }
  });

  it('неизвестная методика → безопасный дефолт, а не падение', () => {
    expect(methodologySpecFor('nonsense').id).toBe('compound_first');
    expect(methodologySpecFor(undefined).id).toBe('compound_first');
    expect(methodologyLabelRu('nonsense')).toBe(METHODOLOGY_SPECS.compound_first.labelRu);
  });
});

describe('METHODOLOGY_SPEC: протокольные поля', () => {
  it('FST-7 включает схему объёма и 7-сетовый финишер', () => {
    const spec = METHODOLOGY_SPECS.fst7;
    expect(spec.impliedVolumeScheme).toBe('fst7');
    expect(spec.finisher?.sets).toBe(7);
    expect(spec.finisher?.technique).toBe('fst7');
    expect(spec.finisher?.restSec).toBeLessThanOrEqual(45);
  });

  it('hyperemia сокращает отдых, но не опускает его ниже пола', () => {
    const spec = METHODOLOGY_SPECS.hyperemia;
    expect(spec.restDeltaSec).toBeLessThan(0);
    expect(spec.restFloorSec).toBeGreaterThanOrEqual(45);
  });

  it('остальные методики не обещают того, чего движок не делает', () => {
    for (const id of ['compound_first', 'post_exhaust', 'mountain_dog'] as SessionMethodology[]) {
      expect(METHODOLOGY_SPECS[id].impliedVolumeScheme, id).toBeUndefined();
      expect(METHODOLOGY_SPECS[id].finisher, id).toBeUndefined();
      expect(METHODOLOGY_SPECS[id].restDeltaSec, id).toBe(0);
    }
    // pre_exhaust меняет вес базы (×0.9), а не отдых.
    expect(METHODOLOGY_SPECS.pre_exhaust.restDeltaSec).toBe(0);
  });
});

describe('METHODOLOGY_SPEC: подписи UI', () => {
  it('селектор получает все 6 вариантов с честной оговоркой', () => {
    const opts = methodologyOptions();
    expect(opts.map(o => o.id)).toEqual(ALL);
    for (const o of opts) {
      expect(o.desc).toContain(METHODOLOGY_SPECS[o.id].honestNote);
    }
  });
});
