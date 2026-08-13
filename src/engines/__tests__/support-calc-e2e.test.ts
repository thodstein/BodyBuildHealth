import { describe, expect, it } from 'vitest';
import { calculateSupportTZ } from '../support-plan/engine';
import { runSupportUnified } from '../support-plan/index';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { resolvePlan, isDoctorControlled } from '../tz-mapper-engine';
import { buildTzInput, buildTzInputCore } from '../support-plan/engine-helpers';
import { calculateTzSpecRisk } from '../risk-engine-tz-spec';
import { canonId } from '../support-plan/shared-constants';
import { detectActivePedClasses } from '../../data/ped-class-matrix';
import { getAdministrationRules } from '../../data/administration-rules-db';
import { getSubstanceMonitoring } from '../../data/substance-monitoring-db';
import { findSeparationRules } from '../../data/separation-timing-db';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function stateWith(ids: string[], overrides: any = {}) {
  return {
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: ids.map(id => ({ id, doseMgWeek: 500, weeks: 12 })) },
    ...overrides,
  };
}

describe('support calc E2E — критический сценарий: test 500 + tren 400 + nand 300', () => {
  const state = stateWith(['test_enan', 'tren_enan', 'nandrolone_decanoate']);

  it('полный план: база, обязательные препараты, без авто-каберголина, риски поддержки', () => {
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const ids = rec.subs.map(s => canonId(s.substanceId));
    // база курса
    for (const b of ['hydration', 'cardio_aerobic', 'electrolyte_balance']) expect(ids).toContain(b);
    // обязательные по профилю
    expect(ids).toContain('hcg');
    expect(ids).toContain('agmatine'); // нандролон
    expect(ids).toContain('telmisartan');
    expect(ids).toContain('nebivolol');
    expect(rec.subs.some(s => s.substanceId === 'magnesium_l_threonate')).toBe(true); // трен-нейро (canonId → magnesium)
    // каберголин lab-gated: PRL нет → НЕ назначается
    expect(ids).not.toContain('cabergoline');
    // риски поддержки (гипотония от тройки АД-препаратов)
    expect(rec.supportRisks?.some(r => r.id === 'hypotension')).toBe(true);
    // мониторинг: baseline + поддержка-мониторинг по препаратам
    const sched = rec.monitoringSchedule || [];
    const baseline = sched.find(s => s.id === 'baseline')!;
    expect(baseline.items.some(i => i.marker.includes('ОАМ'))).toBe(true);
    expect(baseline.items.some(i => i.marker.includes('Маркеры прогресса'))).toBe(true);
    const week4 = sched.find(s => s.id === 'week4')!;
    expect(week4.items.some(i => i.drug && i.marker.includes('Коагулограмма'))).toBe(true); // фибринолитики? нет — но telmisartan K/eGFR
    // рецептурные помечены
    expect(rec.subs.filter(s => isDoctorControlled(s.substanceId)).length).toBeGreaterThan(0);
  });

  it('калькулятор (calculateSupportTZ) и resolvePlan дают один состав', () => {
    const eng = new Set(calculateSupportTZ(state).selectedSubstances.map((id: string) => canonId(id)));
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    for (const s of rec.subs) expect(eng.has(canonId(s.substanceId))).toBe(true);
    expect(rec.subs.length).toBeGreaterThanOrEqual(10);
  });

  it('риск: единый вход калькулятора и вкладки «Риски» — идентичные цифры', () => {
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const subs = rec.subs.map(s => s.substanceId);
    const viaState = buildTzInput(state, subs)!;
    const viaCore = buildTzInputCore({
      drugs: viaState.drugs || [], duration: viaState.duration, labs: viaState.labValues,
      phaseKey: 'course', courseWeek: viaState.courseWeek, genetics: viaState.genetics,
      nutrition: viaState.nutrition, training: viaState.training,
    }, subs);
    const a = calculateTzSpecRisk(viaState);
    const b = calculateTzSpecRisk(viaCore);
    expect(b.overallRaw).toBe(a.overallRaw);
    expect(b.overallAfter).toBe(a.overallAfter);
    expect(b.organs.flatMap(o => o.mechanisms.map(m => m.rawPercent))).toEqual(a.organs.flatMap(o => o.mechanisms.map(m => m.rawPercent)));
  });

  it('support-мониторинг: препараты поддержки дают пункты в графике', () => {
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const sm = getSubstanceMonitoring(rec.subs.map(s => s.substanceId));
    expect(sm.length).toBeGreaterThan(0);
    const sched = rec.monitoringSchedule || [];
    const allMarkers = sched.flatMap(s => s.items.map(i => i.marker)).join(' | ');
    for (const m of sm.slice(0, 5)) expect(allMarkers).toContain(m.marker.slice(0, 20));
  });

  it('разнесение приёма: пары плана находят правила', () => {
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const rules = getAdministrationRules(rec.subs.map(s => s.substanceId));
    const sep = findSeparationRules(rec.subs.map(s => s.substanceId));
    expect(rules.length).toBeGreaterThan(0);
    // хотя бы одно правило критичного времени (натощак/утром)
    expect(rules.some(r => r.timing.includes('натощак') || r.timing.includes('утром'))).toBe(true);
    expect(Array.isArray(sep)).toBe(true);
  });

  it('pill burden не считает базу курса', () => {
    const result = runSupportUnified(state);
    const pills = result.pillBurden?.totalSubstances ?? 0;
    const nonBase = result.substances.filter(s => !['hydration', 'cardio_aerobic', 'electrolyte_balance', 'daily_steps', 'no_smoking', 'no_alcohol'].includes(s.id)).length;
    expect(pills).toBeLessThan(result.substances.length);
    expect(pills).toBeLessThanOrEqual(nonBase);
  });
});

