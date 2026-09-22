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

  it('камера отклонена → понятная подсказка, окно не открывается', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue({}) },
    });

    render(<VideoCaptureCard lift="squat" />);
    fireEvent.click(screen.getByLabelText('Включить живую камеру'));

    await waitFor(() => expect(document.querySelector('[data-vc="stage"]')).toBeNull());
    expect(screen.getByText(/Камера отклонена/)).toBeTruthy();
  });
});
