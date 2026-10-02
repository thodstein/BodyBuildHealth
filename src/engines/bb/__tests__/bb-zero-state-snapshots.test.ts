import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';

/**
 * Zero-state snapshots (Этап 10, п.1 плана BB-AUTO-REBUILD-AND-TUNING-PLAN):
 * фиксируют ТОЧНОЕ текущее состояние per-muscle прямого объёма для всех
 * четырёх маршрутов (Generic / ПРОФ-cycle adapt / Library adapt / natural).
 *
 * Это baseline для последующего тюнинга коэффициентов: любое изменение
 * объёмов/распределения будет видно как падение теста, прежде чем попадёт
 * в продакшен. При ОСОЗНАННОЙ правке коэффициентов снапшоты обновляются
 * вручную (правило Этапа 10: один параметр за проход → тесты → review).
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const PED = { pedDoses: { AAS: 500 }, courseIntensity: 'moderate' as const };

const directVolume = (plan: any): Record<string, number> => {
  const vol = plan.weeklyVolume?.[1] || {};
  return Object.fromEntries(Object.keys(vol).sort().map(m => [m, vol[m].directSets]));
};

describe('BB zero-state snapshots (baseline Этапа 10)', () => {
  it('Generic enhanced 6+ (upper_lower_4, mass, AAS 500) — per-muscle объём', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, ...PED });
    // Re-baseline (осознанно, бюджетная политика tier 6+: 65 сетов/165 мин):
    // грудь 30→36, спина 46→45 (effective 49), руки 6/4→8/7, квадры 18→21,
    // предплечья 6→8, пресс 14→16 — бюджет вмещает предписание целиком,
    // zero-sum закрыт. Валидатор зелёный, инварианты целы.
    // Re-baseline 2 (Sep 2026, keep-first каталог): канонические упражнения
    // вернулись (hip_thrust/gack-хамы/leg_ext_v2 и др.) — пулы/фидеры сдвинули
    // квадры 21→25 (валидатор зелёный, инварианты целы).
    // Re-baseline 3 (Ф1.1 CYCLE-SYSTEM-FULL-AUDIT): «Жим ногами (45°)» больше
    // не мирился в horizontal_push/chest (movement-pattern: leg press →
    // squat/quads) — quad-бакет честный: quads 25→21 (валидатор зелёный,
    // инварианты целы).
    // Re-baseline 4 (аудит 2026-09, P0-3): дозо-зависимая MRV-кривая — AAS 500
    // даёт режим ×1.30 (было плоское ×1.9): спина 45→43 (первой упёрлась в
    // свой честный кап; сессионные капы держат остальные мышцы). Валидатор
    // зелёный, инварианты целы, дозо-зависимость восстановлена.
    // Re-baseline 5 (аудит 2026-09, РЕАЛИЗМ СЕССИИ): недельный объём enhanced 6+
    // пересобран под практические сессии — потолок прямых сетов мышцы за сессию
    // (sessionMuscleRealismCap: big 16/14 при 5 группах дня) вместо 22, плюс
    // автобаланс движка и course-aware final cap. Было → стало
    // (directSets, нед 1, upper_lower_4): back 43→40, chest 36→28, quads 21→19.

    // Направление: сессии 10-15 упражнений / 30-40 сетов вместо 18-20/60+;
    // недельный объём держится частотой сплита. Значения — осознанный re-baseline.
    // Re-baseline 6 (Волна 0, п. 0.4 «валидация/weeklyVolume после мутаций»):
    // этот снапшот калибровался по СТАРОМУ weeklyVolume, который снимался ДО
    // enforceSessionRealism — то есть показывал объём, которого в плане нет.
    // Re-baseline 7 (Волна 0, потолки сессии для опытных): cap big для
    // advanced/course поднят 13→20 и 16→24 (Schoenfeld 2017: ~20 прямых сетов
    // на мышцу/сессию у опытных), а нарезка внутри мышцы идёт до ПОЛА
    // УПРАЖНЕНИЯ (3 у базового / 2 у изоляции) вместо «до 2 у всего».
    // Факт по самому плану (нед 1, upper_lower_4, enhanced 6+): back 24→32,
    // chest 23→24, quads 18→22, abs 10→13, delt_mid исчез (ушёл в нули).
    // Снимок сверен с фактом: weeklyVolume === aggregateBBVolume по сессиям.
    // Re-baseline 8 (аудит-2, формула ПЕД + сессионные капы из канона):
    // AAS-500 без GH/INS даёт более скромный dose-aware множитель, чем прежний
    // плоский ×1.3-1.9 (chest 24→22, quads 22→18, glutes 12→10, abs 13→10),
    // но финализатор догружает малые группы, которые раньше срезались капом
    // сессии (traps 4→7, forearms 4→6, появились delt_front/mid по 2).
    // back 32→33. Валидатор зелёный, инварианты целы.
    // ⚠️ Граница (осознанная): на upper_lower_4 спина получает 2 стимула —
    //   недельный бюджет 33 < 60 (канон про-на-ПЕД достигается на PPL с 2
    //   Pull-днями; см. docs/BB-AUTO-PROFESSIONAL-AUDIT-2.md).
    expect(directVolume(plan)).toEqual({
      abs: 10, back: 33, biceps: 4, calves: 10, chest: 22, delt_front: 2, delt_mid: 2, delt_rear: 2, forearms: 6, glutes: 10, hamstrings: 26, quads: 18, shoulders: 0, traps: 7, triceps: 4,
    });
  });

  it('Generic natural (ppl_6, intermediate 3 года) — per-muscle объём', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    // Re-baseline (осознанно): PPL по-сессионные минимумы (bb-ppl-invariant:
    // biceps/triceps 8-10, calves 9, traps 5, rear-delt) + MEV-guard подняли
    // недельные объёмы выше baseline Этапа 10. Направления совпадают с
    // требованиями (руки/икры/трапы ровно на минимумах ×2 сессии).
    // Re-baseline 2 (Sep 2026, keep-first каталог): пулы канонических
    // упражнений вернули ягодицы 7→9, квадры 16→20; хамы 12→10 (гакк-хамы
    // в пуле перераспределили сеты). Валидатор зелёный.
    // Re-baseline 3 (аудит 2026-09, Волна-1): SFR/профиль сопротивления вошли
    // в _score отбора (ранее только тай-брейк) + флаг каталога stretchPhase —
    // выбор стал качественнее: спина 16→20 (SFR-сильные тяги/подтягивания),
    // бицепс 17→16 и задняя дельта 17→16 (лучший баланс при большем indirect
    // спины). Валидатор зелёный.
    // Re-baseline 4 (аудит 2026-09, Волна-2.6): единый допуск cap-adjust =
    // BB_MRV_TOLERANCE 1.15 (был локальный 1.05) — план больше не режется
    // строже валидатора: бицепс 16→18 (PPL-флор доехал без преждевременной
    // резки). Валидатор зелёный (overflow ≤ допуска).
    // Re-baseline 5 (Волна 0, п. 0.4): снапшот пересчитан по ФАКТУ финального
    // плана, а не по устаревшему weeklyVolume (снимался до enforceSessionRealism).
    // Факт (нед 1, ppl_6, intermediate): back 20→18, бицепс 18→16 — это то,
    // что реально в плане; прежние значения были правдоподобной, но неверной
    // калибровкой. План не менялся.
    // Re-baseline 6 (аудит-2): (1) сессионный кап считается ПЕР-НЕДЕЛЬНО
    // (было: стимулы по всем неделям плана — на длинных планах кап делился
    // дважды) — выполнение не режется ниже контракта (chest 16→18, glutes
    // 9→11, hamstrings 10→12, quads 20→19 после перераспределения);
    // (2) задняя дельта в Pull — канон пара «тяга к лицу + махи в наклоне»
    // (по 3 сета за Pull) → delt_rear 16→12 при видимой паре 6/сессию
    // (инвариант bb-ppl-invariant 5-8 выполняется); (3) грудь Push —
    // наклон + горизонт (make-room вместо раннего выхода) → 18.
    // Re-baseline 7 (аудит 2026-10, потолок упражнения): MEV-repair больше не
    // поднимает ОДНО упражнение выше perExerciseCap — распределение ровнее:
    // спина 18→19 тем же недельным объёмом (та же цель, кап 5/упр; валидатор
    // зелёный, сессии в лимитах).
    expect(directVolume(plan)).toEqual({
      abs: 8, back: 19, biceps: 16, calves: 18, chest: 18, delt_front: 7, delt_mid: 3, delt_rear: 12, forearms: 7, glutes: 11, hamstrings: 12, quads: 19, shoulders: 3, traps: 10, triceps: 16,
    });
  });

  it('ПРОФ-cycle adapt (CYCLE_01 + AAS 500) — per-muscle объём', () => {
    const plan = convertCycleToBBPlan({ cycle: CYCLE_01, workMax: WM, level: 'enhanced', trainingYears: 6, ...PED, mode: 'adapt' } as any);
    // Re-baseline (осознанно): те же кухни (минимумы/MEV-guard/back-стандарты),
    // цикл-путь затронут через общие проходы финализатора.
    // Re-baseline 2 (Ф1.1 CYCLE-SYSTEM-FULL-AUDIT): leg press → squat/quads
    // (movement-pattern) — квадры 15→13 (косвенный вклад leg press в хамс/
    // ягодицы убран из quad-бакета; валидатор зелёный).
    // Re-baseline 3 (про-объём циклового пути): предписанные цели по мышцам
    // (частота×per-session-кап) — квадры 13→15.
    expect(directVolume(plan)).toEqual({
      abs: 7, back: 10, biceps: 11, calves: 8, chest: 8, delt_front: 2, delt_mid: 2, delt_rear: 10, forearms: 7, glutes: 8, hamstrings: 11, quads: 15, shoulders: 0, traps: 6, triceps: 9,
    });
  });

  it('Library adapt (FULL_PROGRAM_LIBRARY) — per-muscle объём', () => {
    const src = FULL_PROGRAM_LIBRARY.find(p => p.weeks?.some(w => w.days?.some(d => d.exercises?.some(e => /подтяг|row|тяга/i.test(e.name)))));
    expect(src).toBeDefined();
    const plan = programToBBPlan(src!, { workMax: WM, level: 'enhanced', trainingYears: 6, ...PED, mode: 'adapt' } as any);
    // Re-baseline (осознанно): см. выше.
    // Re-baseline 3 (про-объём): предписанные цели по мышцам/частоте —
    // quads 9→19, chest 10→11, back 10→9, hamstrings 14→10, traps 9→6.
    // Re-baseline 4 (аудит 2026-10, потолок упражнения/ёмкость): ремонт больше
    // не раздувает одно упражнение (кап perExerciseCap) и добирает ёмкость
    // УПРАЖНЕНИЕМ — перераспределение без переполнений: трицепс 12→8 (на капе,
    // косвенный объём от жимов сохранён), грудь 11→13, квадры 19→20; max сетов
    // на упражнение ≤ кап, сессии ≤ лимитов (валидатор зелёный).
    expect(directVolume(plan)).toEqual({
      abs: 7, back: 9, biceps: 12, calves: 8, chest: 13, delt_front: 3, delt_mid: 2, delt_rear: 10, forearms: 7, glutes: 8, hamstrings: 10, quads: 20, shoulders: 0, traps: 6, triceps: 8,
    });
  });

  it('Инварианты: все мышцы > 0, ни одного single-set, сумма > лимита нет', () => {
    const plans = [
      buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, ...PED }),
      buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM }),
    ];
    for (const plan of plans) {
      for (const week of plan.weeks) for (const session of week.sessions) {
        const working = session.exercises.filter(e => !(e as any).warmupActivator);
        expect(working.length).toBeGreaterThan(0);
        for (const e of working) {
          expect(e.sets).toBeGreaterThanOrEqual(2);
          expect(e.sets).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
