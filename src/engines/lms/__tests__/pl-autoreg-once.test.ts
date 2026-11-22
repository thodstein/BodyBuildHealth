/**
 * pl-autoreg-once.test.ts — P0-4 / P1-7: авторегуляция применяется РОВНО ОДИН РАЗ.
 *
 * Аудит 2026-11: режим «🤖 Авто» применял множители и в билдере, и в слое правок
 * (`applyPLEffectiveOverlay`) — заявленные −10 % превращались в −19 %, подходы и
 * RIR резались дважды, а «🔄 Обновить прикиды»/сезон откатывали поправку.
 *
 * Контракт после фикса:
 *  1. единственная точка применения — билдер/тапер, план помечается `autoRegApplied`;
 *  2. множитель тапер-недель = конфиг (не конфиг²), база попыток — немасштабированный
 *     `attemptPmRow`, множитель хранится отдельно (`attemptAutoRegMult`);
 *  3. сезон и «Обновить прикиды» сохраняют масштаб.
 */
import { describe, it, expect } from 'vitest';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { appendPLTaperWeeks, buildLMSPlan, refreshMeetAttempts, type LMSBuildOutput } from '../lms-builder.engine';
import { buildPLSeasonPeaks } from '../lms-macro-taper.engine';
import {
  plAutoRegPayload,
  parsePLAutoRegCfg,
  samePLAutoReg,
} from '../../../ui/screens/SRCBBScreen_parts/pl-autoreg-cfg';

const tpl = CYCLE_01;
const pmMap = { Присед: 120, 'Жим лежа': 100, 'Становая тяга': 140 };
const M = 0.9;
const AR = { topSetPctMultiplier: M, volumeMultiplier: 1, rirShift: 1, deload: false };

function build(withAr: boolean): LMSBuildOutput {
  return buildLMSPlan({
    template: tpl,
    pmMap: { ...pmMap },
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride: 8,
    progressionEnabled: true,
    faithful: true,
    autoReg: withAr ? { ...AR } : undefined,
  });
}

const workSet = (out: LMSBuildOutput) => {
  for (const wk of out.weeks) {
    for (const d of wk.days) {
      for (const e of d.exercises) {
        const ws = e.workSets.find((s) => s.weight > 0 && s.pct > 0);
        if (ws) return { e, ws };
      }
    }
  }
  throw new Error('нет рабочих подходов');
};

const approx = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.35, Math.abs(b) * 0.01);

describe('P0-4: авторегуляция применяется один раз (билдер)', () => {
  it('план помечается autoRegApplied, без конфига — нет метки', () => {
    expect(build(true).autoRegApplied).toEqual(AR);
    expect(build(false).autoRegApplied).toBeUndefined();
  });

  it('m=0.9 → вес ровно −10 %, а не −19 %', () => {
    const off = workSet(build(false));
    const on = workSet(build(true));
    expect(on.e.name).toBe(off.e.name);
    expect(approx(on.ws.weight, off.ws.weight * M)).toBe(true);
    // Двойное применение дало бы −19 %; убеждаемся, что этой ошибки нет.
    expect(on.ws.weight).toBeGreaterThan(off.ws.weight * M * 0.95);
  });

  it('RIR-сдвиг применяется один раз (+1, а не +2)', () => {
    const off = workSet(build(false));
    const on = workSet(build(true));
    const rirOf = (out: LMSBuildOutput, name: string) => {
      for (const wk of out.weeks)
        for (const d of wk.days)
          for (const e of d.exercises)
            if (e.name === name) {
              const ws = e.workSets.find((s) => s.weight > 0 && s.pct > 0);
              if (ws) return ws.rir ?? 0;
            }
      return 0;
    };
    // Внутри одной сборки RIR уже окончательный: сравниваем приращение к плану без АР.
    const delta = rirOf(build(true), on.e.name) - rirOf(build(false), off.e.name);
    expect(delta).toBeLessThanOrEqual(1);
  });

  it('P3: faithful:false — множитель топ-сета не применяется дважды', () => {
    const mk = (withAr: boolean) =>
      buildLMSPlan({
        template: tpl,
        pmMap: { ...pmMap },
        fallbackPm: 80,
        mode: 'natural',
        weeksOverride: 8,
        progressionEnabled: true,
        faithful: false,
        autoReg: withAr ? { ...AR } : undefined,
      });
    const off = workSet(mk(false));
    const on = workSet(mk(true));
    expect(on.e.name).toBe(off.e.name);
    // m=0.9 → −10 %; двойное применение дало бы −19 %.
    expect(approx(on.ws.weight, off.ws.weight * M)).toBe(true);
    expect(on.ws.weight).toBeGreaterThan(off.ws.weight * M * 0.95);
  });
});

