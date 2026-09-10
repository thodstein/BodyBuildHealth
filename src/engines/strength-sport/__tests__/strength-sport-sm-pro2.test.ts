import { describe, it, expect } from 'vitest';
import {
  logDiameterClass, scaleLogAttempt, scaleLogVbtThreshold, logDiameterNote,
} from '../strength-sport-sm-log-diameter.engine';
import {
  diagnoseYokeRomForSex, diagnoseStoneSecondPullForSex, resolveAthleteSex, athleteSexLabel,
} from '../strength-sport-sm-sex-norms.engine';
import { diagnoseStonePhaseTiming, diagnoseCarrySplits } from '../strength-sport-sm-phase-timing.engine';
import { scoreSMBicepsRisk } from '../strength-sport-sm-biceps-risk.engine';
import { diagnoseSMHoldEvent } from '../strength-sport-sm-hold-event.engine';
import { buildSMFormatPlan } from '../strength-sport-sm-format-attempts.engine';
import { smAutoAnglesFromCsv } from '../strength-sport-sm-auto-angles.engine';

describe('SM PRO2 P1 диаметр лога (Renals 2018)', () => {
  it('классы по см', () => {
    expect(logDiameterClass(25)).toBe('small');
    expect(logDiameterClass(28)).toBe('standard');
    expect(logDiameterClass(32)).toBe('large');
    expect(logDiameterClass(null)).toBeNull();
    expect(logDiameterClass(0)).toBeNull();
  });
  it('малый лог даёт попытку выше большого при том же 1ПМ', () => {
    const small = scaleLogAttempt(100, 25);
    const large = scaleLogAttempt(100, 32);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(small as number).toBeGreaterThan(large as number);
    expect(small).toBe(103);
    expect(large).toBe(97);
  });
  it('стандарт без сдвига, пусто — null', () => {
    expect(scaleLogAttempt(100, 28)).toBe(100);
    expect(scaleLogAttempt(100, null)).toBeNull();
    expect(scaleLogVbtThreshold(0.32, 25)).toBeGreaterThan(0.32);
    expect(scaleLogVbtThreshold(0.32, 32)).toBeLessThan(0.32);
    expect(logDiameterNote(null)).toBeNull();
    expect(logDiameterNote(32)).toContain('Большой');
  });
});

describe('SM PRO2 P2 половые нормы (Hindle 2021)', () => {
  it('hip ROM 28°: мужчина warn, женщина ok', () => {
    const m = diagnoseYokeRomForSex(28, 50, 'male');
    const f = diagnoseYokeRomForSex(28, 50, 'female');
    expect(m?.verdict).toBe('warn');
    expect(f?.verdict).toBe('ok');
    expect(f?.lines.join(' ')).toContain('Hindle');
  });
  it('2-я тяга 3.2 с: мужчина ok, женщина warn', () => {
    expect(diagnoseStoneSecondPullForSex(3.2, 'male')?.verdict).toBe('ok');
    expect(diagnoseStoneSecondPullForSex(3.2, 'female')?.verdict).toBe('warn');
    expect(diagnoseStoneSecondPullForSex(null, 'male')).toBeNull();
  });
  it('пол: явный приоритетнее профиля', () => {
    expect(resolveAthleteSex('female', 'male')).toBe('female');
    expect(resolveAthleteSex('', 'мужской')).toBe('male');
    expect(resolveAthleteSex('', '')).toBeNull();
    expect(athleteSexLabel(null)).toContain('Не указан');
  });
});

describe('SM PRO2 P3 пофазный тайминг', () => {
  it('камень: затянутая 1-я тяга → слабая фаза pull1', () => {
    const r = diagnoseStonePhaseTiming({ pull1S: 5, lapS: 1.5, pull2S: 2.5 });
    expect(r?.weakPhase).toBe('pull1');
    expect(r?.verdict).toBe('warn');
    expect(r?.lines.join(' ')).toContain('RDL');
  });
  it('камень: всё в норме → ok, пусто → null', () => {
    expect(diagnoseStonePhaseTiming({ pull1S: 2, lapS: 1.5, pull2S: 2.5 })?.verdict).toBe('ok');
    expect(diagnoseStonePhaseTiming({})).toBeNull();
  });
  it('переноски: пик в середине → слабый разгон', () => {
    const r = diagnoseCarrySplits([7, 5, 6]);
    expect(r?.peakSegment).toBe(2);
    expect(r?.verdict).toBe('warn');
    expect(r?.lines.join(' ')).toContain('разгон');
  });
  it('переноски: пик поздно → ok; затухание → critical', () => {
    expect(diagnoseCarrySplits([7, 6, 5])?.verdict).toBe('ok');
    expect(diagnoseCarrySplits([5, 6, 7])?.verdict).toBe('critical');
    expect(diagnoseCarrySplits([5, null, 7])).toBeNull();
  });
});

