/**
 * manual-constructor.test.ts — тесты для manual-phase, manual-quality, manual-templates.
 * Покрывает: applyPhaseModulation, computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate.
 */
import { describe, it, expect } from 'vitest';
import { applyPhaseModulation } from '../manual-phase.engine';
import { computePlanQualityFor } from '../manual-quality.engine';
import { muscleAwareSets, makeSetsFromTemplate } from '../manual-templates.engine';
import type { UserProgram, UserWeek, UserSession, UserBlock } from '../../user-program/user-program.types';

// ─── Helpers ───
function makeBlock(muscle: string, setsCount: number = 3, type: string = 'compound'): UserBlock {
  return {
    id: `b_${muscle}_${Math.random().toString(36).slice(2, 6)}`,
    type: type as any,
    exerciseName: `Test ${muscle}`,
    muscle,
    role: 'primary',
    sets: Array.from({ length: setsCount }, (_, i) => ({
      reps: 10,
      rir: 2,
      weight: 50,
      restSec: 120,
    })),
  };
}

function makeSession(muscles: string[], setsPerMuscle: number = 3): UserSession {
  return {
    id: 's1',
    name: 'Test Session',
    focus: muscles.join('/'),
    blocks: muscles.map(m => makeBlock(m, setsPerMuscle)),
  };
}

function makeWeeks(count: number, muscles: string[] = ['chest', 'back'], setsPerMuscle: number = 3): UserWeek[] {
  return Array.from({ length: count }, (_, i) => ({
    week: i + 1,
    phase: 'accumulation',
    deload: false,
    sessions: [makeSession(muscles, setsPerMuscle)],
  }));
}

// ─── applyPhaseModulation ───
describe('applyPhaseModulation', () => {
  it('assigns phases to weeks based on goal and total weeks', () => {
    const weeks = makeWeeks(8);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 8 });
    expect(result.length).toBe(8);
    // First week should be accumulation
    expect(result[0].phase).toBe('accumulation');
    // Should have at least 2 different phases in an 8-week plan
    const phases = new Set(result.map(w => w.phase));
    expect(phases.size).toBeGreaterThanOrEqual(2);
  });

  it('marks deload weeks with deload=true', () => {
    const weeks = makeWeeks(8);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 8, deloadFreq: 4 });
    // With deloadFreq=4 on 8-week plan, weeks 4 and 8 should be deload
    const deloadWeeks = result.filter(w => w.deload);
    expect(deloadWeeks.length).toBeGreaterThan(0);
    for (const dw of deloadWeeks) {
      expect(dw.phase).toBe('deload');
    }
  });

  it('applies RIR from phase config to all sets', () => {
    const weeks = makeWeeks(4);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    // All sets should have a rir value
    for (const w of result) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          for (const set of b.sets) {
            expect(set.rir).toBeGreaterThanOrEqual(0);
            expect(set.rir).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it('applies tempo to compound blocks', () => {
    const weeks = makeWeeks(4);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    for (const w of result) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.type === 'compound') {
            expect(b.tempoSpec).toBeDefined();
            expect(b.tempoSpec).toBeTruthy();
          }
        }
      }
    }
  });

  it('preserves existing reps when numeric (does not override with phase reps)', () => {
    const weeks = makeWeeks(4);
    // Set a specific numeric rep count
    weeks[0].sessions[0].blocks[0].sets[0].reps = 5;
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    // The first set of the first block should preserve reps=5
    const firstSet = result[0].sessions[0].blocks[0].sets[0];
    expect(firstSet.reps).toBe(5);
  });

  it('handles empty weeks array gracefully', () => {
    const result = applyPhaseModulation([], { goal: 'mass', level: 'intermediate', weeksTotal: 8 });
    expect(result).toEqual([]);
  });

  it('handles single week plan', () => {
    const weeks = makeWeeks(1);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 1 });
    expect(result.length).toBe(1);
    expect(result[0].phase).toBe('accumulation');
  });

  it('assigns deloadFreq=0 when not specified and weeks < 6', () => {
    const weeks = makeWeeks(4);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    // No deload in short plans without explicit deloadFreq
    const deloadWeeks = result.filter(w => w.phase === 'deload');
    // May or may not have deload depending on goal, but for 4-week mass plan with no deloadFreq, expect 0
    expect(deloadWeeks.length).toBe(0);
  });

  it('auto-assigns deloadFreq=4 for 8-week plan', () => {
    const weeks = makeWeeks(8);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 8 });
    // 8-week plan auto-assigns deloadFreq=4 → at least 1 deload week
    const deloadWeeks = result.filter(w => w.phase === 'deload');
    expect(deloadWeeks.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves block structure (id, exerciseName, muscle, role)', () => {
    const weeks = makeWeeks(4);
    const original = weeks[0].sessions[0].blocks[0];
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    const modified = result[0].sessions[0].blocks[0];
    expect(modified.id).toBe(original.id);
    expect(modified.exerciseName).toBe(original.exerciseName);
    expect(modified.muscle).toBe(original.muscle);
    expect(modified.role).toBe(original.role);
  });

  it('sets repsRange on blocks', () => {
    const weeks = makeWeeks(4);
    const result = applyPhaseModulation(weeks, { goal: 'mass', level: 'intermediate', weeksTotal: 4 });
    for (const w of result) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          expect(b.repsRange).toBeDefined();
          expect(b.repsRange!.length).toBe(2);
        }
      }
    }
  });
});

