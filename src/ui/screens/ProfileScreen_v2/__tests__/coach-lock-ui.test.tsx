/**
 * coach-lock-ui.test.tsx — PIN и журнал действий в профиле тренера.
 *
 * Проверяем обещания:
 *  • без PIN профиль открыт (по умолчанию ничего не блокируется);
 *  • с PIN и без разблокировки виден ТОЛЬКО экран ввода — ни карточек, ни данных;
 *  • правильный PIN открывает, неправильный — нет;
 *  • выключить PIN можно только зная текущий;
 *  • действия пишутся в журнал без имён и текстов.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../../../core/db', () => ({
  readSpaceStores: vi.fn(async () => ({})),
  writeSpaceStores: vi.fn(async () => undefined),
  spaceDbRecordCount: vi.fn(async () => 0),
  listSpaceDatabaseIds: vi.fn(async () => null),
}));

const shareCalls = vi.hoisted(() => ({ saved: [] as { name: string; text: string }[] }));

vi.mock('../../../../core/native-bridge', () => ({
  isBiometricAvailable: vi.fn(async () => true),
  authenticateWithBiometrics: vi.fn(async () => true),
}));

vi.mock('../../../../core/apk-share', () => ({
  saveTextFileApk: vi.fn(async (name: string, text: string) => {
    shareCalls.saved.push({ name, text });
    return 'shared';
  }),
  shareOutcomeLabel: vi.fn(() => 'файл сохранён'),
  printHtmlApk: vi.fn(async () => 'shared'),
  copyOrShareText: vi.fn(async () => 'shared'),
}));

import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  addCoachAthlete,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import {
  COACH_UNLOCK_KEY,
  createCoachLock,
  readCoachLock,
  writeCoachLock,
} from '../../../../engines/coach/coach-lock.engine';
import { readCoachAudit } from '../../../../engines/coach/coach-audit.engine';
import { _resetDataSpaceCache } from '../../../../core/data-space';

const seedAthletes = (n = 1) => {
  let s = setCoachEnabled(emptyCoachState(), true);
  for (let i = 1; i <= n; i++) {
    s = addCoachAthlete(s, { name: `Атлет ${i}` }, { id: `a${i}`, now: '2026-11-05T10:00:00.000Z' }).state;
  }
  writeCoachState(localStorage, s);
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  shareCalls.saved = [];
  _resetDataSpaceCache();
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

describe('PIN по желанию', () => {
  it('по умолчанию PIN выключен и профиль не блокируется', () => {
    seedAthletes(1);
    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="locked"]')).toBeNull();
    expect(container.querySelector('[data-coach="lock-card"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="lock-enable-open"]')?.textContent).toContain('Включить PIN');
  });

  it('включение PIN сохраняет настройку и пишет событие в журнал', async () => {    seedAthletes(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="lock-enable-open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="lock-pin"]') as HTMLElement, { target: { value: '2468' } });
    fireEvent.change(container.querySelector('[data-coach="lock-pin-confirm"]') as HTMLElement, {
      target: { value: '2468' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-enable-save"]') as HTMLElement);

    await waitFor(() => expect(readCoachLock(localStorage).enabled).toBe(true));
    expect(readCoachLock(localStorage).hash).not.toContain('2468');
    expect(readCoachAudit(localStorage).items.map(e => e.kind)).toContain('pin-enabled');
    // Включили PIN — текущая сессия не выкидывается: человек только что ввёл код.
    expect(container.querySelector('[data-coach="locked"]')).toBeNull();
    expect(container.querySelector('[data-coach="lock-disable-open"]')).not.toBeNull();
  });

  it('несовпадающее подтверждение не включает PIN', async () => {
    seedAthletes(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="lock-enable-open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="lock-pin"]') as HTMLElement, { target: { value: '2468' } });
    fireEvent.change(container.querySelector('[data-coach="lock-pin-confirm"]') as HTMLElement, {
      target: { value: '2469' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-enable-save"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="lock-error"]')?.textContent).toContain('не совпадают'),
    );
    expect(readCoachLock(localStorage).enabled).toBe(false);
  });

  it('с PIN и без разблокировки виден только экран входа; правильный PIN открывает', async () => {
    seedAthletes(1);
    const { settings } = await createCoachLock('1357', { salt: 'fixed' });
    writeCoachLock(localStorage, settings!);

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="locked"]')).not.toBeNull();
    // Никаких карточек и цифр за замком.
    expect(container.querySelector('[data-coach="athlete"]')).toBeNull();
    expect(container.querySelector('[data-coach="athletes"]')).toBeNull();

    fireEvent.change(container.querySelector('[data-coach="lock-unlock-pin"]') as HTMLElement, {
      target: { value: '0000' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-unlock"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('[data-coach="lock-unlock-error"]')?.textContent).toContain('не подошёл'),
    );
    expect(container.querySelector('[data-coach="locked"]')).not.toBeNull();

    fireEvent.change(container.querySelector('[data-coach="lock-unlock-pin"]') as HTMLElement, {
      target: { value: '1357' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-unlock"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-coach="locked"]')).toBeNull());
    expect(container.querySelector('[data-coach="athlete"]')).not.toBeNull();
    expect(sessionStorage.getItem(COACH_UNLOCK_KEY)).toBeTruthy();
  });

  it('выключить PIN можно только зная текущий', async () => {
    seedAthletes(1);
    const { settings } = await createCoachLock('1357', { salt: 'fixed' });
    writeCoachLock(localStorage, settings!);
    sessionStorage.setItem(COACH_UNLOCK_KEY, new Date().toISOString());

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="locked"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-coach="lock-disable-open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="lock-disable-pin"]') as HTMLElement, {
      target: { value: '9999' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-disable-save"]') as HTMLElement);
    await waitFor(() => expect(container.querySelector('[data-coach="lock-error"]')).not.toBeNull());
    expect(readCoachLock(localStorage).enabled).toBe(true);

    fireEvent.change(container.querySelector('[data-coach="lock-disable-pin"]') as HTMLElement, {
      target: { value: '1357' },
    });
    fireEvent.click(container.querySelector('[data-coach="lock-disable-save"]') as HTMLElement);
    await waitFor(() => expect(readCoachLock(localStorage).enabled).toBe(false));
    expect(readCoachAudit(localStorage).items.map(e => e.kind)).toContain('pin-disabled');
  });

  it('автовыход меняется и сохраняется', async () => {    seedAthletes(1);
    const { settings } = await createCoachLock('1357', { salt: 'fixed', autoLockMin: 15 });
    writeCoachLock(localStorage, settings!);
    sessionStorage.setItem(COACH_UNLOCK_KEY, new Date().toISOString());

    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="lock-auto"]') as HTMLElement, { target: { value: '5' } });
    expect(readCoachLock(localStorage).autoLockMin).toBe(5);
  });

  it('вход в чужие данные просит PIN до переключения, а не после', async () => {
    seedAthletes(1);
    const { settings } = await createCoachLock('1357', { salt: 'fixed' });
    writeCoachLock(localStorage, settings!);
    sessionStorage.setItem(COACH_UNLOCK_KEY, new Date().toISOString());

    const { container } = render(<ProfileCoachTab />);
    const enter = container.querySelector('[data-coach="enter-space"]') as HTMLElement;
    expect(enter).not.toBeNull();
    fireEvent.click(enter);

    // Пространство ещё не переключено: диалог, а не перезагрузка в чужой профиль.
    expect(container.querySelector('[data-coach="pin-dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-coach="pin-dialog"]')?.textContent).toContain('чужое пространство');
    fireEvent.click(container.querySelector('[data-coach="pin-dialog-cancel"]') as HTMLElement);
    expect(container.querySelector('[data-coach="pin-dialog"]')).toBeNull();
  });

  it('биометрия включается только с PIN и открывает профиль', async () => {
    seedAthletes(1);
    const { setCoachLockBiometry, readCoachLock: read } = await import(
      '../../../../engines/coach/coach-lock.engine'
    );
    const { settings } = await createCoachLock('1357', { salt: 'fixed' });
    // Включаем биометрию через движок: настройка «только с PIN».
    writeCoachLock(localStorage, setCoachLockBiometry(settings!, true));
    expect(read(localStorage).biometry).toBe(true);

    const { container } = render(<ProfileCoachTab />);
    expect(container.querySelector('[data-coach="locked"]')).not.toBeNull();
    const bio = await waitFor(() => {
      const el = container.querySelector('[data-coach="lock-unlock-bio"]') as HTMLElement | null;
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(bio);
    await waitFor(() => expect(container.querySelector('[data-coach="locked"]')).toBeNull());
    expect(sessionStorage.getItem(COACH_UNLOCK_KEY)).toBeTruthy();
  });

  it('без PIN биометрия не включается — она бы ничего не защищала', async () => {
    const { emptyCoachLock, setCoachLockBiometry } = await import('../../../../engines/coach/coach-lock.engine');
    expect(setCoachLockBiometry(emptyCoachLock(), true).biometry).toBe(false);
  });
});

describe('журнал действий', () => {
  it('добавление атлета пишется без имени, только вид и id', () => {
    seedAthletes(0);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLElement, {
      target: { value: 'Секретное Имя' },
    });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);

    const audit = readCoachAudit(localStorage);
    const added = audit.items.find(e => e.kind === 'athlete-added');
    expect(added).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain('Секретное Имя');
    expect(added?.athleteId).toBeTruthy();
  });

  it('смена статуса и удаление карточки тоже фиксируются', () => {
    seedAthletes(1);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.click(container.querySelector('[data-coach="pause"]') as HTMLElement);
    expect(readCoachAudit(localStorage).items.map(e => e.kind)).toContain('athlete-status');

    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="delete"]') as HTMLElement);
    expect(readCoachAudit(localStorage).items.map(e => e.kind)).toContain('athlete-removed');
  });

  it('журнал выгружается файлом без имён и содержимого', async () => {
    seedAthletes(0);
    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="name"]') as HTMLElement, {
      target: { value: 'Секретное Имя' },
    });
    fireEvent.click(container.querySelector('[data-coach="save"]') as HTMLElement);

    fireEvent.click(container.querySelector('[data-coach="audit-export"]') as HTMLElement);
    await waitFor(() => expect(shareCalls.saved.length).toBe(1));
    const saved = shareCalls.saved[0];
    expect(saved.name).toContain('coach-audit-');
    expect(saved.text).toContain('добавлен атлет');
    expect(saved.text).not.toContain('Секретное Имя');
    await waitFor(() =>
      expect(container.querySelector('[data-coach="audit-notice"]')?.textContent).toContain('файл сохранён'),
    );
  });
});
