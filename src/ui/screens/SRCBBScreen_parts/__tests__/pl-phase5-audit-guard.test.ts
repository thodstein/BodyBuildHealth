/**
 * pl-phase5-audit-guard.test.ts — аудит 2026-11-22, фаза 5 (проводка и честность чисел).
 *
 *  • P1-3  — разряд не считается по неполному тоталу (UI честно это говорит);
 *  • P1-4  — выбор цикла/согласие в «циклах между соревнованиями» — по meetId;
 *  • P1-5  — чек-ин и видео подходов в бэкапе;
 *  • P2-2  — «Недель до старта» синхронизирует блок цели и карточку главного старта;
 *  • P2-13 — RIR пост-старта = база + 3, подпись из фактических значений;
 *  • P2-19 — пропуск по размеру виден в UI, карточки-мосты в бэкапе.
 *
 * Поведение движков проверяется в pl-norms-bridge / lms-comp-gap / pl-backup /
 * pl-post-meet-and-registry.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('P1-3: UI не обещает разряд по неполному тоталу', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');

  it('заголовок карточки различает «Тотал» и «Разряд»', () => {
    expect(src).toContain('normsSnap.incomplete');
    expect(src).toContain('${normsSnap.liftsFound} из 3 движений');
  });

  it('в полной карточке видно, что тотал неполный', () => {
    expect(src).toContain('⚠ неполный: ${normsSnap.liftsFound} из 3 движений');
  });
});

describe('P2-2: «Недель до старта» — одно значение на два поля', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');

  it('общий хелпер пишет и meetList, и окно', () => {
    const fn = src.slice(src.indexOf('const syncWindowWeeks ='));
    expect(fn).toContain('weeksToStart: weeks');
    expect(fn).toContain('setWeeksToMeet(weeks)');
    expect(fn.indexOf('weeksToStart: weeks')).toBeLessThan(fn.indexOf('setWeeksToMeet(weeks)'));
  });

  it('оба поля используют хелпер, а не «сырые» сеттеры', () => {
    expect(src).toContain('syncWindowWeeks(m.id, weeks)');
    expect(src).toContain('syncWindowWeeks(mainMeetId, v)');
    expect(src).not.toContain('onChange={(v) => setWeeksToMeet(v)}');
  });
});

describe('P1-4: «циклы между соревнованиями» — ключ meetId', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLSeasonBuilder.tsx');

  it('выбор/согласие пишутся под meetId сегмента', () => {
    expect(src).toContain('{ ...compSelections, [seg.meetId]:');
    expect(src).toContain('{ ...compConsents, [seg.meetId]:');
    expect(src).toContain('compConsents[seg.meetId]');
    expect(src).not.toContain('compConsents[i]');
  });

  it('старые числовые ключи мигрируются по текущему порядку стартов', () => {
    expect(src).toContain('migrateCompKeys');
    expect(src).toContain('/^\\d+$/.test(k)');
    expect(src).toContain('m.weeksToStart >= 1');
  });
});

describe('P1-5 / P2-19: бэкап переносит чек-ин, видео и карточки-мосты', () => {
  const engine = read('src/engines/lms/pl-backup.engine.ts');

  it('ключи в белом списке и с подписями', () => {
    for (const key of ['he_pl_checkin', 'he_pl_set_video', 'he_pl_diagnostic_card_v1', 'he_pl_limiter_card_v1']) {
      expect(engine).toContain(`'${key}'`);
      expect(engine).toContain(`${key}:`);
    }
  });

  it('пропуск по размеру не молчит', () => {
    expect(engine).toContain('oversize');
    expect(read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx')).toContain('backup.oversize');
  });
});

describe('P2-13: RIR пост-старта честный', () => {
  const src = read('src/engines/lms/lms-builder.engine.ts');

  it('сдвиг +3 и подпись из фактических значений', () => {
    expect(src).toContain('POST_MEET_RIR_SHIFT = 3');
    expect(src).toContain('rirLabel');
    expect(src).toContain('RIR ${rirLabel}');
  });

  it('жёсткая RIR 4 в неделе восстановления убрана', () => {
    const block = src.slice(src.indexOf('if (opts?.postMeet) {'));
    const postBlock = block.slice(0, block.indexOf('cur++'));
    expect(postBlock).not.toContain('rir: 4,');
  });
});
