import React, { useMemo, useState, useEffect } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import type { Exercise } from '../../../core/types';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 11 };

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = {
  all: 'Р’СЃРµ РіСЂСѓРїРїС‹',
  chest: 'Р“СЂСѓРґСЊ',
  back: 'РЎРїРёРЅР°',
  legs: 'РќРѕРіРё',
  shoulders: 'РџР»РµС‡Рё',
  arms: 'Р СѓРєРё',
  core: 'РљРѕСЂ',
};

export const ExerciseCalcTab: React.FC = () => {
  const { profile } = useDataLink();
  const [group, setGroup] = useState<string>('chest');
  const [exId, setExId] = useState<string>('');
  const [oneRM, setOneRM] = useState<number>(0);
  const [goal, setGoal] = useState<string>('strength');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [week, setWeek] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(12);

  // Состояние для отображения списка замен
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [substituteList, setSubstituteList] = useState<Array<{id: string; name: string; reason: string}>>([]);

  // Initialize level, goal, and oneRM from profile when profile changes
  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    const levelVal = lvl === 'enhanced' ? 'advanced' : lvl;
    setLevel(levelVal as 'beginner' | 'intermediate' | 'advanced');
    setGoal(profile?.settings.primaryGoal ?? 'strength');
    // oneRM will be updated when exId changes via another effect
  }, [profile]);

  // Update oneRM when exercise changes (based on profile's strengthBaselines)
  useEffect(() => {
    if (!exId || !profile) { setOneRM(0); return; }
    const baseline = profile?.settings.strengthBaselines?.[exId];
    if (baseline && baseline > 0) {
      setOneRM(baseline);
    } else {
      // fallback to a default value
      setOneRM(100);
    }
  }, [exId, profile]);

  const exList = useMemo(() => group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group), [group]);
  const ex: Exercise | undefined = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);

  const presc = useMemo(() => {
    if (!ex) return null;
    try {
      return calcExercisePrescription(ex, goal, level, false, false, 1, week, totalWeeks);
    } catch {
      return null;
    }
  }, [ex, goal, level, week, totalWeeks]);

  const reps0 = ex && presc ? (parseInt(presc.reps) || 5) : 5;
  const pct = Math.round(100 / (1 + reps0 / 30));
  const workWeight = ex && presc ? +(oneRM * pct / 100).toFixed(1) : 0;

  // Расчёт слабого пункта
  const weakPointAdvice = useMemo(() => {
    if (!ex || !presc) return null;
    const muscle = ex.group;
    const volRef = getVolumeByMuscle(muscle);
    if (!volRef) return null;
    // volRef has properties: beginner, intermediate, advanced each with {mev, mav, mrv, frequency}
    const levelData = (volRef as any)[level];
    if (!levelData) return null;
    const { mev, mav, mrv } = levelData as { mev: number; mav: number; mrv: number; frequency: string };
    const prescribedSets = presc.sets;
    let advice = '';
    if (prescribedSets === 0) {
      advice = `Вы не выполняете подходы для этой группы. Рекомендовано минимум ${mev} подходов (MEV).`;
    } else if (prescribedSets < mev) {
      advice = `Текущий объём ${prescribedSets} подходов ниже MEV (${mev}). Рекомендуется увеличить до ${mev} подходов.`;
    } else if (prescribedSets <= mav) {
      advice = `Объём ${prescribedSets} попадает в оптимальный диапазон [MEV=${mev}, MAV=${mav}].`;
    } else if (prescribedSets <= mrv) {
      advice = `Объём ${prescribedSets} > MAV (${mav}), но ≤ MRV (${mrv}). Рекомендуется снизить до MAV для оптимального роста.`;
    } else {
      advice = `Объём ${prescribedSets} превышает MRV (${mrv}). Высокий риск перетренированности. Рекомендуется снизить до MRV.`;
    }
    return advice;
  }, [ex, presc, level]);

  const handleSubstituteButton = () => {
    if (!ex) {
      alert('Сначала выберите упражнение');
      return;
    }
    const subs = getSubstitutesFor(ex.id);
    if (subs.length === 0) {
      alert('Замены для данного упражнения не найдены');
      return;
    }
    setSubstituteList(subs);
    setShowSubstitutes(true);
  };

  const getSubstitutesFor = (exerciseId: string) => {
    const ex = getExerciseById(exerciseId);
    if (!ex) return [];
    // Filter by equipment if we had user equipment data; for now, we return all
    return getSubstitutes(exerciseId).filter(sub => canReplace(exerciseId, sub.id));
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        рџ“¦ Калькулятор упражнений v2
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Группа мышц</label>
          <PopupSelect
            value={group}
            options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g], desc: '' }))}
            hint="Выберите группу"
            onChange={v => setGroup(v)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Упражнение</label>
          <PopupSelect
            value={exId}
            options={exList.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}`}))}
            hint="Начните вводить для поиска"
            onChange={v => setExId(v)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Цель</label>
          <PopupSelect
            value={goal}
            options={[
              { id: 'strength', label: 'Сила' },
              { id: 'hypertrophy', label: 'Гипертрофия' },
              { id: 'endurance', label: 'Выносливость' },
              { id: 'power', label: 'Взрывная сила' },
            ]}
            hint="Выберите цель"
            onChange={v => setV(v)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Неделя</label>
          <PopupNumber
            value={week}
            min={1}
            max={52}
            step={1}
            onChange={v => setWeek(v)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Всего недель</label>
          <PopupNumber
            value={totalWeeks}
            min={1}
            max={52}
            step={1}
            onChange={v => setTotalWeeks(v)}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM (кг)</label>
          <PopupNumber
            value={oneRM}
            min={0}
            max={500}
            step={0.5}
            onChange={v => setOneRM(v)}
          />
        </div>
      </div>

      {!ex ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Р’С‹Р±РµСЂРёС‚Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РІС‹С€Рµ.</div>
      ) : (
        <>
          <MetricCard title="Предопределённый вес" icon="рџ”ё" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{workWeight}</div>
            <div style={{ ...SMALL }}>кг</div>
          </MetricCard>
          <MetricCard title="Повторения" icon="рџ”ё" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.reps ?? '-'}</div>
            <div style={{ ...SMALL }}>повт</div>
          </MetricCard>
          <MetricCard title="Подходы" icon="рџ”љ" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.sets ?? '-'}</div>
            <div style={{ ...SMALL }}>подходов</div>
          </MetricCard>
          <MetricCard title="RIR" icon="рџ”ё" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rir ?? '-'}</div>
            <div style={{ ...SMALL }}>пунктов</div>
          </MetricCard>
          <MetricCard title="Отдых" icon="рџ”ё" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{presc?.rest ?? '-'}</div>
            <div style={{ ...SMALL }}>сек</div>
          </MetricCard>
          {presc.dropSet && <div style={{ ...SMALL, marginTop: 8 }}>рџ”» Р”СЂРѕРї-СЃРµС‚: {presc.dropSetReps}</div>}
          {presc.backoffSet && <div style={{ ...SMALL }}>в†©пёЏ Р’РєР»СЋС‡РёС‚СЊ backoff‑СЃРµС‚ (РѕР±СЉС‘РјРЅС‹Р№ РґРѕР±РѕСЂРЅС‹Р№ РїРѕРґС…РѕРґ).</div>}

          {/* Блок рекомендаций по замене */}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSubstituteButton} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 600 }}>
              Подобрать замену
            </button>
          </div>

          {/* Отображаем список замен, если нужно */}
          {showSubstitutes && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,230,138,0.08)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 8 }}>Возможные замены:</div>
              {substituteList.map(opt => (
                <div key={opt.id} style={{ marginBottom: 6, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                  <div style={{ fontWeight: 600 }}>{opt.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{opt.reason}</div>
                </div>
              ))}
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <button onClick={() => setShowSubstitutes(false)} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer' }}>
                  Закрыть
                </button>
              </div>
            </div>
          )}

          {/* Блок слабого пункта */}
          {weakPointAdvice && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>Слабый пункт</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{weakPointAdvice}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExerciseCalcTab;
