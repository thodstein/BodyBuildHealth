/**
 * bb-hub-pose-video.test.tsx — BB-G-05: видео-разбор позы в «Скрининге» (АПК-путь).
 *
 * Локи:
 *  - карточка в хабе: системная камера АПК (`<input capture="environment">`), галерея,
 *    переключатель ракурса, честная граница 2D — без обещаний «всё сразу»;
 *  - путь «файл → Разобрать → результат → В скрининг» на подменённом анализаторе
 *    (реальную модель в jsdom не грузим: проверяем проводку, а не MediaPipe);
 *  - модель недоступна и «поза не найдена» — разные сообщения, оба без мок-цифр.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';
import { BbPoseCard } from '../bb-hub-pose-card';
import { summarizeBbPose, type BbPoseLandmark, type BbPoseSummary } from '../../../../engines/bb/bb-pose-metrics.engine';

const goScreening = () => {
  render(<BBDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
};

const lm33 = (over: Record<number, { x: number; y: number }> = {}): BbPoseLandmark[] => {
  const arr: BbPoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  for (const [k, v] of Object.entries(over)) arr[Number(k)] = { visibility: 0.9, ...v };
  return arr;
};

const sideDeep = (): BbPoseLandmark => lm33({
  11: { x: 0.5, y: 0.3 }, 12: { x: 0.5, y: 0.3 },
  15: { x: 0.5, y: 0.16 }, 16: { x: 0.5, y: 0.16 },
  23: { x: 0.5, y: 0.5 }, 24: { x: 0.5, y: 0.5 },
  25: { x: 0.5, y: 0.7 }, 26: { x: 0.5, y: 0.7 },
  27: { x: 0.7, y: 0.7 }, 28: { x: 0.7, y: 0.7 },
  29: { x: 0.45, y: 0.95 }, 30: { x: 0.45, y: 0.95 },
  31: { x: 0.52, y: 0.95 }, 32: { x: 0.52, y: 0.95 },
}) as BbPoseLandmark[];

const sideSummary = (): BbPoseSummary => summarizeBbPose(Array.from({ length: 6 }, sideDeep), 'side');

/** Фронтальная поза: стойка 0.20, колени на линии таз–стопа (вальгус 0). */
const frontSummary = (): BbPoseSummary => {
  const frame = (): BbPoseLandmark => lm33({
    11: { x: 0.40, y: 0.30 }, 12: { x: 0.60, y: 0.30 },
    15: { x: 0.46, y: 0.14 }, 16: { x: 0.54, y: 0.14 },
    23: { x: 0.42, y: 0.55 }, 24: { x: 0.58, y: 0.55 },
    25: { x: 0.41, y: 0.735 }, 26: { x: 0.59, y: 0.735 },
    27: { x: 0.40, y: 0.92 }, 28: { x: 0.60, y: 0.92 },
    29: { x: 0.40, y: 0.95 }, 30: { x: 0.60, y: 0.95 },
    31: { x: 0.40, y: 0.985 }, 32: { x: 0.60, y: 0.985 },
  }) as BbPoseLandmark;
  return summarizeBbPose(Array.from({ length: 6 }, frame), 'front');
};

const HUB_KEY = 'he_bb_diagnostics_hub_v1';
const seedHub = (patch: Record<string, unknown>) => localStorage.setItem(HUB_KEY, JSON.stringify(patch));

/** Харнесс: результат хранится как в хабе (saved), применено — по клику. */
const Harness: React.FC<{ analyze: any; onApply?: () => void }> = ({ analyze, onApply }) => {
  const [saved, setSaved] = useState<BbPoseSummary | null>(null);
  const [applied, setApplied] = useState(false);
  return (
    <BbPoseCard
      view="side"
      onView={() => {}}
      saved={saved}
      applied={applied}
      onResult={setSaved}
      onApply={() => { setApplied(true); onApply?.(); }}
      analyzeVideo={analyze}
      makeDetector={async () => null}
    />
  );
};

const pickVideo = () => {
  const input = document.querySelector('[data-bb="pose-camera"] input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], 'squat.mp4', { type: 'video/mp4' })] } });
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  (URL as any).createObjectURL = vi.fn(() => 'blob:pose-test');
  (URL as any).revokeObjectURL = vi.fn();
});

