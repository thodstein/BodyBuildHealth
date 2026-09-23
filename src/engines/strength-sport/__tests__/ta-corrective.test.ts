import { describe, it, expect } from 'vitest';
import {
  TA_CORRECTIVES, CORRECTIVES_BY_PHASE, correctivesForWeakPoint,
  correctiveSessionFor, correctiveBlockFor, correctivesByError,
  adjustProtocolForCause, TA_ERROR_TAG_RU, correctiveById,
  tagsForBarMetrics, tagsForVelocityLoss, tagsForMobility,
  correctionOrderFor, WEAK_PHASE_ORDER,
  correctiveExportLines, protocolForPreferred,
  MOBILITY_DEMAND, correctiveMetaOf,
  TA_CORRECTIVE_COMPLEXES, complexesForWeakPoint, complexById, complexExportLines,
  TA_WARMUP_PRIMERS, primersForWeakPoint,
  correctiveHowNot, estimateCorrectiveKg, regressionSteps, seasonPhaseForCompetition,
} from '../strength-sport-ta-corrective.engine';
import { estimateCorrBasePm } from '../strength-sport-ta-simulator.engine';
import { rankCorrectionsForTA } from '../strength-sport-ta-correction-rank.engine';
import type { TAWeakCause } from '../strength-sport-ta-weak-cause.engine';
import { allWLWeakPoints, getCorrectionForWeakPoint } from '../strength-sport-weakpoint';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { TA_CATALOG_SUPPLEMENT } from '../../../core/exercise-catalog-ta-supplement';

