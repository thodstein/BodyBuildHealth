/**
 * lab-ai-merge.ts — слияние результатов OCR бланка с AI-проверкой фото.
 *
 * Почему OCR остаётся главным: OCR читает именно бланк и его цифры, а модель
 * может «додумать» показатель по подсказке. AI здесь — второй голос:
 *  - совпало в пределах допуска — поднимаем уверенность и добираем границы;
 *  - разошлось — число OCR не переписываем, показываем предупреждение;
 *  - AI увидел показатель, которого OCR не нашёл, — добавляем его только
 *    низкой уверенностью (≤ 0.6) и без автовыбора: сохранить его пользователь
 *    должен осознанно, сверив с бланком.
 *
 * Модуль чистый: входные массивы не мутируются, сеть и состояние — не его дело.
 */
import { finalizeLabCandidates, type ParsedLabValue } from './ocr-engine';
import { mapToUcumCode, normalizeLabMeasurement, resolveLabMarker } from './labs-mapping';
import { ucumInfo } from './constants';
import type { FoodVisionLabValue } from '../engines/food-vision.types';

export interface LabAiMergeResult {
  labs: ParsedLabValue[];
  warnings: string[];
  added: number;
  enriched: number;
  conflicts: number;
}

/** Код AI-значения в каталоге: сначала код, затем имя, затем алиасы UCUM. */
function resolveAiCode(ai: FoodVisionLabValue): string | null {
  const candidates = [resolveLabMarker(ai.code || ''), resolveLabMarker(ai.name || '')];
  for (const candidate of candidates) {
    const code = mapToUcumCode(candidate);
    if (code && ucumInfo(code)) return code;
  }
  return null;
}

/** Границы принимаем только парой конечных чисел с low < high. */
function finiteRange(low?: number, high?: number): [number, number] | null {
  if (typeof low !== 'number' || typeof high !== 'number') return null;
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) return null;
  return [low, high];
}

/**
 * Границы бланка пересчитываются тем же правилом, что и значение, — иначе
 * 1.2 мг/дл и «норма 0.7–1.3» после нормализации значения в мкмоль/л
 * оказались бы в разных единицах. Не пересчиталось — границы не подставляем.
 */
function normalizeRange(
  code: string,
  low: number,
  high: number,
  unit: string,
): { refLow: number; refHigh: number } | null {
  const lo = normalizeLabMeasurement(code, low, unit);
  const hi = normalizeLabMeasurement(code, high, unit);
  if (!Number.isFinite(lo.value) || !Number.isFinite(hi.value) || lo.value >= hi.value) return null;
  return { refLow: lo.value, refHigh: hi.value };
}

