import { describe, it, expect } from 'vitest';
import {
  buildMacrocycleMulti, buildMacrocycle, serializeMacro, deserializeMacro,
  rebalanceMacrocycle, resizeMacroBlock, resizeBbMacroBlock, buildBbMacrocycle,
  splitMacroPhaseIntoCycles, mergeMacroPhase, setMacroBlockCycle, moveMacroBlock,
  type CompetitionEvent, type Macrocycle,
} from '../macrocycle.engine';

function makeComp(id: string, week: number, priority: CompetitionEvent['priority'] = 'B', name?: string): CompetitionEvent {
  return { id, name: name ?? id, week, priority };
}

describe('buildMacrocycleMulti — несколько соревнований', () => {
  it('пустой список использует обычное распределение без пустого макроцикла', () => {
    const macro = buildMacrocycleMulti([], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    expect(macro.blocks.length).toBeGreaterThan(0);
    expect(macro.blocks.reduce((sum, block) => sum + block.weeks, 0)).toBe(20);
  });
  it('одно соревнование A → создаёт peak + competition блоки привязанные к событию', () => {
    const events = [makeComp('c1', 20, 'A', 'Чемпионат')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 });
    expect(m.competitions).toHaveLength(1);
    expect(m.competitions![0].name).toBe('Чемпионат');
    // Должны быть competition-блоки с competitionId='c1'
    const compBlocks = m.blocks.filter(b => b.phase === 'competition' && b.competitionId === 'c1');
    expect(compBlocks.length).toBeGreaterThanOrEqual(1);
    // Peak-блоки тоже привязаны к c1
    const peakBlocks = m.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects malformed competition events', () => {
    expect(() => buildMacrocycleMulti([{ id: '', name: 'bad', week: 10, priority: 'A' }], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 })).toThrow('Некорректное');
    expect(() => buildMacrocycleMulti([{ id: 'c1', name: 'bad', week: Number.NaN, priority: 'A' }], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 })).toThrow('Некорректное');
  });

  it('главное соревнование (A) → 4 нед peak + 1 нед competition', () => {
    const events = [makeComp('main', 20, 'A')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 });
    const peakBlock = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'main');
    const compBlock = m.blocks.find(b => b.phase === 'competition' && b.competitionId === 'main');
    expect(peakBlock).toBeTruthy();
    expect(peakBlock!.weeks).toBe(4);
    expect(compBlock).toBeTruthy();
    expect(compBlock!.weeks).toBe(1);
    // competition-блок на неделе 20
    expect(compBlock!.weekOffset).toBe(20);
  });

  it('контрольное соревнование (B) → 2 нед peak + 1 нед competition', () => {
    const events = [makeComp('control', 15, 'B')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 25 });
    const peakBlock = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'control');
    expect(peakBlock).toBeTruthy();
    expect(peakBlock!.weeks).toBe(2);
  });

  it('тренировочное соревнование (C) → не создаёт peak/competition блоки', () => {
    const events = [makeComp('mock', 12, 'C')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const compBlocks = m.blocks.filter(b => b.competitionId === 'mock');
    expect(compBlocks).toHaveLength(0);
  });

  it('два соревнования A и B →各自 peak/competition блоки + подготовка между ними', () => {
    const events = [makeComp('c1', 12, 'B', 'Кубок'), makeComp('c2', 30, 'A', 'Чемпионат')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 40 });
    // Два набора peak+competition
    const c1Comp = m.blocks.find(b => b.phase === 'competition' && b.competitionId === 'c1');
    const c2Comp = m.blocks.find(b => b.phase === 'competition' && b.competitionId === 'c2');
    expect(c1Comp).toBeTruthy();
    expect(c2Comp).toBeTruthy();
    expect(c1Comp!.weekOffset).toBe(12);
    expect(c2Comp!.weekOffset).toBe(30);
    // Между ними — strength/endurance блоки (подготовка)
    const between = m.blocks.filter(b => b.weekOffset > 13 && b.weekOffset < 26);
    expect(between.length).toBeGreaterThan(0);
    // После A (c2) — transition (если есть хвост)
    const afterMain = m.blocks.filter(b => b.weekOffset > 30);
    expect(afterMain.length).toBeGreaterThan(0);
  });

  it('соревнования отсортированы по неделе (независимо от порядка ввода)', () => {
    const events = [makeComp('late', 30, 'A'), makeComp('early', 10, 'B')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 40 });
    expect(m.competitions![0].id).toBe('early');
    expect(m.competitions![1].id).toBe('late');
  });

  it('большой зазор перед первым соревнованием → начальная endurance+strength', () => {
    const events = [makeComp('c1', 20, 'A')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 });
    // Первые блоки — endurance/strength (подготовка)
    const earlyPhases = m.blocks.slice(0, 2).map(b => b.phase);
    expect(earlyPhases).toContain('endurance');
    expect(earlyPhases).toContain('strength');
  });

  it('сериализация сохраняет competitions, десериализация восстанавливает', () => {
    const events = [makeComp('c1', 15, 'A', 'Главное'), makeComp('c2', 8, 'B', 'Кубок')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 25 });
    const s = serializeMacro(m);
    const restored = deserializeMacro(s);
    expect(restored).toBeTruthy();
    expect(restored!.competitions).toHaveLength(2);
    expect(restored!.competitions![0].name).toBe('Кубок'); // отсортировано по неделе
    expect(restored!.competitions![1].name).toBe('Главное');
    // Блоки с competitionId восстановлены
    const compBlocks = restored!.blocks.filter(b => b.competitionId);
    expect(compBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it('competitionWeek (обратно-совместимое) = главное соревнование', () => {
    const events = [makeComp('b1', 10, 'B'), makeComp('a1', 25, 'A', 'Чемпионат')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 35 });
    // Главное (A) → competitionWeek
    expect(m.competitionWeek).toBe(25);
  });

  it('buildMacrocycle с competitions в input → вызывает мульти-режим', () => {
    const events = [makeComp('c1', 15, 'A')];
    const m = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 25, competitions: events });
    expect(m.competitions).toHaveLength(1);
    expect(m.competitions![0].id).toBe('c1');
    // Должны быть competition-блоки (мульти-режим)
    const compBlocks = m.blocks.filter(b => b.phase === 'competition');
    expect(compBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('сумма недель блоков = totalWeeks (не превышает)', () => {
    const events = [makeComp('c1', 15, 'A'), makeComp('c2', 30, 'B')];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 40 });
    const sum = m.blocks.reduce((s, b) => s + b.weeks, 0);
    expect(sum).toBeLessThanOrEqual(40);
    // Последний блок не выходит за totalWeeks
    const last = m.blocks[m.blocks.length - 1];
    expect(last.weekOffset + last.weeks - 1).toBeLessThanOrEqual(40);
  });

  it('отклоняет два соревнования на одной неделе', () => {
    expect(() => buildMacrocycleMulti([
      makeComp('a', 12, 'A'),
      makeComp('b', 12, 'B'),
    ], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 })).toThrow(/одной неделе/);
  });

  it('отклоняет два главных соревнования A вместо молчаливого выбора первого', () => {
    expect(() => buildMacrocycleMulti([
      makeComp('a1', 12, 'A'),
      makeComp('a2', 24, 'A'),
    ], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 })).toThrow(/только одно.*A/i);
  });

  it('отклоняет дублирующиеся ID соревнований', () => {
    expect(() => buildMacrocycleMulti([
      makeComp('same', 10, 'B'),
      makeComp('same', 20, 'A'),
    ], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 })).toThrow(/Дублирующийся ID/);
  });

  it('отклоняет соревнование за пределами макроцикла', () => {
    expect(() => buildMacrocycleMulti([makeComp('late', 31, 'A')], {
      level: 'intermediate', goal: 'powerlifting', totalWeeks: 30,
    })).toThrow('Некорректное');
    expect(() => buildMacrocycleMulti([makeComp('fractional', 10.5, 'A')], {
      level: 'intermediate', goal: 'powerlifting', totalWeeks: 30,
    })).toThrow('Некорректное');
  });

  it('отклоняет некорректную дату соревнования', () => {
    expect(() => buildMacrocycleMulti([{
      ...makeComp('bad-date', 10, 'A'), date: 'not-a-date',
    }], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 })).toThrow('Некорректное');
    expect(() => buildMacrocycleMulti([{
      ...makeComp('invalid-day', 10, 'A'), date: '2025-02-30',
    }], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 30 })).toThrow('Некорректное');
  });

  it('отклоняет больше циклов пика, чем доступно недель', () => {
    expect(() => buildMacrocycleMulti([{
      id: 'c1', name: 'Early', week: 3, priority: 'A',
      cycleIds: ['a', 'b', 'c', 'd'],
    }], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 })).toThrow(/циклов/);
  });

  it('допускает соревнование на первой неделе без фиктивного peak-блока', () => {
    const macro = buildMacrocycleMulti([makeComp('early', 1, 'A')], {
      level: 'intermediate', goal: 'powerlifting', totalWeeks: 12,
    });
    const competition = macro.blocks.find(block => block.phase === 'competition');
    expect(competition?.weekOffset).toBe(1);
    expect(macro.blocks.some(block => block.phase === 'peak' && block.weeks <= 0)).toBe(false);
  });

  it('rebalance сохраняет каждую competition-неделю отдельной', () => {
    const macro = buildMacrocycleMulti([
      makeComp('a', 15, 'A'),
      makeComp('b', 30, 'B'),
    ], { level: 'intermediate', goal: 'powerlifting', totalWeeks: 40 });
    const rebalanced = rebalanceMacrocycle(macro, [{ phase: 'competition', weeks: 8 }]);
    const competitions = rebalanced.blocks.filter(block => block.phase === 'competition');
    expect(competitions).toHaveLength(2);
    expect(competitions.every(block => block.weeks === 1)).toBe(true);
    expect(rebalanced.competitions?.map(event => event.week)).toEqual(
      competitions.map(block => block.weekOffset),
    );
  });
});

