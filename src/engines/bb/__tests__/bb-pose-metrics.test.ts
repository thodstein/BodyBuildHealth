/**
 * bb-pose-metrics.test.ts — BB-G-05: геометрия позы проверяется без камеры и модели.
 *
 * Синтетические лендмарки построены так, что ответ считается вручную:
 *  - фронтально: колено внутрь на 0.07 норм. длины при «ноге» 0.37 → atan(0.07/0.37) ≈ 10.7°
 *    (порог заметного вальгуса 10°); сдвиг таза 0.04 при стойке 0.20 → 20% (порог 10%);
 *    перекос таза 0.02/0.20 → 10% (порог 8%);
 *  - сбоку: угол в колене задаётся направлением «таз→колено→голеностоп» (90/110/150),
 *    наклон корпуса — dx/0.20 (30° / 50°), подъём пятки — (носок−пятка)/длина стопы.
 * Если поменять пороги или знак «внутрь», тест падает — это и есть лок.
 */
import { describe, it, expect } from 'vitest';
import {
  BB_POSE_THRESHOLDS,
  bbAngleDeg,
  bbPoseHasPatch,
  bbPoseLines,
  bbPoseScreeningPatch,
  bbTiltFromVerticalDeg,
  summarizeBbPose,
  type BbPoseLandmark,
} from '../bb-pose-metrics.engine';

const lm33 = (over: Record<number, { x: number; y: number; visibility?: number }> = {}): BbPoseLandmark[] => {
  const arr: BbPoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  for (const [k, v] of Object.entries(over)) arr[Number(k)] = { visibility: 0.9, ...v };
  return arr;
};

/** Нейтральная фронтальная поза: стойка 0.20, колени на линии таз–стопа, руки над стопой. */
const front = (o: Record<number, { x: number; y: number }> = {}): BbPoseLandmark[] => lm33({
  11: { x: 0.40, y: 0.30 }, 12: { x: 0.60, y: 0.30 },
  15: { x: 0.46, y: 0.14 }, 16: { x: 0.54, y: 0.14 },
  23: { x: 0.42, y: 0.55 }, 24: { x: 0.58, y: 0.55 },
  25: { x: 0.41, y: 0.735 }, 26: { x: 0.59, y: 0.735 },
  27: { x: 0.40, y: 0.92 }, 28: { x: 0.60, y: 0.92 },
  29: { x: 0.40, y: 0.95 }, 30: { x: 0.60, y: 0.95 },
  31: { x: 0.40, y: 0.985 }, 32: { x: 0.60, y: 0.985 },
  ...o,
});

/**
 * Профиль: колено в (0.5, 0.70), таз в (0.5, 0.50), голеностоп под углом `kneeDeg`
 * к бедру. v = (sin A, −cos A) даёт внутренний угол ровно A.
 */
const side = (opts: { kneeDeg?: number; trunkDx?: number; heelY?: number } = {}): BbPoseLandmark[] => {
  const A = opts.kneeDeg ?? 180;
  const rad = (A * Math.PI) / 180;
  const knee = { x: 0.5, y: 0.70 };
  const ankle = { x: knee.x + 0.2 * Math.sin(rad), y: knee.y - 0.2 * Math.cos(rad) };
  const hip = { x: 0.5, y: 0.50 };
  const sh = { x: 0.5 + (opts.trunkDx ?? 0), y: 0.30 };
  const heel = { x: 0.45, y: opts.heelY ?? 0.95 };
  const toe = { x: 0.52, y: 0.95 };
  return lm33({
    11: sh, 12: sh,
    15: { x: 0.5, y: 0.16 }, 16: { x: 0.5, y: 0.16 },
    23: hip, 24: hip,
    25: knee, 26: knee,
    27: ankle, 28: ankle,
    29: heel, 30: heel,
    31: toe, 32: toe,
  });
};

const frames = (f: () => BbPoseLandmark[], n = 6) => Array.from({ length: n }, f);

