/**
 * Аудит 2026-11, ядро P3-3 — DUP-волна и снапшот плана.
 *
 * Находка: `dupMode` не был объявлен в `BBBuilderInput` (читался как
 * `(input as any).dupMode`), а накладывался DUP только снаружи — в UI, уже
 * ПОСЛЕ сборки. Поэтому `inputSnapshot.dupMode` оставался пустым, хотя
 * `bb-replan.engine.ts` читает именно его: пересборка остатка мезоцикла теряла
 * выбранную методику (план собирался без DUP и без флага).
 *
 * Правка: (1) поле объявлено типом `DUPMode` (+ `dupMuscles`), (2) сборка
 * накладывает DUP сама — после всех мутирующих проходов и ДО финального снимка,
 * поэтому weeklyVolume/validation/report описывают уже DUP-план, (3) флаг и
 * список мышц попадают в снапшот и передаются replan'ом.
 *
 * Тесты проверяют наблюдаемое: метки `[DUP: …]` на primary вне делод-недель,
 * строку rationale, содержимое снапшота и отказ новичку.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { aggregateBBVolume } from '../bb-volume.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
const WM = { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 };

const makeInput = (overrides: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
  patternId: 'upper_lower_4',
  level: 'intermediate',
  trainingYears: 3,
  goal: 'mass',
  weeks: 8,
  workMax: WM,
  equipment: EQ,
  volumeGoal: 'mav',
  ...overrides,
} as BBBuilderInput);

const dupLabeled = (plan: any) => (plan.weeks || [])
  .filter((w: any) => !w.deload && w.phase !== 'deload')
  .flatMap((w: any) => w.sessions)
  .flatMap((s: any) => s.exercises)
  .filter((e: any) => e.role === 'primary' && /\[DUP:/.test(String(e.comment || '')));

describe('ядро P3-3: DUP накладывает сборка, флаг попадает в снапшот', () => {
  it('dupMode=heavy_light: primary получают метку, снапшот и rationale заполнены', () => {
    const plan: any = buildBBPlan(makeInput({ dupMode: 'heavy_light' }));

    const labeled = dupLabeled(plan);
    expect(labeled.length).toBeGreaterThan(0);

    expect(plan.inputSnapshot?.dupMode).toBe('heavy_light');
    expect(plan.dupMode).toBe('heavy_light');
    expect((plan.rationale || []).some((line: string) => String(line).startsWith('DUP: heavy_light'))).toBe(true);
  });

  it('per-muscle DUP: метки только у указанных мышц, список мышц в снапшоте', () => {
    const plan: any = buildBBPlan(makeInput({ dupMode: 'heavy_light', dupMuscles: ['chest'] }));

    const labeled = dupLabeled(plan);
    expect(labeled.length).toBeGreaterThan(0);
    expect([...new Set(labeled.map((e: any) => e.muscle))]).toEqual(['chest']);
    expect(plan.inputSnapshot?.dupMuscles).toEqual(['chest']);
  });

  it('dupMode=none: меток нет', () => {
    const plan: any = buildBBPlan(makeInput({ dupMode: 'none' }));
    expect(dupLabeled(plan)).toEqual([]);
  });

  it('новичку DUP не накладывается (флаг при этом сохраняется как запрос)', () => {
    const plan: any = buildBBPlan(makeInput({ level: 'beginner', trainingYears: 0, dupMode: 'heavy_light' }));
    expect(dupLabeled(plan)).toEqual([]);
    // Флаг — это запрос пользователя: replan повторит то же решение (тоже пропустит).
    expect(plan.inputSnapshot?.dupMode).toBe('heavy_light');
  });

  it('снимок описывает DUP-план: объём недели совпадает с содержимым плана', () => {
    const plan: any = buildBBPlan(makeInput({ dupMode: 'heavy_light' }));
    const week1 = plan.weeks[0];
    // Снимок снимается ПОСЛЕ наложения DUP — значит он обязан совпадать с
    // фактическим содержимым недели (иначе отчёт и карточки качества описывали
    // бы план до DUP).
    expect(plan.weeklyVolume?.[week1.week]).toEqual(aggregateBBVolume(week1.sessions));
  });
});