describe('SM PRO2 P4 риск бицепса', () => {
  it('камень + разнохват + 95% → high + гейт', () => {
    const r = scoreSMBicepsRisk({ stonePlanned: true, mixedGrip: true, intensityPct: 95 });
    expect(r.level).toBe('high');
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.gate?.blockSupinated).toBe(true);
    expect(r.gate?.allowOnly).toContain('straps');
  });
  it('пусто → low 0; умеренная зона', () => {
    expect(scoreSMBicepsRisk({}).score).toBe(0);
    expect(scoreSMBicepsRisk({}).level).toBe('low');
    const mid = scoreSMBicepsRisk({ mixedGrip: true, historyBiceps: true });
    expect(mid.level).toBe('moderate');
    expect(mid.gate).toBeNull();
    expect(mid.score).toBeLessThanOrEqual(100);
  });
});

describe('SM PRO2 P5 холд под ивент', () => {
  it('геркулес 20 с @160 → провал с коррекцией', () => {
    const r = diagnoseSMHoldEvent({ herculesSec: 20, herculesKg: 160 });
    expect(r?.verdict).toBe('critical');
    expect(r?.lines.join(' ')).toContain('фермер');
  });
  it('геркулес 90 с → элита; пусто → null', () => {
    expect(diagnoseSMHoldEvent({ herculesSec: 90, herculesKg: 160 })?.verdict).toBe('ok');
    expect(diagnoseSMHoldEvent({})).toBeNull();
  });
  it('медли: 2 падения → critical', () => {
    expect(diagnoseSMHoldEvent({ medleyDrops: 2 })?.verdict).toBe('critical');
    expect(diagnoseSMHoldEvent({ medleyDrops: 0 })?.verdict).toBe('ok');
  });
});

describe('SM PRO2 P6 попытки под формат', () => {
  it('макс 100 balanced → 87.5/95/100 (шаг 2.5)', () => {
    const r = buildSMFormatPlan({ format: 'max', pmKg: 100, strategy: 'balanced' });
    expect(r?.attemptsKg).toEqual([87.5, 95, 100]);
  });
  it('медли — килограммовых попыток нет, есть план', () => {
    const r = buildSMFormatPlan({ format: 'medley' });
    expect(r?.attemptsKg).toBeNull();
    expect(r?.lines.join(' ')).toContain('Медли');
    expect(buildSMFormatPlan({ format: 'max', pmKg: null })).toBeNull();
  });
  it('повторы — 85% без отказа; высота — шаги', () => {
    const reps = buildSMFormatPlan({ format: 'reps', pmKg: 100 });
    expect(reps?.lines.join(' ')).toContain('85%');
    const h = buildSMFormatPlan({ format: 'height', heightFromM: 4 });
    expect(h?.lines.join(' ')).toContain('4 м');
  });
});

describe('SM PRO2 P7 авто-углы из таблицы', () => {
  it('колено ROM 4° → провал йока', () => {
    const csv = 'время,таз,колено,голеностоп,плечо\n0.00,24,18,90,170\n0.03,25,22,88,172';
    const r = smAutoAnglesFromCsv(csv, 'yoke_walk');
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.verdict).not.toBe('ok');
      expect(r.lines.join(' ')).toContain('knee');
    }
  });
  it('нормальный проход → ok; мусор → честная ошибка', () => {
    const csv = 't,hip,knee,ankle,shoulder\n0.00,10,5,85,160\n0.03,20,25,88,165\n0.06,35,55,90,170';
    const r = smAutoAnglesFromCsv(csv, 'yoke_walk');
    expect(r.valid).toBe(true);
    const bad = smAutoAnglesFromCsv('hello world', 'yoke_walk');
    expect(bad.valid).toBe(false);
  });
  it('лог: плечо 140° → warn', () => {
    const csv = 't,hip,knee,ankle,shoulder\n0.00,20,25,88,138\n0.03,22,28,89,140';
    const r = smAutoAnglesFromCsv(csv, 'log_press');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.verdict).toBe('warn');
  });
});
