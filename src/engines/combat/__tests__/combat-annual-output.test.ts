import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import {
  buildAnnualATR,
  addCompetitionToAnnual,
  autoAnnualWithFightTaper,
} from '../combat-annual';
import {
  buildCombatPrintHtml,
  buildCombatPlanIcs,
  buildFightWeekTemplateHtml,
} from '../combat-print.engine';
import {
  saveCombatPlan,
  loadCombatPlan,
  loadCombatPlans,
  removeCombatPlan,
  isCombatPlanShape,
} from '../combat-storage';

/**
 * combat P7: годовой ATR с таперами к боям + выдача + персист-квоты.
 */
describe('combat annual tapers', () => {
  it('52нед ATR: сумма сходится', () => {
    const ann = buildAnnualATR('mma', 52, '2026-01-05', { cycles: 1 });
    expect(ann.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(52);
  });
  it('главный бой → тапер 2нед, второстепенный → мини 1нед', () => {
    const base = buildAnnualATR('mma', 52, '2026-01-05', { cycles: 1 });
    const main = addCompetitionToAnnual(base, { id: 'c1', name: 'Титул', date: '2026-06-01', priority: 'main' }, '2026-01-05');
    const taperMain = main.blocks.filter(b => b.phase === 'taper' && b.fightDate === '2026-06-01');
    expect(taperMain.length).toBe(1);
    expect(taperMain[0].weeks).toBe(2);
    const base2 = buildAnnualATR('mma', 52, '2026-01-05', { cycles: 1 });
    const sec = addCompetitionToAnnual(base2, { id: 'c2', name: 'Рейтинг', date: '2026-06-01', priority: 'secondary' }, '2026-01-05');
    const taperSec = sec.blocks.filter(b => b.phase === 'taper' && b.fightDate === '2026-06-01');
    expect(taperSec.length).toBe(1);
    expect(taperSec[0].weeks).toBe(1);
  });
  it('два боя: оба тапера на месте, сумма 52', () => {
    let ann = buildAnnualATR('mma', 52, '2026-01-05', { cycles: 1 });
    ann = addCompetitionToAnnual(ann, { id: 'c1', name: 'Бой1', date: '2026-04-01', priority: 'main' }, '2026-01-05');
    ann = addCompetitionToAnnual(ann, { id: 'c2', name: 'Бой2', date: '2026-09-01', priority: 'secondary' }, '2026-01-05');
    expect(ann.blocks.filter(b => b.phase === 'taper' && b.fightDate).length).toBe(2);
    expect(ann.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(52);
    expect(ann.totalWeeks).toBe(52);
  });
  it('без priority — дефолт main (2нед), поведение как раньше', () => {
    const base = buildAnnualATR('boxing', 24, '2026-01-05', { cycles: 1 });
    const ann = addCompetitionToAnnual(base, { id: 'c1', name: 'Бой', date: '2026-03-01' }, '2026-01-05');
    const taper = ann.blocks.filter(b => b.phase === 'taper' && b.fightDate === '2026-03-01');
    expect(taper.length).toBe(1);
    expect(taper[0].weeks).toBe(2);
  });
});

describe('combat fight-week output', () => {
  const planWithFight = () => buildCombatPlan({
    discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3,
    fightDate: '2026-09-12', startDate: '2026-08-01', taperWeeks: 2,
    bodyweight: 80, weightCutKg: 4,
    weightCutProtocol: { targetLossKg: 4, weeksOut: 8, waterMode: 'stable', sodiumMode: 'stable', carbMode: 'stable', weighInType: 'day_before_24h' } as any,
  } as any);

  it('шаблон: 14–10/9–5/4–1 + чек-лист; без даты — пусто', () => {
    const html = buildFightWeekTemplateHtml('2026-09-12', 'day_before_24h');
    expect(html).toContain('Дни 14–10');
    expect(html).toContain('Дни 9–5');
    expect(html).toContain('Дни 4–1');
    expect(html).toContain('Чек-лист');
    expect(html).toContain('8–12г/кг');
    expect(buildFightWeekTemplateHtml('2026-09-12', 'same_day_2h')).toContain('в день');
    expect(buildFightWeekTemplateHtml(null, null)).toBe('');
  });
  it('печать: шаблон + ORS/рефид + errors-секция при ошибках', () => {
    const html = buildCombatPrintHtml(planWithFight());
    expect(html).toContain('Fight week');
    expect(html).toContain('Чек-лист');
    const bad = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    const badHtml = buildCombatPrintHtml(bad);
    expect(badHtml).toContain('Ошибки (сборка заблокирована)');
  });
  it('печать: XSS-экранирование пользовательских строк', () => {
    const plan = planWithFight();
    (plan as any).rationale = [...plan.rationale, '<script>alert(1)</script>'];
    const html = buildCombatPrintHtml(plan);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('ICS: события боя и взвешивания', () => {
    const ics = buildCombatPlanIcs(planWithFight(), '2026-08-01');
    expect(ics).toContain('SUMMARY:Бой');
    expect(ics).toContain('Взвешивание');
    const plain = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    const ics2 = buildCombatPlanIcs(plain, '2026-08-01');
    expect(ics2).not.toContain('SUMMARY:Бой');
  });
});

describe('combat storage quotas', () => {  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  it('isCombatPlanShape: план — да, мусор — нет', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 4, daysPerWeek: 3 } as any);
    expect(isCombatPlanShape(plan)).toBe(true);
    expect(isCombatPlanShape(null)).toBe(false);
    expect(isCombatPlanShape({ id: 'x' })).toBe(false);
    expect(isCombatPlanShape({ id: 'x', weeksData: [{ week: 1 }] })).toBe(false);
    expect(isCombatPlanShape({ id: 'x', weeksData: [{ week: 1, sessions: [] }] })).toBe(true);
  });
  it('roundtrip + битый стор отбраковывается', () => {
    const plan = buildCombatPlan({ discipline: 'boxing', goal: 'power', level: 'beginner', weeks: 3, daysPerWeek: 2 } as any);
    saveCombatPlan(plan);
    expect(loadCombatPlan()?.id).toBe(plan.id);
    expect(loadCombatPlans().length).toBeGreaterThan(0);
    localStorage.setItem('he_combat_plan_v1', JSON.stringify({ id: 'broken' }));
    expect(loadCombatPlan()).toBeNull();
    localStorage.setItem('he_combat_plans_v1', JSON.stringify([{ id: 'broken' }, plan]));
    expect(loadCombatPlans().every(p => p.id === plan.id)).toBe(true);
  });
  it('removeCombatPlan чистит связанные payload-ключи своего плана', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 3, daysPerWeek: 2 } as any);
    saveCombatPlan(plan);
    localStorage.setItem('he_combat_nutrition_payload', JSON.stringify({ planId: plan.id, kcal: 3000 }));
    localStorage.setItem('he_combat_cardio_payload', JSON.stringify({ planId: ' чужой', zone2MinPerWeek: 30 }));
    removeCombatPlan(plan.id);
    expect(loadCombatPlan()).toBeNull();
    expect(localStorage.getItem('he_combat_nutrition_payload')).toBeNull();
    expect(localStorage.getItem('he_combat_cardio_payload')).not.toBeNull();
  });
});

