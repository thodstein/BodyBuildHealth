import { describe, it, expect } from 'vitest';
import {
  parseDateFlexible,
  parseDurationFlexible,
  mapActivityToCardioType,
  parseCardioCsv,
  parseCardioTcx,
  parseCardioGpx,
  parseAppleHealthXml,
  parseCardioJson,
  parseCardioFit,
  parseCardioImport,
} from '../cardio-import.engine';

describe('cardio-import — date flexible', () => {
  it('parses ISO and EU formats', () => {
    expect(parseDateFlexible('2024-08-20')).toBe('2024-08-20');
    expect(parseDateFlexible('2024/08/20')).toBe('2024-08-20');
    expect(parseDateFlexible('20.08.2024')).toBe('2024-08-20');
    expect(parseDateFlexible('20-08-2024 14:30')).toBe('2024-08-20');
    expect(parseDateFlexible('08/20/2024')).toBe('2024-08-20');
    expect(parseDateFlexible('2024-08-20T14:30:00Z')).toBe('2024-08-20');
  });
  it('returns null for invalid', () => {
    expect(parseDateFlexible('')).toBeNull();
    expect(parseDateFlexible('not a date')).toBeNull();
  });
});

describe('cardio-import — duration flexible', () => {
  it('parses minutes and hh:mm:ss', () => {
    expect(parseDurationFlexible('30')).toBe(30);
    expect(parseDurationFlexible('30 min')).toBe(30);
    expect(parseDurationFlexible('00:30:00')).toBe(30);
    expect(parseDurationFlexible('1:00:00')).toBe(60);
    expect(parseDurationFlexible('01:30:00')).toBe(90);
    expect(parseDurationFlexible('1800')).toBe(30); // seconds
    expect(parseDurationFlexible('1800s')).toBe(30);
  });
  it('parses comma decimal', () => {
    expect(parseDurationFlexible('30,5')).toBe(31);
  });
});

describe('cardio-import — type mapping', () => {
  it('maps activities to CardioType', () => {
    expect(mapActivityToCardioType('Run')).toBe('zone2');
    expect(mapActivityToCardioType('Бег')).toBe('zone2');
    expect(mapActivityToCardioType('HIIT Interval')).toBe('hiit');
    expect(mapActivityToCardioType('Интервальная')).toBe('hiit');
    expect(mapActivityToCardioType('Recovery walk')).toBe('recovery');
    expect(mapActivityToCardioType('Tempo run')).toBe('miss');
    expect(mapActivityToCardioType('')).toBe('zone2');
  });
});

describe('cardio-import — CSV', () => {
  it('parses generic CSV with header', () => {
    const csv = `date,duration,distance,hr,calories,type
2024-08-20,30,5,145,300,Run
2024-08-21,45,7.5,150,400,HIIT
`;
    const r = parseCardioCsv(csv);
    expect(r.entries.length).toBe(2);
    expect(r.entries[0].date).toBe('2024-08-20');
    expect(r.entries[0].durationMin).toBe(30);
    expect(r.entries[0].distanceKm).toBe(5);
    expect(r.entries[0].avgHr).toBe(145);
    expect(r.entries[1].type).toBe('hiit');
  });
  it('parses Huawei Health CSV (ru, semicolon, comma decimal)', () => {
    const csv = `Дата начала;Длительность;Дистанция(км);Средний пульс;Калории;Тип
20.08.2024 07:30;00:30:00;5,2;142;280;Бег
21.08.2024 07:30;45:00;8,0;148;380;Ходьба
`;
    const r = parseCardioCsv(csv);
    expect(r.entries.length).toBe(2);
    expect(r.entries[0].date).toBe('2024-08-20');
    expect(r.entries[0].durationMin).toBe(30);
    expect(r.entries[0].distanceKm).toBe(5.2);
    expect(r.entries[0].avgHr).toBe(142);
  });
  it('parses Samsung Health CSV (semicolon)', () => {
    const csv = `Start time;End time;Exercise type;Duration;Distance(km);Avg heart rate;Calories
2024-08-20 07:00;2024-08-20 07:30;Running;00:30:00;5.0;145;300
`;
    const r = parseCardioCsv(csv);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].type).toBe('zone2');
  });
  it('handles no header (fallback order)', () => {
    const csv = `2024-08-20,30,5,145,300,Run
2024-08-21,45,7.5,150,400,Run`;
    const r = parseCardioCsv(csv);
    // without header, our code warns but still parses with fallback? Actually header detection will treat first line as header if it looks like data, then fallback to date,duration...
    // In this case headerLooksLikeData true (first col is date), so fallback order used
    expect(r.entries.length).toBe(2);
  });
  it('dedupes duplicates', () => {
    const csv = `date,duration,type
2024-08-20,30,Run
2024-08-20,30,Run
`;
    const r = parseCardioCsv(csv);
    expect(r.entries.length).toBe(1);
    expect(r.warnings.some(w => /дублей/i.test(w))).toBe(true);
  });
});

