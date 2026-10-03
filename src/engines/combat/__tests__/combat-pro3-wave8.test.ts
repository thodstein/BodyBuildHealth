/**
 * combat-pro3-wave8.test.ts — локи Э5.2 (год собирается планами по блокам),
 * Э5.7-LEA (тренировочный расход из дневника) и Э5.7-женская модуляция
 * (фаза цикла из he_cycle_log).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport } from '../combat-finalize.engine';
import {
  buildAnnualATR, addCompetitionToAnnual, buildAnnualPlans, blockStartDate, annualBlockGoal,
  buildAnnualPrintHtml, saveAnnualCB, loadAnnualCB, isAnnualCBShape, type AnnualCB,
} from '../combat-annual';
import { estimateTrainingKcalFromDiary } from '../combat-measurements.engine';
import {
  combatCyclePhaseForDate, autoCombatCyclePhase, inferCombatCycleLength, cycleModulationFor,
} from '../combat-female-cycle';
import { cyclePhaseForDate } from '../../../ui/screens/NutritionScreen_parts/IndividualPlan/planner-cycle-calendar';
import { saveCardioLogEntry } from '../../lms/cardio-diary.engine';
import { localIsoDate } from '../../../core/local-date';
import type { CombatPlan } from '../combat.types';

beforeEach(() => localStorage.clear());

const sumSets = (p: CombatPlan) =>
  p.weeksData.reduce((a, w) => a + w.sessions.reduce((x, s) => x + s.exercises.reduce((y, e) => y + e.sets, 0), 0), 0);
const flatEx = (p: CombatPlan) =>
  p.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => ({ id: e.id, sets: e.sets, rir: e.rir }))));

describe('Э5.2 — год собирается планами по блокам', () => {
  it('52 нед ATR: все блоки built, план каждой недели = weeks блока', () => {
    const ann = buildAnnualATR('mma', 52, '2026-01-05', { cycles: 1 });
    const res = buildAnnualPlans(ann, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' });
    expect(res.blocks.length).toBeGreaterThan(0);
    for (const b of res.blocks) {
      expect(b.status).toBe('built');
      expect(b.plan).toBeTruthy();
      expect(b.plan!.weeks).toBe(b.weeks);
      expect(b.plan!.weeksData.length).toBe(b.weeks);
      // недели перенумерованы подряд — год не «дырявый»
      expect(b.plan!.weeksData.map(w => w.week)).toEqual(Array.from({ length: b.weeks }, (_, i) => i + 1));
    }
    // сумма недель года не изменилась сборкой
    expect(res.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(52);
    // исходный год не мутирован
    expect(ann.blocks.every(b => !b.plan)).toBe(true);
  });

  it('цель из фазы: accumulation/gpp/transmutation → power, realization/taper → camp, transition → maintenance', () => {
    expect(annualBlockGoal('accumulation')).toBe('power');
    expect(annualBlockGoal('gpp')).toBe('power');
    expect(annualBlockGoal('power')).toBe('power');
    expect(annualBlockGoal('transmutation')).toBe('power');
    expect(annualBlockGoal('realization')).toBe('camp');
    expect(annualBlockGoal('taper')).toBe('camp');
    expect(annualBlockGoal('transition')).toBe('maintenance');
  });

  it('blockStartDate: неделя 1 = якорь, дальше +7×N дней; мусор → null', () => {
    const ann = buildAnnualATR('mma', 24, '2026-01-05', { cycles: 1 });
    const b = { ...ann.blocks[0], startWeek: 13 } as any;
    const expected = new Date('2026-01-05T00:00:00Z');
    expected.setUTCDate(expected.getUTCDate() + 84);
    expect(blockStartDate(ann, b, '2026-01-05')).toBe(expected.toISOString().slice(0, 10));
    expect(blockStartDate(ann, { ...b, startWeek: 1 } as any, '2026-01-05')).toBe('2026-01-05');
    expect(blockStartDate(ann, b, null)).toBeNull();
    expect(blockStartDate(ann, b, '2025-02-30')).toBeNull();
  });

  it('ошибка одного блока изолирована: остальные собираются, год не рушится', () => {
    const ann = buildAnnualATR('mma', 24, '2026-01-05', { cycles: 1 });
    expect(ann.blocks.length).toBeGreaterThanOrEqual(3);
    const broken: AnnualCB = { ...ann, blocks: ann.blocks.map((b, i) => (i === 1 ? { ...b, weeks: 0 } : { ...b })) };
    let res: AnnualCB | null = null;
    expect(() => { res = buildAnnualPlans(broken, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' }); }).not.toThrow();
    expect(res!.blocks[1].status).toBe('error');
    expect(res!.blocks[1].plan).toBeUndefined();
    expect(String(res!.blocks[1].error)).toMatch(/длительность/);
    expect(res!.blocks[0].status).toBe('built');
    expect(res!.blocks[2].status).toBe('built');
  });

  it('mini-taper taper-блока режет объём и помечен в rationale', () => {
    let ann = buildAnnualATR('mma', 24, '2026-01-05', { cycles: 1 });
    ann = addCompetitionToAnnual(ann, { id: 'c1', name: 'Бой', date: '2026-03-01', priority: 'main' } as any, '2026-01-05');
    const res = buildAnnualPlans(ann, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' });
    const taper = res.blocks.find(b => b.phase === 'taper' && b.fightDate)!;
    expect(taper).toBeTruthy();
    expect(taper.plan).toBeTruthy();
    expect(taper.plan!.rationale.some(l => l.includes('Mini-taper'))).toBe(true);
    expect(taper.plan!.weeksData.some(w => (w as any).taper)).toBe(true);
    // тот же блок без даты боя — объём выше (канонический тапер вырезал)
    const noFight = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'intermediate',
      weeks: Math.max(2, taper.weeks), daysPerWeek: 3,
      startDate: blockStartDate(res, taper, '2026-01-05'), fightDate: null,
    } as any));
    expect(sumSets(taper.plan!)).toBeLessThan(sumSets(noFight));
  });

  it('печать года содержит строки планов блоков («план блока: N нед · X сетов/нед»)', () => {
    const ann = buildAnnualATR('mma', 24, '2026-01-05', { cycles: 1 });
    const res = buildAnnualPlans(ann, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' });
    const html = buildAnnualPrintHtml(res);
    expect(html).toContain('план блока:');
    expect(html).toMatch(/сетов\/нед/);
    // статус error/-текст не ломает печать
    const withErr: AnnualCB = { ...res, blocks: res.blocks.map((b, i) => (i === 0 ? { ...b, status: 'error' as const, error: '<bad>' } : b)) };
    const html2 = buildAnnualPrintHtml(withErr);
    expect(html2).not.toContain('<bad>');
    expect(html2).toContain('&lt;bad&gt;');
  });

  it('собранный год переживает персист (shape валиден)', () => {
    const ann = buildAnnualATR('mma', 12, '2026-01-05', { cycles: 1 });
    const res = buildAnnualPlans(ann, { level: 'beginner', daysPerWeek: 2, startDate: '2026-01-05' });
    saveAnnualCB(res);
    const back = loadAnnualCB();
    expect(back).toBeTruthy();
    expect(isAnnualCBShape(back)).toBe(true);
    expect(back!.blocks.some(b => !!b.plan)).toBe(true);
  });
});

describe('Э5.7 — LEA: тренировочный расход из дневника', () => {
  const cardio = (over: any = {}) => ({
    id: 'e1', date: '2026-10-03', type: 'zone2', durationMin: 45, completed: true, ...over,
  });

  it('кардио-дневник даёт kcal>0 (MET-оценки за окно / дни)', () => {
    const r = estimateTrainingKcalFromDiary(null, { cardioEntries: [cardio()] as any, days: 7, todayIso: '2026-10-03' });
    expect(r.kcal).toBe(Math.round(315 / 7));
    expect(r.cardioEntries).toBe(1);
    expect(r.partial).toBe(true);
    expect(r.note).toMatch(/вручную/);
  });

  it('живой путь: запись в he_cardio_sessions подхватывается без явного журнала', () => {
    saveCardioLogEntry({ id: 'c1', date: localIsoDate(), type: 'hiit', durationMin: 15, completed: true } as any);
    const r = estimateTrainingKcalFromDiary([], { weightKg: 80 });
    expect(r.kcal).toBeGreaterThan(0);
    expect(r.cardioEntries).toBe(1);
  });

  it('без данных — честный null и «введите вручную», без выдуманного нуля', () => {
    const r = estimateTrainingKcalFromDiary([], { cardioEntries: [], days: 7, todayIso: '2026-10-03' });
    expect(r.kcal).toBeNull();
    expect(r.strengthKcalPerDay).toBeNull();
    expect(r.note).toMatch(/вручную/);
  });

  it('sRPE-сессии без кардио НЕ переводятся в ккал (нет подписанной формулы)', () => {
    const r = estimateTrainingKcalFromDiary(
      [{ date: '2026-10-02', durationMin: 60, rpe: 8 }, { date: '2026-10-01', rpe: 7 }],
      { cardioEntries: [], days: 7, todayIso: '2026-10-03' },
    );
    expect(r.kcal).toBeNull();
    expect(r.strengthKcalPerDay).toBeNull();
    expect(r.srpeSessions).toBe(2);
    expect(r.note).toMatch(/вручную/);
  });

  it('окно: запись вне последних N дней не учитывается', () => {
    const r = estimateTrainingKcalFromDiary(null, {
      cardioEntries: [cardio({ date: '2026-08-01' })] as any, days: 7, todayIso: '2026-10-03',
    });
    expect(r.cardioEntries).toBe(0);
    expect(r.kcal).toBeNull();
  });
});

describe('Э5.7 — женская модуляция по фазе цикла', () => {
  const base = {
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3,
    bodyweight: 70, sex: 'female',
  } as any;

  it('паритет с планировщиком питания: те же границы фаз на 40 днях', () => {
    for (let day = 0; day < 40; day++) {
      const d = new Date('2026-01-05T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + day);
      const iso = d.toISOString().slice(0, 10);
      expect(combatCyclePhaseForDate('2026-01-05', 28, iso)).toBe(cyclePhaseForDate('2026-01-05', 28, iso));
    }
    expect(inferCombatCycleLength(['2026-09-01', '2026-09-29'])).toBe(28);
  });

  it('авто-фаза из he_cycle_log (менструальная/лютеиновая)', () => {
    localStorage.setItem('he_cycle_log', JSON.stringify(['2026-09-01', '2026-09-29']));
    expect(autoCombatCyclePhase(undefined, '2026-10-03').phase).toBe('menstrual');
    expect(autoCombatCyclePhase(undefined, '2026-10-20').phase).toBe('luteal');
  });

  it('без лога — «none»; фолликулярная/овуляция — без модуляции (норма)', () => {
    expect(autoCombatCyclePhase(undefined, '2026-10-03').phase).toBe('none');
    expect(cycleModulationFor('follicular')).toBeNull();
    expect(cycleModulationFor('ovulation')).toBeNull();
    expect(cycleModulationFor('none')).toBeNull();
    expect(cycleModulationFor(null)).toBeNull();
  });

  it('лютеиновая: объём ниже, RIR не ниже, строка в rationale; без фазы — байт-в-байт', () => {
    const without = finalizeCombatPlan(buildCombatPlan({ ...base } as any));
    const follicular = finalizeCombatPlan(buildCombatPlan({ ...base, cyclePhase: 'follicular' } as any));
    // фолликулярная — норма: математика и rationale идентичны (фаза не модулирует)
    expect(follicular.id).toBe(without.id);
    expect(JSON.stringify(follicular.weeksData)).toBe(JSON.stringify(without.weeksData));
    expect(follicular.rationale).toEqual(without.rationale);
    // male + лютеиновая — модуляции нет
    const maleLuteal = finalizeCombatPlan(buildCombatPlan({ ...base, sex: 'male', cyclePhase: 'luteal' } as any));
    const maleBase = finalizeCombatPlan(buildCombatPlan({ ...base, sex: 'male' } as any));
    expect(JSON.stringify(maleLuteal.weeksData)).toBe(JSON.stringify(maleBase.weeksData));
    expect(maleLuteal.rationale).toEqual(maleBase.rationale);

    const luteal = finalizeCombatPlan(buildCombatPlan({ ...base, cyclePhase: 'luteal' } as any));
    expect(luteal.rationale.some(l => l.includes('Лютеиновая фаза'))).toBe(true);
    expect(sumSets(luteal)).toBeLessThan(sumSets(without));
    const a = flatEx(without); const b = flatEx(luteal);
    expect(b.map(e => e.id)).toEqual(a.map(e => e.id));
    for (let i = 0; i < a.length; i++) {
      expect(b[i].sets).toBeLessThanOrEqual(a[i].sets);
      expect(b[i].rir).toBeGreaterThanOrEqual(a[i].rir);
    }
  });

  it('менструальная: лёгкая неделя без отказа — RIR ≥3 и объём ниже', () => {
    const without = finalizeCombatPlan(buildCombatPlan({ ...base } as any));
    const menst = finalizeCombatPlan(buildCombatPlan({ ...base, cyclePhase: 'menstrual' } as any));
    expect(menst.rationale.some(l => l.includes('Менструальная'))).toBe(true);
    expect(sumSets(menst)).toBeLessThan(sumSets(without));
    for (const e of flatEx(menst)) expect(e.rir).toBeGreaterThanOrEqual(3);
  });
});

describe('годовые планы — печатный отчёт блока читается', () => {
  it('buildCombatReport собранного блока не пуст', () => {
    const ann = buildAnnualATR('boxing', 12, '2026-01-05', { cycles: 1 });
    const res = buildAnnualPlans(ann, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' });
    const txt = buildCombatReport(res.blocks[0].plan!);
    expect(typeof txt).toBe('string');
    expect(txt.length).toBeGreaterThan(20);
  });
});
