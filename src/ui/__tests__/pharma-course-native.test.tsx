/**
 * pharma-course-native.test.tsx — волна 7 (Фарма): hero-карточки на SVG,
 * напоминания (префы/построение повторов), shell без эмодзи в хроме.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PharmaScreen } from '../screens/PharmaScreen_parts';
import {
  loadRemindPrefs,
  saveRemindPrefs,
  buildReminderItems,
  reminderIdForDay,
  allReminderIds,
  defaultRemindPrefs,
} from '../screens/PharmaScreen_parts/pharma-reminders';
import { jsDayToCapacitorWeekday } from '../../core/native-bridge';

function setCapacitorNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
  };
}

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  try {
    localStorage.clear();
  } catch {}
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

describe('Pharma hero (волна 7)', () => {
  it('hero-карточки рендерят SVG, не эмодзи', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    const cards = container.querySelectorAll('.pharma-hero-card svg');
    expect(cards.length).toBe(4);
  });

  it('web-классика цела (4 карточки)', async () => {
    await resetPlatform();
    const { container } = render(<PharmaScreen />);
    expect(container.querySelectorAll('.pharma-hero-card').length).toBe(4);
  });
});

describe('pharma-reminders (чистая логика)', () => {
  it('дефолт: выкл, 09:00, Пн+Чт', () => {
    expect(defaultRemindPrefs()).toEqual({ enabled: false, time: '09:00', days: [0, 3] });
  });

  it('roundtrip префов + санитизация мусора', () => {
    saveRemindPrefs({ enabled: true, time: '25:99', days: [0, 3] });
    const p = loadRemindPrefs();
    expect(p.enabled).toBe(true);
    expect(p.days).toEqual([0, 3]);
    saveRemindPrefs({ enabled: true, time: '08:30', days: [1, 1, 9, -2, 5] });
    expect(loadRemindPrefs().days).toEqual([1, 5]);
  });

  it('id стабильны, все 7 покрыты', () => {
    expect(reminderIdForDay(0)).toBe(41000);
    expect(allReminderIds()).toHaveLength(7);
    expect(new Set(allReminderIds()).size).toBe(7);
  });

  it('Пн=0 → Capacitor 2, Вс=6 → Capacitor 1', () => {
    expect(jsDayToCapacitorWeekday(0)).toBe(2);
    expect(jsDayToCapacitorWeekday(6)).toBe(1);
    expect(jsDayToCapacitorWeekday(3)).toBe(5);
  });

  it('построение повторов: выкл/пусто → [], иначе по дням', () => {
    expect(buildReminderItems(defaultRemindPrefs(), 'T', 'B')).toEqual([]);
    const items = buildReminderItems({ enabled: true, time: '08:30', days: [0, 3] }, 'T', 'B');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 41000, weekday: 2, hour: 8, minute: 30, title: 'T' });
    expect(items[1]).toMatchObject({ id: 41003, weekday: 5 });
  });
});

describe('PharmaCourseScreen напоминания (волна 7)', () => {
  it('native → карточка с тогглом, днями и временем', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { RemindCard } = await import('../screens/PharmaCourseScreen');
    render(<RemindCard />);
    expect(screen.getByText('Напоминания о днях инъекций')).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Напоминания о днях инъекций' })).not.toBeNull();
    // Дни и время появляются после включения.
    expect(screen.queryByLabelText('Время напоминания')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Напоминания о днях инъекций' }));
    expect(screen.getByLabelText('Время напоминания')).not.toBeNull();
    for (const d of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']) {
      expect(screen.getByLabelText(`День ${d}`)).not.toBeNull();
    }
  });

  it('native → включение ставит статус (в jsdom пуши недоступны — честный текст)', async () => {
    setCapacitorNative();
    await resetPlatform();
    const { RemindCard } = await import('../screens/PharmaCourseScreen');
    render(<RemindCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Напоминания о днях инъекций' }));
    expect(await screen.findByText(/Поставлено|недоступны|Не удалось/)).not.toBeNull();
  });

  it('мост пушей вне native — тихий no-op (0), jsDay-маппинг', async () => {
    await resetPlatform();
    const { scheduleWeeklyReminders, cancelScheduledReminders } = await import('../../core/native-bridge');
    await expect(
      scheduleWeeklyReminders([{ id: 1, weekday: 2, hour: 9, minute: 0, title: 'T', body: 'B' }]),
    ).resolves.toBe(0);
    await expect(cancelScheduledReminders([1])).resolves.toBeUndefined();
  });
});
