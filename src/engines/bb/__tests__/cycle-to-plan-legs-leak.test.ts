import { describe, it, expect } from 'vitest';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from '../../../ui/screens/TrainingScreen_parts/programs-data';
import { programToBBPlan } from '../cycle-to-plan';
import type { FullProgram } from '../../complete-program-library.engine';

/**
 * Regression: leg exercises leaking into Push/Pull/Chest/Back/Shoulders/Arms days.
 *
 * Root causes (all fixed):
 *  1. `replacePLForBB` regex `наклон` matched the adjective «наклонной/наклонная»
 *     (Incline DB Press, Жим на наклонной) → they became «Румынская тяга» (legs).
 *  2. `replacePLForBB` regex `классич` matched «классические» (Отжимания классические) →
 *     became «Румынская тяга» (legs). Also `трап` matched «трапеции» (shrugs).
 *  3. `sessionTag` derivation checked only `quads/hamstrings/glutes` for `isLegs`, but
 *     the catalog uses the composite group `legs` for most compounds (Приседания,
 *     Фронтальный присед, RDL, Жим ногами, Hip Thrust, Ягодичный мост). Days composed
 *     solely of leg-compounds were mis-tagged as 'Chest'/'Back'/'Push'.
 *  4. Superset parser used `sepIdx` from the original string but sliced the
 *     `replace`-cleaned string → leftName truncated ("Молотки + Разгиба" instead of
 *     "Молотки") → wrong muscle classification.
 *  5. Translation: «Glute Bridge» → «Ягодичный мостик» (NOT in catalog), «Abductor Machine»
 *     → «Сведение ног в тренажёре (отведение)» (NOT in catalog → keyword fallback
 *     matched «сведен» → 'chest'). Now aligned with catalog entries.
 */
const LEG_MUSCLES = new Set(['quads','hamstrings','glutes','calves','legs']);
const LEGS_DAY_TAGS = new Set(['Legs','Lower','LowerPower','LowerHyp','Limbs','Glutes','GlutesHams','FullBody']);
const WM = { chest:100, back:110, legs:140, shoulders:60, arms:50, core:60, traps:60, hamstrings:90, glutes:160, calves:120, forearms:50 } as Record<string, number>;
const EQ = ['barbell','dumbbell','machine','cable','bodyweight'];
const ALL_PROGRAMS: FullProgram[] = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];

describe('programToBBPlan: no leg-exercises leak into upper-body days', () => {
  for (const prog of ALL_PROGRAMS) {
    it(`${prog.id} (adapt mode)`, () => {
      const plan = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: [], pedDoses: {}, mode: 'adapt',
      } as any);
      const leaked: string[] = [];
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          if (LEGS_DAY_TAGS.has(s.sessionTag || '')) continue;
          for (const e of s.exercises) {
            if (LEG_MUSCLES.has((e.muscle || '').toLowerCase())) {
              leaked.push(`w${w.week}[${s.sessionTag}] ${e.muscle}:${e.exerciseName}`);
            }
          }
        }
      }
      expect(leaked).toEqual([]);
    });

    it(`${prog.id} (faithful mode)`, () => {
      const plan = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: [], pedDoses: {}, mode: 'faithful',
      } as any);
      const leaked: string[] = [];
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          if (LEGS_DAY_TAGS.has(s.sessionTag || '')) continue;
          for (const e of s.exercises) {
            if (LEG_MUSCLES.has((e.muscle || '').toLowerCase())) {
              leaked.push(`w${w.week}[${s.sessionTag}] ${e.muscle}:${e.exerciseName}`);
            }
          }
        }
      }
      expect(leaked).toEqual([]);
    });
  }
});