/**
 * bb-methodology-spec.ts — «методика = протокол», а не только порядок (итерация A, M-1).
 *
 * До этого файла выбор методики (`pre_exhaust`, `fst7`, `mountain_dog`, …) менял
 * ТОЛЬКО порядок упражнений (и −10 % веса базы для предутомления). Названия при
 * этом обещали протокол: «FST-7 — 7-сетовый финишер», «гиперемия — короткие паузы».
 *
 * Здесь один источник правды: что методика реально меняет (порядок, отдых, схема
 * объёма, финишер), одну фразу объяснения в план и честную оговорку о доказательности.
 * Потребители:
 *  - `bb-builder.engine.ts` — отдых (`restDeltaSec`) и схема объёма (`impliedVolumeScheme`);
 *  - `bb-step-params.tsx` — подписи селектора (`methodologyOptions`);
 *  - `bb-step-plan.tsx` / `explainSessionOrder` — строка «что меняет методика».
 *
 * Принцип проекта: не продавать магию. Литература (2022–2025) не показывает
 * превосходства продвинутых техник при равном объёме — методики остаются
 * инструментом приоритизации, плотности и комфорта, и так и подписаны.
 */
import type { SessionMethodology } from './bb-session-order.engine';

export interface MethodologyFinisher {
  sets: number;
  reps: number;
  rir: number;
  restSec: number;
  /** Тег техники для плана/печати (совпадает с `REP_SCHEMES.fst7.techniques`). */
  technique: string;
}

export interface MethodologySpec {
  id: SessionMethodology;
  /** Короткое название для селектора и печати. */
  labelRu: string;
  /** Что методика делает с порядком — одна строка для карточки сессии. */
  orderNote: string;
  /** Модификатор отдыха в секундах (применяется только к аксессуарам). */
  restDeltaSec: number;
  /** Нижний предел отдыха после модификатора (не режем паузу «в пол»). */
  restFloorSec: number;
  /**
   * Схема объёма, которую методика включает, если пользователь не выбрал свою.
   * Явный выбор схемы (gvt/gironda/fst7) всегда приоритетнее.
   */
  impliedVolumeScheme?: 'fst7';
  /** Финишер, который методика гарантирует (сейчас — FST-7). */
  finisher?: MethodologyFinisher;
  /** Честная оговорка о доказательности — в UI рядом с выбором. */
  honestNote: string;
  /** Источник/обоснование для отчёта. */
  evidence: string;
}

