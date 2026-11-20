/**
 * lab-storage-code-single-spelling.test.ts — проход 179: одно написание кода в складе.
 *
 * Чтение анализа терпимо к написанию (ucumInfo, canonicalLabValues, алиасы
 * `findLabPoint`), а запись была нетерпимой: ручной ввод писал `HBA1C`, OCR —
 * `HbA1c`, парсер — `CKMB`, каталог спрашивает `CK_MB`. Один анализ ложился
 * двумя записями, и история/тренд/«просрочен» видели половину точек.
 *
 * Гард держит две стороны:
 *  - правило: `labStorageCode` берёт ЕДИНСТВЕННУЮ таблицу имён (`mapToUcumCode`),
 *    идемпотентен и не теряет неизвестный код;
 *  - границу: все четыре пути записи в `db.ts` проходят через него — новый
 *    вызывающий не может записать второе написание мимо правила.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { labStorageCode } from '../lab-storage-code';
import { mapToUcumCode } from '../labs-mapping';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('проход 179: код склада пишется одним написанием', () => {
  it('известные двойники сводятся к ключу каталога', () => {
    const cases: Array<[string, string]> = [
      ['HBA1C', 'HbA1c'],
      ['hba1c', 'HbA1c'],
      ['HbA1c', 'HbA1c'],
      ['CKMB', 'CK_MB'],
      ['CK_MB', 'CK_MB'],
      ['URIC', 'UA'],
      ['URIC_ACID', 'UA'],
      ['FOLATE', 'FOL'],
      ['B9', 'FOL'],
      ['INSULIN', 'INS'],
      ['PTH', 'PARATHYROID'],
      ['GLUCOSE', 'GLU'],
      ['POTASSIUM', 'K'],
    ];
    for (const [input, expected] of cases) {
      expect(labStorageCode(input), input).toBe(expected);
    }
  });

  it('то же правило, что у чтения: результат mapToUcumCode', () => {
    for (const code of ['ALT', 'HGB', 'CRP', 'FT3', 'T3', 'E2', 'HbA1c', 'URIC_ACID', 'ZZZ']) {
      expect(labStorageCode(code), code).toBe(mapToUcumCode(code));
    }
  });

  it('идемпотентен: дважды записанный код не меняется', () => {
    for (const code of ['HBA1C', 'CKMB', 'URIC_ACID', 'FOLATE', 'ALT', 'ZZZ']) {
      const once = labStorageCode(code);
      expect(labStorageCode(once), code).toBe(once);
    }
  });

  it('неизвестный код не выбрасывается и не подменяется, края обрезаются', () => {
    expect(labStorageCode('  KIM1_x ')).toBe('KIM1_x');
    // Известный каталогу код получает его написание (KIM-1 хранится как KIM1).
    expect(labStorageCode('Kim1')).toBe('KIM1');
    expect(labStorageCode('Zzz_marker')).toBe('Zzz_marker');
    expect(labStorageCode('')).toBe('');
    expect(labStorageCode(null)).toBe('');
    expect(labStorageCode(undefined)).toBe('');
  });

  it('своей таблицы имён в модуле нет — только вызов общего правила', () => {
    const src = read('src/core/lab-storage-code.ts');
    expect(src).toContain("import { mapToUcumCode } from './labs-mapping'");
    expect(src).toContain('return mapToUcumCode(raw)');
    // Ни одной пары «алиас → код»: вторая таблица разошлась бы с первой.
    expect(src).not.toContain("'CK_MB'");
    expect(src).not.toContain("'HbA1c'");
    expect(src).not.toContain('CODE_ALIAS');
  });

  it('все пути записи в db.ts проходят через правило (4 пути, ни одного в обход)', () => {
    const src = read('src/core/db.ts');
    // writeSpaceStores и putSpaceRecords — восстановление и синхронизация.
    expect(src.match(/os\.put\(withStorageLabCode\(s, rec\)\)/g)).toHaveLength(2);
    // db.put — обычная запись.
    expect(src).toContain('put(withStorageLabCode(store, data))');
    // db.update — слияние существующей записи с правкой.
    expect(src).toContain('os.put(withStorageLabCode(store, { ...existing, ...data }))');
    // Обхода нет: прежние прямые записи удалены.
    expect(src).not.toContain('os.put(rec)');
    expect(src).not.toContain('.put(data)');
  });
});
