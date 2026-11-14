/**
 * Calc.substanceUl.ts — предел рядом с дозой в карточке вещества.
 *
 * Зачем отдельный модуль: плашка `DoseUlBadge` есть в протоколах поддержки, но
 * карточка калькулятора показывала только дозу («Магний 200 мг», «Железо 60 мг»)
 * и молчала о пределе. Человек читал карточку как «доза проверена» и не видел,
 * где проходит граница. Это тот же класс, что и подпись единиц: доза без
 * контекста — неполное утверждение.
 *
 * Источник чисел — ТОЛЬКО реестр: `NUTRIENT_UL` (производная `NUTRIENT_LIMITS_V2`,
 * мг/мкг) + `NUTRIENT_LIMIT_INFO` (тип предела, юрисдикция, эффект). Пересчёт дозы
 * в единицу реестра — `planDosesInUlScale`, тот же, что у `checkPlanUpperLimits`
 * и «Суммарной нагрузки»; своего пересчёта здесь нет.
 *
 * ⚠️ Честность типа предела:
 *  - `SafeLevel` (железо) — НЕ порог токсичности: текст говорит это прямо;
 *  - `ClinicalGuidance` (NAC, B12, хром) — клинический ориентир, а не UL;
 *  - «выше» для `SafeLevel` означает «выше уровня наблюдений», а не «токсично».
 */
import { NUTRIENT_LIMIT_INFO, NUTRIENT_UL } from '../../../engines/support-plan/types';
import { planDosesInUlScale, ulLimitKeyOf } from '../../../engines/support-plan/engine-helpers';
import { resolveNutrient } from '../../../engines/support-limits';
import { formatDose } from '../../../data/dose-units';

export type SubstanceLimitKind = 'UL' | 'SafeLevel' | 'ClinicalGuidance';

export interface SubstanceLimitView {
  /** Короткая подпись рядом с дозой: «UL 350 мг», «выше Safe Level 40 мг» … */
  text: string;
  /** Полная расшифровка для tooltip: юрисдикция, год, критический эффект, альтернатива. */
  title: string;
  kind: SubstanceLimitKind;
  /** Доза выше предела. Для SafeLevel это НЕ токсичность (см. `title`). */
  over: boolean;
}

/**
 * Ключ реестра для id вещества. `ulLimitKeyOf` знает только id-пространство
 * `NUTRIENT_UL`, поэтому формы (`magnesium_glycinate`) дорезолвиваются до
 * нутриента — иначе карточка формы молчала бы о пределе.
 */
function limitKeyOf(id: string): string | undefined {
  const direct = ulLimitKeyOf(id);
  if (direct) return direct;
  const canon = resolveNutrient(id);
  return canon && NUTRIENT_UL[canon] !== undefined ? canon : undefined;
}

/**
 * Строка предела для карточки вещества.
 *
 * @param subId — id вещества (как в карточке/плане)
 * @param doseNatural — доза в НАТУРАЛЬНОЙ единице вещества, но в ЭЛЕМЕНТАРНОМ
 *   выражении для минералов (плановая шкала). Массу соли пересчитывает карточка
 *   (`elementalMgOf`) ДО вызова — иначе 400 мг цитрата сравнивались бы как 400 мг Mg.
 * @returns `null` — предела в реестре нет (или предел не установлен): нечего печатать.
 */
export function substanceLimitView(
  subId: string,
  doseNatural: number | null,
): SubstanceLimitView | null {
  if (!subId) return null;
  const key = limitKeyOf(subId);
  if (!key) return null;
  const ul = NUTRIENT_UL[key];
  if (!ul || !(ul > 0)) return null;

  const canon = resolveNutrient(key);
  const info = canon ? NUTRIENT_LIMIT_INFO[canon] : undefined;
  if (!info || info.kind === 'NotEstablished') return null;

  const limitTxt = formatDose(key, ul);
  // Доза → единица реестра тем же конвертером, что у UL-контура плана.
  const converted = doseNatural !== null && Number.isFinite(doseNatural) && doseNatural > 0
    ? planDosesInUlScale({ [key]: doseNatural })[key]
    : undefined;
  const over = converted !== undefined && converted > ul;

  const notes: string[] = [];
  if (info.kind === 'UL') {
    notes.push(
      `${info.jurisdiction} ${info.year}: верхний допустимый уровень для добавок, `
      + `критический эффект — ${info.criticalEffect}. Суммируется по всем продуктам стека.`,
    );
  } else if (info.kind === 'SafeLevel') {
    notes.push(
      `${info.jurisdiction} ${info.year}: UL для этого нутриента НЕ УСТАНОВЛЕН, `
      + `${limitTxt} — «safe level», выше которого не наблюдали побочных эффектов `
      + `(критический эффект — ${info.criticalEffect}). Это НЕ порог токсичности: `
      + `перегрузка оценивается по лаборатории, а не по дозе.`,
    );
  } else {
    notes.push(
      `${info.jurisdiction} ${info.year}: регуляторного UL нет — ${limitTxt} клинический `
      + `ориентир из практики (критический эффект — ${info.criticalEffect}). Не предел безопасности.`,
    );
  }
  if (info.altValue !== undefined && info.altJurisdiction) {
    notes.push(
      `Другая юрисдикция — ${info.altJurisdiction} ${info.altYear ?? ''}: `
      + `${formatDose(key, info.altValue)} (не применяется).`,
    );
  }
  if (!info.verified) {
    notes.push('Значение НЕ перепроверено по первоисточнику — помечено в реестре как невыверенное.');
  }

  let text: string;
  if (info.kind === 'UL') {
    text = `${over ? 'выше UL' : 'UL'} ${limitTxt}`;
  } else if (info.kind === 'SafeLevel') {
    // Слово «UL» здесь запрещено: 40 мг железа — уровень наблюдений, не предел.
    text = over
      ? `выше Safe Level ${limitTxt} — не порог токсичности`
      : `Safe Level ${limitTxt} — не порог токсичности`;
  } else {
    text = over
      ? `выше клинического ориентира ${limitTxt} · не UL`
      : `клинический ориентир ${limitTxt} · не UL`;
  }

  return { text, title: notes.join(' '), kind: info.kind, over };
}
