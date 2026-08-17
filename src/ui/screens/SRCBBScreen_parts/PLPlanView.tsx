/**
 * PLPlanView.tsx — 📋 ПЛАН ЦИКЛА ПЛ (Этап 4 разгрузки SRCBBScreen).
 *
 * Вынесено из SRCBBScreen: календарь мезоцикла (с тапер-метками), план-таблица
 * недель/дней/сетов, правки (U4/U5), прикиды-карточки, печать, прогрессия.
 * Тапер-поля (attemptStrategy/peakMode/...) читаются из контекста taper-state.tsx;
 * остальные зависимости — через api (единый объект).
 */
import React, { useState } from 'react';
import { getCycleById, LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { originalCycleWeeks, getPLWeakPointRecommendations, type LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import { mesocyclePhaseForWeek, type MesocyclePhase } from '../../../engines/rir-matrix.engine';
import { macroPhaseToLmsPhase } from '../../../engines/periodization/phase-bridge';
import { shouldTrainToday, type AutoRegOutput } from '../../../engines/pro/autoregulation-pro.engine';
import { LAST_HEAVY_DAYS } from '../../../engines/pro/taper.engine';
import { competitionAttempts, MEET_STRATEGY_LABEL, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS } from '../../../engines/lms/competition-attempts';
import { adaptForPEDs, type PED } from '../../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { modeMismatchWarning } from '../../../engines/lms/lms-selector.engine';
import { getExercisesByGroup, EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { calcCycleMetrics, type SRExercise } from '../../../engines/lms/lms-metrics.engine';
import { parseProgressionRationale, progressionTiles, splitDescriptionPoints } from '../TrainingScreen_parts/plan-card-helpers';
import {
  MesocycleProgressionCard, SOURCE_PHASE_LABEL, SOURCE_PHASE_ORIGIN_LABEL,
  sourceWeekColor, summarizeSourceCycleWeeks,
} from '../TrainingScreen_parts/MesocycleProgressionCard';
import { MetricCard, PopupNumber, PopupSelect, ExpandableCard, SaveButton } from './TrainingPopups';
import { SessionPlayer, type PlayerDay } from './SessionPlayer';
import { DayCard, type PhaseKey } from '../TrainingScreen_parts/PlanOutput';
import { usePLTaper } from './taper-state';
import type { BridgeSession } from '../../../engines/training-integration.engine';
import type { Lift, WeakPoint } from '../../../engines/lms/weakpoint-pl';
import type { AutoRegMode, DiaryAutoregResult } from '../../../engines/pro/diary-autoreg.engine';
import type { PMAutoRegMode } from '../../../engines/lms/pm-autoreg.engine';
import { plBlockGroups, plExportRows, buildPLExcelWorkbook, downloadPLExcel, buildPLPrintHtml, printPLHtml, plShareLink, openPLShare, PL_BLOCK_LABEL, type PLBlockId, type PLBlockGroup } from './pl-export';
import type { RepTempoOutput } from '../../../engines/rep-tempo-engine';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 };
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: '1px solid var(--accent-dim)' };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px', minHeight: 38 };
const IN: React.CSSProperties = { ...SEL, padding: '10px' };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '6px 0 3px' };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 };
const CAT_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
const PL_WEAKPOINT_LABELS: Record<string, string> = {
  lockout: 'Замок (дожим)', off_chest: 'Срыв с груди', mid: 'Середина', off_floor: 'Срыв с пола', sticking: 'Мёртвая точка', weak_quads: 'Слабые квадрицепсы', weak_hams: 'Слабые бицепсы бедра', weak_glutes: 'Слабые ягодицы', weak_back: 'Слабая спина', weak_grip: 'Слабый хват', weak_pause: 'Слабый пауза-присед', weak_lockout: 'Слабый замок', weak_upper_back: 'Слабый верх спины',
};

export interface PLPlanViewApi {
  builtSrc: LMSBuildOutput;
  setBuiltSrc: (p: LMSBuildOutput) => void;
  srcWeek: number;
  setSrcWeek: (n: number) => void;
  srcEdits: Record<string, { weight?: number; reps?: number; sets?: number; tempo?: string; pct?: number }>;
  setSrcEdits: React.Dispatch<React.SetStateAction<Record<string, { weight?: number; reps?: number; sets?: number; tempo?: string; pct?: number }>>>;
  srcAdditions: Record<string, { uid: string; name: string; group: string; sets: number; reps: number; weight: number }[]>;
  setSrcAdditions: React.Dispatch<React.SetStateAction<Record<string, { uid: string; name: string; group: string; sets: number; reps: number; weight: number }[]>>>;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  setKey: (w: number, di: number, ei: number, si: number) => string;
  effSet: (w: number, di: number, ei: number, si: number, ws: { sets: number; reps: number; weight: number; pct: number }) => { sets: number; reps: number; weight: number; pct: number };
  dayKey: (w: number, di: number) => string;
  addExToDay: (dk: string) => void;
  pickerDay: string | null;
  setPickerDay: (v: string | null) => void;
  pickerGroup: string;
  setPickerGroup: (v: string) => void;
  pickerExName: string;
  setPickerExName: (v: string) => void;
  pickerScheme: { sets: number; reps: number; weight: number };
  setPickerScheme: React.Dispatch<React.SetStateAction<{ sets: number; reps: number; weight: number }>>;
  days: number;
  calendarView: 'original' | 'tapered';
  setCalendarView: (v: 'original' | 'tapered') => void;
  bridgeSessions: BridgeSession[];
  setBridgeWeek: (n: number) => void;
  bridgeWeek: number;
  onNote: (m: string) => void;
  buildSrc: () => void;
  // Параметры спортсмена/курса
  selectedCycleId: string;
  cycleWeeks: number;
  goal: string;
  level: string;
  peds: PED[];
  pedDoses: Record<string, number>;
  pedAuto: boolean;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  autoRegMode: 'off' | 'auto' | 'diary';
  setAutoRegMode: (m: 'off' | 'auto' | 'diary') => void;
  autoRegResult: AutoRegOutput;
  pmAutoRegMode: PMAutoRegMode;
  setPmAutoRegMode: (m: PMAutoRegMode) => void;
  pmDiary: { multiplier: Record<string, number>; decisions: string[]; adjusted: number; noData: number } | null;
  bridgeRir: number;
  pmSquat: number; pmBench: number; pmDead: number;
  best: any;
  plWeakPoints: { lift: Lift; weakPoint: WeakPoint }[];
  // Дневник/прогресс
  linked: any;
  runFocus: any;
  diaryAutoreg: DiaryAutoregResult | null;
  calibratePmFromDiary: (lift: 'squat' | 'bench' | 'deadlift') => void;
  e1rmSeries: { label: string; lift: string; color?: string; pts: { val: number }[] }[];
  exerciseE1rm: { name: string; e1: number; w: number; r: number }[];
  exTrendSeries: { e1: number }[];
  playerDays: PlayerDay[];
  selectedTrendEx: string | null;
  setSelectedTrendEx: React.Dispatch<React.SetStateAction<string | null>>;
  tempoStr: string;
  getTempo: (exerciseName: string, goal: string, isMainLift: boolean) => RepTempoOutput;
  methodHints: { volumeMult: number; technique: string | null; label: string };
}

