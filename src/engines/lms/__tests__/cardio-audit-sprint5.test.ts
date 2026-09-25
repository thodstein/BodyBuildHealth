/**
 * cardio-audit-sprint5.test.ts — научный слой (TID по факту, дисциплина, provenance).
 *
 * Спринт 5 закрывает 3 P1-разрыва, найденных в аудите:
 *  1. TID считался ТОЛЬКО по типам сессий в плане (recovery/zone2→Z1, miss→Z2,
 *     hiit→Z3) — дневник с фактическим HR игнорировался, план выдавался за факт.
 *  2. Калибровка пульса у бега и вела разная, а дневник вообще не хранил
 *     дисциплину → «фактический TID» смешивал несовместимые калибровки.
 *  3. Не было provenance: не отличить ручную запись от импорта, и не видно,
 *     когда запись обновляли.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  tidZoneOfHr, factTimeInZones, tidPlanVsFact,
  TID_HR_BOUNDS_PCT_LTHR, TID_HR_BOUNDS_PCT_MAXHR,
} from '../cardio-tid.engine';
import {
  loadCardioLog, saveCardioLogEntry, sanitizeCardioSport,
  CARDIO_SPORT_RU, CARDIO_SPORTS, CARDIO_LOG_KEY,
} from '../cardio-diary.engine';
import { parseCardioTcx, parseCardioGpx, parseCardioJson } from '../../cardio-import.engine';
import type { CardioLogEntry, CardioSport } from '../cardio-diary.engine';
import type { CardioCycle, CardioType } from '../cardio.engine';

const cyc = (spec: Partial<CardioCycle>['weeks'][number] extends never ? never : Partial<CardioCycle>): CardioCycle => ({
  id: 'c1', goal: 'health', level: 'intermediate', startDate: '2026-09-01',
  phase: 'base', weeks: [], ...spec,
} as CardioCycle);

const week = (sessions: { type: CardioType; min: number; freq?: number }[]) => ({
  week: 1, phase: 'base', isDeload: false, sessions: sessions.map(s => ({
    type: s.type, durationMin: s.min, weeklyFrequency: s.freq ?? 1, zone: 'z2' as const, focus: 'aerobic' as const,
  })),
});

const fact = (o: Partial<{ sport: CardioSport; type: CardioType; min: number; hr: number; done: boolean }>) => ({
  date: '2026-09-10', type: o.type ?? 'zone2', durationMin: o.min ?? 30,
  avgHr: o.hr, completed: o.done ?? true, sport: o.sport,
});

beforeEach(() => { localStorage.clear(); });

describe('S5.1 — TID по фактическому HR, а не по типу сессии', () => {
  it('пороги по LTHR: Z1 <81, Z2 81-89, Z3 ≥89 %LTHR', () => {
    // LTHR 172: 130 уд = 75.6% → Z1; 145 = 84.3% → Z2; 168 = 97.7% → Z3; 170 → тоже Z3
    expect(tidZoneOfHr(130, { lthr: 172 }).zone).toBe(1);
    expect(tidZoneOfHr(145, { lthr: 172 }).zone).toBe(2);
    expect(tidZoneOfHr(168, { lthr: 172 }).zone).toBe(3);
    expect(tidZoneOfHr(170, { lthr: 172 }).zone).toBe(3);
    expect(TID_HR_BOUNDS_PCT_LTHR.z2[0]).toBe(81);
  });

  it('без LTHR — пороги по %ЧССмакс (age/sex через канон maxHrClassic)', () => {
    // 35 лет муж: 220-35 = 185.  Z1 <70% (<129.5), Z2 70-85% (129.5-157), Z3 ≥85% (>157)
    expect(tidZoneOfHr(120, { age: 35, sex: 'male' }).zone).toBe(1);
    expect(tidZoneOfHr(140, { age: 35, sex: 'male' }).zone).toBe(2);
    expect(tidZoneOfHr(165, { age: 35, sex: 'male' }).zone).toBe(3);
    expect(TID_HR_BOUNDS_PCT_MAXHR.z2[1]).toBe(85);
    // пол меняет ЧССмакс (Ж: 226-35 = 191) → те же 140 уд = 73.3% → Z2,
    // а 125 уд = 65.4% → Z1 (у мужчины 125 уд = 67.6% → тоже Z1)
    expect(tidZoneOfHr(125, { age: 35, sex: 'female' }).zone).toBe(1);
    expect(tidZoneOfHr(125, { age: 35, sex: 'male' }).zone).toBe(1);
    expect(tidZoneOfHr(150, { age: 35, sex: 'male' }).zone).toBe(2);   // 81.1%
    // возраст двигает границу: те же 150 уд — 50 лет (ЧССмакс 170) = 88.2% → уже Z3
    expect(tidZoneOfHr(150, { age: 50, sex: 'male' }).zone).toBe(3);
  });

  it('сессия без HR не попадает в зону (не «не знаем» = «зона 1»)', () => {
    const f = factTimeInZones([fact({ min: 60, hr: 0 as any })], { lthr: 170 });
    expect(f.byHr).toBe(0);
    expect(f.skipped).toBe(1);
    expect(f.totalMin).toBe(0);
    expect(f.note).toContain('Нет ни одной сессии со средним HR');
  });

  it('факт считается по HR, а не по типу: тип zone2 с высоким HR → Z3', () => {
    const f = factTimeInZones([fact({ type: 'zone2', min: 30, hr: 170 })], { lthr: 165 });
    expect(f.z3Min).toBe(30);
    expect(f.z1Min).toBe(0);
    expect(f.pct.z3).toBe(100);
  });

  it('незавершённые сессии не входят в факт', () => {
    const f = factTimeInZones(
      [fact({ min: 30, hr: 130 }), fact({ min: 45, hr: 130, done: false })],
      { lthr: 170 },
    );
    expect(f.z1Min).toBe(30);
    expect(f.totalMin).toBe(30);
  });

  it('любой валидный HR попадает в зону (Z1 с 0% — «фолбэк по типу» был бы мёртвым)', () => {
    // Раньше здесь был «фолбэк по типу сессии», но Z1 начинается с 0% референса,
    // поэтому zone=null возможен только без HR — ветка была недостижимой.
    const low = tidZoneOfHr(100, { lthr: 170 });
    expect(low.zone).toBe(1);
    const f = factTimeInZones([fact({ min: 20, hr: 100 })], { lthr: 170 });
    expect(f.byHr).toBe(1);
    expect(f.skipped).toBe(0);
    expect(f.z1Min).toBe(20);
  });

  it('пустой дневник → totalMin 0 без исключений', () => {
    expect(factTimeInZones([], { lthr: 170 }).totalMin).toBe(0);
    expect(factTimeInZones(null as any, { lthr: 170 }).totalMin).toBe(0);
  });
});

describe('S5.1 — сверка «план vs факт»', () => {
  const cycle = cyc({ weeks: [week([{ type: 'zone2', min: 40 }, { type: 'hiit', min: 10 }])] as any });

  it('расхождение считается и вердикт честный', () => {
    const r = tidPlanVsFact(cycle, [
      fact({ min: 40, hr: 130, sport: 'run' }),
      fact({ type: 'hiit', min: 10, hr: 175, sport: 'run' }),
    ], { lthr: 170 });
    expect(r.comparable).toBe(true);
    expect(r.fact.byHr).toBe(2);
    expect(r.drift).toBeGreaterThanOrEqual(0);
    expect(r.verdict.length).toBeGreaterThan(10);
  });

  it('без факта сверка НЕ сравнима — план не выдаётся за факт', () => {
    const r = tidPlanVsFact(cycle, [fact({ min: 30, hr: 0 as any })], { lthr: 170 });
    expect(r.comparable).toBe(false);
    expect(r.verdict).toContain('план нельзя выдавать за факт');
  });
});

describe('S5.2 — дисциплина: бег и вело нельзя смешивать', () => {
  const cycle = cyc({ weeks: [week([{ type: 'zone2', min: 30 }])] as any });

  it('смешанный дневник помечается mixed и даёт честный отказ', () => {
    const r = tidPlanVsFact(cycle, [
      fact({ min: 30, hr: 150, sport: 'run' }),
      fact({ min: 30, hr: 150, sport: 'bike' }),
    ], { lthr: 160 });
    expect(r.mixed).toBe(true);
    expect(r.sportsInLog.sort()).toEqual(['bike', 'run']);
    expect(r.verdict).toContain('разная калибровка пульса');
  });

  it('одна дисциплина — mixed=false', () => {
    const r = tidPlanVsFact(cycle, [fact({ min: 30, hr: 150, sport: 'bike' })], { lthr: 160 });
    expect(r.mixed).toBe(false);
  });

  it('legacy-записи без дисциплины не считаются «смесью»', () => {
    const r = tidPlanVsFact(cycle, [
      fact({ min: 30, hr: 150, sport: 'run' }),
      fact({ min: 20, hr: 150 }),
    ], { lthr: 160 });
    expect(r.mixed).toBe(false);
    expect(r.sportsInLog.sort()).toEqual(['other', 'run']);
  });

  it('санация дисциплины: синонимы → канон, мусор → other', () => {
    expect(sanitizeCardioSport('Running')).toBe('run');
    expect(sanitizeCardioSport('Biking')).toBe('bike');
    expect(sanitizeCardioSport('бег')).toBe('run');
    expect(sanitizeCardioSport('велосипед')).toBe('bike');
    expect(sanitizeCardioSport('что-то странное')).toBe('other');
    expect(sanitizeCardioSport(undefined)).toBe('other');
    expect(sanitizeCardioSport(42)).toBe('other');
  });

  it('у каждой дисциплины есть RU-подпись', () => {
    for (const s of CARDIO_SPORTS) expect(CARDIO_SPORT_RU[s]).toBeTruthy();
  });
});

describe('S5.3 — provenance в дневнике', () => {
  const base = (): CardioLogEntry => ({
    id: 'e1', date: '2026-09-10', type: 'zone2', durationMin: 30, completed: true,
  });

  it('сохранение проставляет updatedAt', () => {
    saveCardioLogEntry(base());
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(typeof log[0].updatedAt).toBe('string');
    expect(log[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('чтение нормализует мусорные sport/source', () => {
    localStorage.setItem(CARDIO_LOG_KEY, JSON.stringify([
      { ...base(), sport: 'хзз', source: 'hack' },
      { ...base(), id: 'e2', sport: 'bike', source: 'import' },
    ]));
    const log = loadCardioLog();
    const byId = Object.fromEntries(log.map(e => [e.id, e]));
    expect(byId.e1.sport).toBe('other');
    expect(byId.e1.source).toBe('manual');   // мусор не выдаём за «взлом»
    expect(byId.e2.sport).toBe('bike');
    expect(byId.e2.source).toBe('import');
  });

  it('битый стор → пустой дневник без исключения', () => {
    localStorage.setItem(CARDIO_LOG_KEY, '{{{');
    expect(loadCardioLog()).toEqual([]);
  });
});

describe('S5.2/5.3 — импорт несёт дисциплину и provenance', () => {
  it('TCX: Sport="Biking" → спорт bike + source import', () => {
    const tcx = `<?xml version="1.0"?>
<TrainingCenterDatabase><Activities><Activity Sport="Biking">
<Training><Plan><Name>ride</Name></Plan><Lap StartTime="2026-09-10T06:00:00.000Z">
<TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>20000</DistanceMeters>
<Calories>500</Calories>
<HeartRateBpm><Value>148</Value></HeartRateBpm>
</Lap></Training></Activity></Activities></TrainingCenterDatabase>`;
    const r = parseCardioTcx(tcx);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].sport).toBe('bike');
    expect(r.entries[0].source).toBe('import');
    expect(r.entries[0].avgHr).toBe(148);
  });

  it('GPX: тип трека сохраняет дисциплину', () => {
    const gpx = `<?xml version="1.0"?>
<gpx><trk><type>running</type><name>утро</name><trkseg>
<trkpt lat="55.75" lon="37.61"><time>2026-09-10T06:00:00.000Z</time></trkpt>
<trkpt lat="55.76" lon="37.62"><time>2026-09-10T06:30:00.000Z</time></trkpt>
</trkseg></trk></gpx>`;
    const r = parseCardioGpx(gpx);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].sport).toBe('run');
    expect(r.entries[0].source).toBe('import');
  });

  it('JSON: sport из поля пробрасывается', () => {
    const r = parseCardioJson(JSON.stringify([
      { date: '2026-09-10', type: 'zone2', duration_min: 2400, sport: 'bike' },
    ]));
    expect(r.entries[0].sport).toBe('bike');
    expect(r.entries[0].source).toBe('import');
  });
});
