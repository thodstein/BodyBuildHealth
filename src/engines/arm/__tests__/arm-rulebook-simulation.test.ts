/**
 * arm-rulebook-simulation.test.ts — симулятор зачёта (раньше 0 тестов).
 * Проверяем поведение по правилам: стратегия попыток, протокол снаряда,
 * сетка WAF (double-elimination, 2 поражения = вылет).
 */
import { describe, it, expect } from 'vitest';
import {
  buildAttemptStrategy,
  simulateImplementProtocol,
  simulateWafBracket,
} from '../arm-rulebook-simulation.engine';
import { WAF_2025_SNAPSHOT, ARMLIFTING_USA_2026_SNAPSHOT } from '../arm-rulebook';
import type { ImplementProtocol, RulebookSnapshot } from '../arm-rulebook';

function protocolsOf(snapshot: RulebookSnapshot): readonly ImplementProtocol[] {
  const rules: any = snapshot.rules;
  return (rules && Array.isArray(rules.protocols) ? rules.protocols : []) as readonly ImplementProtocol[];
}

function findProtocol(id: string): ImplementProtocol {
  const all = [...protocolsOf(WAF_2025_SNAPSHOT), ...protocolsOf(ARMLIFTING_USA_2026_SNAPSHOT)];
  const p = all.find((x) => x.id === id);
  if (!p) throw new Error(`protocol ${id} not found; have: ${all.map((x) => x.id).join(', ')}`);
  return p;
}

