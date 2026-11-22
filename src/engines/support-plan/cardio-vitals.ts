/**
 * support-plan/cardio-vitals.ts — АД и ЧСС из карточки «Сердечно-сосудистая».
 *
 * Проход 204: специализированные домены кардио решали по лабораторным ключам
 * `BP_SYSTOLIC`, `BP_DIASTOLIC` и `HR`, которых бланк не производит — АД и ЧСС не
 * анализы, а поля карточки (`state.cardio`). Из-за этого домены «АД/объём» и
 * «Ритм/ЧСС» не включались ни при каком вводе, а их «контрольные маркеры» в
 * попапе всегда показывали «нет». Здесь — одно место перевода карточки в слова
 * доменов и в систолу, которой ждёт мост механизмов (`MapperCtx.bpSystolic`).
 *
 * Стадия АД в приложении хранится строкой (`normal | prehypertension |
 * hypertension1 | hypertension2`). Своего числа у неё нет, поэтому систола —
 * не измерение, а граница полосы из `LAB_TIERS.BP_SYSTOLIC`: её нельзя печатать
 * как результат бланка, и домен включается по самой стадии, а не по числу.
 */

import { LAB_TIERS } from '../../data/lab-tier-ranges';

export type BpStage = 'normal' | 'prehypertension' | 'hypertension1' | 'hypertension2';

const BP_STAGES: BpStage[] = ['normal', 'prehypertension', 'hypertension1', 'hypertension2'];

/**
 * Стадия в каноне. `'elevated'` — написание из старых профилей и из прежнего
 * комментария `mapper-ctx`; интерфейс («Здоровье» → АД) пишет `'prehypertension'`.
 * Незнакомое значение читается как норма — так же, как раньше вёл себя
 * `bpSystolic` по умолчанию.
 */
export function bpStageCanon(stage?: string): BpStage {
  const s = String(stage || '').trim().toLowerCase();
  if (s === 'elevated') return 'prehypertension';
  return (BP_STAGES as string[]).includes(s) ? (s as BpStage) : 'normal';
}

/** Подпись стадии — то, чем карточка отвечает на вопрос «какое АД». */
export const BP_STAGE_LABEL: Record<BpStage, string> = {
  normal: 'норма',
  prehypertension: 'прегипертония',
  hypertension1: 'гипертония I',
  hypertension2: 'гипертония II',
};

/**
 * Систола полосы стадии — из границ лестницы ступеней, а не литералами.
 *
 * Проход 204: прежний `bpSystolic` в `mapper-ctx` искал `'elevated'`, которого
 * интерфейс не пишет, поэтому прегипертония (`prehypertension`, 130–139) уезжала
 * в `return 120` — то есть в норму. Правило диуретиков (`bpSystolic < 120`) при
 * этом видело «120» у человека с давлением 135.
 *
 * 120 — не порог, а середина полосы «норма»: ниже неё смотрит только правило
 * диуретиков, и оно не должно срабатывать на норме.
 */
export function bpSystolicOfStage(stage?: string): number {
  const t = LAB_TIERS.BP_SYSTOLIC;
  switch (bpStageCanon(stage)) {
    case 'prehypertension': return t.normal[1];          // 130 — верх нормы
    case 'hypertension1': return t.borderline[1];        // 140 — начало «лечения»
    case 'hypertension2': return t.emergencyHigh ?? t.treatment[1]; // 160 — экстренная
    default: return 120;
  }
}

/** АД выше нормы — то, на чём включается домен «АД/объём». */
export function bpStageIsHigh(stage?: string): boolean {
  return bpStageCanon(stage) !== 'normal';
}

/**
 * ЧСС из карточки. Нет числа — нет находки: 0 здесь значит «нечего читать», а не
 * «пульс ноль» (`heartRateOf(undefined)` → `undefined`, а не 0).
 */
export function heartRateOf(cardio?: { heartRate?: number }): number | undefined {
  const hr = Number(cardio?.heartRate);
  return Number.isFinite(hr) && hr > 0 ? hr : undefined;
}

/** Пустая карточка ССС — «нет ответа» = норма и 70, как было до прохода 204. */
export const CARDIO_EMPTY = {
  bpStage: 'normal', heartRate: 70, ldlElevation: 'none', hctElevation: 'none',
  hdlLow: false, triglycerides: 'normal', previousCVD: false, familyCVD: false,
} as const;

export type CardioFlagStep = 'none' | 'mild' | 'moderate' | 'severe';

/**
 * Слова оценок карточки «Здоровье» → ступени калькулятора. Селект ЛПНП отвечает
 * `low | normal | high | very_high`, а бланк и лестница — `none…severe`: это один
 * и тот же вопрос двумя словарями. Перевод идёт **по рангу ответа** («высокий» —
 * средняя ступень, «очень высокий» — тяжёлая), а не по выдуманному порогу мг/дл:
 * числа у карточки нет, и подставлять его нельзя.
 */
const CARDIO_FLAG_STEP: Record<string, CardioFlagStep> = {
  none: 'none', low: 'none', normal: 'none',
  mild: 'mild',
  moderate: 'moderate', high: 'moderate',
  severe: 'severe', very_high: 'severe',
};

const flagStep = (v: unknown): CardioFlagStep | undefined =>
  typeof v === 'string' ? CARDIO_FLAG_STEP[v.trim().toLowerCase()] : undefined;

export type CardioCardWords = Partial<{
  bpStage: BpStage;
  heartRate: number;
  ldlElevation: CardioFlagStep;
  hctElevation: CardioFlagStep;
  triglycerides: 'normal' | 'elevated' | 'high';
  hdlLow: boolean;
  previousCVD: boolean;
  familyCVD: boolean;
}>;

/**
 * Карточка «Здоровье» → состояние калькулятора.
 *
 * Проход 204: `hydrateState` читал из профиля нейро, ОДА, фарму и противопоказания,
 * а кардио — нет. Калькулятор своей карточки АД/ЧСС не имеет, поэтому `state.cardio`
 * оставался дефолтом, и ответ «прегипертония» или «пульс 90» в профиле не влиял ни
 * на риск, ни на домены. Это противоположная половина того же дефекта, что мёртвые
 * ключи `BP_SYSTOLIC`/`HR`.
 *
 * Нет ответа — нет ключа: `undefined`, `''` и незнакомое слово не превращаются в
 * «норму», иначе карточка перекрывала бы бланк молчанием. Числа из анализов
 * главнее: `hydrateState` применяет карточку до разбора бланка.
 */
export function cardioStateFromCard(health?: Record<string, unknown> | null): CardioCardWords {
  const out: CardioCardWords = {};
  if (!health) return out;

  const stage = String(health.bpStage ?? '').trim().toLowerCase();
  if (stage === 'elevated' || (BP_STAGES as string[]).includes(stage)) out.bpStage = bpStageCanon(stage);

  const hr = Number(health.heartRate);
  if (Number.isFinite(hr) && hr > 0) out.heartRate = hr;

  const ldl = flagStep(health.ldlElevation);
  if (ldl) out.ldlElevation = ldl;
  const hct = flagStep(health.hctElevation);
  if (hct) out.hctElevation = hct;

  const tg = String(health.triglycerides ?? '').trim().toLowerCase();
  if (tg === 'normal' || tg === 'elevated' || tg === 'high') out.triglycerides = tg;

  if (typeof health.hdlLow === 'boolean') out.hdlLow = health.hdlLow;
  if (typeof health.previousCVD === 'boolean') out.previousCVD = health.previousCVD;
  if (typeof health.familyCVD === 'boolean') out.familyCVD = health.familyCVD;
  return out;
}
