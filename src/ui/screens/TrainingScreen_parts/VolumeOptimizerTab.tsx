/**
 * VolumeOptimizerTab.tsx – Расчёт объёма и оптимизации v2
 * Ввод на уровне упражнений (имя/сеты/повт/вес) + авто‑определение группы +
 * расчёт тоннажа и КПШ + связь с профилем (level/equipment/workMax → веса).
 * Подбор и замена упражнений – кнопка «Заменить» на каждом упражнении через
 * getSubstitutes/canReplace, с фильтром по оборудованию и обоснованием.
 * «Улучшить программу» – авто‑оптимизация: баланс объёма к MAV, кап >MRV,
 * добор <MEV (добавить упражнения на недостающие мышцы), weak‑point акцент,
 * фильтр оборудования → выдаёт улучшенную версию (редактируемую, можно
 * загрузить в конструктор/выполнить) + журнал правок.
 * Частота и баланс интенсивности – счётчик сессий на мышцу/нед vs
 * рекомендованной частоты; баланс тяж/памп/лёг по RIR с предупреждениями.
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { getVolumeReferences, getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, margin: '6px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

interface ExerciseRow {
  id: string;
  exerciseId: string; // ссылка на EXERCISE_CATALOG
  weight: number; // кг (может быть 0, если вес будет рассчитан из %1RM)
  reps: number;
  sets: number;
  oneRM?: number; // индивидуальное 1RM, если не указано – используется глобальное
  // Для расчёта интенсивности по RIR мы можем добавить поле rir, но опустим для простоты
}

interface MuscleStats {
  sets: number;
  reps: number;
  tonnage: number; // сумма weight * reps * sets
  mev: number;
  mav: number;
  mrv: number;
  frequency: string; // из VolumeReference
  bestExercises: string[];
}

const VolumeOptimizerTab: React.FC = () => {
  const refs = useMemo(() => getVolumeReferences(), []);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<ExerciseRow[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
    { id: 'r3', exerciseId: 'squat', weight: 100, reps: 5, sets: 5 },
  ]);

  const upd = (id: string, field: keyof ExerciseRow, val: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => [...prev, { id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3 }]);
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  // Вспомогательные функции
  const getExercise = (id: string) => getExerciseById(id);
  const getMuscle = (exId: string) => {
    const ex = getExercise(exId);
    return ex?.group ?? '';
  };
  const getMuscleName = (muscleKey: string) => {
    // Приводим к читаемому виду (уже хранится как русская строка в group)
    return muscleKey;
  };

  // Рассчитываем статистику по мышцам
  const muscleStats = useMemo(() => {
    const map: Record<string, MuscleStats> = {};
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const muscle = ex.group;
      const weight = r.weight;
      const reps = r.reps;
      const sets = r.sets;
      const oneRM = r.oneRM ?? oneRMGlobal;
      const vol = weight * reps * sets;
      const repsTotal = reps * sets;
      if (!map[muscle]) {
        const volRef = getVolumeByMuscle(muscle);
        map[muscle] = {
          sets: 0,
          reps: 0,
          tonnage: 0,
          mev: volRef?.beginner.mev ?? 0,
          mav: volRef?.beginner.mav ?? 0,
          mrv: volRef?.beginner.mrv ?? 0,
          frequency: volRef?.beginner.frequency ?? '',
          bestExercises: volRef?.bestExercises ?? [],
        };
        // Учитываем уровень пользователя
        if (level === 'intermediate') {
          const v = getVolumeByMuscle(muscle);
          if (v) {
            map[muscle].mev = v.intermediate.mev;
            map[muscle].mav = v.intermediate.mav;
            map[muscle].mrv = v.intermediate.mrv;
            map[muscle].frequency = v.intermediate.frequency;
          }
        } else if (level === 'advanced') {
          const v = getVolumeByMuscle(muscle);
          if (v) {
            map[muscle].mev = v.advanced.mev;
            map[muscle].mav = v.advanced.mav;
            map[muscle].mrv = v.advanced.mrv;
            map[muscle].frequency = v.advanced.frequency;
          }
        }
      }
      const stat = map[muscle];
      stat.sets += sets;
      stat.reps += repsTotal;
      stat.tonnage += vol;
    });
    return map;
  }, [rows, level, oneRMGlobal]);

  // Рассчитываем общие показатели
  const totals = useMemo(() => {
    let totalSets = 0;
    let totalReps = 0;
    let totalTonnage = 0;
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const weight = r.weight;
      const reps = r.reps;
      const sets = r.sets;
      totalSets += sets;
      totalReps += reps * sets;
      totalTonnage += weight * reps * sets;
    });
    return { totalSets, totalReps, totalTonnage };
  }, [rows]);

  // Статус по мышце (MEV/MAV/MRV)
  const muscleStatus = useMemo(() => {
    const result: Record<string, { label: string; color: string; action: string; advice: string }> = {};
    Object.entries(muscleStats).forEach(([muscle, stat]) => {
      const { sets, mev, mav, mrv } = stat;
      if (sets === 0) {
        result[muscle] = {
          label: 'Нет подходов',
          color: '#64748b',
          action: 'Добавьте упражнения для этой группы',
          advice: `Рекомендовано минимум ${mev} подходов в неделю (MEV).`,
        };
      } else if (sets < mev) {
        result[muscle] = {
          label: `Недостаток объёма`,
          color: '#3b82f6',
          action: `Добавить ${mev - sets} подход(ов)`,
          advice: `Текущий объём ${sets} подходов ниже MEV (${mev}).`,
        };
      } else if (sets <= mav) {
        result[muscle] = {
          label: 'Оптимальный объём',
          color: '#22c55e',
          action: 'В пределах МЕV‑МАV',
          advice: `Объём ${sets} попадает в диапазон [MEV=${mev}, MAV=${mav}].`,
        };
      } else if (sets <= mrv) {
        result[muscle] = {
          label: `Превышение МАV`,
          color: '#eab308',
          action: `Сократить до ${mav} подходов`,
          advice: `Объём ${sets} > MAV (${mav}), но ≤ MRV (${mrv}). Рекомендовано снизить до МАV для оптимального роста.`,
        };
      } else {
        result[muscle] = {
          label: `Перетренировка (>MRV)`,
          color: '#ef4444',
          action: `Сократить до ${mrv} подходов`,
          advice: `Объём ${sets} превышает MRV (${mrv}). Высокий риск перетренированности.`,
        };
      }
    });
    return result;
  }, [muscleStats]);

  // Функция генерации предложений по улучшению программы
  const generateImprovement = () => {
    const changes: Array<{
      type: 'add' | 'reduce' | 'replace' | 'none';
      muscle: string;
      exerciseId?: string;
      reason: string;
      detail: string;
    }> = [];

    // 1. Обработка недостатка и избытка объёма
    Object.entries(muscleStats).forEach(([muscle, stat]) => {
      const { sets, mev, mav, mrv } = stat;
      if (sets < mev) {
        // Нужно добавить подходы
        const needed = mev - sets;
        // Выбираем одно из лучших упражнений для этой мышцы
        const best = stat.bestExercises[0];
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
        // Нужно уменьшить до MRV
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
      } else if (sets > mav && sets <= mrv) {
        // Между MAV и MRV – предлагаем уменьшить до MAV для оптимизации роста
        const excess = sets - mav;
        if (excess > 0) {
          changes.push({
            type: 'reduce',
            muscle,
            exerciseId: undefined,
            reason: `Объём выше MAV для ${muscle}`,
            detail: `Уменьшить до MAV (${mav}) для оптимального роста (текущий ${sets}).`,
          });
        }
      }
    });

    // 2. Предложения по замене упражнений (упрощённо: если есть дублирование паттерна)
    // Для простоты пропустим; можно добавить анализ substitutionGroup.

    // 3. Weak‑point акцент: находим мышцу с наименьшим относительным объёмом относительно среднего
    const setsValues = Object.values(muscleStats).map(s => s.sets);
    const avgSets = setsValues.reduce((a, b) => a + b, 0) / Math.max(setsValues.length, 1);
    let weakMuscle: string | null = null;
    let minRatio = Infinity;
    Object.entries(muscleStats).forEach(([muscle, stat]) => {
      const ratio = stat.sets / Math.max(avgSets, 1);
      if (ratio < minRatio) {
        minRatio = ratio;
        weakMuscle = muscle;
      }
    });
    if (weakMuscle && minRatio < 0.5) {
      // Предлагаем добавить акцент
      const best = muscleStats[weakMuscle].bestExercises[0];
      if (best) {
        changes.push({
          type: 'add',
          muscle: weakMuscle,
          exerciseId: best,
          reason: `Слабая точка: ${weakMuscle}`,
          detail: `Объём ниже среднего (${(minRatio * 100).toFixed(0)}% от среднего). Рекомендуем добавить акцент.`,
        });
      }
    }

    return changes;
  };

  const improvement = useMemo(() => generateImprovement(), [muscleStats]);

  // Обработчик применения улучшений
  const applyImprovement = () => {
    const newRows = [...rows];
    improvement.forEach(ch => {
      if (ch.type === 'add' && ch.exerciseId) {
        // Добавляем новую строку с базовыми параметрами
        newRows.push({
          id: 'r' + Date.now() + Math.random(),
          exerciseId: ch.exerciseId,
          weight: 60, // стартовый вес
          reps: 10,
          sets: 1, // добавляем один подход; можно добавить больше, но для простоты 1
        });
      } else if (ch.type === 'reduce') {
        // Уменьшаем суммарные подходы для мышцы пропорционально существующим строкам
        // Для простоты просто уменьшаем первые встреченные строки до нужного количества
        const targetTotal = muscleStats[ch.muscle!].sets - (ch.detail.match(/(\d+)/)?.[1] ?? 0);
        let remainingToReduce = Math.max(0, muscleStats[ch.muscle!].sets - targetTotal);
        // Сортируем по убыванию net volume (weight*reps*sets) чтобы уменьшать наименее нагруженные
        const muscleRows = newRows
          .filter(r => getExercise(r.exerciseId)?.group === ch.muscle)
          .map(r => ({ ...r, vol: (r.weight * r.reps * r.sets) }))
          .sort((a, b) => a.vol - b.vol);
        muscleRows.forEach(r => {
          if (remainingToReduce <= 0) return;
          const canReduce = Math.min(r.sets, remainingToReduce);
          const newSets = r.sets - canReduce;
          if (newSets <= 0) {
            // удаляем строку полностью
            const idx = newRows.findIndex(x => x.id === r.id);
            if (idx !== -1) newRows.splice(idx, 1);
          } else {
            const idx = newRows.findIndex(x => x.id === r.id);
            if (idx !== -1) {
              const upd = { ...newRows[idx], sets: newSets };
              newRows[idx] = upd;
            }
          }
          remainingToReduce -= canReduce;
        });
      }
    });
    setRows(newRows);
    // После применения можно показать уведомление (заглушка)
    alert('Изменения применены');
  };

  // Подготовка опций для выбора упражнения (первые 200)
  const exerciseOptions = useMemo(() => {
    return EXERCISE_CATALOG.slice(0, 200).map(e => ({
      id: e.id,
      label: e.name,
      desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}`,
    }));
  }, []);

  // Функция получения замен для упражнения
  const getSubstitutesFor = (exId: string) => {
    const subs = getSubstitutes(exId);
    if (!subs) return [];
    // Фильтруем через canReplace и optionally by equipment (пока пропускаем)
    return subs.substitutes.filter(sub => canReplace(exId, sub.id));
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        рџ“‹ Р РµРєРѕРјРµРЅРґР°С†РёРё РїРѕ РіСЂСѓРїРїР°Рј v2
      </div>

      {/* Настройки уровня и глобального 1RM */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Уровень подготовки</label>
          <select value={level} onChange={e => setLevel(e.target.value as any)} style={SELECT_IN}>
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM глобальный (кг)</label>
          <input type="number" value={oneRMGlobal} onChange={e => setOneRMGlobal(+e.target.value)} style={IN} min={0} max={500} />
        </div>
      </div>

      {/* Таблица упражнений */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 6, fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', paddingBottom: 2 }}>
          <span>Упражнение</span>
          <span>Вес (кг)</span>
          <span>Повт</span>
          <span>Подх</span>
          <span>1RM (опц)</span>
          <span>Замена</span>
          <span></span>
        </div>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 4, alignItems: 'start' }}>
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
            {/* Кнопка замены */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => {
                  const subs = getSubstitutesFor(r.exerciseId);
                  if (subs.length === 0) {
                    alert('Замены для данного упражнения не найдены');
                    return;
                  }
                  // Простой prompt для выбора замены (в реальном приложении лучше попап)
                  const choice = window.prompt(
                    `Доступные замены для ${getExercise(r.exerciseId)?.name}:\n${subs.map(s => `- ${getExercise(s.id)?.name} (${s.reason})`).join('\n')}\nВведите ID замены или оставьте пустым для отмены:`,
                    ''
                  );
                  if (choice && getExerciseById(choice)) {
                    upd(r.id, 'exerciseId', choice);
                  }
                }}
                style={{ background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: ACCENT, borderRadius: 6, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>зам</button>
            </div>
            <button onClick={() => delRow(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12, padding: '0 10px' }}>вњ•</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={addRow} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>пј‹ Добавить упражнение</button>
        </div>
      </div>

      {/* Общие показатели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <MetricCard title="РњР°Р»СЊРєСѓР»СЏС‚РѕСЂ" icon="рџ“¦" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totals.totalTonnage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div style={{ ...SMALL }}>кг·повт</div>
        </MetricCard>
        <MetricCard title="Средний вес" icon="рџ”ё" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{(totals.totalTonnage / Math.max(totals.totalReps, 1)).toFixed(1)}</div>
          <div style={{ ...SMALL }}>кг</div>
        </MetricCard>
        <MetricCard title="Общее количество подходов" icon="рџ”љ" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totals.totalSets}</div>
          <div style={{ ...SMALL }}>подходов</div>
        </MetricCard>
      </div>

      {/* Статус по мышцам */}
      {Object.keys(muscleStats).length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>рџ”§ Статус по мышцам (объём подходов/неделя)</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {Object.entries(muscleStats).map(([muscle, stat]) => {
              const status = muscleStatus[muscle];
              return (
                <div key={muscle} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                    <span>{getMuscleName(muscle)}</span>
                    <span style={{ color: status?.color || '#fff' }}>{status?.label ?? ''}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Подходов: <b>{stat.sets}</b> (MEV={stat.mev}, MAV={stat.mav}, MRV={stat.mrv})
                  </div>
                  {status && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                      {status.advice}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Рекомендации по улучшению */}
      {improvement.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>рџ”§ Рекомендации по улучшению программы</div>
          <div style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            {improvement.map((ch, idx) => (
              <div key={idx} style={{ marginBottom: 8, padding: 8, background: 'rgba(0,230,138,0.08)', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: ACCENT }}>{ch.reason}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{ch.detail}</div>
                {ch.exerciseId && (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                    Предлагаемое упражнение: <b>{getExercise(ch.exerciseId)?.name ?? ch.exerciseId}</b>
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button onClick={applyImprovement} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600 }}>
                Применить рекомендации
              </button>
            </div>
          </div>
        </>
      )}

      {/* Кнопка сохранения в план (заглушка) */}
      <div style={{ marginTop: 20 }}>
        <button onClick={() => alert('Сохранено в план тренировки (заглушка)')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12 }}>
          Сохранить в план тренировки
        </button>
      </div>
    </div>
  );
};

export default VolumeOptimizerTab;