describe('buildAttemptStrategy', () => {
  it('неверифицированный протокол → invalid, без выдуманных весов', () => {
    const p = findProtocol(findProtocolId());
    const fake = { ...p, verified: false } as ImplementProtocol;
    const r = buildAttemptStrategy(fake, {});
    expect(r.valid).toBe(false);
    expect(r.strategy).toBeNull();
    expect(r.errors.join(' ')).toMatch(/verified/i);
  });

  it('three_increasing_weights: строго возрастающие веса, ровно 3', () => {
    const p = findProtocol(findProtocolId());
    if (p.attemptPolicy.mode !== 'three_increasing_weights') return;
    const r = buildAttemptStrategy(p, { startWeightKg: 50 });
    if (!r.valid) { expect(r.errors.length).toBeGreaterThan(0); return; }
    const w = r.strategy!.weightsKg;
    expect(w.length).toBe(3);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
  });

  it('unlimited: без весов и без цели → честная ошибка (не молчаливый план)', () => {
    const p = findProtocol(findProtocolId());
    if (p.attemptPolicy.mode !== 'unlimited') return;
    const r = buildAttemptStrategy(p, {});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

function findProtocolId(): string {
  const all = [...protocolsOf(WAF_2025_SNAPSHOT), ...protocolsOf(ARMLIFTING_USA_2026_SNAPSHOT)];
  return (all.find((x) => x.verified) || all[0]).id;
}

describe('simulateImplementProtocol — правила события', () => {
  const proto = () => findProtocol(findProtocolId());

  it('промах = выбыл (если missConsequence eliminate) — следующие попытки игнорируются', () => {
    const p = proto();
    if (p.attemptPolicy.missConsequence !== 'eliminate_from_event') return;
    const r = simulateImplementProtocol(p, [
      { weightKg: 100, success: true },
      { weightKg: 110, success: false },
      { weightKg: 120, success: true },
    ]);
    expect(r.status).toBe('eliminated');
    expect(r.completedAttempts).toBe(2);
    expect(r.ignoredAttempts).toBe(1);
  });

  it('превышение лимита попыток → invalid (не молчаливый пропуск)', () => {
    // событие с конечным числом попыток (three_increasing_weights)
    const all = [...protocolsOf(WAF_2025_SNAPSHOT), ...protocolsOf(ARMLIFTING_USA_2026_SNAPSHOT)];
    const p = all.find((x) => typeof x.attemptPolicy.maxAttempts === 'number')!;
    const max = p.attemptPolicy.maxAttempts as number;
    const many = Array.from({ length: max + 2 }, (_, i) => ({ weightKg: 100 + i, success: true }));
    const r = simulateImplementProtocol(p, many);
    expect(r.status).toBe('invalid');
    expect(r.errors.join(' ')).toMatch(/at most/);
  });

  it('неверифицированный протокол → invalid', () => {
    const p = { ...proto(), verified: false } as ImplementProtocol;
    const r = simulateImplementProtocol(p, [{ weightKg: 100, success: true }]);
    expect(r.status).toBe('invalid');
  });

  it('невалидный вес → invalid с номером попытки', () => {
    const p = proto();
    const r = simulateImplementProtocol(p, [
      { weightKg: 100, success: true },
      { weightKg: -5, success: true },
    ]);
    expect(r.status).toBe('invalid');
    expect(r.errors.join(' ')).toMatch(/Attempt 2/);
  });

  it('three_increasing_weights: нерастущий вес → invalid', () => {
    const p = proto();
    if (p.attemptPolicy.mode !== 'three_increasing_weights') return;
    const r = simulateImplementProtocol(p, [
      { weightKg: 100, success: true },
      { weightKg: 100, success: true },
    ]);
    expect(r.status).toBe('invalid');
  });

  it('лучший результат — максимум среди ПРИНЯТЫХ успешных', () => {
    const p = proto();
    const r = simulateImplementProtocol(p, [
      { weightKg: 80, success: true },
      { weightKg: 120, success: true },
      { weightKg: 90, success: true },
    ]);
    expect(r.bestWeightKg).toBe(120);
  });
});

describe('simulateWafBracket — двойное выбывание', () => {
  const ents = [
    { id: 'a', country: 'RU' }, { id: 'b', country: 'RU' },
    { id: 'c', country: 'US' }, { id: 'd', country: 'US' },
  ];

  it('2 поражения = вылет; победитель определяется только при 1 активном', () => {
    // Раунд 1: a бьёт b, c бьёт d. Раунд 2 (upper): a бьёт c.
    // Нижняя сетка: b выбывает после 2-го поражения, d тоже.
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'a' },
      { round: 1, bracket: 'upper' as const, leftId: 'c', rightId: 'd', winnerId: 'c' },
      { round: 2, bracket: 'lower' as const, leftId: 'b', rightId: 'd', winnerId: 'b' }, // d: 2 поражения → вылет
    ]);
    expect(res.errors).toEqual([]);
    const d = res.standings.find((s) => s.id === 'd')!;
    expect(d.losses).toBe(2);
    expect(d.eliminated).toBe(true);
  });

  it('дубль entrant → invalid', () => {
    const res = simulateWafBracket([{ id: 'a' }, { id: 'a' }], []);
    expect(res.status).toBe('invalid');
    expect(res.errors.join(' ')).toMatch(/Duplicate/);
  });

  it('матч с выбывшим → invalid', () => {
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'a' }, // b:1
      { round: 1, bracket: 'upper' as const, leftId: 'c', rightId: 'd', winnerId: 'c' }, // d:1
      { round: 2, bracket: 'lower' as const, leftId: 'b', rightId: 'd', winnerId: 'b' }, // d:2 → вылет
      { round: 3, bracket: 'lower' as const, leftId: 'd', rightId: 'c', winnerId: 'd' }, // выбывший в матче
    ]);
    expect(res.status).toBe('invalid');
    expect(res.errors.join(' ')).toMatch(/already eliminated/);
  });

  it('матч с одним и тем же участником дважды → invalid', () => {
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'a', winnerId: 'a' },
    ]);
    expect(res.status).toBe('invalid');
    expect(res.errors.join(' ')).toMatch(/same entrant/);
  });

  it('победитель не из пары → invalid', () => {
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'z' },
    ]);
    expect(res.status).toBe('invalid');
    expect(res.errors.join(' ')).toMatch(/winner must be one/);
  });

  it('не-WAF снапшот → invalid (не строим сетку по чужим правилам)', () => {
    const notWaf: any = { rules: { kind: 'armlifting_usa' } };
    const res = simulateWafBracket(ents, [], notWaf);
    expect(res.status).toBe('invalid');
    expect(res.errors.join(' ')).toMatch(/not a WAF/);
  });

  it('пустые entrants → invalid', () => {
    const res = simulateWafBracket([], []);
    expect(res.status).toBe('invalid');
  });

  it('рематч вне place-standing → warning (не ошибка)', () => {
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'a' },
      { round: 2, bracket: 'lower' as const, leftId: 'a', rightId: 'b', winnerId: 'a' },
    ]);
    expect(res.warnings.join(' ')).toMatch(/Rematch/);
  });

  it('одинаковая страна в 1-м раунде → warning', () => {
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'a' },
    ]);
    expect(res.warnings.join(' ')).toMatch(/same-country/);
  });

  it('полный мини-турнир: 1 активный → champion + complete', () => {
    // 4 участника: a бьёт всех; c,b,d набирают по 2 поражения.
    const res = simulateWafBracket(ents, [
      { round: 1, bracket: 'upper' as const, leftId: 'a', rightId: 'b', winnerId: 'a' },
      { round: 1, bracket: 'upper' as const, leftId: 'c', rightId: 'd', winnerId: 'c' },
      { round: 2, bracket: 'upper' as const, leftId: 'a', rightId: 'c', winnerId: 'a' }, // c:1
      { round: 2, bracket: 'lower' as const, leftId: 'b', rightId: 'd', winnerId: 'b' }, // d:2 → вылет
      { round: 3, bracket: 'lower' as const, leftId: 'c', rightId: 'b', winnerId: 'c' }, // b:2 → вылет
      { round: 4, bracket: 'lower' as const, leftId: 'a', rightId: 'c', winnerId: 'c' }, // a:1
      { round: 5, bracket: 'lower' as const, leftId: 'a', rightId: 'c', winnerId: 'a' }, // c:2 → вылет
    ]);
    expect(res.errors).toEqual([]);
    expect(res.standings.find((s) => s.id === 'a')!.losses).toBe(1);
    expect(res.status).toBe('complete');
    expect(res.championId).toBe('a');
    expect(res.eliminated.length).toBe(3);
  });
});
