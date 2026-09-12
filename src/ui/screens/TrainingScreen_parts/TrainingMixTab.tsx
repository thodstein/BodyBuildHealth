/** TrainingMixTab.tsx — ЕДИНЫЙ калькулятор: тренировочные миксы + пресеты здоровья.
 *  Режимы объединены: выбор цели (тренировка/здоровье) в одном интерфейсе. */
import React, { useState, useEffect, useMemo } from 'react';
import { useDataLink } from '../../../core/data-link';
import {
  buildDefaultStack, calculateMixScore, buildBestRecipe,
} from '../../../engines/training-mix-scoring.engine';
import type { MixSubstance, MixProfile, TrainingMixScore } from '../../../engines/training-mix-scoring.engine';
import { mixSafetyGates } from '../../../engines/mix-safety-gates.engine';
import { isUnderdosed, evidenceFor } from '../../../engines/mix-evidence-doses.engine';
import { loadTrainingProfile } from './training-profile';
import { pushSubsToPlan } from './support-plan-bridge';
import {
  saveMixToDiaryAndFavorites, queueMixToSupportPlan, readDiaryMixes,
  type SaveMixResult, type PlanSubstance,
} from '../../../engines/training-plan-save.engine';

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
  { id: 'competition', label: 'Соревнования', emoji: '🏆' },
  { id: 'post_comp', label: 'Пост-соревн.', emoji: '🔄' },
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

const chip = (active: boolean, accent = '#a78bfa'): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  background: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
  border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
  color: active ? accent : '#fff', transition: 'all 0.15s',
});

/** П9: доступный чип-селектор (кнопка + клавиатура + aria-pressed). */
const MixChip: React.FC<{ active: boolean; label: string; onSelect: () => void; accent?: string; style?: React.CSSProperties }> = ({ active, label, onSelect, accent, style }) => (
  <button
    type="button"
    role="option"
    aria-selected={active}
    aria-pressed={active}
    aria-label={label}
    onClick={onSelect}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    style={{ ...chip(active, accent), fontFamily: 'inherit', textAlign: 'left', minHeight: 44, ...(style || {}) }}
  >{label}</button>
);

const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: 12, color: '#fff', minWidth: 100 }}>{label}</span>
    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.5s' }} />
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{value}</span>
  </div>
);

