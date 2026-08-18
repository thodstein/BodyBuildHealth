import { describe, it, expect } from 'vitest';
import {
  designFingerprint,
  linkDesignToProgram,
  unlinkDesignFromProgram,
  isProgramDesignStale,
  reapplyDesignToProgram,
} from '../designer-to-program';
import type { MacrocycleDesign, DesignerPhaseBlock } from '../../periodization-designer.engine';
import type { UserProgram, UserWeek } from '../../user-program/user-program.types';

function makeBlock(id: string, phaseKey: MacrocycleDesign['blocks'][number]['phaseKey'], startWeek: number, endWeek: number, notes = ''): DesignerPhaseBlock {
  return { id, phaseKey, startWeek, endWeek, notes };
}

function makeDesign(blocks: DesignerPhaseBlock[], totalWeeks: number = 52, name = 'Test design'): MacrocycleDesign {
  return {
    id: 'design-1',
    name,
    totalWeeks,
    blocks,
    sport: 'bodybuilding',
    goal: 'hypertrophy',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeProgram(over: Partial<UserProgram> = {}): UserProgram {
  const weeks: UserWeek[] = [
    { week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'День 1', focus: '', blocks: [] }] },
    { week: 2, phase: 'accumulation', deload: false, sessions: [{ id: 's2', name: 'День 2', focus: '', blocks: [] }] },
  ];
  return {
    meta: { id: 'prog-1', title: 'Программа', direction: 'bb', goal: 'hypertrophy', level: 'intermediate', daysPerWeek: 2, weeks: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
    bb: { direction: 'bb', weeks, sourceCycleId: null, constraints: { equipment: [] }, progression: { loadStrategy: 'double_progression' } },
    ...over,
  };
}

describe('designFingerprint', () => {
  it('детерминирован для одного и того же дизайна', () => {
    const d = makeDesign([makeBlock('b1', 'accumulation_hypertrophy', 1, 4)], 8);
    expect(designFingerprint(d)).toBe(designFingerprint(makeDesign([makeBlock('b1', 'accumulation_hypertrophy', 1, 4)], 8)));
  });

  it('не зависит от порядка блоков', () => {
    const a = makeDesign([
      makeBlock('b1', 'accumulation_hypertrophy', 1, 4),
      makeBlock('b2', 'intensification', 5, 8),
    ], 8);
    const b = makeDesign([
      makeBlock('b2', 'intensification', 5, 8),
      makeBlock('b1', 'accumulation_hypertrophy', 1, 4),
    ], 8);
    expect(designFingerprint(a)).toBe(designFingerprint(b));
  });

  it('меняется при правке блока (фаза)', () => {
    const a = makeDesign([makeBlock('b1', 'accumulation_hypertrophy', 1, 4)], 8);
    const b = makeDesign([makeBlock('b1', 'intensification', 1, 4)], 8);
    expect(designFingerprint(a)).not.toBe(designFingerprint(b));
  });

  it('меняется при правке границ блока', () => {
    const a = makeDesign([makeBlock('b1', 'peaking', 1, 3)], 8);
    const b = makeDesign([makeBlock('b1', 'peaking', 1, 4)], 8);
    expect(designFingerprint(a)).not.toBe(designFingerprint(b));
  });

  it('меняется при правке заметки блока', () => {
    const a = makeDesign([makeBlock('b1', 'peaking', 1, 3, 'старая')], 8);
    const b = makeDesign([makeBlock('b1', 'peaking', 1, 3, 'новая')], 8);
    expect(designFingerprint(a)).not.toBe(designFingerprint(b));
  });

  it('меняется при смене totalWeeks', () => {
    const a = makeDesign([makeBlock('b1', 'peaking', 1, 3)], 8);
    const b = makeDesign([makeBlock('b1', 'peaking', 1, 3)], 12);
    expect(designFingerprint(a)).not.toBe(designFingerprint(b));
  });
});

describe('linkDesignToProgram / unlinkDesignFromProgram', () => {
  it('ставит designRef с актуальным хэшем', () => {
    const d = makeDesign([makeBlock('b1', 'accumulation_hypertrophy', 1, 2)], 2);
    const linked = linkDesignToProgram(makeProgram(), d);
    expect(linked.meta.designRef).toEqual({ id: 'design-1', name: 'Test design', hash: designFingerprint(d) });
    expect(linked.bb?.weeks).toHaveLength(2);
  });

  it('unlink снимает связь и возвращает программу без изменений остального', () => {
    const d = makeDesign([], 2);
    const linked = linkDesignToProgram(makeProgram(), d);
    const unlinked = unlinkDesignFromProgram(linked);
    expect(unlinked.meta.designRef).toBeUndefined();
    expect(unlinked.meta.title).toBe('Программа');
  });

  it('unlink без designRef — no-op (та же программа)', () => {
    const p = makeProgram();
    expect(unlinkDesignFromProgram(p)).toBe(p);
  });
});

describe('isProgramDesignStale', () => {
  it('false без designRef', () => {
    const p = makeProgram();
    expect(isProgramDesignStale(p, makeDesign([]))).toBe(false);
  });

  it('false когда дизайн не менялся после привязки', () => {
    const d = makeDesign([makeBlock('b1', 'peaking', 1, 2)], 2);
    const linked = linkDesignToProgram(makeProgram(), d);
    expect(isProgramDesignStale(linked, d)).toBe(false);
  });

  it('true когда дизайн изменён после привязки', () => {
    const d = makeDesign([makeBlock('b1', 'peaking', 1, 2)], 2);
    const linked = linkDesignToProgram(makeProgram(), d);
    const edited = makeDesign([makeBlock('b1', 'peaking', 1, 4)], 2);
    expect(isProgramDesignStale(linked, edited)).toBe(true);
  });
});

describe('reapplyDesignToProgram', () => {
  it('no-op без designRef', () => {
    const p = makeProgram();
    expect(reapplyDesignToProgram(p, makeDesign([]))).toBe(p);
  });

  it('переразмечает bb.weeks, сохраняя сессии и упражнения', () => {
    const d = makeDesign([makeBlock('b1', 'intensification', 1, 1), makeBlock('b2', 'deload', 2, 2)], 2);
    const linked = linkDesignToProgram(makeProgram(), d);
    const reapplied = reapplyDesignToProgram(linked, d);
    expect(reapplied.bb?.weeks[0].phase).toBe('intensification');
    expect(reapplied.bb?.weeks[0].deload).toBe(false);
    expect(reapplied.bb?.weeks[1].phase).toBe('deload');
    expect(reapplied.bb?.weeks[1].deload).toBe(true);
    // сессии сохранены
    expect(reapplied.bb?.weeks[0].sessions[0].id).toBe('s1');
    expect(reapplied.bb?.weeks[1].sessions[0].id).toBe('s2');
    // хэш обновлён на актуальный
    expect(reapplied.meta.designRef?.hash).toBe(designFingerprint(d));
  });

  it('переразмечает pl.customWeeks', () => {
    const d = makeDesign([makeBlock('b1', 'peaking', 1, 2)], 2);
    const p = makeProgram({
      meta: { id: 'prog-pl', title: 'ПЛ', direction: 'pl', goal: 'powerlifting', level: 'intermediate', daysPerWeek: 2, weeks: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
      pl: {
        direction: 'pl', sourceCycleId: null, notes: '', workMax: {},
        schedule: [{ sessionIdx: 0, dayOfWeek: 0 }, { sessionIdx: 1, dayOfWeek: 1 }],
        customWeeks: [
          { week: 1, phase: 'accumulation', deload: false, days: [{ name: 'День 1', exercises: [] }] },
          { week: 2, phase: 'accumulation', deload: false, days: [{ name: 'День 2', exercises: [] }] },
        ],
      },
    });
    const linked = linkDesignToProgram(p, d);
    const reapplied = reapplyDesignToProgram(linked, d);
    expect(reapplied.pl?.customWeeks?.[0].phase).toBe('peaking');
    expect(reapplied.pl?.customWeeks?.[1].phase).toBe('peaking');
    expect(reapplied.pl?.customWeeks?.[0].days[0].name).toBe('День 1');
  });

  it('переразмечает hybrid.bbWeeks', () => {
    const d = makeDesign([makeBlock('b1', 'deload', 1, 2)], 2);
    const p = makeProgram({
      meta: { id: 'prog-hy', title: 'Hybrid', direction: 'hybrid', goal: 'strength_mass', level: 'intermediate', daysPerWeek: 2, weeks: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
      hybrid: { direction: 'hybrid', plRef: { sourceCycleId: 'c1', sessionIndices: [0] }, notes: '', bbWeeks: [
        { week: 1, phase: 'accumulation', deload: false, sessions: [] },
        { week: 2, phase: 'accumulation', deload: false, sessions: [] },
      ] },
    });
    const linked = linkDesignToProgram(p, d);
    const reapplied = reapplyDesignToProgram(linked, d);
    expect(reapplied.hybrid?.bbWeeks[0].deload).toBe(true);
    expect(reapplied.hybrid?.bbWeeks[1].deload).toBe(true);
  });

  it('обновляет name при перепривязке к другому дизайну с тем же id', () => {
    const d1 = makeDesign([makeBlock('b1', 'peaking', 1, 2)], 2, 'Старое имя');
    const d2 = makeDesign([makeBlock('b1', 'peaking', 1, 2)], 2, 'Новое имя');
    const linked = linkDesignToProgram(makeProgram(), d1);
    const reapplied = reapplyDesignToProgram(linked, d2);
    expect(reapplied.meta.designRef?.name).toBe('Новое имя');
  });
});