export const METHODOLOGY_SPECS: Record<SessionMethodology, MethodologySpec> = {
  compound_first: {
    id: 'compound_first',
    labelRu: 'Базовые → изоляция',
    orderNote: 'сначала тяжёлые многосуставные на свежие мышцы, затем изоляция и финишёры.',
    restDeltaSec: 0,
    restFloorSec: 45,
    honestNote: 'Порядок почти не влияет на гипертрофию (мета-анализ Nunes 2020, umbrella 2022/2023), но первое упражнение растёт в силе быстрее — поэтому тяжёлая база идёт первой.',
    evidence: 'Nunes 2020 (PubMed 32077380); 2024 MSSE network meta-analysis (exercise order).',
  },
  pre_exhaust: {
    id: 'pre_exhaust',
    labelRu: 'Pre-exhaust: изоляция первой',
    orderNote: 'изоляция целевой мышцы идёт ПЕРЕД базой, вес базы автоматически −10 %.',
    restDeltaSec: 0,
    restFloorSec: 45,
    honestNote: 'Предутомление не усиливает стимул: 12-недельное сравнение не дало преимуществ (Gentil 2014), ЭМГ показывает перераспределение работы на синергист. Это инструмент ощущения мышцы и техники, а не «больше роста».',
    evidence: 'Gentil 2014 (PubMed 25092528); Augustsson 2003 (снижение веса базы).',
  },
  post_exhaust: {
    id: 'post_exhaust',
    labelRu: 'Post-exhaust: база → изоляция',
    orderNote: 'изоляция той же мышцы ставится сразу после базы (добивка при том же бюджете времени).',
    restDeltaSec: 0,
    restFloorSec: 45,
    honestNote: 'Добивка после базы — способ добрать объём за то же время; при равном числе сетов стимул сопоставим с обычным порядком (обзор стратегий 2025).',
    evidence: 'Sødal 2023 (drop-set ≈ traditional); advanced strategies 2025 (doi 10.1519/ssc.0000000000000929).',
  },
  mountain_dog: {
    id: 'mountain_dog',
    labelRu: 'Mountain Dog: активация → база → памп → стретч',
    orderNote: 'лёгкая активация (RIR ≥ 3, не в отказ) → тяжёлая база → памп → loaded stretch последним.',
    restDeltaSec: 0,
    restFloorSec: 45,
    honestNote: 'Фазовая структура дня (Meadows) — про качество стимула и суставы; отдельного преимущества в гипертрофии при равном объёме не показано.',
    evidence: 'John Meadows (Mountain Dog) — практический протокол; umbrella 2022/2023 по порядку.',
  },
  fst7: {
    id: 'fst7',
    labelRu: 'FST-7: праймер → 7-сетовый финишер',
    orderNote: 'памп-праймер (RIR ≥ 3) первым, тяжёлая работа в середине, 7-сетовый финишер и стретч в конце.',
    restDeltaSec: 0,
    restFloorSec: 45,
    // Методика включает FST-7 как СХЕМУ объёма, а не только порядок:
    // без этого 7-сетовый финишер требовал отдельного выбора схемы (M-1).
    impliedVolumeScheme: 'fst7',
    finisher: { sets: 7, reps: 12, rir: 2, restSec: 40, technique: 'fst7' },
    honestNote: 'FST-7 — способ добрать объём одной мышцей за короткое время и получить памп; при равном объёме не превосходит обычный тренинг (Sødal 2023, обзор 2025). Гейт: только enhanced без joint-guard. 7 сетов ставятся, только если влезают в MRV недели — иначе финишер укорачивается, и это прямо написано в плане.',
    evidence: 'Hany Rambod (FST-7); Sødal 2023; advanced strategies 2025.',
  },
  hyperemia: {
    id: 'hyperemia',
    labelRu: 'Hyperemia: памп раньше тяжестей',
    orderNote: 'у аксессуаров памп-изоляция идёт раньше тяжёлой, паузы короче на 15 с (не ниже 45 с).',
    restDeltaSec: -15,
    restFloorSec: 45,
    honestNote: 'Кровенаполнение (Sarcev) — про ощущение и плотность тренировки. Это осознанный компромисс: паузы >60 с в мета-анализе 2024 дают чуть больше гипертрофии, поэтому ниже 45 с не опускаем и не обещаем «больше роста» от плотности. Гормональный отклик не является медиатором роста (обзор 2025).',
    evidence: 'Milos Sarcev (hyperemia); «Give it a rest» 2024 (PubMed 39205815).',
  },
};

const METHODOLOGY_SET: ReadonlySet<string> = new Set(Object.keys(METHODOLOGY_SPECS));

/** Безопасный резолвер: неизвестная строка → протокол по умолчанию (compound_first). */
export function methodologySpecFor(m?: string | null): MethodologySpec {
  const key = String(m || '') as SessionMethodology;
  return METHODOLOGY_SET.has(key) ? METHODOLOGY_SPECS[key] : METHODOLOGY_SPECS.compound_first;
}

export function methodologyLabelRu(m?: string | null): string {
  return methodologySpecFor(m).labelRu;
}

/**
 * Единственная точка, где методика трогает отдых.
 *
 * Правила: модификатор применяется только к аксессуарам (база требует полного
 * отдыха для силы) и никогда не опускает паузу ниже `restFloorSec`. Пол — это
 * осознанный компромисс: мета-анализ 2024 показывает, что >60 с даёт чуть больше
 * гипертрофии, поэтому плотность предлагается только в пределах 45+ с.
 */
export function applyMethodologyRest(
  baseSec: number,
  role: 'primary' | 'accessory',
  m?: string | null,
): number {
  const spec = methodologySpecFor(m);
  const base = Number.isFinite(baseSec) ? baseSec : 0;
  if (spec.restDeltaSec === 0 || role !== 'accessory') return base;
  return Math.max(spec.restFloorSec, base + spec.restDeltaSec);
}

/** Варианты для селектора UI — из спека, чтобы подписи не расходились с поведением. */
export function methodologyOptions(): Array<{ id: SessionMethodology; label: string; desc: string }> {
  return (Object.keys(METHODOLOGY_SPECS) as SessionMethodology[]).map(id => {
    const spec = METHODOLOGY_SPECS[id];
    return { id, label: spec.labelRu, desc: `${spec.orderNote} ${spec.honestNote}` };
  });
}
