/**
 * pl-readiness-ui.test.tsx — Фаза 6, п.6: чек-ин в UI.
 *
 * Проверяем то, что видит и делает пользователь:
 *  • карточка чек-ина показывает зону и НЕ повышает нагрузку;
 *  • сохранение пишет только «сегодняшний» чек-ин, сброс его убирает;
 *  • плеер видит чек-ин и честно сообщает, что веса этой сессии скорректированы;
 *  • без чек-ина плеер ничего не меняет и ничего не сообщает.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLReadinessCard } from '../PLReadinessCard';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { PL_CHECKIN_KEY } from '../../../../engines/lms/pl-readiness-adjust.engine';
import { localIsoDate, localIsoDateOffset } from '../../../../core/local-date';

const badCheckin = { sleepHours: 4.5, hrvRatio: 0.7, doms: 8, stress: 8 };
const goodCheckin = { sleepHours: 8, hrvRatio: 1, doms: 0, stress: 0 };

const day = (): PlayerDay => ({
  label: 'День 1 · присед',
  exercises: [{
    name: 'Присед',
    group: 'legs',
    load: 'Тяжелая',
    restSec: 180,
    targetSets: [{ weight: 150, reps: 5, rir: 2 }],
  } as never],
});

describe('PLReadinessCard — утренний чек-ин', () => {
  beforeEach(() => { try { localStorage.removeItem(PL_CHECKIN_KEY); } catch { /* ignore */ } });

  it('при плохом сне показывает жёлтую зону и объём ×0.85, RIR +1', () => {
    render(<PLReadinessCard />);
    const sleep = screen.getByLabelText('Сон, часов') as HTMLInputElement;
    fireEvent.change(sleep, { target: { value: '6' } });
    const verdict = document.querySelector('[data-pl="pl-checkin-verdict"]');
    // 6 ч сна (−12) + HRV 100 % (0) → 88 баллов: всё ещё зелёная.
    expect(verdict!.textContent).toMatch(/88\/100/);
    const hrv = screen.getByLabelText('HRV, процент от базы') as HTMLInputElement;
    fireEvent.change(hrv, { target: { value: '85' } });
    expect(document.querySelector('[data-pl="pl-checkin-verdict"]')!.textContent).toMatch(/жёлтая зона: объём ×0\.85, RIR \+1/);
  });

  it('«Применить на сегодня» пишет чек-ин с сегодняшней датой', () => {
    render(<PLReadinessCard />);
    fireEvent.change(screen.getByLabelText('Сон, часов'), { target: { value: '4.5' } });
    fireEvent.change(screen.getByLabelText('HRV, процент от базы'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Мышечная боль'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Стресс'), { target: { value: '8' } });
    fireEvent.click(document.querySelector('[data-pl="pl-checkin-save"]') as HTMLElement);
    const raw = localStorage.getItem(PL_CHECKIN_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.date).toBe(localIsoDate());
    expect(parsed.verdict.level).toBe('red');
  });

  it('«Сбросить» убирает чек-ин', () => {
    render(<PLReadinessCard />);
    fireEvent.click(document.querySelector('[data-pl="pl-checkin-save"]') as HTMLElement);
    expect(localStorage.getItem(PL_CHECKIN_KEY)).toBeTruthy();
    fireEvent.click(document.querySelector('[data-pl="pl-checkin-clear"]') as HTMLElement);
    expect(localStorage.getItem(PL_CHECKIN_KEY)).toBeNull();
  });

  it('предпросмотр показывает, что изменится в первом дне', () => {
    render(<PLReadinessCard previewDay={[{ name: 'Присед', targetSets: [{ weight: 150, reps: 5, rir: 2 }, { weight: 140, reps: 5, rir: 2 }] }]} />);
    fireEvent.change(screen.getByLabelText('Сон, часов'), { target: { value: '4.5' } });
    fireEvent.change(screen.getByLabelText('HRV, процент от базы'), { target: { value: '70' } });
    const preview = document.querySelector('[data-pl="pl-checkin-preview"]');
    expect(preview).toBeTruthy();
    // Красная зона: 2 подхода × 0.6 → 1 подход, вес 150 × 0.95 = 142.5.
    expect(preview!.textContent).toMatch(/Присед: 2×150 → 1×142\.5/);
  });

  it('чек-ин не поднимает нагрузку: хорошие показатели дают 100 и «без изменений»', () => {
    render(<PLReadinessCard />);
    const verdict = document.querySelector('[data-pl="pl-checkin-verdict"]');
    expect(verdict!.textContent).toMatch(/100\/100/);
    expect(verdict!.textContent).toMatch(/без изменений/);
  });
});

describe('SessionPlayer — чек-ин влияет на сегодняшнюю сессию', () => {
  beforeEach(() => { try { localStorage.removeItem(PL_CHECKIN_KEY); } catch { /* ignore */ } });

  it('красный чек-ин → видимый баннер в плеере (веса скорректированы, план не тронут)', () => {
    localStorage.setItem(PL_CHECKIN_KEY, JSON.stringify({ date: localIsoDate(), checkin: badCheckin, verdict: {} }));
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    const banner = document.querySelector('[data-session="readiness"]');
    expect(banner).toBeTruthy();
    expect(banner!.textContent).toMatch(/Чек-ин: готовность/);
    expect(banner!.textContent).toMatch(/без отказа/);
    expect(banner!.textContent).toMatch(/план недели не изменён/);
  });

  it('без чек-ина баннера нет (тренировка по плану)', () => {
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    expect(document.querySelector('[data-session="readiness"]')).toBeNull();
  });

  it('зелёный чек-ин не меняет тренировку и не показывает баннер', () => {
    localStorage.setItem(PL_CHECKIN_KEY, JSON.stringify({ date: localIsoDate(), checkin: goodCheckin, verdict: {} }));
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    expect(document.querySelector('[data-session="readiness"]')).toBeNull();
  });

  it('вчерашний чек-ин сегодня не действует', () => {
    const yesterday = localIsoDateOffset(-1);
    localStorage.setItem(PL_CHECKIN_KEY, JSON.stringify({ date: yesterday, checkin: badCheckin, verdict: {} }));
    render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    expect(document.querySelector('[data-session="readiness"]')).toBeNull();
  });
});