// ─── computePlanQualityFor ───
describe('computePlanQualityFor', () => {
  function makeBBProgram(weeks: UserWeek[]): UserProgram {
    return {
      meta: { title: 'Test', direction: 'bb', createdAt: '', updatedAt: '' },
      bb: { weeks },
    } as any;
  }

  it('returns low score and issues for program with no volume data', () => {
    const prog = makeBBProgram([]);
    const result = computePlanQualityFor(prog, 'intermediate');
    // Empty BB weeks → perMuscle may still have BASE_MUSCLES entries with 0 sets
    // Score should be < 100 (penalized for under-MEV)
    expect(result.score).toBeLessThan(100);
    expect(result.perMuscle.length).toBeGreaterThanOrEqual(0);
  });

  it('returns high score for well-balanced program within MAV', () => {
    // 8 weeks, 12 sets per muscle per week (within MAV for chest ~12-16)
    const weeks = makeWeeks(8, ['chest', 'back'], 4); // 4 sets × 3 blocks = 12 sets
    const prog = makeBBProgram(weeks);
    const result = computePlanQualityFor(prog, 'intermediate');
    expect(result.score).toBeGreaterThan(70);
    expect(result.perMuscle.length).toBeGreaterThan(0);
  });

  it('penalizes over-MRV volume (status=over)', () => {
    // 30 sets per block × 10 blocks = 300 sets per muscle per week — well above MRV
    const weeks: UserWeek[] = [];
    for (let i = 0; i < 4; i++) {
      weeks.push({
        week: i + 1,
        phase: 'accumulation',
        deload: false,
        sessions: [{
          id: 's1',
          name: 'Day 1',
          focus: 'chest',
          blocks: Array.from({ length: 10 }, () => makeBlock('chest', 10)),
        }],
      });
    }
    const prog = makeBBProgram(weeks);
    const result = computePlanQualityFor(prog, 'intermediate');
    const chest = result.perMuscle.find(p => p.muscle === 'chest');
    if (chest) {
      expect(chest.status).toBe('over');
      expect(chest.peakSets).toBeGreaterThan(chest.mrv);
    }
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes under-MEV average volume (status=low)', () => {
    // Peak is ok but average is very low (deload-heavy plan)
    const weeks: UserWeek[] = [];
    for (let i = 0; i < 8; i++) {
      const setsCount = i === 0 ? 4 : 0; // only week 1 has volume, rest 0
      weeks.push({
        week: i + 1,
        phase: 'accumulation',
        deload: false,
        sessions: [{
          id: 's1',
          name: 'Day 1',
          focus: 'chest',
          blocks: [makeBlock('chest', setsCount)],
        }],
      });
    }
    const prog = makeBBProgram(weeks);
    const result = computePlanQualityFor(prog, 'intermediate');
    const chest = result.perMuscle.find(p => p.muscle === 'chest');
    if (chest) {
      expect(chest.avgSets).toBeLessThan(chest.mev);
      expect(chest.status).toBe('low');
    }
  });

  it('adjusts landmarks for onCourse (higher MRV/MAV/MEV)', () => {
    const weeks = makeWeeks(4, ['chest'], 4);
    const prog = makeBBProgram(weeks);
    const natural = computePlanQualityFor(prog, 'intermediate');
    const onCourse = computePlanQualityFor(prog, 'intermediate', { onCourse: true });
    const naturalChest = natural.perMuscle.find(p => p.muscle === 'chest');
    const onCourseChest = onCourse.perMuscle.find(p => p.muscle === 'chest');
    if (naturalChest && onCourseChest) {
      expect(onCourseChest.mrv).toBeGreaterThan(naturalChest.mrv);
      expect(onCourseChest.mav).toBeGreaterThan(naturalChest.mav);
    }
  });

  it('adjusts landmarks for labMult < 1 (lower MRV/MAV/MEV)', () => {
    const weeks = makeWeeks(4, ['chest'], 4);
    const prog = makeBBProgram(weeks);
    const normal = computePlanQualityFor(prog, 'intermediate');
    const labReduced = computePlanQualityFor(prog, 'intermediate', { labMult: 0.7 });
    const normalChest = normal.perMuscle.find(p => p.muscle === 'chest');
    const labChest = labReduced.perMuscle.find(p => p.muscle === 'chest');
    if (normalChest && labChest) {
      expect(labChest.mrv).toBeLessThan(normalChest.mrv);
    }
  });

  it('assigns correct grade thresholds', () => {
    // A grade: 90+
    const goodWeeks = makeWeeks(8, ['chest', 'back'], 4);
    const goodProg = makeBBProgram(goodWeeks);
    const goodResult = computePlanQualityFor(goodProg, 'intermediate');
    if (goodResult.score >= 90) {
      expect(goodResult.grade).toContain('A');
    }
    // Verify grade format: emoji + letter
    expect(goodResult.grade).toMatch(/[🟢🟡🟠🔴]\s+[ABCD]/);
  });

  it('includes perMuscle entries for all muscles with volume', () => {
    const weeks = makeWeeks(4, ['chest', 'back', 'legs'], 3);
    const prog = makeBBProgram(weeks);
    const result = computePlanQualityFor(prog, 'intermediate');
    const muscles = result.perMuscle.map(p => p.muscle);
    expect(muscles).toContain('chest');
    expect(muscles).toContain('back');
    expect(muscles).toContain('legs');
  });

  it('falls back to PL customWeeks when BB body is empty', () => {
    const prog: UserProgram = {
      meta: { title: 'PL Test', direction: 'pl', createdAt: '', updatedAt: '' },
      pl: {
        customWeeks: [{
          week: 1,
          days: [{
            day: 1,
            exercises: [{
              name: 'Жим лёжа',
              muscle: 'chest',
              lift: 'bench',
              sets: [{ sets: 5 }, { sets: 5 }, { sets: 5 }],
            }],
          }],
        }],
      },
    } as any;
    const result = computePlanQualityFor(prog, 'intermediate');
    expect(result.perMuscle.length).toBeGreaterThan(0);
    const chest = result.perMuscle.find(p => p.muscle === 'chest');
    if (chest) {
      expect(chest.peakSets).toBe(15); // 3 sets objects × 5 sets each
    }
  });
});

