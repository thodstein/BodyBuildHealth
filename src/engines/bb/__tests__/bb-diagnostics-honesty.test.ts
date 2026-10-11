/**
 * bb-diagnostics-honesty.test.ts — AUDIT-раунд Oct 11 2026.
 *
 * Класс дефектов, который закрывает этот лок: **отсутствие данных не должно
 * выдаваться за результат**. Каждый тест ниже — это утверждение вида «движок
 * умеет сказать "не замерено"», а не «движок умеет считать».
 *
 * Второй класс — несопоставимые единицы/окна и пороги «округлили и сравнили».
 * Третий — диагностика, которая подставляет дефолт под видом измерения.
 *
 * Лок писался после правок (каждый пункт — с комментарием «было→стало»).
 */
import { describe, it, expect } from 'vitest';
import { singleLegVerdict, resolveMovementDriver, screenPriorityList } from '../bb-movement-screen.engine';
import { loadedSquatVerdict, loadedHingeVerdict, hingeVerdict } from '../bb-hinge-screen.engine';
import { shoulderWallVerdict, thoracicRotationVerdict, erIrVerdict, THORACIC_ROT_NORM } from '../bb-shoulder-screen.engine';
import { ybtLqVerdict, YBT_ANT_ASYM_CM, YBT_COMPOSITE_CUT } from '../bb-ybt-lq.engine';
import { nheVerdict, adductorVerdict } from '../bb-posterior-readiness.engine';
import { painMonitorVerdict } from '../bb-pain-monitor.engine';
import { pushLrSnapshot, summarizeLrDirection } from '../bb-lr-history.engine';
import { detectBBWeakByVolume, e1rmTrend28d, mergeBBWeakCandidates, volumeHistory28d } from '../bb-weak-detection.engine';
import { diagnoseWeakCause, idealDeltaForZone, weeksAtMav } from '../bb-weak-cause.engine';
import { assessBbReadiness } from '../bb-readiness.engine';
import { assessOHS } from '../../strength-sport/strength-sport-ohs.engine';
import { assessBbTendonGuard } from '../bb-tendon-guard.engine';
import { resolveBbDiagIntakeExtras } from '../bb-diag-intake.engine';

const CLEAN_OHS = {
  heelsFlat: true, kneeValgus: false, hipBelowParallel: true,
  trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true,
};