/** Всплывающее окно «Куда сохранено»: подтверждение перед сохранением + итог после. */
const SaveResultPopup: React.FC<{
  popup: { step: 'confirm' | 'done'; toPlan: boolean; result: SaveMixResult | null };
  count: number;
  onToPlanChange: (v: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ popup, count, onToPlanChange, onConfirm, onClose }) => {
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 };
  const box: React.CSSProperties = { maxWidth: 420, width: '100%', background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' };
  const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#fff', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const btn = (bg: string, color: string, flex = true): React.CSSProperties => ({
    flex: flex ? 1 : undefined, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: bg, color, minHeight: 44,
  });
  const res = popup.result;
  const favCount = res ? res.addedFavCount : null;
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && popup.step === 'done') onClose(); }}>
      <div style={box}>
        {popup.step === 'confirm' ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 10 }}>💾 Сохранение микса</div>
            <div style={row}><span>📓</span><span><b>Дневник тренировок</b> — запись «Микс: {count} веществ» с составом и дозами.</span></div>
            <div style={row}><span>⭐</span><span><b>Избранное БАД</b> — добавятся вещества набора (без дублей).</span></div>
            <div style={row}><span>💊</span><span><b>Рекомендации</b> — анализ препаратов: дозы, предупреждения, мониторинг, конфликты. Сохранятся в избранном БАД.</span></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '10px 0', padding: 10, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', cursor: 'pointer', fontSize: 12, color: '#fff' }}>
              <input type="checkbox" checked={popup.toPlan} onChange={e => onToPlanChange(e.target.checked)} style={{ marginTop: 2 }} />
              <span>🧮 <b>Внести в план поддержки</b> — вещества попадут в калькулятор поддержки: расчёт рисков, дозировок и карточка «Тренировочные миксы и пресеты здоровья».</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={btn('rgba(255,255,255,0.08)', '#fff', true)}>Отмена</button>
              <button onClick={onConfirm} style={btn('linear-gradient(135deg,#00e68a,#00c853)', '#000', true)}>Сохранить</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginBottom: 10 }}>✅ Сохранено</div>
            {res ? (
              <>
                <div style={row}><span>📓</span><span>Запись добавлена в <b>дневник тренировок</b> ({count} веществ).</span></div>
                <div style={row}><span>⭐</span><span>В <b>избранное БАД</b> добавлено{favCount != null && favCount > 0 ? ` новых веществ: +${favCount}` : ' новых веществ: 0 (уже в избранном)'}.</span></div>
                <div style={row}><span>💊</span><span><b>Рекомендации сохранены</b>: {res.rec.substances.length} препаратов проанализировано{res.rec.interactions.length > 0 ? `, конфликтов в наборе: ${res.rec.interactions.length}` : ''}.</span></div>
                {popup.toPlan && <div style={row}><span>🧮</span><span>Внесено в <b>план поддержки</b> — появится в карточке калькулятора «Тренировочные миксы и пресеты здоровья».</span></div>}
              </>
            ) : (
              <div style={row}><span>🎯</span><span><b>Комплект сохранён в Избранное</b> — вкладка «🎯 Миксы» блока БАД.</span></div>
            )}
            <div style={{ marginTop: 12 }}>
              <button onClick={onClose} style={{ width: '100%', ...btn('linear-gradient(135deg,#00e68a,#00c853)', '#000') }}>Готово</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const TrainingMixTab: React.FC = () => {
  const linked = useDataLink();
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [mixGoal, setMixGoal] = useState(() => {
    try { return (JSON.parse(localStorage.getItem('he_mix_hub_v1') || '{}').mixGoal) || 'pump'; } catch { return 'pump'; }
  });
  const [mixTiming, setMixTiming] = useState<'pre' | 'intra' | 'post'>(() => {
    try {
      const t = JSON.parse(localStorage.getItem('he_mix_hub_v1') || '{}').mixTiming;
      return t === 'intra' || t === 'post' || t === 'pre' ? t : 'pre';
    } catch { return 'pre'; }
  });
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
  const [mixPushed, setMixPushed] = useState(false);
  const [savePopup, setSavePopup] = useState<{ step: 'confirm' | 'done'; toPlan: boolean; result: SaveMixResult | null } | null>(null);

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
  // Дозы только по весу/эталону — авто-наценок нет.
  const avgMin = linked.profile?.settings?.avgWorkoutMinutes ?? 90;
  const durHrs = (mixGoal === 'endurance' ? Math.max(1.5, avgMin / 60) : Math.min(2, avgMin / 60)) || 1.5;

  // тренировочный стек
  const stack = useMemo(() => {
    try { return buildDefaultStack(mixGoal, mixTiming, bw, durHrs); }
    catch { return []; }
  }, [mixGoal, mixTiming, bw, durHrs]);

  const hasNandrolone = (linked.course || []).some((c: any) => {
    const id = (c.substanceId || '').toLowerCase();
    return id.includes('nandrolon') || id.includes('npp') || id.includes('deca') || id.includes('trest');
  });

  const na = ((linked.labs as any[]) || []).find((l: any) => l.code === 'SODIUM')?.value || 140;
  const kVal = ((linked.labs as any[]) || []).find((l: any) => l.code === 'POTASSIUM')?.value || 4.2;
  const cl = ((linked.labs as any[]) || []).find((l: any) => l.code === 'CHLORIDE')?.value || 102;

  // П6: id применённого коктейля (сам extraStack — после recipe-мемо, иначе TDZ)
  const [appliedRecipeId, setAppliedRecipeId] = useState<string | null>(null);
  useEffect(() => { setAppliedRecipeId(null); }, [mixGoal, mixTiming, bw]);

  const mixTitle = `${mixGoal === 'pump' ? 'Памп' : GOAL_OPTIONS.find(g => g.id === mixGoal)?.label || mixGoal} (${mixTiming === 'pre' ? 'пред' : mixTiming === 'intra' ? 'интра' : 'пост'})`;

  // Эпик D: фарма-коктейль (оживление buildBestRecipe) — слой поверх базового стека
  const recipe = useMemo(() => {
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
      return buildBestRecipe(p);
    } catch { return null; }
  }, [mixGoal, mixTiming, bw, isOnCycle, mixInsulin, mixDrugIGF, mixDrugGH, mixDrugMGF, mixDrugGLP1, hasNandrolone, na, kVal, cl, mixWorkoutType, mixTimeOfDay, durHrs, mixExperience, mixDayType, linked.course]);

  // П6 (продолжение): extraStack после recipe — со скоринга идёт полный стек
  const extraStack = useMemo(() => {
    if (!appliedRecipeId) return [];
    try {
      const items = recipe && recipe.recipe.id === appliedRecipeId ? recipe.items : [];
      const seen = new Set(stack.map(s => `${s.id}`));
      return items.filter(it => !seen.has(it.id)).map(it => ({
        name: it.id, id: it.id, dose: String(it.dose), unit: it.unit, note: `${it.note} (фарма-коктейль)`, mg: it.mg,
      }));
    } catch { return []; }
  }, [appliedRecipeId, recipe, stack]);

  const fullStack = useMemo(() => [...stack, ...extraStack], [stack, extraStack]);

  const mixSubstances: MixSubstance[] = useMemo(() =>
    fullStack.filter(s => s.mg > 0).map(s => ({ id: s.id, name: s.name, doseMg: s.mg })), [fullStack]);

  const planSubstances: PlanSubstance[] = useMemo(() =>
    fullStack.filter(s => s.mg > 0).map(s => ({
      id: s.id, name: s.name, dose: String(s.dose ?? ''), unit: s.unit || 'мг', mg: s.mg, note: s.note, timing: mixTiming,
    })), [fullStack, mixTiming]);

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

  // Эпик C+G: гейты безопасности (добивка — из профиля, не false) + персист параметров
  const [caffeineSensitive, setCaffeineSensitive] = useState(() => {
    try { return JSON.parse(localStorage.getItem('he_mix_hub_v1') || '{}').caffeineSensitive === true; } catch { return false; }
  });
  const caffeineMg = useMemo(() => fullStack.find(s => s.id === 'caffeine')?.mg ?? 0, [fullStack]);
  const gateCtx = useMemo(() => {
    const s: any = (linked.profile?.settings as any) || {};
    const personal = s.personal || {};
    const health = s.health || {};
    const goals = s.goals || {};
    const age = Number(personal.age ?? s.age) || undefined;
    const sex = String(personal.sex ?? s.sex ?? '').toLowerCase();
    const lifeStage = String(goals.lifeStage ?? '').toLowerCase();
    const chronic: string[] = Array.isArray(health.chronicConditions) ? health.chronicConditions : [];
    const bpStage = String(health.bpStage ?? s.cardio?.bpStage ?? '');
    const hasHypertension = /hypertension/i.test(bpStage) || chronic.some(c => /hyperton|гипертон|hypertension|давлен/i.test(String(c)));
    const isPregnant = sex === 'female' && /pregnan|беремен|lactat|лактация/.test(lifeStage);
    const courseIds = (linked.course || []).map((c: any) => String(c.substanceId || '').toLowerCase()).join(' ');
    const takesAnticoagulant = /aspirin|warfarin|heparin|clopidogrel|apixaban|rivaroxaban|dabigatran|anticoag|аспирин|варфарин|гепарин/.test(courseIds);
    return { age, hasHypertension, isPregnant, isTeen: age != null && age < 18, takesAnticoagulant };
  }, [linked.profile?.settings, linked.course]);
  const gates = useMemo(() => {
    try {
      return mixSafetyGates(fullStack.map(s => ({ id: s.id, mg: s.mg })), {
        caffeineMg, bwKg: bw, hasInsulin: mixInsulin > 0,
        timeOfDay: mixTimeOfDay,
        hasHypertension: gateCtx.hasHypertension,
        isPregnant: gateCtx.isPregnant,
        isTeen: gateCtx.isTeen,
        takesAnticoagulant: gateCtx.takesAnticoagulant,
        ageYears: gateCtx.age,
        caffeineSensitive,
      });
    } catch { return []; }
  }, [fullStack, caffeineMg, bw, mixInsulin, mixTimeOfDay, gateCtx, caffeineSensitive]);

  useEffect(() => {
    try { localStorage.setItem('he_mix_hub_v1', JSON.stringify({ mixGoal, mixTiming, mixWorkoutType, mixTimeOfDay, mixExperience, mixDayType, caffeineSensitive })); } catch {}
  }, [mixGoal, mixTiming, mixWorkoutType, mixTimeOfDay, mixExperience, mixDayType, caffeineSensitive]);

  const timingLabel = mixTiming === 'pre' ? 'За 30-60 мин до тренировки' : mixTiming === 'intra' ? 'В течение тренировки' : 'Сразу после тренировки';
  const stackTitle = mixTiming === 'pre' ? '🔥 Пред-тренировочный стек' : mixTiming === 'intra' ? '💧 Интра-тренировочный стек' : '🍗 Пост-тренировочный стек';

  return (
    <div className="train-mix" style={{ padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800, color: '#fff' }}>💪 Тренировочные миксы</h2>
      <p style={{ fontSize: 12, color: '#fff', margin: '0 0 12px' }}>
        Подбор пред-/интра-/пост-тренировочных стеков по цели и весу
      </p>

      <div style={CARD}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#fff' }}>⚙️ Параметры</h4>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>🎯 Цель</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }} role="listbox" aria-label="Цель микса">
          {GOAL_OPTIONS.map(o => (
            <MixChip key={o.id} active={mixGoal === o.id} label={`${o.emoji} ${o.label}`} onSelect={() => setMixGoal(o.id)} />
          ))}
        </div>



        {(
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>⏰ Тайминг</div>
              {[
                { id: 'pre', label: '🔥 Пред-тренировочный' },
                { id: 'intra', label: '💧 Интра-тренировочный' },
                { id: 'post', label: '🍗 Пост-тренировочный' },
              ].map(o => (
                <MixChip key={o.id} active={mixTiming === o.id} label={o.label} onSelect={() => setMixTiming(o.id as any)} style={{ marginBottom: 3 }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>🏋️ Тип тренировки</div>
              {WO_TYPE.map(o => (
                <MixChip key={o.id} active={mixWorkoutType === o.id} label={o.label} onSelect={() => setMixWorkoutType(o.id as any)} style={{ marginBottom: 3 }} />
              ))}
            </div>
          </div>
        )}

        {(
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>🌅 Время суток</div>
              {TOD.map(o => (
                <MixChip key={o.id} active={mixTimeOfDay === o.id} label={o.label} onSelect={() => setMixTimeOfDay(o.id as any)} style={{ marginBottom: 3 }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>🎓 Опыт</div>
              {EXP.map(o => (
                <MixChip key={o.id} active={mixExperience === o.id} label={o.label} onSelect={() => setMixExperience(o.id as any)} style={{ marginBottom: 3 }} />
              ))}
            </div>
          </div>
        )}

        {(
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>📆 Тип дня</div>
              {DAY_TYPES.map(o => (
                <MixChip key={o.id} active={mixDayType === o.id} label={o.label} onSelect={() => setMixDayType(o.id as any)} style={{ marginBottom: 3 }} />
              ))}
            </div>
          </div>
        )}

        {(
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 4 }}>
            ⚖️ Вес тела: <b style={{ color: '#fff' }}>{bw} кг</b>
            {isOnCycle ? <span style={{ color: '#a78bfa', marginLeft: 6 }}>🔥 Курс (дозы по весу, без ×-наценки)</span> : ''}
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={caffeineSensitive} onChange={e => setCaffeineSensitive(e.target.checked)} style={{ width: 18, height: 18 }} aria-label="Чувствительность к кофеину" />
              <span>☕ Чувствительность к кофеину (начну с малой дозы)</span>
            </label>
            {(gateCtx.hasHypertension || gateCtx.isPregnant || gateCtx.isTeen || gateCtx.takesAnticoagulant) && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                Профиль: {[gateCtx.hasHypertension && 'АГ', gateCtx.isPregnant && 'беременность/лактация', gateCtx.isTeen && 'подросток', gateCtx.takesAnticoagulant && 'антикоагулянт'].filter(Boolean).join(' · ')} — гейты ниже учтены.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Фарма (только для тренировки) ── */}
      {(mixInsulin > 0 || mixDrugIGF > 0 || mixDrugGH > 0 || mixDrugMGF > 0 || mixDrugGLP1) && (
        <div style={{ ...CARD, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>💉 Фармакология (автоопределение)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {mixInsulin > 0 && <span style={chip(true)}>💉 Инсулин {mixInsulin}МЕ</span>}
            {mixDrugIGF > 0 && <span style={chip(true)}>🧬 ИГФ-1 {mixDrugIGF}мкг</span>}
            {mixDrugGH > 0 && <span style={chip(true)}>💉 ГР {mixDrugGH}МЕ</span>}
            {mixDrugMGF > 0 && <span style={chip(true)}>🧬 МГФ {mixDrugMGF}мкг</span>}
            {mixDrugGLP1 && <span style={chip(true)}>💊 ГПП-1</span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setMixInsulin(0); setMixDrugIGF(0); setMixDrugGH(0); setMixDrugMGF(0); setMixDrugGLP1(false); }}
              style={{ fontSize: 12, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', padding: 0 }}>✕ Очистить фарму</button>
          </div>
        </div>
      )}

      {/* ── Результат: тренировочный стек ── */}
      {mixSubstances.length > 0 && (
        <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(0,230,138,0.04), rgba(139,92,246,0.04))', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{mixTiming === 'pre' ? '🔥' : mixTiming === 'intra' ? '💧' : '🍗'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{stackTitle}</div>
              <div style={{ fontSize: 12, color: '#fff' }}>{timingLabel}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: score.color }}>{score.compositeScore}</div>
              <div style={{ fontSize: 12, color: score.color }}>{score.label}</div>
              <div style={{ fontSize: 9, color: '#fff', marginTop: 2, maxWidth: 120 }}>ориентир покрытия, не прогноз кг/ватт</div>
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
                <div key={i} style={{ fontSize: 12, color: dm.bonus > 0 ? '#22c55e' : dm.bonus < 0 ? '#ef4444' : '#fff', marginBottom: 2 }}>
                  • {dm.drug}: {dm.effect}{dm.bonus !== 0 ? ` (${dm.bonus > 0 ? '+' : ''}${dm.bonus}%)` : ' (инфо, на скор не влияет)'}
                </div>
              ))}
            </div>
          )}

          {gates.length > 0 && (
            <div style={{ marginBottom: 6 }} role="alert">
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>🛡️ Гейты безопасности:</div>
              {gates.map((g, i) => (
                <div key={i} style={{ fontSize: 12, color: g.level === 'block' ? '#ef4444' : g.level === 'warn' ? '#f59e0b' : '#fff', marginBottom: 1 }}>• {g.text}</div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 6, padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>🥤 Нормы приёма (из расчёта)</div>
            <div style={{ fontSize: 12, color: '#fff' }}>Углеводы: <b>{score.recommendedCarbsG} г</b> · EAA/белок: <b>{score.recommendedEAAG} г</b></div>
            <div style={{ fontSize: 12, color: '#fff' }}>Вода: <b>{score.recommendedWaterMl} мл</b> · Na <b>{score.recommendedNaMg}</b> / K <b>{score.recommendedKMg}</b> / Cl <b>{score.recommendedClMg} мг</b></div>
            {score.electrolyteWarnings.slice(0, 3).map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: '#f59e0b' }}>• {w}</div>
            ))}
          </div>

          {recipe && (
            <div style={{ marginBottom: 6, padding: 8, borderRadius: 8, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>🧬 Фарма-коктейль: {recipe.recipe.name}</div>
              <div style={{ fontSize: 11, color: '#fff', marginBottom: 4 }}>{recipe.recipe.synergyNote}</div>
              {recipe.items.map((it, i) => (
                <div key={i} style={{ fontSize: 11, color: '#fff' }}>• {it.id}: {it.dose}{it.unit} — {it.note} ({it.timing})</div>
              ))}
              {(mixInsulin > 0) && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⛔ С инсулином — только врач + глюкометр + быстрые угли. Хаб не дозирует инсулин.</div>}
              {appliedRecipeId === recipe.recipe.id ? (
                <button onClick={() => setAppliedRecipeId(null)} style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', fontWeight: 700, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>✕ Убрать коктейль из стека</button>
              ) : (
                <button onClick={() => setAppliedRecipeId(recipe.recipe.id)} style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>➕ Добавить коктейль в стек ({recipe.items.length})</button>
              )}
            </div>
          )}

          {score.suggestions.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>💡 Рекомендации:</div>
              {score.suggestions.slice(0, 5).map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: '#fff', marginBottom: 1 }}>• {s}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => {
              if (planSubstances.length === 0) return;
              setSavePopup({ step: 'confirm', toPlan: false, result: null });
            }} style={{ flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa' }}>💾 Сохранить в дневник и избранное</button>
            <button onClick={() => {
              const kit = {
                id: Date.now(), type: 'mix',
                goal: mixGoal, timing: mixTiming, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay,
                bw, isOnCycle,
                stack: fullStack.filter(sItem => sItem.mg > 0),
                score: score.compositeScore,
                date: new Date().toISOString(),
              };
              try {
                const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                arr.push(kit);
                localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                setSavePopup({ step: 'done', toPlan: false, result: null });
              } catch { /* ignore */ }
            }} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a' }}>💾 Комплект</button>
          </div>
          <button onClick={() => {
            const ids = fullStack.filter(sItem => sItem.mg > 0 && sItem.id).map(sItem => sItem.id as string);
            const n = pushSubsToPlan(ids, 'mix', `Микс: ${mixGoal} (${mixTiming === 'pre' ? 'пред' : mixTiming === 'intra' ? 'интра' : 'пост'})`);
            if (n > 0) { setMixPushed(true); setTimeout(() => setMixPushed(false), 1800); }
            else {
              try { (window as any).showToast?.('Все вещества микса — питание (белок/креатин/аминокислоты) — в план поддержки не добавлены.', 'info'); } catch {}
              if (!(window as any).showToast) { setMixPushed(false); }
            }
          }} style={{ marginTop: 6, width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: mixPushed ? 'rgba(0,230,138,0.9)' : 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: mixPushed ? '#0b0b0d' : '#00e68a', transition: 'all 0.2s' }}>
            {mixPushed ? '✓ Добавлено в план поддержки' : '📋 В план поддержки'}
          </button>
        </div>
      )}

      {fullStack.filter(sItem => sItem.mg > 0).length > 0 && (
        <div style={CARD}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#fff' }}>📋 Состав стека{extraStack.length > 0 ? ` (база + коктейль +${extraStack.length})` : ''}</h4>
          {fullStack.filter(sItem => sItem.mg > 0).map((sItem, i) => {
            const under = isUnderdosed(sItem.id, sItem.mg);
            const ev = evidenceFor(sItem.id);
            return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 3 }}>
              <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 12, fontWeight: 600, color: '#fff', wordBreak: 'break-word' }}>
                {sItem.name}
                {under && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, padding: '1px 5px' }}>ниже эталона</span>}
                {ev?.chronicOnly && <span style={{ marginLeft: 6, fontSize: 10, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, padding: '1px 5px' }}>курсом</span>}
                {ev?.grade === 'WADA' && <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '1px 5px' }}>WADA</span>}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 12, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>{sItem.dose} {sItem.unit}</span>
              <span style={{ flex: '0 0 auto', fontSize: 12, color: '#fff', wordBreak: 'break-word' }}>{sItem.note}</span>
            </div>
            );
          })}
        </div>
      )}

      {/* ── История (только для тренировки) ── */}
      {mixHistory.length > 0 && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#fff' }}>📂 История ({mixHistory.length})</h4>
            <button onClick={() => { setMixHistory([]); localStorage.setItem('he_training_mixes', '[]'); }}
              style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Очистить</button>
          </div>
          {mixHistory.slice(0, 10).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginBottom: 2 }}>
              <span style={{ color: '#fff', minWidth: 65 }}>{h.date}</span>
              <span>{h.timing === 'pre' ? '🔥' : h.timing === 'intra' ? '💧' : '🍗'}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{h.goal}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{h.score}</span>
              <span style={{ color: '#fff', fontSize: 12 }}>{h.label}</span>
            </div>
          ))}
        </div>
      )}
      {savePopup && (
        <SaveResultPopup
          popup={savePopup}
          count={planSubstances.length}
          onToPlanChange={v => setSavePopup(prev => prev ? { ...prev, toPlan: v } : prev)}
          onConfirm={() => {
            if (!savePopup) return;
            try {
              const input = {
                title: `Микс: ${mixTitle}`,
                kind: 'mix' as const,
                goal: mixGoal,
                timing: mixTiming,
                score: score.compositeScore,
                label: score.label,
                weightKg: bw,
                substances: planSubstances,
                course: (linked.course || []).map((c: any) => ({ id: c.substanceId || '', name: c.name || c.substanceId })),
              };
              const result = saveMixToDiaryAndFavorites(input);
              if (savePopup.toPlan) queueMixToSupportPlan(result.rec);
              setMixHistory(readDiaryMixes() as any);
              setSavePopup({ step: 'done', toPlan: savePopup.toPlan, result });
            } catch { /* ignore */ }
          }}
          onClose={() => setSavePopup(null)}
        />
      )}
    </div>
  );
};

export default TrainingMixTab;
