/**
 * cardio-structured-progression.test.ts — 12-й проход аудита (ноябрь 2026):
 *  - протоколы вписываются в длительность (работа/отдых неизменны, повторы
 *    подрезаются), а не переполняют бюджет сессии;
 *  - прогрессия повторов по неделям (+1 / 2 недели, ≤ +50%) и фазы;
 *  - генератор сам назначает HIIT-протокол: текст сессии и `structured`
 *    говорят одно и то же (SIT 20/10), таймер получает реальные отрезки;
 *  - история версий: можно вернуть не только последний, но любой снапшот.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildCardioCycle,
  cardioStructuredMainSec,
  buildCardioIntervalPlan,
  saveCardioCycleVersion,
  cardioCycleVersions,
  restoreCardioCycleVersionById,
  type CardioCycle,
} from '../cardio.engine';
import {
  fitStructuredToDuration,
  progressStructuredReps,
  progressStructuredBlock,
  buildGeneratedHiitStructure,
  CARDIO_INTERVAL_PRESETS,
} from '../cardio-interval-presets.engine';

const HISTORY_KEY = 'he_cardio_cycle_history';

beforeEach(() => {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
});

describe('fitStructuredToDuration', () => {
  it('подрезает только повторы: работа/отдых остаются как в протоколе', () => {
    const fit = fitStructuredToDuration({ workSec: 60, restSec: 60, reps: 10 }, 15)!;
    expect(fit).not.toBeNull();
    expect(fit.reps).toBe(2);           // (15-10) мин = 300 с / 120 с
    expect(fit.workSec).toBe(60);
    expect(fit.restSec).toBe(60);
  });

  it('полный протокол влезает — повторы не режутся', () => {
    const fit = fitStructuredToDuration({ workSec: 20, restSec: 10, reps: 8 }, 20)!;
    expect(fit.reps).toBe(8);
  });

  it('не влезает даже минимум — null (иначе таймер переполнил бы сессию)', () => {
    // 10 мин бюджета − 10 мин краёв = 0 → ни одного повтора.
    expect(fitStructuredToDuration({ workSec: 240, restSec: 180, reps: 4 }, 10)).toBeNull();
    // 20 мин дают ровно 1 повтор 4×4 — меньше минимума генератора (4) → null.
    expect(fitStructuredToDuration({ workSec: 240, restSec: 180, reps: 4 }, 20, { minReps: 4 })).toBeNull();
    expect(fitStructuredToDuration({ workSec: 240, restSec: 180, reps: 4 }, 20)!.reps).toBe(1);
  });
});

describe('прогрессия повторов', () => {
  it('+1 повтор за 2 недели, не больше +50% и 30 повторов', () => {
    expect(progressStructuredReps(8, 1)).toBe(8);
    expect(progressStructuredReps(8, 2)).toBe(8);
    expect(progressStructuredReps(8, 3)).toBe(9);
    expect(progressStructuredReps(8, 5)).toBe(10);
    expect(progressStructuredReps(8, 99)).toBe(12);
    expect(progressStructuredReps(30, 99)).toBe(30);
  });

  it('базовая фаза/taper не прогрессируют, build/maintenance — да', () => {
    const block = { workSec: 20, restSec: 10, reps: 8 };
    expect(progressStructuredBlock(block, { week: 9, phase: 'base' }).reps).toBe(8);
    expect(progressStructuredBlock(block, { week: 9, phase: 'taper' }).reps).toBe(8);
    expect(progressStructuredBlock(block, { week: 9, phase: 'build' }).reps).toBe(12);
  });
});

describe('buildGeneratedHiitStructure', () => {
  it('лестница уровня: новичок 6 → средний 8 → продвинутый 10 (20 мин)', () => {
    const opts = { durationMin: 20, equipment: 'running' as const };
    expect(buildGeneratedHiitStructure({ ...opts, level: 'beginner' })!.block.reps).toBe(6);
    expect(buildGeneratedHiitStructure({ ...opts, level: 'intermediate' })!.block.reps).toBe(8);
    expect(buildGeneratedHiitStructure({ ...opts, level: 'advanced' })!.block.reps).toBe(10);
  });

  it('структура — SIT 20/10 с текстом ровно про те же повторы', () => {
    const built = buildGeneratedHiitStructure({ durationMin: 20, equipment: 'cycling', level: 'intermediate', week: 1 })!;
    expect(built.block.workSec).toBe(20);
    expect(built.block.restSec).toBe(10);
    expect(built.text).toBe(`SIT ${built.block.reps}×20 с / 10 с (RPE 9-10)`);
  });

  it('ходьба и плавание — без структуры: спринт на них не назначить', () => {
    expect(buildGeneratedHiitStructure({ durationMin: 30, equipment: 'walking' })).toBeNull();
    expect(buildGeneratedHiitStructure({ durationMin: 30, equipment: 'swimming' })).toBeNull();
  });

  it('слишком короткая сессия — null, а не структура сверх бюджета', () => {
    expect(buildGeneratedHiitStructure({ durationMin: 8, equipment: 'running' })).toBeNull();
  });
});

describe('генератор: HIIT-сессия с машинной структурой', () => {
  it('cut: у каждого HIIT есть structured, текст про SIT и бюджет соблюдён', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 7, bodyWeight: 80, level: 'intermediate' });
    const hiits = c.weeks.flatMap(w => w.sessions.filter(s => s.type === 'hiit'));
    expect(hiits.length).toBeGreaterThan(0);
    for (const s of hiits) {
      expect(s.structured?.length).toBe(1);
      const block = s.structured![0];
      expect(block.workSec).toBe(20);
      expect(block.restSec).toBe(10);
      expect(block.target).toBe('rpe');
      expect(s.purpose).toContain(`SIT ${block.reps}×20 с / 10 с`);
      // Текст = структура: основная часть и таймлайн влезают в длительность.
      expect(cardioStructuredMainSec(s.structured)).toBeLessThanOrEqual(s.durationMin * 60);
      const plan = buildCardioIntervalPlan(s)!;
      expect(plan.workSteps).toBe(block.reps);
      expect(plan.totalSec).toBeLessThanOrEqual(s.durationMin * 60);
      // Разминка/заминка не нулевые — структура не «съедает» всю сессию.
      expect(plan.warmupSec).toBeGreaterThan(0);
      expect(plan.cooldownSec).toBeGreaterThan(0);
    }
  });

  it('поздние недели цикла не легче ранних (прогрессия повторов)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, daysAvailable: 7, bodyWeight: 80, level: 'intermediate' });
    const hiitReps = c.weeks
      .map(w => w.sessions.find(s => s.type === 'hiit'))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map(s => s.structured?.[0]?.reps ?? 0);
    expect(hiitReps.length).toBeGreaterThan(1);
    expect(hiitReps[hiitReps.length - 1]).toBeGreaterThanOrEqual(hiitReps[0]);
  });

  it('lowImpact без оборудования: HIIT идёт ходьбой → структура не выдумывается', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, daysAvailable: 7, bodyWeight: 80, lowImpact: true });
    const hiits = c.weeks.flatMap(w => w.sessions.filter(s => s.type === 'hiit'));
    for (const s of hiits) {
      expect(s.equipment).toBe('walking');
      expect(s.structured).toBeUndefined();
      expect(s.purpose).not.toContain('SIT');
    }
  });

  it('все пресеты отдают блок с положительными работой/повторами', () => {
    for (const p of CARDIO_INTERVAL_PRESETS) {
      const b = p.build({});
      expect(b.workSec).toBeGreaterThan(0);
      expect(b.reps).toBeGreaterThan(0);
    }
  });
});

describe('история версий: выбор любого снапшота', () => {
  const base = (): CardioCycle => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, daysAvailable: 3, bodyWeight: 80 });
    return { ...c, id: 'ver-1' };
  };

  it('возвращает версии новые сверху и восстанавливает выбранную (не последнюю)', () => {
    const c = base();
    saveCardioCycleVersion({ ...c, name: 'первая' }, 'правка 1');
    saveCardioCycleVersion({ ...c, name: 'вторая' }, 'правка 2');

    const versions = cardioCycleVersions(c.id);
    expect(versions).toHaveLength(2);
    expect(versions.map(v => v.reason)).toEqual(['правка 2', 'правка 1']);

    const older = versions[1];
    expect(restoreCardioCycleVersionById(older.id)?.name).toBe('первая');
    // Восстановление не удаляет историю.
    expect(cardioCycleVersions(c.id)).toHaveLength(2);
    expect(restoreCardioCycleVersionById('нет-такой')).toBeNull();
  });

  it('вернёт null по id чужой версии', () => {
    const c = base();
    saveCardioCycleVersion(c, 'только эта');
    expect(restoreCardioCycleVersionById(`${c.id}-no`)).toBeNull();
  });
});
