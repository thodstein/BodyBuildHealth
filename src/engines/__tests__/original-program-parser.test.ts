import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ORIGINAL_PROGRAM_FILES } from '../../ui/screens/TrainingScreen_parts/programs-data';
import { parseOriginalProgram } from '../original-program-parser';
import { cloneFromLibrary } from '../user-program/program-store';

describe('original training programs', () => {
  it.each(ORIGINAL_PROGRAM_FILES)('$name is fully structured from the original source', source => {
    const text = readFileSync(resolve(process.cwd(), 'public/original-programs', source.textFile), 'utf8');
    const program = parseOriginalProgram(source, text);
    const exercises = program.weeks.flatMap(week => week.days.flatMap(day => day.exercises));
    expect(program.weeks).toHaveLength(1);
    expect(program.weeks[0].days.length).toBeGreaterThan(0);
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every(exercise => exercise.name && exercise.sets > 0 && exercise.reps)).toBe(true);
    const editable = cloneFromLibrary(program);
    expect(editable.bb?.weeks[0].sessions.length).toBe(program.weeks[0].days.length);
    expect(editable.bb?.weeks[0].sessions.flatMap(session => session.blocks).length).toBe(exercises.length);
  });
});
