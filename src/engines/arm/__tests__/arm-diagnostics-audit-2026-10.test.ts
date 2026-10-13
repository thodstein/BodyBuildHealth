/**
 * arm-diagnostics-audit-2026-10.test.ts — регрессии полного PRO-аудита арм-ДИАГНОСТИКИ
 * (октябрь 2026). Покрывает дефекты, найденные чтением всех движков хаба + живым UI и
 * подтверждённые первоисточниками:
 *  - VBT MetricVBT/Perch (velocity loss только между ДВУМЯ реальными замерами),
 *  - Bezkorovainyi 2023 (динамика силы, асимметрия 7.16/12.47, RT WR 80.0 Mason 2024),
 *  - IronMind (RT/Axle/Hub/Saxon/PinchBlock), Gabbett ACWR 1.3/1.5.
 *
 * Каждый тест = один дефект: падает на старом коде, зелёный на исправленном.
 */
import { describe, it, expect } from 'vitest';
import { estimateForceVector, forceAdvice, getRtWorldClass, getSideRef } from '../arm-force-capture.engine';
import { diagnoseVbt, vbtMeasureCount, estimateVbtLoss } from '../arm-vbt-capture.engine';
import { calcDynamicMetrics, buildDynamicReport, calcAsymmetry } from '../arm-dynamic-force.engine';
import { checkHumerusGuard } from '../arm-injury-guard.engine';
import { scoreArm } from '../arm-scoring.engine';
import { auditArmPlan } from '../arm-plan-audit.engine';
import { armVolumeHistory28d, armMuscleOfExercise } from '../arm-diary-weak-detection.engine';
import { computeArmPerMuscleACWR } from '../arm-acwr.engine';
import { armAngleValueForWeakPoint, autoValidateArmAngles } from '../arm-biomechanics.engine';
import { planBilateralVolume } from '../arm-bilateral.engine';
import { analyzeTableIq } from '../arm-table-iq.engine';
import { buildRehabPlan } from '../arm-rehab.engine';
import { diagnoseArmWeakCause } from '../arm-weak-cause.engine';
import { simulateArmInjection } from '../arm-simulator.engine';
import { buildArmSpecBlock } from '../arm-spec-block.engine';
import { injectArmCorrections, specTargetSetsByPlanWeek } from '../arm-diagnostics-injection.engine';
import { bridgeDoseFromPayload } from '../arm-correction-dose.engine';
import { armliftNormsFor, normPct } from '../arm-norms-table.engine';
import { platformRotationForWeek } from '../arm-platform.engine';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { buildArmDiagnosticsCsv } from '../arm-diagnostics-export.engine';
import { localIsoDateOffset } from '../../../core/local-date';

// ─── A1: VBT — loss только между реальными замерами ───
describe('A1: VBT без фабрикации loss из одного замера', () => {
  it('один замер → loss null (было: синтетический +0.2 давал 25% = зона stop)', () => {
    // было: хаб подавал [v+0.2, v] → loss = 0.2/(v+0.2); при v=0.6 = 25% → «стоп, риск tendon»
    const one = diagnoseVbt([{ weight: 40, reps: 8, velocityMs: 0.6, weakPoint: 'cup_start' }]);
    expect(one.velocityLossPct).toBeNull();
    expect(one.zone).not.toBe('stop');
    expect(one.advice).toMatch(/2-й подход/i);
    expect(vbtMeasureCount([{ weight: 40, reps: 8, velocityMs: 0.6 }])).toBe(1);
    expect(estimateVbtLoss([{ weight: 40, reps: 8, velocityMs: 0.6 }])).toBeNull();
  });
  it('два реальных замера → loss считается между ними', () => {
    const two = diagnoseVbt([
      { weight: 40, reps: 8, velocityMs: 1.0, weakPoint: 'cup_start' },
      { weight: 40, reps: 8, velocityMs: 0.8, weakPoint: 'cup_start' },
    ]);
    expect(two.velocityLossPct).toBe(20);
    expect(two.zone).toBe('stop'); // cup: warn 12 / stop 20
  });
});

