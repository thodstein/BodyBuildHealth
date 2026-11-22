/**
 * pl-season-dates-audit-2026-11.test.ts — аудит 2026-11-22, фаза 3.
 *
 *  • P0-1 (данные): одноразовый вопрос «дата старта верна?» после массового
 *    «съезда» дат (флаг he_pl_meet_date_prompt_v1, не спрашиваем повторно).
 *  • P1-1: `seasonStart` для тапера по сезону и .ics — начало сезона (сегодня),
 *    а не дата старта (иначе все недели уезжали на N−1 недель).
 *  • P1-2: дата старта не «замораживается» при монтировании — пустое поле значит
 *    «производная от окна», есть кнопка возврата к окну.
 *
 * Поведение самих функций проверяется в движках
 * (pl-meet-registry.test.ts — дрейф даты, lms-season-peaks.test.ts — длина сезона).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('P0-1: одноразовая проверка даты старта', () => {
  const src = read('src/ui/screens/SRCBBScreen.tsx');

  it('флаг he_pl_meet_date_prompt_v1 и модалка с «Дата верна» / «Исправить дату»', () => {
    expect(src).toContain("'he_pl_meet_date_prompt_v1'");
    expect(src).toContain('📅 Исправить дату');
    expect(src).toContain('✅ Дата верна');
    expect(src).toContain('TrainingModal');
  });

  it('флаг ставится в любом исходе (подтвердил/исправил/закрыл) — повторно не спрашиваем', () => {
    const fn = src.slice(src.indexOf('const resolveMeetDateAsk'));
    expect(fn).toContain('localStorage.setItem(PL_MEET_DATE_PROMPT_KEY');
    // setItem — ДО раннего выхода на пустой дате, иначе закрытие модалки спросит снова.
    expect(fn.indexOf('localStorage.setItem(PL_MEET_DATE_PROMPT_KEY')).toBeLessThan(fn.indexOf('if (!iso'));
  });

  it('исправленная дата пишется в канон he_pl_macro и недели пересчитываются от неё', () => {
    const fn = src.slice(src.indexOf('const resolveMeetDateAsk'));
    expect(fn).toContain("localStorage.setItem('he_pl_macro'");
    expect(fn).toContain('weeksToStartFromDate(iso, today)');
  });
});

describe('P1-1: seasonStart — начало сезона, а не дата старта', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');

  it('тапер по сезону получает сегодняшнюю дату как неделю 1', () => {
    expect(src).toContain('seasonStart: localIsoDateOffset(0)');
    expect(src).not.toContain('seasonStart: meetDateInput || undefined');
  });

  it('.ics сезона тоже считается от начала сезона', () => {
    expect(src).toMatch(/seasonStart:\s*seasonIcsWithSessions[^(]*\?\s*localIsoDateOffset\(0\)/);
  });
});

describe('P1-2: дата старта следует за окном, пока её не ввели руками', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');

  it('состояние инициализируется пустым (производная), а не снимком', () => {
    expect(src).toContain("const [meetDateInput, setMeetDateInput] = React.useState<string>('')");
    expect(src).toContain('const meetRef = meetDateInput || derivedMeetDate');
  });

  it('есть кнопка возврата к окну', () => {
    expect(src).toContain('↺ К окну');
    expect(src).toContain("setMeetDateInput('')");
  });
});

describe('P2-3: единственный канон даты — ДЕНЬ СОРЕВНОВАНИЯ', () => {
  const tab = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');
  const screen = read('src/ui/screens/SRCBBScreen.tsx');

  it('производная дата — конец недели старта (не её понедельник)', () => {
    expect(tab).toContain('meetDayFromWeeksToStart(');
    expect(tab).not.toContain('dateFromWeeksToStart(');
  });

  it('подпись больше не врёт «неделя старта заканчивается …»', () => {
    expect(tab).not.toContain('неделя старта заканчивается');
    expect(tab).toContain('день соревнования');
    // границы недели старта показываются честно: (день − 6)…день
    expect(tab).toContain('isoAddDays(meetDateInput, -6)');
  });

  it('тренер-тапер тоже считает от дня соревнования', () => {
    expect(screen).toContain('meetDate: meetDayFromWeeksToStart(');
    expect(screen).not.toContain('meetDate: dateFromWeeksToStart(');
  });
});
