/** TrainingMixTab.tsx — ЕДИНЫЙ калькулятор: тренировочные миксы + пресеты здоровья.
 *  Режимы объединены: выбор цели (тренировка/здоровье) в одном интерфейсе. */
import React, { useState, useEffect, useMemo } from 'react';
import { useDataLink } from '../../../core/data-link';
import {
  buildDefaultStack, calculateMixScore,
  getDefaultTemplate, resolveTemplateItems,
  type MixTemplate,
} from '../../../engines/training-mix-scoring.engine';
import type { MixSubstance, MixProfile, TrainingMixScore } from '../../../engines/training-mix-scoring.engine';
import { loadTrainingProfile } from './training-profile';
import { pushSubsToPlan } from './support-plan-bridge';
import { PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = 'var(--accent)';
const CARD: React.CSSProperties = {
  padding: 10, borderRadius: 14,
  background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
  marginBottom: 10,
};

const GOAL_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'pump', label: 'Памп', emoji: '🩸' },
  { id: 'endurance', label: 'Выносливость', emoji: '🏃' },
  { id: 'strength', label: 'Сила', emoji: '🏋️' },
  { id: 'recovery', label: 'Восстановление', emoji: '🔄' },
  { id: 'focus', label: 'Фокус', emoji: '🧠' },
  { id: 'powerlifting', label: 'ПЛ', emoji: '💪' },
  { id: 'crossfit', label: 'CrossFit', emoji: '🔁' },
  { id: 'hiit', label: 'HIIT', emoji: '💨' },
  { id: 'mma', label: 'MMA', emoji: '🥊' },
  { id: 'sprint', label: 'Спринт', emoji: '🏃' },
  { id: 'fat_loss', label: 'Жиросжигание', emoji: '🔥' },
  { id: 'joint', label: 'Суставы/связки', emoji: '🦵' },
  { id: 'gut', label: 'ЖКТ', emoji: '🫃' },
  { id: 'sleep', label: 'Сон', emoji: '😴' },
  { id: 'hydration', label: 'Гидратация', emoji: '💧' },
  { id: 'antiinflammatory', label: 'Противовоспал', emoji: '🧪' },
  { id: 'immunity', label: 'Иммунитет', emoji: '🛡️' },
];

const WO_TYPE: { id: string; label: string }[] = [
  { id: 'heavy', label: '🏋️ Тяжёлая (присед/тяга)' },
  { id: 'moderate', label: '🏃 Средняя (подсобка)' },
  { id: 'light', label: '🩸 Лёгкая (пампинг)' },
];

const TOD: { id: string; label: string }[] = [
  { id: 'morning', label: '🌅 Утро (6-12)' },
  { id: 'afternoon', label: '☀️ День (12-18)' },
  { id: 'evening', label: '🌙 Вечер (18-24)' },
];

const EXP: { id: string; label: string }[] = [
  { id: 'novice', label: '🌱 Новичок' },
  { id: 'intermediate', label: '📈 Средний' },
  { id: 'advanced', label: '🏆 Опытный' },
];

const DAY_TYPES: { id: string; label: string }[] = [
  { id: 'push', label: '💪 Push (жимы)' },
  { id: 'pull', label: '🔙 Pull (тяги)' },
  { id: 'legs', label: '🦵 Ноги' },
  { id: 'upper', label: '🔼 Верх' },
  { id: 'lower', label: '🔽 Низ' },
  { id: 'fullbody', label: '🔄 Full Body' },
];

const TIMING_RU: Record<string, string> = { pre: 'До тренировки', intra: 'Во время', post: 'После' };
const HEALTH_IDS = new Set(['fat_loss', 'joint', 'gut', 'sleep', 'hydration', 'antiinflammatory', 'immunity']);

const chip = (active: boolean, accent = '#a78bfa'): React.CSSProperties => ({
  padding: '3px 7px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600,
  background: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
  border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
  color: active ? accent : 'rgba(255,255,255,0.7)', transition: 'all 0.15s',
});

const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', minWidth: 100 }}>{label}</span>
    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.5s' }} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{value}</span>
  </div>
);

const PresetItem: React.FC<{ r: { name: string; id: string; dose: string; unit: string; note: string; mg: number } }> = ({ r }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <div>
      <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{r.name}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.note}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>{r.dose}{r.unit}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.mg >= 1000 ? (r.mg / 1000).toFixed(1) + 'г' : r.mg + 'мг'}</div>
    </div>
  </div>
);

