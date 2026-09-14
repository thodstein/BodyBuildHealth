/**
 * pharma-course-add.test.tsx — кнопка добавления не исчезает после первого препарата.
 *
 * Регрессия на жалобу «Фарма → Мой курс: нельзя добавить больше одного препарата,
 * кнопка исчезает (АПК)»: empty-state кнопка «+ Добавить первый препарат» живёт
 * только при пустом курсе, а шапочная «+ Добавить» на телефоне уезжает вверх за
 * экран — пользователь видел «кнопки нет». Фикс — постоянный CTA внизу списка.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../core/db', () => {
  const mem = new Map<string, any>();
  return {
    db: {
      init: async () => {},
      getAll: async () => Array.from(mem.values()),
      put: async (_s: string, v: any) => { mem.set(v.id, v); },
      delete: async (_s: string, id: string) => { mem.delete(id); },
    },
  };
});
vi.mock('../../../core/data-link', () => ({ notifyDataChange: () => {} }));
vi.mock('../../../core/native-bridge', () => ({
  scheduleWeeklyReminders: async () => 0,
  cancelScheduledReminders: async () => {},
}));
vi.mock('../../../core/apk-share', () => ({
  copyOrShareText: async () => 'ok',
  saveTextFileApk: async () => 'ok',
  shareOutcomeLabel: (o: string) => o,
}));

import { PharmaCourseScreen } from '../PharmaCourseScreen';
import { SUBSTANCES_BY_CLASS } from '../../../core/pharma-database';

describe('Мой курс — добавление нескольких препаратов', () => {
  beforeEach(() => { localStorage.clear(); });

  it('нижний CTA виден после 1-го препарата и добавляет 2-й', async () => {
    const subs = SUBSTANCES_BY_CLASS['testosterone'] ?? [];
    expect(subs.length).toBeGreaterThanOrEqual(2);
    render(<PharmaCourseScreen />);
    await waitFor(() => expect(screen.queryByText('Загрузка курса...')).toBeNull());

    // пустой курс: только empty-state кнопка, нижнего CTA нет
    expect(screen.getByRole('button', { name: '+ Добавить первый препарат' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Добавить ещё препарат' })).toBeNull();

    // добавляем первый через empty-state
    fireEvent.click(screen.getByRole('button', { name: '+ Добавить первый препарат' }));
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    fireEvent.click(screen.getByText(subs[0].name));
    await waitFor(() => expect(screen.queryByText('Добавить препарат')).toBeNull());

    // FIX: нижний CTA появился и не исчезает
    const moreBtn = await screen.findByRole('button', { name: 'Добавить ещё препарат' });
    expect(moreBtn).toBeTruthy();

    // второй препарат — через нижний CTA, шапку трогать не нужно
    fireEvent.click(moreBtn);
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    fireEvent.click(screen.getByText(subs[1].name));
    await waitFor(() => expect(screen.queryByText('Добавить препарат')).toBeNull());

    const html = document.body.textContent || '';
    expect(html.includes(subs[0].name)).toBe(true);
    expect(html.includes(subs[1].name)).toBe(true);
    // CTA на месте и после второго добавления
    expect(screen.getByRole('button', { name: 'Добавить ещё препарат' })).toBeTruthy();
  });
});
