import { describe, it, expect } from 'vitest';
import { resolveEffectiveVolumeScheme, resolveEffectiveMethodology, namedSystemNote } from '../bb-scheme-resolve';
import { buildBBPlan } from '../../../../engines/bb/bb-builder.engine';

/**
 * Профессиональная библиотека: схема/методика именного цикла применяются
 * в ПРОФ-цикл-ветке и НЕ меняют generic-ветку (parity).
 */

const WM = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40 };
const repsOf = (plan: any) => plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).flatMap((e: any) => e.workSets || []).map((x: any) => x.reps);

describe('Резолвер схемы/методики: ПРОФ-цикл vs generic', () => {
  it('generic (meta не передан) — поведение прежнее', () => {
    expect(resolveEffectiveVolumeScheme('standard', 'standard')).toBe('standard');
    expect(resolveEffectiveVolumeScheme('standard', 'high')).toBe('gvt'); // объёмный режим форсит GVT
    expect(resolveEffectiveVolumeScheme('gironda', 'standard')).toBe('gironda');
    expect(resolveEffectiveMethodology('compound_first')).toBe('compound_first');
  });

  it('ПРОФ-цикл: дефолт meta применяется, когда пользователь не выбрал', () => {
    expect(resolveEffectiveVolumeScheme('standard', 'standard', { volumeScheme: 'gvt' })).toBe('gvt');
    expect(resolveEffectiveVolumeScheme('standard', 'standard', { volumeScheme: 'gironda' })).toBe('gironda');
    expect(resolveEffectiveVolumeScheme('standard', 'standard', { volumeScheme: 'fst7' })).toBe('fst7');
    expect(resolveEffectiveMethodology('compound_first', { methodology: 'mountain_dog' })).toBe('mountain_dog');
    expect(resolveEffectiveMethodology('compound_first', { methodology: 'fst7' })).toBe('fst7');
  });

  it('явный выбор пользователя приоритетнее meta; high-режим приоритетнее meta', () => {
    expect(resolveEffectiveVolumeScheme('gironda', 'standard', { volumeScheme: 'gvt' })).toBe('gironda');
    expect(resolveEffectiveMethodology('pre_exhaust', { methodology: 'mountain_dog' })).toBe('pre_exhaust');
    expect(resolveEffectiveVolumeScheme('standard', 'high', { volumeScheme: 'gironda' })).toBe('gvt');
  });

  it('заметка «именная система применена» — только когда взята из meta', () => {
    expect(namedSystemNote({ volumeScheme: 'gvt' }, 'gvt', 'compound_first', 'standard', 'compound_first')).toContain('GVT');
    expect(namedSystemNote({ methodology: 'mountain_dog' }, 'standard', 'mountain_dog', 'standard', 'compound_first')).toContain('mountain dog');
    // пользователь переопределил — заметки нет
    expect(namedSystemNote({ volumeScheme: 'gvt' }, 'gironda', 'compound_first', 'gironda', 'compound_first')).toBeNull();
    // meta нет — заметки нет
    expect(namedSystemNote(undefined, 'standard', 'compound_first', 'standard', 'compound_first')).toBeNull();
  });
});

describe('Generic-билдер: схема пользователя реально применяется', () => {
  it('volumeScheme=gvt → 10-повторные рабочие сеты', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 4, workMax: WM, volumeScheme: 'gvt' } as any);
    expect(repsOf(plan).filter((r: number) => r === 10).length).toBeGreaterThan(0);
  });

  it('volumeScheme=gironda → 8-повторные рабочие сеты', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 4, workMax: WM, volumeScheme: 'gironda' } as any);
    expect(repsOf(plan).filter((r: number) => r === 8).length).toBeGreaterThan(0);
  });
});
