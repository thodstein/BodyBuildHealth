import { describe, it, expect } from 'vitest';
import {
  TA_CORRECTIVES, CORRECTIVES_BY_PHASE, correctivesForWeakPoint,
  correctiveSessionFor, correctiveBlockFor, correctivesByError,
  adjustProtocolForCause, TA_ERROR_TAG_RU, correctiveById,
  tagsForBarMetrics, correctiveExportLines, protocolForPreferred,
  MOBILITY_DEMAND,
} from '../strength-sport-ta-corrective.engine';
import { estimateCorrBasePm } from '../strength-sport-ta-simulator.engine';
import { rankCorrectionsForTA } from '../strength-sport-ta-correction-rank.engine';
import type { TAWeakCause } from '../strength-sport-ta-weak-cause.engine';
import { allWLWeakPoints } from '../strength-sport-weakpoint';

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
    expect(sh.findIndex((c) => c.id === 'tall_snatch')).toBeGreaterThan(
      noMob.findIndex((c) => c.id === 'tall_snatch'),
    );
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
    const a = protocolForPreferred('snatch_pull_under', 'tall_snatch', 'technique', 'intermediate');
    const b = protocolForPreferred('snatch_pull_under', 'tall_snatch', 'technique', 'intermediate', ['shoulder']);
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
});
