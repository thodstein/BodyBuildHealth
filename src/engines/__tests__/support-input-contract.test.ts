/**
 * support-input-contract.test.ts — проход 95: у контракта поддержки нет мёртвых полей.
 *
 * Было: `SupportInput` объявлял `labs` (последние 10 анализов) и `demographics`
 * ({age, weight, sex}), а `data-link` их честно передавал. Ни один из них движок
 * не читал: совокупный риск поддержки считается от базы, генетики, питания,
 * тренировок и доз препаратов. Это тот же класс, что проход 94 («пол передаётся,
 * но ни на что не влияет»), только шире: отбрасывался весь блок.
 *
 * Стало: поля удалены с обеих сторон, а в интерфейсе записано, где лабораторные и
 * половые поправки действительно живут. Тест держит поведение: анализы и пол не
 * меняли результат — значит, удаление ничего не сломало.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateSupport } from '../support.engine';

describe('проход 95: контракт `calculateSupport` без мёртвых полей', () => {
  it('анализы и пол не меняли результат и не меняют теперь', () => {
    const plain = calculateSupport({ substances: ['nac'] });
    const withDeadPayload = calculateSupport({
      substances: ['nac'],
      labs: [{ code: 'HCT', value: 55 }, { code: 'ALT', value: 90 }],
      demographics: { age: 41, weight: 92, sex: 'female' },
    } as any);
    expect(withDeadPayload).toEqual(plain);
  });

  it('в `SupportInput` нет полей `labs`/`demographics`', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/support.engine.ts'), 'utf8');
    const from = src.indexOf('export interface SupportInput');
    const to = src.indexOf('export interface SupportOutput');
    const iface = src.slice(from, to);
    expect(iface.length).toBeGreaterThan(0);
    expect(iface).not.toMatch(/^\s+labs\?:/m);
    expect(iface).not.toMatch(/^\s+demographics\?:/m);
  });

  it('вызывающий не передаёт данные, которые движок отбрасывает', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/data-link.ts'), 'utf8');
    const start = src.indexOf('calculateSupport({');
    expect(start).toBeGreaterThan(-1);
    const call = src.slice(start, src.indexOf('});', start));
    expect(call).not.toMatch(/\blabs:/);
    expect(call).not.toMatch(/\bdemographics:/);
  });
});