// ── 1. Нет данных ≠ результат ──────────────────────────────────────────────
describe('AUDIT: «пустой скрининг» больше не выдаёт результат', () => {
  it('односторонний: ни одного ввода — «не проверялся»', () => {
    // было: {null,null,null,null} → «Односторонний: обе стороны чистые»
    const v = singleLegVerdict({ splitSquatL: null, splitSquatR: null, rdlL: null, rdlR: null });
    expect(v.tested).toBe(false);
    expect(v.text).toMatch(/не проверялся/);
  });

  it('односторонний: только угломер без качественной оценки — не «чисто»', () => {
    const v = singleLegVerdict({ splitSquatL: null, splitSquatR: null, rdlL: null, rdlR: null, fppaL: 10, fppaR: 12 });
    expect(v.tested).toBe(true);
    expect(v.weakSide).toBeNull();
    expect(v.text).not.toMatch(/чистые/);
  });

  it('драйвер: tested=false — «скрининг не заполнен», а не «паттерн чистый»', () => {
    const r = resolveMovementDriver({ ...CLEAN_OHS, tested: false } as any);
    expect(r.tested).toBe(false);
    expect(r.label).toMatch(/не заполнен/);
    expect(r.confidence).toBe(0);
  });

  it('драйвер: признак дорсифлексии без компенсаций — всё ещё анкл (было: «драйвер не найден» при провале ohsFailCodes)', () => {
    const r = resolveMovementDriver({ ...CLEAN_OHS, heelsFlat: false });
    expect(r.driver).toBe('ankle');
    expect(r.tested).toBe(true);
    const other = resolveMovementDriver({ ...CLEAN_OHS, ankleDeg: 28 });
    expect(other.driver).toBe('ankle');
  });

  it('плечо у стены: без отметок — «не проверялся»', () => {
    // было: все пять входов были дефолтными true → «чисто — жимы над головой разрешены»
    const v = shoulderWallVerdict({ backOnWall: null, headOnWall: null, bicepsAtEars: null, ribsDown: null, noShrug: null });
    expect(v.tested).toBe(false);
    expect(v.text).toMatch(/не проверялся/);
  });

  it('нагруженный присед: только база без веса — не «стабилен под нагрузкой»', () => {
    const v = loadedSquatVerdict({ bodyweight: 'pass', bar: null, working: null });
    expect(v.loadedTested).toBe(false);
    expect(v.text).toMatch(/только база без веса/);
  });

  it('нагруженный наклон: один ввод — текст называет конкретику', () => {
    const v = loadedHingeVerdict({ rdl: 'pass', floor: null });
    expect(v.tested).toBe(true);
    expect(v.text).toMatch(/RDL/);
    expect(v.text).toMatch(/тяга с пола не проверялась/);
  });

  it('ротация грудного: одна сторона — не «норма обеих»', () => {
    const v = thoracicRotationVerdict({ rotL: 60, rotR: null });
    expect(v.gap).toBeNull();
    expect(v.text).toMatch(/замерена одна сторона/);
  });

  it('аддукторы: одна сторона — не «симметрично (0%)»', () => {
    const v = adductorVerdict({ squeezeL: 20, squeezeR: null });
    expect(v.asymPct).toBeNull();
    expect(v.text).toMatch(/одной стороной/);
  });

  it('NHE: без повторов — не «эксцентрик в порядке»', () => {
    const v = nheVerdict({ breakAngleL: 50 });
    expect(v.text).toMatch(/повторы не замерялись/);
    expect(v.text).not.toMatch(/эксцентрик в порядке/);
  });

  it('шарнир: не проверялся — not_tested (регресс)', () => {
    expect(hingeVerdict(null).locus).toBe('not_tested');
  });
});

// ── 2. Пороги: сравнение по сырому значению + корректные нормы ─────────────
describe('AUDIT: пороги сравниваются по неокруглённым значениям', () => {
  it('ER/IR 0.7499 — предупреждение (было: round(0.75) прятал его)', () => {
    const v = erIrVerdict({ erKg: 7.499, irKg: 10 });
    expect(v.warn).toBe(true);
    expect(v.ratio).toBe(0.75);
  });
  it('ER/IR 1.1501 — проверка замера, а не «норма»', () => {
    const v = erIrVerdict({ erKg: 11.501, irKg: 10 });
    expect(v.warn).toBe(true);
    expect(v.text).toMatch(/нетипично/);
  });
  it('ER/IR в норме — без предупреждения', () => {
    expect(erIrVerdict({ erKg: 9, irKg: 10 }).warn).toBe(false);
  });
  it('ротация: порог 45° — это среднее+0.5SD методики «палка за спиной» (Johnson 2012: 41.6±8.7)', () => {
    // было: круглые 50° — половина здоровых людей попадала в «ограничение»
    expect(THORACIC_ROT_NORM).toBe(45);
    expect(thoracicRotationVerdict({ rotL: 46, rotR: 46 }).low).toBe(false);
    expect(thoracicRotationVerdict({ rotL: 42, rotR: 48 }).low).toBe(true);
  });
});

