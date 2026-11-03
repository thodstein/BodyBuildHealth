/**
 * pl-protocol-import.engine.ts — импорт протокола соревнования (Фаза 6, п.4).
 *
 * Зачем: после старта спортсмен вводит факты попыток вручную (чипы в карточке
 * прикидов). Протокол федерации (OPL/бумага) содержит те же данные — их можно
 * вставить текстом и не набирать руками.
 *
 * ЧЕСТНОСТЬ: форматы протоколов у федераций разные, поэтому парсер
 * ТОЛЕРАНТНЫЙ и НЕ УГАДЫВАЕТ там, где данных нет:
 *  • движение определяется по названию (присед/жим/тяга) — иначе строка идёт
 *    в `warnings`, а не «примерно в присед»;
 *  • зачёт/баранка — по явному маркеру (✅/+/x/❌/«зачёт»/«no lift»); строки без
 *    маркера считаются «нет данных» и не выдумывают результат;
 *  • номер попытки — из строки (1/2/3), иначе по порядку внутри движения.
 * Результат всегда показывается пользователю со списком предупреждений; ничего
 * не пишется в план молча.
 */

export type ProtocolLift = 'squat' | 'bench' | 'deadlift';

export interface ProtocolAttemptRow {
  lift: ProtocolLift;
  liftName: string;
  attempt: 1 | 2 | 3;
  weight: number;
  /** true — зачёт, false — баранка, null — маркера не было (нет данных). */
  made: boolean | null;
}

export interface ProtocolParseResult {
  rows: ProtocolAttemptRow[];
  warnings: string[];
}

const LIFT_PATTERNS: { lift: ProtocolLift; name: string; re: RegExp }[] = [
  { lift: 'squat', name: 'Присед', re: /присед|squat/i },
  { lift: 'bench', name: 'Жим', re: /жим\s*(лёж|леж|л)?|bench/i },
  { lift: 'deadlift', name: 'Тяга', re: /станов|deadlift|тяга/i },
];

const MADE_TRUE = /(✅|✓|✔|\+|зач[её]т|good\s*lift|^ok$|выполнен)/i;
const MADE_FALSE = /(❌|✗|✘|(^|\s)[xх](\s|$)|no\s*lift|баранк|не\s*зач[её]т|fail|мимо)/i;

/** Тяговые аксессуары — не соревновательная становая (иначе «тяга к поясу» стала бы тягой). */
const ACCESSORY_PULL = /тяга\s+(к|на|в|с)\s|тяга\s+блока|тяга\s+гантел|тяга\s+т-?гриф|пуловер|шраг/i;

function normalizeLine(line: string): string {
  return line.replace(/[|;\t]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Вес: первое «кг-подобное» число, но не номер попытки в начале строки. */
function extractWeight(text: string): { weight: number; rest: string } | null {
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:кг|kg)?/gi)];
  for (const m of matches) {
    const value = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;
    // Номер попытки (1..3) без десятичной части и без «кг» — не вес.
    const hasUnit = /кг|kg/i.test(m[0]);
    const isWhole = !/[.,]/.test(m[1]);
    if (!hasUnit && isWhole && value >= 1 && value <= 3) continue;
    if (value < 20 || value > 500) continue;
    return { weight: value, rest: text.replace(m[0], ' ') };
  }
  return null;
}

function detectLift(text: string): { lift: ProtocolLift; name: string } | null {
  if (ACCESSORY_PULL.test(text) && !/станов|deadlift/i.test(text)) return null;
  for (const p of LIFT_PATTERNS) if (p.re.test(text)) return { lift: p.lift, name: p.name };
  return null;
}

function detectAttempt(text: string): 1 | 2 | 3 | null {
  // «2-я», «попытка 2», «attempt 2», или одиночная цифра 1..3 в начале строки.
  const explicit = text.match(/(?:^|\s)([123])(?:-?(?:я|ья|й))?(?=\s|$|[:.)])/);
  if (explicit) return Number(explicit[1]) as 1 | 2 | 3;
  return null;
}

/**
 * Разбор вставленного протокола. Строки с движением и весом попадают в `rows`;
 * всё остальное — в `warnings` (первая строка-заголовок обычно игнорируется).
 */
export function parseMeetProtocol(text: string): ProtocolParseResult {
  const rows: ProtocolAttemptRow[] = [];
  const warnings: string[] = [];
  if (!text || !text.trim()) return { rows, warnings: ['Пустой текст протокола.'] };

  const perLiftCount = new Map<ProtocolLift, number>();
  const seenKeys = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = normalizeLine(raw);
    if (!line) continue;
    const liftInfo = detectLift(line);
    if (!liftInfo) {
      // Заголовки таблиц/даты/имена — не ошибка, но и не данные.
      if (/\d/.test(line)) warnings.push(`Строка без движения: «${raw.trim().slice(0, 60)}»`);
      continue;
    }
    const weightInfo = extractWeight(line);
    if (!weightInfo) {
      warnings.push(`Не нашёл вес: «${raw.trim().slice(0, 60)}»`);
      continue;
    }
    const weight = Math.round(weightInfo.weight * 2) / 2; // блины 0.5 кг
    if (liftInfo.lift === 'deadlift' && /тяга/i.test(line) && !/станов|deadlift|суммо|классич/i.test(line)) {
      warnings.push(`«${raw.trim().slice(0, 60)}» — тяга без уточнения: считаю становой (в протоколе это одно движение).`);
    }
    const attempt = detectAttempt(line) ?? ((Math.min(3, (perLiftCount.get(liftInfo.lift) ?? 0) + 1)) as 1 | 2 | 3);
    const made = MADE_FALSE.test(line) ? false : MADE_TRUE.test(line) ? true : null;
    const key = `${liftInfo.lift}:${attempt}`;
    if (seenKeys.has(key)) {
      warnings.push(`Дубль попытки ${attempt} в «${liftInfo.name}» — строка «${raw.trim().slice(0, 60)}» пропущена.`);
      continue;
    }
    seenKeys.add(key);
    perLiftCount.set(liftInfo.lift, Math.max(perLiftCount.get(liftInfo.lift) ?? 0, attempt));
    rows.push({ lift: liftInfo.lift, liftName: liftInfo.name, attempt, weight, made });
  }

  if (rows.length === 0) warnings.push('Не распознано ни одной попытки. Формат: «Присед 2 192.5 ✅» (движение, номер, вес, зачёт).');
  const noMark = rows.filter(r => r.made === null).length;
  if (noMark > 0) warnings.push(`${noMark} строк(и) без маркера зачёта — результат не проставлен (решите сами).`);

  rows.sort((a, b) => (a.lift === b.lift ? a.attempt - b.attempt : a.lift.localeCompare(b.lift)));
  return { rows, warnings };
}
