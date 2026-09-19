import { describe, it, expect } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { BB_CORRECTIVES, correctiveById } from '../bb-corrective.engine';
import { resistanceProfileOf } from '../bb-sfr-db';
import { WEAK_TO_MUSCLE } from '../bb-builder.engine';

/**
 * K1 (BB-CORRECTIVE-HUB-PRO-PLAN): «title не врёт» — смысловые локи записи ↔ упражнение.
 * Раньше: «Французский (длина)» → кикбэк, «Разгибания на блоке» → брусья,
 * «Наружная ротация» → face pull, «Жим нейтральным» → тяга, «трап» → гакк.
 */
const IDS = new Set((EXERCISE_CATALOG as any[]).map((c) => String(c.id).toLowerCase()));
const cat = (id: string) => (EXERCISE_CATALOG as any[]).find((c) => String(c.id).toLowerCase() === id.toLowerCase());

describe('bb-corrective K1: title не врёт', () => {
  it('трицепс-длина — реальная растянутая головка (не кикбэк)', () => {
    const c = correctiveById('tri-overhead-length')!;
    expect(c.exerciseId).not.toMatch(/kickback/i);
    const ex = cat(c.exerciseId)!;
    expect(ex).toBeTruthy();
    expect(String(ex.name)).toMatch(/француз|над головой/i);
    expect(resistanceProfileOf({ id: c.exerciseId, name: ex.name })).toBe('lengthened');
  });
  it('трицепс-пик — реальный блочный pushdown (не брусья)', () => {
    const c = correctiveById('tri-pushdown-peak')!;
    const ex = cat(c.exerciseId)!;
    expect(String(ex.name)).toMatch(/разгибание на блоке/i);
    expect(c.exerciseId).not.toMatch(/dips/i);
  });
  it('ER:IR-ротация — наружная ротация, не тяга к лицу', () => {
    const c = correctiveById('dr-erir-rotation')!;
    const ex = cat(c.exerciseId)!;
    expect(String(ex.name)).toMatch(/наружная ротация/i);
    expect(c.exerciseId).not.toMatch(/face.?pull/i);
  });
  it('«жим нейтральным» переименован в тягу — подпись соответствует упражнению', () => {
    const c = correctiveById('sh-neutral-press')!;
    expect(c.title).not.toMatch(/жим/i);
    const ex = cat(c.exerciseId)!;
    expect(String(ex.name)).toMatch(/тяга/i);
  });
  it('трап-запись — реальный трап-гриф', () => {
    const c = correctiveById('lh-trap-swap')!;
    expect(c.title).toMatch(/трап/i);
    const ex = cat(c.exerciseId)!;
    expect(`${c.exerciseId} ${ex.name}`.toLowerCase()).toMatch(/trap|трап/);
  });
  it('кью про штанговый хват — на штанге, а не на гантелях', () => {
    const c = correctiveById('cu-bench-neutral')!;
    const ex = cat(c.exerciseId)!;
    expect(String(ex.equipment)).toBe('barbell');
    expect(c.cues.join(' ')).toMatch(/хват/i);
    expect(c.targets).toContain('bench-fix');
  });
  it('разводка не приписана низу груди; низ груди закрыт реальным жимом', () => {
    expect(correctiveById('ch-fly-stretch')!.targets).not.toContain('chest_lower');
    const lower = BB_CORRECTIVES.filter((c) => c.targets.includes('chest_lower'));
    expect(lower.length).toBeGreaterThanOrEqual(2);
    expect(lower.some((c) => /жим|отжим/i.test(String(cat(c.exerciseId)?.name || '')))).toBe(true);
  });
  it('шарнир-учеба не уезжает в core-мышцу (учёт объёма не ломается)', () => {
    const c = correctiveById('core-hinge-rdl')!;
    expect(c.targets).not.toContain('core');
    expect(c.targets).not.toContain('driver:core');
    expect(c.targets).toContain('hamstrings');
  });
  it('аддуктор маппится в каноническую мышцу (инъекция/вес не «мимо»)', () => {
    expect(WEAK_TO_MUSCLE['adductor']).toBeTruthy();
    expect(WEAK_TO_MUSCLE['adductor']).toBe('glutes');
  });
  it('все записи с «(длина» в заголовке — lengthened-профиль', () => {
    const length = BB_CORRECTIVES.filter((c) => /\(длина/.test(c.title));
    expect(length.length).toBeGreaterThanOrEqual(4);
    for (const c of length) {
      const ex = cat(c.exerciseId);
      expect(ex, `${c.id} → ${c.exerciseId}`).toBeTruthy();
      expect(resistanceProfileOf({ id: c.exerciseId, name: ex.name }), c.id).toBe('lengthened');
    }
  });
  it('equipmentAlt: все id реальны (lock)', () => {
    const miss: string[] = [];
    for (const c of BB_CORRECTIVES) for (const alt of c.equipmentAlt) if (!IDS.has(alt.toLowerCase())) miss.push(`${c.id}→${alt}`);
    expect(miss).toEqual([]);
  });
});