describe('buildMacrocycleMulti — cycleId per competition', () => {
  it('comp.cycleId используется для peak/competition блоков этого соревнования', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Кубок', week: 12, priority: 'A', cycleId: 'test-cycle-001' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 25 });
    // peak и competition блоки для c1 должны иметь cycleId='test-cycle-001'
    const peakBlock = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c1');
    const compBlock = m.blocks.find(b => b.phase === 'competition' && b.competitionId === 'c1');
    expect(peakBlock).toBeTruthy();
    expect(peakBlock!.cycleId).toBe('test-cycle-001');
    expect(compBlock).toBeTruthy();
    expect(compBlock!.cycleId).toBe('test-cycle-001');
  });

  it('без comp.cycleId → автоподбор (cycleId из pickCycleForPhase)', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Кубок', week: 12, priority: 'A' }, // без cycleId
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 25 });
    const peakBlock = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlock).toBeTruthy();
    // cycleId должен быть задан (автоподбор) или undefined (если нет подходящих циклов)
    // Главное — не 'test-cycle-001'
    expect(peakBlock!.cycleId).not.toBe('test-cycle-001');
  });

  it('разные cycleId для разных соревнований', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Кубок', week: 10, priority: 'B', cycleId: 'cycle-A' },
      { id: 'c2', name: 'Чемпионат', week: 25, priority: 'A', cycleId: 'cycle-B' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 35 });
    const peak1 = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c1');
    const peak2 = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c2');
    expect(peak1).toBeTruthy();
    expect(peak2).toBeTruthy();
    expect(peak1!.cycleId).toBe('cycle-A');
    expect(peak2!.cycleId).toBe('cycle-B');
    expect(peak1!.cycleId).not.toBe(peak2!.cycleId);
  });

  it('cycleId не найден в LMS_CYCLES → cycleId сохраняется (уважаем выбор пользователя)', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Кубок', week: 12, priority: 'A', cycleId: 'nonexistent-cycle-xyz' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 25 });
    const peakBlock = m.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlock).toBeTruthy();
    // cycleId сохраняется (пользователь явно выбрал) — description помечает "не найден"
    expect(peakBlock!.cycleId).toBe('nonexistent-cycle-xyz');
    expect(peakBlock!.description).toContain('не найден');
  });

  it('сериализация сохраняет comp.cycleId, десериализация восстанавливает', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Кубок', week: 10, priority: 'B', cycleId: 'cycle-A' },
      { id: 'c2', name: 'Чемпионат', week: 25, priority: 'A', cycleId: 'cycle-B' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 35 });
    const s = serializeMacro(m);
    const restored = deserializeMacro(s);
    expect(restored).toBeTruthy();
    expect(restored!.competitions).toHaveLength(2);
    expect(restored!.competitions![0].cycleId).toBe('cycle-A');
    expect(restored!.competitions![1].cycleId).toBe('cycle-B');
    // Блоки тоже сохраняют cycleId
    const peak1 = restored!.blocks.find(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peak1).toBeTruthy();
    expect(peak1!.cycleId).toBe('cycle-A');
  });

  it('тренировочное соревнование (C) игнорирует cycleId (нет peak/competition блоков)', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Mock meet', week: 10, priority: 'C', cycleId: 'cycle-C' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const compBlocks = m.blocks.filter(b => b.competitionId === 'c1');
    expect(compBlocks).toHaveLength(0); // C не создаёт блоков
  });

  it('resizeMacroBlock меняет общую длину и offsets без перераспределения соседей', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const before = macro.blocks.map(block => block.weeks);
    const resized = resizeMacroBlock(macro, 0, before[0] + 3);
    expect(resized.blocks[0].weeks).toBe(before[0] + 3);
    expect(resized.totalWeeks).toBe(macro.totalWeeks + 3);
    expect(resized.blocks[1].weekOffset).toBe(resized.blocks[0].weekOffset + resized.blocks[0].weeks);
  });

  it('resizeBbMacroBlock меняет общий календарь BB-блоков', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const resized = resizeBbMacroBlock(macro, 0, macro.blocks[0].weeks + 2);
    expect(resized.totalWeeks).toBe(macro.totalWeeks + 2);
    expect(resized.blocks[1].weekOffset).toBe(resized.blocks[0].weekOffset + resized.blocks[0].weeks);
  });

  it('splitMacroPhaseIntoCycles: фаза делится на два блока с двумя циклами и суммой недель', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const strengthTotal = macro.blocks.filter(b => b.phase === 'strength').reduce((sum, b) => sum + b.weeks, 0);
    const split = splitMacroPhaseIntoCycles(macro, 'strength', ['cycle-A', 'cycle-B'], [6, 4]);
    const blocks = split.blocks.filter(block => block.phase === 'strength');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cycleId).toBe('cycle-A');
    expect(blocks[1].cycleId).toBe('cycle-B');
    expect(blocks[0].weeks + blocks[1].weeks).toBe(10);
    expect(split.totalWeeks).toBe(macro.totalWeeks + (10 - strengthTotal));
    expect(blocks[1].weekOffset).toBe(blocks[0].weekOffset + blocks[0].weeks);
  });

  it('splitMacroPhaseIntoCycles: сумма недель может отличаться от исходной фазы', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const split = splitMacroPhaseIntoCycles(macro, 'strength', ['cycle-A', 'cycle-B'], [8, 8]);
    expect(split.totalWeeks).toBe(macro.totalWeeks + (8 + 8 - macro.blocks.find(b => b.phase === 'strength')!.weeks));
    expect(split.blocks.filter(b => b.phase === 'strength').reduce((sum, b) => sum + b.weeks, 0)).toBe(16);
  });

  it('splitMacroPhaseIntoCycles: нулевые недели = поровну от текущей суммы фазы', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const phaseTotal = macro.blocks.filter(b => b.phase === 'strength').reduce((sum, b) => sum + b.weeks, 0);
    const split = splitMacroPhaseIntoCycles(macro, 'strength', ['cycle-A', 'cycle-B'], [0, 0]);
    const blocks = split.blocks.filter(b => b.phase === 'strength');
    expect(blocks[0].weeks + blocks[1].weeks).toBe(phaseTotal);
    expect(split.totalWeeks).toBe(macro.totalWeeks);
  });

  it('splitMacroPhaseIntoCycles: один слот «0» = остаток фазы, лишняя неделя не добавляется', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const phaseTotal = macro.blocks.filter(b => b.phase === 'strength').reduce((sum, b) => sum + b.weeks, 0);
    const split = splitMacroPhaseIntoCycles(macro, 'strength', ['cycle-A', 'cycle-B'], [6, 0]);
    const blocks = split.blocks.filter(b => b.phase === 'strength');
    expect(blocks[0].weeks).toBe(6);
    expect(blocks[0].weeks + blocks[1].weeks).toBe(Math.max(phaseTotal, 6));
    expect(split.totalWeeks).toBe(macro.totalWeeks + Math.max(0, 6 - phaseTotal));
  });

  it('mergeMacroPhase удаляет осиротевшее соревнование (week: 0)', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'A', week: 12, priority: 'A' },
      { id: 'c2', name: 'B', week: 20, priority: 'B' },
    ];
    const macro = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 24 });
    expect(macro.competitions).toHaveLength(2);
    // Сводим и peak, и competition фазы: c2 теряет оба блока → orphan → отфильтрован.
    const merged = mergeMacroPhase(mergeMacroPhase(macro, 'peak'), 'competition');
    expect(merged.blocks.filter(b => b.phase === 'competition')).toHaveLength(1);
    expect(merged.competitions).toHaveLength(1);
    expect(merged.competitions![0].id).toBe('c1');
  });

  it('moveMacroBlock пересчитывает неделю соревнования вслед за блоком', () => {
    const events: CompetitionEvent[] = [{ id: 'c1', name: 'Кубок', week: 16, priority: 'A' }];
    const macro = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const compIdx = macro.blocks.findIndex(b => b.phase === 'competition');
    expect(compIdx).toBeGreaterThan(-1);
    const moved = moveMacroBlock(macro, compIdx, 0) as Macrocycle;
    const comp = moved.competitions?.[0];
    const block = moved.blocks.find(b => b.competitionId === comp?.id)!;
    expect(comp).toBeTruthy();
    expect(comp!.week).toBeGreaterThanOrEqual(block.weekOffset);
    expect(comp!.week).toBeLessThanOrEqual(block.weekOffset + block.weeks - 1);
  });

  it('setMacroBlockCycle меняет только цикл блока, недели/offsets не трогает', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const updated = setMacroBlockCycle(macro, 0, 'cycle-NEW');
    expect(updated.blocks[0].cycleId).toBe('cycle-NEW');
    expect(updated.blocks[0].weeks).toBe(macro.blocks[0].weeks);
    expect(updated.blocks[1].weekOffset).toBe(macro.blocks[1].weekOffset);
    expect(updated.totalWeeks).toBe(macro.totalWeeks);
  });

  it('mergeMacroPhase сводит все блоки фазы в один с сохранением суммы недель', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'powerlifting', totalWeeks: 20, competitionWeek: 16 });
    const split = splitMacroPhaseIntoCycles(macro, 'strength', ['cycle-A', 'cycle-B'], [6, 4]);
    expect(split.blocks.filter(b => b.phase === 'strength')).toHaveLength(2);
    const merged = mergeMacroPhase(split, 'strength');
    const mergedBlocks = merged.blocks.filter(b => b.phase === 'strength');
    expect(mergedBlocks).toHaveLength(1);
    expect(mergedBlocks[0].weeks).toBe(10);
    expect(mergedBlocks[0].cycleId).toBe('cycle-A');
    expect(merged.totalWeeks).toBe(split.totalWeeks);
  });
});

