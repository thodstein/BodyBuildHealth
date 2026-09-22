import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rankArmliftCorrections, buildArmliftSpecBlock, armliftCorrectionPoolIds } from '../armlift-correction.engine';
import {
  injectArmliftCorrections,
  correctionsToInjectionItems,
  rirForCause,
} from '../armlift-injection.engine';
import { getArmExerciseById } from '../../../core/exercise-catalog-arm';
import type { ArmliftWeakLink } from '../armlift-diagnosis.engine';

const LINKS: ArmliftWeakLink[] = [
  'thumb', 'fingers', 'wrist_ext', 'support_endurance', 'crush', 'technique', 'asymmetry', 'conditioning',
];

describe('PRO-CORR K1: библиотека PRO на реальных id', () => {
  it('все коррекции всех звеньев — реальные id каталога', () => {
    for (const wl of LINKS) {
      for (const c of rankArmliftCorrections(wl)) {
        expect(getArmExerciseById(c.exId)).toBeTruthy();
      }
    }
  });
  it('пул вырос: определено >= 35 уникальных (было ~22), все — реальные id', () => {
    const ids = armliftCorrectionPoolIds();
    expect(ids.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getArmExerciseById(id)).toBeTruthy();
  });
  it('ROUND-10: каждая причина × фаза ≥2 (6 ячеек были по 1) + причины только канонические', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/arm/armlift-correction.engine.ts'), 'utf8');
    const VALID = new Set(['technique', 'max_strength', 'endurance', 'volume', 'mobility', 'fatigue', 'pain']);
    const counts: Record<string, number> = {};
    const bad: string[] = [];
    for (const line of src.split('\n')) {
      const m = line.match(/causes: \[([^\]]*)\].*?phase: '([a-z]+)'/);
      if (!m) continue;
      for (const c of m[1].replace(/[^a-z_,]/g, '').split(',')) {
        if (!c) continue;
        if (!VALID.has(c)) bad.push(c);
        const k = `${c}/${m[2]}`;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    expect(Array.from(new Set(bad))).toEqual([]);
    const thin = Object.entries(counts).filter(([, n]) => n < 2).map(([k, n]) => `${k}:${n}`);
    expect(thin).toEqual([]);
  });
  it('ROUND-9: библиотека 42→≥50 записей; Excalibur покрыт коррекциями', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/arm/armlift-correction.engine.ts'), 'utf8');
    expect((src.match(/\{ exId:/g) || []).length).toBeGreaterThanOrEqual(50);
    for (const phase of ['technique', 'strength', 'stability']) {
      expect((src.match(new RegExp(`phase: '${phase}'`, 'g')) || []).length).toBeGreaterThanOrEqual(10);
    }
    const ids = armliftCorrectionPoolIds();
    expect(ids).toContain('excalibur_handle');
    // Excalibur покрыт в самой библиотеке (снаряд был в каталоге без практики).
    expect((src.match(/\{ exId: 'excalibur_handle'/g) || []).length).toBeGreaterThanOrEqual(2);
    const exLines = src.split('\n').filter((l) => l.includes("exId: 'excalibur_handle'"));
    expect(exLines.every((l) => l.includes('cues:') && l.includes('progression:'))).toBe(true);
  });
  it('топ несёт кью и прогрессию (показ в табе)', () => {
    const top = rankArmliftCorrections('thumb', 'saxon_bar', {});
    expect(top.some((c) => (c.cues || []).length > 0)).toBe(true);
    expect(top.some((c) => (c.progression || '').length > 0)).toBe(true);
  });
  it('lock: thumb топ-1 plate_pinch_hold цел', () => {
    expect(rankArmliftCorrections('thumb')[0].id).toBe('plate_pinch_hold');
  });
  it('lock: support_endurance дефолт [farmer, towel, fat_gripz] цел', () => {
    expect(rankArmliftCorrections('support_endurance', 'rolling_thunder', {}).map((c) => c.id))
      .toEqual(['farmer_walk_fat', 'towel_pullup', 'fat_gripz_curl']);
  });
  it('lock: crush generic топ coc_trainer цел', () => {
    expect(rankArmliftCorrections('crush')[0].exId).toMatch(/coc_|silver/);
    expect(rankArmliftCorrections('crush', 'coc_gripper', {})[0].exId).toBe('coc_trainer');
  });
});

describe('PRO-CORR K2: матрица причина × уровень × оборудование × боль', () => {
  it('cause-матрица: mobility держит экстензоры в топе запястья', () => {
    const top = rankArmliftCorrections('wrist_ext', 'rolling_thunder', { cause: 'mobility' });
    expect(top[0].exId).toBe('wrist_ext_bb');
    expect(top[0].source).toContain('под причину');
  });
  it('cause-матрица: max_strength держит rolling в топе пальцев', () => {
    const top = rankArmliftCorrections('fingers', 'rolling_thunder', { cause: 'max_strength' });
    expect(top[0].exId).toBe('rolling_thunder');
  });
  it('level-гейт: новичку не едут Inch и Rolling в топ-3 пальцев', () => {
    const top = rankArmliftCorrections('fingers', 'rolling_thunder', { level: 'beginner' });
    const ids = top.map((c) => c.exId);
    expect(ids).not.toContain('inch_dumbbell');
    expect(ids).not.toContain('rolling_thunder');
    expect(top.some((c) => c.source.includes('сложно для уровня'))).toBe(true);
  });
  it('equipment-фолбэк: без grip_tool подменяется, а не умирает', () => {
    const top = rankArmliftCorrections('wrist_ext', 'rolling_thunder', { equipment: ['band'] });
    expect(top.some((c) => c.exId === 'finger_containment_band')).toBe(true);
    expect(top.some((c) => c.source.includes('замена оборудованием'))).toBe(true);
  });
  it('боль (gentleOnly): только щадящие, без тяжёлых троек', () => {
    const top = rankArmliftCorrections('fingers', 'rolling_thunder', { gentleOnly: true });
    expect(top.length).toBe(3);
    expect(top.every((c) => ['wrist_ext_bb', 'wrist_roller', 'plate_pinch_hold'].includes(c.exId))).toBe(true);
  });
  it('усталость щадит: ext_bb первый при fatigue', () => {
    const top = rankArmliftCorrections('wrist_ext', 'rolling_thunder', { cause: 'fatigue' });
    expect(top[0].exId).toBe('wrist_ext_bb');
  });
  it('limit: 4-й ранг — запасная для UI', () => {
    const four = rankArmliftCorrections('thumb', 'saxon_bar', {}, 4);
    expect(four.length).toBe(4);
    expect(new Set(four.map((c) => c.id)).size).toBe(4);
  });
});

describe('PRO-CORR добивка: лесенка и малые пулы', () => {
  it('лесенка CoC несёт кью и прогрессию (порядок цел)', () => {
    const ladder = rankArmliftCorrections('crush', 'coc_gripper', { cocLevel: 1 });
    expect(ladder[0].exId).toBe('coc_no1');
    expect(ladder.every((c) => (c.cues || []).length > 0 && (c.progression || '').length > 0)).toBe(true);
  });
  it('инжектированный экстензор несёт кью (дисбаланс)', () => {
    const imb = rankArmliftCorrections('support_endurance', 'rolling_thunder', { extImbalance: true });
    const ext = imb.find((c) => c.exId === 'wrist_ext_bb');
    expect(ext).toBeTruthy();
    expect((ext?.cues || []).length).toBeGreaterThan(0);
  });
  it('level-гейт малых пулов: technique/asymmetry без rolling у новичка', () => {
    const tech = rankArmliftCorrections('technique', 'rolling_thunder', { level: 'beginner' });
    expect(tech.map((c) => c.exId)).not.toContain('rolling_thunder');
    const asym = rankArmliftCorrections('asymmetry', 'rolling_thunder', { level: 'beginner' });
    const ids = asym.map((c) => c.exId);
    expect(ids).not.toContain('rolling_thunder');
    expect(ids).toContain('wrist_curl_db');
  });
  it('дефолт малых пулов цел: technique [rolling, plate, farmer]', () => {
    expect(rankArmliftCorrections('technique', 'rolling_thunder', {}).map((c) => c.exId))
      .toEqual(['rolling_thunder', 'plate_pinch_hold', 'farmer_walk_fat']);
    expect(rankArmliftCorrections('asymmetry', 'rolling_thunder', {}).map((c) => c.exId))
      .toEqual(['plate_pinch_hold', 'rolling_thunder', 'wrist_ext_bb']);
  });
});

describe('PRO-CORR K3: покрытие фаз срыва', () => {
  it('каждая фаза чинится минимум 2 упражнениями', () => {
    for (const fp of ['off_floor', 'hold_short', 'hold_long', 'mid', 'lockout', 'close_fail']) {
      const ids = new Set<string>();
      for (const wl of LINKS) {
        for (const c of rankArmliftCorrections(wl, undefined, { failurePoint: fp }, 6)) {
          if (c.source.includes('чинит срыв')) ids.add(c.exId);
        }
      }
      expect(ids.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('PRO-CORR K4: спец-волна с подсказкой', () => {
  it('detail: CoC — лесенка, щипок — широкий→узкий, support — тройки', () => {
    const coc = buildArmliftSpecBlock('crush', 'coc_gripper');
    expect(coc[0].detail).toContain('CoC');
    const pinch = buildArmliftSpecBlock('thumb', 'saxon_bar');
    expect(pinch[0].detail).toContain('Щипок');
    const sup = buildArmliftSpecBlock('fingers', 'rolling_thunder');
    expect(sup[0].detail).toContain('тройки');
  });
  it('форма блока цела: 4/6 нед, делод последний, fatigueFirst первый', () => {
    expect(buildArmliftSpecBlock('thumb', 'saxon_bar').length).toBe(4);
    expect(buildArmliftSpecBlock('thumb', 'saxon_bar', undefined, 6).length).toBe(6);
    expect(buildArmliftSpecBlock('thumb', 'saxon_bar')[3].focus).toContain('Делод');
    expect(buildArmliftSpecBlock('fingers', 'rolling_thunder', undefined, 4, { fatigueFirst: true })[0].focus).toContain('Делод');
  });
});

describe('PRO-CORR K5: инъекция держит дозу коррекции', () => {
  const plan = () => ({
    level: 'intermediate', rationale: [] as string[],
    weeks: [{ week: 1, sessions: [{ sessionTag: 'PinchGrip', exercises: [] }] }],
  });
  it('rirForCause: боль/усталость/мобильность 3, сила 1, остальное 2', () => {
    expect(rirForCause('pain')).toBe(3);
    expect(rirForCause('fatigue')).toBe(3);
    expect(rirForCause('mobility')).toBe(3);
    expect(rirForCause('max_strength')).toBe(1);
    expect(rirForCause('technique')).toBe(2);
    expect(rirForCause(null)).toBe(2);
  });
  it('items несут holdSeconds коррекции и заданный rir', () => {
    const top = rankArmliftCorrections('thumb', 'saxon_bar', {});
    const items = correctionsToInjectionItems(top, 3, 0.5, rirForCause('mobility'));
    expect(items.every((t) => t.intensityPct === 0.5 && t.rir === 3)).toBe(true);
    const plate = items.find((t) => t.exId === 'plate_pinch_hold');
    expect(plate?.holdSeconds).toBe(25);
  });
  it('инъекция ставит холд 25с из коррекции, а не фикс 20с', () => {
    const r = injectArmliftCorrections(plan(), [{ exId: 'plate_pinch_hold', sets: 3, dayTag: 'PinchGrip', holdSeconds: 25, rir: 3 }], { workMax: { grip_pinch: 40 } });
    expect(r.injected).toBe(1);
    const ex = r.plan.weeks[0].sessions[0].exercises[0];
    expect(ex.workSets[0].holdSeconds).toBe(25);
    expect(ex.holdSeconds).toBe(25);
    expect(ex.workSets[0].rir).toBe(3);
  });
  it('без holdSeconds — дефолт 20с как раньше', () => {
    const r = injectArmliftCorrections(plan(), [{ exId: 'plate_pinch_hold', sets: 3, dayTag: 'PinchGrip' }], { workMax: { grip_pinch: 40 } });
    expect(r.plan.weeks[0].sessions[0].exercises[0].workSets[0].holdSeconds).toBe(20);
  });
});
