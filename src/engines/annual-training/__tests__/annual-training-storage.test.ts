/**
 * annual-training-storage.test.ts — storage и миграция годового плана.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ANNUAL_PLAN_KEY, saveAnnualTrainingPlan, loadAnnualTrainingPlan,
  removeAnnualTrainingPlan, migrateAnnualPlanFromMacroStorage,
  isAnnualTrainingPlanShape,
  ANNUAL_SCENARIOS_KEY, saveAnnualScenario, loadAnnualScenarios, removeAnnualScenario,
  restoreAnnualScenario, compareAnnualScenarios,
  saveAnnualCardioCycles, loadAnnualCardioCycles, removeAnnualCardioCycles,
} from '../annual-training-storage';
import { annualPlanFromMacro, setAnnualBlockKind } from '../block-builders.engine';
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

describe('снапшоты сборки года (сценарии)', () => {
  beforeEach(() => localStorage.clear());

  const basePlan = () => annualPlanFromMacro(buildBbMacrocycle({ level: 'intermediate', totalWeeks: 16 }));

  it('save/load: снимок сохраняется и загружается', () => {
    const plan = basePlan();
    saveAnnualScenario(plan, 'Тест');
    const list = loadAnnualScenarios();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Тест');
    expect(list[0].plan.blocks).toHaveLength(plan.blocks.length);
    expect(localStorage.getItem(ANNUAL_SCENARIOS_KEY)).toBeTruthy();
  });

  it('кап 6: старые снимки вытесняются', () => {
    for (let i = 0; i < 8; i++) saveAnnualScenario(basePlan(), `S${i}`);
    expect(loadAnnualScenarios()).toHaveLength(6);
    expect(loadAnnualScenarios()[0].label).toBe('S7');
  });

  it('remove: удаляет снимок', () => {
    saveAnnualScenario(basePlan(), 'A');
    const id = loadAnnualScenarios()[0].id;
    removeAnnualScenario(id);
    expect(loadAnnualScenarios()).toHaveLength(0);
  });

  it('restore: возвращает глубокую копию (мутация не влияет на снимок)', () => {
    saveAnnualScenario(basePlan(), 'A');
    const id = loadAnnualScenarios()[0].id;
    const restored = restoreAnnualScenario(id)!;
    restored.blocks[0].status = 'built';
    const again = restoreAnnualScenario(id)!;
    expect(again.blocks[0].status).toBe('unbuilt');
  });

  it('compare: идентичные снапшоты → «идентичны»', () => {
    const plan = basePlan();
    const a = saveAnnualScenario(plan, 'A');
    const b = saveAnnualScenario(plan, 'B');
    const { diffs, summary } = compareAnnualScenarios(a[0], b[0]);
    expect(diffs).toHaveLength(0);
    expect(summary).toBe('Снапшоты идентичны');
  });

  it('compare: смена конструктора блока → дифф с kindChanged и сводкой', () => {
    const plan = basePlan();
    const a = saveAnnualScenario(plan, 'A');
    const changed = setAnnualBlockKind(plan, plan.blocks[0].ref.blockKey, 'MANUAL');
    const b = saveAnnualScenario(changed, 'B');
    const { diffs, summary } = compareAnnualScenarios(a[0], b[0]);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0].kindA).toBe('BB');
    expect(diffs[0].kindB).toBe('MANUAL');
    expect(summary).toContain('конструктор 1');
  });
});

describe('кардио-циклы года (blockKey → cycleId)', () => {
  const KEY = 'he_annual_cardio_cycles';

  it('save/load: маппинг сохраняется и загружается', () => {
    saveAnnualCardioCycles({ block1: 'cardio-a', block2: 'cardio-b' });
    const loaded = loadAnnualCardioCycles();
    expect(loaded).toEqual({ block1: 'cardio-a', block2: 'cardio-b' });
    expect(localStorage.getItem(KEY)).toContain('cardio-a');
  });

  it('нет ключа / битый JSON / невалидная форма → {}', () => {
    expect(loadAnnualCardioCycles()).toEqual({});
    localStorage.setItem(KEY, '{broken');
    expect(loadAnnualCardioCycles()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    expect(loadAnnualCardioCycles()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify(['cardio-x']));
    expect(loadAnnualCardioCycles()).toEqual({});
  });

  it('removeAnnualCardioCycles очищает ключ', () => {
    saveAnnualCardioCycles({ block1: 'cardio-a' });
    removeAnnualCardioCycles();
    expect(loadAnnualCardioCycles()).toEqual({});
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
