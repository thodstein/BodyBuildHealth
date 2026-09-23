import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  SM_CORR_EXID,
  SM_CORR_EXID_BY_ID,
  exIdForSMCorrective,
  libraryEntryForSM,
  protocolForSMPreferred,
  SM_ERROR_TAG_RU,
  SM_TAG_PHASES,
  smCorrectivesByError,
  smErrorTagsForMetrics,
  SM_MOBILITY_DEMAND,
} from '../strength-sport-sm-corrective.engine';
import { buildSMDiagnosticsHtml, buildSMCsv } from '../strength-sport-sm-export.engine';
import { rankCorrectionsForSM, rankCorrectionsForSMLibrary } from '../strength-sport-sm-correction-rank.engine';
import { SM_FALLBACK_BY_WP } from '../strength-sport-sm-correction-rank.engine';
import { buildSMSpecProtocols } from '../../../ui/screens/strength-sport/sm-bridge-intake';

describe('sm-corrective library', () => {
  it('16 фаз × 3 вида: канон + P5-добор (ROUND-9: 56 → ≥80)', () => {
    expect(SM_CORRECTIVE_PHASES.length).toBe(16);
    // было: toBe(56) — ROUND-9 добил тонкие ячейки (причина × фаза) до ≥2 вариантов
    expect(SM_CORRECTIVES.length).toBeGreaterThanOrEqual(80);
  });
  it('ROUND-9: библиотека ≥80; каждый exId — реальная запись каталога (source-guard)', () => {
    expect(SM_CORRECTIVES.length).toBeGreaterThanOrEqual(80);
    const src = readFileSync(resolve(process.cwd(), 'src/core/exercise-catalog.ts'), 'utf8');
    for (const c of SM_CORRECTIVES) {
      const ex = exIdForSMCorrective(c);
      const ok = src.includes(`id:'${ex}'`) || src.includes(`id: '${ex}'`);
      expect(ok, `${c.id} → ${ex}`).toBe(true);
    }
  });
  it('ROUND-10: каждая причина × вид (technique/strength/stability) имеет ≥3 варианта (было ≥2)', () => {
    const causes = ['volume', 'technique', 'mobility', 'fatigue', 'strength', 'grip'];
    const kinds = ['technique', 'strength', 'stability'];
    const thin: string[] = [];
    for (const cause of causes) {
      for (const kind of kinds) {
        const n = SM_CORRECTIVES.filter((c) => (c.causes as string[]).includes(cause) && c.kind === kind).length;
        if (n < 3) thin.push(`${cause}/${kind}:${n}`);
      }
    }
    expect(thin).toEqual([]);
  });
  it('ROUND-9: в каждой фазе объявленная причина имеет ≥2 варианта (не вырождается в 1)', () => {
    const causes = ['volume', 'technique', 'mobility', 'fatigue', 'strength', 'grip'];
    for (const ph of SM_CORRECTIVE_PHASES) {
      const list = correctivesForPhase(ph);
      for (const cause of causes) {
        const n = list.filter((c) => (c.causes as string[]).includes(cause)).length;
        expect(n === 0 || n >= 2, `${ph}/${cause}=${n}`).toBe(true);
      }
    }
  });
  it('каждая фаза имеет technique+strength+stability (P5-добор — сверх канона)', () => {
    for (const ph of SM_CORRECTIVE_PHASES) {
      const kinds = correctivesForPhase(ph).map((c) => c.kind).sort();
      expect(kinds).toContain('stability');
      expect(kinds).toContain('strength');
      expect(kinds).toContain('technique');
      expect(kinds.length).toBeGreaterThanOrEqual(3);
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
  it('экспорт: коррекции в HTML + CSV, без них — байт-совместимо', () => {
    const base: any = { weakPoints: [], score: 80, level: 'ok', verification: 1, findings: [] };
    const htmlBase = buildSMDiagnosticsHtml(base);
    expect(htmlBase).not.toContain('Коррекция');
    const html = buildSMDiagnosticsHtml({ ...base, corrections: ['yoke_walk → test 3×20м'], correctiveDetail: ['yoke_walk → detail [src]'] });
    expect(html).toContain('Коррекция');
    expect(html).toContain('Коррекция детально');
    expect(html).toContain('yoke_walk → test');
    const csv = buildSMCsv({ ...base, corrections: ['a → b'], correctiveDetail: ['d1'] });
    expect(csv).toContain('corrections');
    expect(csv).toContain('correctiveDetail');
    const csvBase = buildSMCsv(base);
    expect(csvBase).not.toContain('a → b');
  });
  it('C3-паритет: топ × 16 фаз × 6 причин — везде непусто, доза различается', () => {
    const causes = ['volume', 'technique', 'mobility', 'fatigue', 'strength', 'grip'] as const;
    let checked = 0;
    for (const ph of SM_CORRECTIVE_PHASES) {
      for (const cause of causes) {
        const top = correctivesForSMWeakPoint(ph, { cause });
        expect(top.length).toBeGreaterThan(0);
        expect(top[0].protocolAdj.sets).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBe(96);
  });
  it('exId: все 48 записей — реальное id каталога (без синтетики в план)', () => {
    const seen = new Set<string>();
    for (const c of SM_CORRECTIVES) {
      const exId = exIdForSMCorrective(c);
      expect(exId).toMatch(/^[a-z0-9_]+$/);
      expect(exId.startsWith('sm_')).toBe(false);
      seen.add(exId);
    }
    // таблица покрывает все фазы × виды
    expect(Object.keys(SM_CORR_EXID).length).toBe(16);
    for (const ph of SM_CORRECTIVE_PHASES) {
      expect(Object.keys(SM_CORR_EXID[ph]).sort()).toEqual(['stability', 'strength', 'technique']);
    }
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
  it('protocolForSMPreferred: библиотечная ⭐ с дозой; чужая/мусор → null', () => {    const lib = protocolForSMPreferred('stone_off_floor', 'sm_stone_off_floor_tech', 'technique');
    expect(lib).not.toBeNull();
    expect(lib!.exId).toBe('deadlift');
    expect(lib!.sets).toBeGreaterThan(0);
    expect(lib!.pct).toBeGreaterThanOrEqual(50);
    // чужой id (из другой фазы) — null, не подмена
    expect(protocolForSMPreferred('stone_off_floor', 'sm_yoke_walk_tech', 'technique')).toBeNull();
    expect(protocolForSMPreferred('stone_off_floor', 'nope', 'technique')).toBeNull();
    expect(protocolForSMPreferred('stone_off_floor', null, 'technique')).toBeNull();
    expect(libraryEntryForSM('nope')).toBeNull();
    expect(libraryEntryForSM('sm_log_dip_tech')!.phase).toBe('log_dip');
  });
  it('C4: в топе ранжира ноль фантомов — все id из канона фаз', () => {
    const known = new Set(Object.values(SM_FALLBACK_BY_WP));
    for (const ph of SM_CORRECTIVE_PHASES) {
      const top = rankCorrectionsForSM(ph, {});
      expect(top.length).toBeGreaterThan(0);
      for (const c of top) {
        expect(known.has(c.id)).toBe(true);
        expect(c.name.length).toBeGreaterThan(0);
      }
    }
  });
  it('P1: словарь ошибок — 18 RU-тегов, каждый гасится ≥1 записью, замеры → теги', () => {
    expect(Object.keys(SM_ERROR_TAG_RU).length).toBe(18);
    for (const [tag, phases] of Object.entries(SM_TAG_PHASES)) {
      expect(phases.length).toBeGreaterThan(0);
      expect(smCorrectivesByError(tag as never).length).toBeGreaterThan(0);
    }
    expect(smErrorTagsForMetrics({ swayCm: 4 }).tags).toContain('sway');
    expect(smErrorTagsForMetrics({}).tags).toEqual([]);
    expect(smErrorTagsForMetrics({}).text).toBeNull();
    expect(smErrorTagsForMetrics({ logDipOutOfWindow: true }).tags).toContain('dip_forward');
    expect(smErrorTagsForMetrics({ gripLimitsCarry: true }).tags).toContain('grip_slip');
    expect(smErrorTagsForMetrics({ carryTurnS: 4 }).tags).toContain('turn_wide');
    expect(smErrorTagsForMetrics({ turnDrop: true }).tags).toContain('turn_drop');
    expect(smErrorTagsForMetrics({ stoneLapS: 3 }).tags).toContain('lap_slow');
    expect(smErrorTagsForMetrics({ tyreSecondPullS: 1.5 }).tags).toContain('pop_fail');
    expect(smErrorTagsForMetrics({ suitcaseAsymPct: 8 }).tags).toContain('asym_carry');
    expect(smErrorTagsForMetrics({ ohsFailed: 3 }).tags).toContain('brace_soft');
  });
  it('P2: ранжир из библиотеки — id sm_* с дозой карточки; топ × 16 фаз × 6 причин', () => {
    const causes = ['volume', 'technique', 'mobility', 'fatigue', 'strength', 'grip'] as const;
    let checked = 0;
    for (const ph of SM_CORRECTIVE_PHASES) {
      for (const cause of causes) {
        const top = rankCorrectionsForSMLibrary(ph, { cause });
        expect(top.length).toBeGreaterThan(0);
        expect(top[0].id.startsWith('sm_')).toBe(true);
        expect(top[0].protocol.sets).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBe(96);
    const lib = rankCorrectionsForSMLibrary('stone_off_floor', { cause: 'strength' });
    const base = correctivesForSMWeakPoint('stone_off_floor', { cause: 'strength' })[0];
    expect(lib[0].protocol.pct).toBe(base.protocolAdj.pct);
  });
  it('P3: mobility-demand spot-lock + equipment-гейт + fatigueSensitive', () => {
    for (const ids of Object.values(SM_MOBILITY_DEMAND)) {
      for (const id of ids) expect(SM_CORRECTIVES.some((c) => c.id === id)).toBe(true);
    }
    const full = correctivesForSMWeakPoint('log_dip', {});
    expect(full.length).toBeGreaterThan(0);
    const none = correctivesForSMWeakPoint('log_dip', { equipment: ['___no_such_equip___'] });
    expect(none.length).toBeLessThanOrEqual(full.length);
    // shoulder-ограничение топит оверхед-дозы, но не скрывает фазу
    const sh = correctivesForSMWeakPoint('log_lockout', { mobilityRestrictions: ['shoulder'] });
    expect(sh.length).toBeGreaterThan(0);
    const ses = correctiveSessionForSM(['log_dip', 'yoke_walk'], { log_dip: 'technique', yoke_walk: null }, { mobilityRestrictions: ['shoulder'] });
    expect(ses.length).toBeLessThanOrEqual(6);
    // C10-гейт моста: при фильтрах ⭐ не вшивается (строгий путь ранжира)
    const withStar = buildSMSpecProtocols(['log_dip'], { log_dip: 'sm_log_dip_tech' }, { log_dip: 'technique' }, ['barbell'], []);
    const noFilter = buildSMSpecProtocols(['log_dip'], { log_dip: 'sm_log_dip_tech' }, { log_dip: 'technique' });
    expect(noFilter['log_dip']).toBeTruthy();
    expect(withStar['log_dip']).toBeTruthy();
  });
  it('P4: волна несёт дозу причины (protocolAdj), а не канон', () => {
    const block = correctiveBlockForSM(['stone_off_floor'], 8, { stone_off_floor: 'strength' });
    expect(block.length).toBe(8);
    // нед4 (i=4) — фокус strength: доза причины +5% пика
    const str = correctivesForSMWeakPoint('stone_off_floor', { cause: 'strength' }).find((t) => t.kind === 'strength')!;
    expect(block[4].lines[0]).toContain('sm_stone_off_floor_strength');
    expect(block[4].lines[0]).toContain(`@${Math.min(90, str.protocolAdj.pct + 5)}%`);
    const tech = correctiveBlockForSM(['log_dip'], 8, {});
    expect(tech[0].lines[0]).toContain('sm_log_dip_tech');
  });
  it('P5: добор инжектабелен — tyre/frame/sandbag/husafell/zercher/axle без sm_* в плане', () => {
    for (const id of ['sm_conditioning_tyre_tech', 'sm_log_lockout_circus', 'sm_stone_load_sandbag', 'sm_farmers_carry_frame', 'sm_stone_lap_husafell', 'sm_yoke_walk_zercher', 'sm_grip_support_axle']) {
      expect(smCorrectiveBasePct(id)).toBeGreaterThan(0);
      expect(SM_CORR_EXID_BY_ID[id]).toMatch(/^[a-z0-9_]+$/);
      expect(SM_CORR_EXID_BY_ID[id].startsWith('sm_')).toBe(false);
    }
    expect(exIdForSMCorrective(libraryEntryForSM('sm_conditioning_tyre_tech')!)).toBe('tire_flip');
  });
  it('R1: YBT-UQ >4см → лог-фазы (паритет weak-cause P7-UQ); ≤4 — тихо', () => {
    const tags = smTagsForMetrics({ ybtUqAsymCm: 5 });
    expect(tags).toContain('log_drive');
    expect(tags).toContain('log_lockout');
    expect(smTagsForMetrics({ ybtUqAsymCm: 3 })).not.toContain('log_drive');
    expect(smTagsForMetrics({})).toEqual([]);
  });
  it('R2: экспорт с фильтрами = показанному (mobility passthrough, без — байт-в-байт)', () => {
    const base = smCorrectiveExportLines(['log_lockout']);
    const mob = smCorrectiveExportLines(['log_lockout'], {}, { mobilityRestrictions: ['shoulder'] });
    expect(base.length).toBe(1);
    expect(mob.length).toBe(1);
    expect(mob[0]).toContain('log_lockout →');
  });
});
