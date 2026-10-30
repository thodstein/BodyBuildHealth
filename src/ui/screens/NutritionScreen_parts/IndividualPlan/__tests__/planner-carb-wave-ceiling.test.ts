/**
 * planner-carb-wave-ceiling.test.ts — B11 (аудит 2026-10).
 *
 * Находка: клинический потолок углеводов (5–10 г/кг) применялся только к БАЗОВОЙ цели
 * дня. Карб-периодизация умножала её (тренировочный день ×1.25, «тяжёлый» ×1.25,
 * рефид ×2.2), и итоговая цель дня уходила за потолок без всякого предела — то есть
 * защита от перебора (инсулин, HV) не работала там, где она и нужна.
 *
 * Решение: у волны свой абсолютный предел — 12 г/кг (гликогенная суперкомпенсация).
 * Дни явной суперкомпенсации (рефид/карб-лоад) освобождены: там превышение базы —
 * это цель, и оно проговаривается пользователю отдельной заметкой.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyCarbWave, CARB_WAVE_HARD_CAP_G_PER_KG } from '../planner-targets';

describe('B11: волна карб-периодизации ограничена физиологическим пределом', () => {
  it('обычная волна внутри предела не меняется', () => {
    // сушка 80 кг: база 400 г (5 г/кг), тренировочный день ×1.25 = 500 г (6.25 г/кг)
    const r = applyCarbWave(400, 1.25, 80);
    expect(r.carbsG).toBe(500);
    expect(r.waveClipped).toBe(false);
  });

  it('экстремальная волна срезается до 12 г/кг', () => {
    // bulk 10 г/кг (800 г) × 1.25 = 1000 г = 12.5 г/кг → предел 960 г
    const r = applyCarbWave(800, 1.25, 80);
    expect(r.carbsG).toBe(80 * CARB_WAVE_HARD_CAP_G_PER_KG);
    expect(r.carbsG).toBe(960);
    expect(r.waveClipped).toBe(true);
  });

  it('предел масштабируется весом, а не абсолютным числом', () => {
    // 60 кг: предел 720 г; 700 × 1.25 = 875 → срез
    expect(applyCarbWave(700, 1.25, 60).carbsG).toBe(720);
    expect(applyCarbWave(700, 1.25, 60).waveClipped).toBe(true);
    // 120 кг: предел 1440 г; та же волна проходит целиком
    expect(applyCarbWave(700, 1.25, 120).carbsG).toBe(875);
    expect(applyCarbWave(700, 1.25, 120).waveClipped).toBe(false);
  });

  it('рефид/карб-лоад освобождён от предела (это и есть цель дня)', () => {
    // рефид ×2.2 на сушке: 400 → 880 г = 11 г/кг — легально
    const r = applyCarbWave(400, 2.2, 80, { allowSupercompensation: true });
    expect(r.carbsG).toBe(880);
    expect(r.waveClipped).toBe(false);
    // и даже выше 12 г/кг на рефиде не режем
    expect(applyCarbWave(800, 2.2, 80, { allowSupercompensation: true }).carbsG).toBe(1760);
  });

  it('модификатор 0/NaN/отрицательный трактуется как «без волны»', () => {
    expect(applyCarbWave(400, 0, 80).carbsG).toBe(400);
    expect(applyCarbWave(400, Number.NaN, 80).carbsG).toBe(400);
    expect(applyCarbWave(400, -1, 80).carbsG).toBe(400);
  });

  it('пол углеводов 50 г соблюдается даже при мусорном весе', () => {
    expect(applyCarbWave(10, 1, 0).carbsG).toBe(50);
    expect(applyCarbWave(0, 1.25, 80).carbsG).toBe(50);
  });

  it('Context применяет предел к цели дня (все три места расчёта)', () => {
    const src = readFileSync(join(__dirname, '..', 'IndividualPlanContext.tsx'), 'utf8');
    expect(src).toMatch(/applyCarbWave\(baseGoalC, dayCarbMod, weight/);
    // Ни одного «сырого» baseGoalC * dayCarbMod в целях движка не осталось.
    expect(src).not.toMatch(/Math\.max\(50, baseGoalC \* dayCarbMod\)/);
    // Рефид объявлен исключением явно.
    expect(src).toMatch(/allowSupercompensation: isRefeedDay/);
  });
});
