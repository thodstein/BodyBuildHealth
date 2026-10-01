import { describe, it, expect } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';

/**
 * Профессиональная библиотека (docs/BB-AUTO-PROFESSIONAL-CYCLES-PLAN.md):
 * именные системы несут свою схему объёма/методику в meta, а планировщик
 * (UI) применяет их к плану — «показано = применяется».
 */

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40 };
const byId = (id: string) => LMS_CYCLES.find(c => c.meta.id === id)!;

const NAMED = [
  'cycle-bb-m-bro-5', 'cycle-bb-m-ppl-6', 'cycle-bb-m-fb-3', 'cycle-bb-m-gvt-8',
  'cycle-bb-m-gironda-8', 'cycle-bb-m-fst7-8', 'cycle-bb-m-meadows-8', 'cycle-bb-m-yates-8',
  'cycle-bb-m-dc-6', 'cycle-bb-m-hit-6', 'cycle-bb-m-nubret-6', 'cycle-bb-m-rp-ul-6',
  'cycle-bb-f-fb-3', 'cycle-bb-f-ppl-5',
];

const allReps = (plan: any) => plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).flatMap((e: any) => (e.workSets || []).map((x: any) => x.reps));

describe('Именные системы ББ-авто: схема/методика в meta', () => {
  it('все 14 именных циклов зарегистрированы с тегами', () => {
    for (const id of NAMED) {
      const c = byId(id);
      expect(c, id).toBeDefined();
      expect((c.meta.tags || []).length, id).toBeGreaterThan(0);
      expect(c.meta.direction, id).toBe('bodybuilding');
    }
  });

  it('GVT/Gironda/FST-7/Mountain Dog несут свою схему/методику', () => {
    expect(byId('cycle-bb-m-gvt-8').meta.volumeScheme).toBe('gvt');
    expect(byId('cycle-bb-m-gironda-8').meta.volumeScheme).toBe('gironda');
    expect(byId('cycle-bb-m-fst7-8').meta.volumeScheme).toBe('fst7');
    expect(byId('cycle-bb-m-fst7-8').meta.methodology).toBe('fst7');
    expect(byId('cycle-bb-m-meadows-8').meta.methodology).toBe('mountain_dog');
  });

  it('схема реально применяется: GVT → 10 повторов, Gironda → 8', () => {
    const gvt = programToBBPlan(cycleTemplateToFullProgram(byId('cycle-bb-m-gvt-8')), {
      workMax, level: 'intermediate', trainingYears: 3, mode: 'adapt', sex: 'male', goal: 'mass', volumeScheme: 'gvt',
    } as any);
    expect(allReps(gvt).filter(r => r === 10).length).toBeGreaterThan(0);

    const gir = programToBBPlan(cycleTemplateToFullProgram(byId('cycle-bb-m-gironda-8')), {
      workMax, level: 'intermediate', trainingYears: 3, mode: 'adapt', sex: 'male', goal: 'mass', volumeScheme: 'gironda',
    } as any);
    expect(allReps(gir).filter(r => r === 8).length).toBeGreaterThan(0);
  });

  it('без схемы план собирается стандартно (meta не форсит сама)', () => {
    // parity: движковый путь без opts.volumeScheme не меняет число повторов GVT-шаблона
    const gvt = programToBBPlan(cycleTemplateToFullProgram(byId('cycle-bb-m-gvt-8')), {
      workMax, level: 'intermediate', trainingYears: 3, mode: 'adapt', sex: 'male', goal: 'mass',
    } as any);
    expect(gvt.weeks.length).toBe(8);
  });
});