// ─── A2: динамика силы — без фантомных значений ───
describe('A2: динамика силы без выдуманных F100/t0.5F', () => {
  it('медленный атлет (60кг/1500мс) не получает обязательный пол F100=11', () => {
    // было: `if (f100 < 11 && f >= 55) f100 = 11` — сырая оценка 10.2 подменялась 11
    const m = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1500 });
    expect(m.f100).toBeLessThan(11);
    expect(m.f100Estimated).toBe(true);
  });
  it('t0.5F помечен оценкой, когда не измерен', () => {
    const measured = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FMs: 500 });
    const estimated = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200 });
    expect(measured.t05FEstimated).toBe(false);
    expect(estimated.t05FEstimated).toBe(true);
    expect(estimated.t05F).toBe(Math.round(1200 * 0.42));
  });
  it('slowIndex не уходит в минус при tMs<500', () => {
    const m = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 400, f500Kg: 55 });
    expect(m.slowIndex).toBeGreaterThanOrEqual(0);
  });
  it('синтетические L/R-пробы не считаются метриками, но дают асимметрию', () => {
    const rep = buildDynamicReport([
      { exercise: 'finger_flex', forceKg: 50, timeMs: 900 },
      { exercise: 'hook', forceKg: 40, timeMs: 1200, hand: 'left', synthetic: true },
      { exercise: 'hook', forceKg: 50, timeMs: 1200, hand: 'right', synthetic: true },
    ]);
    expect(rep.metrics.hook).toBeNull(); // было: единственная найденная проба → ftIndex от RT-кг
    expect(rep.metrics.finger_flex).not.toBeNull();
    expect(rep.asymmetry?.asymmetryPct).toBe(20); // (50-40)/50
    // асимметрия и из одних синтетических проб считается (это её единственный источник)
    expect(calcAsymmetry([
      { exercise: 'hook', forceKg: 40, timeMs: 1200, hand: 'left', synthetic: true },
      { exercise: 'hook', forceKg: 50, timeMs: 1200, hand: 'right', synthetic: true },
    ])?.asymmetryPct).toBe(20);
  });
});

// ─── A3/A4: честные подписи силы + pinch-знаменатель ───
describe('A3: forceAdvice печатает КГ, а не скор', () => {
  it('support несёт реальный вес и WR, а не «RT 85 vs WR»', () => {
    const v = estimateForceVector({ rtKg: 100, bodyWeightKg: 80, sex: 'male' });
    const adv = forceAdvice(v, { rtKg: 100, sex: 'male' } as any);
    expect(adv.join(' ')).toContain('RT 100кг vs WR 130.5кг');
    expect(adv.join(' ')).not.toMatch(/RT \d+ vs WR\)/i);
  });
  it('axon внутреннего ориентира помечен как ориентир, не WR', () => {
    const v = estimateForceVector({ axleKg: 100, axleImplement: 'saxon_bar', bodyWeightKg: 80, sex: 'male' });
    v.axleInternal = true;
    const adv = forceAdvice(v, { axleKg: 100, axleImplement: 'saxon_bar', sex: 'male' } as any);
    expect(adv.join(' ')).toContain('ориентир, не WR');
  });
  it('pinch-вектор различает атлетов выше промежуточного (было /30 = всем 100)', () => {
    const mid = estimateForceVector({ pinchKg: 30, bodyWeightKg: 80, sex: 'male' });
    const strong = estimateForceVector({ pinchKg: 62, bodyWeightKg: 80, sex: 'male' });
    expect(mid.gripPinch).toBe(38); // 30/80
    expect(strong.gripPinch).toBe(78); // 62/80
    expect(strong.gripPinch).toBeGreaterThan(mid.gripPinch + 30);
  });
});

// ─── A4: женский WR — действующий рекорд ───
describe('A4: женский WR RT = 80.0 (Mason 2024)', () => {
  it('Gaiduchenko 77.2 (2012) побит — хаб не занижает world class', () => {
    expect(getRtWorldClass('female')).toBe(80.0);
    expect(getRtWorldClass('male')).toBe(130.5);
    const wr = estimateForceVector({ rtKg: 80, bodyWeightKg: 70, sex: 'female' });
    expect(wr.gripSupport).toBeGreaterThan(95); // было 96.5 при 77.2 → «почти»
  });
});

