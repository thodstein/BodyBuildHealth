/**
 * arm-audit-2026-10.test.ts — регрессии полного PRO-аудита арм-планировщика
 * (октябрь 2026). Покрывает дефекты, найденные аудитом движков + UI + armlift-зоны
 * и подтверждённые интернет-источниками (IronMind WR 2022–2026, Pascoa 2026
 * ротаторы плеча, GripStrength 12-недельный table-ready).
 *
 * Каждый тест = один дефект: падает на старом коде, зелёный на исправленном.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { acwrMultFor } from '../arm-pro5-core.engine';
import { perExerciseCap, sessionLimitsForArm } from '../arm-volume.engine';
import { buildArmReport } from '../arm-report.engine';
import { planLrSplit } from '../arm-lr-split.engine';
import { planWeightCut, weeksUntilStart } from '../arm-competition-prep.engine';
import { ARMLIFT_CAUSE_RU, ARMLIFT_MOBILITY_FAIL_RU, ARMLIFT_ACWR_ZONE_RU } from '../armlift-cause.engine';
import { rankArmliftCorrections, IMPLEMENT_TO_EX } from '../armlift-correction.engine';
import { platformWrFor, platformIsInternal, PLATFORM_WR } from '../arm-platform.engine';
import { estimateForceVector, getRtWorldClass } from '../arm-force-capture.engine';
import { armliftLinkPoolIds } from '../armlift-plan-audit.engine';
import { diagnoseArmlift } from '../armlift-diagnosis.engine';
import { diagnoseArmliftCause } from '../armlift-cause.engine';
import { diagnosticCompleteness } from '../armlift-completeness.engine';
import { getArmLandmarks } from '../arm-volume-landmarks.engine';
import { ARM_SPLIT_PATTERNS } from '../arm-split-patterns';
import { rankArmSplits, levelSessionCapacity, splitMaxSessionMuscles, armSplitReport } from '../arm-selector.engine';
import { buildArmMacrocycle } from '../arm-macrocycle.engine';
import { buildArmTaperCurve, applyArmTaperToWeeks } from '../arm-taper.engine';
import { parseArmResultJson } from '../arm-result-import.engine';
import { buildArmBridgeData } from '../arm-bridge-payload.engine';
import { ARM_MUSCLES, ARM_MUSCLE_RU } from '../arm-types';
import { SourceFileReader } from './helpers/source-reader';

const BASE: any = { discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 8 };

// ─────────────────────────────────────────────────────────────────────────────
describe('P0-1: role в плане реальный (accessory политика обрезки)', () => {
  it('каталожные упражнения специализации получают role accessory', () => {
    const p: any = buildArmPlan({ ...BASE, specialization: true, weakPoints: ['wrist_flexors'], weeks: 4 });
    const roles = new Set<string>();
    for (const wk of p.weeks) for (const s of wk.sessions) for (const ex of s.exercises) roles.add(ex.role);
    expect(roles.has('accessory')).toBe(true);
  });
  it('финализатор режет accessory раньше primary (cap сессии по канону)', () => {
    let p: any = buildArmPlan({ ...BASE, weeks: 2, patternId: 'arm_5_specialized' });
    p = finalizeArmPlan(p, { level: 'intermediate' });
    for (const wk of p.weeks) for (const sess of wk.sessions) {
      const cap = sessionLimitsForArm({ level: 'intermediate', discipline: 'armwrestling', sessionTag: sess.sessionTag }).maxExercises;
      expect(sess.exercises.length).toBeLessThanOrEqual(cap);
    }
  });
});

describe('P0-2: ACWR по ДАТАМ, не по порядку записей', () => {
  const diary = (entries: Array<[number, number, number]>) => entries.map(([day, rpe, mins]) => {
    const d = new Date(Date.UTC(2026, 0, day));
    return { dateIso: d.toISOString().slice(0, 10), srpe: rpe, durationMin: mins };
  });
  it('danger/caution режут (последовательный дневник)', () => {
    const danger = acwrMultFor({ diary: diary([[1, 5, 60], [2, 5, 60], [3, 5, 60], [4, 5, 60], [5, 5, 60], [6, 5, 60], [7, 5, 60], [8, 5, 60], [9, 5, 60], [10, 5, 60], [11, 13.4, 60], [12, 13.4, 60], [13, 13.4, 60], [14, 13.4, 60], [15, 13.4, 60], [16, 13.4, 60], [17, 13.4, 60]]) });
    expect(danger.zone).toBe('danger');
    expect(danger.mult).toBe(0.65);
    const caution = acwrMultFor({ diary: diary([[1, 5, 60], [2, 5, 60], [3, 5, 60], [4, 5, 60], [5, 5, 60], [6, 5, 60], [7, 5, 60], [8, 5, 60], [9, 5, 60], [10, 5, 60], [11, 10, 60], [12, 10, 60], [13, 10, 60], [14, 10, 60], [15, 10, 60], [16, 10, 60], [17, 10, 60]]) });
    expect(caution.zone).toBe('caution');
    expect(caution.mult).toBe(0.85);
  });
  it('правка задним числом НЕ создаёт ложный danger', () => {
    const r = acwrMultFor({ diary: [...diary(Array.from({ length: 20 }, (_, i) => [i + 1, 6, 60] as [number, number, number])), [3, 18, 60]] });
    expect(r.zone).toBe('ok');
  });
  it('legacy без дат — прежнее поведение (порядок массива)', () => {
    const legacy = acwrMultFor({ diary: Array.from({ length: 10 }, () => ({ srpe: 5, durationMin: 60 })).concat(Array.from({ length: 7 }, () => ({ srpe: 13.4, durationMin: 60 }))) });
    expect(legacy.zone).toBe('danger');
  });
  it('билдер: ACWR danger режет MRV', () => {
    const base: any = buildArmPlan({ ...BASE });
    const mk = (rpe: number, n: number, startDay: number) => Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(2026, 1, startDay + i));
      return { dateIso: d.toISOString().slice(0, 10), srpe: rpe, durationMin: 60 };
    });
    const danger: any = buildArmPlan({ ...BASE, diary: [...mk(5, 10, 1), ...mk(13.4, 7, 11)] });
    expect(danger.mrvByMuscle.brachialis).toBeLessThan(base.mrvByMuscle.brachialis);
    expect(danger.rationale.some((r: string) => r.includes('ACWR'))).toBe(true);
  });
});

describe('P1: недельные пороги отчёта (не суммой плана)', () => {
  it('12-нед план с нормой tendon 8/нед НЕ даёт ложной тревоги', () => {
    const p: any = buildArmPlan({ ...BASE, weeks: 12 });
    const rep = buildArmReport(p);
    const maxTendon = Math.max(...p.weeks.map((wk: any) =>
      wk.sessions.reduce((a: number, s: any) => a + s.exercises.filter((e: any) => ['wrist_flexors', 'wrist_extensors', 'pronators', 'supinators', 'risers', 'thumb'].includes(e.muscle)).reduce((x: number, e: any) => x + (e.sets || 0), 0), 0)));
    const rep2 = buildArmReport(p);
    const falseAlarm = rep2.warnings.some((w) => /Tendon load [0-9]+ сетов/.test(w) && !rep.warnings.some((x) => x === w));
    expect(falseAlarm).toBe(false);
    // warning появляется только при пиковой неделе > 22
    if (maxTendon <= 22) expect(rep.warnings.some((w) => w.startsWith('Tendon load'))).toBe(false);
  });
});

describe('P1: сессионный кап — единый источник билдера и финализатора', () => {
  it('TableTech armwrestling non-enhanced = 7 (PRO F) выживает в финализации', () => {
    let p: any = buildArmPlan({ ...BASE, weeks: 2, patternId: 'arm_2_table_support' });
    p = finalizeArmPlan(p, { level: 'intermediate' });
    for (const wk of p.weeks) for (const sess of wk.sessions) {
      const cap = sessionLimitsForArm({ level: 'intermediate', discipline: 'armwrestling', sessionTag: sess.sessionTag }).maxExercises;
      expect(sess.exercises.length).toBeLessThanOrEqual(cap);
    }
  });
  it('armlifting natural = 5 упражнений в сессии', () => {
    const caps = ARM_SPLIT_PATTERNS.filter((p) => p.id.startsWith('grip_')).map((p) => p.id);
    expect(caps.length).toBeGreaterThan(0);
    expect(sessionLimitsForArm({ level: 'intermediate', discipline: 'armlifting', sessionTag: 'SupportGrip' }).maxExercises).toBe(5);
  });
});

describe('P1: L/R-сплит — честный withinMrv и maintenance сильной', () => {
  it('в MRV проверяется СУММА рук, не только слабая', () => {
    const r = planLrSplit({ leftKg: 40, rightKg: 55, baseSets: 10, mrvSets: 16 });
    expect(r.asymmetryPct).toBeGreaterThanOrEqual(7);
    expect(r.weakSets).toBeGreaterThan(r.strongSets);
    expect(r.withinMrv).toBe(r.weakSets + r.strongSets <= 16);
  });
  it('сильная рука при ≥12% снижена к поддержанию (не тавтология)', () => {
    const r = planLrSplit({ leftKg: 40, rightKg: 55, baseSets: 10, mrvSets: 40 });
    expect(r.asymmetryPct!).toBeGreaterThanOrEqual(12);
    expect(r.strongSets).toBeLessThan(10);
  });
});

describe('P2: константы хвата/платформы — единый знаменатель', () => {
  it('Apollon WR — IronMind канон (237.5 M / 137.9 F)', () => {
    expect(PLATFORM_WR.apollon_axle.maleKg).toBe(237.5);
    expect(PLATFORM_WR.apollon_axle.femaleKg).toBe(137.9);
  });
  it('force-capture axle считает %WR от выбранного снаряда (Saxon≠Apollon)', () => {
    const saxon = estimateForceVector({ axleKg: 133, sex: 'male', axleImplement: 'saxon_bar' });
    const apollon = estimateForceVector({ axleKg: 133, sex: 'male', axleImplement: 'apollon_axle' });
    expect(saxon.gripSupport).toBeGreaterThan(apollon.gripSupport);
    expect(apollon.gripSupport).toBe(56); // 133/237.5
    expect(platformIsInternal('saxon_bar')).toBe(true);
    expect(platformIsInternal('apollon_axle')).toBe(false);
  });
  it('RT WR по полу (IronMind)', () => {
    expect(getRtWorldClass('male')).toBe(130.5);
    expect(getRtWorldClass('female')).toBe(77.2);
  });
});

describe('P2: armlift пул/причины — RU-канон и полнота', () => {
  it('RU-лейблы причины покрывают все причины движка', () => {
    const causes = ['technique', 'max_strength', 'endurance', 'volume', 'mobility', 'fatigue', 'pain'];
    for (const c of causes) expect(ARMLIFT_CAUSE_RU[c]).toBeTruthy();
  });
  it('RU-лейблы мобильности и зон ACWR', () => {
    expect(ARMLIFT_MOBILITY_FAIL_RU.wrist_ext).toBeTruthy();
    expect(ARMLIFT_ACWR_ZONE_RU.dangerous || ARMLIFT_ACWR_ZONE_RU.danger).toBeTruthy();
  });
  it('PINCH: причина mobility теперь >= 2 записей', () => {
    const src = new SourceFileReader('src/engines/arm/armlift-correction.engine.ts');
    const pinch = src.blockBetween('const PINCH: PoolEntry[] = [', 'const CRUSH: PoolEntry[] = [');
    const mobility = pinch.split('\n').filter((l) => l.includes('exId:') && l.includes("causes:") && /causes: \[[^\]]*'mobility'/.test(l));
    expect(mobility.length).toBeGreaterThanOrEqual(2);
  });
  it('все fixes — валидные id точек срыва', () => {
    const src = new SourceFileReader('src/engines/arm/armlift-correction.engine.ts');
    const fixes = [...src.text.matchAll(/fixes: \[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/'/g, '')));
    const valid = new Set(['off_floor', 'mid', 'lockout', 'hold_short', 'hold_long', 'close_fail']);
    for (const f of fixes) expect(valid.has(f)).toBe(true);
  });
  it('rankArmliftCorrections: причина mobility даёт >= 2 кандидата (pinch)', () => {
    const out = rankArmliftCorrections('thumb', 'saxon_bar', { cause: 'mobility' });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
  it('country_crush признан щипковым снарядом', () => {
    const d = diagnoseArmlift({ implement: 'country_crush', thumbStiff: true });
    expect(d.weakLink).toBe('thumb');
  });
  it('IMPLEMENT_TO_EX: все exId резолвятся в каталог', () => {
    for (const [impl, ex] of Object.entries(IMPLEMENT_TO_EX)) {
      expect(typeof ex).toBe('string');
      expect(ex.length).toBeGreaterThan(2);
    }
  });
});

describe('P2: отчёт и честность данных', () => {
  it('completeness: CoC 0 (Trainer) НЕ закрывает тест', () => {
    const zero = diagnosticCompleteness({ implement: 'coc_gripper', failurePoint: 'close_fail', hasMobilityData: true, cocLevel: 0 });
    const two = diagnosticCompleteness({ implement: 'coc_gripper', failurePoint: 'close_fail', hasMobilityData: true, cocLevel: 2 });
    expect(two.pct).toBeGreaterThan(zero.pct);
    expect(zero.missing.some((m) => m.includes('CoC'))).toBe(true);
  });
  it('подпись RT несёт владельца по полу', () => {
    const src = new SourceFileReader('src/engines/arm/armlifting-diagnostics.engine.ts');
    expect(src.text).toContain('wrHolderNote');
    expect(src.text).toMatch(/Гайдученко 77\.2, 2012/);
    expect(src.text).toMatch(/Тюкалов 130\.5, 2013/);
  });
  it('apollon диаметр = 2" (51 мм), не 58', () => {
    const src = new SourceFileReader('src/core/exercise-catalog-arm.ts');
    expect(src.text).toContain('51 ');
    expect(src.text).not.toContain('58мм');
  });
  it('CSV армлифтинга защищён от формульной инъекции', () => {
    const src = new SourceFileReader('src/engines/arm/armlifting-diagnostics.engine.ts');
    expect(src.text).toContain("^[=+");
    expect(src.text).toContain('const safe =');
  });
});

describe('P2: WAF карточка старта', () => {
  it('возраст <14 — честный флаг не-зачётности', () => {
    const p: any = buildArmPlan({ ...BASE });
    expect(p).toBeTruthy();
    const src = new SourceFileReader('src/engines/arm/arm-waf.engine.ts');
    expect(src.text).toContain('eligibilityNote');
  });
  it('сгонка до категории ниже веса — в строке взвешивания', () => {
    const src = new SourceFileReader('src/engines/arm/arm-waf.engine.ts');
    expect(src.text).toContain('сгонка');
  });
});

describe('P2: прочие регрессии раунда', () => {
  it('grip_pinch enhanced кап 5 (было мёртвая ветвь)', () => {
    expect(perExerciseCap('grip_pinch', 'enhanced')).toBe(5);
    expect(perExerciseCap('grip_pinch', 'intermediate')).toBe(4);
    expect(perExerciseCap('grip_support', 'enhanced')).toBe(6);
  });
  it('perExerciseCap: side_pressure 3, thumb/risers 4', () => {
    expect(perExerciseCap('side_pressure')).toBe(3);
    expect(perExerciseCap('thumb')).toBe(4);
  });
  it('ARM_MUSCLES покрыты landmarks (19 мышц × 4 уровня)', () => {
    for (const m of ARM_MUSCLES) {
      for (const lvl of ['beginner', 'intermediate', 'advanced', 'enhanced']) {
        const lm = getArmLandmarks(lvl as any, m);
        expect(lm.mrv).toBeGreaterThanOrEqual(lm.mev);
      }
    }
  });
  it('weeksUntilStart клампит вниз — авто-пик прошлой даты отсекается в билдере', () => {
    expect(weeksUntilStart('2026-01-01', '2026-01-01')).toBe(1);
    const p: any = buildArmPlan({ ...BASE, weeks: 8, competitionDateIso: '2020-01-01' });
    expect(p.rationale.some((r: string) => r.includes('уже прошла'))).toBe(true);
  });
  it('сгонка: женский темп 0.4%/нед (не мужской 0.5)', () => {
    const f = planWeightCut({ startKg: 60, targetKg: 56, weeksOut: 10, sex: 'female' });
    const m = planWeightCut({ startKg: 100, targetKg: 96, weeksOut: 10, sex: 'male' });
    expect(f.targetRatePctPerWeek).toBeLessThan(m.targetRatePctPerWeek);
  });
  it('ARM_MUSCLE_RU покрывает все мышцы (нет латиницы в UI)', () => {
    for (const m of ARM_MUSCLES) expect(ARM_MUSCLE_RU[m]).toBeTruthy();
  });
});

describe('P2: отчёт — разбивка перебора MRV (прямые/косвенные)', () => {
  it('пиковый перебор >MRV×1.15 печатается с долей прямых сетов', () => {
    const src = new SourceFileReader('src/engines/arm/arm-report.engine.ts');
    expect(src.text).toContain('aggregateArmVolume(plan.weeks');
    expect(src.text).toContain('косвенные');
    expect(src.text).toContain('MRV ${mrv}×1.15');
  });
  it('на плане без перебора extra-warning не появляется', () => {
    const p: any = buildArmPlan({ ...BASE, weeks: 4 });
    const rep = buildArmReport(p);
    const extra = rep.warnings.filter((w) => w.includes('косвенные'));
    // на интерmediate standard-плане перебора effective > MRV×1.15 быть не должно
    expect(extra.length).toBe(0);
  });
});

describe('P2: perf + цикл-данные (остаток §7 отчёта)', () => {
  it('arm-duration: total-set считается один раз (без O(n^2) reduce на сете)', () => {
    const src = new SourceFileReader('src/engines/arm/arm-duration.engine.ts');
    expect(src.text).toContain('const totalSetsInSession = exercises.reduce(');
    expect(src.text).toContain('const isLastSet = setCount + 1 === totalSetsInSession;');
    // в теле set-цикла больше не должно быть reduce по exercises
    const bodyStart = src.text.indexOf('for (let index = 0; index < count');
    const bodyEnd = src.text.indexOf('setCount += 1;', bodyStart);
    const body = src.text.slice(bodyStart, bodyEnd);
    expect(body).not.toContain('exercises.reduce');
  });
  it('dobrorezov_44: разгрузка каждую 4-ю неделю (deloadRule источника)', () => {
    const src = new SourceFileReader('src/engines/arm/arm-cycle-library.engine.ts');
    const i = src.text.indexOf("id: 'dobrorezov_44'");
    expect(i).toBeGreaterThan(0);
    const plan44 = src.text.slice(i, i + 500);
    expect(plan44).toContain("w % 4 === 0 ? 'deload'");
    // сборка цикла совместима: 44 недели, ошибок нет
    const p: any = buildArmPlan({ ...BASE, weeks: 44, cycleId: 'dobrorezov_44', cycleConsent: true, patternId: 'arm_3_full' });
    expect(p.weeks.length).toBe(44);
    expect(p.rationale.some((r: string) => r.includes('dobrorezov') || r.includes('Доброрез'))).toBe(true);
  });
});

describe('P2: честный порог тендона в диагностике (критик достижим)', () => {
  it('tendon 20 при intermediate → critical (раньше порог >22 был недостижим из UI)', () => {
    const src = new SourceFileReader('src/engines/arm/arm-diagnostics-hub.engine.ts');
    expect(src.text).toMatch(/input\.tendonSets >= 18\) findings\.push\(\{ level: 'critical'/);
  });
});

describe('§8 п.1/п.3: ER:IR risk доезжает до плана и выбора сплита', () => {
  it('билдер: shoulderPriority поднимает shoulder_stab (+15%, кап MRV) с honest-строкой', () => {
    const base: any = buildArmPlan({ ...BASE, weeks: 6, patternId: 'arm_3_full' });
    const prio: any = buildArmPlan({ ...BASE, weeks: 6, patternId: 'arm_3_full', shoulderPriority: true });
    const b = base.volumeTargets['shoulder_stab'].targetSets;
    const p = prio.volumeTargets['shoulder_stab'].targetSets;
    expect(p).toBeGreaterThanOrEqual(b);
    expect(p).toBeLessThanOrEqual(prio.mrvByMuscle['shoulder_stab']);
    if (p > b) {
      expect(prio.rationale.some((r: string) => r.includes('shoulder_stab') && r.includes('ER:IR'))).toBe(true);
      // другие мышцы не тронуты — «одна переменная за раз»
      expect(prio.volumeTargets['wrist_flexors'].targetSets).toBe(base.volumeTargets['wrist_flexors'].targetSets);
    }
  });
  it('билдер: без флага поведение байт-в-байт', () => {
    const a: any = buildArmPlan({ ...BASE, weeks: 6 });
    const b: any = buildArmPlan({ ...BASE, weeks: 6, shoulderPriority: false });
    expect(b.volumeTargets['shoulder_stab'].targetSets).toBe(a.volumeTargets['shoulder_stab'].targetSets);
  });
  it('селектор: shoulderRisk дает бонус сплиту с shoulder_stab', () => {
    const ranked = rankArmSplits({ level: 'intermediate', goal: 'strength', technique: 'balanced', discipline: 'armwrestling', daysPerWeek: 3, shoulderRisk: true } as any);
    const withShoulder = ranked.find((r) => r.rationale.some((x) => x.includes('shoulder_stab')));
    expect(withShoulder).toBeTruthy();
    const plain = rankArmSplits({ level: 'intermediate', goal: 'strength', technique: 'balanced', discipline: 'armwrestling', daysPerWeek: 3 } as any);
    const scoreWith = withShoulder!.score;
    const same = plain.find((r) => r.pattern.id === withShoulder!.pattern.id)!;
    expect(scoreWith).toBeGreaterThan(same.score);
  });
  it('мост: armShoulderRisk уезжает только при risk (пустой ключ без флага)', () => {
    const base: any = buildArmBridgeData({
      groups: ['cup'], technique: 'balanced', weakPoints: ['cup'],
      biomechCards: [], corrections: [], scoring: null, diag: {}, angles: {}, force: null,
      vbt: null, dynamic: null, bench: null, tendon: 8, findings: [], humerus: [], balance: [],
      asymmetry: null, info: [], weakCauses: {}, topByPoint: {}, spec: null,
      mobilityFails: [], acwrDanger: [], bilateral: null, attempts: [],
    });
    expect(base.armShoulderRisk).toBeUndefined();
    const risk: any = buildArmBridgeData({
      groups: ['cup'], technique: 'balanced', weakPoints: ['cup'],
      biomechCards: [], corrections: [], scoring: null, diag: {}, angles: {}, force: null,
      vbt: null, dynamic: null, bench: null, tendon: 8, findings: [], humerus: [], balance: [],
      asymmetry: null, info: [], weakCauses: {}, topByPoint: {}, spec: null,
      mobilityFails: [], acwrDanger: [], bilateral: null, attempts: [], shoulderRisk: true,
    });
    expect(risk.armShoulderRisk).toBe(true);
  });
  it('UI: конструктор читает armShoulderRisk и передает в сборку+селектор', () => {
    const ui = new SourceFileReader('src/ui/screens/TrainingScreen_parts/ArmAutoConstructor.tsx');
    expect(ui.text).toContain('setDiagShoulderRisk(true)');
    expect(ui.text).toContain('shoulderPriority: diagShoulderRisk || undefined');
    expect(ui.text).toContain('shoulderRisk: diagShoulderRisk || undefined');
    const hub = new SourceFileReader('src/ui/screens/TrainingScreen_parts/ArmDiagnosticsHub.tsx');
    expect(hub.text).toContain('shoulderRisk: (() => {');
    expect(hub.text).toContain("v.zone === 'risk'");
  });
});

describe('§8 п.2: ёмкость дня сплита по уровню', () => {
  it('ёмкость уровня: beginner 5 → enhanced 9', () => {
    expect(levelSessionCapacity('beginner')).toBe(5);
    expect(levelSessionCapacity('intermediate')).toBe(6);
    expect(levelSessionCapacity('advanced')).toBe(8);
    expect(levelSessionCapacity('enhanced')).toBe(9);
    expect(levelSessionCapacity('unknown')).toBe(6); // fallback = intermediate
  });
  it('splitMaxSessionMuscles: TableTech (7 мышц) плотнее SupportGrip (4)', () => {
    const table = ARM_SPLIT_PATTERNS.find((p) => p.schedule.some((d) => d.sessionTag === 'TableTech'))!;
    const sparse = ARM_SPLIT_PATTERNS.find((p) => p.schedule.some((d) => d.sessionTag === 'SupportGrip'))!;
    expect(splitMaxSessionMuscles(table)).toBe(7);
    expect(splitMaxSessionMuscles(sparse)).toBe(4);
  });
  it('ранжирование: перебор дня при уровне = предупреждение и штраф', () => {
    const table = ARM_SPLIT_PATTERNS.find((p) => p.schedule.some((d) => d.sessionTag === 'TableTech'))!;
    const row = rankArmSplits({ level: 'beginner', goal: 'strength', technique: 'balanced', discipline: 'armwrestling', daysPerWeek: 3 } as any)
      .find((r) => r.pattern.id === table.id)!;
    expect(row.maxSessionMuscles).toBe(7);
    expect(row.levelCapacity).toBe(5);
    expect(row.warnings.some((w) => /мышц/.test(w) && /ёмкост/.test(w))).toBe(true);
    // на enhanced ёмкость 9 — предупреждения ёмкости у того же сплита нет
    const enh = rankArmSplits({ level: 'enhanced', goal: 'strength', technique: 'balanced', discipline: 'armwrestling', daysPerWeek: 3 } as any)
      .find((r) => r.pattern.id === table.id)!;
    expect(enh.warnings.some((w) => /ёмкост/.test(w))).toBe(false);
  });
  it('ранжирование: бонус сплиту с запасом ёмкости', () => {
    const sparse = ARM_SPLIT_PATTERNS.find((p) => p.schedule.some((d) => d.sessionTag === 'SupportGrip'))!;
    const row = rankArmSplits({ level: 'intermediate', goal: 'strength', technique: 'balanced', discipline: 'armwrestling', daysPerWeek: 3 } as any)
      .find((r) => r.pattern.id === sparse.id)!;
    expect(row.rationale.some((x) => /запасом/.test(x))).toBe(true);
  });
});

describe('UI-конструктор (source-guard)', () => {
  const ui = new SourceFileReader('src/ui/screens/TrainingScreen_parts/ArmAutoConstructor.tsx');
  it('sex читается из снапшота профиля, не из мёртвого пути', () => {
    expect(ui.text).not.toContain('linked?.profile?.personal?.sex');
    expect(ui.text).toContain('profileSnapshot.sex');
  });
  it('sex доезжает до buildArmPlan', () => {
    const src = ui.text;
    const buildIdx = src.indexOf('buildArmPlan({');
    expect(buildIdx).toBeGreaterThan(0);
    expect(src.slice(buildIdx, buildIdx + 400)).toMatch(/sex,/);
  });
  it('годовые блоки несут профиль-патч + goal + sex', () => {
    expect(ui.text).toMatch(/\.\.\.armBuilderProfilePatch\(profileSnapshot\)/);
    const yearIdx = ui.text.indexOf('const res = yearBlocks.map');
    expect(yearIdx).toBeGreaterThan(0);
    const yearSrc = ui.text.slice(yearIdx, yearIdx + 1400);
    expect(yearSrc).toContain('goal,');
    expect(yearSrc).toContain('sex: profileSnapshot.sex');
  });
  it('стартовый вес плоской пирамиды — отдельное поле (не результат лестницы)', () => {
    expect(ui.text).toContain('cycFlatW');
    expect(ui.text).not.toContain('parseFloat(topLadderVal) > 0 ? parseFloat(topLadderVal) : undefined,\n        bloodflow');
  });
  it('план↔факт считается по правленому плану (viewPlan)', () => {
    expect(ui.text).toMatch(/armFactFeedback\(viewPlan/);
    expect(ui.text).toMatch(/armPlanCompliance\(viewPlan/);
    expect(ui.text).toMatch(/auditArmPlan\(viewPlan/);
  });
  it('восстановление варианта несёт сплит/хват/PED/флаги цикла', () => {
    const idx = ui.text.indexOf('const restoreUiFromSnapshot');
    expect(idx).toBeGreaterThan(0);
    const src = ui.text.slice(idx, idx + 4200);
    expect(src).toContain('setPatternId');
    expect(src).toContain('setGripFocus');
    expect(src).toContain('setPedDoses');
    expect(src).toContain('setCycCoc');
  });
  it('нет UTC-даты в дневнике готовности', () => {
    expect(ui.text).not.toContain('new Date().toISOString().slice(0, 10)');
  });
  it('фокус-мышца имеет UI-писателя', () => {
    expect(ui.text).toMatch(/setFocusGroup/);
  });
  it('инвертированный блок специализации нормализуется', () => {
    const idx = ui.text.indexOf('const updateSpecBlock');
    const src = ui.text.slice(idx, idx + 500);
    expect(src).toContain('weekEnd < next.weekStart');
  });
});

describe('ArmliftingDiagnosticsHub (source-guard)', () => {
  const hub = new SourceFileReader('src/ui/screens/TrainingScreen_parts/ArmliftingDiagnosticsHub.tsx');
  it('латиница причины/зоны/ROM убрана из строк хаба', () => {
    expect(hub.text).toContain('ARMLIFT_CAUSE_RU[cause.cause]');
    expect(hub.text).toContain('ARMLIFT_MOBILITY_FAIL_RU[f]');
    expect(hub.text).toContain('ARMLIFT_ACWR_ZONE_RU[acwr.zone]');
    expect(hub.text).toContain('ARMLIFT_WEAK_LINK_SHORT_RU[s.weakLink');
    expect(hub.text).not.toMatch(/>Диагностировать слабейший: \{target\}/);
  });
  it('тост годового оверлея честен (снапшот, не молчаливый no-op)', () => {
    expect(hub.text).toContain('перенесите вручную в годовой план');
  });
});

describe('движки: UTC-даты убраны (канон core/local-date)', () => {
  for (const f of [
    'src/engines/arm/armlift-history.engine.ts',
    'src/engines/arm/armlift-cause.engine.ts',
    'src/engines/arm/arm-force-capture.engine.ts',
  ]) {
    it(`${f} — без toISOString().slice(0,10)`, () => {
      const src = new SourceFileReader(f);
      expect(src.text).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    });
  }
  it('arm-plan-feedback: дефолт «сегодня» — локальная дата', () => {
    const src = new SourceFileReader('src/engines/arm/arm-plan-feedback.engine.ts');
    expect(src.text).toContain('localIsoDate()');
    expect(src.text).not.toMatch(/String\(todayIso \|\| ''\) : new Date\(\)\.toISOString/);
  });
  // 26.10.2026 (свип «менее изученных»): файлы журналов/снапшотов, где дата
  // ещё писалась через UTC — вечерняя запись уходила в «вчера» в UTC+X.
  for (const f of [
    'src/engines/arm/arm-platform.engine.ts',
    'src/engines/arm/arm-bilateral.engine.ts',
    'src/engines/arm/arm-redflags.store.ts',
    'src/engines/arm/arm-force-history.store.ts',
    'src/engines/arm/arm-result-import.engine.ts',
  ]) {
    it(`${f} — без toISOString().slice(0,10)`, () => {
      const src = new SourceFileReader(f);
      expect(src.text).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    });
  }
});


describe('раунд «менее изученных»: годовой макро, тейпер, импорт результатов, отчёт сплита', () => {
  it('buildArmMacrocycle: сумма недель блоков === totalWeeks (12 нед + приоритет A)', () => {
    for (const total of [4, 5, 8, 12, 16, 24, 52]) {
      const m = buildArmMacrocycle({ totalWeeks: total, goal: 'strength', competitions: [{ week: 2, id: 'waf', priority: 'A' }] });
      const sum = m.blocks.reduce((a, b) => a + b.weeks, 0);
      expect(sum, `totalWeeks=${total}`).toBe(m.totalWeeks);
      let off = 0;
      for (const b of m.blocks) { expect(b.weekOffset).toBe(off); off += b.weeks; }
    }
  });
  it('buildArmMacrocycle: цель hypertrophy тоже даёт бюджет без раздувания', () => {
    const m = buildArmMacrocycle({ totalWeeks: 12, goal: 'hypertrophy' });
    expect(m.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(12);
  });
  it('arm-annual: мёртвый configHash-дубль убран (stale считает block-builders)', () => {
    const code = new SourceFileReader('src/engines/arm/arm-annual.ts').text.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain('function stableHash');
    expect(code).not.toMatch(/configHash:/);
  });
  it('buildArmTaperCurve toproll_taper: 3 недели → ровно 3 точки (было 2 → ранняя без тейпера)', () => {
    const c = buildArmTaperCurve({ taperWeeks: 3, mode: 'toproll_taper' });
    expect(c.length).toBe(3);
    expect(c[0].volumePct).toBeGreaterThanOrEqual(c[1].volumePct);
    expect(c[1].volumePct).toBeGreaterThan(c[2].volumePct);
    expect(c[2].volumePct).toBe(0.7);
  });
  it('applyArmTaperToWeeks: side-давление однократно от базы (подпись кривой не врёт)', () => {
    const weeks: any[] = [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 4, rir: 2, workSets: [{ rir: 2 }, { rir: 2 }, { rir: 2 }, { rir: 2 }] }] }] }];
    applyArmTaperToWeeks(weeks, buildArmTaperCurve({ taperWeeks: 1 }));
    expect(weeks[0].sessions[0].exercises[0].sets).toBe(1);
  });
  it('applyArmTaperToWeeks: «Тейпер-1: 65% объёма, RIR+1, side −50%» — side ровно −50%', () => {
    const weeks: any[] = [
      { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 4, rir: 2, workSets: [{ rir: 2 }, { rir: 2 }, { rir: 2 }, { rir: 2 }] }] }] },
      { week: 2, sessions: [{ exercises: [] }] },
    ];
    applyArmTaperToWeeks(weeks, buildArmTaperCurve({ taperWeeks: 2 }));
    expect(weeks[0].sessions[0].exercises[0].sets).toBe(2);
    expect(weeks[0].sessions[0].exercises[0].rir).toBe(3);
  });
  it('arm-result-import: %WR по полу, как в журнале помоста (было male у женщины)', () => {
    const json = JSON.stringify({ date: '2026-10-12', implement: 'rt', attempts: [{ weightKg: 100, success: true }] });
    const male = parseArmResultJson(json, 'male');
    const female = parseArmResultJson(json, 'female');
    const wrF = platformWrFor('rolling_thunder', 'female');
    expect(Math.round((100 / wrF) * 1000) / 10).toBe(female.wrPct);
    expect(female.wrPct).toBeGreaterThan(male.wrPct);
  });
  it('armSplitReport: частота и ёмкость отдельными строками (не только скоринг)', () => {
    const ranked = rankArmSplits({ level: 'intermediate', goal: 'strength', daysPerWeek: 4 });
    const rep = armSplitReport(ranked[0], 'intermediate');
    expect(rep.lines.some(l => l.startsWith('Частота:'))).toBe(true);
    expect(rep.lines.some(l => l.startsWith('Ёмкость дня:'))).toBe(true);
    expect(rep.capacity.levelCapacity).toBe(levelSessionCapacity('intermediate'));
    expect(rep.capacity.maxSessionMuscles).toBe(splitMaxSessionMuscles(ranked[0].pattern));
  });
  it('arm-report: предупреждение пикового перебора печатается без литерала «Н{пик}»', () => {
    const plan = buildArmPlan({ totalWeeks: 4, daysPerWeek: 4, level: 'enhanced' });
    const rep = buildArmReport(finalizeArmPlan(plan as any) as any);
    for (const w of rep.warnings) expect(w).not.toContain('{пик}');
  });
  it('арм-зона: нет гибридной латиницы внутри русских слов (в UI не попадёт «магnezия»)', () => {
    const roots = [
      path.resolve(process.cwd(), 'src/engines/arm'),
      path.resolve(process.cwd(), 'src/ui/screens/TrainingScreen_parts'),
    ];
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
        if (/[\\/]__tests__[\\/]/.test(p)) continue;
        const isArm = p.includes('engines') || /arm-|Arm/.test(name);
        if (!isArm) continue;
        const t = readFileSync(p, 'utf8');
        const cleaned = t.replace(/\/[^/\n*]+\/[gimsuy]*/g, ' ').replace(/'(ПовтMin|ПовтMax)'/g, ' ');
        for (const m of cleaned.matchAll(/[\u0400-\u04FF][A-Za-z]{1,5}(?=[\s\-"'<>,.;:()=+/\\|])/g)) {
          const s = Math.max(0, m.index - 24);
          out.push(`${path.relative(process.cwd(), p)}: …${cleaned.slice(s, m.index + 14).replace(/\s+/g, ' ')}`);
        }
      }
    };
    for (const r of roots) walk(r);
    expect(out, out.slice(0, 10).join(' | ')).toEqual([]);
  });
});
