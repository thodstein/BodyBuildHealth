/**
 * planner-apk-actions.test.tsx — АПК-маршруты выдачи плана:
 * shareOrCopyText / printPlanHtml / downloadCoachFile.
 * web/TG — классика (clipboard/print/Blob), native — native-bridge (замокан).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../core/native-bridge', () => ({
  shareText: vi.fn(async () => true),
  saveTextFile: vi.fn(async () => true),
}));

import { shareText, saveTextFile } from '../../../../../core/native-bridge';
import {
  shareOrCopyText,
  printPlanHtml,
  downloadCoachFile,
} from '../planner-day-print';

const mockedShareText = vi.mocked(shareText);
const mockedSaveTextFile = vi.mocked(saveTextFile);

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

describe('АПК-выдача плана', () => {
  it('web: shareOrCopyText идёт в clipboard, мост не трогает', async () => {
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const ok = await shareOrCopyText('T', 'hello');
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledWith('hello');
    expect(mockedShareText).not.toHaveBeenCalled();
  });

  it('native: shareOrCopyText идёт в Share-мост', async () => {
    setCapacitorNative();
    const ok = await shareOrCopyText('T', 'hello');
    expect(ok).toBe(true);
    expect(mockedShareText).toHaveBeenCalledWith({ title: 'T', text: 'hello' });
  });

  it('native: share упал → fallback в clipboard', async () => {
    setCapacitorNative();
    mockedShareText.mockResolvedValueOnce(false);
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const ok = await shareOrCopyText('T', 'hello');
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledWith('hello');
  });

  it('web: printPlanHtml открывает print-окно', async () => {
    const printed: string[] = [];
    (window as any).open = vi.fn(() => ({
      document: { write: (h: string) => printed.push(h), close: () => {} },
      focus: () => {},
      print: () => {},
    }));
    const ok = await printPlanHtml('День', '<html>menu</html>');
    expect(ok).toBe(true);
    expect(printed.join('')).toContain('menu');
    expect(mockedSaveTextFile).not.toHaveBeenCalled();
  });

  it('native: printPlanHtml сохраняет HTML-файл через мост', async () => {
    setCapacitorNative();
    const ok = await printPlanHtml('День', '<html>menu</html>');
    expect(ok).toBe(true);
    expect(mockedSaveTextFile).toHaveBeenCalledWith('День.html', '<html>menu</html>');
  });

  it('native: downloadCoachFile сохраняет файл через мост', async () => {
    setCapacitorNative();
    const ok = await downloadCoachFile('<html>coach</html>', 'plan-coach-2026-01-01.html');
    expect(ok).toBe(true);
    expect(mockedSaveTextFile).toHaveBeenCalledWith(
      'plan-coach-2026-01-01.html',
      '<html>coach</html>',
    );
  });
});