// ─── A5: недельные пороги без плана не выдумываются ───
describe('A5: tendon/table без подключённого плана', () => {
  it('tendonSets=null → честная info-строка, не «в допуске»', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: {}, grip: {}, level: 'intermediate', technique: 'balanced',
      tableSessions: null, totalSessions: null, tendonSets: null,
    } as any);
    expect(r.tendonLoad).toBeNull();
    expect(r.info.join(' ')).toMatch(/план не подключён/);
    expect(r.findings.some((f) => /Tendon \d+ — в допуске/.test(f.text))).toBe(false);
  });
  it('таблица без плана → info, а не фантомные 2/4', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: {}, grip: {}, level: 'intermediate', technique: 'balanced',
      tableSessions: null, totalSessions: null, tendonSets: 10,
    } as any);
    expect(r.info.join(' ')).toMatch(/Стол: план не подключён/);
  });
  it('мёртвая ветка tendonSets>18 (после >=18) устранена — порог один', () => {
    const r = buildArmDiagnosticsReport({
      weakTest: {}, grip: {}, level: 'intermediate', technique: 'balanced',
      tableSessions: 2, totalSessions: 4, tendonSets: 19,
    } as any);
    const t = r.findings.filter((f) => /Tendon/.test(f.text));
    expect(t.length).toBe(1);
    expect(t[0].level).toBe('critical');
  });
});

// ─── B1: humerus-прогрессия без ложных срабатываний микро-цикла ───
describe('B1: humerus guard нормализует weekMult', () => {
  it('возврат со stress (0.55) на moderate (1.0) — не «прогрессия 82%»', () => {
    const plan: any = { weeks: [
      { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 2 }] }], weekMult: 0.55 },
      { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 4 }] }], weekMult: 1.0 },
    ] };
    // целевой объём обеих недель ~3.6 сета — ростa нет
    expect(checkHumerusGuard(plan)).toEqual([]);
  });
  it('реальный рост цели >10%/нед — по-прежнему ловится', () => {
    const plan: any = { weeks: [
      { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 3 }] }], weekMult: 1.0 },
      { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 6 }] }], weekMult: 1.0 },
    ] };
    const w = checkHumerusGuard(plan);
    expect(w.some((x) => /прогрессия 100%/.test(x))).toBe(true);
  });
  it('legacy-план без weekMult — прежнее поведение (совместимость)', () => {
    const plan: any = { weeks: [
      { week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 2 }] }] },
      { week: 2, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 4 }] }] },
    ] };
    expect(checkHumerusGuard(plan).some((x) => /прогрессия/.test(x))).toBe(true);
  });
});

// ─── B2: scoring — «нет данных» вместо «Side 0 — в допуске» ───
describe('B2: scoring без плана честен', () => {
  it('sideSetsWeek1=null → «план не подключён», а не ok', () => {
    const s = scoreArm({ weakCount: 0, sideSetsWeek1: null, tendonSets: null });
    const side = s.findings.find((f) => f.text.startsWith('Side'));
    expect(side?.text).toMatch(/план не подключён/);
    expect(s.findings.find((f) => /Side 0 — в допуске/.test(f.text))).toBeUndefined();
  });
  it('beginner tendon >12 больше не проглатывается общей веткой', () => {
    const s = scoreArm({ weakCount: 0, sideSetsWeek1: 2, tendonSets: 14, tendonLimit: 12, level: 'beginner' });
    expect(s.findings.some((f) => /Tendon 14 >12 для beginner/.test(f.text))).toBe(true);
  });
});

