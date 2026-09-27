import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { rankCorrectives } from '../../../../engines/bb/bb-corrective.engine';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

/** 1. Движок: зона — жёсткий первый ключ (глобальный сигнал соседней мышцы её не вытесняет).
 *  2. Хаб: ⭐ выбирает упражнение — клик меняет порядок в карточке (и это тот же мемо, что уходит в план). */
describe('bb-corrective zone-priority + выбор упражнения', () => {
  beforeEach(() => { localStorage.clear(); });

  it('зона ягодиц не отдаёт икроножные записи, даже когда горит сигнал голеностопа', () => {
    // Реальный дефект: ktw-asym + driver:ankle — это икры/голеностоп, а не ягодицы.
    const r = rankCorrectives({ zones: ['glutes'], cause: 'volume', ktwAsym: true, ybtAsym: true, driver: 'ankle' });
    const top3 = r.slice(0, 3).map((x) => x.corr);
    expect(top3.length).toBeGreaterThan(0);
    for (const c of top3) {
      expect(c.targets).toContain('glutes');
      expect(String(c.exerciseId)).not.toMatch(/calf/);
    }
    // Честная граница: запись икроножных не исчезает из выдачи — просто после зональных.
    expect(r.some((x) => /calf/.test(String(x.corr.exerciseId)))).toBe(true);
  });

  it('внутри зоны причина/сигнал по-прежнему решают порядок (зона не обнуляет ранжинг)', () => {
    const plain = rankCorrectives({ zones: ['glutes'] }).map((x) => x.corr.id);
    const withCause = rankCorrectives({ zones: ['glutes'], cause: 'volume' }).map((x) => x.corr.id);
    expect(plain[0]).toBe(withCause[0]); // топ по зоне стабилен
    const scoreOf = (list: Array<{ corr: { id: string }; score: number }>, id: string) =>
      list.find((x) => x.corr.id === id)?.score ?? -1;
    const vol = rankCorrectives({ zones: ['glutes'], cause: 'volume' });
    const none = rankCorrectives({ zones: ['glutes'] });
    expect(scoreOf(vol, 'g-hip-thrust')).toBeGreaterThan(scoreOf(none, 'g-hip-thrust'));
  });

  it('зона без своих записей: сигнальные записи остаются в выдаче (легаси-фолбэк)', () => {
    const r = rankCorrectives({ zones: ['совсем_нет_такой_зоны'], rotGap: true });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.corr.targets.includes('rot-gap'))).toBe(true);
  });

  it('хаб: ⭐ выбирает упражнение коррекции и поднимает его наверх', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    render(<BBDiagnosticsHub />);
    const picks = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    expect(picks.length).toBeGreaterThanOrEqual(2);
    // по умолчанию ничего не выбрано — честная подсказка
    expect(document.querySelector('[data-bb="corrective-pick-note"]')!.textContent).toMatch(/не выбрано/);
    // выбираем ВТОРОЕ упражнение
    const second = picks[1] as HTMLElement;
    const corrId = second.getAttribute('data-corr');
    fireEvent.click(second);
    const after = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    expect(after[0].getAttribute('data-corr')).toBe(corrId);
    expect(after[0].getAttribute('data-active')).toBe('1');
    expect(document.querySelector('[data-bb="corrective-pick-note"]')!.textContent).toMatch(/Выбрано/);
  });

  it('хаб: выбор переживает перезагрузку (персист в state хаба)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    const first = render(<BBDiagnosticsHub />);
    const picks = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    const corrId = picks[1].getAttribute('data-corr');
    fireEvent.click(picks[1]);
    const saved = JSON.parse(localStorage.getItem('he_bb_diagnostics_hub_v1') || '{}');
    expect(saved.prefCorr).toEqual({ glutes: corrId });
    first.unmount();
    render(<BBDiagnosticsHub />);
    const after = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    expect(after[0].getAttribute('data-corr')).toBe(corrId);
    expect(after[0].getAttribute('data-active')).toBe('1');
  });

  it('хаб: повторный клик по ⭐ снимает выбор (возврат к ранжиру)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    render(<BBDiagnosticsHub />);
    const picks = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    fireEvent.click(picks[1]);
    const active = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'))
      .find((x) => x.getAttribute('data-active') === '1');
    expect(active).toBeTruthy();
    fireEvent.click(active!);
    expect(document.querySelector('[data-bb="corrective-pick-note"]')!.textContent).toMatch(/не выбрано/);
  });

  it('хаб: в зоне ягодиц карточка не предлагает подъёмы на носки (икры)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({
      weakManual: ['glutes'], ktwL: '7', ktwR: '9', ankleDeg: '32',
    }));
    render(<BBDiagnosticsHub />);
    const rows = Array.from(document.querySelectorAll('[data-bb="corrective-row"]'));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const t = r.textContent || '';
      expect(t).not.toMatch(/Подъём на носки|Подъёмы на носки/);
    }
  });
});
