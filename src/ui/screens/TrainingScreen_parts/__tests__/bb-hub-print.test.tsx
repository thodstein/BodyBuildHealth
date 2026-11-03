/**
 * bb-hub-print.test.tsx — BB-G-07: «Печать» реально печатает, а не молча скачивает.
 *
 * История: кнопка «🖨 Печать» вызывала downloadHtml — печать не открывалась вообще.
 * Теперь печатаем отчёт в отдельном окне; если окно заблокировано/упало — честно
 * говорим и сохраняем HTML (пользователь печатает его сам). Оба пути под локом:
 * иначе «честный откат» снова превратится в молчаливое «✓ готово».
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const printBtn = () => document.querySelector('[data-bb="export-print"]') as HTMLElement | null;

describe('BB-G-07 «Печать» отчёта', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('окно открылось: в него пишется HTML и вызывается print()', () => {
    const written: string[] = [];
    const fakeWin: any = {
      document: { write: (h: string) => { written.push(h); }, close: () => {} },
      focus: () => {},
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as any);
    render(<BBDiagnosticsHub />);
    fireEvent.click(printBtn()!);
    expect(openSpy).toHaveBeenCalled();
    expect(fakeWin.print).toHaveBeenCalledTimes(1);
    // в окно печати уходит тот же отчёт, что и в файл (не пустая страница)
    expect(written.join('')).toContain('ББ');
    expect(screen.getAllByText(/Печать открыта в новом окне/)[0]).toBeInTheDocument();
  });

  it('окно заблокировано: не врём «напечатано» — отдаём файл и предупреждение', () => {
    vi.spyOn(window, 'open').mockReturnValue(null as any);
    const clicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    (document as any).createElement = ((tag: string, ...rest: any[]) => {
      const el = origCreate(tag, ...rest) as any;
      if (tag === 'a') el.click = () => { clicks.push(String(el.download || el.href)); };
      return el;
    }) as any;
    try {
      render(<BBDiagnosticsHub />);
      fireEvent.click(printBtn()!);
      expect(clicks.length).toBe(1);
      expect(clicks[0]).toMatch(/\.html$/);
      expect(screen.getAllByText(/заблокировано/)[0]).toBeInTheDocument();
      expect(screen.queryByText(/Печать открыта в новом окне/)).toBeNull();
    } finally {
      (document as any).createElement = origCreate;
    }
  });
});
