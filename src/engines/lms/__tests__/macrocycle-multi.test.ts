import { describe, it, expect } from 'vitest';
import {
  buildMacrocycleMulti, buildMacrocycle, serializeMacro, deserializeMacro,
  type CompetitionEvent, type Macrocycle,
} from '../macrocycle.engine';

function makeComp(id: string, week: number, priority: CompetitionEvent['priority'] = 'B', name?: string): CompetitionEvent {
  return { id, name: name ?? id, week, priority };
}

describe('buildMacrocycleMulti — несколько соревнований', () => {
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
});