// ── 3. Правило боли совпадает со своим дисклеймером ────────────────────────
describe('AUDIT: pain-monitoring ≤5 днём / <5 утром', () => {
  it('5 днём / 4 утром — зелёный', () => {
    expect(painMonitorVerdict({ during010: 5, nextMorning010: 4 }).level).toBe('green');
  });
  it('3 днём / 5 утром — КРАСНЫЙ (было: жёлтый при m=5..6)', () => {
    const v = painMonitorVerdict({ during010: 3, nextMorning010: 5 });
    expect(v.level).toBe('red');
    expect(v.text).toMatch(/≥5/);
  });
  it('3 днём / 4 утром — не красный', () => {
    expect(painMonitorVerdict({ during010: 3, nextMorning010: 4 }).level).not.toBe('red');
  });
  it('ночная/резкая боль — красный (стоп-сигнал)', () => {
    expect(painMonitorVerdict({ nightPain: true }).level).toBe('red');
    expect(painMonitorVerdict({ sharp: true }).level).toBe('red');
  });
});

// ── 4. YBT: композит по протоколу (3 направления), а не anterior/голень ────
describe('AUDIT: YBT композит считается по протоколу', () => {
  it('только anterior — композит не выдумывается', () => {
    const v = ybtLqVerdict({ antL: 40, antR: 41, shinCm: 48 });
    expect(v.compositePct).toBeNull();
    expect(v.compositeFull).toBe(false);
    expect(v.text).toMatch(/PM\/PL/);
  });
  it('полный ввод — композит (ANT+PM+PL)/(3×конечность)', () => {
    const v = ybtLqVerdict({ antL: 55, antR: 56, pmL: 50, pmR: 51, plL: 50, plR: 51, limbCm: 80 });
    expect(v.compositeFull).toBe(true);
    expect(v.compositePct).toBeCloseTo(64.7, 0);
    expect(v.warn).toBe(true); // <94
  });
  it('асимметрия anterior >4 см — предупреждение', () => {
    const v = ybtLqVerdict({ antL: 58, antR: 64, shinCm: 48 });
    expect(v.warn).toBe(true);
    expect(v.asymCm).toBe(6);
    expect(YBT_ANT_ASYM_CM).toBe(4);
    expect(YBT_COMPOSITE_CUT).toBe(94);
  });
});

// ── 5. Слабость по объёму: direct против ориентиров direct ────────────────
describe('AUDIT: слабость по объёму считается по ПРЯМЫМ сетам', () => {
  const lm = { chest: { mev: 8, mav: 16, mrv: 22 } };
  it('12 indirect-сетов жима без прямых сгибаний — triceps всё ещё слабый', () => {
    // было: effectiveSets (direct + EMG×indirect) сравнивались с ориентирами direct →
    // triceps 5.4 > MEV 4 «не слабый» при нуле прямых сгибаний
    const dirs = detectBBWeakByVolume({ triceps: { directSets: 0, effectiveSets: 5.4 } } as any, 'intermediate');
    expect(dirs.map((c) => c.muscle)).toContain('triceps');
  });
  it('directSets приоритетнее effectiveSets', () => {
    const out = detectBBWeakByVolume({ chest: { directSets: 3, effectiveSets: 30 } } as any, 'intermediate');
    expect(out.length).toBeGreaterThan(0);
  });
});

// ── 6. Окно 28д — от сегодня, а не от последней записи ────────────────────
describe('AUDIT: окна трендаanchored к сегодня', () => {
  const isoAgo = (d: number): string => {
    const x = new Date(); x.setDate(x.getDate() - d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const mk = (date: string, muscle: string, w: number, r: number) => ({ date, exercises: [{ muscleGroup: muscle, sets: [{ weightKg: w, reps: r }] }] });

  it('свежие замеры дают тренд', () => {
    const t = e1rmTrend28d([mk(isoAgo(32), 'chest', 100, 8), mk(isoAgo(1), 'chest', 90, 8)] as any);
    expect(t.chest.deltaPct).toBeLessThan(-5);
  });
  it('замер 30д назад ловится, 45д — нет (границы окна)', () => {
    expect(e1rmTrend28d([mk(isoAgo(30), 'chest', 100, 8), mk(isoAgo(1), 'chest', 100, 8)] as any).chest).toBeDefined();
    expect(e1rmTrend28d([mk(isoAgo(45), 'chest', 100, 8), mk(isoAgo(1), 'chest', 100, 8)] as any).chest).toBeUndefined();
  });
  it('устаревший дневник больше не выдаёт «тренд за 28д»', () => {
    // Сегодня 2026-10-11; записи августа — вне окна → тренда НЕТ (а не «свежий»).
    const t = e1rmTrend28d([mk('2026-08-01', 'chest', 100, 8), mk('2026-08-20', 'chest', 90, 8)] as any);
    expect(t.chest).toBeUndefined();
  });
  it('история объёма: direct-сеты, а не effective', () => {
    // индекс 3 — самая свежая неделя (0–7 дней от сегодня)
    const h = volumeHistory28d([
      { date: isoAgo(2), exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }] }] },
    ] as any);
    expect(h.chest[11]).toBe(2);
  });
});

