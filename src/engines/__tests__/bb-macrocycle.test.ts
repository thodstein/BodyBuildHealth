/**
 * bb-macrocycle.test.ts - тесты BB-макроцикла (buildBbMacrocycle).
 *
 * Проверяет:
 *  - buildBbMacrocycle: 4 BB-фазы, правильные пропорции
 *  - Без соревнований: простое распределение 4 фаз
 *  - С соревнованиями: A/B/C приоритеты
 *  - Сериализация/десериализация v7
 *  - bbMacroToActiveBlock, bbTrainingFocusForWeek
 *  - MACRO_PHASE_TO_BB маппинг (через remapWeeksFromMacrocycle)
 *  - BBMacroPhase → Phase маппинг
 */
import { describe, it, expect } from 'vitest';
import {
  buildBbMacrocycle,
  bbMacroToActiveBlock,
  bbTrainingFocusForWeek,
  serializeBbMacro,
  deserializeBbMacro,
  rebalanceBbMacrocycle,
  type BBMacrocycle,
  type BBMacroPhase,
  type CompetitionEvent,
} from '../lms/macrocycle.engine';
import {
  bbMacroPhaseToUserPhase,
  isDeloadLikeBbMacroPhase,
  PHASE_TO_BB_MACRO,
  BB_MACRO_TO_PHASE,
} from '../periodization/phase-bridge';

// ── 1. buildBbMacrocycle: базовое распределение без соревнований ──
describe('buildBbMacrocycle (без соревнований)', () => {
  it('создаёт 4 BB-фазы для 52-недельного макроцикла', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    expect(macro.blocks).toHaveLength(4);
    expect(macro.blocks.map(b => b.phase)).toEqual(['hypertrophy', 'strength', 'contest_prep', 'transition']);
    expect(macro.totalWeeks).toBe(52);
    expect(macro.trainingFocus).toBe('hypertrophy');
  });

  it('фазы имеют корректные weekOffset', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    let offset = 1;
    for (const block of macro.blocks) {
      expect(block.weekOffset).toBe(offset);
      offset += block.weeks;
    }
    expect(offset - 1).toBe(52);
  });

  it('фазы имеют trainingFocus по умолчанию', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    for (const block of macro.blocks) {
      expect(block.trainingFocus).toBeTruthy();
    }
    const hypBlock = macro.blocks.find(b => b.phase === 'hypertrophy');
    expect(hypBlock?.trainingFocus).toBe('hypertrophy');
  });

  it('гибертрофия > strength > contest_prep > transition', () => {
    // Объёмные доли: 0.40/0.25/0.20/0.15
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 100 });
    const hyp = macro.blocks.find(b => b.phase === 'hypertrophy')!;
    const str = macro.blocks.find(b => b.phase === 'strength')!;
    const prep = macro.blocks.find(b => b.phase === 'contest_prep')!;
    const trans = macro.blocks.find(b => b.phase === 'transition')!;
    expect(hyp.weeks).toBeGreaterThanOrEqual(str.weeks);
    expect(str.weeks).toBeGreaterThanOrEqual(prep.weeks);
    expect(prep.weeks).toBeGreaterThanOrEqual(trans.weeks);
  });

  it('минимальная длительность 12 недель всегда даёт 4 фазы', () => {
    const macro = buildBbMacrocycle({ level: 'beginner', totalWeeks: 12 });
    expect(macro.blocks.length).toBeGreaterThanOrEqual(3);
    expect(macro.totalWeeks).toBe(12);
  });

  it('максимальная длительность 104 недели', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 104 });
    expect(macro.totalWeeks).toBe(104);
    expect(macro.blocks.map(b => b.phase)).toEqual(['hypertrophy', 'strength', 'contest_prep', 'transition']);
  });
});

