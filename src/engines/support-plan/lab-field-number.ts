/**
 * support-plan/lab-field-number.ts — число из поля анализов, одно правило на всё
 * приложение.
 *
 * Поле бланка — это строка. Правила её чтения выросли из двух дефектов проходов:
 *  - проход 130: «1+», «2+», «++» — это полоска, а не концентрация. `parseFloat('1+')`
 *    даёт 1, и «+1» белка мочи становился 1 г/л, то есть нефротической протеинурией
 *    из ничего;
 *  - проход 131: бланк печатает «>1000» и «<0.5». `parseFloat` на такой строке даёт
 *    NaN, и анализ пропадал целиком: ферритин «>1000» (перегрузка железом) не давал
 *    ни находки, ни вклада в риск. Границу читаем как её число — так же, как это
 *    делает авто-разбор бланка (`core/lab-auto-parser`: `[<>≤≥]?число`), а интерфейс
 *    говорит об этом баннером «граница вместо числа» (`labBoundNotes`).
 *
 * Проход 136: функция одна и та же для риск-модели (`extractLabValues`) и для
 * плана поддержки (`labSliceToValues`) — раньше правило жило копией в каждом.
 */
export function labFieldNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'string' && val.includes('+')) return undefined;
  if (typeof val === 'string' && /^[<>≤≥]/.test(val.trim())) {
    const bound = parseFloat(val.trim().replace(/^[<>≤≥]\s*/, '').replace(',', '.'));
    return isNaN(bound) ? undefined : bound;
  }
  const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
  return isNaN(n) ? undefined : n;
}
