/**
 * weakpoint-pl-audit.test.ts — инварианты диагностики мёртвых точек ПЛ-движений.
 *
 * Критическое правило «циклы ПЛ не трогать» распространяется и на ассистентные
 * упражнения: diagnoseWeakPoint обязан возвращать ТОЛЬКО названия из каталога
 * (LMS_EXERCISES / EXERCISE_CATALOG), иначе builder молча создаёт нерабочие
 * предписания (unresolved label).
 */
import { describe, expect, it } from 'vitest';
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT, type Lift } from '../weakpoint-pl';
import { LMS_EXERCISES } from '../../../data/lms-cycles/lms-exercises';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

const catalogNames = new Set<string>([
  ...LMS_EXERCISES.map(e => norm(e.name)),
  ...EXERCISE_CATALOG.map(e => norm(e.name)),
]);

const LIFTS = Object.keys(WEAK_POINTS_BY_LIFT) as Lift[];

describe('weakpoint-pl: диагностика мёртвых точек', () => {
  it('каждый lift × weakPoint возвращает диагноз и НЕ утекает unresolved-названия', () => {
    for (const lift of LIFTS) {
      const points = WEAK_POINTS_BY_LIFT[lift];
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) {
        const d = diagnoseWeakPoint(lift, point);
        // Диагноз определён (не fallback «-»).
        expect(d.label).not.toBe('-');
        expect(d.description).not.toBe('нет данных');
        // Интенсивность в разумном диапазоне % от ПМ.
        expect(d.intensityPct).toBeGreaterThanOrEqual(0.5);
        expect(d.intensityPct).toBeLessThanOrEqual(1);
        // Каждый ассистент существует в каталоге (нет unresolved утечки).
        for (const a of d.assistance) {
          expect(catalogNames.has(norm(a))).toBe(true);
        }
        // Rationale содержит пояснение.
        expect(d.rationale.length).toBeGreaterThan(0);
      }
    }
  });

  it('каждый ассистент из DIAGNOSIS либо есть в каталоге, либо честно помечен как пропущенный', () => {
    for (const lift of LIFTS) {
      for (const point of WEAK_POINTS_BY_LIFT[lift]) {
        const d = diagnoseWeakPoint(lift, point);
        // Если в рациональном обосновании упомянут «рекомендуется добавить в каталог»,
        // значит какие-то метки не резолвятся — движок не должен молча их терять.
        const missingMentioned = /рекомендуется добавить в каталог/.test(d.rationale);
        // При отсутствии резолва ассистенты не должны содержать несуществующие имена.
        expect(d.assistance.every(a => catalogNames.has(norm(a)))).toBe(true);
        // Если ни одного ассистента не осталось — должна быть честная пометка.
        if (d.assistance.length === 0) expect(missingMentioned).toBe(true);
      }
    }
  });

  it('WEAK_POINTS_BY_LIFT полностью согласован с DIAGNOSIS (нет мёртвых ключей)', () => {
    // Каждый перечисленный weakPoint резолвится в непустой диагноз.
    for (const lift of LIFTS) {
      for (const point of WEAK_POINTS_BY_LIFT[lift]) {
        expect(diagnoseWeakPoint(lift, point).assistance.length).toBeGreaterThan(0);
      }
    }
  });

  it('неизвестный weakPoint → безопасный fallback без краха и без мусорных имён', () => {
    const d = diagnoseWeakPoint('bench', 'nonexistent' as Lift['bench']);
    expect(d.assistance).toEqual([]);
    expect(d.rationale).toBe('диагноз не определён');
  });
});