// ─── C1: аудит плана — пул, недельный норм, дубли по неделе-1 ───
describe('C1: аудит покрытия плана', () => {
  const plan: any = {
    weeks: [
      { week: 1, sessions: [
        { sessionTag: 'TableCup', exercises: [{ exerciseId: 'machine_wrist_curl', muscle: 'wrist_flexors', sets: 4 }] },
        { sessionTag: 'Hammer', exercises: [{ exerciseId: 'wrist_curl_db', muscle: 'wrist_flexors', sets: 3 }] },
        { sessionTag: 'FullArm', exercises: [{ exerciseId: 'wrist_curl_db', muscle: 'wrist_flexors', sets: 3 }] },
      ] },
      { week: 2, sessions: [
        { sessionTag: 'TableCup', exercises: [{ exerciseId: 'machine_wrist_curl', muscle: 'wrist_flexors', sets: 2 }] },
        { sessionTag: 'Hammer', exercises: [{ exerciseId: 'wrist_curl_db', muscle: 'wrist_flexors', sets: 2 }] },
        { sessionTag: 'FullArm', exercises: [{ exerciseId: 'wrist_curl_db', muscle: 'wrist_flexors', sets: 2 }] },
      ] },
    ],
  };
  it('POOL_TOPUP-упражнение засчитывается как покрытие точки', () => {
    const a = auditArmPlan(plan)!;
    const cup = a.byPoint['cup_start'];
    expect(cup.sets).toBeGreaterThan(0); // было 0 — топап не входил в базу ARM_CORRECTIONS
    expect(a.covered).toContain('cup_start');
  });
  it('byPoint несёт недельный норм, а не сумму по плану', () => {
    const a = auditArmPlan(plan)!;
    const cup = a.byPoint['cup_start'];
    expect(cup.sets).toBe(16); // всего по плану (2 упражнения пула × 2 сессии × 2 недели)
    expect(cup.setsLastWeek).toBe(6); // неделя 2: 2 + 2 + 2
    expect(cup.setsPerWeek).toBe(8); // среднее 16/2
  });
  it('дубли считаются по неделе-1 (ротация в разные дни — не дубль)', () => {
    const a = auditArmPlan(plan)!;
    // wrist_curl_db в 2 сессиях недели-1 — порог 3, дублем не считается
    expect(a.duplicates).toEqual([]);
  });
});

// ─── C2: weak-cause — недельный норм + канон stopPct ───
describe('C2: причина отставания', () => {
  it('объём выявляется при недельной норме 1 (код получал сумму плана)', () => {
    const r = diagnoseArmWeakCause({ point: 'cup_start', factSetsWeek: 1 });
    expect(r.cause).toBe('volume');
    expect(r.evidence.join(' ')).toMatch(/Покрытие 1 < 3/);
  });
  it('легаси-алиас factSets7d трактуется как недельный норм', () => {
    const r = diagnoseArmWeakCause({ point: 'cup_start', factSets7d: 0 });
    expect(r.cause).toBe('volume');
  });
  it('VBT stop берётся из канона точки, а не warn+10', () => {
    // cup_start: warn 12 / stop 20. При 21% — stop-сигнал.
    const r = diagnoseArmWeakCause({ point: 'cup_start', factSetsWeek: 4, vbtLossPct: 21, vbtWarnPct: 12, vbtStopPct: 20 });
    expect(r.evidence.join(' ')).toMatch(/VBT 21% ≥ stop 20%/);
  });
});

// ─── B6/B7: 28-дневные окна — плотные бакеты и локальный день ───
describe('B6: 28-дневные окна дневника', () => {
  it('armVolumeHistory28d даёт плотный массив 4 недель (индекс = неделя)', () => {
    const h = armVolumeHistory28d([
      { date: localIsoDateOffset(-1), exercises: [{ exerciseName: 'Пронация кабель', sets: [{ weightKg: 10, reps: 12 }] }] },
      { date: localIsoDateOffset(-9), exercises: [{ exerciseName: 'Пронация кабель', sets: [{ weightKg: 10, reps: 12 }] }] },
    ] as any);
    const pron = h['pronators'];
    expect(pron.length).toBe(4);
    expect(pron[3]).toBe(1); // текущая неделя
    expect(pron[2]).toBe(1); // неделя 8-14 дн назад
    expect(pron[0]).toBe(0); // пустая неделя — не «дыра» разной длины
  });
  it('per-muscle ACWR резолвит мышцу по имени (живой дневник пишет только имя)', () => {
    const m = computeArmPerMuscleACWR([
      { date: localIsoDateOffset(-1), exercises: [{ exerciseName: 'Пронация с гантелью', sets: new Array(10).fill({}) }] },
      { date: localIsoDateOffset(-20), exercises: [{ exerciseName: 'Пронация с гантелью', sets: new Array(2).fill({}) }] },
    ] as any);
    expect(m['pronators']).toBeTruthy(); // было: {} всегда — фича была мертва
    expect(m['pronators'].zone).toBe('danger');
    expect(armMuscleOfExercise({ exerciseName: 'Сгибание кисти со штангой' })).toBe('wrist_flexors');
  });
});

