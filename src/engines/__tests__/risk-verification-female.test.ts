/**
 * risk-verification-female.test.ts — §6.2 аудита (docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md):
 * женские пороги верификации рисков (единый движок risk-verification.engine).
 * Мужской путь без sex — байт-в-байт прежний.
 */
import { describe, it, expect } from 'vitest';
import {
  VERIFICATION_SYSTEMS,
  markerStatus,
  thresholdText,
  markerThresholds,
  buildVerificationReport,
  buildVerificationText,
  buildVerificationCsv,
  buildVerificationHtml,
  type VerifMarker,
} from '../risk-verification.engine';

const findMarker = (systemId: string, mechId: string, code: string): VerifMarker => {
  const sys = VERIFICATION_SYSTEMS.find(s => s.id === systemId)!;
  return sys.mechanisms.find(m => m.id === mechId)!.markers.find(mk => mk.code === code)!;
};

describe('женские пороги маркеров (паритет с getMiFromLab)', () => {
  it('HCT: hem1 53% → m1 муж / m2 жен (♂ 51/54/58, ♀ 48/52/56)', () => {
    const m = findMarker('hematologic', 'hem1', 'HCT');
    expect(markerStatus(m, 53, 'male')).toBe(1);
    expect(markerStatus(m, 53, 'female')).toBe(2);
  });

  it('АЛТ/ГГТ: женский ULN 31 (70 Ед/л → m2)', () => {
    const alt = findMarker('hepatic', 'liv1', 'ALT');
    expect(markerStatus(alt, 70, 'male')).toBe(1);
    expect(markerStatus(alt, 70, 'female')).toBe(2);
    // ГГТ идёт по той же лестнице 1×/2×/3×ВГН (♂ 55/110/165, ♀ 31/62/93), без
    // отдельной женской 1.5×-ступени: 70 < 110 → у мужчины грань, ≥ 62 → у женщины m2.
    const ggt = findMarker('hepatic', 'liv2', 'GGT');
    expect(markerStatus(ggt, 70, 'male')).toBe(1);
    expect(markerStatus(ggt, 70, 'female')).toBe(2);
  });

  it('Креатинин: 125 мкмоль/л — у мужчины и у женщины m1 (♀ ВГН 97, дальше 130/200)', () => {
    const cr = findMarker('renal', 'ren1', 'CREAT');
    expect(markerStatus(cr, 125, 'male')).toBe(1);
    expect(markerStatus(cr, 125, 'female')).toBe(1);
    // Проход 126: женский ряд стал ВГН 97 · 130 · 200. До него вторая ступень
    // стояла на 110, третья — на 120, и 125 мкмоль/л у женщины читались как
    // m=3 «тяжело», хотя это лёгкое превышение её нормы.
    expect(markerStatus(cr, 100, 'female')).toBe(1);   // выше её ВГН 97
    expect(markerStatus(cr, 100, 'male')).toBe(0);     // ниже мужской ВГН 110
    expect(markerStatus(cr, 135, 'female')).toBe(2);
    expect(markerStatus(cr, 210, 'female')).toBe(3);
  });

  it('Пролактин: 30 нг/мл — муж m2, женщина m0 (♀ верх 800 мМЕ/л = 37.7)', () => {
    const prl = findMarker('cns', 'cns1', 'PRL');
    expect(markerStatus(prl, 30, 'male')).toBe(2);
    expect(markerStatus(prl, 30, 'female')).toBe(0);
    expect(markerStatus(prl, 45, 'female')).toBe(1);
    expect(markerStatus(prl, 75, 'female')).toBe(3);
  });

  it('Ферритин: 200 мкг/л — женщина m1 (цель 150), мужчина m0', () => {
    const fer = findMarker('cns', 'cns2', 'FERRITIN');
    expect(markerStatus(fer, 200, 'male')).toBe(0);
    expect(markerStatus(fer, 200, 'female')).toBe(1);
    expect(markerStatus(fer, 320, 'female')).toBe(2);
    expect(markerStatus(fer, 420, 'female')).toBe(3);
  });

  it('Тестостерон: направление инвертируется (высокий = вирилизация)', () => {
    const tt = findMarker('reproductive', 'rep2', 'TT');
    expect(markerStatus(tt, 7, 'male')).toBe(2);   // у мужчин низкий TT — плохо
    expect(markerStatus(tt, 7, 'female')).toBe(3); // у женщин высокий TT = вирилизация
    expect(markerStatus(tt, 3, 'female')).toBe(1);
  });

  it('E2: 100 пг/мл — муж m3 / жен m0 (физиология до ~200)', () => {
    const e2 = findMarker('reproductive', 'rep4', 'E2');
    expect(markerStatus(e2, 100, 'male')).toBe(3);
    expect(markerStatus(e2, 100, 'female')).toBe(0);
  });

  it('Мочевая кислота: 380 — у женщины уже m1, у мужчины m0 (♀ 350/400/450)', () => {
    const ua = findMarker('renal', 'ren1', 'URIC');
    expect(markerThresholds(ua, 'male')).toEqual([420, 480, 540]);
    expect(markerThresholds(ua, 'female')).toEqual([350, 400, 450]);
    expect(markerStatus(ua, 380, 'male')).toBe(0);
    expect(markerStatus(ua, 380, 'female')).toBe(1);
  });

  it('thresholdText показывает женские числа при sex=female', () => {
    const hct = findMarker('hematologic', 'hem1', 'HCT');
    expect(thresholdText(hct, 'male')).toBe('≥51 · ≥54 · ≥58');
    expect(thresholdText(hct, 'female')).toBe('≥48 · ≥52 · ≥56');
    expect(markerThresholds(hct, 'female')).toEqual([48, 52, 56]);
    // Один ряд на маркер: в cv4/cv5/hem1 те же числа, что в hem1.
    expect(markerThresholds(findMarker('cardio', 'cv5', 'HCT'), 'female')).toEqual([48, 52, 56]);
    expect(markerThresholds(findMarker('cardio', 'cv4', 'HCT'), 'male')).toEqual([51, 54, 58]);
  });
});

