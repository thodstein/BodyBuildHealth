/**
 * ics-format.ts — общие правила календаря (.ics, RFC 5545).
 *
 * Зачем отдельный модуль: в проекте было минимум семь локальных копий
 * экранирования (`escIcs`, `icsEscape`, `escapeIcs`) и ни одного складывания
 * строк. Кириллица в UTF-8 занимает 2 байта на символ, поэтому даже короткий
 * русский заголовок легко переходит лимит строки — клиенты такие строки
 * обрезают или ломают событие.
 *
 * Правила:
 *  - `icsEscape` — §3.3.11: экранируются `\`, `;`, `,` и переводы строк;
 *  - `icsFoldLine` — §3.1: не длиннее 75 ОКТЕТОВ UTF-8, продолжение —
 *    `CRLF + пробел`; суррогатные пары и многобайтные символы не рвутся;
 *  - `icsProperty` — собрать `NAME:value` сразу с экранированием и складыванием.
 */

/** Экранирование значения свойства ICS (RFC 5545 §3.3.11). */
export function icsEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Складывание физической строки в 75 октетов UTF-8 (RFC 5545 §3.1). */
export function icsFoldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // Первая строка — 75 октетов, продолжения начинаются с пробела → 74.
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** `NAME:value` с экранированием и складыванием — одна строка (или несколько
 *  физических строк с продолжениями). */
export function icsProperty(name: string, value: unknown): string {
  return icsFoldLine(`${name}:${icsEscape(value)}`);
}

/** Развернуть складывание обратно (полезно в тестах и при разборе). */
export function icsUnfold(text: string): string {
  return String(text ?? '').replace(/\r\n[ \t]/g, '');
}
