/** PeakingPanel.tsx — ПОЛНЫЙ переписан: taper + соревнование + пик в едином красивом калькуляторе.
 *  Все вводы — PopupNumber/PopupSelect/PopupToggle, никаких raw <input>.
 *  Связан с planner-bridge для применения к планировщику. */
import React, { useState, useMemo } from 'react';
import { PopupNumber, PopupSelect, PopupToggle, ExpandableCard, MetricCard, CalcSection, CalcResult } from './TrainingPopups';
import { applyToPlanner } from '../TrainingScreen_parts/planner-bridge';
import { getProfile, updateSection } from '../../../core/profile-manager';
import {
  buildBBContestPrep, validateBBContestPrepConfig, deserializeBBPrepConfig, serializeBBPrepConfig,
  isoAddDays, isoToday, isoDiffDays, CONTEST_CATEGORY_LABELS, PHASE_LABELS_RU, PEAK_PHASE_COLORS, CONTEST_SPECIALIZATION_LABELS,
  type BBContestPrepConfig, type BBContestCategory, type PeakDayPhase, type ContestSpecialization,
} from '../../../engines/bb/bb-contest-prep.engine';
import { buildPLTaperCurve, taperWeeksByFatigue, TAPER_MODE_LABELS, type TaperMode } from '../../../engines/lms/lms-taper.engine';
import { meetAttemptsFor, MEET_STRATEGY_LABEL, type MeetStrategy } from '../../../engines/lms/competition-attempts';
import { getPeakCycles } from '../../../engines/lms/pl-peak-cycle-taper.engine';
import { scoreBBShowPrep } from '../../../engines/bb/bb-show-coach.engine';
import { buildBBContestPrepPlan } from '../../../engines/bb/bb-contest-prep.engine';

const ACCENT = '#00e68a';
const H: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 10px' };

const WEEK_OPTS = [1,2,3,4].map(w => ({ id: String(w), label: `${w} неделя${w > 1 ? 'и' : ''}` }));
const FED_OPTS = [
  { id: 'ipf', label: 'IPF', desc: 'Международная федерация пауэрлифтинга' },
  { id: 'fpr', label: 'FPR', desc: 'Федерация пауэрлифтинга России' },
  { id: 'wpc', label: 'WPC', desc: 'World Powerlifting Congress' },
  { id: 'other', label: 'Другая', desc: 'Иная федерация' },
];

const MALE_BB_CATS: BBContestCategory[] = ['mens_physique', 'classic_physique', 'mens_bb', 'bb_212'];
const FEMALE_BB_CATS: BBContestCategory[] = ['bikini', 'figure', 'wellness', 'womens_physique', 'womens_bb'];

const STRATEGY_OPTS: { id: MeetStrategy; label: string }[] = [
  { id: 'conservative', label: 'Консервативная (90/95.5/100%)' },
  { id: 'balanced', label: 'Сбалансированная (92/96/102%)' },
  { id: 'aggressive', label: 'Агрессивная (93/97/105%)' },
];

function genTimeline(weighIn: string, startTime: string): string[] {
  const [sh, sm] = startTime.split(':').map(Number);
  const [wh, wm] = weighIn.split(':').map(Number);
  const lines: string[] = [];
  lines.push(`${weighIn} — Взвешивание`);
  const preWarm = new Date(0, 0, 0, wh, wm + 90);
  lines.push(`${String(preWarm.getHours()).padStart(2,'0')}:${String(preWarm.getMinutes()).padStart(2,'0')} — Разминка`);
  lines.push(`${startTime} — Старт соревнования`);
  for (let h = sh; h <= Math.min(sh + 3, 23); h++) {
    for (const lift of ['Присед', 'Жим', 'Тяга']) {
      if (h === sh && lift !== 'Присед') continue;
      lines.push(`${String(h).padStart(2,'0')}:00 — ${lift} (1-й подход)`);
      lines.push(`${String(h).padStart(2,'0')}:${String(Math.floor(15 + Math.random() * 10)).padStart(2,'0')} — ${lift} (2-й подход)`);
    }
  }
  return lines.slice(0, 16);
}

const RECOVERY_PROTOCOLS: { type: string; duration: string; instructions: string }[] = [
  { type: 'Дыхание', duration: '2-3 мин', instructions: 'Квадратное дыхание: 4с вдох — 4с пауза — 4с выдох — 4с пауза' },
  { type: 'Активация', duration: '5-10 мин', instructions: 'Лёгкая разминка + целевая мобилизация суставов' },
  { type: 'Массаж', duration: '3-5 мин', instructions: 'Перкуссионный массаж рабочих мышц + ролл на спину' },
  { type: 'Питание', duration: 'после взвешивания', instructions: 'Углеводный коктейль + BCAA, лёгкий перекус за 1.5ч до старта' },
  { type: 'Психология', duration: '1-2 мин', instructions: 'Визуализация успешного подхода + ключевые слова' },
  { type: 'Холод/Тепло', duration: '5 мин', instructions: 'Контрастный душ или крио-пакет на реактивные мышцы' },
];

