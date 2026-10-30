/**
 * planner-day-targets.ts — ЕДИНЫЙ расчёт фактических целей дня генерации (Эпик A,
 * план NUTRITION-PLANNER-QUALITY-PLAN.md, Aug 30 2026).
 *
 * Проблема, которую решает: `computePlannerTargets` (planner-targets.ts) считал полную
 * научную цепочку (TDEE → bulk surplus → фаза курса → ААС/инсулин/GLP → weight-adapt →
 * metabolic adapt → женский гейт ≤22%), но фактические цели генерации собирались в
 * IndividualPlanContext из пресета белка × флоор жиров × потолок углей — наука доезжала
 * только через углеводную цель. Профицит 5→25% не менял план, weight-adapt молчал.
 *
 * Новая семантика (auto):
 *   1. kcalTarget = calcTargets.kcal — ПОЛНАЯ научная цепочка (surplus/фаза/фарма/адаптации).
 *   2. Белок = пресет пользователя (г/кг) — явный оверрайд поверх науки.
 *   3. Жиры = пол 0.8 г/кг; при инсулине научный кап 0.5 г/кг сильнее пола.
 *   4. Углеводы = ОСТАТОК до kcalTarget (наука доезжает!), затем диетологический потолок
 *      (computeDieteticCarbTarget: bulk 6-10 г/кг по объёму, инсулин-флор, budget).
 *   5. kcal = Atwater(Б, Ж, У) — display == генерация.
 *
 * manual/profile режимы сохраняют прежнее поведение (обратно-совместимость с тестами).
 * Чистая функция, детерминированная, тестируемая. Breakdown[] — строки для UI.
 */

import { computeDieteticCarbTarget, plannerGoalCategory } from './planner-targets';
import { PROTEIN_G_PER_KG_RANGE } from './types';
import type { PlannerTargets } from './planner-targets';

/**
 * ЕДИНЫЙ источник floor/MPS-модификаторов стиля питания (planType) — Эпик «хвост-3».
 *
 * Раньше было ДВА механизма для одного решения:
 *  1. `buildDayTargets(dietStyle)` — РЕАЛЬНЫЙ макро-профиль дня (кето: угли ≤6% ккал,
 *     highcarb: жиры на полу 0.8 г/кг и т.д.) → цели день, генерируемые движком;
 *  2. «декоративный» `planTypeMod` {pMult/fMult/cMult} из PLAN_TYPES, который приезжал
 *     в движок отдельным полем и умножал ТОЛЬКО флоры (CARB_FLOOR через cMult, MPS-порции
 *     через pMult), никак не влияя на реальные цели дня.
 *
 * Это была двойная семантика: стиль питания влиял на день и через профиль, и через
 * отдельный декоративный множитель флоров. Унификация: множители флоров/MPS выводятся
 * здесь (единственный источник), движок получает `planType` и сам их применяет — поле
 * `planTypeMod` из входа движка и поиск по PLAN_TYPES в Context удалены.
 */
export function planTypeFloorMods(planType?: string | null): { pMult: number; cMult: number } {
  switch (planType) {
    case 'keto': return { pMult: 1.0, cMult: 0.1 };              // низкоуглеводный → флор углей вниз
    case 'highcarb': return { pMult: 0.85, cMult: 1.35 };        // больше углей → флор выше, MPS-порция меньше
    case 'mediterranean': return { pMult: 1.0, cMult: 0.85 };
    case 'vegetarian': return { pMult: 0.8, cMult: 1.0 };        // растительный → MPS-порция ниже (лейцин реже)
    default: return { pMult: 1.0, cMult: 1.0 };
  }
}

