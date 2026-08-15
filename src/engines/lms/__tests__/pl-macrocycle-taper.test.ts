/**
 * pl-macrocycle-taper.test.ts — применение тапера/пика к неделям макроцикла ПЛ
 * (lms-macro-taper.engine): тапер в peak-блоках, meet-неделя с прикидами на
 * неделе соревнований, mock meet ДО и пост-соревновательное восстановление
 * ПОСЛЕ каждого старта. Закрывает gap «peak/competition блоки — только лейбл».
 */
import { describe, expect, it } from 'vitest';
import { applyMacroTaperToPLWeeks } from '../lms-macro-taper.engine';
import type { LMSPlanWeek } from '../lms-builder.engine';

const mkEx = (name: string, sets: number, load?: string) => ({
  name, group: 'Грудь', coef: 1, mnosz: 1, pm: 200, rir: 2,
  ...(load ? { load } : {}),
  workSets: Array.from({ length: 3 }, (_, i) => ({ pct: 0.7 + i * 0.05, reps: 5, sets, weight: 140 + i * 5, rir: 2 })),
});

const mkDay = (mainSets: number, accSets: number) => ({
  exercises: [mkEx('Присед', mainSets, 'main'), mkEx('Жим лежа', mainSets, 'main'), mkEx('Тяга к поясу', accSets), mkEx('Разгибание', accSets)],
  metrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0 } as any,
});

const mkWeek = (week: number, macroPhase: string): LMSPlanWeek => ({
  week,
  pmRow: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
  days: [mkDay(3, 4), mkDay(3, 4)],
  macroPhase,
});

const totalSets = (w: LMSPlanWeek) => w.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0);

// Макро: 2 нед strength → 4 нед peak → 1 нед competition → 2 нед transition
const macroWeeks = () => [
  mkWeek(1, 'strength'), mkWeek(2, 'strength'),
  mkWeek(3, 'peak'), mkWeek(4, 'peak'), mkWeek(5, 'peak'), mkWeek(6, 'peak'),
  mkWeek(7, 'competition'),
  mkWeek(8, 'transition'), mkWeek(9, 'transition'),
];

