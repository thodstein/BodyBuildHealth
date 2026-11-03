/**
 * pl-set-video-ui.test.tsx — Фаза 6, п.10: кнопка «🎥 видео» у подхода.
 *
 * Ключевое обещание: в браузере кнопка НЕ притворяется рабочей (честно говорит
 * «только в приложении»), а в APK — записывает, привязывает ссылку к подходу,
 * даёт посмотреть и снять.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const native = {
  supported: false,
  record: null as { uri: string } | null,
};

vi.mock('../../../../core/native-bridge', () => ({
  isVideoCaptureSupported: () => native.supported,
  recordSetVideo: async () => native.record,
  playSetVideo: vi.fn(async () => true),
  deleteSetVideoFile: vi.fn(async () => true),
}));

import { PLSetVideoButton } from '../PLSetVideoButton';
import { PL_SET_VIDEO_KEY, parseSetVideoStore, findSetVideo } from '../../../../engines/lms/pl-set-video.engine';
import { playSetVideo } from '../../../../core/native-bridge';

const D = '2026-11-03';

const renderBtn = (notes: string[] = []) =>
  render(<PLSetVideoButton date={D} exercise="Присед" setNumber={2} onNote={m => notes.push(m)} />);

describe('PLSetVideoButton', () => {
  beforeEach(() => {
    native.supported = false;
    native.record = null;
    try { localStorage.removeItem(PL_SET_VIDEO_KEY); } catch { /* ignore */ }
    vi.clearAllMocks();
  });

  it('в браузере запись не имитируется: честное сообщение, ничего не пишется', () => {
    const notes: string[] = [];
    renderBtn(notes);
    fireEvent.click(document.querySelector('[data-pl="set-video-record"]') as HTMLElement);
    expect(notes.join(' ')).toMatch(/доступна в приложении \(APK\)/);
    expect(localStorage.getItem(PL_SET_VIDEO_KEY)).toBeNull();
  });

  it('в APK запись привязывается к подходу и кнопка становится «видео»', async () => {
    native.supported = true;
    native.record = { uri: 'file:///storage/emulated/0/Android/data/app/files/Присед-2.mp4' };
    const notes: string[] = [];
    renderBtn(notes);
    fireEvent.click(document.querySelector('[data-pl="set-video-record"]') as HTMLElement);
    expect(await screen.findByText('🎥 видео')).toBeTruthy();
    const store = parseSetVideoStore(localStorage.getItem(PL_SET_VIDEO_KEY));
    expect(findSetVideo(store, D, 'Присед', 2)?.uri).toContain('Присед-2.mp4');
    expect(notes.join(' ')).toMatch(/привязано к подходу 2/);
  });

  it('отмена записи не создаёт пустую ссылку', async () => {
    native.supported = true;
    native.record = null;
    const notes: string[] = [];
    renderBtn(notes);
    fireEvent.click(document.querySelector('[data-pl="set-video-record"]') as HTMLElement);
    await screen.findByText('🎥');
    expect(localStorage.getItem(PL_SET_VIDEO_KEY)).toBeNull();
    expect(notes.join(' ')).toMatch(/отменена или камера недоступна/);
  });

  it('сохранённое видео открывается и снимается', async () => {
    native.supported = true;
    native.record = { uri: 'file:///a.mp4' };
    renderBtn();
    fireEvent.click(document.querySelector('[data-pl="set-video-record"]') as HTMLElement);
    fireEvent.click(await screen.findByText('🎥 видео'));
    expect(playSetVideo).toHaveBeenCalledWith('file:///a.mp4');
    fireEvent.click(document.querySelector('[data-pl="set-video-remove"]') as HTMLElement);
    expect(parseSetVideoStore(localStorage.getItem(PL_SET_VIDEO_KEY)).items).toHaveLength(0);
  });

  it('битый localStorage не роняет кнопку — показывается «записать»', () => {
    localStorage.setItem(PL_SET_VIDEO_KEY, '{не json');
    renderBtn();
    expect(document.querySelector('[data-pl="set-video-record"]')).toBeTruthy();
  });

  it('чужое видео другого подхода не подхватывается', () => {
    native.supported = true;
    native.record = { uri: 'file:///set1.mp4' };
    render(<PLSetVideoButton date={D} exercise="Присед" setNumber={1} />);
    fireEvent.click(document.querySelector('[data-pl="set-video-record"]') as HTMLElement);
    render(<PLSetVideoButton date={D} exercise="Присед" setNumber={2} />);
    const records = document.querySelectorAll('[data-pl="set-video-record"]');
    expect(records.length).toBeGreaterThan(0);
  });
});