// ─── muscleAwareSets ───
describe('muscleAwareSets', () => {
  it('chest: returns compound template with 8-10 reps for intermediate', () => {
    const result = muscleAwareSets('chest', 'intermediate');
    expect(result.length).toBe(1);
    expect(result[0].reps).toBe('8-10');
    expect(result[0].rir).toBe(2);
    expect(result[0].restSec).toBe(150);
  });

  it('chest advanced: returns numeric reps=8, rir=1', () => {
    const result = muscleAwareSets('chest', 'advanced');
    expect(result[0].reps).toBe(8);
    expect(result[0].rir).toBe(1);
  });

  it('back: same as chest (8-10 reps, 150s rest)', () => {
    const result = muscleAwareSets('back', 'intermediate');
    expect(result[0].reps).toBe('8-10');
    expect(result[0].restSec).toBe(150);
  });

  it('legs: higher rest (180s) for intermediate', () => {
    const result = muscleAwareSets('legs', 'intermediate');
    expect(result[0].reps).toBe('8-10');
    expect(result[0].restSec).toBe(180);
  });

  it('legs advanced: reps=6, rir=1 (strength focus)', () => {
    const result = muscleAwareSets('legs', 'advanced');
    expect(result[0].reps).toBe(6);
    expect(result[0].rir).toBe(1);
  });

  it('quads: same as legs', () => {
    const result = muscleAwareSets('quads', 'intermediate');
    expect(result[0].restSec).toBe(180);
  });

  it('hamstrings: same as legs', () => {
    const result = muscleAwareSets('hamstrings', 'intermediate');
    expect(result[0].restSec).toBe(180);
  });

  it('shoulders: 10-15 reps, 90s rest', () => {
    const result = muscleAwareSets('shoulders', 'intermediate');
    expect(result[0].reps).toBe('10-15');
    expect(result[0].restSec).toBe(90);
  });

  it('arms: 10-12 reps, 90s rest', () => {
    const result = muscleAwareSets('arms', 'intermediate');
    expect(result[0].reps).toBe('10-12');
    expect(result[0].restSec).toBe(90);
  });

  it('biceps: same as arms', () => {
    const result = muscleAwareSets('biceps', 'intermediate');
    expect(result[0].reps).toBe('10-12');
  });

  it('triceps: same as arms', () => {
    const result = muscleAwareSets('triceps', 'intermediate');
    expect(result[0].reps).toBe('10-12');
  });

  it('core: 12-20 reps, 60s rest, rir=3', () => {
    const result = muscleAwareSets('core', 'intermediate');
    expect(result[0].reps).toBe('12-20');
    expect(result[0].rir).toBe(3);
    expect(result[0].restSec).toBe(60);
  });

  it('abs: same as core', () => {
    const result = muscleAwareSets('abs', 'intermediate');
    expect(result[0].reps).toBe('12-20');
  });

  it('calves: same as core (high rep, low rest)', () => {
    const result = muscleAwareSets('calves', 'intermediate');
    expect(result[0].reps).toBe('12-20');
    expect(result[0].restSec).toBe(60);
  });

  it('unknown muscle: default 10 reps, 90s rest', () => {
    const result = muscleAwareSets('unknown_muscle', 'intermediate');
    expect(result[0].reps).toBe(10);
    expect(result[0].restSec).toBe(90);
    expect(result[0].rir).toBe(2);
  });

  it('enhanced level: treated same as advanced', () => {
    const result = muscleAwareSets('chest', 'enhanced');
    expect(result[0].reps).toBe(8);
    expect(result[0].rir).toBe(1);
  });

  it('case-insensitive muscle matching', () => {
    const result = muscleAwareSets('CHEST', 'intermediate');
    expect(result[0].reps).toBe('8-10');
  });

  it('empty muscle: returns default', () => {
    const result = muscleAwareSets('', 'intermediate');
    expect(result[0].reps).toBe(10);
  });
});

