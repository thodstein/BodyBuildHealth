import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBBPlan } from '../bb-builder.engine';
import { auditPlanExercises } from '../bb-plan-exercise-audit.engine';
import { buildBBPlanIcs, compareBBVariants, buildBBPlanPrintHtml } from '../bb-visual.engine';
import { buildBBContestPrepPlan, buildPrepIcs } from '../bb-contest-prep.engine';
import { buildBBPlanReportText } from '../bb-report.engine';
import { buildAdaptiveTaper } from '../bb-taper-adaptive.engine';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import {
  saveBBPlanVariant,
  loadSavedBBPlans,
  renameBBPlanVariant,
  getLastBBPlansStoreError,
} from '../../../ui/screens/TrainingScreen_parts/bb-plans-store';
import { PlanExportCard } from '../../../ui/screens/TrainingScreen_parts/PlanExportCard';
import { BBRecommendationsTab } from '../../../ui/screens/TrainingScreen_parts/BBRecommendationsTab';
import { BBFeedbackCard } from '../../../ui/screens/TrainingScreen_parts/BBFeedbackCard';

const basePlan = () =>
  buildBBPlan({
    patternId: 'upper_lower_4',
    weeks: 4,
    level: 'intermediate',
    goal: 'mass',
    trainingYears: 3,
    workMax: { squat: 120, bench: 100, deadlift: 150, ohp: 65, row: 90 },
  });

