/**
 * TaperPlannerTab.tsx — ЕДИНЫЙ ПОЛНЫЙ ТАПЕР-КАЛЬКУЛЯТОР.
 * Объединяет: PL-taper (taper.engine), BB show-peak (peaking-engine),
 * весовую категорию, таймлайн дня, протоколы восстановления, ментальные рутины.
 * Ранее: TaperPlannerTab + PeakingPanel(PL) + ProPlToolsTab(taper) — теперь всё здесь.
 */
import React, { useMemo, useState } from 'react';
import {
  taperPlan, warmupSequence, taperWeeksForFatigue,
  type AttemptStrategy, type Lift, type TaperPlan,
} from '../../../engines/pro/taper.engine';
import type { BBPeakingOutput } from '../../../engines/peaking-engine';
import { buildPLTaperCurve, type TaperMode } from '../../../engines/lms/lms-taper.engine';
import { getPeakCycles, buildPeakCycleTaperCurve } from '../../../engines/lms/pl-peak-cycle-taper.engine';
import { buildBBContestPrep, normalizeContestCategory, planFromStored, configFromPlan, manipulationLockNote, recommendBBTaperConfig, TAPER_VS_DELOAD_NOTE, type BBContestPrepConfig, type BBContestPrepPlan } from '../../../engines/bb/bb-contest-prep.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import {
  selectWeightClassForSex, generateCompetitionTimeline,
  getRecoveryProtocols, getMentalRoutines, recommendWeightCut,
} from '../../../engines/gym-competition.engine';
import { applyToPlanner } from './planner-bridge';
import { getProfile } from '../../../core/profile-manager';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { getCyclesByTrainingDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { AGE_GROUPS, eligibleRanksForAge, ageEligibilityNote, resolveFederation, type AgeGroup, type Federation, type Sex } from '../../../engines/pl-norms.engine';

const ACCENT = '#00e68a';
const DIM = '#fff';
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const CARD_GLASS: React.CSSProperties = { padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 };
const BTN: React.CSSProperties = { flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: DIM };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 };
const LABEL: React.CSSProperties = { color:'#fff', fontSize: 11, margin: '4px 0 2px' };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: '#fff' };
const LIFT_RU: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Тяга' };
const LIFT_COLOR: Record<Lift, string> = { squat: '#ef4444', bench: '#3b82f6', deadlift: '#f59e0b' };

const fatigueOpts = [
  { id: 'low', label: 'Низкая (8-9)', desc: 'Лёгкий тейпер 1 неделя' },
  { id: 'med', label: 'Средняя (5-7)', desc: 'Тейпер 2 недели' },
  { id: 'high', label: 'Высокая (>8)', desc: 'Длительный тейпер 3 недели' },
];
const strategyOpts: { id: AttemptStrategy; label: string; desc: string }[] = [
  { id: 'conservative', label: 'Консервативная', desc: 'Опенер 90%, 2-я 95,5%, 3-я 100%' },
  { id: 'balanced', label: 'Сбалансированная', desc: 'Опенер 92%, 2-я 96%, 3-я 102%' },
  { id: 'aggressive', label: 'Агрессивная', desc: 'Опенер 93%, 2-я 97%, 3-я 105%' },
];

const addDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function getProfileStrengthBaselines(): { squat: number; bench: number; dead: number } | null {
  try {
    const s: any = (getProfile().settings as any)?.training;
    if (s && typeof s.pmSquat === 'number' && typeof s.pmBench === 'number' && typeof s.pmDeadlift === 'number' && s.pmSquat > 20 && s.pmBench > 20 && s.pmDeadlift > 20) {
      return { squat: Math.round(s.pmSquat), bench: Math.round(s.pmBench), dead: Math.round(s.pmDeadlift) };
    }
    // fallback: legacy he_training_profile already merged via getProfile, but check direct
    const legacyRaw = localStorage.getItem('he_training_profile');
    if (legacyRaw) {
      const lp = JSON.parse(legacyRaw);
      if (lp.pmSquat && lp.pmBench && lp.pmDead) return { squat: Math.round(lp.pmSquat), bench: Math.round(lp.pmBench), dead: Math.round(lp.pmDead) };
    }
  } catch {}
  return null;
}

/** P4/P5: residual-подсказки блоков (Issurin: сила ~30д / гипертрофия ~15д / выносливость ~7д). Только порядок, без математики объёма. */
export const TAPER_RESIDUAL_HINTS: Array<{ key: string; label: string; days: string; hint: string }> = [
  { key: 'strength', label: 'Сила', days: '~30 дн', hint: 'Пик держится дольше — тапер можно короче, прекращение до 7 дн' },
  { key: 'hypertrophy', label: 'Гипертрофия', days: '~15 дн', hint: 'Памп-форма уходит за 2 нед — пик-памп backstage обязателен' },
  { key: 'endurance', label: 'Выносливость', days: '~7 дн', hint: 'Аэробная форма тает за неделю — кардио держим до конца' },
];

/** P5: снапшоты пика (паритет с MacrocyclePanel 📸). Кап 6, битый стор → []. */
export interface TaperScenario { id: string; savedAt: number; kind: 'pl' | 'bb'; meetDate: string; weeks: number; volumePct: number; rir: string; dose?: number; label: string; }
const TAPER_SCENARIOS_KEY = 'he_taper_scenarios_v1';
export function loadTaperScenarios(): TaperScenario[] {
  try {
    const raw = localStorage.getItem(TAPER_SCENARIOS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(s => s && typeof s.id === 'string' && (s.kind === 'pl' || s.kind === 'bb')).slice(0, 6);
  } catch { return []; }
}
export function saveTaperScenario(s: TaperScenario): TaperScenario[] {
  try {
    const arr = [s, ...loadTaperScenarios().filter(x => x.id !== s.id)].slice(0, 6);
    localStorage.setItem(TAPER_SCENARIOS_KEY, JSON.stringify(arr));
    return arr;
  } catch { return loadTaperScenarios(); }
}
export function removeTaperScenario(id: string): TaperScenario[] {
  try {
    const arr = loadTaperScenarios().filter(x => x.id !== id);
    localStorage.setItem(TAPER_SCENARIOS_KEY, JSON.stringify(arr));
    return arr;
  } catch { return loadTaperScenarios(); }
}

/** P5: префилл даты старта/шоу из годового плана (he_pl_macro/he_bb_macro → competitions[].date). */
export function macroCompetitionDate(): { date: string; name: string } | null {
  for (const key of ['he_pl_macro', 'he_bb_macro']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const m = JSON.parse(raw);
      const comps = Array.isArray(m?.competitions) ? m.competitions : [];
      const withDate = comps.filter((c: any) => c && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date)).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
      if (withDate.length > 0) return { date: withDate[0].date, name: String(withDate[0].name || 'Соревнование') };
    } catch { /* ignore */ }
  }
  return null;
}