/** Есть ли цифры значения в OCR-тексте: «5,4» и «5.4» — одно число. */
function digitsPresent(rawText: string, value: number): boolean {
  if (!rawText || !Number.isFinite(value)) return true;
  const text = rawText.replace(/(\d),(\d)/g, '$1.$2');
  const forms = new Set([String(value), value.toFixed(1), value.toFixed(2), String(Math.round(value))]);
  for (const form of forms) {
    if (!form) continue;
    const pattern = new RegExp(`(^|[^0-9.])${form.replace('.', '\\.')}([^0-9]|$)`);
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * OCR-значения + AI-кандидаты → объединённый список для предпросмотра импорта.
 *
 * `rawText` используется только для предупреждения «цифр нет в OCR-тексте»:
 * отсутствие цифр не повод выбрасывать AI-кандидата — он и так идёт с низкой
 * уверенностью и без автовыбора.
 */
export function mergeLabAiCandidates(
  ocrLabs: ParsedLabValue[],
  aiValues: FoodVisionLabValue[],
  rawText: string,
): LabAiMergeResult {
  // Копия, а не ссылки: вызывающий экран продолжает владеть своим состоянием.
  const labs: ParsedLabValue[] = (ocrLabs || []).map((lab) => ({ ...lab }));
  const warnings: string[] = [];
  let added = 0;
  let enriched = 0;
  let conflicts = 0;

  // Индекс только по OCR-значениям: AI-добавки не выдаём за «OCR подтвердил».
  const ocrIndexByCode = new Map<string, number>();
  labs.forEach((lab, index) => {
    const code = mapToUcumCode(lab.code);
    if (code && !ocrIndexByCode.has(code)) ocrIndexByCode.set(code, index);
  });
  // Модель иногда повторяет строку (две колонки, склейка таблицы). Второй
  // дубль не должен превращаться в отдельную «AI-добавку» с другим числом.
  const seenAiCodes = new Set<string>();

  for (const ai of aiValues || []) {
    const label = (ai?.name || ai?.code || 'показатель').trim();
    const code = ai ? resolveAiCode(ai) : null;
    if (!code) {
      warnings.push(`AI увидел «${label}» вне каталога — пропущено.`);
      continue;
    }
    if (seenAiCodes.has(code)) {
      warnings.push(`AI вернул «${label}» повторно — второй дубль пропущен.`);
      continue;
    }
    seenAiCodes.add(code);
    const normalized = normalizeLabMeasurement(code, Number(ai.value), ai.unit || '');
    if (!Number.isFinite(normalized.value)) {
      warnings.push(`AI: «${label}» без числового значения — пропущено.`);
      continue;
    }
    const aiConfidence = Number.isFinite(ai.confidence) ? Math.max(0, Math.min(1, ai.confidence)) : 0;
    const range = finiteRange(ai.refLow, ai.refHigh);
    // Границы принимаем только если оба числа реально напечатаны в OCR-тексте
    // бланка: иначе это норма «по памяти», и она не должна становиться
    // референсом бланка при сохранении.
    const rangePrintedOnBlank =
      range !== null &&
      rawText.trim().length > 0 &&
      digitsPresent(rawText, range[0]) &&
      digitsPresent(rawText, range[1]);
    const normalizedRange = rangePrintedOnBlank ? normalizeRange(code, range[0], range[1], ai.unit || '') : null;

    const ocrIndex = ocrIndexByCode.get(code);
    if (ocrIndex !== undefined) {
      const current = labs[ocrIndex];
      const unitsMatch =
        String(normalized.unit || '')
          .trim()
          .toLowerCase() ===
        String(current.unit || '')
          .trim()
          .toLowerCase();
      if (!unitsMatch) {
        conflicts += 1;
        warnings.push(
          `AI: ${label} = ${normalized.value} ${normalized.unit}, OCR: ${current.value} ${current.unit} — единицы не совпали, оставлено OCR.`,
        );
        continue;
      }
      const tolerance = Math.max(0.01, Math.abs(current.value) * 0.005);
      if (Math.abs(current.value - normalized.value) <= tolerance) {
        // Значение подтверждено двумя источниками — уверенность выше,
        // недостающие границы можно добрать из AI. Но AI-добавка прошлого
        // прогона остаётся кандидатом с потолком 0.6: иначе повторная проверка
        // сама себе поднимала бы уверенность.
        const isAiOnly = current.raw === 'AI-проверка';
        const currentConfidence = typeof current.confidence === 'number' ? current.confidence : 0;
        if (aiConfidence > currentConfidence)
          current.confidence = isAiOnly ? Math.min(aiConfidence, 0.6) : aiConfidence;
        if (normalizedRange && !isAiOnly) {
          if (current.refLow === undefined) current.refLow = normalizedRange.refLow;
          if (current.refHigh === undefined) current.refHigh = normalizedRange.refHigh;
        }
        if (!isAiOnly) enriched += 1;
      } else {
        conflicts += 1;
        warnings.push(
          `AI: ${label} = ${normalized.value} ${normalized.unit}, OCR: ${current.value} ${current.unit} — оставлено OCR.`,
        );
      }
      continue;
    }

    if (aiConfidence < 0.5) {
      warnings.push(`AI: «${label}» прочитан с низкой уверенностью (${Math.round(aiConfidence * 100)}%) — пропущено.`);
      continue;
    }

    const info = ucumInfo(code);
    const low = normalizedRange?.refLow ?? info?.lln;
    const high = normalizedRange?.refHigh ?? info?.uln;
    const isAbnormal =
      low !== undefined && high !== undefined ? normalized.value < low || normalized.value > high : undefined;
    const candidate: ParsedLabValue = {
      code,
      name: label || info?.name || code,
      value: normalized.value,
      unit: normalized.unit,
      ...(normalizedRange || {}),
      ...(isAbnormal !== undefined ? { isAbnormal } : {}),
      raw: 'AI-проверка',
      confidence: Math.min(aiConfidence, 0.6),
    };
    labs.push(candidate);
    added += 1;
    warnings.push(
      `AI добавил ${candidate.name} = ${candidate.value} ${candidate.unit} — проверьте по бланку перед сохранением.`,
    );
    if (!digitsPresent(rawText, ai.value) && !digitsPresent(rawText, normalized.value)) {
      warnings.push(`AI: цифр «${ai.value}» для ${candidate.name} нет в OCR-тексте — проверьте по бланку.`);
    }
  }

  return { labs: finalizeLabCandidates(labs), warnings, added, enriched, conflicts };
}
