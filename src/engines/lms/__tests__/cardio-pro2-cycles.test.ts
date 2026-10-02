/**
 * cardio-pro2-cycles.test.ts — локи волны PRO-2 библиотеки кардио-циклов:
 * 11 профессиональных блоков (порог/VO2max/горки бегуна, FTP/100 км вело,
 * 5K гребля, 1500 м плавание, олимпийский триатлон, HYROX, боевое кардио,
 * HIIT-периодизация) + 3 новых интервальных пресета.
 * Проверяются: мета, сборка, делод/taper-недели, ключевые сессии-якоря,
 * валидатор (0 error) и честность kind/faithful-штампа.
 */
import { describe, it, expect } from 'vitest';
import {
  CARDIO_CYCLES, CARDIO_PRO2_CYCLES, getCardioCycleTemplateById,
} from '../../../data/cardio-cycles/cardio-cycle-index';
import { buildCardioCycleFromTemplateId } from '../cardio-templates.engine';
import { validateCardioCycle } from '../cardio-plan-validate.engine';
import { CARDIO_INTERVAL_PRESETS, getCardioIntervalPreset } from '../cardio-interval-presets.engine';

const build = (id: string) => buildCardioCycleFromTemplateId(id, { bodyWeight: 80, age: 30 })!;

describe('PRO-2 библиотека: мета', () => {
  it('11 новых шаблонов, id уникальны и в общем реестре', () => {
    expect(CARDIO_PRO2_CYCLES.length).toBe(11);
    const ids = CARDIO_PRO2_CYCLES.map(t => t.meta.id);
    expect(new Set(ids).size).toBe(11);
    for (const id of ids) {
      expect(getCardioCycleTemplateById(id)).toBeDefined();
      expect(CARDIO_CYCLES.some(c => c.meta.id === id)).toBe(true);
    }
  });
  it('все explicit с дословной разметкой (weeks = meta.weeks)', () => {
    for (const t of CARDIO_PRO2_CYCLES) {
      expect(t.meta.kind).toBe('explicit');
      expect(t.weeks?.length).toBe(t.meta.weeks);
      expect(t.meta.sourceLabel.length).toBeGreaterThan(10);
      for (const w of t.weeks!) {
        expect(w.sessions.length).toBeGreaterThan(0);
        for (const s of w.sessions) expect(s.durationMin).toBeGreaterThan(0);
      }
    }
  });
  it('каждый собирается без бросков; валидатор — 0 error', () => {
    for (const t of CARDIO_PRO2_CYCLES) {
      const c = build(t.meta.id);
      expect(c.totalWeeks).toBe(t.meta.weeks);
      expect(c.weeks.length).toBe(t.meta.weeks);
      expect(c.totalKcal).toBeGreaterThan(0);
      expect(c.config?.templateId).toBe(t.meta.id);
      const v = validateCardioCycle(c);
      expect(v.issues.filter(i => i.level === 'error')).toEqual([]);
      expect(v.valid).toBe(true);
    }
  });
  it('делоды из meta реально помечены deload', () => {
    for (const t of CARDIO_PRO2_CYCLES) {
      const c = build(t.meta.id);
      for (const w of t.meta.deloadWeeks ?? []) {
        expect(c.weeks[w - 1].deload).toBe(true);
      }
    }
  });
  it('taper-недели из meta помечены taper/peak', () => {
    for (const t of CARDIO_PRO2_CYCLES) {
      const c = build(t.meta.id);
      for (const w of t.meta.taperWeeks ?? []) {
        const week = c.weeks[w - 1];
        expect(week.taper || week.phase === 'taper' || week.phase === 'peak').toBe(true);
      }
    }
  });
});

