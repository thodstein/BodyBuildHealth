/**
 * ExerciseCalcTab.tsx – Калькулятор упражнений v2
 * Рассчитывает предписание для выбранного упражнения на основе цели, уровня, недели и т.д.
 * Добавляет:
 *   - Кнопка «Подобрать замену» с подробным списком замен (getSubstitutes + canReplace) и обоснованием.
 *   - Блок «Слабый пункт»: сравнивает предписанный объём (сеты) с рекомендованным диапазоном MEV/MAV/MRV
 *     для мышцы упражнения и выдаёт рекомендацию по увеличению/уменьшению объёма.
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
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
  const [group, setGroup] = useState<string>('chest');
  const [exId, setExId] = useState<string>('');
  const [oneRM, setOneRM] = useState<number>(100);
  const [goal, setGoal] = useState<string>('strength');
  const [level, setLevel] = useState<string>('intermediate');
  const [week, setWeek] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(12);

  // Состояние для отображения списка замен
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [substituteList, setSubstituteList] = useState<Array<{id: string; name: string; reason: string}>>([]);

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

  // Функция получения замен для выбранного упражнения
  const getSubstitutesFor = (exId: string) => {
    const subs = getSubstitutes(exId);
    if (!subs) return [];
    return subs.substitutes.filter(sub => canReplace(exId, sub.id));
  };

  const handleSubstituteButton = () => {
    const subs = getSubstitutesFor(exId);
    if (subs.length === 0) {
      alert('Замены для данного упражнения не найдены');
      return;
    }
    setSubstituteList(
      subs.map(sub => ({
        id: sub.id,
        name: getExerciseById(sub.id)?.name ?? sub.id,
        reason: sub.reason,
      }))
    );
    setShowSubstitutes(true);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        рџ§® РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№
      </div>
      <div style={{ ...SMALL, marginBottom: 10 }}>
        Р’С‹Р±РµСЂРёС‚Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ Рё РІРІРµРґРёС‚Рµ СЃРІРѕР№ 1РџРњ вЂ” СЃРёСЃС‚РµРјР° СЂР°СЃСЃС‡РёС‚Р°РµС‚ РЅР°Р·РЅР°С‡РµРЅРёРµ: РїРѕРґС…РѕРґС‹, РїРѕРІСтРѕСЂРµРЅРёСЏ, %1RM, СЂР°Р±РѕС‡РёР№ РІРµСЃ, RIR Рё РѕС‚РґС‹С….
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupSelect label="Р“СЂСѓРїРїР° РјС‹С€С†" value={group} onChange={setGroup} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g] }))} />
        <PopupSelect label="РЈРїСЂР°Р¶РЅРµРЅРёРµ" value={exId} onChange={setExId} hint="Р’С‹Р±РµСЂРёС‚Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РёР· РєР°С‚Р°Р»РѕРіР°." options={exList.slice(0, 200).map(e => ({ id: e.id, label: e.name, desc: `${e.type === 'compound' ? 'Р‘Р°Р·РѕРІРѕРµ' : 'РР·Рѕ»РёСЂСѓСЋС‰РµРµ'} В· ${e.equipment}` }))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupNumber label="Р’Р°С€ 1РџРњ" value={oneRM} min={5} max={600} suffix=" РєРі" onChange={v => setOneRM(v)} />
        <PopupSelect label="Р¦РµР»СЊ" value={goal} onChange={setGoal} options={[['strength','РЎРёР»Р°'],['mass','Р“РёРїРµСЂС‚СЂРѕС„РёСЏ'],['endurance','Р’С‹РЅРѕСЃР»РёРІРѕСЃС‚СЊ'],['peak','РџРёРє'],['mixed','РЎРјРµС€Р°РЅРЅР°СЏ']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="РЈСЂРѕРІРµРЅСЊ" value={level} onChange={v => setLevel(v)} options={[['beginner','РќРѕРІРёС‡РѕРє'],['intermediate','РЎСЂРµРґРЅРёР№'],['advanced','РџСЂРѕРґРІРёРЅСѓС‚С‹Р№'],['enhanced','Enhanced']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="РќРµРґРµР»СЏ С†РёРєР»Р°" value={week} min={1} max={24} onChange={v => setWeek(v)} />
      </div>

      {ex && presc && (
        <>
          <MetricCard title={`РќР°Р·РЅР°С‡РµРЅРёРµ: ${ex.name}`} icon="рџЋЇ">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>РџРѕРґС…РѕРґС‹ Г— РїРѕРІСтРѕСЂРµРЅРёСЏ</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{presc.sets} Г— {presc.reps}</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Р Р°Р±РѕС‡РёР№ РІРµСЃ ({pct}% 1RM)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{workWeight} РєРі</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>RIR (РїРѕРІСтРѕСЂРµРЅРёСЏ РІ СЂРµР·РµСЂРІРµ)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{presc.rir}</div>
              </div>
              <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>РћС‚РґС‹С… РјРµР¶РґСѓ РїРѕРґС…РѕРґР°РјРё</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>{presc.rest} СЃ</div>
              </div>
            </div>
            {presc.dropSet && <div style={{ ...SMALL, marginTop: 8 }}>рџ”» Р”СЂРѕРї-СЃРµС‚: {presc.dropSetReps}</div>}
            {presc.backoffSet && <div style={{ ...SMALL }}>в†©пёЏ Р’РєР»СЋС‡РёС‚СЊ backoff‑СЃРµС‚ (РѕР±СЉС‘РјРЅС‹Р№ РґРѕР±РѕСЂРЅС‹Р№ РїРѕРґС…РѕРґ).</div>}
          </MetricCard>

          <ExpandableCard title="РљР°Рє СЃС‚СЂРѕРёС‚СЃСЏ РЅР°Р·РЅР°С‡РµРЅРёРµ" icon="рџ“–" short={presc.progressionNote} full={
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
              <div>Р¤Р°Р·Р° РјРµР·РѕС†РёРєР»Р° РґР»СЏ РЅРµРґРµР»Рё {week} РёР· {totalWeeks} РѕРїСЂРµРґРµР»СЏРµС‚ RIR Рё РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ. RIR‑РјР°С‚СЂРёС†Р° СѓС‡РёС‚С‹РІР°РµС‚ С†РµР»СЊ (В«{goal}В») Рё СѓСЂРѕРІРµРЅСЊ (В«{level}В»).</div>
              <div style={{ marginTop: 6 }}>Р Р°Р±РѕС‡РёР№ РІРµСЃ = 1РџРњ Г— %1RM, РіРґРµ %1RM РѕС†РµЅС‘РЅ РїРѕ РїРѕРІСтРѕСЂРµРЅРёСЏРј (в‰€ 100/(1+reps/30)). Р”Р»СЏ С‚РѕС‡РЅРѕРіРѕ %1RM РёСЃРїРѕР»СЊР·СѓР№СтРµ РІРєР»Р°РґРєСѓ В«РљР°Р»СЊРєСѓР»СЏС‚РѕСЂС‹В» в†’ RPEв†”%1RM.</div>
              <div style={{ marginTop: 6 }}>{presc.progressionNote}</div>
            </div>
          } />

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

      {!ex && <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Р’С‹Р±РµСЂРёС‚Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РІС‹С€Рµ.</div>}
    </div>
  );
};

export default ExerciseCalcTab;
