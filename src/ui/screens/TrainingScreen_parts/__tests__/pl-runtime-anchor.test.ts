import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Якорь плана: любая отправка плана в выполнение (`he_pl_runtime`) обязана
 * записать `startDate` — локальную календарную дату (YYYY-MM-DD). День плана N
 * считается N-м тренировочным днём от этой даты.
 *
 * Источник якоря зависит от продюсера:
 *  - `BbAutoConstructor` — выбранная в конструкторе дата старта мезоцикла
 *    (`planAnchorIso()` = `startDateInput` или «сегодня»): от неё же считаются
 *    недели, ICS и печать, иначе план недель расходится с плеером;
 *  - `SRCBBScreen` — `anchorForWrite(readPlRuntime(), playerDays)`: экран
 *    зеркалит план при каждом монтировании, и безусловный «сегодня» сдвигал
 *    старт уже отправленного плана;
 *  - `ProgramEditorView`, `PLPlanView` — момент отправки (`localIsoDate()`).
 *
 * Проверяем статически (исходники, а не рантайм): у каждой записи рядом есть
 * `startDate:` с ожидаемым выражением. Поведение `anchorForWrite` проверяется
 * отдельно — `src/core/__tests__/pl-runtime-events.test.ts`.
 */

type Producer = {
  file: string;
  /** Точное выражение после `startDate:` у каждой записи. */
  expr: string;
  /** Сколько записей he_pl_runtime в файле. */
  writes: number;
  /** Имя, которое обязано быть импортировано в файл (источник даты). */
  importName: string;
};

const PRODUCERS: Producer[] = [
  {
    file: 'src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx',
    expr: 'planAnchorIso()',
    writes: 2,
    importName: 'localIsoDate',
  },
  {
    file: 'src/ui/screens/TrainingScreen_parts/ProgramEditorView.tsx',
    expr: 'localIsoDate()',
    writes: 2,
    importName: 'localIsoDate',
  },
  {
    file: 'src/ui/screens/SRCBBScreen.tsx',
    expr: 'anchorForWrite(readPlRuntime(), playerDays)',
    writes: 1,
    importName: 'anchorForWrite',
  },
  {
    file: 'src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx',
    expr: 'localIsoDate()',
    writes: 1,
    importName: 'localIsoDate',
  },
];

/** Запись плана в хранилище; перенос строки между аргументами допускается. */
const WRITE_RE = /localStorage\.setItem\(\s*'he_pl_runtime'/g;

describe('he_pl_runtime — якорь startDate у всех продюсеров', () => {
  for (const producer of PRODUCERS) {
    const name = producer.file.split('/').pop() as string;
    const src = readFileSync(producer.file, 'utf8');

    describe(name, () => {
      it('каждая запись he_pl_runtime пишет startDate', () => {
        const matches = [...src.matchAll(WRITE_RE)];
        expect(matches.length).toBe(producer.writes);
        for (const match of matches) {
          // До следующей записи (а не по фиксированному окну): объект записи в
          // `SRCBBScreen` длиннее 400 символов, и окно обрезало `startDate`.
          const nextWrite = src.indexOf('localStorage.setItem(', (match.index as number) + 1);
          const tail = src.slice(match.index, nextWrite === -1 ? undefined : nextWrite);
          expect(tail).toMatch(/startDate\s*:/);
        }
      });

      it(`startDate пишется как ${producer.expr}`, () => {
        const uses = src.match(new RegExp(`startDate: ${escapeRe(producer.expr)}`, 'g')) || [];
        expect(uses.length).toBe(producer.writes);
      });

      it(`источник даты (${producer.importName}) импортирован в этот файл`, () => {
        expect(src).toMatch(new RegExp(`import[^;]*\\b${producer.importName}\\b[^;]*from`));
      });
    });
  }

  it('конструктор берёт якорь из даты старта мезоцикла, а не из момента клика', () => {
    const src = readFileSync('src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx', 'utf8');
    // Хелпер обязан читать startDateInput и падать на «сегодня» только как fallback.
    const helper = src.match(/const planAnchorIso = \(\): string =>[^;]+;/);
    expect(helper?.[0]).toMatch(/startDateInput/);
    expect(helper?.[0]).toMatch(/localIsoDate\(\)/);
  });

  it('зеркальная запись SRCBBScreen сохраняет якорь, а не перештамповывает его', () => {
    const src = readFileSync('src/ui/screens/SRCBBScreen.tsx', 'utf8');
    expect(src).toContain('anchorForWrite(readPlRuntime(), playerDays)');
    // Безусловного «сегодня» в этой записи быть не должно.
    expect(src).not.toMatch(/startDate: isoToday\(\),/);
  });
});

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
