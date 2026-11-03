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
import { MEET_STRATEGY_LABEL, MEET_STRATEGY_PCT_LABEL, MEET_WARMUP_STEPS, resolveCompetitionLiftPm, adaptMeetAttempts, type MeetStrategy, type MeetAttemptResult, type MeetAttemptEffort } from '../../../engines/lms/competition-attempts';
import { LAST_HEAVY_DAYS } from '../../../engines/pro/taper.engine';
import type { PED } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { AutoRegMode } from '../../../engines/pro/diary-autoreg.engine';
import type { AutoRegOutput } from '../../../engines/pro/autoregulation-pro.engine';
import { saveCompetitionPlan } from '../TrainingScreen_parts/CompetitionPlansView';
import type { PeakWeekLayout, TaperMode, TaperWeightGoal } from '../../../engines/lms/lms-taper.engine';
import type { TaperCoachCtx, TaperConfigRecommendation } from '../../../engines/lms/lms-taper-coach.engine';
import { buildPLTaperPrintHtml, buildPLPeakWeekCutProtocol } from '../../../engines/lms/lms-taper-coach.engine';
import { buildPLSeasonIcs } from '../../../engines/lms/pl-season-pro.engine';
import { BTN as TRAIN_BTN, BTN_GHOST as TRAIN_BTN_GHOST, BbCard } from '../TrainingScreen_parts/training-ui';
import { PopupNumber, PopupSelect, ExpandableCard } from './TrainingPopups';
import { AutoRegModeSwitch } from './AutoRegModeSwitch';
import { TaperCoachCard } from './TaperCoachCard';
import { usePLTaper } from './taper-state';
import { getPeakCycles } from '../../../engines/lms/pl-peak-cycle-taper.engine';
import { plNormsSnapshot, PL_GEAR_LABEL } from '../../../engines/lms/pl-norms-bridge.engine';
import { parseMeetProtocol } from '../../../engines/lms/pl-protocol-import.engine';
import { collectPLBackup, parsePLBackup, restorePLBackup, PL_BACKUP_KEY_LABEL } from '../../../engines/lms/pl-backup.engine';
import { getProfile } from '../../../core/profile-manager';
import { localIsoDateOffset } from '../../../core/local-date';
import { dateFromWeeksToStart } from '../../../engines/lms/pl-meet-registry.engine';
import { saveTextFileApk, shareOutcomeLabel } from '../../../core/apk-share';