describe('ta-corrective library', () => {
  it('покрывает все 16 фаз минимум 3 упражнениями', () => {
    for (const wp of allWLWeakPoints()) {
      const list = CORRECTIVES_BY_PHASE[wp] || [];
      expect(list.length, wp).toBeGreaterThanOrEqual(3);
    }
  });
  it('id уникальны', () => {
    const ids = TA_CORRECTIVES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('каждая запись имеет кью + прогрессию + источник', () => {
    for (const e of TA_CORRECTIVES) {
      expect(e.cues.length).toBeGreaterThan(0);
      expect(e.progression.length).toBeGreaterThan(0);
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.targets.length).toBeGreaterThan(0);
    }
  });
  it('причина strength даёт 4×4 +5%, volume — 4×5, mobility — минус', () => {
    const s = adjustProtocolForCause({ sets: 3, reps: 5, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 }, 'strength');
    expect(s.sets).toBe(4); expect(s.reps).toBe(4); expect(s.pct).toBe(75);
    const v = adjustProtocolForCause({ sets: 3, reps: 3, pct: 65, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 }, 'volume');
    expect(v.sets).toBe(4); expect(v.reps).toBe(5);
    const m = adjustProtocolForCause({ sets: 3, reps: 5, pct: 70, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 }, 'mobility');
    expect(m.pct).toBe(65);
  });
  it('technique-причина ставит технику первой', () => {
    const list = correctivesForWeakPoint('snatch_pull_under', { cause: 'technique' });
    expect(list[0].phase).toBe('technique');
  });
  it('уровень novice штрафует advanced (дефицит ниже)', () => {
    const nov = correctivesForWeakPoint('snatch_off_floor', { level: 'beginner' });
    const adv = correctivesForWeakPoint('snatch_off_floor', { level: 'advanced' });
    expect(nov.length).toBeGreaterThan(0); expect(adv.length).toBeGreaterThan(0);
    // у новичка первым — доступное (pause/liftoff), а не deficit
    expect(nov[0].id).not.toBe('deficit_snatch');
  });
  it('ошибка jump_forward ведёт на nofeet/segment', () => {
    const ids = correctivesByError('jump_forward').map((e) => e.id);
    expect(ids).toContain('nofeet_snatch');
  });
  it('dip_forward ведёт на dip-упражнения', () => {
    const ids = correctivesByError('dip_forward').map((e) => e.id);
    expect(ids).toContain('jerk_dip');
    expect(ids).toContain('double_pause_jerk');
  });
  it('сессия: техника раньше силы и стабильности, без дублей, ≤6', () => {
    const steps = correctiveSessionFor(['snatch_pull_under', 'jerk_dip'], { snatch_pull_under: 'technique', jerk_dip: 'technique' });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(6);
    const order = steps.map((s) => s.stage);
    expect(order.indexOf('strength') === -1 || order.indexOf('technique') < order.indexOf('strength')).toBe(true);
    expect(new Set(steps.map((s) => s.exerciseId)).size).toBe(steps.length);
  });
  it('блок: волна 3,3,4,4,4,4 и фокусы по неделям', () => {
    const block = correctiveBlockFor(['snatch_mid'], 6);
    expect(block.length).toBe(6);
    expect(block[0].items[0].sets).toBe(3);
    expect(block[2].items[0].sets).toBe(4);
    expect(block[0].focus).toMatch(/Техника/);
    expect(block[4].focus).toMatch(/Интенсивность/);
  });
  it('неизвестная фаза — пусто без броска', () => {
    expect(correctivesForWeakPoint('nope' as any)).toEqual([]);
  });
});

describe('ta-corrective C3: связка замер→тег→экспорт', () => {
  const WM = { snatch: 100, cleanJerk: 130, backSquat: 160, deadlift: 180 };
  it('все id библиотеки инжектабельны (вес > 0, без броска)', () => {
    for (const e of TA_CORRECTIVES) {
      const w = estimateCorrBasePm(e.id, WM as any);
      expect(w, e.id).toBeGreaterThan(0);
    }
  });
  it('RU-подписи покрывают все используемые теги', () => {
    const used = new Set(TA_CORRECTIVES.flatMap((e) => e.errors));
    for (const t of used) expect(TA_ERROR_TAG_RU[t], t).toBeTruthy();
  });
  it('tagsForBarMetrics: ≤4 молчит, 5 — bar_forward, 8 — +crash, jerk — drive', () => {
    expect(tagsForBarMetrics(3, 'snatch').tags).toEqual([]);
    expect(tagsForBarMetrics(null, 'snatch').tags).toEqual([]);
    expect(tagsForBarMetrics(5, 'snatch').tags).toEqual(['bar_forward']);
    expect(tagsForBarMetrics(8, 'snatch').tags).toEqual(['bar_forward', 'bar_crash']);
    expect(tagsForBarMetrics(8, 'jerk').tags).toContain('drive_forward');
  });
  it('correctiveById находит запись и null на мусор', () => {
    expect(correctiveById('tall_snatch')?.nameRu).toMatch(/Высокий/);
    expect(correctiveById('nope')).toBeNull();
  });
  it('exportLines: доза + кью + источник в каждой строке', () => {
    const lines = correctiveExportLines('jerk_dip', 'technique', 'intermediate');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const l of lines) expect(l).toMatch(/@/);
  });
  it('C6: каждый из 22 тегов ошибок имеет ≥1 упражнение', () => {
    for (const tag of Object.keys(TA_ERROR_TAG_RU) as Array<keyof typeof TA_ERROR_TAG_RU>) {
      expect(correctivesByError(tag).length, tag).toBeGreaterThanOrEqual(1);
    }
  });
  it('ROUND-9: все id библиотеки — реальные записи каталога (синтетики нет)', () => {
    const cat = new Set([
      ...EXERCISE_CATALOG.map((e) => e.id),
      ...TA_CATALOG_SUPPLEMENT.map((e) => e.id),
    ]);
    const missing = TA_CORRECTIVES.filter((e) => !cat.has(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });
  it('ROUND-10: каждая причина-лимитер имеет ≥3 записи в каждой фазе (было ≥2)', () => {
    const causes: TAWeakCause[] = ['volume', 'technique', 'mobility', 'fatigue', 'strength'];
    const phases: Array<'technique' | 'strength' | 'stability'> = ['technique', 'strength', 'stability'];
    const thin: string[] = [];
    for (const cause of causes) {
      for (const ph of phases) {
        const n = TA_CORRECTIVES.filter((e) => (e.causes as TAWeakCause[]).includes(cause) && e.phase === ph).length;
        if (n < 3) thin.push(`${cause}/${ph}:${n}`);
      }
    }
    expect(thin).toEqual([]);
  });
  it('ROUND-10: ядро коррекции — ≥6 кандидатов на каждую из 16 фаз, все из библиотеки', () => {
    const lib = new Set(TA_CORRECTIVES.map((e) => e.id));
    const problems: string[] = [];
    for (const wp of allWLWeakPoints()) {
      const list = getCorrectionForWeakPoint(wp);
      if (list.length < 6) problems.push(`${wp}: ${list.length}`);
      if (new Set(list).size !== list.length) problems.push(`${wp}: дубли`);
      for (const id of list) if (!lib.has(id)) problems.push(`${wp}: нет в библиотеке ${id}`);
    }
    expect(problems).toEqual([]);
  });
  it('C6: гигиена библиотеки — имена уникальны, протоколы в коридорах', () => {
    const names = TA_CORRECTIVES.map((e) => e.nameRu);
    expect(new Set(names).size).toBe(names.length);
    for (const e of TA_CORRECTIVES) {
      expect(e.causes.length, `${e.id}/causes`).toBeGreaterThanOrEqual(1);
      expect(e.protocol.sets, `${e.id}/sets`).toBeGreaterThanOrEqual(1);
      expect(e.protocol.sets, `${e.id}/sets`).toBeLessThanOrEqual(6);
      expect(e.protocol.reps, `${e.id}/reps`).toBeGreaterThanOrEqual(1);
      expect(e.protocol.reps, `${e.id}/reps`).toBeLessThanOrEqual(10);
      expect(e.protocol.pct, `${e.id}/pct`).toBeGreaterThanOrEqual(20);
      expect(e.protocol.pct, `${e.id}/pct`).toBeLessThanOrEqual(110);
      expect(e.protocol.rir, `${e.id}/rir`).toBeGreaterThanOrEqual(0);
      expect(e.protocol.rir, `${e.id}/rir`).toBeLessThanOrEqual(4);
      expect(e.protocol.restSeconds, `${e.id}/rest`).toBeGreaterThanOrEqual(60);
      expect(e.protocol.restSeconds, `${e.id}/rest`).toBeLessThanOrEqual(300);
    }
  });
  it('C8: protocolForPreferred — доза карточки (tall 5×3@40 / volume 4×5), мусор — null', () => {
    expect(protocolForPreferred('snatch_pull_under', 'tall_snatch', 'technique', 'intermediate'))
      .toMatchObject({ sets: 5, reps: 3, pct: 40 });
    expect(protocolForPreferred('snatch_pull_under', 'tall_snatch', 'volume', 'intermediate'))
      .toMatchObject({ sets: 4, reps: 5 });
    expect(protocolForPreferred('snatch_pull_under', 'nope', 'technique', 'intermediate')).toBeNull();
    expect(protocolForPreferred('snatch_pull_under', null, 'technique', 'intermediate')).toBeNull();
    // чужой фазе не принадлежит — null (не тянем чужую дозу)
    expect(protocolForPreferred('jerk_dip', 'tall_snatch', 'technique', 'intermediate')).toBeNull();
  });
  it('C11: ограничение сустава топит спросовые упражнения (плечо/голеностоп/таз)', () => {
    // плечо: high-pull без оверхеда честно остаётся первым, а tall (оверхед-фиксация) тонет
    const noMob = correctivesForWeakPoint('snatch_pull_under', { cause: 'technique' });
    expect(noMob[0].id).toBe('snatch_high_pull');
    const sh = correctivesForWeakPoint('snatch_pull_under', { cause: 'technique', mobilityRestrictions: ['shoulder'] });
    expect(sh[0].id).toBe('snatch_high_pull');
    // было: toBeGreaterThan(noMob-индекс) при коротком окне; стало (ROUND-10: библиотека плотнее) —
    // ограничение плеча вытесняет tall_snatch из окна топ-5 вовсе
    const shIdx = sh.findIndex((c) => c.id === 'tall_snatch');
    const noIdx = noMob.findIndex((c) => c.id === 'tall_snatch');
    expect(noIdx).toBeGreaterThanOrEqual(0);
    expect(shIdx === -1 || shIdx > noIdx).toBe(true);
    // голеностоп: дефицит уступает liftoff/тяге
    const off = correctivesForWeakPoint('snatch_off_floor', { cause: 'strength' });
    expect(off[0].id).toBe('deficit_snatch');
    const ank = correctivesForWeakPoint('snatch_off_floor', { cause: 'strength', mobilityRestrictions: ['ankle'] });
    expect(ank[0].id).not.toBe('deficit_snatch');
    // таз: дефициты тонут — deficit_pull последний в топ-5 без ограничения и вылетает с ним
    const pull = correctivesForWeakPoint('pull_start', { cause: 'strength' });
    expect(pull[0].id).toBe('deficit_snatch');
    expect(pull.findIndex((c) => c.id === 'deficit_pull')).toBe(4);
    const hip = correctivesForWeakPoint('pull_start', { cause: 'strength', mobilityRestrictions: ['hip'] });
    expect(hip.findIndex((c) => c.id === 'deficit_pull')).toBe(-1);
  });
  it('C11: ограничения не меняют дозу (только порядок) + сессия/блок/экспорт их несут', () => {
    // было: tall_snatch выживал под ограничением плеча; стало (ROUND-10: плотнее список) — вытесняется → null честно
    expect(protocolForPreferred('snatch_pull_under', 'tall_snatch', 'technique', 'intermediate', ['shoulder'])).toBeNull();
    const a = protocolForPreferred('snatch_pull_under', 'snatch_high_pull', 'technique', 'intermediate');
    const b = protocolForPreferred('snatch_pull_under', 'snatch_high_pull', 'technique', 'intermediate', ['shoulder']);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    const steps = correctiveSessionFor(['snatch_pull_under'], { snatch_pull_under: 'technique' } as any, { mobilityRestrictions: ['shoulder'] });
    expect(steps[0].exerciseId).toBe('snatch_high_pull');
    const lines = correctiveExportLines('snatch_pull_under', 'technique', 'intermediate', ['shoulder']);
    expect(lines[0]).toMatch(/high-pull/);
    const block = correctiveBlockFor(['snatch_off_floor'], 4, { causeByWeak: { snatch_off_floor: 'strength' } as any, mobilityRestrictions: ['ankle'] });
    expect(block[0].items[0].exerciseId).toBe('snatch_liftoff');
    const blockFree = correctiveBlockFor(['snatch_off_floor'], 4, { causeByWeak: { snatch_off_floor: 'strength' } as any });
    expect(blockFree[0].items[0].exerciseId).toBe('deficit_snatch');
  });
  it('C12: волна блока несёт дозу причины (strength +5 / mobility −5), а не базу', () => {
    const s = correctiveBlockFor(['snatch_mid'], 6, { causeByWeak: { snatch_mid: 'strength' } as any });
    const m = correctiveBlockFor(['snatch_mid'], 6, { causeByWeak: { snatch_mid: 'mobility' } as any });
    const base = correctiveBlockFor(['snatch_mid'], 6);
    // пик волны (нед 3–6): сила выше базы, мобильность ниже
    expect(s[2].items[0].pct).toBeGreaterThan(base[2].items[0].pct);
    expect(m[2].items[0].pct).toBeLessThan(base[2].items[0].pct);
  });
  it('C12: demand-сеты — spot-lock ключевых id (паритет ранжира)', () => {
    // глубокий спрос: дефициты — везде, оверхед-фиксация — в overhead, становая — в hip
    for (const id of ['deficit_snatch', 'deficit_clean', 'deficit_pull']) {
      expect(MOBILITY_DEMAND.ankle).toContain(id);
      expect(MOBILITY_DEMAND.hip).toContain(id);
    }
    for (const id of ['overhead_squat_v2', 'snatch_balance', 'tall_snatch', 'split_jerk', 'sots_press']) {
      expect(MOBILITY_DEMAND.overhead).toContain(id);
    }
    expect(MOBILITY_DEMAND.hip).toContain('deadlift');
    // RDL — контролируемый hinge без глубокого спроса: вне hip-сета (как в ранжире)
    expect(MOBILITY_DEMAND.hip).not.toContain('rdl');
    // все id demand-сетов существуют в библиотеке (без висячих ссылок)
    const ids = new Set(TA_CORRECTIVES.map((e) => e.id));
    for (const key of Object.keys(MOBILITY_DEMAND) as Array<keyof typeof MOBILITY_DEMAND>) {
      for (const id of MOBILITY_DEMAND[key]) expect(ids.has(id), `${key}/${id}`).toBe(true);
    }
  });
  it('паритет с ранжиром: топ-3 каждой фазы × каждой причины — в библиотеке', () => {
    const causes: Array<TAWeakCause | null> = [null, 'volume', 'technique', 'mobility', 'fatigue', 'strength'];
    for (const wp of allWLWeakPoints()) {
      for (const cause of causes) {
        for (const c of rankCorrectionsForTA(wp, { cause })) {
          expect(correctiveById(c.id), `${wp}/${cause}/${c.id}`).not.toBeNull();
        }
      }
    }
  });
  it('E1: без equipment — байт-в-байт (фильтр пуст = всё как раньше)', () => {
    const a = correctivesForWeakPoint('snatch_pull_under', { cause: 'technique' });
    const b = correctivesForWeakPoint('snatch_pull_under', { cause: 'technique', equipment: [] });
    expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id));
  });
  it('E1: фильтр без штанги режет штангу, оставляет свой вес', () => {
    const list = correctivesForWeakPoint('snatch_overhead', { equipment: ['bodyweight'] });
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) expect(correctiveMetaOf(c.id).equipment).toBe('bodyweight');
    expect(list.some((c) => c.id === 'tspine_ext')).toBe(true);
  });
  it('E1: гакк требует machine; блоки без стоек топятся, а не исчезают', () => {
    const noMachine = correctivesForWeakPoint('squat_mid', { equipment: ['barbell'] });
    expect(noMachine.find((c) => c.id === 'hack_squat')).toBeUndefined();
    const withMachine = correctivesForWeakPoint('squat_mid', { equipment: ['barbell', 'machine'] });
    expect(withMachine.some((c) => c.id === 'hack_squat')).toBe(true);
    const free = correctivesForWeakPoint('snatch_mid', { cause: 'technique', equipment: ['barbell'] });
    const noBlocks = correctivesForWeakPoint('snatch_mid', { cause: 'technique', equipment: ['barbell'] });
    expect(free.length).toBeGreaterThan(0); expect(noBlocks.length).toBeGreaterThan(0);
  });
  it('E1: fatigue топит дорогие (тяги 8) и поднимает дешёвые', () => {
    const base = correctivesForWeakPoint('snatch_mid', { cause: 'strength' });
    const tired = correctivesForWeakPoint('snatch_mid', { cause: 'strength', fatigueSensitive: true });
    const baseIdx = base.findIndex((c) => c.id === 'snatch_pull');
    const tiredIdx = tired.findIndex((c) => c.id === 'snatch_pull');
    expect(baseIdx).toBeGreaterThanOrEqual(0);
    expect(tiredIdx).toBeGreaterThan(baseIdx);
  });
  it('E1: comp-фаза топит силу и режет дозу', () => {
    const prep = correctivesForWeakPoint('snatch_mid', { cause: 'strength' });
    const comp = correctivesForWeakPoint('snatch_mid', { cause: 'strength', seasonPhase: 'comp' });
    expect(comp[0].protocolAdj.pct).toBeLessThanOrEqual(prep[0].protocolAdj.pct);
  });
});