export interface DayTargetsInput {
  weightKg: number;
  presetGPerKg: number;          // пресет белка пользователя (авто: жёстко 1.6–2.2, см. PROTEIN_G_PER_KG_RANGE)
  fatFloorGPerKg: number;        // физиологический пол жиров (0.8)
  kbjuMode: 'auto' | 'manual' | 'profile';
  manual?: { kcal?: number | null; p?: number | null; f?: number | null; c?: number | null; gPerKg?: { protein?: number | null; fat?: number | null; carbs?: number | null } | null };
  /** Научная цепочка целиком (phase/pharma/weight-adapt/metabolic/female gate) — для auto. */
  calcTargets: PlannerTargets;
  /** Нейтральные цели профиля (maintenance, без модификаторов) — для mode 'profile'. */
  profileTargets: PlannerTargets;
  goal: string;
  trainingVolumeMinPerWeek?: number;
  budget?: string;
  insulinTotalUnits?: number;
  /** Эпик 3: стиль питания (planType): 'keto'/'highcarb' реально меняют макро-профиль дня. */
  dietStyle?: string;
  /**
   * P1-9 «Снять потолок углей»: 0 = без диетологического потолка г/кг.
   * undefined = контекстный потолок по цели/объёму (прежнее поведение).
   */
  carbCapGPerKg?: number;
  /**
   * P1-фикс: фарма-надбавка белка (ААС +0.3 г/кг, GLP +0.2 г/кг), которую раньше считал
   * computePlannerTargets, но auto-день её игнорировал (брал только пресет). Теперь
   * прибавляется к пресету (кап 2.6 г/кг), чтобы чип «+ААС +N г» совпадал с днём.
   * 0/undefined → поведение прежнее (байт-в-байт).
   */
  pharmaProteinBoostG?: number;
}

export interface DayTargetsResult {
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
  /** Человекочитаемый разбор: TDEE → модификаторы → макросы. Для карточки в Settings/Results. */
  breakdown: string[];
  /** Кап углей сработал (день не добрал ккал до цели). UI: баннер «потолок ограничил». */
  carbCapClipped?: boolean;
  /**
   * B32 (аудит 2026-10): сколько углей было ДО применения диетпотолка.
   *
   * Баннер в UI показывает «цель N г/кг > потолка», и это N раньше бралось из
   * `calcTargets.carbs` / `profileTargets.carbs` — то есть из ДРУГОГО источника, чем
   * тот, к которому движок реально применил кап. В итоге число в кнопке «Снять
   * потолок» не совпадало с тем, что ограничивалось на самом деле (в auto-режиме
   * `calcTargets.carbs` — остаток научной цепи ДО правок ББ-плана/стиля питания).
   * Теперь значение приходит из той же функции, что и `carbCapClipped`.
   */
  carbsBeforeCap?: number;
}

const atwater = (p: number, f: number, c: number) => Math.round(p * 4 + f * 9 + c * 4);

