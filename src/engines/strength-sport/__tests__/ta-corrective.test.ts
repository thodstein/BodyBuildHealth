import { describe, it, expect } from 'vitest';
import {
  TA_CORRECTIVES, CORRECTIVES_BY_PHASE, correctivesForWeakPoint,
  correctiveSessionFor, correctiveBlockFor, correctivesByError,
  adjustProtocolForCause, TA_ERROR_TAG_RU, correctiveById,
  tagsForBarMetrics, correctiveExportLines,
} from '../strength-sport-ta-corrective.engine';
import { estimateCorrBasePm } from '../strength-sport-ta-simulator.engine';
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
});
