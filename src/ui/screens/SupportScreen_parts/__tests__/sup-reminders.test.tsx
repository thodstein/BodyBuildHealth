/**
 * sup-reminders.test.ts — напоминания дневника БАД:
 * чистое вычисление следующего срабатывания + персист настроек.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  nextSupReminderDate,
  supReminderCountdown,
  SupportDiaryView,
} from '../SupportDiaryView';

describe('sup reminders math', () => {
  it('время впереди сегодня — срабатывание сегодня', () => {
    const now = new Date(2026, 8, 7, 10, 0, 0);
    const next = nextSupReminderDate('21:30', now);
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(7);
    expect(next!.getHours()).toBe(21);
    expect(next!.getMinutes()).toBe(30);
  });

  it('время позади — срабатывание завтра', () => {
    const now = new Date(2026, 8, 7, 10, 0, 0);
    const next = nextSupReminderDate('08:00', now);
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(8);
    expect(next!.getHours()).toBe(8);
  });

  it('ровно сейчас — тоже завтра (не в прошлом)', () => {
    const now = new Date(2026, 8, 7, 8, 0, 0);
    const next = nextSupReminderDate('08:00', now);
    expect(next!.getDate()).toBe(8);
  });

  it('мусор — null, а не NaN-дата', () => {
    expect(nextSupReminderDate('', new Date())).toBeNull();
    expect(nextSupReminderDate('99:99', new Date())).toBeNull();
    expect(nextSupReminderDate('8:00', new Date())).toBeNull();
  });

  it('обратный отсчёт: минуты / часы / завтра', () => {
    const now = new Date(2026, 8, 7, 10, 0, 0);
    expect(supReminderCountdown(new Date(2026, 8, 7, 10, 0, 10), now)).toBe('меньше чем через минуту');
    expect(supReminderCountdown(new Date(2026, 8, 7, 10, 25, 0), now)).toBe('через 25 мин');
    expect(supReminderCountdown(new Date(2026, 8, 7, 12, 15, 0), now)).toBe('через 2 ч 15 мин (сегодня в 12:15)');
    expect(supReminderCountdown(new Date(2026, 8, 8, 8, 0, 0), now)).toBe('через 22 ч (завтра в 08:00)');
  });
});

describe('sup reminders persist', () => {
  // Напоминания рендерятся только при активном плане — сидируем минимальный
  const seedPlan = () => {
    localStorage.setItem('he_support_plan_result', JSON.stringify(['test_mag']));
  };
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    seedPlan();
  });
  afterEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {}
  });

  it('настройки восстанавливаются из стора', () => {
    localStorage.setItem(
      'he_sup_reminder_v1',
      JSON.stringify({ enabled: true, time: '21:30', smartEnabled: false, smartTime: '08:00' }),
    );
    const { container } = render(<SupportDiaryView s={{}} />);
    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked, 'restored enabled').toBe(true);
    const time = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(time.value, 'restored time').toBe('21:30');
  });

  it('смена времени пишется в стор', () => {
    const { container } = render(<SupportDiaryView s={{}} />);
    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(box);
    const time = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(time, 'time input after enable').not.toBeNull();
    fireEvent.change(time, { target: { value: '07:15' } });
    const stored = JSON.parse(localStorage.getItem('he_sup_reminder_v1') || '{}');
    expect(stored.time, 'persisted time').toBe('07:15');
    expect(stored.enabled, 'persisted enabled').toBe(true);
  });

  it('битый стор — дефолты, без падения', () => {
    localStorage.setItem('he_sup_reminder_v1', '{oops');
    const { container } = render(<SupportDiaryView s={{}} />);
    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it('без разрешения — честный статус вместо alert', () => {
    localStorage.setItem(
      'he_sup_reminder_v1',
      JSON.stringify({ enabled: true, time: '21:30', smartEnabled: false, smartTime: '08:00' }),
    );
    const { container } = render(<SupportDiaryView s={{}} />);
    expect(container.textContent).toContain('Разрешите уведомления');
  });
});