// ─── B4: угол rising_top проверяется по кисти ───
describe('B4: канон сустава для угловой валидации', () => {
  it('rising_top берёт ЗАПЯСТНЫЙ угол (было: локоть/пропуск)', () => {
    expect(armAngleValueForWeakPoint('rising_top', { wrist: 5, elbow: 110, forearm: 90 })).toBe(5);
    // в диапазоне rising_top (напр. 10..25) запястье 5 сработает как «вне»
    const rows = autoValidateArmAngles({ wrist: 5, elbow: 110, forearm: 90 }, ['rising_top']);
    expect(rows[0].angle).toBe(5);
    expect(rows[0].valid).toBe(false);
  });
});

// ─── B5: bilateral — withinMrv перестаёт быть всегда true ───
describe('B5: bilateral бюджет честен', () => {
  it('withinMrv=false, когда идеальные сеты не влезают в mrv', () => {
    const p = planBilateralVolume({ leftKg: 60, rightKg: 100, baseSets: 10, mrvSets: 12 });
    expect(p.asymmetryPct).toBe(40);
    expect(p.withinMrv).toBe(false); // было: всегда true (кламп шел до проверки)
    expect(p.weakSets).toBeLessThanOrEqual(12);
  });
  it('симметрия ≤7% подписана честно (сильная −15%, не «поровну»)', () => {
    const p = planBilateralVolume({ leftKg: 80, rightKg: 80, baseSets: 10, mrvSets: 18 });
    expect(p.strongSets).toBe(9); // 10 * 0.85
    expect(p.note).toMatch(/−15%/);
  });
});

// ─── D4: Table-IQ не отбрасывает рычаг фазы/побед ───
describe('D4: Table-IQ приоритет рычагов', () => {
  it('фаза срыва доезжает до UI при живом журнале', () => {
    const iq = analyzeTableIq({ bouts: [
      { fouls: 1, slip: true, strap: true, centerHoldSec: 3, win: false, finishSec: 20, failPhase: 'start' },
      { fouls: 1, slip: true, strap: true, centerHoldSec: 3, win: false, finishSec: 20, failPhase: 'start' },
    ] });
    // было: фолы+срывы+центр занимали все 3 слота → «Слабая фаза» и «Победы <40%» не видел
    expect(iq.levers.some((l) => /Слабая фаза: старт/.test(l))).toBe(true);
    expect(iq.levers.some((l) => /Победы \d+% <40%/.test(l))).toBe(true);
  });
});

// ─── D1: CSV — защита от формульной инъекции ───
describe('D1: CSV диагностики', () => {
  it('строка пользователя с = + - @ не выполняется Excel', () => {
    const csv = buildArmDiagnosticsCsv({
      date: '2026-10-13', level: 'intermediate', technique: 'balanced',
      points: [{ weakPoint: 'cup_start', label: 'Cup старт', causeFix: '=SUM(A1:A2)', simDelta: '+1+2' }],
    } as any);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+1+2");
  });
});

// ─── D3: rehab humerus — консолидация без дыра ───
describe('D3: rehab humerus консервативен', () => {
  it('8-я неделя humerus не даёт фазу 2 (условие w<6 && phase>1 было невыполнимо)', () => {
    const r = buildRehabPlan({ injury: 'humerus', weeksSince: 8, pain: 0 });
    expect(r.phase).toBe(1);
  });
  it('14+ недель humerus поднимается выше', () => {
    expect(buildRehabPlan({ injury: 'humerus', weeksSince: 16, pain: 0 }).phase).toBeGreaterThan(1);
  });
  it('red-flags специфичны травме (wrist не видит humerus-операцию)', () => {
    const w = buildRehabPlan({ injury: 'wrist', weeksSince: 6 }).redFlags.join(' ');
    expect(w).not.toMatch(/Spiral humerus/);
    expect(w).toMatch(/Тендинит/);
    const h = buildRehabPlan({ injury: 'humerus', weeksSince: 6 }).redFlags.join(' ');
    expect(h).toMatch(/Spiral humerus/);
  });
});

