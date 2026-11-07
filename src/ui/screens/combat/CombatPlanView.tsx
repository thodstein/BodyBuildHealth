/**
 * CombatPlanView.tsx — премиальный рендер плана единоборств.
 * Стекло, градиенты, современные карточки недель/сессий/упражнений.
 */
import React from 'react';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildCombatReport, isCombatPlanBlocked } from '../../../engines/combat/combat-finalize.engine';
import { ruLabel, PHASE_RU, SESSION_TAG_RU, Badge, InfoBanner, BTN, BTN_PRIMARY, BTN_SMALL, INPUT, TEXT_3, Highlight, SectionCard, CardHeader, StatTile, GroupHeading, Divider, CombatPopupSelect } from './CombatUI';
import { AnnualCard } from './combat-annual-card';
import { CampStrip } from './cb-camp-strip';
import { CbCampCharts } from './cb-camp-charts';
import { CbVariants } from './cb-variants';
import { CbCampMeasurementsCard } from './cb-camp-measurements';
import { cbExerciseName } from '../../../engines/combat/combat-builder.engine';
import { combatToNutritionPayload } from '../../../engines/combat/combat-integration.engine';
import { ffmFromProfile } from '../../../engines/combat/combat-measurements.engine';
import { useProfileSection } from '../../../core/profile-manager';
import { combatMesocycleSummary } from '../../../engines/combat/combat-mesocycle';
import type { DiaryTrendCB } from '../../../engines/combat/combat-diary.engine';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';
import { buildCombatPrintHtml, downloadCombatCsv, buildCombatPlanIcs } from '../../../engines/combat/combat-print.engine';
import { downloadCombatXlsx } from '../../../engines/combat/combat-xlsx.engine';
import { weightCutNutritionForWeek, combatWeightCutToMealInput } from '../../../engines/combat/combat-weight-cut.engine';
import { ruCount, RU_SESSIONS } from '../../../engines/ru-plural';

