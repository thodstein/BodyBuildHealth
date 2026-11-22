/**
 * training-compact-blocks.test.tsx — длинный хвост «Записи» и выбора дня.
 *
 * Два блока растягивали экран на несколько рядов, хотя нужны редко:
 *  - «Быстрые теги» заметок (10 чипов) в форме записи;
 *  - «Прогресс по упражнениям дня» (сетка карточек) в зоне проведения.
 * Оба теперь строки-аккордеоны: по умолчанию свёрнуты, содержимое остаётся в DOM.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import React from 'react';
import { DiaryRecordingForm } from '../screens/TrainingScreen_parts/DiaryRecordingForm';

describe('форма записи: теги заметок свёрнуты', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('по умолчанию скрыты, по кнопке раскрываются', () => {
    const { container } = render(<DiaryRecordingForm diary={{}} selectedWeek={1} onSave={() => {}} />);

    const toggle = container.querySelector('[data-act="record-tags"]') as HTMLElement | null;
    const body = container.querySelector('[data-pl="record-tags"]') as HTMLElement | null;
    expect(toggle).not.toBeNull();
    expect(body).not.toBeNull();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    expect(body!.style.display).toBe('none');
    // Контракт текстов не теряем: чипы остаются в разметке.
    expect(container.textContent).toContain('проблемы со сном');

    act(() => {
      fireEvent.click(toggle!);
    });
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(body!.style.display).toBe('flex');
  });
});

describe('зона проведения: прогресс дня — аккордеон', () => {
  it('свёрнут по умолчанию, заголовок — кнопка', () => {
    const src = readFileSync('src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx', 'utf8');
    expect(src).toContain('data-act="day-progress-toggle"');
    expect(src).toContain("display: progressOpen ? 'grid' : 'none'");
    expect(src).toContain('Прогресс по упражнениям дня');
  });
});
