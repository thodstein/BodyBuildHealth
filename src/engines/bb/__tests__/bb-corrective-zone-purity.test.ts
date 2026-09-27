import { describe, it, expect } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { trueMuscleOf } from '../../movement-pattern';
import { BB_CORRECTIVES, rankCorrectives } from '../bb-corrective.engine';

/**
 * ЗАМОК: зона мышцы не может отдать упражнение СОСЕДНЕЙ мышцы.
 *
 * Дефект (Sep 2026): сортировка шла только по `score`, где зона = +5, а КАЖДЫЙ глобальный
 * скрининг-сигнал = +4. Три икроножных сигнала (ktw-asym + ybt-asym + asym + driver:ankle)
 * давали записи икроножных мышц больше, чем зональная запись набирала зону, и пользователь
 * видел «подъёмы на носки» в зоне ягодиц. Матрица ниже показала, что это был НЕ частный случай:
 * без жёсткого первого ключа заражение шло во ВСЕХ зонах (в «грудь» попадали calf_raise_single,
 * copenhagen_plank, goblet_squat, rdl_db…).
 *
 * Инвариант: если в выдаче для зоны есть хоть одна запись ЭТОЙ зоны — топ-3 обязан быть
 * целиком из неё. Если зональных записей нет (всё отсекли фильтры уровня/снаряжения/противопоказаний)
 * — остаётся ранжирование по сигналам, это осознанный фолбэк, а не дефект.
 */
const MUSCLE_ZONES = ['chest', 'back', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear',
  'quads', 'hamstrings', 'glutes', 'calves', 'adductor', 'biceps', 'triceps', 'forearms', 'traps', 'abs'];

const CAUSES: any[] = [null, 'volume', 'activation', 'recovery', 'technique', 'genetics'];
const DRIVERS: any[] = [null, 'ankle', 'hip', 'thoracic', 'shoulder', 'core'];
const BOOSTS: Array<[string, any]> = [
  ['nheWeak', true], ['addWeak', true], ['erirLow', true], ['hingeFail', true], ['shoulderFail', true],
  ['ybtAsym', true], ['ktwAsym', true], ['asym', true], ['rotGap', true], ['loadedFail', true],
];
const BENCH: any[] = [null, 'ok', 'watch', 'fix'];

/** Инвариант для одного набора сигналов. Возвращает описание нарушения или null. */
function zonePurityViolation(s: any): string | null {
  const z = s.zones[0];
  const r = rankCorrectives(s);
  if (!r.some((x) => x.corr.targets.includes(z))) return null; // зональных нет — фолбэк законен
  const top3 = r.slice(0, 3);
  const foreign = top3.filter((x) => !x.corr.targets.includes(z));
  if (!foreign.length) return null;
  return `${z} → топ-3 [${top3.map((x) => x.corr.exerciseId).join(', ')}] `
    + `чужое: [${foreign.map((x) => x.corr.exerciseId).join(', ')}]`;
}

describe('bb-corrective: чистота зон (matrix lock)', () => {
  it('один сигнал × причина × драйвер × bench — ни одна зона не теряет приоритет мышцы', () => {
    const violations: string[] = [];
    for (const z of MUSCLE_ZONES) {
      for (const cause of CAUSES) {
        for (const driver of DRIVERS) {
          for (const [name, val] of BOOSTS) {
            for (const bench of BENCH) {
              const v = zonePurityViolation({ zones: [z], cause, driver, [name]: val, benchLevel: bench });
              if (v) violations.push(`${v} [cause=${cause} driver=${driver} ${name} bench=${bench}]`);
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it('все сигналы разом × причина × драйвер — зона всё равно первая', () => {
    const violations: string[] = [];
    for (const z of MUSCLE_ZONES) {
      for (const cause of CAUSES) {
        for (const driver of DRIVERS) {
          const s: any = { zones: [z], cause, driver };
          for (const [name, val] of BOOSTS) s[name] = val;
          s.benchLevel = 'fix';
          const v = zonePurityViolation(s);
          if (v) violations.push(`${v} [ALL cause=${cause} driver=${driver}]`);
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it('зона без своих записей: сигнальные записи остаются (честный фолбэк, не пустота)', () => {
    const r = rankCorrectives({ zones: ['совсем_нет_такой_зоны'], rotGap: true } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.corr.targets.includes('rot-gap'))).toBe(true);
  });

  /** Документированные исключения «зональная метка ≠ trueMuscleOf»: гранулярные головы и
   *  регионы, а не ошибка разметки. Список закрыт намеренно — новое имя = падение теста. */
  it('targets небьющихся записей: только известные гранулярные/региональные исключения', () => {
    const byId = new Map<string, any>();
    for (const e of EXERCISE_CATALOG as any[]) byId.set(String(e.id).toLowerCase(), e);
    const heads = new Set(['chest_upper', 'chest_lower', 'back_width', 'back_thickness']);
    const KNOWN: Record<string, string> = {
      // Копенгаген — каноническое приведение бедра, но каталог отнёс его к core (см. movement-pattern.ts:
      // adduction → null). Библиотека коррекций права по существу; править каталог — зона BB-плана.
      'ad-copenhagen': 'abs→adduction (каталог: copenhagen_plank = core)',
      'add-copenhagen-str': 'abs→adduction (каталог: copenhagen_plank = core)',
      'ad-copenhagen-lg': 'abs→adduction (каталог: copenhagen_plank = core)',
      // Реверс-пулдаун как нейромышечная работа плеча (эксцентрика плеча), не «спина».
      'sh-neutral-press': 'back→shoulders (реверс-пулдаун = эксцентрика плеча)',
      // Granular head of chest + bench-watch screening.
      'bw-bench-watch-spoto': 'chest→chest_upper (granular head)',
      'th-rot-gap-drill': 'abs→thoracic/back_thickness (ротация грудного отдела)',
    };
    const unknown: string[] = [];
    for (const c of BB_CORRECTIVES) {
      const ex = byId.get(String(c.exerciseId || '').toLowerCase());
      if (!ex) { unknown.push(`${c.id}: упражнения нет в каталоге (${c.exerciseId})`); continue; }
      const real = trueMuscleOf(ex);
      if (!real) continue; // adduction/hinge/carry — сознательно вне ББ-мышц
      const hasZone = c.targets.some((t) => MUSCLE_ZONES.includes(t) || heads.has(t));
      if (hasZone && !c.targets.includes(real) && !KNOWN[c.id]) {
        unknown.push(`${c.id}: НОРМ=${real} targets=[${c.targets.join(',')}]`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
