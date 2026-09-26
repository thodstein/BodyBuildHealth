import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fightEnergyProfile,
  FIGHT_ENERGY_3X3,
  disciplineProfile,
  STRIKING_PROFILE,
  GRAPPLING_PROFILE,
  INTERVAL_VS_SINGLE,
  CUT_WARN_PCT,
  CUT_BLOCK_PCT,
  CUT_SOURCE,
  CUT_REJECTED_PLAN_THRESHOLD,
  cutRisk,
  WEIGHT_CYCLE_SIGNALS,
  weightCycleVerdict,
  SESSION_RPE_MINUTES,
  sessionRpeNote,
} from '../combat-science';

const SRC = join(process.cwd(), 'src/engines/combat');
const read = (f: string) => readFileSync(join(SRC, f), 'utf8');

/**
 * E7 — наука → константы.
 *
 * Ключевой контракт: числа не «по памяти», а из проверенных abstracts
 * (PubMed E-utilities, 2026-09). Source-guard ниже не даёт движкам
 * разъехаться с каноном.
 */
describe('E7.1 — профиль боя: вклад энергосистем', () => {
  it('до 3 мин АТФ-ФК доминирует над гликолитической (PMID 27736247)', () => {
    const p = fightEnergyProfile(2);
    expect(p.alactic).toBeGreaterThan(p.glycolytic);
    expect(p.source).toContain('27736247');
  });

  it('к 5 минутам окислительный вклад выходит на 70% (PMID 27736247)', () => {
    const p = fightEnergyProfile(5);
    expect(p.aerobic).toBeCloseTo(0.70, 2);
    expect(p.glycolytic).toBeCloseTo(0.08, 2);
    expect(p.alactic).toBeCloseTo(0.21, 2);
  });

  it('монотонность: аэробная доля растёт от 2 к 5 минутам, АТФ-ФК теряет лидерство', () => {
    const short = fightEnergyProfile(2);
    const long = fightEnergyProfile(5);
    expect(long.aerobic).toBeGreaterThan(short.aerobic);
    expect(short.alactic).toBeGreaterThan(long.alactic);
  });

  it('выше 5 мин данных нет — профиль НЕ экстраполируется (честная граница)', () => {
    // источник изучал 1-5 мин; 10-мин бой НЕ «должен» иметь другую кривую
    const five = fightEnergyProfile(5);
    const ten = fightEnergyProfile(10);
    expect(ten.aerobic).toBe(five.aerobic);
    expect(ten.alactic).toBe(five.alactic);
    expect(ten.source).toContain('27736247');
  });

  it('сумма долей = 1 в пределах округления публикации (не добиваем выдумкой)', () => {
    for (const m of [1, 2, 3, 4, 5, 6, 9, 12]) {
      const p = fightEnergyProfile(m);
      // 70+8+21 = 99 — это округление источника, а не ошибка
      expect(p.aerobic + p.alactic + p.glycolytic, `мин=${m}`).toBeCloseTo(p.total, 2);
      expect(p.total, `мин=${m}`).toBeGreaterThan(0.98);
      expect(p.total, `мин=${m}`).toBeLessThanOrEqual(1.01);
    }
  });

  it('бокс 3×3 — эталон PMID 35415997 (73/19/8, ЧСС>93%, лактат>15)', () => {
    expect(FIGHT_ENERGY_3X3.aerobic).toBeCloseTo(0.73, 2);
    expect(FIGHT_ENERGY_3X3.alactic).toBeCloseTo(0.19, 2);
    expect(FIGHT_ENERGY_3X3.glycolytic).toBeCloseTo(0.08, 2);
    expect(FIGHT_ENERGY_3X3.hrPct).toBeGreaterThan(90);
    // наблюдался диапазон 12-18 ммоль/л при пороге «>15»
    expect(FIGHT_ENERGY_3X3.lactate).toBeGreaterThanOrEqual(15);
    expect(FIGHT_ENERGY_3X3.lactate).toBeLessThanOrEqual(18);
    expect(FIGHT_ENERGY_3X3.source).toContain('35415997');
  });

  it('мусорные длительности не ломают профиль (0, undefined, 99)', () => {
    for (const bad of [0, -5, NaN as unknown as number, undefined as unknown as number, 99]) {
      const p = fightEnergyProfile(bad);
      expect(p.aerobic + p.alactic + p.glycolytic).toBeCloseTo(p.total, 2);
      expect(p.minutes).toBeGreaterThan(0);
    }
  });
});

