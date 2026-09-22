/**
 * pl-tools-card.test.tsx — Фаза 1: инструменты не показывают вымышленные данные.
 *
 *  1. Frequency Planner получает РЕАЛЬНЫЕ недельные объёмы (prop), при пустых —
 *     честная подсказка «постройте план», а не хардкод.
 *  2. DOTS считается по реальному весу/полу из профиля (83 кг male — только явный фолбэк).
 *  3. «Сохранить LVP» пишет канонический профиль `{[lift]: LVPProfile}` (плоский
 *     формат прежней версии не читался VBT/WL-хабом).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PLToolsCard } from '../PLToolsCard';
import { fetchOPLHistory } from '../../../../engines/openpowerlifting-import.engine';

// §10.3: сетевой путь OPL-импорта тестируется моком движка (реальная сеть в тестах — нет);
// oplToDotsHistory остаётся настоящим (график строится реальной функцией).
vi.mock('../../../../engines/openpowerlifting-import.engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../engines/openpowerlifting-import.engine')>();
  return { ...actual, fetchOPLHistory: vi.fn() };
});

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

const e1RM = { squat: 180, bench: 120, deadlift: 220 };
/** Минимальный план для секции Sheiko/DOTS (иначе блок не рендерится). */
const plan = { weeks: [{ week: 1, days: [{ exercises: [{ workSets: [{ weight: 100, reps: 5, sets: 3, pct: 0.8 }] }] }] }] };

describe('PLToolsCard — честные данные', () => {
  it('Frequency Planner показывает переданные реальные объёмы', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 14, back: 18 }} e1RM={e1RM} />);
    expect(screen.getByText(/chest 14п\/нед/)).toBeTruthy();
    expect(screen.getByText(/back 18п\/нед/)).toBeTruthy();
  });

  it('без объёмов — подсказка «постройте план» вместо вымышленных цифр', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{}} e1RM={e1RM} />);
    expect(screen.getByText(/Объёмы берутся из собранного плана/)).toBeTruthy();
  });

  it('DOTS использует реальный вес и пол из профиля', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} bodyWeight={70} sex="female" plan={plan} />);
    const line = document.querySelector('[data-pl="dots-line"]')?.textContent || '';
    expect(line).toContain('(70кг female)');
  });

  it('без профиля DOTS честно помечает фолбэк 83 кг', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} plan={plan} />);
    const line = document.querySelector('[data-pl="dots-line"]')?.textContent || '';
    expect(line).toContain('83кг male — профиль не заполнен');
  });

  it('«Сохранить LVP» пишет канонический профиль {squat: LVPProfile}', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    fireEvent.click(screen.getByText('Сохранить LVP'));
    const raw = localStorage.getItem('he_lv_profile_ss_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.squat).toBeTruthy();
    expect(parsed.squat.lift).toBe('squat');
    expect(Array.isArray(parsed.squat.points)).toBe(true);
    expect(parsed.squat.points.length).toBe(3);
    expect(typeof parsed.squat.slope).toBe('number');
    expect(typeof parsed.squat.r2).toBe('number');
    expect(screen.getByText(/✓ сохранено \(squat/)).toBeTruthy();
  });
});

// P2-3 (аудит): he_opl_history больше не write-only — сохранённые старты читаются
// при монтировании и рисуются графиком DOTS; битый стор → честно пусто.
describe('PLToolsCard — история OpenPowerlifting (DOTS)', () => {
  const OPL_MEETS = [
    { date: '2024-03-10', federation: 'FPR', totalKg: 500, bwKg: 83, dots: 320, squatKg: 180, benchKg: 120, deadliftKg: 200 },
    { date: '2025-05-18', federation: 'FPR', totalKg: 530, bwKg: 83, dots: 355.5, squatKg: 190, benchKg: 130, deadliftKg: 210 },
  ];

  it('сохранённая история рисуется графиком DOTS (лучший результат + диапазон дат)', () => {
    localStorage.setItem('he_opl_history', JSON.stringify(OPL_MEETS));
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    // Секция OPL свёрнута по умолчанию — раскрываем (контент монтируется только открытым).
    fireEvent.click(screen.getByText('OpenPowerlifting импорт'));
    const hist = document.querySelector('[data-pl="opl-history"]');
    expect(hist).toBeTruthy();
    expect(hist!.textContent).toContain('2 стартов');
    expect(hist!.textContent).toContain('лучший 356');
    expect(hist!.textContent).toContain('2025-05-18');
    expect(hist!.querySelectorAll('circle').length).toBe(2);
  });

  it('битый/чужой he_opl_history → блок не рисуется (честно, без краха)', () => {
    localStorage.setItem('he_opl_history', '{not-json');
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    fireEvent.click(screen.getByText('OpenPowerlifting импорт'));
    expect(document.querySelector('[data-pl="opl-history"]')).toBeNull();
  });

  it('пустая история — подсказки нет, ввод доступен', () => {
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    fireEvent.click(screen.getByText('OpenPowerlifting импорт'));
    expect(document.querySelector('[data-pl="opl-history"]')).toBeNull();
    expect(screen.getByPlaceholderText('Имя атлета')).toBeTruthy();
  });

  it('«Найти» (мок сети): история сохраняется (he_opl_history/name) и рисуется DOTS', async () => {
    (fetchOPLHistory as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OPL_MEETS);
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    fireEvent.click(screen.getByText('OpenPowerlifting импорт'));
    fireEvent.change(screen.getByPlaceholderText('Имя атлета'), { target: { value: 'Иванов' } });
    fireEvent.click(screen.getByText('Найти'));
    await waitFor(() => expect(document.querySelector('[data-pl="opl-history"]')).toBeTruthy());
    expect(localStorage.getItem('he_opl_name')).toBe('Иванов');
    expect(JSON.parse(localStorage.getItem('he_opl_history') || '[]')).toHaveLength(2);
    expect(document.querySelector('[data-pl="opl-history"]')!.textContent).toContain('2 стартов');
  });

  it('имя атлета восстанавливается из he_opl_name при монтировании (не write-only)', () => {
    localStorage.setItem('he_opl_name', 'Петров');
    render(<PLToolsCard level="II-KMS" days={4} totalSets={{ chest: 12 }} e1RM={e1RM} />);
    fireEvent.click(screen.getByText('OpenPowerlifting импорт'));
    expect((screen.getByPlaceholderText('Имя атлета') as HTMLInputElement).value).toBe('Петров');
  });
});
