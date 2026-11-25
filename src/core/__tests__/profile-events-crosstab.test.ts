/**
 * profile-events-crosstab.test.ts — правка профиля из ДРУГОГО окна.
 *
 * `broadcastProfileChange` живёт в памяти окна: вкладка, которая сама ничего не
 * записывала, о правке не узнает, а `storage` не приходит в окно-писатель. Из-за
 * этого календарь держал даты плана по старому графику до перезагрузки. Два
 * источника сводятся в один хелпер — здесь проверяем оба и отписку.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { broadcastProfileChange, onAnyProfileChangeCrossTab } from '../profile-events';

describe('onAnyProfileChangeCrossTab', () => {
  const offs: Array<() => void> = [];
  const subscribe = (fn: () => void) => {
    offs.push(onAnyProfileChangeCrossTab(fn));
  };

  afterEach(() => {
    offs.splice(0).forEach((off) => off());
  });

  it('своё окно: срабатывает шина профиля', () => {
    const fn = vi.fn();
    subscribe(fn);
    broadcastProfileChange(['training']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('другое окно: срабатывает storage с ключом профиля', () => {
    const fn = vi.fn();
    subscribe(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: 'he_profile_v2' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('чужие ключи профилем не считаются', () => {
    const fn = vi.fn();
    subscribe(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: 'he_pl_runtime' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'he_workout_log_v2' }));
    expect(fn).not.toHaveBeenCalled();
  });

  it('отписка снимает оба источника', () => {
    const fn = vi.fn();
    const off = onAnyProfileChangeCrossTab(fn);
    off();
    broadcastProfileChange([]);
    window.dispatchEvent(new StorageEvent('storage', { key: 'he_profile_v2' }));
    expect(fn).not.toHaveBeenCalled();
  });
});
