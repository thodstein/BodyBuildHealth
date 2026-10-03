/**
 * combat-pro3-wave7.test.ts — локи Э5.5 (журналы RMR/мощности) и Э6-P2
 * (офлайн-печать без внешнего QR, daysToFirstFight = ближайший будущий бой).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import {
  addRmr, loadRmr, addPower, loadPower, rmrDeltaFromJournal, powerDeltaPctFromJournal,
  normalizeRmr, normalizePower,
} from '../combat-measurements.engine';
import { weightCycleVerdict } from '../combat-science';
import { buildCombatPrintHtml } from '../combat-print.engine';
import { buildAnnualATR, buildAnnualPrintHtml } from '../combat-annual';
import { daysToFirstFight } from '../../../ui/screens/combat/combat-annual-card';
import { conditioningSessionsForWeek, buildConditioningRationale } from '../combat-conditioning.engine';

const iso = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Э5.5 — журналы RMR и мощности', () => {
  it('roundtrip: RMR и мощность сохраняются, мусор отбрасывается', () => {
    expect(addRmr(iso(30), 1850)).toBe(true);
    expect(addRmr(iso(2), 1597)).toBe(true);
    expect(addRmr(iso(1), 100)).toBe(false); // ниже человеческого RMR
    expect(loadRmr().length).toBe(2);
    expect(addPower(iso(30), 620)).toBe(true);
    expect(addPower(iso(2), 452)).toBe(true);
    expect(addPower(iso(1), 5000)).toBe(false);
    expect(loadPower().length).toBe(2);
  });

  it('дельты: RMR последний−первый, мощность %', () => {
    const rmr = normalizeRmr([{ date: iso(30), kcalPerDay: 1850 }, { date: iso(2), kcalPerDay: 1597 }]);
    expect(rmrDeltaFromJournal(rmr)).toBe(-253);
    const pwr = normalizePower([{ date: iso(30), watts: 620 }, { date: iso(2), watts: 452 }]);
    expect(powerDeltaPctFromJournal(pwr)).toBeCloseTo(-27.1, 1);
  });

  it('кейс PMID 40443978 (RMR −253, мощность −27%) → verdict danger с сигналами', () => {
    const v = weightCycleVerdict({ rmrDelta: -253, powerDeltaPct: -27.1, ffmDeltaKg: -0.6 });
    expect(v.level).toBe('danger');
    expect(v.signals.some(s => s.includes('РМР'))).toBe(true);
    expect(v.signals.some(s => s.includes('мощность'))).toBe(true);
    expect(v.source).toContain('40443978');
  });

  it('без данных — честный watch/ok с подсказкой', () => {
    const v = weightCycleVerdict({ rmrDelta: null, powerDeltaPct: null, ffmDeltaKg: null });
    expect(v.level).toBe('ok');
    expect(v.signals[0]).toContain('недостаточно');
  });
});

describe('Э6-P2 — печать офлайн без внешнего QR', () => {
  it('печать плана и года не содержит api.qrserver (офлайн-АПК + утечка хэша)', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3 } as any);
    const html = buildCombatPrintHtml(plan);
    expect(html).not.toContain('qrserver');
    expect(html).toContain('hash:');
    const ann = buildAnnualATR('mma', 52);
    const annHtml = buildAnnualPrintHtml(ann);
    expect(annHtml).not.toContain('qrserver');
    expect(annHtml).toContain('hash:');
  });
});

describe('Э5.3 — недельная волна кондиции', () => {
  it('нечётные недели накопления — power, чётные — capacity; строка волны в rationale', () => {
    const w1 = conditioningSessionsForWeek(1, 'accumulation', 'power', 2);
    const w2 = conditioningSessionsForWeek(2, 'accumulation', 'power', 2);
    expect(w1.some(s => s.id.includes('power_wave'))).toBe(true);
    expect(w2.some(s => s.id.includes('capacity'))).toBe(true);
    expect(buildConditioningRationale('power', 2, 8).some(l => l.includes('Волна накопления'))).toBe(true);
  });
});

describe('Э6-P2 — daysToFirstFight: ближайший будущий бой', () => {  it('прошлый бой не перекрывает отсчёт до будущего', () => {
    const annual = { competitions: [{ date: iso(30) }, { date: iso(-10) }] };
    expect(daysToFirstFight(annual, iso(0))).toBe(10);
  });

  it('все бои прошли — отсчёт до самого свежего (отрицательный)', () => {
    const annual = { competitions: [{ date: iso(40) }, { date: iso(5) }] };
    expect(daysToFirstFight(annual, iso(0))).toBe(-5);
  });

  it('без соревнований — null', () => {
    expect(daysToFirstFight({ competitions: [] }, iso(0))).toBeNull();
  });
});

beforeEach(() => localStorage.clear());
