/**
 * arm-year-step.test.tsx — шаг года: серия → блоки → сборка.
 *
 * Блоки preview (фазы/приоритеты/именные циклы) + сборка каждым
 * buildArmBlock (тейпер A/B, пики, предупреждения) + запись собранного
 * года в общий годовой план (annual, направление arm).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { loadAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';
import { armYearBlocksToMacro } from '../../../../engines/arm/arm-annual';
import { annualPlanFromMacro } from '../../../../engines/annual-training/block-builders.engine';

beforeEach(() => {
  localStorage.clear();
});

function goYear() {
  const r = render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '🗓 Год' }));
  return r;
}

describe('Arm year step', () => {
  it('блоки серии на месте: фазы, приоритеты, именные циклы', () => {
    const { container } = goYear();
    const blocks = container.querySelector("[data-arm='year-blocks']");
    expect(blocks, 'blocks').not.toBeNull();
    expect(blocks!.querySelectorAll('.ad-bio').length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toContain('приоритет');
    expect(document.body.textContent).toContain('Цикл:');
  });

  it('смена серии перестраивает блоки', () => {
    const { container } = goYear();
    const before = container.querySelector("[data-arm='year-blocks']")!.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'WAF Worlds' }));
    const after = container.querySelector("[data-arm='year-blocks']")!.textContent;
    expect(after).not.toBe(before);
  });

  it('сборка года: busy-строка, итог с тейперами, без фриза', async () => {
    const { container } = goYear();
    fireEvent.click(screen.getByText('🗓 Собрать год'));
    expect(screen.getByText('⏳ Собираем год…')).toBeTruthy();
    const res = await screen.findByText('🗓 Год собран', { exact: false });
    expect(res).toBeTruthy();
    expect(container.querySelector("[data-arm='year-result']")).not.toBeNull();
    expect(document.body.textContent).toContain('тейпер');
  }, 60000);

  it('собранный год уходит в общий годовой план как ARM-блоки', async () => {
    goYear();
    fireEvent.click(screen.getByText('🗓 Собрать год'));
    await screen.findByText('🗓 Год собран', { exact: false });
    const stored = loadAnnualTrainingPlan();
    expect(stored).toBeTruthy();
    expect(stored!.direction).toBe('arm');
    expect(stored!.blocks.length).toBeGreaterThanOrEqual(1);
    expect(stored!.blocks.every(b => b.ref.kind === 'ARM')).toBe(true);
    expect(stored!.blocks.some(b => b.status === 'built' && !!b.result?.armPlan)).toBe(true);
  }, 60000);
});

describe('armYearBlocksToMacro', () => {
  it('превью-блоки серии дают ARM-макро с непрерывными weekOffset', () => {
    const macro = armYearBlocksToMacro([
      { blockKey: 'a1', weeks: 4, phase: 'base', priority: 'C', focus: 'База' },
      { blockKey: 'a2', weeks: 3, phase: 'strength', priority: 'B', focus: 'Сила' },
      { blockKey: 'a3', weeks: 2, phase: 'peaking', priority: 'A', focus: 'Пик' },
    ]);
    expect(macro.type).toBe('arm');
    expect(macro.totalWeeks).toBe(9);
    expect(macro.blocks.map(b => b.phase)).toEqual(['hypertrophy', 'strength', 'peaking']);
    expect(macro.blocks.map(b => b.weekOffset)).toEqual([0, 4, 7]);
    expect(macro.blocks[2].competitionPriority).toBe('A');
    const plan = annualPlanFromMacro(macro);
    expect(plan.direction).toBe('arm');
    expect(plan.blocks.every(b => b.ref.kind === 'ARM')).toBe(true);
  });
});
