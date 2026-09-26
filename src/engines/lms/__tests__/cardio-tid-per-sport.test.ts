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
    // бакет самодостаточен: хранит эталон, которым реально посчитан
    expect(r.bySport.find(x => x.sport === 'bike')?.ref.lthr).toBe(150);
    expect(r.bySport.find(x => x.sport === 'run')?.ref.lthr).toBe(170); // общий фолбэк
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

  /**
   * Регресс-лок (аудит спринта 5.2): при ОДНОЙ реальной дисциплине legacy-<other>
   * минуты — это реальный объём, он обязан попасть в заголовок TID. Раньше fact
   * брался из бакета только этой дисциплины, и «недовыполнено» показывалось
   * пользователю, хотя объём был (тихое занижение факта).
   */
  it('legacy-минуты учтены в заголовке TID, а не выброшены', () => {
    const r = tidPlanVsFact(
      cycle(),
      [s({ sport: 'run', durationMin: 30 }), s({ sport: undefined, durationMin: 20 })],
      { lthr: 170 },
    );
    expect(r.mixed).toBe(false);
    expect(r.fact.totalMin).toBe(50);   // 30 бег + 20 legacy
    expect(r.fact.byHr).toBe(2);        // обе сессии с HR посчитаны
    expect(r.bySport).toHaveLength(2);  // разбивка по-прежнему показывает оба бакета
    expect(r.comparable).toBe(true);
  });

  /**
   * Смешанный лог: усреднять зоны разных калибровок бессмысленно — берём ОДИН бакет.
   * Какой именно (run или bike) — детерминированный tie-break, поэтому проверяем
   * инвариант «взят один бакет, НЕ сумма», а не конкретную дисциплину.
   */
  it('смешанный лог: в заголовок идёт ТОЛЬКО один бакет, а не сумма', () => {
    const r = tidPlanVsFact(
      cycle(),
      [s({ sport: 'run', durationMin: 30 }), s({ sport: 'bike', durationMin: 45 })],
      { lthr: 170 },
    );
    expect(r.mixed).toBe(true);
    expect([30, 45]).toContain(r.fact.totalMin); // ровно один бакет
    expect(r.fact.totalMin).not.toBe(75);          // не сумма разных калибровок
    expect(r.bySport.reduce((a, b) => a + b.fact.totalMin, 0)).toBe(75); // разбивка полна
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
