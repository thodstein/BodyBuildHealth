/**
 * labs-ai-ocr.test.ts — source-contract замок AI-проверки бланка в LabsScreen.
 *
 * Полный рендер экрана слишком тяжёл для юнита, но именно эти строки
 * определяют безопасность: AI идёт через purpose='lab', результат сливается
 * с OCR, а selectedLabs внутри AI-проверки не трогается (AI-добавки не
 * выбираются автоматически). Если кто-то поменяет это — тест упадёт.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

describe('LabsScreen: AI-проверка бланка', () => {
  it('вызывает recognizeFoodPhoto с purpose=lab и OCR-подсказкой', () => {
    expect(source).toContain("recognizeFoodPhoto(target, { purpose: 'lab', hint: ocrResult.text.slice(0, 1600) })");
  });

  it('сливает AI-значения с OCR через mergeLabAiCandidates', () => {
    expect(source).toContain('mergeLabAiCandidates(mergedLabs, r.lab, ocrResult.text)');
  });

  it('не выбирает AI-добавки автоматически: в runAiLabCheck нет setSelectedLabs', () => {
    const start = source.indexOf('const runAiLabCheck');
    const end = source.indexOf('const toggleLabSelection', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).not.toContain('setSelectedLabs');
  });

  it('кнопка AI доступна только для фото и учитывает офлайн', () => {
    expect(source).toContain("ocrResult.source === 'image'");
    expect(source).toContain('aiOffline');
    expect(source).toContain('disabled={aiBusy || aiOffline}');
  });

  it('PDF: страницы рендерятся в JPEG и AI-проверка доступна для source=pdf', () => {
    expect(source).toContain('renderPdfPagesForVision');
    expect(source).toContain("ocrResult.source === 'pdf'");
    expect(source).toContain('maxPages: 3');
  });
});
