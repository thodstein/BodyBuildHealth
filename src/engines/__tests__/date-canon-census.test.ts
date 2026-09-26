/**
 * date-canon-census.test.ts — ВИТРИНА долга по календарным датам.
 *
 * Задача: в проекте «календарная дата» (день тренировки, дата отчёта, день
 * недели, дата соревнования) везде должна считаться через `src/core/local-date.ts`.
 * Нарушение выглядит как `new Date().toISOString().slice(0,10)` — это UTC, и в
 * UTC+3…+12 вечером даёт «вчера» (наша машина как раз Asia/Vladivostok).
 *
 * Тест НЕ падает на текущем долге (он большой и относится к чужим зонам), но:
 *  1) печатает инвентаризацию по зонам — видно, где ещё чинить;
 *  2) фиксирует ПОТОЛОК: любое новое такое место роняет сборку. Долг может
 *     только уменьшаться (это делали зоны по очереди), но не расти.
 *
 * НЕ ловим (осознанно): полные таймстемпы `updatedAt/createdAt/builtAt/savedAt` —
 * там UTC корректен.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { localIsoDate, localIsoDateOffset, parseLocalIsoDate, shiftIsoDate } from '../../core/local-date';

const SRC = join(process.cwd(), 'src');
const EXT = /\.(ts|tsx)$/;

/** Рекурсивный обход src без node_modules. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name === 'node_modules') continue; walk(p, out); }
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

/** date-only вызовы: .toISOString() с последующим .slice(0, 10) */
const DATE_ONLY = /\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g;