// ── 7. Причина: нет данных → честная уверенность; генетика не врёт «12 нед» ─
describe('AUDIT: причина не выдумывает данные', () => {
  it('пустой вход → стартовая гипотеза с уверенностью 0.3 (было 0.65)', () => {
    const r = diagnoseWeakCause({ zone: 'chest' });
    expect(r.cause).toBe('volume');
    expect(r.noData).toBe(true);
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });
  it('генетика: «всё окно на MAV», а не недостижимые «12+ нед»', () => {
    const r = diagnoseWeakCause({ zone: 'calves', factHistory: [18, 18, 18, 18], mev: 8, mav: 16, idealDeltaPct: -20, weeksAtMavClean: 4 });
    expect(r.cause).toBe('genetics');
    expect(r.evidence.join(' ')).toMatch(/окно/);
    expect(r.evidence.join(' ')).not.toMatch(/12\+ нед/);
  });
  it(' McCallum: шея = 2.05×запястье (было 2.5 — завышение на 20%)', () => {
    // запястье 17 см → идеал 34.85 (не 42.5): факт 35 см ≈ идеал (±0.5%)
    const d = idealDeltaForZone('traps', { neck: 35 }, 175, 17);
    expect(d).toBeCloseTo(0.4, 1);
    expect(Math.abs(d as number)).toBeLessThan(1);
  });
});

