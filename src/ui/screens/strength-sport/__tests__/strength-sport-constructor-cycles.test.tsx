import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

beforeEach(() => { localStorage.clear(); });

function goToSplit(container: HTMLElement) {
  fireEvent.click(screen.getByText(/Далее → Вне зала/));
  fireEvent.click(screen.getByText(/Далее → Сплит/));
  expect(container.textContent).toContain('Интернет-цикл');
}

describe('StrengthSportConstructor: интернет-циклы', () => {
  it('шаг сплит показывает карточку цикла, по умолчанию без цикла', () => {
    const { container } = render(<StrengthSportConstructor />);
    goToSplit(container);
    expect(screen.getByLabelText('Цикл')).toBeTruthy();
    // Дословный тоггл появляется только после выбора цикла
    expect(container.textContent).not.toContain('Дословно');
  });

  it('выбор ТА общей базы + сборка → план cycle:ss-ta-general-8', async () => {
    const { container } = render(<StrengthSportConstructor />);
    goToSplit(container);
    fireEvent.click(screen.getByLabelText('Цикл'));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Цикл' })).getByText(/общая база/));
    await waitFor(() => expect(container.textContent).toContain('Дословно'));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('cycle:ss-ta-general-8'), { timeout: 5000 });
    expect(container.textContent).toContain('План 8нед');
  });

  it('advanced + согласие разблокируют болгарский daily-max', async () => {
    const { container } = render(<StrengthSportConstructor />);
    // Уровень → Продвинутый (params)
    fireEvent.click(screen.getByLabelText('Уровень'));
    fireEvent.click(await screen.findByText('Продвинутый'));
    goToSplit(container);
    // Чекбокс согласия виден (блокировка именно по согласию)
    const consent = await screen.findByText(/Понимаю риск daily-max/);
    expect(consent).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByLabelText('Цикл'));
    fireEvent.click(await screen.findByText(/болгарский максимум/));
    await waitFor(() => expect(container.textContent).toContain('Дословно'));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('cycle:ss-ta-bulgarian'), { timeout: 5000 });
    expect(container.textContent).toContain('Daily-max');
  });

  it('кнопка года собирает год из выбранных циклов', async () => {
    const { container } = render(<StrengthSportConstructor />);
    goToSplit(container);
    fireEvent.click(screen.getByLabelText('Цикл'));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Цикл' })).getByText(/общая база/));
    await waitFor(() => expect(container.textContent).toContain('Дословно'));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('cycle:ss-ta-general-8'), { timeout: 5000 });
    // Annual-карточка появляется (автосборка из истории), жмём год из циклов
    const yearBtn = await screen.findByText(/Год из циклов/);
    fireEvent.click(yearBtn);
    await waitFor(() => expect(container.textContent).toContain('Год из циклов:'), { timeout: 5000 });
  });

  it('chips года переключают выбор (счётчик кнопки)', async () => {
    const { container } = render(<StrengthSportConstructor />);
    goToSplit(container);
    fireEvent.click(screen.getByLabelText('Цикл'));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Цикл' })).getByText(/общая база/));
    await waitFor(() => expect(container.textContent).toContain('Дословно'));
    fireEvent.click(screen.getByText(/Собрать план/));
    await waitFor(() => expect(container.textContent).toContain('cycle:ss-ta-general-8'), { timeout: 5000 });
    // Кнопка показывает 3 по умолчанию; снимаем первый чип → 2
    expect(container.textContent).toContain('Год из циклов (3)');
    const chips = screen.getAllByText('ТА общая база — 8 недель (5 д/нед)', { exact: true });
    fireEvent.click(chips[chips.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('Год из циклов (2)'));
  });

  it('превью показывает понедельную структуру до сборки', async () => {
    const { container } = render(<StrengthSportConstructor />);
    goToSplit(container);
    fireEvent.click(screen.getByLabelText('Цикл'));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Цикл' })).getByText(/общая база/));
    await waitFor(() => expect(container.textContent).toContain('Н1·5д'));
    expect(container.textContent).toContain('Н8·5д');
  });
});