export const PLPlanView: React.FC<{ api: PLPlanViewApi }> = ({ api }) => {
  const {
    builtSrc, setBuiltSrc, srcWeek, setSrcWeek, srcEdits, setSrcEdits, srcAdditions, setSrcAdditions,
    editMode, setEditMode, setKey, effSet, dayKey, addExToDay,
    pickerDay, setPickerDay, pickerGroup, setPickerGroup, pickerExName, setPickerExName,
    pickerScheme, setPickerScheme, days, calendarView, setCalendarView,
    bridgeSessions, setBridgeWeek, bridgeWeek, onNote, buildSrc,
    selectedCycleId, cycleWeeks, goal, level, peds, pedDoses, pedAuto, courseIntensity,
    autoRegMode, setAutoRegMode, autoRegResult, bridgeRir, pmSquat, pmBench, pmDead, best,
    pmAutoRegMode, setPmAutoRegMode, pmDiary,
    plWeakPoints, linked, runFocus, diaryAutoreg, calibratePmFromDiary,
    e1rmSeries, exerciseE1rm, exTrendSeries, playerDays, selectedTrendEx, setSelectedTrendEx,
    tempoStr, getTempo, methodHints,
  } = api;
  // 🏁 Тапер-поля — из контекста (taper-state.tsx).
  const { attemptStrategy, peakMode, taperWeeksToAdd, mockMeetOn, meetWeekOn, postMeetOn, taperNote, taperAttemptOverride } = usePLTaper();

  // 📤 Экспорт: цепочка Формат → Объём → (Блок/Неделя) → Экспорт.
  const [expOpen, setExpOpen] = useState(false);
  const [expFormat, setExpFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [expScope, setExpScope] = useState<'all' | 'block' | 'week' | 'full' | null>(null);
  const [expBlock, setExpBlock] = useState<PLBlockId | null>(null);
  const [expWeek, setExpWeek] = useState<number | null>(null);

  const displayPhaseForWeek = (week: LMSBuildOutput['weeks'][number], totalWeeks: number): string => {
    return week.macroPhase
      ? macroPhaseToLmsPhase(week.macroPhase as never)
      : (week.sourcePhase || mesocyclePhaseForWeek(week.week, totalWeeks));
  };
  const weekVolumeOf = (week: LMSBuildOutput['weeks'][number]): number => {
    let v = 0;
    for (const d of week.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
    return v;
  };

  return (
    <>
          {builtSrc && (() => {
             const W = builtSrc.weeks;
             const wk = W[Math.min(srcWeek, W.length) - 1] || W[0];
             const totalW = W.length;
             const phase = displayPhaseForWeek(wk, totalW);
             const PH_RU: Record<string,string> = { base: 'База (накопление)', build: 'Накопление (рост объёма)', peak: 'Пик (интенсификация)', deload: 'Разгрузка' };
             const PH_COLOR: Record<string,string> = { base: '#22c55e', build: '#eab308', peak: '#ef4444', deload: '#60a5fa' };
             const PH_DESC: Record<string,string> = {
               base: 'Фаза базы: акклиматизация, наращивание объёма при контроле техники. RIR 2-3, вес = PM_нед × %ПМ.',
               build: 'Фаза накопления: пик объёма (MAV), прогрессия весов, RIR 1-2. КПШ и тоннаж максимальны.',
               peak: 'Пиковая фаза: интенсификация — %ПМ растёт, объём снижается, RIR 0-1. Готовность к тесту/соревнованию.',
               deload: 'Разгрузка: 50-60% объёма, RIR 4, восстановление перед следующим мезоциклом.',
             };
             const sourceCycle = getCycleById(selectedCycleId);
             // Тапер-неделя: добавленная (taperWeek) или legacy-разметка peak/competition
             // (mock meet исключается — это отдельная неделя имитации соревнований).
             // ВАЖНО: проверяем ТОЛЬКО оригинальные недели — иначе добавление тапера
             // «перекрашивает» весь цикл (sourceCalendar обнуляется, все недели теряют свои цвета).
             const isTaperWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.taperWeek === true || (!w.mockMeet && !w.meetWeek && !w.postMeet && w.macroPhase === 'competition' && w.sourcePhase === 'peak');
             const isMockWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.mockMeet === true;
             const isMeetWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.meetWeek === true;
             const isPostMeetWeek = (w: LMSBuildOutput['weeks'][number]): boolean => w.postMeet === true;
             const sourceCalendar = sourceCycle && !W.filter(w => !isTaperWeek(w) && !isMockWeek(w) && !isMeetWeek(w)).some(w => w.macroPhase)
                 ? summarizeSourceCycleWeeks(sourceCycle.weeks && sourceCycle.weeks.length > 0
                 ? sourceCycle.weeks
                 : Array.from({ length: originalCycleWeeks(sourceCycle) }, () => sourceCycle.week1), sourceCycle.meta.period, sourceCycle.meta.sourcePhases, sourceCycle.meta.sourcePhaseSource ?? 'original')
               : undefined;
             const TAPER_COLOR = '#f59e0b';
             const MOCK_COLOR = '#a78bfa';
             const MEET_COLOR = '#eab308';
             const POST_COLOR = '#34d399';
             const sourceWeek = sourceCalendar?.[wk.week - 1];
             const mockPctLabel = wk.meetAttempts ? (MEET_STRATEGY_PCT_LABEL[wk.meetAttempts.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced) : 'прикиды-синглы';
             const calendarColor = sourceWeek && sourceCalendar ? sourceWeekColor(sourceWeek, sourceCalendar) : isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isPostMeetWeek(wk) ? POST_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase];
             const calendarTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 14%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isPostMeetWeek(wk) ? POST_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '14';
             const calendarBorderTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 30%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isPostMeetWeek(wk) ? POST_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '30';
             const calendarBadgeTint = sourceWeek ? `color-mix(in srgb, ${calendarColor} 13%, transparent)` : (isMeetWeek(wk) ? MEET_COLOR : isMockWeek(wk) ? MOCK_COLOR : isPostMeetWeek(wk) ? POST_COLOR : isTaperWeek(wk) ? TAPER_COLOR : PH_COLOR[phase]) + '22';
             const calendarLabel = isMeetWeek(wk)
               ? `🏁 Соревнования · прикиды ${mockPctLabel}`
               : isMockWeek(wk)
               ? `🎯 Имитация соревнований (mock meet) · ${mockPctLabel}`
               : isPostMeetWeek(wk)
               ? `🔄 Пост-соревновательное восстановление (объём ×0.5, RIR +3)`
               : isTaperWeek(wk)
               ? (peakMode === 'pl' && wk.taperNote
                 ? `🏁 ${wk.taperNote.split(':')[0].trim()} · ${Math.round(weekVolumeOf(wk) / Math.max(1, weekVolumeOf(W[W.length - taperWeeksToAdd - 1] ?? W[0]))) * 100}% объёма${wk.meetAttempts ? ' · прикиды' : ''}`
                 : `📉 Тапер · ${Math.round(weekVolumeOf(wk) / Math.max(1, weekVolumeOf(W[W.length - taperWeeksToAdd - 1] ?? W[0]))) * 100}% объёма`)
               : sourceWeek
               ? `${SOURCE_PHASE_ORIGIN_LABEL[sourceWeek.phaseOrigin]} · ${SOURCE_PHASE_LABEL[sourceWeek.phase]} · ${Math.round(sourceWeek.intensityPct * 100)}% · ${sourceWeek.volumeSets} сетов`
               : PH_RU[phase];
             const calendarDescription = isMeetWeek(wk)
               ? `Неделя соревнований (день старта): прикиды как подходы — опенер RIR2 → вторая RIR1 → третья RIR0 (${mockPctLabel} от ПМ недели). План полностью готов: разгрузка (тапер) → попытки.`
               : isMockWeek(wk)
               ? `Имитация соревнований за 10-14 дней до старта: основные движения — прикиды-синглы (опенер RIR2 → вторая RIR1 → третья RIR0, ${mockPctLabel} от ПМ), аксессуары — 50% объёма. Проверка стратегии прикидов перед реальным соревнованием.`
               : isPostMeetWeek(wk)
               ? `Пост-соревновательное восстановление: объём ×0.5, RIR +3 — полная разгрузка после старта, возврат к базовому объёму со следующей недели.`
               : isTaperWeek(wk)
               ? `Тапер-неделя: объём снижен (×0.65/×0.45), RIR +1/+2, интенсивность сохранена (Bosquet 2005). Разгрузка перед соревнованием.`
               : sourceWeek
               ? `${SOURCE_PHASE_ORIGIN_LABEL[sourceWeek.phaseOrigin]}: ${SOURCE_PHASE_LABEL[sourceWeek.phase]}. ${sourceWeek.volumeSets} рабочих сетов, средняя интенсивность ${Math.round(sourceWeek.intensityPct * 100)}% 1ПМ, средний RIR ${sourceWeek.rir.toFixed(1)}.`
               : PH_DESC[phase];
            return <div style={{ ...CARD, overflow:'hidden', boxSizing:'border-box', maxWidth:'100%' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                   <div style={{ ...H, margin:0, minWidth:0, overflowWrap:'break-word' }}>План: {builtSrc.template.meta.title}</div>
                 <span style={{ fontSize:11, fontWeight:700, color: calendarColor, background: calendarBadgeTint, padding:'3px 8px', borderRadius:10, flexShrink:0 }}>{calendarLabel}</span>
              </div>
                {/* ⚙️ Как собран план — структурированная карточка (PED-стиль) */}
                {(() => {
                  const info = parseProgressionRationale(builtSrc.progressionRationale || '');
                  const tiles = progressionTiles(info);
                  if (tiles.length === 0) return null;
                  // Только значимые заметки сборки. Отфильтровываем шум, который
                  // не относится к действующему циклу и/или дублируется в других карточках:
                  // слабые группы/диагностика (показаны в «🎯 Слабые точки СРЦ»), S-MRV-бюджет,
                  // дефолтный объём аксессуаров.
                  const RELEVANT = (n: string) =>
                    !/Слабая группа|Диагностика|не добавлен/.test(n) &&
                    !/S-MRV|объём сессий автоматически/.test(n) &&
                    !/Объём аксессуаров/.test(n);
                  const notes = info.notes.filter(RELEVANT);
                  return (
                    <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.16)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:13 }}>⚙️</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#38bdf8' }}>Как собран план</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(96px, 1fr))', gap:6 }}>
                        {tiles.map((t, i) => (
                          <div key={i} style={{ padding:'6px 9px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', minWidth:0 }}>
                            <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.l}</div>
                            <div style={{ fontSize:12, fontWeight:800, color:'#38bdf8', marginTop:2, overflowWrap:'break-word' }}>{t.v}</div>
                          </div>
                        ))}
                      </div>
                      {notes.length > 0 && (
                        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                          {notes.map((n, i) => (
                            <div key={i} style={{ fontSize:10, color:'rgba(255,255,255,0.6)', padding:'5px 8px', borderRadius:7, background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.12)', lineHeight:1.4 }}>
                              {n}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
               {autoRegMode === 'off' && best && modeMismatchWarning({ goal: goal as any, level: level as any, mode: peds.length > 0 ? 'on_course' : 'natural' }, best.cycle) && (
                 <div role="alert" style={{ marginTop:6, padding:'6px 8px', borderRadius:7, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11 }}>
                   ⚠ {modeMismatchWarning({ goal: goal as any, level: level as any, mode: peds.length > 0 ? 'on_course' : 'natural' }, best.cycle)}
                 </div>
               )}
               <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background: calendarTint, border:'1px solid '+calendarBorderTint }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                   <span style={{ width:8, height:8, borderRadius:'50%', background: calendarColor, flexShrink:0 }} />
                   <span style={{ fontSize:12, fontWeight:800, color: calendarColor }}>{calendarLabel}</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginLeft:'auto' }}>Неделя {wk.week} из {totalW}</span>
                </div>
                {(() => {
                  const tiles: Array<{ l: string; v: string }> = isMeetWeek(wk)
                    ? [{ l: 'Стратегия', v: mockPctLabel }, { l: 'Попытки', v: 'RIR2 → RIR1 → RIR0' }, { l: 'Формат', v: 'Разгрузка → прикиды' }]
                    : isMockWeek(wk)
                    ? [{ l: 'Формат', v: 'Прикиды-синглы' }, { l: 'Стратегия', v: mockPctLabel }, { l: 'Аксессуары', v: '50% объёма' }]
                    : isTaperWeek(wk)
                    ? [{ l: 'Объём', v: '×0.65 / ×0.45' }, { l: 'RIR', v: '+1 / +2' }, { l: 'Интенсивность', v: 'сохранена' }]
                    : sourceWeek
                    ? [{ l: 'Фаза', v: SOURCE_PHASE_LABEL[sourceWeek.phase] }, { l: 'Объём', v: `${sourceWeek.volumeSets} сетов` }, { l: 'Интенсивность', v: `${Math.round(sourceWeek.intensityPct * 100)}% 1ПМ` }, { l: 'RIR', v: sourceWeek.rir.toFixed(1) }]
                    : [{ l: 'Фаза', v: PH_RU[phase] }, { l: 'Характер', v: phase === 'deload' ? '50-60% объёма' : phase === 'peak' ? 'высокая интенсивность' : 'объёмная работа' }];
                  return (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(96px, 1fr))', gap:6 }}>
                      {tiles.map((t, i) => <div key={i} style={{ padding:'6px 9px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', minWidth:0 }}>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.l}</div>
                        <div style={{ fontSize:12, fontWeight:800, color: calendarColor, marginTop:2, overflowWrap:'break-word' }}>{t.v}</div>
                      </div>)}
                    </div>
                  );
                })()}
                 <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                   {splitDescriptionPoints(calendarDescription).map((point, i) => (
                     <div key={i} style={{ fontSize:10, color:'rgba(255,255,255,0.65)', padding:'5px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', lineHeight:1.4, wordBreak:'break-word' }}>
                       <span style={{ color: calendarColor, fontWeight:800 }}>•</span> {point}
                     </div>
                   ))}
                 </div>
              </div>
              {/* 📊 Расчёты цикла (метрики микроцикла — Черняк) */}
              {builtSrc.cycleMetrics && (() => {
                const cm = builtSrc.cycleMetrics;
                const tiles: Array<{ l: string; v: string }> = [
                  { l: 'Тоннаж', v: Math.round(cm.tonnage).toLocaleString('ru-RU') + ' кг' },
                  { l: 'КПШ', v: String(cm.kpsh) },
                  { l: 'Средний вес', v: Math.round(cm.avgWeight) + ' кг' },
                  { l: 'Отн. интенсивность', v: Math.round(cm.relIntensity * 100) + '%' },
                  { l: 'УОИ', v: cm.uoi.toFixed(2) },
                  { l: 'Сессий', v: String(cm.sessions) },
                ];
                return (
                  <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.15)' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'var(--accent)', marginBottom:6 }}>📊 Расчёты цикла</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(96px, 1fr))', gap:6 }}>
                      {tiles.map((t, i) => (
                        <div key={i} style={{ padding:'6px 9px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', minWidth:0 }}>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.l}</div>
                          <div style={{ fontSize:12, fontWeight:800, color:'var(--accent)', marginTop:2, overflowWrap:'break-word' }}>{t.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {methodHints.label && <div style={{ marginTop:4, fontSize:11, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(0,230,138,0.2)', padding:'3px 8px', borderRadius:8, display:'inline-block' }}>🧩 {methodHints.label}{methodHints.volumeMult !== 1 ? ' · объём×' + methodHints.volumeMult : ''}{methodHints.technique ? ' · ' + methodHints.technique : ''}</div>}
              {plWeakPoints.length > 0 && (
                <div style={{ marginTop:8, fontSize:11, color:'#c4b5fd', background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', padding:'6px 8px', borderRadius:8 }}>
                  <div style={{ fontWeight:700, marginBottom:4 }}>🎯 Слабые точки СРЦ (добавлены ассистенты в план):</div>
                  {plWeakPoints.map((wp, i) => {
                    const rec = getPLWeakPointRecommendations(wp.lift, wp.weakPoint);
                    const liftLabelMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной' };
                    const liftLabel = liftLabelMap[wp.lift] || wp.lift;
                    const assists = rec.corrections.length ? rec.corrections : ['—'];
                    return <div key={i} style={{ marginBottom:2, overflowWrap:'break-word' }}>• <b>{PL_WEAKPOINT_LABELS[wp.weakPoint]}</b> ({liftLabel}): + {assists.join(', ')} — {rec.rationale}</div>;
                  })}
                </div>
              )}
              <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={() => setEditMode(m => !m)} style={{ padding:'6px 10px', minHeight:34, fontSize:11, fontWeight:700, cursor:'pointer', borderRadius:8, border: editMode ? '1px solid #f59e0b' : '1px solid rgba(245,158,11,0.55)', background: editMode ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{editMode ? '✓ Готово' : '✏️ Правка плана'}</button>
                {editMode && <button onClick={() => setSrcEdits({})} disabled={Object.keys(srcEdits).length===0} style={{ ...BTN_GHOST, padding:'6px 10px', minHeight:34, fontSize:11, opacity: Object.keys(srcEdits).length===0?0.4:1 }}>↺ Сбросить</button>}
                {editMode && <span style={{ ...SMALL }}>правка недели 1 применяется к «Выполнение»</span>}
                <button onClick={() => { setExpOpen(true); setExpFormat(null); setExpScope(null); setExpBlock(null); setExpWeek(null); }} style={{ padding:'6px 10px', minHeight:34, fontSize:11, fontWeight:700, cursor:'pointer', borderRadius:8, border:'1px solid rgba(96,165,250,0.55)', background:'rgba(96,165,250,0.12)', color:'#60a5fa' }}>📤 Экспорт</button>
                <button onClick={() => { const link = plShareLink({ title: builtSrc.template.meta.title, weeks: totalW, pmSquat, pmBench, pmDead, cycleId: selectedCycleId, baseUrl: window.location.href.split('#')[0] }); openPLShare(link); }} style={{ padding:'6px 10px', minHeight:34, fontSize:11, fontWeight:700, cursor:'pointer', borderRadius:8, border:'1px solid rgba(56,189,248,0.55)', background:'rgba(56,189,248,0.12)', color:'#38bdf8' }}>📲 Поделиться в ТГ</button>
              </div>
              {/* P12-wire #2: проф-авторегуляция плана — 3 режима (off/auto/diary) */}
              {(() => {
                const stt = shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0, combinedRirShift: autoRegMode === 'auto' ? autoRegResult.rirShift + bridgeRir : bridgeRir });
                const modeColor = autoRegMode === 'auto' ? '#60a5fa' : autoRegMode === 'diary' ? '#22c55e' : '#71717a';
                const segBtn = (m: AutoRegMode, label: string) => (
                  <button onClick={() => setAutoRegMode(m)} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === m ? modeColor : 'rgba(255,255,255,0.08)', color: autoRegMode === m ? '#000' : 'rgba(255,255,255,0.6)' }}>{label}</button>
                );
                return (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: autoRegMode === 'off' ? 'rgba(255,255,255,0.02)' : autoRegResult.deload ? 'rgba(239,68,68,0.08)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.06)' : 'rgba(96,165,250,0.06)', border: '1px solid ' + (autoRegMode === 'off' ? 'rgba(255,255,255,0.06)' : autoRegResult.deload ? 'rgba(239,68,68,0.25)' : autoRegMode === 'diary' ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.2)') }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                      <div>
                        <span style={{ fontSize:11, fontWeight:700, color: stt.train ? (autoRegResult.deload && autoRegMode !== 'off' ? '#ef4444' : modeColor) : '#ef4444' }}>
                          {stt.train ? '✅' : '⚠️'} {stt.reason}
                        </span>
                        {autoRegMode !== 'off' && autoRegResult.intensityNote && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: autoRegResult.intensityNote === 'силовая' ? 'rgba(239,68,68,0.15)' : autoRegResult.intensityNote === 'восстановительная' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: autoRegResult.intensityNote === 'силовая' ? '#ef4444' : autoRegResult.intensityNote === 'восстановительная' ? '#22c55e' : '#f59e0b' }}>{autoRegResult.intensityNote === 'силовая' ? 'СИЛОВАЯ' : autoRegResult.intensityNote === 'восстановительная' ? 'ВОССТАНОВИТ.' : autoRegResult.intensityNote === 'лёгкая' ? 'ЛЁГКАЯ' : ''}</span>}
                      </div>
                      <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:700, color: modeColor, marginRight: 4 }}>Авторегуляция:</span>
                        {segBtn('off', 'ВЫКЛ')}
                        {segBtn('auto', 'АВТО')}
                        {segBtn('diary', 'ДНЕВНИК')}
                      </div>
                    </div>
                    {autoRegMode === 'auto' && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload ? ' · 🔴 DELOAD' : ''}</div>
                      {autoRegResult.decisions.slice(0,3).map((d, i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                    </div>}
                    {autoRegMode === 'diary' && diaryAutoreg && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div style={{ fontWeight:700, color: '#22c55e' }}>✓ {diaryAutoreg.summary.adjusted} скорректировано · {diaryAutoreg.summary.unchanged} в норме · {diaryAutoreg.summary.noData} без данных</div>
                      {diaryAutoreg.summary.noData > 0 && <div style={{ marginTop:2, color:'#f59e0b' }}>⚠ {diaryAutoreg.summary.noData} упражнений без данных дневника — плановые веса</div>}
                      {[...diaryAutoreg.perExercise.entries()].filter(([,v]) => v.source === 'diary').slice(0,4).map(([name, adj], i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {name}: {adj.factWeight}кг→{adj.adjustedWeight}кг (RPE {adj.factRPE}) {adj.note}</div>)}
                      {diaryAutoreg.plateauWarnings.map((w, i) => <div key={'pw'+i} style={{ marginTop:2, color:'#ef4444' }}>🔴 {w}</div>)}
                    </div>}
                    {autoRegMode === 'diary' && !diaryAutoreg && <div style={{ marginTop:6, fontSize:11, color:'#f59e0b' }}>⚠ Постройте план и выберите неделю — дневниковая авторегуляция применится к весам.</div>}
                  </div>
                );
              })()}
              {/* Авторегуляция ПРОГРЕССИИ ПМ (только ПМ, без объёма) — независимый переключатель */}
              {(() => {
                const pmColor = pmAutoRegMode === 'auto' ? '#a78bfa' : pmAutoRegMode === 'diary' ? '#22c55e' : '#71717a';
                const pmSegBtn = (m: PMAutoRegMode, label: string) => (
                  <button onClick={() => setPmAutoRegMode(m)} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: pmAutoRegMode === m ? pmColor : 'rgba(255,255,255,0.08)', color: pmAutoRegMode === m ? '#000' : 'rgba(255,255,255,0.6)' }}>{label}</button>
                );
                return (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background: pmAutoRegMode === 'off' ? 'rgba(255,255,255,0.02)' : 'rgba(167,139,250,0.06)', border: '1px solid ' + (pmAutoRegMode === 'off' ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.25)') }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                      <div>
                        <span style={{ fontSize:11, fontWeight:700, color: pmAutoRegMode === 'off' ? 'rgba(255,255,255,0.4)' : pmColor }}>
                          {pmAutoRegMode === 'off' ? 'Прогрессия ПМ: по данным цикла' : pmAutoRegMode === 'auto' ? '⚡ ПМ по авторасчётам' : '📒 ПМ по дневнику'}
                        </span>
                        <span style={{ marginLeft:6, fontSize:10, color:'rgba(255,255,255,0.4)' }}>только ПМ · без объёма</span>
                      </div>
                      <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:700, color: pmColor, marginRight: 4 }}>Авторег. ПМ:</span>
                        {pmSegBtn('off', 'ВЫКЛ')}
                        {pmSegBtn('auto', 'АВТО')}
                        {pmSegBtn('diary', 'ДНЕВНИК')}
                      </div>
                    </div>
                    {pmAutoRegMode === 'auto' && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div>Темп ПМ рассчитывается автоматически (PED/курс/уровень), коррекция цикла игнорируется.</div>
                    </div>}
                    {pmAutoRegMode === 'diary' && pmDiary && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                      <div style={{ fontWeight:700, color: '#22c55e' }}>✓ {pmDiary.adjusted} скорректировано · {pmDiary.noData} без данных</div>
                      {pmDiary.decisions.slice(0,4).map((d, i) => <div key={i} style={{ marginTop:2, color:'rgba(255,255,255,0.55)' }}>• {d}</div>)}
                    </div>}
                    {pmAutoRegMode === 'diary' && !pmDiary && <div style={{ marginTop:6, fontSize:11, color:'#f59e0b' }}>⚠ Постройте план — дневниковая авторегуляция ПМ применится к кривой ПМ.</div>}
                  </div>
                );
              })()}
              {/* Exercise picker popup */}
              {pickerDay && (
                <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', background:'rgba(0,0,0,0.9)' }} onClick={() => setPickerDay(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--accent)' }}>＋ Упражнение в день</span>
                      <button onClick={() => setPickerDay(null)} style={{ fontSize:11, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', padding:'4px 8px' }}>✕</button>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', padding:'8px 12px 80px' }}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>{CAT_GROUPS.map(g => <button key={g} onClick={() => { setPickerGroup(g); setPickerExName(''); }} style={{ padding:'5px 10px', borderRadius:16, fontSize:11, cursor:'pointer', border: pickerGroup===g?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.08)', background: pickerGroup===g?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.03)', color: pickerGroup===g?'var(--accent)':'rgba(255,255,255,0.7)' }}>{GRP_RU[g]||g}</button>)}</div>
                      <select value={pickerExName} onChange={e => setPickerExName(e.target.value)} style={{ ...SEL, marginBottom:8 }}>
                        <option value=''>— выберите упражнение —</option>
                        {getExercisesByGroup(pickerGroup).map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}
                      </select>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>Подходы</span>
                        <input type='number' value={pickerScheme.sets} onChange={e => setPickerScheme(s => ({ ...s, sets: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11 }}>×</span>
                        <input type='number' value={pickerScheme.reps} onChange={e => setPickerScheme(s => ({ ...s, reps: +e.target.value }))} style={{ width:48, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11 }}>×</span>
                        <input type='number' value={pickerScheme.weight} onChange={e => setPickerScheme(s => ({ ...s, weight: +e.target.value }))} style={{ width:56, ...IN, padding:'4px', fontSize:11 }} />
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>кг</span>
                      </div>
                      <button onClick={() => addExToDay(pickerDay)} disabled={!pickerExName} style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:11, background: pickerExName ? 'linear-gradient(135deg,var(--accent),#00c8a0)' : 'rgba(255,255,255,0.1)', color: pickerExName ? '#000' : 'rgba(255,255,255,0.3)' }}>Добавить в день</button>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'#fff' }}>Неделя {wk.week} из {totalW}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:calendarColor, background:calendarBadgeTint, padding:'2px 10px', borderRadius:8 }}>{calendarLabel}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
                   {W.map(w => { const ph = displayPhaseForWeek(w, totalW); const original = sourceCalendar?.[w.week - 1]; const taper = isTaperWeek(w); const mock = isMockWeek(w); const meet = isMeetWeek(w); const post = isPostMeetWeek(w); const color = original && sourceCalendar ? sourceWeekColor(original, sourceCalendar) : meet ? MEET_COLOR : mock ? MOCK_COLOR : post ? POST_COLOR : taper ? TAPER_COLOR : PH_COLOR[ph]; const tint = original ? `color-mix(in srgb, ${color} 13%, transparent)` : color + '1a'; const label = original ? `${SOURCE_PHASE_ORIGIN_LABEL[original.phaseOrigin]} · ${SOURCE_PHASE_LABEL[original.phase]} ${Math.round(original.intensityPct * 100)}% · ${original.volumeSets} сетов` : meet ? `🏁 Соревнования · прикиды ${MEET_STRATEGY_PCT_LABEL[w.meetAttempts?.strategy ?? attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}` : mock ? `🎯 Имитация соревнований (mock meet) · прикиды-синглы` : post ? `🔄 Пост-старт восстановление (объём ×0.5, RIR +3)` : taper ? `📉 Тапер · ${Math.round(weekVolumeOf(w) / Math.max(1, weekVolumeOf(W[W.length - taperWeeksToAdd - 1] ?? W[0]))) * 100}% объёма` : PH_RU[ph]; const active = w.week===wk.week; return <button key={w.week} onClick={() => setSrcWeek(w.week)} title={'Неделя '+w.week+': '+label} style={{ padding:'6px 0', borderRadius:8, border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', background: active ? color : tint, color: active ? '#000' : '#fff', fontSize:11, fontWeight:700, cursor:'pointer', minHeight:36, minWidth:0 }}>{meet ? '🏁' : mock ? '🎯' : post ? '🔄' : taper ? '📉' : w.week}</button>; })}
                </div>
              </div>
              {/* Визуальный календарь мезоцикла: недели × дни с тоннажём и фазой */}
              <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>📅 Календарь мезоцикла (нед × дни, тоннаж)</div>
                  {/* Переключатель: оригинальный цикл / с учётом тапера */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCalendarView('original')} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: calendarView === 'original' ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)', background: calendarView === 'original' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)', color: calendarView === 'original' ? '#60a5fa' : 'rgba(255,255,255,0.55)' }}>
                      🔵 Оригинальный ({W.filter(w => !isTaperWeek(w) && !isMockWeek(w) && !isMeetWeek(w)).length} нед)
                    </button>
                    <button onClick={() => setCalendarView('tapered')} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: calendarView === 'tapered' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: calendarView === 'tapered' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: calendarView === 'tapered' ? '#f59e0b' : 'rgba(255,255,255,0.55)' }}>
                      📉 С тапером ({W.length} нед)
                    </button>
                  </div>
                </div>
                {(W.some(isTaperWeek) || W.some(isMockWeek) || W.some(isMeetWeek)) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
                    {W.some(isTaperWeek) && <span><span style={{ color: TAPER_COLOR }}>📉</span> тапер · разгрузка</span>}
                    {W.some(isMockWeek) && <span><span style={{ color: MOCK_COLOR }}>🎯</span> mock meet · прикиды-синглы</span>}
                    {W.some(isMeetWeek) && <span><span style={{ color: MEET_COLOR }}>🏁</span> соревнования · прикиды</span>}
                    {W.some(isPostMeetWeek) && <span><span style={{ color: POST_COLOR }}>🔄</span> пост-старт · восстановление</span>}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(calendarView === 'original' ? W.filter(w => !isTaperWeek(w) && !isMockWeek(w) && !isMeetWeek(w) && !isPostMeetWeek(w)) : W).map(w => { const ph = displayPhaseForWeek(w, totalW); const original = sourceCalendar?.[w.week - 1]; const taper = isTaperWeek(w); const mock = isMockWeek(w); const meet = isMeetWeek(w); const post = isPostMeetWeek(w); const color = original && sourceCalendar ? sourceWeekColor(original, sourceCalendar) : meet ? MEET_COLOR : mock ? MOCK_COLOR : post ? POST_COLOR : taper ? TAPER_COLOR : PH_COLOR[ph]; const colorFade = original ? `color-mix(in srgb, ${color} 55%, transparent)` : color + '88'; const active = w.week === wk.week; const calWeeks = calendarView === 'original' ? W.filter(ww => !isTaperWeek(ww) && !isMockWeek(ww) && !isMeetWeek(ww) && !isPostMeetWeek(ww)) : W; const maxT = Math.max(1, ...calWeeks.map(ww => ww.days.reduce((s, d) => s + d.metrics.tonnage, 0))); const wTotal = w.days.reduce((s, d) => s + d.metrics.tonnage, 0); return (
                    <div key={w.week} onClick={() => setSrcWeek(w.week)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: active ? (meet ? 'rgba(234,179,8,0.12)' : mock ? 'rgba(167,139,250,0.12)' : post ? 'rgba(52,211,153,0.1)' : taper ? 'rgba(245,158,11,0.1)' : 'var(--accent-dim)') : 'transparent', border: active ? (meet ? '1px solid rgba(234,179,8,0.45)' : mock ? '1px solid rgba(167,139,250,0.45)' : post ? '1px solid rgba(52,211,153,0.4)' : taper ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(0,230,138,0.3)') : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? (meet ? '#eab308' : mock ? '#a78bfa' : post ? '#34d399' : taper ? '#f59e0b' : 'var(--accent)') : 'rgba(255,255,255,0.7)', minWidth: 26 }}>{meet ? '🏁' : mock ? '🎯' : post ? '🔄' : taper ? '📉' : 'Н' + w.week}</span>
                       <span style={{ width: 4, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} title={original ? `${SOURCE_PHASE_ORIGIN_LABEL[original.phaseOrigin]} · ${SOURCE_PHASE_LABEL[original.phase]}: ${Math.round(original.intensityPct * 100)}% · ${original.volumeSets} сетов` : meet ? '🏁 Соревнования: прикиды как подходы' : mock ? '🎯 Имитация соревнований: прикиды-синглы' : post ? '🔄 Пост-старт: объём ×0.5, RIR +3' : taper ? '📉 Тапер: объём снижен, RIR +1/+2, интенсивность сохранена' : PH_RU[ph]} />
                      <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                          {w.days.map((d, di) => { const t = d.metrics.tonnage; return <div key={di} title={'Д' + (di+1) + ': ' + t.toFixed(0) + ' кг·пов'} style={{ flex: 1, height: 14, borderRadius: 3, background: t > 0 ? `linear-gradient(180deg, ${color}, ${colorFade})` : 'rgba(255,255,255,0.04)', opacity: 0.4 + 0.6 * (t / maxT) }} />; })}
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 38, textAlign: 'right' }}>{wTotal.toFixed(0)}</span>
                    </div>
                  ); })}
                </div>
              </div>
              <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
                {splitDescriptionPoints(calendarDescription).map((point, i) => (
                  <div key={i} style={{ fontSize:10, color:'rgba(255,255,255,0.65)', padding:'5px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', lineHeight:1.4, wordBreak:'break-word' }}>
                    <span style={{ color: calendarColor, fontWeight:800 }}>•</span> {point}
                  </div>
                ))}
              </div>
              <MetricCard title={'ПМ на неделю '+wk.week+' (прогрессия)'} icon="📈" accent="#60a5fa">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{Object.entries(wk.pmRow).map(([n, pm]) => <span key={n} style={{ ...SMALL, color:'#fff', background:'rgba(96,165,250,0.08)', padding:'3px 8px', borderRadius:6, border:'1px solid rgba(96,165,250,0.15)' }}><b>{n}:</b> {pm.toFixed(1)} кг</span>)}</div>
              </MetricCard>
              {/* График прогрессии ПМ по неделям */}
              {builtSrc && Array.isArray(builtSrc.weeks) && builtSrc.weeks.length > 0 && (() => {
                const exNames = Object.keys(builtSrc.weeks[0]?.pmRow || {}).slice(0, 3);
                if (exNames.length === 0) return null;
                const allVals = builtSrc.weeks.flatMap(w => exNames.map(n => w.pmRow[n] || 0));
                const minV = Math.min(...allVals), maxV = Math.max(...allVals);
                const W2 = builtSrc.weeks.length;
                const colors = ['var(--accent)', '#60a5fa', '#a855f7'];
                const px = (i: number) => 24 + (i / Math.max(1, W2 - 1)) * 280;
                const py = (v: number) => 70 - ((v - minV) / Math.max(1, maxV - minV)) * 56;
                return <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📈 Прогрессия ПМ по неделям</div>
                  <svg width="100%" viewBox="0 0 320 80" style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
                    {[0,1,2,3].map(g => <line key={g} x1={24} x2={304} y1={14 + g * 18} y2={14 + g * 18} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />)}
                    {exNames.map((n, ei) => { const pts = builtSrc.weeks.map((w, i) => `${px(i)},${py(w.pmRow[n] || 0)}`).join(' '); return <polyline key={n} points={pts} fill="none" stroke={colors[ei]} strokeWidth={1.6} />; })}
                    {exNames.map((n, ei) => builtSrc.weeks.map((w, i) => <circle key={n + i} cx={px(i)} cy={py(w.pmRow[n] || 0)} r={2} fill={colors[ei]} />))}
                  </svg>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>{exNames.map((n, ei) => <span key={n} style={{ fontSize: 10, color: colors[ei] }}>● {n}</span>)}</div>
                </div>;
              })()}
              {(goal === 'peak' || W.some(isTaperWeek) || W.some(isMeetWeek) || W.some(isMockWeek)) && (() => {
                const hasDiary = e1rmSeries.length > 0;
                const diaryLast = (lift: 'squat' | 'bench' | 'deadlift'): number | null => {
                  const keywords: Record<typeof lift, string[]> = { squat: ['присед'], bench: ['жим лёжа', 'жим лежа'], deadlift: ['становая'] };
                  const series = e1rmSeries.find(s => keywords[lift].some(k => s.label.toLowerCase().includes(k) || s.lift === lift));
                  return series?.pts.at(-1)?.val ?? null;
                };
                const diaryVals = { squat: diaryLast('squat'), bench: diaryLast('bench'), deadlift: diaryLast('deadlift') };
                const diaryApplied = Object.values(diaryVals).some(v => v != null);
                return (
                <MetricCard title={`🏁 Попытки на соревнования${W.some(isTaperWeek) ? ` · ${MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}` : ''}`} icon="🏁" accent="#f59e0b">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {([['Присед', pmSquat], ['Жим', pmBench], ['Становая', pmDead]] as const).map(([name, value]) => {
                      const a = competitionAttempts(value);
                      return <div key={name} style={{ padding: 6, borderRadius: 6, background: 'rgba(245,158,11,0.08)', fontSize: 10 }}><b>{name}</b><div>1: {a.openerRange[0]}–{a.openerRange[1]} кг</div><div>2: {a.secondRange[0]}–{a.secondRange[1]} кг</div><div>3: {a.thirdRange[0]}–{a.thirdRange[1]} кг</div><div style={{ color: '#f59e0b', marginTop: 3 }}>рекоменд.: {a.opener}/{a.second}/{a.third}</div></div>;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      disabled={!hasDiary}
                      onClick={() => {
                        calibratePmFromDiary('squat'); calibratePmFromDiary('bench'); calibratePmFromDiary('deadlift');
                        onNote('📈 ПМ обновлены из дневника — попытки на соревнования пересчитаны автоматически.');
                      }}
                      style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10, border: hasDiary ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)', color: hasDiary ? '#00e68a' : 'rgba(255,255,255,0.3)', background: hasDiary ? 'rgba(0,230,138,0.08)' : 'transparent' }}
                      title="Заполнить ПМ из последних 1ПМ дневника тренировок (как в полях ПМ) — попытки пересчитаются"
                    >📈 Из дневника{diaryApplied ? ` (присед ${diaryVals.squat ?? '—'} · жим ${diaryVals.bench ?? '—'} · тяга ${diaryVals.deadlift ?? '—'})` : ''}</button>
                    {!hasDiary && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>нет записей в дневнике — попытки от введённых ПМ</span>}
                  </div>
                </MetricCard>
                );
              })()}
              {(wk.meetAttempts && wk.meetAttempts.lifts.length > 0) && (() => {
                const arMult = autoRegMode === 'auto' && autoRegResult ? autoRegResult.topSetPctMultiplier : 1;
                // Прикиды и warmup масштабируются в ДВИЖКЕ (appendPLTaperWeeks.autoReg) —
                // здесь показываем итоговые числа плана как есть (scale = identity).
                const scale = (w: number) => w;
                return (
                <MetricCard title={`${wk.meetWeek ? '🏁 Неделя соревнований' : wk.mockMeet ? '🎯 Имитация соревнований (mock meet)' : '🏁 Соревновательный день'} · прикиды ${MEET_STRATEGY_PCT_LABEL[wk.meetAttempts.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced} (неделя ${wk.week})${arMult !== 1 ? ` · авторегуляция ×${arMult.toFixed(2)}` : ''}`} icon={wk.meetWeek ? '🏁' : wk.mockMeet ? '🎯' : '🏁'} accent={wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b'}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                    {wk.meetAttempts.lifts.map(l => (
                      <div key={l.name} style={{ padding: 6, borderRadius: 6, background: wk.meetWeek ? 'rgba(234,179,8,0.08)' : wk.mockMeet ? 'rgba(167,139,250,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${wk.meetWeek ? 'rgba(234,179,8,0.3)' : wk.mockMeet ? 'rgba(167,139,250,0.25)' : 'rgba(245,158,11,0.2)'}`, fontSize: 10 }}>
                        <b style={{ color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b' }}>{l.name}</b>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 2px' }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>1-я</div><b style={{ fontSize: 12 }}>{scale(l.opener)}</b></div>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 2px' }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>2-я</div><b style={{ fontSize: 12 }}>{scale(l.second)}</b></div>
                          <div style={{ textAlign: 'center', background: wk.meetWeek ? 'rgba(234,179,8,0.14)' : wk.mockMeet ? 'rgba(167,139,250,0.14)' : 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '4px 2px', border: `1px solid ${wk.meetWeek ? 'rgba(234,179,8,0.4)' : wk.mockMeet ? 'rgba(167,139,250,0.35)' : 'rgba(245,158,11,0.3)'}` }}><div style={{ color: 'rgba(255,255,255,0.5)' }}>3-я</div><b style={{ fontSize: 12, color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#f59e0b' }}>{scale(l.third)}</b></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Разминка по опенеру (канон warmupToOpener в MeetAttemptsInfo) — от масштабированного опенера */}
                  {(() => {
                    const first = wk.meetAttempts!.lifts[0];
                    if (!first || !first.warmup || first.warmup.length === 0) return null;
                    return (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                        🔥 Разминка под опенер {first.opener} кг ({first.name}): {first.warmup.map(s => `${Math.round(s.pct * 100)}%×${s.reps}`).join(' → ')} ({first.warmup.map(s => s.weight).join('/')} кг)
                      </div>
                    );
                  })()}
                  {/* Последние тяжёлые движения (тайминг разгрузки) */}
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    ⏱ Последние тяжёлые: {([['Присед', LAST_HEAVY_DAYS.squat], ['Жим', LAST_HEAVY_DAYS.bench], ['Тяга', LAST_HEAVY_DAYS.deadlift]] as const).map(([n, d]) => `${n} — за ${d} дн.`).join(' · ')} до старта.
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>
                    {wk.meetWeek
                      ? '🏁 День старта: прикиды — реальные попытки на соревнованиях (опенер RIR2 → вторая RIR1 → третья RIR0). Разгрузка выполнена тапер-неделями — план полностью готов.'
                      : wk.mockMeet
                      ? '🎯 Это ТРЕНИРОВОЧНАЯ неделя за 10-14 дней до старта: прикиды-синглы на 100% усилия (опенер RIR2 → вторая RIR1 → третья RIR0) — проверка стратегии. После неё — тапер-разгрузка, а затем реальные прикиды на соревнованиях.'
                      : '📉 Разгрузка уже выполнена тапер-неделями (объём ×0.65/×0.45, RIR +1/+2, интенсивность сохранена — Bosquet 2005). Прикиды — план дня соревнований, не тренировочная нагрузка: разминка по опенеру, подходы строго по стратегии, между попытками 10-20 мин.'}
                  </div>
                </MetricCard>
                );
                })()}
              {e1rmSeries.length > 0 && (() => {
                const W = 300, H = 120, PADX = 26, PADY = 16;
                const allVals = e1rmSeries.flatMap(s => s.pts.map(p => p.val));
                const minV = Math.min(...allVals, pmSquat, pmBench, pmDead);
                const maxV = Math.max(...allVals, pmSquat, pmBench, pmDead);
                const maxPts = Math.max(...e1rmSeries.map(s => s.pts.length), 1);
                const px = (i: number) => PADX + (maxPts <= 1 ? 0 : (i / (maxPts - 1)) * (W - PADX - 8));
                const py = (v: number) => H - PADY - ((v - minV) / ((maxV - minV) || 1)) * (H - PADY - 14);
                return (
                  <MetricCard title={'Прогресс 1ПМ (дневник тренировок)'} icon="📈">
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
                      {[0, 1, 2, 3].map(g => <line key={g} x1={PADX} x2={W - 8} y1={14 + g * ((H - PADY - 14) / 3)} y2={14 + g * ((H - PADY - 14) / 3)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />)}
                      {e1rmSeries.map(s => <polyline key={s.lift} points={s.pts.map((p, i) => `${px(i)},${py(p.val)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} />)}
                      {e1rmSeries.map(s => s.pts.map((p, i) => <circle key={s.lift + i} cx={px(i)} cy={py(p.val)} r={2} fill={s.color} />))}
                    </svg>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>{e1rmSeries.map(s => <span key={s.lift} style={{ fontSize: 11, color: s.color }}>● {s.label} {s.pts[s.pts.length - 1].val} кг</span>)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>PM0 плана: присед {pmSquat} · жим {pmBench} · становая {pmDead} кг</div>
                    {exerciseE1rm.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--accent-dim)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Личные 1ПМ по упражнениям (из дневника):</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: '3px 8px', fontSize: 11, alignItems: 'center' }}>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Упражнение</div>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>1ПМ</div>
                          <div style={{ color: 'var(--text-dim)', fontWeight: 600, textAlign: 'right' }}>подход</div>
                          {exerciseE1rm.slice(0, 15).map((e) => (
                            <React.Fragment key={e.name}>
                              <div style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{e.name}</div>
                              <div style={{ color: 'var(--accent)', fontWeight: 700, textAlign: 'right' }}>{e.e1}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{e.w}×{e.r}</div>
                            </React.Fragment>
                          ))}
                        </div>
                        {exerciseE1rm.length > 15 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>показано 15 из {exerciseE1rm.length}</div>}
                      </div>
                    )}
                    {exerciseE1rm.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--accent-dim)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Тренд 1ПМ по упражнению (график во времени):</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                          {exerciseE1rm.slice(0, 10).map((e) => (
                            <button key={e.name} onClick={() => setSelectedTrendEx(s => s === e.name ? null : e.name)}
                              style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                border: selectedTrendEx === e.name ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                                background: selectedTrendEx === e.name ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                                color: selectedTrendEx === e.name ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}>
                              {e.name} ({e.e1}кг)
                            </button>
                          ))}
                        </div>
                        {selectedTrendEx && exTrendSeries.length >= 2 && (() => {
                          const W = 300, H = 100, PADX = 28, PADY = 16;
                          const vals = exTrendSeries.map(p => p.e1);
                          const minV = Math.min(...vals) - 5;
                          const maxV = Math.max(...vals) + 5;
                          const n = exTrendSeries.length;
                          const px = (i: number) => PADX + (i / Math.max(n - 1, 1)) * (W - PADX - 8);
                          const py = (v: number) => H - PADY - ((v - minV) / ((maxV - minV) || 1)) * (H - PADY - 12);
                          return (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{selectedTrendEx}</div>
                              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
                                {[0, 1, 2].map(g => <line key={g} x1={PADX} x2={W - 8} y1={12 + g * ((H - PADY - 12) / 2)} y2={12 + g * ((H - PADY - 12) / 2)} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />)}
                                <polyline points={exTrendSeries.map((p, i) => `${px(i)},${py(p.e1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
                                {exTrendSeries.map((p, i) => <circle key={i} cx={px(i)} cy={py(p.e1)} r={2.5} fill="var(--accent)" />)}
                              </svg>
                              <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, color: 'var(--accent)' }}>посл: {exTrendSeries[exTrendSeries.length - 1].e1}кг</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>макс: {maxV.toFixed(0)}кг</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>тренировок: {n}</span>
                              </div>
                            </div>
                          );
                        })()}
                        {selectedTrendEx && exTrendSeries.length < 2 && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>нужно ≥2 тренировок для графика (найдено {exTrendSeries.length})</div>
                        )}
                      </div>
                    )}
                  </MetricCard>
                );
              })()}
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                <SaveButton label="💾 Сохранить программу" savedLabel="✓ Программа сохранена" onSave={() => {
                  try {
                    const cycle = LMS_CYCLES.find(c => c.meta.id === selectedCycleId);
                    // Полный формат «Моих тренировок»: id + exercises (иначе вкладка «Планы» крашится на plan.exercises.length).
                    const week1 = builtSrc.weeks[0];
                    const exercises = week1 ? week1.days.flatMap(d => d.exercises.map(e => ({
                      name: e.name,
                      sets: e.workSets.reduce((s, ws) => s + ws.sets, 0),
                      reps: e.workSets[0]?.reps ?? 5,
                      rir: e.workSets[0]?.rir ?? e.rir ?? 2,
                    }))) : [];
                    const plan = { id: 'plplan_' + Date.now(), name: `PL ${cycle?.meta.title || selectedCycleId || 'цикл'}`, date: new Date().toISOString(), exercises, weekCount: totalW, cycleWeeks };
                    const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
                    // Отбрасываем битые записи старых версий (без exercises) — они ломали рендер «Планы».
                    const updated = [...(Array.isArray(existing) ? existing : []).filter((p: any) => p && typeof p === 'object' && Array.isArray(p.exercises)), plan].slice(-30);
                    localStorage.setItem('myTrainingPlans', JSON.stringify(updated));
                    onNote(`✓ Программа сохранена в «Мои тренировки»: ${plan.name} — ${exercises.length} упр. · ${totalW} нед`);
                  } catch (e) { onNote(`⚠ Ошибка сохранения: ${(e as Error).message}`); }
                }} />
                <button
                  onClick={() => {
                    if (!builtSrc || playerDays.length === 0) { onNote('⚠ Сначала сгенерируйте план'); return; }
                    try {
                      // План уже пишется в he_pl_runtime эффектом выше; фиксируем выбранную неделю явно.
                      localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: runFocus, week: srcWeek, track: 'pl' }));
                      localStorage.setItem('he_training_tab', 'runtime');
                      if (typeof (window as any).__navigateToTrainingTab === 'function') {
                        (window as any).__navigateToTrainingTab('runtime');
                      } else {
                        onNote('▶ План готов к выполнению: откройте «Тренировки → Проведение тренировки».');
                      }
                    } catch (e) { onNote(`⚠ Не удалось запустить: ${(e as Error).message}`); }
                  }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 44,
                    background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontWeight: 800, fontSize: 12 }}
                  title="Записать план в «Проведение тренировки» и открыть выполнение (SessionPlayer)"
                >▶ Начать работу по циклу</button>
              </div>
              {/* Явная подпись недели в понедельном плане: соревнования / имитация / тапер не выглядят как обычные */}
              {isMeetWeek(wk) && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)', fontSize: 11, color: '#eab308', lineHeight: 1.45 }}>
                  🏁 <b>Неделя соревнований</b> — прикиды как подходы дня старта (опенер RIR2 → вторая RIR1 → третья RIR0, {wk.meetAttempts ? (MEET_STRATEGY_PCT_LABEL[wk.meetAttempts.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced) : MEET_STRATEGY_PCT_LABEL.balanced} от ПМ недели). Разгрузка выполнена тапер-неделями — план готов полностью.
                </div>
              )}
              {isMockWeek(wk) && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.35)', fontSize: 11, color: '#a78bfa', lineHeight: 1.45 }}>
                  🎯 <b>Имитация соревнований (mock meet)</b> — прикиды-синглы за 10-14 дней до старта (опенер RIR2 → вторая RIR1 → третья RIR0), аксессуары 50% объёма. Проверка стратегии перед реальными соревнованиями.
                </div>
              )}
              {isTaperWeek(wk) && !isMockWeek(wk) && !isMeetWeek(wk) && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', fontSize: 11, color: '#f59e0b', lineHeight: 1.45 }}>
                  📉 <b>Тапер-неделя</b> — разгрузка: объём ×0.65/×0.45, RIR +1/+2, интенсивность сохранена (Bosquet 2005). Восстановление перед соревнованиями.
                </div>
              )}
              {wk.days.map((d, di) => {
                const sourcePhase = sourceWeek?.phase || phase;
                const dayPhase: PhaseKey = ({ base: 'accumulation', build: 'intensification', peak: 'peaking', deload: 'deload' } as Record<string, PhaseKey>)[sourcePhase] || 'accumulation';
                const loadStr = d.exercises[0]?.load ? ' · ' + d.exercises[0].load : '';
                const volumeTag = `${d.metrics.tonnage.toFixed(0)}т · ${d.metrics.kpsh}КПШ · УОИ ${d.metrics.uoi.toFixed(2)}`;
                const roleOf = (load?: string) => (load === 'main' ? 'main' : load === 'additional' ? 'additional' : 'accessory');
                const dk = dayKey(wk.week, di);
                if (editMode) {
                  return (
                    <DayCard key={di} day={{
                      key: 'day-' + di,
                      title: `🏋️ День ${di + 1}${loadStr}`,
                      phase: dayPhase,
                      volumeTag,
                      renderBody: (
                        <>
                           {d.exercises.map((e, ei) => (
                              <div key={ei} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8, padding:'6px 8px', marginBottom:4, border:'1px solid rgba(255,255,255,0.04)', overflow:'hidden', boxSizing:'border-box' }}>
                               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:2 }}>
                                 <span style={{ fontSize:11, fontWeight:600, color:'#fff', flex:1, minWidth:0, overflowWrap:'break-word' }}>{e.name}</span>
                                  <span style={{ fontSize:11, color:e.load === 'main' ? 'var(--accent)' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight:600, padding:'1px 6px', borderRadius:4, flexShrink:0, background: e.load === 'main' ? 'var(--accent-dim)' : e.load === 'additional' ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                                   {e.load === 'main' ? 'ОСН' : e.load === 'additional' ? 'ДОП' : 'АКС'}
                                 </span>
                               </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                                {(() => {
                                  const allSets: { ws: typeof e.workSets[number]; blockIdx: number; setIdx: number }[] = [];
                                  e.workSets.forEach((ws, bi) => { for (let r=0; r<ws.sets; r++) allSets.push({ ws, blockIdx: bi, setIdx: allSets.length }); });
                                  const INM: React.CSSProperties = { background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'5px 4px', fontSize:12, textAlign:'center', minWidth:0 };
                                  const IN_LBL: React.CSSProperties = { fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const, letterSpacing:0.5, textAlign:'center' as const };
                                  return allSets.map(({ ws, blockIdx, setIdx }) => {
                                    const k = setKey(wk.week, di, ei, setIdx);
                                    const es = effSet(wk.week, di, ei, setIdx, ws);
                                    return (
                                      <div key={setIdx} style={{ background:'rgba(255,255,255,0.025)', borderRadius:6, padding:'4px 6px' }}>
                                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:2, fontWeight:600, display:'flex', justifyContent:'space-between' }}><span>Сет {setIdx+1}</span><span style={{ color:'#60a5fa', fontWeight:700 }}>{Math.round(es.pct*100)}%</span></div>
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                                          <div><div style={IN_LBL}>Вес, кг</div><input type='number' value={es.weight} onChange={ev => setSrcEdits(prev => { const next = { ...prev, [k]: { ...(prev[k] ?? {}), weight: +ev.target.value } }; delete next[k].pct; return next; })} style={{ ...INM, width:'100%' }} /></div>
                                          <div><div style={IN_LBL}>Повторы</div><input type='number' value={es.reps} onChange={ev => setSrcEdits(prev => ({ ...prev, [k]: { ...prev[k], reps: +ev.target.value } }))} style={{ ...INM, width:'100%' }} /></div>
                                          <div><div style={IN_LBL}>% ПМ</div><input type='number' value={Math.round(es.pct*100)} min={0} max={110} onChange={ev => setSrcEdits(prev => { const next = { ...prev, [k]: { ...(prev[k] ?? {}), pct: (+ev.target.value) / 100 } }; delete next[k].weight; return next; })} style={{ ...INM, width:'100%' }} title='% от ПМ недели — вес пересчитается автоматически' /></div>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          ))}
                          {(srcAdditions[dk] || []).map(a => (
                             <div key={a.uid} style={{ display:'flex', flexDirection:'column', gap:4, padding:'5px 0', borderBottom:'1px solid var(--accent-dim)' }}>
                               <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0 }}>
                                 <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                                 <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', flexShrink:0 }}>＋ добавлено</span>
                                 <button onClick={() => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).filter(x => x.uid !== a.uid) }; })} style={{ fontSize:11, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', flexShrink:0 }}>✕</button>
                               </div>
                               <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3 }}>
                                 <input type='number' value={a.sets} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, sets: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='подходы' title='подходы'/>
                                 <input type='number' value={a.reps} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, reps: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='повт' title='повторы'/>
                                 <input type='number' value={a.weight} onChange={ev => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).map(x => x.uid===a.uid ? { ...x, weight: +ev.target.value } : x) }; })} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'6px 2px', fontSize:11, textAlign:'center', minWidth:0, width:'100%' }} aria-label='вес' title='вес, кг'/>
                               </div>
                             </div>
                           ))}
                          <button onClick={() => { setPickerDay(dk); setPickerExName(''); }} style={{ marginTop:6, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, border:'1px dashed rgba(0,230,138,0.4)', background:'var(--accent-dim)', color:'var(--accent)', cursor:'pointer' }}>＋ Добавить упражнение из каталога</button>
                        </>
                      ),
                    }} />
                  );
                }
                return (
                  <DayCard key={di} day={{
                    key: 'day-' + di,
                    title: `🏋️ День ${di + 1}${loadStr}`,
                    phase: dayPhase,
                    volumeTag,
                    renderBody: (
                      <>
                        {d.exercises.map((e, ei) => {
                          const tmpo = getTempo(e.name, goal, e.load === 'main');
                          const isCompound = !e.name.toLowerCase().includes('сгибан') && !e.name.toLowerCase().includes('разгибан') && !e.name.toLowerCase().includes('подъём') && !e.name.toLowerCase().includes('махи');
                          const roleColor = e.load === 'main' ? '#00e68a' : e.load === 'additional' ? '#f59e0b' : 'rgba(255,255,255,0.55)';
                          const charColor = e.load === 'main' ? '#60a5fa' : e.load === 'additional' ? '#a855f7' : 'rgba(255,255,255,0.5)';
                          const charLabel = e.load === 'main' ? '💪 Тяж' : e.load === 'additional' ? '🩸 Памп' : '🌿 Лёг';
                          const roleLabel = e.load === 'main' ? '🎯 Основное' : e.load === 'additional' ? '📌 Добивка' : '⚙️ Аксессуар';
                           const rawFirstWs = e.workSets[0] ? effSet(wk.week, di, ei, 0, e.workSets[0]) : null;
                           const diaryAdj = autoRegMode === 'diary' && diaryAutoreg ? diaryAutoreg.perExercise.get(e.name) : undefined;
                            const firstWs = rawFirstWs ? {
                              ...rawFirstWs,
                              sets: diaryAdj ? diaryAdj.adjustedSets : rawFirstWs.sets,
                              weight: diaryAdj ? diaryAdj.adjustedWeight : rawFirstWs.weight,
                              rir: diaryAdj ? diaryAdj.adjustedRir : (e.workSets[0]?.rir ?? e.rir),
                            } : null;
                            const adjustedMark = diaryAdj ? ' 📓' : '';
                            const adjustDisplaySet = (ws: typeof e.workSets[number], si: number) => {
                               const raw = { ...effSet(wk.week, di, ei, si, ws), rir: ws.rir };
                              const adjusted = diaryAdj
                                ? { ...raw, sets: diaryAdj.adjustedSets, weight: diaryAdj.adjustedWeight, rir: diaryAdj.adjustedRir }
                                : raw;
                              return adjusted;
                            };
                           const firstRir = firstWs?.rir;
                          const setSummary = firstWs ? (firstWs.sets + '×' + firstWs.reps + ' @ ' + Math.round(firstWs.pct*100) + '%') : '';
                          const tempo = tempoStr || tmpo.tempo.toString;
                          return (
                            <div key={ei} style={{ padding:'8px 10px', marginBottom:6, background:'rgba(255,255,255,0.025)', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
                              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:5, minWidth:0 }}>
                                <span style={{ minWidth:20, height:20, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:11, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{ei+1}</span>
                                <span style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1.2, flex:1, minWidth:0, overflowWrap:'break-word' }}>{e.name}</span>
                              </div>
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:(isCompound?'#00e68a':'#f59e0b')+'20', color:isCompound?'#00e68a':'#f59e0b', border:'0.5px solid '+(isCompound?'#00e68a':'#f59e0b')+'30' }}>{isCompound?'База':'Изо'}</span>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:roleColor+'20', color:roleColor, border:'0.5px solid '+roleColor+'30' }}>{roleLabel}</span>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:charColor+'20', color:charColor, border:'0.5px solid '+charColor+'30' }}>{charLabel}</span>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:5 }}>
                                 {firstWs && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(34,197,94,0.1)', border:'0.5px solid rgba(34,197,94,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(34,197,94,0.8)' }}>Сеты</span><b style={{color:'#fff'}}>{e.workSets.reduce((n,ws)=>n+ws.sets,0)}×{firstWs.reps}{adjustedMark}</b></span>}
                                <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(245,158,11,0.1)', border:'0.5px solid rgba(245,158,11,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(245,158,11,0.8)' }}>RIR</span><b style={{color:'#fff'}}>{firstRir ?? e.rir}</b></span>
                                 {firstWs && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(96,165,250,0.1)', border:'0.5px solid rgba(96,165,250,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(96,165,250,0.8)' }}>Вес</span><b style={{color:'#fff'}}>{firstWs.weight}кг{adjustedMark}</b></span>}
                                 {tempo && <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(168,85,247,0.1)', border:'0.5px solid rgba(168,85,247,0.2)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(168,85,247,0.8)' }}>Темп</span><b style={{color:'#fff'}}>{tempo}</b></span>}
                                <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', padding:'3px 6px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'0.5px solid rgba(255,255,255,0.1)', display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(255,255,255,0.6)' }}>Группа</span><b style={{color:'#fff'}}>{e.group}</b></span>
                              </div>
                              <div style={{ marginTop:5, display:'flex', flexDirection:'column', gap:3 }}>
                                {(() => {
                                  const allSets: { ws: typeof e.workSets[number]; si: number; blockIdx: number; repIdx: number }[] = [];
                                  e.workSets.forEach((ws, blockIdx) => {
                                    for (let r = 0; r < ws.sets; r++) {
                                      allSets.push({ ws, si: allSets.length, blockIdx, repIdx: r });
                                    }
                                  });
                                  return allSets.map(({ ws, si, blockIdx }) => {
                                    const es = adjustDisplaySet(ws, blockIdx);
                                    return (
                                      <div key={si} style={{ fontSize:11, color:'rgba(255,255,255,0.8)', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                        <span style={{ fontSize:9, fontWeight:700, color:'rgba(0,230,138,0.7)', minWidth:40 }}>Сет {si+1}</span>
                                        <span style={{ fontWeight:700, color:'#fff' }}>{es.reps} повт</span>
                                        <span style={{ color:'#60a5fa', fontWeight:700 }}>{Math.round(es.pct*100)}%</span>
                                        <span style={{ color:'rgba(255,255,255,0.6)' }}>{es.weight}кг</span>
                                        {typeof es.rir === 'number' && <span style={{ color:'#f59e0b' }}>RIR {es.rir}</span>}
                                        {adjustedMark && <span style={{ fontSize:9 }}>{adjustedMark}</span>}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        })}
                        {(srcAdditions[dk] || []).map(a => (
                          <div key={a.uid} style={{ padding:'6px 10px', marginBottom:6, background:'rgba(0,230,138,0.05)', borderRadius:10, border:'0.5px solid rgba(0,230,138,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                            <div style={{ minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              <span style={{ fontSize:13, fontWeight:800, color:'#00e68a' }}>＋ {a.name}</span>
                              <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginLeft:6 }}>{a.sets}×{a.reps}×{a.weight}кг</span>
                            </div>
                            <button onClick={() => setSrcAdditions(prev => { return { ...prev, [dk]: (prev[dk]||[]).filter(x => x.uid !== a.uid) }; })} style={{ fontSize:11, color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', borderRadius:5, padding:'4px 8px', cursor:'pointer', flexShrink:0 }}>✕</button>
                          </div>
                        ))}
                      </>
                    ),
                  }} />
                );
              })}
              <MetricCard title={'Итоги мезоцикла ('+totalW+' нед)'} icon="📊">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Тоннаж: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.tonnage.toFixed(0)}</b> кг·пов</div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>КПШ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.kpsh}</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>Инт. отн: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.relIntensity.toFixed(3)}</b></div>
                  <div style={{ ...SMALL, background:'var(--accent-dim)', padding:'6px 8px', borderRadius:8 }}>УОИ: <b style={{color:'#fff'}}>{builtSrc.cycleMetrics.uoi.toFixed(3)}</b></div>
                </div>
              </MetricCard>
              {builtSrc && builtSrc.plVolumeLandmarks && builtSrc.plVolumeLandmarks.length > 0 && (
                <MetricCard title={'Объём vs MRV (volume-landmarks)'} icon="📊">
                  <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, marginBottom:8 }}>
                    Пиковая неделя: {builtSrc.plVolumeLandmarks[0].peakWeek}{W.some(w => w.macroPhase === 'competition') ? ` · 📉 +${W.filter(w => w.macroPhase === 'competition').length} тапер-нед` : ''}{pedAuto && peds.length > 0 ? ` · 💉 MRV ×${Math.max(1, (() => { try { const lm = Object.fromEntries(Object.entries(getAllVolumeLandmarks(level)).map(([k, v]) => [k, v.mrv])); return adaptForPEDs(peds, lm, pedDoses, courseIntensity).combinedMrvMultiplier; } catch { return 1; } })()).toFixed(2)} (PED)` : ''}
                  </div>
                  {builtSrc.plVolumeLandmarks.map((lm) => {
                    const c = lm.status === 'over' ? '#ff5252' : lm.status === 'high' ? '#ffb74d' : lm.status === 'optimal' ? '#4caf50' : '#90caf9';
                    const lbl = lm.status === 'over' ? 'ПЕРЕБОР' : lm.status === 'high' ? 'высоко' : lm.status === 'optimal' ? 'оптимум' : 'низко';
                    return (
                      <div key={lm.group} style={{ marginBottom: 6, minWidth: 0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ color:'#fff', fontSize:12, minWidth: 0, overflowWrap: 'break-word' }}>{lm.muscle}</span>
                          <span style={{ color: c, fontSize:11, fontWeight:700, whiteSpace: 'nowrap' }}>{lm.sets} сет · MRV {lm.mrv} · {lbl}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>MAV {lm.mav} · MEV {lm.mev}</div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.1)', borderRadius:3, marginTop:3, overflow:'hidden' }}>
                          <div style={{ width: `${Math.min(100, (lm.sets / lm.mrv) * 100)}%`, height:'100%', background:c, borderRadius:3 }} />
                        </div>
                      </div>
                    );
                  })}
                  {builtSrc.plVolumeLandmarks.some(l => l.status === 'over') && (
                    <div style={{ color:'#ff5252', fontSize:11, marginTop:4 }}>⚠ Объём выше MRV — риск перетренированности. Снизьте подходы или добавьте разгрузку.</div>
                  )}
                </MetricCard>
              )}
              {/* Календарь цикла: оригинальный / с учётом тапера */}
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button onClick={() => setCalendarView('original')} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: calendarView === 'original' ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)', background: calendarView === 'original' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)', color: calendarView === 'original' ? '#60a5fa' : 'rgba(255,255,255,0.55)' }}>
                  🔵 Оригинальный ({originalCycleWeeks(getCycleById(selectedCycleId)!) ?? totalW} нед)
                </button>
                <button onClick={() => setCalendarView('tapered')} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: calendarView === 'tapered' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: calendarView === 'tapered' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: calendarView === 'tapered' ? '#f59e0b' : 'rgba(255,255,255,0.55)' }}>
                  📉 С тапером ({totalW} нед)
                </button>
              </div>
              <MesocycleProgressionCard
                weeks={totalW}
                sourceWeeks={(() => {
                  if (calendarView === 'tapered') {
                    // С учётом тапера: все недели плана (оригинал + mock + тапер + соревнования)
                    return W.map(wk => {
                      let volumeSets = 0, intNum = 0, rirNum = 0;
                      for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) {
                        volumeSets += ws.sets;
                        intNum += ws.pct * ws.sets;
                        rirNum += (ws.rir ?? 0) * ws.sets;
                      }
                      return {
                        week: wk.week,
                        volumeSets,
                        intensityPct: volumeSets > 0 ? intNum / volumeSets : 0,
                        rir: volumeSets > 0 ? rirNum / volumeSets : 0,
                        phase: (wk.sourcePhase || 'peak') as MesocyclePhase,
                        phaseOrigin: wk.sourcePhaseOrigin ?? ('inferred' as const),
                      };
                    });
                  }
                  const sourceCycle = getCycleById(selectedCycleId);
                  // Только оригинальные недели решают про исходный календарь: добавленные
                  // тапер/mock meet/неделя соревнований (macroPhase/taperWeek) не должны
                  // «перекрашивать» цикл.
                  if (!sourceCycle || W.filter(w => !isTaperWeek(w) && !isMockWeek(w) && !isMeetWeek(w)).some(week => week.macroPhase)) return undefined;
                  const layouts = sourceCycle.weeks && sourceCycle.weeks.length > 0
                    ? sourceCycle.weeks
                    : Array.from({ length: originalCycleWeeks(sourceCycle) }, () => sourceCycle.week1);
                   return summarizeSourceCycleWeeks(layouts, sourceCycle.meta.period, sourceCycle.meta.sourcePhases, sourceCycle.meta.sourcePhaseSource ?? 'original');
                })()}
                weekOverrides={(() => {
                  if (calendarView !== 'tapered') return undefined;
                  const ov: Record<number, { label: string; color: string }> = {};
                  for (const w of W) {
                    if (isMeetWeek(w)) ov[w.week] = { label: '🏁 Соревнования (прикиды)', color: MEET_COLOR };
                    else if (isMockWeek(w)) ov[w.week] = { label: '🎯 Mock meet (прикиды-синглы)', color: MOCK_COLOR };
                    else if (isPostMeetWeek(w)) ov[w.week] = { label: '🔄 Пост-старт (восстановление)', color: POST_COLOR };
                    else if (isTaperWeek(w)) ov[w.week] = { label: '📉 Тапер (разгрузка)', color: TAPER_COLOR };
                  }
                  return Object.keys(ov).length > 0 ? ov : undefined;
                })()}
                startVolumeSets={Math.round(W.reduce((s, w) => s + w.days.reduce((ss, d) => ss + d.exercises.reduce((sss, e) => sss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0), 0) / totalW / (days || 3))}
                startIntensityPct={0.72}
                startRIR={3}
                goal="strength"
                title={calendarView === 'tapered' ? 'Календарь цикла с тапером (ПЛ)' : 'Календарь оригинального цикла (ПЛ)'}
              />
              <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                <div style={{ ...LABEL, color:'#60a5fa', margin:'0 0 4px' }}>➡️ Что дальше</div>
                <div style={SMALL}>{phase === 'peak'
                  ? 'Цикл завершается пиковой фазой. После теста ПМ — неделя разгрузки (deload: 60% объёма, RIR 4), затем новый мезоцикл с пересчитанным PM0 (новый PM = результат теста). Система пересчитает прогрессию автоматически при вводе нового PM.'
                  : phase === 'deload'
                  ? 'Разгрузка — восстановление перед следующим мезо. После неё начните новый цикл: PM0 = текущий расчётный PM (он вырос за мезо по формуле PM0×(1+k)^нед).'
                  : 'Система считает дальнейшие недели сама: вес = PM_нед × %ПМ, где PM_нед = PM0×(1+k)^нед (k=0.5% натурал / 1.5-2.5% на курсе). Переходите по неделям ◀▶ — фазы Base→Build→Peak чередуются автоматически.'}</div>
              </div>
              {/* 📤 Экспорт: цепочка Формат → Объём → (Блок/Неделя) → Экспорт */}
              {expOpen && (() => {
                const blocks = plBlockGroups(W);
                const scopeLabel = expScope === 'all' ? `Весь план (${W.length} нед)`
                  : expScope === 'full' ? `Всё вместе (${W.length} нед + сводка)`
                  : expScope === 'block' ? `Блок «${expBlock ? PL_BLOCK_LABEL[expBlock] : ''}»`
                  : expScope === 'week' ? `Неделя ${expWeek}`
                  : '';
                const ready = !!expFormat && !!expScope && (expScope !== 'block' || !!expBlock) && (expScope !== 'week' || !!expWeek);
                const summary = expScope === 'full' && builtSrc.cycleMetrics ? [
                  { label: 'Тоннаж', value: Math.round(builtSrc.cycleMetrics.tonnage).toLocaleString('ru-RU') + ' кг·пов' },
                  { label: 'КПШ', value: String(builtSrc.cycleMetrics.kpsh) },
                  { label: 'Средний вес', value: Math.round(builtSrc.cycleMetrics.avgWeight) + ' кг' },
                  { label: 'Отн. интенсивность', value: Math.round(builtSrc.cycleMetrics.relIntensity * 100) + '%' },
                  { label: 'УОИ', value: builtSrc.cycleMetrics.uoi.toFixed(2) },
                  { label: 'Сессий', value: String(builtSrc.cycleMetrics.sessions) },
                ] : undefined;
                const doExport = () => {
                  if (!ready) return;
                  const sel: LMSBuildOutput['weeks'] = expScope === 'all' || expScope === 'full'
                    ? W
                    : expScope === 'block'
                      ? (blocks.find(b => b.id === expBlock)?.weeks ?? W)
                      : W.filter(w => w.week === expWeek);
                  const title = builtSrc.template.meta.title;
                  if (expFormat === 'xlsx') {
                    downloadPLExcel(buildPLExcelWorkbook(title, plExportRows(sel), summary), `pl-plan-${selectedCycleId}-${expScope ?? 'all'}.xlsx`);
                    onNote(`📥 Excel сохранён: ${scopeLabel} (${sel.length} нед).`);
                  } else {
                    printPLHtml(buildPLPrintHtml(title, scopeLabel, sel, { summary }));
                    onNote(`🖨 PDF: окно печати — ${scopeLabel}.`);
                  }
                  setExpOpen(false);
                };
                const stepBtn = (on: boolean, label: string, sub: string, onClick: () => void, color: string, ariaLabel?: string) => (
                  <button onClick={onClick} aria-label={ariaLabel} style={{ padding:'10px 12px', borderRadius:10, textAlign:'left', cursor:'pointer', border: on ? '1px solid ' + color : '1px solid rgba(255,255,255,0.12)', background: on ? color + '22' : 'rgba(255,255,255,0.03)', color:'#fff' }}>
                    <div style={{ fontSize:13, fontWeight:800, color: on ? color : 'rgba(255,255,255,0.85)' }}>{label}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{sub}</div>
                  </button>
                );
                return (
                  <div style={{ position:'fixed', inset:0, zIndex:210, display:'flex', background:'rgba(0,0,0,0.9)' }} onClick={() => setExpOpen(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#18181b', display:'flex', flexDirection:'column' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 12px 0' }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'#60a5fa' }}>📤 Экспорт плана</span>
                        <button onClick={() => setExpOpen(false)} style={{ fontSize:11, color:'#ef4444', border:'none', background:'transparent', cursor:'pointer', padding:'4px 8px' }}>✕</button>
                      </div>
                      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                        {!expFormat && <>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)' }}>1 · Формат</div>
                          {stepBtn(expFormat === 'xlsx', '📊 Excel (.xlsx)', 'Таблица для Excel / Google Sheets', () => setExpFormat('xlsx'), '#60a5fa')}
                          {stepBtn(expFormat === 'pdf', '🖨 PDF', 'Окно печати → «Сохранить как PDF»', () => setExpFormat('pdf'), '#f59e0b')}
                        </>}
                        {expFormat && !expScope && <>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)' }}>2 · Что выгружаем</div>
                          {stepBtn(expScope === 'all', '📋 Весь план', 'Тренировочный план — все недели', () => setExpScope('all'), '#00e68a')}
                          {stepBtn(expScope === 'block', '🧩 Отдельный блок на выбор', 'Основной цикл / тапер / mock / соревнования / пост-старт', () => setExpScope('block'), '#a78bfa')}
                          {stepBtn(expScope === 'week', '📅 Одна неделя на выбор', 'Выберите номер недели', () => setExpScope('week'), '#eab308')}
                          {stepBtn(expScope === 'full', '📦 Всё вместе', 'Все недели + сводка цикла + прикиды', () => setExpScope('full'), '#f59e0b')}
                        </>}
                        {expFormat && expScope === 'block' && <>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)' }}>3 · Выберите блок</div>
                          {blocks.map(b => <div key={b.id} style={{ width:'100%' }}>{stepBtn(expBlock === b.id, `${b.icon} ${b.label}`, `нед ${b.range} · ${b.weeks.length} нед`, () => setExpBlock(b.id), '#a78bfa', `Экспорт блок ${b.id}`)}</div>)}                          {blocks.length === 0 && <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Отдельных блоков нет — план однородный.</div>}
                        </>}
                        {expFormat && expScope === 'week' && <>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)' }}>3 · Выберите неделю</div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(72px, 1fr))', gap:4 }}>
                            {W.map(w => {
                              const ph2 = displayPhaseForWeek(w, totalW);
                              const active2 = expWeek === w.week;
                              return <button key={w.week} onClick={() => setExpWeek(w.week)} aria-label={'Экспорт неделя ' + w.week} style={{ padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border: active2 ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.1)', background: active2 ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.03)', color:'#fff' }}>
                                <div>{w.week}</div>
                                <div style={{ fontSize:8, color: PH_COLOR[ph2 as keyof typeof PH_COLOR] ?? 'rgba(255,255,255,0.4)' }}>{PH_RU[ph2 as keyof typeof PH_RU] ?? ph2}</div>
                              </button>;
                            })}
                          </div>
                        </>}
                      </div>
                      <div style={{ display:'flex', gap:6, padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                        <button onClick={() => { if (expScope) setExpScope(null); else if (expFormat) setExpFormat(null); }} disabled={!expFormat} style={{ padding:'10px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.7)', opacity: expFormat ? 1 : 0.4 }}>⬅ Назад</button>
                        <button onClick={doExport} disabled={!ready} style={{ flex:1, padding:'10px 12px', borderRadius:8, fontSize:12, fontWeight:800, cursor:'pointer', border:'none', background: ready ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.1)', color: ready ? '#000' : 'rgba(255,255,255,0.35)' }}>
                          {ready ? `📥 Экспорт: ${expFormat === 'xlsx' ? 'Excel' : 'PDF'} · ${scopeLabel}` : 'Выберите формат и объём'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>;
          })()}
    </>
  );
};

export default PLPlanView;
