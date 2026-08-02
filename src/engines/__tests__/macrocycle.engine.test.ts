import { describe, it, expect } from 'vitest';
import {
  buildMacrocycle, rebalanceMacrocycle, macrocycleToActiveCycle,
  serializeMacro, deserializeMacro, estimateCompetitionWeek,
  findBlockByPhase,
  PHASE_LABEL_RU,
  type Macrocycle, type MacroRebalanceEdit,
} from '../lms/macrocycle.engine';

describe('buildMacrocycle', () => {
  it('ограничивает длину макроцикла безопасным диапазоном', () => {
    expect(buildMacrocycle({ level: 'intermediate', goal: 'general', totalWeeks: 0 }).totalWeeks).toBe(52);
    expect(buildMacrocycle({ level: 'intermediate', goal: 'general', totalWeeks: -2 }).totalWeeks).toBe(12);
    expect(buildMacrocycle({ level: 'intermediate', goal: 'general', totalWeeks: 200 }).totalWeeks).toBe(104);
    const short = buildMacrocycle({ level: 'intermediate', goal: 'general', totalWeeks: 12 });
    expect(short.blocks.reduce((sum, block) => sum + block.weeks, 0)).toBe(12);
    expect(short.blocks.every(block => block.weeks > 0)).toBe(true);
  });
  it('findBlockByPhase returns the first matching block or undefined', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    expect(findBlockByPhase(m, 'strength')?.phase).toBe('strength');
    expect(findBlockByPhase(m, 'competition')?.weekOffset).toBeGreaterThan(0);
    expect(findBlockByPhase({ ...m, blocks: [] }, 'strength')).toBeUndefined();
  });
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
    const competition = m.blocks.find(b => b.phase === 'competition');
    expect(competition?.weekOffset).toBe(44);
  });

  it('каждый блок имеет cycleId или описание для BB', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52 });
    for (const b of m.blocks) {
      if (b.kind === 'SRC') {
        // Competition is a calendar week, not a training cycle.
        if (b.phase !== 'competition') expect(b.cycleId).toBeTruthy();
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
    expect(r!.block.phase).toBe('endurance');
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

  it('rebalance синхронизирует week соревнования с competition-блоками', () => {
    const macro = buildMacrocycle({
      level: 'intermediate', goal: 'powerlifting', totalWeeks: 30,
      competitions: [{ id: 'main', name: 'Главное', week: 20, priority: 'A' }],
    });
    const result = rebalanceMacrocycle(macro, [{ phase: 'strength', weeks: 4 }]);
    const competitionBlock = result.blocks.find(block => block.phase === 'competition');
    expect(competitionBlock).toBeTruthy();
    expect(result.competitions?.[0].week).toBe(competitionBlock!.weekOffset);
    expect(result.competitionWeek).toBe(competitionBlock!.weekOffset);
  });

  it('пропорционально распределяет правку между повторяющимися фазами', () => {
    const m: Macrocycle = {
      blocks: [
        { phase: 'peak', weeks: 2, weekOffset: 1, kind: 'SRC', description: 'a', competitionId: 'a' },
        { phase: 'competition', weeks: 1, weekOffset: 3, kind: 'SRC', description: 'a' },
        { phase: 'peak', weeks: 4, weekOffset: 4, kind: 'SRC', description: 'b', competitionId: 'b' },
        { phase: 'competition', weeks: 1, weekOffset: 8, kind: 'SRC', description: 'b' },
      ],
      totalWeeks: 14,
      competitions: [],
      rationale: [],
    };
    const result = rebalanceMacrocycle(m, [{ phase: 'peak', weeks: 9 }]);
    const peaks = result.blocks.filter(block => block.phase === 'peak');
    expect(peaks.map(block => block.weeks)).toEqual([3, 6]);
    expect(result.competitions).toEqual([]);
    expect(result.blocks.reduce((sum, block) => sum + block.weeks, 0)).toBe(14);
  });
});

describe('serialize / deserialize', () => {
  it('round-trip сохраняет структуру', () => {
    const m = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', totalWeeks: 52, competitionWeek: 44 });
    const s = serializeMacro(m);
    const r = deserializeMacro(s);
    expect(r).not.toBeNull();
    expect(r!.blocks.find(block => block.phase === 'competition')?.weekOffset).toBe(44);
    expect(r!.totalWeeks).toBe(52);
    expect(r!.competitionWeek).toBe(44);
    expect(r!.competitions?.[0]?.week).toBe(44);
    expect(r!.blocks[0].phase).toBe('endurance');
    expect(r!.blocks[0].weekOffset).toBe(1);
  });

  it('невалидный JSON → null', () => {
    expect(deserializeMacro('not json')).toBeNull();
    expect(deserializeMacro('{}')).toBeNull();
  });

  it('отбрасывает дробные недели, дубли ID и невалидные legacy-поля', () => {
    const valid = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 12 });
    const serialized = JSON.parse(serializeMacro(valid));
    serialized.b[0][1] = 1.5;
    expect(deserializeMacro(JSON.stringify(serialized))).toBeNull();

    const withDuplicateIds = JSON.parse(serializeMacro({
      ...valid,
      competitions: [
        { id: 'same', name: 'A', week: 5, priority: 'A' },
        { id: 'same', name: 'B', week: 8, priority: 'B' },
      ],
    }));
    expect(deserializeMacro(JSON.stringify(withDuplicateIds))).toBeNull();

    const withInvalidAlias = JSON.parse(serializeMacro(valid));
    withInvalidAlias.c = 0;
    expect(deserializeMacro(JSON.stringify(withInvalidAlias))).toBeNull();
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

  it('accepts a deterministic reference date', () => {
    expect(estimateCompetitionWeek('2026-08-15', 12, '2026-08-01')).toBe(3);
  });

  it('невалидная дата → безопасный fallback', () => {
    expect(estimateCompetitionWeek('not-a-date', 52)).toBe(44);
  });
});

describe('PHASE_LABEL_RU', () => {
  it('содержит все 5 фаз', () => {
    expect(Object.keys(PHASE_LABEL_RU)).toHaveLength(5);
    expect(PHASE_LABEL_RU.strength).toBe('Силовой');
    expect(PHASE_LABEL_RU.competition).toBe('Соревнования');
  });
});
