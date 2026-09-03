import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { applyArmPro } from '../arm-pro-integration.engine';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 4,
};

describe('arm-pro-integration (A–J сквозной)', () => {
  it('база без PRO-полей — без PRO-строк, валиден', () => {
    const p: any = buildArmPlan({ ...BASE });
    expect(p.rationale.join(' ')).not.toMatch(/WAF/);
    expect((p.safetyWarnings || []).length).toBe(0);
    const v = validateArmPlan(p, 'intermediate');
    expect(v.mrvOverflow || []).toEqual([]);
  });
  it('WAF-карточка + малый запас → warning', () => {
    const p: any = buildArmPlan({ ...BASE, bodyWeightKg: 84.5, ageYears: 30, arm: 'both', sex: 'male' });
    expect(p.rationale.join(' ')).toMatch(/WAF senior/);
    expect(p.rationale.join(' ')).toMatch(/кат\. 85/);
    expect(p.safetyWarnings.join(' ')).toMatch(/запас/);
  });
  it('билатеральная строка при L/R', () => {
    const p: any = buildArmPlan({ ...BASE, leftKg: 80, rightKg: 100 });
    expect(p.rationale.join(' ')).toMatch(/L\/R/);
    expect(p.safetyWarnings.join(' ')).toMatch(/Асимметрия 20%/);
  });
  it('бенчи задают веса (вместо default-30)', () => {
    const p: any = buildArmPlan({ ...BASE, bench: { wristCurlLb: 100, rtKg: 80 } });
    const wrist = p.weeks[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.muscle === 'wrist_flexors');
    expect(wrist).toBeTruthy();
    // 100lb=45.4кг × 0.82 (тяж) ≈ 37.2 — далеко от default 30×0.82=24.6
    expect(wrist.workSets[0].weight).toBeGreaterThan(30);
    expect(p.rationale.join(' ')).toMatch(/Бенчи/);
  });
  it('дневник с болью режет объём и переводит side/pron в технику', () => {
    const clean: any = buildArmPlan({ ...BASE });
    const pain: any = buildArmPlan({
      ...BASE,
      diary: [{ dateIso: '2026-09-01', srpe: 9, elbowPain: 6 }],
    });
    const vol = (pl: any) =>
      pl.weeks[0].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + e.sets, 0), 0);
    expect(vol(pain)).toBeLessThan(vol(clean));
    expect(pain.rationale.join(' ')).toMatch(/Дневник/);
    expect(pain.safetyWarnings.join(' ')).toMatch(/Авторегуляция/);
  });
  it('спарринг 100% в делоад — запрет', () => {
    const pro = applyArmPro({ ...BASE, sparring: { intensityPct: 100, partnerDeltaKg: 0 }, diary: [{ dateIso: '2026-09-01', srpe: 9 }] } as any);
    // diary-sRPE не запрещает спарринг сам по себе; делоад запрещает:
    const pro2 = applyArmPro({ ...BASE, sparring: { intensityPct: 100, partnerDeltaKg: 0 } } as any);
    expect(pro2.sparringLine).toMatch(/допущен/);
    expect(pro.warnings.join(' ')).toMatch(/Авторегуляция/);
  });
  it('суперматч + ремень + видео + сгонка строки', () => {
    const p: any = buildArmPlan({
      ...BASE,
      supermatch: true,
      strapExpected: true,
      competitionDateIso: '2026-10-15',
      targetWeightKg: 85,
      bodyWeightKg: 87,
      sex: 'male',
      trackCsv: 't,x,y\n0,4,8\n0.1,6,7\n0.2,8,6\n0.3,10,5',
    });
    const all = p.rationale.join(' ');
    expect(all).toMatch(/Суперматч/);
    expect(all).toMatch(/Ремень/);
    expect(all).toMatch(/До старта/);
    expect(all).toMatch(/Видео/);
  });
  it('TableTech содержит radial+thumb (эпик F)', () => {
    const p: any = buildArmPlan({ ...BASE });
    const tech = p.weeks[0].sessions.find((s: any) => s.sessionTag === 'TableTech');
    expect(tech).toBeTruthy();
    const muscles = tech.exercises.map((e: any) => e.muscle);
    expect(muscles).toContain('radial_deviators');
    expect(muscles).toContain('thumb');
  });
  it('валидатор: radial-warning и taper-side-warning только warnings', () => {
    const p: any = buildArmPlan({ ...BASE, patternId: 'arm_2_table_support', weeks: 1 });
    const v = validateArmPlan(p, 'intermediate');
    expect(v.valid).toBe(true);
  });
});
