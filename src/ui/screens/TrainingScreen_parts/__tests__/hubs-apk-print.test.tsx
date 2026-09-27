import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * АПК-безопасность выдачи в хабах диагностики.
 *
 * Проблема зафиксирована в core/apk-share.ts: в Capacitor WebView
 * - window.open(...).print() — попапы заблокированы (печати нет),
 * - Blob/`a[download]` — файл уходит в никуда.
 * Поэтому печать обязана идти через printHtmlApk (native → Documents+Share).
 *
 * Этот файл — источник-guard: держит все 4 хаба на APK-безопасном пути.
 */

const DIR = path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts');

const HUBS: Array<{ file: string; label: string }> = [
  { file: 'WLDiagnosticsHub.tsx', label: 'ТА' },
  { file: 'ArmDiagnosticsHub.tsx', label: 'арм' },
  { file: 'ArmliftingDiagnosticsHub.tsx', label: 'армлифтинг' },
  { file: 'StrongmanDiagnosticsHub.tsx', label: 'стронг' },
];

const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf-8');

describe('АПК: печать хабов диагностики идёт через apk-share', () => {
  for (const { file, label } of HUBS) {
    it(`${label}: печать через printHtmlApk, сырого window.open().print() нет`, () => {
      const src = read(file);
      expect(src).toMatch(/import \{[^}]*printHtmlApk[^}]*shareOutcomeLabel[^}]*\} from '\.\.\/\.\.\/\.\.\/core\/apk-share'/);
      expect(src).toMatch(/await printHtmlApk\(/);
      // ни в одном обработчике печати не осталось сырого попапа
      expect(src).not.toMatch(/const handlePrint[A-Za-z0-9]* = \(\) => \{[\s\S]{0,400}window\.open/);
      expect(src).not.toMatch(/w\.print\(\)/);
    });
  }

  it('хост-слой apk-share реально даёт native-ветку (Documents+Share), а не window.open', () => {
    const bridge = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'apk-share.ts'), 'utf-8');
    const fn = bridge.slice(bridge.indexOf('export async function printHtmlApk'));
    expect(fn).toMatch(/if \(isNativeApp\(\)\)/);
    expect(fn).toMatch(/saveTextFile\(/);
    // web-ветка остаётся как была — TG/браузер не ломаем
    expect(fn).toMatch(/window\.open\(/);
    expect(fn).toMatch(/w\.print\(\)/);
  });

  // Вторая половина той же поломки: файловые выгрузки. Blob + a[download] в Capacitor
  // WebView не сохраняет файл, поэтому хабы не должны звать движковые download*.
  const DOWNLOADERS = ['downloadArmFile', 'downloadArmliftIcs', 'downloadSMHtml', 'downloadSMCsv', 'downloadSMIcs', 'downloadSMBackup', 'downloadWLHtml', 'downloadWLCsv'];
  for (const { file, label } of HUBS) {
    it(`${label}: файловые выгрузки идут через saveTextFileApk/saveCsvApk, не через Blob-download`, () => {
      const src = read(file);
      // ни один движковый download*-хелпер не вызывается (в комментариях — можно)
      const calls = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const d of DOWNLOADERS) expect(calls).not.toMatch(new RegExp(`${d}\\(`));
      // и есть реальные вызовы apk-слоя
      expect(src).toMatch(/await (saveTextFileApk|saveCsvApk|printHtmlApk)\(|saveTextFileApk\(/);
    });
  }

  it('в хабах нет своей копии URL.createObjectURL (единый sanctioned-слой)', () => {
    for (const { file, label } of HUBS) {
      const src = read(file);
      expect(src, label).not.toMatch(/URL\.createObjectURL/);
    }
  });
});
