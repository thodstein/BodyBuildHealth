/**
 * arm-humerus-checklist.engine.ts — позиционный чек-лист перед тяжёлым столом (PRO-3 P8).
 * Источник маркеров: видеоанализ 74 переломов (SpringerMedicine 2024–2025) —
 * ротация туловища, сломанная ось «кисть–локоть–плечо», запястье позади плеча (81,1%),
 * 62,2% переломов — в защитной позиции. Плюс разминка (ретроспектива PMC 2023:
 * холодный сезон и отсутствие разминки — фактор риска).
 * Чистый движок без порогов силы: любой «нет» → стоп тяжёлого стола сегодня.
 */

export interface HumerusCheck {
  id: string;
  label: string;
  hint: string;
}

export const HUMERUS_CHECKS: HumerusCheck[] = [
  { id: 'axis', label: 'Ось цела', hint: 'кисть–локоть–плечо на одной линии' },
  { id: 'wrist', label: 'Запястье впереди', hint: 'не позади плеча' },
  { id: 'shoulder', label: 'Плечо не внутрь', hint: 'не ушло внутрь/назад (защита ≠ завал)' },
  { id: 'elbow', label: 'Локоть стоит', hint: 'не едет по подушке' },
  { id: 'warmup', label: 'Разминка сделана', hint: 'кровь в локте/кисти, лёгкие подходы' },
];

export interface HumerusCheckResult {
  ok: boolean;
  failedIds: string[];
  failedLabels: string[];
  stopLine: string | null;
}

export function checkHumerusChecklist(failedIds: string[]): HumerusCheckResult {
  const known = new Set(HUMERUS_CHECKS.map((c) => c.id));
  const failed = (failedIds || []).filter((id) => known.has(id));
  const labels = failed.map((id) => HUMERUS_CHECKS.find((c) => c.id === id)?.label || id);
  return {
    ok: failed.length === 0,
    failedIds: failed,
    failedLabels: labels,
    stopLine: failed.length
      ? `⛔ broken arm position — стоп: тяжёлый стол сегодня запрещён (сбоит: ${labels.join(', ')})`
      : null,
  };
}
