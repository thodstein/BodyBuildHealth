import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { isRealVegItem } from '../planner-quality-score';
import { PLANNER_CONVERGENCE_PCT } from '../day-target-corrector';

/**
 * §8.122 «нота говорит факт» (замок, ревью 2026-11-24).
 *
 * У ноты овощного добора два обязательства, и оба проверяются на сетке 160 дней
 * (10 профилей × 3–6 приёмов × трен/отдых × авто/ручной):
 *  • «Овощной слот ЗАКРЫТ настоящим овощем» — только дню, который действительно держит
 *    ≥ 200 г овоща и ≥ 2 вида (QG10);
 *  • «Овощной слот добрать НЕ удалось» — только дню, который пол не держит.
 * Раньше первая фраза писалась любому дню с `_added88 > 0`. Замер до правки:
 * `normal90/3/отд/руч` +49 г → 180 г/1 вид, `recomp80/3/отд/руч` +45 г → 180 г/1 вид,
 * `keto85/5/тр/руч` +150 г → 150 г/1 вид — добор упирался в тарелку дня, а нота утверждала
 * закрытый слот. Замер после правки: на той же сетке **39** дней «слот закрыт» и **3** дня
 * «добрать не удалось», расхождений с фактом **0**. Факт для слова «крахмал срезан» копится
 * всеми тремя ходами добора — доращиванием (`_grow88`) и обеими постановками (`_try1st88`,
 * `_try2nd88`): раньше две последние выбрасывали результат `_trimCarb88`, и день, где овощ
 * ПРИШЁЛ, а не дорос, получал ноту «срезать было нечего» при реальном срезе 30–60 ккал.
 *
 * Почему здесь НЕ проверяется «N г = разница овоща дня с добором и без»: это не инвариант
 * движка. Нота — запись ПРИНЯТЫХ шагов добора (§8.122 идёт до §8.110-последней-мили, §8.112,
 * §8.114, §8.127/§8.128), а стадии после неё законно пере-порционируют тарелку. Замер
 * `mass110/4/отд/руч`: нота 119 г, факт добора 135 г bok_choy в перекусе + 19 г к endive, а
 * итоговая разница с днём без добора — 114 г, потому что день без добора держал ещё и 40 г
 * сельдерея в обеде.
 *
 * Дефект, из-за которого граммы ноты стали предметом ревью (P2-1): `_grow88` растил
 * захваченную позицию овоща, но откат `_run88` заменяет позиции приёмов КЛОНАМИ, поэтому
 * следующий шаг лестницы писал в сироту, а срез крахмала шёл по ЖИВОЙ тарелке — день терял
 * крупу без овоща, а нота обещала граммы, которых в тарелке нет. Позиция теперь
 * пере-разрешается на каждом шаге по `id`+роли, а шаг без живой позиции отвергается
 * (`_run88` требует `gained > 0`). Замер мутации (`live → vIt`) на этой сетке: 0 расхождений,
 * то есть лестница повторов на ней не срабатывает — отдельного замка на неё нет.
 */

const PROFILES = [
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, k: 2400, p: 180, f: 150 },
];

const carbsFor = (p: any) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));

const build = (p: any, mc: number, tr: boolean, manual: boolean): any =>
  buildDayPlan({
    weightKg: p.w,
    lbmKg: Math.round(p.w * 0.82),
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: p.k,
    goalProteinG: p.p,
    goalFatG: p.f,
    goalCarbsG: carbsFor(p),
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  } as unknown as MealPlanInput);

/** Овощ дня по §8.122 — ТЕМ ЖЕ предикатом, что `_veg88`/`_vegKinds88` (`isRealVegItem`):
 *  роль `veg` + плотность белка < 12 г/100 г; микро-флаги НЕ исключаются (§8.124, замер
 *  600 дней: флаги стоят только на настоящем овоще). Иначе тест мерил бы строже движка. */
const vegItems = (plan: any): any[] =>
  ((plan.meals || []) as any[]).flatMap((m: any) => m.items || []).filter((x: any) => isRealVegItem(x));
const vegG = (plan: any): number => vegItems(plan).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
const vegKinds = (plan: any): number => new Set(vegItems(plan).map((x: any) => String(x.id))).size;

const vegNote = (plan: any): string | null =>
  (plan.notes || []).map(String).find((n: string) => n.includes('🥦 Овощной слот')) ?? null;

