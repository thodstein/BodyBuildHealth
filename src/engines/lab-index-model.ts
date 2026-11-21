/**
 * lab-index-model.ts — проход 194: индексы «воспаление», «стресс печени» и
 * «стресс почек» считает главная механизм-модель, а не свои веса.
 *
 * Было: каждая поверхность строила эти индексы своей формулой.
 * `labs-indices` брал взвешенное среднее долей нормы (СРБ 0.6 + ферритин 0.4;
 * АЛТ 0.3 + АСТ 0.25 + ГГТ 0.2 + билирубин 0.15 + ЩФ 0.1), `lab-analysis` —
 * сумму «СРБ + ферритин/100» и среднее трансаминаз в долях ВГН ×100. Один и тот
 * же АЛТ 30 при ВГН 40 читался в карточке «Риски» как «Проблемы» (доля 0.667),
 * в разборе — как «стресс печени 75», а риск-модель по нему же ставила ступень
 * m=0. Три ответа на один анализ, и ни один не был главным.
 *
 * Теперь числа даёт только модель: механизм берёт ступень `getMiLabStep`
 * (liv1 — цитолиз, liv2 — холестаз, cns2 — системное воспаление/окислительный
 * стресс, ren1 — почечная гемодинамика), а индекс печатает эту же ступень на
 * одной шкале: доля = m/3, процент = round(доля·100). m0 → 0 %, m1 → 33 %,
 * m2 → 67 %, m3 → 100 %. Тот же процент читают карточка «Риски», разбор
 * (`lab-analysis`), тренерские и поддержкины пороги: шкала одна.
 *
 * Ступень берётся «по бланку» (`getMiLabStep`), а не через `getMiFromLab`:
 * второй поднимает её до базовой ступени препарата (`M_I_BASE_DEFAULTS.liv1 = 2`,
 * `cns2 = 2`) и до минимума 1 у целевого механизма. Это риск курса, а не
 * показание анализа: нормальный АЛТ 30 на такой ступени дал бы «33 %» без
 * единой отклонённой цифры.
 *
 * Правила чтения — те же, что у модели и склада, а не свои:
 *  - имя анализа приводит `canonicalLabValues` (код склада), как на входе движка;
 *  - из серии берётся последняя запись (`date`), а не первая в массиве;
 *  - единица бланка главнее догадки (`readFlatLabs`/`readLabInUnit`): запись в
 *    чужой величине не идёт в расчёт и называется в `skipped`;
 *  - граница («<5», «>1000») идёт в расчёт только если доказывает сторону
 *    (`boundProvesSide` по границам `getLabNorm`); «СРБ <5» при верхней 5 ничего
 *    не доказывает и в индекс не попадает;
 *  - нет ни одного маркера механизма — `step: null` («нет данных»). Базовая
 *    ступень модели (`M_I_BASE_DEFAULTS.liv1 = 2`, `cns2 = 2`) — риск препарата,
 *    а не анализ: подставлять её в индекс значило бы печатать «67 %» без бланка.
 */
import type { LabPoint } from '../core/types';
import { boundProvesSide } from '../core/lab-bound';
import { labStorageCode } from '../core/lab-storage-code';
import { getLabNorm } from './lab-norms.engine';
import { readFlatLabs } from './lab-flat';
import { canonicalLabValues } from './lab-code-bridge';
import { getMiLabStep, MECH_LAB_MARKERS } from './risk-engine-tz-spec';

/** Запись, которая в индекс не пошла, с причиной — чтобы это не было молчанием. */
export interface LabMechanismSkip {
  /** Код склада (`labStorageCode`), чтобы запись называлась тем же именем, что и в модели. */
  code: string;
  value: number;
  unit: string;
  /** `unit` — величину не перевести в единицу расчёта; `bound` — граница сторону не доказала. */
  reason: 'unit' | 'bound';
}