describe('E7.2 — профиль дисциплины: ударка vs грэпплинг', () => {
  it('ударка: скорость в лёгких нагрузках выше силы (PMID 26993133)', () => {
    expect(STRIKING_PROFILE.velocity).toBeGreaterThan(STRIKING_PROFILE.maxStrength);
  });

  it('грэпплинг: максимальная сила доминирует (сдвиг всей кривой, PMID 26993133)', () => {
    expect(GRAPPLING_PROFILE.maxStrength).toBeGreaterThan(GRAPPLING_PROFILE.velocity);
    expect(GRAPPLING_PROFILE.maxStrength).toBeGreaterThan(0.8);
  });

  it('дисциплины распознаются по названиям; неизвестное → спектр единоборств', () => {
    expect(disciplineProfile('boxing').key).toBe('striking');
    expect(disciplineProfile('Кикбокс').key).toBe('striking');
    expect(disciplineProfile('тайский бокс').key).toBe('striking');
    expect(disciplineProfile('kickboxing').key).toBe('striking');
    expect(disciplineProfile('bjj').key).toBe('grappling');
    expect(disciplineProfile('вольная борьба').key).toBe('grappling');
    expect(disciplineProfile('дзюдо').key).toBe('grappling');
    // вольная борьба по-английски — тоже грэпплинг (регрессия поймана UI-тестом)
    expect(disciplineProfile('wrestling').key).toBe('grappling');
    expect(disciplineProfile('combat_sport').key).toBe('grappling');
    expect(disciplineProfile('что-то неведомое').key).toBe('mma');
    expect(disciplineProfile(null).key).toBe('mma');
  });

  it('профили в среднем по силе, грэпплингу тяжелее удара', () => {
    expect(GRAPPLING_PROFILE.maxStrength).toBeGreaterThan(STRIKING_PROFILE.maxStrength);
    expect(STRIKING_PROFILE.velocity).toBeGreaterThan(GRAPPLING_PROFILE.velocity);
    // длинная анаэробная работа решает в грэпплинге (26993133)
    expect(GRAPPLING_PROFILE.anaerobicEndurance).toBeGreaterThan(0.8);
  });

  it('интервальный формат — инструмент АТФ-ФК (PMID 38787849)', () => {
    expect(INTERVAL_VS_SINGLE.pcrHigher).toBe(true);
    expect(INTERVAL_VS_SINGLE.glycolyticHigher).toBe(false);
    expect(INTERVAL_VS_SINGLE.source).toContain('38787849');
  });
});

