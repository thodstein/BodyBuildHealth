import { describe, it, expect } from 'vitest';
import {
  buildMacrocycle, rebalanceMacrocycle, macrocycleToActiveCycle,
  serializeMacro, deserializeMacro, estimateCompetitionWeek,
  PHASE_LABEL_RU,
  type Macrocycle, type MacroRebalanceEdit,
} from '../lms/macrocycle.engine';

describe('buildMacrocycle', () => {
  it('создаёт 5 блоков фаз', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    expect(m.blocks).toHaveLength(5);
    expect(m.blocks.map(b => b.phase)).toEqual(['endurance', 'strength', 'peak', 'competition', 'transition']);
  });

  it('сумма недель блоков = totalWeeks', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    const sum = m.blocks.reduce((s, b) => s + b.weeks, 0);
    expect(sum).toBe(52);
    expect(m.totalWeeks).toBe(52);
  });

  it('weekOffset корректны (1-индекс, последовательные)', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    expect(m.blocks[0].weekOffset).toBe(1);
    for (let i = 1; i < m.blocks.length; i++) {
      expect(m.blocks[i].weekOffset).toBe(m.blocks[i - 1].weekOffset + m.blocks[i - 1].weeks);
    }
  });

  it('competitionWeek передаётся в результат', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 44 });
    expect(m.competitionWeek).toBe(44);
  });

  it('каждый блок имеет cycleId или описание для BB', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    for (const b of m.blocks) {
      if (b.kind === 'SRC') {
        expect(b.cycleId).toBeTruthy();
      }
      expect(b.description).toBeTruthy();
    }
  });

  it('goal=bodybuilding → endurance/strength/transition блоки = BB', () => {
    const m = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 52 });
    expect(m.blocks[0].kind).toBe('BB'); // endurance
    expect(m.blocks[1].kind).toBe('BB'); // strength
    expect(m.blocks[4].kind).toBe('BB'); // transition
    expect(m.blocks[2].kind).toBe('SRC'); // peak
  });
});

describe('macrocycleToActiveCycle', () => {
  const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });

  it('неделя 1 → первый блок (endurance)', () => {
    const r = macrocycleToActiveCycle(m, 1);
    expect(r).not.toBeNull();
    expect(r!.block.phase).toBe('endurance');
  });

  it('неделя в середине strength → блок strength', () => {
    const strengthBlock = m.blocks.find(b => b.phase === 'strength')!;
    const midWeek = strengthBlock.weekOffset + Math.floor(strengthBlock.weeks / 2);
    const r = macrocycleToActiveCycle(m, midWeek);
    expect(r).not.toBeNull();
    expect(r!.block.phase).toBe('strength');
  });

  it('неделя 0 (вне диапазона) → fallback на первый блок', () => {
    const r = macrocycleToActiveCycle(m, 0);
    expect(r).not.toBeNull();
  });

  it('неделя > total → fallback на последний блок', () => {
    const r = macrocycleToActiveCycle(m, 999);
    expect(r).not.toBeNull();
    expect(r!.block.phase).toBe('transition');
  });
});

describe('rebalanceMacrocycle', () => {
  it('изменяет длительность фазы', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    const originalStrength = m.blocks.find(b => b.phase === 'strength')!.weeks;
    const edits: MacroRebalanceEdit[] = [{ phase: 'strength', weeks: 30 }];
    const r = rebalanceMacrocycle(m, edits);
    expect(r.blocks.find(b => b.phase === 'strength')!.weeks).toBe(30);
    expect(r.blocks.find(b => b.phase === 'strength')!.weeks).not.toBe(originalStrength);
  });

  it('пересчитывает weekOffset после правки', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    const edits: MacroRebalanceEdit[] = [{ phase: 'endurance', weeks: 10 }];
    const r = rebalanceMacrocycle(m, edits);
    expect(r.blocks[0].weekOffset).toBe(1);
    expect(r.blocks[1].weekOffset).toBe(11); // endurance 10 нед → strength старт с 11
  });

  it('сохраняет totalWeeks (разница в последний блок)', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    const edits: MacroRebalanceEdit[] = [
      { phase: 'endurance', weeks: 5 },
      { phase: 'strength', weeks: 20 },
      { phase: 'peak', weeks: 10 },
    ];
    const r = rebalanceMacrocycle(m, edits);
    const sum = r.blocks.reduce((s, b) => s + b.weeks, 0);
    expect(sum).toBe(52);
  });
});

describe('serialize / deserialize', () => {
  it('round-trip сохраняет структуру', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 44 });
    const s = serializeMacro(m);
    const r = deserializeMacro(s);
    expect(r).not.toBeNull();
    expect(r!.blocks).toHaveLength(5);
    expect(r!.totalWeeks).toBe(52);
    expect(r!.competitionWeek).toBe(44);
    expect(r!.blocks[0].phase).toBe('endurance');
    expect(r!.blocks[0].weekOffset).toBe(1);
  });

  it('невалидный JSON → null', () => {
    expect(deserializeMacro('not json')).toBeNull();
    expect(deserializeMacro('{}')).toBeNull();
  });
});

describe('estimateCompetitionWeek', () => {
  it('дата в будущем → положительная неделя', () => {
    const future = new Date(Date.now() + 84 * 86400000).toISOString(); // ~12 недель
    const w = estimateCompetitionWeek(future, 52);
    expect(w).toBeGreaterThan(8);
    expect(w).toBeLessThan(20);
  });

  it('дата в прошлом → неделя 1 (clamped)', () => {
    const past = new Date(Date.now() - 365 * 86400000).toISOString();
    const w = estimateCompetitionWeek(past, 52);
    expect(w).toBeGreaterThanOrEqual(1);
  });
});

describe('PHASE_LABEL_RU', () => {
  it('содержит все 5 фаз', () => {
    expect(Object.keys(PHASE_LABEL_RU)).toHaveLength(5);
    expect(PHASE_LABEL_RU.strength).toBe('Силовой');
    expect(PHASE_LABEL_RU.competition).toBe('Соревнования');
  });
});