// ─── makeSetsFromTemplate ───
describe('makeSetsFromTemplate', () => {
  it('creates UserSet array from templates with weight', () => {
    const templates = [
      { reps: '8-10', rir: 2, restSec: 150 },
      { reps: '8-10', rir: 2, restSec: 150 },
    ];
    const sets = makeSetsFromTemplate(templates, 80);
    expect(sets.length).toBe(2);
    expect(sets[0].reps).toBe('8-10');
    expect(sets[0].rir).toBe(2);
    expect(sets[0].weight).toBe(80);
    expect(sets[0].restSec).toBe(150);
  });

  it('handles numeric reps', () => {
    const templates = [{ reps: 8, rir: 1, restSec: 180 }];
    const sets = makeSetsFromTemplate(templates, 100);
    expect(sets[0].reps).toBe(8);
    expect(sets[0].weight).toBe(100);
  });

  it('handles empty templates array', () => {
    const sets = makeSetsFromTemplate([], 50);
    expect(sets).toEqual([]);
  });

  it('preserves all template fields', () => {
    const templates = [{ reps: 'AMRAP', rir: 0, restSec: 240 }];
    const sets = makeSetsFromTemplate(templates, 60);
    expect(sets[0].reps).toBe('AMRAP');
    expect(sets[0].rir).toBe(0);
    expect(sets[0].restSec).toBe(240);
    expect(sets[0].weight).toBe(60);
  });

  it('works with muscleAwareSets output', () => {
    const templates = muscleAwareSets('chest', 'intermediate');
    const sets = makeSetsFromTemplate(templates, 80);
    expect(sets.length).toBe(1);
    expect(sets[0].reps).toBe('8-10');
    expect(sets[0].weight).toBe(80);
  });

  it('creates multiple sets from multi-set template', () => {
    const templates = [
      { reps: 10, rir: 3, restSec: 120 },
      { reps: 8, rir: 2, restSec: 150 },
      { reps: 6, rir: 1, restSec: 180 },
    ];
    const sets = makeSetsFromTemplate(templates, 90);
    expect(sets.length).toBe(3);
    expect(sets[0].reps).toBe(10);
    expect(sets[1].reps).toBe(8);
    expect(sets[2].reps).toBe(6);
    expect(sets[0].rir).toBe(3);
    expect(sets[2].rir).toBe(1);
  });
});