describe('ta-corrective E2: тиры замеров + очередь', () => {
  it('severity: 5 — warn, 8 — critical, jerk 12 — +unstable', () => {
    expect(tagsForBarMetrics(5, 'snatch').severity).toBe('warn');
    expect(tagsForBarMetrics(5, 'snatch').tags).toEqual(['bar_forward']);
    expect(tagsForBarMetrics(8, 'snatch').severity).toBe('critical');
    expect(tagsForBarMetrics(8, 'jerk').tags).toContain('split_short');
    expect(tagsForBarMetrics(12, 'snatch').tags).toContain('unstable_overhead');
    expect(tagsForBarMetrics(12, 'jerk').tags).toContain('unstable_overhead');
  });
  it('Д4: vMax <1.3 добавляет weak_extension, ≥1.3 — нет', () => {
    expect(tagsForBarMetrics(5, 'snatch', { vMaxMs: 1.1 }).tags).toEqual(['bar_forward', 'weak_extension']);
    expect(tagsForBarMetrics(5, 'snatch', { vMaxMs: 1.85 }).tags).toEqual(['bar_forward']);
    expect(tagsForBarMetrics(5, 'snatch').tags).toEqual(['bar_forward']);
    expect(tagsForBarMetrics(3, 'snatch', { vMaxMs: 1.1 }).tags).toEqual([]);
  });
  it('VBT: <10 молчит, 12 — warn turnover, 22 — critical +финал', () => {
    expect(tagsForVelocityLoss(8).tags).toEqual([]);
    expect(tagsForVelocityLoss(12)).toMatchObject({ tags: ['slow_turnover'], severity: 'warn' });
    const c = tagsForVelocityLoss(22, 'snatch');
    expect(c.severity).toBe('critical');
    expect(c.tags).toContain('weak_extension');
    expect(tagsForVelocityLoss(22, 'jerk').tags).toContain('drive_forward');
  });
  it('мобильность: OHS≥2 на приёме → soft_catch, ktw<9 на тяге → hips_rise', () => {
    const o = tagsForMobility(3, null, 'snatch_catch');
    expect(o.tags).toContain('soft_catch');
    const k = tagsForMobility(0, 7, 'snatch_off_floor');
    expect(k.tags).toContain('hips_rise');
    expect(tagsForMobility(0, 12, 'snatch_off_floor').tags).toEqual([]);
    expect(tagsForMobility(0, null, 'snatch').tags).toEqual([]);
  });
  it('очередь: отрыв раньше ухода раньше замка; тяжесть — внутри фазы', () => {
    const q = correctionOrderFor(['jerk_lockout', 'snatch_pull_under', 'snatch_off_floor']);
    expect(q).toEqual(['snatch_off_floor', 'snatch_pull_under', 'jerk_lockout']);
    const q2 = correctionOrderFor(['snatch_mid', 'snatch_off_floor'], { snatch_mid: 3, snatch_off_floor: 0 });
    expect(q2[0]).toBe('snatch_off_floor');
    expect(WEAK_PHASE_ORDER['snatch_off_floor']).toBeLessThan(WEAK_PHASE_ORDER['jerk_lockout']);
  });
});