export function buildDayTargets(input: DayTargetsInput): DayTargetsResult {
  const weight = Math.max(30, Math.min(300, Number(input.weightKg) || 80));
  // Авто-белок ограничен рабочим диапазоном 1.6–2.2 г/кг (решение пользователя).
  // Выше 2.2 — только ручной режим КБЖУ ниже: там цели берутся из явных граммов/г-кг пользователя
  // и этот клэмп не применяется (mode 'manual' возвращается раньше). Legacy 'max' (2.6) из старых
  // сохранений не может пробить потолок даже при прямом вызове движка.
  const preset = Math.max(PROTEIN_G_PER_KG_RANGE.min, Math.min(PROTEIN_G_PER_KG_RANGE.max, Number(input.presetGPerKg) || 2.0));
  const fatFloor = Math.max(0.4, Math.min(2.0, Number(input.fatFloorGPerKg) || 0.8));
  const insulinUnits = Math.max(0, Number(input.insulinTotalUnits) || 0);
  const mode = input.kbjuMode || 'auto';
  const manual = input.manual || {};
  const fallback: PlannerTargets = { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 };
  const base = input.calcTargets || fallback;
  const prof = input.profileTargets || fallback;

  // ─── manual: прежнее поведение (обратно-совместимо) ─────────────────────────
  // FIX manual-card: г/кг-инпуты карточки («Ввод в г/кг веса») писали только в
  // manualGPerKg → computePlannerTargets (calcTargets), который manual-ветка
  // игнорирует целиком. Итог: в ручном режиме г/кг были мертвы, а при пустых
  // граммах цели схлопывались в ~0 («рацион не собирается»). Теперь г/кг —
  // фолбэк граммов: явные граммы приоритетнее, недостающие считаются из г/кг.
  if (mode === 'manual') {
    const gpk = (manual as any)?.gPerKg || {};
    const gProtein = Number((gpk as any)?.protein) > 0 ? Math.round(weight * Number((gpk as any).protein)) : 0;
    const gFat = Number((gpk as any)?.fat) > 0 ? Math.round(weight * Number((gpk as any).fat)) : 0;
    const gCarbs = Number((gpk as any)?.carbs) > 0 ? Math.round(weight * Number((gpk as any).carbs)) : 0;

    // ─── FIX B19/B20 (аудит 2026-10): ручной режим = ЯВНЫЕ граммы пользователя ──
    // Было три дефекта, из-за которых «ручное КБЖУ» не работало как ручное:
    //  1) жир молча поднимался до диетологического пола (`fatFloor` = 0.8 г/кг):
    //     ввели Ж 30 при 80 кг → на выходе 64 г. Пользователь видел не свои цифры.
    //  2) если были заданы ккал И все три макроса, целью оставался введённый kcal,
    //     хотя БЖУ давали другую сумму по Атwater. Набор целей становился внутренне
    //     ПРОТИВОРЕЧИВЫМ (нельзя одновременно попасть в 2000 ккал и в Б150/Ж70/У200
    //     = 2030 ккал), и корректор честно не мог сойтись лучше 3% — «ползунок
    //     сходимости» всегда краснел в ручном режиме.
    //  3) если пользователь не задал ни граммов, ни ккал — все цели становились 0
    //     и рацион «не собирался».
    // Новый контракт (детерминированный и всегда внутренне согласованный):
    //  • явные граммы Б/Ж/У — приоритет; г/кг — только фолбэк для незаполненных;
    //  • жир не переписывается диетполом: применяется только физиологический
    //    минимум незаменимых ЖК (0.3 г/кг) и это ЯВНО пишется в разборе;
    //  • ккал не может противоречить БЖУ: если заданы все три макроса, ккал
    //    считается по Атwater (а расхождение с введённым ккал показывается);
    //  • если цели пусты — берём нейтральные цели профиля (план собирается).
    const pGiven = manual.p !== null && manual.p !== undefined && Number(manual.p) > 0;
    const fGiven = manual.f !== null && manual.f !== undefined && Number(manual.f) > 0;
    const cGiven = manual.c !== null && manual.c !== undefined && Number(manual.c) > 0;
    const kcalGiven = Number(manual.kcal) > 0;
    const notes: string[] = [];

    let p = pGiven ? Math.max(0, Math.round(Number(manual.p))) : gProtein;
    let f = fGiven ? Math.max(0, Math.round(Number(manual.f))) : gFat;
    let c = cGiven ? Math.max(0, Math.round(Number(manual.c))) : gCarbs;

    // Физиологический минимум жира (незаменимые ЖК) — единственная причина,
    // по которой ручной жир всё же корректируется. Порог низкий и явный.
    const essentialFatG = Math.max(15, Math.round(weight * 0.3));
    if (f > 0 && f < essentialFatG) {
      notes.push(`Ж ${f} г ниже физиологического минимума (${essentialFatG} г = 0.3 г/кг) — поднято до минимума`);
      f = essentialFatG;
    }

    // Требование пользователя (2026-10-30): ЛЮБОЙ не введённый параметр считается
    // автоматически — по тем же научным правилам, что и авто-режим (пресет белка,
    // норма жира с учётом инсулина, потолок углей, стиль питания). Раньше незаполненный
    // макрос оставался нулём (ввёл только белок → 720 ккал, Ж 0, У 0), а при полном
    // отсутствии ввода брались «нейтральные цели профиля», игнорируя науку.
    // Ленивая рекурсия: auto-ветка не содержит ручных полей, поэтому цикл невозможен.
    const autoForFill = () => buildDayTargets({ ...input, kbjuMode: 'auto', manual: undefined });

    // Добираем незаполненные макросы из ккал (если ккал задан).
    const missing = (v: number) => !(v > 0);
    if (kcalGiven) {
      const k = Math.round(Number(manual.kcal));
      if (missing(p) && missing(f) && missing(c)) {
        // только ккал: белок — пресет, жир — пол, угли — остаток
        p = Math.round(Math.min(weight * 2.6, weight * preset));
        f = Math.max(essentialFatG, Math.round(weight * fatFloor));
        c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
        notes.push(`из ${k} ккал: белок по пресету ${p} г, жир по полу ${f} г, угли — остаток`);
      } else if (missing(f) && missing(c) && p > 0) {
        // заданы только ккал (+возможно белок): жир — по диетологическому полу,
        // угли — остаток. Раньше здесь жир забирал ВСЮ калорийность (угли 0).
        f = Math.max(essentialFatG, Math.round(weight * fatFloor));
        c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
      } else if (missing(c) && p > 0 && f > 0) {
        // BUG-фикс: остаток углей считаем по ВЫЧИСЛЕННЫМ p/f, а не по сырым manual.*
        c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
      } else if (missing(f) && p > 0 && c > 0) {
        const rest = k - p * 4 - c * 4;
        f = Math.max(essentialFatG, Math.round(rest / 9));
      } else if (missing(p) && missing(c) && f > 0) {
        // Задан только жир (+ккал): делим остаток между белком и углеводами в
        // АВТО-ПРОПОРЦИИ, иначе белок съедал всю калорийность, а углеводы = 0.
        const auto = autoForFill();
        const rest = Math.max(0, k - f * 9);
        const autoSum = auto.protein * 4 + auto.carbs * 4;
        const t = autoSum > 0 ? rest / autoSum : 0;
        p = Math.max(0, Math.round(auto.protein * t));
        c = Math.max(0, Math.round(auto.carbs * t));
        notes.push(`из ${k} ккал при заданном жире: белок и углеводы — в авто-пропорции (${p} г / ${c} г)`);
      } else if (missing(p) && missing(f) && c > 0) {
        // Заданы только углеводы (+ккал): остаток делим между белком и жиром
        // в авто-пропорции, с полом незаменимых ЖК.
        const auto = autoForFill();
        const rest = Math.max(0, k - c * 4);
        const autoSum = auto.protein * 4 + auto.fats * 9;
        const t = autoSum > 0 ? rest / autoSum : 0;
        p = Math.max(0, Math.round(auto.protein * t));
        f = Math.max(essentialFatG, Math.round(auto.fats * t));
        notes.push(`из ${k} ккал при заданных углеводах: белок и жир — в авто-пропорции (${p} г / ${f} г)`);
      }
    }

    // ─── автодосчёт всего, что пользователь не ввёл ───────────────────────────
    // Единое правило: незаполненный макрос считается автоматически, а не остаётся 0.
    //  • белок/жир — из авто-цели (пресет + норма жира с учётом инсулина и стиля);
    //  • углеводы — остаток до ВВЕДЁННЫХ ккал, если они есть; иначе — авто-значение
    //    (с диетпотолком/кето-поправкой, чтобы автодосчёт не пробивал кап).
    if (!pGiven && !fGiven && !cGiven && !kcalGiven && !(gProtein > 0) && !(gFat > 0) && !(gCarbs > 0)) {
      // Ничего не введено → полный авто-расчёт (кап углей, стиль, инсулин).
      const auto = autoForFill();
      notes.push('цели не заданы — все три макроса посчитаны автоматически (как в авто-режиме)');
      const breakdown = [`Ручной режим (автодосчёт): ${auto.kcal} ккал · Б ${auto.protein} · Ж ${auto.fats} · У ${auto.carbs}`, ...notes];
      return { kcal: auto.kcal, protein: auto.protein, fats: auto.fats, carbs: auto.carbs, breakdown, carbsBeforeCap: auto.carbsBeforeCap ?? auto.carbs };
    }
    if (missing(p) || missing(f) || missing(c)) {
      const auto = autoForFill();
      if (missing(p)) {
        p = auto.protein;
        notes.push(`белок не задан — посчитан автоматически: ${p} г (пресет)`);
      }
      if (missing(f)) {
        f = Math.max(essentialFatG, auto.fats);
        notes.push(`жир не задан — посчитан автоматически: ${f} г (норма)`);
      }
      if (missing(c)) {
        if (kcalGiven) {
          const k = Math.round(Number(manual.kcal));
          c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
          notes.push(`углеводы не заданы — остаток до введённых ${k} ккал: ${c} г`);
        } else {
          c = auto.carbs;
          notes.push(`углеводы не заданы — посчитаны автоматически: ${c} г (с диетпотолком/стилем)`);
        }
      }
    }

    // Итоговые ккал: если заданы все три макроса — ккал ПРОИЗВОДНЫЙ (Атwater),
    // иначе набор целей был бы противоречивым и сходимость недостижима.
    const atwaterKcal = atwater(p, f, c);
    let kcal: number;
    if (pGiven && fGiven && cGiven) {
      kcal = atwaterKcal;
      if (kcalGiven) {
        const entered = Math.round(Number(manual.kcal));
        const devPct = entered > 0 ? Math.abs(entered - atwaterKcal) / entered * 100 : 0;
        if (devPct > 3) {
          notes.push(`введено ${entered} ккал, но Б ${p} + Ж ${f} + У ${c} = ${atwaterKcal} ккал (расхождение ${Math.round(devPct)}%) — цель по ккал приведена к БЖУ`);
        }
      }
    } else if (kcalGiven) {
      kcal = Math.round(Number(manual.kcal));
      // страховка: если остаток ушёл в минус/ноль, набор неисполним — берём Атwater
      if (Math.abs(kcal - atwaterKcal) / Math.max(1, kcal) > 0.15) {
        notes.push(`ккал ${kcal} не сходятся с БЖУ (${atwaterKcal}) — цель по ккал приведена к БЖУ`);
        kcal = atwaterKcal;
      }
    } else {
      kcal = atwaterKcal;
    }
    const breakdown = [`Ручной режим: ${kcal} ккал · Б ${p} · Ж ${f} · У ${c}`, ...notes];
    // B32: в ручном режиме диетпотолок не применяется, «до капа» == итог.
    return { kcal, protein: p, fats: f, carbs: c, breakdown, carbsBeforeCap: c };
  }

  // ─── profile: нейтральные цели профиля + диетпотолок (прежнее поведение) ────
  if (mode === 'profile') {
    const p = Math.max(0, Math.round(prof.protein || 0));
    const f = Math.max(Math.round(weight * fatFloor), Math.max(0, Math.round(prof.fats || 0)));
    const vol = Math.max(0, Number(input.trainingVolumeMinPerWeek) || 0);
    // B32: ровно то значение, которое уходит в кап (а не пересчёт «похожего» поля).
    const rawCarbsProfile = Math.max(0, Math.round(prof.carbs || 0));
    const c = computeDieteticCarbTarget({
      weightKg: weight, rawCarbsG: rawCarbsProfile, insulinTotalUnits: insulinUnits,
      goalPhase: plannerGoalCategory(input.goal || ''), trainingVolumeMinPerWeek: vol, budget: input.budget,
    });
    const kcal = atwater(p, f, c);
    return {
      kcal, protein: p, fats: f, carbs: c, carbsBeforeCap: rawCarbsProfile,
      breakdown: [`Профиль (без модификаторов): ${kcal} ккал · Б ${p} · Ж ${f} · У ${c} (потолок углей применён)`],
    };
  }

  // ─── auto: наука = источник калорий, пресет = белок, угли = остаток ─────────
  // P1-фикс: фарма-надбавка белка (ААС/GLP) добавляется к пресету, чтобы цель дня
  // совпадала с чипом «+ААС +N г». Кап 2.6 г/кг (выше авто-диапазона 2.2, но ниже опасного).
  const pharmaBoost = Math.max(0, Number(input.pharmaProteinBoostG) || 0);
  const protein = Math.round(Math.min(weight * 2.6, weight * preset + pharmaBoost));
  // Инсулин: научный кап жира 0.5 г/кг СИЛЬНЕЕ пола (planner-targets правило 6).
  const fatFloorAbs = Math.round(weight * fatFloor);
  const fats = insulinUnits > 0
    ? Math.max(20, Math.min(fatFloorAbs, Math.round(weight * 0.5)))
    : Math.max(fatFloorAbs, Math.max(0, Math.round(base.fats || 0)));
  const kcalTarget = Math.max(1200, Math.round(base.kcal || 0));
  const carbsRaw = Math.max(0, (kcalTarget - protein * 4 - fats * 9) / 4);
  const vol = Math.max(0, Number(input.trainingVolumeMinPerWeek) || 0);
  const goalPhase = plannerGoalCategory(input.goal || '');
  // Эпик 3: стиль питания — РЕАЛЬНЫЙ макро-профиль (не декорация):
  //   keto     — угли ≤6% ккал (кето-порог), жиры = остаток (кап 2.5 г/кг);
  //   highcarb — жиры на физиологическом полу 0.8 г/кг, угли = максимум до потолка;
  //   classic/mediterranean/vegetarian — без изменения целей (веган через пул).
  const dietStyle = input.dietStyle || 'classic';
  let fatsFinal = fats;
  let carbsFinal: number;
  if (dietStyle === 'keto') {
    // Кето: угли ≤6% ккал (или ≤60 г — кето-порог), жиры = остаток с безопасным капом 3 г/кг.
    // Если цель НЕ закрывается жирами в капе — угли честно поднимаются до минимума закрытия
    // (кето-набор на 4300+ ккал физически невозможен без углей; это фиксируется в breakdown).
    const ketoCarbCap = Math.max(20, Math.min(Math.round(kcalTarget * 0.06 / 4), 60));
    let carbsKeto = Math.min(carbsRaw, ketoCarbCap);
    // P1-фикс: инсулиновый кап жира 0.5 г/кг СИЛЬНЕЕ стиля — раньше кето молча
    // переписывал кап (150–190 г жиров на 100 кг вместо 50), а строка breakdown
    // «инсулин: кап 0.5 г/кг сильнее пола» при этом врала.
    const insulinFatCap = insulinUnits > 0 ? Math.max(20, Math.round(weight * 0.5)) : null;
    let fatsKeto = Math.max(fatFloorAbs, Math.round((kcalTarget - protein * 4 - carbsKeto * 4) / 9));
    if (insulinFatCap !== null && fatsKeto > insulinFatCap) { fatsKeto = insulinFatCap; carbsKeto = Math.max(0, Math.round((kcalTarget - protein * 4 - fatsKeto * 9) / 4)); }
    const fatsCapKeto = Math.round(weight * 3.0);
    if (fatsKeto > fatsCapKeto) {
      fatsFinal = fatsCapKeto;
      carbsKeto = Math.max(0, Math.round((kcalTarget - protein * 4 - fatsFinal * 9) / 4));
    } else {
      fatsFinal = fatsKeto;
    }
    carbsFinal = carbsKeto;
  } else if (dietStyle === 'highcarb') {
    fatsFinal = fatFloorAbs;
    carbsFinal = Math.max(0, Math.round((kcalTarget - protein * 4 - fatsFinal * 9) / 4));
  } else {
    carbsFinal = Math.round(carbsRaw);
  }
  // Волна-3 чистка (2026-10-18): тернарники `kbjuMode === 'manual'` были мёртвыми —
  // в manual/profile buildDayTargets завершается ранним return (:143/:159), код ниже
  // достижим только в auto-режиме.
  const carbs = computeDieteticCarbTarget({
    weightKg: weight, rawCarbsG: carbsFinal, insulinTotalUnits: insulinUnits,
    goalPhase, trainingVolumeMinPerWeek: vol, budget: input.budget,
    carbGPerKg: input.carbCapGPerKg,
    minCarbG: dietStyle === 'keto' ? 0 : undefined,
  });
  const kcal = atwater(protein, fatsFinal, carbs);

  const breakdown: string[] = [];
  breakdown.push(`TDEE ${Math.round(base.tdee || 0)} ккал → с фазой/фармой/адаптациями ${kcalTarget} ккал`);
  if (base.adjustment) breakdown.push(`Коррекция движка питания: ${base.adjustment > 0 ? '+' : ''}${Math.round(base.adjustment)} ккал`);
  // Эпик 2: предупреждения согласованности (цель vs фарма-фаза) — в карточке целей.
  if (Array.isArray((base as any).warnings)) (base as any).warnings.forEach((w: string) => breakdown.push(w));
  breakdown.push(`Белок: пресет ${preset} г/кг → ${protein} г`);
  if (pharmaBoost > 0) breakdown.push(`💉 Фарма-надбавка белка: +${Math.round(pharmaBoost)} г (ААС/GLP, кап 2.6 г/кг)`);
  if (base.protein > protein * 1.12) breakdown.push(`Научный белок ${Math.round(base.protein)} г выше пресета — пресет приоритетен (поднимите «🥩 Пресет белка» при необходимости)`);
  breakdown.push(insulinUnits > 0
    ? `Жиры: ${fatsFinal} г (инсулин: кап 0.5 г/кг сильнее пола)`
    : `Жиры: ${fatsFinal} г (пол ${fatFloor} г/кг)`);
  breakdown.push(`Углеводы: остаток до ${kcalTarget} ккал → ${carbs} г (диетологический потолок ${goalPhase})`);
  if (dietStyle === 'keto') {
    const ketoCapG = Math.max(20, Math.min(Math.round(kcalTarget * 0.06 / 4), 60));
    breakdown.push(`🥑 Стиль «Кето»: угли ≤6% ккал (≤${ketoCapG} г), жиры = остаток (кап 3 г/кг)${fatsFinal >= Math.round(weight * 3.0) ? ' — ⚠ цель не закрывается жирами, угли подняты до минимума закрытия' : ''}`);
    // Честный конфликт: гликемический пол инсулина может перекрыть кето-цель —
    // раньше это происходило молча, и пользователь видел «Кето» при 400 г углей.
    if (carbs > ketoCapG) {
      breakdown.push(`⚠ Конфликт: гликемический пол инсулина требует ≥${Math.round((insulinUnits || 0) * 10)} г углей — кето-цель (≤${ketoCapG} г) перекрыта. Это безопасность инсулиновых окон, а не стиль рациона.`);
    }
  }
  if (dietStyle === 'highcarb') breakdown.push(`🍚 Стиль «Высоко-углеводный»: жиры на полу ${fatFloor} г/кг, угли = максимум до потолка`);
  breakdown.push(`Итог дня: ${kcal} ккал = Б ${protein}×4 + Ж ${fatsFinal}×9 + У ${carbs}×4`);
  if (kcal < kcalTarget * 0.92) breakdown.push(`⚠ Потолок углей срезал ${Math.round(kcalTarget - kcal)} ккал — увеличьте объём тренировок или бюджет («💰»), либо снимите потолок`);
  return { kcal, protein, fats: fatsFinal, carbs, breakdown, carbCapClipped: carbs < carbsFinal - 1, carbsBeforeCap: carbsFinal };
}