describe('E7.3 — пороги сгона (проверенный источник вместо «ISSN»)', () => {
  it('5% — предупреждение, 8% — блок сборки', () => {
    expect(CUT_WARN_PCT).toBeCloseTo(0.05, 3);
    expect(CUT_BLOCK_PCT).toBeCloseTo(0.08, 3);
    expect(CUT_SOURCE).toContain('40266645');
  });

  it('непроверяемый порог из плана честно помечен как отклонённый', () => {
    expect(CUT_REJECTED_PLAN_THRESHOLD).toMatch(/не верифицируется|не используется/);
  });

  it('корпус: 3 кг при 80 кг — ок; 5 кг — предупреждение; 7 кг — блок', () => {
    expect(cutRisk(3, 80).level).toBe('ok');
    const warn = cutRisk(5, 80);
    expect(warn.level).toBe('caution');
    expect(warn.unsafe).toBe(true);
    expect(warn.blocksBuild).toBe(false);
    const block = cutRisk(7, 80);
    expect(block.level).toBe('danger');
    expect(block.blocksBuild).toBe(true);
  });

  it('уровни строго возрастают вместе с долей сгона', () => {
    const rank = { ok: 0, caution: 1, danger: 2 } as const;
    let prev = -1;
    for (const kg of [1, 3, 4.5, 5, 6, 7, 10]) {
      const r = rank[cutRisk(kg, 80).level];
      expect(r, `${kg}кг`).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('без веса тела / без цели — не паникуем', () => {
    expect(cutRisk(5, 0).level).toBe('ok');
    expect(cutRisk(5, null).level).toBe('ok');
    expect(cutRisk(0, 80).level).toBe('ok');
    expect(cutRisk(5, undefined).unsafe).toBe(false);
  });

  it('для женщин добавляется отдельная оговорка (обзор: гормоны, РПП)', () => {
    expect(cutRisk(5, 80, 'female').note).toMatch(/женщин/i);
    expect(cutRisk(5, 80, 'male').note).toMatch(/тестостерона|кортизола/i);
  });

  it('каждое сообщение ссылается на источник', () => {
    for (const kg of [1, 5, 7]) expect(cutRisk(kg, 80).source).toContain('40266645');
  });
});

describe('E7.4 — сигналы весовых качелей (PMID 40443978)', () => {
  it('константы взяты из наблюдавшегося кейса', () => {
    expect(WEIGHT_CYCLE_SIGNALS.rmrDropKcalPerDay).toBe(253);
    expect(WEIGHT_CYCLE_SIGNALS.powerDropPct).toBe(27);
    expect(WEIGHT_CYCLE_SIGNALS.source).toContain('40443978');
  });

  it('просадка РМР и мощности → danger с объяснением', () => {
    const v = weightCycleVerdict({ rmrDelta: -300, powerDeltaPct: -30 });
    expect(v.level).toBe('danger');
    expect(v.signals.length).toBeGreaterThanOrEqual(2);
    expect(v.signals.join(' ')).toMatch(/РМР|мощност/);
  });

  it('потеря безжировой массы без других сигналов → watch, не danger', () => {
    const v = weightCycleVerdict({ ffmDeltaKg: -2 });
    expect(v.level).toBe('watch');
  });

  it('пустые данные честно просят внести показатели, а не «всё хорошо»', () => {
    const v = weightCycleVerdict({});
    expect(v.level).toBe('ok');
    expect(v.signals[0]).toMatch(/недостаточно/);
  });

  it('малые колебания не считаются тревожными', () => {
    expect(weightCycleVerdict({ rmrDelta: -30, powerDeltaPct: -3 }).level).toBe('ok');
  });
});

describe('E7.5 — session-RPE: 10 минут достаточно (PMID 24570606)', () => {
  it('тайминг 10 минут', () => {
    expect(SESSION_RPE_MINUTES).toBe(10);
  });

  it('подсказка называет тайминг и честно различает виды спорта', () => {
    const strike = sessionRpeNote('boxing');
    const grap = sessionRpeNote('bjj');
    expect(strike).toContain('10 мин');
    expect(strike).toMatch(/0\.81/);
    expect(grap).toMatch(/0\.53/);
  });

  it('неизвестный вид → диапазон, а не выдуманное число', () => {
    expect(sessionRpeNote('хз')).toMatch(/0\.53-0\.81/);
  });
});

describe('E7 — source-guard: движки не разъезжаются с каноном', () => {
  it('builder режет сгон на 5% (не на другое число)', () => {
    const s = read('combat-builder.engine.ts');
    expect(s).toMatch(/pct\s*>\s*0\.05/);
  });

  it('safety блокирует сборку на 8%', () => {
    const s = read('combat-safety.engine.ts');
    expect(s).toMatch(/pct\s*>\s*0\.08/);
  });

  it('канон и движки используют ОДНО значение — расхождения быть не может', () => {
    const builder = read('combat-builder.engine.ts');
    const safety = read('combat-safety.engine.ts');
    // пороги канона обязаны встречаться в обоих движках
    expect(builder).toContain('0.05');
    expect(safety).toContain('0.08');
    expect(CUT_WARN_PCT).toBeCloseTo(0.05, 3);
    expect(CUT_BLOCK_PCT).toBeCloseTo(0.08, 3);
  });

  it('непроверяемый порог плана НЕ внедрён в движок', () => {
    const all = read('combat-builder.engine.ts') + read('combat-safety.engine.ts') + read('combat-weight-cut.engine.ts');
    // 12-15% в коде нет — только 5/8
    expect(all).not.toMatch(/0\.1[25]\b/);
  });
});
