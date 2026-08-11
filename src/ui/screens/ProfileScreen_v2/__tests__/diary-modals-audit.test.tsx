/**
 * diary-modals-audit.test.ts — тесты доработок quick-add модалок (Aug 10 2026):
 * undo-очередь, утренний рутинг, bpCategory, daysAgo/stale, useDiaryDraft reset-guard,
 * stale-чип в шапке модалки, findByDate + баннеры замены записи (Round 4).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor, render, screen, fireEvent, within } from '@testing-library/react';
import {
  bpCategory,
  daysAgoLabel,
  staleColorFor,
  daysSince,
  findByDate,
  nextRoutineStep,
  pushUndoAction,
  topUndo,
  dismissTopUndo,
  UNDO_TTL_MS,
  useDiaryDraft,
  DiaryModalShell,
} from '../diary-modals';
import { AddSleepModal } from '../sleep-diary-modal';
import { AddBodyMeasurementsModal } from '../body-measurements-modal';
import { AddInjectionModal } from '../injection-diary-modal';
import { AddHealthModal } from '../health-diary-modal';
import { todayIso } from '../diary-helpers';

describe('bpCategory — классификация АД', () => {
  it('норма (<120/<80)', () => {
    expect(bpCategory(110, 70)).toEqual({ label: 'Норма', color: '#22c55e' });
    expect(bpCategory(119, 79)).toEqual({ label: 'Норма', color: '#22c55e' });
  });
  it('повышенная норма (120-129 и <80)', () => {
    expect(bpCategory(120, 79)).toEqual({ label: 'Норма (высокая)', color: '#60a5fa' });
    expect(bpCategory(129, 75)).toEqual({ label: 'Норма (высокая)', color: '#60a5fa' });
  });
  it('повышенное (130-139 или 80-89)', () => {
    expect(bpCategory(130, 80)).toEqual({ label: 'Повышенное', color: '#a78bfa' });
    expect(bpCategory(125, 85)).toEqual({ label: 'Повышенное', color: '#a78bfa' });
  });
  it('гипертония 1 ст (140-159 или 90-99)', () => {
    expect(bpCategory(140, 90)).toEqual({ label: 'Гипертония 1 ст.', color: '#f59e0b' });
    expect(bpCategory(135, 95)).toEqual({ label: 'Гипертония 1 ст.', color: '#f59e0b' });
  });
  it('гипертония 2 ст (160-179 или 100-119)', () => {
    expect(bpCategory(160, 100)).toEqual({ label: 'Гипертония 2 ст.', color: '#f97316' });
    expect(bpCategory(150, 110)).toEqual({ label: 'Гипертония 2 ст.', color: '#f97316' });
  });
  it('гипертония 3 ст (≥180 или ≥120)', () => {
    expect(bpCategory(180, 120)).toEqual({ label: 'Гипертония 3 ст.', color: '#ef4444' });
    expect(bpCategory(150, 125)).toEqual({ label: 'Гипертония 3 ст.', color: '#ef4444' });
  });
  it('невалидные значения → «Введите показатели»', () => {
    expect(bpCategory(0, 80).label).toBe('Введите показатели');
    expect(bpCategory(NaN, 80).label).toBe('Введите показатели');
    expect(bpCategory(120, 0).label).toBe('Введите показатели');
  });
});

describe('daysAgoLabel / staleColorFor / daysSince', () => {
  it('daysAgoLabel: сегодня/вчера/N дн.', () => {
    expect(daysAgoLabel(0)).toBe('сегодня');
    expect(daysAgoLabel(1)).toBe('вчера');
    expect(daysAgoLabel(3)).toBe('3 дн. назад');
    expect(daysAgoLabel(10)).toBe('10 дн. назад');
  });
  it('staleColorFor: зелёный ≤2, жёлтый 3-6, оранжевый 7-13, красный ≥14', () => {
    expect(staleColorFor(1, '#a78bfa')).toBe('#a78bfa');
    expect(staleColorFor(3, '#a78bfa')).toBe('#f59e0b');
    expect(staleColorFor(7, '#a78bfa')).toBe('#f97316');
    expect(staleColorFor(14, '#a78bfa')).toBe('#ef4444');
  });
  it('daysSince: сегодня=0, вчера=1, 10 дней=10, пусто=null', () => {
    const iso = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };
    expect(daysSince(iso(0))).toBe(0);
    expect(daysSince(iso(1))).toBe(1);
    expect(daysSince(iso(10))).toBe(10);
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince('bad-date')).toBeNull();
  });
});

describe('nextRoutineStep — цепочка утреннего рутинга', () => {
  it('сон → давление → вес → конец', () => {
    expect(nextRoutineStep('sleep')).toBe('bp');
    expect(nextRoutineStep('bp')).toBe('weight');
    expect(nextRoutineStep('weight')).toBeNull();
  });
});

describe('undo-очередь', () => {
  const noop = () => {};
  it('push: последний добавленный — верхний (LIFO)', () => {
    let q = pushUndoAction([], 'A', noop);
    q = pushUndoAction(q, 'B', noop);
    expect(topUndo(q)?.label).toBe('B');
    expect(q.length).toBe(2);
  });
  it('dismissTop: убирает верхний, следующий становится видимым', () => {
    let q = pushUndoAction([], 'A', noop);
    q = pushUndoAction(q, 'B', noop);
    q = dismissTopUndo(q);
    expect(topUndo(q)?.label).toBe('A');
  });
  it('topUndo пустой очереди → null; dismiss пустой → пустая', () => {
    expect(topUndo([])).toBeNull();
    expect(dismissTopUndo([])).toEqual([]);
  });
  it('кап очереди = 5', () => {
    let q: ReturnType<typeof pushUndoAction> = [];
    for (let i = 0; i < 8; i++) q = pushUndoAction(q, `#${i}`, noop);
    expect(q.length).toBe(5);
    expect(topUndo(q)?.label).toBe('#7');
    expect(q[0].label).toBe('#3');
  });
  it('expiresAt = now + TTL', () => {
    const before = Date.now();
    const q = pushUndoAction([], 'X', noop);
    const after = Date.now();
    expect(topUndo(q)?.expiresAt).toBeGreaterThanOrEqual(before + UNDO_TTL_MS - 1);
    expect(topUndo(q)?.expiresAt).toBeLessThanOrEqual(after + UNDO_TTL_MS + 1);
  });
  it('undo-действие выполняется при отмене', () => {
    let called = 0;
    const q = pushUndoAction([], 'Y', () => { called++; });
    const top = topUndo(q);
    top?.undo();
    expect(called).toBe(1);
  });
});

describe('useDiaryDraft — черновик в sessionStorage', () => {
  const KEY = 'he_test_draft';
  beforeEach(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  });

  it('восстанавливает сохранённый черновик', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ a: 42, b: 'saved' }));
    const { result } = renderHook(() => useDiaryDraft<{ a: number; b: string }>(KEY, () => ({ a: 1, b: 'init' })));
    expect(result.current[0]).toEqual({ a: 42, b: 'saved' });
  });

  it('персистит изменения в sessionStorage', async () => {
    const { result } = renderHook(() => useDiaryDraft<{ a: number }>(KEY, () => ({ a: 1 })));
    await waitFor(() => expect(sessionStorage.getItem(KEY)).not.toBeNull());
    act(() => result.current[1]({ a: 5 }));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(KEY) || '{}').a).toBe(5));
  });

  it('reset: очищает storage и не пишет свежий дефолт обратно (guard)', async () => {
    const { result } = renderHook(() => useDiaryDraft<{ a: number }>(KEY, () => ({ a: 1 })));
    await waitFor(() => expect(sessionStorage.getItem(KEY)).not.toBeNull());
    act(() => result.current[2]());
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    act(() => result.current[2]({ a: 0 }));
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    act(() => result.current[1]({ a: 3 }));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(KEY) || '{}').a).toBe(3));
  });

  it('reset(next) сбрасывает состояние до next', () => {
    const { result } = renderHook(() => useDiaryDraft<{ a: number }>(KEY, () => ({ a: 1 })));
    act(() => result.current[1]({ a: 9 }));
    act(() => result.current[2]({ a: 0 }));
    expect(result.current[0]).toEqual({ a: 0 });
  });

  it('кривой JSON в storage → дефолт без падения', () => {
    sessionStorage.setItem(KEY, 'not-json{{{');
    const { result } = renderHook(() => useDiaryDraft<{ a: number }>(KEY, () => ({ a: 7 })));
    expect(result.current[0]).toEqual({ a: 7 });
  });
});

describe('DiaryModalShell — stale-чип и анимации', () => {
  const baseProps = { title: 'Тест', icon: '💤', color: '#a78bfa', onSubmit: () => {} };

  it('не рендерится при open=false', () => {
    render(<DiaryModalShell open={false} onClose={() => {}} {...baseProps}>x</DiaryModalShell>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('рендерит dialog + stale-чип «3 дн. назад»', () => {
    render(
      <DiaryModalShell open onClose={() => {}} stale={{ days: 3 }} {...baseProps}>
        контент
      </DiaryModalShell>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/3 дн\. назад/)).toBeTruthy();
  });
  it('stale=null — без чипа, спарклайн присутствует при spark', () => {
    render(
      <DiaryModalShell open onClose={() => {}} spark={{ data: [1, 2, 3, 4, 5] }} {...baseProps}>
        контент
      </DiaryModalShell>,
    );
    expect(screen.queryByText(/дн\. назад|вчера|сегодня/)).toBeNull();
    expect(screen.getByRole('dialog').querySelector('svg')).toBeTruthy();
  });
});

describe('findByDate — поиск записи за дату', () => {
  it('находит запись за дату', () => {
    const entries = [{ date: '2026-08-01' }, { date: '2026-08-10' }];
    expect(findByDate(entries, '2026-08-10')?.date).toBe('2026-08-10');
  });
  it('не находит за отсутствующую дату', () => {
    const entries = [{ date: '2026-08-01' }];
    expect(findByDate(entries, '2026-08-02')).toBeUndefined();
  });
  it('пустой массив → undefined', () => {
    expect(findByDate([], '2026-08-01')).toBeUndefined();
  });
  it('записи без date не ломают поиск', () => {
    const entries: { date?: string }[] = [{ notes: 'x' }, { date: '2026-08-10' }];
    expect(findByDate(entries, '2026-08-10')).toBeTruthy();
    expect(findByDate(entries, '2026-08-01')).toBeUndefined();
  });
});

describe('Round 4 — баннер «запись уже есть» (замена)', () => {
  const noop = () => {};
  const today = todayIso();
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('сон: баннер при записи за ту же дату, summary содержит часы', () => {
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: today, hours: 7.5, quality: 4 }]));
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    expect(screen.getByText(new RegExp('Запись за ' + today + ' уже есть'))).toBeTruthy();
    expect(screen.getByText(/7\.5 ч/)).toBeTruthy();
    expect(screen.getByText(/будет заменена/)).toBeTruthy();
  });
  it('сон: нет баннера, если запись за другую дату', () => {
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: '2020-01-01', hours: 6 }]));
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    expect(screen.queryByText(/уже есть/)).toBeNull();
  });
  it('вес: баннер при записи за ту же дату с весом', () => {
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: today, weight: 82.5 }]));
    render(<AddBodyMeasurementsModal open onClose={noop} onSave={noop} />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(new RegExp('Запись за ' + today + ' уже есть'));
    expect(banner.textContent).toMatch(/82\.5 кг/);
    expect(banner.textContent).toMatch(/будет заменена/);
  });
  it('вес: нет баннера при другой дате', () => {
    localStorage.setItem('he_weight_log', JSON.stringify([{ date: '2020-01-01', weight: 80 }]));
    render(<AddBodyMeasurementsModal open onClose={noop} onSave={noop} />);
    expect(screen.queryByText(/уже есть/)).toBeNull();
  });
  it('инъекция: баннер с названием препарата (тот же препарат за дату)', () => {
    localStorage.setItem('he_injection_diary', JSON.stringify([{ date: today, substance: 'Тестостерон энантат', dose: '250 мг' }]));
    render(<AddInjectionModal open onClose={noop} onSave={noop} />);
    fireEvent.change(screen.getByLabelText(/Препарат/), { target: { value: 'Тестостерон энантат' } });
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(new RegExp('Запись за ' + today + ' уже есть'));
    expect(banner.textContent).toMatch(/Тестостерон энантат/);
    expect(banner.textContent).toMatch(/250 мг/);
  });
  it('инъекция: другой препарат за ту же дату НЕ даёт баннер (2 укола в день допустимы)', () => {
    localStorage.setItem('he_injection_diary', JSON.stringify([{ date: today, substance: 'Тестостерон энантат', dose: '250 мг' }]));
    render(<AddInjectionModal open onClose={noop} onSave={noop} />);
    fireEvent.change(screen.getByLabelText(/Препарат/), { target: { value: 'Нандролон' } });
    expect(screen.queryByText(/уже есть/)).toBeNull();
  });
  it('здоровье: баннер при существующей записи за дату', () => {
    localStorage.setItem('he_health_diary', JSON.stringify([{ date: today, pain: { totalScore: 5 } }]));
    render(<AddHealthModal open onClose={noop} onSave={noop} />);
    expect(screen.getByText(new RegExp('Запись здоровья за ' + today + ' уже есть'))).toBeTruthy();
  });
});

describe('AddSleepModal — секция «Факторы» (паритет с полной формой)', () => {
  const noop = () => {};
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('секция свёрнута по умолчанию: тумблер есть, полей нет', () => {
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    expect(screen.getByRole('button', { name: /Факторы/ })).toBeTruthy();
    expect(screen.queryByLabelText(/Засыпание, мин/)).toBeNull();
    expect(screen.queryByLabelText(/Экран перед сном/)).toBeNull();
  });

  it('клик по тумблеру раскрывает все поля факторов', () => {
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Факторы/ }));
    expect(screen.getByLabelText(/Засыпание, мин/)).toBeTruthy();
    expect(screen.getByLabelText(/Кофеин до/)).toBeTruthy();
    expect(screen.getByLabelText(/Экран перед сном/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Алкоголь' })).toBeTruthy();
    expect(screen.getByText('Стресс за день')).toBeTruthy();
  });

  it('факторы наследуются из последней записи (дефолт черновика)', () => {
    localStorage.setItem(
      'he_sleep_diary',
      JSON.stringify([{ date: '2026-08-01', hours: 7, quality: 4, latency: 18, screenTime: 40, caffeineCutoff: '13:00', stressLevel: 6, alcohol: true }]),
    );
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Факторы/ }));
    expect((screen.getByLabelText(/Засыпание, мин/) as HTMLInputElement).value).toBe('18');
    expect((screen.getByLabelText(/Экран перед сном/) as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText(/Кофеин до/) as HTMLInputElement).value).toBe('13:00');
    expect(screen.getByRole('button', { name: /✓ Алкоголь/ })).toBeTruthy();
  });

  it('качество наследуется из последней записи (не дефолт 4)', () => {
    localStorage.setItem('he_sleep_diary', JSON.stringify([{ date: '2026-08-01', hours: 7, quality: 2 }]));
    render(<AddSleepModal open onClose={noop} onSave={noop} />);
    expect(screen.getByRole('radio', { name: '😞' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '🙂' })).toHaveAttribute('aria-checked', 'false');
  });

  it('факторы попадают в onSave: латентность, кофеин, экран, алкоголь, стресс', () => {
    let saved: Record<string, unknown> | null = null;
    render(<AddSleepModal open onClose={noop} onSave={(e: any) => { saved = e; }} />);
    fireEvent.click(screen.getByRole('button', { name: /Факторы/ }));
    fireEvent.change(screen.getByLabelText(/Засыпание, мин/), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Кофеин до/), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText(/Экран перед сном/), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Алкоголь' }));
    fireEvent.click(screen.getByRole('radio', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(saved).toMatchObject({ latency: 25, caffeineCutoff: '15:00', screenTime: 45, alcohol: true, stressLevel: 6 });
  });

  it('невалидная латентность: error-баннер + сохранение заблокировано', () => {
    let saved = false;
    render(<AddSleepModal open onClose={noop} onSave={() => { saved = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /Факторы/ }));
    fireEvent.change(screen.getByLabelText(/Засыпание, мин/), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/0 до 300/);
    expect(saved).toBe(false);
  });
});
