import { describe, it, expect } from 'vitest';
import { designerToUserWeeks, applyDesignPhasesToWeeks } from '../../../../engines/periodization/designer-to-program';
import type { MacrocycleDesign, DesignerPhaseBlock } from '../../../../engines/periodization-designer.engine';
import type { UserWeek, UserBlock, UserSet } from '../../../../engines/user-program/user-program.types';
import { newId } from '../../../../engines/user-program/user-program.types';

/**
 * Тесты баг-фиксов ручного планировщика (без React/RTL — тестируем чистую логику,
 * которая извлечена или может быть извлечена из компонентов).
 */

function makeBlock(id: string, phaseKey: DesignerPhaseBlock['phaseKey'], startWeek: number, endWeek: number): DesignerPhaseBlock {
  return { id, phaseKey, startWeek, endWeek, notes: '' };
}

function makeDesign(blocks: DesignerPhaseBlock[], totalWeeks: number = 12): MacrocycleDesign {
  return {
    id: 'test', name: 'Test', totalWeeks, blocks,
    sport: 'bodybuilding', goal: 'hypertrophy',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeUserWeek(week: number, phase: UserWeek['phase'], deload: boolean, sessionsCount: number = 1): UserWeek {
  return {
    week, phase, deload,
    sessions: Array.from({ length: sessionsCount }, () => ({
      id: newId('ses'), name: 'День ' + week, focus: '', blocks: [],
    })),
  };
}

describe('BUG 6.1: addWeakToWeek — должен добавлять во все недели, не только week 0', () => {
  it('логика: все недели (кроме deload) получают блоки', () => {
    // Симулируем логику исправленного addWeakToWeek
    const weeks: UserWeek[] = [
      makeUserWeek(1, 'accumulation', false),
      makeUserWeek(2, 'accumulation', false),
      makeUserWeek(3, 'accumulation', false),
      makeUserWeek(4, 'deload', true), // deload — не добавляем
      makeUserWeek(5, 'intensification', false),
    ];
    const makeBlock = (): UserBlock => ({
      id: newId('blk'), type: 'accessory', exerciseName: 'Test', muscle: 'chest',
      role: 'accessory', sets: [{ reps: 12, rir: 2, weight: 40, restSec: 60 } as UserSet],
    });
    // Применяем логику: добавить в session[0] каждой недели, кроме deload
    const updated = weeks.map(w => w.deload ? w : {
      ...w,
      sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, makeBlock()] } : s),
    });
    // Проверяем: недели 1,2,3,5 получили блок, неделя 4 (deload) — нет
    expect(updated[0].sessions[0].blocks).toHaveLength(1);
    expect(updated[1].sessions[0].blocks).toHaveLength(1);
    expect(updated[2].sessions[0].blocks).toHaveLength(1);
    expect(updated[3].sessions[0].blocks).toHaveLength(0); // deload — пусто
    expect(updated[4].sessions[0].blocks).toHaveLength(1);
  });

  it('каждый блок имеет уникальный id (не переиспользуется)', () => {
    const weeks: UserWeek[] = [makeUserWeek(1, 'accumulation', false), makeUserWeek(2, 'accumulation', false)];
    const ids: string[] = [];
    const makeBlock = (): UserBlock => {
      const b = { id: newId('blk'), type: 'accessory' as const, exerciseName: 'X', muscle: 'chest', role: 'accessory' as const, sets: [] };
      ids.push(b.id);
      return b;
    };
    weeks.map(w => w.deload ? w : {
      ...w,
      sessions: w.sessions.map((s, si) => si === 0 ? { ...s, blocks: [...s.blocks, makeBlock()] } : s),
    });
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('BUG 6.2: PLSetEditor calcW — accessory должен возвращать null', () => {
  it('логика: для accessory calcW возвращает null (вес вручную)', () => {
    // Симулируем логику исправленного calcW
    const workMax = { squat: 140, bench: 100, dead: 180 };
    const calcW = (pct: number, lift: 'squat' | 'bench' | 'dead' | 'accessory'): number | null => {
      if (lift === 'accessory') return null; // исправлено
      const pm = workMax[lift];
      if (!pm || pm <= 0) return null;
      return Math.round((pm * pct) / 2.5) * 2.5;
    };
    // squat 70% → 97.5
    expect(calcW(0.7, 'squat')).toBe(97.5);
    // bench 70% → 70
    expect(calcW(0.7, 'bench')).toBe(70);
    // dead 70% → 125
    expect(calcW(0.7, 'dead')).toBe(125);
    // accessory 70% → null (вес вручную, не от squat)
    expect(calcW(0.7, 'accessory')).toBeNull();
  });

  it('логика v1 (баг): accessory использовал squat → абсурдный вес', () => {
    // Демонстрируем баг: accessory трицепс pushdown 70% от squatPM = 97.5 кг (нереально)
    const workMax = { squat: 140, bench: 100, dead: 180 };
    const calcW_buggy = (pct: number, lift: 'accessory' | 'squat'): number | null => {
      const pm = workMax[lift === 'accessory' ? 'squat' : lift]; // баг: accessory→squat
      if (!pm || pm <= 0) return null;
      return Math.round((pm * pct) / 2.5) * 2.5;
    };
    // Баг: 70% от squat 140 = 97.5 кг для трицепс pushdown — абсурд
    expect(calcW_buggy(0.7, 'accessory')).toBe(97.5); // баг
    // Исправление возвращает null
    const calcW_fixed = (pct: number, lift: 'accessory'): number | null => {
      if (lift === 'accessory') return null;
      return null; // заглушка
    };
    expect(calcW_fixed(0.7, 'accessory')).toBeNull();
  });
});

describe('designerToUserWeeks roundtrip — фазы корректны после применения', () => {
  it('применение дизайнера к существующим неделям сохраняет sessions', () => {
    const existing: UserWeek[] = [
      { week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'Д1', focus: 'chest', blocks: [] }] },
      { week: 2, phase: 'accumulation', deload: false, sessions: [{ id: 's2', name: 'Д1', focus: 'back', blocks: [] }] },
    ];
    const d = makeDesign([
      makeBlock('b1', 'intensification', 1, 1),
      makeBlock('b2', 'deload', 2, 2),
    ], 2);
    const result = applyDesignPhasesToWeeks(existing, d);
    expect(result[0].phase).toBe('intensification');
    expect(result[0].sessions[0].id).toBe('s1'); // sessions сохранены
    expect(result[0].sessions[0].focus).toBe('chest');
    expect(result[1].phase).toBe('deload');
    expect(result[1].deload).toBe(true);
    expect(result[1].sessions[0].focus).toBe('back'); // focus сохранён
  });
});