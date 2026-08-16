/**
 * Тесты заминки по целевым группам (cooldown-day.engine.ts + generateCooldown targetGroups).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  COOLDOWN_GROUP_PREP, collectGroupCooldown, prepGroupLabelsCooldown,
} from '../cooldown-day.engine';
import {
  generateCooldown, upsertCooldownLog, loadCooldownLog, latestCooldownLog, cooldownLogForDate,
  cooldownAdherence, cooldownQualityTrend, cooldownStreak, buildCooldownInsights,
  exportCooldownCheckinsCSV, COOLDOWN_LABELS, cooldownLabel, sanitizeCooldownLog,
  COOLDOWN_DIARY_KEY, COOLDOWN_SKIP_REASONS,
} from '../cooldown.engine';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

describe('COOLDOWN_GROUP_PREP и collectGroupCooldown', () => {
  it('покрывает базовые группы с растяжками', () => {
    for (const g of ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'core']) {
      expect(COOLDOWN_GROUP_PREP[g], g).toBeTruthy();
      expect(COOLDOWN_GROUP_PREP[g].stretch.length).toBeGreaterThan(0);
    }
  });

  it('грудной день: растяжка груди + плеч', () => {
    const exs = collectGroupCooldown(['chest']);
    expect(exs.map(e => e.id)).toEqual(['chest_stretch', 'shoulder_stretch']);
  });

  it('арм-день: растяжка рук включает запястья', () => {
    const ids = collectGroupCooldown(['biceps', 'triceps']).map(e => e.id);
    expect(ids).toContain('bicep_stretch');
    expect(ids).toContain('triceps_stretch');
    expect(ids).toContain('wrist_stretch');
  });

  it('композиты: legs → квадры/задняя/ягодицы/икры с дедупликацией', () => {
    const exs = collectGroupCooldown(['legs']);
    const ids = exs.map(e => e.id);
    expect(ids).toContain('quad_stretch');
    expect(ids).toContain('hamstring_stretch');
    expect(ids).toContain('glute_stretch');
    expect(ids).toContain('calf_stretch');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('кап ≤ 8 и неизвестные группы игнорируются', () => {
    expect(collectGroupCooldown(['fullbody']).length).toBeLessThanOrEqual(8);
    expect(collectGroupCooldown(['неизвестное', '']).length).toBe(0);
  });

  it('prepGroupLabelsCooldown — русские подписи', () => {
    expect(prepGroupLabelsCooldown(['chest', 'back'])).toBe('грудь, спина');
  });
});

describe('generateCooldown с targetGroups', () => {
  it('нижний день: растяжка рабочих зон с заметкой', () => {
    const blocks = generateCooldown({
      muscleGroupsUsed: [], fatigueScore: 0.3, riskFlags: {}, sessionDuration: 3600,
      targetGroups: ['quads', 'hamstrings', 'glutes'],
    });
    const stretch = blocks.find(b => b.type === 'stretch')!;
    expect(stretch.exercises.map(e => e.exerciseId)).toContain('quad_stretch');
    expect(stretch.exercises.map(e => e.exerciseId)).toContain('glute_stretch');
    expect(stretch.notes).toContain('Растяжка рабочих зон');
  });

  it('дыхание всегда первым блоком; восстановление при усталости', () => {
    const blocks = generateCooldown({ muscleGroupsUsed: [], fatigueScore: 0.8, riskFlags: {}, sessionDuration: 3600, targetGroups: ['chest'] });
    expect(blocks[0].type).toBe('breathing');
    expect(blocks.some(b => b.type === 'mobility')).toBe(true);
  });

  it('без targetGroups — прежняя эвристика по muscleGroupsUsed', () => {
    const blocks = generateCooldown({ muscleGroupsUsed: ['chest', 'shoulders'], fatigueScore: 0.3, riskFlags: {}, sessionDuration: 3600 });
    const stretch = blocks.find(b => b.type === 'stretch')!;
    expect(stretch.exercises.map(e => e.exerciseId)).toEqual(['chest_stretch', 'shoulder_stretch']);
  });
});

describe('Дневник заминки', () => {
  beforeEach(() => localStorage.clear());

  it('upsert по дате: добавляет и заменяет', () => {
    upsertCooldownLog({ date: daysAgo(1), done: true, quality: 4 });
    expect(loadCooldownLog().length).toBe(1);
    upsertCooldownLog({ date: daysAgo(1), done: false, quality: null, skippedReason: 'устал' });
    const list = loadCooldownLog();
    expect(list.length).toBe(1);
    expect(list[0].done).toBe(false);
    expect(list[0].skippedReason).toBe('устал');
    expect(latestCooldownLog()?.date).toBe(daysAgo(1));
    expect(cooldownLogForDate(daysAgo(1))?.done).toBe(false);
  });

  it('устойчив к битому JSON; sanitize отбрасывает мусор', () => {
    localStorage.setItem(COOLDOWN_DIARY_KEY, '{"broken":');
    expect(loadCooldownLog()).toEqual([]);
    expect(sanitizeCooldownLog(null)).toBeNull();
    expect(sanitizeCooldownLog({ date: 'вчера', done: true })).toBeNull();
    expect(sanitizeCooldownLog({ date: '2026-01-01', done: true, quality: 9 })?.quality).toBeNull();
  });

  it('cooldownAdherence и качество', () => {
    upsertCooldownLog({ date: daysAgo(1), done: true, quality: 5 });
    upsertCooldownLog({ date: daysAgo(2), done: true, quality: 3 });
    upsertCooldownLog({ date: daysAgo(3), done: false, quality: null });
    const adh = cooldownAdherence(30);
    expect(adh.done).toBe(2);
    expect(adh.total).toBe(3);
    expect(adh.pct).toBe(67);
    const q = cooldownQualityTrend(30);
    expect(q.count).toBe(2);
    expect(q.avg).toBe(4);
  });

  it('cooldownStreak: 3 дня подряд; пропуск разрывает', () => {
    upsertCooldownLog({ date: daysAgo(0), done: true, quality: 4 });
    upsertCooldownLog({ date: daysAgo(1), done: true, quality: 4 });
    upsertCooldownLog({ date: daysAgo(2), done: true, quality: 4 });
    expect(cooldownStreak()).toBe(3);
    upsertCooldownLog({ date: daysAgo(1), done: false, quality: null });
    expect(cooldownStreak()).toBe(1);
  });

  it('buildCooldownInsights: приверженность и частая причина пропуска', () => {
    expect(buildCooldownInsights().some(s => s.includes('мало данных'))).toBe(true);
    upsertCooldownLog({ date: daysAgo(1), done: true, quality: 5 });
    upsertCooldownLog({ date: daysAgo(2), done: true, quality: 4 });
    upsertCooldownLog({ date: daysAgo(3), done: true, quality: 4 });
    expect(buildCooldownInsights().some(s => s.includes('отличная'))).toBe(true);
    upsertCooldownLog({ date: daysAgo(4), done: false, quality: null, skippedReason: 'устал' });
    upsertCooldownLog({ date: daysAgo(5), done: false, quality: null, skippedReason: 'устал' });
    upsertCooldownLog({ date: daysAgo(6), done: false, quality: null, skippedReason: 'устал' });
    expect(buildCooldownInsights().some(s => s.includes('устал'))).toBe(true);
  });

  it('CSV и словарь', () => {
    upsertCooldownLog({ date: daysAgo(1), done: true, quality: 4 });
    const csv = exportCooldownCheckinsCSV();
    expect(csv.split('\n')[0]).toContain('quality');
    expect(csv.split('\n')[1]).toContain(daysAgo(1));
    expect(COOLDOWN_LABELS['deep_breathing']).toBeTruthy();
    expect(COOLDOWN_LABELS['chest_stretch']).toBeTruthy();
    expect(cooldownLabel('неизвестный_id')).toBe('неизвестный_id');
    expect(COOLDOWN_SKIP_REASONS.length).toBeGreaterThanOrEqual(4);
  });
});
