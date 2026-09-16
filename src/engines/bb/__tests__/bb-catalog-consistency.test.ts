/**
 * Волна 5.1 (план BB-AUTO-EXHAUSTIVE-PRO): гигиена каталога + честная классификация.
 * Lock-тесты на реальные дефекты, найденные аудитом 572 записей:
 *  - «станов» без огласовки ловил «постановка»/«остановками» → «Жим ногами (широкая
 *    постановка)», «Присед с остановками», «Жим с остановками», «Присед сумо (широкая
 *    постановка)» выпадали из quads/chest (derived mp=hinge / null по имени);
 *  - `walk` в имени делал «Ходьба с резиной (monster walks)» переноской → NULL;
 *  - «Выпады шагом (прогулка фермера)» ложно уходили в carry (исправлено имя записи);
 *  - тяга троса между ног (pull-through) была NULL — не попадала в глут-пулы.
 * Соревновательные лифты/переноски остаются NULL — это дизайн (не ББ-упражнения).
 */
import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { derivePattern, isCarryExercise, trueMuscleOf } from '../../movement-pattern';
import { isBBJunk } from '../bb-builder.engine';

const cat = EXERCISE_CATALOG as any[];
const byId = (id: string) => cat.find((e) => e.id === id);

describe('5.1 каталог: гигиена', () => {
  it('нет дублей id; у всех записей movementPattern/substitutionGroup/targetMuscle', () => {
    const ids = cat.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of cat) {
      expect(e.movementPattern, e.id).toBeTruthy();
      expect(e.substitutionGroup, e.id).toBeTruthy();
      expect(e.targetMuscle, e.id).toBeTruthy();
    }
  });

  it('trueMuscleOf покрывает ≥529 записей (43 NULL — соревновательные/переноски, дизайн)', () => {
    const nonNull = cat.filter((e) => trueMuscleOf(e)).length;
    expect(nonNull).toBeGreaterThanOrEqual(529);
    expect(cat.length - nonNull).toBeLessThanOrEqual(43);
  });
});

describe('5.1 каталог: «станов» не ловит «постановка»/«остановками»', () => {
  it('derivePattern: постановка/остановки — НЕ hinge', () => {
    expect(derivePattern({ name: 'Присед с остановками', group: 'legs', type: 'compound' })).toBe('squat');
    expect(derivePattern({ name: 'Присед сумо (широкая постановка)', group: 'legs', type: 'compound' })).toBe('squat');
    expect(derivePattern({ name: 'Жим ногами (широкая постановка)', group: 'legs', type: 'compound' })).toBe('squat');
    expect(derivePattern({ name: 'Жим ногами (высокая постановка)', group: 'legs', type: 'compound' })).toBe('squat');
  });

  it('trueMuscleOf: паузы/постановки — quads/chest, классическая становая — NULL (дизайн)', () => {
    expect(trueMuscleOf({ name: 'Присед с остановками', movementPattern: 'squat' })).toBe('quads');
    expect(trueMuscleOf({ name: 'Жим с остановками', movementPattern: 'horizontal_push' })).toBe('chest');
    expect(trueMuscleOf({ name: 'Присед сумо (широкая постановка)', movementPattern: 'squat' })).toBe('quads');
    expect(trueMuscleOf({ name: 'Становая тяга (классика)', movementPattern: 'hinge' })).toBeNull();
    expect(trueMuscleOf({ name: 'Становая тяга с паузой ниже колен', movementPattern: 'hinge' })).toBeNull();
  });

  it('реальные записи каталога: pl_* паузы и leg_press-постановки классифицированы', () => {
    expect(trueMuscleOf(byId('pl_squat_stop'))).toBe('quads');
    expect(trueMuscleOf(byId('pl_bench_stop'))).toBe('chest');
    expect(byId('leg_press_wide')?.movementPattern).toBe('squat');
    expect(trueMuscleOf(byId('leg_press_wide'))).toBe('quads');
    expect(trueMuscleOf(byId('leg_press_high'))).toBe('quads');
    expect(trueMuscleOf(byId('leg_press_low'))).toBe('quads');
    expect(trueMuscleOf(byId('sumo_squat'))).toBe('quads');
  });
});

describe('5.1 каталог: переноски и ходьбы', () => {
  it('«Ходьба с резиной» — не carry, ягодичная изоляция', () => {
    expect(isCarryExercise({ name: 'Ходьба с резиной (monster walks)' })).toBe(false);
    expect(derivePattern({ name: 'Ходьба с резиной (monster walks)', group: 'legs', type: 'isolation', targetMuscle: 'Ягодицы (средняя)' })).toBe('isolation_glutes');
    expect(trueMuscleOf(byId('band_walks'))).toBe('glutes');
  });

  it('«Выпады шагом» — lunge/quads (имя без «прогулка фермера»)', () => {
    expect(byId('lunge_walking')?.name).toBe('Выпады шагом');
    expect(trueMuscleOf(byId('lunge_walking'))).toBe('quads');
  });

  it('настоящие переноски/плинты остаются carry/NULL (дизайн)', () => {
    expect(isCarryExercise({ name: 'Фермерская прогулка' })).toBe(true);
    expect(trueMuscleOf(byId('farmer_walk'))).toBeNull();
    expect(trueMuscleOf(byId('yoke_walk'))).toBeNull();
    expect(trueMuscleOf(byId('deadlift'))).toBeNull();
  });

  it('derived-правило: отведение/разведение ног — isolation_glutes', () => {
    expect(derivePattern({ name: 'Разведение ног в тренажёре', group: 'legs', type: 'isolation', targetMuscle: 'Ягодицы (средняя)' })).toBe('isolation_glutes');
    expect(derivePattern({ name: 'Приведение бедра в тренажёре', group: 'legs', type: 'isolation', targetMuscle: 'Приводящие' })).toBe('adduction');
  });
});

describe('5.1 каталог: задняя цепь ББ', () => {
  it('pull-through — ББ-упражнение задней цепи (glutes), не соревновательный null', () => {
    expect(trueMuscleOf(byId('cable_pull_through'))).toBe('glutes');
  });

  it('RDL/гудморнинг/гиперэкстензия — hamstrings (дизайн сохранён)', () => {
    expect(trueMuscleOf(byId('rdl'))).toBe('hamstrings');
    expect(trueMuscleOf({ name: 'Гудморнинг', movementPattern: 'hinge' })).toBe('hamstrings');
  });
});

describe('5.1 каталог: дриллы-активации вне ББ-плана (junk), классификация при этом верна', () => {
  it('donkey_kick/fire_hydrant — glutes по классификации, но junk (как bird-dog/планка/monster walks)', () => {
    // Волна 5.1: переклассификация в glutes сделала их кандидатами ББ-пулов,
    // что ломало PPL-гарантию «хам-день — квадры памп 3» (донор-трим уносил выпады).
    // Junk-фильтр держит их вне гипертрофийных пулов (активация, не рабочее движение),
    // загруженный cable_kickback остаётся.
    expect(trueMuscleOf(byId('donkey_kick'))).toBe('glutes');
    expect(trueMuscleOf(byId('fire_hydrant'))).toBe('glutes');
    expect(isBBJunk(byId('donkey_kick'))).toBe(true);
    expect(isBBJunk(byId('fire_hydrant'))).toBe(true);
    expect(isBBJunk(byId('cable_kickback'))).toBe(false);
    expect(isBBJunk({ id: 'bridge_walkout', name: 'Вышагивания в мост' })).toBe(true);
  });
});
