/** mix-hub-shell.test.tsx — шелл MixHub: кнопки экспорта + клавиатура MixChip. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MixHub } from '../MixHub';

beforeEach(() => {
  localStorage.clear();
});

describe('MixHub shell', () => {
  it('кнопки экспорта рендерятся', () => {
    const { container } = render(<MixHub />);
    expect(container.querySelector('[data-mix="export-html"]')).toBeTruthy();
    expect(container.querySelector('[data-mix="export-csv"]')).toBeTruthy();
  });

  it('цель выбирается клавиатурой (Enter)', () => {
    render(<MixHub />);
    const hiit = screen.getByRole('option', { name: /HIIT/ });
    expect(hiit.getAttribute('aria-selected')).toBe('false');
    (hiit as HTMLElement).focus();
    fireEvent.keyDown(hiit, { key: 'Enter' });
    expect(hiit.getAttribute('aria-selected')).toBe('true');
  });

  it('персист цели между маунтами', () => {
    const { unmount } = render(<MixHub />);
    fireEvent.click(screen.getByRole('option', { name: /Соревнования/ }));
    unmount();
    render(<MixHub />);
    expect(screen.getByRole('option', { name: /Соревнования/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('экспорт HTML печатает дневник, CSV скачивается', () => {
    localStorage.setItem('he_training_mixes', JSON.stringify([
      { id: 'm1', title: 'Микс', kind: 'mix', goal: 'pump', substances: [{ id: 'creatine', name: 'Креатин', dose: '5', unit: 'г', mg: 5000 }], recommendations: null, date: '2026-09-01', ts: 1 },
    ]));
    let printed = 0;
    (window as any).open = () => {
      printed++;
      return { document: { write: () => {}, close: () => {} }, print: () => {} };
    };
    let downloaded: string | null = null;
    (window.URL as any).createObjectURL = () => 'blob:x';
    (window.URL as any).revokeObjectURL = () => {};
    const origCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = (() => { downloaded = (el as HTMLAnchorElement).download; }) as any;
      }
      return el;
    }) as any;
    try {
      render(<MixHub />);
      fireEvent.click(screen.getByText(/Печать миксов/));
      expect(printed).toBe(1);
      fireEvent.click(screen.getByText(/CSV миксов/));
      expect(downloaded).toBe('mixes.csv');
    } finally {
      document.createElement = origCreate;
    }
  });
});
