/**
 * arm-movement-diagnostics.test.ts — P1–P7: диагностика движений схватки.
 * Каждый эпик со своим триггером; P7 — встройка без регрессий.
 */
import { describe, expect, it } from 'vitest';
import {
  diagnoseMatchPhase, phaseForWeakPoint, weakPointsForPhase, isArmMatchPhase,
} from '../arm-match-phases.engine';
import { assessStartReaction, reactionZone } from '../arm-start-reaction.engine';
import { analyzeVectorTimeline } from '../arm-vector-timeline.engine';
import { assessTableStrength } from '../arm-table-strength.engine';
import { assessHumerusDanger, checkHumerusChecklist } from '../arm-humerus-checklist.engine';
import { assessFoulRisk } from '../arm-foul-risk.engine';
import { analyzeTableIq } from '../arm-table-iq.engine';
import { rankCorrectionsForArm } from '../arm-correction-rank.engine';
import { buildArmBridgeData } from '../arm-bridge-payload.engine';
import { buildArmDiagnosticsCsv, buildArmDiagnosticsHtml } from '../arm-diagnostics-export.engine';

describe('P1 match-phases', () => {
  it('без фазы — честный no-data', () => {
    const r = diagnoseMatchPhase({});
    expect(r.phase).toBeNull();
    expect(r.note).toContain('не указана');
  });
  it('mid даёт точки середины + дриллы', () => {
    const r = diagnoseMatchPhase({ failPhase: 'mid', failDetail: 'открывают пальцы' });
    expect(r.phase).toBe('mid');
    expect(r.weakPoints).toContain('side_mid');
    expect(r.note).toContain('открывают пальцы');
    expect(r.drillIds.length).toBeGreaterThan(0);
  });
  it('точка маппится в фазу (side_pin → pin)', () => {
    expect(phaseForWeakPoint('side_pin')).toBe('pin');
    expect(phaseForWeakPoint('cup_start')).toBe('start');
    expect(phaseForWeakPoint('nope')).toBeNull();
  });
  it('каждая фаза имеет ≥1 точку', () => {
    for (const ph of ['setup', 'readygo', 'start', 'mid', 'pin']) {
      expect(isArmMatchPhase(ph)).toBe(true);
      expect(weakPointsForPhase(ph).length).toBeGreaterThan(0);
    }
  });
});

describe('P2 start-reaction', () => {
  it('без замера — nodata + reaction_go', () => {
    const r = assessStartReaction({});
    expect(r.level).toBe('nodata');
    expect(r.drills).toContain('reaction_go');
  });
  it('фальстарт блочит готовность', () => {
    const r = assessStartReaction({ reactionMs: 240, falseStarts: 1 });
    expect(r.ready).toBe(false);
    expect(r.drills).toContain('foul_freeze');
  });
  it('быстрый + центр — ready', () => {
    const r = assessStartReaction({ reactionMs: 280, falseStarts: 0, centerTakeoverMs: 800 });
    expect(r.ready).toBe(true);
    expect(r.centerNote).toContain('Центр');
  });
  it('медленный центр — чинить pron/rising', () => {
    const r = assessStartReaction({ reactionMs: 300, centerTakeoverMs: 3200 });
    expect(r.centerNote).toContain('старта нет');
  });
  it('зоны реакции 250/350', () => {
    expect(reactionZone(200)).toBe('fast');
    expect(reactionZone(300)).toBe('ok');
    expect(reactionZone(420)).toBe('slow');
  });
});

describe('P3 vector-timeline', () => {
  it('без данных — честно', () => {
    const r = analyzeVectorTimeline({});
    expect(r.hasData).toBe(false);
  });
  it('слабый вектор + просадка + containLoss', () => {
    const r = analyzeVectorTimeline({
      start: { rising: 8, pron: 8, back: 7, side: 7 },
      mid: { rising: 5, pron: 5, back: 6, side: 6 },
      pin: { rising: 4, pron: 4, back: 6, side: 5 },
    });
    expect(r.hasData).toBe(true);
    expect(r.containLoss).toBe(true);
    expect(r.corrections).toContain('contain_fingers');
    expect(r.drops.length).toBeGreaterThan(0);
  });
  it('стабильные векторы — просадок нет', () => {
    const r = analyzeVectorTimeline({
      start: { rising: 7, pron: 7, back: 7, side: 7 },
      pin: { rising: 7, pron: 7, back: 7, side: 7 },
    });
    expect(r.drops.length).toBe(0);
    expect(r.containLoss).toBe(false);
  });
});

describe('P4 table-strength', () => {
  it('пусто — 0/4 + гэпы', () => {
    const r = assessTableStrength({});
    expect(r.filledCount).toBe(0);
    expect(r.gaps.length).toBe(4);
  });
  it('слабое звено + усталость', () => {
    const r = assessTableStrength({
      wristFlexKg: 40, pronKg: 22, risingKg: 30, pinHoldSec: 12, round1Sec: 12, round3Sec: 7,
    });
    expect(r.filledCount).toBe(4);
    expect(r.scoreReliable).toBe(true);
    expect(r.note).toContain('пронация');
    expect(r.fatigueIndex).toBeGreaterThanOrEqual(30);
  });
});