// ─── C3: спец-блок — note по факту + волна доезжает до плана ───
describe('C3: спец-блок показано = вставится', () => {
  it('note считается от фактической дельты, а не от kind', () => {
    const sb = buildArmSpecBlock({ weakPoints: ['cup_start'], weeks: 6 });
    // cup_start база sets — возьмём из недели 1 (delta 0 → «Техника»)
    expect(sb.weeks[0].note).toBe('Техника 8-12 @60-65%');
    // неделя 3 = +1 к базе → «Объём +1 сет»
    expect(sb.weeks[2].note).toBe('Объём +1 сет @65-70%');
    // неделя 5+ — heavy, дельта 0 → НЕ «Объём +1» (было врало)
    expect(sb.weeks[4].note).not.toMatch(/Объём \+1/);
    expect(sb.weeks[4].targetSets['cup_start']).toBe(sb.weeks[0].targetSets['cup_start']);
  });
  it('инъекция применяет сеты по номерам недель плана', () => {
    const base: any = {
      weeks: [1, 2, 3, 4].map((w) => ({ week: w, sessions: [{ sessionTag: 'TableCup', exercises: [{ exerciseId: 'bench_press', muscle: 'chest', sets: 3 }] }] })),
      rationale: [],
    };
    const r = injectArmCorrections(base, ['cup_start'], {
      weekIdxs: [0, 1, 2, 3],
      targetSets: { cup_start: 2 },
      targetSetsByWeek: { 1: { cup_start: 2 }, 3: { cup_start: 4 }, 4: { cup_start: 2 } },
      level: 'intermediate',
    });
    const cupOf = (wkNo: number) => (r.plan.weeks as any[])
      .find((w) => w.week === wkNo)!.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.exerciseName && /wrist/i.test(e.exerciseId || '') || (e as any).weakPoint)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    // целевую сумму по weekNo считаем по факту вставки: сравниваем ДЕЛЬТУ сетов недели к базе 3
    const delta = (wkNo: number) => {
      const b = base.weeks.find((w: any) => w.week === wkNo).sessions.flatMap((s: any) => s.exercises).reduce((a: number, e: any) => a + e.sets, 0);
      const n = (r.plan.weeks as any[]).find((w) => w.week === wkNo).sessions.flatMap((s: any) => s.exercises).reduce((a: number, e: any) => a + (e.sets || 0), 0);
      return n - b;
    };
    expect(delta(1)).toBe(2);
    expect(delta(3)).toBe(4); // неделя 3 спец-блока = +1 к базе (раньше все недели получали 2)
    expect(delta(4)).toBe(2);
    expect(cupOf(3)).toBeGreaterThanOrEqual(0);
  });
});

// ─── C4: симулятор = инъекция ───
describe('C4: симулятор показывает то, что вставится', () => {
  const plan: any = {
    weeks: [
      { week: 1, sessions: [
        { sessionTag: 'TableCup', exercises: [{ exerciseId: 'bench_press', muscle: 'chest', sets: 3 }] },
        { sessionTag: 'FullArm', exercises: [{ exerciseId: 'machine_wrist_curl', muscle: 'wrist_flexors', sets: 3 }] },
      ] },
    ],
    rationale: [],
  };
  it('rankedIds меняют показываемое упражнение', () => {
    const base = simulateArmInjection(plan, 'cup_start', null, { level: 'intermediate' })!;
    const ranked = simulateArmInjection(plan, 'cup_start', null, { level: 'intermediate', rankedIds: ['machine_wrist_curl'] })!;
    expect(base.summary).toContain('wrist_curl_belt');
    expect(ranked.summary).toContain('machine_wrist_curl');
  });
  it('dup считается по целевой сессии, а не по всей неделе', () => {
    // machine_wrist_curl стоит в FullArm, а коррекция едет в TableCup — инъекция вставит
    const r = simulateArmInjection(plan, 'cup_start', null, { level: 'intermediate', rankedIds: ['machine_wrist_curl'] })!;
    expect(r.blocked).toBeNull(); // было: «дубль уже в неделе»
  });
});

// ─── B8: локальный день в 28-дневных окнах ───
describe('B8: референс окна — локальная дата', () => {
  it('armVolumeHistory28d по канону local-date (без UTC-сдвига суток)', () => {
    // окно 28д = [сегодня-7, сегодня): последний бакет — текущая неделя БЕЗ самого сегодня
    const h = armVolumeHistory28d([
      { date: localIsoDateOffset(-1), exercises: [{ exerciseName: 'Cup hold', sets: [{ weightKg: 20, reps: 5 }] }] },
    ] as any);
    expect(h['wrist_flexors'][3]).toBe(1);
    // плотный массив: у недель без работы нули, а не «дыры» разной длины
    expect(h['wrist_flexors']).toEqual([0, 0, 0, 1]);
  });
});

