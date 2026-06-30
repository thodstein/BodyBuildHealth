/**
 * TonnageCalcTab.tsx – Калькулятор тоннажа v2
 * Рассчитывает общий тоннаж, тоннаж по мышцам и по зонам интенсивности (%1RM).
 * Позволяет добавлять упражнения из каталога, указывать вес, повторения, подходы.
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById } from '../../../core/exercise-catalog';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };
const SELECT_IN: React.CSSProperties = { ...IN, fontSize: 11 };

interface Row {
  id: string;
  exerciseId: string; // ссылка на EXERCISE_CATALOG
  weight: number; // кг
  reps: number;
  sets: number;
  oneRM?: number; // индивидуальное 1RM, если не указано – используется глобальное
}

export const TonnageCalcTab: React.FC = () => {
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<Row[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
  ]);

  const upd = (id: string, field: keyof Row, val: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => [...prev, { id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3 }]);
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const memo = useMemo(() => {
    let totalTonnage = 0;
    let totalReps = 0; // сумма sets*reps (для среднего веса)
    const tonnageByMuscle: Record<string, number> = {};
    const tonnageByZone = { light: 0, medium: 0, heavy: 0 }; // в кг·повт

    rows.forEach(r => {
      const ex = getExerciseById(r.exerciseId);
      if (!ex) return;
      const oneRM = r.oneRM ?? oneRMGlobal;
      const weight = r.weight;
      const reps = r.reps;
      const sets = r.sets;
      const setVolume = weight * reps * sets; // кг·повт per set group
      totalTonnage += setVolume;
      totalReps += sets * reps;

      // по мышце
      const muscle = ex.group; // упрощенно, можно маппить group->читаемое название
      tonnageByMuscle[muscle] = (tonnageByMuscle[muscle] || 0) + setVolume;

      // по зонам интенсивности
      const percent1RM = oneRM > 0 ? (weight / oneRM) * 100 : 0;
      if (percent1RM < 60) {
        tonnageByZone.light += setVolume;
      } else if (percent1RM <= 80) {
        tonnageByZone.medium += setVolume;
      } else {
        tonnageByZone.heavy += setVolume;
      }
    });

    const avgWeight = totalReps > 0 ? totalTonnage / totalReps : 0;
    const relInt = oneRMGlobal > 0 ? (avgWeight / oneRMGlobal) * 100 : 0;

    return {
      totalTonnage,
      totalReps,
      avgWeight,
      relInt,
      tonnageByMuscle,
      tonnageByZone,
    };
  }, [rows, oneRMGlobal]);

  const totalTonnage = memo.totalTonnage;
  const totalReps = memo.totalReps;
  const avgWeight = memo.avgWeight;
  const relInt = memo.relInt;
  const tonnageByMuscle = memo.tonnageByMuscle;
  const tonnageByZone = memo.tonnageByZone;

  // Подготовка опций для выбора упражнения (ограничим первыми 200)
  const exerciseOptions = EXERCISE_CATALOG.slice(0, 200).map(e => ({
    id: e.id,
    label: e.name,
    desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}`,
  }));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        рџ“¦ Тоннаж калькулятор v2
      </div>

      {/* Ввод 1RM глобального */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM (global)</label>
          <input type="number" value={oneRMGlobal} onChange={e => setOneRMGlobal(+e.target.value)} style={IN} />
        </div>
      </div>

      {/* Таблица упражнений */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 6, fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', paddingBottom: 2 }}>
          <span>Упражнение</span>
          <span>Вес (кг)</span>
          <span>Повт</span>
          <span>Подх</span>
          <span>1RM (опц)</span>
          <span></span>
        </div>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 4, alignItems: 'start' }}>
            <PopupSelect
              label=""
              value={r.exerciseId}
              options={exerciseOptions}
              hint="Начните вводить для поиска"
              onChange={v => upd(r.id, 'exerciseId', v)}
              style={{ width: '100%' }}
            />
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Вес (кг)</label>
              <input type="number" value={r.weight} onChange={e => upd(r.id, 'weight', +e.target.value)} style={IN} min={0} max={500} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Повт</label>
              <input type="number" value={r.reps} onChange={e => upd(r.id, 'reps', +e.target.value)} style={IN} min={0} max={200} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Подх</label>
              <input type="number" value={r.sets} onChange={e => upd(r.id, 'sets', +e.target.value)} style={IN} min={0} max={100} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM (опц)</label>
              <input type="number" value={r.oneRM ?? 0} onChange={e => {
                const v = +e.target.value;
                upd(r.id, 'oneRM', v === 0 ? undefined : v);
              }} style={IN} min={0} max={500} placeholder="–" />
            </div>
            <button onClick={() => delRow(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12, padding: '0 10px' }}>вњ•</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={addRow} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>пј‹ Добавить упражнение</button>
        </div>
      </div>

      {/* Результаты */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center', border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>РњР°Р»СЊРєСѓР»СЏС‚РѕСЂ</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totalTonnage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>кг·повт</div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: 10, textAlign: 'center', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>РЈРћР (%1РџРњ)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{relInt.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>средняя интенсивность</div>
        </div>
      </div>

      {/* По мышцам */}
      {Object.keys(tonnageByMuscle).length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>рџ”§ Тоннаж по мышцам</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {Object.entries(tonnageByMuscle).map(([muscle, tonnage]) => (
              <div key={muscle} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  <span>{muscle}</span>
                  <span>{tonnage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} кг·повт</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* По зонам интенсивности */}
      <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>рџ”§ Тоннаж по зонам интенсивности (%1РџРњ)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[['light', 'Легкая (<60%)', '#22c55e'], ['medium', 'Средняя (60-80%)', '#f59e0b'], ['heavy', 'Тяжёлая (>80%)', '#ef4444']].map(([key, label, color]) => (
          <div key={key} style={{ background: `${color}0f`, border: `1px solid ${color}33`, borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: color }}>{(tonnageByZone[key as keyof typeof tonnageByZone] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} кг·повт</div>
          </div>
        ))}
      </div>

      {/* Кнопка сохранения в план (заглушка) */}
      <div style={{ marginTop: 20 }}>
        <button onClick={() => alert('Сохранено (заглушка)')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12 }}>Сохранить в план тренировки</button>
      </div>
    </div>
  );
};

export default TonnageCalcTab;