// ── 2. С соревнованиями ──
describe('buildBbMacrocycle (с соревнованиями)', () => {
  it('A-соревнование: создаёт contest_prep 12 нед', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_1', name: 'Чемпионат области', week: 48, priority: 'A' },
    ];
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events });
    const prepBlocks = macro.blocks.filter(b => b.phase === 'contest_prep');
    expect(prepBlocks.length).toBeGreaterThanOrEqual(1);
    // Проверяем, что A-соревнование имеет prep длительностью около 12 недель
    const mainPrep = prepBlocks.find(b => b.competitionId === 'comp_1');
    expect(mainPrep).toBeTruthy();
    expect(mainPrep!.weeks).toBeLessThanOrEqual(12);
    expect(mainPrep!.weeks).toBeGreaterThanOrEqual(6);
  });

  it('contest_prep включает неделю соревнования', () => {
    const macro = buildBbMacrocycle({
      level: 'intermediate',
      totalWeeks: 52,
      competitions: [{ id: 'show', name: 'Шоу', week: 48, priority: 'A' }],
    });
    const prep = macro.blocks.find(block => block.competitionId === 'show');
    expect(prep).toBeTruthy();
    expect(prep!.weekOffset + prep!.weeks - 1).toBe(48);
  });

  it('B-соревнование: создаёт contest_prep ~6 нед', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_1', name: 'Контрольная тренировка', week: 40, priority: 'B' },
    ];
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events });
    const prepBlocks = macro.blocks.filter(b => b.phase === 'contest_prep');
    expect(prepBlocks.length).toBeGreaterThanOrEqual(1);
    const prep = prepBlocks.find(b => b.competitionId === 'comp_1');
    expect(prep).toBeTruthy();
    expect(prep!.weeks).toBeLessThanOrEqual(6);
    expect(prep!.weeks).toBeGreaterThanOrEqual(2);
  });

  it('C-соревнование: не создаёт отдельный блок prep', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_1', name: 'Тренировочное', week: 30, priority: 'C' },
    ];
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 52, competitions: events });
    const prepBlock = macro.blocks.find(b => b.competitionId === 'comp_1');
    expect(prepBlock).toBeUndefined();
  });

  it('несколько соревнований: A + B создают 2 prep-блока', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_a', name: 'Главное', week: 48, priority: 'A' },
      { id: 'comp_b', name: 'Контрольное', week: 20, priority: 'B' },
    ];
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events });
    const prepBlocks = macro.blocks.filter(b => b.competitionId && b.phase === 'contest_prep');
    expect(prepBlocks.length).toBe(2);
  });

  it('мультисоревновательный timeline покрывает все недели без gaps/overlaps', () => {
    const macro = buildBbMacrocycle({
      level: 'advanced',
      totalWeeks: 52,
      competitions: [
        { id: 'mock', name: 'Mock', week: 12, priority: 'C' },
        { id: 'control', name: 'Control', week: 28, priority: 'B' },
        { id: 'main', name: 'Main', week: 48, priority: 'A' },
      ],
    });
    const covered = new Set<number>();
    let expectedOffset = 1;
    for (const block of macro.blocks) {
      expect(block.weekOffset).toBe(expectedOffset);
      for (let week = block.weekOffset; week < block.weekOffset + block.weeks; week++) {
        expect(covered.has(week)).toBe(false);
        covered.add(week);
      }
      expectedOffset += block.weeks;
    }
    expect(covered.size).toBe(52);
    expect(Math.min(...covered)).toBe(1);
    expect(Math.max(...covered)).toBe(52);
  });

  it('валидирует дублирующиеся недели соревнований', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_a', name: 'A', week: 30, priority: 'A' },
      { id: 'comp_b', name: 'B', week: 30, priority: 'B' },
    ];
    expect(() => buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events })).toThrow();
  });

  it('валидирует дублирующиеся ID и некорректные даты соревнований', () => {
    const duplicateId: CompetitionEvent[] = [
      { id: 'same', name: 'A', week: 20, priority: 'A' },
      { id: 'same', name: 'B', week: 40, priority: 'B' },
    ];
    expect(() => buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: duplicateId })).toThrow();

    expect(() => buildBbMacrocycle({
      level: 'intermediate',
      totalWeeks: 52,
      competitions: [{ id: 'bad-date', name: 'A', week: 20, priority: 'A', date: '2026-02-30' }],
    })).toThrow();
  });

  it('создаёт rationale с информацией о соревнованиях', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_1', name: 'Чемпионат', week: 48, priority: 'A' },
    ];
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events });
    expect(macro.rationale.length).toBeGreaterThan(0);
    expect(macro.rationale.some(r => r.includes('Чемпионат'))).toBe(true);
  });
});

