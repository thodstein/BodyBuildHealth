/**
 * cardio-pro2.test.ts — P1–P7 PRO-2 (план docs/CARDIO-PRO-2-PLAN.md).
 * Каждый эпик со своим триггером; без фичи тесты красные.
 */
import { describe, it, expect } from 'vitest';
import * as facade from '../cardio.engine';
import {
  buildCardioCycle,
  buildCardioIcs,
  type CardioCycle,
} from '../cardio.engine';
import {
  CARDIO_RED_FLAGS,
  screenCardioRedFlags,
  needsMedicalBlock,
} from '../cardio-red-flags.engine';
import { validateCardioCycle } from '../cardio-plan-validate.engine';
import {
  CARDIO_INTERVAL_PRESETS,
  getCardioIntervalPreset,
} from '../cardio-interval-presets.engine';
import { zone2HonestyNote } from '../cardio-zone2-honesty.engine';
import {
  predictRaceTimes,
  predictorNote,
  RACE_WEEK_CHECKLIST,
} from '../cardio-race-predictor.engine';
import {
  fuelingForSession,
  heatAcclimationPlan,
  altitudeNote,
} from '../cardio-fueling.engine';

const hasType = (c: CardioCycle, t: string) =>
  c.weeks.some(w => w.sessions.some(s => s.type === t));

// ─── P1: фасад после распила — все ключи на месте ───
describe('P1 facade lock', () => {
  it('типы и движки PRO-2 реэкспортируются фасадом', () => {
    for (const k of [
      'buildCardioCycle', 'buildCardioIcs', 'buildCardioPrintHtml', 'buildCardioTcx', 'buildCardioZwo',
      'screenCardioRedFlags', 'needsMedicalBlock', 'CARDIO_RED_FLAGS',
      'zone2HonestyNote',
      'predictRaceTimes', 'RACE_WEEK_CHECKLIST',
      'fuelingForSession', 'heatAcclimationPlan', 'altitudeNote',
      'CARDIO_EQUIPMENT_OPTIONS', 'CARDIO_LEVEL_LABELS', 'CARDIO_PERIODIZATION_LABELS',
      'CARDIO_GOAL_LABELS', 'CARDIO_PHASE_LABELS', 'CARDIO_PRESETS', 'CARDIO_VARIANT_LABELS',
    ]) {
      expect((facade as Record<string, unknown>)[k], k).not.toBeUndefined();
    }
  });
  it('типовой модуль импортируется напрямую', async () => {
    const t = await import('../cardio-cycle-types.engine');
    expect(typeof t).toBe('object');
  });
});

// ─── P4: мед-скрининг ───
describe('P4 red-flags', () => {
  it('5 флагов в каталоге', () => {
    expect(CARDIO_RED_FLAGS.length).toBe(5);
  });
  it('каждый флаг блочит HIIT', () => {
    for (const f of CARDIO_RED_FLAGS) {
      const s = screenCardioRedFlags([f.id], 30);
      expect(s.blockHiit).toBe(true);
      expect(s.doctorNote).toContain('врача');
    }
  });
  it('без флагов 30 лет — не блочит', () => {
    expect(screenCardioRedFlags([], 30).blockHiit).toBe(false);
    expect(needsMedicalBlock([], 30)).toBe(false);
  });
  it('teen 15 лет без флагов — блочит (щадящий)', () => {
    const s = screenCardioRedFlags([], 15);
    expect(s.blockHiit).toBe(true);
    expect(s.teen).toBe(true);
  });
  it('40+ без флага — НЕ блочит (возраст не болезнь)', () => {
    expect(screenCardioRedFlags([], 45).blockHiit).toBe(false);
  });
  it('сборка с флагом: нет HIIT/MISS + rationale к врачу', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, redFlags: ['chest_pain'] });
    expect(hasType(c, 'hiit')).toBe(false);
    expect(hasType(c, 'miss')).toBe(false);
    expect(c.rationale.join(' ')).toContain('врача');
  });
  it('валидатор: medicalBlock + интенсив → error', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const v = validateCardioCycle(c, { medicalBlock: true });
    expect(v.issues.some(i => i.code === 'medical_block' && i.level === 'error')).toBe(true);
    expect(v.valid).toBe(false);
  });
  it('prep-путь: redFlags режут HIIT/MISS (№3-добивка)', async () => {
    const { buildCardioCycleFromPrep } = await import('../cardio.engine');
    const prep = {
      id: 'p1', showDate: '2026-06-01', category: 'mens_bb', sex: 'male' as const,
      preparation: { startDate: '2026-01-05', weeks: 12, finalWeeks: 2, targetRatePctPerWeek: 0.5, startingWeightKg: 90, currentCalories: 2800, stepsPerDay: 8000, cardioMinutesPerWeek: 120 },
      taper: { enabled: true, weeks: 2 },
      peakWeek: { enabled: true },
    };
    const plain = buildCardioCycleFromPrep(prep, {})!;
    expect(plain.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))).toBe(true);
    const blocked = buildCardioCycleFromPrep(prep, { redFlags: ['syncope'], age: 30 })!;
    expect(blocked.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))).toBe(false);
    expect(blocked.weeks.flatMap(w => w.rationale).join(' ')).toContain('Мед-скрининг');
  });
  it('rationale: честный Z2 при <150 мин (№6), молчит при мед-блоке и шаблоне', () => {
    const low = buildCardioCycle({ goal: 'mass', totalWeeks: 6 });
    expect(low.rationale.join(' ')).toContain('Storoschuk');
    const med = buildCardioCycle({ goal: 'mass', totalWeeks: 6, redFlags: ['chest_pain'] });
    expect(med.rationale.join(' ')).not.toContain('Storoschuk');
    const tpl = buildCardioCycle({ goal: 'mass', totalWeeks: 6, templateId: 'x' });
    expect(tpl.rationale.join(' ')).not.toContain('Storoschuk');
  });
});