describe('applyMacroTaperToPLWeeks', () => {
  it('meet-неделя: прикиды + meetWeek, аксессуары ×0.5', () => {
    const { weeks } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced' });
    const meet = weeks.find(w => w.macroPhase === 'competition')!;
    expect(meet.meetWeek).toBe(true);
    expect(meet.meetAttempts).toBeTruthy();
    expect(meet.meetAttempts!.strategy).toBe('balanced');
    expect(meet.meetAttempts!.lifts.some(l => /присед/i.test(l.name))).toBe(true);
    // Аксессуары (не main): 4 сета → ×0.5 = 2
    const acc = meet.days[0].exercises.find(e => !e.load);
    expect(acc!.workSets[0].sets).toBe(2);
    // Прикиды-синглы на основных: 1 сет × 1 повтор
    const main = meet.days[0].exercises.find(e => e.load === 'main')!;
    expect(main.workSets.every(ws => ws.sets === 1 && ws.reps === 1)).toBe(true);
  });

  it('тапер: 2 последние недели peak-блока получают кривую (объём аксессуаров ↓, RIR ↑)', () => {
    const { weeks } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced' });
    const w5 = weeks[4], w6 = weeks[5];
    expect(w5.taperWeek).toBe(true);
    expect(w6.taperWeek).toBe(true);
    const refAcc = macroWeeks()[2].days[0].exercises.find(e => !e.load)!;
    const acc5 = w5.days[0].exercises.find(e => !e.load)!;
    const acc6 = w6.days[0].exercises.find(e => !e.load)!;
    expect(acc5.workSets[0].sets).toBe(Math.max(1, Math.round(refAcc.workSets[0].sets * 0.65)));
    expect(acc6.workSets[0].sets).toBe(Math.max(1, Math.round(refAcc.workSets[0].sets * 0.45)));
    expect(acc6.workSets[0].rir).toBeGreaterThan(acc5.workSets[0].rir);
    // Недели 3-4 peak-блока — не тапер
    expect(weeks[2].taperWeek).toBeFalsy();
    expect(weeks[3].taperWeek).toBeFalsy();
  });

  it('mock meet ДО соревнования: неделя за 3 позиции (перед peak-блоком)', () => {
    const { weeks, notes } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', mockMeet: true });
    const mock = weeks.find(w => w.mockMeet)!;
    // competition на неделе 7, peak 3-6, тапер 5-6 → mock на неделе 4? Нет:
    // mockIdx = ci - applyCount - 1 = 6 - 2 - 1 = 3 → неделя 4 (последняя не-тапер peak)
    expect(mock.week).toBe(4);
    expect(notes.some(n => n.includes('Mock meet'))).toBe(true);
    // Прикиды-синглы на основных
    const main = mock.days[0].exercises.find(e => e.load === 'main')!;
    expect(main.workSets.every(ws => ws.sets === 1)).toBe(true);
  });

  it('пост-соревновательная неделя ПОСЛЕ старта: объём ×0.5, RIR +3', () => {
    const { weeks, notes } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', postMeet: true });
    const post = weeks.find(w => w.postMeet)!;
    expect(post.week).toBe(8);
    const ref = macroWeeks()[7]; // исходная неделя 8
    expect(totalSets(post)).toBeLessThan(totalSets(ref));
    // Первый main-сет: 3 → ×0.5 = 2; аксессуар: 4 → 2
    expect(post.days[0].exercises[0].workSets[0].sets).toBe(2);
    expect(post.days[0].exercises.find(e => !e.load)!.workSets[0].sets).toBe(2);
    expect(post.days[0].exercises[0].workSets[0].rir).toBe(5); // 2 + 3
    expect(notes.some(n => n.includes('Пост-соревновательное'))).toBe(true);
    expect(post.meetAttempts).toBeUndefined();
  });

  it('несколько соревнований: каждый старт получает meet-неделю, тапер; mock — где не занято восстановлением', () => {
    const weeks = [
      mkWeek(1, 'strength'), mkWeek(2, 'strength'), mkWeek(3, 'peak'), mkWeek(4, 'peak'), mkWeek(5, 'competition'),
      mkWeek(6, 'transition'),
      mkWeek(7, 'peak'), mkWeek(8, 'peak'), mkWeek(9, 'competition'),
      mkWeek(10, 'transition'),
    ];
    const { weeks: out, notes } = applyMacroTaperToPLWeeks(weeks, { strategy: 'balanced', mockMeet: true, postMeet: true });
    const meets = out.filter(w => w.meetWeek);
    expect(meets).toHaveLength(2);
    expect(meets[0].week).toBe(5);
    expect(meets[1].week).toBe(9);
    // mock первого старта — неделя 2 (перед peak-блоком); mock второго —
    // претендовал бы на неделю 6, но она занята пост-восстановлением первого старта
    const mocks = out.filter(w => w.mockMeet);
    expect(mocks).toHaveLength(1);
    expect(mocks[0].week).toBe(2);
    const posts = out.filter(w => w.postMeet);
    expect(posts).toHaveLength(2);
    expect(posts[0].week).toBe(6);
    expect(posts[1].week).toBe(10);
    // Тапер перед обоими стартами: нед 3-4 и нед 7-8
    expect(out[2].taperWeek).toBe(true);
    expect(out[3].taperWeek).toBe(true);
    expect(out[6].taperWeek).toBe(true);
    expect(out[7].taperWeek).toBe(true);
    expect(notes.filter(n => n.includes('Соревнование')).length).toBe(2);
  });

  it('идемпотентность: повторный вызов не меняет размеченные недели', () => {
    const first = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', mockMeet: true, postMeet: true });
    const second = applyMacroTaperToPLWeeks(first.weeks, { strategy: 'balanced', mockMeet: true, postMeet: true });
    expect(second.weeks.map(w => w.week)).toEqual(first.weeks.map(w => w.week));
    expect(second.weeks.filter(w => w.meetWeek)).toHaveLength(1);
    expect(second.weeks.filter(w => w.mockMeet)).toHaveLength(1);
    expect(second.weeks.filter(w => w.postMeet)).toHaveLength(1);
    expect(second.notes).toHaveLength(0);
  });

  it('без соревнований в макроцикле — ничего не меняется', () => {
    const weeks = [mkWeek(1, 'strength'), mkWeek(2, 'strength'), mkWeek(3, 'peak')];
    const { weeks: out, notes } = applyMacroTaperToPLWeeks(weeks, { strategy: 'balanced', mockMeet: true, postMeet: true });
    expect(out).toHaveLength(3);
    expect(out.every(w => !w.taperWeek && !w.mockMeet && !w.meetWeek && !w.postMeet)).toBe(true);
    expect(notes).toHaveLength(0);
  });

  it('весовая цель lose: объём тапера ×0.9 (на предпоследней неделе тапера)', () => {
    const { weeks: loseW } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', weightGoal: 'lose' });
    const { weeks: keepW } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', weightGoal: 'maintain' });
    // Предпоследняя неделя тапера (нед 5): 0.585 vs 0.65 — разница видна в аксессуарах
    expect(totalSets(loseW[4])).toBeLessThan(totalSets(keepW[4]));
  });

  it('pl-режим: интенсивность основных лифтов по протоколу (95% на интенсивной неделе)', () => {
    const { weeks } = applyMacroTaperToPLWeeks(macroWeeks(), { strategy: 'balanced', mode: 'pl' });
    const intense = weeks[4]; // нед 5 — вторая неделя тапера (интенсивная 95%)
    const final = weeks[5];   // нед 6 — финальная тапера (соревновательная 100% → разминка)
    const intenseMain = intense.days[0].exercises.find(e => e.load === 'main')!;
    expect(intenseMain.workSets[0].pct).toBeCloseTo(0.95, 2);
    // Финальная протокола: только разминка (50/70/90), нет рабочих сетов на 100%
    const finalMain = final.days[0].exercises.find(e => e.load === 'main')!;
    expect(finalMain.workSets.map(ws => ws.pct)).toEqual([0.5, 0.7, 0.9]);
    expect(final.taperNote).toContain('Соревновательная');
  });
});
