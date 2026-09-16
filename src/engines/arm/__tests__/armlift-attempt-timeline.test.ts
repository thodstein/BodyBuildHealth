import { describe, it, expect } from 'vitest';
import {
  attemptTimelineFor,
  phaseForFailurePoint,
  phaseForFault,
  weakLinksForPhase,
  timelineImplements,
  failureIdsFor,
} from '../armlift-attempt-timeline.engine';
import { faultsFor } from '../armlift-failure-modes.engine';

const IMPLS = timelineImplements();

describe('PRO-6 M1: фазовый таймлайн попытки', () => {
  it('таймлайн начинается с setup и заканчивается down', () => {
    for (const impl of IMPLS) {
      const tl = attemptTimelineFor(impl);
      expect(tl[0].id).toBe('setup');
      expect(tl[tl.length - 1].id).toBe('down');
      expect(tl.every((ph, i) => ph.order === i)).toBe(true);
    }
  });
  it('каждая точка срыва ⊂ фаз таймлайна', () => {
    for (const impl of IMPLS) {
      const phases = new Set(attemptTimelineFor(impl).map((ph) => ph.id));
      for (const fp of failureIdsFor(impl)) {
        expect(phases.has(fp)).toBe(true);
      }
    }
  });
  it('фолы фаз ⊂ чек-листа снаряда (без выдуманных)', () => {
    for (const impl of IMPLS) {
      const allowed = new Set(faultsFor(impl).map((fl) => fl.id));
      for (const ph of attemptTimelineFor(impl)) {
        for (const fid of ph.faultIds) {
          expect(allowed.has(fid)).toBe(true);
        }
      }
    }
  });
  it('phaseForFailurePoint находит фазу срыва', () => {
    const ph = phaseForFailurePoint('rolling_thunder', 'mid');
    expect(ph?.label).toBe('Протяжка');
    expect(ph?.isFailurePhase).toBe(true);
  });
  it('setup/down — не точки срыва', () => {
    expect(phaseForFailurePoint('rolling_thunder', 'setup')).toBeNull();
    expect(phaseForFailurePoint('rolling_thunder', 'down')).toBeNull();
    expect(phaseForFailurePoint('rolling_thunder', '')).toBeNull();
  });
  it('phaseForFault находит фазу фола (рамка RT — середина)', () => {
    const ph = phaseForFault('rolling_thunder', 'touch_frame');
    expect(ph?.id).toBe('mid');
  });
  it('неизвестный фол — null, неизвестный снаряд — fallback RT', () => {
    expect(phaseForFault('rolling_thunder', 'zzz')).toBeNull();
    const tl = attemptTimelineFor('zzz');
    expect(tl[0].id).toBe('setup');
    expect(tl.some((ph) => ph.id === 'mid')).toBe(true);
  });
  it('у каждой фазы есть слабые звенья', () => {
    for (const impl of IMPLS) {
      for (const ph of attemptTimelineFor(impl)) {
        expect(ph.weakLinks.length).toBeGreaterThan(0);
      }
    }
    expect(weakLinksForPhase('close_fail')).toContain('crush');
    expect(weakLinksForPhase('setup')).toEqual(['technique']);
  });
});
