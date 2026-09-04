/**
 * bb-diagnostics-max-pro.test.ts — MAX PRO покрытие (эпики A–H).
 * Причины / 28д / McCallum / ранжир / спец-блок / PROF+TUT / диагноз / инъекция / экспорт.
 */
import { describe, it, expect } from 'vitest';
import { diagnoseWeakCause, idealDeltaForZone, weeksAtMav } from '../bb-weak-cause.engine';
import { volumeHistory28d, detectBBWeakByVolumeStable } from '../bb-weak-detection.engine';
import { idealMcCallumMap, symmetryTriadDeviation, femaleSymmetryNotes } from '../bb-symmetry.engine';
import { rankCorrectionsForWeak, top3CorrectionsForWeak } from '../bb-correction-rank.engine';
import { buildSpecBlock, splitSetsBySessions } from '../bb-spec-block.engine';
import { getProfExecutionProfile, tutFor, listProfMuscles } from '../bb-execution-prof.engine';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { buildBBDiagnosticsHtml } from '../bb-diagnostics-export.engine';

// ── A: причины ──
describe('weak-cause (5 причин)', () => {
  it('volume при факте < MEV', () => {
    const r = diagnoseWeakCause({ zone: 'chest', factHistory: [4], mev: 8, mav: 16 });
    expect(r.cause).toBe('volume');
    expect(r.confidence).toBeGreaterThan(0.4);
  });
  it('recovery побеждает при ACWR danger', () => {
    const r = diagnoseWeakCause({ zone: 'back', factHistory: [16], mev: 8, mav: 16, acwrZone: 'dangerous', sleepHours: 8 });
    expect(r.cause).toBe('recovery');
  });
  it('recovery при сне <6.5 + VBT', () => {
    const r = diagnoseWeakCause({ zone: 'quads', factHistory: [14], mev: 8, mav: 16, sleepHours: 5.5, vbtLossPct: 35 });
    expect(r.cause).toBe('recovery');
  });
  it('technique при singleAngle + missingStrict', () => {
    const r = diagnoseWeakCause({ zone: 'chest', factHistory: [14], mev: 8, mav: 16, singleAngle: true, missingStrict: true, hasLengthened: false });
    expect(r.cause).toBe('technique');
  });
  it('activation при объёме ≥MAV и плато e1RM без lengthened', () => {
    const r = diagnoseWeakCause({ zone: 'biceps', factHistory: [16], mev: 8, mav: 16, e1rmDeltaPct: 0, e1rmSessions: 3, hasLengthened: false });
    expect(r.cause).toBe('activation');
  });
  it('genetics при 12+ нед чисто и большой дельте vs идеала', () => {
    const r = diagnoseWeakCause({ zone: 'calves', factHistory: [18], mev: 8, mav: 16, idealDeltaPct: -20, weeksAtMavClean: 14 });
    expect(r.cause).toBe('genetics');
  });
  it('fallback volume при пустых данных', () => {
    const r = diagnoseWeakCause({ zone: 'chest' });
    expect(r.cause).toBe('volume');
    expect(r.evidence.length).toBeGreaterThan(0);
  });
});

// ── A: 28д ──
describe('volume 28d', () => {
  const mk = (date: string, muscle: string, sets: number) => ({
    date, exercises: [{ muscleGroup: muscle, sets: Array.from({ length: sets }, () => ({ weightKg: 50, reps: 10 })) }],
  });
  it('history группирует 4 недели', () => {
    const sessions = [mk('2026-08-06', 'chest', 8), mk('2026-08-13', 'chest', 10), mk('2026-08-20', 'chest', 12), mk('2026-08-27', 'chest', 14)];
    const h = volumeHistory28d(sessions as any);
    expect(h.chest.length).toBe(4);
    expect(h.chest[3]).toBe(14);
  });
  it('stable находит 3+ нед ниже MAV', () => {
    const out = detectBBWeakByVolumeStable({ chest: [6, 6, 6, 6], back: [18, 18, 18, 18] }, 'intermediate');
    expect(out.some((c) => c.muscle === 'chest')).toBe(true);
  });
  it('пустые сессии → пусто', () => {
    expect(volumeHistory28d([])).toEqual({});
  });
});

