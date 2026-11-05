/**
 * space-return.test.ts — возврат на тот же экран после смены пространства данных.
 *
 * Переключение атлета = перезагрузка. Без возврата тренер после «Войти в его
 * данные» оказывался на главной. Проверяем не только «запомнили/забрали», но и
 * границы: без явного запоминания ничего не пишем, старая точка не срабатывает
 * через день, битая запись не ломает старт.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SPACE_RETURN_KEY,
  SPACE_RETURN_MAX_AGE_MS,
  _resetSpaceReturnCache,
  markSpaceReturn,
  rememberScreen,
  restoreScreen,
  takeSpaceReturn,
} from '../space-return';
import { activateAthleteSpace, activateSpaceById, HOME_SPACE_ID, isDeviceLevelKey } from '../data-space';
describe('возврат после смены пространства', () => {
  beforeEach(() => {
    _resetSpaceReturnCache();
    localStorage.clear();
  });

  it('ключ — данные устройства: к атлетам не относится и в облако не уезжает', () => {
    expect(isDeviceLevelKey(SPACE_RETURN_KEY)).toBe(true);
    expect(SPACE_RETURN_KEY.startsWith('he_data_space_')).toBe(true);
  });

  it('без явного запоминания экрана ничего не пишет', () => {
    markSpaceReturn();
    expect(localStorage.getItem(SPACE_RETURN_KEY)).toBeNull();
    expect(takeSpaceReturn()).toBeNull();
  });

  it('запоминает вкладку и подраздел и отдаёт их один раз', () => {
    rememberScreen('profile', 'coach');
    markSpaceReturn();
    expect(takeSpaceReturn()).toEqual({ tab: 'profile', subTab: 'coach' });
    // второй раз — уже пусто: возврат одноразовый, иначе он «залипнет»
    expect(takeSpaceReturn()).toBeNull();
  });

  it('подраздел не передан — возвращаем вкладку без него, а не строку "null"', () => {
    rememberScreen('training', null);
    markSpaceReturn();
    expect(takeSpaceReturn()).toEqual({ tab: 'training', subTab: null });
  });

  it('старую точку возврата не применяет и стирает', () => {
    const now = 1_700_000_000_000;
    rememberScreen('profile', 'coach');
    markSpaceReturn(now);
    expect(takeSpaceReturn(now + SPACE_RETURN_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem(SPACE_RETURN_KEY)).toBeNull();
  });

  it('время «из будущего» (переставили часы) не считается свежим', () => {
    const now = 1_700_000_000_000;
    rememberScreen('profile', 'coach');
    markSpaceReturn(now + 5 * 60_000);
    expect(takeSpaceReturn(now)).toBeNull();
  });

  it('битая запись не ломает старт', () => {
    localStorage.setItem(SPACE_RETURN_KEY, '{oops');
    expect(takeSpaceReturn()).toBeNull();
    localStorage.setItem(SPACE_RETURN_KEY, JSON.stringify({ tab: 42 }));
    expect(takeSpaceReturn()).toBeNull();
    // ни одна из них не осталась висеть
    expect(localStorage.getItem(SPACE_RETURN_KEY)).toBeNull();
  });

  it('переключение атлета отмечает экран — на него и вернёмся после reload', () => {
    // Точка возврата ставится при активации пространства (все UI-пути идут
    // через activate*/reloadToApplySpace), поэтому проверяем проводку здесь.
    rememberScreen('profile', 'coach');
    const res = activateAthleteSpace('a1', 'Атлет');
    expect(res.error).toBeNull();
    expect(takeSpaceReturn()).toEqual({ tab: 'profile', subTab: 'coach' });
  });

  it('возврат к своим данным тоже возвращает на тот же экран', () => {
    expect(activateAthleteSpace('a1', 'Атлет').error).toBeNull();
    localStorage.removeItem(SPACE_RETURN_KEY);
    rememberScreen('training', 'diary');
    activateSpaceById(HOME_SPACE_ID);
    expect(takeSpaceReturn()).toEqual({ tab: 'training', subTab: 'diary' });
  });

  it('отказ переключения (неизвестное пространство) не оставляет точку возврата', () => {
    rememberScreen('profile', 'coach');
    expect(activateSpaceById('asp_nope').error).toBe('unknown');
    expect(localStorage.getItem(SPACE_RETURN_KEY)).toBeNull();
  });

  it('App принимает только настоящую вкладку: чужой id не откроет пустой экран', () => {
    const known = ['home', 'profile', 'training'];
    rememberScreen('profile', 'coach');
    markSpaceReturn();
    expect(restoreScreen(known)).toEqual({ tab: 'profile', subTab: 'coach' });

    rememberScreen('not-a-tab', null);
    markSpaceReturn();
    expect(restoreScreen(known)).toBeNull();
    // и запись не осталась: иначе она сработала бы при следующем старте
    expect(localStorage.getItem(SPACE_RETURN_KEY)).toBeNull();
  });
});
