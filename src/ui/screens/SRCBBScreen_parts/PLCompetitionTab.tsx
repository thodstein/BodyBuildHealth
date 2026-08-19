/**
 * PLCompetitionTab.tsx — 🏁 СОРЕВНОВАНИЯ + ТАПЕР ПЛ (отдельная вкладка).
 *
 * Вынесено из SRCBBScreen (шаг разгрузки одного экрана): весь блок
 * «Соревнования сезона + тапер» — сезон, параметры, рекомендации по весу,
 * генерация тапер-плана, тренерская карточка, карточка тапер-плана с прикидами.
 * State остаётся в SRCBBScreen (сериализация he_pl_session) и передаётся через api.
 */
import React from 'react';
import { recommendWeightCut } from '../../../engines/gym-competition.engine';
import { appendPLTaperWeeks, refreshMeetAttempts, computeMeetAttemptsFromPmRow, type LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import { buildPLPeakBlockLayout } from '../../../engines/lms/lms-peak-block.engine';
import { buildPLSeasonPeaks } from '../../../engines/lms/lms-macro-taper.engine';
import { calcCycleMetrics, type SRExercise } from '../../../engines/lms/lms-metrics.engine';
import { MEET_STRATEGY_LABEL, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS, type MeetStrategy } from '../../../engines/lms/competition-attempts';
import { LAST_HEAVY_DAYS } from '../../../engines/pro/taper.engine';
import type { PED } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { AutoRegMode } from '../../../engines/pro/diary-autoreg.engine';
import type { AutoRegOutput } from '../../../engines/pro/autoregulation-pro.engine';
import { saveCompetitionPlan } from '../TrainingScreen_parts/CompetitionPlansView';
import type { PeakWeekLayout, TaperMode, TaperWeightGoal } from '../../../engines/lms/lms-taper.engine';
import type { TaperCoachCtx, TaperConfigRecommendation } from '../../../engines/lms/lms-taper-coach.engine';
import { buildPLTaperPrintHtml } from '../../../engines/lms/lms-taper-coach.engine';
import { PopupNumber, PopupSelect, ExpandableCard } from './TrainingPopups';
import { TaperCoachCard } from './TaperCoachCard';
import { usePLTaper } from './taper-state';

const BTN: React.CSSProperties = { background: '#00e68a', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 12, minHeight: 40, cursor: 'pointer' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: '#00e68a', border: '1px solid var(--accent-dim)' };

export interface PLMeetListItem {
  id: string;
  name: string;
  weeksToStart: number;
  fed: string;
  plannedPm: Record<string, number>;
  strategy: MeetStrategy;
}

export interface PLCompetitionTabApi {
  builtSrc: LMSBuildOutput | null;
  setBuiltSrc: (p: LMSBuildOutput) => void;
  /** Показать сообщение пользователю (methodNote). */
  onNote: (m: string) => void;
  cycle: {
    peds: PED[];
    pedDoses: Record<string, number>;
    courseIntensity: 'mild' | 'moderate' | 'heavy';
    pedAuto: boolean;
    autoRegMode: AutoRegMode;
    autoRegResult: AutoRegOutput;
    plCalorieSurplus: number;
    plProteinPerKg: number;
    selectedCycleId: string;
    pmSquat: number; pmBench: number; pmDead: number;
  };
  coach: {
    buildCtx: () => TaperCoachCtx;
    applyRecommendation: (r: TaperConfigRecommendation) => void;
    diarySessions: unknown[];
  };
  autoRegMode: AutoRegMode;
  setAutoRegMode: (mode: AutoRegMode) => void;
}

export const PLCompetitionTab: React.FC<{ api: PLCompetitionTabApi }> = ({ api }) => {
  const { builtSrc, setBuiltSrc, onNote } = api;
  const cyc = api.cycle;
  const coach = api.coach;
  // 🏁 Тапер-state (сезон/параметры/прикиды/mock/meet/пост) — из контекста (taper-state.tsx).
  const t = usePLTaper();
  const {
    meetList, setMeetList, mainMeetId, setMainMeetId, applyMainMeet, addMeet, removeMeet,
    bw, setBw, targetBw, setTargetBw, weeksToMeet, setWeeksToMeet,
    taperWeeksToAdd, setTaperWeeksToAdd, attemptStrategy, setAttemptStrategy,
    peakMode, setPeakMode, peakLayout, setPeakLayout, taperWeightGoal, setTaperWeightGoal,
    taperFed, setTaperFed, taperActualPm, setTaperActualPm, taperPlannedPm, setTaperPlannedPm,
    taperAttemptOverride, setTaperAttemptOverride,
    mockMeetOn, setMockMeetOn, meetWeekOn, setMeetWeekOn, postMeetOn, setPostMeetOn,
    taperNote, setTaperNote, taperPlan, setTaperPlan,
  } = t;
  const { peds, pedDoses, courseIntensity, pedAuto, autoRegMode, autoRegResult, plCalorieSurplus, plProteinPerKg, selectedCycleId, pmSquat, pmBench, pmDead } = cyc;
  const setAutoRegMode = (mode: AutoRegMode) => {
    // Реальный переключатель режима авторегуляции — state живёт в родительском SRCBBScreen.
    api.setAutoRegMode(mode);
    onNote(`🔄 Режим авторегуляции: ${mode === 'auto' ? '🤖 Авто' : mode === 'diary' ? '📓 Авто-дневник' : 'ВЫКЛ'}`);
  };
  // A1: предпросмотр пик-блока по окну до старта (weeksToMeet) — блок = вход в пик +
  // mock + глубокий тапер + соревнования (+ пост после окна). Показывает, что окно реально работает.
  const peakPreview = React.useMemo(() => buildPLPeakBlockLayout({
    windowWeeks: weeksToMeet,
    taperWeeks: taperWeeksToAdd,
    mode: peakMode,
    weightGoal: taperWeightGoal === 'auto' ? undefined : taperWeightGoal,
    mockMeet: mockMeetOn,
    meetWeek: meetWeekOn,
    postMeet: postMeetOn,
  }), [weeksToMeet, taperWeeksToAdd, peakMode, taperWeightGoal, mockMeetOn, meetWeekOn, postMeetOn]);
  // C1: дата старта (ISO) — реверс от неё календарной разметки недель блока.
  const meetRef = (() => {
    try { return new Date(Date.now() + Math.max(0, weeksToMeet) * 7 * 86400000).toISOString().slice(0, 10); }
    catch { return undefined; }
  })();
  const fedRu: Record<string, string> = { ipf: 'IPF', fpr: 'FPR', wpc: 'WPC', other: 'Другая' };
  // C4: печать тапер-плана (PDF через window.print).
  const handlePrintTaperPlan = () => {
    if (!taperPlan) return;
    try {
      const html = buildPLTaperPrintHtml(taperPlan);
      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) { onNote('⚠ Всплывающее окно заблокировано — разрешите попапы для печати тапер-плана.'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch (e) { onNote('⚠ Ошибка печати тапер-плана: ' + (e as Error).message); }
  };
  // C2: тапер по ВСЕМУ сезону — продлевает план до дальнего старта, под каждое
  // соревнование ставит пик-блок (вход в пик + mock + глубокий тапер + соревнования [+ пост]).
  const handleBuildSeasonPeaks = () => {
    if (!builtSrc) return;
    try {
      const meets = meetList
        .filter(m => Number.isFinite(m.weeksToStart) && m.weeksToStart >= 1)
        .map(m => ({ id: m.id, name: m.name, weeksToStart: m.weeksToStart }));
      if (meets.length === 0) { onNote('⚠ Добавьте соревнования в сезон — сезон пуст.'); return; }
      const res = buildPLSeasonPeaks(builtSrc.weeks, meets, {
        mode: peakMode,
        weightGoal: taperWeightGoal === 'auto' ? undefined : taperWeightGoal,
        strategy: attemptStrategy,
        mockMeet: mockMeetOn,
        meetWeek: true,
        postMeet: postMeetOn,
        windowWeeks: weeksToMeet,
      });
      if (res.weeks.length === 0) { onNote('⚠ Не удалось построить сезон — нет базового плана.'); return; }
      const sessions = res.weeks.flatMap(wk => wk.days.map(d => d.exercises.map(ex => ({
        name: ex.name, group: ex.group, coef: ex.coef, mnosz: ex.mnosz, pm: ex.pm,
        sets: ex.workSets.map(s => ({ weight: s.weight, reps: s.reps, sets: s.sets })),
      } as SRExercise))));
      const season: LMSBuildOutput = {
        ...builtSrc,
        weeks: res.weeks,
        cycleMetrics: calcCycleMetrics(sessions),
        progressionRationale: builtSrc.progressionRationale + ' 🏁 ' + res.notes.join(' '),
      };
      setBuiltSrc(season);
      setTaperNote(`📅 Сезон: ${meets.length} старт(ов) → ${season.weeks.length} нед`);
      onNote('📅 Тапер по всему сезону построен: ' + res.notes.join(' '));
    } catch (e) { onNote('⚠ Ошибка построения сезона: ' + (e as Error).message); }
  };

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>🏁 Соревнования сезона + тапер</div>
        {builtSrc && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>план: {builtSrc.weeks.length} нед · тапер добавлен: {taperNote ? 'да' : 'нет'}</span>}
        {builtSrc && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginLeft: 8 }}>
            {autoRegMode === 'auto' && '🤖 auto'}{autoRegMode === 'diary' && '📓 diary'}{autoRegMode === 'off' && '⚠ off'}
          </span>
        )}
      </div>
      {/* 🏁 Несколько соревнований: список + выбор главного */}
      <div style={{ marginBottom: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>📋 Сезон ({meetList.length}) — тапер-план строится по ⭐ главному</div>
          <button onClick={addMeet} style={{ ...BTN_GHOST, minHeight: 30, fontSize: 10, border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '3px 10px' }}>➕ Добавить соревнование</button>
        </div>
        {meetList.map(m => {
          const isMain = m.id === mainMeetId;
          // 🧠 Готовность старта по срокам: 0 нед — старт, ≤2 — тапер, ≤4 — пик, >4 — база.
          const wl = Math.max(0, m.weeksToStart);
          const readiness = wl === 0
            ? { score: 100, label: '🏁 старт' }
            : wl <= 2
              ? { score: 92, label: '📉 тапер' }
              : wl <= 4
                ? { score: 85, label: '🎯 пик' }
                : { score: 75, label: '✅ база' };
          const rdColor = readiness.score >= 90 ? '#22c55e' : readiness.score >= 80 ? '#eab308' : '#93c5fd';
          return (
            <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', padding: 8, borderRadius: 10, marginTop: 6, background: isMain ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))' : 'rgba(255,255,255,0.03)', border: `1px solid ${isMain ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
              <button
                onClick={() => { setMainMeetId(m.id); applyMainMeet(m); }}
                title={isMain ? 'Главное соревнование — по нему строится тапер-план' : 'Сделать главным'}
                style={{ minHeight: 34, minWidth: 38, padding: '4px 8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: isMain ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.12)', background: isMain ? 'rgba(234,179,8,0.2)' : 'transparent', color: isMain ? '#eab308' : 'rgba(255,255,255,0.4)', alignSelf: 'flex-start' }}
              >{isMain ? '⭐' : '☆'}</button>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Название соревнования</div>
                <input
                  value={m.name}
                  onChange={e => setMeetList(cur => cur.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, fontWeight: 700, minHeight: 34, boxSizing: 'border-box' }}
                  placeholder="Например, «Первенство области»"
                />
              </div>
              <div style={{ width: 132, flexShrink: 0 }}>
                <PopupNumber
                  label="Недель до старта"
                  value={m.weeksToStart}
                  min={1}
                  max={52}
                  suffix=" нед"
                  hint={`Через сколько недель старт «${m.name}» (1–52). Готовность пересчитается автоматически.`}
                  onChange={v => {
                    const weeks = Number.isFinite(v) && v >= 1 ? Math.min(Math.round(v), 52) : m.weeksToStart;
                    setMeetList(cur => cur.map(x => x.id === m.id ? { ...x, weeksToStart: weeks } : x));
                    if (isMain) setWeeksToMeet(weeks);
                  }}
                />
              </div>
              <div style={{ width: 118, flexShrink: 0 }}>
                <PopupSelect
                  label="Федерация"
                  value={m.fed}
                  options={[{ id: 'ipf', label: 'IPF' }, { id: 'fpr', label: 'FPR' }, { id: 'wpc', label: 'WPC' }, { id: 'other', label: 'Другая' }]}
                  hint="Федерация определяет нормативы/категории — используется в прикидах сезона"
                  onChange={v => { setMeetList(cur => cur.map(x => x.id === m.id ? { ...x, fed: v } : x)); if (isMain) setTaperFed(v); }}
                />
              </div>
              <span title={`Готовность старта «${m.name}» через ${m.weeksToStart} нед: ${readiness.label}`} style={{ padding: '3px 9px', borderRadius: 8, fontSize: 10, fontWeight: 800, background: rdColor + '16', border: `1px solid ${rdColor}44`, color: rdColor, alignSelf: 'flex-start' }}>
                🧠 {readiness.score}% {readiness.label}
              </span>
              <button
                onClick={() => removeMeet(m.id)}
                disabled={meetList.length <= 1}
                title="Удалить соревнование"
                style={{ minHeight: 34, minWidth: 34, padding: '4px 8px', borderRadius: 8, fontSize: 12, cursor: meetList.length <= 1 ? 'not-allowed' : 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', opacity: meetList.length <= 1 ? 0.4 : 1, alignSelf: 'flex-start' }}
              >✕</button>
            </div>
          );
        })}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.4 }}>
          ⭐ Главное — полный тапер/пик-план (ниже). Остальные — контрольные старты: прикиды по их данным показываются в карточке «Тапер-план» → «Сезон». Стратегия, план ПМ и факт ПМ ниже относятся к ГЛАВНОМУ.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
        <PopupNumber label="Вес сейчас" value={bw} min={40} max={250} suffix=" кг" onChange={v => setBw(v)} />
        <PopupNumber label="Целевой вес (категория)" value={targetBw} min={40} max={250} suffix=" кг" onChange={v => setTargetBw(v)} />
        <PopupNumber label="Недель до старта" value={weeksToMeet} min={1} max={26} suffix=" нед" hint="Окно пик-блока: на эти недели строится полный блок — вход в пик + mock + тапер + соревнования (+ пост). Раньше окно было информационным, теперь реально задаёт длину блока." onChange={v => setWeeksToMeet(v)} />
        <PopupNumber label="Тапер-недель к циклу" value={taperWeeksToAdd} min={1} max={4} suffix="" hint="Сколько недель ГЛУБОКОГО снижения объёма внутри окна до старта" onChange={v => setTaperWeeksToAdd(v)} />
      </div>
      {/* A1: предпросмотр пик-блока по окну до старта */}
      <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: peakPreview.warnings.length ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${peakPreview.warnings.length ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.25)'}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: peakPreview.warnings.length ? '#f87171' : '#34d399', marginBottom: 2 }}>🗓 {peakPreview.summary}</div>
        {peakPreview.warnings.map((w, i) => (
          <div key={i} style={{ fontSize: 10, color: '#fbbf24', lineHeight: 1.4 }}>⚠ {w}</div>
        ))}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.4 }}>
          «Недель до старта» = окно пик-блока: вход в пик (объём плавно ↓) → mock meet → глубокий тапер → соревнования{postMeetOn ? ' → пост-старт' : ''}. Блок строится кнопкой «🗓 Пик-блок на окно» ниже.
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
        <PopupSelect
          label="Стратегия прикидов (выход на пик)"
          value={attemptStrategy}
          onChange={v => setAttemptStrategy(v as MeetStrategy)}
          hint="Прикиды дня соревнований на финальной тапер-неделе: консервативная 90/95.5/100%, сбалансированная 92/96/102%, агрессивная 93/97/105% от ПМ"
          options={[
            { id: 'conservative', label: MEET_STRATEGY_LABEL.conservative, desc: 'Опенер 90%, 2nd 95.5%, 3rd 100%' },
            { id: 'balanced', label: MEET_STRATEGY_LABEL.balanced, desc: 'Опенер 92%, 2nd 96%, 3rd 102%' },
            { id: 'aggressive', label: MEET_STRATEGY_LABEL.aggressive, desc: 'Опенер 93%, 2nd 97%, 3rd 105%' },
          ]}
        />
        <PopupSelect label="Раскладка тапера" value={peakMode} onChange={v => setPeakMode(v as TaperMode)} hint={`ПЛ-пик: 3-нед протокол Библиотеки — объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR 1-2/0-1/0, синглы на интенсивной неделе, финал — разминка + прикиды. Classic: разгрузка Bosquet (интенсивность сохранена, RIR +1/+2). Pro: усталость-зависимая кривая — объём ~0.65/0.45/0.40, инт. ~92%, прайминг. Classic WF: 2 нед перегрузка → суперкомпенсация.${peakMode === 'pl' && taperWeeksToAdd !== 3 ? ` ⚠ Протокол рассчитан на 3 недели (сейчас ${taperWeeksToAdd}) — будет использован сокращённый/повторный профиль.` : ''}`} options={([
          { id: 'pl', label: '🏁 ПЛ-пик-протокол (3 нед, интенсификация)' },
          { id: 'classic', label: '📉 Классический тапер (Bosquet, разгрузка)' },
          { id: 'pro', label: '🎯 Про (усталость-зависимый, прайминг)' },
          { id: 'wf', label: '🎢 Classic WF (4 нед: перегрузка → суперкомпенсация)' },
        ] as { id: TaperMode; label: string }[])} />
        <PopupSelect label="Раскладка финальной недели" value={peakLayout} onChange={v => setPeakLayout(v as PeakWeekLayout)} hint="Attempts: прикиды соревновательного дня на финальной тапер-неделе (опенер/вторая/третья). Light: только разминка 50/70/90% без прикидов — для контрольных стартов" options={([
          { id: 'attempts', label: '🏁 Прикиды соревновательного дня' },
          { id: 'light', label: '🎭 Только разминка (без прикидов)' },
        ] as { id: PeakWeekLayout; label: string }[])} />
        <PopupSelect label="Весовая цель тапера" value={taperWeightGoal} onChange={v => setTaperWeightGoal(v as TaperWeightGoal)} hint="Сгонка к категории: объём тапера ×0.9 (дефицит → MRV ниже, Helms 2022). Набор/стабильно: полный объём. Авто — по текущему/целевому весу" options={([
          { id: 'auto', label: '🤖 Авто (по весу)' },
          { id: 'lose', label: '⬇ Сброс к категории' },
          { id: 'gain', label: '⬆ Набор к категории' },
          { id: 'maintain', label: '⏸ Вес стабилен' },
        ] as { id: TaperWeightGoal; label: string }[])} />
        {/* 🏁 Данные к соревнованиям: тапер строится под РАЗНИЦУ ПМ (факт после цикла vs план федерации) */}
        <PopupSelect label="Федерация" value={taperFed} onChange={v => setTaperFed(v)} options={[
          { id: 'ipf', label: 'IPF' }, { id: 'fpr', label: 'FPR' }, { id: 'wpc', label: 'WPC' }, { id: 'other', label: 'Другая' },
        ]} />
        <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
          {(['Присед', 'Жим лежа', 'Становая тяга'] as const).map(name => (
            <PopupNumber key={name + '_act'} label={`Факт. ПМ после цикла · ${name === 'Присед' ? 'присед' : name === 'Жим лежа' ? 'жим' : 'тяга'}`} value={taperActualPm[name] || 0} min={0} max={500} suffix=" кг" hint="Реально поднятый ПМ — от него строятся тренировочные веса тапера" onChange={v => setTaperActualPm(p => ({ ...p, [name]: v }))} />
          ))}
          {(['Присед', 'Жим лежа', 'Становая тяга'] as const).map(name => (
            <PopupNumber key={name + '_plan'} label={`План ПМ в федерации · ${name === 'Присед' ? 'присед' : name === 'Жим лежа' ? 'жим' : 'тяга'}`} value={taperPlannedPm[name] || 0} min={0} max={500} suffix=" кг" hint="Целевые веса соревнования — от них считаются прикиды/попытки" onChange={v => setTaperPlannedPm(p => ({ ...p, [name]: v }))} />
          ))}
        </div>
        <button
          disabled={!builtSrc}
          onClick={() => {
            if (!builtSrc) return;
            const meetData = {
              actualPm: Object.fromEntries(Object.entries(taperActualPm).filter(([, v]) => v > 0)),
              plannedPm: Object.fromEntries(Object.entries(taperPlannedPm).filter(([, v]) => v > 0)),
            };
            const next = appendPLTaperWeeks(builtSrc, taperWeeksToAdd, {
              peds: peds.length ? peds : undefined,
              pedDoses,
              courseIntensity,
              mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
              peakExit: { strategy: attemptStrategy },
              mockMeet: mockMeetOn ? { strategy: attemptStrategy } : undefined,
              meetWeek: meetWeekOn ? { strategy: attemptStrategy } : undefined,
              postMeet: postMeetOn ? {} : undefined,
              weightGoal: taperWeightGoal,
              autoReg: autoRegMode === 'auto' && autoRegResult
                ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift }
                : undefined,
              nutrition: { calorieSurplus: plCalorieSurplus, proteinPerKg: plProteinPerKg },
              meetData,
              peakMode,
              peakLayout,
              windowWeeks: weeksToMeet,
              reference: meetRef,
            });
            setTaperPlan(next);
            const addCount = (mockMeetOn ? 1 : 0) + taperWeeksToAdd + (meetWeekOn ? 1 : 0) + (postMeetOn ? 1 : 0);
            setTaperNote(`Тапер-план сгенерирован: +${addCount} нед${mockMeetOn ? ' · 🎯 mock meet' : ''}${meetWeekOn ? ' · 🏁 соревнования' : ''}${postMeetOn ? ' · 🔄 пост-старт' : ''}${peakMode === 'pl' ? ' · 🏁 ПЛ-пик-протокол' : peakMode === 'pro' ? ' · 🎯 про-тапер' : ' · 📉 классика'}${taperWeightGoal === 'lose' ? ' · ⬇ сгонка' : taperWeightGoal === 'gain' ? ' · ⬆ набор' : ''}${Object.keys(meetData.actualPm).length ? ' · по факт. ПМ после цикла' : ''}${Object.keys(meetData.plannedPm).length ? ' · прикиды от плана федерации' : ''} · пик ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}${autoRegMode === 'auto' ? ' · auto-regime: top-set×' + (autoRegResult?.topSetPctMultiplier ?? 1).toFixed(2) + ' · объём×' + (autoRegResult?.volumeMultiplier ?? 1).toFixed(2) + ' · RIR+' + (autoRegResult?.rirShift ?? 0) : ''}${autoRegMode === 'diary' ? ' · diary-regime active' : ''}`);
            onNote(`📋 Тапер-план готов (отдельная карточка — цикл не изменён).${peakMode === 'pl' ? ' Режим: ПЛ-пик-протокол (объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR→0).' : peakMode === 'pro' ? ' Режим: про-тапер (усталость-зависимый, прайминг).' : ' Режим: классический тапер (Bosquet, интенсивность сохранена).'}${taperWeightGoal === 'lose' ? ' Весовая цель: сгонка — объём ×0.9.' : taperWeightGoal === 'gain' ? ' Весовая цель: набор — полный объём.' : ''}${Object.keys(meetData.actualPm).length ? ' Тренировочные веса тапера от фактического ПМ после цикла.' : ''}${Object.keys(meetData.plannedPm).length ? ' Прикиды/попытки от планируемого ПМ федерации.' : ''} Чтобы встроить в weeks цикла — «Встроить в план».`);
          }}
          style={{ ...BTN_GHOST, alignSelf: 'flex-end', minHeight: 44, fontSize: 11, border: builtSrc ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc ? '#f59e0b' : 'rgba(255,255,255,0.3)', background: builtSrc ? 'rgba(245,158,11,0.1)' : 'transparent' }}
          title="Сгенерировать тапер-план в ОТДЕЛЬНУЮ карточку (не встраивая в weeks цикла) — под разницу ПМ: факт после цикла / план федерации"
        >📋 Сгенерировать тапер-план</button>
        <button
          disabled={!taperPlan}
          onClick={handlePrintTaperPlan}
          style={{ ...BTN_GHOST, alignSelf: 'flex-end', minHeight: 44, fontSize: 11, border: taperPlan ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.08)', color: taperPlan ? '#34d399' : 'rgba(255,255,255,0.3)', background: taperPlan ? 'rgba(52,211,153,0.1)' : 'transparent' }}
          title="Печать тапер-плана (PDF) — таблицы недель блока с датами, объёмом, интенсивностью, RIR и прикидами"
        >🖨 Тапер-план (PDF)</button>
        <button
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: mockMeetOn ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)', background: mockMeetOn ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: mockMeetOn ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Имитация соревнований за 10-14 дней до старта: неделя перед тапером с прикидами-синглами (опенер RIR2 → вторая RIR1 → третья RIR0)"
        >🎯 Имитация соревнований (mock meet){mockMeetOn ? ' ✓' : ''}</button>
        <button
          onClick={() => setMeetWeekOn(v => !v)}
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: meetWeekOn ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)', background: meetWeekOn ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.02)', color: meetWeekOn ? '#eab308' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Неделя соревнований В КОНЦЕ плана: прикиды (опенер/вторая/третья ×1) как подходы дня старта — план готов полностью"
        >🏁 Неделя соревнований в конце{meetWeekOn ? ' ✓' : ''}</button>
        <button
          onClick={() => setPostMeetOn(v => !v)}
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: postMeetOn ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)', background: postMeetOn ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.02)', color: postMeetOn ? '#34d399' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Восстановительная неделя ПОСЛЕ соревнований: объём ×0.5, RIR +3 — полная разгрузка после прикидок"
        >🔄 Пост-старт неделя{postMeetOn ? ' ✓' : ''}</button>
        <button
          disabled={!builtSrc || !taperNote}
          onClick={() => {
            if (!builtSrc) return;
            setBuiltSrc(refreshMeetAttempts(builtSrc, attemptStrategy));
            onNote(`🔄 Прикиды пересчитаны: ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]} (${MEET_STRATEGY_LABEL[attemptStrategy]}) — без повторного добавления тапера.`);
          }}
          style={{ ...BTN_GHOST, alignSelf: 'flex-end', minHeight: 44, fontSize: 11, border: builtSrc && taperNote ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc && taperNote ? '#a78bfa' : 'rgba(255,255,255,0.3)', background: builtSrc && taperNote ? 'rgba(139,92,246,0.1)' : 'transparent' }}
          title="Пересчитать прикиды на финальной тапер-неделе (и mock meet) под выбранную стратегию"
        >🔄 Обновить прикиды</button>
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => setAutoRegMode('diary')}
            style={{ padding:'4px 8px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === 'diary' ? '#60a5fa' : 'rgba(255,255,255,0.08)', color: autoRegMode === 'diary' ? '#000' : 'rgba(255,255,255,0.6)' }}>
            📓 Авто-дневник
          </button>
          <button
            onClick={() => setAutoRegMode('auto')}
            style={{ padding:'4px 8px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === 'auto' ? '#60a5fa' : 'rgba(255,255,255,0.08)', color: autoRegMode === 'auto' ? '#000' : 'rgba(255,255,255,0.6)' }}>
            🤖 Авто
          </button>
          <button
            onClick={() => setAutoRegMode('off')}
            style={{ padding:'4px 8px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: autoRegMode === 'off' ? '#71717a' : 'rgba(255,255,255,0.08)', color: autoRegMode === 'off' ? '#000' : 'rgba(255,255,255,0.6)' }}>
            ВЫКЛ
          </button>
        </div>
      </div>
      {/* Рекомендации по сбросу ИЛИ набору (текущий вес ниже целевого — переход в более тяжёлую категорию) */}
      {(() => {
        const rec = recommendWeightCut(bw, targetBw, weeksToMeet);
        return (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
              {rec.toCut > 0
                ? `⚖️ Сброс: ${rec.toCut.toFixed(1)} кг · темп ${(rec.toCut / Math.max(1, weeksToMeet)).toFixed(2)} кг/нед · дефицит ≈${rec.dailyDeficitKcal} ккал/день`
                : rec.toGain > 0
                  ? `📈 Набор: +${rec.toGain.toFixed(1)} кг · темп ${(rec.toGain / Math.max(1, weeksToMeet)).toFixed(2)} кг/нед · профицит ≈${rec.dailySurplusKcal} ккал/день`
                  : 'уже в категории'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
              {(rec.toCut > 0 ? rec.recommendations : rec.toGain > 0 ? rec.gainRecommendations : rec.recommendations).map((r, i) => (
                <div key={i} style={{ fontSize: 10, color: r.startsWith('❌') ? '#f87171' : r.startsWith('⚠') ? '#fbbf24' : r.startsWith('✅') ? '#4ade80' : 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{r}</div>
              ))}
            </div>
            {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).map(t => (
                  <div key={t.week} title={t.note} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 9, background: t.week === weeksToMeet ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.week === weeksToMeet ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                    <b style={{ color: t.week === weeksToMeet ? '#f59e0b' : 'rgba(255,255,255,0.8)' }}>Н{t.week}</b> {t.weight.toFixed(1)} кг
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {/* Действия: тапер к активному циклу + авто-новый цикл */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          disabled={!builtSrc}
          onClick={() => {
            if (!builtSrc) return;
            const next = appendPLTaperWeeks(builtSrc, taperWeeksToAdd, {
              peds: peds.length ? peds : undefined,
              pedDoses,
              courseIntensity,
              mode: pedAuto && peds.length > 0 ? 'on_course' : 'natural',
              peakExit: { strategy: attemptStrategy },
              mockMeet: mockMeetOn ? { strategy: attemptStrategy } : undefined,
              meetWeek: meetWeekOn ? { strategy: attemptStrategy } : undefined,
              postMeet: postMeetOn ? {} : undefined,
              weightGoal: taperWeightGoal,
              autoReg: autoRegMode === 'auto' && autoRegResult
                ? { topSetPctMultiplier: autoRegResult.topSetPctMultiplier, volumeMultiplier: autoRegResult.volumeMultiplier, rirShift: autoRegResult.rirShift }
                : undefined,
              nutrition: { calorieSurplus: plCalorieSurplus, proteinPerKg: plProteinPerKg },
              peakMode,
              peakLayout,
              windowWeeks: weeksToMeet,
              reference: meetRef,
            });
            setBuiltSrc(next);
            const addCount = (mockMeetOn ? 1 : 0) + taperWeeksToAdd + (meetWeekOn ? 1 : 0) + (postMeetOn ? 1 : 0);
            setTaperNote(`+${addCount} нед${mockMeetOn ? ' · 🎯 mock meet' : ''}${meetWeekOn ? ' · 🏁 соревнования' : ''}${postMeetOn ? ' · 🔄 пост-старт' : ''}${pedAuto && peds.length > 0 ? ' · 💉 PED-адаптация как в цикле' : ''}${taperWeightGoal === 'lose' ? ' · ⬇ сгонка' : taperWeightGoal === 'gain' ? ' · ⬆ набор' : ''} · 🏁 пик ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}`);
            onNote(`📉 Пик-блок применён к активному циклу по окну ${weeksToMeet} нед: ${peakPreview.summary}${peakPreview.warnings.length ? ' ⚠ ' + peakPreview.warnings.join(' ⚠ ') : ''} — ${peakMode === 'pl' ? 'ПЛ-пик-протокол (объём 85/75/60%, инт. 90/95/100%)' : peakMode === 'pro' ? 'про-тапер (усталость-зависимый)' : 'объём ×0.65/×0.45, RIR +1/+2 (Bosquet 2005)'}.${taperWeightGoal === 'lose' ? ' Весовая цель: сгонка — объём ×0.9.' : taperWeightGoal === 'gain' ? ' Весовая цель: набор — полный объём.' : ''}${mockMeetOn ? ' 🎯 Имитация соревнований (mock meet) добавлена перед тапером — прикиды-синглы.' : ''}${meetWeekOn ? ' 🏁 Неделя соревнований добавлена в конец — прикиды как подходы дня старта.' : ''}${postMeetOn ? ' 🔄 Пост-соревновательная неделя: объём ×0.5, RIR +3.' : ''} 🏁 Выход на пик: прикиды дня соревнований (${MEET_STRATEGY_LABEL[attemptStrategy]}, ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}) на финальной тапер-неделе.${pedAuto && peds.length > 0 ? ' 💉 PED-адаптация та же, что в цикле: прогрессия ПМ продолжена по курсу, adaptForPEDs (MRV/восст).' : ''} → откройте «📋 План цикла», чтобы увидеть результат.`);
          }}
          style={{ ...BTN_GHOST, flex: 1, minHeight: 44, border: builtSrc ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, background: builtSrc ? 'rgba(245,158,11,0.1)' : 'transparent' }}
          title={builtSrc ? `Построить пик-блок на окно ${weeksToMeet} нед до старта: вход в пик + mock + глубокий тапер (${taperWeeksToAdd} нед) + соревнования${postMeetOn ? ' + пост-старт' : ''}${pedAuto && peds.length > 0 ? ' (с учётом PED-курса)' : ''}` : 'Сначала сгенерируйте план'}
        >🗓 Пик-блок на окно ({weeksToMeet} нед){pedAuto && peds.length > 0 ? ' · 💉' : ''}</button>
        <button
          disabled={!builtSrc}
          onClick={handleBuildSeasonPeaks}
          style={{ ...BTN_GHOST, flex: 1, minHeight: 44, border: builtSrc ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc ? '#34d399' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, background: builtSrc ? 'rgba(52,211,153,0.08)' : 'transparent' }}
          title="Построить тапер по ВСЕМУ сезону: продлить план до дальнего старта, под каждое соревнование поставить пик-блок (вход в пик + mock + глубокий тапер + соревнования [+ пост])"
        >📅 Тапер по сезону ({meetList.length} старт)</button>
        <button
          disabled={!builtSrc}
          onClick={() => {
            if (!builtSrc) return;
            if (taperNote) {
              setBuiltSrc(builtSrc);
              setTaperNote('');
              onNote('↺ Тапер уже в плане — сгенерируйте план заново, чтобы убрать.');
            }
          }}
          style={{ ...BTN_GHOST, minHeight: 44, fontSize: 11, border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', display: taperNote ? 'inline-flex' : 'none' }}
          title="Тапер уже добавлен — пересоберите план, чтобы начать заново"
        >ℹ️ в плане</button>
        <button
          disabled={!builtSrc || !taperNote}
          onClick={() => {
            if (!builtSrc) return;
            try {
              const lastAttempts = [...builtSrc.weeks].reverse().find(w => w.meetAttempts)?.meetAttempts;
              const record = {
                id: 'comp-' + Date.now(),
                savedAt: new Date().toISOString(),
                cycleTitle: builtSrc.template.meta.title,
                cycleId: selectedCycleId,
                strategy: attemptStrategy,
                weekCount: builtSrc.weeks.length,
                taperWeeks: taperWeeksToAdd,
                mockMeet: mockMeetOn,
                meetWeek: meetWeekOn,
                weights: { squat: pmSquat, bench: pmBench, deadlift: pmDead },
                meetAttempts: lastAttempts?.lifts ?? [],
                plan: builtSrc,
              };
              const res = saveCompetitionPlan(record);
              const pct = MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced;
              onNote(res.ok
                ? `🏆 Соревновательный цикл сохранён: «${record.cycleTitle}» — ${record.weekCount} нед с тапером, прикиды ${pct}. Открыть: Дневник тренировок → подвкладка «🏁 Соревнования».`
                : `⚠ Не удалось сохранить соревновательный цикл: ${res.error ?? 'переполнение хранилища'}`);
            } catch (error) { onNote(`⚠ Не удалось сохранить: ${(error as Error).message}`); }
          }}
          style={{ ...BTN_GHOST, minHeight: 44, fontSize: 11, border: builtSrc && taperNote ? '1px solid rgba(234,179,8,0.45)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc && taperNote ? '#eab308' : 'rgba(255,255,255,0.3)', background: builtSrc && taperNote ? 'rgba(234,179,8,0.1)' : 'transparent' }}
          title="Сохранить цикл с тапером как соревновательный — появится в дневнике тренировок (подвкладка «🏁 Соревнования») с прикидами и составом мезоцикла"
        >🏆 Сохранить как соревновательный</button>
      </div>
      {/* 🧠 ТРЕНЕР: авто-подбор схемы + вердикт по готовности к старту */}
      <TaperCoachCard
        builtSrc={builtSrc}
        hasTaper={!!taperNote}
        buildCtx={coach.buildCtx}
        applyRecommendation={coach.applyRecommendation}
        attemptStrategy={attemptStrategy}
        onStrategyChange={s => setAttemptStrategy(s)}
        diarySessions={coach.diarySessions}
        onNote={onNote}
      />
      {/* 📋 ТАПЕР-ПЛАН: отдельная свёрнутая карточка (не встраивается в weeks цикла) */}
      <ExpandableCard
        title={`📋 Тапер-план${taperPlan ? ` · ${peakMode === 'pl' ? '🏁 ПЛ-пик' : peakMode === 'pro' ? '🎯 про' : peakMode === 'wf' ? '🎢 WF' : '📉 классика'} · ${taperPlan.weeks.length} нед${Object.values(taperActualPm).some(v => v > 0) ? ' · по факт. ПМ' : ''}${Object.values(taperPlannedPm).some(v => v > 0) ? ' · план федерации' : ''}` : ''}`}
        icon="📋"
        short={taperPlan
          ? `${taperPlan.weeks.length} нед · ${mockMeetOn ? '🎯 mock · ' : ''}📉 тапер ×${taperWeeksToAdd}${meetWeekOn ? ' · 🏁 соревнования' : ''}${Object.values(taperActualPm).some(v => v > 0) ? ' · веса от факт. ПМ' : ''}${Object.values(taperPlannedPm).some(v => v > 0) ? ' · прикиды от плана' : ''} — раскройте для деталей`
          : 'Не сгенерирован — кнопка «📋 Сгенерировать тапер-план» выше. Отдельная карточка, weeks цикла не изменяются.'}
        full={!taperPlan ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Сгенерируйте тапер-план кнопкой выше — он появится здесь отдельной карточкой, не изменяя weeks цикла (календарь не захламится). Тапер строится под разницу ПМ: тренировочные веса — от фактического ПМ после цикла, прикиды/попытки — от планируемого ПМ в федерации.
          </div>
        ) : (() => {
          const arMult = autoRegMode === 'auto' && autoRegResult ? autoRegResult.topSetPctMultiplier : 1;
          // Прикиды отображаются от БАЗЫ (pmRow недели, без авторегуляции) × множитель
          // режима — переключение 🤖 Авто/ВЫКЛ меняет веса карточки на лету (паритет с движком).
          const scale = (w: number) => Math.round(w * arMult * 10) / 10;
          const mockWk = taperPlan.weeks.find(w => w.mockMeet);
          const meetWk = taperPlan.weeks.find(w => w.meetWeek);
          const peakWk = [...taperPlan.weeks].reverse().find(w => w.taperWeek && w.meetAttempts);
          const taperWeeks = taperPlan.weeks.filter(w => w.taperWeek);
          const planRefVolume = Math.max(1, (builtSrc?.weeks[builtSrc.weeks.length - 1]?.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0)) ?? 1);
          return (
            <div>
              {/* Структура тапера */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {mockWk && <span style={{ padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>🎯 Mock meet — нед {mockWk.week}</span>}
                {taperWeeks.map(w => {
                  const protoLabel = peakMode === 'pl' && w.taperNote ? w.taperNote.split(':')[0].trim() : '';
                  const isFinal = w === peakWk;
                  const bg = isFinal ? 'rgba(245,158,11,0.16)' : protoLabel ? 'rgba(96,165,250,0.12)' : 'rgba(245,158,11,0.1)';
                  const color = isFinal ? '#fbbf24' : protoLabel ? '#93c5fd' : '#f59e0b';
                  const bd = isFinal ? 'rgba(245,158,11,0.4)' : protoLabel ? 'rgba(96,165,250,0.3)' : 'rgba(245,158,11,0.25)';
                  return <span key={w.week} style={{ padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: bg, color, border: `1px solid ${bd}` }}>{protoLabel ? `🏁 ${protoLabel} — нед ${w.week}` : `📉 Тапер — нед ${w.week}`}{isFinal ? ' · прикиды' : ''}</span>;
                })}
                {peakWk && taperWeeks.includes(peakWk) && null}
                {meetWk && <span style={{ padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.14)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)' }}>🏁 Соревнования — нед {meetWk.week}</span>}
              </div>
              {/* 📋 Сезон: все соревнования — прикиды по их данным (главное ⭐ + контрольные) */}
              {meetList.length > 1 && (
                <div style={{ marginBottom: 8, padding: 8, borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#93c5fd', marginBottom: 6 }}>📋 Сезон соревнований — прикиды по каждому старту</div>
                  {meetList.map(m => {
                    const isMain = m.id === mainMeetId;
                    const row = { ...(taperActualPm || {}), ...(m.plannedPm || {}) };
                    const hasRow = Object.values(m.plannedPm || {}).some(v => v > 0) || Object.values(taperActualPm || {}).some(v => v > 0);
                    const attempts = hasRow ? computeMeetAttemptsFromPmRow(row as Record<string, number>, m.strategy) : null;
                    return (
                      <div key={m.id} style={{ marginTop: 4, padding: 6, borderRadius: 8, background: isMain ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isMain ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 10 }}>
                          <b style={{ color: isMain ? '#fbbf24' : '#93c5fd' }}>{isMain ? '⭐' : '·'} {m.name}</b>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>через {m.weeksToStart} нед</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fedRu[m.fed] || m.fed}</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{MEET_STRATEGY_PCT_LABEL[m.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}</span>
                          {!isMain && <span style={{ fontSize: 9, color: '#93c5fd', padding: '1px 6px', borderRadius: 5, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}>контрольный: сокращённый пик 1-2 нед перед стартом</span>}
                        </div>
                        {attempts ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            {attempts.lifts.map(l => (
                              <span key={l.name} style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
                                <b>{l.name}</b>: {Math.round(l.opener * 10) / 10} / {Math.round(l.second * 10) / 10} / {Math.round(l.third * 10) / 10}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>Задайте план ПМ (выше) — прикиды появятся автоматически.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Данные к соревнованиям */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginBottom: 8 }}>
                {(['Присед', 'Жим лежа', 'Становая тяга'] as const).map(name => {
                  const actual = taperActualPm[name] || 0;
                  const planned = taperPlannedPm[name] || 0;
                  const diff = actual > 0 && planned > 0 ? planned - actual : 0;
                  const lastCycleWk = builtSrc?.weeks[builtSrc.weeks.length - 1];
                  const forecast = lastCycleWk?.pmRow[name] ?? 0;
                  const vsForecast = actual > 0 && forecast > 0 ? actual - forecast : 0;
                  return (
                    <div key={name} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10 }}>
                      <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{name === 'Присед' ? 'Присед' : name === 'Жим лежа' ? 'Жим' : 'Тяга'}</div>
                      <div style={{ marginTop: 2 }}><span style={{ color: 'rgba(255,255,255,0.45)' }}>факт: </span><b style={{ color: actual > 0 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>{actual > 0 ? actual : '—'}</b></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.45)' }}>план: </span><b style={{ color: planned > 0 ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>{planned > 0 ? planned : '—'}</b></div>
                      {diff !== 0 && <div style={{ fontSize: 9, fontWeight: 800, color: diff > 0 ? '#fbbf24' : '#60a5fa' }}>{diff > 0 ? '▲ +' + diff : '▼ ' + diff} кг к старту</div>}
                      {vsForecast !== 0 && <div style={{ fontSize: 9, fontWeight: 800, color: vsForecast > 0 ? '#22c55e' : '#f87171' }}>vs прогноз цикла {vsForecast > 0 ? '▲ +' + Math.round(vsForecast) : '▼ ' + Math.round(vsForecast)} кг</div>}
                    </div>
                  );
                })}
                <div style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10 }}>
                  <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Федерация</div>
                  <div style={{ marginTop: 2 }}>{fedRu[taperFed] || taperFed} · стратегия {MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}</div>
                </div>
              </div>
              {/* Тапер/пик-кривая */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                  {peakMode === 'pl' ? '🏁 ПЛ-пик-кривая (протокол Библиотеки): объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR → 0' : '📉 Тапер-кривая (Bosquet 2005): объём ↓, интенсивность сохранена, RIR ↑'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 4 }}>
                  {taperWeeks.map(w => {
                    const vol = w.days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.workSets.reduce((a, ws) => a + ws.sets, 0), 0), 0);
                    const ref = Math.max(1, planRefVolume);
                    const mainWs = w.days.flatMap(d => d.exercises.filter(e => e.load === 'main' || e.load === 'Тяжелая').flatMap(e => e.workSets));
                    const mainW = mainWs.length ? Math.max(...mainWs.map(ws => ws.weight)) : 0;
                    const pm = w.pmRow['Присед'] || w.pmRow['Жим лежа'] || w.pmRow['Становая тяга'] || 0;
                    const intensity = mainW > 0 && pm > 0 ? Math.round((mainW / pm) * 100) : null;
                    const rir = mainWs.length ? mainWs[0].rir : null;
                    const protoLabel = peakMode === 'pl' && w.taperNote ? w.taperNote.split(':')[0].trim() : '';
                    const isFinal = w === peakWk;
                    return (
                      <div key={w.week} style={{ padding: 5, borderRadius: 7, background: isFinal ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)', border: `1px solid ${isFinal ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.14)'}`, fontSize: 9, textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: isFinal ? '#fbbf24' : '#f59e0b' }}>{protoLabel ? protoLabel : `Нед ${w.week}`}</div>
                        <div>объём ≈ {Math.round((vol / ref) * 100)}%</div>
                        {intensity != null && <div>инт. ≈ {intensity}% ПМ</div>}
                        <div>RIR {rir != null ? rir : '?'}{peakMode === 'pl' && rir != null && rir <= 0 ? ' · до отказа' : ''}</div>
                        {w.meetAttempts && <div style={{ color: '#fbbf24', fontWeight: 800 }}>🏁 прикиды</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Прикиды */}
              {[peakWk, mockWk, meetWk].filter(Boolean).map(wk => wk && (() => {
                // База прикидов — из pmRow недели (без авторегуляции): переключение режима
                // меняет отображаемые веса, а не накапливает множители поверх сохранённых.
                const att = wk.meetAttempts
                  ? computeMeetAttemptsFromPmRow(wk.pmRow, wk.meetAttempts.strategy) ?? wk.meetAttempts
                  : null;
                return (
                <div key={wk.week} style={{ marginBottom: 8, padding: 8, borderRadius: 10, background: wk.meetWeek ? 'rgba(234,179,8,0.06)' : wk.mockMeet ? 'rgba(167,139,250,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${wk.meetWeek ? 'rgba(234,179,8,0.25)' : wk.mockMeet ? 'rgba(167,139,250,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#fbbf24', marginBottom: 4 }}>
                    {wk.meetWeek ? '🏁 Неделя соревнований' : wk.mockMeet ? '🎯 Mock meet' : '🏁 Выход на пик'} · нед {wk.week} · {MEET_STRATEGY_PCT_LABEL[att?.strategy ?? attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}
                    {arMult !== 1 ? ` · 🤖 авторегуляция ×${arMult.toFixed(2)}` : ''}
                  </div>
                  {wk.taperNote && <div style={{ fontSize: 9, color: '#fbbf24', marginBottom: 4 }}>⚠ {wk.taperNote}</div>}
                  {att?.lifts.map(l => {
                    const ov = taperAttemptOverride[l.name];
                    const opener = ov ? ov[0] : scale(l.opener);
                    const second = ov ? ov[1] : scale(l.second);
                    const third = ov ? ov[2] : scale(l.third);
                    return (
                      <div key={l.name} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, marginTop: 3, flexWrap: 'wrap' }}>
                        <b style={{ width: 70, flexShrink: 0 }}>{l.name}</b>
                        {ov ? (
                          <>
                            <span>1-я <b>{opener}</b></span>
                            <span>2-я <b>{second}</b></span>
                            <span>3-я <b style={{ color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#fbbf24' }}>{third}</b></span>
                            <button onClick={() => setTaperAttemptOverride(cur => { const n = { ...cur }; delete n[l.name]; return n; })} style={{ ...BTN_GHOST, minHeight: 28, fontSize: 9, padding: '3px 8px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>↺ расчёт</button>
                          </>
                        ) : (
                          <>
                            <span>1-я <b>{opener}</b></span>
                            <span>2-я <b>{second}</b></span>
                            <span>3-я <b style={{ color: wk.meetWeek ? '#eab308' : wk.mockMeet ? '#a78bfa' : '#fbbf24' }}>{third}</b></span>
                            <button onClick={() => setTaperAttemptOverride(cur => ({ ...cur, [l.name]: [Math.round(opener), Math.round(second), Math.round(third)] }))} style={{ ...BTN_GHOST, minHeight: 28, fontSize: 9, padding: '3px 8px', background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.3)' }}>✏️ свои</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {att?.lifts[0] && taperAttemptOverride[att.lifts[0].name] && (() => {
                    const ov = taperAttemptOverride[att.lifts[0].name];
                    return (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {['опенер', 'вторая', 'третья'].map((label, i) => (
                          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                            {label}:
                            <input type="number" value={ov[i] || 0} min={0} max={500} step={2.5}
                              onChange={e => {
                                const v = Number(e.target.value);
                                setTaperAttemptOverride(cur => {
                                  const next = [...(cur[att.lifts[0].name] || [0, 0, 0])];
                                  next[i] = Number.isFinite(v) && v >= 0 ? Math.min(v, 500) : 0;
                                  return { ...cur, [att.lifts[0].name]: next };
                                });
                              }}
                              style={{ width: 60, padding: '3px 5px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 10, fontWeight: 700, minHeight: 26, boxSizing: 'border-box' }} />
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {att?.lifts[0] && (() => {
                    const opener = scale(att.lifts[0].opener);
                    if (!opener) return null;
                    const steps = MEET_WARMUP_STEPS.map(p => ({ pct: p, weight: Math.round(opener * p * 2) / 2, reps: p < 0.7 ? 5 : p < 0.85 ? 3 : 1 }));
                    return <div style={{ marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>🔥 Разминка: {steps.map(s => `${Math.round(s.pct * 100)}%×${s.reps}`).join(' → ')} ({steps.map(s => s.weight).join('/')} кг)</div>;
                  })()}
                </div>
                );
              })())}
              {/* Последние тяжёлые */}
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                ⏱ Последние тяжёлые до старта: присед — {LAST_HEAVY_DAYS.squat} дн. · жим — {LAST_HEAVY_DAYS.bench} дн. · тяга — {LAST_HEAVY_DAYS.deadlift} дн.
              </div>
              {/* 📅 Таймлайн дня соревнований (по регламенту федерации) */}
              <div style={{ marginTop: 6, padding: 8, borderRadius: 10, background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#eab308', marginBottom: 4 }}>📅 День старта — таймлайн</div>
                {[
                  ['Взвешивание', 'по регламенту (обычно 08:00-09:00). После — углеводный коктейль + лёгкий перекус за 1.5ч до старта'],
                  ['Разминка', 'за 90 мин до подхода: по протоколу от опенера (50%×5 → 60%×4 → 70%×3 → 80%×2 → 90%×1)'],
                  ['Присед', '3 попытки: опенер RIR2 → вторая RIR1 → третья RIR0. Между попытками 10-20 мин, дыхание 2-3 мин, активация'],
                  ['Жим', '3 попытки по той же схеме. Перкуссионный массаж рабочих мышц между дисциплинами'],
                  ['Тяга', '3 попытки. Контрастный душ/крио-пакет при необходимости'],
                ].map(([t, d], i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 9, lineHeight: 1.4, marginTop: 3 }}>
                    <b style={{ color: '#eab308', width: 80, flexShrink: 0 }}>{t}</b>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {[['🧠 Психо', 'визуализация успешного подхода + ключевое слово за 2 подхода до выхода'], ['🌬 Дыхание', 'квадрат: 4с вдох — 4с пауза — 4с выдох — 4с пауза'], ['💪 Активация', 'лёгкая разминка + целевая мобилизация'], ['🍽 Питание', 'углеводы+BCAA после взвешивания, перекус за 1.5ч'], ['❄ Восстановление', 'массаж/ролл между дисциплинами, крио-пакет при необходимости']].map(([l, d], i) => (
                    <span key={i} title={d} style={{ padding: '3px 8px', borderRadius: 7, fontSize: 9, fontWeight: 700, background: 'rgba(234,179,8,0.08)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.2)', cursor: 'default' }}>{l}</span>
                  ))}
                </div>
              </div>
              {/* Действия */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => { setBuiltSrc(taperPlan); setTaperNote(`Встроено в weeks цикла: +${taperPlan.weeks.length - (builtSrc?.weeks.length ?? taperPlan.weeks.length)} нед тапера`); }} style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }} title="Встроить тапер-недели в weeks активного плана (календарь покажет с тапером)">📌 Встроить в план (weeks)</button>
                <button onClick={() => { if (taperPlan) setTaperPlan(refreshMeetAttempts(taperPlan, attemptStrategy)); }} style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', background: 'rgba(139,92,246,0.08)' }} title="Пересчитать прикиды под выбранную стратегию">🔄 Обновить прикиды</button>
                <button
                  onClick={() => {
                    if (!taperPlan) return;
                    try {
                      const lastAttempts = [...taperPlan.weeks].reverse().find(w => w.meetAttempts)?.meetAttempts;
                      const record = {
                        id: 'comp-' + Date.now(),
                        savedAt: new Date().toISOString(),
                        cycleTitle: taperPlan.template.meta.title + (peakMode === 'pl' ? ' (ПЛ-пик)' : ' (тапер)'),
                        cycleId: selectedCycleId,
                        strategy: attemptStrategy,
                        weekCount: taperPlan.weeks.length,
                        taperWeeks: taperWeeksToAdd,
                        mockMeet: mockMeetOn,
                        meetWeek: meetWeekOn,
                        weights: { squat: pmSquat, bench: pmBench, deadlift: pmDead },
                        meetAttempts: lastAttempts?.lifts ?? [],
                        plan: taperPlan,
                      };
                      const res = saveCompetitionPlan(record);
                      onNote(res.ok
                        ? `🏆 Тапер-план сохранён как соревновательный: «${record.cycleTitle}» — ${record.weekCount} нед, прикиды ${MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}. Дневник → «🏁 Соревнования».`
                        : `⚠ Не удалось сохранить: ${res.error ?? 'переполнение хранилища'}`);
                    } catch (error) { onNote(`⚠ Не удалось сохранить: ${(error as Error).message}`); }
                  }}
                  style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(234,179,8,0.45)', color: '#eab308', background: 'rgba(234,179,8,0.08)' }}
                  title="Сохранить тапер-план как соревновательный — появится в дневнике (подвкладка «🏁 Соревнования») с прикидами"
                >🏆 Сохранить как соревновательный</button>
                <button
                  onClick={() => {
                    if (!taperPlan) return;
                    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const lines: string[] = [];
                    lines.push('<h2>📋 Тапер-план: ' + esc(taperPlan.template.meta.title) + (peakMode === 'pl' ? ' (ПЛ-пик-протокол)' : ' (классика)') + '</h2>');
                    lines.push('<p>Федерация: ' + esc(fedRu[taperFed] || taperFed) + ' · стратегия прикидов: ' + esc(MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? '') + ' · всего ' + taperPlan.weeks.length + ' нед</p>');
                    lines.push('<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px">');
                    lines.push('<tr><th>Нед</th><th>Тип</th><th>Движение</th><th>1-я</th><th>2-я</th><th>3-я</th></tr>');
                    for (const wk of taperPlan.weeks) {
                      const attempts = wk.meetAttempts?.lifts;
                      if (!attempts) continue;
                      for (const l of attempts) {
                        lines.push(`<tr><td>${wk.week}</td><td>${wk.meetWeek ? '🏁 Соревнования' : wk.mockMeet ? '🎯 Mock' : '🏁 Пик'}</td><td>${esc(l.name)}</td><td><b>${scale(l.opener)}</b></td><td><b>${scale(l.second)}</b></td><td><b>${scale(l.third)}</b></td></tr>`);
                      }
                    }
                    lines.push('</table>');
                    lines.push('<p><b>Данные:</b> факт. ПМ: ' + ['Присед', 'Жим лежа', 'Становая тяга'].map(n => n.split(' ')[0] + ' ' + (taperActualPm[n] || '—')).join(' · ') + ' | план федерации: ' + ['Присед', 'Жим лежа', 'Становая тяга'].map(n => n.split(' ')[0] + ' ' + (taperPlannedPm[n] || '—')).join(' · ') + '</p>');
                    const w = window.open('', '_blank', 'width=900,height=700');
                    if (w) { w.document.write('<html><head><title>Тапер-план</title></head><body style="font-family:sans-serif">' + lines.join('') + '</body></html>'); w.document.close(); w.print(); }
                  }}
                  style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', background: 'rgba(96,165,250,0.08)' }}
                  title="Печать тапер-плана: прикиды по неделям + данные к соревнованиям"
                >🖨 Печать тапер-плана</button>
              </div>
            </div>
          );
        })()}
      />
    </div>
  );
};

export default PLCompetitionTab;
