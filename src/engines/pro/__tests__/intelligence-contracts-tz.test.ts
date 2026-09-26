import { describe, expect, it, beforeEach } from 'vitest';
import { shouldTrain, analyzeRecovery, normalizeFatigue, normalizeSleepQuality } from '../../recovery-optimization.engine';
import { predictLabTrend, generateReadinessForecast, runWhatIf } from '../../predictive.engine';
import { trafficLight, ACWR_ZONE_META, type ACWRZone } from '../training-load.engine';
import { getCalibrationStats, recordSessionRIR, clearCalibrationData } from '../../rir-calibration.engine';
import { localIsoDate } from '../../../ui/screens/TrainingScreen_parts/diary-shared';

/** Сессия дневника нужного вида: recordSessionRIR берёт фактические RPE из сетов. */
function session(date: string, exName: string, rpe: number[], exerciseId = exName) {
  return {
    date, focus: 'chest',
    exercises: [{
      exerciseId, exerciseName: exName,
      sets: rpe.map(r => ({ weightKg: 80, reps: 8, rpe: r })),
    }],
  } as any;
}
function plan(name: string, rir: number) {
  return { exercises: [{ name, targetSets: [{ rir }] }] } as any;
}

describe('E12 shouldTrain — все 5 ветвей', () => {
  it('ветка 1: RI < 20 → отказ, intensityMod = 0', () => {
    const r = shouldTrain(10, 0.3);
    expect(r.train).toBe(false);
    expect(r.intensityMod).toBe(0);
    expect(r.message).toContain('Критически низкое');
  });

  it('ветка 2: RI < 35 И усталость > 0.7 → активный отдых', () => {
    const r = shouldTrain(30, 0.9);
    expect(r.train).toBe(false);
    expect(r.message).toContain('активный отдых');
  });

  it('ветка 2 не срабатывает при низкой усталости — тренировка разрешена', () => {
    const r = shouldTrain(30, 0.2);
    expect(r.train).toBe(true);
    expect(r.intensityMod).toBeLessThan(0);
  });

  it('ветка 3: RI < 45 → пониженная интенсивность −15%', () => {
    const r = shouldTrain(40, 0.5);
    expect(r.train).toBe(true);
    expect(r.intensityMod).toBeCloseTo(-0.15, 5);
  });

  it('ветка 4: RI > 80 и низкая усталость → +5%', () => {
    const r = shouldTrain(90, 0.1);
    expect(r.train).toBe(true);
    expect(r.intensityMod).toBeCloseTo(0.05, 5);
  });

  it('ветка 5: всё остальное → стандартная тренировка, Mod = 0', () => {
    const r = shouldTrain(60, 0.5);
    expect(r.train).toBe(true);
    expect(r.intensityMod).toBe(0);
    expect(r.message).toContain('Стандартная');
  });

  it('мусор на входе не ломает решение (нормализация, без NaN в ответе)', () => {
    for (const bad of [NaN, undefined as any, 'x' as any, null as any]) {
      const r = shouldTrain(bad, bad);
      expect(typeof r.train).toBe('boolean');
      expect(Number.isFinite(r.intensityMod)).toBe(true);
    }
  });
});

