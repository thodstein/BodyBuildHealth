/**
 * arm-pro5-coc-gate.engine.ts — PRO-5 P3 CoC-гейты дня и баланса (чистый модуль).
 *
 * Источник: GripStrength 2026 (grip НЕ в день тяжёлых тяг; deload −40% без
 * максимумов), IronMind (extensor bands 2×10–15 каждую краш-сессию).
 * Всё warnings — valid не трогаем.
 */

export interface CocGateWeek {
  sessions: Array<{
    exercises: Array<{
      muscle: string;
      sets: number;
      substitutionGroup?: string;
      name?: string;
      character?: string;
    }>;
  }>;
}

/** Тяжёлая тяга дня = back_pressure тяж-характера (уже утомлённые предплечья). */
function hasHeavyPull(session: CocGateWeek['sessions'][number]): boolean {
  return session.exercises.some(
    (e) => e.muscle === 'back_pressure' && String(e.character || 'тяж') === 'тяж',
  );
}

function hasHeavyCrush(session: CocGateWeek['sessions'][number]): boolean {
  return session.exercises.some(
    (e) =>
      e.muscle === 'grip_crush' &&
      (String(e.substitutionGroup || '').toLowerCase().includes('crush') ||
        String(e.name || '').toLowerCase().includes('coc') ||
        String(e.name || '').toLowerCase().includes('эспандер')),
  );
}

function hasExtensor(session: CocGateWeek['sessions'][number]): boolean {
  return session.exercises.some(
    (e) =>
      e.muscle === 'wrist_extensors' ||
      e.muscle === 'risers' ||
      String(e.name || '').toLowerCase().includes('expander') ||
      String(e.name || '').toLowerCase().includes('экспандер') ||
      String(e.name || '').toLowerCase().includes('разгибател'),
  );
}

/** Гейты недели: crush не в день тяжёлой тяги + экстензоры после краша. */
export function checkCocGates(week: CocGateWeek, weekNo: number): string[] {
  const out: string[] = [];
  week.sessions.forEach((s, i) => {
    if (hasHeavyPull(s) && hasHeavyCrush(s))
      out.push(
        `Н${weekNo} день ${i + 1}: тяжёлый crush + тяжёлая тяга в один день — разнести (GripStrength: предплечья уже утомлены, риск тендинопатии).`,
      );
    if (hasHeavyCrush(s) && !hasExtensor(s))
      out.push(
        `Н${weekNo} день ${i + 1}: краш без экстензоров — добавить Expand Bands 2×10–15 (IronMind, баланс).`,
      );
  });
  return out;
}
