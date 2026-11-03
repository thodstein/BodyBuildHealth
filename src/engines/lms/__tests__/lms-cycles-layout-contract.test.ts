/**
 * lms-cycles-layout-contract.test.ts — СТРАЖ раскладок `LMS_CYCLES` (Фаза 5 аудита PL-auto).
 *
 * Зачем: раскладки циклов (порядок упражнений, %ПМ, повторы, подходы) — данные,
 * на которых держатся все расчёты PL-авто. Их случайная/«попутная» правка меняет
 * планы у пользователей и ломает инварианты (соглашение: раскладки не меняются
 * без отдельного согласования, §7 плана аудита).
 *
 * Тест фиксирует отпечаток (FNV-1a по канонической строке) всех циклов.
 * Если изменение СОЗНАТЕЛЬНОЕ — обновите `EXPECTED_FINGERPRINT` отдельным коммитом
 * с обоснованием (в сообщении видно cycles/weeks/days/exercises/sets — для ревью).
 */
import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRDaySpec, SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const EXPECTED_FINGERPRINT = 'cb40f90c';

/**
 * Отпечаток РАСКЛАДКИ БЕЗ ПОЛЯ `group`: имя, коэф., МНОСЗ, нагрузка и подходы.
 *
 * Зачем второй отпечаток: `group` — это метаданные для подсчёта объёма, а не
 * структура тренировки. Долг данных мы закрываем, заполняя `group` у стандартных
 * упражнений, и этот отпечаток доказывает, что вместе с меткой не уехали ни
 * порядок упражнений, ни проценты, ни подходы. Меняться он не должен НИКОГДА
 * без отдельного согласования раскладок.
 */
const EXPECTED_LAYOUT_ONLY = '75827fb0';

/**
 * Легаси-долг данных (сокращён аудитом PL-auto 2026-11: 952 → 190).
 * Осталось только то, у чего в таксономии приложения (`chest/back/legs/
 * shoulders/arms/core`) нет честной группы: кистевые и армреслинг-движения.
 * Придумывать им группу «Руки» было бы враньём — там нет ни бицепса, ни трицепса.
 */
const KNOWN_EMPTY_GROUPS = 190;

/** Разрешённые упражнения без `group` — ровно этот список, без «плюс-минус». */
const KNOWN_EMPTY_NAMES = [
  'Боковой нажим',
  'Иммитация верха',
  'Кисть РР',
  'Кисть стоя',
  'Отведение СБ',
  'Приведение к плечу',
  'Пронация СБ',
  'Сгибание кисти стоя',
  'Сгибание обратным хватом',
];

function layoutsOf(c: SRCycleTemplate): SRDaySpec[][] {
  return c.weeks && c.weeks.length > 0 ? c.weeks : [c.week1];
}

interface Fingerprint {
  hash: string;
  cycles: number;
  weeks: number;
  days: number;
  exercises: number;
  sets: number;
}

function fnv(parts: string[]): string {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function fingerprint(opts: { withGroup?: boolean } = {}): Fingerprint {
  const withGroup = opts.withGroup !== false;
  const parts: string[] = [];
  let weeks = 0, days = 0, exercises = 0, sets = 0;
  // Порядок в массиве не должен влиять на отпечаток (каталог сортируется по id).
  const cycles = [...LMS_CYCLES].sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  for (const c of cycles) {
    parts.push(`C:${c.meta.id}:${c.meta.weeks}:${c.meta.sessionsPerWeek}:${c.meta.correctionPct}`);
    const layouts = layoutsOf(c);
    weeks += layouts.length;
    layouts.forEach((layout, wi) => {
      parts.push(`W${wi}:${layout.length}`);
      days++;
      layout.forEach((day, di) => {
        parts.push(`D${di}:${day.exercises.length}`);
        for (const ex of day.exercises) {
          exercises++;
          parts.push(withGroup
            ? `E:${ex.name}:${ex.group}:${ex.coef}:${ex.mnosz}:${ex.load ?? ''}`
            : `E:${ex.name}:${ex.coef}:${ex.mnosz}:${ex.load ?? ''}`);
          for (const s of ex.sets ?? []) {
            sets++;
            parts.push(`S:${s.pct}:${s.reps}:${s.sets}:${s.rir ?? ''}`);
          }
        }
      });
    });
  }
  return { hash: fnv(parts), cycles: cycles.length, weeks, days, exercises, sets };
}

describe('LMS_CYCLES — контракт раскладок (стража Фазы 5)', () => {
  it('раскладки не изменились: отпечаток id/недель/дней/упражнений/подходов', () => {
    const fp = fingerprint();
    expect(
      fp.hash,
      `Отпечаток раскладок изменился (cycles=${fp.cycles} weeks=${fp.weeks} days=${fp.days} exercises=${fp.exercises} sets=${fp.sets}). ` +
      'Если правка раскладки сознательная — обновите EXPECTED_FINGERPRINT и опишите причину в коммите.',
    ).toBe(EXPECTED_FINGERPRINT);
  });

  it('раскладка БЕЗ поля group не менялась (заполнение group — только метаданные)', () => {
    const fp = fingerprint({ withGroup: false });
    expect(
      fp.hash,
      `Изменилась структура раскладки (порядок/коэф./МНОСЗ/проценты/подходы), а не только group. ` +
      `exercises=${fp.exercises} sets=${fp.sets}. Это ломает планы у пользователей — откатите.`,
    ).toBe(EXPECTED_LAYOUT_ONLY);
  });

  it('инварианты каталога: уникальные id, непустые недели/дни/упражнения/подходы', () => {
    const ids = LMS_CYCLES.map(c => c.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    let emptyGroups = 0;
    const emptyNames = new Set<string>();
    for (const c of LMS_CYCLES) {
      const layouts = layoutsOf(c);
      expect(layouts.length, c.meta.id).toBeGreaterThan(0);
      for (const layout of layouts) {
        expect(layout.length, c.meta.id).toBeGreaterThan(0);
        for (const day of layout) {
          expect(day.exercises.length, c.meta.id).toBeGreaterThan(0);
          for (const ex of day.exercises) {
            expect(ex.name.trim().length, `${c.meta.id}: пустое имя упражнения`).toBeGreaterThan(0);
            if (!ex.group.trim()) { emptyGroups++; emptyNames.add(ex.name); }
            expect((ex.sets ?? []).length, `${c.meta.id}/${ex.name}: нет подходов`).toBeGreaterThan(0);
            for (const s of ex.sets ?? []) {
              expect(s.sets, `${c.meta.id}/${ex.name}: sets<=0`).toBeGreaterThan(0);
              expect(s.reps, `${c.meta.id}/${ex.name}: reps<=0`).toBeGreaterThan(0);
              expect(s.pct, `${c.meta.id}/${ex.name}: pct<=0`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
    expect(
      emptyGroups,
      'Упражнения без `group` не попадают в volume-landmarks (exEnGroup("") → undefined). ' +
      'Выросло — новый пустой group: исправьте данные цикла. Уменьшилось — уменьшите KNOWN_EMPTY_GROUPS.',
    ).toBe(KNOWN_EMPTY_GROUPS);
    // Список пустых имён — тоже контракт: новое имя без группы означает либо
    // забытое стандартное упражнение (долг обязан уменьшаться), либо новую
    // армреслинг-специфику (тогда расширяйте список осознанно, а не «как вышло»).
    expect([...emptyNames].sort(), 'Набор упражнений без group расширился — это долг, а не норма').toEqual(KNOWN_EMPTY_NAMES);
  });
});
