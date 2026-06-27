import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  runScoreAnalysis, getSuggestedPlan, generateScoreReportText,
  type ScoreReport,
} from '../../../engines/score-engine';
import {
  analyzeLabs, generateLabsReport,
} from '../../../engines/score-labs';
import {
  analyzeNutrition, generateNutritionReport,
} from '../../../engines/score-nutrition';
import {
  analyzeTraining, generateTrainingReport,
} from '../../../engines/score-training';
import {
  analyzePharma, generatePharmaReport,
} from '../../../engines/score-pharma';
import {
  runPipeline, generateFullReport,
  type OrchestratorResult,
} from '../../../engines/orchestrator';
import type { ModuleResult } from '../../../engines/score-engine';
import { PHARMA_DB } from '../../../core/pharma-database';
import { getScoreHistory, saveScoreSnapshot, getScoreTrend } from '../../../engines/score-history';
import ScoreDashboard from '../../components/ScoreDashboard';
import ScoreHistoryChart from '../../components/ScoreHistoryChart';
import SupportScoreCard from '../../components/SupportScoreCard';

interface AutoCalculatorProps {
  linked: any;
  supportLevel: 'basic' | 'mid' | 'max' | 'boost';
  boostEnabled: boolean;
  selectedAnalogs: Record<string, string>;
  enhancedSubs: string[];
  calcResult: any;
  supportResult: any;
  onApply: (result: {
    level: 'basic' | 'mid' | 'max' | 'boost';
    boostEnabled: boolean;
    analogs: Record<string, string>;
    subs: string[];
    calcResult: any;
    supportResult: any;
  }) => void;
}

type ModuleTab = 'support' | 'labs' | 'nutrition' | 'training' | 'pharma' | 'full';

const MODULE_TABS: Array<{ id: ModuleTab; label: string; icon: string }> = [
  { id: 'support', label: 'Поддержка', icon: '💊' },
  { id: 'pharma', label: 'Фарма', icon: '💉' },
  { id: 'labs', label: 'Анализы', icon: '🧪' },
  { id: 'nutrition', label: 'Питание', icon: '🥗' },
  { id: 'training', label: 'Тренинг', icon: '🏋️' },
  { id: 'full', label: 'Полный', icon: '🧬' },
];

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: 14,
};

const PILL_BTN: React.CSSProperties = {
  background: 'var(--accent)',
  padding: '6px 14px',
  borderRadius: 22,
  border: 'none',
  color: '#000',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 14, fontSize: 9, fontWeight: 700, cursor: 'pointer',
  background: active ? 'var(--accent)' : 'var(--bg-secondary)',
  color: active ? '#000' : 'var(--text-dim)',
  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
  whiteSpace: 'nowrap' as const,
});

const LEVEL_META: Record<string, { icon: string; color: string }> = {
  low: { icon: '🟢', color: '#22c55e' },
  moderate: { icon: '🟡', color: '#fbbf24' },
  high: { icon: '🔴', color: '#ef4444' },
};

