/**
 * progesterone-advice.test.ts — проход 190: совет на прогестерон без каберголина.
 *
 * Прогестерон у мужчины — диагностическая находка. Прежние правила выдавали на
 * него каберголин (агонист D2, снижает ПРОЛАКТИН, а не прогестерон, и имеет свои
 * риски) и называли повышение «гинекомастией/либидо» — грудь при курсе растёт от
 * эстрадиола и пролактина. Кроме того, одно и то же число судили две строки
 * правил (`PROG` и `PROGESTERONE`) с разными текстами.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeTierAdjustments } from '../lab-tier-recommendations';

const SRC = readFileSync(resolve(process.cwd(), 'src/data/lab-tier-recommendations.ts'), 'utf8');

describe('проход 190: прогестерон — к врачу, а не «снижать» препаратом', () => {
  it('каберголин не выдаётся ни на одной ступени', () => {
    for (const value of [2, 5, 12]) {
      const r = computeTierAdjustments({ PROG: value }, 'male');
      expect(r.addSubs.map((s) => s.id), `PROG ${value}`).not.toContain('cabergoline');
    }
  });

  it('повышение ведёт к эндокринологу с адренальным источником', () => {
    const r = computeTierAdjustments({ PROG: 12 }, 'male');
    const text = r.alerts.map((a) => a.message).join(' ');
    expect(text).toContain('эндокринолог');
    expect(text).toContain('17-ОН-прогестерон');
    expect(text).toContain('кортизол');
    // Механизм 19-нор-стероидов — PR-агонизм и пролактин, а не «прогестерон
    // в бланке»: перекрёстная реакция нандролона 0.17% (Krasowski 2014, табл. 4).
    expect(text).not.toContain('гинекомастия/либидо');
    expect(text).toContain('каберголин здесь не показан');
  });

  it('второе написание даёт тот же совет, что канон', () => {
    const alias = computeTierAdjustments({ PROGESTERONE: 12 }, 'male');
    const canon = computeTierAdjustments({ PROG: 12 }, 'male');
    expect(alias.alerts[0]?.tier).toBe(canon.alerts[0]?.tier);
    expect(alias.alerts[0]?.message).toBe(canon.alerts[0]?.message);
    expect(alias.nutrition.map((n) => n.action)).toEqual(canon.nutrition.map((n) => n.action));
  });

  it('строка правил у анализа одна — второе написание закрыто мостом', () => {
    expect(SRC.match(/marker: 'PROG'/g)).toHaveLength(1);
    expect(SRC).not.toContain("marker: 'PROGESTERONE'");
  });
});
