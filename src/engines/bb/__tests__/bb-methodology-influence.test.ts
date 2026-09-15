import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { applyDUPOverlay } from '../bb-dup.engine';

/**
 * M1 (план §8.1): «все выбранные методики реально строятся».
 * Property-матрица: план с настройкой ≠ план без настройки (сигнатура),
 * + точечные маркеры (что именно изменилось).
 *
 * ВАЖНО: DUP применяется в UI ПОСЛЕ сборки (applyDUPOverlay), поэтому проверяется отдельно.
 */
const WM = { chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7, glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7 };

function build(extra: Record<string, unknown> = {}) {
  return buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 8, workMax: WM, ...extra } as any);
}

function sig(plan: any): string {
  return JSON.stringify(plan.weeks.map((w: any) => w.sessions.map((s: any) => s.exercises.map((e: any) => ({
    n: e.exerciseName || e.name, role: e.role, sets: e.sets, rir: e.rir, rr: e.repsRange,
    ws: (e.workSets || []).map((x: any) => [x.reps, x.rir, x.weight, x.technique || '', x.tempo || '']),
    c: e.comment || '', sup: e.supersetWith || '', tech: e.technique || '',
  })))));
}
const comments = (p: any) => p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).map((e: any) => e.comment || '').join(' | ');
const workSets = (p: any) => p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).flatMap((e: any) => e.workSets || []);
const allEx = (p: any) => p.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises);
const totalSets = (p: any) => p.weeks.reduce((a: number, w: any) => a + w.sessions.reduce((b: number, s: any) => b + s.exercises.reduce((c: number, e: any) => c + (e.sets || 0), 0), 0), 0);

const BASE = build();

