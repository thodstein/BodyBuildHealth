import { describe, expect, it, beforeEach } from 'vitest';
import {
  weekdayMon1,
  importRowsFromDiary,
  saveVolumeSnapshot,
  loadVolumeSnapshots,
  removeVolumeSnapshot,
  compareVolumeSnapshot,
  buildVolumeCsv,
  buildVolumeHtml,
  csvCellVolume,
  resolveVolumeOneRM,
  VOLUME_HISTORY_KEY,
} from '../volume-hub-conveyor.engine';

beforeEach(() => {
  localStorage.clear();
});

describe('conveyor: даты без UTC-сдвига', () => {
  it('2026-09-11 — пятница = 5', () => {
    expect(weekdayMon1('2026-09-11')).toBe(5);
  });
  it('2026-09-07 — понедельник = 1', () => {
    expect(weekdayMon1('2026-09-07')).toBe(1);
  });
  it('мусор — null', () => {
    expect(weekdayMon1('xxx')).toBeNull();
  });
});

describe('conveyor: импорт из дневника', () => {
  const NOW = new Date(2026, 8, 11, 12, 0, 0).getTime();
  it('маппит exerciseId + вес/повторы/RPE, считает сеты', () => {
    const r = importRowsFromDiary([
      { date: '2026-09-10', exercises: [{ exerciseId: 'bench_bar', sets: [{ weightKg: 80, reps: 8, rpe: 8 }, { weightKg: 82.5, reps: 6, rpe: 9 }] }] },
    ], { now: NOW });
    expect(r.sessions).toBe(1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ exerciseId: 'bench_bar', sets: 2, weight: 82.5, reps: 6, rpe: 9 });
  });
  it('старые сессии (>7д) и немопадающиеся — пропуск со счётчиком', () => {
    const r = importRowsFromDiary([
      { date: '2026-08-01', exercises: [{ exerciseId: 'bench_bar', sets: [{ weightKg: 80, reps: 8 }] }] },
      { date: '2026-09-10', exercises: [{ exerciseId: 'nope_unknown_xyz', sets: [{ weightKg: 10, reps: 10 }] }] },
    ], { now: NOW });
    expect(r.rows).toHaveLength(0);
    expect(r.skipped).toBe(1);
    expect(r.sessions).toBe(1);
  });
  it('не-массив — пусто без throw', () => {
    expect(importRowsFromDiary(null, { now: NOW })).toEqual({ rows: [], sessions: 0, skipped: 0 });
  });
});

describe('conveyor: снапшоты + сравнение', () => {
  it('save/load кап 10 + Δ было/стало', () => {
    const rows = [{ exerciseId: 'bench_bar', day: 1, week: 1, weight: 80, reps: 8, sets: 4 }];
    for (let i = 0; i < 12; i++) {
      saveVolumeSnapshot(rows, 'intermediate', { totalSets: 4 + i, totalTonnage: 1000, byGroup: { chest: 4 + i } });
    }
    const all = loadVolumeSnapshots();
    expect(all).toHaveLength(10);
    expect(localStorage.getItem(VOLUME_HISTORY_KEY)).toContain('he_volume_history'.slice(0, 0) + 'chest');
    const d = compareVolumeSnapshot(all[all.length - 1], [
      ...rows,
      { exerciseId: 'squat', day: 3, week: 1, weight: 100, reps: 5, sets: 4 },
    ]);
    expect(d.setsDelta).toBeGreaterThan(0);
    expect(d.groupDelta.length).toBeGreaterThan(0);
    const rest = removeVolumeSnapshot(all[0].id);
    expect(rest).toHaveLength(9);
  });
});

describe('conveyor: resolveVolumeOneRM (профиль > per-row > глобальный)', () => {
  it('базлайн профиля приоритетнее всего', () => {
    expect(resolveVolumeOneRM({ bench_bar: 120 }, 100, 'bench_bar', 110)).toBe(120);
  });
  it('per-row при пустом профиле', () => {
    expect(resolveVolumeOneRM({}, 100, 'bench_bar', 90)).toBe(90);
  });
  it('глобальный фолбэк; нули/отрицательные игнорятся', () => {
    expect(resolveVolumeOneRM({}, 100, 'bench_bar')).toBe(100);
    expect(resolveVolumeOneRM({ bench_bar: 0 }, 100, 'bench_bar', -5)).toBe(100);
  });
});

describe('conveyor: экспорт', () => {
  it('CSV: шапка + анти-формула (=cmd → \'=cmd)', () => {
    expect(csvCellVolume('=cmd')).toBe('"\'=cmd"');
    const csv = buildVolumeCsv([{ exerciseId: 'bench_bar', day: 1, week: 1, weight: 80, reps: 8, sets: 4 }]);
    expect(csv).toContain('exercise');
    expect(csv).toContain('Жим');
  });
  it('HTML: XSS-esc (имя со скриптом обезврежено)', () => {
    const html = buildVolumeHtml(
      [{ exerciseId: '<script>alert(1)</script>', day: 1, week: 1, weight: 60, reps: 8, sets: 3 }],
      { level: 'intermediate' },
    );
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });
});
