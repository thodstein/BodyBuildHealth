/**
 * Как печатается одно значение анализа.
 *
 * Проход 138: бланк печатает границу, когда результат за пределами линейного
 * диапазона метода («Ферритин >1000 нг/мл», «СРБ <0.5 мг/л»). В расчёт идёт
 * число (шкала ступеней иначе не работает), но в интерфейсе значение без знака
 * выглядит точным измерением — а это не так. Одна функция на все поверхности:
 * список анализов, карточка маркера, отчёт, CSV, предпросмотр импорта.
 */
export function labValueLabel(
  value: number | string | null | undefined,
  bound?: '<' | '>' | string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  return `${bound === '<' || bound === '>' ? bound : ''}${value}`;
}

/**
 * То же значение для HTML-поверхностей (отчёт, PDF, недельная сводка).
 *
 * Проход 143: знак «<» в HTML — не текст, а начало тега. «СРБ <0.5 мг/л» в
 * таблице отчёта обрывал ячейку: браузер видел тег «0.5». Поэтому знак
 * печатается сущностью (`&lt;0.5`), а сам текст значения не меняется.
 */
export function labValueLabelHtml(
  value: number | string | null | undefined,
  bound?: '<' | '>' | string,
): string {
  const text = labValueLabel(value, bound);
  if (text === '—') return text;
  if (bound === '<') return `&lt;${value}`;
  if (bound === '>') return `&gt;${value}`;
  return text;
}
