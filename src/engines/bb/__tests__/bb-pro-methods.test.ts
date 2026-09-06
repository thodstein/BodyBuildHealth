import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { markAntagonistSupersets, applyVolumeScheme } from '../bb-finalize.engine';
import { INTENSITY_TECHNIQUES } from '../bb-autocoach.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const mkEx = (muscle: string, name: string, role: 'primary' | 'accessory' = 'accessory', character: 'тяж' | 'памп' = 'памп') => ({
  muscle, name, role, character, sets: 3, repsRange: [12, 15] as [number, number], rir: 3,
  workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: 30, restSeconds: 60 })),
});

describe('Проф-методики ББ (Библиотека → Методики)', () => {
  describe('Суперсеты-антагонисты', () => {
    it('помечает пары грудь↔спина и бицепс↔трицепс с supersetWith', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [mkEx('chest', 'Жим лёжа'), mkEx('back', 'Тяга'), mkEx('biceps', 'Сгибания'), mkEx('triceps', 'Разгибания'), mkEx('quads', 'Разгибания ног')] },
        ] }],
      };
      markAntagonistSupersets(plan);
      const exs = plan.weeks[0].sessions[0].exercises;
      expect(exs[0].supersetWith).toBe('Тяга');
      expect(exs[1].supersetWith).toBe('Жим лёжа');
      expect(exs[2].supersetWith).toBe('Разгибания');
      expect(exs[3].supersetWith).toBe('Сгибания');
      expect(exs[0].comment).toContain('Суперсет');
    });

    it('максимум 3 пары на сессию', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [
            mkEx('chest', 'Жим'), mkEx('back', 'Тяга'),
            mkEx('biceps', 'Сгибания'), mkEx('triceps', 'Разгибания'),
            mkEx('quads', 'Разгибания ног'), mkEx('hamstrings', 'Сгибания ног'),
            mkEx('chest', 'Жим 2'), mkEx('back', 'Тяга 2'),
          ] },
        ] }],
      };
      markAntagonistSupersets(plan);
      const exs = plan.weeks[0].sessions[0].exercises;
      expect(exs.filter((e: any) => e.supersetWith).length).toBe(6);
    });

    it('deload-недели не получают суперсетов', () => {
      const plan: any = {
        weeks: [
          { phase: 'deload', sessions: [{ day: 1, exercises: [mkEx('chest', 'Жим'), mkEx('back', 'Тяга')] }] },
        ],
      };
      markAntagonistSupersets(plan);
      const exs = plan.weeks[0].sessions[0].exercises;
      expect(exs.every((e: any) => !e.supersetWith)).toBe(true);
    });
  });

  describe('Схемы объёма памп-дней', () => {
    it('GVT: памп-изоляции получают 5×10 (2 упражнения = 10 сетов на мышцу), cap 5', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [
            mkEx('quads', 'Разгибания ног'), mkEx('quads', 'Жим ногами', 'accessory', 'памп'),
            mkEx('chest', 'Сведение в кроссовере'),
          ] },
        ] }],
      };
      applyVolumeScheme(plan, 'gvt');
      const exs = plan.weeks[0].sessions[0].exercises;
      const quads = exs.filter((e: any) => e.muscle === 'quads');
      expect(quads[0].sets).toBe(5);
      expect(quads[1].sets).toBe(5);
      expect(quads[0].repsRange[0]).toBe(10);
      expect(quads[0].restSeconds).toBe(75);
      expect(quads[0].comment).toContain('GVT 10×10');
      for (const e of exs) expect(e.sets).toBeLessThanOrEqual(5);
    });

    it('FST-7: 7 сетов ОДНИМ финишером (Rambod), отдых 40с — только с fst7Seven', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [mkEx('biceps', 'Сгибания'), mkEx('biceps', 'Молотки')] },
        ] }],
      };
      applyVolumeScheme(plan, 'fst7', { fst7Seven: true });
      const exs = plan.weeks[0].sessions[0].exercises;
      const fin = exs.find((e: any) => (e.comment || '').includes('FST-7'));
      expect(fin, 'финишер с меткой FST-7').toBeTruthy();
      expect(fin.sets).toBe(7);
      expect(fin.restSeconds).toBe(40);
      expect(fin.repsRange[0]).toBe(8);
    });

    it('FST-7 без флага: legacy 5+2 (кап-5 инвариант)', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [mkEx('biceps', 'Сгибания'), mkEx('biceps', 'Молотки')] },
        ] }],
      };
      applyVolumeScheme(plan, 'fst7');
      const exs = plan.weeks[0].sessions[0].exercises;
      const total = exs.reduce((s: number, e: any) => s + e.sets, 0);
      expect(total).toBe(7);
      for (const e of exs) expect(e.sets).toBeLessThanOrEqual(5);
    });

    it('Gironda 8×8: 8 сетов суммарно, reps 8-10, отдых 60с', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [mkEx('triceps', 'Разгибания на блоке'), mkEx('triceps', 'Французский')] },
        ] }],
      };
      applyVolumeScheme(plan, 'gironda');
      const exs = plan.weeks[0].sessions[0].exercises;
      expect(exs.reduce((s: number, e: any) => s + e.sets, 0)).toBe(8);
      expect(exs[0].repsRange[0]).toBe(8);
      expect(exs[0].restSeconds).toBe(60);
    });

    it('primary/тяж упражнения не меняются', () => {
      const plan: any = {
        weeks: [{ phase: 'accumulation', sessions: [
          { day: 1, exercises: [mkEx('quads', 'Присед', 'primary', 'тяж')] },
        ] }],
      };
      applyVolumeScheme(plan, 'gvt');
      const ex = plan.weeks[0].sessions[0].exercises[0];
      expect(ex.sets).toBe(3);
    });
  });

  describe('Негативы (intensity technique)', () => {
    it('INTENSITY_TECHNIQUES содержит negative с описанием', () => {
      expect(INTENSITY_TECHNIQUES.negative).toBeDefined();
      expect(INTENSITY_TECHNIQUES.negative.label).toContain('Негативы');
    });

    it('buildBBPlan с intensityTechnique=negative: primary получают темп 4-2-1-0 и комментарий', () => {
      const plan = buildBBPlan({
        patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3,
        goal: 'mass', weeks: 1, workMax: WM, intensityTechnique: 'negative' as any,
      });
      const primary = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.role === 'primary');
      expect(primary.length).toBeGreaterThan(0);
      const withNegative = primary.filter(e => (e.comment || '').includes('Негативы') || e.workSets?.some(ws => ws.tempo === '4-2-1-0'));
      expect(withNegative.length).toBeGreaterThan(0);
    });

    it('по умолчанию (none) негативы не применяются', () => {
      const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
      const hasNegative = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).some(e => (e.comment || '').includes('Негативы'));
      expect(hasNegative).toBe(false);
    });
  });

  describe('E2E через buildBBPlan', () => {
    it('supersetMode=antagonist: план содержит суперсет-пары (supersetWith + комментарий)', () => {
      const plan = buildBBPlan({
        patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1,
        workMax: WM, supersetMode: 'antagonist',
      });
      const pairs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => e.supersetWith);
      expect(pairs.length).toBeGreaterThan(0);
      const commented = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).some((e: any) => (e.comment || '').includes('Суперсет'));
      expect(commented).toBe(true);
    });

    it('без supersetMode пары не помечаются', () => {
      const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM });
      const pairs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter((e: any) => e.supersetWith);
      expect(pairs.length).toBe(0);
    });

    it('volumeScheme=gvt: памп-изоляции получают 5×10 и кап 5 соблюдён', () => {
      const plan = buildBBPlan({
        patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1,
        workMax: WM, volumeScheme: 'gvt',
      });
      const gvtComments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
        .filter((e: any) => (e.comment || '').includes('GVT 10×10'));
      expect(gvtComments.length).toBeGreaterThan(0);
      for (const e of gvtComments) {
        // GVT ставит 5 сетов; post-hoc cap-adjust (MRV) может срезать до 4.
        expect(e.sets).toBeGreaterThanOrEqual(4);
        expect(e.sets).toBeLessThanOrEqual(5);
        expect(e.repsRange[0]).toBe(10);
        expect(e.restSeconds).toBe(75);
      }
      const allSets = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map((e: any) => e.sets);
      expect(Math.max(...allSets)).toBeLessThanOrEqual(5);
    });

    it('стандартная схема (по умолчанию) не меняет объём', () => {
      const a = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM });
      const b = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, volumeScheme: 'standard' });
      expect(a.weeks[0].sessions.flatMap(s => s.exercises).map((e: any) => e.sets).join(',')).toBe(b.weeks[0].sessions.flatMap(s => s.exercises).map((e: any) => e.sets).join(','));
    });
  });
});
