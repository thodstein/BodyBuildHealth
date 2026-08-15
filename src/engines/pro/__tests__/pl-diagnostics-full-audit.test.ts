import { describe, expect, it } from 'vitest';
import { analyzePhaseAssistance, analyzeStickingCorrections, analyzeBarPathAssistance, protocolFromCycle } from '../lift-assistance.engine';
import { barPathIssuesForLift } from '../lift-diagnostics.engine';
import { getPLWeakGroupExerciseCandidates } from '../../lms/lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const WEAK: Record<string, string[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
};

const MAIN_LIFT_RES: Record<string, RegExp> = {
  bench: /^жим штанги лёжа$|^жим лёжа$/i,
  squat: /^приседания? со штангой$/i,
  deadlift: /^становая тяга$/i,
  ohp: /^жим стоя$/i,
  row: /^тяга штанги в наклоне$/i,
  pulldown: /^тяга верхнего блока \(прямой\)$/i,
  incline_press: /^жим штанги лёжа на наклонной$/i,
};

describe('ПЛ-диагностика: полный тренерский аудит (мышцы/точки/мёртвые/bar-path)', () => {
  it('слабые точки: каждая фаза каждого движения — ≥1 ассистент, optimal, протокол с RIR, без основного лифта', () => {
    let empty = 0;
    for (const [lift, phases] of Object.entries(WEAK)) {
      for (const wp of phases) {
        const r = analyzePhaseAssistance(lift as any, wp as any, CYCLE_01);
        if (r.items.length === 0) empty++;
        expect(r.items.some(i => i.optimal), `${lift}/${wp}`).toBe(true);
        for (const i of r.items) {
          expect(i.protocol.rir, `${lift}/${wp}/${i.exercise.name}: нет RIR`).toBeGreaterThanOrEqual(0);
          expect(i.protocol.sets, `${lift}/${wp}/${i.exercise.name}`).toBeGreaterThanOrEqual(1);
          expect(MAIN_LIFT_RES[lift].test(i.exercise.name), `${lift}/${wp}: дублирует основной лифт ${i.exercise.name}`).toBe(false);
        }
      }
    }
    expect(empty, `пустых фаз: ${empty}`).toBe(0);
  });

  it('мёртвые точки: 3 классических — коррекции с углами; 4 остальных — пусто (пояснение в UI)', () => {
    for (const [lift, phases] of Object.entries(WEAK)) {
      for (const wp of phases) {
        const r = analyzeStickingCorrections(lift as any, wp as any, CYCLE_01);
        if (['bench', 'squat', 'deadlift'].includes(lift)) {
          expect(r.items.length, `${lift}/${wp}: нет коррекций`).toBeGreaterThanOrEqual(2);
          expect(r.items[0].rationale).toContain('Коррекция мёртвой точки');
        } else {
          expect(r.items, `${lift}/${wp}: у 4 движений мёртвых точек нет`).toEqual([]);
        }
      }
    }
  });

  it('bar-path: каждое отклонение каждого движения — per-lift пул, optimal, протокол с RIR', () => {
    for (const lift of Object.keys(WEAK)) {
      const issues = barPathIssuesForLift(lift as any);
      expect(issues.length, `${lift}`).toBeGreaterThan(0);
      for (const issue of issues) {
        const r = analyzeBarPathAssistance(lift as any, issue, CYCLE_01);
        expect(r.items.length, `${lift}/${issue}`).toBeGreaterThanOrEqual(1);
        expect(r.items.some(i => i.optimal)).toBe(true);
        for (const i of r.items) {
          expect(i.protocol.rir).toBeGreaterThanOrEqual(0);
          expect(MAIN_LIFT_RES[lift].test(i.exercise.name), `${lift}/${issue}: дублирует основной лифт ${i.exercise.name}`).toBe(false);
        }
      }
    }
  });

  it('слабые мышцы: каждая подгруппа группы — ≥1 кандидат по циклу, без основных лифтов', () => {
    const SUBS: Record<string, { label: string; patterns: string[] }[]> = {
      chest: [
        { label: 'верх груди', patterns: ['incline_push'] },
        { label: 'низ груди', patterns: ['dip_push', 'decline_push'] },
        { label: 'изоляция груди', patterns: ['isolation_chest'] },
      ],
      back: [
        { label: 'широчайшие', patterns: ['vertical_pull'] },
        { label: 'толщина', patterns: ['horizontal_pull'] },
        { label: 'изоляция', patterns: ['isolation_back'] },
        { label: 'задние дельты', patterns: ['isolation_shoulders'] },
      ],
      legs: [
        { label: 'квадры', patterns: ['lunge', 'isolation_legs_quad'] },
        { label: 'бицепс бедра', patterns: ['isolation_legs_ham', 'hinge'] },
        { label: 'ягодицы', patterns: ['glute_squat', 'hinge'] },
        { label: 'икры', patterns: ['isolation_calves'] },
      ],
      shoulders: [{ label: 'дельты', patterns: ['isolation_shoulders'] }],
      arms: [{ label: 'руки', patterns: ['isolation_arms'] }],
      core: [{ label: 'кор', patterns: ['core', 'rotation', 'anti_rotation'] }],
    };
    for (const [group, subs] of Object.entries(SUBS)) {
      const all = getPLWeakGroupExerciseCandidates(CYCLE_01 as any, group);
      for (const sub of subs) {
        const filtered = all.filter(e => sub.patterns.includes(e.movementPattern || ''));
        expect(filtered.length, `${group}/${sub.label}: пусто`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('протоколы из цикла: pct/reps/sets/RIR валидны для каждой группы', () => {
    for (const group of ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']) {
      const p = protocolFromCycle(CYCLE_01 as any, group);
      expect(p.pct).toBeGreaterThan(0);
      expect(p.pct).toBeLessThanOrEqual(1);
      expect(p.reps).toBeGreaterThanOrEqual(2);
      expect(p.sets).toBeGreaterThanOrEqual(1);
      expect(p.rir).toBeGreaterThanOrEqual(0);
    }
    expect(protocolFromCycle(undefined, 'legs')).toEqual({ pct: 0.6, reps: 10, sets: 3, rir: 2 });
  });

  it('все источники пулов не пересекаются (weak/sticking/bar не смешиваются)', () => {
    for (const [lift, phases] of Object.entries(WEAK)) {
      for (const wp of phases) {
        const phase = analyzePhaseAssistance(lift as any, wp as any);
        expect(phase.items.some(i => i.source !== 'weak')).toBe(false);
        const stick = analyzeStickingCorrections(lift as any, wp as any);
        expect(stick.items.some(i => i.source !== 'sticking')).toBe(false);
      }
      for (const issue of barPathIssuesForLift(lift as any)) {
        const bar = analyzeBarPathAssistance(lift as any, issue);
        expect(bar.items.some(i => i.source !== 'bar')).toBe(false);
      }
    }
  });
});
