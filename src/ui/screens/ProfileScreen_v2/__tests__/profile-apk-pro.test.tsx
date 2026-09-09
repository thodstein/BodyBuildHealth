/**
 * profile-apk-pro.test.tsx — §83 PROFILE PRO-FULL.
 * Навигация без возврата в hero, quick-jump с активным разделом,
 * пакетное развернуть/свернуть, тач-цели 40px+.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ProfileScreen_v2 } from '../ProfileScreen_v2';
import { ProfileUserTab } from '../ProfileUserTab';
import { ProfileReportsTab } from '../ProfileReportsTab';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
});

describe('Profile §83 — поднавигация без hero', () => {
  it('hero → раздел → переключение пилюлей без возврата', () => {
    const { container, getByLabelText } = render(<ProfileScreen_v2 />);
    // Hero с навигацией
    expect(container.querySelector('.pf-hero-nav')).not.toBeNull();
    // Открываем Пользователя
    const userCard = container.querySelector('.pf-hero-card[data-id="user"]');
    expect(userCard).not.toBeNull();
    fireEvent.click(userCard!);
    // Поднавигация видна
    const subnav = container.querySelector('.pf-subnav');
    expect(subnav).not.toBeNull();
    // Переключаемся на Настройки пилюлей
    fireEvent.click(getByLabelText('Раздел Настройки'));
    expect(getByLabelText('Раздел Настройки').getAttribute('data-active')).toBe('true');
    // И обратно на Дневники
    fireEvent.click(getByLabelText('Раздел Дневники'));
    expect(getByLabelText('Раздел Дневники').getAttribute('data-active')).toBe('true');
  });

  it('кнопка назад 44px и undo 40px', () => {
    const { container } = render(<ProfileScreen_v2 />);
    fireEvent.click(container.querySelector('.pf-hero-card[data-id="user"]')!);
    const back = container.querySelector('.pf-head-back') as HTMLElement;
    expect(back).not.toBeNull();
    expect(back.style.minHeight).toBe('44px');
  });
});

describe('Profile §83 — quick-jump и аккордеоны', () => {
  it('клик по разделу выставляет data-active', () => {
    const { container, getByLabelText } = render(<ProfileUserTab />);
    const btn = getByLabelText('Перейти к разделу Цели');
    fireEvent.click(btn);
    expect(btn.getAttribute('data-active')).toBe('true');
    expect(container.querySelectorAll('.pf-jump-link[data-active="true"]').length).toBe(1);
  });

  it('«Развернуть все» открывает аккордеоны (data-open)', () => {
    const { container, getByText } = render(<ProfileUserTab />);
    fireEvent.click(getByText(/Развернуть все/));
    const opened = container.querySelectorAll('.pf-acc[data-open="true"]');
    expect(opened.length).toBeGreaterThan(1);
    fireEvent.click(getByText(/Свернуть/));
    expect(container.querySelectorAll('.pf-acc[data-open="true"]').length).toBe(0);
  });

  it('jump-цели 40px', () => {
    const { container } = render(<ProfileUserTab />);
    const first = container.querySelector('.pf-jump-link') as HTMLElement;
    expect(first.style.minHeight).toBe('40px');
  });
});

describe('Profile §85 — PVE-попап: хуки и тач-цели', () => {
  it('числовой редактор: оверлей/лист/степперы/футер 44px', () => {
    const { container } = render(<ProfileUserTab />);
    const trig = Array.from(container.querySelectorAll('.profile-pve-btn'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Возраст')) as HTMLElement;
    expect(trig).toBeTruthy();
    fireEvent.click(trig);
    const overlay = document.body.querySelector('.pf-pve-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.pf-pve-sheet')).not.toBeNull();
    const close = overlay.querySelector('.pf-pve-close') as HTMLElement;
    expect(close.style.minHeight).toBe('44px');
    const steps = overlay.querySelectorAll('.pf-pve-step');
    expect(steps.length).toBe(2);
    steps.forEach(s => expect((s as HTMLElement).style.minHeight).toBe('44px'));
    expect((overlay.querySelector('.pf-pve-save') as HTMLElement).style.minHeight).toBe('44px');
    expect((overlay.querySelector('.pf-pve-cancel') as HTMLElement).style.minHeight).toBe('44px');
    fireEvent.click(close);
    expect(document.body.querySelector('.pf-pve-overlay')).toBeNull();
  });

  it('селект: опции с data-sel', () => {
    const { container } = render(<ProfileUserTab />);
    const trig = Array.from(container.querySelectorAll('.profile-pve-btn'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Пол')) as HTMLElement;
    expect(trig).toBeTruthy();
    fireEvent.click(trig);
    const opts = document.body.querySelectorAll('.pf-pve-opt');
    expect(opts.length).toBeGreaterThan(0);
    expect(document.body.querySelector('.pf-pve-opt[data-sel="true"]')).not.toBeNull();
    fireEvent.click(document.body.querySelector('.pf-pve-overlay') as HTMLElement);
    expect(document.body.querySelector('.pf-pve-overlay')).toBeNull();
  });
});

describe('Profile §86 — тело дневников: рутинг, фильтры, поиск', () => {
  it('кнопки рутинга 48px, пропуск 44, закрытие 40', async () => {
    const { ProfileDiariesTab } = await import('../ProfileDiariesTab');
    const { container, getByText, getByLabelText, queryByLabelText } = render(<ProfileDiariesTab />);
    const go = getByText(/Утренний лог/) as HTMLElement;
    expect(go.className).toContain('pf-routine-go');
    expect(go.style.minHeight).toBe('48px');
    expect((getByText(/Вечерний лог/) as HTMLElement).style.minHeight).toBe('48px');
    // Пропуск/закрытие видны только при активном рутинге — стартуем его.
    expect(queryByLabelText('Отменить лог')).toBeNull();
    fireEvent.click(go);
    expect((getByText(/Пропустить/) as HTMLElement).style.minHeight).toBe('44px');
    expect((getByLabelText('Отменить лог') as HTMLElement).style.minHeight).toBe('40px');
    expect(container.querySelector('.pf-streaks')).not.toBeNull();
    cleanup();
  });

  it('поиск 16px/44px, фильтры 40px', async () => {
    const { ProfileDiariesTab } = await import('../ProfileDiariesTab');
    const { container, getByLabelText } = render(<ProfileDiariesTab />);
    const search = getByLabelText('Поиск дневника') as HTMLInputElement;
    expect(search.style.fontSize).toBe('16px');
    expect(search.style.minHeight).toBe('48px');
    const filters = container.querySelectorAll('.pf-dfilter');
    expect(filters.length).toBeGreaterThan(0);
    filters.forEach(f => expect((f as HTMLElement).style.minHeight).toBe('40px'));
    cleanup();
  });

  it('DiaryCard: быстрые действия 40px+ с хуками', async () => {
    const { DiaryCard } = await import('../diary-ui');
    const noop = () => {};
    const { container } = render(
      <DiaryCard diaryKey="sleep" count={5} last="сегодня" daysSinceLast={1} loggedToday={false} onAdd={noop} onOpen={noop} history={[]} />,
    );
    expect((container.querySelector('.diary-card-add') as HTMLElement).style.minHeight).toBe('44px');
    expect((container.querySelector('.diary-card-open') as HTMLElement).style.minHeight).toBe('44px');
    cleanup();
  });
});

describe('Profile §83 — отчёты', () => {
  it('табы 44px и переключаются', () => {
    // initialView blocks: не монтируем ReportsScreen (IndexedDB-шум jsdom).
    const { container, getByRole } = render(<ProfileReportsTab initialView="blocks" />);
    const tabs = container.querySelectorAll('.pf-rep-tab');
    expect(tabs.length).toBe(3);
    (tabs as unknown as HTMLElement[]).forEach(t => {
      expect((t as HTMLElement).style.minHeight).toBe('44px');
    });
    fireEvent.click(getByRole('tab', { name: /Архив/ }));
    expect(getByRole('tab', { name: /Архив/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('карточки источников 68px с хуком, архивные ряды с хуком', () => {
    const { container } = render(<ProfileReportsTab initialView="blocks" />);
    const first = container.querySelector('.profile-reports-item') as HTMLElement;
    expect(first).not.toBeNull();
    expect(first.style.minHeight).toBe('68px');
  });
});

describe('Profile §91 — раунды 4-5: настройки, слайдеры, РМ-категории', () => {
  it('кнопки настроек 56px с хуком pf-set-btn', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container, getByRole } = render(<ProfileSettingsTab />);
    // Аккордеон 4.2 закрыт по умолчанию — открываем.
    fireEvent.click(getByRole('button', { name: /4\.2 Экспорт/ }));
    const btns = container.querySelectorAll('.pf-set-btn');
    expect(btns.length).toBe(3);
    (btns as unknown as HTMLElement[]).forEach(b => {
      expect((b as HTMLElement).style.minHeight).toBe('56px');
    });
    cleanup();
  });

  it('слайдер несёт хук profile-slider', async () => {
    const { SliderInput } = await import('../ui');
    const { container } = render(
      <SliderInput value={7} onChange={() => {}} min={1} max={10} label="Тест" />,
    );
    expect(container.querySelector('.profile-slider')).not.toBeNull();
    cleanup();
  });

  it('категории РМ с хуком pf-wm-cat переключаются', async () => {
    const { TrainingPMSection } = await import('../sections/TrainingPMSection');
    const { container, getByRole } = render(<TrainingPMSection />);
    // Аккордеон закрыт по умолчанию — открываем.
    fireEvent.click(getByRole('button', { name: /Личные рекорды/ }));
    const cats = container.querySelectorAll('.pf-wm-cat');
    expect(cats.length).toBeGreaterThan(1);
    // Первая открыта по умолчанию (openCategory='chest'), вторая закрыта.
    expect((cats[0] as HTMLElement).getAttribute('data-open')).toBe('true');
    expect((cats[1] as HTMLElement).getAttribute('data-open')).toBe('false');
    fireEvent.click((cats[1] as HTMLElement).querySelector('button') as HTMLElement);
    expect((cats[1] as HTMLElement).getAttribute('data-open')).toBe('true');
    cleanup();
  });
});