describe('buildMacrocycleMulti — несколько циклов на одно соревнование (cycleIds)', () => {
  it('comp.cycleIds делит peak на под-блоки, каждому присваивается свой cycleId', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'Чемпионат', week: 12, priority: 'A', cycleIds: ['cycle-X', 'cycle-Y', 'cycle-Z'] },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const peakBlocks = m.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlocks).toHaveLength(3); // 3 под-блока для 3 циклов
    const cycleIds = peakBlocks.map(b => b.cycleId);
    expect(cycleIds).toEqual(['cycle-X', 'cycle-Y', 'cycle-Z']);
  });

  it('cycleIds распределяются равномерно по неделям пика', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'A', week: 8, priority: 'A', cycleIds: ['c1', 'c2', 'c3', 'c4'] },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 16 });
    const peakBlocks = m.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    // A-приоритет → 4 недели peak, делённые на 4 цикла = 1 неделя каждому
    expect(peakBlocks.reduce((s, b) => s + b.weeks, 0)).toBe(4);
    expect(peakBlocks).toHaveLength(4);
    expect(peakBlocks.every(b => b.weeks === 1)).toBe(true);
  });

  it('cycleId используется как fallback, если cycleIds не задан (обратная совместимость)', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'A', week: 12, priority: 'A', cycleId: 'legacy-cycle' },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const peakBlocks = m.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlocks).toHaveLength(1);
    expect(peakBlocks[0].cycleId).toBe('legacy-cycle');
  });

  it('сериализация/десериализация сохраняет cycleIds', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'A', week: 12, priority: 'A', cycleIds: ['x', 'y', 'z'] },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 20 });
    const s = serializeMacro(m);
    const restored = deserializeMacro(s);
    expect(restored).toBeTruthy();
    expect(restored!.competitions![0].cycleIds).toEqual(['x', 'y', 'z']);
    const peakBlocks = restored!.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlocks.map(b => b.cycleId)).toEqual(['x', 'y', 'z']);
  });

  it('cycleIds из 1 элемента = один под-блок', () => {
    const events: CompetitionEvent[] = [
      { id: 'c1', name: 'A', week: 10, priority: 'A', cycleIds: ['single-cycle'] },
    ];
    const m = buildMacrocycleMulti(events, { level: 'intermediate', goal: 'powerlifting', totalWeeks: 18 });
    const peakBlocks = m.blocks.filter(b => b.phase === 'peak' && b.competitionId === 'c1');
    expect(peakBlocks).toHaveLength(1);
    expect(peakBlocks[0].cycleId).toBe('single-cycle');
  });
});
