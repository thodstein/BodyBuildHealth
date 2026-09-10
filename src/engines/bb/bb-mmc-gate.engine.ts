/**
 * bb-mmc-gate.engine.ts — PRO-3 R4: гейт «связи мозг–мышца» по нагрузке + позинг.
 *
 * Наука (Calatayud; Schoenfeld 2018; Nuckols/SBS): внутренний фокус повышает ЭМГ
 * на +14–24% только при 30–65% 1RM и в изоляциях; выше ~65% (порог 60–80%) и на
 * взрывных — работает внешний фокус, внутренний мешает координации.
 * Позинг/iso-hold между сетами: Schoenfeld 2020 — плюс к mid-thigh, минус к силе
 * ног (трейдофф честно в тексте). Чистый движок, без диагнозов.
 */

/** Порог, выше которого внутренний фокус не даёт прибавки (Calatayud: порог 60–80%). */
export const MMC_LOAD_THRESHOLD = 0.65;

export interface BbMmcAdvice {
  focus: 'internal' | 'external';
  cue: string;
  text: string;
}

export function mmcAdviceFor(input: {
  isolation?: boolean;
  loadPct1RM?: number | null;
  explosive?: boolean;
}): BbMmcAdvice {
  const { isolation = false, loadPct1RM = null, explosive = false } = input || {};
  if (explosive) {
    return {
      focus: 'external',
      cue: 'Взрыв: «толкай пол/штангу от себя»',
      text: 'Взрывная работа — только внешний фокус, внутренний сбивает скорость',
    };
  }
  if (loadPct1RM != null && Number.isFinite(loadPct1RM) && loadPct1RM >= MMC_LOAD_THRESHOLD) {
    return {
      focus: 'external',
      cue: 'Тяжело: «дави/тяни вес по траектории»',
      text: `Нагрузка ≥${Math.round(MMC_LOAD_THRESHOLD * 100)}% 1RM — моторных единиц уже хватает, внутренний фокус не добавит (внешний держит технику)`,
    };
  }
  if (isolation) {
    return {
      focus: 'internal',
      cue: '«Почувствуй squeeze целевой мышцы»',
      text: 'Изоляция на умеренном весе — внутренний фокус даёт +14–24% включения (держи паузу в пике)',
    };
  }
  return {
    focus: 'external',
    cue: 'База: «веди вес по траектории»',
    text: 'Многосуставное на умеренном весе — внешний фокус держит координацию; дожимай изоляцией с внутренним',
  };
}

/** Памятка про позинг между сетами (опция, не дефолт — есть цена в силе). */
export function posingIsoNote(): string {
  return 'Позинг 30 с в отдыхе квадрицепса — опция для mid-thigh (Schoenfeld 2020); цена: может просадить силу ног — не для силового блока';
}