describe('P0-4/P1-7: тапер-недели — множитель не накапливается', () => {
  const taperOpts = (withAr: boolean) => ({
    peakExit: { strategy: 'balanced' as const },
    autoReg: withAr ? { topSetPctMultiplier: M, volumeMultiplier: 1, rirShift: 1 } : undefined,
  });

  it('вес тапер-недели = ×m, а не ×m²', () => {
    const plain = appendPLTaperWeeks(build(false), 2, taperOpts(false));
    const scaled = appendPLTaperWeeks(build(true), 2, taperOpts(true));
    const lastIdx = plain.weeks.length - 1;
    const pick = (out: LMSBuildOutput) => {
      const wk = out.weeks[lastIdx];
      for (const d of wk.days)
        for (const e of d.exercises) {
          const ws = e.workSets.find((s) => s.weight > 0 && s.pct > 0);
          if (ws) return ws;
        }
      throw new Error('нет подходов в тапер-неделе');
    };
    const a = pick(plain);
    const b = pick(scaled);
    expect(approx(b.weight, a.weight * M)).toBe(true);
    expect(b.weight).toBeGreaterThan(a.weight * M * 0.95); // не ×0.81
  });

  it('базовые недели не пересобираются тапером (нет второго ×m)', () => {
    const base = build(true);
    const withTaper = appendPLTaperWeeks(base, 2, taperOpts(true));
    const w = (out: LMSBuildOutput) => workSet(out).ws.weight;
    expect(w(withTaper)).toBe(w(base));
  });

  it('тапер-план тоже помечается autoRegApplied', () => {
    expect(appendPLTaperWeeks(build(true), 2, taperOpts(true)).autoRegApplied?.topSetPctMultiplier).toBe(M);
    expect(appendPLTaperWeeks(build(false), 2, taperOpts(false)).autoRegApplied).toBeUndefined();
  });

  it('прикиды тапера масштабированы, база `attemptPmRow` немасштабированная', () => {
    const out = appendPLTaperWeeks(build(true), 2, taperOpts(true));
    const wk = out.weeks.find((w) => w.meetAttempts);
    expect(wk?.attemptAutoRegMult).toBeCloseTo(M, 6);
    const plain = appendPLTaperWeeks(build(false), 2, taperOpts(false));
    const baseWk = plain.weeks.find((w) => w.meetAttempts);
    // Попытки округляются до шага блинов 2.5 кг, поэтому после ×0.9 — допуск 0.3 кг.
    expect(Math.abs(wk!.meetAttempts!.lifts[0].opener - baseWk!.meetAttempts!.lifts[0].opener * M)).toBeLessThan(0.3);
    // База попыток — та же, что у плана без АР (множитель живёт отдельным полем).
    expect(wk!.attemptPmRow).toEqual(baseWk!.attemptPmRow);
  });
});

