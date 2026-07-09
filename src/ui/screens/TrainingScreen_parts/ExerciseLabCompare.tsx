import React, { useMemo, useState, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getTechnique, getCues, getErrorsForExercise, getProgression } from '../../../engines/genetic-deload-technique.engine';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../../engines/movement-engines';
import { forceVector, lengthenedPartials } from '../../../engines/pro/exercise-prescription.engine';
import { getMappedIds } from '../../../data/exercise-id-mapping';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';
import {
  ACCENT, DIM, CARD, SMALL,
  GROUP_RU, TYPE_RU, EQUIP_RU,
  TechniqueDetail, calcTechniqueScore, getResistanceProfile, getRiskColor,
} from './ExerciseLabShared';

const CompareTab: React.FC<{ initialId1: string; initialId2: string }> = ({ initialId1, initialId2 }) => {
  const [id1, setId1] = useState(initialId1);
  const [id2, setId2] = useState(initialId2 || '');
  const { profile } = useDataLink();
  const [goal, setGoal] = useState('hypertrophy');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');

  const ex1 = useMemo(() => EXERCISE_CATALOG.find(e => e.id === id1), [id1]);
  const ex2 = useMemo(() => EXERCISE_CATALOG.find(e => e.id === id2), [id2]);
  const allExs = EXERCISE_CATALOG;

  useEffect(() => {
    if (!profile) return;
    const lvl = profile?.settings.trainingLevel ?? 'intermediate';
    setLevel((lvl === 'enhanced' ? 'advanced' : lvl) as any);
    setGoal((profile?.settings as any)?.training?.primaryGoal ?? 'hypertrophy');
  }, [profile]);

  const getExData = (ex: any) => {
    if (!ex) return null;
    const presc = calcExercisePrescription(ex, goal, level, false, false, 1);
    const map = getMappedIds(ex.id);
    const lookupId = map.bio || map.movement || ex.id;
    const score = calcTechniqueScore(ex);
    const safety = assessSafety(ex.id, [], score.total / 100);
    return {
      exercise: ex, presc, bio: getExerciseBio(lookupId), technique: getTechnique(ex.name),
      score, cues: getCues(ex.name), errors: getErrorsForExercise(ex.name),
      progression: getProgression(ex.name), synergy: getMuscleSynergy(map.synergy || lookupId),
      jointStress: getJointStress(map.joint || lookupId),
      classification: classifyMovement(map.movement || lookupId),
      fVector: forceVector(ex.group, ex.type, ex.name), lengthened: lengthenedPartials(ex.group), safety,
    };
  };

  const d1 = useMemo(() => getExData(ex1), [ex1, goal, level]);
  const d2 = useMemo(() => getExData(ex2), [ex2, goal, level]);

  const renderColumn = (d: any, color: string) => {
    if (!d) return <div style={{ flex: 1, textAlign: 'center', color: DIM, padding: 20 }}>Выберите упражнение</div>;
    const { exercise: ex, presc, score, safety } = d;
    return (
      <div style={{ flex: 1, minWidth: 200, ...CARD, border: `1px solid ${color}33` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6 }}>{ex.name}</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{TYPE_RU[ex.type]} · {EQUIP_RU[ex.equipment]} · {ex.difficulty === 'beginner' ? 'Новичок' : ex.difficulty === 'advanced' ? 'Продвинутый' : 'Средний'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${getRiskColor(score.level)} ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0)` }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{score.total}</div>
          </div>
          <div><div style={{ fontSize: 11, fontWeight: 700 }}>{score.label}</div><div style={{ fontSize: 9, color: DIM }}>технический счёт</div></div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          <div>📐 Сеты: <b>{presc.sets}</b> · Повторы: <b>{presc.reps}</b></div>
          <div>🎯 RIR: <b>{presc.rir}</b> · Отдых: <b>{presc.rest}с</b></div>
          <div>⚡ ЦНС: <b>{d.bio?.cnsDemand || '—'}/5</b> · Суставы: <b>{ex.jointStress === 'high' ? 'высокая' : ex.jointStress === 'med' ? 'средняя' : 'низкая'}</b></div>
          <div>🛡 Безоп.: <b style={{ color: getRiskColor(safety.level) }}>{safety.score}/100</b> · {safety.level === 'safe' ? '✅' : safety.level === 'moderate' ? '⚠️' : '🚫'}</div>
        </div>
        {d1 && d2 && d === d1 && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', fontSize: 9, lineHeight: 1.4 }}>
            {ex1!.type !== ex2!.type && <div>📌 Разные типы: {TYPE_RU[ex1!.type]} vs {TYPE_RU[ex2!.type]} — {ex1!.type === 'compound' ? 'база для общей стимуляции' : 'изоляция для целевой мышцы'}</div>}
            {ex1!.jointStress !== ex2!.jointStress && <div>🦴 Нагрузка на суставы: {ex1!.jointStress} vs {ex2!.jointStress} — {ex1!.jointStress === 'high' ? 'выше у 1-го' : 'выше у 2-го'}</div>}
            {d1.bio?.cnsDemand !== d2.bio?.cnsDemand && <div>🧠 ЦНС-нагрузка: {d1.bio?.cnsDemand} vs {d2.bio?.cnsDemand}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <PopupSelect label="Упражнение A" value={id1} options={allExs.map(e => ({ id: e.id, label: e.name, desc: `${GROUP_RU[e.group] || e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Первое" onChange={v => setId1(v)} />
        <PopupSelect label="Упражнение B" value={id2} options={allExs.map(e => ({ id: e.id, label: e.name, desc: `${GROUP_RU[e.group] || e.group} · ${TYPE_RU[e.type] || e.type}` }))} hint="Второе" onChange={v => setId2(v)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <PopupSelect label="" value={goal} options={[{ id: 'strength', label: 'Сила' }, { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'endurance', label: 'Выносливость' }, { id: 'power', label: 'Взрывная' }]} onChange={v => setGoal(v)} />
        <PopupSelect label="" value={level} options={[{ id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' }]} onChange={v => setLevel(v as any)} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {renderColumn(d1, ACCENT)}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: DIM, fontWeight: 800, padding: '0 6px' }}>vs</div>
        {renderColumn(d2, '#60a5fa')}
      </div>

      {d1 && d2 && (<>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>🔬 Сравнение техники</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ ...CARD, border: `1px solid ${ACCENT}22` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>{ex1!.name}</div>
              <TechniqueDetail ex={ex1!} technique={d1.technique} score={d1.score} cues={d1.cues} errors={d1.errors} progression={d1.progression} synergy={d1.synergy} jointStress={d1.jointStress} classification={d1.classification} fVector={d1.fVector} lengthened={d1.lengthened} safety={d1.safety} bio={d1.bio} cssScale={0.85} />
            </div>
            <div style={{ ...CARD, border: `1px solid #60a5fa22` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>{ex2!.name}</div>
              <TechniqueDetail ex={ex2!} technique={d2.technique} score={d2.score} cues={d2.cues} errors={d2.errors} progression={d2.progression} synergy={d2.synergy} jointStress={d2.jointStress} classification={d2.classification} fVector={d2.fVector} lengthened={d2.lengthened} safety={d2.safety} bio={d2.bio} cssScale={0.85} />
            </div>
          </div>
        </div>

        <div style={{ ...CARD, marginTop: 12, border: `1px solid ${ACCENT}33`, background: 'rgba(0,230,138,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🏆 Итоговая рекомендация</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.12)' }}>
              <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{ex1!.name}</div>
              <div>Тех. счёт: <b>{d1.score.total}/100</b></div><div>Безопасность: <b style={{ color: getRiskColor(d1.safety.level) }}>{d1.safety.score}/100</b></div>
              <div>ЦНС: <b>{d1.bio?.cnsDemand || '?'}/5</b></div><div>Объём: <b>{d1.presc.sets}×{d1.presc.reps}</b></div>
              <div>Профиль: <b>{getResistanceProfile(ex1!).curve.replace('_', ' ')}</b></div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.12)' }}>
              <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>{ex2!.name}</div>
              <div>Тех. счёт: <b>{d2.score.total}/100</b></div><div>Безопасность: <b style={{ color: getRiskColor(d2.safety.level) }}>{d2.safety.score}/100</b></div>
              <div>ЦНС: <b>{d2.bio?.cnsDemand || '?'}/5</b></div><div>Объём: <b>{d2.presc.sets}×{d2.presc.reps}</b></div>
              <div>Профиль: <b>{getResistanceProfile(ex2!).curve.replace('_', ' ')}</b></div>
            </div>
          </div>
          {(() => {
            const rp1 = getResistanceProfile(ex1!);
            const rp2 = getResistanceProfile(ex2!);
            let winner: 1 | 2 = 1; let reason = '';
            if (goal === 'hypertrophy') {
              if (rp1.curve === 'stretch_mediated' && rp2.curve !== 'stretch_mediated') { winner = 1; reason = 'stretch-mediated профиль лучше для гипертрофии'; }
              else if (rp2.curve === 'stretch_mediated' && rp1.curve !== 'stretch_mediated') { winner = 2; reason = 'stretch-mediated профиль лучше для гипертрофии'; }
              else if (rp1.score > rp2.score) { winner = 1; reason = 'выше resistance-оценка'; }
              else if (rp2.score > rp1.score) { winner = 2; reason = 'выше resistance-оценка'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше технический счёт'; }
            } else if (goal === 'strength') {
              if (ex1!.type === 'compound' && ex2!.type !== 'compound') { winner = 1; reason = 'базовое движение для силы'; }
              else if (ex2!.type === 'compound' && ex1!.type !== 'compound') { winner = 2; reason = 'базовое движение для силы'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше технический счёт'; }
            } else {
              if (d1.safety.score > d2.safety.score) { winner = 1; reason = 'безопаснее'; }
              else if (d2.safety.score > d1.safety.score) { winner = 2; reason = 'безопаснее'; }
              else { winner = d1.score.total > d2.score.total ? 1 : 2; reason = 'выше тех. счёт'; }
            }
            const wName = winner === 1 ? ex1!.name : ex2!.name;
            const wColor = winner === 1 ? ACCENT : '#60a5fa';
            return (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: wColor }}>🏅 Рекомендовано: {wName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Причина: {reason}. Цель: {goal === 'hypertrophy' ? 'гипертрофия' : goal}.</div>
              </div>
            );
          })()}
        </div>
      </>)}
    </div>
  );
};

export default CompareTab;