describe('Wave 7 — Quality Dashboard, Exports, Plan Management & Cleanup', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    vi.restoreAllMocks();
  });

  it('auditPlanExercises detects tempoSpec and excludes warmupActivator exercises', () => {
    const plan = basePlan();
    const s0 = plan.weeks[0].sessions[0];
    const workEx = s0.exercises.find(e => !(e as any).warmupActivator)!;
    expect(workEx).toBeTruthy();

    (workEx as any).tempoSpec = '3-1-1-0';
    delete (workEx as any).tempo;
    const beforeAudit = auditPlanExercises(plan);

    s0.exercises.unshift({
      ...workEx,
      name: 'Разминочный активатор',
      warmupActivator: true,
      sets: 2,
      workSets: [{ reps: 15, rir: 4, weight: 20 }],
    } as any);

    const afterAudit = auditPlanExercises(plan);
    expect(afterAudit.totalExercises).toBe(beforeAudit.totalExercises);
    expect(afterAudit.totalSets).toBe(beforeAudit.totalSets);
    const totalTempoSets = Object.values(afterAudit.byMuscle).reduce((s, b) => s + b.tempoSets, 0);
    expect(totalTempoSets).toBeGreaterThanOrEqual(workEx.sets);
  });

  it('buildBBPlanIcs uses floating local DTSTART/DTEND (no Z), UTC DTSTAMP, stable UID, and exercise DESCRIPTION', () => {
    const plan = basePlan();
    const ics = buildBBPlanIcs(plan, { startDate: '2027-03-01' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTAMP:');
    expect(ics).toContain('UID:bb-');
    expect(ics).toMatch(/DTSTART:\d{8}T100000\r\n/);
    expect(ics).toMatch(/DTEND:\d{8}T110000\r\n/);
    expect(ics).not.toMatch(/DTSTART:\d{8}T100000Z/);
    expect(ics).toContain('DESCRIPTION:');
  });

  it('buildPrepIcs includes UTC DTSTAMP and deterministic UID for all events', () => {
    const prep = buildBBContestPrepPlan({
      category: 'classic_physique',
      sex: 'male',
      weightKg: 88,
      bodyFatPct: 10,
      showDate: '2027-07-01',
      weeksOut: 3,
      experienceLevel: 'advanced',
      prepCount: 1,
      trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate',
      waterStrategy: 'stable',
      sodiumStrategy: 'stable',
    });
    const ics = buildPrepIcs(prep);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTAMP:');
    expect(ics).toContain('UID:prep-');
  });

  it('compareBBVariants reports added/removed exercises and avg weight delta per week', () => {
    const planA = basePlan();
    const planB = structuredClone(planA);
    const workEx = planB.weeks[0].sessions[0].exercises.find(e => !(e as any).warmupActivator)!;
    workEx.name = 'Новое тестовое упражнение';
    workEx.workSets = workEx.workSets.map(ws => ({ ...ws, weight: (ws.weight || 50) + 30 }));

    const diff = compareBBVariants(planA, planB);
    expect(diff.length).toBeGreaterThan(0);
    const w1 = diff[0];
    expect(w1.changes).toBeGreaterThan(0);
    expect(w1.detail.some(d => d.includes('Новое тестовое упражнение'))).toBe(true);
    expect(w1.detail.some(d => d.includes('Ср. вес'))).toBe(true);
  });

  it('PlanExportCard fixes Толкай/Тяни typo and renders TXT save button', () => {
    const plan = basePlan();
    plan.pattern = { ...plan.pattern, id: 'ppl', name: 'Push/Pull/Legs' };
    const html = renderToStaticMarkup(
      React.createElement(PlanExportCard, {
        bbPlan: plan,
        level: 'intermediate',
        weakPoints: ['chest'],
        hasDeload: true,
        meta: { splitName: 'Push/Pull/Legs', weeks: plan.weeks.length },
      }),
    );
    expect(html).not.toContain('Толкай/Тянай');
    expect(html).toContain('Экспорт плана');
    expect(html).toContain('Файл (.txt)');
  });

  it('bb-plans-store supports renameBBPlanVariant and exposes QuotaExceededError cleanly', () => {
    const plan = basePlan();
    const saved = saveBBPlanVariant('Вариант А', plan, { weeks: 4 }, { totalSets: 60, avgRir: 2, sessionsPerWeek: 4, muscleCount: 8, mrvMult: 1, qualityScore: 85, phases: ['accumulation'] });
    expect(saved.length).toBe(1);
    const renamed = renameBBPlanVariant(saved[0].id, 'Вариант Про');
    expect(renamed[0].name).toBe('Вариант Про');
    expect(loadSavedBBPlans()[0].name).toBe('Вариант Про');
    expect(getLastBBPlansStoreError()).toBeNull();
  });

  it('buildBBPlanPrintHtml localizes phase headers and exercise techniques in Russian', () => {
    const plan = basePlan();
    (plan.weeks[0] as any).phase = 'accumulation';
    (plan.weeks[0].sessions[0].exercises[0] as any).technique = 'drop_set';
    const html = buildBBPlanPrintHtml(plan);
    expect(html).toContain('Накопление');
    expect(html).not.toContain('· accumulation ·');
    expect(html).toContain('Дроп-сет');
    expect(html).not.toContain('>drop_set<');
  });

  it('buildBBPlanReportText ignores trailing deload when computing progression summary & formats reps accurately', () => {
    const plan = basePlan();
    const w1Ex = plan.weeks[0].sessions[0].exercises.find(e => e.role === 'primary' && !(e as any).warmupActivator)!;
    const wLast = plan.weeks[plan.weeks.length - 1];
    (wLast as any).phase = 'deload';
    (wLast as any).deload = true;
    const wLastEx = wLast.sessions[0].exercises.find(e => e.name === w1Ex.name);
    if (wLastEx && wLastEx.workSets?.[0]) wLastEx.workSets[0].weight = 10; // deload weight drop
    const text = buildBBPlanReportText(plan);
    expect(text).not.toMatch(/↓ ~8\d%/);
  });

  it('buildAdaptiveTaper applies enhanced/bikini config modifiers only once (no double multiplication)', () => {
    const adaptive = buildAdaptiveTaper({
      sex: 'female',
      category: 'bikini',
      weightKg: 58,
      experienceLevel: 'advanced',
      enhanced: true,
      prepCount: 1,
      showDate: '2027-07-01',
      weeksOut: 4,
      trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate',
      waterStrategy: 'stable',
      sodiumStrategy: 'stable',
    });
    // Base week 0 is 0.90. With bikini (0.90) * enhanced (0.95) = 0.855 -> 0.90 * 0.855 = 0.77 (not double-applied 0.66)
    expect(adaptive[0].volumePct).toBeCloseTo(0.77, 2);
  });

  it('calculatePlanSafetyScore evaluates frequency per working week instead of summing days across weeks', () => {
    const singleFreqPlan: any = {
      pattern: { id: 'bro_1', name: 'LowFreq', sessionsPerRotation: 1 },
      weeks: [1, 2, 3, 4].map(w => ({
        week: w,
        phase: 'accumulation',
        sessions: [{
          day: w, // different weekday number per week!
          character: 'сред',
          exercises: [{ name: 'Сгибания на бицепс', muscle: 'biceps', sets: 3, rir: 2, workSets: [{ reps: 10, weight: 30, rir: 2 }] }],
        }],
      })),
    };
    const score = calculatePlanSafetyScore(singleFreqPlan);
    const bicepsFreq = score.details.frequencyDetails.find(f => f.muscle === 'biceps');
    expect(bicepsFreq).toBeDefined();
    expect(bicepsFreq!.days).toBe(1);
    expect(bicepsFreq!.violation).toBe(true);
  });

  it('native-bridge saveTextFile uses Encoding.UTF8 and Cache FileProvider fallback in Capacitor native APK', async () => {
    const writeCalls: any[] = [];
    const shareCalls: any[] = [];
    vi.doMock('../../../core/app-platform', () => ({
      isCapacitorNative: () => true,
      isNativeApp: () => true,
    }));
    vi.doMock('@capacitor/filesystem', () => ({
      Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE', Data: 'DATA' },
      Encoding: { UTF8: 'utf8' },
      Filesystem: {
        checkPermissions: async () => ({ publicStorage: 'granted' }),
        writeFile: async (opts: any) => {
          writeCalls.push(opts);
          if (opts.directory === 'DOCUMENTS') throw new Error('Scoped storage restricted');
          return { uri: `file:///cache/${opts.path}` };
        },
        readFile: async () => ({ data: '{"ok":true}' }),
      },
    }));
    vi.doMock('@capacitor/share', () => ({
      Share: {
        share: async (opts: any) => {
          shareCalls.push(opts);
        },
      },
    }));
    vi.resetModules();
    const bridge = await import('../../../core/native-bridge');
    const ok = await bridge.saveTextFile('test-plan.json', '{"hello":"мир"}');
    expect(ok).toBe(true);
    expect(writeCalls.some(c => c.encoding === 'utf8' && c.directory === 'CACHE')).toBe(true);
    expect(shareCalls.length).toBe(1);
    expect(shareCalls[0].url).toContain('test-plan.json');
    vi.resetModules();
  });

  it('BBFeedbackCard and BBRecommendationsTab render cleanly with localized RU labels & CSS tokens', () => {
    const fbHtml = renderToStaticMarkup(React.createElement(BBFeedbackCard));
    expect(fbHtml).toContain('Фидбек');
    expect(fbHtml).not.toContain('Adherence (сессии)');
    const recHtml = renderToStaticMarkup(
      React.createElement(BBRecommendationsTab, { hub: { historyWorkouts: [], setMode: () => {} } as any }),
    );
    expect(recHtml).toContain('Рекомендации');
    expect(recHtml).toContain('var(--text');
  });
});
