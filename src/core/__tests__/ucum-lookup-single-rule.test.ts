/**
 * ucum-lookup-single-rule.test.ts — проход 174: запись каталога анализов ищется
 * ОДНИМ правилом (`ucumInfo`/`ucumKey` из `core/constants`).
 *
 * Каталог `UCUM_MAP` держит коды в основном ВЕРХНИМИ, но часть намеренно
 * смешанная — `HbA1c` (так печатают бланки и так записаны синонимы). Пока
 * каждый файл искал запись сам, правило приходилось повторять в трёх-четырёх
 * вариантах регистра, и каждый новый такой перебор забывал один из вариантов:
 * анализ с кодом `HBA1C` оставался без нормы, без имени и без единицы `%`,
 * а на экране выглядел как «нет нормы» (или, хуже, «норма» без проверки).
 *
 * Гард держит два контракта:
 *  1) `ucumInfo` находит запись в любом регистре и в любой форме кода;
 *  2) перебор регистров у `UCUM_MAP` в исходниках не возвращается: если кому-то
 *     снова нужна запись, он зовёт `ucumInfo`, а не собирает свой вариант.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UCUM_MAP, ucumInfo, ucumKey } from '../constants';
import { mapToUcumCode, resolveLabMarker } from '../labs-mapping';
import { getLabNorm } from '../../engines/lab-norms.engine';
import { normalizeLab } from '../../engines/labs.engine';

const SRC = join(process.cwd(), 'src');
const EXT = /\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p, out);
    } else if (EXT.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^\s*\/\/.*$/gm, '');

describe('проход 174: одно правило поиска записи каталога анализов', () => {
  it('ucumInfo находит запись в любом регистре (HbA1c)', () => {
    const canonical = UCUM_MAP['HbA1c'];
    expect(canonical.prefUnit).toBe('%');
    for (const code of ['HbA1c', 'HBA1C', 'hba1c', 'HbA1C', '  hba1c  ']) {
      const info = ucumInfo(code);
      expect(info, `код «${code}» не найден`).toBe(canonical);
    }
    expect(ucumInfo('ЗНАЧЕНИЯ_НЕТ')).toBeUndefined();
    expect(ucumInfo('')).toBeUndefined();
    expect(ucumInfo(null)).toBeUndefined();
  });

  it('ucumKey возвращает ключ каталога в его собственном регистре', () => {
    expect(ucumKey('hba1c')).toBe('HbA1c');
    expect(ucumKey('ALT')).toBe('ALT');
    expect(ucumKey('нет')).toBeUndefined();
  });

  it('приведение имени: mapToUcumCode/resolveLabMarker не выдают несуществующий ключ', () => {
    // Раньше возвращался `HBA1C` — ключ, которого в каталоге нет.
    expect(mapToUcumCode('hba1c')).toBe('HbA1c');
    expect(resolveLabMarker('hba1c')).toBe('HbA1c');
    expect(resolveLabMarker('HbA1c')).toBe('HbA1c');
    // Нижний путь не изменился: канонические коды остаются собой.
    expect(mapToUcumCode('alt')).toBe('ALT');
    expect(resolveLabMarker('ттг')).toBe('TSH');
  });

  it('норма и единица не теряются, даже если код записан верхним регистром', () => {
    const upper = getLabNorm('HBA1C');
    expect(upper).not.toBeNull();
    expect(upper!.lln).toBe(4.0);
    expect(upper!.uln).toBe(5.7);
    expect(upper!.unit).toBe('%');

    const normalized = normalizeLab('hba1c', 6.2, '%');
    expect(normalized.ref).toEqual({ uln: 5.7, lln: 4.0 });
    expect(normalized.unit).toBe('%');
  });

  it('перебора регистров у UCUM_MAP в исходниках больше нет', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length + 1).replace(/\\/g, '/');
      const src = stripComments(readFileSync(file, 'utf8'));
      src.split(/\r?\n/).forEach((line, i) => {
        const caseJuggle = /UCUM_MAP\[[^\]]*\.to(?:Upper|Lower)Case\(\)/.test(line);
        const ownFind = /Object\.entries\(UCUM_MAP/.test(line) && /\.find\(/.test(line);
        // `Object.entries(UCUM_MAP)` без поиска — законный перебор каталога
        // (каталог экрана, счётчики), его не трогаем.
        if (caseJuggle || ownFind) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders, `свой перебор регистров вместо ucumInfo:\n${offenders.join('\n')}`).toEqual([]);
  });
});
