/**
 * pl-date-census.test.ts — «время-бомба» ПЛ-зоны (§5-bis п.6 аудита Oct 2026).
 *
 * Три уровня стражи:
 *  1) ДВИЖКИ ПЛ (src/engines/lms, без тестов): date-only через UTC
 *     (`new Date().toISOString().slice(0,10)`) запрещён — календарную дату
 *     даёт канон `core/local-date` (в UTC+3…+12 вечером UTC-дата = «вчера»).
 *     Комментарии не считаются: иначе пояснения вида «было toISOString…»
 *     падали бы в долг самими собой.
 *  2) ТЕСТЫ ПЛ: любой «часовой» сайт (new Date() без фиксированной даты)
 *     регистрируется в реестре ниже. Новый сайт или изменившееся число
 *     роняет сборку — дат-зависимый тест добавляется осознанно.
 *  3) ПОВЕДЕНИЕ под замороженными часами (vi.setSystemTime): дефолты
 *     «сегодня» в PL-функциях берутся из локального календаря, а не UTC;
 *     ICS-раскладка от переданных дат от часов не зависит.
 *
 * Пойманный в этом раунде кейс: имя файла .ics было UTC — в вечерней зоне
 * календарь уезжал на «вчера».
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  plWeeklyCompliance, plWeeklyComplianceByDays, plSeasonIcsFilename, buildPLSeasonIcs,
} from '../pl-season-pro.engine';
import { buildLMSPlan, originalCycleWeeks } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { localIsoDate } from '../../../core/local-date';

const SRC = join(process.cwd(), 'src');
const EXT = /\.(ts|tsx)$/;
const DATE_ONLY = /\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name === 'node_modules') continue; walk(p, out); }
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

/** Комментарии гасятся С СОХРАНЕНИЕМ строк: номер в сообщении ценза = файлу. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
     .replace(/^(\s*)\/\/.*$/gm, '$1');

const rel = (p: string) => p.replace(process.cwd() + '\\', '').replace(/\//g, '\\');

describe('ценз дат: движки ПЛ без UTC date-only', () => {
  it('src/engines/lms (без тестов) — 0 ЧАСОВЫХ мест toISOString().slice(0,10)', () => {
    const files = walk(join(SRC, 'engines', 'lms'))
      .filter(f => !/[\\/]__tests__[\\/]/.test(f) && !/\.test\.(ts|tsx)$/.test(f));
    const sites: string[] = [];
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'));
      DATE_ONLY.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DATE_ONLY.exec(src)) !== null) {
        // «Часовая» бомба — дата взята из ЧАСОВ (new Date() без аргумента или
        // Date.now()). Вход-derived (`new Date(iso + 'T00:00:00Z')`) часами не
        // пользуется — это строковая арифметика календаря, она детерминирована.
        const before = src.slice(Math.max(0, m.index - 160), m.index);
        if (/new Date\(\s*\)|Date\.now\(/.test(before)) {
          sites.push(`${rel(f)}: ${hitsCount(src, m.index)}`);
        }
      }
    }
    expect(sites).toEqual([]);
  });
});

/** Номер строки для позиции в исходнике — для читаемого сообщения ценза. */
function hitsCount(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

/** Реестр «часовых» сайтов PL-тестов: относительные даты допустимы, но
 *  зарегистрированы. Фиксированные литералы (`new Date('…')`) и заморозка
 *  (`setSystemTime`) не считаются — они детерминированы. */
const PL_TEST_SITES: Record<string, number> = {
  'src\\engines\\lms\\__tests__\\pl-auto-audit-2026-10.test.ts': 1,
  'src\\engines\\lms\\__tests__\\pl-auto-audit-fixes.test.ts': 2,
  'src\\engines\\lms\\__tests__\\pl-season-pro.test.ts': 1,
  'src\\ui\\screens\\SRCBBScreen_parts\\__tests__\\pl-plan-view.test.tsx': 2,
};
const PL_TEST_CEILING = 6;

const PL_TEST_GLOBS = [
  join(SRC, 'engines', 'lms', '__tests__'),
  join(SRC, 'engines', 'pro', '__tests__'),
  join(SRC, 'ui', 'screens', 'SRCBBScreen_parts', '__tests__'),
];
const PL_TEST_NAME = /^pl-.*\.test\.tsx?$|^diary-autoreg.*\.test\.tsx?$/;

describe('ценз дат: тесты ПЛ', () => {
  it('зарегистрированные «часовые» сайты совпадают с реестром', () => {
    const found = new Map<string, number>();
    for (const dir of PL_TEST_GLOBS) {
      if (!statSync(dir, { throwIfNoEntry: false })) continue;
      for (const f of readdirSync(dir)) {
        if (!PL_TEST_NAME.test(f) || !EXT.test(f)) continue;
        const path = join(dir, f);
        const lines = readFileSync(path, 'utf8').split('\n');
        let n = 0;
        for (const line of lines) {
          if (!/new Date\(/.test(line)) continue;
          if (/new Date\('/.test(line)) continue;          // фиксированная дата
          if (/setSystemTime/.test(line)) continue;        // замороженные часы
          if (/^\s*(\/\/|\*)/.test(line)) continue;        // комментарий
          n += 1;
        }
        if (n > 0) found.set(rel(path), n);
      }
    }
    const total = [...found.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(PL_TEST_CEILING);
    expect(Object.fromEntries(found)).toMatchObject(PL_TEST_SITES);
  });
});

describe('ценз дат: поведение под замороженными часами', () => {
  afterEach(() => { vi.useRealTimers(); });

  const plan = () => buildLMSPlan({
    template: CYCLE_01, pmMap: { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 200 },
    fallbackPm: 80, weeksOverride: originalCycleWeeks(CYCLE_01), mode: 'natural',
  });

  it('«сегодня» по умолчанию — локальная дата, не UTC (23:45Z = следующий день в UTC+10)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T23:45:00Z'));
    const local = localIsoDate();
    const utc = new Date('2026-10-11T23:45:00Z').toISOString().slice(0, 10);
    // Если машина в UTC+X вечером — локальная дата заведомо следующая (UTC+10).
    if (utc !== local) {
      const res = plWeeklyCompliance(plan(), [], { currentWeek: 1 });
      // Неделя 1 без weekStart и currentWeek=1 → уже началась (missed), а не upcoming.
      expect(res.weeks.find(w => w.week === 1)!.status).toBe('missed');
      const days = plWeeklyComplianceByDays(plan(), [], { currentWeek: 1 });
      expect(days.weeks.find(w => w.week === 1)!.days.every(d => d.status === 'missed')).toBe(true);
      expect(plSeasonIcsFilename('pl-season')).toBe(`pl-season-${local}.ics`);
      expect(plSeasonIcsFilename('pl-season')).not.toBe(`pl-season-${utc}.ics`);
    } else {
      // Машина в UTC-зоне: проверяем непосредственно согласованность дефолтов.
      const res = plWeeklyCompliance(plan(), [], { currentWeek: 1 });
      expect(res.weeks.find(w => w.week === 1)!.status).toBe('missed');
      expect(plSeasonIcsFilename('pl-season')).toBe(`pl-season-${local}.ics`);
    }
  });

  it('раскладка ICS-сессий от переданных дат от часов не зависит', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const ics = buildPLSeasonIcs(plan().weeks, [], { todayIso: '2026-05-04', seasonStart: '2026-09-07', withTrainingSessions: true });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260914');
    expect(ics).not.toContain('20260101');
  });
});
