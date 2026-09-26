/**
 * cardio-tid-per-sport.test.ts — пер-спортная калибровка TID (спринт 5.2, добивка).
 *
 * Проблема: смешанный дневник (бег + вело) признавался «несравнимым», и время
 * по зонам терялось совсем — пользователь не получал НИЧЕГО. Плюс у бега и вела
 * РАЗНЫЕ пульсы (свой LTHR), поэтому один эталон на обе дисциплины неверен.
 *
 * Решение (без выдуманных порогов): границы зон те же (LTHR / %ЧССмакс),
 * но эталон можно задать ПО ДИСЦИПЛИНЕ, а факт всегда разбирается по дисциплинам.
 */
import { describe, expect, it } from 'vitest';
import { tidPlanVsFact, tidFactBySport, type FactSession } from '../cardio-tid.engine';
import { buildCardioCycle } from '../cardio.engine';

const cycle = () => buildCardioCycle({ goal: 'health', totalWeeks: 6, id: 'tid-sport' });

const s = (over: Partial<FactSession> = {}): FactSession => ({
  date: '2026-09-20', type: 'zone2', durationMin: 30, completed: true, avgHr: 140, ...over,
});

describe('Разбивка факта по дисциплинам', () => {
  it('смешанный лог даёт разбивку, а не пустоту', () => {
    const r = tidPlanVsFact(cycle(), [s({ sport: 'run' }), s({ sport: 'bike' })], { lthr: 170 });
    expect(r.mixed).toBe(true);
    expect(r.bySport).toHaveLength(2);
    expect(r.bySport.map(x => x.sport).sort()).toEqual(['bike', 'run']);
    // время по зонам по каждой дисциплине — достоверный факт
    for (const b of r.bySport) expect(b.fact.totalMin).toBe(30);
  });

  it('legacy-записи без дисциплины идут в «other» и не ломают порядок', () => {
    const r = tidPlanVsFact(cycle(), [s({ sport: 'run' }), s({ sport: undefined })], { lthr: 170 });
    expect(r.bySport).toHaveLength(2);
    expect(r.bySport[r.bySport.length - 1].sport).toBe('other');
  });

  it('без эталонов все спорты помечены ownRef=false', () => {
    const rows = tidFactBySport([s({ sport: 'run' }), s({ sport: 'bike' })], {}, { lthr: 170 });
    expect(rows.every(r => r.ownRef === false)).toBe(true);
  });
});

describe('Эталон HR по дисциплине снимает блокировку смешанного лога', () => {
  it('без пер-спортного эталона — честный отказ (как раньше)', () => {
    const r = tidPlanVsFact(cycle(), [s({ sport: 'run' }), s({ sport: 'bike' })], { lthr: 170 });
    expect(r.comparable).toBe(true);
    expect(r.verdict).toMatch(/смешаны дисциплины/);
    expect(r.verdict).toMatch(/Разбивка по дисциплинам/);
    expect(r.hasPerSportRef).toBe(false);
  });

  it('с эталоном для вела — сравнение по велу разрешено и названа дисциплина', () => {
    // LTHR вела ниже бегового: 150. При avgHr 140 → 93% → Z2 (<89? нет, 93 ≥ 89 → Z3)
    const r = tidPlanVsFact(
      cycle(),
      [s({ sport: 'run', avgHr: 150 }), s({ sport: 'bike', avgHr: 130 })],
      { lthr: 170 },
      { bike: { lthr: 150 } },
    );
    expect(r.hasPerSportRef).toBe(true);
    expect(r.verdict).not.toMatch(/смешаны дисциплины/);
    // факт считается по велу (у него свой эталон)
    expect(r.fact.basis).toBe('lthr');
    expect(r.bySport.find(x => x.sport === 'bike')?.ownRef).toBe(true);
    expect(r.bySport.find(x => x.sport === 'run')?.ownRef).toBe(false);
  });

  it('эталон применяется к СВОЕЙ дисциплине: bike Z2 там, где run дал бы Z3', () => {
    const hr = 140;
    const run = tidFactBySport([s({ sport: 'run', avgHr: hr })], { run: { lthr: 170 } }, { lthr: 170 })[0];
    const bike = tidFactBySport([s({ sport: 'bike', avgHr: hr })], { bike: { lthr: 150 } }, { lthr: 150 })[0];
    // 140/170 = 82% → Z2 ; 140/150 = 93% → Z3 — одна и та же ЧСС, разные зоны
    expect(run.fact.z2Min).toBe(30);
    expect(bike.fact.z3Min).toBe(30);
  });

  it('одна реальная дисциплина + legacy — сравнение разрешено (не mixed)', () => {
    const r = tidPlanVsFact(cycle(), [s({ sport: 'run' }), s({ sport: undefined })], { lthr: 170 });
    expect(r.mixed).toBe(false);
    expect(r.verdict).not.toMatch(/смешаны дисциплины/);
  });
});

describe('Обратная совместимость (старый вызов без refsBySport)', () => {
  it('3 аргумента работают как раньше: факт по всем сессиям', () => {
    const r = tidPlanVsFact(cycle(), [s({ sport: 'run' }), s({ sport: 'run', date: '2026-09-21' })], { lthr: 170 });
    expect(r.fact.byHr).toBe(2);
    expect(r.fact.totalMin).toBe(60);
    expect(r.bySport).toHaveLength(1);
  });

  it('пустой лог — по-прежнему «сверка невозможна», bySport пуст', () => {
    const r = tidPlanVsFact(cycle(), [], { lthr: 170 });
    expect(r.comparable).toBe(false);
    expect(r.bySport).toHaveLength(0);
    expect(r.verdict).toMatch(/Сверка невозможна/);
  });
});