describe('P5 humerus-danger', () => {
  it('чеклист цел (регрессия)', () => {
    expect(checkHumerusChecklist([]).ok).toBe(true);
    expect(checkHumerusChecklist(['axis']).ok).toBe(false);
  });
  it('дожим в проигрыше — стоп', () => {
    const r = assessHumerusDanger({ losing: true, sideMax: true });
    expect(r.stop).toBe(true);
    expect(r.note).toContain('ремень');
  });
  it('острый локоть — стоп', () => {
    expect(assessHumerusDanger({ elbowDeg: 75 }).stop).toBe(true);
  });
  it('тихо — нет стопа + teen-нота', () => {
    const r = assessHumerusDanger({ teen: true });
    expect(r.stop).toBe(false);
    expect(r.note).toContain('Teen');
  });
});

describe('P6 foul-risk', () => {
  it('пусто — топ-причины нет', () => {
    const r = assessFoulRisk({});
    expect(r.topCause).toBeNull();
    expect(r.slipProfile).toBeNull();
  });
  it('элбоу 3 — топ-причина + high', () => {
    const r = assessFoulRisk({ elbowLift: 3, shoulderLine: 1, bouts: 10, foulHistory: 12 });
    expect(r.topCause).toBe('elbow_lift');
    expect(r.risks.find((x) => x.id === 'elbow_lift')?.level).toBe('high');
    expect(r.foulRate).toBe(1.2);
  });
  it('слипы в проигрыше — losing-профиль', () => {
    const r = assessFoulRisk({ slipClean: 0, slipLosing: 2 });
    expect(r.slipProfile).toBe('losing');
    expect(r.note).toContain('фол-риск');
  });
  it('чистые слипы — clean-профиль', () => {
    expect(assessFoulRisk({ slipClean: 2, slipLosing: 0 }).slipProfile).toBe('clean');
  });
});

describe('P7 встройка', () => {
  it('Table-IQ: мода фазы срыва идёт в levers, без фаз — как было', () => {
    const base = analyzeTableIq({ bouts: [{ win: true }, { win: false }] });
    expect(base.levers.some((l) => l.includes('Слабая фаза'))).toBe(false);
    const phased = analyzeTableIq({
      bouts: [
        { win: true, failPhase: 'mid' },
        { win: false, failPhase: 'mid' },
        { win: false, failPhase: 'start' },
      ],
    });
    expect(phased.levers.some((l) => l.includes('Слабая фаза: середина'))).toBe(true);
  });
  it('ранжир: matchPhase даёт бонус точке своей фазы', () => {
    const a = rankCorrectionsForArm('side_mid', {});
    const b = rankCorrectionsForArm('side_mid', { matchPhase: 'mid' });
    expect(b[0].score).toBeGreaterThanOrEqual(a[0].score);
    // чужая фаза бонус не даёт точке mid
    const c = rankCorrectionsForArm('side_mid', { matchPhase: 'start' });
    expect(c[0].score).toBeLessThanOrEqual(b[0].score);
  });
  it('мост: movement-поля прокидываются, без них — null (байт-в-байт)', () => {
    const base = buildArmBridgeData({
      groups: [], technique: 'hook', weakPoints: [], biomechCards: [], corrections: [],
      scoring: null, diag: null, angles: null, force: null, vbt: null, dynamic: null,
      bench: null, tendon: 0, findings: [], humerus: [], balance: [], asymmetry: null,
      info: [], weakCauses: {}, topByPoint: {}, spec: null, mobilityFails: [], acwrDanger: [],
      bilateral: null, attempts: [],
    }) as Record<string, unknown>;
    expect(base['armMatchPhase']).toBeNull();
    const full = buildArmBridgeData({
      groups: [], technique: 'hook', weakPoints: [], biomechCards: [], corrections: [],
      scoring: null, diag: null, angles: null, force: null, vbt: null, dynamic: null,
      bench: null, tendon: 0, findings: [], humerus: [], balance: [], asymmetry: null,
      info: [], weakCauses: {}, topByPoint: {}, spec: null, mobilityFails: [], acwrDanger: [],
      bilateral: null, attempts: [], matchPhase: 'mid', startNote: 's', vectorNote: 'v',
      foulNote: 'f', tableStrengthNote: 't', humerusDangerNote: 'd',
    }) as Record<string, unknown>;
    expect(full['armMatchPhase']).toBe('mid');
    expect(full['armFoulNote']).toBe('f');
  });
  it('экспорт: movement-секция в HTML+CSV, без неё — как было', () => {
    const data = {
      date: 't', level: 'l', technique: 'hook', points: [],
      movement: { matchPhase: 'mid', start: 's', vector: 'v', foul: 'f', tableStrength: 't', danger: 'd' },
    };
    expect(buildArmDiagnosticsHtml(data)).toContain('Движение схватки');
    expect(buildArmDiagnosticsCsv(data)).toContain('movement;');
    const plain = { date: 't', level: 'l', technique: 'hook', points: [] };
    expect(buildArmDiagnosticsHtml(plain)).not.toContain('Движение схватки');
  });
  it('parity: 12 точек × 5 фаз — у каждой фазы есть диагностика и точка', () => {
    const points = ['cup_start', 'cup_hold', 'rising_top', 'pron_open', 'pron_lock', 'sup_cup', 'sup_drag', 'side_mid', 'side_pin', 'back_start', 'back_drag', 'contain_fingers'];
    for (const ph of ['setup', 'readygo', 'start', 'mid', 'pin']) {
      const pts = weakPointsForPhase(ph);
      expect(pts.length).toBeGreaterThan(0);
      for (const p of pts) expect(points).toContain(p);
      const d = diagnoseMatchPhase({ failPhase: ph });
      expect(d.phase).toBe(ph);
      expect(d.weakPoints.length).toBeGreaterThan(0);
    }
  });
});