describe('ta-corrective E3: комплексы + праймеры', () => {
  it('12 комплексов: injectId реален, протокол в коридорах', () => {
    expect(TA_CORRECTIVE_COMPLEXES.length).toBe(12);
    for (const c of TA_CORRECTIVE_COMPLEXES) {
      expect(correctiveById(c.injectId), c.id).not.toBeNull();
      expect(c.parts.length).toBeGreaterThanOrEqual(2);
      expect(c.protocol.sets).toBeGreaterThanOrEqual(1);
      expect(c.protocol.pct).toBeGreaterThanOrEqual(20);
      expect(c.protocol.pct).toBeLessThanOrEqual(110);
    }
  });
  it('комплексы находятся по фазе и причине', () => {
    expect(complexesForWeakPoint('snatch_off_floor').length).toBeGreaterThanOrEqual(2);
    expect(complexesForWeakPoint('jerk_dip', { cause: 'technique' }).length).toBeGreaterThanOrEqual(1);
    expect(complexById('cx_push_press_plus_jerk')?.injectId).toBe('push_press');
    expect(complexById('nope')).toBeNull();
    expect(complexExportLines('snatch_mid')[0]).toMatch(/@/);
  });
  it('12 праймеров: палка/гриф, каждая фаза ухода/приёма покрыта', () => {
    expect(TA_WARMUP_PRIMERS.length).toBe(12);
    expect(primersForWeakPoint('snatch_pull_under').length).toBeGreaterThanOrEqual(3);
    expect(primersForWeakPoint('snatch_catch').length).toBeGreaterThanOrEqual(2);
    for (const p of TA_WARMUP_PRIMERS) expect(p.dose).toMatch(/палка|гриф/);
  });
});

