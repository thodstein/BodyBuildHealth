/**
 * lab-marker-risks.ts — отклонения маркеров для экрана рисков.
 *
 * Проход 147: раньше процент отклонения считался прямо по числу из бланка, а
 * маркеры без нормы и с недоказанной стороной просто исчезали из списка — и
 * экран писал «Все маркеры в норме», хотя «>5» при верхней границе 300 ничего
 * не доказывает. Правило стороны одно на приложение — `boundProvesSide`
 * (core/lab-bound); здесь оно применено к списку отклонений:
 *  - сторона доказана точным числом — процент считается как раньше;
 *  - сторона доказана границей («>1000» при верхней 400) — отклонение есть, но
 *    процента нет: число обрезано, процент был бы процентом от неизвестного;
 *  - сторона не доказана (граница внутрь нормы, нет нормы) — это «без вывода»,
 *    отдельный счётчик, а не «норма».
 */
import { ucumInfo } from '../../../core/constants';
import { normalizeLabMeasurement } from '../../../core/labs-mapping';
import { boundProvesSide, type LabBound } from '../../../core/lab-bound';
import { getLabNorm } from '../../../engines/lab-norms.engine';
import { LABS_SYSTEM_GROUPS } from './LabsUI';

export interface MarkerDeviation {
  code: string;
  name: string;
  value: number;
  bound?: LabBound;
  uln: number;
  lln: number;
  /** Процент к норме; `null` — число обрезано, процент не считается. */
  deviation: number | null;
  side: 'high' | 'low';
  system: string;
}

/** Запись без вердикта: почему сторона не доказана (проход 154). */
export interface MarkerUnknown {
  code: string;
  value: number;
  bound?: LabBound;
  /** `bound` — граница не доказывает сторону; `no_norm` — нормы маркера нет. */
  reason: 'bound' | 'no_norm';
}

export interface MarkerRiskSummary {
  markerDeviations: MarkerDeviation[];
  /** Сколько маркеров доказанно в норме. */
  normalCount: number;
  /** Сколько маркеров без вывода: обрезано или норма неизвестна. */
  unknownCount: number;
  /**
   * Проход 154: сами записи без вывода (не только счётчик) — чтобы тексты,
   * копия и CSV могли назвать код и причину, а не печатать «—» без объяснения.
   */
  unknown: MarkerUnknown[];
  /** Коды маркеров, доказанно попавших в норму (для табличных выгрузок). */
  normalCodes: string[];
}

interface MarkerInput {
  code: string;
  value: number;
  unit?: string;
  bound?: LabBound;
  refLow?: number;
  refHigh?: number;
}

/**
 * Отклонения маркеров — по норме бланка, иначе по норме приложения (женские
 * границы при `sex = 'female'`).
 */
export function computeMarkerDeviations(
  labs: MarkerInput[],
  sex: 'male' | 'female',
): MarkerRiskSummary {
  const markerDeviations: MarkerDeviation[] = [];
  const unknown: MarkerUnknown[] = [];
  const normalCodes: string[] = [];
  let normalCount = 0;
  let unknownCount = 0;

  for (const lab of labs) {
    // Проход 174: запись каталога ищется одним правилом (`ucumInfo`) — прежний
    // четырёхступенчатый перебор регистров здесь был копией правила и молчал
    // на любом новом ключе со смешанным регистром.
    const ref = ucumInfo(lab.code);
    // Проход 147: маркер без нормы не «в норме» — норма неизвестна.
    if (!ref) { unknownCount += 1; unknown.push({ code: lab.code, value: lab.value, bound: lab.bound, reason: 'no_norm' }); continue; }
    const coeff = ref.coeff || 1;
    // Проход 93: если единица бланка известна, число и диапазон бланка приводятся
    // к единице приложения одним множителем (`normalizeLabMeasurement`): HGB
    // 150 г/л больше не становится 1500 и не даёт 782% отклонения. Единицы нет —
    // прежний `coeff`.
    const hasUnit = !!String(lab.unit || '').trim();
    const normalized = hasUnit ? normalizeLabMeasurement(lab.code, lab.value, String(lab.unit)) : null;
    const factor = normalized && lab.value ? normalized.value / lab.value : coeff;
    const norm = lab.value * factor;
    // Prefer stored reference ranges from parsed lab forms;
    // fall back to UCUM_MAP defaults (Л8: женские границы при sex=female) when not available.
    const fallbackNorm = getLabNorm(lab.code, sex);
    const uln = lab.refHigh !== undefined ? lab.refHigh * factor : (fallbackNorm?.uln ?? ref.uln);
    const lln = lab.refLow !== undefined ? lab.refLow * factor : (fallbackNorm?.lln ?? ref.lln);
    // Проход 147: сторону отклонения доказывает то же правило, что у дневника и
    // трендов. «>5» при верхней границе 300 стороны не доказывает, поэтому оно
    // уходит в «без вывода», а не в «норму».
    const side = boundProvesSide(lab.bound, norm, lln, uln);
    if (!side) {
      if (lab.bound) { unknownCount += 1; unknown.push({ code: lab.code, value: lab.value, bound: lab.bound, reason: 'bound' }); }
      else if (uln === undefined || lln === undefined) { unknownCount += 1; unknown.push({ code: lab.code, value: lab.value, reason: 'no_norm' }); }
      else { normalCount += 1; normalCodes.push(lab.code); }
      continue;
    }
    // Процент считается только у точного числа: у обрезанного он был бы
    // процентом от неизвестного значения.
    let deviation: number | null = null;
    if (!lab.bound) {
      deviation = side === 'high' ? (norm - uln) / uln : -((lln - norm) / lln);
      if (Math.abs(deviation) <= 0.01) { normalCount += 1; normalCodes.push(lab.code); continue; }
    }
    let sys = 'other';
    for (const [s, codes] of Object.entries(LABS_SYSTEM_GROUPS)) {
      if (codes.includes(lab.code.toUpperCase())) { sys = s; break; }
    }
    markerDeviations.push({
      code: lab.code, name: ref.name || lab.code, value: lab.value, bound: lab.bound,
      uln, lln,
      deviation: deviation == null ? null : Math.round(deviation * 100),
      side,
      system: sys,
    });
  }

  // Точные отклонения — по силе, обрезанные (без процента) — после них.
  markerDeviations.sort((a, b) => {
    if (a.deviation == null && b.deviation == null) return 0;
    if (a.deviation == null) return 1;
    if (b.deviation == null) return -1;
    return Math.abs(b.deviation) - Math.abs(a.deviation);
  });

  return { markerDeviations, normalCount, unknownCount, unknown, normalCodes };
}
