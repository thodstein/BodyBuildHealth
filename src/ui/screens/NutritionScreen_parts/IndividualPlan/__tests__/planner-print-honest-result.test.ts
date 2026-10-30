/**
 * planner-print-honest-result.test.ts — B24 (аудит 2026-10).
 *
 * Находка: печать и копирование сообщали об успехе при провале.
 *  - `printDayReport` возвращал `void`, а вызывающий код проверял `if (!ok)` →
 *    `ok` был всегда `true`: заблокированный попап давал «готово» без печати.
 *  - `shareOrCopyText` делал `await navigator.clipboard?.writeText(text)`; при
 *    отсутствии Clipboard API это `await undefined` → всегда `true`.
 *
 * Замок: функции возвращают РЕАЛЬНЫЙ результат операции.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { printDayReport, printMealTimeline, printPlanHtml, shareOrCopyText } from '../planner-day-print';

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeWin = (written: string[]) => ({
  document: { write: (h: string) => written.push(h), close: () => {} },
  focus: () => {},
  print: () => {},
});

describe('B24: печать сообщает правду о результате', () => {
  it('printDayReport → true, когда окно открылось и HTML записан', () => {
    const written: string[] = [];
    vi.spyOn(window, 'open').mockReturnValue(fakeWin(written) as any);
    expect(printDayReport('<p>ok</p>')).toBe(true);
    expect(written[0]).toContain('<p>ok</p>');
  });

  it('printDayReport → false, когда попап заблокирован (window.open вернул null)', () => {
    vi.spyOn(window, 'open').mockReturnValue(null as any);
    // РАНЬШЕ возвращался void → `!ok` никогда не срабатывал, пользователь видел «готово».
    expect(printDayReport('<p>x</p>')).toBe(false);
  });

  it('printDayReport → false, когда запись в окно бросает исключение', () => {
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: () => { throw new Error('blocked'); }, close: () => {} },
      focus: () => {},
      print: () => {},
    } as any);
    expect(printDayReport('<p>x</p>')).toBe(false);
  });

  it('printMealTimeline → false при заблокированном попапе', () => {
    vi.spyOn(window, 'open').mockReturnValue(null as any);
    expect(printMealTimeline('<p>x</p>')).toBe(false);
  });

  it('printPlanHtml пробрасывает реальный результат печати (не безусловный true)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null as any);
    await expect(printPlanHtml('День', '<p>x</p>')).resolves.toBe(false);

    const written: string[] = [];
    vi.spyOn(window, 'open').mockReturnValue(fakeWin(written) as any);
    await expect(printPlanHtml('День', '<p>x</p>')).resolves.toBe(true);
  });
});

describe('B24: копирование сообщает правду о результате', () => {
  it('shareOrCopyText → true, когда Clipboard API реально записал текст', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await expect(shareOrCopyText('Заголовок', 'текст')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('текст');
  });

  it('shareOrCopyText → false, когда Clipboard API нет и нет execCommand', async () => {
    // jsdom: navigator.clipboard отсутствует, document.execCommand не реализован.
    // РАНЬШЕ: `await undefined` → возвращался true («скопировано» при провале).
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    await expect(shareOrCopyText('Заголовок', 'текст')).resolves.toBe(false);
  });

  it('shareOrCopyText → false, когда Clipboard API есть, но запись запрещена и fallback не сработал', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await expect(shareOrCopyText('Заголовок', 'текст')).resolves.toBe(false);
  });

  it('shareOrCopyText → true, когда Clipboard API запрещён, но fallback-копирование удалось', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    (document as any).execCommand = vi.fn().mockReturnValue(true);
    try {
      await expect(shareOrCopyText('Заголовок', 'текст')).resolves.toBe(true);
      expect((document as any).execCommand).toHaveBeenCalledWith('copy');
    } finally {
      delete (document as any).execCommand;
    }
  });
});