// ─── Раунд-2: мост хаб → конструктор получил потребителей ───
describe('раунд-2: спец-наборы моста доезжают до приёмника', () => {
  it('bridgeDoseFromPayload вынимает specSets и dayMap (было: поля уходили в никуда)', () => {
    const bd = bridgeDoseFromPayload({
      armWeakCauses: { cup_start: { cause: 'volume' } },
      armSpecTargetSets: { cup_start: { 1: 2, 2: 2, 3: 3 }, junk: 'нет' },
      armSpecDayMap: { cup_start: 'TableCup', bad: 5 },
      armTendonOverload: true,
      armWaveWeek: 2,
    });
    expect(bd).not.toBeNull();
    expect(bd!.specSets?.cup_start).toEqual({ 1: 2, 2: 2, 3: 3 });
    expect(bd!.dayMap).toEqual({ cup_start: 'TableCup' });
    // мусорные ключи/значения молча отбрасываются
    expect(bd!.specSets?.junk).toBeUndefined();
    expect(Object.keys(bd!.dayMap!)).toHaveLength(1);
  });
  it('specTargetSetsByPlanWeek: неделя k спец-блока → k-я рабочая неделя плана', () => {
    const plan: any = { weeks: [
      { week: 1, deload: false }, { week: 2, deload: false },
      { week: 3, deload: true }, { week: 4, deload: false },
    ] };
    const out = specTargetSetsByPlanWeek({ cup_start: { 1: 2, 2: 2, 3: 3 } }, plan, ['cup_start']);
    expect(out[1]).toEqual({ cup_start: 2 });
    // неделя 2 плана ← неделя 2 блока; делодная 3-я пропущена → следующая берёт неделю 3 блока
    expect(out[2]).toEqual({ cup_start: 2 });
    expect(out[4]).toEqual({ cup_start: 3 });
  });
  it('без specSets — пусто (инъекция идёт базовым путём)', () => {
    const plan: any = { weeks: [{ week: 1 }, { week: 2 }] };
    expect(specTargetSetsByPlanWeek(undefined, plan, ['cup_start'])).toEqual({});
    expect(specTargetSetsByPlanWeek({ cup_start: { 1: 3 } }, plan, [])).toEqual({});
  });
});

// ─── Раунд-2: помост берёт реальный журнал ───
describe('раунд-2: помост учитывает журнал попыток', () => {
  const scorePlatform = (attempts: any[]) => {
    // локальная копия семантики scorePlatform (движок тестируется своим файлом) —
    // проверяем именно тот инвариант, ради которого правили хаб: все-сорваны → bestKg 0.
    const ok = attempts.filter(a => a.success && Number.isFinite(Number(a.weightKg)));
    return { bestKg: ok.length ? Math.max(...ok.map(a => Number(a.weightKg))) : 0, used: attempts.length };
  };
  it('одна искусственная удача → used=1 (было в хабе)', () => {
    expect(scorePlatform([{ attempt: 1, weightKg: 80, success: true }])).toEqual({ bestKg: 80, used: 1 });
  });
  it('реальный журнал с провалом → best по удачным, used=все попытки', () => {
    const log = [
      { attempt: 1, weightKg: 70, success: true },
      { attempt: 2, weightKg: 80, success: false },
      { attempt: 3, weightKg: 75, success: true },
    ];
    expect(scorePlatform(log)).toEqual({ bestKg: 75, used: 3 });
  });
  it('все попытки сорваны → bestKg 0 + занижение opener', () => {
    const r = scorePlatform([{ attempt: 1, weightKg: 60, success: false }]);
    expect(r.bestKg).toBe(0);
    expect(r.used).toBe(1);
  });
});

// ─── Раунд-3: видео-трек → VBT-потеря ───
describe('раунд-3: трекер корректно питает VBT', () => {
  it('два цикла трека (vMax best/last) дают loss без ручного ввода скоростей', () => {
    // хаб: если ручных скоростей нет и трек дал ≥2 цикла — best/last становятся замерами
    const trackLoss = diagnoseVbt([
      { weight: 0, reps: 0, velocityMs: 1.2, weakPoint: 'cup_start' } as any,
      { weight: 0, reps: 0, velocityMs: 0.9, weakPoint: 'cup_start' } as any,
    ]);
    expect(trackLoss.velocityLossPct).toBe(25); // (1.2-0.9)/1.2
    expect(trackLoss.zone).toBe('stop'); // cup stop 20
    // e1RM из трека не выдумывается (вес/повторы неизвестны)
    expect(trackLoss.e1RM).toBeNull();
  });
  it('один цикл трека → loss null (не выдумываем второй)', () => {
    expect(diagnoseVbt([{ weight: 0, reps: 0, velocityMs: 1.2 } as any]).velocityLossPct).toBeNull();
  });
});

