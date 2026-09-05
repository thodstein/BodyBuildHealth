/**
 * pull-to-refresh-native.test.tsx — жест вниз с верха скролла обновляет,
 * всё остальное игнорируется. Только APK-хук, TG/web его не монтируют.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { usePullToRefresh } from '../native/usePullToRefresh';

vi.mock('../../core/native-bridge', () => ({ haptics: vi.fn() }));

const Probe: React.FC<{ onRefresh: () => Promise<void> | void }> = ({ onRefresh }) => {
  const ptr = usePullToRefresh({ onRefresh });
  return (
    <div
      ref={ptr.containerRef as React.RefObject<HTMLDivElement>}
      data-testid="scroll"
      style={{ overflowY: 'auto', height: 400 }}
    >
      <div
        ref={ptr.indicatorRef as React.RefObject<HTMLDivElement>}
        data-testid="bar"
        style={{ height: 0 }}
      />
      <div data-testid="state">{ptr.refreshing ? 'refreshing' : ptr.pulling ? 'pulling' : 'idle'}</div>
    </div>
  );
};

function pull(el: Element, fromY: number, toY: number, steps = 1) {
  fireEvent.touchStart(el, { touches: [{ clientX: 50, clientY: fromY }] });
  for (let i = 1; i <= steps; i++) {
    fireEvent.touchMove(el, {
      touches: [{ clientX: 50, clientY: fromY + ((toY - fromY) * i) / steps }],
    });
  }
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 50, clientY: toY }] });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

afterEach(() => {
  cleanup();
});

describe('usePullToRefresh', () => {
  it('длинный пул сверху → onRefresh один раз, индикатор гаснет', async () => {
    let calls = 0;
    const { getByTestId } = render(
      <Probe
        onRefresh={async () => {
          calls += 1;
        }}
      />,
    );
    const el = getByTestId('scroll');
    pull(el, 100, 320);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
    expect((getByTestId('bar') as HTMLElement).style.height).toBe('0px');
  });

  it('короткий пул → без обновления', async () => {
    let calls = 0;
    const { getByTestId } = render(<Probe onRefresh={async () => { calls += 1; }} />);
    pull(getByTestId('scroll'), 100, 115);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(0);
  });

  it('горизонтальный свайп и не-верх скролла → без обновления', async () => {
    let calls = 0;
    const { getByTestId, rerender } = render(
      <Probe onRefresh={async () => { calls += 1; }} />,
    );
    const el = getByTestId('scroll');
    // Горизонталь: dx >> dy.
    fireEvent.touchStart(el, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 250, clientY: 110 }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 250, clientY: 110 }] });
    // Середина списка.
    (el as HTMLElement).scrollTop = 200;
    pull(el, 300, 500);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(0);
    rerender(<Probe onRefresh={async () => { calls += 1; }} />);
  });

  it('ошибка onRefresh не вешает индикатор', async () => {
    const { getByTestId } = render(
      <Probe
        onRefresh={async () => {
          throw new Error('offline');
        }}
      />,
    );
    const el = getByTestId('scroll');
    pull(el, 100, 320);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect((getByTestId('bar') as HTMLElement).style.height).toBe('0px');
    expect(getByTestId('state').textContent).toBe('idle');
  });
});