type Props = {
  plan: CombatPlan;
  historyLen: number;
  onUndo: () => void;
  onUpdateEx: (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => void;
  onMoveEx: (wkIdx: number, day: number, exId: string, dir: -1 | 1) => void;
  onSwapEx: (wkIdx: number, day: number, exId: string, newId: string) => void;
  // годовой + экспорт (опционально прокидываются из конструктора)
  annual?: any;
  annualWeeks?: number;
  setAnnualWeeks?: (n: number) => void;
  annualCycles?: number;
  setAnnualCycles?: (n: number) => void;
  competitionName?: string;
  setCompetitionName?: (s: string) => void;
  competitionDate?: string;
  setCompetitionDate?: (s: string) => void;
  competitionWeight?: string;
  setCompetitionWeight?: (s: string) => void;
  competitionPriority?: 'main' | 'secondary';
  setCompetitionPriority?: (p: 'main' | 'secondary') => void;
  startDate?: string;
  outside?: any;
  outsideMetrics?: any;
  diaryLoad?: number | null;
  acwr?: { ratio: number; zone: string } | null;
  msg?: string;
  setMsg?: (s: string) => void;
  onBuildATR?: () => void;
  onAddCompetition?: () => void;
  onRemoveCompetition?: (id: string) => void;
  onRemoveAnnual?: () => void;
  annualCyclesHint?: number;
  onPrintAnnual?: () => void;
  onDownloadIcs?: () => void;
  onExportProgram?: () => void;
  /** Э5.2: сборка/печать/загрузка планов блоков года. */
  onBuildPlans?: () => void;
  onPrintBlock?: (block: any) => void;
  onLoadBlock?: (block: any) => void;
};

/* Карта качества шея/хват/core по неделям — переиспользуется в шаге «Качество» */
export const CbQualityMap: React.FC<{ plan: CombatPlan }> = ({ plan }) => (
  <SectionCard icon="✦" title="Карта качества" subtitle="Сеты/нед vs MEV/MRV — шея/хват/core" accent>
    <CardHeader icon="✦" title="Карта качества — сеты/нед" subtitle="vs MEV/MRV · подсветка зон" accent />
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {(['neck', 'grip', 'core'] as const).map(kind => (
        <div key={kind} style={{ display: 'flex', gap: 8, alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'8px 10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: kind === 'neck' ? '#c4b5fd' : kind === 'grip' ? '#fbbf24' : '#6ee7b7', minWidth: 48, display:'flex', alignItems:'center', gap:4 }}><span style={{ fontSize:11 }}>{kind==='neck'?'🦴': kind==='grip'?'✊':'🌀'}</span>{kind === 'neck' ? 'Шея' : kind === 'grip' ? 'Хват' : 'Core'}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {plan.weeksData.map(wk => {
              let sets = 0;
              if (kind === 'neck') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
              if (kind === 'grip') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('grip') || e.id.includes('pinch') || e.id.includes('wrist') || e.id.includes('farmer') || e.id.includes('towel')).reduce((a, e) => a + e.sets, 0), 0);
              if (kind === 'core') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank', 'pallof_rotation_press', 'suitcase_carry', 'landmine_rotation'].includes(e.id)).reduce((a, e) => a + e.sets, 0), 0);
              let col = '#a855f7';
              if (kind === 'core') col = sets < 4 ? '#f59e0b' : sets <= 10 ? '#a855f7' : '#eab308';
              else {
                const lm = getCombat(plan.level, kind as any);
                const st = lm ? (sets < lm.mev ? 'below' : sets <= lm.mav ? 'optimal' : sets <= lm.mrv ? 'high' : 'over') : 'optimal';
                col = st === 'below' ? '#f59e0b' : st === 'optimal' ? '#a855f7' : st === 'high' ? '#eab308' : '#ef4444';
              }
              return (
                <span key={wk.week} style={{ padding: '4px 8px', borderRadius: 10, background: col + '14', border: `0.5px solid ${col}2e`, color: col, fontSize: 11, fontWeight: 700, fontVariantNumeric:'tabular-nums' }}>
                  Н{wk.week} · <Highlight color={col}>{sets}</Highlight>{wk.deload ? ' · разгрузка' : (wk as any).taper ? ' · тапер' : ''}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight color="#a855f7">Фиолетовый</Highlight> оптимум · <Highlight color="#f59e0b">янтарь</Highlight> недобор · <Highlight color="#eab308">жёлтый</Highlight> высоко · <Highlight color="#ef4444">красный</Highlight> перебор</div>
  </SectionCard>
);

/* Кросс-мезо карта: что привнесла прогрессия из прошлого плана (движок был немым) */
export const CbMesoCard: React.FC<{ prev: CombatPlan | null; nextInput: any }> = ({ prev, nextInput }) => {
  const lines = combatMesocycleSummary(prev, nextInput);
  return (
    <SectionCard icon="🔗" title="Кросс-мезоцикл" subtitle={prev ? `от плана ${prev.weeks}нед · ${prev.patternId}` : 'первый цикл'} accent>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.06)', lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>{l}</div>
        ))}
      </div>
    </SectionCard>
  );
};

const CB_TREND_RU: Record<string, string> = { neck: 'Шея', grip: 'Хват', legs: 'Ноги', push: 'Жим', pull: 'Тяга', rotational: 'Ротация', core: 'Кор' };

/* Дневник: e1RM-тренды групп из реального лога (были видны только движку) */
export const CbDiaryCard: React.FC<{ trends: DiaryTrendCB[] | null }> = ({ trends }) => {
  if (!trends || !trends.length) return null;
  return (
    <SectionCard icon="📊" title="Дневник — тренды групп" subtitle="e1RM 28д vs пред. 28д · из вашего лога" accent>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {trends.map(t => {
          const col = t.changePct <= -5 ? '#f87171' : t.changePct < 0 ? '#fbbf24' : '#4ade80';
          const badge = t.changePct <= -5 ? 'слабо' : t.changePct < 0 ? 'плато' : 'рост';
          return (
            <span key={t.group} style={{ padding: '6px 10px', borderRadius: 10, background: `${col}14`, border: `0.5px solid ${col}44`, color: '#fff', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {CB_TREND_RU[t.group] || t.group} <Highlight color={col}>{t.changePct > 0 ? `+${t.changePct}` : t.changePct}%</Highlight> · {badge} · {t.recentMax}/{t.prevMax}
            </span>
          );
        })}
      </div>
    </SectionCard>
  );
};

export const CombatPlanView: React.FC<Props> = ({
  plan, historyLen, onUndo, onUpdateEx, onMoveEx, onSwapEx,
  annual, annualWeeks, setAnnualWeeks, annualCycles, setAnnualCycles, competitionName, setCompetitionName, competitionDate, setCompetitionDate, competitionWeight, setCompetitionWeight, competitionPriority, setCompetitionPriority,
  startDate, outside, outsideMetrics, diaryLoad, acwr, msg, setMsg,
  onBuildATR, onAddCompetition, onRemoveCompetition, onRemoveAnnual, annualCyclesHint, onPrintAnnual, onDownloadIcs, onExportProgram,
  onBuildPlans, onPrintBlock, onLoadBlock,
}) => {
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(0);
  const [openSess, setOpenSess] = React.useState<Record<string, boolean>>({});
  const [restored, setRestored] = React.useState<CombatPlan | null>(null);
  const shown = restored || plan;
  const doMsg = (m: string) => { setMsg?.(m); setTimeout(() => setMsg?.(''), 2200); };
  // P1-9: правка в режиме просмотра варианта выходит из просмотра — иначе рендер
  // показывал restored, а мутировался live-план («показано ≠ правится»)
  const exitRestoredForEdit = () => {
    if (restored) { setRestored(null); doMsg('↩ Просмотр варианта закрыт — правка идёт в текущий план'); }
  };
  const updEx = (w: number, d: number, id: string, p: Partial<{ weight: number; reps: string; rir: number }>) => { exitRestoredForEdit(); onUpdateEx(w, d, id, p); };
  const movEx = (w: number, d: number, id: string, dir: -1 | 1) => { exitRestoredForEdit(); onMoveEx(w, d, id, dir); };
  const swpEx = (w: number, d: number, id: string, nid: string) => { exitRestoredForEdit(); onSwapEx(w, d, id, nid); };
  const sessOpen = (wk: number, day: number, idx: number) => openSess[`${wk}-${day}`] ?? idx === 0;
  // №1: заблокированный план (errors) нельзя выгружать ни в каком виде — канон isCombatPlanBlocked из finalize
  const blocked = isCombatPlanBlocked(plan);
  const blockedTitle = blocked ? 'Сначала исправьте ошибки' : undefined;
  const blockedDim = blocked ? { opacity: 0.4 } as const : {};

  // Авто-входы для скринингов (8.4/8.8). Раньше карточка считала их по null и
  // всегда показывала «нет данных» — блоки LEA и теплового протокола были мертвы.
  //   kcal  — канон проекта: combatToNutritionPayload (потребление из плана);
  //   ffmKg — из профиля: вес × (1 − %жира), и только если %жира правдоподобен;
  //   trainingKcal/cat2Flags/heatSessions — НЕ выводятся ни из чего, вводятся руками.
  const [personal] = useProfileSection('personal');
  const autoKcal = React.useMemo(() => {
    try { return combatToNutritionPayload(plan).kcal ?? null; } catch { return null; }
  }, [plan]);
  const autoFfm = React.useMemo(
    () => ffmFromProfile(personal?.weight ?? null, personal?.bodyFat ?? null),
    [personal?.weight, personal?.bodyFat]);

  return (
    <div className="combat-planview" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Верхняя панель действий */}
      <div className="cb-plan-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="cb-plan-undo" onClick={onUndo} disabled={historyLen === 0} style={{
            padding: '8px 12px', minHeight: 44, borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: historyLen ? 'pointer' : 'default',
            background: historyLen ? 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.14))' : 'rgba(255,255,255,0.04)',
            color: historyLen ? '#d8b4fe' : '#fff', border: `1px solid ${historyLen ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.06)'}`,
            backdropFilter: 'blur(8px)',
          }}>↩ Отменить {historyLen ? `(${historyLen})` : ''}</button>
          <span className="cb-plan-hist" style={{ fontSize: 11, color: TEXT_3, fontWeight: 700 }}>История {historyLen}/10</span>
        </div>
        {msg && <span className="cb-plan-msg" style={{ fontSize: 11, color: '#fff', background: 'rgba(168,85,247,0.14)', padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.22)' }}>{msg}</span>}
      </div>

      {/* Отчёт — Apple glass + Highlights + StatTiles */}
      <div className="cb-plan-summary">
      <SectionCard icon="📋" title="Сводка плана" subtitle={`${shown.discipline} · ${shown.goal} · ${shown.level} · ${shown.weeks} нед`} accent>
        <div className="cb-plan-stats" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px,1fr))', gap:8 }}>
          <StatTile label="Недель" value={String(shown.weeks)} color="#a855f7" sub={shown.patternId} icon="📅" />
          <StatTile label="Сессий" value={String(shown.weeksData.reduce((a,w)=>a+w.sessions.length,0))} color="#a855f7" sub="за цикл" icon="🗓️" />
          <StatTile label="Сетов" value={String(shown.weeksData.reduce((a,w)=>a+(w.totalSets||0),0))} color="#a855f7" sub="за цикл" icon="📊" />
          <StatTile label="Тоннаж" value={`${Math.round(shown.weeksData.reduce((a,w)=>a+((w as any).totalTonnage||0),0)/1000)}т`} color="#a855f7" sub="за цикл" icon="⚖️" />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{shown.discipline}</Badge>
        <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{shown.goal}</Badge>
        <Badge>{shown.patternId}</Badge>
        {(shown.inputSnapshot as any)?.fightDate && <Badge color="#ef4444" bg="rgba(239,68,68,0.10)" border="rgba(239,68,68,0.18)">🏁 бой {(shown.inputSnapshot as any).fightDate}</Badge>}
        </div>
        <CampStrip plan={plan} expandedWeek={expandedWeek} onPickWeek={setExpandedWeek} />
        {shown.outsideMetrics && <InfoBanner tone={shown.outsideMetrics.interference==='high'?'warn':'info'}><Highlight color={shown.outsideMetrics.interference==='high'?'#ff9f0a':'#a855f7'}>{shown.outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{shown.outsideMetrics.volumeMultiplier}</Highlight> · {shown.outsideMetrics.interference}</InfoBanner>}
        {(shown.inputSnapshot as any)?.weightCutProtocol && (
          <SectionCard icon="⚖️" title="Весогонка — питание по неделям" subtitle="ISSN 2025 · клик — скопировать в планировщик питания" accent>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {shown.weeksData.map(wk=>{
                const proto = (shown.inputSnapshot as any).weightCutProtocol;
                const bw = (shown.inputSnapshot as any).bodyweight || 80;
                const sex = (shown.inputSnapshot as any).sex || 'male';
                const nut = weightCutNutritionForWeek(wk.week, shown.weeks, proto, bw, sex);
                const meal = combatWeightCutToMealInput(wk.week, shown.weeks, proto, bw, sex);
                return (
                  <div key={wk.week} style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
                    <Highlight color={wk.deload?'#f59e0b': (wk as any).taper?'#60a5fa':'#a855f7'}>Нед {wk.week}</Highlight>
                    <span style={{ fontSize:11, color:'#fff' }}>{nut.kcal} ккал · P{nut.proteinG} C{nut.carbsG} · {nut.waterMl}мл · Na{nut.sodiumMg}мг</span>
                    <span style={{ fontSize:10, color:TEXT_3 }}>{nut.notes.slice(0,1).join(' ')}</span>
                    <button onClick={()=>{
                      try{
                        if(meal) { localStorage.setItem('he_combat_meal_preview', JSON.stringify({ week:wk.week, ...meal })); navigator.clipboard?.writeText(`${nut.kcal} ккал P${nut.proteinG} C${nut.carbsG} W${nut.waterMl} Na${nut.sodiumMg}`); doMsg(`Нед ${wk.week} — питание скопировано`);} 
                      }catch{}
                    }} style={{ ...BTN_SMALL, padding:'5px 10px', fontSize:11 }}>⎙ Копировать</button>
                  </div>
                );
              })}
            </div>
            <InfoBanner tone="info">Меню генерируется через `combatWeightCutToMealInput` → планировщик питания (кнопка «Копировать» сохраняет в `he_combat_meal_preview`)</InfoBanner>
          </SectionCard>
        )}
        {shown.rationale?.length ? <div style={{ fontSize:11, color:'#fff', background:'rgba(0,0,0,0.14)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', lineHeight:1.45 }}>{shown.rationale.slice(0,3).map((r,i)=> <div key={i} style={{ display:'flex', gap:6 }}><span style={{ color:'#a855f7' }}>•</span><span>{r}</span></div>)}</div> : null}
        <details style={{ background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)' }}>
          <summary style={{ fontSize:11, fontWeight:700, color:'#d8b4fe', cursor:'pointer' }}>📄 Подробный отчёт (текст)</summary>
          <div style={{ fontSize:11, color:'#fff', whiteSpace:'pre-wrap', marginTop:8, lineHeight:1.5 }}>{buildCombatReport(plan)}</div>
        </details>
      </SectionCard>
      </div>

      {shown.validation?.errors?.length ? (
        <div className="cb-plan-errors" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>⛔ Сборка заблокирована ({shown.validation.errors.length}) — до врача/исправления</div>
          {shown.validation.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#fff' }}>• {e}</div>
          ))}
        </div>
      ) : null}
      {shown.validation?.warnings.map((w, i) => (
        <InfoBanner key={i} tone="warn">{w}</InfoBanner>
      ))}

      {/* Кондиция — Apple 3-системы с Highlights */}
      {(plan as any).conditioning && (
        <SectionCard icon="🏃" title="Кондиция — 3 системы" subtitle={`Вне зала ${outside?.sessionsPerWeek ?? 0}× · объём ×${outsideMetrics?.volumeMultiplier ?? 1}`} accent>
          <GroupHeading icon="⚡️" text="Alactic / Lactic / Aerobic" desc="Issurin ATR — кондиция по неделям" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(plan as any).conditioning.sessions.map((week: any[], wi: number) => (
              <div key={wi} style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.05)', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <Highlight color="#60a5fa">Нед {wi + 1}</Highlight><span style={{ fontWeight:700, color:'#fff' }}>{ruLabel(PHASE_RU, shown.weeksData[wi]?.phase)}</span><span style={{ color:TEXT_3 }}>·</span>
                {week.length ? week.map((s: any, si:number) => <Highlight key={si} color={s.modality==='alactic'?'#a855f7': s.modality==='lactic'?'#ef4444':'#0ea5e9'}>{`${s.modality} ${s.durationMin}′ ${s.intervals || ''}`.trim()}</Highlight>) : <span style={{ color: TEXT_3 }}>внезал покрывает</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#fff', background:'rgba(59,130,246,0.08)', padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(59,130,246,0.14)' }}><Highlight color="#3b82f6">Alactic 8×10с</Highlight> · <Highlight color="#ef4444">Lactic 5×3′</Highlight> · <Highlight color="#0ea5e9">Aerobic 40′ Zone2</Highlight></div>
        </SectionCard>
      )}

      {restored && (
        <div data-cb="variant-shown" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <InfoBanner tone="warn">Показан сохранённый вариант — текущая сборка скрыта.</InfoBanner>
          <button onClick={() => setRestored(null)} style={{ ...BTN_SMALL, minHeight: 44, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.08)' }}>↩ К текущей сборке</button>
        </div>
      )}

      {/* Карта качества — Apple с Highlights */}
      <CbQualityMap plan={shown} />

      <CbCampCharts plan={shown} />
      <CbVariants plan={plan} onRestore={(p) => { setRestored(p); setExpandedWeek(0); doMsg('↩ Вариант показан'); }} onMsg={doMsg} />
      <CbCampMeasurementsCard
        plan={plan}
        sleepHours={(((plan.inputSnapshot as any)?.sleepHours ?? null) as number | null)}
        kcal={autoKcal}
        ffmKg={autoFfm}
      />

      {diaryLoad != null && (
        <InfoBanner tone={diaryLoad > 30 ? 'warn' : 'info'}>
          Дневник: нагрузка 7д ≈ {diaryLoad} {diaryLoad > 30 ? '— высоко, рассмотрите лёгкую неделю' : '— норма'} {acwr ? `· ACWR ${acwr.ratio} · ${acwr.zone}` : ''}
        </InfoBanner>
      )}

      {/* Недели */}
      {shown.weeksData.map(wk => {
        const isOpen = expandedWeek === wk.week - 1;
        const tone = (PHASE_RU as any)[wk.phase] ? (wk.deload ? '#f59e0b' : (wk as any).taper ? '#60a5fa' : '#a855f7') : '#a855f7';
        return (
          <div key={wk.week} className="cb-plan-week" data-open={isOpen ? 'true' : 'false'} style={{ background: isOpen ? `linear-gradient(180deg, ${tone}10, rgba(20,22,28,0.55))` : 'rgba(20,22,28,0.55)', backdropFilter:'blur(18px) saturate(160%)', WebkitBackdropFilter:'blur(18px) saturate(160%)', borderRadius:14, border:`1px solid ${tone}30`, borderLeft:`4px solid ${tone}`, overflow:'hidden' }}>
            <button
              onClick={() => setExpandedWeek(isOpen ? null : wk.week - 1)}
              className="cb-plan-weekhead"
              aria-expanded={isOpen}
              aria-controls={`cb-wk-${wk.week}`}
              aria-label={`Неделя ${wk.week}${wk.deload ? ' · разгрузка' : (wk as any).taper ? ' · тапер' : ''}`}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'14px 16px', background:`linear-gradient(135deg, ${tone}18, rgba(255,255,255,0.02))`, border:'none', cursor:'pointer', textAlign:'left' as const, minHeight:64 }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                <span className="cb-plan-weeknum" style={{ width:36, height:36, borderRadius:10, background:tone, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontSize:14, flexShrink:0 }}>{wk.week}</span>
                <div className="cb-plan-weektitle" style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>Неделя {wk.week} · {ruLabel(PHASE_RU, wk.phase)}</div>
                  <div style={{ fontSize:11, color:'#fff', opacity:0.85, marginTop:2, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ padding:'2px 7px', borderRadius:6, background:`${tone}22`, color:tone, border:`1px solid ${tone}35`, fontWeight:700 }}>{ruLabel(PHASE_RU, wk.phase)}</span>
                    {wk.deload ? <span style={{ padding:'2px 7px', borderRadius:6, background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', fontWeight:700 }}>разгрузка</span> : (wk as any).taper ? <span style={{ padding:'2px 7px', borderRadius:6, background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', fontWeight:700 }}>тапер</span> : null}
                    <span style={{ fontVariantNumeric:'tabular-nums' }}>{wk.totalSets} сетов{(wk as any).totalTonnage ? ` · ${((wk as any).totalTonnage / 1000).toFixed(1)}т` : ''} · {ruCount(wk.sessions.length, RU_SESSIONS)}</span>
                  </div>
                </div>
              </div>
              <span className="cb-plan-weekchev" style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, flexShrink:0, transition:'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
            </button>

            {!isOpen && (
              <div className="cb-plan-weekchips" style={{ padding: '0 12px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wk.sessions.map(s => (
                  <span key={s.day} style={{ fontSize: 11, fontWeight:700, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.07)', color: '#fff' }}>
                    {SESSION_TAG_RU[s.sessionTag] || s.sessionTag} · {s.exercises.length}упр
                  </span>
                ))}
              </div>
            )}

            {isOpen && (
              <div id={`cb-wk-${wk.week}`} className="cb-plan-weekbody" style={{ padding: '8px 10px', borderTop:`1px solid ${tone}15`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="cb-plan-copyweek" onClick={() => {
                    const txt = wk.sessions.map(s => `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e => `  ${e.name} ${e.sets}x${e.reps} ${e.weight ? e.weight + 'кг' : ''} RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment ? ' // ' + e.comment : ''}`).join('\n')).join('\n\n');
                    navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n` + txt); doMsg(`Неделя ${wk.week} скопирована`);
                  }} style={{ ...BTN_SMALL, padding:'6px 10px', fontSize:11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}>⎙ Копировать неделю</button>
                </div>

                {wk.sessions.map((sess, si) => {
                  const sOpen = sessOpen(wk.week, sess.day, si);
                  return (
                  <div key={sess.day} className="cb-plan-sess" data-open={sOpen ? 'true' : 'false'} style={{
                    background:'rgba(20,22,28,0.55)', border:`1px solid ${tone}30`, borderLeft:`4px solid ${tone}`, borderRadius:14, overflow:'hidden',
                  }}>
                    <button
                      onClick={() => setOpenSess(s => ({ ...s, [`${wk.week}-${sess.day}`]: !sOpen }))}
                      aria-expanded={sOpen}
                      className="cb-plan-sesshead-btn"
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background:`linear-gradient(135deg, ${tone}18, rgba(255,255,255,0.02))`, border: 'none', cursor: 'pointer', textAlign: 'left' as const, gap: 12 }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                        <span style={{ width:36, height:36, borderRadius:10, background:tone, display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontSize:14, flexShrink:0 }}>{sess.day}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>День {sess.day} · {SESSION_TAG_RU[sess.sessionTag] || sess.sessionTag}</div>
                          <div style={{ fontSize:11, color:'#fff', opacity:0.85, marginTop:2, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                            <span style={{ padding:'2px 7px', borderRadius:6, background:`${tone}22`, color:tone, border:`1px solid ${tone}35`, fontWeight:700 }}>{sess.character}</span>
                            <span>{sess.durationMin}′ · {sess.exercises.length} упр</span>
                            <span>⏱ {Math.round(sess.exercises.reduce((a, e) => a + e.workSets.length * (e.restSeconds || 75), 0) / 60)}′ отдыха</span>
                          </div>
                        </div>
                      </div>
                      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink:0, transition: 'transform 0.2s', transform: sOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    </button>

                    {sOpen && (
                    <div style={{ padding:'8px 10px', borderTop:`1px solid ${tone}15`, display: 'flex', flexDirection: 'column' }}>
                      {sess.exercises.map((ex, exIdx) => (
                        <div key={ex.id} className="cb-plan-ex" style={{
                          padding: '10px 12px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ minWidth:22, height:22, borderRadius:'50%', background:'rgba(168,85,247,0.16)', color:'#c084fc', fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{exIdx + 1}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1.25, letterSpacing:'-0.2px' }}>{ex.name}</div>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(168,85,247,0.12)', color:'#e9d5ff', border:'0.5px solid rgba(168,85,247,0.25)' }}>{ex.sets}×{ex.reps}</span>
                                {ex.holdSeconds != null ? <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(34,197,94,0.10)', color:'#86efac', border:'0.5px solid rgba(34,197,94,0.22)' }}>холд {ex.holdSeconds}с</span> : null}
                                {ex.weight ? <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(255,255,255,0.05)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.08)' }}>{ex.weight} кг</span> : null}
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(255,255,255,0.04)', color:'#fff', opacity:0.85, border:'0.5px solid rgba(255,255,255,0.06)' }}>RIR {ex.rir}</span>
                                <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:5, background:'rgba(255,255,255,0.04)', color:'#fff', opacity:0.7, border:'0.5px solid rgba(255,255,255,0.06)' }}>{ex.tempo} · {ex.restSeconds}с</span>
                                {ex.comment?.includes('Тапер') ? <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(96,165,250,0.10)', color:'#60a5fa', border:'0.5px solid rgba(96,165,250,0.22)' }}>тапер</span> : null}
                                {ex.comment?.includes('Весогонка') ? <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(245,158,11,0.10)', color:'#f59e0b', border:'0.5px solid rgba(245,158,11,0.22)' }}>весогонка</span> : null}
                              </div>
                            </div>
                          </div>

                          <div className="cb-plan-exgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center', marginTop: 8 }}>
                            <input aria-label="вес" type="number" value={ex.weight} onChange={e => updEx(wk.week - 1, sess.day, ex.id, { weight: Number(e.target.value) || 0 })} placeholder="вес" style={{ ...INPUT, padding: '8px 6px', fontSize: 12, textAlign: 'center', minHeight: 44, borderRadius: 8 }} />
                            <input aria-label="повторы" type="text" value={ex.reps} onChange={e => updEx(wk.week - 1, sess.day, ex.id, { reps: e.target.value })} placeholder="повт" style={{ ...INPUT, padding: '8px 6px', fontSize: 12, textAlign: 'center', minHeight: 44, borderRadius: 8 }} />
                            <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e => updEx(wk.week - 1, sess.day, ex.id, { rir: Number(e.target.value) || 0 })} style={{ ...INPUT, padding: '8px 6px', fontSize: 12, textAlign: 'center', minHeight: 44, borderRadius: 8 }} />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button aria-label="вверх" onClick={() => movEx(wk.week - 1, sess.day, ex.id, -1)} className="cb-plan-move" style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>↑</button>
                              <button aria-label="вниз" onClick={() => movEx(wk.week - 1, sess.day, ex.id, 1)} className="cb-plan-move" style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>↓</button>
                            </div>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <CombatPopupSelect label="Замена" value={ex.id} onChange={v => { if (v !== ex.id) swpEx(wk.week - 1, sess.day, ex.id, v); }} options={[
                              { id: ex.id, label: `${cbExerciseName(ex.id)} · текущий` },
                              ...(cbStrictGroupFor(ex.id) ? CB_STRICT_GROUPS[cbStrictGroupFor(ex.id)!] : []).filter(id => id !== ex.id).map(id => ({ id, label: cbExerciseName(id) })),
                            ]} />
                          </div>

                          {ex.comment && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(168,85,247,0.06)', borderLeft: '2px solid rgba(168,85,247,0.28)', padding: '6px 8px', borderRadius: 6, marginTop: 6 }}>{ex.comment}</div>}
                          {ex.warmupSets && ex.warmupSets.length > 0 && <div style={{ fontSize: 10.5, color: '#fff', opacity: 0.7, marginTop: 6 }}>Разминка: {ex.warmupSets.map(s => `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {ex.workSets.map((s, setIdx) => (
                              <span key={setIdx} data-ss="set-row" style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', padding: '3px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.10)', color: '#e9d5ff', border: '0.5px solid rgba(168,85,247,0.25)' }}>
                                {setIdx + 1}. {s.reps}×{s.weight ? `${s.weight}кг` : '—'} RIR{s.rir}{s.holdSeconds != null ? ` холд ${s.holdSeconds}с` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Годовой — единый блок (общий с шагом «Экспорт» конструктора) */}
      {annual && onBuildATR && (
        <AnnualCard
          annual={annual}
          onBuildATR={onBuildATR}
          annualWeeks={annualWeeks}
          setAnnualWeeks={setAnnualWeeks}
          annualCycles={annualCycles}
          setAnnualCycles={setAnnualCycles}
          startDate={startDate}
          competitionName={competitionName}
          setCompetitionName={setCompetitionName}
          competitionDate={competitionDate}
          setCompetitionDate={setCompetitionDate}
          competitionWeight={competitionWeight}
          setCompetitionWeight={setCompetitionWeight}
          competitionPriority={competitionPriority}
          setCompetitionPriority={setCompetitionPriority}
          onAddCompetition={onAddCompetition}
          onRemoveCompetition={onRemoveCompetition}
          onRemoveAnnual={onRemoveAnnual}
          annualCyclesHint={annualCyclesHint}
          onPrintAnnual={onPrintAnnual}
          onDownloadIcs={onDownloadIcs}
          onBuildPlans={onBuildPlans}
          onPrintBlock={onPrintBlock}
          onLoadBlock={onLoadBlock}
        />
      )}

      {/* Экспорт — Apple glass */}
      <div className="cb-plan-export">
      <SectionCard icon="📤" title="Экспорт и шаринг" subtitle="Печать · CSV · ICS · в программу">
        {blocked && (
          <div className="cb-export-blocked" style={{ fontSize: 11, color: '#fff', background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(239,68,68,0.24)' }}>⛔ Экспорт заблокирован — сначала исправьте ошибки выше (план с мед-флагами нельзя выгружать даже на бумагу)</div>
        )}
        <GroupHeading icon="⎙" text="Копировать и печать" desc="Быстрый обмен" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
          <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); doMsg('Скопировано'); }} style={{ ...BTN, ...blockedDim }} disabled={blocked} title={blockedTitle}>⎙ Копировать</button>
          <button onClick={() => { const html = buildCombatPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); doMsg('HTML скопирован'); } }} style={{ ...BTN, ...blockedDim }} disabled={blocked} title={blockedTitle}>🖨 Печать</button>
          <button onClick={onExportProgram} style={{ ...BTN_PRIMARY, ...blockedDim }} disabled={blocked} title={blockedTitle}>✦ В программу</button>
        </div>
        <Divider />
        <GroupHeading icon="📊" text="Файлы" desc="CSV для Excel · ICS для календаря" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
          <button onClick={() => { downloadCombatCsv(plan); doMsg('CSV скачан'); }} style={{ ...BTN, ...blockedDim }} disabled={blocked} title={blockedTitle}>📊 CSV</button>
          <button onClick={() => { downloadCombatXlsx(plan); doMsg('XLS скачан'); }} style={{ ...BTN, ...blockedDim }} disabled={blocked} title={blockedTitle}>📗 XLSX</button>
          <button onClick={() => { const ics = buildCombatPlanIcs(plan, startDate || null); const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `combat-plan-${plan.discipline}-${plan.weeks}w.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); doMsg('ICS скачан'); }} style={{ ...BTN, ...blockedDim }} disabled={blocked} title={blockedTitle}>📅 План .ics</button>
        </div>
        <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight>Экспорт</Highlight> — библиотека программ · печать · ICS · CSV</div>
      </SectionCard>
      </div>
    </div>
  );
};