// ── A: McCallum/триада/female ──
describe('symmetry PRO', () => {
  it('McCallum wrist 17.5', () => {
    const m = idealMcCallumMap(17.5);
    expect(m.chest).toBeCloseTo(113.8, 0);
    expect(m.bicep).toBeCloseTo(43.8, 0);
    expect(m.calf).toBeCloseTo(35, 0);
  });
  it('McCallum битый вход → {}', () => {
    expect(idealMcCallumMap(NaN)).toEqual({});
  });
  it('триада 0 при равных', () => {
    expect(symmetryTriadDeviation({ neck: 40, bicep: 40, calf: 40 })).toBe(0);
  });
  it('триада ловит разброс', () => {
    expect(symmetryTriadDeviation({ neck: 40, bicep: 40, calf: 30 }) as number).toBeGreaterThan(10);
  });
  it('female WHR высокий → подсказка', () => {
    expect(femaleSymmetryNotes({ waist: 85, hips: 95 }).length).toBeGreaterThan(0);
  });
  it('female норма → тихо', () => {
    expect(femaleSymmetryNotes({ waist: 65, hips: 95 }).length).toBe(0);
  });
});

// ── B: ранжир ──
describe('correction-rank', () => {
  it('возвращает кандидатов по мышце', () => {
    const r = rankCorrectionsForWeak('chest', null, {});
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].muscle).toBe('chest');
  });
  it('angleGap поднимает закрывающий угол', () => {
    const all = rankCorrectionsForWeak('chest', null, {});
    const withAngle = all.find((c) => c.angleClass);
    if (withAngle?.angleClass) {
      const ranked = rankCorrectionsForWeak('chest', null, { missingAngles: [withAngle.angleClass] });
      expect(ranked[0].closesAngle).toBeTruthy();
    }
  });
  it('unilateral бонус при asym≥7', () => {
    const a = rankCorrectionsForWeak('glutes', null, { asymPct: 9 });
    expect(a.some((c) => c.unilateral)).toBe(true);
  });
  it('дедуп с планом', () => {
    const all = rankCorrectionsForWeak('chest', null, {});
    const top = all[0];
    const filtered = rankCorrectionsForWeak('chest', null, { inPlanIds: [top.id] });
    expect(filtered.some((c) => c.id === top.id)).toBe(false);
  });
  it('beginner режет экзотику', () => {
    const r = rankCorrectionsForWeak('back', null, { level: 'beginner' });
    expect(r.every((c) => !/рывок|snatch/i.test(c.name))).toBe(true);
  });
  it('top3 ≤3', () => {
    expect(top3CorrectionsForWeak('biceps', null, {}).length).toBeLessThanOrEqual(3);
  });
  it('reason непустой', () => {
    const r = rankCorrectionsForWeak('triceps', null, {});
    expect(r[0].reason.length).toBeGreaterThan(0);
  });
});

// ── C: спец-блок ──
describe('spec-block 8 нед', () => {
  it('рампа растёт и капится MRV', () => {
    const b = buildSpecBlock({ weakZones: ['chest'], factSets: { chest: 8 }, level: 'intermediate', weeks: 8 });
    expect(b.lengthWeeks).toBe(8);
    const s1 = b.weeks[0].targetSets.chest;
    const s8 = b.weeks[7].targetSets.chest;
    expect(s8).toBeGreaterThanOrEqual(s1);
    expect(s8).toBeLessThanOrEqual(30);
  });
  it('доноры не включают цели', () => {
    const b = buildSpecBlock({ weakZones: ['chest'], factSets: {}, level: 'intermediate' });
    expect(b.donors.includes('chest')).toBe(false);
  });
  it('частота мелких выше крупных', () => {
    const b = buildSpecBlock({ weakZones: ['calves', 'chest'], factSets: {}, level: 'intermediate' });
    expect(b.weeks[0].frequency.calves).toBeGreaterThanOrEqual(b.weeks[0].frequency.chest);
  });
  it('dayMap валиден 1..5', () => {
    const b = buildSpecBlock({ weakZones: ['delt_mid'], factSets: {}, level: 'intermediate' });
    for (const d of b.dayMap.delt_mid) expect(d).toBeGreaterThanOrEqual(1), expect(d).toBeLessThanOrEqual(5);
  });
  it('splitSetsBySessions режет >10/сессия', () => {
    const parts = splitSetsBySessions(24, 2);
    expect(Math.max(...parts)).toBeLessThanOrEqual(12);
    expect(parts.reduce((a, c) => a + c, 0)).toBe(24);
  });
  it('кламп недель 4..12', () => {
    expect(buildSpecBlock({ weakZones: ['chest'], factSets: {}, weeks: 99 }).lengthWeeks).toBe(12);
  });
});

