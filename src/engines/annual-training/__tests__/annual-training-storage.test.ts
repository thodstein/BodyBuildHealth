/**
 * annual-training-storage.test.ts — storage и миграция годового плана.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ANNUAL_PLAN_KEY, saveAnnualTrainingPlan, loadAnnualTrainingPlan,
  removeAnnualTrainingPlan, migrateAnnualPlanFromMacroStorage,
  isAnnualTrainingPlanShape,
} from '../annual-training-storage';
import { annualPlanFromMacro } from '../block-builders.engine';
import { buildBbMacrocycle, serializeBbMacro } from '../../lms/macrocycle.engine';
import type { AnnualTrainingPlan } from '../annual-training.types';

beforeEach(() => {
  localStorage.clear();
});

describe('save/load', () => {
  it('roundtrip: сохранить → загрузить', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    const plan = annualPlanFromMacro(macro);
    saveAnnualTrainingPlan(plan);
    const loaded = loadAnnualTrainingPlan();
    expect(loaded).toBeTruthy();
    expect(loaded!.id).toBe(plan.id);
    expect(loaded!.blocks).toHaveLength(plan.blocks.length);
    expect(loaded!.blocks.every(b => b.status === 'unbuilt')).toBe(true);
  });

  it('нет ключа → null', () => {
    expect(loadAnnualTrainingPlan()).toBeNull();
  });

  it('битый JSON → null', () => {
    localStorage.setItem(ANNUAL_PLAN_KEY, '{broken');
    expect(loadAnnualTrainingPlan()).toBeNull();
  });

  it('невалидная форма → null', () => {
    localStorage.setItem(ANNUAL_PLAN_KEY, JSON.stringify({ id: 'x', blocks: [{ ref: { blockKey: 'k' }, status: 'weird' }] }));
    expect(loadAnnualTrainingPlan()).toBeNull();
  });

  it('removeAnnualTrainingPlan очищает ключ', () => {
    saveAnnualTrainingPlan(annualPlanFromMacro(buildBbMacrocycle({ level: 'intermediate' })));
    removeAnnualTrainingPlan();
    expect(loadAnnualTrainingPlan()).toBeNull();
  });

  it('isAnnualTrainingPlanShape: защита от некорректных блоков', () => {
    expect(isAnnualTrainingPlanShape({ id: 'a', totalWeeks: 12, blocks: [] })).toBe(true);
    expect(isAnnualTrainingPlanShape(null)).toBe(false);
    expect(isAnnualTrainingPlanShape({ id: 'a', blocks: [] })).toBe(false);
    expect(isAnnualTrainingPlanShape({ id: 'a', totalWeeks: 12, blocks: [{ ref: { blockKey: 'k' }, status: 'built' }] })).toBe(false);
  });
});

describe('миграция из макро-хранилищ', () => {
  it('BB-макро → план со всеми блоками BB и unbuilt', () => {
    const bbMacro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    localStorage.setItem('he_bb_macro', serializeBbMacro(bbMacro));
    const plan = migrateAnnualPlanFromMacroStorage();
    expect(plan).toBeTruthy();
    expect(plan!.totalWeeks).toBe(52);
    expect(plan!.direction).toBe('bb');
    expect(plan!.blocks.every(b => b.ref.kind === 'BB')).toBe(true);
    expect(localStorage.getItem(ANNUAL_PLAN_KEY)).toBeTruthy();
  });

  it('повторный вызов не пересоздаёт план (id стабилен)', () => {
    localStorage.setItem('he_bb_macro', serializeBbMacro(buildBbMacrocycle({ level: 'intermediate' })));
    const first = migrateAnnualPlanFromMacroStorage()!;
    const second = migrateAnnualPlanFromMacroStorage()!;
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('приоритет BB-макро над PL-макро', () => {
    localStorage.setItem('he_bb_macro', serializeBbMacro(buildBbMacrocycle({ level: 'intermediate' })));
    localStorage.setItem('he_pl_macro', JSON.stringify({ v: 7, b: [], t: 12 }));
    const plan = migrateAnnualPlanFromMacroStorage();
    expect(plan!.direction).toBe('bb');
  });

  it('нет хранилищ → null', () => {
    expect(migrateAnnualPlanFromMacroStorage()).toBeNull();
  });

  it('существующий годовой план приоритетнее макро (миграция не перезаписывает)', () => {
    const existing: AnnualTrainingPlan = annualPlanFromMacro(buildBbMacrocycle({ level: 'intermediate', totalWeeks: 20 }));
    existing.blocks[0].status = 'built';
    saveAnnualTrainingPlan(existing);
    localStorage.setItem('he_bb_macro', serializeBbMacro(buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 })));
    const plan = migrateAnnualPlanFromMacroStorage();
    expect(plan!.id).toBe(existing.id);
    expect(plan!.blocks[0].status).toBe('built');
  });
});
