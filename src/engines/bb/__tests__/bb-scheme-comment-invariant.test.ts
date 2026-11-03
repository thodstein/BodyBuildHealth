/**
 * bb-scheme-comment-invariant.test.ts (итерация G)
 *
 * ИНВАРИАНТ: цифра сетов в комментарии схемы объёма = фактическое число сетов
 * упражнения в плане.
 *
 * Зачем отдельный файл, если есть bb-scheme-comment-consistency:
 * тот проверял ТОЛЬКО FST-7 (тогда чинили именно его). Разведка показала, что
 * ровно тот же обман живёт у GVT (и потенциально у 8×8 Gironda): финализатор
 * назначает 5×10, а недельный бюджет режет до 4 или 3 — комментарий продолжает
 * обещать 5 сетов. Замер на 8-недельных планах: десятки упражнений с «GVT 10×10
 * (5×10)», у которых в плане 3-4 сета.
 *
 * Поэтому контракт проверяется по МАТРИЦЕ схем × паттернов × уровней, а не на
 * одном примере: любая будущая правка распределения сетов обязана либо сохранять
 * схему целиком, либо честно переписать цифру (и назвать причину).
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { applyPostPhaseProcessing } from '../bb-autocoach.engine';

const WM = {
  chest: 110, back: 130, shoulders: 65, quads: 150, hamstrings: 105,
  glutes: 145, biceps: 52, triceps: 62, calves: 85, traps: 75, forearms: 42,
};

const SCHEMES = ['gvt', 'fst7', 'gironda'] as const;
const PATTERNS = ['ppl_6', 'upper_lower_4', 'fullbody_3'] as const;
const LEVELS = [
  { level: 'intermediate', trainingYears: 3, extra: {} },
  { level: 'advanced', trainingYears: 6, extra: {} },
  { level: 'enhanced', trainingYears: 9, extra: { peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 2 } } },
] as const;

/** Комментарий схемы: «GVT 10×10 (5×10, отдых 75с)» / «FST-7 (7×8-12…)» / «Gironda 8×8 (5×8…)». */
const CLAIM = /(GVT 10×10|FST-7|Gironda 8×8) \((\d+)×/;

describe('G: цифра в комментарии схемы объёма = фактические сеты', () => {
  for (const scheme of SCHEMES) {
    for (const patternId of PATTERNS) {
      for (const { level, trainingYears, extra } of LEVELS) {
        it(`${scheme} × ${patternId} × ${level}`, () => {
          const plan: any = buildBBPlan({
            patternId, level, trainingYears, goal: 'mass', sex: 'male', weeks: 8,
            workMax: WM, volumeScheme: scheme, courseIntensity: 'moderate', ...(extra as any),
          } as any);

          let checked = 0;
          const lies: string[] = [];
          for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
            const m = CLAIM.exec(String(e.comment || ''));
            if (!m) continue;
            checked += 1;
            const claimed = Number(m[2]);
            if (claimed !== Number(e.sets)) {
              lies.push(`нед ${w.week}: «${m[1]} ${claimed}×» → в плане ${e.sets} (${e.name})`);
            }
          }
          // Схема не обязана примениться на каждой сборке (MRV-гейт), но если
          // применилась — обещание обязано совпасть с фактом.
          expect(lies, lies.slice(0, 5).join('; ')).toEqual([]);
          if (checked > 0) expect(checked).toBeGreaterThan(0);
        });
      }
    }
  }

  it('урезанная схема объясняет причину прямо в упражнении', () => {
    // Хоть одна сборка из матрицы обязана попасть в «схема урезана» — иначе
    // инвариант выше ничего не доказывает про честность причины.
    let applied = 0;
    let trims = 0;
    for (const scheme of SCHEMES) {
      const plan: any = buildBBPlan({
        patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass',
        sex: 'male', weeks: 8, workMax: WM, volumeScheme: scheme,
      } as any);
      const joined = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
        .map((e: any) => String(e.comment || '')).join('\n');
      // Схема могла не примениться (MRV-гейт / уровень) — это нормально, но хотя бы
      // на двух из трёх она обязана примениться, иначе тест вакуумный.
      if (CLAIM.test(joined)) applied += 1;
      trims += (joined.match(/схема урезана бюджетом недели|финишер урезан бюджетом недели/g) || []).length;
    }
    expect(applied, 'схемы объёма вообще не применились').toBeGreaterThanOrEqual(2);
    expect(trims, 'ни одного урезания схемы — инвариант нечем подтвердить').toBeGreaterThan(0);
  });
});

/**
 * H: пост-обработка (`applyPostPhaseProcessing`) меняет сеты ПОСЛЕ билдера —
 * авто-регуляция по готовности множит объём каждой недели (×0.7…×1.1). До фикса
 * комментарий схемы оставался на числе, назначенном билдером: замер на 24
 * сборках дал 509 расхождений, включая рост (5 → 6 сетов при ×1.1).
 */
describe('H: авто-регуляция не оставляет схему с чужим числом сетов', () => {
  for (const scheme of ['gvt', 'gironda'] as const) {
    for (const mult of [0.7, 0.85, 1.1]) {
      it(`${scheme} × готовность ${mult}`, () => {
        const base: any = buildBBPlan({
          patternId: 'ppl_6', level: 'advanced', trainingYears: 6, goal: 'mass', sex: 'male',
          weeks: 8, workMax: WM, volumeScheme: scheme,
        } as any);
        const post: any = applyPostPhaseProcessing({
          plan: JSON.parse(JSON.stringify(base)), totalWeeks: 8, workMax: WM,
          skipPhaseRedistribution: true,
          autoRegResult: { volumeMultiplier: mult, weightMultiplier: 1, rirShift: 0, readinessLabel: 'test' },
        } as any);

        const lies: string[] = [];
        let checked = 0;
        for (const w of post.weeks) {
          for (const s of w.sessions) for (const e of s.exercises) {
            const m = CLAIM.exec(String(e.comment || ''));
            if (!m) continue;
            checked += 1;
            if (Number(m[2]) !== Number(e.sets)) {
              lies.push(`нед ${w.week}: «${m[1]} ${m[2]}×» → ${e.sets} (${e.name})`);
            }
          }
        }
        // Схема в этом плане применяется (ppl_6 advanced) — иначе тест пустой.
        expect(checked).toBeGreaterThan(0);
        expect(lies, lies.slice(0, 5).join('; ')).toEqual([]);
        // Причина названа именно авто-регуляцией, а не «бюджетом недели».
        const joined = post.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
          .map((e: any) => String(e.comment || '')).join('\n');
        expect(joined).toMatch(/объём по готовности: \d+ из \d+ сетов/);
        expect(post.rationale.join('\n')).toMatch(/авто-регуляция изменила число сетов/);
      });
    }
  }
});
