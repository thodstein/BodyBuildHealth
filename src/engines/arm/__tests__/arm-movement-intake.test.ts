/**
 * arm-movement-intake.test.ts — приёмник движения: чистота + санитизация.
 */
import { describe, expect, it } from 'vitest';
import { resolveArmMovementIntake, ARM_MOVEMENT_KEY } from '../arm-movement-intake.engine';

describe('arm-movement-intake', () => {
  it('пустой мост — null/тихо (байт-в-байт)', () => {
    expect(resolveArmMovementIntake(null)).toEqual({ persist: null, flashes: [], phaseMode: null });
    expect(resolveArmMovementIntake({})).toEqual({ persist: null, flashes: [], phaseMode: null });
  });

  it('мусор отбрасывается: не-строки и левая фаза', () => {
    const r = resolveArmMovementIntake({
      armMatchPhase: 'mid-table', armStartNote: 42, armVectorNote: '   ',
    } as any);
    expect(r.persist).toBeNull();
    expect(r.flashes).toEqual([]);
  });

  it('полный пакет — persist + flash-строка', () => {
    const r = resolveArmMovementIntake({
      armMatchPhase: 'mid', armStartNote: 'Реакция 280мс',
      armVectorNote: 'Слабый вектор: бок', armFoulNote: 'Фол-рейт 0.2',
      armTableStrengthNote: 'Слабое звено: пронация', armHumerusDangerNote: 'дожим в проигрыше',
    });
    expect(r.persist?.key).toBe(ARM_MOVEMENT_KEY);
    expect(r.persist?.value['matchPhase']).toBe('mid');
    expect(r.flashes.length).toBe(2);
    expect(r.flashes[0]).toContain('🥋 Движение схватки');
    expect(r.flashes[1]).toContain('⛔');
  });

  it('мода failPhase из журнала считается', () => {
    const r = resolveArmMovementIntake({
      armBouts: [
        { failPhase: 'mid' }, { failPhase: 'mid' }, { failPhase: 'start' }, { win: true },
      ],
    } as any);
    expect(r.phaseMode).toBe('mid (2/4)');
    expect(r.persist?.value['phaseMode']).toBe('mid (2/4)');
    expect(r.flashes[0]).toContain('мода журнала: mid (2/4)');
  });

  it('невалидные failPhase игнорятся, валидных нет — тихо', () => {
    const r = resolveArmMovementIntake({ armBouts: [{ failPhase: 'nope' }, {}] } as any);
    expect(r.phaseMode).toBeNull();
    expect(r.persist).toBeNull();
  });

  it('длинные строки режутся до 300', () => {
    const r = resolveArmMovementIntake({ armStartNote: 'x'.repeat(500) });
    expect(r.persist?.value['startNote']?.length).toBe(300);
  });
});