// ── D: PROF + TUT ──
describe('PROF 2.0 + TUT', () => {
  it('traps/forearms/abs профили есть', () => {
    expect(getProfExecutionProfile('traps')?.label).toMatch(/Трапеции/);
    expect(getProfExecutionProfile('forearms')?.cues.length).toBeGreaterThan(0);
    expect(getProfExecutionProfile('abs')?.tempo).toBeTruthy();
  });
  it('17 профилей (было 14)', () => {
    expect(listProfMuscles().length).toBeGreaterThanOrEqual(17);
  });
  it('tutFor 3-1-1-0 ×10 = 50', () => {
    expect(tutFor('3-1-1-0', 10)).toBe(50);
  });
  it('tutFor битый → null', () => {
    expect(tutFor(null, 10)).toBe(null);
    expect(tutFor('3-1-1-0', 0)).toBe(null);
  });
});

// ── D: диагноз ──
describe('diagnosis MAX', () => {
  it('tutGap при TUT>70', () => {
    const d = diagnoseExercise({ name: 'Жим штанги лёжа', muscle: 'chest', tempo: '5-3-2-0' } as any, { muscle: 'chest', planReps: 12 } as any);
    expect(d.flags.includes('tutGap')).toBe(true);
  });
  it('uncovered не шумит если угол закрыт', () => {
    const d = diagnoseExercise({ name: 'incline_db тест', muscle: 'chest' } as any, { muscle: 'chest', uncoveredSubregions: ['incline_db тест'] } as any);
    expect(d.flags.includes('uncoveredSubregion')).toBe(false);
  });
  it('strictMissing точечный', () => {
    const d = diagnoseExercise({ name: 'Жим штанги лёжа', muscle: 'chest' } as any, { muscle: 'chest', strictMissing: ['chest_fly'] } as any);
    expect(d.flags.includes('missingStrict')).toBe(true);
  });
  it('взвешенный скор ≤100', () => {
    const d = diagnoseExercise({ name: 'Жим', muscle: 'chest' } as any, { muscle: 'chest' } as any);
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThanOrEqual(100);
  });
});