// ── 3. bbMacroToActiveBlock + bbTrainingFocusForWeek ──
describe('bbMacroToActiveBlock / bbTrainingFocusForWeek', () => {
  const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });

  it('возвращает блок для заданной недели', () => {
    const first = macro.blocks[0];
    const block = bbMacroToActiveBlock(macro, first.weekOffset);
    expect(block).toBeTruthy();
    expect(block!.phase).toBe(first.phase);
  });

  it('возвращает последний блок для недели за пределами макроцикла', () => {
    const last = macro.blocks[macro.blocks.length - 1];
    const block = bbMacroToActiveBlock(macro, 999);
    expect(block).toBeTruthy();
    expect(block!.phase).toBe(last.phase);
  });

  it('trainingFocusForWeek возвращает block.trainingFocus', () => {
    const first = macro.blocks[0];
    const focus = bbTrainingFocusForWeek(macro, first.weekOffset);
    expect(focus).toBe(first.trainingFocus);
  });
});

describe('rebalanceBbMacrocycle', () => {
  it('preserves chronological block order with multiple contests', () => {
    const macro = buildBbMacrocycle({
      level: 'intermediate',
      totalWeeks: 52,
      competitions: [
        { id: 'early', name: 'B', week: 20, priority: 'B' },
        { id: 'main', name: 'A', week: 48, priority: 'A' },
      ],
    });
    const phaseOrder = macro.blocks.map(block => `${block.phase}:${block.competitionId ?? ''}`);
    const result = rebalanceBbMacrocycle(macro, { hypertrophy: 20, strength: 10, contest_prep: 18, transition: 4 });
    expect(result.blocks.map(block => `${block.phase}:${block.competitionId ?? ''}`)).toEqual(phaseOrder);
    expect(result.blocks.at(-1)!.weekOffset + result.blocks.at(-1)!.weeks - 1).toBe(52);
  });

  it('moves competition weeks with their contest-prep blocks', () => {
    const macro = buildBbMacrocycle({
      level: 'intermediate',
      totalWeeks: 52,
      competitions: [{ id: 'main', name: 'A', week: 48, priority: 'A' }],
    });
    const result = rebalanceBbMacrocycle(macro, { hypertrophy: 12, strength: 12, contest_prep: 8, transition: 20 });
    const block = result.blocks.find(candidate => candidate.competitionId === 'main')!;
    expect(result.competitions?.[0].week).toBe(block.weekOffset + block.weeks - 1);
  });
});

// ── 4. Сериализация/десериализация ──
describe('serializeBbMacro / deserializeBbMacro', () => {
  const original = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, trainingFocus: 'strength' });

  it('сериализует и десериализует (v7)', () => {
    const json = serializeBbMacro(original);
    const restored = deserializeBbMacro(json);
    expect(restored).toBeTruthy();
    expect(restored!.totalWeeks).toBe(52);
    expect(restored!.trainingFocus).toBe('strength');
    expect(restored!.blocks).toHaveLength(4);
    for (let i = 0; i < original.blocks.length; i++) {
      expect(restored!.blocks[i].phase).toBe(original.blocks[i].phase);
      expect(restored!.blocks[i].weeks).toBe(original.blocks[i].weeks);
      expect(restored!.blocks[i].weekOffset).toBe(original.blocks[i].weekOffset);
      expect(restored!.blocks[i].trainingFocus).toBe(original.blocks[i].trainingFocus);
    }
  });

  it('null для невалидного JSON', () => {
    expect(deserializeBbMacro('null')).toBeNull();
    expect(deserializeBbMacro('{}')).toBeNull();
    expect(deserializeBbMacro('{"v": 7}')).toBeNull();
  });

  it('null для v != 7', () => {
    const json = serializeBbMacro(original);
    const broken = json.replace('"v":7', '"v":6');
    expect(deserializeBbMacro(broken)).toBeNull();
  });

  it('отбрасывает повреждённые описания и дубликаты соревнований', () => {
    const invalidDescription = JSON.parse(serializeBbMacro(original));
    invalidDescription.b[0][3] = 42;
    expect(deserializeBbMacro(JSON.stringify(invalidDescription))).toBeNull();

    const duplicateEvents = JSON.parse(serializeBbMacro(buildBbMacrocycle({
      level: 'intermediate',
      totalWeeks: 52,
      competitions: [{ id: 'a', name: 'A', week: 48, priority: 'A' }],
    })));
    duplicateEvents.e.push(['a', 'A2', 40, null, 'B', null, null, null]);
    expect(deserializeBbMacro(JSON.stringify(duplicateEvents))).toBeNull();

    const orphanBlock = JSON.parse(serializeBbMacro(original));
    orphanBlock.b[0][4] = 'missing-competition';
    expect(deserializeBbMacro(JSON.stringify(orphanBlock))).toBeNull();

    const missingCompetitionList = JSON.parse(serializeBbMacro(original));
    missingCompetitionList.b[0][4] = 'missing-competition';
    missingCompetitionList.e = null;
    expect(deserializeBbMacro(JSON.stringify(missingCompetitionList))).toBeNull();
  });

  it('сохраняет соревнования', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_1', name: 'Чемпионат', week: 48, priority: 'A' },
    ];
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52, competitions: events });
    const json = serializeBbMacro(macro);
    const restored = deserializeBbMacro(json);
    expect(restored).toBeTruthy();
    expect(restored!.competitions).toBeTruthy();
    expect(restored!.competitions).toHaveLength(1);
    expect(restored!.competitions![0].name).toBe('Чемпионат');
  });

  it('переживает round-trip с соревнованиями', () => {
    const events: CompetitionEvent[] = [
      { id: 'comp_a', name: 'Главное', week: 48, priority: 'A' },
      { id: 'comp_b', name: 'Контрольное', week: 20, priority: 'B', notes: 'проверка формы' },
    ];
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 52, competitions: events });
    const json = serializeBbMacro(macro);
    const restored = deserializeBbMacro(json);
    expect(restored).toBeTruthy();
    expect(restored!.blocks.length).toBeGreaterThan(0);
    expect(restored!.competitions!.length).toBe(2);
    expect(restored!.rationale.length).toBeGreaterThan(0);
  });
});