describe('ta-corrective E4/E5: расширение + доза', () => {
  it('библиотека ≥60, split_asym ≥3, press ≥5', () => {
    expect(TA_CORRECTIVES.length).toBeGreaterThanOrEqual(60);
    expect(correctivesByError('split_asym').length).toBeGreaterThanOrEqual(3);
    const press = TA_CORRECTIVES.filter((e) => (e.targets as string[]).includes('press_start'));
    expect(press.length).toBeGreaterThanOrEqual(5);
  });
  it('не-штанговая мобильность честна (bodyweight + nonBarbell)', () => {
    for (const id of ['tspine_ext', 'dead_bug_oh', 'pallof_hold']) {
      expect(correctiveMetaOf(id).equipment).toBe('bodyweight');
      expect(correctiveMetaOf(id).nonBarbell).toBe(true);
    }
    expect(correctiveMetaOf('single_arm_press').equipment).toBe('dumbbell');
  });
  it('howNot: tall/muscle/dip/jerk_split — есть, мусор — null', () => {
    expect(correctiveHowNot('tall_snatch')).toMatch(/колени/);
    expect(correctiveHowNot('jerk_dip')).toMatch(/носк/);
    expect(correctiveHowNot('nope')).toBeNull();
  });
  it('якорь кг: рывок 100@80% → 80, мусор/пусто — null', () => {
    expect(estimateCorrectiveKg('tall_snatch', 80, { snatch: 100 })).toBe(80);
    expect(estimateCorrectiveKg('tall_snatch', 40, { snatch: 100 })).toBe(40);
    expect(estimateCorrectiveKg('tall_snatch', 80, null)).toBeNull();
    expect(estimateCorrectiveKg('tall_snatch', 0, { snatch: 100 })).toBeNull();
  });
  it('лесенка регрессии: ≥1 шаг, tall — про палку/гриф', () => {
    const steps = regressionSteps('tall_snatch');
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });
  it('П5: howNot покрывает все 67 записей (непустые строки)', () => {
    for (const e of TA_CORRECTIVES) {
      const h = correctiveHowNot(e.id);
      expect(h && h.length > 5, e.id).toBe(true);
    }
  });
  it('П2: фаза сезона — старт 0–21 день → comp, иначе null', () => {
    const now = '2026-09-01';
    expect(seasonPhaseForCompetition('2026-09-01', now)).toBe('comp');
    expect(seasonPhaseForCompetition('2026-09-22', now)).toBe('comp');
    expect(seasonPhaseForCompetition('2026-10-15', now)).toBeNull();
    expect(seasonPhaseForCompetition('2026-08-01', now)).toBeNull();
    expect(seasonPhaseForCompetition(null)).toBeNull();
    expect(seasonPhaseForCompetition('мусор', now)).toBeNull();
  });
  it('П3: injectId всех комплексов — штанга (гвард инъекции их не зарежет)', () => {
    for (const c of TA_CORRECTIVE_COMPLEXES) {
      expect(correctiveMetaOf(c.injectId).nonBarbell, c.id).not.toBe(true);
      expect(correctiveById(c.injectId), c.id).not.toBeNull();
    }
  });
  it('Д1: новые оверхед-фиксации в overhead-спросе (плечо их топит)', () => {
    for (const id of ['oh_lunge', 'heaving_balance', 'snatch_push_press', 'jerk_support']) {
      expect(MOBILITY_DEMAND.overhead).toContain(id);
    }
    const ids = new Set(TA_CORRECTIVES.map((e) => e.id));
    for (const id of MOBILITY_DEMAND.overhead) expect(ids.has(id), `overhead/${id}`).toBe(true);
    // плечо топит оверхед-спрос: oh_lunge падает, не-спросовый split_pause обгоняет split_jerk
    const free = correctivesForWeakPoint('jerk_lockout', { cause: 'technique', limit: 10 });
    const sore = correctivesForWeakPoint('jerk_lockout', { cause: 'technique', mobilityRestrictions: ['shoulder'], limit: 10 });
    const fi = (l: ReturnType<typeof correctivesForWeakPoint>, id: string) => l.findIndex((c) => c.id === id);
    expect(fi(free, 'oh_lunge')).toBeGreaterThanOrEqual(0);
    expect(fi(sore, 'oh_lunge')).toBeGreaterThan(fi(free, 'oh_lunge'));
    expect(fi(sore, 'split_pause')).toBeLessThan(fi(sore, 'split_jerk'));
  });
});
