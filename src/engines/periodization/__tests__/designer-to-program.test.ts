import { describe, it, expect } from 'vitest';
import {
  designerToUserWeeks,
  applyDesignPhasesToWeeks,
  makeEmptySessionsForWeek,
  type DesignerToUserWeeksOptions,
} from '../designer-to-program';
import type { MacrocycleDesign, DesignerPhaseBlock } from '../../periodization-designer.engine';
import type { UserWeek } from '../../user-program/user-program.types';

function makeBlock(id: string, phaseKey: MacrocycleDesign['blocks'][number]['phaseKey'], startWeek: number, endWeek: number): DesignerPhaseBlock {
  return { id, phaseKey, startWeek, endWeek, notes: '' };
}

function makeDesign(blocks: DesignerPhaseBlock[], totalWeeks: number = 52): MacrocycleDesign {
  return {
    id: 'test',
    name: 'Test design',
    totalWeeks,
    blocks,
    sport: 'powerlifting',
    goal: 'strength',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('designerToUserWeeks', () => {
  it('пустой дизайн → все недели accumulation/deload=false, длина = totalWeeks', () => {
    const d = makeDesign([], 8);
    const weeks = designerToUserWeeks(d);
    expect(weeks).toHaveLength(8);
    for (const w of weeks) {
      expect(w.phase).toBe('accumulation');
      expect(w.deload).toBe(false);
      expect(w.sessions).toEqual([]);
    }
  });

  it('один блок покрывает весь диапазон → все недели с фазой блока', () => {
    const d = makeDesign([makeBlock('b1', 'intensification', 1, 6)], 6);
    const weeks = designerToUserWeeks(d);
    expect(weeks).toHaveLength(6);
    for (const w of weeks) {
      expect(w.phase).toBe('intensification');
      expect(w.deload).toBe(false);
    }
    expect(weeks.map(w => w.week)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('multi-block: разные фазы для разных диапазонов недель', () => {
    const d = makeDesign([
      makeBlock('b1', 'accumulation_hypertrophy', 1, 4),
      makeBlock('b2', 'intensification', 5, 8),
      makeBlock('b3', 'peaking', 9, 10),
      makeBlock('b4', 'deload', 11, 12),
    ], 12);
    const weeks = designerToUserWeeks(d);
    expect(weeks).toHaveLength(12);
    expect(weeks[0].phase).toBe('accumulation');
    expect(weeks[3].phase).toBe('accumulation');
    expect(weeks[4].phase).toBe('intensification');
    expect(weeks[7].phase).toBe('intensification');
    expect(weeks[8].phase).toBe('peaking');
    expect(weeks[9].phase).toBe('peaking');
    expect(weeks[10].phase).toBe('deload');
    expect(weeks[10].deload).toBe(true);
    expect(weeks[11].phase).toBe('deload');
    expect(weeks[11].deload).toBe(true);
  });

  it('deload-подобная фаза (transition) выставляет deload=true', () => {
    const d = makeDesign([makeBlock('b1', 'transition', 1, 4)], 4);
    const weeks = designerToUserWeeks(d);
    expect(weeks[0].phase).toBe('deload');
    expect(weeks[0].deload).toBe(true);
  });

  it('gap weeks (недели вне блоков) → accumulation/deload=false', () => {
    // блок покрывает только недели 1-3, а всего 6
    const d = makeDesign([makeBlock('b1', 'peaking', 1, 3)], 6);
    const weeks = designerToUserWeeks(d);
    expect(weeks[0].phase).toBe('peaking');
    expect(weeks[3].phase).toBe('accumulation');
    expect(weeks[3].deload).toBe(false);
    expect(weeks[5].phase).toBe('accumulation');
  });

  it('progresses repeated filled blocks across a long design', () => {
    const d = makeDesign([makeBlock('b1', 'accumulation_hypertrophy', 1, 4)], 20);
    const weeks = designerToUserWeeks(d, {
      fillExercises: true,
      daysPerWeek: 2,
      level: 'intermediate',
      goal: 'hypertrophy',
    });
    const weights = weeks
      .map(week => week.sessions[0]?.blocks.find(block => (block.sets[0]?.weight ?? 0) > 0)?.sets[0]?.weight)
      .filter((weight): weight is number => typeof weight === 'number');
    expect(weights.length).toBeGreaterThan(1);
    expect(Math.max(...weights)).toBeGreaterThan(Math.min(...weights));
  });

  it('пересекающиеся блоки: first-match (сортировка по startWeek)', () => {
    const d = makeDesign([
      makeBlock('b2', 'peaking', 3, 6),
      makeBlock('b1', 'intensification', 1, 6), // начинается раньше → приоритет
    ], 6);
    const weeks = designerToUserWeeks(d);
    expect(weeks[0].phase).toBe('intensification');
    expect(weeks[2].phase).toBe('intensification');
  });

  it('totalWeeks=0 → минимум 1 неделя', () => {
    const d = makeDesign([], 0);
    const weeks = designerToUserWeeks(d);
    expect(weeks).toHaveLength(1);
  });
});

describe('applyDesignPhasesToWeeks', () => {
  it('переразмечает phase/deload, сохраняя sessions', () => {
    const existing: UserWeek[] = [
      { week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'День 1', focus: '', blocks: [] }] },
      { week: 2, phase: 'accumulation', deload: false, sessions: [{ id: 's2', name: 'День 2', focus: '', blocks: [] }] },
    ];
    const d = makeDesign([
      makeBlock('b1', 'intensification', 1, 1),
      makeBlock('b2', 'deload', 2, 2),
    ], 2);
    const result = applyDesignPhasesToWeeks(existing, d);
    expect(result[0].phase).toBe('intensification');
    expect(result[0].deload).toBe(false);
    // sessions сохранены
    expect(result[0].sessions).toHaveLength(1);
    expect(result[0].sessions[0].id).toBe('s1');
    expect(result[1].phase).toBe('deload');
    expect(result[1].deload).toBe(true);
    expect(result[1].sessions[0].id).toBe('s2');
  });

  it('недели вне блоков сохраняют свою phase', () => {
    const existing: UserWeek[] = [
      { week: 1, phase: 'peaking', deload: false, sessions: [] },
      { week: 2, phase: 'accumulation', deload: false, sessions: [] },
    ];
    const d = makeDesign([makeBlock('b1', 'deload', 2, 2)], 2);
    const result = applyDesignPhasesToWeeks(existing, d);
    expect(result[0].phase).toBe('peaking'); // не тронут (вне блоков)
    expect(result[1].phase).toBe('deload'); // переразмечен
  });
});

describe('makeEmptySessionsForWeek', () => {
  it('создаёт N сессий с корректными dayOfWeek', () => {
    const sessions = makeEmptySessionsForWeek(4);
    expect(sessions).toHaveLength(4);
    expect(sessions.map(s => s.dayOfWeek)).toEqual([0, 1, 2, 3]); // Пн/Вт/Ср/Чт
    for (const s of sessions) {
      expect(s.blocks).toEqual([]);
      expect(s.focus).toBe('');
    }
  });

  it('ограничивает дни 1..7', () => {
    expect(makeEmptySessionsForWeek(0)).toHaveLength(1);
    expect(makeEmptySessionsForWeek(10)).toHaveLength(7);
  });
});
