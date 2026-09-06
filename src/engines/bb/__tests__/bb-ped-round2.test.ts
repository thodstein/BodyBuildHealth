import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from '../bb-ped-adaptation.engine';
import { recommendPEDMethodology, suggestMethodologyForStack } from '../bb-ped-methodology.engine';

/**
 * bb-ped-round2.test.ts — второй раунд PED-плана (доводка до полного):
 * E: ручной оверрайд фазы; A: авто-выбор методики; C: MGF +1 слот + dayMap;
 * D: DC-лайт (гейт, ротация-3, widowmaker, круиз-каденс).
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

function buildWithPED(input: BBBuilderInput, peds: PED[], doses: Record<string, number>, intensity: CourseIntensity = 'moderate') {
  const pedAdapt = adaptForPEDs(peds, 20, doses, intensity);
  return buildBBPlan({ ...input, pedDoses: doses } as any, pedAdapt);
}

describe('E: ручной оверрайд фазы', () => {
  const both = { peds: ['MGF', 'IGF1'] as any, pedDoses: { MGF: 200, IGF1: 50 }, level: 'advanced', totalWeeks: 8 };
  it('override proliferation форсит все недели', () => {
    const m = recommendPEDMethodology({ ...both, phaseOverride: 'proliferation' });
    expect(m.pedPhase).toBe('proliferation');
    expect(m.pedPhaseByWeek).toHaveLength(8);
    expect(m.pedPhaseByWeek.every(p => p === 'proliferation')).toBe(true);
    expect(m.rationale.some(r => r.includes('вручную'))).toBe(true);
  });
  it('override differentiation форсит все недели', () => {
    const m = recommendPEDMethodology({ ...both, phaseOverride: 'differentiation' });
    expect(m.pedPhase).toBe('differentiation');
    expect(m.pedPhaseByWeek.every(p => p === 'differentiation')).toBe(true);
  });
  it('auto (дефолт) — чередование/блоки как раньше', () => {
    const m = recommendPEDMethodology(both);
    expect(m.pedPhase).toBe('both');
    expect(new Set(m.pedPhaseByWeek).size).toBe(2);
  });
  it('билдер пробрасывает override в rationale', () => {
    const plan = buildWithPED(
      { patternId: 'upper_lower_4', level: 'advanced', trainingYears: 4, goal: 'mass', weeks: 8, workMax: WM, pedPhaseOverride: 'differentiation' } as any,
      ['MGF', 'IGF1'], { MGF: 200, IGF1: 50 },
    );
    expect(plan.rationale.some((r: string) => r.includes('вручную'))).toBe(true);
  }, 30000);
});

describe('A: авто-выбор методики по стеку', () => {
  it('GH+INS (окно) → hyperemia', () => {
    expect(suggestMethodologyForStack({ peds: ['GH', 'insulin'] as any, pedDoses: { GH: 4, insulin: 10 } })).toBe('hyperemia');
  });
  it('MGF → mountain_dog', () => {
    expect(suggestMethodologyForStack({ peds: ['MGF'] as any, pedDoses: { MGF: 200 } })).toBe('mountain_dog');
  });
  it('конфликт GH+INS+MGF → hyperemia (окно главнее)', () => {
    expect(suggestMethodologyForStack({ peds: ['GH', 'insulin', 'MGF'] as any, pedDoses: { GH: 4, insulin: 10, MGF: 200 } })).toBe('hyperemia');
  });
  it('малые дозы / пусто → null (выбор юзера)', () => {
    expect(suggestMethodologyForStack({ peds: ['GH', 'insulin'] as any, pedDoses: { GH: 1, insulin: 4 } })).toBe(null);
    expect(suggestMethodologyForStack({ peds: [] as any, pedDoses: {} })).toBe(null);
    expect(suggestMethodologyForStack({ peds: ['AAS'] as any, pedDoses: { AAS: 500 } })).toBe(null);
  });
});

describe('C: MGF +1 памп-слот + dayMap', () => {
  const specBase: BBBuilderInput = {
    patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3,
    goal: 'mass', weeks: 4, workMax: WM, weakPoints: ['forearms'], specialization: true,
  } as any;
  const slotOf = (plan: any) => plan.weeks
    .flatMap((w: any) => w.sessions)
    .flatMap((s: any) => s.exercises)
    .filter((e: any) => !(e as any).warmupActivator && String((e as any).comment || '').includes('MGF/IGF1 слот'));
  it('spec+MGF: слот есть (2 сета, памп), dayMap в rationale', () => {
    const plan = buildWithPED(specBase, ['MGF'], { MGF: 200 });
    const slots = slotOf(plan);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.sets).toBe(2);
      expect(s.character).toBe('памп');
      expect(s.muscle).toBe('forearms');
    }
    expect(plan.rationale.some((r: string) => r.includes('MGF dayMap'))).toBe(true);
  }, 30000);
  it('частота цели реально +1: слот стоит в сессии без цели', () => {
    const withMgf = buildWithPED(specBase, ['MGF'], { MGF: 200 });
    for (const w of withMgf.weeks) {
      for (const s of w.sessions) {
        const slots = s.exercises.filter((e: any) => !(e as any).warmupActivator && String((e as any).comment || '').includes('MGF/IGF1 слот'));
        for (const sl of slots) {
          const others = s.exercises.filter((e: any) => e !== sl && !(e as any).warmupActivator && String(e.muscle) === 'forearms');
          expect(others.length, 'слот добавляет новую сессию, не дублирует').toBe(0);
        }
      }
    }
    // И хотя бы один слот в плане есть (см. тест выше)
    expect(slotOf(withMgf).length).toBeGreaterThan(0);
  }, 30000);
  it('без специализации / без MGF — слота нет', () => {
    const noSpec = buildWithPED({ ...specBase, weakPoints: [], specialization: false } as any, ['MGF'], { MGF: 200 });
    expect(slotOf(noSpec).length).toBe(0);
    const noMgf = buildBBPlan(specBase);
    expect(slotOf(noMgf).length).toBe(0);
  }, 30000);
  it('явное расписание: слоты следуют целям блоков', () => {
    const pedAdapt = adaptForPEDs(['MGF'] as any, 20, { MGF: 200 }, 'moderate');
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass',
      weeks: 12, workMax: WM, weakPoints: ['forearms'], specialization: true, pedDoses: { MGF: 200 },
      specializationSchedule: [{ weekStart: 1, weekEnd: 8, targets: ['forearms'] }, { weekStart: 9, weekEnd: 12, targets: ['biceps'] }],
    } as any, pedAdapt);
    // Каждый слот — в мышцу активного блока СВОЕЙ недели (не чужого блока).
    let total = 0;
    for (let w = 1; w <= 12; w++) {
      if ((plan.weeks[w - 1] as any).phase === 'deload' || (plan.weeks[w - 1] as any).deload) continue;
      const expected = w <= 8 ? ['forearms'] : ['biceps'];
      const slots = plan.weeks[w - 1].sessions
        .flatMap((s: any) => s.exercises)
        .filter((e: any) => !(e as any).warmupActivator && String((e as any).comment || '').includes('MGF/IGF1'));
      for (const sl of slots) {
        // только настоящие слоты (пометки myo-reps/lengthened — не слоты)
        if (!String((sl as any).comment || '').includes('MGF/IGF1 слот')) continue;
        total++;
        expect(expected, `нед ${w}: слот ${sl.muscle}`).toContain(String(sl.muscle));
      }
    }
    expect(total, 'слоты есть').toBeGreaterThan(0);
    expect(plan.rationale.some((r: string) => r.includes('MGF dayMap'))).toBe(true);
  }, 30000);
});

describe('D: DC-лайт', () => {
  const dcBase: BBBuilderInput = {
    patternId: 'upper_lower_4', level: 'advanced', trainingYears: 5,
    goal: 'mass', weeks: 8, workMax: WM, dcMode: true,
  } as any;
  const dcDoses = { AAS: 800 };
  it('гейт: beginner/натурал — игнор + пометка', () => {
    const plan = buildBBPlan({ ...dcBase, level: 'beginner', trainingYears: 1 } as any);
    expect(plan.rationale.some((r: string) => r.includes('DC-лайт выкл'))).toBe(true);
    expect(plan.rationale.some((r: string) => r.includes('DC-ротация'))).toBe(false);
  }, 30000);
  it('ротация-3: топ-лифт мышцы меняется по неделям, объём тот же', () => {
    const plan = buildWithPED(dcBase, ['AAS'], dcDoses, 'heavy');
    const chestPrim = (w: any) => w.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => !(e as any).warmupActivator && e.role === 'primary' && e.muscle === 'chest')
      .map((e: any) => e.exerciseName || e.name);
    const w1 = chestPrim(plan.weeks[0]);
    const w2 = chestPrim(plan.weeks[1]);
    expect(w1.length).toBeGreaterThan(0);
    // Хотя бы один топ-лифт груди другой (каталог полон альтернатив);
    // суммарные сеты груди по неделям равны (swap имён, не объёма).
    expect(w2.some((n: string) => !w1.includes(n))).toBe(true);
    const sum = (w: any) => w.sessions.flatMap((s: any) => s.exercises)
      .filter((e: any) => !(e as any).warmupActivator && e.muscle === 'chest')
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    expect(sum(plan.weeks[1])).toBe(sum(plan.weeks[0]));
    expect(plan.rationale.some((r: string) => r.includes('DC-ротация'))).toBe(true);
  }, 30000);
  it('widowmaker: добивочный 20-повторный сет квадрам (без отдельного 1-сетовика)', () => {
    const plan = buildWithPED(dcBase, ['AAS'], dcDoses, 'heavy');
    const widows: any[] = [];
    for (const w of plan.weeks) {
      if ((w as any).phase === 'deload' || (w as any).deload) continue;
      for (const s of w.sessions) for (const e of s.exercises) {
        if (String((e as any).comment || '').includes('widowmaker')) widows.push(e);
      }
    }
    expect(widows.length).toBeGreaterThan(0);
    for (const e of widows) {
      // Хост-упражнение цело (сетов ≥2 было и осталось +1), 20-ка внутри workSets
      expect((e.workSets || []).some((ws: any) => ws.reps === 20)).toBe(true);
      expect(e.sets).toBeGreaterThanOrEqual(2);
      expect(e.sets).toBeLessThanOrEqual(8);
    }
  }, 30000);
  it('круиз-каденс: делод на 6-й неделе, не на 4-й', () => {
    const plan = buildWithPED(dcBase, ['AAS'], dcDoses, 'heavy');
    const isDeload = (w: any) => (w as any).phase === 'deload' || !!(w as any).deload;
    expect(isDeload(plan.weeks[5])).toBe(true);
    expect(isDeload(plan.weeks[3])).toBe(false);
  }, 30000);
});