/**
 * Убираем комментарии перед подсчётом: иначе сам модуль-канон и любые
 * поясняющие комментарии вида «toISOString().slice(0,10) — это UTC» попадают
 * в долг как реальные места. Полнострочные `//` и блоки `/* *\/` — то, где
 * живут все такие пояснения; хвостовые `//` после кода остаются, но в них
 * календарных дат не пишут.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const zoneOf = (rel: string): string =>
  rel.split(/[\\/]/).slice(0, 3).join('/') || 'src';

function census() {
  const files = walk(SRC).filter(f => !/[\\/]__tests__[\\/]/.test(f) && !/\.test\.(ts|tsx)$/.test(f));
  const perZone = new Map<string, number>();
  const sites: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const hits = src.match(DATE_ONLY);
    if (!hits || !hits.length) continue;
    const rel = f.replace(/\\/g, '/').split('/src/')[1] ? 'src/' + f.replace(/\\/g, '/').split('/src/')[1] : f;
    const z = zoneOf(rel);
    perZone.set(z, (perZone.get(z) || 0) + hits.length);
    hits.forEach((_, i) => sites.push(`${rel}:${i + 1}`));
  }
  return { perZone, sites, total: sites.length };
}

describe('канон календарной даты (core/local-date)', () => {
  it('localIsoDate берёт МЕСТНЫЕ геттеры (контракт) и там, где окружение позволяет — не UTC', () => {
    // Контракт: значение = календарь МЕСТНОГО времени. Проверяем всегда.
    const d = new Date(2026, 8, 26, 23, 30);
    expect(localIsoDate(d)).toBe(`${d.getFullYear()}-09-26`);
    // Различие с UTC проверяем только если машина впереди UTC: иначе утверждение
    // было бы вакуумным (в UTC обе даты совпадают). Сдвиг TZ через process.env
    // в vitest-окружении не применяется, поэтому опираемся на реальный offset.
    const сейчас = new Date();
    const смещениеЧасов = -сейчас.getTimezoneOffset();
    if (смещениеЧасов > 0) {
      const позднийВечер = new Date(Date.UTC(2026, 8, 26, 23, 30));
      expect(позднийВечер.toISOString().slice(0, 10)).toBe('2026-09-26'); // UTC говорит «26-е»
      expect(localIsoDate(позднийВечер)).not.toBe('2026-09-26');          // календарь — «27-е»
    } else {
      console.log('[date-canon] смещение TZ = 0 — сравнение с UTC пропущено (иначе тест вакуумный)');
    }
  });

  it('полночь не «перескакивает» ни в одну сторону', () => {
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
    expect(localIsoDate(new Date(2026, 0, 1, 23, 55))).toBe('2026-01-01');
  });

  it('localIsoDateOffset не съезжает на сутки через границу месяца', () => {
    const последнийДеньФевраля = new Date(2026, 1, 28, 12, 0);
    expect(localIsoDateOffset(1, последнийДеньФевраля)).toBe('2026-03-01');
    expect(localIsoDateOffset(-1, new Date(2026, 2, 1, 12, 0))).toBe('2026-02-28');
  });

  it('parse/shift: разбор в местную полночь, сдвиг строковой даты', () => {
    const d = parseLocalIsoDate('2026-09-26');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getDate()).toBe(26);
    expect(parseLocalIsoDate('мусор')).toBeNull();
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('витрина долга: date-only вызовы', () => {
  const { perZone, sites, total } = census();

  it('инвентаризация напечатана (где чинить дальше)', () => {
    const строки = [...perZone.entries()].sort((a, b) => b[1] - a[1]).map(([z, n]) => `  ${z}: ${n}`);
    console.log(`[date-canon] date-only мест в production-коде: ${total}\n${строки.join('\n')}`);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('долг не растёт: новых мест быть не должно', () => {
    // Потолок = измеренный базовый уровень. Он ТОЛЬКО уменьшается: на старте
    // раунда измерено 250 мест, затем календарь + трекер питания сняли 17 (writer
    // и reader дневных ключей, окна недели/месяца, серия дней) -> 233, затем
    // пять отчётных движков (окна анализов, приверженности, недели рекомендаций,
    // прогноз даты цели, отчёт) сняли ещё 25 -> 208, затем контур дневников
    // (TrainingDiaryHub/DiaryToolsView/DiaryHistoryView: ключ напоминания,
    // «сегодня» в карточках, гейт «тренировка сегодня», имена выгружаемых
    // файлов, окно ПР за 30 дней, границы недель) снял 22 -> 186, затем
    // лаборатория + риски (LabsScreen/RiskScreen: дата снимка и имя выгрузки,
    // подпись отчёта, три стартовые даты окон комплаенса) сняли 13 -> 173, затем
    // арм-контур (ArmDiagnosticsHub/ArmliftingDiagnosticsHub/arm-hub-tabs2: дата
    // снимков, «сегодня», имена выгрузок, dateIso силовой попытки, недели с
    // прошлой попытки) снял ещё 13 -> 160. Одно из этих 13 мест — `touchedAt`
    // в he_arm_humerus_checks — оказалось СОБЫТИЕМ во времени, а не календарным
    // днём: его не «перевели» на канон, а перестали резать до дня (write-only).
    // Затем хаб стронгмена (StrongmanDiagnosticsHub) снял ещё 7: три writer-даты
    // (запись прогресса, снимок приседа, снимок хвата) и четыре имени выгрузки
    // (бэкап/ICS/HTML/CSV). Writer-класс здесь не косметика: append*Snapshot и
    // appendSMProgress ЗАМЕНЯЮТ запись по дате, поэтому UTC-дата на границе суток
    // (вечер 26-го + утро 27-го в UTC+10 дают один UTC-день) затирала вечернюю
    // запись утренней. Проверено мутацией в strongman-date-canon.
    // Расти нельзя. Зона чинит -> число падает, потолок понижается здесь же.
    const ПОТОЛОК = 153;
    expect(
      total,
      `date-only мест стало ${total} (был максимум ${ПОТОЛОК}). Почини через core/local-date:\n${sites.slice(0, 20).join('\n')}`,
    ).toBeLessThanOrEqual(ПОТОЛОК);
  });

  it('зона стронгмена/ТА чиста — там долга быть не должно', () => {
    const вЗоне = sites.filter(s => s.startsWith('src/engines/strength-sport/') || s.startsWith('src/ui/screens/strength-sport/'));
    expect(вЗоне, `в зоне стронгмена/ТА остались date-only вызовы:\n${вЗоне.join('\n')}`).toEqual([]);
  });
});
