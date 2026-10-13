/**
 * strongman-audit-2026-10-2.test.ts — AUDIT-2026-10 (раунд 5): кластер диагностики.
 *
 * Каждый пункт = дефект, подтверждённый чтением кода (3 параллельных аудита
 * зоны + собственная перепроверка).
 */
import { describe, it, expect } from 'vitest';
import {
  estimateSMCorrBasePm, isSMCarryCorr, simulateSMCorrection,
} from '../strength-sport-sm-simulator.engine';
import { basePmForSM } from '../strength-sport-sm-injection.engine';
import { correctivesForSMWeakPoint, exIdForSMCorrective, smCatalogLookup } from '../strength-sport-sm-corrective.engine';
import { saveSMProgress, loadSMProgress } from '../strength-sport-sm-progress.engine';
import { buildSMCsv } from '../strength-sport-sm-export.engine';
import { buildWLCsv } from '../strength-sport-wl-export.engine';
import { diagnoseSMAnthro } from '../strength-sport-sm-anthro.engine';
import { SM_ALL_PHASES } from '../strength-sport-sm-plan-audit.engine';

const WM = { logPress: 100, yokeWalk: 240, farmersWalk: 130, atlasStone: 150, backSquat: 180, deadlift: 220, overheadPress: 70 };

describe('AUDIT-2026-10-2: превью коррекции считает ту же базу, что и инъекция', () => {
  it('щипок больше не уходит в ветку лога (pin ⊂ pinch) — 20 кг, не 60', () => {
    // ДО фикса локальная копия симулятора срабатывала на `low.includes('pin')`
    // (в "pinch") и возвращала logPress 60–100 кг на щипок.
    expect(estimateSMCorrBasePm('plate_pinch', WM)).toBe(20);
    expect(estimateSMCorrBasePm('plate_pinch_hold', WM)).toBe(20);
  });

  it('переноска остаётся на фермере/йоке (не 20 кг грипа и не 100 кг камня)', () => {
    // Канон инъекции: ветка переносок = `farmersWalk || yokeWalk || 140`.
    // Превью обязано совпасть с инъекцией (раньше расходилось).
    expect(estimateSMCorrBasePm('sm_farmers_grip_strength', WM)).toBe(130);
    expect(estimateSMCorrBasePm('sm_yoke_walk_volume', WM)).toBe(130);
    expect(estimateSMCorrBasePm('frame_carry', WM)).toBe(basePmForSM('frame_carry', WM));
  });

  it('база совпадает с каноном инъекции на всех группах', () => {
    for (const id of ['plate_pinch', 'sm_yoke_walk_volume', 'sm_stone_lap_strength', 'sm_log_dip_fatigue',
      'tire_flip', 'front_squat', 'deadlift_romanian', 'hammer_curl', 'plank_walkout']) {
      expect(estimateSMCorrBasePm(id, WM), `расхождение канона на ${id}`).toBe(basePmForSM(id, WM));
    }
  });

  it('жим лога/оси остаются на logPress (не скатываются в squat/deadlift)', () => {
    expect(estimateSMCorrBasePm('sm_log_press_technique', WM)).toBe(100);
    expect(estimateSMCorrBasePm('axle_press', WM)).toBe(100);
  });
});

describe('AUDIT-2026-10-2: «показано = вставится» по оборудованию и усталости', () => {
  it('sm_log_dip_fatigue — реальный снаряд диски (sled_push_sprint): виден под «Диски»', () => {
    // Фазовый канон log_dip.stability = suitcase_carry (гантели); реальная
    // запись = sled_push_sprint (диски). Прежний фильтр смотрел на канон.
    const plates = correctivesForSMWeakPoint('log_dip', { equipment: ['plate'], level: 'advanced', mobilityRestrictions: [] });
    expect(plates.map(c => c.id)).toContain('sm_log_dip_fatigue');
  });

  it('та же запись НЕ показывается под «Гантели» (раньше показывалась — и не вставилась бы)', () => {
    const dumbbells = correctivesForSMWeakPoint('log_dip', { equipment: ['dumbbell'], level: 'advanced', mobilityRestrictions: [] });
    expect(dumbbells.map(c => c.id)).not.toContain('sm_log_dip_fatigue');
  });

  it('инвариант: под каждым фильтром снаряд показанного = снаряд вставляемого', () => {
    // Свойство на ВСЕХ фазах: оборудование записи берётся по её реальному
    // exId (exIdForSMCorrective), иначе фильтр врёт в любую сторону.
    const eqs = [['barbell'], ['dumbbell'], ['plate'], ['machine']];
    for (const eq of eqs) {
      for (const wp of SM_ALL_PHASES) {
        const rows = correctivesForSMWeakPoint(wp, { equipment: eq, level: 'enhanced', mobilityRestrictions: [] });
        for (const c of rows) {
          const need = String(smCatalogLookup(exIdForSMCorrective(c)).equipment || '').toLowerCase();
          if (!need || need === 'bodyweight' || need === 'universal') continue;
          expect(eq.includes(need), `${c.id} (${need}) показан под ${eq.join('/')}`).toBe(true);
        }
      }
    }
  });
});

