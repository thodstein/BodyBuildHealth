import { useState, useMemo } from 'react';
import { EXERCISE_CATALOG, getSubstitutes, canReplace, getExerciseById } from '../../core/exercise-catalog';
import type { Exercise } from '../../core/types';

export type SubstituteOption = { id: string; name: string; reason: string };
export type ForbiddenOption = { id: string; reason: string };

/**
 * useExerciseSubstitution — логика подбора замен для упражнения.
 * Возвращает выбранное упражнение, список допустимых и запретных замен.
 * Чистая, переиспользуемая (используется калькулятором замены и может быть в план-табе).
 */
export function useExerciseSubstitution(initialExId = '') {
  const [exId, setExId] = useState<string>(initialExId);
  const [group, setGroup] = useState<string>('chest');

  const ex: Exercise | undefined = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);

  const subs: SubstituteOption[] = useMemo(() => {
    if (!ex) return [];
    const sub = getSubstitutes(ex.id);
    const opts: SubstituteOption[] = [];
    if (sub) {
      for (const s of sub.substitutes) {
        if (!canReplace(ex.id, s.id)) continue;
        const r = getExerciseById(s.id);
        opts.push({ id: s.id, name: r?.name || s.id, reason: s.reason });
      }
    }
    if (opts.length === 0) {
      EXERCISE_CATALOG
        .filter(c => c.group === ex.group && c.id !== ex.id && canReplace(ex.id, c.id))
        .slice(0, 8)
        .forEach(c => opts.push({ id: c.id, name: c.name, reason: 'Альтернатива той же группы' }));
    }
    return opts;
  }, [ex]);

  const forbidden: ForbiddenOption[] = useMemo(() => {
    if (!ex) return [];
    return getSubstitutes(ex.id)?.forbidden ?? [];
  }, [ex]);

  return { exId, setExId, group, setGroup, ex, subs, forbidden };
}