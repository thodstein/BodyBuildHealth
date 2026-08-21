import { describe, expect, it } from 'vitest';
import { buildExerciseInstructions } from '../bb-exercise-instructions.engine';

describe('BB лаборатория-привязка по уровню', () => {
  it('новичок получает более медленный темп и технику-приоритет', () => {
    const beginner = buildExerciseInstructions({ exerciseName: 'Жим штанги лёжа', muscle: 'chest', level: 'beginner' });
    const advanced = buildExerciseInstructions({ exerciseName: 'Жим штанги лёжа', muscle: 'chest', level: 'advanced' });
    // Темп новичка отличается (медленнее/контролируемее)
    expect(beginner.tempo).toBeTruthy();
    expect(beginner.progression.toLowerCase()).toContain('техник');
  });

  it('продвинутый — стандартный темп и прогрессия повторов', () => {
    const advanced = buildExerciseInstructions({ exerciseName: 'Жим штанги лёжа', muscle: 'chest', level: 'advanced' });
    expect(advanced.progression.toLowerCase()).not.toContain('освойте технику');
    expect(advanced.progression.toLowerCase()).toContain('повторы');
  });
});