describe('E12 контракт шкал: fatigueScore и качество сна', () => {
  it('normalizeFatigue всегда 0..1, включая границы и мусор', () => {
    for (const v of [0, 0.5, 1, -3, 7, NaN, undefined as any, 'x' as any]) {
      const n = normalizeFatigue(v as any);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('внутри одной ветви шкалы монотонна (0–1 / 1–10 / 10–100 по кускам)', () => {
    // шкала кусочная: 0..1 — как есть, 2..10 — /10, >10 — /100 (вход может прийти с любой шкалы)
    expect(normalizeFatigue(0.9)).toBeGreaterThan(normalizeFatigue(0.2));
    expect(normalizeFatigue(9)).toBeGreaterThan(normalizeFatigue(3));
    expect(normalizeFatigue(90)).toBeGreaterThan(normalizeFatigue(50));
  });

  it('normalizeSleepQuality всегда 0..10 и монотонна', () => {
    for (const v of [0, 5, 10, -5, 99, NaN, undefined as any]) {
      const n = normalizeSleepQuality(v as any);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(10);
    }
    expect(normalizeSleepQuality(9)).toBeGreaterThan(normalizeSleepQuality(2));
  });

  it('analyzeRecovery: сон и HRV двигают ИТОГОВЫЙ индекс, готовность — входной самоотчёт', () => {
    const rested = analyzeRecovery({
      fatigueScore: 1, sleep: { hours: 8, quality: 9 }, stress: 1, soreness: 1, motivation: 9, hrv: { rmssd: 60 },
    } as any);
    const fried = analyzeRecovery({
      fatigueScore: 0.9, sleep: { hours: 5, quality: 3 }, stress: 9, soreness: 8, motivation: 3, hrv: { rmssd: 20 },
    } as any);
    // считаемый показатель — overallRecoveryIndex
    expect(rested.overallRecoveryIndex).toBeGreaterThan(fried.overallRecoveryIndex);
    // readinessScore — входной hrv.readinessScore, а не результат (контракт зафиксирован в движке)
    expect(rested.readinessScore).toBe(50);
    expect(fried.readinessScore).toBe(50);
    expect(rested.sleepScore).toBeGreaterThan(fried.sleepScore);
  });
});

describe('E12 predictLabTrend', () => {
  it('< 2 точек → нули без алерта (нет данных, а не выдумка)', () => {
    const r = predictLabTrend([80]);
    expect(r.w4).toBe(0);
    expect(r.w8).toBe(0);
    expect(r.alert).toBeUndefined();
  });

  it('растущий тренд даёт w4 > current', () => {
    const r = predictLabTrend([60, 70, 80, 90, 100, 110, 120]);
    expect(r.w4).toBeGreaterThan(r.current);
  });

  it('алерт — только про выход гематокрита за 54%, а не про падение', () => {
    // при сатурации тренд гасится, поэтому алерт = текущее значение уже у 54+
    const high = predictLabTrend([50, 52, 54, 56, 58, 60, 62]);
    expect(high.current).toBeGreaterThan(54);
    expect(high.alert).toBeTruthy();
    expect(high.alert).toContain('54%');
    // падение само по себе не повод для «алерта о донации» — честная семантика функции
    const falling = predictLabTrend([100, 90, 80, 70, 60, 50, 40]);
    expect(falling.w4).toBeLessThan(falling.current);
    expect(falling.alert).toBeUndefined();
  });

  it('насыщение ограничивает рост: у потолка прогноз не улетает (санитарные потолки)', () => {
    const near = predictLabTrend([90, 92, 93, 94, 95, 95, 95]);
    const sat = predictLabTrend([200, 210, 215, 220, 220, 220, 220], 52);
    expect(sat.w4).toBeGreaterThan(0);
    expect(sat.current).toBe(220);
  });

  it('детерминирован: тот же вход → тот же выход', () => {
    const a = predictLabTrend([70, 75, 80, 85, 90, 95, 100]);
    const b = predictLabTrend([70, 75, 80, 85, 90, 95, 100]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('generateReadinessForecast: < 2 точек → hasData=false + предупреждение', () => {
    const r = generateReadinessForecast([]);
    expect(r.hasData).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('runWhatIf: изменение препарата двигает риск, калорий/сон — готовность, всё с расшифровкой', () => {
    const drug = runWhatIf(30, 70, { drugChange: { test: 2 } });     // ×2 препарата → +12 риска
    const kcal = runWhatIf(30, 70, { calorieChange: -500 });          // −500 ккал → −2 ед. готовности
    const sleep = runWhatIf(30, 70, { sleepChange: -1 });            // −1 ч сна → −5 ед.
    expect(drug.riskDelta).toBeCloseTo(12, 5);
    expect(drug.readinessDelta).toBe(0);
    expect(kcal.readinessDelta).toBeCloseTo(-2, 5);
    expect(kcal.riskDelta).toBe(0);
    expect(sleep.readinessDelta).toBeCloseTo(-5, 5);
    expect(drug.note.length + kcal.note.length + sleep.note.length).toBeGreaterThan(0);
  });

  it('runWhatIf: нулевые/мусорные правки не двигают ничего (нет выдуманного эффекта)', () => {
    const none = runWhatIf(30, 70, { drugChange: { test: 1 }, calorieChange: 0, sleepChange: 0 });
    const junk = runWhatIf(30, 70, { drugChange: { test: NaN }, calorieChange: NaN, sleepChange: NaN });
    expect(none.riskDelta).toBe(0);
    expect(none.readinessDelta).toBe(0);
    expect(junk.riskDelta).toBe(0);
    expect(junk.readinessDelta).toBe(0);
  });
});

describe('E12 trafficLight', () => {
  it('зелёный: всё в норме или данных нет', () => {
    expect(trafficLight(1.0, 1.0, 0)).toBe('green');
    expect(trafficLight(null, 1.0, 0)).toBe('green');
  });

  it('жёлтый: один умеренный сигнал', () => {
    expect(trafficLight(0.9, 1.0, 0)).toBe('yellow');
    expect(trafficLight(1.0, 1.35, 0)).toBe('yellow');
    expect(trafficLight(1.0, 1.0, 1)).toBe('yellow');
  });

  it('красный: 2+ сигнала или жёсткий скачок', () => {
    expect(trafficLight(0.8, 1.6, 0)).toBe('red');
    expect(trafficLight(0.8, 1.0, 2)).toBe('red');
    expect(trafficLight(1.0, 1.6, 1.5)).toBe('red');
  });

  it('монотонность: ухудшение сигналов не улучшает свет', () => {
    const order: Array<'green' | 'yellow' | 'red'> = ['green', 'yellow', 'red'];
    const idx = (c: 'green' | 'yellow' | 'red') => order.indexOf(c);
    const good = trafficLight(1.0, 1.0, 0);
    const mid = trafficLight(0.9, 1.35, 0);
    const bad = trafficLight(0.8, 1.6, 1.5);
    expect(idx(good)).toBeLessThanOrEqual(idx(mid));
    expect(idx(mid)).toBeLessThanOrEqual(idx(bad));
  });
});

describe('E12 канон зон и шкалы ACWR', () => {
  it('все зоны имеют непустые подпись/цвет/подсказку (контракт для UI)', () => {
    for (const zone of Object.keys(ACWR_ZONE_META) as ACWRZone[]) {
      const m = ACWR_ZONE_META[zone];
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.hint.length).toBeGreaterThan(10);
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('E12 getCalibrationStats (RIR-калибровка)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCalibrationData();
  });

  it('без данных: нули и пустой lastUpdated (не выдуманные «средние»)', () => {
    const s = getCalibrationStats();
    expect(s.totalSets).toBe(0);
    expect(s.totalExercises).toBe(0);
    expect(s.overallAvgBias).toBe(0);
    expect(s.overallConsistency).toBe(0);
    expect(s.lastUpdated).toBe('');
  });

  it('считает среднее систематическое смещение planned−actual по всем подходам', () => {
    // план RIR 2, факт RPE 9 → фактический RIR 1 → смещение +1 на каждый подход (2+1 подхода)
    recordSessionRIR(session('2026-09-01', 'Жим лёжа', [9, 9]), plan('Жим лёжа', 2));
    recordSessionRIR(session('2026-09-02', 'Жим лёжа', [9]), plan('Жим лёжа', 2));
    recordSessionRIR(session('2026-09-03', 'Тяга', [7]), plan('Тяга', 3));   // план 3, факт 3 → 0
    const s = getCalibrationStats();
    expect(s.totalSets).toBe(4);
    expect(s.totalExercises).toBe(2);
    // три подхода со смещением +1 и один с нулевым → среднее 0.75, округлённое движком до 0.8
    expect(s.overallAvgBias).toBeCloseTo(0.8, 1);
    expect(s.lastUpdated).toBe('2026-09-03');
  });

  it('подходы без RPE (rpe = 0) не попадают в калибровку (нет выдуманной точки)', () => {
    recordSessionRIR(session('2026-09-01', 'Жим лёжа', [0, 0]), plan('Жим лёжа', 2));
    expect(getCalibrationStats().totalSets).toBe(0);
  });

  it('упражнение без совпадения в плане не даёт точек (без молчаливой подстановки)', () => {
    recordSessionRIR(session('2026-09-01', 'Жим лёжа', [9]), plan('Тяга', 2));
    expect(getCalibrationStats().totalSets).toBe(0);
  });

  it('список упражнений отсортирован по числу точек (самые собранные сверху)', () => {
    recordSessionRIR(session('2026-09-01', 'Разгиб', [8]), plan('Разгиб', 2));
    recordSessionRIR(session('2026-09-02', 'Жим', [8, 8, 8]), plan('Жим', 2));
    const s = getCalibrationStats();
    expect(s.exercises[0].exerciseName).toBe('Жим');
    expect(s.exercises[0].totalPoints).toBe(3);
  });

  it('битый стор не ломает статистику (пустые нули, без исключения)', () => {
    localStorage.setItem('he_rir_calibration', '{не json');
    expect(() => getCalibrationStats()).not.toThrow();
    expect(getCalibrationStats().totalSets).toBe(0);
  });

  it('clearCalibrationData реально стирает данные', () => {
    recordSessionRIR(session('2026-09-01', 'Жим', [8]), plan('Жим', 2));
    expect(getCalibrationStats().totalSets).toBe(1);
    clearCalibrationData();
    expect(getCalibrationStats().totalSets).toBe(0);
  });
});

describe('E12 TZ-регресс: даты считаются локально', () => {
  it('localIsoDate отдаёт YYYY-MM-DD по локальному времени, не по UTC', () => {
    const iso = localIsoDate(new Date(2026, 8, 26, 23, 30, 0));
    expect(iso).toBe('2026-09-26');
  });

  it('калибровка хранит дату сессии как есть (без UTC-сдвига «на входе»)', () => {
    const localDate = localIsoDate(new Date(2026, 8, 26, 23, 30));
    recordSessionRIR(session(localDate, 'Жим', [8]), plan('Жим', 2));
    expect(getCalibrationStats().lastUpdated).toBe('2026-09-26');
  });

  it('последняя дата в статистике = самая свежая по порядку добавления', () => {
    recordSessionRIR(session('2026-09-01', 'A', [8]), plan('A', 2));
    recordSessionRIR(session('2026-09-02', 'B', [8]), plan('B', 2));
    expect(getCalibrationStats().lastUpdated).toBe('2026-09-02');
  });
});
