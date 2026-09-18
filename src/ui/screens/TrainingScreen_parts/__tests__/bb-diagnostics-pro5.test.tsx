/**
 * PRO-5 (docs/BB-DIAGNOSTICS-HUB-PRO-5.md) — UI-локи эпиков хаба диагностики ББ.
 * Э2 свежесть: профиль без ремаунта + report/balance по planNonce + локальные даты.
 * Э1 возврат: ступени возврата в работу.
 * Э3 паритет выдачи: спец-блок/трекинг.
 * Э4 каталог Разбора: план первыми + поиск.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

const planWith = (ex: Array<Record<string, unknown>>) => ({ weeks: [{ sessions: [{ exercises: ex }] }] });

beforeEach(() => { localStorage.clear(); });

describe('PRO-5 Э2 свежесть данных', () => {
  it('профиль: profile-updated без ремаунта включает teen-гейт', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    expect(document.querySelector('[data-bb="teen-gate"]')).toBeNull();
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { age: 14 } } }));
    fireEvent(window, new CustomEvent('profile-updated'));
    expect(document.querySelector('[data-bb="teen-gate"]')).not.toBeNull();
  });

  it('report/balance: откат снимка пересчитывает отчёт (planNonce) — кольцо меняет балл', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify(planWith([
      { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 },
    ])));
    localStorage.setItem('he_bb_plan_history', JSON.stringify([{
      date: '2026-01-01', label: 'снимок',
      plan: planWith([{ exerciseName: 'leg_ext', name: 'Разгибание ног сидя', muscle: 'quads', sets: 6, rir: 2 }]),
    }]));
    render(<BBDiagnosticsHub />);
    const before = document.querySelector('[data-bb="score"]')?.textContent || '';
    expect(before).not.toBe('');
    fireEvent.click(screen.getByText('↩ Восстановить'));
    const after = document.querySelector('[data-bb="score"]')?.textContent || '';
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });

  it('локальные даты: снимок замеров пишется локальной датой, UTC-срез в хабе не остался', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Пропорции/ }));
    fireEvent.click(screen.getByText('Снимок сегодня'));
    const hist = JSON.parse(localStorage.getItem('he_bb_measure_history') || '[]');
    const local = new Date().toLocaleDateString('sv-SE');
    expect(hist[0]?.date).toBe(local);
    // source-guard: ни одного UTC-среза даты и ≥7 канонических localIsoDate
    expect(SRC.includes('toISOString().slice(0, 10)')).toBe(false);
    expect((SRC.match(/localIsoDate\(\)/g) || []).length).toBeGreaterThanOrEqual(7);
  });

  it('source-guard: report/balance зависят от planNonce; профиль-мемы от profileNonce', () => {
    expect(SRC).toMatch(/const balance = useMemo\([\s\S]{0,600}?\}, \[diarySessions, planNonce\]\);/);
    expect(SRC).toMatch(/state\.weakManual, planNonce\]\);/);
    expect((SRC.match(/\[profileNonce\]/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
