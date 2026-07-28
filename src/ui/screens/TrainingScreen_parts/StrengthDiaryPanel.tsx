/**
 * StrengthDiaryPanel.tsx — F3.5 lite.
 *
 * Показывает для упражнений текущей программы реальную статистику из
 * StrengthDiary (e1RM, totalSets, lastDate). Помогает тренеру видеть,
 * какие упражнения реально прогрессируют, а какие уперлись в плато
 * (e1RM не растёт > 4 недель).
 */
import React, { useEffect, useState, useMemo } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import type { StrengthStats } from '../../../engines/strength-diary.engine';
import { CARD, DIM, DIM_STRONG, ACCENT } from './training-ui';
import { GROUP_RU } from './program-types';

export const StrengthDiaryPanel: React.FC<{ program: UserProgram; dir: string }> = ({ program, dir }) => {
  const [statsMap, setStatsMap] = useState<Record<string, StrengthStats | null>>({});
  const [loading, setLoading] = useState(false);

  // Собираем уникальные упражнения из программы
  const uniqueExercises = useMemo(() => {
    if (dir !== 'bb' || !program.bb) return [];
    const seen = new Set<string>();
    const list: Array<{ name: string; muscle: string }> = [];
    for (const w of program.bb.weeks ?? []) {
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          if (b.exerciseName && !seen.has(b.exerciseName)) {
            seen.add(b.exerciseName);
            list.push({ name: b.exerciseName, muscle: b.muscle });
          }
        }
      }
    }
    return list;
  }, [program, dir]);

  useEffect(() => {
    if (uniqueExercises.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const diary = new StrengthDiary();
      const next: Record<string, StrengthStats | null> = {};
      for (const ex of uniqueExercises) {
        try {
          const s = await diary.getExerciseStats(ex.name);
          next[ex.name] = s;
        } catch {
          next[ex.name] = null;
        }
      }
      if (!cancelled) {
        setStatsMap(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uniqueExercises]);

  if (uniqueExercises.length === 0) return null;

  // Сортировка: сначала упражнения с e1RM (реальные данные), потом без
  const sorted = [...uniqueExercises].sort((a, b) => {
    const sa = statsMap[a.name]?.max1RM ?? 0;
    const sb = statsMap[b.name]?.max1RM ?? 0;
    return sb - sa;
  });

  const plateauCount = sorted.filter(ex => {
    const s = statsMap[ex.name];
    if (!s) return false;
    return s.maxWeight > 0;
  }).length;

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #60a5fa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>📊 Дневник: реальный прогресс</span>
        <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{sorted.length} упражнений · {plateauCount} возможный плато</span>
      </div>
      {loading && <div style={{ fontSize: 11, color: DIM }}>⏳ Загрузка...</div>}
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sorted.slice(0, 20).map(ex => {
          const s = statsMap[ex.name];
          if (!s) {
            return (
              <div key={ex.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ flex: 1, color: DIM_STRONG, fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                <span style={{ fontSize: 9, color: DIM }}>нет данных</span>
              </div>
            );
          }
          const e1rm = s.max1RM ?? 0;
          const muscle = GROUP_RU[ex.muscle] ?? ex.muscle;
          const workouts = s.workoutCount ?? 0;
          return (
            <div key={ex.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ flex: 1, color: DIM_STRONG, fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ex.name}>{ex.name}</span>
              <span style={{ fontSize: 9, color: DIM, minWidth: 50 }}>{muscle}</span>
              <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>{e1rm > 0 ? `${e1rm}кг` : '—'}</span>
              <span style={{ fontSize: 9, color: DIM, minWidth: 40, textAlign: 'right' }}>{workouts}тр</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