describe('карточка в хабе (АПК)', () => {
  it('системная камера через input capture, галерея и ракурсы', () => {
    goScreening();
    expect(document.querySelector('[data-bb="pose-capture"]')).not.toBeNull();
    const cam = document.querySelector('[data-bb="pose-camera"] input[type="file"]') as HTMLInputElement;
    expect(cam).not.toBeNull();
    expect(cam.getAttribute('accept')).toContain('video');
    // АПК-путь: камера телефона, а не getUserMedia (в WebView он часто недоступен)
    expect(cam.getAttribute('capture')).toBe('environment');
    expect(document.querySelector('[data-bb="pose-gallery"] input[type="file"]')).not.toBeNull();
    expect(document.querySelector('[data-bb="pose-view-front"]')?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(document.querySelector('[data-bb="pose-view-side"]') as HTMLElement);
    expect(document.querySelector('[data-bb="pose-view-side"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-bb="pose-view-front"]')?.getAttribute('aria-pressed')).toBe('false');
    // ракурс объяснён: сбоку не обещаем вальгус
    expect(document.querySelector('[data-bb="pose-view-note"]')?.textContent).toMatch(/Вальгус и сдвиг таза в этой проекции не видны/);
  });

  it('честная граница модели на месте (не «скоро»)', () => {
    goScreening();
    const note = document.querySelector('[data-bb="motion-capture"]')?.textContent || '';
    expect(note).toMatch(/Видео-разбор работает автоматически/);
    expect(note).toMatch(/2D-проекция/);
    expect(note).toMatch(/поясницы/);
    expect(note).toMatch(/гониометр/);
  });

  it('оба ракурса хранятся: второй разбор не затирает первый', () => {
    seedHub({
      poseView: 'front',
      poseResults: { front: frontSummary(), side: sideSummary() },
      poseApplied: { front: true, side: false },
      screenTouched: true,
    });
    goScreening();
    // текущий ракурс — фронт: его метрики и его статус переноса
    const res = document.querySelector('[data-bb="pose-result"]')?.textContent || '';
    expect(res).toMatch(/Вальгус/);
    expect(document.querySelector('[data-bb="pose-apply"]')?.textContent).toMatch(/Перенесено в скрининг/);
    // второй ракурс не потерян: итог виден и открывается одной кнопкой
    expect(document.querySelector('[data-bb="pose-other-view"]')?.textContent).toMatch(/Сбоку: разобрано/);
    fireEvent.click(document.querySelector('[data-bb="pose-other-open"]') as HTMLElement);
    expect(document.querySelector('[data-bb="pose-result"]')?.textContent).toMatch(/Глубина/);
    expect(document.querySelector('[data-bb="pose-other-view"]')?.textContent).toMatch(/Спереди: разобрано/);
    // у бока свой патч, значит своя кнопка «→ В скрининг» (ещё не применено)
    expect(document.querySelector('[data-bb="pose-apply"]')?.textContent).toMatch(/В скрининг/);
  });

  it('миграция: одиночный poseResult старого снимка не теряется', () => {
    seedHub({ poseView: 'side', poseResult: sideSummary(), poseApplied: true, screenTouched: true });
    goScreening();
    expect(document.querySelector('[data-bb="pose-result"]')?.textContent).toMatch(/Глубина/);
    expect(document.querySelector('[data-bb="pose-apply"]')?.textContent).toMatch(/Перенесено в скрининг/);
  });

  it('разбор видео — это данные: балл не «нет данных» без остального скрининга', () => {
    seedHub({ poseResults: { front: frontSummary(), side: null }, poseApplied: { front: false, side: false } });
    goScreening();
    const score = document.querySelector('[data-bb="score"]');
    expect(score).not.toBeNull();
    expect(score!.getAttribute('data-state')).not.toBe('nodata');
  });
});

describe('путь «видео → разбор → скрининг»', () => {
  it('файл из камеры → Разобрать → результат → → В скрининг', async () => {
    const analyze = vi.fn(async () => sideSummary());
    const onApply = vi.fn();
    render(<Harness analyze={analyze} onApply={onApply} />);
    pickVideo();
    expect(document.querySelector('[data-bb="pose-video"]')).not.toBeNull();
    fireEvent.click(document.querySelector('[data-bb="pose-analyze"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-bb="pose-result"]')).not.toBeNull());
    expect(analyze).toHaveBeenCalledTimes(1);
    const result = document.querySelector('[data-bb="pose-result"]')!.textContent || '';
    expect(result).toMatch(/Глубина: колено 90°/);
    expect(result).toMatch(/глубоко/);
    const apply = document.querySelector('[data-bb="pose-apply"]') as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.querySelector('[data-bb="pose-apply"]')!.textContent).toMatch(/Перенесено в скрининг/));
  });

  it('закрыл полноэкранное видео → «Разобрать» и результат остались в карточке', async () => {
    const analyze = vi.fn(async () => sideSummary());
    render(<Harness analyze={analyze} />);
    pickVideo();
    // выбор файла сразу открывает полноэкранный просмотр (АПК-путь)
    expect(document.querySelector('[data-bb="pose-stage"]')).not.toBeNull();
    fireEvent.click(document.querySelector('[data-bb="pose-stage-close"]') as HTMLElement);
    expect(document.querySelector('[data-bb="pose-stage"]')).toBeNull();
    const btn = document.querySelector('[data-bb="pose-analyze"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(document.querySelector('[data-bb="pose-result"]')).not.toBeNull());
  });

  it('модель не загрузилась → прямое сообщение, результата нет', async () => {
    const analyze = vi.fn(async () => null);
    render(<Harness analyze={analyze} />);
    pickVideo();
    fireEvent.click(document.querySelector('[data-bb="pose-analyze"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-bb="pose-status"]')).not.toBeNull());
    expect(document.querySelector('[data-bb="pose-status"]')!.textContent).toMatch(/Модель позы не загрузилась/);
    expect(document.querySelector('[data-bb="pose-result"]')).toBeNull();
  });

  it('поза не найдена → своё сообщение (не путать с «нет модели»)', async () => {
    const analyze = vi.fn(async () => summarizeBbPose([[]], 'side'));
    render(<Harness analyze={analyze} />);
    pickVideo();
    fireEvent.click(document.querySelector('[data-bb="pose-analyze"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-bb="pose-status"]')).not.toBeNull());
    expect(document.querySelector('[data-bb="pose-status"]')!.textContent).toMatch(/Поза не распознана/);
    expect(document.querySelector('[data-bb="pose-result"]')).toBeNull();
  });
});