// Фаза 3: кнопки — из единого кита training-ui.
const BTN = TRAIN_BTN;
const BTN_GHOST = TRAIN_BTN_GHOST;

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
    taperFed, setTaperFed, taperGear, setTaperGear, taperActualPm, setTaperActualPm, taperPlannedPm, setTaperPlannedPm,
    taperAttemptOverride, setTaperAttemptOverride,
    mockMeetOn, setMockMeetOn, meetWeekOn, setMeetWeekOn, postMeetOn, setPostMeetOn,
    taperNote, setTaperNote, taperPlan, setTaperPlan,
    peakCycleId, setPeakCycleId,
  } = t;
  const { peds, pedDoses, courseIntensity, pedAuto, autoRegMode, autoRegResult, plCalorieSurplus, plProteinPerKg, selectedCycleId, pmSquat, pmBench, pmDead } = cyc;
  // P1-2: честный контур «встроен ↔ не встроен»: снимок плана до встраивания
  // тапера позволяет реально вернуть его (а не только сбросить подпись).
  // Aудит P0: снимок — ПЛАН ЦЕЛИКОМ (метрики/лендмарки/рационал тоже), иначе
  // откат возвращал weeks при отчётах тапер-плана; + fingerprint плана, чтобы
  // устаревший снимок не ложился поверх свежесобранного цикла.
  const TAPER_PREV_KEY = 'he_pl_prev_plan_v1';
  const planFingerprint = (p: LMSBuildOutput | null): string =>
    p ? `${p.weeks.length}:${p.weeks.map(w => w.week).join(',')}:${p.weeks[0]?.days.length ?? 0}` : '';
  const readTaperSnapshot = (): { fingerprint: string; weeks: LMSBuildOutput['weeks']; cycleMetrics?: LMSBuildOutput['cycleMetrics']; plVolumeLandmarks?: LMSBuildOutput['plVolumeLandmarks']; progressionRationale?: string } | null => {
    try {
      const raw = sessionStorage.getItem(TAPER_PREV_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.weeks) || snap.weeks.length === 0) return null;
      return snap;
    } catch { return null; }
  };
  const [taperEmbedded, setTaperEmbedded] = React.useState<boolean>(() => {
    try { return !!sessionStorage.getItem(TAPER_PREV_KEY); } catch { return false; }
  });
  const embeddedPlanRef = React.useRef<LMSBuildOutput | null>(null);
  // Пересборка плана (смена цикла/параметров) обесценивает снимок: устаревший
  // откат возвращал бы ЧУЖОЙ план поверх свежего (аудит P0 — потеря данных).
  React.useEffect(() => {
    if (!taperEmbedded) return;
    if (builtSrc && builtSrc === embeddedPlanRef.current) return; // только что встроили
    const snap = readTaperSnapshot();
    if (!snap || snap.fingerprint !== planFingerprint(builtSrc)) {
      try { sessionStorage.removeItem(TAPER_PREV_KEY); } catch { /* ignore */ }
      embeddedPlanRef.current = null;
      setTaperEmbedded(false);
      setTaperNote('');
    }
  }, [builtSrc, taperEmbedded, setTaperNote]);
  const setAutoRegMode = (mode: AutoRegMode) => {
    // Реальный переключатель режима авторегуляции — state живёт в родительском SRCBBScreen.
    api.setAutoRegMode(mode);
    onNote(`🔄 Режим авторегуляции: ${mode === 'auto' ? '🤖 Авто' : mode === 'diary' ? '📓 Авто-дневник' : 'ВЫКЛ'}`);
  };
  // A1: предпросмотр пик-блока по окну до старта (weeksToMeet) — блок = вход в пик +
  // mock + глубокий тапер + соревнования (+ пост после окна). Показывает, что окно реально работает.
  // Интеграция пиковых циклов: если выбран peakCycleId — кривая тапера берётся ИЗ цикла.
  const peakPreview = React.useMemo(() => buildPLPeakBlockLayout({
    windowWeeks: weeksToMeet,
    taperWeeks: taperWeeksToAdd,
    mode: peakMode,
    weightGoal: taperWeightGoal === 'auto' ? undefined : taperWeightGoal,
    mockMeet: mockMeetOn,
    meetWeek: meetWeekOn,
    postMeet: postMeetOn,
    peakCycleId: peakCycleId ?? undefined,
  }), [weeksToMeet, taperWeeksToAdd, peakMode, taperWeightGoal, mockMeetOn, meetWeekOn, postMeetOn, peakCycleId]);
  // C1: дата старта (ISO) — реверс от неё календарной разметки недель блока.
  // P2-6: реальная дата старта (ISO) — реверс календарной разметки от неё.
  // Aудит P1: было `new Date(Date.now()+...).toISOString()` — в UTC+X утром дата
  // уезжала на сутки назад; канон проекта — локальная дата (core/local-date).
  const derivedMeetDate = (() => {
    // Канон недель проекта: старт в неделе N ⇔ её начало = today + (N−1)×7
    // (см. dateFromWeeksToStart / buildPLSeasonPeaks). Было weeksToMeet*7 —
    // дата старта уезжала на неделю позже, чем неделя соревнований в плане.
    try { return dateFromWeeksToStart(Math.max(1, Math.round(weeksToMeet || 1)), localIsoDateOffset(0)); }
    catch { return undefined; }
  })();
  const [meetDateInput, setMeetDateInput] = React.useState<string>(derivedMeetDate ?? '');
  const meetRef = meetDateInput || derivedMeetDate;
  // 📅 ICS сезона: опция «с тренировочными днями» — VEVENT на каждую сессию
  // (раунд 3, §5-bis п.4). Дни цикла раскладываются позиционно от weekStart:
  // СРЦ-цикл не хранит weekday, поэтому при другом расписании события сдвигаются.
  const [seasonIcsWithSessions, setSeasonIcsWithSessions] = React.useState(false);
  // 🏁 Фаза 6, п.1: ФАКТ попыток старта (зачёт/баранка/тяжело + вес) → пересчёт 2-й/3-й
  // по правилам федерации (вес не уменьшается). Переживает F5: старт идёт часами,
  // и потерять опенер из-за перезагрузки экрана — дорогая ошибка.
  const [meetLog, setMeetLog] = React.useState<Record<string, MeetAttemptResult[]>>(() => {
    try {
      const raw = localStorage.getItem('he_pl_meet_log');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed as Record<string, MeetAttemptResult[]> : {};
    } catch { return {}; }
  });
  // 📥 Фаза 6, п.4: импорт протокола соревнования → факты попыток.
  const [protocolOpen, setProtocolOpen] = React.useState(false);
  const [protocolText, setProtocolText] = React.useState('');
  const [protocolLog, setProtocolLog] = React.useState<string[]>([]);
  // 💾 Фаза 6, п.8: бэкап/восстановление PL-сессии (всё живёт в localStorage).
  const [backupText, setBackupText] = React.useState('');
  const [backupLog, setBackupLog] = React.useState<string[]>([]);
  React.useEffect(() => {
    try { localStorage.setItem('he_pl_meet_log', JSON.stringify(meetLog)); } catch { /* ignore */ }
  }, [meetLog]);
  const meetLogKey = (week: number, lift: string) => `${week}:${lift}`;
  const meetResults = (week: number, lift: string) =>
    (meetLog[meetLogKey(week, lift)] || []).filter(r => Number.isFinite(r.weight) && r.weight > 0);
  const setMeetResult = (
    week: number,
    lift: string,
    attempt: 1 | 2 | 3,
    value: { weight: number; made: boolean; effort?: MeetAttemptEffort } | null,
  ) => {
    setMeetLog(cur => {
      const key = meetLogKey(week, lift);
      const list = (cur[key] || []).filter(r => r.attempt !== attempt);
      if (value) list.push({ attempt, weight: value.weight, made: value.made, ...(value.effort ? { effort: value.effort } : {}) });
      list.sort((a, b) => a.attempt - b.attempt);
      const next = { ...cur };
      if (list.length === 0) delete next[key]; else next[key] = list;
      return next;
    });
  };
  // P2-5: протокол сгонки к категории на пик-неделю (вода/натрий/карбы).
  // Фаза 6, п.5: окно «взвешивание → подход» определяет план регидратации.
  const [weighInHours, setWeighInHours] = React.useState<number>(2);
  const peakCut = React.useMemo(
    () => buildPLPeakWeekCutProtocol(bw, targetBw, { weighInHoursBeforeLift: weighInHours }),
    [bw, targetBw, weighInHours],
  );
  // 🏅 Фаза 6, п.2: разряд/тотал/очки. Проектный тотал — от целевых ПМ сезона
  // (если они не заполнены — от фактических). Вес категории — целевой (взвешивание).
  const normsSnap = React.useMemo(() => {
    const sex: 'male' | 'female' = (() => {
      try { return (getProfile().settings as { personal?: { sex?: string } } | undefined)?.personal?.sex === 'female' ? 'female' : 'male'; }
      catch { return 'male'; }
    })();
    const planned = Object.values(taperPlannedPm).some(v => v > 0) ? taperPlannedPm : taperActualPm;
    return plNormsSnapshot({ fed: taperFed, sex, bodyWeight: targetBw > 0 ? targetBw : bw, plannedPm: planned, gear: taperGear });
  }, [taperFed, taperGear, taperPlannedPm, taperActualPm, targetBw, bw]);
  const fedRu: Record<string, string> = { ipf: 'IPF', fpr: 'FPR', wpc: 'WPC', other: 'Другая' };
  // C4: печать тапер-плана (PDF через window.print) — единый контур печати
  // (карточка тапер-плана и кнопка у прикидов используют этот же обработчик).
  const handlePrintTaperPlan = () => {
    if (!taperPlan) return;
    try {
      const pmLine = 'Федерация: ' + (fedRu[taperFed] || taperFed)
        + ' · прикиды: ' + (MEET_STRATEGY_PCT_LABEL[attemptStrategy] ?? '')
        + ' · факт. ПМ: ' + ['Присед', 'Жим лежа', 'Становая тяга']
          .map(n => n.split(' ')[0] + ' ' + (taperActualPm[n] || '—') + ' / план ' + (taperPlannedPm[n] || '—'))
          .join(' · ');
      const html = buildPLTaperPrintHtml(taperPlan, { metaLine: pmLine });
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
        postMeet: postMeetOn,
        windowWeeks: weeksToMeet,
        seasonStart: meetDateInput || undefined,
        peakCycleId: peakCycleId ?? undefined,
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

  // 📅 Календарь сезона (.ics): соревнования из единого реестра + недели
  // пик-блоков с разметкой дат (аудит Oct 2026: сезон выгружался без календаря —
  // ICS был только у тапер-плана и макроцикла).
  // Раунд 4 (§5-quat): выдача идёт через общий APK-мост (core/apk-share) —
  // в Capacitor WebView <a download> уводит файл в никуда; native — Documents+Share.
  const handleSeasonIcs = async () => {
    if (!builtSrc) return;
    try {
      const ics = buildPLSeasonIcs(
        builtSrc.weeks,
        meetList.map(m => ({ id: m.id, name: m.name, weeksToStart: m.weeksToStart, priority: m.id === mainMeetId ? 'A' as const : 'B' as const })),
        {
          todayIso: localIsoDateOffset(0),
          // Даты недель сезона считаются от начала сезона ТОЛЬКО если план реально
          // сезонный (seasonProvenance) — иначе недели без дат честно пропускаются.
          seasonStart: (seasonIcsWithSessions && builtSrc.seasonProvenance?.length) ? (meetDateInput || undefined) : undefined,
          withTrainingSessions: seasonIcsWithSessions,
        },
      );
      if (!/BEGIN:VEVENT/.test(ics)) {
        onNote('⚠ Нечего выгружать: нет стартов с датами и недель пик-блока с разметкой — задайте дату старта или окно до старта.');
        return;
      }
      const out = await saveTextFileApk('pl-season.ics', ics, 'text/calendar;charset=utf-8');
      if (out === 'failed') { onNote('⚠ Не удалось сохранить календарь сезона.'); return; }
      onNote(`📅 Календарь сезона: ${shareOutcomeLabel(out)} (pl-season.ics) — старты и недели пик-блока` + (seasonIcsWithSessions ? ' + события всех тренировочных сессий.' : '.'));
    } catch (e) { onNote('⚠ Ошибка выгрузки календаря: ' + (e as Error).message); }
  };

  return (
    <BbCard
      className="pl-comp"
      icon="🏁"
      accent="#f59e0b"
      title="Соревнования сезона + тапер"
      style={{ marginTop: 10, background: 'rgba(245,158,11,0.05)' }}
      right={
        <>
          {builtSrc && <span style={{ fontSize: 10, color: '#fff' }}>план: {builtSrc.weeks.length} нед · тапер: {taperNote ? (taperEmbedded ? 'встроен' : 'готов (не встроен)') : 'нет'}</span>}
          {builtSrc && (
            <span style={{ fontSize: 10, color: '#fff', marginLeft: 8 }}>
              {autoRegMode === 'auto' && '🤖 auto'}{autoRegMode === 'diary' && '📓 diary'}{autoRegMode === 'off' && '⚠ off'}
            </span>
          )}
        </>
      }
    >
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
                style={{ minHeight: 34, minWidth: 38, padding: '4px 8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: isMain ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.12)', background: isMain ? 'rgba(234,179,8,0.2)' : 'transparent', color: isMain ? '#eab308' : '#fff', alignSelf: 'flex-start' }}
              >{isMain ? '⭐' : '☆'}</button>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 9, color: '#fff', marginBottom: 3, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Название соревнования</div>
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
                  hint="Федерация отображается в сводке/печати прикидов; в расчёт весов попыток не входит (веса — от ПМ по стратегии)"
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
        <div style={{ fontSize: 9, color: '#fff', marginTop: 6, lineHeight: 1.4 }}>
          ⭐ Главное — полный тапер/пик-план (ниже). Остальные — контрольные старты: прикиды по их данным показываются в карточке «Тапер-план» → «Сезон». Стратегия, план ПМ и факт ПМ ниже относятся к ГЛАВНОМУ.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
        <PopupNumber label="Вес сейчас" value={bw} min={40} max={250} suffix=" кг" onChange={v => setBw(v)} />
        <PopupNumber label="Целевой вес (категория)" value={targetBw} min={40} max={250} suffix=" кг" onChange={v => setTargetBw(v)} />
        <PopupNumber label="Недель до старта" value={weeksToMeet} min={1} max={52} suffix=" нед" hint="Окно пик-блока: на эти недели строится полный блок — вход в пик + mock + тапер + соревнования (+ пост). Раньше окно было информационным, теперь реально задаёт длину блока." onChange={v => setWeeksToMeet(v)} />
        <PopupNumber label="Тапер-недель к циклу" value={taperWeeksToAdd} min={1} max={4} suffix="" hint="Сколько недель ГЛУБОКОГО снижения объёма внутри окна до старта" onChange={v => setTaperWeeksToAdd(v)} />
      </div>
      {/* P2-6: реальная дата старта (реверс календарной разметки) */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>📅 Дата старта:</label>
        <input
          type="date"
          value={meetDateInput}
          onChange={e => setMeetDateInput(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, minHeight: 34, boxSizing: 'border-box' }}
          title="Реальная дата соревнования — от неё строится календарная разметка недель пик-блока"
        />
        <span style={{ fontSize: 9, color: '#fff' }}>
          {meetDateInput ? `неделя старта заканчивается ${meetRef}` : 'не задана — по умолчанию через ' + weeksToMeet + ' нед от сегодня'}
        </span>
      </div>
      {/* A1: предпросмотр пик-блока по окну до старта */}
      <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: peakPreview.warnings.length ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${peakPreview.warnings.length ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.25)'}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: peakPreview.warnings.length ? '#f87171' : '#34d399', marginBottom: 2 }}>🗓 {peakPreview.summary}</div>
        {peakPreview.warnings.map((w, i) => (
          <div key={i} style={{ fontSize: 10, color: '#fbbf24', lineHeight: 1.4 }}>⚠ {w}</div>
        ))}
        <div style={{ fontSize: 9, color: '#fff', marginTop: 3, lineHeight: 1.4 }}>
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
        <PopupSelect
          label="🏆 Пиковый цикл ПЛ (интеграция)"
          value={peakCycleId ?? ''}
          onChange={v => setPeakCycleId(v || null)}
          hint="Если выбран — кривая тапера берётся ИЗ недель пикового цикла (объём/intensity по фактическим сетам, канон buildPeakCycleTaperCurve). Без выбора — каноническая кривая по режиму. Интеграция: тапер-пик соответствует пиковому циклу."
          options={[
            { id: '', label: '— каноническая кривая (по режиму) —', desc: 'classic/pl/pro/wf' },
            ...getPeakCycles().map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${c.meta.weeks} нед · ${c.meta.level}` })),
          ]}
        />
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
        {/* Фаза 6, п.3: экипировка меняет таблицу нормативов (у ФПР своя) и коэффициенты IPF GL. */}
        <PopupSelect label="Экипировка" value={taperGear} onChange={v => setTaperGear(v as typeof taperGear)} options={[
          { id: 'classic', label: PL_GEAR_LABEL.classic },
          { id: 'single-ply', label: PL_GEAR_LABEL['single-ply'] },
          { id: 'multi-ply', label: PL_GEAR_LABEL['multi-ply'] },
        ] as { id: 'classic' | 'single-ply' | 'multi-ply'; label: string }[]} />
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
              peakCycleId: peakCycleId ?? undefined,
            });
            setTaperPlan(next);
            // Число добавленных недель — ИЗ ФАКТА (движок дописывает ещё и «вход в
            // пик»); сумма переключателей раньше занижала его в 2 раза.
            const addCount = Math.max(0, next.weeks.length - (builtSrc?.weeks.length ?? next.weeks.length));
            const cycNote = peakCycleId ? ` · 🏆 из цикла «${peakCycleId}»` : '';
            setTaperNote(`Тапер-план сгенерирован: +${addCount} нед${mockMeetOn ? ' · 🎯 mock meet' : ''}${meetWeekOn ? ' · 🏁 соревнования' : ''}${postMeetOn ? ' · 🔄 пост-старт' : ''}${peakMode === 'pl' ? ' · 🏁 ПЛ-пик-протокол' : peakMode === 'pro' ? ' · 🎯 про-тапер' : ' · 📉 классика'}${cycNote}${taperWeightGoal === 'lose' ? ' · ⬇ сгонка' : taperWeightGoal === 'gain' ? ' · ⬆ набор' : ''}${Object.keys(meetData.actualPm).length ? ' · по факт. ПМ после цикла' : ''}${Object.keys(meetData.plannedPm).length ? ' · прикиды от плана федерации' : ''} · пик ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}${autoRegMode === 'auto' ? ' · auto-regime: top-set×' + (autoRegResult?.topSetPctMultiplier ?? 1).toFixed(2) + ' · объём×' + (autoRegResult?.volumeMultiplier ?? 1).toFixed(2) + ' · RIR+' + (autoRegResult?.rirShift ?? 0) : ''}${autoRegMode === 'diary' ? ' · diary-regime active' : ''}`);
            onNote(`📋 Тапер-план готов (отдельная карточка — цикл не изменён).${peakCycleId ? ` Пиковый цикл «${peakCycleId}» — кривая тапера из цикла (соответствует ПЛ-авто).` : peakMode === 'pl' ? ' Режим: ПЛ-пик-протокол (объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR→0).' : peakMode === 'pro' ? ' Режим: про-тапер (усталость-зависимый, прайминг).' : ' Режим: классический тапер (Bosquet, интенсивность сохранена).'}${taperWeightGoal === 'lose' ? ' Весовая цель: сгонка — объём ×0.9.' : taperWeightGoal === 'gain' ? ' Весовая цель: набор — полный объём.' : ''}${Object.keys(meetData.actualPm).length ? ' Тренировочные веса тапера от фактического ПМ после цикла.' : ''}${Object.keys(meetData.plannedPm).length ? ' Прикиды/попытки от планируемого ПМ федерации.' : ''} Чтобы встроить в weeks цикла — «Встроить в план».`);
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
          onClick={() => setMockMeetOn(v => !v)}
          aria-pressed={mockMeetOn}
          data-pl="mock-meet-toggle"
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: mockMeetOn ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)', background: mockMeetOn ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', color: mockMeetOn ? '#a78bfa' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Имитация соревнований за 10-14 дней до старта: неделя перед тапером с прикидами-синглами (опенер RIR2 → вторая RIR1 → третья RIR0)"
        >🎯 Имитация соревнований (mock meet){mockMeetOn ? ' ✓' : ''}</button>
        <button
          onClick={() => setMeetWeekOn(v => !v)}
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: meetWeekOn ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)', background: meetWeekOn ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.02)', color: meetWeekOn ? '#eab308' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Неделя соревнований В КОНЦЕ плана: прикиды (опенер/вторая/третья ×1) как подходы дня старта — план готов полностью"
        >🏁 Неделя соревнований в конце{meetWeekOn ? ' ✓' : ''}</button>
        <button
          onClick={() => setPostMeetOn(v => !v)}
          style={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 8, border: postMeetOn ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)', background: postMeetOn ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.02)', color: postMeetOn ? '#34d399' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 12px' }}
          title="Восстановительная неделя ПОСЛЕ соревнований: объём ×0.5, вес 65 % ПМ, RIR 4 — плавный старт от последней рабочей недели (без соревновательных весов)"
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
        <div style={{ marginTop: 6 }}>
          <AutoRegModeSwitch value={autoRegMode} onChange={setAutoRegMode} dataHook="comp-autoreg" />
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
                <div key={i} style={{ fontSize: 10, color: r.startsWith('❌') ? '#f87171' : r.startsWith('⚠') ? '#fbbf24' : r.startsWith('✅') ? '#4ade80' : '#fff', lineHeight: 1.4 }}>{r}</div>
              ))}
            </div>
            {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(rec.toCut > 0 ? rec.timeline : rec.toGain > 0 ? rec.gainTimeline : rec.timeline).map(t => (
                  <div key={t.week} title={t.note} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 9, background: t.week === weeksToMeet ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.week === weeksToMeet ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                    <b style={{ color: t.week === weeksToMeet ? '#f59e0b' : '#fff' }}>Н{t.week}</b> {t.weight.toFixed(1)} кг
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {/* 🏅 Фаза 6, п.2: разряд и зачётный тотал по нормативам федерации */}
      <div data-pl="norms-bridge">
        <ExpandableCard
          icon="🏅"
          title={normsSnap.classification
            ? `🏅 Разряд · ${normsSnap.classification.achievedLabel} → ${normsSnap.classification.nextLabel} · проект ${normsSnap.total} кг`
            : `🏅 Разряд и тотал · проект ${normsSnap.total} кг`}
          short={`${taperGear === 'classic' ? '' : `Экипировка · ${PL_GEAR_LABEL[taperGear]} · `}${normsSnap.classification
            ? `${normsSnap.classification.category.label} · до следующего разряда ${normsSnap.classification.nextLabel}: ${normsSnap.classification.kgToNext > 0 ? `${normsSnap.classification.kgToNext} кг` : 'выполнен'} · IPF GL ${normsSnap.glPoints} · прогресс ${normsSnap.progressPct}% · ⚠ Сверяйте с официальной таблицей сезона`
            : `${normsSnap.note}${normsSnap.glPoints > 0 ? ` · IPF GL ${normsSnap.glPoints}` : ''}`}`}
          full={
            <div>
              <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.45, marginBottom: 6 }}>
                Проектный тотал: <b>{normsSnap.total} кг</b> (вес категории {normsSnap.bodyWeight} кг) · очки IPF GL: <b>{normsSnap.glPoints}</b>
              </div>
              {normsSnap.classification && (
                <>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, normsSnap.progressPct))}%`, height: '100%', background: '#00e68a' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    {normsSnap.classification.allRanks.map(rn => (
                      <span
                        key={rn.key}
                        title={rn.achieved ? 'выполнено проектом тотала' : 'не дотягиваем'}
                        style={{
                          padding: '3px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                          background: rn.achieved ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${rn.achieved ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: rn.achieved ? '#4ade80' : '#fff',
                        }}
                      >
                        {rn.label} {rn.threshold}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 9, color: '#fff', opacity: 0.8, lineHeight: 1.45 }}>{normsSnap.note}</div>
              <div style={{ fontSize: 9, color: '#fff', opacity: 0.6, lineHeight: 1.45, marginTop: 4 }}>
                Тотал считается из целевых ПМ (поля «План ПМ в федерации»). Нормативы — из справочника приложения; перед заявкой сверяйте с официальной таблицей сезона.
              </div>
            </div>
          }
        />
      </div>
      {/* P2-5: сгонка к категории на пик-неделе (вода/натрий/карбы по дням) */}
      {peakCut.needed && (
        <ExpandableCard
          icon="💧"
          title={`💧 Сгонка на пик-неделе · ${peakCut.toCutKg.toFixed(1)} кг (вода/натрий/карбы)`}
          short={`Вода 6→2 л · Натрий 4→0.5 г · Карбы 4→1 г/кг · взвешивание утром старта${peakCut.recovery ? ` · ♻️ восстановление: ${peakCut.recovery.hoursToLift} ч до подхода` : ''}${peakCut.warnings.length ? ' · ⚠ см. детали' : ''}`}
          full={
            <div>
              {peakCut.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 10, color: '#fbbf24', lineHeight: 1.4, marginBottom: 4 }}>⚠ {w}</div>
              ))}
              <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, marginBottom: 6 }}>{peakCut.summary}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 9, color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>День</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Вода</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Натрий</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px' }}>Карбы</th>
                  </tr>
                </thead>
                <tbody>
                  {peakCut.days.map(d => (
                    <tr key={d.day} style={{ fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700, color: d.day === 7 ? '#f59e0b' : '#fff' }}>{d.label}</td>
                      <td style={{ padding: '4px 6px', color: '#fff' }}>{d.waterMl}</td>
                      <td style={{ padding: '4px 6px', color: '#fff' }}>{d.sodiumMg}</td>
                      <td style={{ padding: '4px 6px', color: '#fff' }}>{d.carbsG}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Фаза 6, п.5: план восстановления ПОСЛЕ взвешивания (без него сгонка бессмысленна) */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>Взвешивание:</span>
                {[{ h: 2, label: 'за 2 ч (IPF)' }, { h: 24, label: 'за 24 ч' }].map(o => (
                  <button
                    key={o.h}
                    type="button"
                    data-pl="weighin-window"
                    aria-pressed={weighInHours === o.h}
                    onClick={() => setWeighInHours(o.h)}
                    style={{
                      minHeight: 30, padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${weighInHours === o.h ? '#38bdf8' : 'rgba(255,255,255,0.15)'}`,
                      background: weighInHours === o.h ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                      color: weighInHours === o.h ? '#000' : '#fff',
                    }}
                  >{o.label}</button>
                ))}
              </div>
              {peakCut.recovery && (
                <div data-pl="weighin-recovery" style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>♻️ Восстановление после взвешивания</div>
                  <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.45, marginBottom: 6 }}>{peakCut.recovery.summary}</div>
                  {peakCut.recovery.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#fbbf24', lineHeight: 1.4, marginBottom: 4 }}>⚠ {w}</div>
                  ))}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ fontSize: 9, color: '#fff' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Окно</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Жидкость</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Натрий</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Углеводы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peakCut.recovery.steps.map((s, i) => (
                        <tr key={i} style={{ fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 700, color: '#fff' }}>{s.window}</td>
                          <td style={{ padding: '4px 6px', color: '#fff' }}>{s.fluids}</td>
                          <td style={{ padding: '4px 6px', color: '#fff' }}>{s.sodium}</td>
                          <td style={{ padding: '4px 6px', color: '#fff' }}>{s.carbs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {peakCut.recovery.steps.map((s, i) => (
                    <div key={i} style={{ fontSize: 9, color: '#fff', opacity: 0.75, marginTop: 2 }}>· {s.window}: {s.note}</div>
                  ))}
                </div>
              )}
            </div>
          }
        />
      )}
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
              peakCycleId: peakCycleId ?? undefined,
            });
            setBuiltSrc(next);
            // Число добавленных недель — ИЗ ФАКТА (движок дописывает ещё и «вход в
            // пик»); сумма переключателей занижала его в 2 раза (аудит Oct 2026).
            const addCount = Math.max(0, next.weeks.length - builtSrc.weeks.length);
            const cycNote2 = peakCycleId ? ` · 🏆 из цикла «${peakCycleId}»` : '';
            setTaperNote(`+${addCount} нед${mockMeetOn ? ' · 🎯 mock meet' : ''}${meetWeekOn ? ' · 🏁 соревнования' : ''}${postMeetOn ? ' · 🔄 пост-старт' : ''}${pedAuto && peds.length > 0 ? ' · 💉 PED-адаптация как в цикле' : ''}${cycNote2}${taperWeightGoal === 'lose' ? ' · ⬇ сгонка' : taperWeightGoal === 'gain' ? ' · ⬆ набор' : ''} · 🏁 пик ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}`);
            onNote(`📉 Пик-блок применён к активному циклу по окну ${weeksToMeet} нед: ${peakPreview.summary}${peakPreview.warnings.length ? ' ⚠ ' + peakPreview.warnings.join(' ⚠ ') : ''} — ${peakCycleId ? `пиковый цикл «${peakCycleId}» — кривая тапера из цикла (соответствует ПЛ-авто).` : peakMode === 'pl' ? 'ПЛ-пик-протокол (объём 85/75/60%, инт. 90/95/100%)' : peakMode === 'pro' ? 'про-тапер (усталость-зависимый)' : 'объём ×0.65/×0.45, RIR +1/+2 (Bosquet 2005)'}.${taperWeightGoal === 'lose' ? ' Весовая цель: сгонка — объём ×0.9.' : taperWeightGoal === 'gain' ? ' Весовая цель: набор — полный объём.' : ''}${mockMeetOn ? ' 🎯 Имитация соревнований (mock meet) добавлена перед тапером — прикиды-синглы.' : ''}${meetWeekOn ? ' 🏁 Неделя соревнований добавлена в конец — прикиды как подходы дня старта.' : ''}${postMeetOn ? ' 🔄 Пост-соревновательная неделя: объём ×0.5, вес 65 % ПМ, RIR 4 — от последней рабочей недели, без соревновательных весов.' : ''} 🏁 Выход на пик: прикиды дня соревнований (${MEET_STRATEGY_LABEL[attemptStrategy]}, ${MEET_STRATEGY_PCT_LABEL[attemptStrategy]}) на финальной тапер-неделе.${pedAuto && peds.length > 0 ? ' 💉 PED-адаптация та же, что в цикле: прогрессия ПМ продолжена по курсу, adaptForPEDs (MRV/восст).' : ''} → откройте «📋 План цикла», чтобы увидеть результат.`);
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
          onClick={handleSeasonIcs}
          style={{ ...BTN_GHOST, flex: 1, minHeight: 44, border: builtSrc ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.08)', color: builtSrc ? '#60a5fa' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, background: builtSrc ? 'rgba(96,165,250,0.08)' : 'transparent' }}
          title="Выгрузить сезон в календарь (.ics): соревнования из реестра стартов + недели пик-блоков с датами"
        >📅 Календарь сезона (.ics)</button>
        {/* §5-bis п.4: VEVENT на каждую тренировочную сессию сезона.
            Тумблер НЕ disabled без плана — это предпочтение выгрузки. */}
        <button
          data-taper="ics-sessions"
          onClick={() => setSeasonIcsWithSessions(v => !v)}
          aria-pressed={seasonIcsWithSessions}
          style={{ ...BTN_GHOST, flex: 1, minHeight: 44, border: seasonIcsWithSessions ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(255,255,255,0.08)', color: seasonIcsWithSessions ? '#34d399' : 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, background: seasonIcsWithSessions ? 'rgba(52,211,153,0.1)' : 'transparent' }}
          title="Добавить в календарь событие на каждую тренировочную сессию сезона (дни раскладываются позиционно от недели — СРЦ-цикл не хранит weekday)"
        >🏋 С тренировками ({seasonIcsWithSessions ? 'вкл' : 'выкл'})</button>
        <button
          disabled={!builtSrc}
          data-taper="state"
          onClick={() => {
            if (!builtSrc) return;
            if (taperNote) {
              // Честный откат: если тапер реально встроен — возвращаем снимок плана
              // ЦЕЛИКОМ (weeks + метрики + лендмарки + рационал).
              let restored = false;
              try {
                const snap = readTaperSnapshot();
                if (snap && snap.fingerprint === planFingerprint(builtSrc)) {
                  setBuiltSrc({
                    ...builtSrc,
                    weeks: snap.weeks,
                    cycleMetrics: snap.cycleMetrics ?? builtSrc.cycleMetrics,
                    plVolumeLandmarks: snap.plVolumeLandmarks ?? builtSrc.plVolumeLandmarks,
                    progressionRationale: snap.progressionRationale ?? builtSrc.progressionRationale,
                  });
                  restored = true;
                }
              } catch { /* снимок битый — честно сообщаем ниже */ }
              if (restored) {
                try { sessionStorage.removeItem(TAPER_PREV_KEY); } catch { /* ignore */ }
                embeddedPlanRef.current = null;
                setTaperEmbedded(false);
                setTaperNote('');
                onNote('↩ Тапер убран из плана — восстановлена раскладка до встраивания.');
              } else if (taperEmbedded) {
                onNote('⚠ Снимок плана «до встраивания» устарел (план пересобран) — откат невозможен, постройте план заново.');
              } else {
                onNote('ℹ️ Тапер сгенерирован отдельной карточкой и НЕ встроен в недели плана — встройте кнопкой «📌 Встроить в план», чтобы он попал в таблицу/печать.');
              }
            }
          }}
          style={{ ...BTN_GHOST, minHeight: 44, fontSize: 11, border: '1px solid rgba(255,255,255,0.08)', color: '#fff', display: taperNote ? 'inline-flex' : 'none' }}
          title={taperEmbedded ? 'Вернуть раскладку плана до встраивания тапера' : 'Тапер готов отдельной карточкой и не встроен в план'}
        >{taperEmbedded ? '↩ Убрать тапер из плана' : 'ℹ️ в плане'}</button>
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
          <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
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
                {meetWk && <span style={{ padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.14)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)' }}>🏁 Соревнования — нед {meetWk.week}</span>}
              </div>
              {/* P2-7: гент-таймлайн пик-блока (недели по типам + даты) */}
              {(() => {
                const tail = taperPlan.weeks.filter(w => w.taperWeek || w.mockMeet || w.meetWeek || w.postMeet || w.rampWeek);
                if (tail.length === 0) return null;
                const colorOf = (w: { meetWeek?: boolean; mockMeet?: boolean; postMeet?: boolean; rampWeek?: boolean }) =>
                  w.meetWeek ? '#eab308' : w.mockMeet ? '#a78bfa' : w.postMeet ? '#34d399' : w.rampWeek ? '#60a5fa' : '#f59e0b';
                const labelOf = (w: typeof tail[number]) =>
                  w.meetWeek ? '🏁' : w.mockMeet ? '🎯' : w.postMeet ? '🔄' : w.rampWeek ? '📈' : '📉';
                return (
                  <div style={{ marginTop: 8, marginBottom: 8, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 6 }}>🗺 Пик-блок ({tail.length} нед)</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {tail.map(w => {
                        const c = colorOf(w);
                        const date = w.weekStart && w.weekEnd ? `${w.weekStart} – ${w.weekEnd}` : '';
                        return (
                          <div key={w.week} title={`Нед ${w.week}${date ? ' · ' + date : ''}`} style={{ flex: '1 1 60px', minWidth: 56, padding: '6px 8px', borderRadius: 8, textAlign: 'center', background: c + '1a', border: `1px solid ${c}55`, fontSize: 11, fontWeight: 700, color: c }}>
                            <div>{labelOf(w)}</div>
                            <div style={{ fontSize: 9, fontWeight: 400, color: '#fff' }}>нед {w.week}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 9, color: '#fff' }}>
                      <span>📈 Вход в пик</span><span>🎯 Mock</span><span>📉 Тапер</span><span>🏁 Соревнования</span><span>🔄 Пост</span>
                    </div>
                  </div>
                );
              })()}
              {/* 📋 Сезон: все соревнования — прикиды по их данным (главное ⭐ + контрольные) */}
              {meetList.length > 1 && (
                <div style={{ marginBottom: 8, padding: 8, borderRadius: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#93c5fd', marginBottom: 6 }}>📋 Сезон соревнований — прикиды по каждому старту</div>
                  {meetList.map(m => {
                    const isMain = m.id === mainMeetId;
                    // Только положительные значения: нули «План ПМ в федерации»
                    // (дефолт полей) затирали фактический ПМ, и лифт пропадал из
                    // прикидов вовсе (resolveCompetitionLifts режет value>0).
                    const pos = (o: Record<string, number> | undefined) =>
                      Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => Number.isFinite(v) && v > 0));
                    const row = { ...pos(taperActualPm), ...pos(m.plannedPm) };
                    const hasRow = Object.values(row).some(v => v > 0);
                    const attempts = hasRow ? computeMeetAttemptsFromPmRow(row as Record<string, number>, m.strategy) : null;
                    return (
                      <div key={m.id} style={{ marginTop: 4, padding: 6, borderRadius: 8, background: isMain ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isMain ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 10 }}>
                          <b style={{ color: isMain ? '#fbbf24' : '#93c5fd' }}>{isMain ? '⭐' : '·'} {m.name}</b>
                          <span style={{ color: '#fff' }}>через {m.weeksToStart} нед</span>
                          <span style={{ color: '#fff' }}>{fedRu[m.fed] || m.fed}</span>
                          <span style={{ color: '#fff' }}>{MEET_STRATEGY_PCT_LABEL[m.strategy] ?? MEET_STRATEGY_PCT_LABEL.balanced}</span>
                          {!isMain && <span style={{ fontSize: 9, color: '#93c5fd', padding: '1px 6px', borderRadius: 5, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}>контрольный: сокращённый пик 1-2 нед перед стартом</span>}
                        </div>
                        {attempts ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            {attempts.lifts.map(l => (
                              <span key={l.name} style={{ fontSize: 9, color: '#fff' }}>
                                <b>{l.name}</b>: {Math.round(l.opener * 10) / 10} / {Math.round(l.second * 10) / 10} / {Math.round(l.third * 10) / 10}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: '#fff', marginTop: 3 }}>Задайте план ПМ (выше) — прикиды появятся автоматически.</div>
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
                   const forecastLift = name === 'Присед' ? 'squat' : name === 'Жим лежа' ? 'bench' : 'deadlift';
                   const forecast = resolveCompetitionLiftPm(lastCycleWk?.pmRow ?? {}, forecastLift);
                  const vsForecast = actual > 0 && forecast > 0 ? actual - forecast : 0;
                  return (
                    <div key={name} style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10 }}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{name === 'Присед' ? 'Присед' : name === 'Жим лежа' ? 'Жим' : 'Тяга'}</div>
                      <div style={{ marginTop: 2 }}><span style={{ color: '#fff' }}>факт: </span><b style={{ color: actual > 0 ? '#22c55e' : '#fff' }}>{actual > 0 ? actual : '—'}</b></div>
                      <div><span style={{ color: '#fff' }}>план: </span><b style={{ color: planned > 0 ? '#f59e0b' : '#fff' }}>{planned > 0 ? planned : '—'}</b></div>
                      {diff !== 0 && <div style={{ fontSize: 9, fontWeight: 800, color: diff > 0 ? '#fbbf24' : '#60a5fa' }}>{diff > 0 ? '▲ +' + diff : '▼ ' + diff} кг к старту</div>}
                      {vsForecast !== 0 && <div style={{ fontSize: 9, fontWeight: 800, color: vsForecast > 0 ? '#22c55e' : '#f87171' }}>vs прогноз цикла {vsForecast > 0 ? '▲ +' + Math.round(vsForecast) : '▼ ' + Math.round(vsForecast)} кг</div>}
                    </div>
                  );
                })}
                <div style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10 }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Федерация</div>
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
                  {/* 📥 Фаза 6, п.4: импорт протокола — заполняет факты попыток из вставленного текста. */}
                  {(wk.meetWeek || wk.mockMeet) && (
                    <div data-pl="protocol-import" style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        data-pl="protocol-import-toggle"
                        aria-expanded={protocolOpen}
                        onClick={() => setProtocolOpen(o => !o)}
                        style={{ ...BTN_GHOST, minHeight: 28, fontSize: 9, padding: '3px 8px', background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.3)' }}
                      >📥 {protocolOpen ? 'Скрыть импорт протокола' : 'Импорт протокола'}</button>
                      {protocolOpen && (
                        <div style={{ marginTop: 4 }}>
                          <textarea
                            value={protocolText}
                            onChange={e => setProtocolText(e.target.value)}
                            aria-label="Текст протокола соревнования"
                            placeholder={'Присед 1 185 ✅\nПрисед 2 192.5 ✅\nЖим 1 140 ❌'}
                            style={{ width: '100%', minHeight: 68, padding: 6, borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 10, fontFamily: 'monospace', boxSizing: 'border-box' }}
                          />
                          <button
                            type="button"
                            data-pl="protocol-import-apply"
                            onClick={() => {
                              const parsed = parseMeetProtocol(protocolText);
                              const applied: string[] = [];
                              for (const row of parsed.rows) {
                                if (row.made === null) continue; // не выдумываем результат
                                const lift = att?.lifts.find(li =>
                                  row.lift === 'squat' ? /присед/i.test(li.name)
                                    : row.lift === 'bench' ? /жим/i.test(li.name)
                                      : /станов|тяга/i.test(li.name));
                                if (!lift) continue;
                                setMeetResult(wk.week, lift.name, row.attempt, { weight: row.weight, made: row.made, effort: 'normal' });
                                applied.push(`${lift.name} ${row.attempt}-я ${row.weight} кг ${row.made ? '✅' : '❌'}`);
                              }
                              const log = [...parsed.warnings, applied.length > 0 ? `Внесено: ${applied.join('; ')}` : 'Ничего не внесено.'];
                              setProtocolLog(log);
                              onNote(`📥 Протокол: внесено попыток — ${applied.length}. Проверьте чипы факта ниже.`);
                            }}
                            style={{ ...BTN_GHOST, minHeight: 28, fontSize: 9, padding: '3px 8px', marginTop: 4, background: 'rgba(0,230,138,0.12)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.35)' }}
                          >Заполнить факты</button>
                          {protocolLog.length > 0 && (
                            <div data-pl="protocol-import-log" style={{ marginTop: 4, fontSize: 9, color: '#fff', opacity: 0.85, lineHeight: 1.45 }}>
                              {protocolLog.map((l, i) => <div key={i}>{/Внесено|Ничего/.test(l) ? `✔ ${l}` : `⚠ ${l}`}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {att?.lifts.map(l => {
                    const ov = taperAttemptOverride[l.name];
                    const opener = ov ? ov[0] : scale(l.opener);
                    const second = ov ? ov[1] : scale(l.second);
                    const third = ov ? ov[2] : scale(l.third);
                    // Разминка — на КАЖДЫЙ лифт: раньше выводилась только для первого
                    // (присед), а жим/тяга оставались без разминочной лестницы.
                    const baseWarmup = l.warmup ?? [];
                    const ratio = l.opener > 0 ? opener / scale(l.opener) : 1;
                    const steps = baseWarmup.length > 0
                      ? baseWarmup.map(s => ({ pct: s.pct, weight: Math.round(s.weight * ratio * 2) / 2, reps: s.reps }))
                      : MEET_WARMUP_STEPS.map(p => ({ pct: p, weight: Math.round(opener * p * 2) / 2, reps: p < 0.7 ? 5 : p < 0.85 ? 3 : 1 }));
                    return (
                      <div key={l.name} style={{ marginTop: 3 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, flexWrap: 'wrap' }}>
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
                      {ov && (
                        <div data-pl="attempt-override" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {['опенер', 'вторая', 'третья'].map((label, i) => (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                              {label}:
                              <input type="number" value={ov[i] || 0} min={0} max={500} step={2.5}
                                aria-label={`${l.name} ${label}`}
                                onChange={e => {
                                  const v = Number(e.target.value);
                                  setTaperAttemptOverride(cur => {
                                    const next = [...(cur[l.name] || [0, 0, 0])];
                                    next[i] = Number.isFinite(v) && v >= 0 ? Math.min(v, 500) : 0;
                                    return { ...cur, [l.name]: next };
                                  });
                                }}
                                style={{ width: 60, padding: '3px 5px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 10, fontWeight: 700, minHeight: 26, boxSizing: 'border-box' }} />
                            </span>
                          ))}
                        </div>
                      )}
                      {opener > 0 && (
                        <div style={{ marginTop: 4, fontSize: 9, color: '#fff' }}>🔥 Разминка: {steps.map(s => `${Math.round(s.pct * 100)}%×${s.reps}`).join(' → ')} ({steps.map(s => s.weight).join('/')} кг)</div>
                      )}
                      {(wk.meetWeek || wk.mockMeet) && (() => {
                        const results = meetResults(wk.week, l.name);
                        const adv = adaptMeetAttempts({ opener, second, third, target: third }, results);
                        const chipStyle = (active: boolean, tone: string) => ({
                          minHeight: 26, minWidth: 30, padding: '2px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                          border: `1px solid ${active ? tone : 'rgba(255,255,255,0.15)'}`,
                          background: active ? tone : 'rgba(255,255,255,0.05)',
                          color: active ? '#000' : '#fff',
                        });
                        const plannedWeight = (n: 1 | 2 | 3) => (n === 1 ? opener : n === 2 ? second : third);
                        return (
                          <div data-pl="meet-adaptive" style={{ marginTop: 6, paddingTop: 5, borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
                            <div style={{ fontSize: 9, color: '#fff', opacity: 0.75 }}>🏁 Факт попыток → пересчёт 2-й/3-й (вес можно только поднимать или повторить)</div>
                            {([1, 2, 3] as const).map(n => {
                              const r = results.find(x => x.attempt === n);
                              const w = r ? r.weight : plannedWeight(n);
                              return (
                                <div key={n} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3, fontSize: 9 }}>
                                  <span style={{ width: 26, color: '#fff' }}>{n}-я</span>
                                  <input
                                    type="number" min={0} max={500} step={2.5} value={w}
                                    aria-label={`${l.name} факт ${n}-й попытки`}
                                    onChange={e => {
                                      const v = Number(e.target.value);
                                      if (!Number.isFinite(v) || v <= 0) { setMeetResult(wk.week, l.name, n, null); return; }
                                      setMeetResult(wk.week, l.name, n, { weight: Math.min(v, 500), made: r ? r.made : true, effort: r?.effort });
                                    }}
                                    style={{ width: 60, padding: '3px 5px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 10, fontWeight: 700, minHeight: 26, boxSizing: 'border-box' }}
                                  />
                                  <button
                                    type="button" data-pl="meet-made" aria-pressed={!!r && r.made && r.effort !== 'grind'}
                                    onClick={() => {
                                      const active = !!r && r.made && r.effort !== 'grind';
                                      setMeetResult(wk.week, l.name, n, active ? null : { weight: w, made: true, effort: 'normal' });
                                    }}
                                    style={chipStyle(!!r && r.made && r.effort !== 'grind', '#4ade80')}
                                  >✅</button>
                                  <button
                                    type="button" data-pl="meet-grind" aria-pressed={!!r && r.made && r.effort === 'grind'}
                                    onClick={() => {
                                      const active = !!r && r.made && r.effort === 'grind';
                                      setMeetResult(wk.week, l.name, n, active ? null : { weight: w, made: true, effort: 'grind' });
                                    }}
                                    style={chipStyle(!!r && r.made && r.effort === 'grind', '#fbbf24')}
                                  >😤</button>
                                  <button
                                    type="button" data-pl="meet-miss" aria-pressed={!!r && !r.made}
                                    onClick={() => {
                                      const active = !!r && !r.made;
                                      setMeetResult(wk.week, l.name, n, active ? null : { weight: w, made: false });
                                    }}
                                    style={chipStyle(!!r && !r.made, '#f87171')}
                                  >✗</button>
                                </div>
                              );
                            })}
                            {results.length > 0 && (
                              <div data-pl="meet-advice" style={{ marginTop: 4, fontSize: 9, color: adv.bombed ? '#f87171' : '#fbbf24' }}>
                                {adv.notes.map((note, ni) => <div key={ni}>· {note}</div>)}
                                {(adv.second !== null || adv.third !== null) && (
                                  <div style={{ color: '#fff' }}>
                                    → Рекомендация: {adv.second !== null ? `2-я ${adv.second} кг` : ''}
                                    {adv.second !== null && adv.third !== null ? ' · ' : ''}
                                    {adv.third !== null ? `3-я ${adv.third} кг` : ''}
                                  </div>
                                )}
                                {adv.second !== null && adv.third !== null && (adv.second !== second || adv.third !== third) && (
                                  <button
                                    type="button" data-pl="meet-apply"
                                    onClick={() => {
                                      const o = Math.round(opener);
                                      const s2 = Math.round(adv.second!);
                                      const t2 = Math.round(adv.third!);
                                      setTaperAttemptOverride(cur => ({ ...cur, [l.name]: [o, s2, t2] }));
                                      onNote(`📌 ${l.name}: рекомендация ${o}/${s2}/${t2} кг внесена в план (печать/экспорт увидят её).`);
                                    }}
                                    style={{ ...BTN_GHOST, minHeight: 26, fontSize: 9, padding: '3px 8px', marginTop: 3, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}
                                  >📌 Принять в план</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      </div>
                    );
                  })}
                  {/* Свои прикиды и разминка — теперь внутри карточки КАЖДОГО лифта (выше). */}

                </div>
                );
              })())}
              {/* 📌 Свои прикиды → В ПЛАН: печать/экспорт/сохранение видят те же веса,
                  что показывает карточка (аудит P1: оверрайд жил только в UI). */}
              {Object.keys(taperAttemptOverride).length > 0 && (
                <button
                  onClick={() => {
                    const applyOverrides = (out: LMSBuildOutput): LMSBuildOutput => ({
                      ...out,
                      weeks: out.weeks.map(w => {
                        if (!w.meetAttempts) return w;
                        if (w.meetAttempts.lifts.every(l => !taperAttemptOverride[l.name])) return w;
                        return { ...w, meetAttempts: { ...w.meetAttempts, lifts: w.meetAttempts.lifts.map(l => {
                          const ov = taperAttemptOverride[l.name];
                          if (!ov) return l;
                          const [o, s2, t2] = ov.map(v => Math.round(v * 10) / 10);
                          return { ...l, opener: o, second: s2, third: t2, target: t2 };
                        }) } };
                      }),
                    });
                    if (builtSrc) setBuiltSrc(applyOverrides(builtSrc));
                    if (taperPlan) setTaperPlan(applyOverrides(taperPlan));
                    onNote('📌 Свои прикиды внесены в план — печать, экспорт и сохранение увидят те же веса.');
                  }}
                  style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}
                  title="Записать введённые веса попыток в недели плана (прикиды в таблице/печати/экспорте совпадут с показанными)"
                >📌 Внести свои прикиды в план</button>
              )}
              {/* Последние тяжёлые */}
              <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.5 }}>
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
                    <span style={{ color: '#fff' }}>{d}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {[['🧠 Психо', 'визуализация успешного подхода + ключевое слово за 2 подхода до выхода'], ['🌬 Дыхание', 'квадрат: 4с вдох — 4с пауза — 4с выдох — 4с пауза'], ['💪 Активация', 'лёгкая разминка + целевая мобилизация'], ['🍽 Питание', 'углеводы+BCAA после взвешивания, перекус за 1.5ч'], ['❄ Восстановление', 'массаж/ролл между дисциплинами, крио-пакет при необходимости']].map(([l, d], i) => (
                    <span key={i} title={d} style={{ padding: '3px 8px', borderRadius: 7, fontSize: 9, fontWeight: 700, background: 'rgba(234,179,8,0.08)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.2)', cursor: 'default' }}>{l}</span>
                  ))}
                </div>
                {/* 9 попыток = 9 возможностей: промах не «сгоревшая» попытка */}
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 9, color: '#fbbf24', lineHeight: 1.45 }}>
                  🎯 <b>Мимо третьей попытки?</b> Повторите ТОТ ЖЕ вес (не снижайте и не завышайте) — сознательно снятая попытка обнуляет шанс на рекорд (тренерская практика IPF/PTW: «9 попыток = 9 возможностей»). Между попытками — дыхание и активация, не новый разминочный подход.
                </div>
              </div>
              {/* Действия */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => {
                  if (!builtSrc || !taperPlan) return;
                  try {
                    sessionStorage.setItem(TAPER_PREV_KEY, JSON.stringify({
                      fingerprint: planFingerprint(builtSrc),
                      weeks: builtSrc.weeks,
                      cycleMetrics: builtSrc.cycleMetrics,
                      plVolumeLandmarks: builtSrc.plVolumeLandmarks,
                      progressionRationale: builtSrc.progressionRationale,
                    }));
                  } catch { /* ignore */ }
                  setTaperEmbedded(true);
                  setBuiltSrc(taperPlan);
                  embeddedPlanRef.current = taperPlan;
                  // Число добавленных недель — ИЗ ФАКТА плана (включая «вход в пик»),
                  // а не из суммы переключателей: раньше заметка говорила «+5 нед»,
                  // когда движок дописывал 9.
                  setTaperNote(`Встроено в weeks цикла: +${Math.max(0, taperPlan.weeks.length - (builtSrc.weeks.length ?? 0))} нед тапера`);
                }} style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }} title="Встроить тапер-недели в weeks активного плана (календарь покажет с тапером)">📌 Встроить в план (weeks)</button>
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
                  onClick={handlePrintTaperPlan}
                  style={{ ...BTN_GHOST, minHeight: 38, fontSize: 10, border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', background: 'rgba(96,165,250,0.08)' }}
                  title="Печать тапер-плана: прикиды по неделям, объём/интенсивность, даты и данные к соревнованиям"
                >🖨 Печать тапер-плана</button>
              </div>
            </div>
          );
        })()}
      />
      {/* 💾 Фаза 6, п.8: бэкап/восстановление PL-сессии (всё живёт в localStorage) */}
      <ExpandableCard
        icon="💾"
        title="💾 Бэкап PL-сессии"
        short="Сессия, макро-цикл, тапер, факты попыток и сохранённые планы живут только в localStorage. Скачайте бэкап перед чисткой данных или переносом на другое устройство."
        full={
          <div data-pl="pl-backup">
            <button
              type="button"
              data-pl="pl-backup-download"
              onClick={() => {
                const backup = collectPLBackup(localStorage);
                if (!backup) { setBackupLog(['⚠ Нет PL-данных для бэкапа — сначала соберите план/сезон.']); return; }
                const keysCount = Object.keys(backup.keys).length;
                void saveTextFileApk(`pl-backup-${localIsoDateOffset(0)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
                  .then(out => setBackupLog(out === 'failed'
                    ? ['⚠ Не удалось сохранить файл бэкапа.']
                    : [`✔ Бэкап: ${keysCount} ключ(ей) — ${Object.keys(backup.keys).map(k => PL_BACKUP_KEY_LABEL[k as keyof typeof PL_BACKUP_KEY_LABEL] ?? k).join(', ')}`]))
                  .catch(e => setBackupLog([`⚠ Ошибка бэкапа: ${(e as Error).message}`]));
              }}
              style={{ ...BTN_GHOST, minHeight: 34, fontSize: 10, padding: '5px 10px', background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.35)' }}
            >⬇ Скачать бэкап</button>
            <div style={{ fontSize: 9, color: '#fff', opacity: 0.75, margin: '8px 0 4px', lineHeight: 1.45 }}>
              Восстановление: вставьте JSON файла бэкапа ниже. Пишутся только ключи PL-сессии — чужие ключи игнорируются.
            </div>
            <textarea
              value={backupText}
              onChange={e => setBackupText(e.target.value)}
              aria-label="JSON бэкапа PL"
              placeholder='{"app":"bodybuildhealth","kind":"pl-backup",...}'
              style={{ width: '100%', minHeight: 72, padding: 6, borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 10, fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              data-pl="pl-backup-restore"
              onClick={() => {
                const parsed = parsePLBackup(backupText);
                if (parsed.error || !parsed.backup) { setBackupLog([`⛔ ${parsed.error ?? 'не удалось разобрать бэкап'}`]); return; }
                const res = restorePLBackup(parsed.backup, localStorage);
                const lines = [
                  ...res.restored.map(k => `✔ ${PL_BACKUP_KEY_LABEL[k as keyof typeof PL_BACKUP_KEY_LABEL] ?? k}`),
                  ...res.skipped.map(k => `⚠ пропущено: ${k}`),
                  ...(res.error ? [`⚠ ${res.error}`] : []),
                  '♻️ Перезагрузите экран, чтобы приложение подхватило восстановленные данные.',
                ];
                setBackupLog(lines);
                onNote(`♻️ Восстановлено ключей: ${res.restored.length}${res.skipped.length ? `, пропущено: ${res.skipped.length}` : ''}.`);
              }}
              style={{ ...BTN_GHOST, minHeight: 34, fontSize: 10, padding: '5px 10px', marginTop: 6, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >♻️ Восстановить</button>
            {backupLog.length > 0 && (
              <div data-pl="pl-backup-log" style={{ marginTop: 6, fontSize: 9, color: '#fff', opacity: 0.9, lineHeight: 1.45 }}>
                {backupLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
          </div>
        }
      />
    </BbCard>
  );
};

export default PLCompetitionTab;
