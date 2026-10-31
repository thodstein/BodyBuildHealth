import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { VideoCaptureCard } from '../VideoCaptureCard';

describe('VideoCaptureCard', () => {
  it('рендерит гид по ракурсу для жима', () => {
    const html = renderToStaticMarkup(<VideoCaptureCard lift="bench" />);
    expect(html).toContain('Как снимать');
    expect(html).toContain('Ракурс');
    expect(html).toContain('В кадре обязательно');
    expect(html).toContain('Выбрать файл');
  });
  it('гид меняется по движению', () => {
    const htmlSquat = renderToStaticMarkup(<VideoCaptureCard lift="squat" />);
    expect(htmlSquat).toContain('Присед');
    const htmlDead = renderToStaticMarkup(<VideoCaptureCard lift="deadlift" />);
    expect(htmlDead).toContain('Тяга');
  });
});

describe('VideoCaptureCard — полноэкранное видео', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('live-камера открывается полноэкранным окном (портал в body) и закрывается', async () => {
    // jsdom не реализует play()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve() as any);
    const stop = vi.fn();
    const fakeStream = { getTracks: () => [{ stop }] } as any;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });

    render(<VideoCaptureCard lift="bench" />);
    fireEvent.click(screen.getByLabelText('Включить живую камеру'));

    await waitFor(() => expect(document.querySelector('[data-vc="stage"]')).not.toBeNull());
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByLabelText('Остановить камеру и закрыть'));
    await waitFor(() => expect(document.querySelector('[data-vc="stage"]')).toBeNull());
    expect(stop).toHaveBeenCalled();
  });

  it('камера отклонена → понятная подсказка, окно не открывается', async () => {    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue({}) },
    });

    render(<VideoCaptureCard lift="squat" />);
    fireEvent.click(screen.getByLabelText('Включить живую камеру'));

    await waitFor(() => expect(document.querySelector('[data-vc="stage"]')).toBeNull());
    expect(screen.getByText(/Камера отклонена/)).toBeTruthy();
  });

  it('история разборов (he_cv_reports) читается и честно делит замер/оценку', () => {
    const base = { elbowAvgDeg: 52, gripRatio: 1.42, barVelocity: 0.48, bridge: null, note: '' };
    localStorage.setItem('he_cv_reports', JSON.stringify([
      { ts: Date.now(), lift: 'bench', fileName: 'measured.mp4', result: { ...base, measured: true } },
      { ts: Date.now() - 86_400_000, lift: 'bench', fileName: 'mock.mp4', result: { ...base, measured: false } },
      // битые записи не должны ломать карточку
      { ts: 'nope' },
      null,
    ]));

    const { container } = render(<VideoCaptureCard lift="bench" />);
    const history = container.querySelector('[data-vc="history"]');
    expect(history, 'блок истории').toBeTruthy();
    const items = container.querySelectorAll('[data-vc="history-item"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('замер');
    expect(items[1].textContent).toContain('оценка');
    expect(history!.textContent).toContain('Хранится только на устройстве');

    fireEvent.click(container.querySelector('[data-vc="history-clear"]')!);
    expect(container.querySelector('[data-vc="history"]')).toBeNull();
    expect(localStorage.getItem('he_cv_reports')).toBeNull();
    localStorage.removeItem('he_cv_reports');
  });

  it('битый JSON в he_cv_reports не роняет карточку и не рисует историю', () => {
    localStorage.setItem('he_cv_reports', '{not json');
    const { container } = render(<VideoCaptureCard lift="bench" />);
    expect(container.querySelector('[data-vc="history"]')).toBeNull();
    expect(container.textContent).toContain('Как снимать');
    localStorage.clear();
  });
});