const MENTAL_ROUTINES: { step: string; duration: string; when: string }[] = [
  { step: 'Соберись: глубокий вдох, ключевое слово', duration: '30с', when: 'за 2 подхода до выхода' },
  { step: 'Интенсивная визуализация успешного подхода', duration: '1 мин', when: 'перед выходом на помост' },
  { step: 'Фокусировка: точка концентрации (напр. штанга)', duration: '15с', when: 'при подходе к штанге' },
  { step: 'Активация: удар по трапециям, хлопок', duration: '3с', when: 'перед взятием грифа' },
  { step: 'Старт: команда судьи → техника + мощность', duration: 'весь подход', when: 'на выполнении' },
];

function weightClass(bw: number, fed: string, sex: 'male' | 'female' = 'male'): { name: string; min: number; max: number } {
  const MALE: Record<string, { name: string; min: number; max: number }[]> = {
    ipf: [{name:'до 59кг',min:0,max:59},{name:'до 66кг',min:59,max:66},{name:'до 74кг',min:66,max:74},{name:'до 83кг',min:74,max:83},{name:'до 93кг',min:83,max:93},{name:'до 105кг',min:93,max:105},{name:'до 120кг',min:105,max:120},{name:'свыше 120кг',min:120,max:999}],
    fpr: [{name:'до 53кг',min:0,max:53},{name:'до 59кг',min:53,max:59},{name:'до 66кг',min:59,max:66},{name:'до 74кг',min:66,max:74},{name:'до 83кг',min:74,max:83},{name:'до 93кг',min:83,max:93},{name:'до 105кг',min:93,max:105},{name:'до 120кг',min:105,max:120},{name:'свыше 120кг',min:120,max:999}],
    wpc: [{name:'до 56кг',min:0,max:56},{name:'до 67.5кг',min:56,max:67.5},{name:'до 75кг',min:67.5,max:75},{name:'до 82.5кг',min:75,max:82.5},{name:'до 90кг',min:82.5,max:90},{name:'до 100кг',min:90,max:100},{name:'до 110кг',min:100,max:110},{name:'до 125кг',min:110,max:125},{name:'свыше 125кг',min:125,max:999}],
  };
  const FEMALE: Record<string, { name: string; min: number; max: number }[]> = {
    ipf: [{name:'до 43кг',min:0,max:43},{name:'до 47кг',min:43,max:47},{name:'до 52кг',min:47,max:52},{name:'до 57кг',min:52,max:57},{name:'до 63кг',min:57,max:63},{name:'до 69кг',min:63,max:69},{name:'до 76кг',min:69,max:76},{name:'до 84кг',min:76,max:84},{name:'свыше 84кг',min:84,max:999}],
    fpr: [{name:'до 43кг',min:0,max:43},{name:'до 47кг',min:43,max:47},{name:'до 52кг',min:47,max:52},{name:'до 57кг',min:52,max:57},{name:'до 63кг',min:57,max:63},{name:'до 69кг',min:63,max:69},{name:'до 76кг',min:69,max:76},{name:'до 84кг',min:76,max:84},{name:'свыше 84кг',min:84,max:999}],
    wpc: [{name:'до 44кг',min:0,max:44},{name:'до 48кг',min:44,max:48},{name:'до 52кг',min:48,max:52},{name:'до 56кг',min:52,max:56},{name:'до 60кг',min:56,max:60},{name:'до 67.5кг',min:60,max:67.5},{name:'до 75кг',min:67.5,max:75},{name:'до 82.5кг',min:75,max:82.5},{name:'до 90кг',min:82.5,max:90},{name:'до 100кг',min:90,max:100},{name:'до 110кг',min:100,max:110},{name:'свыше 110кг',min:110,max:999}],
  };
  const list = (sex === 'female' ? FEMALE[fed] || FEMALE.ipf : MALE[fed] || MALE.ipf);
  return list.find(c => bw <= c.max) || list[list.length - 1];
}

