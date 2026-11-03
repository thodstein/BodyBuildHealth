/**
 * bb-hub-nodata-score.test.tsx — BB-D-05 (хвост): пустой хаб показывал «100 · ОК».
 *
 * Локи:
 *  - без скрининга, замеров и дневника балл — «—» серым (`data-state="nodata"`);
 *  - подпись говорит «НЕТ ДАННЫХ», а не «ОК»/«ВНИМАНИЕ»;
 *  - ввод первого замера возвращает настоящий балл (состояние не залипает).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const scoreEl = () => document.querySelector('[data-bb="score"]') as HTMLElement | null;

describe('BB-D-05 (хвост) · пустой хаб не врёт про 100', () => {
  beforeEach(() => { localStorage.clear(); });

  it('пустой хаб: «—», data-state=nodata, подпись «НЕТ ДАННЫХ · пров. —»', () => {
    render(<BBDiagnosticsHub />);
    const el = scoreEl();
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('—');
    expect(el!.getAttribute('data-state')).toBe('nodata');
    expect(el!.getAttribute('title')).toContain('Данных нет');
    const label = el!.parentElement!.textContent || '';
    expect(label).toContain('НЕТ ДАННЫХ');
    expect(label).toContain('пров. —');
    expect(label).not.toContain('ОК');
  });

  it('первый замер снимает «нет данных» и возвращает числовой балл', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Пропорции/ }));
    fireEvent.change(screen.getByLabelText('Рост, см'), { target: { value: '180' } });
    const el = scoreEl();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('data-state')).not.toBe('nodata');
    expect(el!.textContent).toMatch(/^\d+$/);
    expect(el!.parentElement!.textContent).not.toContain('НЕТ ДАННЫХ');
  });

  it('сохранённый план — это данные: хаб его аудирует, «нет данных» не показывается', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({
      weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 }] }] }],
    }));
    render(<BBDiagnosticsHub />);
    const el = scoreEl();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('data-state')).not.toBe('nodata');
    expect(el!.textContent).toMatch(/^\d+$/);
  });

  it('предзаполненные 175/80 — заглушка, а не замер: сами по себе балла не дают', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Пропорции/ }));
    // «Рост, см» и «Вес, кг» уже стоят, но это DEFAULT_STATE.circ, а не ввод пользователя
    expect((screen.getByLabelText('Рост, см') as HTMLInputElement).value).toBe('175');
    expect((screen.getByLabelText('Вес, кг') as HTMLInputElement).value).toBe('80');
    expect(scoreEl()!.getAttribute('data-state')).toBe('nodata');
  });
});
