import React, { useMemo, useState, useEffect } from 'react';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { loadTrainingProfile } from './training-profile';
import { useDataLink } from '../../../core/data-link';
import { labTrainingAdjust } from './lab-training-adjust';
import { PopupSelect, PopupNumber, ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { adaptForPEDs } from '../../../engines/bb/bb-ped-adaptation.engine';
import { analyzeProQuality } from '../../../engines/manual-constructor/pro-quality-analysis.engine';
import TrainingMetricsChart from '../SRCBBScreen_parts/TrainingMetricsChart';
import { applyToPlanner } from './planner-bridge';
import { composeQualityScoreV2 } from '../../../engines/quality-score-v2.engine';
import { deriveV2InputFromProgram, programForDivision } from './quality-hub-helpers';
import { PerMuscleBars, QualityScoreCard, useQualityCharts, useQualityProgram } from './quality-hub-parts';
import { QualityActions } from './QualityActions';

const ACCENT = '#00e68a';
const DIM = '#fff';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD_GLASS: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;
const SMALL_W: React.CSSProperties = { fontSize: 10, color: '#fff', lineHeight: 1.45 };
const ru = (g: string) => GROUP_RU[g] || g;

type Division = 'bb' | 'pl';
type LevelKey = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

/**
 * CalcQualityTab PRO — профессиональный калькулятор качества программ.
 * Два разделения: ПЛ (сила) и ББ (гипертрофия), кнопка учета ПЕД + всех ключевых параметров,
 * живой пересчет, сравнение натурал/курс, лабораторная коррекция, детальный разбор.
 */
export const CalcQualityTab: React.FC<{ program?: UserProgram | null; level?: string; goal?: string; onBuildPlan: () => void }> = ({ program: propsProgram, level = 'intermediate', goal = 'hypertrophy', onBuildPlan }) => {
  const linked = useDataLink();
  // P7: выбор программы + разделение вынесены в useQualityProgram (логика 1-в-1).
  const { programs, selectedId, setSelectedId, division, setDivision, selectedProgram, isHybrid } = useQualityProgram(propsProgram);
  const [levelOverride, setLevelOverride] = useState<LevelKey | ''>('');
  const [usePed, setUsePed] = useState<boolean>(() => {
    try { return !!loadTrainingProfile().onCourse; } catch { return false; }
  });
  const [courseIntensity, setCourseIntensity] = useState<'mild' | 'moderate' | 'heavy'>(() => {
    try { const c = loadTrainingProfile().courseIntensity; return (c === 'mild' || c === 'heavy' ? c : 'moderate'); } catch { return 'moderate'; }
  });
  const [useLab, setUseLab] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const effectiveLevel = (levelOverride || selectedProgram?.meta.level || level) as string;
  const prof = useMemo(() => loadTrainingProfile(), []);

  const labAdjust = useMemo(() => labTrainingAdjust(useLab ? (linked.labAnalysis ?? null) : null), [linked.labAnalysis, useLab]);
  const labMult = labAdjust.mrvMultiplier;

  // Подхватываем дозы ПЕД из профиля для точного расчета (если включен учет)
  const pedDoses = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      return raw?.pedDoses || {};
    } catch { return {}; }
  }, []);
  const peds = useMemo(() => {
    if (!usePed) return [];
    try {
      const sp = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      const list = sp?.peds as string[] | undefined;
      if (Array.isArray(list) && list.length) return list as any;
    } catch {}
    return prof.onCourse ? (['AAS'] as any) : [];
  }, [usePed, prof.onCourse]);

  const [pedDosesEdit, setPedDosesEdit] = useState<Record<string, number>>(() => pedDoses);
  useEffect(() => { setPedDosesEdit(pedDoses); }, [pedDoses]);
  useEffect(() => {
    if (!usePed) return;
    try {
      const cur = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      const next = { ...cur, pedDoses: pedDosesEdit };
      localStorage.setItem('he_pl_session', JSON.stringify(next));
    } catch {}
  }, [pedDosesEdit, usePed]);

  const pedAdapt = useMemo(() => {
    if (!usePed || peds.length === 0) return null;
    const base: Record<string, number> = { chest: 20, back: 22, legs: 20, shoulders: 14, arms: 14, core: 12 };
    try { return adaptForPEDs(peds as any, base, pedDosesEdit, courseIntensity); } catch { return null; }
  }, [usePed, peds, pedDosesEdit, courseIntensity]);

  // Вычисляем анализ для выбранного разделения — с учётом hybrid и PL-синтетики
  const analysis = useMemo(() => {
    if (!selectedProgram) return null;
    const progForCalc = programForDivision(selectedProgram, division, (id: string) => getCycleById(id));
    if (!progForCalc) return null;
    return computePlanQualityFor(progForCalc as UserProgram, effectiveLevel, {
      onCourse: usePed,
      courseIntensity: courseIntensity as any,
      labMult: labMult,
      division,
      enableV2: true,
    });
  }, [selectedProgram, effectiveLevel, usePed, courseIntensity, labMult, division]);

  const analysisNatural = useMemo(() => {
    if (!usePed || !selectedProgram) return null;
    const progForCalc = programForDivision(selectedProgram, division, (id: string) => getCycleById(id));
    if (!progForCalc) return null;
    return computePlanQualityFor(progForCalc as UserProgram, effectiveLevel, { onCourse: false, courseIntensity: 'moderate', labMult: useLab ? labMult : 1, division, enableV2: true });
  }, [selectedProgram, effectiveLevel, usePed, useLab, labMult, division]);

  const pro = useMemo(() => {
    if (!selectedProgram || !analysis) return null;
    try {
      const g = (selectedProgram.meta.goal || goal || 'hypertrophy') as string;
      return analyzeProQuality(selectedProgram, division, effectiveLevel, g, analysis.perMuscle);
    } catch { return null; }
  }, [selectedProgram, division, effectiveLevel, goal, analysis]);

  // ——— P6: V2-оценка из факта программы (канон quality-score-v2) ———
  const v2 = useMemo(() => {
    if (!selectedProgram) return null;
    try {
      const input = deriveV2InputFromProgram(selectedProgram as any, division, effectiveLevel);
      if (!input) return null;
      return composeQualityScoreV2(input);
    } catch { return null; }
  }, [selectedProgram, division, effectiveLevel]);

  const overloadFix = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of analysis?.perMuscle || []) if (p.status === 'over') out[p.muscle] = p.mav;
    return out;
  }, [analysis]);

  const weakGroups = useMemo(
    () => (analysis?.perMuscle || []).filter(p => p.status === 'low').map(p => p.muscle),
    [analysis],
  );

  const needsDeload = useMemo(() => {
    try {
      const weeks: any[] = (selectedProgram?.bb as any)?.weeks || (selectedProgram?.hybrid as any)?.bbWeeks || [];
      if (weeks.length >= 6) return !weeks.some((w: any) => w?.deload || w?.phase === 'deload');
      return false;
    } catch { return false; }
  }, [selectedProgram]);

  const splitCandidates = useMemo(
    () => (v2?.perMuscle || [])
      .filter(m => m.frequency < 2 && m.weeklySets > m.mav)
      .map(m => ({ muscle: m.muscle, weeklySets: m.weeklySets, frequency: m.frequency })),
    [v2],
  );

  // ——— P7: все чарты/экстры вынесены в useQualityCharts (логика 1-в-1) ———
  const { lmsChart, bbChart, bbWeeklyChart, bbExtra, plExtra, bbReportExtras, plReportExtras } = useQualityCharts(selectedProgram, division, analysis);

  // hybrid: показываем ББ+ПЛ совместно (isHybrid — из useQualityProgram)
  const hasData = !!(selectedProgram && (division === 'bb' ? selectedProgram.bb || isHybrid : selectedProgram.pl || isHybrid));
  const hasAnyProgram = programs.length > 0 || !!propsProgram;

  if (!hasAnyProgram) {
    return (
      <div className="train-qualitycalc" style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['bb', 'pl'] as Division[]).map(d => (
            <button key={d} onClick={() => setDivision(d)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: division === d ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: division === d ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: division === d ? ACCENT : '#fff' }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          ))}
        </div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 12, lineHeight: 1.5 }}>Нет сохранённых программ. Создайте программу в «Планировщик» → «Мои программы» — и здесь появится полный разбор: объём по группам (MEV/MAV/MRV), PED-коррекция, лабораторная коррекция, рекомендации.</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Перейти к построению плана</button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['bb', 'pl'] as Division[]).map(d => (
            <button key={d} onClick={() => setDivision(d)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: division === d ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: division === d ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: division === d ? ACCENT : '#fff' }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          ))}
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>Разделение «{division === 'bb' ? 'ББ' : 'ПЛ'}» не содержит данных в выбранной программе «{selectedProgram?.meta.title}».</div>
          <div style={{ fontSize: 11, color: '#fff', marginBottom: 12 }}>{division === 'bb' ? 'ББ-программа хранит недели → сессии → блоки (мышечные группы). Создайте ББ-план в ПЛ/ББ-авто или ручном конструкторе.' : 'ПЛ-программа хранит недели → дни → упражнения (присед/жим/тяга). Клонируйте СРЦ-цикл или создайте кастом.'}</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Открыть планировщик</button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 12 }}>Недостаточно данных для оценки. Добавьте упражнения в программу «{selectedProgram?.meta.title}».</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Редактировать программу</button>
        </div>
      </div>
    );
  }

  const sc = analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#f59e0b' : '#ef4444';
  const pedOn = usePed;
  const programOptions = programs.map(p => ({ id: p.meta.id, label: `${p.meta.title} · ${p.meta.direction.toUpperCase()} · ${p.meta.level}`, desc: `${p.meta.weeks} нед · ${p.meta.daysPerWeek} дн/нед` }));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 8px 18px', color: '#fff' }}>
      <div style={{ ...CARD_GLASS, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(167,139,250,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>🎯</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Качество программ — PRO</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>ПЛ · ББ · Гибрид — один расчёт MEV/MAV/MRV + PED + лаборатория. Без дублей.</div>
          </div>
          <span style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background: sc+'18', border:`1px solid ${sc}55`, color: sc, fontWeight:800, whiteSpace:'nowrap' }}>{analysis.grade} · {analysis.score}/100</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> выбери программу и разделение — <b style={{ color:ACCENT }}>ПЛ</b> сила, <b style={{ color:'#a78bfa' }}>ББ</b> гипертрофия. <span style={{ color:ACCENT }}>MEV/MAV/MRV</span> + PED + лаборатория — один живой расчёт.
        </div>
      </div>

      {/* Выбор программы */}
      {programs.length > 1 && (
        <div style={{ marginBottom: 8 }}>
          <PopupSelect label="Программа" value={selectedProgram.meta.id} options={programOptions} onChange={setSelectedId} />
        </div>
      )}
      {selectedProgram && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span><b style={{ color: ACCENT }}>{selectedProgram.meta.title}</b> · {selectedProgram.meta.direction.toUpperCase()} {isHybrid ? '· HYBRID' : ''} · {selectedProgram.meta.level} · {selectedProgram.meta.weeks} нед</span>
          <span style={{ color: '#fff' }}>{division === 'bb' ? 'ББ-недель: ' + ((selectedProgram.bb?.weeks.length || 0) || (isHybrid ? (selectedProgram.hybrid?.bbWeeks?.length || 0) : 0)) : 'ПЛ-недель: ' + (selectedProgram.pl?.customWeeks?.length || (selectedProgram.pl?.sourceCycleId ? 1 : 0))}</span>
        </div>
      )}

      {/* Разделения */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['bb', 'pl'] as Division[]).map(d => {
          const active = division === d;
          return (
            <button key={d} onClick={() => setDivision(d)} style={{
              flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 12,
              border: active ? `1px solid ${d === 'bb' ? '#a78bfa' : ACCENT}` : '1px solid rgba(255,255,255,0.08)',
              background: active ? (d === 'bb' ? 'rgba(167,139,250,0.14)' : 'rgba(0,230,138,0.14)') : 'rgba(255,255,255,0.02)',
              color: active ? (d === 'bb' ? '#a78bfa' : ACCENT) : '#fff',
            }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          );
        })}
      </div>

      {/* Параметры — уровень + ПЕД + лаборатория */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupSelect label="Уровень" value={effectiveLevel} options={[
          { id: 'beginner', label: 'Новичок', desc: 'MEV низкий, MRV до 15' },
          { id: 'intermediate', label: 'Средний', desc: 'MEV 8-10, MRV до 20-24' },
          { id: 'advanced', label: 'Продвинутый', desc: 'MEV 10-12, MRV до 28' },
          { id: 'enhanced', label: 'Enhanced (ПЕД)', desc: 'MRV +15% и выше' },
        ]} onChange={v => setLevelOverride(v as LevelKey)} />
        <div style={{ padding: '8px 10px', borderRadius: 12, border: `1px solid ${pedOn ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`, background: pedOn ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: pedOn ? '#f87171' : '#fff' }}>{pedOn ? '💉 На курсе — ПЕД учитывается' : '🌱 Натурал — без ПЕД'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setUsePed(false)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 800, border: !pedOn ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !pedOn ? 'rgba(34,197,94,0.15)' : 'transparent', color: !pedOn ? '#22c55e' : '#fff' }}>Натурал</button>
            <button onClick={() => setUsePed(true)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 800, border: pedOn ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: pedOn ? 'rgba(239,68,68,0.14)' : 'transparent', color: pedOn ? '#f87171' : '#fff' }}>На курсе</button>
          </div>
          {pedOn && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['mild', 'moderate', 'heavy'] as const).map(k => {
                const on = courseIntensity === k;
                const label = k === 'mild' ? 'Mild' : k === 'moderate' ? 'Moderate' : 'Heavy';
                return <button key={k} onClick={() => setCourseIntensity(k)} style={{ padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 9, fontWeight: 700, border: on ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(239,68,68,0.12)' : 'transparent', color: on ? '#f87171' : '#fff' }}>{label}{on ? ' ✓' : ''}</button>;
              })}
            </div>
          )}
          {pedOn && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <PopupNumber label="AAS мг/нед" value={pedDosesEdit['AAS'] || 0} min={0} max={3000} step={50} onChange={v => setPedDosesEdit(p => ({ ...p, AAS: v }))} />
              <PopupNumber label="GH МЕ/день" value={pedDosesEdit['GH'] || 0} min={0} max={15} step={1} onChange={v => setPedDosesEdit(p => ({ ...p, GH: v }))} />
              <PopupNumber label="Инсулин МЕ/день" value={pedDosesEdit['insulin'] || 0} min={0} max={40} step={2} onChange={v => setPedDosesEdit(p => ({ ...p, insulin: v }))} />
              <PopupNumber label="IGF-1 мкг/день" value={pedDosesEdit['IGF1'] || 0} min={0} max={200} step={10} onChange={v => setPedDosesEdit(p => ({ ...p, IGF1: v }))} />
            </div>
          )}
          {pedOn && pedAdapt && (
            <>
              <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.3 }}>MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · Восст ×{pedAdapt.combinedRecoveryMultiplier.toFixed(2)} · {pedAdapt.periWorkoutCarbs === 'high' ? 'Углеводы высокие' : 'Углеводы умеренные'}</div>
              {pedAdapt.perPED.length > 0 && (
                <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pedAdapt.perPED.map(p => (
                    <div key={p.ped} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{p.ped} {p.dose > 0 ? `${p.dose}${p.ped === 'AAS' ? 'мг' : p.ped === 'GH' || p.ped === 'insulin' ? 'МЕ' : 'мкг'}` : ''}</span>
                      <span style={{ color: '#f87171' }}>×{p.mrvMult.toFixed(2)}/×{p.recMult.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {pedAdapt.rationale.slice(0, 2).map((r, i) => <div key={i} style={{ fontSize: 8, color: '#fff', lineHeight: 1.3 }}>• {r}</div>)}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setUseLab(v => !v)} style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 10, border: useLab ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: useLab ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)', color: useLab ? '#f59e0b' : '#fff' }}>{useLab ? `🧪 Лаборатория учтена ×${labMult.toFixed(2)}` : '🧪 Учитывать лабораторию'}</button>
        <button onClick={() => setShowDetails(v => !v)} style={{ padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#fff' }}>{showDetails ? 'Скрыть детали' : 'Показать детали'}</button>
      </div>
      {useLab && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          {linked.labAnalysis ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6, fontSize: 9 }}>
              <span>Печень: <b style={{ color: linked.labAnalysis.liverStress > 40 ? '#ef4444' : '#22c55e' }}>{linked.labAnalysis.liverStress}</b></span>
              <span>Почки: <b style={{ color: linked.labAnalysis.kidneyStress > 40 ? '#ef4444' : '#22c55e' }}>{linked.labAnalysis.kidneyStress}</b></span>
              <span>Воспаление: <b style={{ color: linked.labAnalysis.inflammation > 40 ? '#ef4444' : '#22c55e' }}>{linked.labAnalysis.inflammation}</b></span>
              <span>Гормоны: <b style={{ color: linked.labAnalysis.hormoneScore < 60 ? '#f59e0b' : '#22c55e' }}>{linked.labAnalysis.hormoneScore}</b></span>
              <span>Кардио-риск: <b style={{ color: linked.labAnalysis.cardioRisk > 40 ? '#ef4444' : '#22c55e' }}>{linked.labAnalysis.cardioRisk}</b></span>
              <span>MRV ×{labMult.toFixed(2)}</span>
            </div>
          ) : <div style={{ marginBottom: 6, color: '#f59e0b' }}>Нет данных лаборатории — сдайте анализы для точной коррекции.</div>}
          {labAdjust.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          {labAdjust.intensityNote && <div style={{ marginTop: 4, color: '#f59e0b' }}>💡 {labAdjust.intensityNote}</div>}
        </div>
      )}
      {pedOn && pedAdapt?.risks.length ? (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          {pedAdapt.risks.slice(0, 3).map((r, i) => <div key={i}>⚠ {r}</div>)}
        </div>
      ) : null}

      {/* Сравнение натурал vs курс */}
      {usePed && analysisNatural && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#fff' }}>
          <span>Натурал: <b style={{ color: analysisNatural.score >= 80 ? '#22c55e' : analysisNatural.score >= 50 ? '#f59e0b' : '#ef4444' }}>{analysisNatural.score}/100 {analysisNatural.grade}</b></span>
          <span>С ПЕД: <b style={{ color: sc }}>{analysis.score}/100 {analysis.grade}</b></span>
          <span style={{ color: analysis.score > analysisNatural.score ? '#22c55e' : '#fff' }}>{analysis.score - analysisNatural.score > 0 ? `+${analysis.score - analysisNatural.score}` : `${analysis.score - analysisNatural.score}`} баллов</span>
        </div>
      )}
      {isHybrid && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 10, color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span>🔀 Гибрид: оцените обе вкладки — <b>ББ</b> и <b>ПЛ</b> отдельно, затем сравните PRO-корректировки.</span>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>{division === 'bb' ? 'ББ вид' : 'ПЛ вид'}</span>
          <button onClick={() => setDivision(d => d === 'bb' ? 'pl' : 'bb')} style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.12)', color: '#a78bfa', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>⇄ Сравнить гибрид</button>
        </div>
      )}

      {/* Score */}
      <QualityScoreCard
        analysis={analysis}
        division={division}
        sc={sc}
        contextLine={`Уровень ${effectiveLevel} · ${pedOn ? `ПЕД ×${pedAdapt?.combinedMrvMultiplier.toFixed(2) ?? '1.2'}` : 'Натурал'} · Лаб ×${labMult.toFixed(2)} · ${division === 'bb' ? 'ББ-объём по мышцам' : 'ПЛ-объём по группам'} · ${analysis.perMuscle.length} групп`}
      />

      <PerMuscleBars perMuscle={analysis.perMuscle} division={division} />

      {/* PRO — паттерны / углы / растяжка / техника / цель */}
      {pro && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: pro.scoreDelta >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${pro.scoreDelta >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: pro.scoreDelta >= 0 ? '#22c55e' : '#f87171' }}>PRO-корректировка: {pro.scoreDelta >= 0 ? `+${pro.scoreDelta}` : `${pro.scoreDelta}`} баллов</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: sc }}>Итог PRO: {Math.max(0, Math.min(100, analysis.score + pro.scoreDelta))}/100</span>
            <span style={{ fontSize: 10, color: '#fff' }}>Паттерны {pro.patterns.filter(p => p.ok).length}/{pro.patterns.length} · Углы {pro.angles.filter(a => a.ok).length}/{pro.angles.length} · Растяжка {pro.stretches.filter(s => s.ok).length}/{pro.stretches.length}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔀 Паттерны — разнообразие движений</div>
              {pro.patterns.map(p => (
                <div key={p.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, marginBottom: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(p.muscle)}: {p.patterns.join(', ') || '—'}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ color: p.ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{p.distinct} / {p.expected.length} {p.ok ? '✓' : '⚠'}</span>
                    {!p.ok && p.distinct > 0 && (
                      <button
                        onClick={() => {
                          const missing = p.expected.find(x => !p.patterns.includes(x));
                          if (!missing) return;
                          try { applyToPlanner({ kind: 'weakpoints', label: `Добавить паттерн ${missing} для ${ru(p.muscle)}`, data: { groups: [p.muscle] } as any }); } catch {}
                        }}
                        style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}
                      >
                        ➕ {p.expected.find(x => !p.patterns.includes(x)) || 'паттерн'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {pro.patterns.every(p => p.ok) && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 4 }}>Паттерны покрыты — разнообразие достаточное для гипертрофии/силы.</div>}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📐 Углы — проработка головок/сегментов</div>
              {pro.angles.map(a => (
                <div key={a.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, marginBottom: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(a.muscle)}: {a.angles.join(', ') || '—'}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ color: a.ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{Math.round(a.coverage * 100)}% {a.ok ? '✓' : '⚠'}</span>
                    {!a.ok && a.angles.length > 0 && (
                      <button
                        onClick={() => {
                          const missing = a.expected.find(x => !a.angles.includes(x));
                          if (!missing) return;
                          try { applyToPlanner({ kind: 'weakpoints', label: `Добавить угол ${missing} для ${ru(a.muscle)}`, data: { groups: [a.muscle] } as any }); } catch {}
                        }}
                        style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}
                      >
                        ➕ {a.expected.find(x => !a.angles.includes(x)) || 'угол'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🧘 Растяжка — stretch-фаза / удлинённая позиция</div>
              {pro.stretches.map(s => (
                <div key={s.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, marginBottom: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(s.muscle)}: {s.stretchExercises.join(', ') || '—'}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ color: s.ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{s.ok ? 'есть ✓' : 'нет ✕'}</span>
                    {!s.ok && (
                      <button
                        onClick={() => {
                          try { applyToPlanner({ kind: 'weakpoints', label: `Добавить растяжку для ${ru(s.muscle)}`, data: { groups: [s.muscle] } as any }); } catch {}
                        }}
                        style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}
                      >
                        ➕ stretch
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: pro.technique.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${pro.technique.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>⚡ Техника — интенсификация</div>
              <div style={{ fontSize: 10, color: '#fff' }}>Блоков с техникой: <b style={{ color: pro.technique.ok ? '#22c55e' : '#f59e0b' }}>{pro.technique.withTechnique}/{pro.technique.totalBlocks} ({pro.technique.pct}%)</b> · distinct: {pro.technique.distinct.join(', ') || 'нет'}</div>
              {pro.technique.issue && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>{pro.technique.issue}</div>}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: pro.goalAlignment.ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${pro.goalAlignment.ok ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🎯 Привязка к цели — «{pro.goalAlignment.goal}»</div>
              <div style={{ fontSize: 10, color: '#fff' }}>Объём {pro.goalAlignment.volumePctAvg}% MRV · Техники {pro.goalAlignment.techniquePct}% · Растяжка {Math.round(pro.goalAlignment.stretchCoverage * 100)}%</div>
              {pro.goalAlignment.issue && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>{pro.goalAlignment.issue}</div>}
              {pro.goalAlignment.recommendation && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 4 }}>💡 {pro.goalAlignment.recommendation}</div>}
            </div>

            {(pro.totalIssues.length > 0 || pro.totalRecommendations.length > 0) && (
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                {pro.totalIssues.slice(0, 6).map((iss, i) => <div key={i} style={{ color: '#f59e0b' }}>• {iss}</div>)}
                {pro.totalRecommendations.slice(0, 6).map((r, i) => <div key={`r-${i}`} style={{ color: '#22c55e' }}>{r}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* P6: V2-оценка + действия (снапшоты/сравнение/фиксы/экспорт/мост) */}
      {selectedProgram && analysis && (
        <QualityActions
          programId={selectedProgram.meta.id}
          title={selectedProgram.meta.title}
          division={division}
          level={effectiveLevel}
          pedLabel={pedOn ? `ПЕД ×${pedAdapt?.combinedMrvMultiplier.toFixed(2) ?? '1.2'}` : 'Натурал'}
          base={{ score: analysis.score, grade: analysis.grade, perMuscle: analysis.perMuscle }}
          v2={v2}
          overloadFix={overloadFix}
          weakGroups={weakGroups}
          needsDeload={needsDeload}
          proDelta={pro?.scoreDelta ?? null}
          splitCandidates={splitCandidates}
        />
      )}

      {/* BB/PL отчет — доп. без дублей (фазы, методики, баланс, прогрессия) */}
      {division === 'bb' && bbReportExtras && (
        <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>🧩 ББ-отчет (дополнительно к PRO) — фазы/методики/баланс</div>
          <div>Фазы: {Object.entries(bbReportExtras.phaseCount).map(([k, v]) => `${k}×${v}`).join(' · ') || '—'} · Пик нед {bbReportExtras.peakWeek} · Прогрессия тоннажа {bbReportExtras.progPct >= 0 ? `+${bbReportExtras.progPct}` : bbReportExtras.progPct}%</div>
          <div>Баланс тяги/жимы: {bbReportExtras.pull}/{bbReportExtras.press} (ratio {bbReportExtras.ratio}) {bbReportExtras.ratio < 0.9 ? '⚠ тяг мало' : bbReportExtras.ratio > 1.3 ? '⚠ перекос в тяги' : '✓'}</div>
          <div>Методики: superset {bbReportExtras.superset} · техники {bbReportExtras.tech} {bbReportExtras.dup ? `· DUP ${bbReportExtras.dup}` : ''}</div>
          <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Источник: bb-report.engine (фазы/методики/баланс) — без дубля PRO-паттернов.</div>
        </div>
      )}
      {division === 'pl' && plReportExtras && (
        <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>🏋️ ПЛ-отчет — фазы/прогрессия КПШ</div>
          <div>Фазы: {Object.entries(plReportExtras.phaseCount).map(([k, v]) => `${k}×${v}`).join(' · ') || '—'} · Недель {plReportExtras.weeks} · Пик КПШ {plReportExtras.peakK} · Прогрессия {plReportExtras.progPct >= 0 ? `+${plReportExtras.progPct}` : plReportExtras.progPct}%</div>
          <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Источник: PLPlanView/лмс (фазы/тапер) — тоннаж/КПШ уже в графиках.</div>
        </div>
      )}

      {/* Графики — полный комплект параметров качества */}
      {division === 'pl' && lmsChart && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📈 Графики нагрузки ПЛ — тоннаж / КПШ / интенсивность (источники: Фунтиков, Черняк, Прилепин, Шейко)</div>
          <TrainingMetricsChart lms={lmsChart} />
          {plExtra && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: '#fff' }}>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>КПШ/нед: <b>{plExtra.totalKpsh}</b> · Тоннаж: <b>{plExtra.totalTonnage.toLocaleString('ru-RU')} кг</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Частота присед/жим/тяга: <b>{plExtra.freqPerWeek.squat}× / {plExtra.freqPerWeek.bench}× / {plExtra.freqPerWeek.dead}×</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', gridColumn: '1 / -1' }}>
                Зоны Прилепина КПШ: {Object.entries(plExtra.zoneCounts).map(([k, v]) => `${k}%: ${v}`).join(' · ')}
              </div>
            </div>
          )}
          <div style={{ fontSize: 9, color:'#fff', marginTop: 6, lineHeight: 1.4 }}>
            Тоннаж = Σвес×пов×под×Множ · КПШ = Σпов×под · Ср.вес = Тоннаж/КПШ · Инт.отн = Ср.вес/(PM×Множ) · УОИ = ΣКПШ×Коэф/ΣКПШ · Инт.Ф+Б = Σk(вес/PM)×вес×пов×под×Множ×Коэф. По Прилепину: оптимум 60-70% — КПШ 18-30, 70-80% — 12-24 и т.д.
          </div>
        </div>
      )}
      {division === 'bb' && bbChart && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📊 Графики объёма ББ — тяж/памп vs MRV (Israetel, Schoenfeld, Helms)</div>
          <TrainingMetricsChart bb={bbChart} />
          {bbWeeklyChart && bbWeeklyChart.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Прогрессия ББ по неделям — тоннаж и эфф. сеты</div>
              <TrainingMetricsChart lms={bbWeeklyChart as any} />
            </div>
          )}
          {bbExtra && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: '#fff' }}>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Всего сетов/нед: <b>{bbExtra.totalSets}</b> · эфф. {bbExtra.effectiveSets}</div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Хард RIR&lt;1: <b style={{ color: bbExtra.hardSets > 6 ? '#ef4444' : '#fff' }}>{bbExtra.hardSets}</b> · Ср.RIR {bbExtra.avgRir.toFixed(1)}</div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Тоннаж/нед: <b>{bbExtra.tonnage.toLocaleString('ru-RU')} кг</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Частота ср.: <b>{bbExtra.avgFreq}×/нед</b> · {Object.entries(bbExtra.freqPerWeek).slice(0, 3).map(([k, v]) => `${ru(k)} ${v}×`).join(' · ')}</div>
            </div>
          )}
          <div style={{ fontSize: 9, color: '#fff', marginTop: 6, lineHeight: 1.3 }}>Israetel: MEV/MAV/MRV по уровню; Schoenfeld: частота 2×/нед для гипертрофии; Helms: hard-cap по уровню (нач 3/ сред 6/ продв 10). Зелёный — тяж, голубой — памп, красный пунктир — MRV.</div>
        </div>
      )}

      {showDetails && (
        <ExpandableCard title="📊 Детальный разбор" icon="🔬" short="Нажмите чтобы раскрыть методологию" full={
          <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 6 }}><b style={{ color: ACCENT }}>Методология:</b> MEV/MAV/MRV из <i>Israetel Hypertrophy Guide</i> по уровню ({effectiveLevel}) + PED-надбавка {pedOn ? `×${pedAdapt?.combinedMrvMultiplier.toFixed(2)}` : '×1.0'} + лаб-коррекция ×{labMult.toFixed(2)}. Пик — макс недельный объём, среднее — по мезоциклу.</div>
            <div style={{ marginBottom: 6 }}><b>Статусы:</b> <span style={{ color: '#3b82f6' }}>low</span> — ниже MEV (недогруз), <span style={{ color: '#22c55e' }}>ok</span> — оптимум, <span style={{ color: '#f59e0b' }}>high</span> — ≥MAV, <span style={{ color: '#ef4444' }}>over</span> — сверх MRV (перетрен).</div>
            <div style={{ marginBottom: 6 }}><b>ПЛ vs ББ:</b> ББ — 15 групп, акцент на гипертрофию (объём сетов, частота 2×/нед Schoenfeld 2016, hard-cap Helms); ПЛ — те же 6 групп, но акцент на интенсивность (Прилепин КПШ, Фунтиков k, Черняк Инт.отн, УОИ).</div>
            <div style={{ marginBottom: 6 }}><b>Источники:</b> Israetel Hypertrophy Guide (MEV/MAV/MRV), Schoenfeld 2017 (volume/frequency), Helms 2018 (hard sets), Прилепин 1974 (КПШ зоны), Шейко 2005 (тоннаж), Фунтиков 1979 (k-таблица), Черняк 2003 (Инт.отн), Bondarenko 1982 (УОИ/коэфф.).</div>
            <div style={{ marginBottom: 6 }}><b>Паттерны/углы:</b> Israetel 2020 (exercise variation), Contreras 2013 (glute), Schoenfeld 2021 (stretch-mediated hypertrophy — удлинённая позиция +10-15% роста).</div>
            <div style={{ fontSize: 9, color: '#fff' }}>Подсказка: ББ пик 85-95% MRV, ПЛ 70-85% MRV. PED dose-aware (кривая AAS 0-3000мг, GH 0-15МЕ), лаборатория 0.7-1.0 по печени/почкам/воспалению. Техники: ББ 10-30%, ПЛ 5-15%.</div>
          </div>
        } />
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onBuildPlan} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Редактировать программу</button>
        <button onClick={() => setDivision(d => d === 'bb' ? 'pl' : 'bb')} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>⇄ Переключить на {division === 'bb' ? 'ПЛ' : 'ББ'}</button>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            if (!pro) return;
            const recs = pro.totalRecommendations.slice(0, 6).join('\n');
            if (!recs) return;
            try {
              applyToPlanner({ kind: 'weakpoints', label: `Калькулятор качества PRO: ${division.toUpperCase()} — применить`, data: { groups: pro.patterns.filter(p => !p.ok).map(p => p.muscle) } as any });
            } catch {}
            navigator.clipboard?.writeText(recs).catch(() => {});
          }}
          style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', cursor: 'pointer', fontWeight: 800, fontSize: 10 }}
        >
          🛠 Применить рекомендации PRO
        </button>
        <button
          onClick={() => {
            const header = `Калькулятор качества — ${division === 'bb' ? 'ББ' : 'ПЛ'} — ${selectedProgram?.meta.title || ''}`;
            const proScore = pro ? Math.max(0, Math.min(100, analysis.score + pro.scoreDelta)) : analysis.score;
            const linesCsv: string[][] = [
              ['Программа', selectedProgram?.meta.title || '', selectedProgram?.meta.direction || '', effectiveLevel, division],
              ['Оценка', String(analysis.score), analysis.grade, `PRO ${proScore}`],
              ['Уровень', effectiveLevel, pedOn ? `ПЕД ×${pedAdapt?.combinedMrvMultiplier.toFixed(2)}` : 'Натурал', `Лаб ×${labMult.toFixed(2)}`],
              [],
              ['Мышца', 'Пик', 'MEV', 'MAV', 'MRV', 'Статус', '%MRV', 'Ср/нед'],
              ...analysis.perMuscle.map(p => [ru(p.muscle), String(p.peakSets), String(p.mev), String(p.mav), String(p.mrv), p.status, String(p.mrv ? Math.round((p.peakSets / p.mrv) * 100) : 0), String(p.avgSets)]),
            ];
            // PRO-детали
            if (pro) {
              linesCsv.push([], ['PRO — Паттерны'], ...pro.patterns.map(p => [ru(p.muscle), p.patterns.join('|') || '—', `${p.distinct}/${p.expected.length}`, p.ok ? 'OK' : '⚠']));
              linesCsv.push([], ['PRO — Углы'], ...pro.angles.map(a => [ru(a.muscle), a.angles.join('|') || '—', `${Math.round(a.coverage * 100)}%`, a.ok ? 'OK' : '⚠']));
              linesCsv.push([], ['PRO — Растяжка'], ...pro.stretches.map(s => [ru(s.muscle), s.stretchExercises.join('|') || '—', s.ok ? 'есть' : 'нет']));
              linesCsv.push([], ['PRO — Техника', `${pro.technique.pct}%`, pro.technique.distinct.join('|') || 'нет', pro.technique.ok ? 'OK' : pro.technique.issue || '']);
              linesCsv.push([], ['PRO — Цель', pro.goalAlignment.goal, `${pro.goalAlignment.volumePctAvg}% MRV`, `${pro.goalAlignment.techniquePct}%`, `${Math.round(pro.goalAlignment.stretchCoverage * 100)}%`, pro.goalAlignment.ok ? 'OK' : pro.goalAlignment.issue || '']);
            }
            if (division === 'bb' && bbReportExtras) {
              linesCsv.push([], ['BB-отчет — Фазы', ...Object.entries(bbReportExtras.phaseCount).map(([k, v]) => `${k}×${v}`)]);
              linesCsv.push(['BB-отчет — Баланс', `${bbReportExtras.pull}/${bbReportExtras.press}`, `ratio ${bbReportExtras.ratio}`]);
              linesCsv.push(['BB-отчет — Методики', `superset ${bbReportExtras.superset}`, `tech ${bbReportExtras.tech}`, bbReportExtras.dup ? `DUP ${bbReportExtras.dup}` : '']);
            }
            if (division === 'pl' && plReportExtras) {
              linesCsv.push([], ['ПЛ-отчет — Фазы', ...Object.entries(plReportExtras.phaseCount).map(([k, v]) => `${k}×${v}`)]);
              linesCsv.push(['ПЛ-отчет — Пик КПШ', String(plReportExtras.peakK), `прогрессия ${plReportExtras.progPct}%`]);
            }
            const csv = linesCsv.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blobCsv = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const urlCsv = URL.createObjectURL(blobCsv);
            const aCsv = document.createElement('a');
            aCsv.href = urlCsv;
            aCsv.download = `quality-${division}-${(selectedProgram?.meta.title || 'program').replace(/\s+/g, '_')}.csv`;
            aCsv.click();
            URL.revokeObjectURL(urlCsv);
            const lines = [
              header,
              `Уровень: ${effectiveLevel} · ${pedOn ? `ПЕД ×${pedAdapt?.combinedMrvMultiplier.toFixed(2)}` : 'Натурал'} · Лаб ×${labMult.toFixed(2)}`,
              `Оценка: ${analysis.score}/100 ${analysis.grade} · PRO: ${pro ? Math.max(0, Math.min(100, analysis.score + pro.scoreDelta)) : analysis.score}/100`,
              `--- Объём ---`,
              ...analysis.perMuscle.map(p => `${ru(p.muscle)}: ${p.peakSets} сет (MEV${p.mev}/MAV${p.mav}/MRV${p.mrv}) ${p.status}`),
              `--- PRO ---`,
              ...(pro ? [`Паттерны: ${pro.patterns.map(p => `${ru(p.muscle)}:${p.distinct}/${p.expected.length}${p.ok ? '✓' : '✕'}`).join(' · ')}`, `Углы: ${pro.angles.map(a => `${ru(a.muscle)}:${Math.round(a.coverage * 100)}%`).join(' · ')}`, `Техника: ${pro.technique.pct}%`, `Цель: ${pro.goalAlignment.goal} ${pro.goalAlignment.ok ? '✓' : '✕'}`] : []),
              ...(lmsChart ? [`--- Тоннаж/КПШ (ПЛ) ---`, ...lmsChart.map(m => `Нед ${m.week}: тоннаж ${m.tonnage} кг · КПШ ${m.kpsh} · Инт ${m.relInt} · УОИ ${m.uoi}`)] : []),
              ...(bbExtra ? [`--- ББ метрики ---`, `Всего сетов ${bbExtra.totalSets} · эфф ${bbExtra.effectiveSets} · хард ${bbExtra.hardSets} · RIR ${bbExtra.avgRir.toFixed(1)} · тоннаж ${bbExtra.tonnage} кг`] : []),
            ];
            const text = lines.join('\n');
            navigator.clipboard?.writeText(text).catch(() => {});
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quality-${division}-${(selectedProgram?.meta.title || 'program').replace(/\s+/g, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 10 }}
        >
          📤 Экспорт отчёта
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 10 }}
        >
          🖨 Печать
        </button>
      </div>
    </div>
  );
};

export default CalcQualityTab;