describe('базовая геометрия', () => {
  it('угол в колене: прямая нога 180, согнутая 90', () => {
    expect(bbAngleDeg({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180, 5);
    expect(bbAngleDeg({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
  });
  it('наклон корпуса: вертикально 0, dx/dy даёт arctg', () => {
    expect(bbTiltFromVerticalDeg({ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 })).toBeCloseTo(0, 5);
    expect(bbTiltFromVerticalDeg({ x: 0.7, y: 0.3 }, { x: 0.5, y: 0.5 })).toBeCloseTo(45, 5);
  });
  it('нулевые координаты не дают NaN-мусора в сводке', () => {
    const s = summarizeBbPose([[{ x: 0, y: 0 }, { x: 0, y: 0 }]], 'front');
    expect(s.framesPosed).toBe(0);
    expect(s.quality).toBe('none');
    expect(s.valgusDeg).toBeNull();
  });
});

describe('фронтально: вальгус, сдвиг и перекос таза', () => {
  it('нейтральная стойка: 0° вальгуса, 0% сдвига, руки над стопой 100%', () => {
    const s = summarizeBbPose(frames(front), 'front');
    expect(s.quality).toBe('ok');
    expect(s.framesPosed).toBe(6);
    expect(s.valgusDeg).toBe(0);
    expect(s.valgusLevel).toBe('none');
    expect(s.hipShiftPct).toBe(0);
    expect(s.pelvicDropPct).toBe(0);
    expect(s.armsOverMidfootPct).toBe(100);
    // глубина — только сбоку: во фронте честный null, а не «0°»
    expect(s.depthKneeDeg).toBeNull();
    expect(s.depthLevel).toBeNull();
  });

  it('колени на 0.07 внутрь → вальгус ≈10.7° = заметный', () => {
    const s = summarizeBbPose(frames(() => front({ 25: { x: 0.48, y: 0.735 }, 26: { x: 0.52, y: 0.735 } })), 'front');
    expect(s.valgusDeg).toBeCloseTo(10.7, 0);
    expect(s.valgusLevel).toBe('notable');
    expect(BB_POSE_THRESHOLDS.valgusNotable).toBe(10);
  });

  it('колени на 0.04 внутрь → 6.2° = пограничный (между 5 и 10)', () => {
    const s = summarizeBbPose(frames(() => front({ 25: { x: 0.45, y: 0.735 }, 26: { x: 0.55, y: 0.735 } })), 'front');
    expect(s.valgusDeg).toBeCloseTo(6.2, 0);
    expect(s.valgusLevel).toBe('borderline');
  });

  it('таз сдвинут на 0.04 при стойке 0.20 → 20% = заметный сдвиг', () => {
    const s = summarizeBbPose(frames(() => front({ 23: { x: 0.46, y: 0.55 }, 24: { x: 0.62, y: 0.55 } })), 'front');
    expect(s.hipShiftPct).toBeCloseTo(20, 0);
    expect(s.hipShiftLevel).toBe('notable');
  });

  it('правое бедро выше на 0.02 → перекос 10% = заметный', () => {
    const s = summarizeBbPose(frames(() => front({ 24: { x: 0.58, y: 0.57 } })), 'front');
    expect(s.pelvicDropPct).toBeCloseTo(10, 0);
    expect(s.pelvicDropLevel).toBe('notable');
  });

  it('руки сдвинуты от стопы → «руки над стопой» 0%', () => {
    const s = summarizeBbPose(frames(() => front({ 15: { x: 0.10, y: 0.14 }, 16: { x: 0.15, y: 0.14 } })), 'front');
    expect(s.armsOverMidfootPct).toBe(0);
  });

  it('стойка уже 0.02 — фронтальные метрики честно не считаются', () => {
    const s = summarizeBbPose(frames(() => front({ 27: { x: 0.495, y: 0.92 }, 28: { x: 0.505, y: 0.92 } })), 'front');
    expect(s.framesPosed).toBe(0);
    expect(s.valgusDeg).toBeNull();
    expect(s.quality).toBe('none');
  });

  it('в профиле вальгус не считается (null), даже если колени «внутрь»', () => {
    const s = summarizeBbPose(frames(side), 'side');
    expect(s.valgusDeg).toBeNull();
    expect(s.hipShiftPct).toBeNull();
    expect(s.pelvicDropPct).toBeNull();
  });
});

describe('сбоку: глубина, наклон корпуса, пятка', () => {
  it('колено 90° → глубина «глубоко» (порог 100)', () => {
    const s = summarizeBbPose(frames(() => side({ kneeDeg: 90 })), 'side');
    expect(s.depthKneeDeg).toBeCloseTo(90, 0);
    expect(s.depthLevel).toBe('deep');
  });

  it('колено 110° → «до параллели» (100 < 110 ≤ 120)', () => {
    const s = summarizeBbPose(frames(() => side({ kneeDeg: 110 })), 'side');
    expect(s.depthLevel).toBe('parallel');
  });

  it('колено 150° → «неполная глубина»', () => {
    const s = summarizeBbPose(frames(() => side({ kneeDeg: 150 })), 'side');
    expect(s.depthLevel).toBe('shallow');
  });

  it('наклон корпуса 30° → умеренный, 50° → сильный', () => {
    const moderate = summarizeBbPose(frames(() => side({ trunkDx: 0.2 * Math.tan(Math.PI / 6) })), 'side');
    expect(moderate.trunkLeanDeg).toBeCloseTo(30, 0);
    expect(moderate.trunkLevel).toBe('moderate');
    const excessive = summarizeBbPose(frames(() => side({ trunkDx: 0.2 * Math.tan((50 * Math.PI) / 180) })), 'side');
    expect(excessive.trunkLeanDeg).toBeCloseTo(50, 0);
    expect(excessive.trunkLevel).toBe('excessive');
    const upright = summarizeBbPose(frames(() => side({ trunkDx: 0 })), 'side');
    expect(upright.trunkLeanDeg).toBeCloseTo(0, 0);
    expect(upright.trunkLevel).toBe('upright');
  });

  it('пятка поднята на 0.03: длина стопы с подъёмом 0.0762 → ≈39% = заметный подъём', () => {
    const s = summarizeBbPose(frames(() => side({ heelY: 0.92 })), 'side');
    expect(s.heelRisePct).toBeCloseTo(39.4, 0);
    expect(s.heelRisePct! >= BB_POSE_THRESHOLDS.heelNotable).toBe(true);
  });

  it('пятка на полу → 0%', () => {
    const s = summarizeBbPose(frames(() => side({ heelY: 0.95 })), 'side');
    expect(s.heelRisePct).toBeCloseTo(0, 5);
  });

  it('камеру сбоку: вальгуса нет, глубина есть', () => {
    const s = summarizeBbPose(frames(() => side({ kneeDeg: 95 })), 'side');
    expect(s.depthLevel).toBe('deep');
    expect(s.valgusDeg).toBeNull();
  });
});

describe('качество и честные состояния', () => {
  it('меньше 4 кадров с позой → черновой результат + пояснение', () => {
    const s = summarizeBbPose(frames(side, 2), 'side');
    expect(s.framesPosed).toBe(2);
    expect(s.quality).toBe('low');
    expect(s.notes.join(' ')).toMatch(/черновой/);
  });

  it('поза не найдена ни в одном кадре → quality none и причина, а не нули', () => {
    const none = summarizeBbPose([[], [], []], 'front');
    expect(none.quality).toBe('none');
    expect(none.framesPosed).toBe(0);
    expect(none.notes.join(' ')).toMatch(/Поза не распознана/);
    expect(bbPoseLines(none)).toEqual([]);
    // а «кадров нет вовсе» — отдельное сообщение
    const empty = summarizeBbPose([], 'front');
    expect(empty.notes.join(' ')).toMatch(/Кадров нет/);
  });

  it('низкая видимость ключевых точек = кадр без позы', () => {
    const bad = front();
    for (const i of [23, 24, 25, 26, 27, 28]) bad[i] = { ...bad[i], visibility: 0.2 };
    const s = summarizeBbPose([bad, bad], 'front');
    expect(s.framesPosed).toBe(0);
    expect(s.quality).toBe('none');
  });

  it('ракурс всегда объяснён: фронт не обещает глубину, профиль — вальгус', () => {
    const f = summarizeBbPose(frames(front), 'front');
    const sd = summarizeBbPose(frames(side), 'side');
    expect(f.notes.join(' ')).toMatch(/Глубина приседа.*не измеряются/);
    expect(sd.notes.join(' ')).toMatch(/Вальгус.*не видны/);
    // 2D-ограничение печатается в обоих ракурсах
    expect(f.notes.join(' ')).toMatch(/2D-видео/);
    expect(sd.notes.join(' ')).toMatch(/2D-видео/);
  });

  it('пороги попадают в результат — отчёт печатает те же числа', () => {
    const s = summarizeBbPose(frames(front), 'front');
    expect(s.thresholds.valgusNotable).toBe(BB_POSE_THRESHOLDS.valgusNotable);
    expect(s.thresholds.depthDeep).toBe(100);
    expect(s.thresholds.heelBorderline).toBe(15);
  });
});

describe('перенос в OHS-скрининг: только измеренное', () => {
  it('фронт переносит вальгус и руки, но не глубину/корпус/пятку', () => {
    const s = summarizeBbPose(frames(() => front({ 25: { x: 0.48, y: 0.735 }, 26: { x: 0.52, y: 0.735 } })), 'front');
    const p = bbPoseScreeningPatch(s);
    expect(p.ohsKneeValgus).toBe(true);
    expect(p.ohsArmsOverMidfoot).toBe(true);
    expect('ohsHipBelowParallel' in p).toBe(false);
    expect('ohsTrunkUpright' in p).toBe(false);
    expect('ohsHeelsFlat' in p).toBe(false);
  });

  it('профиль переносит глубину/корпус/пятку, но не вальгус', () => {
    const deep = summarizeBbPose(frames(() => side({ kneeDeg: 95, trunkDx: 0, heelY: 0.95 })), 'side');
    const p = bbPoseScreeningPatch(deep);
    expect(p.ohsHipBelowParallel).toBe(true);
    expect(p.ohsTrunkUpright).toBe(true);
    expect(p.ohsHeelsFlat).toBe(true);
    expect('ohsKneeValgus' in p).toBe(false);
    expect(bbPoseHasPatch(deep)).toBe(true);
  });

  it('плохая глубина/наклон/пятка ставят «не сдано», а не выпадают из патча', () => {
    const shallow = summarizeBbPose(frames(() => side({ kneeDeg: 150, trunkDx: 0.2 * Math.tan((50 * Math.PI) / 180), heelY: 0.90 })), 'side');
    const p = bbPoseScreeningPatch(shallow);
    expect(p.ohsHipBelowParallel).toBe(false);
    expect(p.ohsTrunkUpright).toBe(false);
    expect(p.ohsHeelsFlat).toBe(false);
  });

  it('нет позы — переносить нечего (кнопка обязана быть недоступна)', () => {
    const none = summarizeBbPose([[], []], 'side');
    expect(bbPoseScreeningPatch(none)).toEqual({});
    expect(bbPoseHasPatch(none)).toBe(false);
    expect(bbPoseHasPatch(null)).toBe(false);
  });
});

describe('строки вердикта (карточка = отчёт)', () => {
  it('фронт: вальгус/сдвиг/перекос/руки + кадры и качество', () => {
    const s = summarizeBbPose(frames(() => front({ 25: { x: 0.48, y: 0.735 }, 26: { x: 0.52, y: 0.735 } })), 'front');
    const lines = bbPoseLines(s);
    expect(lines.join(' ')).toMatch(/Вальгус: 10\.7°/);
    expect(lines.join(' ')).toMatch(/заметный/);
    expect(lines.join(' ')).toMatch(/порог 5°\/10°/);
    expect(lines.join(' ')).toMatch(/Руки над серединой стопы: 100%/);
    expect(lines.join(' ')).toMatch(/Кадров с позой: 6 из 6/);
  });

  it('профиль: глубина/наклон/пятка', () => {
    const s = summarizeBbPose(frames(() => side({ kneeDeg: 95, trunkDx: 0.2 * Math.tan(Math.PI / 6), heelY: 0.92 })), 'side');
    const t = bbPoseLines(s).join(' ');
    expect(t).toMatch(/Глубина: колено 95°/);
    expect(t).toMatch(/глубоко/);
    expect(t).toMatch(/Наклон корпуса: 30°/);
    expect(t).toMatch(/умеренный наклон/);
    expect(t).toMatch(/Пятка: подъём 39%/);
    expect(t).toMatch(/заметный/);
  });

  it('нет разбора — пустые строки (UI не рисует пустую карточку)', () => {
    expect(bbPoseLines(null)).toEqual([]);
    expect(bbPoseLines(summarizeBbPose([[]], 'side'))).toEqual([]);
  });
});
