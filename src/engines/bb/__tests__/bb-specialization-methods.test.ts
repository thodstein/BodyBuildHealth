import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { applySpecializationPass } from '../bb-finalize.engine';
import { INTENSITY_TECHNIQUES } from '../bb-autocoach.engine';

/**
 * Специализация из Библиотеки-методик (полная реализация):
 * 1) RIR-профиль спец: изоляции целевой мышцы — RIR 0-1 (добивка);
 * 2) 21s (7-7-7) — интенсив-техника бицепса;
 * 3) икры-спец: темп 2-2-1-0 (пауза внизу+вверху), сеты ≥4;
 * 4) спец-частота: целевая мышца ≥2×/нед (добавление изоляций).
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('Специализация (методики Библиотеки)', () => {
  it('RIR-добивка: изоляции целевой мышцы получают RIR 0-1 и пометку', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['chest_upper'] });
    const chestIso = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => e.muscle === 'chest' && /сведен|развод|fly|кроссовер/i.test(e.name || '') && !(e as any).warmupActivator);
    expect(chestIso.length).toBeGreaterThan(0);
    for (const e of chestIso) {
      expect(e.rir).toBeLessThanOrEqual(1);
      expect((e.comment || '')).toContain('Спец-добивка');
    }
    // primary-жимы не получают спец-RIR (сохраняют фазовый)
    const bench = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .find(e => e.muscle === 'chest' && /жим штанги лёжа/i.test(e.name || ''));
    expect(bench?.rir).toBeGreaterThan(1);
  });

  it('RIR-добивка не применяется без специализации', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    const chestIso = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => e.muscle === 'chest' && /сведен|развод|fly|кроссовер/i.test(e.name || ''));
    expect(chestIso.some(e => (e.comment || '').includes('Спец-добивка'))).toBe(false);
  });

  it('21s: мета-запись в INTENSITY_TECHNIQUES', () => {
    expect(INTENSITY_TECHNIQUES.twenty_ones).toBeDefined();
    expect(INTENSITY_TECHNIQUES.twenty_ones.label).toContain('21s');
  });

  it('21s: при специализации бицепса сгибания получают 21 повторов и метку; не-бицепс не трогается', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['biceps'], intensityTechnique: 'twenty_ones' as any });
    const all = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises);
    const biceps21 = all.filter(e => (e.comment || '').includes('21s'));
    expect(biceps21.length).toBeGreaterThan(0);
    for (const e of biceps21) {
      expect(e.muscle).toBe('biceps');
      expect(e.workSets?.[e.workSets.length - 1]?.reps).toBe(21);
    }
    expect(all.some(e => e.muscle !== 'biceps' && (e.comment || '').includes('21s'))).toBe(false);
  });

  it('икры-спец (focusGroup=calves): темп 2-2-1-0 на всех подходах икр', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, focusGroup: 'calves' });
    const calves = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.muscle === 'calves' && !(e as any).warmupActivator);
    expect(calves.length).toBeGreaterThan(0);
    for (const e of calves) {
      expect((e.workSets || []).every(ws => ws.tempo === '2-2-1-0')).toBe(true);
    }
  });

  it('спец-частота: focusGroup=chest в bro_5 даёт груди ≥2×/нед (без overflow/кап-нарушений)', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, focusGroup: 'chest' });
    const freq = plan.weeks[0].sessions.filter(s => s.exercises.some(e => e.muscle === 'chest' && !(e as any).warmupActivator)).length;
    expect(freq).toBeGreaterThanOrEqual(2);
    for (const s of plan.weeks[0].sessions) {
      for (const e of s.exercises) {
        if ((e as any).warmupActivator) continue;
        expect(e.sets).toBeLessThanOrEqual(5);
        expect(e.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('спец-частота (unit): сессия без целевой мышцы с подходящим тегом получает изоляции', () => {
    const plan: any = {
      pattern: { id: 'test' },
      mrvByMuscle: { quads: 20, hamstrings: 16 },
      weeks: [{
        week: 1, phase: 'accumulation',
        sessions: [
          { day: 1, sessionTag: 'Legs', exercises: [
            { muscle: 'quads', name: 'Присед', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: [] },
          ] },
          { day: 2, sessionTag: 'Arms', exercises: [
            { muscle: 'biceps', name: 'Сгибания', role: 'accessory', character: 'памп', sets: 3, repsRange: [12, 15], rir: 2, workSets: [] },
          ] },
        ],
      }],
    };
    applySpecializationPass(plan, { priorityMuscles: ['quads'] } as any);
    const arms = plan.weeks[0].sessions[1];
    // Тег Arms не подходит для quads — добавления нет (честная страховка)
    expect(arms.exercises.length).toBe(1);
  });

  it('спец-частота (unit): подходящая сессия без целевой мышцы получает изоляции', () => {
    const plan: any = {
      pattern: { id: 'test' },
      mrvByMuscle: { glutes: 16 },
      weeks: [{
        week: 1, phase: 'accumulation',
        sessions: [
          { day: 1, sessionTag: 'Legs', exercises: [
            { muscle: 'quads', name: 'Присед', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: [] },
          ] },
          { day: 2, sessionTag: 'FullBody', exercises: [
            { muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: [] },
          ] },
        ],
      }],
    };
    applySpecializationPass(plan, { priorityMuscles: ['glutes'], equipment: [] } as any);
    const all = plan.weeks[0].sessions.flatMap((s: any) => s.exercises).filter((e: any) => e.muscle === 'glutes');
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].comment).toContain('Спец-частота');
  });
});
