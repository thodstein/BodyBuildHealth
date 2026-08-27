import { describe, it, expect } from 'vitest';
import { parseCardioCsv, parseCardioTcx, parseCardioGpx, parseDateFlexible, parseDurationFlexible, mapActivityToCardioType } from '../cardio-import.engine';

describe('cardio-import fuzz — date/duration/type', () => {
  it('parseDateFlexible — все форматы', () => {
    expect(parseDateFlexible('2026-08-28')).toBe('2026-08-28');
    expect(parseDateFlexible('28.08.2026')).toBe('2026-08-28');
    expect(parseDateFlexible('08/28/2026')).toBe('2026-08-28');
    expect(parseDateFlexible('2026/08/28')).toBe('2026-08-28');
    expect(parseDateFlexible('')).toBeNull();
    expect(parseDateFlexible('not-a-date')).toBeNull();
  });
  it('parseDurationFlexible — числа/секунды/h:m:s', () => {
    expect(parseDurationFlexible('30')).toBe(30);
    expect(parseDurationFlexible('1800')).toBe(30); // секунды
    expect(parseDurationFlexible('00:30:00')).toBe(30);
    expect(parseDurationFlexible('1:30:00')).toBe(90);
    expect(parseDurationFlexible('30 min')).toBe(30);
    expect(parseDurationFlexible('')).toBeNull();
  });
  it('mapActivityToCardioType — приоритеты', () => {
    expect(mapActivityToCardioType('HIIT workout')).toBe('hiit');
    expect(mapActivityToCardioType('Recovery run')).toBe('recovery');
    expect(mapActivityToCardioType('Threshold tempo')).toBe('miss');
    expect(mapActivityToCardioType('Easy run')).toBe('zone2');
  });
});

describe('CSV fuzz', () => {
  it('пустой файл → warning', () => {
    const r = parseCardioCsv('', 'a.csv');
    expect(r.entries).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('валидный CSV с 2 строками', () => {
    const csv = 'date,duration,distance,hr\n2026-08-27,30,5,150\n2026-08-28,45,7,140';
    const r = parseCardioCsv(csv, 't.csv');
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].durationMin).toBe(30);
  });
  it('дедуп по date|type|duration', () => {
    const csv = 'date,duration\n2026-08-27,30\n2026-08-27,30';
    const r = parseCardioCsv(csv, 't.csv');
    expect(r.entries).toHaveLength(1);
    expect(r.warnings.some(w => w.includes('дублей'))).toBe(true);
  });
  it('разделитель ; и ,', () => {
    const csv1 = 'date;duration\n2026-08-27;30';
    const csv2 = 'date,duration\n2026-08-27,30';
    expect(parseCardioCsv(csv1, 'a.csv').entries).toHaveLength(1);
    expect(parseCardioCsv(csv2, 'a.csv').entries).toHaveLength(1);
  });
});

describe('TCX fuzz', () => {
  it('пустой → warning', () => {
    const r = parseCardioTcx('');
    expect(r.entries).toHaveLength(0);
  });
  it('валидный TCX Lap', () => {
    const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap StartTime="2026-08-27T06:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm><Calories>300</Calories></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const r = parseCardioTcx(tcx);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].durationMin).toBe(30);
    expect(r.entries[0].distanceKm).toBe(5);
  });
  it('битый XML → warning, не throw', () => {
    const r = parseCardioTcx('<broken>');
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(() => parseCardioTcx('<broken>')).not.toThrow();
  });
});

describe('GPX fuzz', () => {
  it('пустой → warning', () => {
    const r = parseCardioGpx('');
    expect(r.entries).toHaveLength(0);
  });
  it('валидный GPX с 2 точками', () => {
    const gpx = `<gpx><trk><name>Test</name><trkseg><trkpt lat="55" lon="37"><time>2026-08-27T06:00:00Z</time></trkpt><trkpt lat="55.001" lon="37.001"><time>2026-08-27T06:30:00Z</time></trkpt></trkseg></trk></gpx>`;
    const r = parseCardioGpx(gpx);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].durationMin).toBe(30);
  });
});
