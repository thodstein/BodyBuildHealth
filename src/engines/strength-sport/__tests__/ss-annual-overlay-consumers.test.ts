/**
 * Wave-0 Э0.4 — замок «мост в никуда» для годовых оверлеев ТА/стронг.
 *
 * Факт (проверен чтением кода, 26.09.2026):
 *  - `he_ta_annual_sync_v1` пишется из WLDiagnosticsHub, читается `loadTAAnnualOverlay()`
 *  - `he_sm_annual_sync_v1` пишется из StrongmanDiagnosticsHub, читается `loadSMAnnualOverlay()`
 *  - НО production-потребителей (годовой планировщик `annual-training/`, `MacrocyclePanel`)
 *    у этих loaders НЕТ — только собственные тесты движков.
 *
 * Поэтому UI обязан говорить «сохранено локально, планировщик пока НЕ читает».
 * Как только появится настоящий потребитель — тесты упадут, и их нужно будет переписать
 * вместе с изменением тостов (намеренный «красный» предохранитель против тихой лжи).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT);

/** Убираем комментарии, чтобы guard не цеплялся за текст в комментариях автора. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Файлы, реально ЧИТАЮЩИЕ символ (не тесты, не файл-определение, не комментарии). */
function productionReaders(symbol: string, engineFile: string): string[] {
  return FILES.filter((f) => {
    if (f.includes('__tests__')) return false;
    if (f.endsWith(engineFile)) return false; // файл-определение
    return code(readFileSync(f, 'utf8')).includes(symbol);
  });
}

const CASES = [
  {
    label: 'ТА',
    loader: 'loadTAAnnualOverlay',
    engineFile: join('engines', 'strength-sport', 'strength-sport-ta-annual-bridge.engine.ts'),
    key: 'he_ta_annual_sync_v1',
    honestText: 'Оверлей ТА сохранён локально',
    hub: join('ui', 'screens', 'TrainingScreen_parts', 'WLDiagnosticsHub.tsx'),
  },
  {
    label: 'стронг',
    loader: 'loadSMAnnualOverlay',
    engineFile: join('engines', 'strength-sport', 'strength-sport-sm-annual-bridge.engine.ts'),
    key: 'he_sm_annual_sync_v1',
    honestText: 'Оверлей стронга сохранён локально',
    hub: join('ui', 'screens', 'TrainingScreen_parts', 'StrongmanDiagnosticsHub.tsx'),
  },
] as const;

describe('Wave-0 Э0.4: годовые оверлеи ТА/стронг — нет скрытого потребителя', () => {
  for (const c of CASES) {
    it(`${c.label}: loader не читается ни одним production-файлом`, () => {
      const readers = productionReaders(c.loader, c.engineFile);
      expect(
        readers,
        `появился production-потребитель ${c.loader}: ${readers.join(', ')} — подключи оверлей к годовому планировщику и перепиши тосты`,
      ).toEqual([]);
    });

    it(`${c.label}: тост хаба честный (локальное сохранение, а не «применено в год»)`, () => {
      const src = readFileSync(join(ROOT, c.hub), 'utf8');
      expect(src).toContain(c.honestText);
      expect(src).not.toContain('✓ Годовой синк');        // было ложное обещание
      expect(src).not.toContain('нед → годовой план');      // было ложное обещание
    });

    it(`${c.label}: оверлей пишется СВОИМ ключом (не в чужой)`, () => {
      const engine = readFileSync(join(ROOT, c.engineFile), 'utf8');
      expect(engine).toContain(c.key);
    });
  }

  it('стронг: его оверлей входит в собственный бэкап (восстановление его вернёт)', () => {
    const storage = readFileSync(join(ROOT, 'engines', 'strength-sport', 'strength-sport-sm-storage.engine.ts'), 'utf8');
    expect(storage).toContain('he_sm_annual_sync_v1');
  });
});
