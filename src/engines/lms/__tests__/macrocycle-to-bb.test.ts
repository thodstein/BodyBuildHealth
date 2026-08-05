import { describe, it, expect } from 'vitest';
import { macrocycleToBBProgram, shouldPeriodicDeload, type MacrocycleToBBOptions } from '../macrocycle-to-bb';
import { buildBbMacrocycle, buildMacrocycle, type Macrocycle } from '../macrocycle.engine';

const baseOpts: MacrocycleToBBOptions = {
  level: 'intermediate',
  goal: 'hypertrophy',
  daysPerWeek: 4,
  weakPoints: [],
  equipment: ['barbell', 'dumbbell'],
};

describe('macrocycleToBBProgram', () => {
  it('shouldPeriodicDeload применяет разгрузку на каждой четвёртой неделе базовой фазы', () => {
    expect(shouldPeriodicDeload('strength', 4, 1)).toBe(true);
    expect(shouldPeriodicDeload('strength', 5, 1)).toBe(false);
    expect(shouldPeriodicDeload('transition', 4, 1)).toBe(false);
    expect(shouldPeriodicDeload('endurance', 8, 5)).toBe(true);
  });
  it('создаёт UserProgram с direction=bb и корректной meta', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 12 });
    const prog = macrocycleToBBProgram(macro, baseOpts);
    expect(prog.meta.direction).toBe('bb');
    expect(prog.meta.weeks).toBe(12);
    expect(prog.meta.daysPerWeek).toBeGreaterThanOrEqual(3); // autodraftBBPlan может выбрать 3-4 дня
    expect(prog.bb).toBeTruthy();
    expect(prog.bb!.direction).toBe('bb');
  });

  it('число недель = macro.totalWeeks', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 12 });
    const prog = macrocycleToBBProgram(macro, baseOpts);
    expect(prog.bb!.weeks).toHaveLength(12);
    expect(prog.bb!.weeks.map(w => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('фазы недель переразмечены по макроциклу (5 фаз)', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 12 });
    const prog = macrocycleToBBProgram(macro, baseOpts);
    const phases = prog.bb!.weeks.map(w => w.phase);
    // Все phase ∈ {accumulation, intensification, deload, peaking}
    for (const p of phases) {
      expect(['accumulation', 'intensification', 'deload', 'peaking']).toContain(p);
    }
    // endurance → accumulation (первые недели)
    expect(phases[0]).toBe('accumulation');
    // Короткий одиночный макроцикл заканчивается transition-разгрузкой.
    expect(phases[phases.length - 1]).toBe('deload');
    expect(phases).toContain('peaking');
  });

  it('deload-фазы (transition) выставляют deload=true', () => {
    // 52 недели гарантируют непустой transition-блок (15% = ~8 нед)
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 52 });
    const prog = macrocycleToBBProgram(macro, baseOpts);
    // Найти недели в transition-блоке
    const transitionBlock = macro.blocks.find(b => b.phase === 'transition' && b.weeks > 0);
    expect(transitionBlock).toBeTruthy();
    if (transitionBlock) {
      const transitionWeeks = prog.bb!.weeks.filter(w =>
        w.week >= transitionBlock.weekOffset && w.week < transitionBlock.weekOffset + transitionBlock.weeks
      );
      expect(transitionWeeks.length).toBeGreaterThan(0);
      for (const w of transitionWeeks) {
        expect(w.deload).toBe(true);
        expect(w.phase).toBe('deload');
      }
    }
  });

  it('peaking-фаза корректирует RIR compounds в 0-1', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 16 });
    const prog = macrocycleToBBProgram(macro, baseOpts);
    // Найти неделю в peak-блоке
    const peakBlock = macro.blocks.find(b => b.phase === 'peak');
    expect(peakBlock).toBeTruthy();
    if (peakBlock) {
      const peakWeek = prog.bb!.weeks.find(w =>
        w.week >= peakBlock.weekOffset && w.week < peakBlock.weekOffset + peakBlock.weeks
      );
      expect(peakWeek).toBeTruthy();
      if (peakWeek && peakWeek.sessions.length > 0) {
        // Хотя бы один compound сет должен иметь RIR 0 или 1
        const compoundSets = peakWeek.sessions.flatMap(s =>
          s.blocks.filter(b => b.type === 'compound').flatMap(b => b.sets)
        );
        if (compoundSets.length > 0) {
          for (const s of compoundSets) {
            expect(s.rir).toBeGreaterThanOrEqual(0);
            expect(s.rir).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('invalid options still produce a valid macrocycle-sized BB program', () => {
    // The current autodraft path normalizes invalid labels instead of throwing.
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 12 });
    const prog = macrocycleToBBProgram(macro, {
      ...baseOpts,
      level: 'invalid_level_xyz',
      goal: 'invalid_goal_xyz',
    });
    // Должен вернуть валидный UserProgram соответствующего размера.
    expect(prog.meta.direction).toBe('bb');
    expect(prog.bb!.weeks).toHaveLength(12);
    expect(prog.meta.title).toContain('Годовой план ББ');
  });

  it('competition week removes accessory blocks instead of keeping fake work', () => {
    const macro = buildMacrocycle({
      level: 'intermediate',
      goal: 'bodybuilding',
      totalWeeks: 20,
      competitionWeek: 15,
    });
    const competitionBlock = macro.blocks.find(block => block.phase === 'competition');
    expect(competitionBlock).toBeTruthy();
    const week = macrocycleToBBProgram(macro, baseOpts).bb!.weeks.find(candidate =>
      candidate.week >= competitionBlock!.weekOffset
      && candidate.week < competitionBlock!.weekOffset + competitionBlock!.weeks,
    );
    expect(week).toBeTruthy();
    expect(week!.sessions.every(session =>
      session.blocks.every(block => block.type === 'compound'),
    )).toBe(true);
  });

  it('expanded weeks have independent session and block ids', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 52 });
    const weeks = macrocycleToBBProgram(macro, baseOpts).bb!.weeks;
    const sessionIds = weeks.flatMap(week => week.sessions.map(session => session.id));
    const blockIds = weeks.flatMap(week => week.sessions.flatMap(session => session.blocks.map(block => block.id)));
    expect(new Set(sessionIds).size).toBe(sessionIds.length);
    expect(new Set(blockIds).size).toBe(blockIds.length);
  });

  it('continues load progression when a 16-week base plan is repeated', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 32 });
    const weeks = macrocycleToBBProgram(macro, baseOpts).bb!.weeks;
    const firstWeight = weeks[0].sessions.flatMap(session => session.blocks)
      .flatMap(block => block.sets)
      .map(set => set.weight)
      .find((weight): weight is number => typeof weight === 'number' && weight > 0);
    const repeatedWeight = weeks[16].sessions.flatMap(session => session.blocks)
      .flatMap(block => block.sets)
      .map(set => set.weight)
      .find((weight): weight is number => typeof weight === 'number' && weight > 0);
    expect(firstWeight).toBeDefined();
    expect(repeatedWeight).toBeDefined();
    expect(repeatedWeight!).toBeGreaterThan(firstWeight!);
  });

  it('inserts a mini-deload at the fourth week of preparation blocks (adaptive frequency)', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'bodybuilding', totalWeeks: 52 });
    const program = macrocycleToBBProgram(macro, baseOpts);
    const preparation = macro.blocks.find(block => block.phase === 'endurance' && block.weeks >= 4);
    expect(preparation).toBeTruthy();
    // PL-4 FIX: deload frequency is now adaptive based on block duration
    // For blocks > 12 weeks, deload every 5-6 weeks; for shorter blocks, every 4 weeks
    const deloadFrequency = preparation!.weeks > 12 ? 6 : preparation!.weeks > 8 ? 5 : 4;
    const deloadWeek = preparation!.weekOffset + deloadFrequency - 1;
    const deloadWeekData = program.bb!.weeks.find(week => week.week === deloadWeek);
    expect(deloadWeekData?.deload).toBe(true);
  });

  it('uses trainingFocus stored in a BB macrocycle over fallback options', () => {
    const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 12, trainingFocus: 'strength' });
    const program = macrocycleToBBProgram(macro, { ...baseOpts, trainingFocus: 'hypertrophy' });
    expect(program.bb?.weeks).toHaveLength(12);
    expect(macro.trainingFocus).toBe('strength');
    expect(program.meta.trainingFocus).toBe('strength');
  });
});