/** P5: XSS-escape + защита от формульных инъекций CSV (префикс ' для =+-@). */
export function taperEscHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function taperCsvCell(v: string | number): string {
  const s = String(v ?? '');
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** P1: валидация прикидов (Travis: интенсивность держать ≥85%, но опенер консервативнее 90–93%). */
export function attemptWarnings(strategy: AttemptStrategy): string[] {
  if (strategy === 'aggressive') return ['⚠ Опенер 93% — верхняя граница (держите ≥85%, но открывайтесь консервативно). Третья 105% — только с запасом и trial-прикидками.'];
  if (strategy === 'balanced') return [];
  return [];
}

export const TaperPlannerTab: React.FC = () => {
  const [kind, setKind] = useState<'pl' | 'bb'>('pl');
  const [selectedPlCycle, setSelectedPlCycle] = useState<string>('');
  const [selectedBbCycle, setSelectedBbCycle] = useState<string>('');
  // Интеграция пиковых циклов ПЛ → ТАПЕР-пик ПЛ-авто (канон lms-taper)
  const [plPeakCycleId, setPlPeakCycleId] = useState<string>('');

  // ── PL: taper + соревнование ──
  const [meetDate, setMeetDate] = useState<string>(addDays(28));
  const [squat1RM, setSquat1RM] = useState(180);
  const [bench1RM, setBench1RM] = useState(120);
  const [deadlift1RM, setDeadlift1RM] = useState(220);
  const [fatigueRaw, setFatigueRaw] = useState<string>('med');
  const [fatigueNum, setFatigueNum] = useState(7);
  const [strategy, setStrategy] = useState<AttemptStrategy>('balanced');
  const [saved, setSaved] = useState(false);
  // Весовая категория + унификация возраст/пол/федерация (pl-norms)
  const [bw, setBw] = useState(() => { try { return Number((getProfile().settings as any)?.personal?.weight) || 80; } catch { return 80; } });
  const [fed, setFed] = useState('IPF');
  const [taperSex, setTaperSex] = useState<Sex>(() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } });
  const [taperFed, setTaperFed] = useState<Federation>('fpr_classic');
  const [taperAgeGroup, setTaperAgeGroup] = useState<AgeGroup>(() => {
    try {
      const age = Number((getProfile().settings as any)?.personal?.age) || 25;
      if (age >= 40) return 'masters_40plus';
      if (age >= 19 && age <= 23) return 'junior_19_23';
      if (age >= 14 && age <= 18) return 'youth_14_18';
      if (age >= 12 && age <= 13) return 'youth_12_13';
      return 'open';
    } catch { return 'open'; }
  });
  // Таймлайн
  const [weighIn, setWeighIn] = useState('08:00');
  const [start, setStart] = useState('11:00');

  // ── BB: шоу (P2: мёртвые слайдеры кондиция/наполнение/сухость/carbTol удалены — входы не влияли на расчёт; настройка в ББ-авто → шаг Contest) ──
  const [showDate, setShowDate] = useState<string>(() => macroCompetitionDate()?.date ?? addDays(7));
  const [macroBadge, setMacroBadge] = useState<string | null>(() => macroCompetitionDate()?.name ?? null);
  // P1: per-lift последний тяжёлый день (Travis 2–7д; дефолт = канон LAST_HEAVY_DAYS 12/8/4)
  const [lastSquat, setLastSquat] = useState(8);
  const [lastBench, setLastBench] = useState(4);
  const [lastDead, setLastDead] = useState(12);
  // P3: адаптив из дневника
  const [srpeApplied, setSrpeApplied] = useState(false);
  // P5: сценарии + экспорт
  const [scenarios, setScenarios] = useState<TaperScenario[]>(() => loadTaperScenarios());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const fatigue = fatigueRaw === 'low' ? 8 : fatigueRaw === 'high' ? 9 : fatigueNum;

  const plCycles = useMemo(() => getCyclesByTrainingDirection('strength').slice(0, 20), []);
  const bbCycles = useMemo(() => getCyclesByTrainingDirection('bodybuilding').slice(0, 20), []);
  const selectedPlCycleData = useMemo(() => plCycles.find(c => c.meta.id === selectedPlCycle), [plCycles, selectedPlCycle]);
  const selectedBbCycleData = useMemo(() => bbCycles.find(c => c.meta.id === selectedBbCycle), [bbCycles, selectedBbCycle]);
  const baseTaperWeeks = useMemo(() => taperWeeksForFatigue(fatigue * 10), [fatigue]);
  const adjustedTaperWeeks = useMemo(() => {
    if (taperAgeGroup === 'youth_12_13') return Math.min(baseTaperWeeks, 1);
    if (taperAgeGroup === 'youth_14_18') return Math.min(baseTaperWeeks, 2);
    if (taperAgeGroup === 'masters_40plus') return Math.min(3, baseTaperWeeks + 1);
    return baseTaperWeeks;
  }, [baseTaperWeeks, taperAgeGroup]);
  const ageTaperNote = useMemo(() => {
    if (adjustedTaperWeeks !== baseTaperWeeks) {
      if (taperAgeGroup === 'masters_40plus') return `👴 Мастера 40+: +1 нед к базовому taper (${baseTaperWeeks}→${adjustedTaperWeeks} нед) — дольше восстановление`;
      if (taperAgeGroup === 'youth_12_13') return `🧒 12-13 лет: taper ограничен 1 нед (базовый ${baseTaperWeeks}→${adjustedTaperWeeks}) — юношеские нагрузки`;
      if (taperAgeGroup === 'youth_14_18') return `🧑‍🎓 14-18 лет: taper ограничен 2 нед (базовый ${baseTaperWeeks}→${adjustedTaperWeeks}) — КМС доступно с 14`;
    }
    return null;
  }, [adjustedTaperWeeks, baseTaperWeeks, taperAgeGroup]);
  const [pmAutoNote, setPmAutoNote] = useState<string | null>(null);

  const applyProfilePMs = React.useCallback(() => {
    const p = getProfileStrengthBaselines();
    if (p) {
      setSquat1RM(p.squat);
      setBench1RM(p.bench);
      setDeadlift1RM(p.dead);
      setPmAutoNote(`✓ ПМ подставлены из профиля: ${p.squat}/${p.bench}/${p.dead} кг (тренировочный профиль → LMS цикл)`);
      setTimeout(() => setPmAutoNote(null), 4000);
      return true;
    }
    setPmAutoNote('⚠️ В профиле нет ПМ (заполните Профиль → Тренировки → Личные рекорды)');
    setTimeout(() => setPmAutoNote(null), 3000);
    return false;
  }, []);

  const handlePlCycleChange = React.useCallback((v: string) => {
    setSelectedPlCycle(v);
    if (v) {
      const c = plCycles.find(x => x.meta.id === v);
      const p = getProfileStrengthBaselines();
      if (p && c) {
        // Автоподстановка 1RM из профиля при выборе цикла (LMS_CYCLES.find → strengthBaselines)
        setSquat1RM(p.squat);
        setBench1RM(p.bench);
        setDeadlift1RM(p.dead);
        setPmAutoNote(`↗ Цикл «${c.meta.title}» (${c.meta.weeks} нед) — ПМ из профиля: ${p.squat}/${p.bench}/${p.dead} кг → taper ${adjustedTaperWeeks} нед (база ${baseTaperWeeks} + возраст ${AGE_GROUPS.find(a => a.id === taperAgeGroup)?.label})`);
        setTimeout(() => setPmAutoNote(null), 4000);
      } else if (c) {
        setPmAutoNote(`Цикл «${c.meta.title}» (${c.meta.weeks} нед) — заполните ПМ вручную или из профиля`);
        setTimeout(() => setPmAutoNote(null), 3000);
      }
    } else {
      setPmAutoNote(null);
    }
  }, [plCycles, adjustedTaperWeeks, baseTaperWeeks, taperAgeGroup]);

  // ── Расчёты PL — эффективная усталость с учётом возраста (adjustedTaperWeeks → реальный план)
  const effectiveFatigue = useMemo(() => {
    if (adjustedTaperWeeks !== baseTaperWeeks) return adjustedTaperWeeks === 1 ? 30 : adjustedTaperWeeks === 2 ? 50 : 75;
    return fatigue * 10;
  }, [adjustedTaperWeeks, baseTaperWeeks, fatigue]);
  const plan: TaperPlan | null = useMemo(() => {
    if (kind !== 'pl' || squat1RM <= 0 || bench1RM <= 0 || deadlift1RM <= 0) return null;
    try { return taperPlan(meetDate, { squat: squat1RM, bench: bench1RM, deadlift: deadlift1RM }, effectiveFatigue, strategy); }
    catch { return null; }
  }, [kind, meetDate, squat1RM, bench1RM, deadlift1RM, effectiveFatigue, strategy]);
  // Канон ПЛ-авто (lms-taper) — та же усталость/стратегия, но через buildPLTaperCurve (соответствие «интеллектуальные тренировки ↔ ПЛ-авто»)
  const canonicalCurve = useMemo(() => {
    if (kind !== 'pl') return null;
    try {
      return buildPLTaperCurve({ taperWeeks: adjustedTaperWeeks, mode: 'pl' as TaperMode, peakCycleId: plPeakCycleId || undefined });
    } catch { return null; }
  }, [kind, adjustedTaperWeeks, plPeakCycleId]);
  const peakCycleCurve = useMemo(() => {
    if (kind !== 'pl' || !plPeakCycleId) return null;
    try { return buildPeakCycleTaperCurve(plPeakCycleId, adjustedTaperWeeks); } catch { return null; }
  }, [kind, plPeakCycleId, adjustedTaperWeeks]);

  const daysUntil = useMemo(() => {
    const d = new Date(meetDate).getTime() - Date.now();
    return Math.max(0, Math.round(d / 86400000));
  }, [meetDate]);

  const cls = useMemo(() => {
    return selectWeightClassForSex(taperSex, bw, fed);
  }, [taperSex, bw, fed]);
  const taperFedLabel = useMemo(() => ({ fpr_ipf: 'ФПР/IPF', fpr_classic: 'ФПР классика', fpr_equipped: 'ФПР экип', wrpf_untested: 'WRPF без ДК', wrpf_tested: 'WRPF с ДК' }[taperFed] || taperFed), [taperFed]);
  const timeline = useMemo(() => generateCompetitionTimeline(weighIn, start), [weighIn, start]);
  const recovery = useMemo(() => getRecoveryProtocols(), []);
  const mental = useMemo(() => getMentalRoutines(), []);
  const warmup = plan ? warmupSequence(plan.attempts.squat.opener) : [];

  // ── Расчёты BB — единый план из профиля (bb-contest-prep-sync) ──
  // Хардкод weeksOut=1 / minimal / constant удалён — читаем сохранённый план, иначе подсказка настроить в ББ-авто/питании.
  // P2: таблица несёт PRO-2 поля (клетчатка/калий/доза trial), мост — реальную кривую, trial-замок виден.
  const bb: (BBPeakingOutput & { fiber: string; potassium: string } & { storedPlan: BBContestPrepPlan | null; peakCfg: BBContestPrepConfig | null; dose: number | null; lockNote: string | null; isPreview: boolean }) | null = useMemo(() => {
    if (kind !== 'bb') return null;
    try {
      const s: any = (() => { try { return (getProfile().settings as any) || {}; } catch { return {}; } })();
      // Приоритет — сохранённый версионированный план
      const storedPlan = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal) as BBContestPrepPlan | null;
      if (storedPlan) {
        const cfgForPeak = (() => { try { return configFromPlan(storedPlan); } catch { return null; } })();
        const res = cfgForPeak ? buildBBContestPrep(cfgForPeak) : null;
        if (res) {
          return {
            weekPlan: res.peakWeek.map((d: any) => ({
              day: d.day,
              training: d.training.type,
              carbs: `${d.carbsG} г`,
              water: `${d.waterLiters} л`,
              sodium: `${d.sodiumMg} мг`,
              posing: `${d.posingMinutes} мин`,
              fiber: `${d.fiberMaxG} г`,
              potassium: `${d.potassiumMg} мг`,
            })),
            recommendations: [
              ...res.warnings,
              `План: шоу ${storedPlan.showDate} · ${storedPlan.category} · тапер ${storedPlan.taper.weeks} нед · трек ${storedPlan.postShowTrack ?? 'recovery'}`,
              'Вода и натрий стабильны по умолчанию; резкие манипуляции — только с подтверждением.',
            ],
            fiber: '',
            potassium: '',
            storedPlan,
            peakCfg: cfgForPeak,
            dose: storedPlan.peakWeek.carbDoseGPerKg ?? null,
            lockNote: cfgForPeak ? manipulationLockNote(cfgForPeak) : null,
            isPreview: false,
          };
        }
      }
      // Fallback — превью на дату showDate из профиля (минимальный безопасный конфиг)
      const bbSex: 'male' | 'female' = s?.personal?.sex === 'female' ? 'female' : 'male';
      const bbCategory = String(s?.goals?.bbCategory || (bbSex === 'female' ? 'bikini' : 'mens_physique'));
      const bbWeight = Number(s?.personal?.weight) > 0 ? Number(s.personal.weight) : 80;
      const cfg: BBContestPrepConfig = {
        sex: bbSex,
        category: normalizeContestCategory(bbCategory, bbSex),
        weightKg: bbWeight,
        experienceLevel: 'intermediate',
        enhanced: false,
        prepCount: 0,
        showDate,
        weeksOut: 1,
        trainingProtocol: 'bb',
        carbLoadStrategy: 'moderate',
        waterStrategy: 'stable',
        sodiumStrategy: 'stable',
      };
      const res2 = buildBBContestPrep(cfg);
      return {
        weekPlan: res2.peakWeek.map((d: any) => ({
          day: d.day,
          training: d.training.type,
          carbs: `${d.carbsG} г`,
          water: `${d.waterLiters} л`,
          sodium: `${d.sodiumMg} мг`,
          posing: `${d.posingMinutes} мин`,
          fiber: `${d.fiberMaxG} г`,
          potassium: `${d.potassiumMg} мг`,
        })),
        recommendations: [
          ...res2.warnings,
          'Нет сохранённого плана — показано превью на выбранную дату. Настройте полный тапер в ББ-авто или во вкладке «🏁 Тапер ББ» питания.',
        ],
        fiber: '',
        potassium: '',
        storedPlan: null,
        peakCfg: cfg,
        dose: null,
        lockNote: manipulationLockNote(cfg),
        isPreview: true,
      };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, showDate]);

  // P3: адаптив из дневника (sRPE + ACWR) — PL предлагает недели, BB зеркалит recommendBBTaperConfig
  const adaptive = useMemo(() => {
    try {
      const sessions = loadSRPESessions();
      if (sessions.length < 2) return null;
      const daily = toDailyLoads(sessions as any);
      const acwr = acuteChronicRatio(daily);
      const ratio = Number((acwr as any)?.ratio);
      const mean = sessions.reduce((a, s) => a + (Number(s.sRPE) || 0), 0) / Math.max(1, sessions.length);
      const rec = recommendBBTaperConfig({ fatigue: Math.round(mean * 10), acwrRatio: ratio, recentSessions: sessions.map(s => ({ sRPE: s.sRPE })) });
      const suggest: 'low' | 'med' | 'high' = !Number.isFinite(ratio) ? 'med' : ratio > 1.5 ? 'high' : ratio > 1.3 ? 'med' : ratio < 0.8 ? 'low' : 'med';
      return { n: sessions.length, mean: Math.round(mean * 10) / 10, ratio, rec, suggest };
    } catch { return null; }
  }, []);

  // P4: мёртвые storage he_taper_plan/he_bb_peak_plan больше не пишем (P5-снапшоты — единственный сейв)
  const handleSave = () => {
    if (kind === 'pl' && plan && canonicalCurve) {
      const last = canonicalCurve[canonicalCurve.length - 1];
      const sc: TaperScenario = {
        id: `pl-${Date.now()}`,
        savedAt: Date.now(),
        kind: 'pl',
        meetDate,
        weeks: adjustedTaperWeeks,
        volumePct: last?.volumePct ?? 0.5,
        rir: last?.rirTarget != null ? `RIR→${last.rirTarget}` : `+${last?.rirShift ?? 0}`,
        label: `PL ${meetDate} · ${adjustedTaperWeeks} нед · объём ×${last?.volumePct ?? 0.5}`,
      };
      setScenarios(saveTaperScenario(sc));
    }
    if (kind === 'bb' && bb) {
      const sc: TaperScenario = {
        id: `bb-${Date.now()}`,
        savedAt: Date.now(),
        kind: 'bb',
        meetDate: showDate,
        weeks: bb.storedPlan?.taper.weeks ?? 1,
        volumePct: bb.storedPlan?.taper.volumeProfile?.slice(-1)[0] ?? 0.6,
        rir: 'RIR 2–4',
        dose: bb.dose ?? undefined,
        label: `BB ${showDate} · тапер ${bb.storedPlan?.taper.weeks ?? 1} нед${bb.dose != null ? ` · доза ${bb.dose} г/кг` : ''}`,
      };
      setScenarios(saveTaperScenario(sc));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="train-taper" style={{ maxWidth: 800, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🔻 Тапер-планер (ПОЛНЫЙ)</div>
      <div style={{ ...SMALL, color: '#fff', marginBottom: 10 }}>
        Единый калькулятор: тейпер/пик для пауэрлифтинга (снижение объёма 40-60%, прикиды, стратегия,
        весовая категория, таймлайн дня, восстановление, ментал) + шоу-пик для бодибилдинга
        (углеводная загрузка, водная манипуляция, памп-тренировки). Источники: Mujika & Padilla 2003 (тейпер), Bosquet et al. 2007, Pritchard et al. 2015, Helms — без выдумок.
      </div>

      {/* ── PL / BB переключатель ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setKind('pl')} style={{ ...BTN_GHOST, flex: 1, border: kind === 'pl' ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: kind === 'pl' ? 'rgba(0,230,138,0.12)' : 'transparent', color: kind === 'pl' ? ACCENT : DIM }}>
          🏋️ PL: Тапер + Соревнование
        </button>
        <button onClick={() => setKind('bb')} style={{ ...BTN_GHOST, flex: 1, border: kind === 'bb' ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)', background: kind === 'bb' ? 'rgba(0,230,138,0.12)' : 'transparent', color: kind === 'bb' ? ACCENT : DIM }}>
          🏆 BB: Шоу-пик
        </button>
      </div>

      {/* P4: тапер ≠ делод (Bell 2025 / Rogerson-Bell 2024) */}
      <div style={{ ...CARD_GLASS, border: '1px solid rgba(0,230,138,0.16)', background: 'rgba(0,230,138,0.05)' }}>
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>{TAPER_VS_DELOAD_NOTE}</div>
      </div>

      {/* ── Выбор цикла по направлению (ПЛ vs ББ — учитываем разные циклы) ── */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🔄 Цикл для тейпера (ПЛ и ББ отличаются)</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>
          ПЛ-циклы — силовые (LMS, присед/жим/тяга, пикинг 3 нед, RIR→0). ББ-циклы — гипертрофийные (сплиты, памп, шоу-пик 4 нед, карб/вода). Выберите цикл — калькулятор подстроит подсказки и покажет длительность/направление.
        </div>
        {kind === 'pl' ? (
          <>
            <PopupSelect label="ПЛ-цикл (LMS)" value={selectedPlCycle} options={[{ id: '', label: '— без привязки к циклу —', desc: 'Ручной ввод 1RM' }, ...plCycles.map(c => ({ id: c.meta.id, label: `${c.meta.title} (${c.meta.level}, ${c.meta.weeks} нед)`, desc: `${c.meta.direction}` }))]} onChange={handlePlCycleChange} />
            {selectedPlCycleData && (
              <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 10, color: DIM }}>
                <b style={{ color: ACCENT }}>{selectedPlCycleData.meta.title}</b> · {selectedPlCycleData.meta.direction} · {selectedPlCycleData.meta.weeks} нед · {selectedPlCycleData.meta.level} · {selectedPlCycleData.meta.weeks} нед цикл → тейпер {adjustedTaperWeeks} нед (база {baseTaperWeeks} + возраст {AGE_GROUPS.find(a=>a.id===taperAgeGroup)?.label.split(' ')[0]}) {ageTaperNote ? '· ' + ageTaperNote.split('—')[0] : ''}.
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <button onClick={applyProfilePMs} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT }}>📥 Подставить ПМ из профиля (LMS → taper)</button>
                </div>
              </div>
            )}
            {!selectedPlCycleData && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <button onClick={applyProfilePMs} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: DIM }}>📥 Подставить ПМ из профиля</button>
              </div>
            )}
            {pmAutoNote && (
              <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: pmAutoNote.startsWith('⚠️') ? 'rgba(239,68,68,0.08)' : 'rgba(0,230,138,0.08)', border: '1px solid ' + (pmAutoNote.startsWith('⚠️') ? 'rgba(239,68,68,0.18)' : 'rgba(0,230,138,0.18)'), fontSize: 10, color: pmAutoNote.startsWith('⚠️') ? '#f87171' : ACCENT, lineHeight: 1.4 }}>{pmAutoNote}</div>
            )}
          </>
        ) : (
          <>
            <PopupSelect label="ББ-цикл" value={selectedBbCycle} options={[{ id: '', label: '— без привязки —', desc: 'Ручной' }, ...bbCycles.map(c => ({ id: c.meta.id, label: `${c.meta.title} (${c.meta.weeks} нед)`, desc: `${c.meta.direction}` }))]} onChange={v => setSelectedBbCycle(v)} />
            {selectedBbCycleData && (
              <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.12)', fontSize: 10, color: DIM }}>
                <b style={{ color: '#ec4899' }}>{selectedBbCycleData.meta.title}</b> · {selectedBbCycleData.meta.direction} · {selectedBbCycleData.meta.weeks} нед · шоу-пик 4 нед (углеводы/вода/памп) отличается от ПЛ-тейпера.
              </div>
            )}
          </>
        )}
      </div>
      {/* ── Интеграция пиковых циклов ПЛ → ТАПЕР-пик ПЛ-авто (канон) ── */}
      {kind === 'pl' && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🏆 Пиковый цикл ПЛ → Тапер-пик (интеграция с ПЛ-авто)</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>
            Если выбран пиковый цикл — кривая тапера берётся <b style={{ color: '#fff' }}>ИЗ недель пикового цикла</b> (объём/intensity по фактическим сетам, buildPeakCycleTaperCurve). Без выбора — каноническая кривая по режиму (classic/pl/pro/wf). <b style={{ color: ACCENT }}>Тапер-пик здесь = тапер-пик в ПЛ-авто</b> (lms-taper.engine, один канон).
          </div>
          <PopupSelect
            label="Пиковый цикл для тапера"
            value={plPeakCycleId}
            options={[
              { id: '', label: '— канон по режиму (без цикла) —', desc: 'classic/pl/pro/wf' },
              ...getPeakCycles().map(c => ({ id: c.meta.id, label: c.meta.title, desc: `${c.meta.weeks} нед · ${c.meta.level}` })),
            ]}
            onChange={v => setPlPeakCycleId(v)}
          />
          {plPeakCycleId && peakCycleCurve && canonicalCurve && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.14)', fontSize: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, color: ACCENT, marginBottom: 4 }}>✓ Соответствие: пиковый цикл → канон ПЛ-авто</div>
              <div style={{ color: DIM }}>Из цикла «{plPeakCycleId}»: объём финальной нед {Math.round(peakCycleCurve[peakCycleCurve.length-1].volumePct*100)}% · Инт. {Math.round(peakCycleCurve[peakCycleCurve.length-1].intensityPct*100)}% · Канон {canonicalCurve[canonicalCurve.length-1].label}: объём {Math.round(canonicalCurve[canonicalCurve.length-1].volumePct*100)}% — оба используют <b style={{ color: '#fff' }}>lms-taper.engine</b> (один источник).</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    try {
                      const txt = `Пиковый цикл ${plPeakCycleId}: ${peakCycleCurve.map(p=>`нед ${p.week} объём×${p.volumePct} int ${Math.round(p.intensityPct*100)}%`).join(' | ')} | Канон: ${canonicalCurve.map(p=>`нед ${p.week} объём×${p.volumePct}`).join(' | ')}`;
                      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt);
                    } catch {}
                  }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.1)', color: ACCENT, fontSize: 10, cursor: 'pointer' }}
                >📋 Скопировать соответствие</button>
                <button
                  onClick={() => {
                    applyToPlanner({ kind: 'peak', label: `Тапер из пикового цикла ${plPeakCycleId}: объём×${peakCycleCurve[peakCycleCurve.length-1].volumePct}`, data: { volumeMult: peakCycleCurve[peakCycleCurve.length-1].volumePct, rirTarget: peakCycleCurve[peakCycleCurve.length-1].rirTarget ?? 0, peakCycleId: plPeakCycleId } } as any);
                  }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.1)', color: '#a78bfa', fontSize: 10, cursor: 'pointer' }}
                >↗ В ПЛ-авто</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Унификация возраст/пол/федерация (как в PlNormsCalcTab) — влияет на taper и весовую категорию ── */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>👤 Возраст / Пол / Федерация — унифицировано</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>Как в <b style={{ color: '#fff' }}>Едином нормативе</b> (pl-norms): возраст влияет на допустимые разряды и на длительность taper (юноши — короче, мастера — дольше), пол — на весовую категорию и DOTS/Wilks, федерация — на категории и пороги.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupSelect label="Возрастная группа" value={taperAgeGroup} options={AGE_GROUPS.map(a => ({ id: a.id, label: a.label, desc: a.desc }))} onChange={v => setTaperAgeGroup(v as AgeGroup)} />
          <PopupSelect label="Пол" value={taperSex} options={[{ id: 'male', label: '♂ Мужчина', desc: '59-120 кг' }, { id: 'female', label: '♀ Женщина', desc: '43-84 кг' }]} onChange={v => setTaperSex(v as Sex)} />
          <PopupSelect label="Федерация" value={taperFed} options={[{ id: 'fpr_classic', label: 'ФПР / IPF — классика', desc: 'с ДК' }, { id: 'fpr_equipped', label: 'ФПР — экипировка', desc: 'с ДК' }, { id: 'wrpf_tested', label: 'WRPF с ДК', desc: 'с ДК' }, { id: 'wrpf_untested', label: 'WRPF без ДК', desc: 'без ДК' }]} onChange={v => { const nf = v as Federation; setTaperFed(nf); const rf = resolveFederation(nf); setFed(rf === 'fpr_classic' || rf === 'fpr_equipped' ? 'IPF' : 'other'); }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <div style={{ fontSize: 10, color: DIM, lineHeight: 1.3 }}>
              Весовая: <b style={{ color: '#fff' }}>{taperSex === 'female' ? '♀' : '♂'} {taperFedLabel}</b> · Категория до <b style={{ color: ACCENT }}>{cls.weightClass} кг</b><br />
              Допустимые разряды: <b style={{ color: ACCENT }}>{eligibleRanksForAge(taperAgeGroup).join(', ') || '— (только юношеские)'}</b>
            </div>
          </div>
        </div>
        {ageTaperNote && (
          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 10, color: '#f59e0b', lineHeight: 1.4 }}>{ageTaperNote}</div>
        )}
        {(() => {
          const note = ageEligibilityNote(taperAgeGroup, 'ms' as any);
          // показываем общую справку по возрасту, если есть ограничение
          const anyNote = taperAgeGroup !== 'open' ? (taperAgeGroup === 'youth_12_13' ? 'В 12-13 лет взрослые разряды не присваиваются — доступны только юношеские/I-III.' : taperAgeGroup === 'youth_14_18' ? 'В 14-18 лет доступен только КМС (МС с 16, МСМК с 17).' : null) : null;
          return anyNote ? <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 10, color: '#f87171', lineHeight: 1.4 }}>⛔ {anyNote}</div> : null;
        })()}
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 10, color: DIM, lineHeight: 1.4 }}>
          Taper: база <b style={{ color: '#fff' }}>{baseTaperWeeks} нед</b> (по усталости {fatigue*10}) → с учётом возраста <b style={{ color: ACCENT }}>{adjustedTaperWeeks} нед</b> · Пол/федерация из профиля подставляют ПМ и категорию автоматически.
        </div>
      </div>

      {/* ════════════════ PL ════════════════ */}
      {kind === 'pl' && (<>
        {/* Параметры */}
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Параметры taper</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><div style={LABEL}>📅 Дата старта</div>
              <input type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} style={IN} /></div>
            <PopupSelect label="Усталость (RPE-пресс)" value={fatigueRaw} options={fatigueOpts} onChange={setFatigueRaw} />
            <PopupSelect label="Стратегия прикидов" value={strategy} options={strategyOpts} onChange={v => setStrategy(v as AttemptStrategy)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <PopupNumber label="Присед 1RM" value={squat1RM} min={20} max={600} suffix="кг" onChange={setSquat1RM} />
            <PopupNumber label="Жим 1RM" value={bench1RM} min={20} max={400} suffix="кг" onChange={setBench1RM} />
            <PopupNumber label="Тяга 1RM" value={deadlift1RM} min={20} max={600} suffix="кг" onChange={setDeadlift1RM} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><PopupNumber label="Усталость число (1-10)" value={fatigueNum} min={1} max={10} onChange={setFatigueNum} /></div>
            {daysUntil > 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '4px 0' }}>
              <span style={{ ...SMALL, color: ACCENT }}>До старта: <b>{daysUntil}</b> дн.</span>
            </div>}
          </div>
        </div>

        {/* Сводка taper — с учётом возраста/пола (унифицировано с нормами) */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { title: 'Длительность', val: adjustedTaperWeeks + ' нед', sub: baseTaperWeeks === adjustedTaperWeeks ? baseTaperWeeks + ' нед по усталости' : `${baseTaperWeeks} баз. → ${adjustedTaperWeeks} с возр.`, clr: ACCENT },
              { title: 'Тотал (имп.)', val: String(squat1RM + bench1RM + deadlift1RM), sub: 'сум 3 движ.', clr: ACCENT },
              { title: 'Цель 3rd SQ', val: plan.attempts.squat.third + ' кг', sub: plan.attempts.squat.rpeNote, clr: '#f59e0b' },
              { title: 'Цель 3rd DL', val: plan.attempts.deadlift.third + ' кг', sub: plan.attempts.deadlift.rpeNote, clr: '#f59e0b' },
            ].map(s => (
              <div key={s.title} style={{ padding: 12, borderRadius: 12, textAlign: 'center', background: 'rgba(24,24,27,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.clr }}>{s.val}</div>
                <div style={{ fontSize: 10, color: DIM }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* P1: per-lift последний тяжёлый день + прекращение (Travis 2–7д; дефолт = канон 12/8/4) */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>⏱ Последний тяжёлый день по лифтам</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>Тяга раньше всех (самая taxing), жим позже всех. После своего дня — только разминка/прайминг, прекращение 2–7 дн до старта.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <PopupSelect label="Тяга (10–14)" value={String(lastDead)} options={[{ id: '10', label: 'D-10' }, { id: '12', label: 'D-12 · канон' }, { id: '14', label: 'D-14' }]} onChange={v => setLastDead(Number(v) || 12)} />
              <PopupSelect label="Присед (7–9)" value={String(lastSquat)} options={[{ id: '7', label: 'D-7' }, { id: '8', label: 'D-8 · канон' }, { id: '9', label: 'D-9' }]} onChange={v => setLastSquat(Number(v) || 8)} />
              <PopupSelect label="Жим (3–5)" value={String(lastBench)} options={[{ id: '3', label: 'D-3' }, { id: '4', label: 'D-4 · канон' }, { id: '5', label: 'D-5' }]} onChange={v => setLastBench(Number(v) || 4)} />
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6, lineHeight: 1.4 }}>Прекращение: тяжёлая тяга за {lastDead} дн · присед за {lastSquat} дн · жим за {lastBench} дн → дальше прайминг 60% ×1–2, полный отдых за 2 дн.</div>
          </div>
        )}

        {/* P1: главная кривая — канон ПЛ-авто (lms-taper.engine); pro-кривая — collapsible-альтернатива с дельтой */}
        {plan && canonicalCurve && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Главная кривая — канон ПЛ-авто {plPeakCycleId ? `· из цикла ${plPeakCycleId}` : '· режим pl'} {adjustedTaperWeeks !== baseTaperWeeks ? <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 400 }}>· {adjustedTaperWeeks} нед с возр. (база {baseTaperWeeks})</span> : null}</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6, lineHeight: 1.4 }}>Тапер-пик здесь = тапер-пик в ПЛ-авто (lms-taper.engine): buildPLTaperCurve{plPeakCycleId ? ' + buildPeakCycleTaperCurve' : ''}. Интенсивность ≥85%, объём −30…−70% (Bosquet/Travis).</div>
            {ageTaperNote && adjustedTaperWeeks !== baseTaperWeeks && (
              <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 10, color: '#f59e0b' }}>{ageTaperNote} — план построен с эффективной усталостью {effectiveFatigue}.</div>
            )}
            {canonicalCurve.map(pt => (
              <div key={pt.week} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>Нед {pt.week}</span>
                <span style={{ color: '#fff' }}>Объём: <b style={{ color: '#fff' }}>{Math.round(pt.volumePct * 100)}%</b></span>
                <span style={{ color: '#fff' }}>Инт.: <b style={{ color: '#fff' }}>{pt.intensityMode === 'preserve' ? 'сохр.' : Math.round(pt.intensityPct * 100) + '%'}</b></span>
                <span style={{ color: '#fff' }}>RIR: <b style={{ color: '#fff' }}>{pt.rirTarget != null ? pt.rirTarget : `+${pt.rirShift}`}</b></span>
                <div style={{ gridColumn: '1 / -1', fontSize: 10, color: DIM, marginTop: 2 }}>{pt.label}{pt.focus ? ` · ${pt.focus}` : ''}</div>
              </div>
            ))}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, fontWeight: 700, color: DIM, cursor: 'pointer', minHeight: 32 }}>Альтернатива: усталость/прайминг (pro/taper.engine) — показать с дельтой</summary>
              {(() => {
                const lastAlt = plan.taperCurve[plan.taperCurve.length - 1];
                const lastMain = canonicalCurve[canonicalCurve.length - 1];
                const dVol = Math.round((lastAlt.volumePctOfPeak - lastMain.volumePct) * 100);
                const dVolStr = `${dVol >= 0 ? '+' : ''}${dVol} п.п.`;
                return <div style={{ fontSize: 10, color: DIM, margin: '6px 0', lineHeight: 1.4 }}>Дельта финала vs канон: объём {dVolStr} · RIR alt {lastAlt.rir} vs канон {lastMain.rirTarget != null ? `→${lastMain.rirTarget}` : `+${lastMain.rirShift}`} — прайминг/DE-день, не основной план.</div>;
              })()}
              {plan.taperCurve.map(tw => (
                <div key={tw.week} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>Нед {tw.week}</span>
                  <span style={{ color: '#fff' }}>Объём: <b style={{ color: '#fff' }}>{Math.round(tw.volumePctOfPeak * 100)}%</b></span>
                  <span style={{ color: '#fff' }}>Инт.: <b style={{ color: '#fff' }}>{Math.round(tw.intensityPct * 100)}%</b></span>
                  <span style={{ color: '#fff' }}>RIR: <b style={{ color: '#fff' }}>{tw.rir}</b></span>
                  <div style={{ gridColumn: '1 / -1', fontSize: 10, color: DIM, marginTop: 2 }}>{tw.rationale}</div>
                </div>
              ))}
            </details>
          </div>
        )}

        {/* Понедельный план */}
        {plan && plan.weeks.map(w => (
          <div key={w.week} style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📅 Неделя {w.week} — {w.sessions.length} сессии</div>
            {w.sessions.map((s, si) => (
              <div key={si} style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.dayName}</span>
                  <span style={{ fontSize: 10, color: ACCENT }}>{s.daysUntilMeet} дн. до старта</span>
                </div>
                <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>{s.focus}</div>
                {s.exercises.map((ex, ei) => {
                  const weight = ex.lift === 'squat' ? squat1RM : ex.lift === 'bench' ? bench1RM : deadlift1RM;
                  const wkg = Math.round(weight * ex.percent * 10) / 10;
                  return (
                    <div key={ei} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr', gap: 6, fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#fff' }}>
                      <span style={{ color: LIFT_COLOR[ex.lift], fontWeight: 700 }}>{LIFT_RU[ex.lift]}</span>
                      <span>{Math.round(ex.percent * 100)}% × {ex.reps}</span>
                      <span style={{ color: ACCENT, fontWeight: 700 }}>{wkg} кг × {ex.sets}</span>
                      <span style={{ gridColumn: '4 / -1' }}>{ex.note}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

        {/* Прикиды */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏆 Прикиды ({strategyOpts.find(s => s.id === strategy)?.label})</div>
            {attemptWarnings(strategy).map((w, i) => (
              <div key={i} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 10, color: '#f59e0b', lineHeight: 1.4 }}>{w}</div>
            ))}
            {(['squat', 'bench', 'deadlift'] as Lift[]).map(l => (
              <div key={l} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: LIFT_COLOR[l], marginBottom: 4 }}>{LIFT_RU[l]}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['opener', 'second', 'third', 'target'] as const).map(a => (
                    <div key={a} style={{ padding: 8, borderRadius: 8, textAlign: 'center', background: a === 'target' ? 'rgba(245,158,11,0.06)' : 'rgba(24,24,27,0.6)', border: a === 'target' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 10, color: DIM }}>{a === 'opener' ? 'Опенер' : a === 'second' ? 'Вторая' : a === 'third' ? 'Третья' : 'Цель'}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: a === 'target' ? '#f59e0b' : '#fff' }}>{plan.attempts[l][a]} кг</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Разминка + последние тяжёлые + инструкции */}
        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={CARD}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🔥 Разминка (опенер присед {plan.attempts.squat.opener} кг)</div>
              {warmup.map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#fff' }}>
                  <span>{Math.round(w.percent * 100)}%</span>
                  <b style={{ color: ACCENT }}>{w.weight} кг × {w.reps} повт.</b>
                </div>
              ))}
            </div>
            <div style={CARD}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>⏱ Последние тяжёлые (дн. до старта) — ваш выбор выше</div>
              {([
                { l: 'squat' as Lift, v: lastSquat, canon: plan.lastHeavyDays.squat },
                { l: 'bench' as Lift, v: lastBench, canon: plan.lastHeavyDays.bench },
                { l: 'deadlift' as Lift, v: lastDead, canon: plan.lastHeavyDays.deadlift },
              ]).map(({ l, v, canon }) => (
                <div key={l} style={ROW}>
                  <span style={{ color: LIFT_COLOR[l], fontWeight: 700 }}>{LIFT_RU[l]}</span>
                  <span style={{ color: '#fff' }}><b>{v}</b> дн.{v !== canon ? <span style={{ color: '#f59e0b' }}> (канон {canon})</span> : null}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#fff', marginTop: 8 }}>
                {plan.meetDayInstructions.map((m, i) => <div key={i} style={{ padding: '4px 0', lineHeight: 1.45 }}>• {m}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Весовая категория ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>⚖️ Весовая категория</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <PopupNumber label="Вес тела, кг" value={bw} min={40} max={200} suffix="кг" onChange={v => setBw(v)} />
            <PopupSelect label="Федерация" value={fed} options={[{ id: 'IPF', label: 'IPF (офиц.)' }, { id: 'other', label: 'Другая' }]} onChange={v => setFed(v)} />
          </div>
          <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Категория до {cls.weightClass} кг</div>
            {cls.cuttingRequired && <div style={{ fontSize: 10, color: '#eab308' }}>Сушка: {cls.cuttingAmount} кг</div>}
            {!cls.cuttingRequired && bw < cls.weightClass && (() => {
              const g = recommendWeightCut(bw, cls.weightClass, Math.max(1, Math.ceil(daysUntil / 7)));
              return (
                <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2, lineHeight: 1.45 }}>
                  📈 Набор до {cls.weightClass} кг: +{g.toGain.toFixed(1)} кг · темп {g.safeGainRate.toFixed(1)} кг/нед · профицит ≈{g.dailySurplusKcal} ккал/день
                  {g.gainFeasible && ` · успеваете за ${Math.ceil(daysUntil / 7)} нед`}
                  {g.gainRecommendations.length > 0 && <div style={{ color: DIM, marginTop: 2 }}>{g.gainRecommendations[1]}</div>}
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{cls.recommendation}</div>
          </div>
        </div>

        {/* ═══ Таймлайн дня ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>⏰ Таймлайн соревновательного дня</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><div style={LABEL}>Взвешивание</div><input type="time" style={IN} value={weighIn} onChange={e => setWeighIn(e.target.value)} /></div>
            <div><div style={LABEL}>Старт потока</div><input type="time" style={IN} value={start} onChange={e => setStart(e.target.value)} /></div>
          </div>
          {timeline.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{t.time}</span>
              <span style={{ color: DIM }}>{t.action}</span>
            </div>
          ))}
        </div>

        {/* ═══ Протоколы восстановления ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🔄 Протоколы восстановления</div>
          {recovery.map((r, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{r.name} <span style={{ fontSize: 10, color: DIM }}>({r.type}, {r.durationMin} мин)</span></div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Когда: {r.whenToUse}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{r.instructions.join(' · ')}</div>
            </div>
          ))}
        </div>

        {/* ═══ Ментальные рутины ═══ */}
        <div style={CARD_GLASS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>🧠 Ментальные рутины</div>
          {mental.map((m, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>{m.name}</div>
              <div style={{ fontSize: 10, color: DIM }}>Когда: {m.whenToUse}</div>
              {m.steps.map((s, j) => (
                <div key={j} style={{ fontSize: 10, color: DIM, marginTop: 2 }}>• {s.action} ({s.duration}) {s.notes}</div>
              ))}
            </div>
          ))}
        </div>

        {/* Инструкции соревновательного дня */}
        {plan && (
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📋 План соревновательного дня</div>
            {plan.meetDayInstructions.map((m, i) => (
              <div key={i} style={{ fontSize: 11, color: '#fff', padding: '4px 0', lineHeight: 1.45 }}>• {m}</div>
            ))}
          </div>
        )}

        {/* Apply + Save */}
        {plan && (<>
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>
              🔗 Применить ПМ ({squat1RM}/{bench1RM}/{deadlift1RM} кг) и taper-план (канон: объём ×{canonicalCurve?.[canonicalCurve.length - 1]?.volumePct ?? 0.5}{canonicalCurve?.[canonicalCurve.length - 1]?.rirTarget != null ? `, RIR→${canonicalCurve?.[canonicalCurve.length - 1]?.rirTarget}` : ''}) к планировщику.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => applyToPlanner({ kind: 'pm', label: 'ПМ taper: ' + squat1RM + '/' + bench1RM + '/' + deadlift1RM + ' кг', data: { squat: squat1RM, bench: bench1RM, dead: deadlift1RM } })} style={{ ...BTN, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000' }}>
                🛠 Применить ПМ
              </button>
              <button onClick={() => {
                const canon = canonicalCurve?.[canonicalCurve.length-1];
                const vol = canon?.volumePct ?? plan.taperCurve[plan.taperCurve.length - 1]?.volumePctOfPeak ?? 0.5;
                const rir = canon?.rirTarget ?? 0;
                applyToPlanner({ kind: 'peak', label: `Taper${plPeakCycleId ? ` из цикла ${plPeakCycleId}` : ''}: объём ×${vol}${rir!=null ? `, RIR→${rir}` : ''}`, data: { volumeMult: vol, rirTarget: rir, peakCycleId: plPeakCycleId || undefined } } as any);
              }} style={{ ...BTN, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}>
                🛠 Применить пик{plPeakCycleId ? ' (из цикла)' : ''}
              </button>
            </div>
          </div>
          <button onClick={handleSave} disabled={saved} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: saved ? 'not-allowed' : 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, marginTop: 8, opacity: saved ? 0.4 : 1 }}>
            {saved ? '✓ Сценарий сохранён' : '📸 Сохранить сценарий пика'}
          </button>
        </>)}
      </>)}

      {/* ════════════════ BB ════════════════ */}
      {kind === 'bb' && (<>
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Параметры шоу-пика</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={LABEL}>📅 Дата шоу</div><input type="date" style={IN} value={showDate} onChange={e => setShowDate(e.target.value)} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>
                {macroBadge ? <span>📍 <b style={{ color: ACCENT }}>{macroBadge}</b> — дата из годового плана</span> : <span>Кондиция/наполнение/сухость настраиваются в <b style={{ color: '#fff' }}>ББ-авто → шаг Contest</b> (единый контур)</span>}
              </div>
            </div>
          </div>
        </div>
        {bb && (
          <div style={CARD}>
            <div style={H}>⬇ Неделя пика (шоу){bb.isPreview ? <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 400 }}> · превью (нет сохранённого плана)</span> : <span style={{ fontSize: 10, color: ACCENT, fontWeight: 400 }}> · из сохранённого плана</span>}{bb.dose != null ? <span style={{ fontSize: 10, color: ACCENT, fontWeight: 400 }}> · 🧪 доза trial {bb.dose} г/кг</span> : null}</div>
            {bb.lockNote && (
              <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 10, color: '#f59e0b', lineHeight: 1.4 }}>{bb.lockNote}</div>
            )}
            <div style={ROW}><span>День</span><span>Тренировка · Углеводы · Вода · Na · Клетч. · Калий · Поза</span></div>
            {bb.weekPlan.map(d => (
              <div key={d.day} style={{ ...ROW, flexWrap: 'wrap', gap: 4 }}>
                <span style={{ color: ACCENT, fontWeight: 700, width: 28 }}>Д{d.day}</span>
                <span style={{ color: '#fff', fontSize: 11 }}>{d.training} · {d.carbs} · {d.water} · {d.sodium} · {(d as any).fiber} · {(d as any).potassium} · {d.posing}</span>
              </div>
            ))}
            {bb.recommendations.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={LABEL}>Рекомендации:</div>
                {bb.recommendations.map((r, i) => <div key={i} style={SMALL}>• {r}</div>)}
              </div>
            )}
          </div>
        )}
        {bb && (
          <>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>
                🔗 Применить BB шоу-пик к планировщику (карб-загрузка, водная манипуляция, памп).
              </div>
              <button onClick={() => {
                const vol = bb.storedPlan?.taper.volumeProfile?.slice(-1)[0] ?? 0.6;
                applyToPlanner({ kind: 'peak', label: `BB шоу-пик ${showDate}: объём ×${vol}, RIR 2–4${bb.dose != null ? `, доза trial ${bb.dose} г/кг` : ''}`, data: { volumeMult: vol, rirTarget: 2, showDate, carbDoseGPerKg: bb.dose ?? undefined, postShowTrack: bb.storedPlan?.postShowTrack ?? 'recovery', peakWeek: bb.storedPlan?.peakWeek ?? undefined } } as any);
              }} style={{ width: '100%', ...BTN, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000' }}>
                🛠 Применить шоу-пик к планировщику
              </button>
            </div>
            <button onClick={handleSave} disabled={saved} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: saved ? 'not-allowed' : 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, marginTop: 8, opacity: saved ? 0.4 : 1 }}>
              {saved ? '✓ Сценарий сохранён' : '📸 Сохранить сценарий пика'}
            </button>
          </>
        )}
      </>)}

      {/* P3: адаптив из дневника (sRPE + ACWR). PL — применить недели; BB — зеркало recommendBBTaperConfig, сборка в ББ-авто */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🤖 Адаптив из дневника</div>
        {!adaptive ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>Нет данных sRPE (нужно ≥2 сессий с RPE в дневнике тренировок). Усталость задаётся вручную выше; пик-дата не двигается адаптивом никогда.</div>
        ) : (
          <div>
            <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5, marginBottom: 6 }}>
              sRPE: {adaptive.n} сесс. · сред. RPE {adaptive.mean}{Number.isFinite(adaptive.ratio) ? ` · ACWR ${adaptive.ratio.toFixed(2)}` : ' · ACWR —'} · Пик-дата не двигается.
              {adaptive.rec.reasons.length > 0 ? ` ${adaptive.rec.reasons.join('; ')}.` : ' Нагрузка в норме.'}
            </div>
            {kind === 'pl' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setFatigueRaw(adaptive.suggest);
                    if (adaptive.suggest === 'high') setFatigueNum(9);
                    else if (adaptive.suggest === 'low') setFatigueNum(4);
                    else setFatigueNum(6);
                    setSrpeApplied(true);
                    setTimeout(() => setSrpeApplied(false), 2500);
                  }}
                  style={{ ...BTN, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff' }}
                >
                  {srpeApplied ? '✓ Применено' : `Применить: усталость «${adaptive.suggest === 'high' ? 'Высокая' : adaptive.suggest === 'low' ? 'Низкая' : 'Средняя'}»`}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
                BB: рекомендовано тапер {adaptive.rec.weeksOut} нед{adaptive.rec.volumeMult !== 1 ? `, объём ×${adaptive.rec.volumeMult}` : ''} — применяется в <b style={{ color: '#fff' }}>ББ-авто → шаг Contest → «Адаптивный тапер»</b> (здесь только зеркало).
              </div>
            )}
          </div>
        )}
      </div>

      {/* P5: сценарии пика (⇄ сравнить) + экспорт */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>📸 Сценарии пика {scenarios.length > 0 ? `(${scenarios.length}/6)` : ''}</div>
        {scenarios.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>Пока пусто — кнопка «📸 Сохранить сценарий пика» выше сохраняет текущий расчёт. Паритет с MacrocyclePanel 📸.</div>
        ) : (
          <div>
            {scenarios.map(sc => {
              const checked = compareIds.includes(sc.id);
              return (
                <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                  <input type="checkbox" aria-label={`Сравнить ${sc.label}`} checked={checked} onChange={() => setCompareIds(prev => prev.includes(sc.id) ? prev.filter(x => x !== sc.id) : [...prev, sc.id].slice(-2))} style={{ width: 20, height: 20 }} />
                  <span style={{ flex: 1, color: '#fff', lineHeight: 1.4 }}>{sc.label}</span>
                  <button onClick={() => setScenarios(removeTaperScenario(sc.id))} aria-label={`Удалить ${sc.label}`} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: DIM, fontSize: 10, cursor: 'pointer', minHeight: 32 }}>✕</button>
                </div>
              );
            })}
            {compareIds.length === 2 && (() => {
              const [a, b] = compareIds.map(id => scenarios.find(s => s.id === id)).filter(Boolean) as TaperScenario[];
              if (!a || !b) return null;
              return (
                <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)', fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                  ⇄ {a.label} vs {b.label}: недель {a.weeks}→{b.weeks} · объём ×{a.volumePct}→×{b.volumePct} · {a.rir}→{b.rir}{a.dose != null || b.dose != null ? ` · доза ${a.dose ?? '—'}→${b.dose ?? '—'} г/кг` : ''}
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  try {
                    const rows = kind === 'pl' && plan && canonicalCurve
                      ? canonicalCurve.map(pt => [pt.week, Math.round(pt.volumePct * 100) + '%', pt.intensityMode === 'preserve' ? 'сохр.' : Math.round(pt.intensityPct * 100) + '%', pt.rirTarget != null ? pt.rirTarget : `+${pt.rirShift}`, pt.label])
                      : kind === 'bb' && bb ? bb.weekPlan.map(d => [d.day, d.training, d.carbs, d.water, d.sodium, (d as any).fiber, (d as any).potassium, d.posing]) : [];
                    const csv = rows.map(r => r.map(taperCsvCell).join(',')).join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `taper-${kind}-${kind === 'pl' ? meetDate : showDate}.csv`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 2000);
                    setExportMsg('✓ CSV выгружен');
                  } catch { setExportMsg('⚠ Не удалось выгрузить CSV'); }
                  setTimeout(() => setExportMsg(null), 2500);
                }}
                style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }}
              >📥 CSV</button>
              <button
                onClick={() => {
                  try {
                    const dt = (kind === 'pl' ? meetDate : showDate).replace(/-/g, '');
                    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBuildHealth//Taper//RU', `BEGIN:VEVENT`, `UID:taper-${Date.now()}@bbh`, `DTSTAMP:${dt}T080000`, `DTSTART:${dt}T080000`, `SUMMARY:${kind === 'pl' ? 'Старт ПЛ' : 'Шоу ББ'} — пик`, `DESCRIPTION:${kind === 'pl' ? `Тапер ${adjustedTaperWeeks} нед` : `Шоу-пик${bb?.dose != null ? `, доза ${bb.dose} г/кг` : ''}`}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
                    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `taper-${kind}.ics`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 2000);
                    setExportMsg('✓ ICS выгружен');
                  } catch { setExportMsg('⚠ Не удалось выгрузить ICS'); }
                  setTimeout(() => setExportMsg(null), 2500);
                }}
                style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }}
              >📅 ICS</button>
              <button
                onClick={() => {
                  try {
                    const title = kind === 'pl' ? `Тапер ПЛ к ${meetDate}` : `Шоу-пик ББ ${showDate}`;
                    const body = kind === 'pl' && plan && canonicalCurve
                      ? canonicalCurve.map(pt => `<tr><td>Нед ${pt.week}</td><td>${Math.round(pt.volumePct * 100)}%</td><td>${pt.intensityMode === 'preserve' ? 'сохр.' : Math.round(pt.intensityPct * 100) + '%'}</td><td>${taperEscHtml(String(pt.rirTarget ?? '+' + pt.rirShift))}</td><td>${taperEscHtml(pt.label)}</td></tr>`).join('')
                      : kind === 'bb' && bb ? bb.weekPlan.map(d => `<tr><td>Д${d.day}</td><td>${taperEscHtml(d.training)}</td><td>${taperEscHtml(d.carbs)}</td><td>${taperEscHtml(d.water)}</td><td>${taperEscHtml(d.sodium)}</td><td>${taperEscHtml((d as any).fiber)}</td><td>${taperEscHtml((d as any).potassium)}</td></tr>`).join('') : '';
                    const w = window.open('', '_blank');
                    if (!w) { setExportMsg('⚠ Блокировано всплывающее окно'); setTimeout(() => setExportMsg(null), 2500); return; }
                    w.document.write(`<html><head><meta charset="utf-8"><title>${taperEscHtml(title)}</title></head><body><h1>${taperEscHtml(title)}</h1><table border="1" cellpadding="6" cellspacing="0"><tbody>${body}</tbody></table></body></html>`);
                    w.document.close();
                    w.print();
                    setExportMsg('✓ Печать открыта');
                  } catch { setExportMsg('⚠ Не удалось открыть печать'); }
                  setTimeout(() => setExportMsg(null), 2500);
                }}
                style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }}
              >🖨 Печать</button>
            </div>
            {exportMsg && <div style={{ marginTop: 6, fontSize: 10, color: exportMsg.startsWith('✓') ? ACCENT : '#f59e0b' }}>{exportMsg}</div>}
          </div>
        )}
      </div>

      {/* P6: residual-подсказки блоков (Issurin) */}
      <div style={CARD_GLASS}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🧬 Residual-эффекты (Issurin)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {TAPER_RESIDUAL_HINTS.map(r => (
            <div key={r.key} title={r.hint} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{r.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{r.days}</div>
              <div style={{ fontSize: 9, color: DIM, marginTop: 2, lineHeight: 1.35 }}>{r.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaperPlannerTab;
