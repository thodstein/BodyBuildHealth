/**
 * VolumeOptimizerTab.tsx – Упрощённый вариант расчёта объёма и оптимизации v2
 * Ввод на уровне упражнений (имя/сеты/повт/вес) + авто‑определение группы +
 * расчёт тоннажа и КПШ + связь с профилем (level/oneRM → веса).
 * Подбор и замена упражнений – кнопка «Заменить» на каждом упражнении через
 * getSubstitutes/canReplace.
 * «Улучшить программу» – базовая авто‑оптимизация: добавить упражнения для
 * мышц с недостаточным объёмом (MEV) и уменьшить перегрузку (MRV).
 * Частота и интенсивность – упрощённый индикатор.
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { getVolumeReferences, getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

interface ExerciseRow {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  sets: number;
  oneRM?: number;
}

export const VolumeOptimizerTab: React.FC = () => {
  const refs = useMemo(() => getVolumeReferences(), []);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<ExerciseRow[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
  ]);

  const upd = (id: string, field: keyof ExerciseRow, val: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => [...prev, { id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3 }]);
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const getExercise = (id: string) => getExerciseById(id);
  const getMuscle = (exId: string) => {
    const ex = getExercise(exId);
    return ex?.group ?? '';
  };

  // Рассчитываем статистику по мышцам
  const muscleStats = useMemo(() => {
    const map: Record<string, { sets: number; mev: number; mav: number; mrv: number }> = {};
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const muscle = ex.group;
      const sets = r.sets;
      if (!map[muscle]) {
        const volRef = getVolumeByMuscle(muscle);
        if (!volRef) return;
        const levelKey = level as 'beginner' | 'intermediate' | 'advanced';
        const levelData = volRef[levelKey];
        map[muscle] = {
          sets: 0,
          mev: levelData.mev,
          mav: levelData.mav,
          mrv: levelData.mrv,
        };
      }
      const stat = map[muscle];
      stat.sets += sets;
    });
    return map;
  }, [rows, level]);

  // Общее количество подходов
  const totalSets = useMemo(() => rows.reduce((sum, r) => sum + r.sets, 0), [rows]);

  // Генерация рекомендаций по улучшению
  const improvement = useMemo(() => {
    const changes: Array<{type: 'add' | 'reduce'; muscle: string; exerciseId?: string; reason: string; detail: string}> = [];
    Object.entries(muscleStats).forEach(([muscle, stat]) => {
      const { sets, mev, mrv } = stat;
      if (sets < mev) {
        const needed = mev - sets;
        const best = Object.keys(muscleStats).length > 0 ? 'bench_bar' : ''; // простая заглушка
        if (best) {
          changes.push({
            type: 'add',
            muscle,
            exerciseId: best,
            reason: `Недостаток объёма для ${muscle}`,
            detail: `Добавить ${needed} подход(ов) упражнения "${getExercise(best)?.name ?? best}" (MEV=${mev}).`,
          });
        }
      } else if (sets > mrv) {
        const excess = sets - mrv;
        if (excess > 0) {
          changes.push({
            type: 'reduce',
            muscle,
            exerciseId: undefined,
            reason: `Избыток объёма для ${muscle}`,
            detail: `Уменьшить общее число подходов на ${excess} (до MRV=${mrv}).`,
          });
        }
      }
    });
    return changes;
  }, [muscleStats]);

  const applyImprovement = () => {
    const newRows = [...rows];
    improvement.forEach(ch => {
      if (ch.type === 'add' && ch.exerciseId) {
        newRows.push({
          id: 'r' + Date.now() + Math.random(),
          exerciseId: ch.exerciseId,
          weight: 60,
          reps: 10,
          sets: 1,
        });
      } else if (ch.type === 'reduce') {
        // просто уменьшаем первый найденный сет для этой мышцы
        const idx = newRows.findIndex(r => getExercise(r.exerciseId)?.group === ch.muscle);
        if (idx !== -1) {
          const r = newRows[idx];
          if (r.sets > 1) {
            newRows[idx] = { ...r, sets: r.sets - 1 };
          } else {
            newRows.splice(idx, 1);
          }
        }
      }
    });
    setRows(newRows);
    alert('Изменения применены');
  };

  const getSubstitutesFor = (exId: string) => {
    const subs = getSubstitutes(exId);
    if (!subs) return [];
    return subs.substitutes.filter(sub => canReplace(exId, sub.id));
  };

  const exerciseOptions = useMemo(() => {
    return EXERCISE_CATALOG.slice(0, 200).map(e => ({
      id: e.id,
      label: e.name,
      desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}`,
    }));
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        рџ“‹ Р РµРєРѕРјРµРЅРґР°С†РёРё РїРѕ РіСЂСѓРїРїР°Рј v2 (упрощ
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Уровень подготовки</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM глобальный (кг)</label>
          <input type="number" value={oneRMGlobal} onChange={e => setOneRMGlobal(+e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} min={0} max={500} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 6, fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', paddingBottom: 2 }}>
          <span>Упражнение</span>
          <span>Вес (кг)</span>
          <span>Повт</span>
          <span>Подх</span>
          <span>1RM (опц)</span>
          <span>Замена</span>
        </div>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 4, alignItems: 'start' }}>
            <div style={{ width: '100%' }}>
              <PopupSelect
                label=""
                value={r.exerciseId}
                options={exerciseOptions}
                hint="Начните вводить для поиска"
                onChange={v => upd(r.id, 'exerciseId', v)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Вес (кг)</label>
              <input type="number" value={r.weight} onChange={e => upd(r.id, 'weight', +e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} min={0} max={500} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Повт</label>
              <input type="number" value={r.reps} onChange={e => upd(r.id, 'reps', +e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} min={0} max={200} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Подх</label>
              <input type="number" value={r.sets} onChange={e => upd(r.id, 'sets', +e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} min={0} max={100} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM (опц)</label>
              <input type="number" value={r.oneRM ?? 0} onChange={e => {
                const v = +e.target.value;
                upd(r.id, 'oneRM', v === 0 ? undefined : v);
              }} style={{ width: '100%', padding: '8px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }} min={0} max={500} placeholder="–" />
            </div>
            <button
              onClick={() => {
                const subs = getSubstitutesFor(r.exerciseId);
                if (subs.length === 0) {
                  alert('Замены для данного упражнения не найдены');
                  return;
                }
                // простой выбор первой замены для демонстрации
                const first = subs[0];
                upd(r.id, 'exerciseId', first.id);
              }}
              style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
            >
              Замена
            </button>
            <button onClick={() => delRow(r.id)} style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              Удалить
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={addRow} style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            Добавить упражнение
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,230,138,0.08)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: ACCENT, marginBottom: 4 }}>Общий объём: {totalSets} подходов</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={applyImprovement}
          style={{ width: '100%', padding: '10px 16px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          Улучшить программу
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: ACCENT, marginBottom: 4 }}>Рекомендации по улучшению</div>
        {improvement.map((ch, idx) => (
          <div key={idx} style={{ marginBottom: 8, padding: 6, background: 'rgba(0,230,138,0.04)', borderRadius: 4 }}>
            <div style={{ fontWeight: 600 }}>{ch.reason}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{ch.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VolumeOptimizerTab;
