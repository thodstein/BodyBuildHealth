import { describe, it, expect } from 'vitest';
import {
  SM_CORRECTIVES,
  SM_CORRECTIVE_PHASES,
  correctivesForPhase,
  correctivesForSMWeakPoint,
  correctiveSessionForSM,
  correctiveBlockForSM,
  smTagsForMetrics,
  smCorrectiveExportLines,
  smCorrectiveBasePct,
} from '../strength-sport-sm-corrective.engine';

describe('sm-corrective library', () => {
  it('16 фаз × 3 вида = 48 записей', () => {
    expect(SM_CORRECTIVE_PHASES.length).toBe(16);
    expect(SM_CORRECTIVES.length).toBe(48);
  });
  it('каждая фаза имеет technique+strength+stability', () => {
    for (const ph of SM_CORRECTIVE_PHASES) {
      const kinds = correctivesForPhase(ph).map((c) => c.kind).sort();
      expect(kinds).toEqual(['stability', 'strength', 'technique']);
    }
  });
  it('гигиена: id уникальны, дозы в коридорах, ≥1 причина', () => {
    const ids = SM_CORRECTIVES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of SM_CORRECTIVES) {
      expect(c.protocol.sets).toBeGreaterThanOrEqual(1);
      expect(c.protocol.sets).toBeLessThanOrEqual(6);
      expect(c.protocol.pct).toBeGreaterThanOrEqual(50);
      expect(c.protocol.pct).toBeLessThanOrEqual(90);
      expect(c.protocol.rir).toBeGreaterThanOrEqual(0);
      expect(c.protocol.rir).toBeLessThanOrEqual(4);
      expect(c.protocol.restSeconds).toBeGreaterThanOrEqual(60);
      expect(c.protocol.restSeconds).toBeLessThanOrEqual(300);
      expect(c.causes.length).toBeGreaterThanOrEqual(1);
      expect(c.cues.length).toBeGreaterThanOrEqual(1);
      expect(c.source.length).toBeGreaterThan(0);
    }
  });
  it('все 48 инжектабельны (basePct>0)', () => {
    for (const c of SM_CORRECTIVES) expect(smCorrectiveBasePct(c.id)).toBeGreaterThan(0);
  });
  it('ранг под причину: strength даёт 4×4+5%, volume 4×5, fatigue −5%', () => {
    const s = correctivesForSMWeakPoint('stone_off_floor', { cause: 'strength' });
    expect(s[0].kind).toBe('strength');
    expect(s[0].protocolAdj.sets).toBe(4);
    const v = correctivesForSMWeakPoint('yoke_walk', { cause: 'volume' });
    expect(v[0].protocolAdj.sets).toBe(4);
    const f = correctivesForSMWeakPoint('yoke_walk', { cause: 'fatigue' });
    const base = f[0].protocol.pct;
    expect(f[0].protocolAdj.pct).toBe(Math.max(50, base - 5));
  });
  it('сессия ≤6, порядок техника→сила→стабильность', () => {
    const ses = correctiveSessionForSM(['log_dip', 'yoke_walk', 'stone_load', 'farmers_carry']);
    expect(ses.length).toBeLessThanOrEqual(6);
    const rank = { technique: 0, strength: 1, stability: 2 } as Record<string, number>;
    for (let i = 1; i < ses.length; i++) expect(rank[ses[i].kind]).toBeGreaterThanOrEqual(rank[ses[i - 1].kind]);
  });
  it('волна 8 нед с именами, сеты 3-3-4-4-4-4-3-3', () => {
    const b = correctiveBlockForSM(['log_dip', 'stone_load']);
    expect(b.length).toBe(8);
    expect(b[0].name).toBe('Втягивание');
    expect(b.map((x) => x.sets)).toEqual([3, 3, 4, 4, 4, 4, 3, 3]);
  });
  it('теги замеров: sway/VBT/асимметрия/OHS', () => {
    expect(smTagsForMetrics({ swayCm: 4 })).toContain('yoke_walk');
    expect(smTagsForMetrics({ swayCm: 2 })).toEqual([]);
    expect(smTagsForMetrics({ vbtLossPct: 16 })).toContain('farmers_carry');
    expect(smTagsForMetrics({ vbtLossPct: 12 })).toContain('log_drive');
    expect(smTagsForMetrics({ asymmetryPct: 8 })).toContain('farmers_grip');
    expect(smTagsForMetrics({ ohsFailed: 3 })).toContain('stone_lap');
  });
  it('exportLines: фаза → топ + cue + source', () => {
    const lines = smCorrectiveExportLines(['log_lockout']);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('log_lockout →');
    expect(lines[0]).toContain('[');
  });
});
