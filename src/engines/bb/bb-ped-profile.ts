/**
 * bb-ped-profile.ts — одно дозо-зависимое правило «реальный PED-профиль».
 *
 * Аудит 2026-11, P3-2. Раньше «высокий объём/на курсе» определялся в трёх местах по
 * трём разным правилам: решения о сплите — дозо-зависимо, кап сессии и MRV-множитель —
 * по самому факту непустого списка `peds`. Креатин (и любой витамин из списка) делал
 * атлета «курсовым»: недельный бюджет восстановления ×2, MRV ×1.9–2.15, кап сессии
 * 60/16 — то есть план строился на объёме, которого у атлета нет.
 *
 * Модуль вынесен отдельно, чтобы его могли читать и `bb-selector` (правило сплита), и
 * `bb-volume` (бюджет/MRV/капы сессии): `bb-volume` не может импортировать
 * `bb-selector` (тот уже импортирует `bb-volume` — был бы цикл).
 *
 * Проход 17 (2026-11): режим объёма — ТРИ состояния, а не булев флаг.
 * `MGF`/`IGF-1` — реальные препараты из карточки PED, но их дозо-кривая ×1.13–1.24,
 * а сборка плана считала их «курсом» (бюджет 224, капы 52/15) только потому, что
 * список непуст. Теперь пептиды — отдельный тир: своя кривая MRV, но капы по уровню.
 */

import { normLevel } from '../volume-landmarks.engine';

/** Мини-вход: списки и дозы PED. Форма совместима с `BBSelectorInput`. */
export interface PedProfileInput {
  peds?: string[];
  pedDoses?: Record<string, number>;
}

/**
 * Режим объёма. `course` — AAS/GH/инсулин, `peptides` — только MGF/IGF-1,
 * `natural` — всё остальное (креатин, витамины, пустой список).
 */
export type VolumeRegime = 'natural' | 'peptides' | 'course';

/** Классы препаратов по имени/ключу дозы. Любая положительная доза = препарат активен. */
export interface PedClassProfile {
  hasAAS: boolean;
  hasGH: boolean;
  hasIns: boolean;
  hasMGF: boolean;
  hasIGF1: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Профиль фармподдержки: AAS / GH / инсулин.
 *
 * AAS — имя содержит `aas`/`тест` ИЛИ доза `AAS` ≥ 500 мг; GH и инсулин — по имени
 * (`GH`/`insulin`) или по ненулевой дозе. Порог 500 мг — именно «высокий объём»
 * (правило сплита), НЕ «на курсе»: TRT 125 мг тоже курс (см. `volumeRegimeOf`).
 */
export function pedProfileOf(
  input: PedProfileInput,
): { hasAAS: boolean; hasGH: boolean; hasIns: boolean } {
  const peds = input.peds || [];
  const doses = (input.pedDoses || {}) as Record<string, number>;
  const hasAAS = peds.some((x) => {
    const s = String(x).toLowerCase();
    return s.includes('aas') || s.includes('тест');
  }) || num(doses['AAS']) >= 500;
  const hasGH = peds.some((x) => String(x) === 'GH') || num(doses['GH']) > 0;
  const hasIns = peds.some((x) => String(x) === 'insulin') || num(doses['insulin']) > 0;
  return { hasAAS, hasGH, hasIns };
}

/**
 * Классы препаратов для режима объёма: ЛЮБАЯ положительная доза считается
 * действующей (TRT 125 мг — это курс, а не натурал). Имена AAS-веществ
 * (`test_enan`, `tren`, `deca`…) узнаются так же, как в `bb-builder` для
 * PED-гейтов, иначе цикловой путь с дозами без агрегированного `AAS` молча
 * становился натуральным.
 */
export function pedClassesOf(input: PedProfileInput): PedClassProfile {
  const peds = input.peds || [];
  const doses = (input.pedDoses || {}) as Record<string, number>;
  const nameHas = (re: RegExp) => peds.some((x) => re.test(String(x).toLowerCase()));
  const doseKeys = Object.entries(doses).filter(([, v]) => num(v) > 0).map(([k]) => k.toLowerCase());
  const doseHas = (re: RegExp) => doseKeys.some((k) => re.test(k));
  const aasRe = /aas|тест|test|tren|deca|nandro|npp|bold|prim|drost|mast|stan|oxan|anavar|methan|anadrol|oxymeth|sust|equip|tbol|turinabol|dbol|dianabol|winstrol|primo|dhb|trest|ment|sdrol|superdrol|halo|provir|sarm|ostarine|lgd|rad140|yk11/;
  const ghRe = /^(?:gh|hgh|somatropin|гр)$/i;
  const insRe = /^(?:insulin|инсулин|humalog|novorapid|lantus|apida)$/i;
  return {
    hasAAS: nameHas(aasRe) || doseHas(aasRe) || num(doses['AAS']) > 0,
    hasGH: peds.some((x) => ghRe.test(String(x).trim())) || doseKeys.some((k) => ghRe.test(k)) || num(doses['GH']) > 0,
    hasIns: peds.some((x) => insRe.test(String(x).trim())) || doseKeys.some((k) => insRe.test(k)) || num(doses['insulin']) > 0,
    hasMGF: peds.some((x) => /^(?:peg[-_]?)?mgf$/i.test(String(x).trim())) || num(doses['MGF']) > 0,
    hasIGF1: peds.some((x) => /^igf/i.test(String(x).trim())) || num(doses['IGF1'] ?? doses['IGF']) > 0,
  };
}

/**
 * Режим объёма (бюджет/MRV/капы): `course` | `peptides` | `natural`.
 *
 * Явный флаг сильнее профиля: пользователь с PED-профилем может быть ВНЕ курса
 * (фаза «off», пауза) — тогда план считается натуральным. Профиль включается
 * только когда флаг не задан.
 */
export function volumeRegimeOf(input: PedProfileInput & { onCourse?: boolean }): VolumeRegime {
  if (input.onCourse != null) return input.onCourse === true ? 'course' : 'natural';
  // Список препаратов — источник истины, если он задан: форма держит дозы «по
  // умолчанию» для НЕвыбранных препаратов (AAS 500 в состоянии UI), и такая
  // доза не должна делать атлета курсовым. Дозы решают, только когда списка нет
  // (цикловой путь с одними дозами).
  const peds = input.peds || [];
  const c = pedClassesOf(peds.length > 0 ? { peds } : { pedDoses: input.pedDoses });
  if (c.hasAAS || c.hasGH || c.hasIns) return 'course';
  if (c.hasMGF || c.hasIGF1) return 'peptides';
  return 'natural';
}

/** «Высокий объём» для решения о сплите: enhanced или реальный PED-профиль. */
export function highVolumeDemandOf(
  input: PedProfileInput & { level?: string },
): boolean {
  if (normLevel(String(input.level || '')) === 'enhanced') return true;
  const { hasAAS, hasGH, hasIns } = pedProfileOf(input);
  return hasAAS || hasGH || hasIns;
}

/**
 * «На курсе» для объёма (кап сессии, «про»-тир): ровно `volumeRegimeOf === 'course'`.
 * Креатин и пептиды (MGF/IGF-1) курсом не считаются — у них свой тир.
 */
export function onCourseOf(input: PedProfileInput & { onCourse?: boolean }): boolean {
  return volumeRegimeOf(input) === 'course';
}