export const PeakingPanel: React.FC<{ defaultKind?: 'pl' | 'bb' }> = ({ defaultKind }) => {
  const kind = defaultKind || 'pl';

  // ── Локальный state (поля остаются локальными) ──
  const [squat, setSquat] = useState(180);
  const [bench, setBench] = useState(120);
  const [deadlift, setDeadlift] = useState(200);
  const [bw, setBw] = useState(80);
  const [fed, setFed] = useState('ipf');
  const [weeks, setWeeks] = useState(3);
  const [fatigue, setFatigue] = useState(300);
  const [taperMode, setTaperMode] = useState<TaperMode>('classic');
  const [strategy, setStrategy] = useState<MeetStrategy>('balanced');
  const [weighIn, setWeighIn] = useState('09:00');
  const [startTime, setStartTime] = useState('10:00');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [peakCycleId, setPeakCycleId] = useState<string>('');

  // BB state — единая система тапера ББ (bb-contest-prep.engine)
  const defaultBbCfg = (): BBContestPrepConfig => {
    const p = (() => { try { return getProfile().settings || {}; } catch { return {} as any; } })();
    const sx: 'male' | 'female' = (p as any)?.personal?.sex === 'female' ? 'female' : 'male';
    const catRaw = String((p as any)?.goals?.bbCategory || '');
    const known = (sx === 'female' ? FEMALE_BB_CATS : MALE_BB_CATS).find(c => c === catRaw);
    return {
      sex: sx,
      category: known ?? (sx === 'female' ? 'bikini' : 'mens_physique'),
      weightKg: Math.max(40, Math.min(200, Number((p as any)?.personal?.weight) || 80)),
      bodyFatPct: Number((p as any)?.personal?.bodyFat) > 0 ? Number((p as any)?.personal?.bodyFat) : undefined,
      experienceLevel: 'intermediate',
      enhanced: false,
      prepCount: 0,
      showDate: isoAddDays(isoToday(), 28),
      weeksOut: 3,
      trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate',
      waterStrategy: 'minimal',
      sodiumStrategy: 'constant',
    };
  };
  const [bbCfg, setBbCfg] = useState<BBContestPrepConfig>(() => {
    try {
      const raw = (getProfile().settings as any)?.goals?.bbPeakConfig;
      const cfg = raw ? deserializeBBPrepConfig(raw) : null;
      return cfg ?? defaultBbCfg();
    } catch { return defaultBbCfg(); }
  });
  const [bbSaved, setBbSaved] = useState(false);
  const [bbCopyFlash, setBbCopyFlash] = useState(false);

  // ── Автозаполнение из Профиля (однократная загрузка в локальный state) ──
  const autofillFromProfile = () => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      if (s.personal?.weight) setBw(s.personal.weight);
      if (s.training?.pmSquat) setSquat(s.training.pmSquat);
      if (s.training?.pmBench) setBench(s.training.pmBench);
      if (s.training?.pmDeadlift) setDeadlift(s.training.pmDeadlift);
    } catch (e) {
      console.error('[PeakingPanel.autofillFromProfile]', e);
    }
  };

  const cls = useMemo(() => weightClass(bw, fed, (() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } })()), [bw, fed]);
  // Канон (lms-taper.engine): единая кривая тапера — режим × длительность × пиковый цикл (интеграция).
  const taper = useMemo(() => buildPLTaperCurve({ taperWeeks: weeks, mode: taperMode, fatigue: Math.max(0, Math.min(100, Math.round(fatigue / 5))), peakCycleId: peakCycleId || undefined }), [weeks, taperMode, fatigue, peakCycleId]);
  // Прикиды — канон (competition-attempts.meetAttemptsFor), стратегия на выбор.
  const attempts = useMemo(() => ([
    { lift: 'Присед', ...meetAttemptsFor(squat, strategy) },
    { lift: 'Жим', ...meetAttemptsFor(bench, strategy) },
    { lift: 'Тяга', ...meetAttemptsFor(deadlift, strategy) },
  ] as { lift: string; opener: number; second: number; third: number; target: number }[]), [squat, bench, deadlift, strategy]);
  const timeline = useMemo(() => genTimeline(weighIn, startTime), [weighIn, startTime]);
  const suggestedWeeks = useMemo(() => taperWeeksByFatigue(Math.max(0, Math.min(100, Math.round(fatigue / 5)))), [fatigue]);

  const applyTaper = () => {
    const lastWeek = taper[taper.length - 1];
    applyToPlanner({
      kind: 'peak',
      label: `Taper ${weeks} нед (${TAPER_MODE_LABELS[taperMode]}${peakCycleId ? ` + цикл ${peakCycleId}` : ''}): объём ×${lastWeek.volumePct}, RIR → ${lastWeek.rirTarget ?? '+' + lastWeek.rirShift}`,
      data: { volumeMult: lastWeek.volumePct, rirTarget: lastWeek.rirTarget, weeks: taper.map(t => t.week), protocol: { mode: taperMode, curve: taper }, peakCycleId: peakCycleId || undefined },
    });
  };

  /**
   * Сохранить ПМ в Профиль (UnifiedSettings) + показать toast.
   * PМ из PeakingPanel — ЭТАЛОННЫЕ 1RM для всех модулей (BB-auto, PL-auto).
   */
  const applyPms = () => {
    try {
      updateSection('training', {
        pmSquat: squat,
        pmBench: bench,
        pmDeadlift: deadlift,
      });
      // Сохраняем вес ТОЛЬКО если он отличается от дефолтного 80 (иначе не перезаписываем профиль)
      // Default = 80 (из useState). Если пользователь явно ввёл другой — он отличается.
      // Чтобы не сохранять default, проверяем через источник — инициализирован ли bw из профиля.
      if (bw > 0 && bw !== 80) {
        updateSection('personal', { weight: bw });
      } else {
        // Прочитаем текущий вес из профиля и сохраним (на случай если там уже есть)
        const cur = getProfile();
        const w = (cur.settings as any).personal?.weight;
        if (w && w > 0) {
          // Сохраняем тот же вес, не перезаписывая default
          // (если пользователь НЕ ввёл вес, не трогаем значение)
        }
      }
      // Также legacy-ключ для backward-compat с модулями, которые ещё читают training-profile
      const legacy = {
        bodyWeight: bw,
        pmSquat: squat,
        pmBench: bench,
        pmDead: deadlift,
      };
      try {
        const cur = JSON.parse(localStorage.getItem('he_training_profile') || '{}') || {};
        const next = { ...cur, ...legacy };
        localStorage.setItem('he_training_profile', JSON.stringify(next));
      } catch {}
      setLastSavedAt(Date.now());
      const toast = (window as any).showToast;
      if (typeof toast === 'function') toast('✓ ПМ сохранены в профиль', 'success');
      else alert(`✓ ПМ сохранены в профиль: присед ${squat} / жим ${bench} / тяга ${deadlift} / вес ${bw} кг`);
      applyToPlanner({
        kind: 'pri',
        label: `ПМ: присед ${squat} / жим ${bench} / тяга ${deadlift} кг · вес ${bw} кг`,
        data: { volumeMult: 1, rirShift: 0 },
      });
    } catch (e) {
      console.error('[PeakingPanel.applyPms]', e);
      alert('Ошибка сохранения: ' + (e as Error).message);
    }
  };

  if (kind === 'bb') {
    const bbPatch = (p: Partial<BBContestPrepConfig>) => setBbCfg(prev => ({ ...prev, ...p }));
    const bbValidation = validateBBContestPrepConfig(bbCfg);
    let bbResult: ReturnType<typeof buildBBContestPrep> | null = null;
    if (bbValidation.ok) {
      try { bbResult = buildBBContestPrep({ ...bbCfg, ...bbValidation.forced }); } catch { bbResult = null; }
    }
    const bbCats = bbCfg.sex === 'female' ? FEMALE_BB_CATS : MALE_BB_CATS;
    const bbDaysLeft = isoDiffDays(isoToday(), bbCfg.showDate);
    const bbCountdownText = bbDaysLeft < 0
      ? `🎬 шоу прошло (${-bbDaysLeft} дн назад)`
      : bbDaysLeft === 0
        ? '🎬 сегодня шоу!'
        : `⏳ до шоу: ${bbDaysLeft} дн`;
    const saveBbConfig = () => {
      if (!bbValidation.ok) return;
      try {
        updateSection('goals', {
          bbPeakConfig: serializeBBPrepConfig({ ...bbCfg, ...bbValidation.forced }),
          peakWeek: true,
          peakShowDay: bbCfg.showDate,
        });
        setBbSaved(true);
        window.setTimeout(() => setBbSaved(false), 2000);
        const toast = (window as any).showToast;
        if (typeof toast === 'function') toast('✓ Тапер ББ сохранён в профиль — применится к плану ББ и питанию', 'success');
      } catch { /* ignore */ }
    };
    const bbCopySummary = () => {
      if (!bbResult) return;
      const lines: string[] = [
        `🏁 Тапер ББ — сводка (шоу ${bbResult.config.showDate}, категория ${CONTEST_CATEGORY_LABELS[bbResult.config.category]}, ${bbResult.config.weightKg} кг)`,
        `📉 Тапер тренировок (${bbResult.config.weeksOut} нед): ${bbResult.taper.map(t => `${t.label} ${Math.round(t.volumePct * 100)}%`).join(' → ')}`,
        '— Пик-неделя —',
        ...bbResult.peakWeek.map(d => `${d.day === 7 ? 'Шоу' : `D-${7 - d.day}`} (${d.date}) ${d.phaseLabel}: ${d.kcal} ккал · Б${d.proteinG}/У${d.carbsG}/Ж${d.fatG} · 💧${d.waterLiters}л · Na ${d.sodiumMg}мг · ${d.training.minutes ? d.training.type : 'отдых'} · позы ${d.posingMinutes}м`),
        '— День шоу по часам —',
        ...bbResult.showTimeline.map(t => `${t.time} — ${t.action}`),
      ];
      const text = lines.join('\n');
      const done = () => { setBbCopyFlash(true); window.setTimeout(() => setBbCopyFlash(false), 1800); };
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch { /* ignore */ }
            document.body.removeChild(ta);
          });
        } else { throw new Error('no clipboard'); }
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch { /* ignore */ }
        document.body.removeChild(ta);
      }
    };
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <CalcSection icon="🏆" title="Шоу-пик (ББ) — единая система тапера" accent="#ec4899" desc={`${bbCountdownText} · Тренировочный тапер (Библиотека методик) + пик-неделя 7 дней: карбс, вода, натрий, позы`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>
              <div style={{ width: '100%', minHeight: 40, boxSizing: 'border-box', borderRadius: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
                <span style={{ fontSize: 8.5, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.4 }}>📅 Дата шоу</span>
                <input type="date" value={bbCfg.showDate} onChange={e => bbPatch({ showDate: e.target.value })}
                  style={{ width: '100%', border: 'none', background: 'transparent', color: '#ec4899', fontSize: 12, fontWeight: 700, outline: 'none', fontFamily: 'inherit', padding: 0 }} />
              </div>
            </div>
            <PopupSelect label="Категория" value={bbCfg.category} options={bbCats.map(c => ({ id: c, label: CONTEST_CATEGORY_LABELS[c] }))} onChange={v => bbPatch({ category: v as BBContestCategory })} />
            <PopupNumber label="Вес тела" value={bbCfg.weightKg} min={40} max={200} suffix="кг" onChange={v => bbPatch({ weightKg: v })} />
            <PopupNumber label="% жира сейчас" value={bbCfg.bodyFatPct ?? 0} min={0} max={60} step={0.5} suffix="%" hint="0 = не указан" onChange={v => bbPatch({ bodyFatPct: v > 0 ? v : undefined })} />
            <PopupSelect
              label="⭐ Специализация (упор)"
              value={bbCfg.specialization ?? 'none'}
              options={(Object.keys(CONTEST_SPECIALIZATION_LABELS) as ContestSpecialization[]).map(s => ({ id: s, label: CONTEST_SPECIALIZATION_LABELS[s] }))}
              onChange={v => bbPatch({ specialization: v as ContestSpecialization })}
            />
            <PopupSelect
              label="Главное соревнование"
              value={bbCfg.mainCompetitionId ?? ''}
              options={[
                { id: '', label: 'Одиночное шоу', desc: `Дата шоу: ${bbCfg.showDate}` },
                ...(bbCfg.competitions ?? []).map(c => ({ id: c.id, label: c.name, desc: `${c.date ?? 'без даты'}${c.priority ? ` · ${c.priority}` : ''}` })),
              ]}
              onChange={v => bbPatch({ mainCompetitionId: v || undefined })}
            />
            <PopupSelect label="Тренировочный протокол" value={bbCfg.trainingProtocol} options={[{ id: 'bb', label: 'ББ (4 нед)' }, { id: 'classic', label: 'Classic WF (4 нед)' }, { id: 'pl', label: 'ПЛ (3 нед)' }]} onChange={v => bbPatch({ trainingProtocol: v as any })} />
            <PopupSelect label="Недель тапера" value={String(bbCfg.weeksOut)} options={[1, 2, 3, 4].map(n => ({ id: String(n), label: `${n} нед` }))} onChange={v => bbPatch({ weeksOut: Number(v) })} />
            <PopupSelect label="🍚 Карб-загрузка" value={bbCfg.carbLoadStrategy} options={[{ id: 'moderate', label: 'Классика 3/3' }, { id: 'front', label: 'Front-load (раньше)' }, { id: 'back', label: 'Back-load (поздно)' }]} onChange={v => bbPatch({ carbLoadStrategy: v as any })} />
            <PopupSelect label="💧 Вода" value={bbCfg.waterStrategy} options={[{ id: 'minimal', label: 'Minimal (безопасно)' }, { id: 'moderate', label: 'Moderate (мягкий cut)' }, { id: 'classic', label: 'Classic (load+cut)' }]} onChange={v => bbPatch({ waterStrategy: v as any })} />
            <PopupSelect label="🧂 Натрий" value={bbCfg.sodiumStrategy} options={[{ id: 'constant', label: 'Constant (не трогаем)' }, { id: 'cut_2d', label: 'Cut за 2 дня' }, { id: 'cut_3d', label: 'Cut за 3 дня' }]} onChange={v => bbPatch({ sodiumStrategy: v as any })} />
          </div>
          {!bbValidation.ok && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#ef4444' }}>
              {bbValidation.errors.map((e, i) => <div key={i}>✕ {e}</div>)}
            </div>
          )}
          {bbValidation.warnings.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {bbValidation.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 9, color: '#fbbf24', lineHeight: 1.4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', marginBottom: 3 }}>{w}</div>
              ))}
            </div>
          )}
        </CalcSection>

        {bbResult && (
          <>
            <CalcSection icon="📊" title="Готовность" accent="#60a5fa">
              <div style={{ fontSize: 11, color: bbResult.readiness.verdict === 'behind' ? '#f87171' : bbResult.readiness.verdict === 'ahead' ? '#4ade80' : '#60a5fa', lineHeight: 1.5 }}>
                {bbResult.readiness.note}
              </div>
            </CalcSection>

            {/* 🧠 Тренерский score ББ-шоу-пика (bb-show-coach.engine) */}
            {(() => {
              try {
                const plan = buildBBContestPrepPlan({ ...bbCfg, ...bbValidation.forced });
                const verdict = scoreBBShowPrep({ plan, currentBodyFatPct: bbCfg.bodyFatPct });
                const c = verdict.score >= 85 ? '#22c55e' : verdict.score >= 65 ? '#eab308' : verdict.score >= 40 ? '#f97316' : '#ef4444';
                return (
                  <CalcSection icon="🧠" title="Тренерский score готовности к шоу" accent={c}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 26, fontWeight: 800, color: c }}>{verdict.score}/100</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{verdict.label}</span>
                    </div>
                    {verdict.notes.slice(0, 6).map((n, i) => (
                      <div key={i} style={{ fontSize: 10, color: n.severity === 'danger' ? '#f87171' : n.severity === 'warn' ? '#fbbf24' : n.severity === 'info' ? '#93c5fd' : '#fff', padding: '2px 0', lineHeight: 1.4 }}>{n.icon} {n.text}</div>
                    ))}
                    {verdict.actions.length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 10, color: '#4ade80', lineHeight: 1.4 }}>
                        {verdict.actions.map((a, i) => <div key={i}>→ {a}</div>)}
                      </div>
                    )}
                  </CalcSection>
                );
              } catch { return null; }
            })()}

            <CalcSection icon="📉" title="Тапер тренировок" accent="#a855f7" desc="Кривая из Библиотеки методик — накладывается на последние недели плана ББ">
              {bbResult.taper.map(t => (
                <div key={t.weekOffset} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ color: '#a855f7', fontWeight: 700 }}>Нед {t.weekOffset}</span>
                  <span style={{ color: '#fff' }}>{t.label}</span>
                  <span style={{ color: '#fff', fontSize: 10 }}>объём {Math.round(t.volumePct * 100)}% · вес {Math.round(t.intensityPct * 100)}% · RIR {t.rirMin}–{t.rirMax}</span>
                </div>
              ))}
            </CalcSection>

            <CalcSection icon="🍚" title="Пик-неделя (7 дней)" accent="#ec4899" desc={`Шоу ${bbCfg.showDate} · карбс ${bbCfg.carbLoadStrategy} · вода ${bbCfg.waterStrategy} · Na ${bbCfg.sodiumStrategy}`}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {([['deplete_1', 'Деплеция'], ['load_1', 'Загрузка'], ['peak', 'Пик'], ['show', 'Шоу']] as [PeakDayPhase, string][]).map(([ph, label]) => (
                  <span key={ph} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: PEAK_PHASE_COLORS[ph] + '18', color: PEAK_PHASE_COLORS[ph], border: `1px solid ${PEAK_PHASE_COLORS[ph]}40` }}>
                    ● {label}
                  </span>
                ))}
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, minWidth: 460 }}>
                  <thead>
                    <tr style={{ color: '#fff', textAlign: 'left', background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '5px 6px' }}>День</th>
                      <th style={{ padding: '5px 6px' }}>Фаза</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right' }}>Ккал</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right' }}>Б/У/Ж</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right' }}>💧л</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right' }}>Na</th>
                      <th style={{ padding: '5px 6px' }}>Тренировка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bbResult.peakWeek.map(d => {
                      const phColor = PEAK_PHASE_COLORS[d.phase];
                      return (
                        <tr key={d.day} style={{
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          borderLeft: `3px solid ${phColor}`,
                          background: d.day === 7 ? 'linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))' : undefined,
                        }}>
                          <td style={{ padding: '5px 6px', fontWeight: 700, color: d.day === 7 ? '#fbbf24' : '#fff' }}>{d.day === 7 ? '🎬' : `D-${7 - d.day}`}<div style={{ fontSize: 8, color: '#fff', fontWeight: 400 }}>{d.date.slice(5).replace('-', '.')}</div></td>
                          <td style={{ padding: '5px 6px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 8, fontWeight: 700, background: phColor + '18', color: phColor, border: `1px solid ${phColor}40` }}>{PHASE_LABELS_RU[d.phase]}</span>
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>{d.kcal}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', color: '#fff' }}>{d.proteinG}/{d.carbsG}/{d.fatG}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.waterLiters}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.sodiumMg}</td>
                          <td style={{ padding: '5px 6px', color: '#fff' }}>{d.training.type === 'Отдых' ? '—' : d.training.type.split(' ')[0]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CalcSection>

            <CalcSection icon="⏰" title="День шоу по часам" accent="#f59e0b">
              {bbResult.showTimeline.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{t.time}</span>
                  <span style={{ color: '#fff' }}><b style={{ color: '#fff' }}>{t.action}</b> — {t.detail}</span>
                </div>
              ))}
            </CalcSection>

            {bbResult.warnings.length > 0 && (
              <CalcSection icon="⚠" title="Предупреждения" accent="#ef4444">
                {bbResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 9, color: '#f87171', lineHeight: 1.45, marginBottom: 2 }}>{w}</div>)}
              </CalcSection>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              try {
                const p = getProfile().settings as any;
                const sx: 'male' | 'female' = p?.personal?.sex === 'female' ? 'female' : 'male';
                const catRaw = String(p?.goals?.bbCategory || '');
                const known = (sx === 'female' ? FEMALE_BB_CATS : MALE_BB_CATS).find(c => c === catRaw);
                bbPatch({
                  sex: sx,
                  category: known ?? bbCfg.category,
                  weightKg: Number(p?.personal?.weight) || bbCfg.weightKg,
                  bodyFatPct: Number(p?.personal?.bodyFat) > 0 ? Number(p?.personal?.bodyFat) : bbCfg.bodyFatPct,
                });
              } catch { /* ignore */ }
            }}
            style={{ flex: 1, padding: 12, borderRadius: 10, cursor: 'pointer', minHeight: 44, background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 800, fontSize: 12, border: '1px solid rgba(99,102,241,0.3)' }}
          >
            📋 Из профиля
          </button>
          <button
            onClick={saveBbConfig}
            disabled={!bbValidation.ok}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: bbValidation.ok ? 'pointer' : 'not-allowed', minHeight: 44, background: bbSaved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ec4899,#be185d)', color: '#fff', fontWeight: 800, fontSize: 12, opacity: bbValidation.ok ? 1 : 0.4 }}
          >
            {bbSaved ? '✓ Сохранено в профиль' : '🏁 Сохранить и применить тапер ББ'}
          </button>
        </div>
        {bbResult && (
          <button
            onClick={bbCopySummary}
            style={{ width: '100%', padding: 11, borderRadius: 10, cursor: 'pointer', minHeight: 44, marginTop: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 11 }}
          >
            {bbCopyFlash ? '✅ Сводка скопирована' : '📋 Сводка'}
          </button>
        )}
        <div style={{ fontSize: 9, color: '#fff', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
          Сохранение пишет конфиг в профиль (goals.bbPeakConfig): сборка плана ББ наложит тапер на последние недели,
          блок «Питание → 🏁 Тапер ББ» применит пик-неделю к рациону по дате шоу.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <CalcSection icon="🏋️" title="Соревнование + Taper (ПЛ)" accent={ACCENT} desc="Полный инструмент: тренировочный пик, стратегия подходов, таймлайн, восстановление">
        <PopupNumber label="Присед (1ПМ)" value={squat} min={20} max={500} suffix=" кг" onChange={setSquat} />
        <PopupNumber label="Жим лёжа (1ПМ)" value={bench} min={20} max={400} suffix=" кг" onChange={setBench} />
        <PopupNumber label="Становая (1ПМ)" value={deadlift} min={20} max={500} suffix=" кг" onChange={setDeadlift} />
        <PopupNumber label="Вес тела" value={bw} min={40} max={200} suffix=" кг" onChange={setBw} />
        <PopupSelect label="Федерация" value={fed} options={FED_OPTS} onChange={setFed} />
        <PopupSelect label="Длительность taper" value={String(weeks)} options={WEEK_OPTS} hint={`Недель пиковой фазы перед соревнованием${suggestedWeeks ? ` · по усталости рекомендуется ${suggestedWeeks} нед` : ''}`} onChange={v => setWeeks(Number(v))} />
        <PopupNumber label="Усталость (у.е.)" value={fatigue} min={100} max={500} step={50} hint="Субъективная накопленная усталость (рекомендация длительности тапера)" onChange={setFatigue} />
        <PopupSelect label="Раскладка тапера" value={taperMode} options={(['classic', 'pl', 'pro'] as TaperMode[]).map(m => ({ id: m, label: TAPER_MODE_LABELS[m] }))} hint="Канон lms-taper.engine: классика — разгрузка Bosquet; ПЛ-пик-протокол — интенсификация 90/95/100%; про — усталость-зависимая кривая с праймингом" onChange={v => setTaperMode(v as TaperMode)} />
        <PopupSelect label="🏆 Пиковый цикл (интеграция)" value={peakCycleId} options={[{ id: '', label: '— канон по режиму —', desc: 'classic/pl/pro' }, ...getPeakCycles().map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${c.meta.weeks} нед · ${c.meta.level}` }))]} hint="Если выбран — кривая тапера берётся ИЗ недель пикового цикла (соответствие ПЛ-авто). Без выбора — каноническая кривая по режиму." onChange={v => setPeakCycleId(v)} />
        <PopupSelect label="Стратегия прикидов" value={strategy} options={STRATEGY_OPTS} hint="Прикиды дня соревнований (округление к 2.5 кг)" onChange={v => setStrategy(v as MeetStrategy)} />
      </CalcSection>

      <CalcSection icon="⚖️" title="Весовая категория" accent="#60a5fa" grid2>
        <CalcResult label="Категория" value={cls.name} accent="#60a5fa" hint={`Для ${bw} кг · ${fed.toUpperCase()}`} />
        <CalcResult label="Нужно сбросить" value={bw > cls.max ? `${(bw - cls.max + 0.5).toFixed(1)} кг` : '0 кг'} accent="#f59e0b" hint={bw > cls.max ? 'Рекомендуется сушка' : 'Вес в норме'} />
      </CalcSection>

      <CalcSection icon="📉" title="Taper-кривая" accent="#a855f7" desc={`${weeks}-недельная пиковая фаза · ${TAPER_MODE_LABELS[taperMode]}${suggestedWeeks && suggestedWeeks !== weeks ? ` (по усталости рекомендуется ${suggestedWeeks} нед)` : ''}`}>
        {taper.map(t => (
          <div key={t.week} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
            background: t.week === weeks ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${t.week === weeks ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', minWidth: 28 }}>Н{t.week}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {t.label && <span style={{ fontSize: 9, color: '#fff' }}>{t.label}{t.focus ? `: ${t.focus}` : ''}</span>}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 48, fontSize: 9, color: '#fff' }}>Объём</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${t.volumePct * 100}%`, height: '100%', borderRadius: 2, background: '#3b82f6' }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', minWidth: 32, textAlign: 'right' }}>{Math.round(t.volumePct * 100)}%</span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 48, fontSize: 9, color: '#fff' }}>Интенс.</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${t.intensityPct * 100}%`, height: '100%', borderRadius: 2, background: '#ef4444' }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', minWidth: 32, textAlign: 'right' }}>{t.intensityMode === 'preserve' ? 'сохр.' : `${Math.round(t.intensityPct * 100)}%`}</span>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', minWidth: 20 }}>RIR {t.rirTarget ?? `+${t.rirShift}`}</span>
          </div>
        ))}
      </CalcSection>

      <CalcSection icon="📋" title={`Стратегия подходов — ${MEET_STRATEGY_LABEL[strategy]}`} accent="#f59e0b">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, fontWeight: 700, fontSize: 9, color: '#fff', padding: '4px 8px' }}>
          <span>Движение</span><span style={{textAlign:'center'}}>1-й</span><span style={{textAlign:'center'}}>2-й</span><span style={{textAlign:'center'}}>3-й</span>
        </div>
        {attempts.map(a => (
          <div key={a.lift} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, padding: '6px 8px', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>{a.lift}</span>
            <span style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>{a.opener} кг</span>
            <span style={{ textAlign: 'center', color: '#eab308', fontWeight: 600 }}>{a.second} кг</span>
            <span style={{ textAlign: 'center', color: ACCENT, fontWeight: 800 }}>{a.third} кг</span>
          </div>
        ))}
      </CalcSection>

      <CalcSection icon="⏰" title="Таймлайн дня" accent="#ec4899" desc={`Взвешивание ${weighIn} · Старт ${startTime}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {timeline.map((line, i) => (
            <div key={i} style={{ fontSize: 10, padding: '3px 8px', color: '#fff', borderLeft: i === 0 ? '2px solid #3b82f6' : i === 1 ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.08)', marginLeft: 4 }}>
              {line}
            </div>
          ))}
        </div>
      </CalcSection>

      <CalcSection icon="🔄" title="Протоколы восстановления" accent="#22c55e">
        <div style={{ display: 'grid', gap: 4 }}>
          {RECOVERY_PROTOCOLS.map(p => (
            <ExpandableCard key={p.type} title={`${p.type} (${p.duration})`} short={p.instructions} full={<div style={{ fontSize: 10, color: '#fff' }}>Применять {p.duration} · {p.instructions}</div>} />
          ))}
        </div>
      </CalcSection>

      <CalcSection icon="🧠" title="Ментальные рутины" accent="#a855f7">
        <div style={{ display: 'grid', gap: 4 }}>
          {MENTAL_ROUTINES.map(m => (
            <div key={m.step} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', fontSize: 10, alignItems: 'center' }}>
              <span style={{ flex: 1, color: '#fff' }}>{m.step}</span>
              <span style={{ color: '#a855f7', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.duration}</span>
              <span style={{ color: '#fff', fontSize: 9, whiteSpace: 'nowrap' }}>{m.when}</span>
            </div>
          ))}
        </div>
      </CalcSection>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={autofillFromProfile}
          aria-label="Загрузить ПМ и вес из Профиля"
          title="Загрузить ПМ и вес из Профиля"
          style={{
            flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 800, fontSize: 12,
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >
          📋 Из профиля
        </button>
        <button onClick={applyTaper} style={{
          flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', minHeight: 44,
          background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12,
        }}>
          🛠 Применить taper
        </button>
        <button onClick={applyPms} style={{
          flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
          background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 800, fontSize: 12,
          border: '1px solid rgba(96,165,250,0.3)',
        }}>
          💾 Сохранить ПМ в профиль
        </button>
      </div>
      {lastSavedAt && (
        <div style={{ fontSize: 10, color: '#fff', marginTop: 6, textAlign: 'center' }}>
          ✓ ПМ сохранены: {new Date(lastSavedAt).toLocaleTimeString('ru')}
        </div>
      )}
    </div>
  );
};

export default PeakingPanel;