describe('§8.122: нота овощного добора не врёт ни в одну сторону', () => {
  it('«слот закрыт» ⇒ ≥ 200 г и ≥ 2 вида; «добрать не удалось» ⇒ пола нет (160 дней сетки)', () => {
    let closed = 0;
    let partial = 0;
    const lies: string[] = [];
    for (const p of PROFILES) {
      for (const mc of [3, 4, 5, 6]) {
        for (const tr of [false, true]) {
          for (const manual of [false, true]) {
            const plan: any = build(p, mc, tr, manual);
            const note = vegNote(plan);
            if (!note) continue;
            const tag = `${p.id}/mc${mc}/${tr ? 'тр' : 'отд'}/${manual ? 'руч' : 'авто'}`;
            const g = Math.round(vegG(plan));
            const k = vegKinds(plan);
            const holds = g >= 200 && k >= 2;
            const claimsClosed = note.includes('слот закрыт настоящим овощем');
            const claimsPartial = note.includes('слот добрать не удалось');
            if (claimsClosed) closed += 1;
            if (claimsPartial) partial += 1;
            if (claimsClosed && !holds) {
              lies.push(`${tag}: «слот закрыт», факт ${g} г / ${k} вида — «${note.slice(0, 70)}…»`);
            }
            if (claimsPartial && holds) {
              lies.push(`${tag}: «добрать не удалось», факт ${g} г / ${k} вида — «${note.slice(0, 70)}…»`);
            }
            if (!claimsClosed && !claimsPartial) {
              lies.push(`${tag}: нота овощного добора без вердикта — «${note.slice(0, 70)}…»`);
            }
            // Обещание «крахмал срезан на ту же калорийность» не должно приходить на день,
            // который потом ушёл за канон своего пути (2 % ручной / 3 % авто).
            if (note.includes('крахмал срезан на ту же калорийность')) {
              const canon = manual ? 2 : PLANNER_CONVERGENCE_PCT;
              if (!(Number(plan.deviationPct) <= canon + 1e-9)) {
                lies.push(`${tag}: «крахмал срезан», но день ${plan.deviationPct} % > ${canon} %`);
              }
            }
          }
        }
      }
    }
    expect(lies).toEqual([]);
    // Замок не должен проходить вхолостую: вердикт ноты обязан встречаться на сетке.
    expect(closed).toBeGreaterThanOrEqual(10);
    expect(closed + partial).toBeGreaterThanOrEqual(20);
  }, 600000);
});

/**
 * §8.122 / P2-3 (`docs/NUTRITION-PLANNER-NEXT-PLAN-2026-11.md:84-89`): лестница повторов.
 *
 * Инвариант: «день не теряет крупу без овоща» — крахмал дня может упасть относительно
 * дня БЕЗ овощного добора (`vegTopUp88: false`) только если овощ дня вырос; сильнее и
 * точнее по месту правки — тарелка не теряет крахмал, если ЕЁ овощ не вырос.
 *
 * Замеры (2026-11-25, сетка считает каждый день через `buildDayPlan` дважды):
 *  • 160 дней (10 профилей × 3–6 приёмов × трен/отдых × авто/ручной): овощ вырос в **47**
 *    днях; дней «крахмал упал без роста овоща» — **0** (дневной уровень).
 *  • ветка лестницы реально срабатывает: на расширенной сетке 960 дней (профили w70/w90 ×
 *    kcal 1400–7000 × 2 белка × 2 жира × mc 2–4 × трен/отдых × авто/ручной) — **60**
 *    входов в `if (!_grow88(want))`, **31** принятый второй шаг. Форма ниже
 *    (`w70k3600p1.6f0.7/mc2/тр/руч/s1d1`) — один из этих дней (`_ok88` отверг `want`,
 *    лестница приняла шаг; замер инструментированного движка: entry=1, ok=1).
 *  • мутация `live → vIt` на ДНЕВНОМ уровне не наблюдаема: на 960 + 1728 + 2592 + 1152
 *    днях (сетки с randomSalt/dayOffset/fiberCapG/goal/variety) принятых «сиротских» шагов
 *    было 1 + 6 + 3 + 8 = 18, и все они либо полностью откачены финальным гейтом §8.122
 *    (`_qA88.total < _qB88.total` — крахмал дня возвращается к дню без добора), либо живой
 *    овощ догоняется следующей постановкой/стадией (40 → 265 г). Дней «день потерял
 *    крахмал без овоща» под мутацией — **0**. Значит дневной замок зелёный и под мутацией,
 *    и P2-3 им не закрывается: нужен внутренний self-check движка (assert, что `live`
 *    после пере-разрешения лежит в `m.items`, или счётчик в `_grow88`), иначе гейт §8.122
 *    маскирует сироту.
 *  • наблюдаемый след той же мутации — тарелочная форма инварианта на этой же форме:
 *    чистый движок держит срез только там, где овощ вырос (обед +55 г овоща, −15 г крахмала;
 *    ужин −15 г овоща, +1 г крахмала), а под мутацией обед теряет 5 г крахмала и перекус 1 г
 *    при НЕИЗМЕНЁННОМ овоще (0 → 0). Этот замок красный под мутацией и зелёный на текущем коде.
 */
