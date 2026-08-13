/**
 * diary-mmc-checkin-integration.test.tsx — сквозная проверка моих фич за Aug 13:
 * 1) Чек-ин ← дневники профиля (подтягивание + запись при сохранении)
 * 2) MMC: MMCSetPanel записывает в he_mmc_log, MMCTrackingCard показывает агрегаты
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { CheckinMetricsCard } from '../../ui/screens/TrainingScreen_parts/CheckinMetricsCard';
import MMCSetPanel from '../../ui/screens/TrainingScreen_parts/MMCSetPanel';
import MMCTrackingCard from '../../ui/screens/TrainingScreen_parts/MMCTrackingCard';
import { clearMMCLog, loadMMCLog } from '../mmc-tracking.engine';

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  localStorage.clear();
  clearMMCLog();
});

describe('Чек-ин ↔ дневники профиля', () => {
  it('подтягивает сегодняшние вес/сон/пульс из дневников профиля в форму', async () => {
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: today, weight: 82.5 }]));
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: today, hours: 6.5, quality: 2 }]));
    localStorage.setItem('he_bp_diary', JSON.stringify([{ date: today, systolic: 120, diastolic: 80, pulse: 68 }]));
    render(<CheckinMetricsCard />);
    const weight = await screen.findByDisplayValue('82.5');
    expect(weight).toBeTruthy();
    expect(screen.getByDisplayValue('6.5')).toBeTruthy();
    expect(screen.getByDisplayValue('68')).toBeTruthy();
    expect(screen.getByText(/Синхронизировано с дневниками профиля/)).toBeTruthy();
  });

  it('сохранение чек-ина пишет вес/сон/пульс в дневники профиля', async () => {
    render(<CheckinMetricsCard />);
    const inputs = document.querySelectorAll('input');
    const weightInput = inputs[0]; // Вес, кг
    const sleepInput = inputs[1];  // Сон, ч
    fireEvent.change(weightInput, { target: { value: '81.2' } });
    fireEvent.change(sleepInput, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить чек-ин/ }));
    const wl = JSON.parse(localStorage.getItem('he_weight_log') || '[]');
    expect(wl.find((e: any) => e.date === today)?.weight).toBe(81.2);
    const sl = JSON.parse(localStorage.getItem('he_sleep_diary') || '[]');
    expect(sl.find((e: any) => e.date === today)?.hours).toBe(8);
    const dm = JSON.parse(localStorage.getItem('he_daily_metrics') || '[]');
    expect(dm.find((e: any) => e.date === today)?.weightKg).toBe(81.2);
  });

  it('вес из чек-ина обновляет существующую запись дневника, сохраняя замеры', () => {
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: today, weight: 80, waistCm: 85 }]));
    render(<CheckinMetricsCard />);
    const weightInput = document.querySelectorAll('input')[0]; // Вес, кг
    fireEvent.change(weightInput, { target: { value: '79.4' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить чек-ин/ }));
    const wl = JSON.parse(localStorage.getItem('he_weight_log') || '[]');
    expect(wl).toHaveLength(1);
    expect(wl[0].weight).toBe(79.4);
    expect(wl[0].waistCm).toBe(85);
  });
});

describe('MMC/Пампинг/Суставы в дневнике', () => {
  it('MMCSetPanel записывает в he_mmc_log (upsert по дата+упражнение+подход)', async () => {
    render(<MMCSetPanel exerciseId="bench" exerciseName="Жим лёжа" setNumber={1} date={today} />);
    const mmcInput = screen.getByPlaceholderText('связь');
    fireEvent.change(mmcInput, { target: { value: '9' } });
    const pumpInput = screen.getByPlaceholderText('памп');
    fireEvent.change(pumpInput, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /Записать/ }));
    const log = loadMMCLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ date: today, exerciseName: 'Жим лёжа', setNumber: 1, mmc: 9, pump: 7 });
    expect(screen.getByText(/Записано/)).toBeTruthy();
    // повторная запись — апдейт, не дубль
    fireEvent.change(mmcInput, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Записать/ }));
    expect(loadMMCLog()).toHaveLength(1);
    expect(loadMMCLog()[0].mmc).toBe(8);
  });

  it('MMCTrackingCard показывает агрегаты после записи', async () => {
    localStorage.setItem('he_mmc_log', JSON.stringify([
      { date: today, exerciseId: 'bench', exerciseName: 'Жим лёжа', setNumber: 1, mmc: 8, pump: 7, jointDiscomfort: 1, energy: 6 },
      { date: today, exerciseId: 'bench', exerciseName: 'Жим лёжа', setNumber: 2, mmc: 7, pump: 6, jointDiscomfort: 2, energy: 6 },
    ]));
    render(<MMCTrackingCard />);
    expect(await screen.findByText(/Жим лёжа/)).toBeTruthy();
    expect(screen.getByText(/7\.5\/10/)).toBeTruthy(); // MMC 8+7/2
    expect(screen.getByText(/6\.5\/10/)).toBeTruthy(); // Пампинг 7+6/2
    expect(screen.getByText(/2 сетов/)).toBeTruthy();
  });

  it('пустая карточка MMC подсказывает про кнопку 🧠', () => {
    render(<MMCTrackingCard />);
    expect(screen.getByText(/кнопка 🧠/)).toBeTruthy();
  });
});