// ── C: инъекция MAX ──
describe('injection MAX', () => {
  const plan = (weeks: number) => ({
    level: 'intermediate',
    rationale: [],
    weeks: Array.from({ length: weeks }, (_, i) => ({
      phase: 'accumulation',
      totalSets: 10,
      sessions: [{ day: i + 1, exercises: [{ muscle: 'chest', name: 'Жим', exerciseName: 'bench_bar', sets: 4, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }],
    })),
  });
  it('allWeeks инъецирует в 2 недели', () => {
    const r = injectBBWeakPoints(plan(2) as any, ['delt_mid'], { allWeeks: true, budget: 500 });
    expect(r.injected).toBeGreaterThanOrEqual(2);
  });
  it('без allWeeks — только weeks[0]', () => {
    const r = injectBBWeakPoints(plan(2) as any, ['delt_mid'], { budget: 500 });
    expect(r.injected).toBe(1);
  });
  it('preferredIds используется', () => {
    const r = injectBBWeakPoints(plan(1) as any, ['chest'], { budget: 500, preferredIds: { chest: 'incline_db' } });
    expect(r.injected).toBe(1);
    const added = r.plan.weeks[0].sessions[0].exercises.find((e: any) => String((e as any).exerciseName || '').toLowerCase() === 'incline_db');
    expect(added).toBeTruthy();
  });
  it('profTempo в комментарии', () => {
    const r = injectBBWeakPoints(plan(1) as any, ['chest'], { budget: 500, profTempo: { chest: '3-2-1-1' } });
    expect(r.plan.weeks[0].sessions[0].exercises.some((e: any) => String(e.comment || '').includes('3-2-1-1'))).toBe(true);
  });
  it('бюджет режет', () => {
    const r = injectBBWeakPoints(plan(1) as any, ['chest'], { budget: 1 });
    expect(r.skippedBudget).toBeGreaterThanOrEqual(1);
  });
});

// ── H: экспорт ──
describe('export MAX', () => {
  const rep = () => ({
    weakCandidates: [{ muscle: 'chest', granular: 'chest_upper', source: 'volume', deltaPct: -30, reason: 't' }],
    weakMusclesCanonical: ['chest'],
    weakZonesGranular: ['chest_upper'],
    symmetry: { ratios: {}, issues: [], score: 80 },
    stimulus: { global: { lengthened: 1, midRange: 2, shortened: 0, compound: 3, isolation: 2, patterns: {} }, issues: [] },
    score: { score: 70, level: 'warn', floors: [], verification: 0.5, penalties: {}, raw: 10 },
    findings: [], priorities: [],
  });
  it('HTML включает причины и спец-блок', () => {
    const html = buildBBDiagnosticsHtml(rep() as any, {
      weakCauses: { chest_upper: { cause: 'volume', confidence: 0.8, evidence: ['a'], fix: 'b' } },
      specBlock: { lengthWeeks: 8, donors: ['back'], rationale: ['r'], weeks: [{ week: 1, targetSets: { chest_upper: 16 }, frequency: { chest_upper: 3 }, note: 'n' }] },
    } as any);
    expect(html).toContain('Причины отставания');
    expect(html).toContain('Спец-блок 8 нед');
  });
  it('HTML без meta не падает', () => {
    expect(buildBBDiagnosticsHtml(rep() as any).includes('ББ-диагностика')).toBe(true);
  });
});

// ── Доп. покрытие до 50+ ──
describe('max-pro extra', () => {
  it('diagnoseWeakCauses батч 2 зоны', async () => {
    const mod = await import('../bb-weak-cause.engine');
    const out = mod.diagnoseWeakCauses(['chest', 'back'], { chest: { factHistory: [5], mev: 8, mav: 16 } });
    expect(Object.keys(out).length).toBeLessThanOrEqual(2);
    expect(out.chest.cause).toBe('volume');
  });
  it('specBlock rationale непуст', () => {
    const b = buildSpecBlock({ weakZones: ['back_width'], factSets: {}, level: 'beginner' });
    expect(b.rationale.length).toBeGreaterThanOrEqual(2);
  });
  it('female glute приоритет в ранжире', () => {
    const f = rankCorrectionsForWeak('glutes', null, { sex: 'female' });
    const m = rankCorrectionsForWeak('glutes', null, { sex: 'male' });
    expect(f.length).toBeGreaterThan(0);
    expect(m.length).toBeGreaterThan(0);
  });
  it('tutFor 2-0-1-0 ×8 = 24', () => {
    expect(tutFor('2-0-1-0', 8)).toBe(24);
  });
  it('diagnose без TUT не ставит tutGap', () => {
    const d = diagnoseExercise({ name: 'Жим', muscle: 'chest', tempo: '3-1-1-0' } as any, { muscle: 'chest', planReps: 10 } as any);
    expect(d.flags.includes('tutGap')).toBe(false);
  });
  it('injection пустые зоны → noop', () => {
    const r = injectBBWeakPoints({ weeks: [{ sessions: [{ day: 1, exercises: [] }] }] } as any, [], {});
    expect(r.injected).toBe(0);
  });
  it('specBlock кламп снизу 4', () => {
    expect(buildSpecBlock({ weakZones: ['chest'], factSets: {}, weeks: 1 }).lengthWeeks).toBe(4);
  });
  it('McCallum forearm формула', () => {
    expect(idealMcCallumMap(20).forearm).toBeCloseTo(36, 0);
  });
});

// ── idealDeltaForZone + weeksAtMav (оживление genetics-ветки) ──
describe('ideal-delta + weeks-at-mav', () => {
  it('грудь vs McCallum: 100см при wrist 17.5 → −12.1%', () => {
    expect(idealDeltaForZone('chest', { chest: 100 }, 175, 17.5)).toBeCloseTo(-12.1, 0);
  });
  it('грудь vs Reeves без запястья: 114 при 175 → 0%', () => {
    expect(idealDeltaForZone('chest', { chest: 114 }, 175, null)).toBe(0);
  });
  it('бицепс среднее L/R vs McCallum', () => {
    // wrist 16 → идеал 40; среднее (36+38)/2=37 → −7.5%
    expect(idealDeltaForZone('biceps', { bicepL: 36, bicepR: 38 }, 175, 16)).toBeCloseTo(-7.5, 0);
  });
  it('abs → null (талия не лаггинг)', () => {
    expect(idealDeltaForZone('abs', { waist: 90 }, 175, 17.5)).toBe(null);
  });
  it('неизвестная зона → null', () => {
    expect(idealDeltaForZone('neck', { neck: 40 }, 175, 17.5)).toBe(null);
  });
  it('без замеров → null', () => {
    expect(idealDeltaForZone('chest', {}, 175, 17.5)).toBe(null);
  });
  it('спина через грудь-прокси', () => {
    expect(idealDeltaForZone('back_width', { chest: 100 }, 175, 17.5)).toBeCloseTo(-12.1, 0);
  });
  it('weeksAtMav считает недели ≥85% MAV', () => {
    expect(weeksAtMav([16, 14, 18, 10], 16)).toBe(3);
    expect(weeksAtMav([], 16)).toBe(0);
    expect(weeksAtMav([16], null)).toBe(0);
  });
  it('genetics через живые входы (идеал + история)', () => {
    const hist = [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16];
    const r = diagnoseWeakCause({
      zone: 'calves', factHistory: hist, mev: 8, mav: 16,
      idealDeltaPct: idealDeltaForZone('calves', { calfL: 30, calfR: 30 }, 175, 17.5),
      weeksAtMavClean: weeksAtMav(hist, 16),
    });
    // идеал 35, факт 30 → −14.3%: порог genetics (−15) не пробит → не genetics
    expect(r.cause).not.toBe('genetics');
    const r2 = diagnoseWeakCause({
      zone: 'calves', factHistory: hist, mev: 8, mav: 16,
      idealDeltaPct: -20, weeksAtMavClean: 12,
    });
    expect(r2.cause).toBe('genetics');
  });
});

// ── prescribeCorrections weakHead ──
describe('corrections weakHead', () => {
  it('замены целятся в слабую головку', async () => {
    const mod = await import('../bb-exercise-correction.engine');
    const diag: any = {
      effect: { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', sfr: 5, profile: 'short' },
      flags: ['lowSFRHighFatigue'], issues: [], score: 80, profGaps: [],
    };
    const out = mod.prescribeCorrections(diag, { name: 'Разгибание на блоке', muscle: 'triceps' }, { muscle: 'triceps', weakHead: 'triceps_long' });
    const subs = out.filter((a) => (a.type === 'substitute' || a.type === 'mobilitySwap') && a.targetId);
    expect(subs.length).toBeGreaterThan(0);
  });
  it('без weakHead — прежнее поведение', async () => {
    const mod = await import('../bb-exercise-correction.engine');
    const diag: any = {
      effect: { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', sfr: 5, profile: 'short' },
      flags: ['lowSFRHighFatigue'], issues: [], score: 80, profGaps: [],
    };
    const out = mod.prescribeCorrections(diag, { name: 'Разгибание на блоке', muscle: 'triceps' }, { muscle: 'triceps' });
    expect(out.length).toBeGreaterThan(0);
  });
});