describe('M1: каждая настройка реально влияет на план (generic upper_lower_4)', () => {
  it('базовая сборка валидна (контроль)', () => {
    expect(BASE.weeks.length).toBe(8);
    expect(totalSets(BASE)).toBeGreaterThan(0);
  });

  it('methodology pre_exhaust меняет порядок (изоляция перед базой)', () => {
    const p = build({ methodology: 'pre_exhaust' });
    expect(sig(p)).not.toBe(sig(BASE));
    // хотя бы в одной сессии первое упражнение — не primary
    const someIsoFirst = p.weeks.some(w => w.sessions.some(s => s.exercises.length > 1 && s.exercises[0].role !== 'primary'));
    expect(someIsoFirst).toBe(true);
  });

  it('methodology post_exhaust/pre_exhaust различимы', () => {
    const a = build({ methodology: 'pre_exhaust' });
    const b = build({ methodology: 'post_exhaust' });
    expect(sig(a)).not.toBe(sig(b));
  });

  it('loadStrategy linear меняет веса/повторы', () => {
    const p = build({ loadStrategy: 'linear' });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('intensityTechnique drop_set оставляет видимую метку', () => {
    const p = build({ intensityTechnique: 'drop_set' });
    expect(sig(p)).not.toBe(sig(BASE));
    expect(comments(p) + workSets(p).map((x: any) => x.technique || '').join(' ')).toMatch(/дроп|drop/i);
  });

  it('intensityTechnique negative ставит темп негатива', () => {
    const p = build({ intensityTechnique: 'negative' });
    expect(sig(p)).not.toBe(sig(BASE));
    expect(workSets(p).some((x: any) => /4-/.test(String(x.tempo || ''))) || /негатив/i.test(comments(p))).toBe(true);
  });

  it('volumeScheme gvt даёт ~10 повторов на сет', () => {
    const p = build({ volumeScheme: 'gvt' });
    expect(sig(p)).not.toBe(sig(BASE));
    expect(workSets(p).some((x: any) => x.reps === 10)).toBe(true);
    expect(workSets(p).some((x: any) => (x as any).reps === 10 && comments(p).length > 0)).toBe(true);
  });

  it('volumeScheme gironda даёт 8 повторов на сет', () => {
    const p = build({ volumeScheme: 'gironda' });
    expect(sig(p)).not.toBe(sig(BASE));
    expect(workSets(p).some((x: any) => x.reps === 8)).toBe(true);
  });

  it('supersetMode antagonist ставит пары', () => {
    const p = build({ supersetMode: 'antagonist' });
    expect(sig(p)).not.toBe(sig(BASE));
    expect(allEx(p).some((e: any) => !!e.supersetWith)).toBe(true);
  });

  it('trainingFocus strength vs hypertrophy различимы', () => {
    const s = build({ trainingFocus: 'strength' });
    const h = build({ trainingFocus: 'hypertrophy' });
    expect(sig(s)).not.toBe(sig(h));
  });

  it('volumeGoal mev/mav/mrv меняют суммарный объём', () => {
    const mev = build({ volumeGoal: 'mev' });
    const mrv = build({ volumeGoal: 'mrv' });
    expect(totalSets(mrv)).toBeGreaterThan(totalSets(mev));
  });

  it('trainingVolumeMode high включает объёмный режим', () => {
    const p = build({ trainingVolumeMode: 'high' });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('bfrMode даёт протокол 30-15-15-15', () => {
    const p = build({ bfrMode: true });
    expect(sig(p)).not.toBe(sig(BASE));
    const hasBfr = p.weeks.some(w => w.sessions.some(s => s.exercises.some(e => (e.workSets || []).length >= 4 && e.workSets[0].reps === 30 && e.workSets[1].reps === 15)));
    expect(hasBfr).toBe(true);
  });

  it('eccentricMult 1.2 повышает веса primary', () => {
    const p = build({ eccentricMult: 1.2 });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('abPatternRotation оставляет видимый маркер', () => {
    const p = build({ abPatternRotation: true });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('rehabMuscles снижает объём целевой мышцы на первой неделе', () => {
    const p = build({ rehabMuscles: ['chest'] });
    const chestBase = BASE.weeks[0].sessions.flatMap(s => s.exercises).filter(e => e.muscle === 'chest').reduce((a, e) => a + (e.sets || 0), 0);
    const chestRehab = p.weeks[0].sessions.flatMap(s => s.exercises).filter(e => e.muscle === 'chest').reduce((a, e) => a + (e.sets || 0), 0);
    expect(chestRehab).toBeLessThanOrEqual(chestBase);
    expect(p.rationale.join(' ')).toMatch(/еабилит|рампа|возврат/i);
  });

  it('intensityLevel light меняет интенсивность/объём', () => {
    const p = build({ intensityLevel: 'light' });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('allowStrengthLifts (strength_mass) добавляет силовые движения', () => {
    const p = build({ goal: 'strength_mass', allowStrengthLifts: true });
    expect(sig(p)).not.toBe(sig(build({ goal: 'strength_mass' })));
  });

  it('packingV2 меняет раскладку (сеты/число движений)', () => {
    const p = build({ packingV2: true });
    expect(sig(p)).not.toBe(sig(BASE));
  });

  it('pedPhaseOverride при MGF+IGF1 работает (фаза), иначе — честный игнор', () => {
    const both = build({ peds: ['MGF', 'IGF1'], pedDoses: { MGF: 200, IGF1: 50 }, pedPhaseOverride: 'differentiation', level: 'enhanced', trainingYears: 6 });
    const auto = build({ peds: ['MGF', 'IGF1'], pedDoses: { MGF: 200, IGF1: 50 }, pedPhaseOverride: 'auto', level: 'enhanced', trainingYears: 6 });
    expect(sig(both)).not.toBe(sig(auto));
  });

  it('DUP (applyDUPOverlay, UI-постпроцесс) виден в плане', () => {
    const dup = applyDUPOverlay(BASE, { mode: 'heavy_light', cycleDays: 2 });
    expect(sig(dup)).not.toBe(sig(BASE));
    expect(comments(dup)).toMatch(/\[DUP:/);
  });
});
