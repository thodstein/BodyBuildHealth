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
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PLToolsCard } from '../PLToolsCard';

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