describe('женские floors верификации', () => {
  it('HCT 50: женский якорь срабатывает (≥48 риск 25), мужской — нет', () => {
    const fem = buildVerificationReport({ HCT: 50 }, 'female');
    const hemF = fem.systems.find(s => s.id === 'hematologic')!;
    expect(hemF.floorHits.length).toBe(1);
    expect(hemF.floorHits[0].risk).toBe(25);
    expect(buildVerificationReport({ HCT: 50 }, 'male').systems.find(s => s.id === 'hematologic')!.floorHits.length).toBe(0);
  });

  it('АЛТ 70: женский floor 62 риска 25, мужской — без floor', () => {
    const fem = buildVerificationReport({ ALT: 70 }, 'female');
    expect(fem.systems.find(s => s.id === 'hepatic')!.floorHits.some(f => f.code === 'ALT' && f.risk === 25)).toBe(true);
    expect(buildVerificationReport({ ALT: 70 }, 'male').systems.find(s => s.id === 'hepatic')!.floorHits.length).toBe(0);
  });

  it('TT > 6 — только женский floor вирилизации', () => {
    const fem = buildVerificationReport({ TT: 7 }, 'female');
    expect(fem.systems.find(s => s.id === 'reproductive')!.floorHits.some(f => f.code === 'TT')).toBe(true);
    expect(buildVerificationReport({ TT: 7 }, 'male').systems.find(s => s.id === 'reproductive')!.floorHits.length).toBe(0);
  });
});

describe('мужской путь байт-в-байт', () => {
  const labs = { LDL: 3.0, HCT: 50, ALT: 60, TT: 10, E2: 90, CREAT: 110, GGT: 60 };

  it('buildVerificationReport без sex === с sex=male', () => {
    expect(JSON.stringify(buildVerificationReport(labs))).toBe(JSON.stringify(buildVerificationReport(labs, 'male')));
  });

  it('текст без sex === текст с sex=male', () => {
    expect(buildVerificationText(labs)).toBe(buildVerificationText(labs, 'male'));
  });

  it('женский экспорт помечает пороги и отличается от мужского', () => {
    const fem = buildVerificationText(labs, 'female');
    expect(fem).toContain('♀ женские пороги');
    expect(fem).toContain('≥48 · ≥52 · ≥56');
    expect(fem).not.toBe(buildVerificationText(labs, 'male'));
    const html = buildVerificationHtml(labs, 'female');
    expect(html).toContain('женские пороги');
    const csv = buildVerificationCsv(labs, 'female');
    expect(csv).toContain('48;52;56');
  });
});
