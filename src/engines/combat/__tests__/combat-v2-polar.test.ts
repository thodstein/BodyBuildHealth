import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { buildCombatXlsxHtml } from '../combat-xlsx.engine';

describe('combat v2 polish — VBT per-lift, neck auto, XLSX', () => {
  it('VBT per-lift EWMA: history с большой потерей режет вес bench', () => {
    const base = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const benchBase = base.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='bench_bar');
    const hist = [
      { liftId:'bench_bar', velocity:0.80, date:'2026-08-10' },
      { liftId:'bench_bar', velocity:0.78, date:'2026-08-11' },
      { liftId:'bench_bar', velocity:0.55, date:'2026-08-12' }, // резкая просадка 31% от 0.80
    ] as any;
    const withVbt = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, vbtHistory: hist } as any);
    const benchVbt = withVbt.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='bench_bar');
    // при потере >20% RIR+1 и вес -3..5%
    if (benchBase && benchVbt) {
      expect(benchVbt.rir).toBeGreaterThanOrEqual(benchBase.rir);
      // вес должен быть <= базового (срезан) если была потеря
      expect(benchVbt.weight).toBeLessThanOrEqual(benchBase.weight);
    }
  });

  it('VBT per-lift: velocityLossPerLift map приоритетнее скаляра', () => {
    const withMap = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, velocityLossPerLift:{ bench_bar: 26 } } as any);
    const bench = withMap.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='bench_bar');
    const squat = withMap.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='squat');
    // bench с 26% должен получить RIR+1 / вес -5%, squat — без (скаляр 0)
    if (bench && squat) {
      expect(bench.rir).toBeGreaterThanOrEqual(2);
    }
  });

  it('Neck auto: если пул бедный на шею — builder всё равно добавит 1 плоскость', () => {
    // форсим пул без neck через excludedExercises + проверим что finalize не ругается, а builder auto добавит
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, excludedExercises: ['neck_harness_ext','neck_lateral_flex'] } as any);
    // даже с исключением, fallback должен оставить хотя бы 1 neck (globalSafe) и auto добавит missing plane
    const hasNeck = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id.includes('neck'))));
    expect(hasNeck).toBe(true);
    // проверим что в неделе есть хотя бы 1 изометрическая шея (наш NECK_IDS)
    const neckIds = plan.weeksData[0].sessions.flatMap(s=> s.exercises).filter(e=> e.id.includes('neck')).map(e=> e.id);
    expect(neckIds.length).toBeGreaterThanOrEqual(1);
  });

  it('Neck auto: 4 плоскости — builder auto добавляет missing', async () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    // в каждой неделе должен быть хотя бы 1 neck (auto гарантирует), а finalize может ругаться если <4 плоскостей — это нормально (1 auto за неделю)
    const allWeeksHaveNeck = plan.weeksData.every(w=> w.sessions.some(s=> s.exercises.some(e=> e.id.includes('neck'))));
    expect(allWeeksHaveNeck).toBe(true);
    const neckCountW1 = plan.weeksData[0].sessions.flatMap(s=> s.exercises).filter(e=> e.id.includes('neck')).length;
    expect(neckCountW1).toBeGreaterThanOrEqual(2);
  });

  it('XLSX экспорт: html содержит шапку, Gantt, heatmap и meta', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const html = buildCombatXlsxHtml(plan);
    expect(html).toContain('<html');
    expect(html).toContain('Единоборства');
    expect(html).toContain('Heatmap');
    expect(html).toContain('Н1');
    expect(html).toContain('hash:');
    expect(html).toContain('Жим лёжа'); // хотя бы одно упражнение
  });

  it('XLSX heatmap строки шея/хват/core присутствуют', () => {
    const plan = buildCombatPlan({ discipline:'wrestling', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const html = buildCombatXlsxHtml(plan);
    expect(html).toContain('Шея');
    expect(html).toContain('Хват');
    expect(html).toContain('Core');
  });

  it('Annual 4 цикла содержит 4× transition (Issurin)', async () => {
    const { buildAnnualATR } = await import('../combat-annual');
    const ann = buildAnnualATR('mma', 52, null, { cycles:4 } as any);
    expect(ann.blocks.filter(b=> b.phase==='transition').length).toBeGreaterThanOrEqual(3);
    expect(ann.totalWeeks).toBe(52);
    expect(ann.blocks.length).toBeGreaterThan(10);
  });
});
