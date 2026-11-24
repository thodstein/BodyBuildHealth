/**
 * pl-runtime-events.test.ts — замок на сигнал «план отправлен в выполнение».
 *
 * `storage`-событие браузер шлёт только другим вкладкам, поэтому после записи
 * `he_pl_runtime` в том же окне плеер и календарь держали старый план (пустой
 * плановый слой до смены месяца, плеер на прошлом дне). Продюсеры зовут
 * `notifyPlRuntimeSaved()`, потребители подписаны через `onPlRuntimeSaved()`.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { anchorForWrite, notifyPlRuntimeSaved, onPlRuntimeSaved, PL_RUNTIME_KEY } from '../pl-runtime-events';
import { localIsoDate } from '../local-date';

const read = (path: string) => readFileSync(path, 'utf8');
const count = (src: string, needle: string) => src.split(needle).length - 1;

describe('сигнал he_pl_runtime: подписка', () => {
  it('своё событие окна доходит до подписчика, отписка снимает обработчик', () => {
    const handler = vi.fn();
    const off = onPlRuntimeSaved(handler);
    notifyPlRuntimeSaved();
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    notifyPlRuntimeSaved();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('storage из другой вкладки: ключ плана и clear — да, чужие ключи — нет', () => {
    const handler = vi.fn();
    const off = onPlRuntimeSaved(handler);
    window.dispatchEvent(new StorageEvent('storage', { key: PL_RUNTIME_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'he_runtime_day' }));
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(handler).toHaveBeenCalledTimes(2);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: PL_RUNTIME_KEY }));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('сигнал he_pl_runtime: кто сообщает и кто слушает', () => {
  it('каждая запись he_pl_runtime у продюсера сопровождается сигналом', () => {
    const producers: [string, number][] = [
      ['src/ui/screens/TrainingScreen_parts/BbAutoConstructor.tsx', 2],
      ['src/ui/screens/TrainingScreen_parts/ProgramEditorView.tsx', 2],
      ['src/ui/screens/SRCBBScreen.tsx', 1],
      ['src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx', 1],
    ];
    for (const [file, expected] of producers) {
      const src = read(file);
      expect(count(src, 'notifyPlRuntimeSaved()'), file).toBe(expected);
      expect(src, file).toContain('core/pl-runtime-events');
    }
  });

  it('плеер и календарь подписаны на общий сигнал, а не на свой storage-хендлер', () => {
    const training = read('src/ui/screens/TrainingScreen.tsx');
    expect(training).toContain('onPlRuntimeSaved(');
    // Второй `addEventListener('storage')` для he_pl_runtime не нужен: он живёт в подписке.
    expect(training).not.toContain("addEventListener('storage', onStorage)");

    const calendar = read('src/ui/screens/TrainingScreen_parts/TrainingCalendarTab.tsx');
    expect(calendar).toContain('onPlRuntimeSaved(');
    expect(calendar).not.toContain("addEventListener('storage', onStorage)");
  });
});

describe('якорь при перезаписи плана (anchorForWrite)', () => {
  const days = [{ label: 'Д1', exercises: [{ name: 'Жим' }] }];

  it('тот же массив дней — прежний якорь сохраняется', () => {
    // Экран-конструктор зеркалит план при каждом монтировании: без этого
    // «сегодня» сдвигало старт уже отправленного плана на дни вперёд.
    expect(anchorForWrite({ days, startDate: '2026-11-02' }, days)).toBe('2026-11-02');
  });

  it('другой план (изменились дни) — якорь «сегодня»', () => {
    const other = [{ label: 'Д1', exercises: [{ name: 'Тяга' }] }];
    expect(anchorForWrite({ days, startDate: '2026-11-02' }, other)).toBe(localIsoDate());
  });

  it('нет прежней записи или якорь битый — «сегодня»', () => {
    expect(anchorForWrite(null, days)).toBe(localIsoDate());
    expect(anchorForWrite({ days, startDate: '2026-13-99' }, days)).toBe(localIsoDate());
    expect(anchorForWrite({ days }, days)).toBe(localIsoDate());
  });
});
