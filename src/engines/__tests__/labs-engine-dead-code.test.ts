/**
 * labs.engine — мёртвое хранение и второй прогноз удалены (проход 202).
 *
 * Дефект: в движке лежали три функции без единого вызова —
 * `addLabPoint`/`getLabHistory`/`getLabTrend` (писатель и читатель стора
 * `labs_log`, в который не писал никто) и `predictLab` с интерфейсом
 * `LabForecast` (линейный прогноз с ДИ). Прогноз при этом уже жил вторым
 * способом — `predictive.engine.predictLabTrend`, и «Аналитика» читает именно
 * его. Два прогноза одной величины — ровно то, что запрещено: числа расходятся,
 * а тест проверяет тот, который на экран не попадает.
 *
 * Почему source-guard: инвариант — «у прогноза и у стора лаборатории один
 * дом». Удалённые функции приватностью не отделены (они были экспортами), но
 * проверить поведением то, чего нет, нельзя; честная проверка — структурная.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as labs from '../labs.engine';

const LABS_SRC = readFileSync(join(__dirname, '..', 'labs.engine.ts'), 'utf8');
const PREDICTIVE_SRC = readFileSync(join(__dirname, '..', 'predictive.engine.ts'), 'utf8');

describe('проход 202: лабораторный движок без мёртвого хранения', () => {
  it('хранение labs_log удалено целиком: ни писателя, ни читателя', () => {
    const exported = Object.keys(labs);
    expect(exported).not.toContain('addLabPoint');
    expect(exported).not.toContain('getLabHistory');
    expect(exported).not.toContain('getLabTrend');
    // Ключ стора в движке быть не должно: писателя нет — запись осталась бы сиротой.
    expect(LABS_SRC).not.toContain('labs_log');
    expect(LABS_SRC).not.toContain("from '../core/db'");
  });

  it('прогноз лаборатории — один: predictive.engine, а не labs.engine', () => {
    expect(Object.keys(labs)).not.toContain('predictLab');
    expect(LABS_SRC).not.toContain('predictLab(');
    expect(PREDICTIVE_SRC).toContain('export function predictLabTrend');
  });

  it('нормализация и проверка границ остаются на месте (это не мёртвый код)', () => {
    const exported = Object.keys(labs);
    expect(exported).toContain('normalizeLab');
    expect(exported).toContain('isAbnormal');
    expect(exported).toContain('toHL7v2OBX');
  });
});
