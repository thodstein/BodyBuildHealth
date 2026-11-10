/**
 * bb-ped-m2-generic-path.test.ts (M-2, итерация F)
 *
 * M-2 из аудита: «PED-методика не гарантированно доходит до generic-пути».
 * Проверяем ровно то, что просил аудит, на ОБЫЧНОМ пути (buildBBPlan, без
 * cycle/program-оверлеев):
 *  1) на 12-недельном плане схемы РАЗНЫЕ в accumulation и intensification
 *     (то есть schemeProfile выбирает схему по фазе, а не один раз);
 *     DC здесь включается явно (dcMode + AAS ≥ 750, аудит 2026-11), иначе
 *     фаза intensification не имеет права на 1-сетовый rest-pause.
 *  2) инсулиновое памп-окно появляется ТОЛЬКО когда в стеке есть инсулин
 *     вместе с GH (синергия IGF-1), а не «за компанию» с AAS;
 *  3) GH ≥ 4 МЕ → joint guard честно назван в rationale.
 *
 * Тест не требует новых полей и не меняет движок — он фиксирует текущий
 * контракт, чтобы он не «поплыл» при следующих правках PED-оверлея.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = {
  chest: 110, back: 130, shoulders: 65, quads: 150, hamstrings: 105,
  glutes: 145, biceps: 52, triceps: 62, calves: 85, traps: 75, forearms: 42,
};

const plan = (extra: Record<string, unknown> = {}) => buildBBPlan({
  patternId: 'ppl_6',
  level: 'enhanced',
  trainingYears: 9,
  goal: 'mass',
  sex: 'male',
  weeks: 12,
  workMax: WM,
  ...extra,
} as any) as any;

const exercisesInPhase = (p: any, phase: string) =>
  p.weeks
    .filter((w: any) => String(w.phase || '') === phase && !w.deload && !w.taper)
    .flatMap((w: any) => w.sessions)
    .flatMap((s: any) => s.exercises)
    // тяжёлые базы: там, где схема повторов вообще имеет смысл как «протокол»
    .filter((e: any) => e.character === 'тяж' && e.role === 'primary' && !(e as any).warmupActivator);

const repSignature = (exs: any[]) => {
  const set = new Set<string>();
  for (const e of exs) {
    const rr = e.repsRange;
    if (Array.isArray(rr) && rr.length === 2) set.add(`${rr[0]}-${rr[1]}`);
  }
  return [...set].sort().join(' ');
};

describe('M-2: PED-методика на generic-пути (buildBBPlan)', () => {
  it('12 недель + AAS/GH: схема повторов в accumulation и intensification разная', () => {
    const p = plan({ dcMode: true, peds: ['AAS', 'GH'], pedDoses: { AAS: 1000, GH: 2 }, courseIntensity: 'moderate' });
    const acc = exercisesInPhase(p, 'accumulation');
    const intens = exercisesInPhase(p, 'intensification');
    expect(acc.length, 'нет тяж-базы в accumulation').toBeGreaterThan(0);
    expect(intens.length, 'нет тяж-базы в intensification').toBeGreaterThan(0);
    // Фаза-специфичная схема должна реально отличаться, а не быть одной на план.
    expect(repSignature(intens), `acc=[${repSignature(acc)}] int=[${repSignature(intens)}]`)
      .not.toBe(repSignature(acc));
  });

  it('памп-окно инсулина — только с инсулином в стеке', () => {
    const withoutInsulin = plan({ peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 2 }, courseIntensity: 'moderate' });
    const rationaleNo = withoutInsulin.rationale.join('\n');
    expect(rationaleNo).not.toMatch(/pump window/i);

    const withInsulin = plan({ peds: ['AAS', 'GH', 'insulin'], pedDoses: { AAS: 500, GH: 4, insulin: 10 }, courseIntensity: 'moderate' });
    expect(withInsulin.rationale.join('\n')).toMatch(/pump window/i);
  });

  it('GH ≥ 4 МЕ → joint guard назван в rationale (generic-путь)', () => {
    const p = plan({ peds: ['AAS', 'GH'], pedDoses: { AAS: 500, GH: 4 }, courseIntensity: 'moderate' });
    expect(p.rationale.join('\n')).toMatch(/[Jj]oint[- ]guard/);
  });

  it('пустой стек PED: ни памп-окна, ни joint guard в rationale', () => {
    const plain = plan();
    const r = plain.rationale.join('\n');
    expect(r).not.toMatch(/pump window/i);
    expect(r).not.toMatch(/[Jj]oint[- ]guard/);
  });
});