describe('detectActivePedClasses — корректная классификация (баг-регрессия)', () => {
  it('sustanon → тестостерон, НЕ орал 17α', () => {
    const cls = detectActivePedClasses({ pharma: { aas: [{ id: 'sustanon' }] } });
    expect(cls.map(c => c.id)).toContain('testosterone');
    expect(cls.map(c => c.id)).not.toContain('oral17');
  });
  it('nandrolone_propionate → нандролон, НЕ тестостерон', () => {
    const cls = detectActivePedClasses({ pharma: { aas: [{ id: 'nandrolone_propionate' }] } });
    expect(cls.map(c => c.id)).toContain('nandrolone');
    expect(cls.map(c => c.id)).not.toContain('testosterone');
  });
  it('test_enan + tren_enan + winstrol → тест + трен + орал', () => {
    const cls = detectActivePedClasses({ pharma: { aas: [{ id: 'test_enan' }, { id: 'tren_enan' }, { id: 'winstrol' }] } });
    const ids = cls.map(c => c.id).sort();
    expect(ids).toEqual(['oral17', 'testosterone', 'trenbolone']);
  });
  it('пустой курс → без классов', () => {
    expect(detectActivePedClasses({ pharma: { aas: [] } })).toHaveLength(0);
  });
});

describe('каберголин lab-gated (полный цикл)', () => {
  it('PRL 45 на тренболоне → каберголин назначен, предупреждение снято', () => {
    const s = stateWith(['test_enan', 'tren_enan'], {
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelSex: { Prolactin: '45' } } as any },
    });
    const rec = resolvePlan(buildMapperCtx(s, 'medium'));
    expect(rec.subs.some(x => canonId(x.substanceId) === 'cabergoline')).toBe(true);
    expect(rec.protocolWarnings?.some(w => w.includes('КАБЕРГОЛИН НЕ НАЗНАЧЕН'))).toBe(false);
  });
  it('PRL 12 → без каберголина, предупреждение есть', () => {
    const s = stateWith(['test_enan', 'tren_enan'], {
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelSex: { Prolactin: '12' } } as any },
    });
    const rec = resolvePlan(buildMapperCtx(s, 'medium'));
    expect(rec.subs.some(x => canonId(x.substanceId) === 'cabergoline')).toBe(false);
    expect(rec.protocolWarnings?.some(w => w.includes('КАБЕРГОЛИН НЕ НАЗНАЧЕН'))).toBe(true);
  });
});
