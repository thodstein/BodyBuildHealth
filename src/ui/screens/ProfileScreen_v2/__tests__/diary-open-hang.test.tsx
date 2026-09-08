/**
 * diary-open-hang.test.tsx — дневники открываются и скроллятся в APK.
 * Регрессия «открыл — половина контента, виснет»:
 *  1. BPChart не глушит вертикальный скролл (touchAction pan-y, а не none).
 *  2. Оверлеи дневников несут явные края (фолбэк без inset).
 *  3. pf-inner имеет vh-фолбэк под dvh.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BPChart } from '../diaries/BPDiary/BPChart';

afterEach(() => cleanup());

const goals = { sleepHours: 8, weightKg: 80, systolicTarget: 120 };
const noop = () => {};

describe('Diary open — no scroll trap (APK)', () => {
  it('BPChart: вертикальный скролл разрешён', () => {
    const { container } = render(
      <BPChart
        data={[{ date: '2026-09-01', systolic: 120, diastolic: 80, pulse: 65 }]}
        goalSystolic={120}
        goalDiastolic={80}
        normalRange={{ low: 90, high: 120 }}
      />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).not.toBeNull();
    // 'none' убивает скролл страницы под пальцем; нужен pan-y.
    expect(svg.style.touchAction).not.toBe('none');
    expect(svg.style.touchAction).toBe('pan-y');
  });

  const edgeCases = [
    ['.sleep-window', 'sleep', () => import('../diaries/SleepDiary/SleepDiary').then(m => m.SleepDiary)],
    ['.bp-window', 'bp', () => import('../diaries/BPDiary/BPDiary').then(m => m.BPDiary)],
    ['.wd-diary', 'weight', () => import('../diaries/WeightDiary/WeightDiary').then(m => m.WeightDiary)],
    ['.injection-window', 'injection', () => import('../diaries/InjectionDiary/InjectionDiary').then(m => m.InjectionDiary)],
    ['.health-window', 'health', () => import('../diaries/HealthDiary/HealthDiary').then(m => m.HealthDiary)],
  ] as const;
  for (const [sel, key, load] of edgeCases) {
    it(`оверлей ${key}: явные края top/left/right/bottom`, async () => {
      const C: any = await load();
      const { container } = render(
        <C open onClose={noop} diaryKey={key} goals={goals} onDataChange={noop} />,
      );
      const el = container.querySelector(sel) as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.style.position).toBe('fixed');
      expect(el.style.top).toBe('0px');
      expect(el.style.left).toBe('0px');
      expect(el.style.right).toBe('0px');
      expect(el.style.bottom).toBe('0px');
    });
  }

  it('pf-inner: vh-фолбэк под dvh в styles-native.css', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src', 'styles-native.css'),
      'utf-8',
    );
    const idx = css.indexOf('.pf-inner');
    expect(idx).toBeGreaterThan(-1);
    const block = css.slice(idx, idx + 400);
    expect(block).toContain('100vh');
    expect(block).toContain('100dvh');
    // vh обязан идти первым (каскадный фолбэк).
    expect(block.indexOf('100vh')).toBeLessThan(block.indexOf('100dvh'));
  });
});
