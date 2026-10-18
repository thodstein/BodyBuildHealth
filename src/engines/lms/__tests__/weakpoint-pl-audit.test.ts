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

// Строгий инвариант: имена ассистентов обязаны быть ТОЧНО в EXERCISE_CATALOG
// (с нормализацией ё→е). Объединение с LMS_EXERCISES ослабляло проверку:
// LMS-only имена («Становая тяга из ямы») проходили аудит, но у них нет
// каталогных метаданных (id/оборудование/паттерн) — prescription молча
// подставлял дефолты (id 'assist_N', equipment 'barbell').
const catalogNames = new Set<string>(EXERCISE_CATALOG.map(e => norm(e.name)));

const LIFTS = Object.keys(WEAK_POINTS_BY_LIFT) as Lift[];

// База лифта не может быть собственным «ассистентом» (самолифт в диагностике —
// бессмысленная инъекция самого движения). Для изолированных лифтов
// (biceps/triceps/calf/shrug) объёмные варианты базы допустимы — не проверяем.
const SELF_LIFT_NAMES: Partial<Record<Lift, string[]>> = {
  bench: ['Жим штанги лёжа'],
  incline_press: ['Жим штанги на наклонной (30°)'],
  squat: ['Приседания со штангой'],
  deadlift: ['Становая тяга (классика)', 'Становая тяга сумо'],
  sumo: ['Становая тяга сумо'],
  ohp: ['Армейский жим стоя'],
  row: ['Тяга штанги в наклоне (прямой хват)'],
  pulldown: ['Тяга верхнего блока (прямой)'],
};

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

  it('базовый лифт не является собственным ассистентом (нет самолифтов)', () => {
    for (const lift of LIFTS) {
      const selfNames = (SELF_LIFT_NAMES[lift] ?? []).map(norm);
      if (!selfNames.length) continue;
      for (const point of WEAK_POINTS_BY_LIFT[lift]) {
        const d = diagnoseWeakPoint(lift, point);
        for (const a of d.assistance) {
          expect(selfNames, `${lift}/${point}: «${a}» — самолифт в ассистентах`).not.toContain(norm(a));
        }
      }
    }
  });

  it('одноимённые weak-point (deadlift.sumo_* ↔ sumo.sumo_*) дают согласованные списки', () => {
    // sumo_mid есть только у отдельного лифта sumo (у deadlift 5 точек без него) —
    // сравниваем только общие для обоих лифтов точки.
    const shared = WEAK_POINTS_BY_LIFT.sumo.filter(p => (WEAK_POINTS_BY_LIFT.deadlift as readonly string[]).includes(p));
    expect(shared.length).toBeGreaterThan(0);
    for (const point of shared) {
      const a = diagnoseWeakPoint('deadlift', point).assistance;
      const b = diagnoseWeakPoint('sumo', point).assistance;
      expect(b, `sumo/${point}`).toEqual(a);
    }
  });

  it('новые движения: sumo (отдельная тяга) и biceps — полный диагноз и резолв из каталога', () => {
    // sumo — отдельное движение со своими фазами (не часть deadlift).
    expect(WEAK_POINTS_BY_LIFT.sumo).toEqual(['sumo_start', 'sumo_mid', 'sumo_lockout']);
    for (const p of WEAK_POINTS_BY_LIFT.sumo) {
      const d = diagnoseWeakPoint('sumo', p);
      expect(d.label).not.toBe('-');
      expect(d.assistance.length).toBeGreaterThan(0);
      for (const a of d.assistance) expect(catalogNames.has(norm(a))).toBe(true);
    }
    // biceps — отдельное движение со своими фазами.
    expect(WEAK_POINTS_BY_LIFT.biceps).toEqual(['biceps_start', 'biceps_mid', 'biceps_top']);
    for (const p of WEAK_POINTS_BY_LIFT.biceps) {
      const d = diagnoseWeakPoint('biceps', p);
      expect(d.label).not.toBe('-');
      expect(d.assistance.length).toBeGreaterThan(0);
      for (const a of d.assistance) expect(catalogNames.has(norm(a))).toBe(true);
    }
  });
});
