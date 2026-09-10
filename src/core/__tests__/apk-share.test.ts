import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../app-platform', () => ({
  isNativeApp: vi.fn(() => false),
  isCapacitorNative: vi.fn(() => false),
}));

vi.mock('../native-bridge', () => ({
  shareText: vi.fn(async () => true),
  saveTextFile: vi.fn(async () => true),
}));

import { isNativeApp } from '../app-platform';
import { shareText, saveTextFile } from '../native-bridge';
import {
  dataUrlToFile,
  copyOrShareText,
  saveTextFileApk,
  saveCsvApk,
  saveBlobApk,
  printHtmlApk,
  shareOutcomeLabel,
} from '../apk-share';

const mockedIsNative = vi.mocked(isNativeApp);
const mockedShare = vi.mocked(shareText);
const mockedSave = vi.mocked(saveTextFile);

describe('apk-share (Labs/Pharma/Risks выдача в АПК)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsNative.mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dataUrlToFile: конвертирует dataUrl камеры в File', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    const url = `data:image/jpeg;base64,${btoa(bin)}`;
    const f = dataUrlToFile(url, 'lab-photo.jpg');
    expect(f).not.toBeNull();
    expect(f!.name).toBe('lab-photo.jpg');
    expect(f!.type).toBe('image/jpeg');
    expect(dataUrlToFile('not-a-data-url')).toBeNull();
  });

  it('copyOrShareText: web — clipboard', async () => {
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    const o = await copyOrShareText('hello');
    expect(o).toBe('copied');
    expect(write).toHaveBeenCalledWith('hello');
    expect(mockedShare).not.toHaveBeenCalled();
  });

  it('copyOrShareText: native — Share-диалог', async () => {
    mockedIsNative.mockReturnValue(true);
    const o = await copyOrShareText('анализ ALT 40', 'Анализы');
    expect(mockedShare).toHaveBeenCalledWith({ title: 'Анализы', text: 'анализ ALT 40' });
    expect(o).toBe('shared');
  });

  it('saveTextFileApk: native — Filesystem+Share, web — <a download>', async () => {
    mockedIsNative.mockReturnValue(true);
    expect(await saveTextFileApk('labs.csv', 'a;b')).toBe('saved');
    expect(mockedSave).toHaveBeenCalledWith('labs.csv', 'a;b');

    mockedIsNative.mockReturnValue(false);
    mockedSave.mockClear();
    const click = vi.fn();
    if (typeof URL.createObjectURL !== 'function') {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (typeof (URL as any).revokeObjectURL !== 'function') {
      (URL as any).revokeObjectURL = vi.fn();
    }
    const orig = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: any[]) => {
      const el = (orig as any)(tag, ...rest) as any;
      if (tag === 'a') el.click = click;
      return el;
    }) as any);
    expect(await saveTextFileApk('labs.csv', 'a;b')).toBe('saved');
    expect(click).toHaveBeenCalled();
    expect(mockedSave).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('saveCsvApk: добавляет расширение', async () => {
    mockedIsNative.mockReturnValue(true);
    await saveCsvApk('lab-trends-2026-09-10', 'Code,Name');
    expect(mockedSave).toHaveBeenCalledWith('lab-trends-2026-09-10.csv', expect.any(String));
  });

  it('printHtmlApk: native — html в файл, web — window.open', async () => {
    mockedIsNative.mockReturnValue(true);
    expect(await printHtmlApk('<html></html>', 'report.html', 'fallback')).toBe('saved');
    expect(mockedSave).toHaveBeenCalledWith('report.html', '<html></html>');
  });

  it('saveBlobApk: web — <a download> для PNG', async () => {
    mockedIsNative.mockReturnValue(false);
    const click = vi.fn();
    if (typeof URL.createObjectURL !== 'function') {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    }
    const orig = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: any[]) => {
      const el = (orig as any)(tag, ...rest) as any;
      if (tag === 'a') el.click = click;
      return el;
    }) as any);
    const blob = new Blob(['png'], { type: 'image/png' });
    expect(await saveBlobApk('chart.png', blob)).toBe('saved');
    expect(click).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('shareOutcomeLabel: все исходы', () => {
    expect(shareOutcomeLabel('shared')).toContain('Отправлено');
    expect(shareOutcomeLabel('saved')).toContain('Сохранено');
    expect(shareOutcomeLabel('copied')).toContain('Скопировано');
    expect(shareOutcomeLabel('failed')).toContain('Не удалось');
  });

  it('пустой текст — failed без сайд-эффектов', async () => {
    expect(await copyOrShareText('')).toBe('failed');
    expect(mockedShare).not.toHaveBeenCalled();
  });
});
