/**
 * D1 (§9 плана BB-AUTO-EXHAUSTIVE-PRO) — unit-lock чистого приёмника движений ББ-диагностики:
 *  - bits: движение+fix, односторонний слабее левая/правая;
 *  - persist: санитизированные driver/singleLeg (клэмпы, трим, мусор отбрасывается);
 *  - clean: stale L/R-канал чистится ТОЛЬКО при наличии ключа `lrVerdicts` в payload
 *    (маркер BB-хаба; WL/SM/Arm-хабы его не шлют → их мосты ничего не сносят);
 *  - `vbtLossPct` НЕ читается (хаб шлёт null by design) — движок без localStorage/window.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveBbDiagIntakeExtras } from '../bb-diag-intake.engine';

const ENGINE_SRC = readFileSync(resolve(__dirname, '..', 'bb-diag-intake.engine.ts'), 'utf8');

const DRIVER = {
  driver: 'ankle',
  label: 'Голеностоп (дорсифлексия)',
  fix: 'Мобилизация голеностопа ежедневно + подъём пятки 2.5 см',
  confidence: 0.7,
};
const SINGLE = { weakSide: 'left' as const, text: 'Односторонний: слабее левая (2 vs 1) — унилатеральная первой в сессии' };

describe('D1 bits (тост «диагностика»)', () => {
  it('движение с fix: «движение: label (фикс: fix)»', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: DRIVER });
    expect(r.bits).toEqual([`движение: ${DRIVER.label} (фикс: ${DRIVER.fix})`]);
  });

  it('движение без fix: только label', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: { ...DRIVER, fix: '' } });
    expect(r.bits).toEqual([`движение: ${DRIVER.label}`]);
  });

  it('односторонний: слабее левая / правая; balanced (null) — без бита', () => {
    expect(resolveBbDiagIntakeExtras({ singleLeg: SINGLE }).bits).toEqual(['односторонний: слабее левая']);
    expect(resolveBbDiagIntakeExtras({ singleLeg: { ...SINGLE, weakSide: 'right' } }).bits).toEqual(['односторонний: слабее правая']);
    expect(resolveBbDiagIntakeExtras({ singleLeg: { weakSide: null, text: 'Обе стороны чистые' } }).bits).toEqual([]);
  });

  it('оба движения — оба бита, порядок стабилен (движение → односторонний)', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: DRIVER, singleLeg: SINGLE });
    expect(r.bits).toHaveLength(2);
    expect(r.bits[0].startsWith('движение: ')).toBe(true);
    expect(r.bits[1]).toBe('односторонний: слабее левая');
  });

  it('пусто/мусор → пустые bits, без исключений', () => {
    for (const d of [undefined, null, {}, { movementDriver: 'мусор' }, { movementDriver: [] }, { singleLeg: 42 }, { singleLeg: {} }]) {
      expect(resolveBbDiagIntakeExtras(d as never).bits).toEqual([]);
    }
  });
});

describe('D1 persist (he_bb_last_movement_driver / he_bb_last_single_leg)', () => {
  it('драйвер: трим строк, confidence клэмпится 0..1', () => {
    const r = resolveBbDiagIntakeExtras({
      movementDriver: { driver: ' ankle ', label: ' Голеностоп ', fix: ' fix ', confidence: 2 },
    });
    expect(r.persist.movementDriver).toEqual({ driver: 'ankle', label: 'Голеностоп', fix: 'fix', confidence: 1 });
    expect(resolveBbDiagIntakeExtras({ movementDriver: { ...DRIVER, confidence: -3 } }).persist.movementDriver?.confidence).toBe(0);
    expect(resolveBbDiagIntakeExtras({ movementDriver: { ...DRIVER, confidence: Number.NaN } }).persist.movementDriver?.confidence).toBe(0);
  });

  it('драйвер без label (или label не строка) → не персистится и без бита', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: { driver: 'ankle', fix: 'x', confidence: 1 } });
    expect(r.persist.movementDriver).toBeUndefined();
    expect(r.bits).toEqual([]);
  });

  it('driver пустой → fallback на label', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: { driver: '  ', label: 'Кор', fix: '', confidence: 0.6 } });
    expect(r.persist.movementDriver?.driver).toBe('Кор');
  });

  it('singleLeg: сторона строго left/right (мусор → null), текст тримом; текст обязателен', () => {
    const r = resolveBbDiagIntakeExtras({ singleLeg: { weakSide: 'leftish', text: '  Слабее левая  ' } });
    expect(r.persist.singleLeg).toEqual({ weakSide: null, text: 'Слабее левая' });
    expect(resolveBbDiagIntakeExtras({ singleLeg: { weakSide: 'right', text: '   ' } }).persist.singleLeg).toBeUndefined();
  });

  it('оба движения персистятся вместе', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: DRIVER, singleLeg: SINGLE });
    expect(r.persist.movementDriver?.label).toBe(DRIVER.label);
    expect(r.persist.singleLeg?.weakSide).toBe('left');
  });
});

describe('D1 clean (stale L/R-канал)', () => {
  it('маркер lrVerdicts (даже []) + нет lrTopUp → чистим lrTopUp', () => {
    expect(resolveBbDiagIntakeExtras({ lrVerdicts: [] }).clean.lrTopUp).toBe(true);
    expect(resolveBbDiagIntakeExtras({ lrVerdicts: [] }).clean.returnAction).toBe(true);
  });

  it('без lrVerdicts — ничего не чистится (WL/SM/Arm-хабы)', () => {
    const r = resolveBbDiagIntakeExtras({ movementDriver: DRIVER, singleLeg: SINGLE });
    expect(r.clean).toEqual({ lrTopUp: false, returnAction: false });
  });

  it('returnAction чистится только когда returnStage тоже отсутствует', () => {
    const r = resolveBbDiagIntakeExtras({ lrVerdicts: [], returnStage: '2' });
    expect(r.clean.returnAction).toBe(false);
    expect(resolveBbDiagIntakeExtras({ lrVerdicts: [], returnStage: null }).clean.returnAction).toBe(true);
  });

  it('payload с данными канала → не чистим', () => {
    const r = resolveBbDiagIntakeExtras({
      lrVerdicts: [{ group: 'biceps', verdict: 'topup' }],
      lrTopUp: { biceps: { side: 'left', sets: 2 } },
      returnAction: { volumeMult: 0.75, rirShift: 1, bannedPatterns: [] },
    });
    expect(r.clean).toEqual({ lrTopUp: false, returnAction: false });
  });

  it('lrTopUp = {} → новый clean не срабатывает (за legacy-веткой компонента)', () => {
    expect(resolveBbDiagIntakeExtras({ lrVerdicts: [], lrTopUp: {} }).clean.lrTopUp).toBe(false);
  });
});

describe('D1 vbtLossPct не читается', () => {
  it('лишнее поле не меняет решение (глубокое равенство)', () => {
    const base = { movementDriver: DRIVER, singleLeg: SINGLE, lrVerdicts: [] };
    const withVbt = { ...base, vbtLossPct: 42 } as unknown;
    expect(resolveBbDiagIntakeExtras(withVbt as never)).toEqual(resolveBbDiagIntakeExtras(base));
  });

  it('движок без сайд-эффектов: нет обращений к localStorage/window и чтения vbtLossPct', () => {
    expect(ENGINE_SRC.includes('localStorage.')).toBe(false);
    expect(ENGINE_SRC.includes('window.')).toBe(false);
    expect(ENGINE_SRC.includes('.vbtLossPct')).toBe(false);
    expect(ENGINE_SRC.includes('vbtLossPct:')).toBe(false);
  });

  it('идемпотентность и вход не мутируется', () => {
    const input = { movementDriver: { ...DRIVER }, singleLeg: { ...SINGLE }, lrVerdicts: [] };
    const snapshot = JSON.stringify(input);
    const a = resolveBbDiagIntakeExtras(input);
    const b = resolveBbDiagIntakeExtras(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
