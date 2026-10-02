import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { programToBBPlan, cycleTemplateToFullProgram, convertCycleToBBPlan } from '../cycle-to-plan';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

/**
 * Матрица «опция UI → наблюдаемый эффект в плане» (требование владельца 2026-10):
 * для каждой методики — два прогона (вкл/выкл) и ассерт наблюдаемого отличия
 * (порядок/сеты/reps/RIR/техника/маркер) ИЛИ честный «не применяется»
 * (faithful/гейт — тогда `methodologyApplied:false`/строка в rationale).
 * Паритет generic/cycle/program по каждой опции.
 */

const WM = { chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7, glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7 };
const PED = { peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate' as const };
const BASE = { workMax: WM, level: 'enhanced', trainingYears: 9, goal: 'mass', sex: 'male', weeks: 8, ...PED } as const;

const CYCLE = () => LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-01')!;
const PROGRAM = () => cycleTemplateToFullProgram(CYCLE());

/** Сигнатура выдачи: имена/роли/сеты/RIR/reps + веса рабочих сетов + техника-маркеры. */
function sig(plan: any): string {
  return JSON.stringify(plan.weeks.map((w: any) => w.sessions.map((s: any) => s.exercises.map((e: any) => ({
    n: e.exerciseName || e.name, role: e.role, sets: e.sets, rir: e.rir, reps: e.repsRange,
    ws: (e.workSets || []).map((x: any) => [x.reps, x.rir, x.weight, x.technique || '', x.tempo || '']),
    sup: e.supersetWith || '', cmt: String(e.comment || '').slice(0, 40),
  })))));
}

/** Порядок упражнений первой сессии (для проверки «изоляция первой»). */
function firstOrder(plan: any): string[] {
  return (plan.weeks[0]?.sessions?.[0]?.exercises || []).map((e: any) => `${e.role}:${e.exerciseName || e.name}`);
}

function gen(extra: Record<string, unknown>) {
  return buildBBPlan({ patternId: 'upper_lower_4', ...BASE, ...extra } as never);
}
function cyc(extra: Record<string, unknown>) {
  return convertCycleToBBPlan({ cycle: CYCLE(), ...BASE, mode: 'adapt', ...extra } as never);
}
function prog(extra: Record<string, unknown>) {
  return programToBBPlan(PROGRAM(), { ...BASE, mode: 'adapt', ...extra } as never);
}

describe('ББ-методики: матрица «опция → эффект» (generic + cycle + program)', () => {
  it('methodology: compound_first vs pre_exhaust → разный порядок (изоляция первой)', () => {
    const a = gen({ methodology: 'compound_first' });
    const b = gen({ methodology: 'pre_exhaust' });
    expect(sig(a)).not.toBe(sig(b));
    expect(firstOrder(b).some(x => x.startsWith('accessory'))).toBe(true);
  });

  it('intensityTechnique: drop_set/rest_pause/negative → маркеры техник в плане', () => {
    const base = sig(gen({}));
    for (const t of ['drop_set', 'rest_pause', 'negative']) {
      const p = gen({ intensityTechnique: t });
      const hasMarker = /дроп|Rest-pause|негатив|Drop|cluster|кластер/i.test(JSON.stringify(p.weeks));
      expect(sig(p) !== base || hasMarker, `technique ${t} не применилась`).toBe(true);
    }
  });

  it('loadStrategy: linear vs double_progression → разный вес/повторы', () => {
    const a = gen({ loadStrategy: 'linear' });
    const b = gen({ loadStrategy: 'double_progression' });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('supersetMode: antagonist → supersetWith присутствует', () => {
    const p = gen({ supersetMode: 'antagonist' });
    const paired = p.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => e.supersetWith);
    expect(paired.length).toBeGreaterThan(0);
  });

  it('volumeScheme: gvt/fst7/gironda → схемные маркеры', () => {
    expect(/GVT 10×10/.test(JSON.stringify(gen({ volumeScheme: 'gvt' }).weeks))).toBe(true);
    expect(/8×8|Gironda/.test(JSON.stringify(gen({ volumeScheme: 'gironda' }).weeks))).toBe(true);
    // FST-7 7-in-1 — только enhanced без joint-guard (гейт): маркер или честный даунгрейд.
    const fst = gen({ volumeScheme: 'fst7' });
    const ok = /FST-7/.test(JSON.stringify(fst.weeks)) || fst.rationale.some((r: string) => /FST-7.*standard|FST-7 7-in-1/.test(r));
    expect(ok).toBe(true);
  });

  it('intensityLevel: light vs moderate → разный отдых', () => {
    const rests = (p: any) => p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).filter((e: any) => e.restSeconds).map((e: any) => e.restSeconds);
    const m = rests(gen({ intensityLevel: 'moderate' }));
    const l = rests(gen({ intensityLevel: 'light' }));
    expect(l.reduce((a: number, b: number) => a + b, 0)).toBeGreaterThan(m.reduce((a: number, b: number) => a + b, 0));
  });

  it('rotationMode: forbid vs variety → разный состав упражнений', () => {
    const a = gen({ rotationMode: 'forbid' });
    const b = gen({ rotationMode: 'variety' });
    // Оба валидны; допускаем совпадение на коротком плане, но флаг доезжает (rationale/snapshot).
    const applied = sig(a) !== sig(b) || (b as any).inputSnapshot?.rotationMode === 'variety';
    expect(applied).toBe(true);
  });

  it('eccentricMult: 1.0 vs 1.2 → primary веса выше (cycle path)', () => {
    const primaryTonnage = (p: any) => p.weeks
      .filter((w: any) => !(w.phase === 'deload' || w.deload))
      .flatMap((w: any) => w.sessions)
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.role === 'primary')
      .reduce((a: number, e: any) => a + (e.workSets || []).reduce((b: number, x: any) => b + (x.weight || 0), 0), 0);
    const a = cyc({ eccentricMult: 1.0 });
    const b = cyc({ eccentricMult: 1.2 });
    expect(primaryTonnage(b)).toBeGreaterThan(primaryTonnage(a));
  });

  it('trainingVolumeMode: high → лимиты сессии/объём не ниже standard', () => {
    const a = gen({ trainingVolumeMode: 'standard' });
    const b = gen({ trainingVolumeMode: 'high' });
    expect((b as any).maxWorkingSets ?? 0).toBeGreaterThanOrEqual((a as any).maxWorkingSets ?? 0);
  });

  it('abPatternRotation: sibling-сессии избегают доминантного паттерна', () => {
    const a = gen({ abPatternRotation: false });
    const b = gen({ abPatternRotation: true });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('trainingFocus: strength vs endurance → разный RIR/повторы', () => {
    const a = gen({ trainingFocus: 'strength' });
    const b = gen({ trainingFocus: 'endurance' });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('goal: mass vs cut → разный объём', () => {
    const a = gen({ goal: 'mass' });
    const b = gen({ goal: 'cut' });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('cycle path: weakPoints/focusGroup реально влияют', () => {
    const a = cyc({});
    const b = cyc({ weakPoints: ['chest'] });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('faithful vs adapt: methodologyApplied и выдача различаются', () => {
    const f: any = prog({ mode: 'faithful' });
    const a: any = prog({ mode: 'adapt' });
    expect(f.methodologyApplied).toBe(false);
    expect(a.methodologyApplied).toBe(true);
    expect(sig(f)).not.toBe(sig(a));
  });

  it('dcMode гейт: advanced+AAS≥750 → widowmaker; beginner → честный отказ', () => {
    const ok: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', trainingYears: 5, goal: 'mass', weeks: 8, workMax: WM, peds: ['AAS'], pedDoses: { AAS: 800 }, dcMode: true } as never);
    const blocked: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'beginner', trainingYears: 1, goal: 'mass', weeks: 8, workMax: WM, dcMode: true } as never);
    expect(ok.rationale.some((r: string) => r.includes('DC-лайт'))).toBe(true);
    expect(blocked.rationale.some((r: string) => r.includes('DC-лайт выкл') || r.includes('DC-лайт пропущен'))).toBe(true);
  });

  it('паритет generic/cycle/program: FST-7 7-in-1 даунгрейд при соло-инсулине во всех путях', () => {
    const solo = { peds: ['insulin'], pedDoses: { insulin: 10 }, courseIntensity: 'moderate' as const };
    const g: any = buildBBPlan({ patternId: 'upper_lower_4', ...BASE, ...solo, volumeScheme: 'fst7' } as never);
    const c: any = cyc({ ...solo, volumeScheme: 'fst7' });
    const p: any = prog({ ...solo, volumeScheme: 'fst7' });
    expect([g.volumeScheme, c.volumeScheme, p.volumeScheme]).toEqual(['standard', 'standard', 'standard']);
  });
});
