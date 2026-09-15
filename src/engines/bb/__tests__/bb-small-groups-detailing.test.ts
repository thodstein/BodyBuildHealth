import { describe, it, expect } from 'vitest';
import { ANGLE_CLASSES, STRICT_EXERCISE_GROUPS, strictGroupForExercise } from '../bb-exercise-selection.engine';

describe('bb-small-groups-detailing', () => {
  it('угловые классы предплечий/трапеций/поясницы', () => {
    expect(ANGLE_CLASSES.forearms.length).toBeGreaterThanOrEqual(2);
    expect(ANGLE_CLASSES.traps.length).toBeGreaterThanOrEqual(2);
    expect(ANGLE_CLASSES.lower_back.length).toBeGreaterThanOrEqual(2);
    const flex = ANGLE_CLASSES.forearms.find(c => c.name === 'wrist_flexion');
    expect(flex).toBeTruthy();
    const shrug = ANGLE_CLASSES.traps.find(c => c.name === 'shrug_vertical');
    expect(shrug).toBeTruthy();
    const ext = ANGLE_CLASSES.lower_back.find(c => c.name === 'back_extension');
    expect(ext).toBeTruthy();
  });
  it('строгие группы предплечий/трапеций, кросс запрещён', () => {
    expect(STRICT_EXERCISE_GROUPS.forearms.length).toBe(2);
    expect(STRICT_EXERCISE_GROUPS.traps.length).toBe(2);
    expect(strictGroupForExercise({ id: 'wrist_curl', name: 'Сгибания запястий со штангой' }, 'forearms')?.key).toBe('forearm_flex');
    expect(strictGroupForExercise({ id: 'wrist_curl_reverse', name: 'Разгибания запястий' }, 'forearms')?.key).toBe('forearm_ext');
    expect(strictGroupForExercise({ id: 'shrug_bar', name: 'Шраги со штангой' }, 'traps')?.key).toBe('trap_shrug');
    expect(strictGroupForExercise({ id: 'upright_row', name: 'Тяга к подбородку' }, 'traps')?.key).toBe('trap_upright');
  });
});