const buildEx = (p: any, mc: number, tr: boolean, manual: boolean, extra: Record<string, any> = {}): any =>
  buildDayPlan({
    weightKg: p.w,
    lbmKg: Math.round(p.w * 0.82),
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: p.k,
    goalProteinG: p.p,
    goalFatG: p.f,
    goalCarbsG: carbsFor(p),
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
    ...extra,
  } as unknown as MealPlanInput);

const starchG = (plan: any): number =>
  ((plan.meals || []) as any[])
    .flatMap((m: any) => m.items || [])
    .filter((x: any) => x.role === 'carb_slow' || x.role === 'carb_fast')
    .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);

const mealStarchG = (m: any): number =>
  ((m?.items || []) as any[])
    .filter((x: any) => x.role === 'carb_slow' || x.role === 'carb_fast')
    .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);

/** Приёмы по ключу `тип#вхождение`: план с добором и без него держат одни и те же слоты. */
const mealsByKey = (plan: any): Map<string, any> => {
  const out = new Map<string, any>();
  const seen = new Map<string, number>();
  for (const m of plan.meals || []) {
    const t = String(m.type);
    const i = seen.get(t) || 0;
    seen.set(t, i + 1);
    out.set(`${t}#${i}`, m);
  }
  return out;
};

describe('§8.122 P2-3: лестница повторов не теряет крупу без овоща', () => {
  it('день: крахмал упал ⇒ овощ дня вырос (160 дней сетки)', () => {
    let grew = 0;
    const bad: string[] = [];
    for (const p of PROFILES) {
      for (const mc of [3, 4, 5, 6]) {
        for (const tr of [false, true]) {
          for (const manual of [false, true]) {
            const on: any = buildEx(p, mc, tr, manual);
            const off: any = buildEx(p, mc, tr, manual, { vegTopUp88: false });
            const vOn = Math.round(vegG(on));
            const vOff = Math.round(vegG(off));
            const sOn = starchG(on);
            const sOff = starchG(off);
            if (vOn > vOff) grew += 1;
            if (sOn < sOff && vOn <= vOff) {
              bad.push(
                `${p.id}/mc${mc}/${tr ? 'тр' : 'отд'}/${manual ? 'руч' : 'авто'}: крахмал ${sOff}→${sOn} г, овощ ${vOff}→${vOn} г`,
              );
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
    // Замок не проходит вхолостую: на сетке есть дни, где добор реально вырастил овощ.
    expect(grew).toBeGreaterThanOrEqual(20);
  }, 600000);

  it('тарелка: форма с принятым вторым шагом роста не теряет крахмал без своего овоща', () => {
    // Формы из замера: на обеих чистый движок входит в лестницу (entry=1, ok=1 при
    // инструментированном `_grow88`); `mc` 2 и 3 дают тот же день, но фиксируют оба слота.
    const p14 = { id: 'w70k3600p1.4f0.7', w: 70, k: 3600, p: 98, f: 49 };
    const p16 = { id: 'w70k3600p1.6f0.7', w: 70, k: 3600, p: 112, f: 49 };
    const forms: any[] = [
      [p14, 2, { randomSalt: 4, dayOffset: 1 }],
      [p14, 3, { randomSalt: 4, dayOffset: 1 }],
      [p16, 2, { randomSalt: 1, dayOffset: 1 }],
      [p16, 3, { randomSalt: 1, dayOffset: 1 }],
    ];
    const bad: string[] = [];
    let accepted = 0;
    for (const [p, mc, extra] of forms) {
      const on: any = buildEx(p, mc, true, true, extra);
      const off: any = buildEx(p, mc, true, true, { ...extra, vegTopUp88: false });
      const tag = `${p.id}/mc${mc}`;
      if (Math.round(vegG(on)) > Math.round(vegG(off))) accepted += 1;
      const onMeals = mealsByKey(on);
      const offMeals = mealsByKey(off);
      for (const [key, mOn] of onMeals) {
        const mOff = offMeals.get(key);
        if (!mOff) continue;
        const sOn = mealStarchG(mOn);
        const sOff = mealStarchG(mOff);
        const vOn = Math.round(vegG({ meals: [mOn] }));
        const vOff = Math.round(vegG({ meals: [mOff] }));
        if (sOn < sOff && vOn <= vOff) {
          bad.push(`${tag} ${key}: крахмал ${sOff}→${sOn} г, овощ ${vOff}→${vOn} г`);
        }
      }
    }
    expect(bad).toEqual([]);
    // Лестница должна реально срабатывать: хотя бы на одной форме добор принят.
    expect(accepted).toBeGreaterThanOrEqual(1);
  }, 600000);
});
