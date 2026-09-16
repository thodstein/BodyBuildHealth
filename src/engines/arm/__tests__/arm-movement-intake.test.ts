/**
 * arm-movement-intake.test.ts — приёмник движения: чистота + санитизация.
 * Персиста-ключа нет осознанно (write-only слепки не храним):
 * заметки едут в diagSnap.movement, его читает печать.
 */
import { describe, expect, it } from 'vitest';
import { resolveArmMovementIntake } from '../arm-movement-intake.engine';

describe('arm-movement-intake', () => {
  it('пустой мост — тихо (байт-в-байт)', () => {
    expect(resolveArmMovementIntake(null)).toEqual({ hasNotes: false, flashes: [], phaseMode: null, notes: {} });
    expect(resolveArmMovementIntake({})).toEqual({ hasNotes: false, flashes: [], phaseMode: null, notes: {} });
  });

  it('мусор отбрасывается: не-строки и левая фаза', () => {
    const r = resolveArmMovementIntake({
      armMatchPhase: 'mid-table', armStartNote: 42, armVectorNote: '   ',
    } as any);
    expect(r.hasNotes).toBe(false);
    expect(r.flashes).toEqual([]);
    expect(r.notes).toEqual({});
  });

  it('полный пакет — notes + flash-строки', () => {
    const r = resolveArmMovementIntake({
      armMatchPhase: 'mid', armStartNote: 'Реакция 280мс',
      armVectorNote: 'Слабый вектор: бок', armFoulNote: 'Фол-рейт 0.2',
      armTableStrengthNote: 'Слабое звено: пронация', armHumerusDangerNote: 'дожим в проигрыше',
    });
    expect(r.hasNotes).toBe(true);
    expect(r.notes['matchPhase']).toBe('mid');
    expect(r.notes['humerusDangerNote']).toBe('дожим в проигрыше');
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
    expect(r.notes['phaseMode']).toBe('mid (2/4)');
    expect(r.flashes[0]).toContain('мода журнала: mid (2/4)');
  });

  it('невалидные failPhase игнорятся, валидных нет — тихо', () => {
    const r = resolveArmMovementIntake({ armBouts: [{ failPhase: 'nope' }, {}] } as any);
    expect(r.phaseMode).toBeNull();
    expect(r.hasNotes).toBe(false);
  });

  it('длинные строки режутся до 300', () => {
    const r = resolveArmMovementIntake({ armStartNote: 'x'.repeat(500) });
    expect(r.notes['startNote']?.length).toBe(300);
  });
});
