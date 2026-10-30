/**
 * planner-settings-manual-gkg.test.tsx — регрессия на жалобу «в ручном режиме
 * появляется карточка БЖУ, данные вводятся, но НЕ применяются; применяются
 * только если вводить в старую карточку с авто-расчётом».
 *
 * Причина: карточка «Ввод в г/кг веса» писала только в manualGPerKg, а ручные
 * цели строятся из явных граммов (они заполняются при входе в ручной режим) —
 * г/кг молча игнорировались. Теперь г/кг × вес = граммы, и наоборот.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const seedBase = () => {
  try {
    localStorage.setItem('he_planner_mode', 'pro');
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
        training: { primaryGoal: 'mass' },
        pharma: { phase: 'course' },
        nutrition: {},
      },
    }));
  } catch {}
};
const btns = () => Array.from(document.querySelectorAll('button'));
const clickBtn = (re: RegExp) => {
  const found = btns().filter((b) => re.test(b.textContent || ''));
  if (found.length === 0) throw new Error(`button not found: ${re}`);
  fireEvent.click(found[found.length - 1]);
};
const numInputs = () => Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
const gkgInputs = () => numInputs().filter(i => i.placeholder === '0.0');
const gramTiles = () => numInputs().filter(i => i.placeholder !== '0.0');

const bootManual = () => {
  render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
  clickBtn(/Ручной ввод/); // режим «✏️ Ручной ввод» в сегменте КБЖУ
};

describe('Ручной режим: карточка «Ввод в г/кг веса» реально применяется', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    cleanup();
    seedBase();
  });

  it('ввод г/кг сразу пересчитывает граммы и калорийность (жалоба)', () => {
    bootManual();
    expect(gkgInputs().length).toBe(3);
    fireEvent.change(gkgInputs()[0], { target: { value: '2.5' } });
    fireEvent.change(gkgInputs()[1], { target: { value: '1' } });
    fireEvent.change(gkgInputs()[2], { target: { value: '4' } });
    // 85 кг: 2.5 → 213 г белка, 1 → 85 г жира, 4 → 340 г углеводов.
    expect(localStorage.getItem('he_manual_p')).toBe('213');
    expect(localStorage.getItem('he_manual_f')).toBe('85');
    expect(localStorage.getItem('he_manual_c')).toBe('340');
    // Ккал = Атwater от введённых макросов (213*4 + 85*9 + 340*4 = 2977).
    expect(localStorage.getItem('he_manual_kcal')).toBe('2977');
    // Плитки граммов показывают те же числа, что посчитаны из г/кг.
    expect(gramTiles().map(i => i.value)).toEqual(['2977', '213', '85', '340']);
  });

  it('вход в ручной режим заполняет карточку г/кг текущими целями (а не нулями)', () => {
    bootManual();
    const vals = gkgInputs().map(i => i.value);
    expect(vals.every(v => v !== '')).toBe(true);
    expect(Number(vals[0])).toBeGreaterThan(0.5);
  });

  it('правка плитки граммов синхронизирует г/кг и ккал (две карточки не врут)', () => {
    bootManual();
    const tiles = gramTiles();
    fireEvent.change(tiles[1], { target: { value: '170' } }); // белок, г
    // 170 / 85 = 2.0 г/кг в карточке г/кг.
    expect(gkgInputs()[0].value).toBe('2');
    const g = JSON.parse(localStorage.getItem('he_manual_g_per_kg') || '{}');
    expect(g.protein).toBe(2);
    expect(localStorage.getItem('he_manual_p')).toBe('170');
  });

  it('очистка поля г/кг не стирает граммы (не превращается в «авто» на первом символе)', () => {
    bootManual();
    const before = localStorage.getItem('he_manual_p');
    fireEvent.change(gkgInputs()[0], { target: { value: '' } });
    expect(localStorage.getItem('he_manual_p')).toBe(before);
  });

  it('рацион собирается по значениям, введённым в г/кг (сквозной путь)', async () => {
    bootManual();
    fireEvent.change(gkgInputs()[0], { target: { value: '2.5' } });
    fireEvent.change(gkgInputs()[1], { target: { value: '1' } });
    fireEvent.change(gkgInputs()[2], { target: { value: '4' } });
    clickBtn(/Рассчитать и создать рацион|Сгенерировать план питания/);
    await waitFor(() => { expect(localStorage.getItem('he_day_plan')).toBeTruthy(); }, { timeout: 60000 });
    const p = JSON.parse(localStorage.getItem('he_day_plan') || 'null');
    const t = p?.totals || {};
    expect(t.p, `белок плана ${t.p} ≠ 213`).toBeGreaterThanOrEqual(213 * 0.88);
    expect(t.p, `белок плана ${t.p} ≠ 213`).toBeLessThanOrEqual(213 * 1.12);
    expect(t.f, `жир плана ${t.f} ≠ 85`).toBeGreaterThanOrEqual(85 * 0.88);
    expect(t.c, `углеводы плана ${t.c} ≠ 340`).toBeGreaterThanOrEqual(340 * 0.88);
  });
});