describe('autoAnnualWithFightTaper (№2)', () => {
  const planWithFight = () => buildCombatPlan({
    discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3,
    fightDate: '2026-08-29', startDate: '2026-08-01', taperWeeks: 2,
  } as any);

  it('дата боя из свежего плана → тапер 2нед в авто-годе, сумма 6', () => {
    const ann = autoAnnualWithFightTaper([planWithFight()]);
    const taper = ann.blocks.filter(b => b.phase === 'taper' && b.fightDate === '2026-08-29');
    expect(taper.length).toBe(1);
    expect(taper[0].weeks).toBe(2);
    expect(ann.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(6);
    expect(ann.competitions.some(c => c.date === '2026-08-29')).toBe(true);
  });

  it('без даты боя — как раньше: таперов нет', () => {
    const plain = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3 } as any);
    const ann = autoAnnualWithFightTaper([plain]);
    expect(ann.blocks.filter(b => b.phase === 'taper').length).toBe(0);
    expect(ann.competitions).toEqual([]);
  });

  it('мусорная дата — без тапера и без throw', () => {
    const bad = buildCombatPlan({ discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3, fightDate: '2025-02-30' } as any);
    let ann: any = null;
    expect(() => { ann = autoAnnualWithFightTaper([bad]); }).not.toThrow();
    expect(ann.blocks.filter((b: any) => b.phase === 'taper').length).toBe(0);
  });

  it('пустая история — пустой год без throw', () => {
    let ann: any = null;
    expect(() => { ann = autoAnnualWithFightTaper([]); }).not.toThrow();
    expect(ann.blocks).toEqual([]);
  });

  it('№4: бои из ВСЕХ планов истории (дедуп по дате)', () => {
    const a = buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      fightDate: '2026-08-15', startDate: '2026-08-01', taperWeeks: 2,
    } as any);
    const b = buildCombatPlan({
      discipline: 'mma', goal: 'camp', level: 'intermediate', weeks: 6, daysPerWeek: 3,
      fightDate: '2026-10-27', startDate: '2026-09-01', taperWeeks: 2,
    } as any);
    const ann = autoAnnualWithFightTaper([b, a]);
    const tapers = ann.blocks.filter(x => x.phase === 'taper' && x.fightDate);
    expect(tapers.map(t => t.fightDate).sort()).toEqual(['2026-08-15', '2026-10-27']);
    expect(ann.blocks.reduce((s, x) => s + x.weeks, 0)).toBe(12);
    // дубль даты — один тапер
    const dup = autoAnnualWithFightTaper([b, { ...a, id: 'clone' } as any]);
    expect(dup.blocks.filter(x => x.phase === 'taper' && x.fightDate).length).toBe(2);
  });
});