// ─── P3: интервалы ───
describe('P3 intervals 3→6', () => {
  it('6 пресетов с дозами', () => {
    expect(CARDIO_INTERVAL_PRESETS.length).toBe(6);
    expect(CARDIO_INTERVAL_PRESETS.map(p => p.id)).toEqual(
      expect.arrayContaining(['rst-10x10', 'sit-8x20', 'hiit-opt-140']),
    );
  });
  it('RST 10×10/60', () => {
    const b = getCardioIntervalPreset('rst-10x10')!.build({});
    expect(b).toMatchObject({ workSec: 10, restSec: 60, reps: 10 });
  });
  it('SIT 8×20/10', () => {
    const b = getCardioIntervalPreset('sit-8x20')!.build({});
    expect(b).toMatchObject({ workSec: 20, restSec: 10, reps: 8 });
  });
  it('HIIT-opt 140/165 WRR 0.85', () => {
    const b = getCardioIntervalPreset('hiit-opt-140')!.build({ hrMax: 190 });
    expect(b).toMatchObject({ workSec: 140, restSec: 165 });
    expect(165 / 140).toBeLessThan(1.2);
    expect(b.targetHr).toEqual({ min: 171, max: 181 });
  });
  it('без HRmax — зон нет, текст/RPE', () => {
    const b = getCardioIntervalPreset('hiit-opt-140')!.build({});
    expect(b.targetHr).toBeUndefined();
  });
});

// ─── P2: честный Z2 ───
describe('P2 zone2 honesty', () => {
  it('<150 мин без HIIT → строка', () => {
    expect(zone2HonestyNote(120, 0)).toContain('HIIT');
  });
  it('с HIIT → тихо; ≥180 → тихо', () => {
    expect(zone2HonestyNote(120, 2)).toBeNull();
    expect(zone2HonestyNote(200, 0)).toBeNull();
  });
  it('валидатор: низкообъёмный custom без HIIT → warn', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 6 });
    const v = validateCardioCycle(c);
    expect(v.issues.some(i => i.code === 'z2_without_hiit_low_volume' && i.level === 'warn')).toBe(true);
    expect(v.valid).toBe(true);
  });
});

// ─── P5: свитч ───
describe('P5 tidSwitch', () => {
  it('без флага — rationale без свитча', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12 });
    expect(c.rationale.join(' ')).not.toContain('PYR→POL');
  });
  it('с флагом: 2-я половина без MISS + rationale + объём ±20%', () => {
    const base = buildCardioCycle({ goal: 'cut', totalWeeks: 12 });
    const sw = buildCardioCycle({ goal: 'cut', totalWeeks: 12, tidSwitchWeek: 7 });
    expect(sw.rationale.join(' ')).toContain('PYR→POL');
    const late = sw.weeks.filter(w => w.week >= 7 && !w.deload && !w.taper);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every(w => !w.sessions.some(s => s.type === 'miss'))).toBe(true);
    const mins = (c: CardioCycle) => c.weeks.reduce((s, w) => s + w.totalMinutes, 0);
    const ratio = mins(sw) / mins(base);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.2);
  });
});