// ── 8. L/R-история: три клика ≠ три замера ────────────────────────────────
describe('AUDIT: L/R снимки дедуплицируются по (группа, дата)', () => {
  it('три клика за день → одна запись', () => {
    // было: каждый клик «→ В ББ-авто» пушил снимок → summarizeLrDirection видел
    // «3 замера подряд» и включал постоянную добивку слабой стороны
    let h = pushLrSnapshot([], { date: '2026-10-11', group: 'quads', weakSide: 'left', asymPct: 10, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-10-11', group: 'quads', weakSide: 'left', asymPct: 10, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-10-11', group: 'quads', weakSide: 'left', asymPct: 10, verdict: 'topup' });
    expect(h.length).toBe(1);
    const d = summarizeLrDirection(h, 'quads');
    expect(d!.persistent).toBe(false);
    expect(d!.text).toMatch(/данных мало/);
  });
  it('разные даты копятся', () => {
    let h = pushLrSnapshot([], { date: '2026-10-01', group: 'quads', weakSide: 'left', asymPct: 10, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-10-08', group: 'quads', weakSide: 'left', asymPct: 12, verdict: 'topup' });
    expect(h.length).toBe(2);
  });
});

// ── 9. Приоритеты: ER:IR — по флагу, а не по парсингу текста ──────────────
describe('AUDIT: приоритеты не парсят текст вердикта', () => {
  it('ER:IR >1.15 попадает в приоритеты (regex про <0.75 его не видел)', () => {
    const out = screenPriorityList({ erIr: { warn: true, text: 'ER/IR 1.2 (>1.15) — нетипично' } });
    expect(out.join(' ')).toMatch(/ER:IR/);
  });
  it('незаполненный драйвер (tested=false) не попадает в приоритеты', () => {
    const out = screenPriorityList({ driver: { driver: 'none', label: 'Скрининг не заполнен', fix: '…', confidence: 0, tested: false } });
    expect(out.join(' ')).not.toMatch(/не заполнен/);
  });
});

// ── 13. W1: плечо — заявленная норма 180° действительно проверяется ───────
describe('AUDIT W1: гониометр плеча проверяется (было: поле мёртвое)', () => {
  it('плечо <180 делает сегмент «руки» честно провальным', () => {
    const clean = { heelsFlat: true, kneeValgus: false, hipBelowParallel: true, trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true };
    const ok = assessOHS({ ...clean, shoulderFlexionDeg: 180 });
    expect(ok.failed).toBe(0);
    expect(ok.shoulderNote).toMatch(/норма/);
    const bad = assessOHS({ ...clean, shoulderFlexionDeg: 150 });
    expect(bad.failed).toBe(1); // без поля было 0
    expect(bad.segments.find((s) => s.segment === 'arm')?.fault).toMatch(/Плечо/);
    expect(bad.shoulderNote).toMatch(/выраженное ограничение/);
  });
  it('без гониометра поведение прежнее (байт-в-байт)', () => {
    const clean = { heelsFlat: true, kneeValgus: false, hipBelowParallel: true, trunkUpright: true, armsOverMidfoot: true, lumbarNeutral: true };
    const r = assessOHS({ ...clean });
    expect(r.failed).toBe(0);
    expect(r.shoulderNote).toBeUndefined();
  });
});

// ── 14. W2/W3: сухожилия из живых входов + история 12 недель ─────────────
describe('AUDIT W2/W3', () => {
  it('tendon-guard: провал плеча в присед-тесте даёт стоп по плечу', () => {
    const sessions = [{ date: '2026-10-10', exercises: [{ exerciseName: 'Жим штанги лёжа', name: 'Жим штанги лёжа', sets: [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }] }] }];
    const g = assessBbTendonGuard(sessions as any, { level: 'intermediate', shoulderOhsFail: true });
    expect(g.shoulder.level).toBe('stop'); // был dead-параметр → 'ok'
    expect(g.shoulder.text).toMatch(/провал плеча/);
  });
  it('tendon-guard: заявленная боль в локте тоже даёт стоп (не только красный PMМ)', () => {
    const sessions = [{ date: '2026-10-10', exercises: [{ exerciseName: 'Подтягивания', name: 'Подтягивания', sets: [{ weightKg: 0, reps: 8 }] }] }];
    const g = assessBbTendonGuard(sessions as any, { level: 'intermediate', elbowPain: true });
    expect(g.elbow.level).toBe('stop');
    expect(g.elbow.text).toMatch(/боль/);
  });
  it('история объёма — 12 недель, свежая неделя последняя', () => {
    const isoAgo = (d: number): string => { const x = new Date(); x.setDate(x.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const h = volumeHistory28d([
      { date: isoAgo(70), exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 50, reps: 10 }] }] },
      { date: isoAgo(0), exercises: [{ muscleGroup: 'chest', sets: [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }] }] },
    ] as any);
    expect(h.chest.length).toBe(12);
    expect(h.chest[1]).toBe(1); // 70д назад = 10-я неделя от конца
    expect(h.chest[11]).toBe(2); // свежая неделя
  });
  it('genetics теперь достижима: «всё окно 12 нед на MAV чисто»', () => {
    // `diagnoseWeakCause` берёт weeksAtMavClean из входа — hub-сборка считает его
    // из истории (assembleWeakCauseInput → weeksAtMav), теперь истории хватает.
    const hist = Array.from({ length: 12 }, () => 18);
    expect(weeksAtMav(hist, 16)).toBe(12);
    const r = diagnoseWeakCause({ zone: 'calves', factHistory: hist, mev: 8, mav: 16, idealDeltaPct: -20, weeksAtMavClean: 12 });
    expect(r.cause).toBe('genetics');
    expect(r.evidence.join(' ')).toMatch(/12 нед/);
  });
});

