/**
 * cardio-import-apple-zip.test.ts — прямые тесты Apple Health (export.xml) и ZIP.
 *
 * P2-аудит: TCX/GPX/JSON были покрыты тестами спринта 5, а Apple Health и ZIP —
 * нет (при том что это два самых частых формата выгрузки у пользователей).
 * Тесты пишутся по РЕАЛЬНОЙ разметке, которую ждёт парсер, а не по придумке.
 */
import { describe, expect, it } from 'vitest';
import { parseCardioImport, detectCardioFormat, parseCardioZip } from '../../cardio-import.engine';

/** Реальная форма Apple Health: Workout + WorkoutStatistics (distance/HR/energy). */
const APPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="ru_RU">
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Apple Watch" startDate="2026-09-10 07:00:00 +0300" endDate="2026-09-10 07:40:00 +0300" value="420"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="45" durationUnit="min"
   startDate="2026-09-10 07:00:00 +0300" endDate="2026-09-10 07:45:00 +0300"
   creationDate="2026-09-10 08:00:00 +0300">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling" startDate="x" endDate="y" sum="18.4" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="x" endDate="y" sum="148" unit="count/min"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="x" endDate="y" sum="520" unit="kcal"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min"
   startDate="2026-09-12 18:00:00 +0300" endDate="2026-09-12 18:30:00 +0300"
   creationDate="2026-09-12 19:00:00 +0300">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5.2" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" sum="152" unit="count/min"/>
 </Workout>
</HealthData>`;

describe('Apple Health (export.xml)', () => {
  it('распознаёт формат и читает 2 тренировки', () => {
    expect(detectCardioFormat('export.xml', APPLE_XML)).toBe('apple_health');
    const r = parseCardioImport('export.xml', APPLE_XML);
    expect(r.entries).toHaveLength(2);
  });

  it('велосипед: длительность 45 мин, дистанция 18.4 км, ЧСС 148, 520 ккал', () => {
    const r = parseCardioImport('export.xml', APPLE_XML);
    const bike = r.entries.find(e => e.sport === 'bike')!;
    expect(bike).toBeTruthy();
    expect(bike.durationMin).toBe(45);
    expect(bike.distanceKm).toBeCloseTo(18.4, 1);
    expect(bike.avgHr).toBe(148);
    expect(bike.calories).toBe(520);
  });

  it('бег: дистанция из DistanceWalkingRunning, дисциплина run', () => {
    const r = parseCardioImport('export.xml', APPLE_XML);
    const run = r.entries.find(e => e.sport === 'run')!;
    expect(run.durationMin).toBe(30);
    expect(run.distanceKm).toBeCloseTo(5.2, 1);
    expect(run.avgHr).toBe(152);
  });

  it('проставляет source=import и спринт-дисциплину (provenance)', () => {
    const r = parseCardioImport('export.xml', APPLE_XML);
    expect(r.entries.every(e => e.source === 'import')).toBe(true);
    expect(r.entries.map(e => e.sport).sort()).toEqual(['bike', 'run']);
  });

  it('XML без <Workout> → 0 записей и ЧЕСТНОЕ предупреждение (не тишина)', () => {
    const r = parseCardioImport('export.xml', '<?xml version="1.0"?><HealthData><Record type="X"/></HealthData>');
    expect(r.entries).toHaveLength(0);
    expect(r.warnings.join(' ')).toMatch(/Workout/i);
  });

  it('мили конвертируются в км (реальный Apple-юнит)', () => {
    const xml = `<?xml version="1.0"?><HealthData>
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="20" durationUnit="min"
        startDate="2026-09-11 08:00:00 +0300" endDate="2026-09-11 08:20:00 +0300" creationDate="2026-09-11 09:00:00 +0300">
        <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="3.1" unit="mi"/>
      </Workout></HealthData>`;
    const r = parseCardioImport('export.xml', xml);
    expect(r.entries[0].distanceKm).toBeCloseTo(5.0, 0);   // 3.1 mi ≈ 4.99 km
  });

  it('метры конвертируются в км', () => {
    const xml = `<?xml version="1.0"?><HealthData>
      <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="25" durationUnit="min"
        startDate="2026-09-13 08:00:00 +0300" endDate="2026-09-13 08:25:00 +0300" creationDate="2026-09-13 09:00:00 +0300">
        <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="2400" unit="m"/>
      </Workout></HealthData>`;
    const r = parseCardioImport('export.xml', xml);
    expect(r.entries[0].distanceKm).toBeCloseTo(2.4, 1);
  });

  it('дата берётся по МЕСТНОМУ календарю (startDate +0300 → 2026-09-10, не 09-09)', () => {
    const r = parseCardioImport('export.xml', APPLE_XML);
    expect(r.entries.map(e => e.date).sort()).toEqual(['2026-09-10', '2026-09-12']);
  });
});

describe('Формат по сигнатуре (мусорное имя файла не должно ломать)', () => {
  it('экспорт Apple с нестандартным именем определяется по содержимому', () => {
    expect(detectCardioFormat('мои_данные.txt', APPLE_XML)).toBe('apple_health');
    const r = parseCardioImport('мои_данные.txt', APPLE_XML);
    expect(r.entries).toHaveLength(2);
  });
});

describe('ZIP (выгрузка Apple Health = export.zip)', () => {
  it('определяется по расширению и по сигнатуре PK\\x03\\x04', () => {
    expect(detectCardioFormat('export.zip', '')).toBe('zip');
    const magic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(detectCardioFormat('health_data', magic.buffer)).toBe('zip');
  });

  it('битый ZIP не роняет импорт: 0 записей + ЧЕСТНОЕ предупреждение', () => {
    const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    const r = parseCardioZip(junk.buffer);
    expect(r.entries).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('мусор не-ZIP (обычный текст) тоже без исключения', () => {
    const r = parseCardioZip(new TextEncoder().encode('не архив').buffer as ArrayBuffer);
    expect(r.entries).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