describe('P1-7: «Обновить прикиды» сохраняет масштаб авторегуляции', () => {
  it('refreshMeetAttempts(strategy) = свежий тапер × m', () => {
    const arPlan = appendPLTaperWeeks(build(true), 2, {
      peakExit: { strategy: 'conservative' },
      autoReg: { topSetPctMultiplier: M, volumeMultiplier: 1, rirShift: 0 },
    });
    const refreshed = refreshMeetAttempts(arPlan, 'aggressive');
    const fresh = appendPLTaperWeeks(build(false), 2, { peakExit: { strategy: 'aggressive' } });
    const liftOf = (out: LMSBuildOutput) => out.weeks.find((w) => w.meetAttempts)!.meetAttempts!.lifts[0];
    // Обе стороны округлены до 2.5 кг, поэтому сравниваем в пределах шага блинов.
    expect(Math.abs(liftOf(refreshed).opener - liftOf(fresh).opener * M)).toBeLessThan(0.3);
    expect(refreshed.weeks.find((w) => w.meetAttempts)!.attemptAutoRegMult).toBeCloseTo(M, 6);
  });
});

describe('P1-7: сезонный путь сохраняет масштаб попыток', () => {
  const meets = [{ id: 'm1', name: 'Чемпионат', weeksToStart: 5 }];

  it('autoRegMult применяется к попыткам соревнований ровно один раз', () => {
    const base = build(true);
    const seasonAr = buildPLSeasonPeaks(base.weeks, meets, {
      strategy: 'balanced',
      windowWeeks: 3,
      autoRegMult: M,
    });
    const seasonPlain = buildPLSeasonPeaks(build(false).weeks, meets, {
      strategy: 'balanced',
      windowWeeks: 3,
      autoRegMult: 1,
    });
    const liftOf = (weeks: { meetAttempts?: { lifts: { opener: number }[] } }[]) =>
      weeks.find((w) => w.meetAttempts?.lifts?.length)!.meetAttempts!.lifts[0].opener;
    expect(Math.abs(liftOf(seasonAr.weeks) - liftOf(seasonPlain.weeks) * M)).toBeLessThan(0.3);
  });

  it('без множителя сезон ведёт себя как раньше (множитель 1)', () => {
    const season = buildPLSeasonPeaks(build(false).weeks, meets, { strategy: 'balanced', windowWeeks: 3 });
    const plain = buildPLSeasonPeaks(build(false).weeks, meets, {
      strategy: 'balanced',
      windowWeeks: 3,
      autoRegMult: 1,
    });
    expect(JSON.stringify(season.weeks)).toBe(JSON.stringify(plain.weeks));
  });
});

describe('pl-autoreg-cfg: разбор/сравнение конфига «по кнопке»', () => {
  it('payload содержит поля движка и не тащит appliedAt', () => {
    const payload = plAutoRegPayload({ ...AR, appliedAt: '2026-11-22T10:00:00.000Z' });
    expect(payload).toEqual(AR);
    expect(plAutoRegPayload(null)).toBeUndefined();
  });

  it('битые сохранённые данные → null (конфиг не применяется)', () => {
    expect(parsePLAutoRegCfg(null)).toBeNull();
    expect(parsePLAutoRegCfg({ topSetPctMultiplier: 'x' })).toBeNull();
    expect(parsePLAutoRegCfg({ topSetPctMultiplier: 0, volumeMultiplier: 1, rirShift: 0 })).toBeNull();
  });

  it('валидный конфиг читается и клипается в разумные рамки', () => {
    const cfg = parsePLAutoRegCfg({ topSetPctMultiplier: 9, volumeMultiplier: 0.05, rirShift: 9, deload: true });
    expect(cfg).not.toBeNull();
    expect(cfg!.topSetPctMultiplier).toBeLessThanOrEqual(1.2);
    expect(cfg!.volumeMultiplier).toBeGreaterThanOrEqual(0.2);
    expect(cfg!.rirShift).toBe(6);
    expect(cfg!.deload).toBe(true);
  });

  it('samePLAutoReg: одинаковые множители = «уже применено»', () => {
    expect(samePLAutoReg({ ...AR, appliedAt: '' }, AR)).toBe(true);
    expect(samePLAutoReg({ ...AR, appliedAt: '' }, { ...AR, topSetPctMultiplier: 0.95 })).toBe(false);
    expect(samePLAutoReg(null, AR)).toBe(false);
  });
});
