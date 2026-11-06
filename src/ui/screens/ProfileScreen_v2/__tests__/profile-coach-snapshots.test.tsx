/**
 * profile-coach-snapshots.test.tsx — сводка по атлету на карточке тренера.
 *
 * Проверяем пользовательский сценарий:
 *  • карточки рисуются сразу, сводки подставляются асинхронно;
 *  • «тренировка сегодня / план есть» — из ДАННЫХ атлета, а не из ручного журнала;
 *  • пустое пространство честно говорит «нет данных», а не «0 дней»;
 *  • фильтр «требуют внимания» оставляет только тех, кому есть что смотреть;
 *  • сортировка «давно не тренировался» ставит «нет данных» наверх.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

const spaceStores = vi.hoisted(() => ({
  bySpace: {} as Record<string, Record<string, unknown[]>>,
  failFor: new Set<string>(),
}));

const dbWrites = vi.hoisted(() => ({ written: [] as { sid: string; stores: Record<string, unknown[]> }[] }));

vi.mock('../../../../core/db', () => ({
  readSpaceStores: vi.fn(async (sid: string) => {
    if (spaceStores.failFor.has(sid)) throw new Error('boom');
    return spaceStores.bySpace[sid] ?? {};
  }),
  writeSpaceStores: vi.fn(async (sid: string, stores: Record<string, unknown[]>) => {
    dbWrites.written.push({ sid, stores });
  }),
  spaceDbRecordCount: vi.fn(async () => 0),
  listSpaceDatabaseIds: vi.fn(async () => null),
}));

const shareCalls = vi.hoisted(() => ({
  printed: [] as string[],
  saved: [] as { name: string; text: string }[],
  copied: [] as string[],
}));

vi.mock('../../../../core/apk-share', () => ({
  printHtmlApk: vi.fn(async (html: string) => {
    shareCalls.printed.push(html);
    return 'shared';
  }),
  saveTextFileApk: vi.fn(async (name: string, text: string) => {
    shareCalls.saved.push({ name, text });
    return 'shared';
  }),
  copyOrShareText: vi.fn(async (text: string) => {
    shareCalls.copied.push(text);
    return 'shared';
  }),
  shareOutcomeLabel: vi.fn(() => 'файл сохранён'),
}));

import { ProfileCoachTab } from '../ProfileCoachTab';
import {
  addCoachAthlete,
  coachToday,
  emptyCoachState,
  setCoachEnabled,
  writeCoachState,
} from '../../../../engines/coach/coach-mode.engine';
import {
  _resetDataSpaceCache,
  athleteSpaceId,
  toPhysicalKey,
} from '../../../../core/data-space';
import { readCoachNotes } from '../../../../engines/coach/coach-notes.engine';
import { readCoachPrograms } from '../../../../engines/coach/coach-program-library.engine';
import { readCoachState } from '../../../../engines/coach/coach-mode.engine';
import { weekStartOf } from '../../../../engines/coach/coach-adherence.engine';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  spaceStores.bySpace = {};
  spaceStores.failFor = new Set();
  dbWrites.written = [];
  shareCalls.printed = [];
  shareCalls.saved = [];
  shareCalls.copied = [];
  _resetDataSpaceCache();
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
  _resetDataSpaceCache();
});

const seed = (names: string[]) => {
  let s = setCoachEnabled(emptyCoachState(), true);
  names.forEach((name, i) => {
    s = addCoachAthlete(s, { name }, { id: `a${i + 1}`, now: '2026-11-05T10:00:00.000Z' }).state;
  });
  writeCoachState(localStorage, s);
};

const cards = (c: HTMLElement) => c.querySelectorAll('[data-coach="athlete"]');
const cardByName = (c: HTMLElement, name: string): HTMLElement | null => {
  for (const card of Array.from(cards(c))) {
    if (card.textContent?.includes(name)) return card as HTMLElement;
  }
  return null;
};

describe('сводка из данных атлета', () => {
  it('тренировка и план видны, пустое пространство — «нет данных»', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {
      training_log: [
        { id: 'l1', date: coachToday(), exerciseId: 'squat', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5, rir: 2 }] },
      ],
    };
    localStorage.setItem(toPhysicalKey(sid1, 'he_pl_macro'), JSON.stringify({ v: 7, b: ['присед'], t: 12 }));
    localStorage.setItem(
      toPhysicalKey(sid1, 'he_weight_log'),
      JSON.stringify([{ date: coachToday(), weight: 82.5 }]),
    );

    const { container } = render(<ProfileCoachTab />);

    await waitFor(() => {
      const ivan = cardByName(container, 'Иван');
      expect(ivan?.querySelector('[data-coach="snapshot"]')?.textContent).toContain('тренировка сегодня');
    });
    const ivan = cardByName(container, 'Иван')!;
    expect(ivan.querySelector('[data-coach="snapshot"]')?.textContent).toContain('план есть');
    expect(ivan.querySelector('[data-coach="snapshot"]')?.textContent).toContain('вес 82,5 кг');
    expect(ivan.querySelector('[data-coach="attention"]')).toBeNull();

    await waitFor(() => {
      const petr = cardByName(container, 'Пётр');
      expect(petr?.querySelector('[data-coach="snapshot"]')?.textContent).toBe('нет данных в приложении');
    });
    const petr = cardByName(container, 'Пётр')!;
    expect(petr.querySelector('[data-coach="attention"]')?.textContent).toContain('нет сохранённой программы');
    expect(petr.querySelector('[data-coach="snapshot"]')?.textContent).not.toContain('0 дн.');
  });

  it('ошибка чтения одного пространства не рушит остальные', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {
      training_log: [{ date: coachToday(), sets: [{ weight: 50, reps: 10 }] }],
    };
    const db = await import('../../../../core/db');
    const original = db.readSpaceStores;
    spaceStores.failFor = new Set([athleteSpaceId('a2')]);
    expect(typeof original).toBe('function');

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
    // Пётр не «завис» — получил пустую сводку
    await waitFor(() => {
      expect(cardByName(container, 'Пётр')?.querySelector('[data-coach="snapshot"]')?.textContent).toBe(
        'нет данных в приложении',
      );
    });
    spaceStores.failFor = new Set();
  });
});

describe('фильтр и сортировка', () => {
  it('«Требуют внимания» оставляет только проблемные карточки', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }] };
    localStorage.setItem(toPhysicalKey(sid1, 'he_bb_macro'), JSON.stringify({ a: 1 }));

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(container.querySelector('[data-coach="attention-filter"]')?.textContent).toContain('(1)');
    });
    fireEvent.click(container.querySelector('[data-coach="attention-filter"]') as HTMLElement);
    await waitFor(() => expect(cards(container)).toHaveLength(1));
    expect(cards(container)[0].textContent).toContain('Пётр');

    fireEvent.click(container.querySelector('[data-coach="attention-filter"]') as HTMLElement);
    await waitFor(() => expect(cards(container)).toHaveLength(2));
  });

  it('«Давно не тренировался» ставит «нет данных» наверх, затем большее число дней', async () => {
    seed(['Иван', 'Пётр', 'Анна']);
    spaceStores.bySpace[athleteSpaceId('a1')] = {
      training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }],
    };
    spaceStores.bySpace[athleteSpaceId('a2')] = {};

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
    fireEvent.change(container.querySelector('[data-coach="athlete-sort"]') as HTMLSelectElement, {
      target: { value: 'inactive' },
    });
    await waitFor(() => {
      const names = Array.from(cards(container)).map(c => c.textContent ?? '');
      // без данных — наверх (Пётр и Анна), затем Иван
      expect(names[2]).toContain('Иван');
    });
  });

  it('«Обновить сводки» перечитывает данные, а не показывает старые', async () => {
    seed(['Иван']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {};
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toBe(
        'нет данных в приложении',
      );
    });

    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 60, reps: 5 }] }] };
    fireEvent.click(container.querySelector('[data-coach="snapshots-refresh"]') as HTMLElement);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
  });

  it('возвращение из фона пересобирает сводки: привезённые тренировки видны без кнопки', async () => {
    seed(['Иван']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = {};
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toBe(
        'нет данных в приложении',
      );
    });

    // Пока вкладка была в фоне, синхронизация привезла тренировку.
    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 60, reps: 5 }] }] };
    const setVisibility = (state: 'hidden' | 'visible') =>
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(cardByName(container, 'Иван')?.querySelector('[data-coach="snapshot"]')?.textContent).toContain(
        'тренировка сегодня',
      );
    });
  });
});
describe('выполнение недели, инбокс и комментарий к неделе', () => {
  it('план из рантайма + тренировка → «1 из 2 за неделю», без выдуманных процентов сверх факта', async () => {
    seed(['Иван']);
    const sid = athleteSpaceId('a1');
    spaceStores.bySpace[sid] = {
      training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }],
    };
    localStorage.setItem(
      toPhysicalKey(sid, 'he_pl_macro'),
      JSON.stringify({ v: 7, b: [], t: 12 }),
    );
    localStorage.setItem(
      toPhysicalKey(sid, 'he_pl_runtime'),
      JSON.stringify({
        days: [
          { label: 'День 1', exercises: [{ name: 'присед' }] },
          { label: 'День 2', exercises: [{ name: 'жим' }] },
        ],
        focus: 'Сила',
        track: 'pl',
        week: 1,
      }),
    );

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => {
      expect(container.querySelector('[data-coach="adherence"]')?.textContent).toContain('1 из 2');
    });
    expect(container.querySelector('[data-coach="adherence"]')?.textContent).toContain('неделя не закончена');
  });

  it('атлет без программы попадает в инбокс, и переход фильтрует список на него', async () => {
    seed(['Иван', 'Пётр']);
    const sid1 = athleteSpaceId('a1');
    spaceStores.bySpace[sid1] = { training_log: [{ date: coachToday(), sets: [{ weight: 100, reps: 5 }] }] };
    localStorage.setItem(toPhysicalKey(sid1, 'he_bb_macro'), JSON.stringify({ a: 1 }));

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="inbox"]')).not.toBeNull());
    const inboxText = container.querySelector('[data-coach="inbox"]')?.textContent ?? '';
    expect(inboxText).toContain('Пётр');
    expect(inboxText).toContain('нет сохранённой программы');

    const item = Array.from(container.querySelectorAll('[data-coach="inbox-item"]')).find(el =>
      el.textContent?.includes('Пётр'),
    ) as HTMLElement;
    fireEvent.click(item);
    const search = container.querySelector('[data-coach="search"]') as HTMLInputElement;
    expect(search.value).toBe('Пётр');
    await waitFor(() => expect(cards(container)).toHaveLength(1));
    expect(cards(container)[0].textContent).toContain('Пётр');
  });

  it('комментарий к неделе сохраняется заметкой с привязкой атлет+неделя', async () => {
    seed(['Иван']);
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="week-comment-open"]')).not.toBeNull());

    fireEvent.click(container.querySelector('[data-coach="week-comment-open"]') as HTMLElement);
    fireEvent.change(container.querySelector('[data-coach="week-comment-input"]') as HTMLElement, {
      target: { value: 'Сон 6 ч, просил не ставить присед первым' },
    });
    fireEvent.click(container.querySelector('[data-coach="week-comment-save"]') as HTMLElement);

    const note = readCoachNotes(localStorage).items.find(n => n.athleteId === 'a1');
    expect(note?.body).toContain('Сон 6 ч');
    expect(note?.week).toBe(weekStartOf(coachToday()));
    expect(container.querySelector('[data-coach="week-comment-has"]')).not.toBeNull();
  });

  it('пустой комментарий не сохраняется и объясняет почему', async () => {
    seed(['Иван']);
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="week-comment-open"]')).not.toBeNull());

    fireEvent.click(container.querySelector('[data-coach="week-comment-open"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-coach="week-comment-save"]') as HTMLElement);
    expect(container.querySelector('[data-coach="week-comment-editor"]')?.textContent).toContain('Пустой комментарий');
    expect(readCoachNotes(localStorage).items).toHaveLength(0);
  });
});

describe('отчёт и обмен программой файлом', () => {
  it('отчёт читает дневник атлета и показывает тоннаж с оговоркой про максимумы', async () => {
    seed(['Иван']);
    const sid = athleteSpaceId('a1');
    spaceStores.bySpace[sid] = {
      training_log: [
        {
          id: 'l1',
          date: coachToday(),
          exerciseName: 'Присед',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 110, reps: 3 },
          ],
        },
      ],
    };
    localStorage.setItem(
      toPhysicalKey(sid, 'he_weight_log'),
      JSON.stringify([{ date: coachToday(), weight: 82.5 }]),
    );

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="report-open"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-coach="report-open"]') as HTMLElement);

    await waitFor(() =>
      expect(container.querySelector('[data-coach="report-text"]')?.textContent).toContain('Тоннаж: 830 кг'),
    );
    const text = container.querySelector('[data-coach="report-text"]')?.textContent ?? '';
    expect(text).toContain('Отчёт: Иван');
    expect(text).toContain('Присед');
    expect(text).toContain('82,5');
    expect(container.querySelector('[data-coach="report"]')?.textContent).toContain('а не «настоящий ПМ»');

    fireEvent.click(container.querySelector('[data-coach="report-print"]') as HTMLElement);
    await waitFor(() => expect(shareCalls.printed.length).toBe(1));
    await waitFor(() =>
      expect(container.querySelector('[data-coach="report-outcome"]')?.textContent).toContain('файл сохранён'),
    );
    // Печать уходит с экранированным HTML, а не с сырым текстом пользователя.
    expect(shareCalls.printed[0]).toContain('<!DOCTYPE html>');
  });

  it('отчёт можно закрыть и открыть заново', async () => {
    seed(['Иван']);
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="report-open"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-coach="report-open"]') as HTMLElement);
    expect(container.querySelector('[data-coach="report"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-coach="report-close"]') as HTMLElement);
    expect(container.querySelector('[data-coach="report"]')).toBeNull();
  });

  it('импорт файла добавляет программу в библиотеку, но никому её не выдаёт', async () => {
    seed(['Иван']);
    const sid = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(sid, 'he_pl_macro'), JSON.stringify({ v: 7, b: ['присед'], t: 12 }));
    spaceStores.bySpace[sid] = { training_log: [{ id: 'l1', date: coachToday(), sets: [{ weight: 100, reps: 5 }] }] };

    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="program-import"]')).not.toBeNull());

    const bundle = {
      app: 'bodybuildhealth',
      kind: 'coach-program',
      version: 1,
      createdAt: '2026-11-01T10:00:00.000Z',
      name: 'Силовая база',
      keys: { he_pl_macro: JSON.stringify({ v: 7, b: ['присед'], t: 12 }) },
    };
    const file = new File([JSON.stringify(bundle)], 'silovaya.coach-program.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('[data-coach="program-import"]') as HTMLElement, {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(container.querySelector('[data-coach="program-notice"]')?.textContent).toContain('Силовая база'),
    );
    const programs = readCoachPrograms(localStorage);
    expect(programs.items).toHaveLength(1);
    expect(programs.items[0].name).toBe('Силовая база');
    // Библиотека — не выдача: программа атлета не перезаписана молча.
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_pl_macro'))).toBe(
      JSON.stringify({ v: 7, b: ['присед'], t: 12 }),
    );
  });

  it('чужой JSON не выдаёт себя за программу', async () => {
    seed(['Иван']);
    const { container } = render(<ProfileCoachTab />);
    await waitFor(() => expect(container.querySelector('[data-coach="program-import"]')).not.toBeNull());

    const file = new File([JSON.stringify({ hello: 'world' })], 'notes.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('[data-coach="program-import"]') as HTMLElement, {
      target: { files: [file] },
    });
    await waitFor(() => expect(container.querySelector('[data-coach="program-error"]')).not.toBeNull());
    expect(readCoachPrograms(localStorage).items).toHaveLength(0);
  });
});

describe('копия одного атлета', () => {
  it('выгружает файл с ключами и записями его пространства, без чужих данных', async () => {
    seed(['Иван', 'Пётр']);
    const sid = athleteSpaceId('a1');
    localStorage.setItem(toPhysicalKey(sid, 'he_weight_log'), JSON.stringify([{ date: coachToday(), weight: 82.5 }]));
    localStorage.setItem(toPhysicalKey('asp_other', 'he_weight_log'), JSON.stringify([{ weight: 99 }]));
    spaceStores.bySpace[sid] = { training_log: [{ id: 'l1', date: coachToday(), sets: [{ weight: 100, reps: 5 }] }] };

    const { container } = render(<ProfileCoachTab />);
    const ivan = cardByName(container, 'Иван')!;
    fireEvent.click(ivan.querySelector('[data-coach="athlete-copy-export"]') as HTMLElement);

    await waitFor(() => expect(shareCalls.saved.length).toBe(1));
    const saved = shareCalls.saved[0];
    expect(saved.name).toContain('Иван.coach-athlete.json');
    const parsed = JSON.parse(saved.text);
    expect(parsed.kind).toBe('coach-athlete-copy');
    expect(parsed.label).toBe('Иван');
    expect(Object.keys(parsed.keys)).toContain('he_weight_log');
    expect(parsed.keys.he_weight_log).toContain('82.5');
    expect(JSON.stringify(parsed.keys)).not.toContain('asp_other');
    expect(parsed.stores.training_log).toHaveLength(1);
    expect(parsed.stores.training_log[0].sets[0].weight).toBe(100);

    await waitFor(() =>
      expect(container.querySelector('[data-coach="copy-notice"]')?.textContent).toContain('Фото веса в копию не входят'),
    );
  });

  it('восстановление создаёт НОВОГО атлета, пишет ключи и записи в его пространство', async () => {
    seed(['Иван']);
    const copy = {
      app: 'bodybuildhealth',
      kind: 'coach-athlete-copy',
      version: 1,
      createdAt: '2026-11-01T10:00:00.000Z',
      label: 'Сергей',
      keys: { he_weight_log: JSON.stringify([{ date: coachToday(), weight: 90 }]) },
      stores: { training_log: [{ id: 'l1', date: coachToday(), sets: [{ weight: 120, reps: 3 }] }] },
    };
    const file = new File([JSON.stringify(copy)], 'sergey.coach-athlete.json', { type: 'application/json' });

    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="athlete-copy-import"]') as HTMLElement, {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(container.querySelector('[data-coach="copy-notice"]')?.textContent).toContain('Сергей (копия)'),
    );
    const after = readCoachState(localStorage);
    const created = after.athletes.find(a => a.name === 'Сергей (копия)');
    expect(created).toBeTruthy();

    const sid = athleteSpaceId(created!.id);
    expect(localStorage.getItem(toPhysicalKey(sid, 'he_weight_log'))).toContain('90');
    expect(dbWrites.written).toHaveLength(1);
    expect(dbWrites.written[0].sid).toBe(sid);
    expect(dbWrites.written[0].stores.training_log).toHaveLength(1);
    // Никакой «тихой замены»: прежние атлеты на месте.
    expect(after.athletes.map(a => a.name)).toContain('Иван');
  });

  it('чужой файл отклоняется и ничего не создаёт', async () => {
    seed(['Иван']);
    const file = new File([JSON.stringify({ app: 'bodybuildhealth', kind: 'coach-program', version: 1 })], 'x.json', {
      type: 'application/json',
    });
    const { container } = render(<ProfileCoachTab />);
    fireEvent.change(container.querySelector('[data-coach="athlete-copy-import"]') as HTMLElement, {
      target: { files: [file] },
    });
    await waitFor(() => expect(container.querySelector('[data-coach="copy-error"]')).not.toBeNull());
    expect(container.querySelector('[data-coach="copy-error"]')?.textContent).toContain('не копия атлета');
    expect(readCoachState(localStorage).athletes).toHaveLength(1);
    expect(dbWrites.written).toHaveLength(0);
  });
});
