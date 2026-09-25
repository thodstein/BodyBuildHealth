/**
 * cardio-date-guard.test.ts — TZ-независимый страж класса «UTC-парс локальной даты».
 *
 * P1-аудит: в кардио-зоне было 6+ самописных копий арифметики дат. Ключевой
 * дефект — `new Date(iso)` для 10-символьной ISO-даты: JS парсит её как UTC,
 * а `getDay()/getDate()/setHours()` читают локально. На машинах с отрицательным
 * смещением результат уезжает на сутки назад (сетка календаря, якорь недели,
 * окно ACWR, счётчик дней соревнований).
 *
 * Поведенческий тест на этой машине (UTC+10) такой баг НЕ воспроизводит,
 * поэтому страж структурный: в кардио-файлах запрещены
 *   1) собственный парсер 10-символьной даты (`new Date(iso + 'T00:00:00')`),
 *   2) UTC-парс локальной даты (`new Date(<переменная>)` + локальные геттеры),
 * а канон cardio-date-utils — единственный источник.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

/** Рекурсивно собрать .ts/.tsx (без тестов). */
function collect(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const CARDIO_FILES = [
  ...collect(join(ROOT, 'engines/lms')).filter(f => /cardio[^/\\]*\.ts$/.test(f)),
  ...collect(join(ROOT, 'engines')).filter(f => /^src[\\/]engines[\\/]cardio/.test(f.replace(/\//g, '\\'))),
  ...collect(join(ROOT, 'ui/screens/TrainingScreen_parts')).filter(f => /Cardio.*\.tsx$/.test(f)),
];

const read = (f: string) => readFileSync(f, 'utf8');

/** Строки с `new Date(x)`, где x — переменная (не конструктор с аргументами). */
function bareNewDateLines(src: string): string[] {
  const out: string[] = [];
  src.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/new Date\(([A-Za-z_$][\w$.]*)\)/);
    if (m) out.push(`${i + 1}: ${line.trim()}`);
  });
  return out;
}

describe('cardio-date-guard: единый канон локальных дат', () => {
  it('кандидатов в зоне достаточно для осмысленной проверки', () => {
    expect(CARDIO_FILES.length).toBeGreaterThan(10);
  });

  it('канон cardio-date-utils — единственный источник парсинга 10-символьной даты', () => {
    const offenders: string[] = [];
    for (const f of CARDIO_FILES) {
      if (f.endsWith('cardio-date-utils.engine.ts')) continue;
      const src = read(f);
      src.split(/\r?\n/).forEach((line, i) => {
        // Собственный локальный парсер даты = дублирование канона.
        if (/new Date\([^)]*\.length === 10 \?/.test(line)) {
          offenders.push(`${f}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders, `дубликаты парсера даты:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('НЕТ опасной формы: new Date(дата) + локальные геттеры/сеттеры дня', () => {
    // `new Date(iso)` парсит дату как UTC, а getDay()/getDate()/setHours() — локально.
    // Именно эта связка давала «уезд сетки на колонку» в календаре и якорь недели.
    const offenders: string[] = [];
    for (const f of CARDIO_FILES) {
      if (f.endsWith('cardio-date-utils.engine.ts')) continue;
      read(f).split(/\r?\n/).forEach((line, i) => {
        if (!/new Date\([A-Za-z_$][\w$.]*\)/.test(line)) return;
        if (/getDay\(\)|getDate\(\)|setDate\(|setHours\(|setMonth\(|setFullYear\(/.test(line)) {
          offenders.push(`${f}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders, `UTC-парс + локальные геттеры:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('в каноне есть нужные примитивы (weekday/local-midnight/parse)', () => {    const src = read(join(ROOT, 'engines/lms/cardio-date-utils.engine.ts'));
    for (const fn of ['toLocalIso', 'parseLocalIso', 'addDaysIso', 'todayLocalIso', 'weekStartIso', 'dayOfWeekIso', 'weekdayMon0Iso', 'localMidnight']) {
      expect(src, `в каноне нет ${fn}`).toContain(`export function ${fn}`);
    }
  });

  it('физиология/дневник/календарь берут даты из канона, а не парсят сами', () => {
    const targets = [
      join(ROOT, 'engines/lms/cardio-physiology.engine.ts'),
      join(ROOT, 'engines/lms/cardio-diary.engine.ts'),
      join(ROOT, 'ui/screens/TrainingScreen_parts/CardioCalendar.tsx'),
      join(ROOT, 'ui/screens/TrainingScreen_parts/CardioCompsStep.tsx'),
    ];
    for (const f of targets) {
      const src = read(f);
      expect(src, `${f} не импортирует канон дат`).toMatch(/from '[^']*cardio-date-utils\.engine'/);
    }
  });

  it('дневник кардио НЕ тянет IndexedDB: канон хранения один (localStorage + cloud-kv)', () => {
    // Регресс-барьер: возврат write-only IDB-зеркала тянул `core/db` в граф
    // модулей дневника (цикл резолвера vite-node) и расходило два хранилища.
    const src = read(join(ROOT, 'engines/lms/cardio-diary.engine.ts'));
    // Проверяем КОД, а не текст: докблок объясняет, почему зеркала нет.
    const code = src.split(/\r?\n/).filter(l => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    expect(code).not.toMatch(/from '[^']*core\/db'/);
    expect(code).not.toMatch(/await import\(/);
    expect(code).not.toContain('CARDIO_IDB_STORE');
    expect(code).not.toContain('loadCardioLogAsync');
    expect(code).not.toContain('saveCardioLogEntryAsync');
    expect(code).not.toContain('clearCardioLogAsync');
    // и в UI никто не зовёт миграцию
    const panelCode = read(join(ROOT, 'ui/screens/TrainingScreen_parts/CardioDiaryPanel.tsx'))
      .split(/\r?\n/).filter(l => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    expect(panelCode).not.toContain('migrateCardioLogToIdb');
  });

  it('ИНФОРМАЦИОННО: перечень остаточных new Date(x) в зоне (для ревью)', () => {
    const report: string[] = [];
    for (const f of CARDIO_FILES) {
      const lines = bareNewDateLines(read(f));
      if (lines.length > 0) report.push(`${f} → ${lines.length}: ${lines[0]}`);
    }
    // Ожидание: список конечен и мал. При росте — новые копии арифметики дат.
    expect(report.length).toBeLessThanOrEqual(14);
    // eslint-disable-next-line no-console
    if (process.env.CARDIO_DATE_REPORT) console.log('[cardio-date-guard]\n' + report.join('\n'));
  });
});
