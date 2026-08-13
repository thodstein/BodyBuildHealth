import { describe, expect, it } from 'vitest';
import { analyzePhaseAssistance, analyzeBarPathAssistance, protocolFromCycle } from '../lift-assistance.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

describe('analyzePhaseAssistance — оптимальность упражнений для фазы', () => {
  it('squat.bottom возвращает упражнения на квадрицепсы с top-1 optimal', () => {
    const analysis = analyzePhaseAssistance('squat', 'bottom', CYCLE_01);
    expect(analysis.items.length).toBeGreaterThan(0);
    expect(analysis.items.some(i => i.optimal)).toBe(true);
    const optimal = analysis.items.find(i => i.optimal)!;
    expect(optimal.rationale).toContain('squat');
    expect(optimal.exercise.name.length).toBeGreaterThan(0);
  });

  it('bench.lockout — трицепс/верх груди, не дублирует жим лёжа', () => {
    const analysis = analyzePhaseAssistance('bench', 'lockout', CYCLE_01);
    expect(analysis.items.length).toBeGreaterThan(0);
    for (const item of analysis.items) {
      // Основной жим лёжа (horizontal_push) исключён — не добавляем дубль основного лифта.
      expect(item.pattern).not.toBe('horizontal_push');
      expect(item.exercise.name.toLowerCase()).not.toMatch(/^жим штанги лёжа$|^жим лёжа$/);
    }
  });

  it('deadlift.start — задняя цепь, не становая (hinge исключён)', () => {
    const analysis = analyzePhaseAssistance('deadlift', 'start', CYCLE_01);
    expect(analysis.items.length).toBeGreaterThan(0);
    for (const item of analysis.items) {
      expect(item.exercise.name.toLowerCase()).not.toMatch(/становая|румынская/);
    }
  });

  it('каждый item имеет протокол из раскладки цикла', () => {
    const analysis = analyzePhaseAssistance('squat', 'bottom', CYCLE_01);
    for (const item of analysis.items) {
      expect(item.protocol.pct).toBeGreaterThan(0);
      expect(item.protocol.pct).toBeLessThanOrEqual(1);
      expect(item.protocol.reps).toBeGreaterThan(0);
      expect(item.protocol.sets).toBeGreaterThan(0);
    }
  });

  it('без template — дефолтный протокол, но анализ работает', () => {
    const analysis = analyzePhaseAssistance('squat', 'bottom');
    expect(analysis.items.length).toBeGreaterThan(0);
    for (const item of analysis.items) {
      expect(item.protocol).toEqual({ pct: 0.6, reps: 10, sets: 3 });
    }
  });

  it('разные фазы дают разный набор упражнений', () => {
    const bottom = analyzePhaseAssistance('squat', 'bottom', CYCLE_01);
    const lockout = analyzePhaseAssistance('squat', 'lockout', CYCLE_01);
    const bottomNames = bottom.items.map(i => i.exercise.name);
    const lockoutNames = lockout.items.map(i => i.exercise.name);
    expect(bottomNames.join('|')).not.toBe(lockoutNames.join('|'));
  });
});

describe('analyzeBarPathAssistance — отклонения траектории', () => {
  it('hips_shoot_up (squat) → ассистенты на квадрицепс, top-1 optimal', () => {
    const analysis = analyzeBarPathAssistance('squat', 'hips_shoot_up', CYCLE_01);
    expect(analysis.issue).toBe('hips_shoot_up');
    expect(analysis.items.length).toBeGreaterThan(0);
    expect(analysis.items.some(i => i.optimal)).toBe(true);
    expect(analysis.items[0].rationale).toContain('hips_shoot_up');
  });

  it('good_morning → упражнения на присед-фронт', () => {
    const analysis = analyzeBarPathAssistance('squat', 'good_morning', CYCLE_01);
    expect(analysis.items.length).toBeGreaterThan(0);
  });

  it('asymmetric → унилатеральные упражнения', () => {
    const analysis = analyzeBarPathAssistance('squat', 'asymmetric', CYCLE_01);
    const names = analysis.items.map(i => i.exercise.name.toLowerCase());
    expect(names.some(n => /выпад|сплит/.test(n))).toBe(true);
  });
});

describe('protocolFromCycle — протокол из раскладки цикла', () => {
  it('возвращает set-блоки аксессуара цикла (не жёсткий дефолт)', () => {
    const protocol = protocolFromCycle(CYCLE_01, 'legs');
    // В cycle-01 есть аксессуары (Жим гантелей и т.п.) с процентами 0.4-0.7
    expect(protocol.pct).toBeGreaterThanOrEqual(0.3);
    expect(protocol.pct).toBeLessThanOrEqual(0.8);
    expect(protocol.reps).toBeGreaterThanOrEqual(2);
    expect(protocol.sets).toBeGreaterThanOrEqual(1);
  });

  it('без template — дефолтный протокол', () => {
    expect(protocolFromCycle(undefined, 'legs')).toEqual({ pct: 0.6, reps: 10, sets: 3 });
  });
});
