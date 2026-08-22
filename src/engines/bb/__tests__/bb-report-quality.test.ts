import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { buildBBPlanReportText } from '../bb-report.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB отчёт качества (без мусора/дублей, с полезной информацией)', () => {
  it('содержит баланс, фазы и валидацию (ранее отсутствовавшие)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 8, workMax: WM });
    const text = buildBBPlanReportText(plan);
    expect(text).toContain('⚖️ Баланс');
    expect(text).toContain('📅 Фазы');
    expect(text).toContain('Накопление');
    expect(text).toMatch(/Валидация|✅/);
  });

  it('нагрузка не дублируется по неделям (одно упражнение — одна строка)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 8, workMax: WM });
    const text = buildBBPlanReportText(plan);
    const loadSection = text.split('Нагрузка')[1] || '';
    const names = [...loadSection.matchAll(/^\s*\S+?: (.+?) —/gm)].map(m => m[1].trim());
    const unique = new Set(names);
    expect(names.length).toBeGreaterThan(0);
    expect(unique.size).toBe(names.length); // нет повторов упражнения по неделям
  });

  it('настройки консолидированы: нет внутренних дублей и «мусорных» флагов', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM });
    const text = buildBBPlanReportText(plan);
    const settings = text.split('\n').find(l => l.startsWith('Настройки:')) || '';
    expect(settings).toContain('Уровень');
    expect(settings).toContain('Цель');
    // дубли внутренних имён убраны
    expect(settings).not.toContain('Цель объёма');
    expect(settings).not.toContain('Режим объёма');
    expect(settings).not.toContain('MRV×');
    expect(text).not.toContain('Меньше базы: да');
  });
});
