/** diary-record-addset: «+» в шапке упражнения добавляет подход именно ему. */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { DiaryRecordingForm } from '../DiaryRecordingForm';

const DAY = {
  exercises: [
    { name: 'Жим штанги лёжа', sets: 2, reps: 8 },
    { name: 'Приседания со штангой', sets: 2, reps: 5 },
  ],
};

const renderForm = () =>
  render(
    <DiaryRecordingForm
      diary={{ checkProgressionAlerts: async () => [] } as never}
      selectedWeek={1}
      onSave={() => {}}
      historyWorkouts={[]}
      pendingTemplate={DAY as never}
      templateKey={1}
    />,
  );

describe('DiaryRecordingForm — «+» на конкретном упражнении', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('«+» в шапке второго упражнения не дописывает подход первому', () => {
    const { container } = renderForm();
    const headers = Array.from(container.querySelectorAll('[data-pl="record-ex"]'));
    // Заголовки упражнений: «2 подхода» у обоих из шаблона
    expect(container.textContent).toContain('Жим штанги лёжа');
    expect(container.textContent).toContain('Приседания со штангой');

    const plus = Array.from(container.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === '+');
    expect(plus.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(plus[1]);

    const text = container.textContent || '';
    const firstBlock = headers.length > 0 ? headers[0].textContent || '' : '';
    // Второе упражнение получило третий подход, первое — нет
    expect(text).toContain('3 подхода');
    expect(firstBlock).not.toContain('3 подхода');
  });

  it('сохранение доступно в шапке формы, а не только в самом низу', () => {
    const { container } = renderForm();
    const top = container.querySelector('[data-act="record-save-top"]');
    expect(top).not.toBeNull();
    // Главная кнопка «💾 Сохранить тренировку» остаётся внизу — не дублируем её текст
    const bottom = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes('Сохранить тренировку'),
    );
    expect(bottom).toBeTruthy();
    expect(container.innerHTML.indexOf('record-save-top')).toBeLessThan(
      container.innerHTML.indexOf('Сохранить тренировку'),
    );
  });
});