export interface LabMechanismIndexRead {
  /** Ступень главной модели 0..3. `null` — ни один маркер механизма не измерен. */
  step: number | null;
  /** Доля 0..1 = `step/3` — шкала индексов «Анализы → Риски». */
  share: number | null;
  /** Процент 0..100 = `round(share·100)` — шкала разбора и тренерских порогов. */
  percent: number | null;
  /** Сколько маркеров механизмов реально измерено (точное число или доказанная граница). */
  measured: number;
  /** Сколько маркеров описано в модели для этих механизмов. */
  total: number;
  /** Коды склада, которые модель читает для этих механизмов. */
  markers: string[];
  /** Записи, которые не пошли в расчёт. */
  skipped: LabMechanismSkip[];
}

/** Доля индекса: ступень модели 0..3 → 0..1. Единственная шкала индексов. */
export function miIndexShare(step: number | null): number | null {
  if (step === null || !Number.isFinite(step)) return null;
  return Math.max(0, Math.min(3, step)) / 3;
}

/** Процент индекса: та же доля ×100, округлённая. */
export function miIndexPercent(step: number | null): number | null {
  const share = miIndexShare(step);
  return share === null ? null : Math.round(share * 100);
}

/** Маркеры механизмов без повторов и в порядке объявления модели. */
function markersOf(mechIds: string[]): string[] {
  const out: string[] = [];
  for (const id of mechIds) {
    for (const code of MECH_LAB_MARKERS[id] ?? []) if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Последняя запись по каждому анализу.
 *
 * `readFlatLabs` оставляет последнее встреченное число, поэтому порядок входа
 * решает, какая точка пойдёт в расчёт. Серия анализов судится по текущей, а не по
 * первой в массиве; нет даты — запись считается самой старой.
 */
function latestPerCode(entries: LabPoint[]): LabPoint[] {
  const byCode = new Map<string, LabPoint>();
  for (const point of entries) {
    const code = labStorageCode(point.code || point.name || '');
    if (!code) continue;
    const prev = byCode.get(code);
    if (!prev || String(point.date ?? '') >= String(prev.date ?? '')) byCode.set(code, point);
  }
  return Array.from(byCode.values());
}

/**
 * Индекс по механизмам главной модели.
 *
 * Возвращает ступень (максимум по механизмам, у которых есть измеренный маркер),
 * её долю/процент и честный счётчик «сколько маркеров учтено». Записи, которые
 * не пошли в расчёт, названы в `skipped` — «нет данных» не выдаётся ни за ноль,
 * ни за норму.
 */
export function labMechanismIndex(
  entries: LabPoint[],
  mechIds: string[],
  sex?: 'male' | 'female',
): LabMechanismIndexRead {
  const markers = markersOf(mechIds);
  const skipped: LabMechanismSkip[] = [];
  const usable: LabPoint[] = [];

  for (const point of latestPerCode(entries)) {
    // Имя — код склада (`labStorageCode`), как и у маркеров модели: граница
    // проверяется по норме канона, а не по норме написания. Иначе «БИЛИРУБИН >30»
    // под алиасом не нашёл бы границу и молча выпал бы в `skipped`.
    const code = labStorageCode(point.code || point.name || '');
    if (!code || typeof point.value !== 'number' || !Number.isFinite(point.value)) continue;
    if (point.bound) {
      const norm = getLabNorm(code, sex);
      const proven = norm
        ? boundProvesSide(point.bound, point.value, norm.lln, norm.uln)
        : undefined;
      if (!proven) {
        skipped.push({ code, value: point.value, unit: point.unit ?? '', reason: 'bound' });
        continue;
      }
    }
    usable.push(point);
  }

  const flat = readFlatLabs(usable);
  for (const unread of flat.unread) {
    skipped.push({ ...unread, code: labStorageCode(unread.code) || unread.code, reason: 'unit' });
  }
  const values = canonicalLabValues(flat.values);

  const measured = markers.filter((code) => Number.isFinite(values[code])).length;
  const steps = mechIds
    .filter((id) => (MECH_LAB_MARKERS[id] ?? []).some((code) => Number.isFinite(values[code])))
    .map((id) => getMiLabStep(id, values, sex))
    .filter((s): s is number => typeof s === 'number');
  const step = steps.length > 0 ? Math.max(...steps) : null;

  return {
    step,
    share: miIndexShare(step),
    percent: miIndexPercent(step),
    measured,
    total: markers.length,
    markers,
    skipped,
  };
}