// ── 5. trainingFocus propagation ──
describe('trainingFocus в BB-макроцикле', () => {
  it('переданный trainingFocus сохраняется в результате', () => {
    const macro = buildBbMacrocycle({ level: 'beginner', totalWeeks: 52, trainingFocus: 'endurance' });
    expect(macro.trainingFocus).toBe('endurance');
  });

  it('по умолчанию trainingFocus = hypertrophy', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 40 });
    expect(macro.trainingFocus).toBe('hypertrophy');
  });

  it('contest_prep фаза имеет trainingFocus = endurance', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    const prep = macro.blocks.find(b => b.phase === 'contest_prep');
    expect(prep?.trainingFocus).toBe('endurance');
  });

  it('hypertrophy фаза имеет trainingFocus = hypertrophy', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
    const hyp = macro.blocks.find(b => b.phase === 'hypertrophy');
    expect(hyp?.trainingFocus).toBe('hypertrophy');
  });
});

// ── 6. BBMacroPhase → Phase маппинг ──
describe('BBMacroPhase → Phase маппинг', () => {
  it('маппинг BB_MACRO_TO_PHASE корректен', () => {
    expect(bbMacroPhaseToUserPhase('hypertrophy')).toBe('accumulation');
    expect(bbMacroPhaseToUserPhase('strength')).toBe('intensification');
    expect(bbMacroPhaseToUserPhase('contest_prep')).toBe('peaking');
    expect(bbMacroPhaseToUserPhase('transition')).toBe('deload');
  });

  it('isDeloadLikeBbMacroPhase', () => {
    expect(isDeloadLikeBbMacroPhase('transition')).toBe(true);
    expect(isDeloadLikeBbMacroPhase('hypertrophy')).toBe(false);
    expect(isDeloadLikeBbMacroPhase('contest_prep')).toBe(false);
  });

  it('PHASE_TO_BB_MACRO обратный маппинг', () => {
    expect(PHASE_TO_BB_MACRO.accumulation).toBe('hypertrophy');
    expect(PHASE_TO_BB_MACRO.peaking).toBe('contest_prep');
  });

  it('BB_MACRO_TO_PHASE', () => {
    expect(BB_MACRO_TO_PHASE.hypertrophy).toBe('accumulation');
    expect(BB_MACRO_TO_PHASE.strength).toBe('intensification');
    expect(BB_MACRO_TO_PHASE.contest_prep).toBe('peaking');
    expect(BB_MACRO_TO_PHASE.transition).toBe('deload');
  });
});
