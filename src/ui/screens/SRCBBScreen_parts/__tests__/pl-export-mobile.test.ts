/**
 * pl-export-mobile.test.ts — мобильное сохранение экспорта ПЛ:
 * saveFileToDevice (нативная панель share-first), plShareDigest/plShareLink
 * (план в сообщении, а не просто ссылка на веб-версию), printPLHtml
 * (оверлей-просмотр, когда window.open заблокирован в WebView/Telegram).
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { LMSPlanWeek } from '../../../../engines/lms/lms-builder.engine';
import { saveFileToDevice, plShareDigest, plShareLink, plTelegramAppUrl, printPLHtml, openPLShare } from '../pl-export';

const mkEx = (name: string, pct: number, sets: number) => ({
  name, group: 'Грудь', coef: 1, mnosz: 1, pm: 200, rir: 2,
  workSets: [{ pct, reps: 3, sets, weight: 160, rir: 2 }],
});

const mkDay = () => ({
  exercises: [mkEx('Присед', 0.85, 3), mkEx('Жим лежа', 0.85, 3), mkEx('Тяга к поясу', 0.7, 4)],
  metrics: { tonnage: 1000, kpsh: 20, avgWeight: 50, relIntensity: 0.7, intFB: 0, uoi: 0 } as never,
});

const weeks = (n: number): LMSPlanWeek[] =>
  Array.from({ length: n }, (_, i) => ({
    week: i + 1,
    pmRow: { 'Присед': 200, 'Жим лежа': 140 },
    days: [mkDay()],
    sourcePhase: 'base',
  } as never));

const clearNavShare = () => {
  const nav = navigator as unknown as Record<string, unknown>;
  Object.defineProperty(nav, 'canShare', { value: undefined, configurable: true });
  Object.defineProperty(nav, 'share', { value: undefined, configurable: true });
};

afterEach(() => {
  vi.restoreAllMocks();
  clearNavShare();
  Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  document.getElementById('pl-print-overlay')?.remove();
  document.getElementById('pl-file-save-overlay')?.remove();
});

describe('saveFileToDevice — сохранение файла на устройство', () => {
  it('записывает файл через системный picker, если браузер его поддерживает', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const createWritable = vi.fn(async () => ({ write, close }));
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn(async () => ({ createWritable })), configurable: true,
    });

    const res = await saveFileToDevice(new Blob(['x'], { type: 'text/plain' }), 'plan.txt');
    expect(res).toBe('saved');
    expect(write).toHaveBeenCalledWith(expect.any(Blob));
    expect(close).toHaveBeenCalled();
  });

  it('нативная системная панель (navigator.share с файлом), когда canShare поддерживает файлы', async () => {
    const nav = navigator as unknown as Record<string, unknown>;
    const canShare = vi.fn(() => true);
    const share = vi.fn(async () => {});
    Object.defineProperty(nav, 'canShare', { value: canShare, configurable: true });
    Object.defineProperty(nav, 'share', { value: share, configurable: true });

    const res = await saveFileToDevice(new Blob(['x'], { type: 'text/plain' }), 'a.txt');
    expect(res).toBe('shared');
    expect(canShare).toHaveBeenCalled();
    const data = share.mock.calls[0][0] as { files: File[]; title: string };
    expect(data.files[0]).toBeInstanceOf(File);
    expect(data.files[0].name).toBe('a.txt');
    expect(data.title).toBe('a.txt');
  });

  it('отмена системной панели (AbortError) не падает и не пытается скачать', async () => {
    const nav = navigator as unknown as Record<string, unknown>;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(nav, 'canShare', { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(nav, 'share', {
      value: vi.fn(async () => {
        const e = new Error('abort');
        (e as { name?: string }).name = 'AbortError';
        throw e;
      }),
      configurable: true,
    });

    const res = await saveFileToDevice(new Blob(['x']), 'a.txt');
    expect(res).toBe('shared');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('фолбэк на <a download>, когда navigator.share недоступен (десктоп/старый браузер)', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    const res = await saveFileToDevice(new Blob(['x']), 'a.txt');
    expect(res).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.getElementById('pl-file-save-overlay')?.textContent).toContain('Сохранить файл');
  });
});

describe('plShareDigest / plShareLink — план в сообщении', () => {
  it('строит Telegram Mini App deep-link с startapp', () => {
    expect(plTelegramAppUrl('cycle-01', '@BBHealthBot')).toBe('https://t.me/BBHealthBot?startapp=pl-plan-cycle-01');
  });

  it('digest: заголовок, прикиды и недели с упражнениями/весами', () => {
    const d = plShareDigest({ title: 'Тестовый цикл', weeks: weeks(2), pmSquat: 180, pmBench: 120, pmDead: 220 });
    expect(d).toContain('Тестовый цикл');
    expect(d).toContain('2 нед');
    expect(d).toContain('Присед 180 / Жим 120 / Тяга 220 кг');
    expect(d).toContain('Неделя 1');
    expect(d).toContain('День 1');
    expect(d).toContain('3×3@160кг');
  });

  it('digest: длинный план обрезается с «… ещё N нед»', () => {
    const d = plShareDigest({ title: 'Длинный', weeks: weeks(12), pmSquat: 180, pmBench: 120, pmDead: 220 });
    expect(d).toContain('Полный план — в приложении');
    expect(d.length).toBeLessThanOrEqual(2000);
  });

  it('plShareLink с планом: digest попадает в text сообщения', () => {
    const link = plShareLink({
      title: 'Тестовый цикл', weeks: 8, pmSquat: 180, pmBench: 120, pmDead: 220,
      cycleId: 'cycle-01', baseUrl: 'https://app.ru', plan: weeks(8),
    });
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('https://t.me/share/url?url=');
    expect(decoded).toContain('https://app.ru#pl-plan-cycle-01');
    expect(decoded).toContain('Неделя 5');
    expect(decoded).toContain('ещё 3 нед');
    expect(decoded).toContain('Открыть план в приложении');
  });

  it('plShareLink без плана: по-прежнему заголовок и прикиды в тексте', () => {
    const link = plShareLink({
      title: 'Тестовый цикл', weeks: 8, pmSquat: 180, pmBench: 120, pmDead: 220,
      cycleId: 'cycle-01', baseUrl: 'https://app.ru',
    });
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('#pl-plan-cycle-01');
    expect(decoded).toContain('Тестовый цикл');
    expect(decoded).toContain('Присед 180');
  });
});

describe('openPLShare — системная передача плана', () => {
  it('передаёт текст плана, а не только URL приложения', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const result = await openPLShare('https://t.me/share/url?text=fallback', {
      title: 'ПЛ: Тест', text: 'Неделя 1\nПрисед 3×3@160кг', url: 'https://app.ru#pl-plan-x',
    });
    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'ПЛ: Тест', text: 'Неделя 1\nПрисед 3×3@160кг', url: 'https://app.ru#pl-plan-x',
    });
  });
});

describe('printPLHtml — печать/PDF', () => {
  it('window.open работает (десктоп) → печать в новом окне', () => {
    const fakeWin = { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn(), close: vi.fn() } as never;
    vi.spyOn(window, 'open').mockReturnValue(fakeWin as Window);
    const ok = printPLHtml('<h1>план</h1>', { title: 'План' });
    expect(ok).toBe(true);
    expect((fakeWin as { document: { write: ReturnType<typeof vi.fn> } }).document.write).toHaveBeenCalled();
  });

  it('window.open заблокирован (WebView/Telegram) → встроенный просмотр с печатью и копированием', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const ok = printPLHtml('<h1>План ПЛ</h1>', { title: 'Тестовый цикл', text: 'План ПЛ текст' });
    expect(ok).toBe(false);
    const overlay = document.getElementById('pl-print-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay!.textContent).toContain('Тестовый цикл');
    expect(overlay!.textContent).toContain('Печать');
    expect(overlay!.textContent).toContain('Копировать');
  });

  it('просмотр закрывается по «Закрыть»', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    printPLHtml('<h1>План</h1>', { title: 'План' });
    const overlay = document.getElementById('pl-print-overlay')!;
    expect(overlay).toBeTruthy();
    const closeBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent?.includes('Закрыть'));
    closeBtn?.click();
    expect(document.getElementById('pl-print-overlay')).toBeNull();
  });
});