// ── 15. W5: мост несёт честный статус, но НЕ канал нагрузки ──────────────
describe('AUDIT W5: статус диагностики в мосте — info, не нагрузка', () => {
  it('diagStatus: «скрининг не пройден» / «метрик восстановления нет» → биты', () => {
    const r = resolveBbDiagIntakeExtras({
      movementDriver: { driver: 'none', label: 'Скрининг не заполнен', fix: '', confidence: 0 },
      diagStatus: { screenTouched: false, readinessLevel: 'yellow', readinessNoData: true, ybtCompositeFull: false },
      ybt: { text: 'YBT: не замерялся' },
    });
    expect(r.bits.join(' ')).toMatch(/скрининг не пройден/);
    expect(r.bits.join(' ')).toMatch(/метрики восстановления не введены/);
    // сборку не трогаем: в persist нет ничего, кроме info
    expect(r.persist.movementExtra?.readiness).toMatch(/не введены/);
  });
  it('legacy-каналы (readiness/redFlags/lvp) по-прежнему не шлются — только diagStatus', () => {
    const r = resolveBbDiagIntakeExtras({ diagStatus: { screenTouched: true, readinessLevel: 'green', readinessNoData: false, ybtCompositeFull: true } });
    expect(r.bits.join(' ')).not.toMatch(/скрининг не пройден/);
  });
});
describe('AUDIT: готовность больше не выдаёт пустую замер за зелёный', () => {
  it('ни одного ввода - желтый с пометой noData (было: зеленый)', () => {
    const r = assessBbReadiness({});
    expect(r.tested).toBe(false);
    expect(r.noData).toBe(true);
    expect(r.level).toBe('yellow'); // не red: резать вставку без оснований нельзя
    expect(r.reasons.join(' ')).toMatch(/не введены/);
  });
  it('«боли нет» (pain010: 0) — это ДАННЫЕ, зелёный сохраняется', () => {
    const r = assessBbReadiness({ sleepHours: 8, pain010: 0 });
    expect(r.tested).toBe(true);
    expect(r.level).toBe('green');
  });
  it('пустой ACWR (null) ≠ «0 перегруженных»', () => {
    expect(assessBbReadiness({ sleepHours: 8, dangerMuscles: null }).tested).toBe(true);
    expect(assessBbReadiness({ dangerMuscles: 0 }).level).toBe('yellow');
    expect(assessBbReadiness({ dangerMuscles: 0 }).tested).toBe(false);
    expect(assessBbReadiness({ dangerMuscles: 2 }).level).toBe('red');
  });
  it('реальный день без замечаний — зелёный и протестирован', () => {
    const r = assessBbReadiness({ sleepHours: 8, pain010: 1, vbtLossPct: 5 });
    expect(r.level).toBe('green');
    expect(r.tested).toBe(true);
  });
});

// ── 12. Merge: источник надёжнее «более отрицательной оценки» ─────────────
describe('AUDIT: merge кандидатов выбирает по надёжности источника', () => {
  it('окружность (−40%) не побеждает измеренный объём (−10%)', () => {
    // было: победитель = самая отрицательная deltaPct → оценка по пропорциям
    // вытесняла реальный объём-факт
    const out = mergeBBWeakCandidates(
      [{ muscle: 'chest', reason: 'объём', deltaPct: -10, source: 'volume' }],
      [],
      [{ muscle: 'chest', reason: 'Reeves', deltaPct: -40, source: 'circumf' }],
    );
    expect(out[0].source).toBe('volume');
  });
  it('e1RM важнее окружности', () => {
    const out = mergeBBWeakCandidates(
      [],
      [{ muscle: 'back', reason: 'e1RM', deltaPct: -20, source: 'e1rm' }],
      [{ muscle: 'back', reason: 'Reeves', deltaPct: -50, source: 'circumf' }],
    );
    expect(out[0].source).toBe('e1rm');
  });
});