describe('PRO-2 якоря сессий', () => {
  const purposesOf = (id: string, w: number) => build(id).weeks[w - 1].sessions.map(s => s.purpose ?? '').join(' | ');

  it('порог бегуна: 3×8 → 25 мин нон-стоп → тест 10К', () => {
    expect(purposesOf('cardio-run-threshold-8', 1)).toContain('3×8');
    expect(purposesOf('cardio-run-threshold-8', 7)).toContain('25 мин нон-стоп');
    expect(purposesOf('cardio-run-threshold-8', 8)).toContain('ТЕСТ 10К');
  });
  it('VO2max/5K: 8×400 → 4×1000 → гонка 5К', () => {
    expect(purposesOf('cardio-run-vo2max-6', 1)).toContain('8×400');
    expect(purposesOf('cardio-run-vo2max-6', 5)).toContain('4×1000');
    expect(purposesOf('cardio-run-vo2max-6', 6)).toContain('ГОНКА 5К');
  });
  it('горки: 6×90 с на 5-й, холмистый тест на 6-й', () => {
    expect(purposesOf('cardio-run-hills-6', 5)).toContain('6×90 с');
    expect(purposesOf('cardio-run-hills-6', 6)).toContain('холмистому');
  });
  it('FTP Builder: тест до/после, 2×25 мин SS в середине', () => {
    expect(purposesOf('cardio-bike-ftp-builder-6', 1)).toContain('FTP-тест');
    expect(purposesOf('cardio-bike-ftp-builder-6', 5)).toContain('2×25');
    expect(purposesOf('cardio-bike-ftp-builder-6', 6)).toContain('итоговый');
  });
  it('100 км: длинная растёт до 3 часов, событие в финале', () => {
    expect(purposesOf('cardio-bike-century-10', 7)).toContain('3 часа');
    expect(purposesOf('cardio-bike-century-10', 10)).toContain('100 км');
  });
  it('гребля 5K: 4×1000 м → 3×2000 м → тест 5К', () => {
    expect(purposesOf('cardio-row-5k-8', 1)).toContain('4×1000');
    expect(purposesOf('cardio-row-5k-8', 6)).toContain('3×2000');
    expect(purposesOf('cardio-row-5k-8', 8)).toContain('ТЕСТ 5К');
  });
  it('плавание: 1000 → первая 1500 → тест 1500', () => {
    expect(purposesOf('cardio-swim-1500-8', 1)).toContain('1000 м');
    expect(purposesOf('cardio-swim-1500-8', 6)).toContain('первая попытка 1500');
    expect(purposesOf('cardio-swim-1500-8', 8)).toContain('ТЕСТ 1500');
  });
  it('олимпийский триатлон: кирпич с 5-й, старт в финале', () => {
    expect(purposesOf('cardio-pro-tri-olympic-12', 5)).toContain('Кирпич');
    expect(purposesOf('cardio-pro-tri-olympic-12', 12)).toContain('СТАРТ');
  });
  it('HYROX: компромиссные связки и полная симуляция', () => {
    expect(purposesOf('cardio-hyrox-12', 5)).toContain('Компромисс');
    expect(purposesOf('cardio-hyrox-12', 10)).toContain('ПОЛНАЯ СИМУЛЯЦИЯ');
    expect(purposesOf('cardio-hyrox-12', 12)).toContain('СТАРТ HYROX');
  });
  it('боевое кардио: 30-30 и финальный тест-бой', () => {
    expect(purposesOf('cardio-combat-8', 1)).toContain('30 с боевым темпом');
    expect(purposesOf('cardio-combat-8', 8)).toContain('ТЕСТ-БОЙ');
  });
  it('HIIT-периодизация: 4×4 → Billat → SIT → тест', () => {
    expect(purposesOf('cardio-hiit-block-6', 1)).toContain('Norwegian');
    expect(purposesOf('cardio-hiit-block-6', 3)).toContain('Billat');
    expect(purposesOf('cardio-hiit-block-6', 5)).toContain('SIT');
    expect(purposesOf('cardio-hiit-block-6', 6)).toContain('ТЕСТ');
  });
});

describe('PRO-2 интервальные пресеты (6 → 9)', () => {
  it('9 пресетов, новые id на месте', () => {
    expect(CARDIO_INTERVAL_PRESETS.length).toBe(9);
    expect(CARDIO_INTERVAL_PRESETS.map(p => p.id)).toEqual(
      expect.arrayContaining(['hills-8x60', 'sweet-spot-3x12', 'row-4x1500']),
    );
  });
  it('горки 8×60/120', () => {
    const b = getCardioIntervalPreset('hills-8x60')!.build({});
    expect(b).toMatchObject({ workSec: 60, restSec: 120, reps: 8 });
    expect(getCardioIntervalPreset('hills-8x60')!.equipment).toEqual(['running']);
  });
  it('Sweet Spot 3×12 мин — тип miss (не HIIT), вело', () => {
    const p = getCardioIntervalPreset('sweet-spot-3x12')!;
    expect(p.sessionType).toBe('miss');
    expect(p.build({})).toMatchObject({ workSec: 720, restSec: 240, reps: 3, target: 'power' });
    expect(p.equipment).toEqual(['cycling']);
  });
  it('гребля 4×1500 м / 3 мин', () => {
    const p = getCardioIntervalPreset('row-4x1500')!;
    expect(p.build({})).toMatchObject({ workSec: 360, restSec: 180, reps: 4, target: 'pace' });
    expect(p.equipment).toEqual(['rowing']);
  });
});