describe('cardio-import — TCX', () => {
  it('parses minimal TCX with Lap', () => {
    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2024-08-20T07:00:00Z</Id>
      <Lap StartTime="2024-08-20T07:00:00Z">
        <TotalTimeSeconds>1800</TotalTimeSeconds>
        <DistanceMeters>5000</DistanceMeters>
        <Calories>300</Calories>
        <AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
    const r = parseCardioTcx(tcx);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].date).toBe('2024-08-20');
    expect(r.entries[0].durationMin).toBe(30);
    expect(r.entries[0].distanceKm).toBe(5);
    expect(r.entries[0].avgHr).toBe(145);
  });
  it('returns warning for empty TCX', () => {
    const r = parseCardioTcx('<TrainingCenterDatabase></TrainingCenterDatabase>');
    expect(r.entries.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('cardio-import — GPX', () => {
  it('parses GPX with trk and times', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx>
  <trk><name>Morning Run</name><type>Running</type>
    <trkseg>
      <trkpt lat="55.75" lon="37.61"><time>2024-08-20T07:00:00Z</time></trkpt>
      <trkpt lat="55.76" lon="37.62"><time>2024-08-20T07:30:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const r = parseCardioGpx(gpx);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].date).toBe('2024-08-20');
    expect(r.entries[0].durationMin).toBe(30);
    // distance via haversine ~1.3km
    expect(r.entries[0].distanceKm).toBeGreaterThan(0);
  });
});

describe('cardio-import — Apple Health XML', () => {
  it('parses export.xml Workout', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="1800" startDate="2024-08-20 07:00:00 +0300" endDate="2024-08-20 07:30:00 +0300" creationDate="2024-08-20 07:30:00 +0300">
    <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5" unit="km"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="300" unit="kcal"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" average="145" unit="count/min"/>
  </Workout>
</HealthData>`;
    const r = parseAppleHealthXml(xml);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].date).toBe('2024-08-20');
    expect(r.entries[0].durationMin).toBe(30);
    expect(r.entries[0].distanceKm).toBe(5);
    expect(r.entries[0].avgHr).toBe(145);
  });
});

describe('cardio-import — JSON', () => {
  it('parses generic JSON array', () => {
    const json = JSON.stringify([
      { date: '2024-08-20', duration: 30, distance: 5, hr: 145, type: 'Running' },
      { date: '2024-08-21', durationMin: 45, distanceKm: 7.5, avgHr: 150, type: 'HIIT' },
    ]);
    const r = parseCardioJson(json);
    expect(r.entries.length).toBe(2);
    expect(r.entries[1].type).toBe('hiit');
  });
});

describe('cardio-import — FIT stub', () => {
  it('returns instructions for FIT', () => {
    const r = parseCardioFit(new ArrayBuffer(10));
    expect(r.entries.length).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/FIT/i);
  });
});

describe('cardio-import — auto-detect', () => {
  it('detects formats by filename and content', () => {
    const csv = 'date,duration\n2024-08-20,30';
    expect(parseCardioImport('test.csv', csv).format).toMatch(/csv/);
    const tcx = '<TrainingCenterDatabase><Activity Sport="Running"><Id>2024-08-20T07:00:00Z</Id><Lap StartTime="2024-08-20T07:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds></Lap></Activity></TrainingCenterDatabase>';
    expect(parseCardioImport('workout.tcx', tcx).entries.length).toBe(1);
    const gpx = '<gpx><trk><name>Run</name><trkseg><trkpt lat="0" lon="0"><time>2024-08-20T07:00:00Z</time></trkpt><trkpt lat="0" lon="0"><time>2024-08-20T07:30:00Z</time></trkpt></trkseg></trk></gpx>';
    expect(parseCardioImport('track.gpx', gpx).entries.length).toBe(1);
  });
});
