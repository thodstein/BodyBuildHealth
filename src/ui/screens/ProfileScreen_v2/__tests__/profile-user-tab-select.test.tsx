/**
 * profile-user-tab-select.test.tsx — регрессия «нельзя выбрать значения»:
 * попап PopupValueEditor рендерится через createPortal в document.body,
 * чтобы не обрезаться карточкой-аккордеоном (backdrop-filter + overflow:hidden).
 * Плюс Esc-закрытие и кэш getSnapshotsCount.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act, cleanup } from '@testing-library/react';
import { ProfileUserTab } from '../ProfileUserTab';
import { ProfileSettingsTab } from '../ProfileSettingsTab';
import { getSnapshotsCount, pushSnapshot, clearSnapshots, _resetProfileModuleStateForTests } from '../../../../core/profile-manager';

const baseProfile = (): Record<string, any> => ({
  name: 'Тест',
  id: 't1',
  role: 'user',
  settings: {
    personal: { age: 30, sex: 'male', height: 180, weight: 85, bodyFat: 15 },
    training: { primaryGoal: 'bulk', daysPerWeek: 4, minutesPerSession: 70, weakPoints: ['chest_upper'], equipment: ['barbell'], workMax: { squat: 140, bench: 100, deadlift: 180 } },
    pharma: {},
    health: {},
    nutrition: {},
    lifestyle: {},
    system: {},
    goals: {},
    labs: { summary: [] },
    symptoms: { recent: [] },
  },
});

const openTrainingProfile = () => {
  const btn = screen.getAllByRole('button', { name: /2\.1 Профиль/ })[0];
  fireEvent.click(btn);
};

const flushDebounce = async () => {
  await act(async () => { vi.advanceTimersByTime(1200); });
};

beforeEach(() => {
  localStorage.clear();
  _resetProfileModuleStateForTests();
  localStorage.setItem('he_profile_v2', JSON.stringify(baseProfile()));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('PopupValueEditor — выбор значений (портал)', () => {
  it('Уровень: попап открывается, опция выбирается, значение сохраняется и показывается', async () => {
    render(<ProfileUserTab />);
    openTrainingProfile();

    fireEvent.click(screen.getByRole('button', { name: /Уровень: —/ }));
    const dialog = screen.getByRole('dialog', { name: 'Уровень' });
    // Попап рендерится ПРЯМО в body (не внутри карточки с backdrop-filter/overflow:hidden)
    expect(dialog.parentElement).toBe(document.body);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'advanced' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    // Значение отобразилось на карточке поля
    expect(screen.getByRole('button', { name: /Уровень: Продвинутый/ })).toBeTruthy();
    // Попап закрыт после сохранения
    expect(screen.queryByRole('dialog', { name: 'Уровень' })).toBeNull();

    await flushDebounce();
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.training.level).toBe('advanced');
  });

  it('Escape закрывает попап без сохранения', () => {
    render(<ProfileUserTab />);
    openTrainingProfile();

    fireEvent.click(screen.getByRole('button', { name: /^Уровень/ }));
    expect(screen.getByRole('dialog', { name: 'Уровень' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Уровень' })).toBeNull();
    // Значение не сохранилось
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.training.level).toBeUndefined();
  });

  it('клик по подложке (вне карточки) закрывает попап', () => {
    render(<ProfileUserTab />);
    openTrainingProfile();

    fireEvent.click(screen.getByRole('button', { name: /^Уровень/ }));
    const dialog = screen.getByRole('dialog', { name: 'Уровень' });
    fireEvent.click(dialog); // клик по overlay (не по внутренней карточке)
    expect(screen.queryByRole('dialog', { name: 'Уровень' })).toBeNull();
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.training.level).toBeUndefined();
  });

  it('числовой попап (Стаж) тоже в портале и сохраняет число', async () => {
    render(<ProfileUserTab />);
    openTrainingProfile();

    fireEvent.click(screen.getByRole('button', { name: /Стаж: —/ }));
    expect(screen.getByRole('dialog', { name: 'Стаж' }).parentElement).toBe(document.body);

    const input = screen.getByPlaceholderText('—') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await flushDebounce();
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.training.experience).toBe(3.5);
  });
});

describe('Попапы — отображение пустых/заполненных состояний', () => {
  it('HDL: без данных → «—», false → «Норма», true → «Низкий»', () => {
    const renderWithHdl = (hdlLow: boolean | undefined) => {
      _resetProfileModuleStateForTests();
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      if (hdlLow === undefined) delete p.settings.health.hdlLow;
      else p.settings.health.hdlLow = hdlLow;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      render(<ProfileUserTab />);
      fireEvent.click(screen.getAllByRole('button', { name: /1\.2 Здоровье/ })[0]);
      return screen;
    };

    expect(renderWithHdl(undefined).getByRole('button', { name: /HDL: —/ })).toBeTruthy();
    cleanup();
    expect(renderWithHdl(false).getByRole('button', { name: /HDL: Норма/ })).toBeTruthy();
    cleanup();
    expect(renderWithHdl(true).getByRole('button', { name: /HDL: Низкий/ })).toBeTruthy();
  });

  it('Базовый HRV: подпись значения не дублирует диапазон', () => {
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    p.settings.lifestyle.baselineHrvRatio = 1;
    localStorage.setItem('he_profile_v2', JSON.stringify(p));

    render(<ProfileUserTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /1\.4 Образ жизни/ })[0]);
    const btn = screen.getByRole('button', { name: /Базовый HRV/ });
    expect(btn.textContent).toContain('1 коэф.');
    expect(btn.textContent).not.toContain('0.5-1.5');
  });

  it('Monte Carlo: без значения показывает «—», выбор сохраняет число', () => {
    render(<ProfileSettingsTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /4\.1 Системные/ })[0]);
    expect(screen.getByRole('button', { name: /Monte Carlo прогонов: —/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Monte Carlo прогонов: —/ }));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: /Monte Carlo прогонов: 5000/ })).toBeTruthy();
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.system.mcRuns).toBe(5000);
  });
});

describe('getSnapshotsCount — кэш без повторного парсинга', () => {  it('считается и обновляется после pushSnapshot', () => {
    expect(getSnapshotsCount()).toBe(0);
    pushSnapshot();
    expect(getSnapshotsCount()).toBe(1);
    pushSnapshot();
    pushSnapshot();
    expect(getSnapshotsCount()).toBe(3);
  });

  it('не читает localStorage повторно, пока счётчик не инвалидирован', () => {
    clearSnapshots(); // инвалидирует модульный кэш (после прошлого теста в нём 3)
    const spy = vi.spyOn(window.localStorage, 'getItem');
    expect(getSnapshotsCount()).toBe(0);
    expect(getSnapshotsCount()).toBe(0);
    // Первый вызов прочитал ключ снапшотов, повторные — нет
    const snapshotReads = spy.mock.calls.filter(c => c[0] === 'he_profile_snapshots_v1').length;
    expect(snapshotReads).toBe(1);
    spy.mockRestore();
  });
});