export const TrainingMixTab: React.FC = () => {
  const linked = useDataLink();
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [mixGoal, setMixGoal] = useState('pump');
  const [mixTiming, setMixTiming] = useState<'pre' | 'intra' | 'post'>('pre');
  const [mixWorkoutType, setMixWorkoutType] = useState<'heavy' | 'moderate' | 'light'>('moderate');
  const [mixTimeOfDay, setMixTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [mixExperience, setMixExperience] = useState<'novice' | 'intermediate' | 'advanced'>('intermediate');
  const [mixDayType, setMixDayType] = useState<'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullbody'>('fullbody');
  const [mixHistory, setMixHistory] = useState<{ goal: string; timing: string; score: number; label: string; date: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_mixes') || '[]'); } catch { return []; }
  });
  const [mixInsulin, setMixInsulin] = useState<number>(0);
  const [mixDrugIGF, setMixDrugIGF] = useState<number>(0);
  const [mixDrugGH, setMixDrugGH] = useState<number>(0);
  const [mixDrugMGF, setMixDrugMGF] = useState<number>(0);
  const [mixDrugGLP1, setMixDrugGLP1] = useState(false);
  const [bwInput, setBwInput] = useState(prof.bodyWeight || 80);
  const [mult, setMult] = useState(1);
  const [mixPushed, setMixPushed] = useState(false);

  const isHealth = HEALTH_IDS.has(mixGoal);

  // автоопределение фармы
  useEffect(() => {
    const course = linked.course || [];
    const detect = (kw: string) => course.some((c: any) => (c.substanceId || '').toLowerCase().includes(kw.toLowerCase()));
    try {
      const calcData = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
      if ((detect('insulin') || detect('humalog') || detect('novorapid') || detect('lantus') || calcData.pharma?.hasInsulin) && mixInsulin === 0) setMixInsulin(5);
      if ((detect('igf') || detect('igf1') || detect('mecasermin') || calcData.pharma?.hasIGF) && mixDrugIGF === 0) setMixDrugIGF(50);
      if ((detect('hgh') || detect('somatropin') || detect('genotropin') || detect('ghrp') || detect('cjc') || calcData.pharma?.hasGH) && mixDrugGH === 0) setMixDrugGH(5);
      if ((detect('mgf') || detect('mechano') || calcData.pharma?.hasMGF) && mixDrugMGF === 0) setMixDrugMGF(200);
      if ((detect('semaglutide') || detect('tirzepatide') || detect('liraglutide') || detect('dulaglutide') || detect('glp') || calcData.pharma?.hasGLP1) && !mixDrugGLP1) setMixDrugGLP1(true);
      if (calcData.goals?.trainingCycle) {
        const goalMap: Record<string, string> = { mass: 'pump', cut: 'endurance', maintenance: 'recovery', endurance: 'endurance', strength: 'powerlifting' };
        if (goalMap[calcData.goals.trainingCycle] && mixGoal === 'pump') setMixGoal(goalMap[calcData.goals.trainingCycle]);
      }
    } catch { /* ignore */ }
  }, [linked.course, mixGoal, mixInsulin, mixDrugIGF, mixDrugGH, mixDrugMGF, mixDrugGLP1]);

  const bw = linked.profile?.settings?.weight ?? 80;
  const hasCourse = (linked.course || []).length > 0;
  const isOnCycle = hasCourse;
  const multiplier = isOnCycle ? 1.25 : 1.0;
  const avgMin = linked.profile?.settings?.avgWorkoutMinutes ?? 90;
  const durHrs = (mixGoal === 'endurance' ? Math.max(1.5, avgMin / 60) : Math.min(2, avgMin / 60)) || 1.5;

  // тренировочный стек
  const stack = useMemo(() => {
    try { return buildDefaultStack(mixGoal, mixTiming, bw, multiplier, durHrs, mixGoal === 'competition'); }
    catch { return []; }
  }, [mixGoal, mixTiming, bw, multiplier, durHrs]);

  const hasNandrolone = (linked.course || []).some((c: any) => {
    const id = (c.substanceId || '').toLowerCase();
    return id.includes('nandrolon') || id.includes('npp') || id.includes('deca') || id.includes('trest');
  });

  const na = ((linked.labs as any[]) || []).find((l: any) => l.code === 'SODIUM')?.value || 140;
  const kVal = ((linked.labs as any[]) || []).find((l: any) => l.code === 'POTASSIUM')?.value || 4.2;
  const cl = ((linked.labs as any[]) || []).find((l: any) => l.code === 'CHLORIDE')?.value || 102;

  const mixSubstances: MixSubstance[] = useMemo(() =>
    stack.filter(s => s.mg > 0).map(s => ({ id: s.id, name: s.name, doseMg: s.mg })), [stack]);

  const score: TrainingMixScore = useMemo(() => {
    if (mixSubstances.length === 0) return {
      pumpScore: 0, energyScore: 0, focusScore: 0, strengthScore: 0,
      hydrationScore: 0, enduranceScore: 0, anticatabolicScore: 0,
      recoveryScore: 0, proteinScore: 0, glycogenScore: 0,
      noScore: 0, compositeScore: 0, label: 'Нет данных', color: '#6b7280',
      recommendedCarbsG: 0, recommendedEAAG: 0, recommendedWaterMl: 0,
      recommendedNaMg: 0, recommendedKMg: 0, recommendedClMg: 0,
      drugModifiers: [], electrolyteWarnings: [], suggestions: [], substanceBreakdown: [],
    };
    try {
      const aasIds = (linked.course || []).map((c: any) => (c.substanceId || '').toLowerCase()).filter(Boolean);
      const p: MixProfile = {
        goal: mixGoal as any, timing: mixTiming, weightKg: bw, isOnCycle,
        drugs: {
          insulin: mixInsulin > 0, igf: mixDrugIGF > 0, gh: mixDrugGH > 0, mgf: mixDrugMGF > 0, glp1: mixDrugGLP1,
          insulinDose: mixInsulin, insulinTiming: 'post' as const,
          igfDose: mixDrugIGF, igfTiming: 'post' as const,
          ghDose: mixDrugGH, ghTiming: 'pre' as const,
          mgfDose: mixDrugMGF, mgfTiming: 'pre' as const,
        },
        hasNandrolone, userElectrolytes: { sodiumMmolL: na, potassiumMmolL: kVal, chlorideMmolL: cl },
        workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay,
        workoutDurationMin: Math.round(durHrs * 60),
        experience: mixExperience, dayType: mixDayType, aas: aasIds,
      };
      return calculateMixScore(mixSubstances, p);
    } catch {
      return {
        pumpScore: 0, energyScore: 0, focusScore: 0, strengthScore: 0,
        hydrationScore: 0, enduranceScore: 0, anticatabolicScore: 0,
        recoveryScore: 0, proteinScore: 0, glycogenScore: 0,
        noScore: 0, compositeScore: 0, label: 'Ошибка расчёта', color: '#ef4444',
        recommendedCarbsG: 0, recommendedEAAG: 0, recommendedWaterMl: 0,
        recommendedNaMg: 0, recommendedKMg: 0, recommendedClMg: 0,
        drugModifiers: [], electrolyteWarnings: [], suggestions: [], substanceBreakdown: [],
      };
    }
  }, [mixSubstances, mixGoal, mixTiming, bw, isOnCycle, mixInsulin, mixDrugIGF, mixDrugGH, mixDrugMGF, mixDrugGLP1, hasNandrolone, na, kVal, cl, mixWorkoutType, mixTimeOfDay, durHrs, mixExperience, mixDayType, linked.course]);

  // пресет здоровья
  const tpl: MixTemplate | undefined = useMemo(() => getDefaultTemplate(mixGoal), [mixGoal]);
  const phases = useMemo(() => {
    if (!tpl) return null;
    return {
      pre: resolveTemplateItems(tpl.pre, mult, bwInput),
      intra: resolveTemplateItems(tpl.intra, mult, bwInput),
      post: resolveTemplateItems(tpl.post, mult, bwInput),
    };
  }, [tpl, mult, bwInput]);

  const timingLabel = mixTiming === 'pre' ? 'За 30-60 мин до тренировки' : mixTiming === 'intra' ? 'В течение тренировки' : 'Сразу после тренировки';
  const stackTitle = mixTiming === 'pre' ? '🔥 Пред-тренировочный стек' : mixTiming === 'intra' ? '💧 Интра-тренировочный стек' : '🍗 Пост-тренировочный стек';

  return (
    <div style={{ padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: ACCENT }}>💪 Тренировочные миксы</h2>
      <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 12px' }}>
        {isHealth ? 'Готовые пресеты (pre/intra/post) под оздоровительную цель' : 'Подбор пред-/интра-/пост-тренировочных стеков по цели и весу'}
      </p>

      <div style={CARD}>
        <h4 style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text)' }}>⚙️ Параметры</h4>

        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>🎯 Цель</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {GOAL_OPTIONS.map(o => (
            <div key={o.id} onClick={() => setMixGoal(o.id)} style={chip(mixGoal === o.id)}>{o.emoji} {o.label}</div>
          ))}
        </div>



        {!isHealth && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>⏰ Тайминг</div>
              {[
                { id: 'pre', label: '🔥 Пред-тренировочный' },
                { id: 'intra', label: '💧 Интра-тренировочный' },
                { id: 'post', label: '🍗 Пост-тренировочный' },
              ].map(o => (
                <div key={o.id} onClick={() => setMixTiming(o.id as any)} style={{ ...chip(mixTiming === o.id), marginBottom: 3 }}>{o.label}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>🏋️ Тип тренировки</div>
              {WO_TYPE.map(o => (
                <div key={o.id} onClick={() => setMixWorkoutType(o.id as any)} style={{ ...chip(mixWorkoutType === o.id), marginBottom: 3 }}>{o.label}</div>
              ))}
            </div>
          </div>
        )}

        {!isHealth && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>🌅 Время суток</div>
              {TOD.map(o => (
                <div key={o.id} onClick={() => setMixTimeOfDay(o.id as any)} style={{ ...chip(mixTimeOfDay === o.id), marginBottom: 3 }}>{o.label}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>🎓 Опыт</div>
              {EXP.map(o => (
                <div key={o.id} onClick={() => setMixExperience(o.id as any)} style={{ ...chip(mixExperience === o.id), marginBottom: 3 }}>{o.label}</div>
              ))}
            </div>
          </div>
        )}

        {!isHealth && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>📆 Тип дня</div>
              {DAY_TYPES.map(o => (
                <div key={o.id} onClick={() => setMixDayType(o.id as any)} style={{ ...chip(mixDayType === o.id), marginBottom: 3 }}>{o.label}</div>
              ))}
            </div>
          </div>
        )}

        {!isHealth && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
            ⚖️ Вес тела: <b style={{ color: ACCENT }}>{bw} кг</b>
            {isOnCycle ? <span style={{ color: '#a78bfa', marginLeft: 6 }}>🔥 Курс (×1.25)</span> : ''}
          </div>
        )}

        {isHealth && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PopupNumber label="⚖️ Вес тела" value={bwInput} min={30} max={250} suffix=" кг" onChange={setBwInput} />
            <PopupNumber label="Множитель дозы" value={mult} min={0.5} max={2} step={0.1} suffix="×" onChange={setMult} />
          </div>
        )}
      </div>

      {/* ── Фарма (только для тренировки) ── */}
      {!isHealth && (mixInsulin > 0 || mixDrugIGF > 0 || mixDrugGH > 0 || mixDrugMGF > 0 || mixDrugGLP1) && (
        <div style={{ ...CARD, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>💉 Фармакология (автоопределение)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {mixInsulin > 0 && <span style={chip(true)}>💉 Инсулин {mixInsulin}МЕ</span>}
            {mixDrugIGF > 0 && <span style={chip(true)}>🧬 ИГФ-1 {mixDrugIGF}мкг</span>}
            {mixDrugGH > 0 && <span style={chip(true)}>💉 ГР {mixDrugGH}МЕ</span>}
            {mixDrugMGF > 0 && <span style={chip(true)}>🧬 МГФ {mixDrugMGF}мкг</span>}
            {mixDrugGLP1 && <span style={chip(true)}>💊 ГПП-1</span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setMixInsulin(0); setMixDrugIGF(0); setMixDrugGH(0); setMixDrugMGF(0); setMixDrugGLP1(false); }}
              style={{ fontSize: 10, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', padding: 0 }}>✕ Очистить фарму</button>
          </div>
        </div>
      )}

      {/* ── Результат: тренировочный стек ── */}
      {!isHealth && mixSubstances.length > 0 && (
        <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(0,230,138,0.04), rgba(139,92,246,0.04))', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{mixTiming === 'pre' ? '🔥' : mixTiming === 'intra' ? '💧' : '🍗'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{stackTitle}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{timingLabel}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: score.color }}>{score.compositeScore}</div>
              <div style={{ fontSize: 10, color: score.color }}>{score.label}</div>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <ScoreBar label="🩸 Памп" value={score.pumpScore} color="#ec4899" />
            <ScoreBar label="⚡ Энергия" value={score.energyScore} color="#f59e0b" />
            <ScoreBar label="🧠 Фокус" value={score.focusScore} color="#8b5cf6" />
            <ScoreBar label="🏋️ Сила" value={score.strengthScore} color="#ef4444" />
            <ScoreBar label="💧 Гидратация" value={score.hydrationScore} color="#3b82f6" />
            <ScoreBar label="🏃 Выносливость" value={score.enduranceScore} color="#22c55e" />
            <ScoreBar label="🛡️ Анти-катаболизм" value={score.anticatabolicScore} color="#f97316" />
            <ScoreBar label="🔄 Восстановление" value={score.recoveryScore} color="#06b6d4" />
            <ScoreBar label="🥩 Белок" value={score.proteinScore} color="#eab308" />
            <ScoreBar label="🍚 Гликоген" value={score.glycogenScore} color="#a3e635" />
          </div>

          {score.drugModifiers.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {score.drugModifiers.map((dm, i) => (
                <div key={i} style={{ fontSize: 10, color: dm.bonus >= 0 ? '#22c55e' : '#ef4444', marginBottom: 2 }}>
                  • {dm.drug}: {dm.effect} ({dm.bonus >= 0 ? '+' : ''}{dm.bonus}%)
                </div>
              ))}
            </div>
          )}

          {score.suggestions.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>💡 Рекомендации:</div>
              {score.suggestions.slice(0, 5).map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 1 }}>• {s}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => {
              const entry = { goal: mixGoal, timing: mixTiming, score: score.compositeScore, label: score.label, date: new Date().toLocaleDateString('ru-RU') };
              const updated = [entry, ...mixHistory].slice(0, 20);
              setMixHistory(updated);
              localStorage.setItem('he_training_mixes', JSON.stringify(updated));
            }} style={{ flex: 1, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa' }}>💾 Сохранить</button>
            <button onClick={() => {
              const kit = {
                id: Date.now(), type: 'mix',
                goal: mixGoal, timing: mixTiming, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay,
                bw, multiplier, isOnCycle,
                stack: stack.filter(sItem => sItem.mg > 0),
                score: score.compositeScore,
                date: new Date().toISOString(),
              };
              try {
                const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                arr.push(kit);
                localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                alert('✅ Комплект сохранён в Избранное');
              } catch { /* ignore */ }
            }} style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a' }}>💾 Комплект</button>
          </div>
          <button onClick={() => {
            const ids = stack.filter(sItem => sItem.mg > 0 && sItem.id).map(sItem => sItem.id as string);
            const n = pushSubsToPlan(ids, 'mix', `Микс: ${mixGoal} (${mixTiming === 'pre' ? 'пред' : mixTiming === 'intra' ? 'интра' : 'пост'})`);
            if (n > 0) { setMixPushed(true); setTimeout(() => setMixPushed(false), 1800); }
            else alert('Все вещества микса относятся к питанию (белок/креатин/аминокислоты) — в план поддержки не добавлены.');
          }} style={{ marginTop: 6, width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: mixPushed ? 'rgba(0,230,138,0.9)' : 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: mixPushed ? '#0b0b0d' : '#00e68a', transition: 'all 0.2s' }}>
            {mixPushed ? '✓ Добавлено в план поддержки' : '📋 В план поддержки'}
          </button>
        </div>
      )}

      {!isHealth && stack.filter(sItem => sItem.mg > 0).length > 0 && (
        <div style={CARD}>
          <h4 style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text)' }}>📋 Состав стека</h4>
          {stack.filter(sItem => sItem.mg > 0).map((sItem, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 3 }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{sItem.name}</span>
              <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>{sItem.dose} {sItem.unit}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{sItem.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Результат: пресет здоровья ── */}
      {isHealth && tpl && phases && (
        <div style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 4px' }}>{tpl.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>{tpl.description}</div>
          {(['pre', 'intra', 'post'] as const).map(t => {
            const items = phases[t];
            if (!items || items.length === 0) return null;
            return (
              <div key={t} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: '6px 0 4px' }}>⏱️ {TIMING_RU[t]} ({items.length})</div>
                {items.map((r, i) => <PresetItem key={i} r={r} />)}
              </div>
            );
          })}
        </div>
      )}
      {isHealth && !tpl && <div style={CARD}><div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Для этой цели пресета нет.</div></div>}

      {/* ── История (только для тренировки) ── */}
      {!isHealth && mixHistory.length > 0 && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 11, color: 'var(--text)' }}>📂 История ({mixHistory.length})</h4>
            <button onClick={() => { setMixHistory([]); localStorage.setItem('he_training_mixes', '[]'); }}
              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Очистить</button>
          </div>
          {mixHistory.slice(0, 10).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginBottom: 2 }}>
              <span style={{ color: 'var(--text-dim)', minWidth: 65 }}>{h.date}</span>
              <span>{h.timing === 'pre' ? '🔥' : h.timing === 'intra' ? '💧' : '🍗'}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{h.goal}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{h.score}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{h.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingMixTab;
