/**
 * profile-deep-native.test.tsx — глубокий слой Профиля: quick-jump,
 * карточки дневников, отчёты, попап-редактор. Поведение не изменилось.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfileUserTab } from '../screens/ProfileScreen_v2/ProfileUserTab';
import { DiaryCard, SectionCard } from '../screens/ProfileScreen_v2/diary-ui';
import { ProfileReportsTab } from '../screens/ProfileScreen_v2/ProfileReportsTab';
import { PopupValueEditor } from '../screens/ProfileScreen_v2/ui';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  await resetPlatform();
});

describe('profile deep hooks', () => {
  it('1. UserTab: quick-jump из 9 ссылок с хуками', () => {
    const { container } = render(<ProfileUserTab />);
    expect(container.querySelector('.profile-jump')).not.toBeNull();
    expect(container.querySelector('.profile-jump-row')).not.toBeNull();
    expect(container.querySelectorAll('.profile-jump-link').length).toBe(9);
    expect(container.querySelector('.profile-user-sections')).not.toBeNull();
  });

  it('2. UserTab: клик по ссылке не роняет (нет секции в изоляции)', () => {
    render(<ProfileUserTab />);
    fireEvent.click(screen.getByLabelText('Перейти к разделу Питание'));
  });

  it('3. DiaryCard: классы, data-diary, stale-флаг', () => {
    const noop = () => {};
    const { container, rerender } = render(
      <DiaryCard diaryKey="sleep" count={0} last="" daysSinceLast={null} loggedToday={false} onAdd={noop} onOpen={noop} />,
    );
    const card = container.querySelector('.diary-card') as HTMLElement;
    expect(card?.dataset.diary).toBe('sleep');
    rerender(
      <DiaryCard diaryKey="weight" count={5} last="2026-01-01" daysSinceLast={10} loggedToday={false} onAdd={noop} onOpen={noop} />,
    );
    const stale = container.querySelector('.diary-card') as HTMLElement;
    expect(stale?.dataset.diary).toBe('weight');
    expect(stale?.dataset.stale).toBe('true');
  });

  it('4. DiaryCard: клик открывает дневник', () => {
    const onOpen = vi.fn();
    const noop = () => {};
    const { container } = render(
      <DiaryCard diaryKey="bp" count={3} last="2026-01-02" daysSinceLast={1} loggedToday={true} onAdd={noop} onOpen={onOpen} />,
    );
    fireEvent.click(container.querySelector('.diary-card') as HTMLElement);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('5. SectionCard несёт класс', () => {
    const { container } = render(
      <>
        <div className="probe-class">probe</div>
        <SectionCard icon="💤" title="Сон" color="#a78bfa">
          <div>тело</div>
        </SectionCard>
      </>,
    );
    expect(container.querySelector('.probe-class')).not.toBeNull();
    expect(container.querySelector('.diary-section')).not.toBeNull();
    // Локальная версия diary-ui (канон): заголовок — h3.
    // Дубликат из diary-modals рисует span — его здесь быть не должно.
    expect(container.querySelector('.diary-section h3')).not.toBeNull();
    expect(screen.getByText('Сон')).not.toBeNull();
  });

  it('6. ReportsTab: табы с data-active, список строк', () => {
    const { container } = render(<ProfileReportsTab initialView="blocks" />);
    expect(container.querySelector('.profile-reports')).not.toBeNull();
    const tabs = container.querySelectorAll('.profile-reports-tab');
    expect(tabs.length).toBeGreaterThan(0);
    expect(container.querySelector('.profile-reports-tab[data-active="true"]')).not.toBeNull();
    expect(container.querySelector('.profile-reports-list')).not.toBeNull();
    expect(container.querySelectorAll('.profile-reports-item').length).toBeGreaterThan(0);
  });

  it('7. ReportsTab: переключение таба работает', () => {
    const { container } = render(<ProfileReportsTab initialView="blocks" />);
    const tabs = container.querySelectorAll('.profile-reports-tab');
    const second = tabs[1] as HTMLElement;
    fireEvent.click(second);
    expect(second.dataset.active).toBe('true');
  });

  it('8. PopupValueEditor: кнопка с data-filled', () => {
    const { container } = render(
      <PopupValueEditor label="Вес" value={82.5} unit="кг" type="number" onChange={() => {}} />,
    );
    const btn = container.querySelector('.profile-pve-btn') as HTMLElement;
    expect(btn?.dataset.filled).toBe('true');
  });
});
