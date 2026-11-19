/**
 * pharma-course-add.test.tsx — добавление препаратов в «Мой курс».
 *
 * 1. Регрессия на жалобу «Фарма → Мой курс: нельзя добавить больше одного препарата,
 *    кнопка исчезает (АПК)»: empty-state кнопка «+ Добавить первый препарат» живёт
 *    только при пустом курсе, а шапочная «+ Добавить» на телефоне уезжает вверх за
 *    экран — пользователь видел «кнопки нет». Фикс — постоянный CTA внизу списка.
 * 2. Тап на препарат больше не добавляет его молча: открывается попап с дозировкой,
 *    частотой уколов и началом/концом курса — в курс препарат попадает только
 *    после «Добавить в курс».
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
    __resetDb: () => mem.clear(),
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
import { SUBSTANCES_BY_CLASS, getPharmaDetail } from '../../../core/pharma-database';
import * as dbModule from '../../../core/db';

/** Дни недели по рекомендованной частоте — как в попапе (0=Пн). */
function expectedDays(freq: string): number {
  const s = freq.toLowerCase();
  if (s.includes('/d') || s === 'daily') return 7;
  if (s === 'eod') return 4;
  const m = s.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*x\s*\/\s*w/);
  if (!m) return 2;
  return Math.round((parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) : parseFloat(m[1]))) / 2);
}

describe('Мой курс — добавление нескольких препаратов', () => {
  beforeEach(() => {
    localStorage.clear();
    (dbModule as any).__resetDb?.();
  });

  it('попап настройки показывает дозу, частоту и недели, затем добавляет препарат', async () => {
    const subs = SUBSTANCES_BY_CLASS['testosterone'] ?? [];
    expect(subs.length).toBeGreaterThanOrEqual(2);
    const first = subs[0];
    const range = getPharmaDetail(first.id)!.dosageRange!;
    const midDose = Math.round((range.min + range.max) / 2);

    render(<PharmaCourseScreen />);
    await waitFor(() => expect(screen.queryByText('Загрузка курса...')).toBeNull());

    // пустой курс: только empty-state кнопка, нижнего CTA нет
    expect(screen.getByRole('button', { name: '+ Добавить первый препарат' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Добавить ещё препарат' })).toBeNull();

    // добавляем первый через empty-state
    fireEvent.click(screen.getByRole('button', { name: '+ Добавить первый препарат' }));
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());

    // тап на препарат → попап настройки, в курс пока ничего не ушло
    fireEvent.click(screen.getByText(first.name));
    await waitFor(() => expect(screen.getByText('Дозировка')).toBeTruthy());
    expect(screen.getByText('Частота уколов')).toBeTruthy();
    expect(screen.getByText('Начало и конец курса')).toBeTruthy();

    // доза предзаполнена серединой рекомендованного диапазона
    const doseInput = screen.getByLabelText('Дозировка препарата') as HTMLInputElement;
    expect(doseInput.value).toBe(String(midDose));
    expect((screen.getByLabelText('Единица дозировки') as HTMLSelectElement).value).toBe(
      range.unit.includes('/wk') ? 'mg/wk' : range.unit.toLowerCase().startsWith('iu') ? 'IU' : range.unit.toLowerCase().startsWith('mcg') ? 'mcg' : 'mg',
    );

    // частота — по рекомендации базы
    const pressedDays = screen.getAllByRole('button', { pressed: true });
    expect(pressedDays.length).toBe(expectedDays(range.frequency));

    // недели курса по умолчанию 0 → 12
    expect((screen.getByLabelText('Начало курса, неделя') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('Конец курса, неделя') as HTMLInputElement).value).toBe('12');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить в курс' }));
    await waitFor(() => expect(screen.queryByText('Частота уколов')).toBeNull());

    // препарат реально в курсе (доза/частота/недели)
    const html = document.body.textContent || '';
    expect(html.includes(first.name)).toBe(true);
    expect(html.includes(`${midDose}`)).toBe(true);

    // FIX: нижний CTA появился и не исчезает
    const moreBtn = await screen.findByRole('button', { name: 'Добавить ещё препарат' });
    expect(moreBtn).toBeTruthy();

    // второй препарат — через нижний CTA, шапку трогать не нужно
    const second = subs[1];
    fireEvent.click(moreBtn);
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    fireEvent.click(screen.getByText(second.name));
    await waitFor(() => expect(screen.getByText('Дозировка')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в курс' }));
    await waitFor(() => expect(screen.queryByText('Частота уколов')).toBeNull());

    const finalHtml = document.body.textContent || '';
    expect(finalHtml.includes(first.name)).toBe(true);
    expect(finalHtml.includes(second.name)).toBe(true);
    // CTA на месте и после второго добавления
    expect(screen.getByRole('button', { name: 'Добавить ещё препарат' })).toBeTruthy();
  });

  it('попап: отмена и «Назад» не добавляют препарат', async () => {
    const subs = SUBSTANCES_BY_CLASS['testosterone'] ?? [];
    render(<PharmaCourseScreen />);
    await waitFor(() => expect(screen.queryByText('Загрузка курса...')).toBeNull());

    // база в моке общая на файл: курс может быть непустым — открываем любую из кнопок
    const openBtn = screen.queryByRole('button', { name: '+ Добавить первый препарат' })
      ?? screen.getByRole('button', { name: 'Добавить ещё препарат' });
    fireEvent.click(openBtn);
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    fireEvent.click(screen.getByText(subs[0].name));
    await waitFor(() => expect(screen.getByText('Дозировка')).toBeTruthy());

    // «Назад» возвращает к списку препаратов
    fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    expect(screen.queryByText('Дозировка')).toBeNull();

    // закрытие крестиком ничего не добавляет
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть выбор препарата' }));
    await waitFor(() => expect(screen.queryByText('Добавить препарат')).toBeNull());
    expect(screen.queryByText('Частота уколов')).toBeNull();
    expect(document.body.textContent || '').not.toContain(subs[0].name);
  });

  it('пептид без диапазона в базе: единица mcg, доза пустая, добавление ждёт дозу', async () => {
    const subs = SUBSTANCES_BY_CLASS['peptide_ghrh'] ?? [];
    const pep = subs.find(s => !getPharmaDetail(s.id)?.dosageRange);
    if (!pep) return; // в базе появились диапазоны — сценарий невоспроизводим

    render(<PharmaCourseScreen />);
    await waitFor(() => expect(screen.queryByText('Загрузка курса...')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '+ Добавить первый препарат' }));
    await waitFor(() => expect(screen.getByText('Добавить препарат')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /GHRH/ }));
    await waitFor(() => expect(screen.getByText(pep.name)).toBeTruthy());
    fireEvent.click(screen.getByText(pep.name));

    await waitFor(() => expect(screen.getByText('Дозировка')).toBeTruthy());
    expect(screen.getByText('нет в базе')).toBeTruthy();
    expect((screen.getByLabelText('Единица дозировки') as HTMLSelectElement).value).toBe('mcg');
    expect((screen.getByLabelText('Дозировка препарата') as HTMLInputElement).value).toBe('');

    const addBtn = screen.getByRole('button', { name: 'Добавить в курс' }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Дозировка препарата'), { target: { value: '150' } });
    expect(addBtn.disabled).toBe(false);
  });
});