describe('AUDIT-2026-10-2: сохранение прогресса не врёт об успехе', () => {
  it('возвращает false при отказе хранилища (раньше было void + catch {})', () => {
    // Квота падает на записи истории прогресса — ровно тот ключ, что пишет
    // saveSMProgress. Мокаем ЭКЗЕМПЛЯР localStorage: в jsdom
    // Storage.prototype.setItem не перехватывает localStorage.
    const orig = localStorage.setItem.bind(localStorage);
    (localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem = (k: string) => {
      if (k === 'he_sm_progress_hist_v1') throw new Error('QuotaExceededError');
      orig(k, '');
    };
    let r: boolean | undefined;
    try {
      r = saveSMProgress([] as never);
    } finally {
      (localStorage as unknown as { setItem: typeof orig }).setItem = orig;
      try { localStorage.removeItem('he_sm_progress_hist_v1'); } catch { /* noop */ }
    }
    expect(r).toBe(false);
  });

  it('при рабочем хранилище возвращает true и roundtrip читается', () => {
    const ok = saveSMProgress([{ date: '2026-10-13', implement: 'rolling_thunder', kg: 100 } as never]);
    expect(ok).toBe(true);
    expect(loadSMProgress().length).toBe(1);
    try { localStorage.removeItem('he_sm_progress_hist_v1'); } catch { /* noop */ }
  });
});

describe('AUDIT-2026-10-2: CSV-экспорт несёт BOM (APK-native пишет как есть)', () => {
  const snap = { weakPoints: ['yoke_walk'], score: 49, level: 'critical', verification: 0.3, findings: ['Осевая перегрузка'] } as never;

  it('buildSMCsv начинается с BOM и содержит кириллицу', () => {
    const csv = buildSMCsv(snap);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('Осевая перегрузка');
    expect(csv.split('\n').length).toBeGreaterThan(5);
  });

  it('buildWLCsv тоже несёт BOM (сестрая поверхность зоны)', () => {
    const csv = buildWLCsv({ ...snap, weakPoints: ['snatch_pull_under'] } as never);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});

describe('AUDIT-2026-10-2: антропос — никаких выдуманных роста/платформы', () => {
  it('без платформы → null, а не «платформа 140см» по умолчанию', () => {
    expect(diagnoseSMAnthro({ heightCm: 190, platformCm: null })).toBeNull();
  });

  it('без роста → null, а не «рост 178см» по умолчанию', () => {
    expect(diagnoseSMAnthro({ heightCm: null, platformCm: 120 })).toBeNull();
  });

  it('оба введены → совет печатает введённые числа', () => {
    const r = diagnoseSMAnthro({ heightCm: 190, platformCm: 110, armSpanCm: 196 })!;
    expect(r).not.toBeNull();
    expect(r.loadAdvice).toContain('Рост 190см + платформа 110см');
    expect(r.platformAdvantage).toBe('tall');
    expect(r.build).toBe('long');
    expect(r.tackyHeightCm).toBeGreaterThan(95);
  });

  it('неизмеренный размах = честное «не измерен», а не «пропорции средние»', () => {
    const r = diagnoseSMAnthro({ heightCm: 178, platformCm: 140 })!;
    expect(r.build).toBe('unknown');
    expect(r.diffCm).toBeNull();
    expect(r.pickupAdvice).toContain('Размах рук не измерен');
    expect(r.pickupAdvice).not.toContain('Пропорции средние');
  });
});
