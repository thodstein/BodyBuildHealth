/**
 * bb-ui-prep-contours.test.ts — аудит UI (P2): два prep-контура пишут в одно хранилище.
 *
 * Контур 1 — годовой план: `contest_prep`-блок со своей датой шоу и макроцикл со списком
 * стартов. Контур 2 — prep-панель ББ-авто (`prepShowDate`, `prepCompetitions`). Было:
 * синк шёл только в UI-state (prep-план оставался со старой датой), старты макроцикла в
 * prep-панель не доезжали вовсе, а ручную дату синк перетирал через 7 дней. Здесь —
 * чистые правила синка (старты макроцикла → prep, дата блока → prep с курсором) и
 * source-guard на то, что конструктор ими пользуется.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ANNUAL_SHOWDATE_CURSOR_KEY,
  annualShowDateDecision,
  prepSeedFromMacrocycle,
  showDateFromCompetitions,
} from '../bb-auto-constructor-shared';

describe('prepSeedFromMacrocycle — старты годового макроцикла → prep-контур', () => {
  it('переносит старты с датами и приоритетами, сохраняя id', () => {
    const seed = prepSeedFromMacrocycle({
      competitions: [
        { id: 'c1', name: 'Первенство области', date: '2026-09-01', priority: 'A' },
        { id: 'c2', name: 'Кубок', date: '2026-06-01', priority: 'B' },
      ],
    });
    expect(seed.competitions).toEqual([
      { id: 'c1', name: 'Первенство области', date: '2026-09-01', priority: 'A' },
      { id: 'c2', name: 'Кубок', date: '2026-06-01', priority: 'B' },
    ]);
    // Дата шоу — главный старт (A), даже если по календарю он позже контрольного.
    expect(seed.showDate).toBe('2026-09-01');
  });

  it('без старта A берёт самый ранний датированный', () => {
    const seed = prepSeedFromMacrocycle({
      competitions: [
        { id: 'c1', name: 'Кубок', date: '2026-07-01', priority: 'B' },
        { id: 'c2', name: 'Тренировочный', date: '2026-05-01' },
      ],
    });
    expect(seed.showDate).toBe('2026-05-01');
    // Приоритет не выдумывается.
    expect(seed.competitions[1].priority).toBeUndefined();
  });

  it('старт без даты остаётся стартом, но не задаёт дату шоу', () => {
    const seed = prepSeedFromMacrocycle({
      competitions: [{ id: 'c1', name: 'Старт без даты' }],
    });
    expect(seed.competitions).toHaveLength(1);
    expect(seed.competitions[0].date).toBeUndefined();
    expect(seed.showDate).toBeUndefined();
  });

  it('пустые записи и мусорные даты отбрасываются, id генерируется', () => {
    const seed = prepSeedFromMacrocycle({
      competitions: [
        null as any,
        {} as any,
        { name: '   ' } as any,
        { name: 'Кубок', date: '01.09.2026' },   // не ISO — дату не берём
        { name: '', date: '2026-09-09' },        // имени нет, но дата есть — старт существует
      ],
    });
    expect(seed.competitions).toHaveLength(2);
    expect(seed.competitions[0]).toMatchObject({ id: 'comp_4', name: 'Кубок' });
    expect(seed.competitions[0].date).toBeUndefined();
    expect(seed.competitions[1]).toMatchObject({ id: 'comp_5', name: 'Старт 5', date: '2026-09-09' });
    expect(seed.showDate).toBe('2026-09-09');
  });

  it('нет макроцикла/стартов — пусто, а не выдуманный старт', () => {
    expect(prepSeedFromMacrocycle(null)).toEqual({ competitions: [], showDate: undefined });
    expect(prepSeedFromMacrocycle({})).toEqual({ competitions: [], showDate: undefined });
    expect(prepSeedFromMacrocycle({ competitions: [] }).competitions).toEqual([]);
  });

  it('showDateFromCompetitions игнорирует невалидные даты', () => {
    expect(showDateFromCompetitions(undefined)).toBeUndefined();
    expect(showDateFromCompetitions([])).toBeUndefined();
    expect(showDateFromCompetitions([
      { id: 'a', name: 'A', date: 'вчера', priority: 'A' },
      { id: 'b', name: 'B', date: '2026-08-08', priority: 'C' },
    ])).toBe('2026-08-08');
  });
});

describe('annualShowDateDecision — дата шоу из годового блока в prep', () => {
  it('без даты в блоке или с мусором — решения нет', () => {
    expect(annualShowDateDecision({ blockShowDate: undefined, lastSyncedShowDate: '2026-09-01' })).toBeNull();
    expect(annualShowDateDecision({ blockShowDate: '', lastSyncedShowDate: '2026-09-01' })).toBeNull();
    expect(annualShowDateDecision({ blockShowDate: '01.09.2026', lastSyncedShowDate: '2026-09-01' })).toBeNull();
  });

  it('первое наблюдение только запоминается — настроенную дату не перетираем', () => {
    // Курсора нет: неизвестно, новее ли блок или ручная правка, поэтому ничего не меняем.
    expect(annualShowDateDecision({ blockShowDate: '2026-09-01', currentShowDate: '2026-10-01' }))
      .toEqual({ date: '2026-09-01', action: 'adopt' });
  });

  it('уже применённую дату повторно не применяет', () => {
    expect(annualShowDateDecision({
      blockShowDate: '2026-09-01',
      lastSyncedShowDate: '2026-09-01',
      currentShowDate: '2026-09-01',
    })).toBeNull();
  });

  it('дата уже совпадает с планом — только курсор', () => {
    expect(annualShowDateDecision({
      blockShowDate: '2026-09-01',
      lastSyncedShowDate: '2026-06-01',
      currentShowDate: '2026-09-01',
    })).toEqual({ date: '2026-09-01', action: 'adopt' });
  });

  it('новая дата в блоке применяется один раз (и не задевает ручную правку, пока блок не изменят)', () => {
    expect(annualShowDateDecision({
      blockShowDate: '2026-09-01',
      lastSyncedShowDate: '2026-06-01',
      currentShowDate: '2026-08-20', // ручная правка в prep
    })).toEqual({ date: '2026-09-01', action: 'apply' });
    // После применения курсор сдвинулся — повторно не применяется, ручная дата живёт.
    expect(annualShowDateDecision({
      blockShowDate: '2026-09-01',
      lastSyncedShowDate: '2026-09-01',
      currentShowDate: '2026-10-10',
    })).toBeNull();
  });
});

describe('BbAutoConstructor использует правила синка контуров (source-guard)', () => {
  const src = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');

  it('дата блока применяется к prep-плану через курсор, а не «на 7 дней»', () => {
    expect(src).toContain('annualShowDateDecision({');
    expect(src).toContain('ANNUAL_SHOWDATE_CURSOR_KEY');
    expect(src).not.toContain('he_contest_manual_date');
    expect(src).toContain('applyPrepShowDate(decision.date)');
  });

  it('старты макроцикла доезжают до prep-контура при применении цикла', () => {
    expect(src).toContain('prepSeedFromMacrocycle(source as BBMacrocycle)');
    expect(src).toContain('setPrepCompetitions(seed.competitions)');
  });
});
