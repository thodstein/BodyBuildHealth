/**
 * health-improvement-plan.test.ts — тесты генератора плана улучшений здоровья (Aug 11 2026).
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeHealthProfile,
  generateHealthPlan,
  summarizeHealthPlan,
  exportHealthPlanText,
  exportHealthReportText,
  saveHealthPlan,
  loadHealthPlan,
  savePlanDone,
  loadPlanDone,
} from '../health-improvement-plan.engine';
import type { UnifiedHealthEntry } from '../health-diary.engine';

const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const painEntry = (
  daysAgo: number,
  zones: Record<string, number>,
  extra: Partial<UnifiedHealthEntry> = {},
): UnifiedHealthEntry => {
  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  return {
    id: `e_${daysAgo}`,
    date: isoDaysAgo(daysAgo),
    pain: total > 0 ? { zones, totalScore: total } : null,
    symptoms: [],
    neuro: null,
    acne: null,
    hemato: null,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
};

const withSymptoms = (daysAgo: number, names: { name: string; severity: number }[]): UnifiedHealthEntry => ({
  ...painEntry(daysAgo, {}),
  symptoms: names.map((n, i) => ({ id: `${daysAgo}_${i}`, name: n.name, severity: n.severity as 1 | 2 | 3 | 4 | 5 })),
});

describe('analyzeHealthProfile', () => {
  it('пустые данные → нейтральные значения', () => {
    const a = analyzeHealthProfile([]);
    expect(a.totalEntries).toBe(0);
    expect(a.pain.avg7).toBeNull();
    expect(a.pain.worstZone).toBeNull();
    expect(a.adherence.entriesLast14).toBe(0);
    expect(a.trend.deltaPct).toBeNull();
  });

  it('avg7/avg30 считаются по окну', () => {
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => painEntry(i, { shoulders: 10, knees: 10, lower_back: 10, hips: 10 })), // 40/70
      ...Array.from({ length: 5 }, (_, i) => painEntry(31 + i, { shoulders: 2, knees: 2, lower_back: 2, hips: 2 })), // 8/70 (старше 30 дней не входят)
    ];
    const a = analyzeHealthProfile(entries);
    expect(a.pain.avg7).toBe(40);
    expect(a.pain.avg30).toBe(40);
  });

  it('работает с входом в любом порядке (сортировка внутри)', () => {
    const desc = [painEntry(2, { shoulders: 5 }), painEntry(0, { shoulders: 8 }), painEntry(5, { shoulders: 3 })];
    const asc = [painEntry(5, { shoulders: 3 }), painEntry(2, { shoulders: 5 }), painEntry(0, { shoulders: 8 })];
    const a = analyzeHealthProfile(desc);
    const b = analyzeHealthProfile(asc);
    expect(a.pain.worstZone?.label).toBe(b.pain.worstZone?.label);
    expect(a.pain.worseningZones).toHaveLength(b.pain.worseningZones.length);
  });

  it('worseningZones: тренд up и last ≥ 4', () => {
    const entries = [painEntry(2, { knees: 2 }), painEntry(1, { knees: 6 })];
    const a = analyzeHealthProfile(entries);
    expect(a.pain.worseningZones.some((z) => z.id === 'knees' && z.last === 6)).toBe(true);
  });

  it('topTriggers и timeOfDayPeak', () => {
    const entries = [
      painEntry(5, { shoulders: 6 }, { pain: { zones: { shoulders: 6 }, totalScore: 6, timeOfDay: 'morning', triggers: ['Физ. нагрузка'] } as any }),
      painEntry(4, { shoulders: 5 }, { pain: { zones: { shoulders: 5 }, totalScore: 5, timeOfDay: 'morning', triggers: ['Физ. нагрузка'] } as any }),
      painEntry(3, { shoulders: 7 }, { pain: { zones: { shoulders: 7 }, totalScore: 7, timeOfDay: 'morning', triggers: ['Физ. нагрузка'] } as any }),
    ];
    const a = analyzeHealthProfile(entries);
    expect(a.pain.topTriggers[0].trigger).toBe('Физ. нагрузка');
    expect(a.pain.topTriggers[0].count).toBe(3);
    expect(a.pain.timeOfDayPeak?.label).toBe('morning');
    expect(a.pain.timeOfDayPeak!.avgScore).toBeGreaterThanOrEqual(5);
  });

  it('linkedExercise только при 2+ повторениях', () => {
    const once = [painEntry(5, { elbows: 3 }, { pain: { zones: { elbows: 3 }, totalScore: 3, linkedExercise: 'Жим лёжа' } as any })];
    expect(analyzeHealthProfile(once).pain.linkedExercise).toBeNull();
    const twice = [
      painEntry(5, { elbows: 3 }, { pain: { zones: { elbows: 3 }, totalScore: 3, linkedExercise: 'Жим лёжа' } as any }),
      painEntry(2, { elbows: 4 }, { pain: { zones: { elbows: 4 }, totalScore: 4, linkedExercise: 'Жим лёжа' } as any }),
    ];
    expect(analyzeHealthProfile(twice).pain.linkedExercise?.name).toBe('Жим лёжа');
  });

  it('агрегация симптомов по имени', () => {
    const entries = [withSymptoms(3, [{ name: 'Головная боль', severity: 4 }]), withSymptoms(1, [{ name: 'Головная боль', severity: 3 }])];
    const a = analyzeHealthProfile(entries);
    expect(a.symptoms[0].name).toBe('Головная боль');
    expect(a.symptoms[0].count).toBe(2);
    expect(a.symptoms[0].avgSeverity).toBe(3.5);
  });

  it('adherence: уникальные дни за 14', () => {
    const entries = Array.from({ length: 10 }, (_, i) => withSymptoms(i, [{ name: 'Х', severity: 2 }]));
    expect(analyzeHealthProfile(entries).adherence.pct).toBeGreaterThanOrEqual(70);
  });

  it('trend: неделя vs прошлая неделя', () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => painEntry(13 + i, { shoulders: 10 })), // prev: 10
      ...Array.from({ length: 6 }, (_, i) => painEntry(6 - i, { shoulders: 15 })), // this: 15
    ];
    const a = analyzeHealthProfile(entries);
    expect(a.trend.weekMean).toBe(15);
    expect(a.trend.prevWeekMean).toBe(10);
    expect(a.trend.deltaPct).toBe(50);
  });
});

describe('generateHealthPlan — критические', () => {
  it('гемато ≥2 → critical', () => {
    const entries = [painEntry(0, {}, { hemato: { symptoms: { nosebleeds: true, bruising: true }, totalScore: 2 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.summary.critical).toBeGreaterThanOrEqual(1);
    expect(plan.recommendations.some((r) => r.priority === 'critical' && r.domain === 'hemato')).toBe(true);
  });

  it('зона VAS ≥7 (растущая) → critical', () => {
    const entries = [painEntry(2, { shoulders: 3 }), painEntry(0, { shoulders: 9 })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    const rec = plan.recommendations.find((r) => r.title.includes('Критическая боль'));
    expect(rec?.priority).toBe('critical');
    expect(rec?.zoneIds).toContain('shoulders');
  });

  it('нейро ≥6 → critical', () => {
    const entries = [painEntry(0, {}, { neuro: { symptoms: { anxiety: true, insomnia: true, tremor: true, headache: true, fatigue: true, memory: true }, totalScore: 6 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'critical' && r.domain === 'neuro')).toBe(true);
  });

  it('avg7 ≥ 35/70 → critical', () => {
    const entries = Array.from({ length: 7 }, (_, i) => painEntry(i, { shoulders: 10, knees: 10, lower_back: 10, hips: 10 }));
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'critical' && r.title.includes('Стабильно высокая боль'))).toBe(true);
  });
});

describe('generateHealthPlan — важные', () => {
  it('растущая зона (last 4-6) → high', () => {
    const entries = [painEntry(2, { knees: 2 }), painEntry(0, { knees: 5 })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('нарастает'))).toBe(true);
  });

  it('частый триггер ≥3 → high', () => {
    const entries = [1, 2, 3].map((n) =>
      painEntry(n, { shoulders: 4 }, { pain: { zones: { shoulders: 4 }, totalScore: 4, triggers: ['Стресс'] } as any }),
    );
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('Частый триггер'))).toBe(true);
  });

  it('упражнение 2+ раза → high', () => {
    const entries = [1, 2].map((n) =>
      painEntry(n, { elbows: 4 }, { pain: { zones: { elbows: 4 }, totalScore: 4, linkedExercise: 'Жим лёжа' } as any }),
    );
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('Жим лёжа'))).toBe(true);
  });

  it('гемато = 1 → high', () => {
    const entries = [painEntry(0, {}, { hemato: { symptoms: { nosebleeds: true }, totalScore: 1 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.domain === 'hemato')).toBe(true);
  });

  it('симптом 3+ раз с тяжестью ≥3 → high', () => {
    const entries = [withSymptoms(4, [{ name: 'Головная боль', severity: 4 }]), withSymptoms(2, [{ name: 'Головная боль', severity: 4 }]), withSymptoms(0, [{ name: 'Головная боль', severity: 4 }])];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('Головная боль'))).toBe(true);
  });

  it('avg7 ≥ 20 → high', () => {
    const entries = Array.from({ length: 5 }, (_, i) => painEntry(i, { shoulders: 5, knees: 5, lower_back: 5, hips: 5, elbows: 5 }));
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('выше нормы'))).toBe(true);
  });
});

describe('generateHealthPlan — средние и низкие', () => {
  it('нейро 4-5 → medium', () => {
    const entries = [painEntry(0, {}, { neuro: { symptoms: { anxiety: true, insomnia: true, tremor: true, headache: true }, totalScore: 4 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.domain === 'neuro')).toBe(true);
  });

  it('акне ≥7 → medium', () => {
    const entries = [painEntry(0, {}, { acne: { areas: { face: 3, chest: 2, back: 2 }, totalScore: 7 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.domain === 'acne')).toBe(true);
  });

  it('низкая регулярность → medium', () => {
    const entries = [withSymptoms(0, [{ name: 'Х', severity: 2 }]), withSymptoms(1, [{ name: 'Х', severity: 2 }])];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.domain === 'adherence')).toBe(true);
  });

  it('пик боли в период суток → medium', () => {
    const entries = [1, 2, 3].map((n) =>
      painEntry(n, { shoulders: 6 }, { pain: { zones: { shoulders: 6 }, totalScore: 6, timeOfDay: 'evening' } as any }),
    );
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.title.includes('evening'))).toBe(true);
  });

  it('рост боли неделя к неделе ≥10% → medium', () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => painEntry(13 + i, { shoulders: 10 })),
      ...Array.from({ length: 6 }, (_, i) => painEntry(6 - i, { shoulders: 15 })),
    ];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.title.includes('растёт неделя к неделе'))).toBe(true);
  });

  it('снижение боли → low', () => {
    const entries = [
      ...Array.from({ length: 22 }, (_, i) => painEntry(29 - i, { shoulders: 15 })),
      ...Array.from({ length: 7 }, (_, i) => painEntry(6 - i, { shoulders: 5 })),
    ];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'low' && r.title === 'Боль снижается')).toBe(true);
  });

  it('отличная регулярность → low', () => {
    const entries = Array.from({ length: 12 }, (_, i) => withSymptoms(i, [{ name: 'Х', severity: 2 }]));
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'low' && r.title.includes('Отличная регулярность'))).toBe(true);
  });

  it('нет активных жалоб → low', () => {
    const entries = [withSymptoms(0, [])];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.recommendations.some((r) => r.priority === 'low' && r.title.includes('Нет активных жалоб'))).toBe(true);
  });
});

describe('generateHealthPlan — сортировка, сводка, экспорт, storage', () => {
  it('рекомендации отсортированы по приоритету', () => {
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => painEntry(i, { shoulders: 10, knees: 10, lower_back: 10, hips: 10 })),
      ...[1, 2, 3].map((n) => withSymptoms(n, [{ name: 'Головная боль', severity: 4 }])),
    ];
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    const priorities = plan.recommendations.map((r) => order[r.priority]);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('summary считает количество по приоритетам', () => {
    const entries = [painEntry(0, {}, { hemato: { symptoms: { nosebleeds: true, bruising: true }, totalScore: 2 } })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    expect(plan.summary.critical).toBeGreaterThanOrEqual(1);
    expect(plan.summary.high + plan.summary.medium + plan.summary.low).toBe(plan.recommendations.length - plan.summary.critical);
    expect(plan.summary.verdict).toContain('специалиста');
  });

  it('summarizeHealthPlan: критичный вердикт', () => {
    const s = summarizeHealthPlan([{ id: '1', domain: 'pain', priority: 'critical', title: 'x', rationale: 'y', action: 'z' } as any]);
    expect(s.critical).toBe(1);
    expect(s.verdict).toContain('специалиста');
  });

  it('exportHealthPlanText содержит заголовки и рекомендации', () => {
    const entries = [painEntry(0, {}, { hemato: { symptoms: { nosebleeds: true, bruising: true }, totalScore: 2 } })];
    const analysis = analyzeHealthProfile(entries);
    const plan = generateHealthPlan(analysis);
    const text = exportHealthPlanText(plan, analysis);
    expect(text).toContain('ПЛАН УЛУЧШЕНИЙ ЗДОРОВЬЯ');
    expect(text).toContain(plan.summary.verdict);
    expect(text).toContain('[КРИТИЧНО]');
  });

  it('saveHealthPlan/loadHealthPlan round-trip', () => {
    const entries = [painEntry(0, { shoulders: 9 })];
    const plan = generateHealthPlan(analyzeHealthProfile(entries));
    saveHealthPlan(plan);
    const loaded = loadHealthPlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.recommendations.length).toBe(plan.recommendations.length);
  });

  it('loadHealthPlan: повреждённые данные → null', () => {
    localStorage.setItem('he_health_plan', '{broken');
    expect(loadHealthPlan()).toBeNull();
  });

  it('savePlanDone/loadPlanDone round-trip', () => {
    savePlanDone(['a', 'b']);
    expect(loadPlanDone()).toEqual(['a', 'b']);
    savePlanDone([]);
    expect(loadPlanDone()).toEqual([]);
  });
});

describe('generateHealthPlan — контекст других дневников (ctx)', () => {
  const base = () => [withSymptoms(0, [])];

  it('сон < 6 ч → medium', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { sleepAvg7: 5.2 }));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.title.includes('Недостаток сна'))).toBe(true);
  });

  it('сон ≥ 6 ч → без рекомендации о сне', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { sleepAvg7: 7.5 }));
    expect(plan.recommendations.some((r) => r.title.includes('Недостаток сна'))).toBe(false);
  });

  it('систола ≥160 → critical', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { bpSystolicLast: 172, bpDiastolicLast: 104 }));
    expect(plan.recommendations.some((r) => r.priority === 'critical' && r.title.includes('Высокое АД'))).toBe(true);
  });

  it('систола 140-159 → high', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { bpSystolicLast: 148, bpDiastolicLast: 92 }));
    expect(plan.recommendations.some((r) => r.priority === 'high' && r.title.includes('Повышенное АД'))).toBe(true);
  });

  it('АД в норме → без рекомендации об АД', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { bpSystolicLast: 118, bpDiastolicLast: 76 }));
    expect(plan.recommendations.some((r) => r.title.includes('АД'))).toBe(false);
  });

  it('активный курс → medium мониторинг', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { onCycle: true }));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.title.includes('Мониторинг на курсе'))).toBe(true);
  });

  it('быстрый набор веса ≥0.5 кг/нед → medium', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base(), { weightTrendKgWeek: 0.8 }));
    expect(plan.recommendations.some((r) => r.priority === 'medium' && r.title.includes('Быстрый набор веса'))).toBe(true);
  });

  it('ctx по умолчанию не даёт ложных срабатываний', () => {
    const plan = generateHealthPlan(analyzeHealthProfile(base()));
    expect(plan.recommendations.some((r) => r.title.includes('Недостаток сна'))).toBe(false);
    expect(plan.recommendations.some((r) => r.title.includes('АД'))).toBe(false);
    expect(plan.recommendations.some((r) => r.title.includes('Быстрый набор веса'))).toBe(false);
  });
});

describe('generateHealthPlan — стабильные id', () => {
  it('повторная генерация даёт те же id (чекбоксы не «плывут»)', () => {
    const entries = [
      painEntry(2, { shoulders: 3 }),
      painEntry(0, { shoulders: 9 }),
      ...Array.from({ length: 3 }, (_, i) => withSymptoms(i, [{ name: 'Головная боль', severity: 4 }])),
    ];
    const a = analyzeHealthProfile(entries);
    const p1 = generateHealthPlan(a);
    const p2 = generateHealthPlan(analyzeHealthProfile(entries));
    expect(p1.recommendations.map((r) => r.id)).toEqual(p2.recommendations.map((r) => r.id));
    expect(new Set(p1.recommendations.map((r) => r.id)).size).toBe(p1.recommendations.length);
  });

  it('id не зависит от порядка правил и не содержит индексов', () => {
    const plan = generateHealthPlan(analyzeHealthProfile([painEntry(0, { shoulders: 9 })]));
    for (const r of plan.recommendations) {
      expect(r.id).toMatch(/^[a-z]+_[a-z0-9]+$/);
    }
  });
});

describe('exportHealthReportText', () => {
  it('содержит все разделы: боль, симптомы, контекст и план', () => {
    const entries = [
      painEntry(2, { shoulders: 3 }),
      painEntry(0, { shoulders: 9, knees: 5 }, { pain: { zones: { shoulders: 9, knees: 5 }, totalScore: 14, triggers: ['Физ. нагрузка'] } as any }),
      withSymptoms(0, [{ name: 'Головная боль', severity: 4 }]),
    ];
    const analysis = analyzeHealthProfile(entries, { sleepAvg7: 5.5, bpSystolicLast: 150, bpDiastolicLast: 95, onCycle: true });
    const plan = generateHealthPlan(analysis);
    const text = exportHealthReportText(analysis, plan);
    expect(text).toContain('ОТЧЁТ ПО ДНЕВНИКУ ЗДОРОВЬЯ');
    expect(text).toContain('— Боль —');
    expect(text).toContain('Худшая зона');
    expect(text).toContain('— Симптомы —');
    expect(text).toContain('Головная боль');
    expect(text).toContain('— Контекст —');
    expect(text).toContain('5.5 ч');
    expect(text).toContain('150/95');
    expect(text).toContain('активен');
    expect(text).toContain('ПЛАН УЛУЧШЕНИЙ ЗДОРОВЬЯ');
    expect(text).toContain(plan.summary.verdict);
  });
});