// ─── P6: предиктор + durability + чек-лист ───
describe('P6 predictor/durability/checklist', () => {
  it('Riegel: монотонность 5К<10К<half<marathon', () => {
    const p = predictRaceTimes(10, 2700)!;
    expect(p.map(x => x.label)).toEqual(['5 км', '10 км', 'Полумарафон', 'Марафон']);
    for (let i = 1; i < p.length; i++) expect(p[i].timeSec).toBeGreaterThan(p[i - 1].timeSec);
    expect(p[1].timeSec).toBe(2700);
  });
  it('мусор → null + нота-предупреждение', () => {
    expect(predictRaceTimes(NaN, 100)).toBeNull();
    expect(predictRaceTimes(10, -5)).toBeNull();
    expect(predictorNote()).toContain('не обещание');
  });
  it('чек-лист: 5 пунктов', () => {
    expect(RACE_WEEK_CHECKLIST.length).toBe(5);
  });
  it('durability: без флага — нет длинной; с флагом — есть при ≥150 мин', () => {
    const off = buildCardioCycle({ goal: 'cut', totalWeeks: 12 });
    expect(off.weeks.every(w => !w.sessions.some(s => s.purpose.includes('Durability')))).toBe(true);
    const on = buildCardioCycle({ goal: 'cut', totalWeeks: 12, durabilitySession: true });
    const withLong = on.weeks.filter(w => w.sessions.some(s => s.purpose.includes('Durability')));
    expect(withLong.length).toBeGreaterThan(0);
    for (const w of withLong) expect(w.totalMinutes).toBeGreaterThanOrEqual(100);
  });
  it('ICS taper содержит чек-лист', () => {
    const c = buildCardioCycle({
      goal: 'cut', totalWeeks: 8,
      competitions: [{ id: 'r1', name: 'Старт', week: 8 }],
    });
    const ics = buildCardioIcs(c, '2026-01-05');
    expect(ics).toContain('Чек-лист гоночной недели');
  });
});

// ─── P7: фьюлинг + акклиматизация ───
describe('P7 fueling/acclimation', () => {
  it('<60′ — нули честно', () => {
    const f = fuelingForSession(45);
    expect(f.carbsGTotal).toBe(0);
    expect(f.sodiumMgTotal).toBe(0);
  });
  it('60–90′ — только вода', () => {
    const f = fuelingForSession(75);
    expect(f.waterMlTotal).toBeGreaterThan(0);
    expect(f.carbsGTotal).toBe(0);
  });
  it('>90′ — вода + Na + угли с капом 60 г/ч', () => {
    const f = fuelingForSession(120);
    expect(f.carbsGPerHour).toBeLessThanOrEqual(60);
    expect(f.sodiumMgTotal).toBeGreaterThan(0);
    expect(f.carbsGTotal).toBeGreaterThan(0);
  });
  it('акклиматизация: <28 → null; ≥28 → 12 дней с гейтом HIIT', () => {
    expect(heatAcclimationPlan(20)).toBeNull();
    const plan = heatAcclimationPlan(30)!;
    expect(plan.length).toBe(12);
    expect(plan.slice(0, 4).every(d => d.mode === 'z2_short')).toBe(true);
    expect(plan[11].mode).toBe('full');
  });
  it('высота: ≤1000 → null; выше → нота', () => {
    expect(altitudeNote(500)).toBeNull();
    expect(altitudeNote(2000)).toContain('Z2/recovery');
  });
  it('сборка: длинные сессии несут фьюлинг в purpose', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const longs = c.weeks.flatMap(w => w.sessions.filter(s => s.durationMin >= 60));
    if (longs.length > 0) {
      expect(longs.every(s => s.purpose.includes('Фьюлинг'))).toBe(true);
    }
  });
  it('сборка в жару: rationale с акклиматизацией', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, tempC: 30 });
    expect(c.rationale.join(' ')).toContain('Акклиматизация');
  });
});