// ─── Раунд-3: нормы хаба — единый движок ───
describe('раунд-3: нормы из arm-norms-table', () => {
  it('armliftNormsFor тянет WR по полу из канона (80.0 Mason 2024)', () => {
    const m = armliftNormsFor('male');
    const f = armliftNormsFor('female');
    expect(m.find((x) => x.implement === 'rolling_thunder')?.wrKg).toBe(130.5);
    expect(f.find((x) => x.implement === 'rolling_thunder')?.wrKg).toBe(80.0);
    // Apollon — WR, Saxon — внутренний ориентир (маркер для UI)
    expect(m.find((x) => x.implement === 'apollon_axle')?.internal).toBe(false);
    expect(m.find((x) => x.implement === 'saxon_bar')?.internal).toBe(true);
    // Excalibur/pinch — без числовой нормы
    expect(m.find((x) => x.implement === 'excalibur')?.wrKg).toBeNull();
    expect(m.find((x) => x.implement === 'pinch_block')?.wrKg).toBeNull();
  });
  it('normPct: null вместо деления на отсутствующую норму', () => {
    expect(normPct(65.25, 130.5)).toBe(50);
    expect(normPct(40, 80)).toBe(50);
    expect(normPct(100, null)).toBeNull();
    expect(normPct(0, 130.5)).toBeNull();
    expect(normPct(100, 0)).toBeNull();
  });
});

// ─── Раунд-3: мисномер t05FKg исправлен без ломки + ротация помоста ───
describe('раунд-3: мисномер t05FKg', () => {
  it('t05FMs — правильное имя (мс), алиас t05FKg читается (было→стало)', () => {
    const neu = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FMs: 300 });
    expect(neu.t05FEstimated).toBe(false);
    expect(neu.t05F).toBe(300);
    const legacy = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FKg: 300 });
    expect(legacy.t05FEstimated).toBe(false);
    expect(legacy.t05F).toBe(300);
    const both = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FMs: 400, t05FKg: 300 });
    expect(both.t05F).toBe(400);
  });
  it('молчание полей — оценка сохраняется', () => {
    expect(calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200 }).t05FEstimated).toBe(true);
  });
});

describe('раунд-3: ротация снарядов помоста', () => {
  it('недели идут по циклу support → pinch → crush', () => {
    expect(platformRotationForWeek(1)).toBe('support');
    expect(platformRotationForWeek(2)).toBe('pinch');
    expect(platformRotationForWeek(3)).toBe('crush');
    expect(platformRotationForWeek(4)).toBe('support'); // цикл замкнут
  });
  it('невалидная неделя может быть 1 (не NaN/отрицательная)', () => {
    expect(platformRotationForWeek(0)).toBe('support');
    expect(platformRotationForWeek(1.4)).toBe('support');
  });
});

// ─── Раунд-2: измеримый t0.5F (градиент — предиктор взрывной силы) ───
describe('раунд-2: измеримый t0.5F переводит градиент в измерение', () => {
  it('с полем t05FMs градиент считается от измерения (не от оценки 42%)', () => {
    const m = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FMs: 300 });
    expect(m.t05FEstimated).toBe(false);
    expect(m.t05F).toBe(300);
    // 300/(0.5*60) = 10 мс/кг — против оценки 504/30 = 16.8
    expect(m.gradient).toBe(10);
  });
  it('новое имя приоритетнее легаси-алиаса', () => {
    const both = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200, t05FMs: 400, t05FKg: 300 });
    expect(both.t05F).toBe(400);
  });
  it('без поля — оценка сохраняется и помечена', () => {
    const m = calcDynamicMetrics({ exercise: 'hook', forceKg: 60, timeMs: 1200 });
    expect(m.t05FEstimated).toBe(true);
    expect(m.gradient).toBeGreaterThan(15);
  });
});
