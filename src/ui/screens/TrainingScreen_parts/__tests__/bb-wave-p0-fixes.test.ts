/**
 * bb-wave-p0-fixes.test.ts — Волна 1 мастер-плана (docs/BB-AUTO-MASTER-PLAN.md §2).
 *
 * Source-guard'ы (jsdom-рендер god-компонента BbAutoConstructor виснет — пред-существующее,
 * см. bb-hub-payload-consume.test.ts) + юнит-проверки чистых хелперов.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonTechniqueId } from '../bb-technique-display';

const DIR = resolve(__dirname, '..');
const SRC = readFileSync(resolve(DIR, 'BbAutoConstructor.tsx'), 'utf8');
const ADJ = readFileSync(resolve(DIR, 'bb-step-adjust.tsx'), 'utf8');

describe('§2.1/2.2: bridge Library→BB (pending при монтировании, program-форма, clear)', () => {
  it('BbAutoConstructor читает pending и чистит после обработки', () => {
    expect(SRC).toContain('getPlannerApply()');
    expect(SRC).toContain('clearPlannerApply()');
    expect(SRC).toContain('const pending = getPlannerApply()');
    expect(SRC).toContain("pending.kind === 'program'");
  });

  it('program-ветка конвертирует SRCycleTemplate в FullProgram и никлает customProgram=null', () => {
    expect(SRC).toContain('cycleTemplateToFullProgram(d as SRCycleTemplate)');
    expect(SRC).toContain('applyProgramToBb(prog)');
    expect(SRC).not.toContain('setCustomProgram(null)');
  });

  it('payload поддерживает обе формы и не роняет обработчик', () => {
    expect(SRC).toContain('d?.program && !d?.meta');
    expect(SRC).toContain('d?.meta?.id');
    expect(SRC).toContain("console.warn('[BB-auto] planner-bridge:'");
  });

  it('свежесть pending ограничена (≤5 мин)', () => {
    expect(SRC).toContain('Date.now() - (pending.ts ?? 0) < 5 * 60_000');
  });
});

describe('§2.3: редактор техник пишет в последний workSet каноничным id', () => {
  it('canonTechniqueId приводит UI-легаси к движку', () => {
    expect(canonTechniqueId('myo_rep')).toBe('myo_reps');
    expect(canonTechniqueId('21s')).toBe('twenty_ones');
    expect(canonTechniqueId('dropset')).toBe('drop_set');
    expect(canonTechniqueId('drop_set')).toBe('drop_set');
    expect(canonTechniqueId('negative')).toBe('negative');
    expect(canonTechniqueId('none')).toBeNull();
    expect(canonTechniqueId(null)).toBeNull();
    expect(canonTechniqueId(undefined)).toBeNull();
  });

  it('applyEditsToPlan пишет технику в последний workSet и не оставляет intensityTechUsed', () => {
    expect(SRC).toContain('(edited.workSets[edited.workSets.length - 1] as any).technique = canonTech');
    expect(SRC).not.toContain('intensityTechUsed');
  });

  it('селектор техник использует канонические id', () => {
    expect(ADJ).toContain("{ id: 'myo_reps'");
    expect(ADJ).toContain("{ id: 'twenty_ones'");
    expect(ADJ).not.toContain("{ id: 'myo_rep'");
    expect(ADJ).not.toContain("{ id: '21s'");
    expect(ADJ).toContain('canonTechniqueId');
  });
});

describe('§2.4/2.5/2.6: UI-разрывы', () => {
  it('onGoalChange не молчаливый no-op (честное сообщение)', () => {
    expect(SRC).not.toContain('onGoalChange={() => undefined}');
    expect(SRC).toContain('Годовой план ББ-авто — всегда «Бодибилдинг»');
  });

  it('лимит вставок — из движка, не хардкод 10', () => {
    expect(SRC).toContain('const maxExForInsert');
    expect(SRC).toContain('exercises.length < maxExForInsert');
    expect(SRC).toContain('exercises.length >= maxExForInsert');
    expect(SRC).not.toContain('exercises.length < 10');
    expect(SRC).not.toContain('exercises.length >= 10');
  });

  it('калибровка сохраняет полный metadata-слепок методик', () => {
    expect(SRC).toContain('setBuiltPlan((prev) => ({\n      ...(prev || {}),\n      ...plan,\n      trainingVolumeMode,');
  });

  it('карточка оптимизации частоты рендерится (была write-only)', () => {
    expect(SRC).toContain('data-bb="freq-opt"');
    expect(SRC).toContain('freqOptResult.recommendations');
  });
});