function ModuleSystemsView({ systems, totalLabel }: { systems: Array<{ id: string; label: string; icon: string; weightedScore: number; level: string }>; totalLabel?: string }) {
  const active = systems.filter(s => s.weightedScore > 0);
  if (active.length === 0) return <div style={{ ...GLASS_CARD, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>✅ Всё в норме</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {active.map(sys => {
        const meta = LEVEL_META[sys.level];
        return (
          <div key={sys.id} style={{ ...GLASS_CARD, padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{sys.icon} {sys.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: meta.color }}>{sys.weightedScore}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(sys.weightedScore, 100)}%`, background: meta.color, borderRadius: 2 }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {totalLabel && (
        <div style={{ ...GLASS_CARD, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{totalLabel}</div>
        </div>
      )}
    </div>
  );
}

function ModuleRecsView({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>💡 Рекомендации</div>
      {recommendations.map((r, i) => (
        <div key={i} style={{ ...GLASS_CARD, padding: '8px 12px', fontSize: 9, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}>{r}</div>
      ))}
    </div>
  );
}

export const AutoCalculator: React.FC<AutoCalculatorProps> = ({
  linked, supportLevel, boostEnabled, selectedAnalogs, enhancedSubs, calcResult, supportResult, onApply,
}) => {
  const [moduleTab, setModuleTab] = useState<ModuleTab>('full');
  const [applied, setApplied] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_support_auto_reports') || '[]'); } catch { return []; }
  });

  const course = linked?.course || [];
  const profile = linked?.profile || {};
  const weight = profile?.settings?.weight || 80;
  const age = profile?.settings?.age || 30;
  const sex = profile?.settings?.sex || 'male';
  const labs = linked?.labs || [];
  const latestLab = labs.length > 0 ? labs[labs.length - 1] : null;
  const trainingPlan = linked?.training || {};

  // ─── Module Results ───

  const pharmaResult = useMemo<ModuleResult>(() => analyzePharma({
    course: course.map((c: any) => ({ substanceId: c.substanceId || c.id || '', dose: c.doseValue || c.dose || 0, unit: c.doseUnit || 'мг', weeks: c.durationWeeks || c.endWeek - c.startWeek || 0 })),
    weight, age, sex,
  }), [course, weight, age, sex]);

  const nutritionResult = useMemo<ModuleResult>(() => {
    // Try to load real meal data from diary
    let meals: Array<{ foods: Array<any> }> = [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const diary = JSON.parse(localStorage.getItem('nutrition_diary') || '{}');
      const dayData = diary[today];
      if (dayData?.meals) {
        meals = Object.values(dayData.meals).map((items: any) => ({
          foods: (Array.isArray(items) ? items : []).map((i: any) => ({
            id: i.name || 'unknown', name: i.name || '', grams: parseInt(i.qty) || 100,
            protein: i.p || 0, fat: i.f || 0, carbs: i.c || 0, kcal: i.kcal || 0, fiber: 0,
          })),
        }));
      }
    } catch {}
    return analyzeNutrition({ meals, weight, age, sex, goal: profile?.settings?.goal, activityLevel: 'moderate' });
  }, [weight, age, sex]);

  const trainingResult = useMemo<ModuleResult>(() => analyzeTraining({
    workoutsPerWeek: trainingPlan?.workoutsPerWeek || profile?.settings?.workoutsPerWeek || 3,
    avgMinutes: trainingPlan?.avgMinutes || 60,
    intensity: trainingPlan?.intensity || 'moderate',
    goal: profile?.settings?.goal || 'hypertrophy',
    experience: profile?.settings?.experience || 'intermediate',
    sleepHours: profile?.settings?.sleepHours || 7,
    stressLevel: profile?.settings?.stressLevel || 3,
    jointPain: [],
    deloadWeeksAgo: trainingPlan?.deloadWeeksAgo ?? 99,
    weight, age, sex,
  }), [trainingPlan, profile, weight, age, sex]);

  // Cross-module modifiers (TZ: результаты nutrition/training → коррекция support)
  const nutritionQuality = nutritionResult ? 100 - nutritionResult.overallRaw : undefined;
  const trainingLoad = trainingResult ? trainingResult.overallRaw : undefined;

  const supportResult_ = useMemo<ScoreReport>(() => runScoreAnalysis({
    course: course.map((c: any) => ({ substanceId: c.substanceId || c.id || '', dose: c.doseValue || c.dose || 0, unit: c.doseUnit || 'мг', weeks: c.durationWeeks || c.endWeek - c.startWeek || 0 })),
    weight, age, sex, labs: latestLab || undefined,
    nutritionQuality, trainingLoad,
  }), [course, weight, age, sex, latestLab, nutritionQuality, trainingLoad]);

  const labsResult = useMemo<ModuleResult>(() => {
    if (!latestLab) return { module: 'labs', timestamp: '', profile: { weight, age, sex }, systems: [], overallRaw: 0, overallAfterSupport: 0, recommendations: [], supportCount: 0, details: {} };
    const markers = Object.entries(latestLab).filter(([k, v]) => typeof v === 'number').map(([id, value]) => ({ id, value: value as number }));
    return analyzeLabs({ markers, weight, age, sex });
  }, [latestLab, weight, age, sex]);

  const fullResult = useMemo<OrchestratorResult>(() => runPipeline({
    support: { course: course.map((c: any) => ({ substanceId: c.substanceId || c.id || '', dose: c.doseValue || c.dose || 0, unit: c.doseUnit || 'мг', weeks: c.durationWeeks || c.endWeek - c.startWeek || 0 })) },
    labs: latestLab ? { markers: Object.entries(latestLab).filter(([k, v]) => typeof v === 'number').map(([id, value]) => ({ id, value: value as number })) } : undefined,
    nutrition: { meals: [] },
    training: {
      workoutsPerWeek: trainingPlan?.workoutsPerWeek || profile?.settings?.workoutsPerWeek || 3,
      avgMinutes: trainingPlan?.avgMinutes || 60,
      intensity: trainingPlan?.intensity || 'moderate',
      goal: profile?.settings?.goal || 'hypertrophy',
      experience: profile?.settings?.experience || 'intermediate',
      sleepHours: profile?.settings?.sleepHours || 7,
      stressLevel: profile?.settings?.stressLevel || 3,
      jointPain: [],
      deloadWeeksAgo: trainingPlan?.deloadWeeksAgo ?? 99,
    },
    weight, age, sex,
  }), [course, latestLab, trainingPlan, profile, weight, age, sex]);

  // Auto-save score snapshot to history when full results change
  useEffect(() => {
    const all = fullResult?.modules || {};
    if (!all.support && !all.pharma && !all.labs && !all.nutrition && !all.training) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const modules: Record<string, { overallRaw: number; systemCount: number }> = {};
      for (const [key, val] of Object.entries(all)) {
        if (val) modules[key] = { overallRaw: val.overallRaw, systemCount: val.systems.filter((s: any) => s.weightedScore > 0).length };
      }
      saveScoreSnapshot({ date: today, modules });
    } catch {}
  }, [fullResult]);

  const currentResult = useMemo<ScoreReport | ModuleResult | null>(() => {
    switch (moduleTab) {
      case 'support': return supportResult_;
      case 'pharma': return pharmaResult;
      case 'labs': return labsResult;
      case 'nutrition': return nutritionResult;
      case 'training': return trainingResult;
      default: return null;
    }
  }, [moduleTab, supportResult_, pharmaResult, labsResult, nutritionResult, trainingResult]);

  const suggestedPlan = useMemo(() => moduleTab === 'support' ? getSuggestedPlan(supportResult_) : [], [moduleTab, supportResult_]);
  const enrichedPlan = useMemo(() => fullResult.modules.support ? getSuggestedPlan(fullResult.modules.support as any) : [], [fullResult]);

  const handleApply = useCallback((plan: Array<{ id: string }>) => {
    onApply({
      level: supportLevel, boostEnabled,
      analogs: selectedAnalogs,
      subs: plan.map(p => p.id),
      calcResult, supportResult,
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [onApply, supportLevel, boostEnabled, selectedAnalogs, calcResult, supportResult]);

  const handleGenerateReport = useCallback(() => {
    let text = '';
    if (moduleTab === 'full' && fullResult) {
      text = generateFullReport(fullResult);
    } else if (currentResult) {
      switch (moduleTab) {
        case 'support': text = generateScoreReportText(currentResult as ScoreReport); break;
        case 'pharma': text = generatePharmaReport(currentResult); break;
        case 'labs': text = generateLabsReport(currentResult); break;
        case 'nutrition': text = generateNutritionReport(currentResult); break;
        case 'training': text = generateTrainingReport(currentResult); break;
      }
    }
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});

    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      module: moduleTab,
      summary: currentResult ? `${currentResult.systems.filter(s => s.weightedScore > 0).length}/${currentResult.systems.length} систем` : 'полный',
    };
    const updated = [entry, ...savedReports].slice(0, 20);
    setSavedReports(updated);
    try { localStorage.setItem('he_support_auto_reports', JSON.stringify(updated)); } catch {}

    // Save score snapshot to history
    try {
      const today = new Date().toISOString().split('T')[0];
      const modules: Record<string, { overallRaw: number; systemCount: number }> = {};
      const all = fullResult?.modules || { support: null, pharma: null, labs: null, nutrition: null, training: null };
      for (const [key, val] of Object.entries(all)) {
        if (val) modules[key] = { overallRaw: val.overallRaw, systemCount: val.systems.filter((s: any) => s.weightedScore > 0).length };
      }
      saveScoreSnapshot({ date: today, modules });
    } catch {}

    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2500);
  }, [moduleTab, fullResult, currentResult, savedReports]);

  return (
    <div style={{ padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2, color: 'var(--text)' }}>🧬 Score Engine — TZ Pipeline</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          Единый pipeline: 💊 поддержка + 💉 фарма + 🧪 анализы + 🥗 питание + 🏋️ тренинг
        </div>
        <div style={{ fontSize: 8, color: '#818cf8', marginTop: 2 }}>{new Date().toLocaleString('ru-RU')}</div>
      </div>

      {/* PROFILE BAR */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...GLASS_CARD, display: 'flex', gap: 16, alignItems: 'center', padding: '6px 14px' }}>
          <div><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{weight}</span><span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 2 }}>кг</span></div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{age}</span><span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 2 }}>лет</span></div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{sex === 'male' ? 'М' : 'Ж'}</span></div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: fullResult.overallRisk >= 60 ? '#ef4444' : fullResult.overallRisk >= 30 ? '#fbbf24' : '#22c55e' }}>{fullResult.overallRisk}%</div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>общий</div>
          </div>
        </div>
      </div>

      {/* MODULE TABS */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'wrap' }}>
        {MODULE_TABS.map(mt => (
          <button key={mt.id} onClick={() => setModuleTab(mt.id)} style={TAB_STYLE(moduleTab === mt.id)}>
            {mt.icon} {mt.label}
          </button>
        ))}
      </div>

      {/* SUPPORT MODULE */}
      {moduleTab === 'support' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SupportScoreCard
            course={course.map((c: any) => ({ substanceId: c.substanceId || c.id || '', dose: c.doseValue || c.dose || 0, unit: c.doseUnit || 'мг', weeks: c.durationWeeks || c.endWeek - c.startWeek || 0 }))}
            weight={weight} age={age} sex={sex}
            nutritionQuality={nutritionQuality} trainingLoad={trainingLoad}
            pharmaHepatic={pharmaResult.systems.find(s => s.id === 'hepatic')?.weightedScore}
            pharmaCardio={pharmaResult.systems.find(s => s.id === 'cardio')?.weightedScore}
            pharmaRenal={pharmaResult.systems.find(s => s.id === 'renal')?.weightedScore}
            pharmaNeuro={pharmaResult.systems.find(s => s.id === 'neuro')?.weightedScore}
            labsHepatic={labsResult.systems.find(s => s.id === 'hepatic')?.weightedScore}
            labsCardio={labsResult.systems.find(s => s.id === 'cardio')?.weightedScore}
            labsRenal={labsResult.systems.find(s => s.id === 'renal')?.weightedScore}
            labsNeuro={labsResult.systems.find(s => s.id === 'neuro')?.weightedScore}
          />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>💊 Анализ поддержки курса — детально</div>
          <ModuleSystemsView systems={supportResult_.systems} totalLabel={`Risk: ${supportResult_.overallRaw}% → ${supportResult_.overallAfterSupport}% · ${supportResult_.supportCount} веществ`} />
          {supportResult_.organs && supportResult_.organs.length > 0 && (
            <div><div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>🔬 Органы под нагрузкой</div>
              {supportResult_.organs.slice(0, 4).map((o: any) => (
                <div key={o.id} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: o.stressLevel >= 60 ? '#ef4444' : o.stressLevel >= 30 ? '#fbbf24' : '#22c55e' }}>{o.stressLevel >= 60 ? '🔴' : o.stressLevel >= 30 ? '🟡' : '🟢'} {o.stressLevel}%</span>
                  <span style={{ fontSize: 9, color: 'var(--text)' }}>{o.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{o.fromSystems?.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
          {supportResult_.synergies && supportResult_.synergies.length > 0 && (
            <div><div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>🔗 Совместимость</div>
              {supportResult_.synergies.slice(0, 3).map((s: any, i: number) => (
                <div key={i} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span>{s.type === 'synergy' ? '🟢' : s.type === 'caution' ? '🟡' : '🔴'}</span>
                  <span style={{ fontSize: 8, color: '#22c55e' }}>{s.pair}: {s.description}</span>
                </div>
              ))}
            </div>
          )}
          <ModuleRecsView recommendations={supportResult_.recommendations} />
          {/* Auto-suggested plan */}
          {suggestedPlan.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>💊 План ({suggestedPlan.length})</div>
              {suggestedPlan.map(p => (
                <div key={p.id} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>💊</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--accent)' }}>{p.dose}</span>
                  <span style={{ fontSize: 8, color: '#818cf8' }}>{p.timing}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PHARMA MODULE */}
      {moduleTab === 'pharma' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>💉 PK/PD анализ фармакологии</div>
          <ModuleSystemsView systems={pharmaResult.systems} totalLabel={`PD риск: ${pharmaResult.overallRaw}%`} />
          {(pharmaResult.details as any)?.pkProfiles?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>⏱ PK-профили</div>
              {(pharmaResult.details as any).pkProfiles.slice(0, 4).map((p: any) => (
                <div key={p.substanceId} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>T½={p.halfLifeHours}ч · F={Math.round(p.bioavailability * 100)}% · Vd={p.Vd}л</span>
                  <span style={{ fontSize: 8, color: '#818cf8', marginLeft: 'auto' }}>{p.clearanceNote}</span>
                </div>
              ))}
            </div>
          )}
          {(pharmaResult.details as any)?.interactions?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>🔗 Взаимодействия</div>
              {(pharmaResult.details as any).interactions.slice(0, 4).map((ix: any, i: number) => (
                <div key={i} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span>{ix.type === 'synergy' ? '🟢' : ix.type === 'conflict' ? '🔴' : '🟡'}</span>
                  <span style={{ fontSize: 8, color: 'var(--text)' }}>{ix.a} + {ix.b}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{ix.effect}</span>
                </div>
              ))}
            </div>
          )}
          <ModuleRecsView recommendations={pharmaResult.recommendations} />
        </div>
      )}

      {/* LABS MODULE */}
      {moduleTab === 'labs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>🧪 Анализ лабораторных показателей</div>
          {!latestLab ? (
            <div style={{ ...GLASS_CARD, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Нет данных анализов. Добавьте анализы во вкладке Лаборатория.</div>
          ) : (
            <><ModuleSystemsView systems={labsResult.systems} />
            <ModuleRecsView recommendations={labsResult.recommendations} /></>
          )}
        </div>
      )}

      {/* NUTRITION MODULE */}
      {moduleTab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>🥗 Анализ качества питания</div>
          <ModuleSystemsView systems={nutritionResult.systems} totalLabel={`Risk: ${nutritionResult.overallRaw}%`} />
          <ModuleRecsView recommendations={nutritionResult.recommendations} />
          <div style={{ ...GLASS_CARD, padding: '8px 12px', fontSize: 8, color: 'var(--text-dim)' }}>
            * Для точного анализа добавьте приёмы пищи в дневник питания.
          </div>
        </div>
      )}

      {/* TRAINING MODULE */}
      {moduleTab === 'training' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>🏋️ Анализ тренировочного процесса</div>
          <ModuleSystemsView systems={trainingResult.systems} totalLabel={`Risk: ${trainingResult.overallRaw}%`} />
          <ModuleRecsView recommendations={trainingResult.recommendations} />
          <div style={{ ...GLASS_CARD, padding: '8px 12px', fontSize: 8, color: 'var(--text-dim)' }}>
            * Данные из профиля: {trainingResult.details?.weeklyVolume || 0} мин/нед, сон {((trainingResult.details as any)?.sleepHours) || 7} ч.
          </div>
        </div>
      )}

      {/* FULL PIPELINE MODULE */}
      {moduleTab === 'full' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>🧬 Полный pipeline (TZ Orchestrator)</div>

          {/* Overall risk gauge */}
          <div style={{ ...GLASS_CARD, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)', textAlign: 'center' }}>📊 Общий риск: {fullResult.overallRisk}%</div>
            <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(fullResult.overallRisk, 100)}%`, background: fullResult.overallRisk >= 60 ? '#ef4444' : fullResult.overallRisk >= 30 ? '#fbbf24' : '#22c55e', borderRadius: 4 }} />
            </div>
          </div>

          {/* Cross-module auto-suggest plan */}
          {enrichedPlan.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>💊 План поддержки (cross-module enriched)</div>
              {enrichedPlan.map(p => (
                <div key={p.id} style={{ ...GLASS_CARD, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>💊</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 8, color: 'var(--accent)' }}>{p.dose}</span>
                  <span style={{ fontSize: 8, color: '#818cf8' }}>{p.timing}</span>
                </div>
              ))}
            </div>
          )}

          {/* Score Dashboard */}
          <ScoreDashboard modules={[
            { icon: '💊', label: 'Поддержка', risk: fullResult.modules.support?.overallRaw || 0, systemCount: fullResult.modules.support?.systems.filter(s => s.weightedScore > 0).length || 0, totalSystems: fullResult.modules.support?.systems.length || 8 },
            { icon: '💉', label: 'Фарма', risk: fullResult.modules.pharma?.overallRaw || 0, systemCount: fullResult.modules.pharma?.systems.filter(s => s.weightedScore > 0).length || 0, totalSystems: fullResult.modules.pharma?.systems.length || 8 },
            { icon: '🧪', label: 'Анализы', risk: fullResult.modules.labs?.overallRaw || 0, systemCount: fullResult.modules.labs?.systems.filter(s => s.weightedScore > 0).length || 0, totalSystems: fullResult.modules.labs?.systems.length || 8 },
            { icon: '🥗', label: 'Питание', risk: fullResult.modules.nutrition?.overallRaw || 0, systemCount: fullResult.modules.nutrition?.systems.filter(s => s.weightedScore > 0).length || 0, totalSystems: fullResult.modules.nutrition?.systems.length || 8 },
            { icon: '🏋️', label: 'Тренинг', risk: fullResult.modules.training?.overallRaw || 0, systemCount: fullResult.modules.training?.systems.filter(s => s.weightedScore > 0).length || 0, totalSystems: fullResult.modules.training?.systems.length || 6 },
          ]} overallRisk={fullResult.overallRisk} />

          {/* Cross-module insights */}
          {(nutritionQuality !== undefined || trainingLoad !== undefined) && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>🔗 Кросс-модульные связи (TZ)</div>
              {nutritionQuality !== undefined && (
                <div style={{ ...GLASS_CARD, padding: '6px 10px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🥗</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: 'var(--text)' }}>Качество питания</div>
                    <div style={{ fontSize: 7, color: nutritionQuality < 60 ? '#ef4444' : '#22c55e' }}>{nutritionQuality}%</div>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>→</span>
                  <span>🫁</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: 'var(--text)' }}>Печень</div>
                    <div style={{ fontSize: 7, color: (fullResult.modules.support?.systems?.find(s => s.id === 'hepatic')?.weightedScore || 0) >= 60 ? '#ef4444' : '#22c55e' }}>
                      {fullResult.modules.support?.systems?.find(s => s.id === 'hepatic')?.weightedScore || 0}% риск
                    </div>
                  </div>
                </div>
              )}
              {trainingLoad !== undefined && (
                <div style={{ ...GLASS_CARD, padding: '6px 10px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🏋️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: 'var(--text)' }}>Нагрузка тренинга</div>
                    <div style={{ fontSize: 7, color: trainingLoad > 50 ? '#ef4444' : '#22c55e' }}>{trainingLoad}%</div>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>→</span>
                  <span>🧠</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: 'var(--text)' }}>Нервная система</div>
                    <div style={{ fontSize: 7, color: (fullResult.modules.support?.systems?.find(s => s.id === 'neuro')?.weightedScore || 0) >= 60 ? '#ef4444' : '#22c55e' }}>
                      {fullResult.modules.support?.systems?.find(s => s.id === 'neuro')?.weightedScore || 0}% риск
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Score History Trends Chart */}
          <ScoreHistoryChart days={30} />

          {/* All recommendations */}
          <ModuleRecsView recommendations={fullResult.recommendations} />

          {/* Archive */}
          {savedReports.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>📂 Архив отчётов ({savedReports.length})</div>
              {savedReports.slice(0, 3).map(r => (
                <div key={r.id} style={{ ...GLASS_CARD, padding: '6px 10px', marginBottom: 3 }}>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{new Date(r.date).toLocaleString('ru-RU')} · {r.module || '—'}</div>
                  <div style={{ fontSize: 9, color: 'var(--text)' }}>{r.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
        <button onClick={handleGenerateReport} style={PILL_BTN}>📋 Сгенерировать отчёт</button>
        {moduleTab === 'support' && suggestedPlan.length > 0 && (
          <button onClick={() => handleApply(suggestedPlan)} style={applied ? { ...PILL_BTN, background: '#22c55e', color: '#000' } : PILL_BTN}>
            {applied ? '✅ План применён' : '✅ Применить план в калькулятор'}
          </button>
        )}
        {moduleTab === 'full' && enrichedPlan.length > 0 && (
          <button onClick={() => handleApply(enrichedPlan)} style={applied ? { ...PILL_BTN, background: '#22c55e', color: '#000' } : PILL_BTN}>
            {applied ? '✅ План применён' : '✅ Применить enriched план в калькулятор'}
          </button>
        )}
      </div>

      {showCopied && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 12,
          padding: '8px 16px', fontSize: 10, color: 'var(--accent)', zIndex: 999,
          whiteSpace: 'nowrap',
        }}>
          📋 Отчёт скопирован в буфер
        </div>
      )}
    </div>
  );
};

export default AutoCalculator;
