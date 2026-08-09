import { describe, it, expect } from 'vitest';
import { buildLMSPlan } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_09K } from '../../../data/lms-cycles/cycle-09k';
import { CYCLE_02 } from '../../../data/lms-cycles/cycle-02';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

describe('Original cycle integrity: weeks[] preserved exactly', () => {

  function checkCycleIntegrity(cycle: SRCycleTemplate, label: string) {
    it(`${label}: all 12 weeks preserve source pct/reps/sets exactly (AUTO OFF, no autoReg)`, () => {
      const plan = buildLMSPlan({
        template: cycle,
        pmMap,
        fallbackPm: 80,
        faithful: true,
        weeksOverride: cycle.meta.weeks,
        progressionEnabled: false,
      });

      expect(plan.weeks.length).toBe(cycle.weeks!.length);

      for (let wi = 0; wi < cycle.weeks!.length; wi++) {
        const sourceWeek = cycle.weeks![wi];
        const planWeek = plan.weeks[wi];

        expect(planWeek.days.length).toBe(sourceWeek.length);

        for (let di = 0; di < sourceWeek.length; di++) {
          const sourceDay = sourceWeek[di];
          const planDay = planWeek.days[di];

          // Same number of source exercises (injected weak points are extra)
          const sourceExCount = sourceDay.exercises.length;
          expect(planDay.exercises.length).toBeGreaterThanOrEqual(sourceExCount);

          for (let ei = 0; ei < sourceExCount; ei++) {
            const sourceEx = sourceDay.exercises[ei];
            const planEx = planDay.exercises[ei];

            expect(planEx.name).toBe(sourceEx.name);
            expect(planEx.workSets.length).toBe(sourceEx.sets.length);

            for (let si = 0; si < sourceEx.sets.length; si++) {
              const srcSet = sourceEx.sets[si];
              const planSet = planEx.workSets[si];

              // pct MUST match exactly
              expect(planSet.pct).toBe(srcSet.pct);

              // reps MUST match exactly
              expect(planSet.reps).toBe(srcSet.reps);

              // sets MUST match exactly (no autoReg, no ACWR → no modification)
              expect(planSet.sets).toBe(srcSet.sets);
            }
          }
        }
      }
    });

    it(`${label}: weights = PM × pct when AUTO OFF (flat PM, no autoReg)`, () => {
      const plan = buildLMSPlan({
        template: cycle,
        pmMap,
        fallbackPm: 80,
        faithful: true,
        weeksOverride: cycle.meta.weeks,
        progressionEnabled: false,
      });

      for (const week of plan.weeks) {
        for (const day of week.days) {
          for (const ex of day.exercises) {
            const pm = week.pmRow[ex.name];
            expect(pm).toBeDefined();
            for (const ws of ex.workSets) {
              const expectedWeight = Math.round(pm * ws.pct * 10) / 10;
              expect(ws.weight).toBe(expectedWeight);
            }
          }
        }
      }
    });

    it(`${label}: PM is flat (same every week) when AUTO OFF`, () => {
      const plan = buildLMSPlan({
        template: cycle,
        pmMap,
        fallbackPm: 80,
        faithful: true,
        weeksOverride: cycle.meta.weeks,
        progressionEnabled: false,
      });

      const firstWeekPm = plan.weeks[0].pmRow;
      for (const week of plan.weeks) {
        for (const [name, pm] of Object.entries(week.pmRow)) {
          expect(pm).toBe(firstWeekPm[name]);
        }
      }
    });

    it(`${label}: PM progresses when AUTO ON (default)`, () => {
      const plan = buildLMSPlan({
        template: cycle,
        pmMap,
        fallbackPm: 80,
        faithful: true,
        weeksOverride: cycle.meta.weeks,
        // progressionEnabled defaults to true
      });

      // Use first exercise name from week1
      const exName = cycle.week1[0].exercises[0].name;
      const w1Pm = plan.weeks[0].pmRow[exName];
      const wLastPm = plan.weeks[plan.weeks.length - 1].pmRow[exName];
      expect(w1Pm).toBeDefined();
      expect(wLastPm).toBeDefined();
      expect(wLastPm).toBeGreaterThan(w1Pm);
    });

    it(`${label}: source percentages preserved even when AUTO ON`, () => {
      const plan = buildLMSPlan({
        template: cycle,
        pmMap,
        fallbackPm: 80,
        faithful: true,
        weeksOverride: cycle.meta.weeks,
        // progressionEnabled defaults to true
      });

      for (let wi = 0; wi < cycle.weeks!.length; wi++) {
        const sourceWeek = cycle.weeks![wi];
        const planWeek = plan.weeks[wi];

        for (let di = 0; di < sourceWeek.length; di++) {
          const sourceDay = sourceWeek[di];
          const planDay = planWeek.days[di];

          for (let ei = 0; ei < sourceDay.exercises.length; ei++) {
            const sourceEx = sourceDay.exercises[ei];
            const planEx = planDay.exercises[ei];

            for (let si = 0; si < sourceEx.sets.length; si++) {
              expect(planEx.workSets[si].pct).toBe(sourceEx.sets[si].pct);
              expect(planEx.workSets[si].reps).toBe(sourceEx.sets[si].reps);
            }
          }
        }
      }
    });

    it(`${label}: weeks[0] === week1 (data consistency)`, () => {
      expect(cycle.weeks).toBeDefined();
      expect(cycle.weeks!.length).toBeGreaterThan(0);
      expect(cycle.weeks![0].length).toBe(cycle.week1.length);
      for (let di = 0; di < cycle.week1.length; di++) {
        const w1Day = cycle.week1[di];
        const w0Day = cycle.weeks![0][di];
        expect(w1Day.exercises.length).toBe(w0Day.exercises.length);
        for (let ei = 0; ei < w1Day.exercises.length; ei++) {
          expect(w1Day.exercises[ei].name).toBe(w0Day.exercises[ei].name);
          expect(w1Day.exercises[ei].sets.length).toBe(w0Day.exercises[ei].sets.length);
          for (let si = 0; si < w1Day.exercises[ei].sets.length; si++) {
            expect(w1Day.exercises[ei].sets[si].pct).toBe(w0Day.exercises[ei].sets[si].pct);
            expect(w1Day.exercises[ei].sets[si].reps).toBe(w0Day.exercises[ei].sets[si].reps);
            expect(w1Day.exercises[ei].sets[si].sets).toBe(w0Day.exercises[ei].sets[si].sets);
          }
        }
      }
    });
  }

  checkCycleIntegrity(CYCLE_01, 'CYCLE_01');
  checkCycleIntegrity(CYCLE_02, 'CYCLE_02');
  checkCycleIntegrity(CYCLE_09K, 'CYCLE_09K');
});
