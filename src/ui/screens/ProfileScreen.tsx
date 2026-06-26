import React, { useEffect, useState, useRef } from 'react';
import type { UserProfile, InjuryRecord, SupplementEntry, MedicationEntry, LabPoint, WorkoutLog, StrengthLogEntry } from '../../core/types';
import { getProfile, updateProfile, useProfileRefresh } from '../../core/profile-manager';
import { saveContraindications, CHRONIC_CONDITIONS_LIST, ORGAN_WEAKNESSES, GENETIC_POLYMORPHISMS, getContraindications } from '../../core/contraindications';
import { getNutritionV2Data, saveNutritionV2Data, addWeightEntry, calcTrend } from '../../core/nutrition-v2-data';
import { db } from '../../core/db';
import { calcReadiness } from '../../engines/readiness.engine';
import { computeLabIndices, interpretLabIndices } from '../../engines/labs-indices.engine';
import { calculateIndices } from '../../engines/clinical-indices.engine';
import { NAVY_BF_FORMULAS, MUSCLE_GROUPS_FULL, INJURY_LOCATIONS } from '../../core/constants';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

type ProfileTab = 'overview' | 'anthropometry' | 'sleep' | 'lifestyle' | 'diet' | 'nutrition_v7' | 'genetics' | 'injuries' | 'progress' | 'analytics' | 'contacts' | 'bp_diary' | 'measurements' | 'diaries';
type ProfilePage = 'hero' | 'tabs';

const SPORT_TYPES = [
  { id: 'bodybuilding', label: 'Бодибилдинг' }, { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' }, { id: 'fitness', label: 'Фитнес' }, { id: 'other', label: 'Другое' },
] as const;

const CHRONIC_CONDITIONS = [
  { id: 'hypertension', label: 'Гипертония' }, { id: 'diabetes', label: 'Диабет' },
  { id: 'asthma', label: 'Астма' }, { id: 'thyroid', label: 'Щитовидная железа' },
  { id: 'heart', label: 'Сердечно-сосудистые' }, { id: 'liver', label: 'Заболевания печени' },
  { id: 'kidney', label: 'Заболевания почек' }, { id: 'joints', label: 'Заболевания суставов' },
] as const;

const BLOOD_TYPES = [
  { id: 'I+', label: 'I (Rh+)' }, { id: 'I-', label: 'I (Rh−)' },
  { id: 'II+', label: 'II (Rh+)' }, { id: 'II-', label: 'II (Rh−)' },
  { id: 'III+', label: 'III (Rh+)' }, { id: 'III-', label: 'III (Rh−)' },
  { id: 'IV+', label: 'IV (Rh+)' }, { id: 'IV-', label: 'IV (Rh−)' },
] as const;

const GOALS = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомп' }, { id: 'health', label: 'Здоровье' }
] as const;

const WEIGHT_LOG_KEY = 'he_weight_log';
interface WeightEntry { date: string; weight: number; }
function getWeightLog(): WeightEntry[] {
  try { return JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]'); } catch { return []; }
}
function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(log.slice(-90)));
}

const MEASUREMENTS_LOG_KEY = 'he_measurements_log';
interface MeasurementEntry { date: string; waistCm: number; chestCm: number; hipCm: number; bicepCm: number; thighCm: number; neckCm: number; forearmCm: number; bodyFat: number; }
function getMeasurementsLog(): MeasurementEntry[] {
  try { return JSON.parse(localStorage.getItem(MEASUREMENTS_LOG_KEY) || '[]'); } catch { return []; }
}

const BP_DIARY_KEY = 'he_bp_diary';
interface BPEntry { date: string; systolic: number; diastolic: number; hr: number; }
function getBPDiary(): BPEntry[] {
  try { return JSON.parse(localStorage.getItem(BP_DIARY_KEY) || '[]'); } catch { return []; }
}
function saveBPDiary(log: BPEntry[]) {
  localStorage.setItem(BP_DIARY_KEY, JSON.stringify(log));
}

const DIET_TYPES = [
  { id: 'omnivore', label: 'Всеядное', icon: '' },
  { id: 'vegetarian', label: 'Вегетарианское', icon: '' },
  { id: 'vegan', label: 'Веганское', icon: '' },
  { id: 'pescatarian', label: 'Пескатарианское', icon: '' },
  { id: 'keto', label: 'Кето', icon: '' },
  { id: 'paleo', label: 'Палео', icon: '' },
  { id: 'mediterranean', label: 'Средиземноморское', icon: '' },
] as const;

const ALLERGEN_OPTIONS = [
  { id: 'dairy', label: 'Молочные' }, { id: 'gluten', label: 'Глютен' }, { id: 'soy', label: 'Соя' },
  { id: 'eggs', label: 'Яйца' }, { id: 'fish', label: 'Рыба' }, { id: 'shellfish', label: 'Морепродукты' },
  { id: 'tree_nuts', label: 'Орехи' }, { id: 'peanuts', label: 'Арахис' },
];

const INTOLERANCE_OPTIONS = [
  { id: 'lactose', label: 'Лактоза' }, { id: 'fructose', label: 'Фруктоза' },
  { id: 'histamine', label: 'Гистамин' }, { id: 'sorbitol', label: 'Сорбитол' },
];

const COOKING_SKILLS = [
  { id: 'none', label: 'Не умею' }, { id: 'basic', label: 'Базовые' },
  { id: 'intermediate', label: 'Средние' }, { id: 'advanced', label: 'Продвинутые' },
] as const;

const TRAINING_LEVELS = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' }, { id: 'enhanced', label: 'Enhanced' }
] as const;

const PHARMA_EXPERIENCE = [
  { id: 'none', label: 'Нет' }, { id: 'beginner', label: 'Начинающий' },
  { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' }
] as const;

const CHRONOTYPES = [
  { id: 'lark', label: 'Жаворонок' }, { id: 'owl', label: 'Сова' }, { id: 'mixed', label: 'Смешанный' }
] as const;

const COURSE_PHASES = [
  { id: 'baseline', label: 'База' }, { id: 'course', label: 'Курс' },
  { id: 'course-bridge-course', label: 'Курс+Бридж' }, { id: 'bridge', label: 'Бридж' },
  { id: 'pct', label: 'ПКТ' }, { id: 'post_pct', label: 'После ПКТ' }, { id: 'fertility', label: 'Фертильность' },
] as const;

const INJURY_TYPES: { id: InjuryRecord['type']; label: string }[] = [
  { id: 'joint', label: 'Сустав' }, { id: 'muscle', label: 'Мышца' }, { id: 'bone', label: 'Кость' },
  { id: 'ligament', label: 'Связка' }, { id: 'tendon', label: 'Сухожилие' }, { id: 'nerve', label: 'Нерв' }
];

const MOVEMENT_LIMITS: { id: InjuryRecord['movementLimit']; label: string }[] = [
  { id: 'none', label: 'Нет' }, { id: 'mild', label: 'Лёгкое' },
  { id: 'moderate', label: 'Умеренное' }, { id: 'severe', label: 'Сильное' },
  { id: 'full_restriction', label: 'Полное' }
];

// ── Apple-style design tokens ──
const apple = {
  glassBg: 'rgba(24,24,27,0.12)',
  glassBorder: '1px solid rgba(255,255,255,0.04)',
  glassHover: 'rgba(24,24,27,0.2)',
  cardRadius: 14,
  accent: '#00e68a',
  accentDim: 'rgba(0,230,138,0.15)',
  accentBorder: '1px solid rgba(0,230,138,0.3)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: '1px solid rgba(255,255,255,0.08)',
  inputFocus: '1px solid rgba(0,230,138,0.4)',
  textPrimary: 'rgba(255,255,255,0.95)',
  textSecondary: 'rgba(255,255,255,0.9)',
  textDim: 'rgba(255,255,255,0.85)',
  pillBg: 'rgba(255,255,255,0.06)',
  pillActiveBg: 'rgba(0,230,138,0.12)',
  gradientGreen: 'linear-gradient(135deg, #00e68a, #00b864)',
  gradientBlue: 'linear-gradient(135deg, #3b82f6, #6366f1)',
  gradientOrange: 'linear-gradient(135deg, #f59e0b, #f97316)',
  gradientRed: 'linear-gradient(135deg, #ef4444, #dc2626)',
  gradientPurple: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
} as const;

const glassCard: React.CSSProperties = {
  background: apple.glassBg,
  borderRadius: apple.cardRadius,
  border: apple.glassBorder,
  padding: 16,
  marginBottom: 10,
};

const appleInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: apple.inputBorder,
  background: apple.inputBg,
  color: apple.textPrimary,
  fontSize: 14,
  boxSizing: 'border-box' as const,
  outline: 'none',
  transition: 'border 0.2s',
};

const appleSlider: React.CSSProperties = {
  width: '100%',
  accentColor: apple.accent,
  height: 6,
  borderRadius: 3,
  outline: 'none',
};

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: active ? apple.accentBorder : apple.glassBorder,
  background: active ? apple.accentDim : apple.glassBg,
  color: active ? apple.accent : apple.textSecondary,
  transition: 'all 0.15s',
});

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: apple.textDim,
  marginBottom: 4,
};

const SLEEP_DIARY_KEY = 'he_sleep_diary';

interface SleepEntry {
  date: string;
  hours: number;
  quality: number;
  awakenings: number;
  bedtime: string;
  wakeTime: string;
  notes: string;
}

const loadSleepDiary = (): SleepEntry[] => {
  try { return JSON.parse(localStorage.getItem(SLEEP_DIARY_KEY) || '[]'); } catch { return []; }
};

const saveSleepDiaryEntry = (entry: SleepEntry) => {
  try {
    const diary = loadSleepDiary();
    const idx = diary.findIndex(e => e.date === entry.date);
    if (idx >= 0) diary[idx] = entry; else diary.unshift(entry);
    localStorage.setItem(SLEEP_DIARY_KEY, JSON.stringify(diary.slice(0, 365)));
  } catch {}
};

const deleteSleepEntry = (date: string) => {
  try {
    const diary = loadSleepDiary().filter(e => e.date !== date);
    localStorage.setItem(SLEEP_DIARY_KEY, JSON.stringify(diary));
  } catch {}
};

const SleepDiary: React.FC<{ settings: any; save: (data: any) => void }> = ({ settings, save }) => {
  const [diary, setDiary] = useState<SleepEntry[]>(loadSleepDiary);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState(settings.baselineSleepHours ?? 7);
  const [quality, setQuality] = useState(settings.baselineSleepQuality ?? 5);
  const [awakenings, setAwakenings] = useState(settings.nightAwakenings ?? 1);
  const [bedtime, setBedtime] = useState(settings.bedtime ?? '23:00');
  const [wakeTime, setWakeTime] = useState(settings.wakeTime ?? '07:00');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'diary' | 'chart'>('diary');

  const addEntry = () => {
    const entry: SleepEntry = { date, hours, quality, awakenings, bedtime, wakeTime, notes };
    saveSleepDiaryEntry(entry);
    setDiary(loadSleepDiary());
    setShowForm(false);
    setNotes('');
  };

  const removeEntry = (d: string) => {
    deleteSleepEntry(d);
    setDiary(loadSleepDiary());
  };

  const weekData = diary.slice(0, 7).reverse();
  const maxHeight = 60;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <button onClick={() => setShowForm(!showForm)} style={{
        width:'100%', padding:'10px', borderRadius:12, border:apple.accentBorder,
        background:apple.accentDim, color:apple.accent, cursor:'pointer', fontSize:12, fontWeight:700,
      }}>
        {showForm ? '✕ Закрыть' : '➕ Добавить запись сна'}
      </button>

      {showForm && (
        <div style={glassCard}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <span style={sectionLabel}>Дата</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={appleInput} />
            </div>
            <div>
              <span style={sectionLabel}>Часов сна</span>
              <input type="number" min={0} max={24} step={0.5} value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)} style={appleInput} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <span style={sectionLabel}>Качество (1-10)</span>
              <input type="range" min={1} max={10} step={1} value={quality} onChange={e => setQuality(parseInt(e.target.value))} style={appleSlider} />
              <div style={{ fontSize:11, fontWeight:700, color:apple.accent, textAlign:'center' }}>{quality}/10</div>
            </div>
            <div>
              <span style={sectionLabel}>Пробуждения</span>
              <input type="range" min={0} max={10} step={1} value={awakenings} onChange={e => setAwakenings(parseInt(e.target.value))} style={appleSlider} />
              <div style={{ fontSize:11, fontWeight:700, color:apple.accent, textAlign:'center' }}>{awakenings}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div><span style={sectionLabel}>Засыпание</span><input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} style={appleInput} /></div>
            <div><span style={sectionLabel}>Подъём</span><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={appleInput} /></div>
          </div>
          <div style={{ marginBottom:8 }}>
            <span style={sectionLabel}>Заметки</span>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Стресс, кофеин, алкоголь..." style={appleInput} />
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={addEntry} style={{
              flex:1, padding:'8px', borderRadius:10, border:'none', cursor:'pointer',
              background:apple.gradientGreen, color:'#000', fontWeight:700, fontSize:11,
            }}>💾 Сохранить</button>
            <button onClick={() => {
              save({ baselineSleepHours: hours, baselineSleepQuality: quality, nightAwakenings: awakenings, bedtime, wakeTime });
            }} style={{
              padding:'8px 12px', borderRadius:10, cursor:'pointer', fontSize:10, fontWeight:600,
              border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.9)',
            }}>↕ В профиль</button>
          </div>
        </div>
      )}

      {/* View mode toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:4 }}>
        {['diary','chart'].map(m => (
          <button key={m} onClick={() => setViewMode(m as any)} style={pillBtn(viewMode === m)}>
            {m === 'diary' ? '📋 Журнал' : '📊 График'}
          </button>
        ))}
      </div>

      {/* Chart view */}
      {viewMode === 'chart' && diary.length > 0 && (
        <div style={glassCard}>
          <span style={sectionLabel}>Последние 7 дней</span>
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:maxHeight+30, padding:'8px 0' }}>
            {weekData.map((e, i) => {
              const h = Math.min(maxHeight, (e.hours / 12) * maxHeight);
              return <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:'100%', background:'rgba(0,230,138,0.12)', borderRadius:'4px 4px 0 0', height:h, minHeight:4, position:'relative', border:'1px solid rgba(0,230,138,0.2)' }}>
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', fontSize:8, fontWeight:700, color:apple.accent, whiteSpace:'nowrap' }}>{e.hours}ч</div>
                </div>
                <span style={{ fontSize:7, color:apple.textSecondary, textAlign:'center' }}>{e.date.slice(5)}</span>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* Diary log */}
      {viewMode === 'diary' && (
        <div style={glassCard}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={sectionLabel}>История сна ({diary.length} записей)</span>
          </div>
          {diary.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, fontSize:10, color:apple.textSecondary }}>
              Нет записей. Добавьте первую запись сна.
            </div>
          ) : (
            <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
              {diary.map((e, i) => (
                <div key={i} style={{
                  padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.02)',
                  border:'1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{e.date}</span>
                    <button onClick={() => removeEntry(e.date)} style={{
                      padding:'2px 6px', borderRadius:6, fontSize:8, cursor:'pointer',
                      border:'1px solid rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.06)', color:'#ef4444',
                    }}>✕</button>
                  </div>
                  <div style={{ display:'flex', gap:8, fontSize:9, color:apple.textSecondary }}>
                    <span style={{ color:apple.accent, fontWeight:700 }}>💤 {e.hours}ч</span>
                    <span style={{ color: e.quality >= 7 ? '#00e68a' : e.quality >= 4 ? '#f59e0b' : '#ef4444' }}>⭐ {e.quality}/10</span>
                    <span>🌙 {e.awakenings} проб.</span>
                    <span>🛌 {e.bedtime}-{e.wakeTime}</span>
                  </div>
                  {e.notes && <div style={{ fontSize:8, color:apple.textDim, marginTop:2 }}>{e.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProfileScreen: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [page, setPage] = useState<ProfilePage>('hero');
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [editInjury, setEditInjury] = useState<InjuryRecord | null>(null);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(getWeightLog);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [bpEntries, setBpEntries] = useState<BPEntry[]>(getBPDiary);
  const [bpPeriod, setBpPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [showBpForm, setShowBpForm] = useState(false);
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bpHr, setBpHr] = useState('');
  const [reportTab, setReportTab] = useState<'current' | 'archive'>('current');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'reports' | 'progress'>('reports');
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<any>(null);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [customReportBlocks, setCustomReportBlocks] = useState<Record<string, boolean>>({
    profile: true, training: true, nutrition: true, labs: true,
    pharma: true, risk: true, support: true, bp: true, sleep: true,
  });

  // Food diary data for reports
  const [foodDiaryAvg, setFoodDiaryAvg] = useState<{avgKcal:number;avgProtein:number;avgFat:number;avgCarbs:number} | null>(null);

  interface TelegramFriend { id: string; name: string; username: string; avatar?: string; addedAt: string; }
  const TELEGRAM_FRIENDS_KEY = 'telegramFriends';
  const getFriends = (): TelegramFriend[] => { try { return JSON.parse(localStorage.getItem(TELEGRAM_FRIENDS_KEY) || '[]'); } catch { return []; } };
  const [friends, setFriends] = useState<TelegramFriend[]>(getFriends);
  const saveFriends = (f: TelegramFriend[]) => { localStorage.setItem(TELEGRAM_FRIENDS_KEY, JSON.stringify(f)); setFriends(f); };

  const addFriend = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery('bodybuildhealth_friend_add', ['users', 'groups']);
    }
    try {
      const name = prompt('Имя друга (если не через Telegram)');
      if (!name || !name.trim()) return;
      const username = prompt('Username (без @)') || 'user';
      const newFriend: TelegramFriend = {
        id: crypto.randomUUID(), name: name.trim(), username,
        addedAt: new Date().toISOString().split('T')[0],
      };
      saveFriends([...friends, newFriend]);
    } catch {}
  };

  const removeFriend = (id: string) => { saveFriends(friends.filter(f => f.id !== id)); };

  const shareReport = () => {
    const tg = (window as any).Telegram?.WebApp;
    const settings = profile.settings;
    const bmiVal = settings.weight && settings.height ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : '—';
    const ffmiVal = (() => {
      if (!settings.weight || !settings.height || !settings.bodyFat) return '—';
      const lbm = settings.weight * (1 - settings.bodyFat / 100);
      return (lbm / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1);
    })();
    const riskRaw = localStorage.getItem('he_last_risk');
    const riskPct = riskRaw ? JSON.parse(riskRaw).overallNet || '—' : '—';
    const supps = (settings.currentSupplements || []).slice(0, 3).map((x: any) => x.name).join(', ') || 'нет';

    const report = [
      `📊 *Отчёт BodyBuildHealth*`,
      `👤 ${profile.name || 'Пользователь'}`,
      `⚖️ Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
      `📐 BMI: ${bmiVal} | FFMI: ${ffmiVal}`,
      `🔥 Текущий риск: ${riskPct}%`,
      `💊 Поддержка: ${supps}`,
      `📅 ${new Date().toLocaleDateString('ru')}`,
    ].join('\n');

    if (tg?.sendData) {
      tg.sendData(JSON.stringify({ type: 'share_report', report }));
    } else if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent('https://body-build-health.vercel.app')}&text=${encodeURIComponent(report)}`);
    } else {
      navigator.clipboard?.writeText(report).then(() => alert('Отчёт скопирован в буфер обмена'));
    }
  };

  const openTrainingForFriend = () => {
    const tg = (window as any).Telegram?.WebApp;
    const username = prompt('Username друга (без @)') || '';
    if (!username.trim()) return;
    const deepLink = `https://t.me/BodyBuildHealthBot?start=training_view_${username.trim()}`;
    localStorage.setItem('he_shared_training_for', username.trim());
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(deepLink);
    } else if (tg?.openLink) {
      tg.openLink(deepLink);
    } else {
      navigator.clipboard?.writeText(deepLink).then(() => alert('Ссылка скопирована в буфер'));
    }
  };

  const settings = profile.settings;
  useEffect(() => {
    if (settings) saveContraindications({
      chronicConditions: settings.chronicConditions || [],
      foodAllergies: settings.foodAllergies || [],
      foodIntolerances: settings.foodIntolerances || [],
      excludedFoods: settings.excludedFoods || [],
      allergyNotes: settings.allergyNotes || '',
    });
  }, [settings.chronicConditions, settings.foodAllergies, settings.foodIntolerances, settings.excludedFoods, settings.allergyNotes]);
  const nutV2 = getNutritionV2Data();
  useEffect(() => {
    if (settings.weight && nutV2.weightHistory.length === 0) {
      addWeightEntry(settings.weight);
    }
    if (settings.bodyFat) saveNutritionV2Data({ bodyFatPercent: settings.bodyFat });
  }, []);
  const readinessScores = calcReadiness({
    sleepHours: settings.baselineSleepHours ?? 7,
    sleepQuality: settings.baselineSleepQuality ?? 5,
    nightAwakenings: settings.nightAwakenings ?? 1,
    hrvRatio: settings.baselineHrvRatio ?? 1.0,
    doms: 2, stress: settings.baselineStressLevel ?? 3,
    calRatio: settings.nutritionFactor ?? 0.8, proteinRatio: 0.8,
    waterRatio: 0.7, fiberRatio: 0.6, omega3Flag: false,
    trainingLoadRatio: settings.trainingFactor ?? 0.6,
    subjFatigue: settings.fatigueLevel ?? 3, hrIncrease: 0.1,
    chronotype: settings.chronotype, bedtime: settings.bedtime, wakeTime: settings.wakeTime,
  });

  const clinicalIndices = labs.length > 0 ? calculateIndices(labs, settings.sex, settings.age ?? 30) : null;
  const labIndices = labs.length > 0 ? computeLabIndices(labs) : null;
  const labIndexText = labIndices ? interpretLabIndices(labIndices) : null;

  const bmi = settings.height && settings.weight ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : null;
  const bmiText = bmi ? `${bmi} кг/м²` : '';
  const bmiCategory = bmi ? (parseFloat(bmi) < 18.5 ? 'Дефицит' : parseFloat(bmi) < 25 ? 'Норма' : parseFloat(bmi) < 30 ? 'Избыток' : 'Ожирение') : '';
  const lbm = settings.weight && settings.bodyFat ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : null;
  const ffmi = lbm && settings.height ? (parseFloat(lbm) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmi ? (parseFloat(ffmi) < 18 ? 'Ниже среднего' : parseFloat(ffmi) < 20 ? 'Средний' : parseFloat(ffmi) < 22 ? 'Хорошо' : parseFloat(ffmi) < 25 ? 'Отлично' : parseFloat(ffmi) < 28 ? 'Исключительно' : 'Подозрение') : '';
  const navyBf = (() => {
    if (!settings.waistCm || !settings.neckCm || !settings.height) return null;
    const f = NAVY_BF_FORMULAS[settings.sex] ?? NAVY_BF_FORMULAS.male;
    if (settings.sex === 'male') {
      return Math.max(0, f.a * Math.log10(settings.waistCm - settings.neckCm) - f.b * Math.log10(settings.height) + f.c).toFixed(1);
    }
    if (settings.hipCm) {
      const ff = NAVY_BF_FORMULAS.female;
      return Math.max(0, ff.a * Math.log10(settings.waistCm + settings.hipCm - settings.neckCm) - ff.b * Math.log10(settings.height) + ff.c).toFixed(1);
    }
    return null;
  })();
  const navyBfText = navyBf ? `${navyBf}%` : '';

  useEffect(() => {
    const load = async () => {
      try { setLabs(await db.getAll<LabPoint>('labs_log')); } catch {}
      try {
        const wLogs = await db.getAll<WorkoutLog>('workout_log');
        setWorkoutLogs((wLogs || []).sort((a, b) => b.date.localeCompare(a.date)));
      } catch {}
      // Load food diary for avg calculations
      try {
        const diaryEntries = await db.getAll<any>('food_diary');
        if (diaryEntries.length > 0) {
          const last7 = diaryEntries.filter((d: any) => d.date >= new Date(Date.now() - 7*86400000).toISOString().slice(0,10));
          const sample = last7.length > 0 ? last7 : diaryEntries.slice(-7);
          const n = sample.length;
          setFoodDiaryAvg({
            avgKcal: Math.round(sample.reduce((s:number, d:any) => s + (d.kcal || 0), 0) / n),
            avgProtein: Math.round(sample.reduce((s:number, d:any) => s + (d.protein || 0), 0) / n),
            avgFat: Math.round(sample.reduce((s:number, d:any) => s + (d.fat || 0), 0) / n),
            avgCarbs: Math.round(sample.reduce((s:number, d:any) => s + (d.carbs || 0), 0) / n),
          });
        }
      } catch {}
    };
    load();
  }, []);

  const save = (partial: Partial<UserProfile['settings']>) => {
    if (partial.weight !== undefined && partial.weight !== settings.weight) {
      const newEntry: WeightEntry = { date: new Date().toISOString().split('T')[0], weight: partial.weight };
      const updated = [...weightLog.filter(w => w.date !== newEntry.date), newEntry].sort((a, b) => a.date.localeCompare(b.date));
      setWeightLog(updated);
      saveWeightLog(updated);
    }
    updateProfile({ settings: { ...settings, ...partial } });
  };

  const addInjury = () => {
    const newInj: InjuryRecord = { id: crypto.randomUUID(), type: 'muscle', location: '', painLevel: 3, movementLimit: 'none', side: 'left', chronic: false, date: new Date().toISOString().slice(0, 10) };
    setEditInjury(newInj);
  };

  const saveInjury = (inj: InjuryRecord) => {
    const existing = settings.injuries ?? [];
    const idx = existing.findIndex(i => i.id === inj.id);
    const updated = idx >= 0 ? existing.map(i => i.id === inj.id ? inj : i) : [...existing, inj];
    save({ injuries: updated });
    setEditInjury(null);
  };

  const deleteInjury = (id: string) => {
    save({ injuries: (settings.injuries ?? []).filter(i => i.id !== id) });
  };

  const toggleWeakPoint = (id: string) => {
    const wp = settings.weakPoints ?? [];
    save({ weakPoints: wp.includes(id) ? wp.filter(x => x !== id) : [...wp, id] });
  };

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Обзор' }, { id: 'anthropometry', label: 'Тело' },
    { id: 'sleep', label: 'Сон' }, { id: 'lifestyle', label: 'Образ жизни' },
    { id: 'diet', label: 'Питание' }, { id: 'injuries', label: 'Травмы' },
    { id: 'analytics', label: 'Аналитика' },
    { id: 'bp_diary', label: 'Давление' }, { id: 'measurements', label: 'Замеры' }, { id: 'diaries', label: 'Дневники' }, { id: 'contacts', label: 'Контакты' }
  ];

  const initials = (profile.name || 'П').charAt(0).toUpperCase();
  const goalLabel = GOALS.find(g => g.id === (settings.primaryGoal || settings.goal))?.label || '—';
  const sportLabel = SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—';
  const trainLevelLabel = TRAINING_LEVELS.find(t => t.id === settings.trainingLevel)?.label || '—';
  const trainExp = settings.trainingExperience ?? 0;

  return (
    <div className="screen profile">
      {page === 'hero' ? (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/profile-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{
                  width:56, height:56, borderRadius:'50%',
                  background: apple.gradientGreen,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22, fontWeight:800, color:'#000',
                  border:'2px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 4px 20px rgba(0,230,138,0.3)',
                }}>
                  {initials}
                </div>
                <div>
                  <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0, textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Профиль</h1>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', margin:'4px 0 0', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
                    {profile.name || 'Пользователь'} • {settings.age || '—'} лет
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { id: 'overview', icon: '📋', title: 'Сведения о пользователе', desc: 'Обзор, антропометрия, сон, образ жизни, питание, травмы', color: '#00e68a' },
                { id: 'analytics', icon: '📊', title: 'Аналитика', desc: 'Отчёты для тренера/врача, дневник прогресса, дневники по категориям', color: '#3b82f6' },
                { id: 'contacts', icon: '📞', title: 'Контакты и друзья', desc: 'Список друзей, шаринг, поддержка и контакты', color: '#8b5cf6' },
              ].map(card => (
                <button key={card.id} onClick={() => { setPage('tabs'); setTab(card.id as ProfileTab); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: card.color + '18', fontSize: 20 }}>{card.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position:'relative', minHeight:'100vh' }}>
          <div style={{ position:'relative', zIndex:1, padding:'10px 12px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginBottom: 8 }}>
            <button onClick={() => setPage('hero')} style={{
              padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600,
              background: apple.glassBg, border: apple.glassBorder,
              color: apple.textSecondary,
            }}>← На главную</button>
          </div>

          <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:10, paddingBottom:2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: tab === t.id ? apple.accentDim : apple.glassBg,
                border: tab === t.id ? apple.accentBorder : apple.glassBorder,
                color: tab === t.id ? apple.accent : apple.textSecondary,
                transition:'all 0.2s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          {tab === 'overview' && (
          <InfoErrorBoundary label="Обзор">
            {/* Hero card with avatar + key stats */}
            <div style={{
              ...glassCard,
              background: 'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,180,100,0.04))',
              border: apple.accentBorder,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                <div style={{
                  width:60, height:60, borderRadius:'50%',
                  background: apple.gradientGreen,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:24, fontWeight:800, color:'#000',
                  boxShadow: '0 4px 20px rgba(0,230,138,0.25)',
                  flexShrink:0,
                }}>{initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:700, color: apple.textPrimary }}>{profile.name || 'Пользователь'}</div>
                  <div style={{ fontSize:12, color: apple.textSecondary, marginTop:2 }}>
                    {settings.age || '—'} лет • {goalLabel} • {sportLabel}
                  </div>
                  <div style={{ fontSize:11, color: apple.textDim, marginTop:2 }}>
                    Стаж: {trainExp || '—'} лет • Уровень: {trainLevelLabel}
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {[
                  { label:'Вес', val: settings.weight ? `${settings.weight} кг` : '—', sub: '' },
                  { label:'Рост', val: settings.height ? `${settings.height} см` : '—', sub: '' },
                  { label:'BMI', val: bmi || '—', sub: bmiCategory, color: bmi ? (parseFloat(bmi) < 18.5 ? '#f97316' : parseFloat(bmi) < 25 ? '#00e68a' : parseFloat(bmi) < 30 ? '#f59e0b' : '#ef4444') : undefined },
                  { label:'FFMI', val: ffmi || '—', sub: ffmiCategory, color: ffmi ? (parseFloat(ffmi) < 18 ? '#f97316' : parseFloat(ffmi) < 22 ? '#f59e0b' : '#00e68a') : undefined },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'center', background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'8px 4px' }}>
                    <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color: s.color || apple.textPrimary }}>{s.val}</div>
                    <div style={{ fontSize:9, color: s.color || apple.textSecondary, marginTop:1 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {readinessScores && (
              <div style={glassCard}>
                <div style={{ ...sectionLabel, marginBottom:10 }}>Готовность</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, textAlign:'center' }}>
                  {[
                    { label:'Восст.', value:readinessScores.recovery, good:60 },
                    { label:'Питание', value:readinessScores.nutrition, good:60 },
                    { label:'Поддержка', value:readinessScores.support, good:60 },
                    { label:'Усталость', value:readinessScores.fatigue, good:40, invert:true },
                  ].map(m => (
                    <div key={m.label} style={{ background:'rgba(255,255,255,0.02)', borderRadius:10, padding:'8px 4px' }}>
                      <div style={{ fontSize:22, fontWeight:700, color: m.invert ? (m.value <= m.good ? '#00e68a' : m.value <= 60 ? '#f59e0b' : '#ef4444') : (m.value >= m.good ? '#00e68a' : m.value >= 40 ? '#f59e0b' : '#ef4444') }}>{m.value}</div>
                      <div style={{ fontSize:10, color: apple.textDim }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={glassCard}>
              <div style={sectionLabel}>Фаза курса</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {COURSE_PHASES.map(p => (
                  <button key={p.id} style={pillBtn((settings.phase ?? 'baseline') === p.id)} onClick={() => save({ phase: p.id })}>{p.label}</button>
                ))}
              </div>
              {settings.courseStartDate && (
                <div style={{ marginTop:10 }}>
                  <span style={sectionLabel}>Дата начала курса</span>
                  <input style={appleInput} type="date" value={settings.courseStartDate} onChange={e => save({ courseStartDate: e.target.value })} />
                </div>
              )}
              {!settings.courseStartDate && settings.phase && settings.phase !== 'baseline' && (
                <button style={{ ...pillBtn(false), marginTop:10 }} onClick={() => save({ courseStartDate: new Date().toISOString().slice(0, 10) })}>Указать дату начала</button>
              )}
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Основная информация</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><span style={sectionLabel}>Имя</span><input style={appleInput} value={profile.name} onChange={e => updateProfile({ name: e.target.value })} /></div>
                <div><span style={sectionLabel}>Email</span><input style={appleInput} value={settings.email ?? ''} disabled /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                <div><span style={sectionLabel}>Возраст</span><input style={appleInput} type="number" value={settings.age || ''} onChange={e => save({ age: parseFloat(e.target.value) || 0 })} placeholder="30" /></div>
                <div>
                  <span style={sectionLabel}>Пол</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={pillBtn(settings.sex === 'male')} onClick={() => save({ sex: 'male' })}>Муж</button>
                    <button style={pillBtn(settings.sex === 'female')} onClick={() => save({ sex: 'female' })}>Жен</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Расширенная информация</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <span style={sectionLabel}>Вид спорта</span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {SPORT_TYPES.map(st => <button key={st.id} style={pillBtn((settings.sportType ?? 'bodybuilding') === st.id)} onClick={() => save({ sportType: st.id })}>{st.label}</button>)}
                  </div>
                </div>
                <div><span style={sectionLabel}>Стаж тренировок (лет)</span><input style={appleInput} type="number" value={(settings.trainingExperience ?? 0) || ''} onChange={e => save({ trainingExperience: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                <div><span style={sectionLabel}>Группа крови</span>
                  <select style={appleInput} value={settings.bloodType ?? ''} onChange={e => save({ bloodType: e.target.value })}>
                    <option value="">Не указано</option>
                    {BLOOD_TYPES.map(bt => <option key={bt.id} value={bt.id}>{bt.label}</option>)}
                  </select>
                </div>
                <div><span style={sectionLabel}>Аллергии (текст)</span><input style={appleInput} value={settings.allergyNotes ?? ''} onChange={e => save({ allergyNotes: e.target.value })} /></div>
              </div>
              <div style={{ marginTop:10 }}>
                <span style={sectionLabel}>Хронические заболевания</span>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                  {CHRONIC_CONDITIONS.map(c => {
                    const active = (settings.chronicConditions ?? []).includes(c.id);
                    return <button key={c.id} onClick={() => { const cur = settings.chronicConditions ?? []; save({ chronicConditions: active ? cur.filter(x => x !== c.id) : [...cur, c.id] }); }} style={pillBtn(active)}>{c.label}</button>;
                  })}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                <div><span style={sectionLabel}>Экстренный контакт (имя)</span><input style={appleInput} value={settings.emergencyName ?? ''} onChange={e => save({ emergencyName: e.target.value })} /></div>
                <div><span style={sectionLabel}>Экстренный телефон</span><input style={appleInput} value={settings.emergencyPhone ?? ''} onChange={e => save({ emergencyPhone: e.target.value })} /></div>
              </div>
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Питание v2 (динамический TDEE)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
                <div style={{ background:'rgba(0,230,138,0.06)', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Текущий TDEE</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#00e68a' }}>{Math.round(nutV2.currentTDEE)}</div>
                  <div style={{ fontSize:9, color: nutV2.tdeeAdjustment > 50 ? '#ef4444' : nutV2.tdeeAdjustment < -50 ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
                    {nutV2.tdeeAdjustment !== 0 ? `${nutV2.tdeeAdjustment > 0 ? '+' : ''}${Math.round(nutV2.tdeeAdjustment)} ккал корр.` : 'базовый'}
                  </div>
                </div>
                <div style={{ background:'rgba(59,130,246,0.06)', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Тренд веса</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#3b82f6' }}>{nutV2.lastTrendKgPerWeek.toFixed(2)}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>кг/нед</div>
                </div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6 }}>
                <input type="number" id="v2-weight-input" placeholder="Вес, кг" style={{ flex:1, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12 }} />
                <button onClick={() => { const inp = document.getElementById('v2-weight-input') as HTMLInputElement; if (inp?.value) { addWeightEntry(parseFloat(inp.value)); inp.value = ''; } }} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:11, cursor:'pointer' }}>Записать</button>
              </div>
              {nutV2.weightHistory.length > 0 && (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:4, textAlign:'center' }}>
                  {nutV2.weightHistory.length} записей, последняя: {nutV2.weightHistory[nutV2.weightHistory.length-1].kg} кг ({nutV2.weightHistory[nutV2.weightHistory.length-1].date})
                </div>
              )}
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>🍬 Поведенческие режимы</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={() => saveNutritionV2Data({ cravingMode: !nutV2.cravingMode })} style={{
                    padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', fontWeight: nutV2.cravingMode ? 700 : 400,
                    background: nutV2.cravingMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                    border: nutV2.cravingMode ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                    color: nutV2.cravingMode ? '#ef4444' : 'rgba(255,255,255,0.8)',
                  }}>🍬 Хочу сладкое</button>
                  {nutV2.cravingMode && (
                    <select value={nutV2.cravingDays} onChange={e => saveNutritionV2Data({ cravingDays: parseInt(e.target.value) })} style={{
                      padding:'4px 6px', borderRadius:6, fontSize:9, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff',
                    }}>
                      {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} дн.</option>)}
                    </select>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={() => saveNutritionV2Data({ lazyDayActive: !nutV2.lazyDayActive })} style={{
                    padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', fontWeight: nutV2.lazyDayActive ? 700 : 400,
                    background: nutV2.lazyDayActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                    border: nutV2.lazyDayActive ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                    color: nutV2.lazyDayActive ? '#f59e0b' : 'rgba(255,255,255,0.8)',
                  }}>🛋 Ленивый день</button>
                  {nutV2.lazyDayActive && (
                    <select value={nutV2.lazyDayDays} onChange={e => saveNutritionV2Data({ lazyDayDays: parseInt(e.target.value) })} style={{
                      padding:'4px 6px', borderRadius:6, fontSize:9, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff',
                    }}>
                      {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} дн.</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {clinicalIndices && (
              <div style={glassCard}>
                <div style={sectionLabel}>Клинические индексы</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, textAlign:'center' }}>
                  {[
                    { n:'HOMA-IR', v:clinicalIndices.homaIR.value, l:clinicalIndices.homaIR.status === 'normal' ? '✓' : '!' },
                    { n:'eGFR', v:clinicalIndices.egfr.value, l:clinicalIndices.egfr.status === 'normal' ? '✓' : '!' },
                    { n:'LDL/HDL', v:clinicalIndices.ldlHdlRatio.value, l:clinicalIndices.ldlHdlRatio.status === 'optimal' ? '✓' : '!' },
                    { n:'De Ritis', v:clinicalIndices.deritis.value, l:clinicalIndices.deritis.status === 'normal' ? '✓' : '!' },
                  ].map(i => (
                    <div key={i.n} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 6px' }}>
                      <div style={{ fontSize:18, fontWeight:700 }}>{i.v}</div>
                      <div style={{ fontSize:10, color: apple.textDim }}>{i.n}</div>
                      <div style={{ fontSize:10, opacity:0.6 }}>{i.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </InfoErrorBoundary>
          )}

          {/* ═══ ANTHROPOMETRY TAB ═══ */}
          {tab === 'anthropometry' && (
          <InfoErrorBoundary label="Замеры">
            {/* Bio card: BMI, LBM, FFMI */}
            <div style={glassCard}>
              <div style={sectionLabel}>Показатели тела</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0,230,138,0.1), rgba(0,180,100,0.05))',
                  border: '1px solid rgba(0,230,138,0.15)', borderRadius:12, padding:'12px 8px', textAlign:'center',
                }}>
                  <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>BMI</div>
                  <div style={{ fontSize:18, fontWeight:700, color: apple.accent }}>{bmiText || '—'}</div>
                  <div style={{ fontSize:9, color: apple.textSecondary, marginTop:2 }}>{bmiCategory}</div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))',
                  border: '1px solid rgba(59,130,246,0.15)', borderRadius:12, padding:'12px 8px', textAlign:'center',
                }}>
                  <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>LBM</div>
                  <div style={{ fontSize:18, fontWeight:700, color: '#3b82f6' }}>{lbm ? `${lbm} кг` : '—'}</div>
                  <div style={{ fontSize:9, color: apple.textSecondary, marginTop:2 }}>Сухая масса</div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(168,85,247,0.05))',
                  border: '1px solid rgba(139,92,246,0.15)', borderRadius:12, padding:'12px 8px', textAlign:'center',
                }}>
                  <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>FFMI</div>
                  <div style={{ fontSize:18, fontWeight:700, color: '#8b5cf6' }}>{ffmi || '—'}</div>
                  <div style={{ fontSize:9, color: apple.textSecondary, marginTop:2 }}>{ffmiCategory}</div>
                </div>
              </div>
              {navyBf && (
                <div style={{ marginTop:8, padding:'8px 12px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', textAlign:'center' }}>
                  <span style={{ fontSize:11, color: apple.textDim }}>Navy BF%: </span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#f59e0b' }}>{navyBfText}</span>
                  <span style={{ fontSize:10, color: apple.textSecondary, marginLeft:6 }}>
                    {parseFloat(navyBf!) < 6 ? 'Очень низкий' : parseFloat(navyBf!) < 18 ? 'Норма' : parseFloat(navyBf!) < 25 ? 'Повышен' : 'Высокий'}
                  </span>
                </div>
              )}
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Основные параметры</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <span style={sectionLabel}>Рост (см)</span>
                  <input style={appleInput} type="number" value={settings.height || ''} onChange={e => save({ height: parseFloat(e.target.value) || 0 })} placeholder="175" />
                </div>
                <div>
                  <span style={sectionLabel}>Вес (кг)</span>
                  <input style={appleInput} type="number" step="0.1" value={settings.weight} onChange={e => save({ weight: parseFloat(e.target.value) || 0 })} placeholder="80" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                <div>
                  <span style={sectionLabel}>% жира (ручной)</span>
                  <input style={appleInput} type="number" step="0.1" value={settings.bodyFat || ''} onChange={e => save({ bodyFat: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} placeholder="15" />
                </div>
                <div>
                  <span style={sectionLabel}>Пол</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={pillBtn(settings.sex === 'male')} onClick={() => save({ sex: 'male' })}>М</button>
                    <button style={pillBtn(settings.sex === 'female')} onClick={() => save({ sex: 'female' })}>Ж</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Обхваты (см)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { k:'waistCm', l:'Талия' }, { k:'neckCm', l:'Шея' }, { k:'chestCm', l:'Грудь' },
                  { k:'hipCm', l:'Бёдра' }, { k:'forearmCm', l:'Предплечье' }, { k:'bicepCm', l:'Бицепс' },
                  { k:'thighCm', l:'Бедро' }
                ].map(c => (
                  <div key={c.k}>
                    <span style={{ ...sectionLabel, fontSize:10 }}>{c.l}</span>
                    <input style={{ ...appleInput, fontSize:13, padding:'8px 10px' }} type="number" step="0.5" value={(settings as any)[c.k] ?? ''} onChange={e => save({ [c.k]: e.target.value ? parseFloat(e.target.value) || 0 : undefined } as any)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Weight history with gradient bars */}
            {weightLog.length > 1 && (
              <div style={glassCard}>
                <div style={{ ...sectionLabel, marginBottom:10 }}>История веса ({weightLog.length} записей)</div>
                <div style={{ display:'flex', gap:1, height:70, alignItems:'flex-end', padding:'0 4px' }}>
                  {weightLog.slice(-30).map((e, i) => {
                    const minW = Math.min(...weightLog.map(w => w.weight));
                    const maxW = Math.max(...weightLog.map(w => w.weight));
                    const range = maxW - minW || 1;
                    const h = Math.max(4, ((e.weight - minW) / range) * 100);
                    const isLast = i === weightLog.slice(-30).length - 1;
                    const colorVal = (e.weight - minW) / range;
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}
                        title={`${e.date}: ${e.weight} кг`}>
                        <div style={{
                          width:'75%', height:`${h}%`,
                          background: isLast ? apple.gradientGreen : `linear-gradient(180deg, rgba(0,230,138,${0.3 + colorVal * 0.5}), rgba(0,180,100,${0.15 + colorVal * 0.3}))`,
                          borderRadius:'2px 2px 0 0', minHeight:2,
                        }} />
                        {i % 7 === 0 && <span style={{ fontSize:7, color: apple.textDim }}>{e.date.slice(5)}</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color: apple.textDim, marginTop:6 }}>
                  <span>Мин: {Math.min(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
                  <span style={{ color: apple.accent, fontWeight:600 }}>{weightLog[weightLog.length - 1]?.weight?.toFixed(1)} кг</span>
                  <span>Макс: {Math.max(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
                </div>
              </div>
            )}
            </InfoErrorBoundary>
          )}

          {/* ═══ SLEEP TAB — ДНЕВНИК СНА ═══ */}
          {tab === 'sleep' && <InfoErrorBoundary label="Сон"><SleepDiary settings={settings} save={save} /></InfoErrorBoundary>}

          {/* ═══ LIFESTYLE TAB ═══ */}
          {tab === 'lifestyle' && (
            <InfoErrorBoundary label="Образ жизни">
              <div style={glassCard}>
                <div style={sectionLabel}>Стресс и усталость</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color: apple.textSecondary }}>Стресс</span>
                    <span style={{ fontSize:14, fontWeight:700, color: (settings.baselineStressLevel ?? 3) <= 3 ? apple.accent : (settings.baselineStressLevel ?? 3) <= 6 ? '#f59e0b' : '#ef4444' }}>{settings.baselineStressLevel ?? 3}/10</span>
                  </div>
                  <input style={appleSlider} type="range" min="1" max="10" value={settings.baselineStressLevel ?? 3} onChange={e => save({ baselineStressLevel: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color: apple.textSecondary }}>Усталость</span>
                    <span style={{ fontSize:14, fontWeight:700, color: (settings.fatigueLevel ?? 3) <= 3 ? apple.accent : (settings.fatigueLevel ?? 3) <= 6 ? '#f59e0b' : '#ef4444' }}>{settings.fatigueLevel ?? 3}/10</span>
                  </div>
                  <input style={appleSlider} type="range" min="1" max="10" value={settings.fatigueLevel ?? 3} onChange={e => save({ fatigueLevel: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Активность</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color: apple.textSecondary }}>Шаги/день</span>
                    <span style={{ fontSize:14, fontWeight:700, color: apple.accent }}>{settings.dailySteps ?? 6000}</span>
                  </div>
                  <input style={appleSlider} type="range" min="0" max="30000" step="500" value={settings.dailySteps ?? 6000} onChange={e => save({ dailySteps: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color: apple.textSecondary }}>Вода/день (л)</span>
                    <span style={{ fontSize:14, fontWeight:700, color: apple.accent }}>{settings.dailyWaterLiters ?? 2}</span>
                  </div>
                  <input style={appleSlider} type="range" min="0" max="6" step="0.1" value={settings.dailyWaterLiters ?? 2} onChange={e => save({ dailyWaterLiters: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><span style={sectionLabel}>Тренировок/нед</span><input style={appleInput} type="number" min="0" max="7" value={settings.workoutsPerWeek || ''} onChange={e => save({ workoutsPerWeek: parseFloat(e.target.value) || 0 })} /></div>
                  <div><span style={sectionLabel}>Мин/тренировку</span><input style={appleInput} type="number" min="15" max="180" value={settings.avgWorkoutMinutes || ''} onChange={e => save({ avgWorkoutMinutes: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Уровни и опыт</div>
                <div style={{ marginBottom:10 }}>
                  <span style={sectionLabel}>Тренировочный уровень</span>
                  <div style={{ display:'flex', gap:5, marginTop:4 }}>
                    {TRAINING_LEVELS.map(l => <button key={l.id} style={pillBtn((settings.trainingLevel ?? 'intermediate') === l.id)} onClick={() => save({ trainingLevel: l.id as any })}>{l.label}</button>)}
                  </div>
                </div>
                <div>
                  <span style={sectionLabel}>Фармакологический опыт</span>
                  <div style={{ display:'flex', gap:5, marginTop:4 }}>
                    {PHARMA_EXPERIENCE.map(e => <button key={e.id} style={pillBtn((settings.pharmaExperience ?? 'none') === e.id)} onClick={() => save({ pharmaExperience: e.id as any })}>{e.label}</button>)}
                  </div>
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Цель</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:2 }}>
                  {GOALS.map(g => <button key={g.id} style={pillBtn((settings.primaryGoal ?? settings.goal ?? '') === g.id)} onClick={() => save({ primaryGoal: g.id as any, goal: g.id })}>{g.label}</button>)}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Отстающие группы</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:4 }}>
                  {MUSCLE_GROUPS_FULL.map(m => (
                    <button key={m.id} style={pillBtn((settings.weakPoints ?? []).includes(m.id))} onClick={() => toggleWeakPoint(m.id)}>{m.label}</button>
                  ))}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Принимаю: БАДы</div>
                {(settings.currentSupplements ?? []).map((sup, i) => (
                  <div key={sup.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: apple.glassBorder }}>
                    <span style={{ flex:1, fontSize:12, color: apple.textSecondary }}>{sup.name} — {sup.doseMg} {sup.doseUnit}</span>
                    <button style={{
                      padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontSize:10, cursor:'pointer',
                    }} onClick={() => save({ currentSupplements: (settings.currentSupplements ?? []).filter((_, j) => j !== i) })}>Уд.</button>
                  </div>
                ))}
                <button style={{ ...pillBtn(false), marginTop:8, width:'100%' }} onClick={() => {
                  const ns: SupplementEntry = { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg' };
                  save({ currentSupplements: [...(settings.currentSupplements ?? []), ns] });
                }}>+ Добавить БАД</button>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Принимаю: Аптека</div>
                {(settings.currentMedications ?? []).map((med, i) => (
                  <div key={med.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: apple.glassBorder }}>
                    <span style={{ flex:1, fontSize:12, color: apple.textSecondary }}>{med.name} — {med.doseMg} {med.doseUnit} ({med.frequency})</span>
                    <button style={{
                      padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontSize:10, cursor:'pointer',
                    }} onClick={() => save({ currentMedications: (settings.currentMedications ?? []).filter((_, j) => j !== i) })}>Уд.</button>
                  </div>
                ))}
                <button style={{ ...pillBtn(false), marginTop:8, width:'100%' }} onClick={() => {
                  const nm: MedicationEntry = { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg', frequency: 'daily' };
                  save({ currentMedications: [...(settings.currentMedications ?? []), nm] });
                }}>+ Добавить препарат</button>
              </div>
            </InfoErrorBoundary>
          )}

          {/* ═══ DIET TAB ═══ */}
          {tab === 'diet' && (
            <InfoErrorBoundary label="Питание"><div>
              <div style={glassCard}>
                <div style={sectionLabel}>Тип питания</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:6 }}>
                  {DIET_TYPES.map(dt => (
                    <button key={dt.id} onClick={() => save({ dietType: dt.id as any })} style={{
                      padding:'10px 6px', borderRadius:12, cursor:'pointer', textAlign:'center',
                      background: settings.dietType === dt.id ? apple.accentDim : apple.glassBg,
                      border: settings.dietType === dt.id ? apple.accentBorder : apple.glassBorder,
                    }}>
                      <div style={{ fontSize:18 }}>{dt.icon}</div>
                      <div style={{ fontSize:10, fontWeight:600, color: settings.dietType === dt.id ? apple.accent : apple.textSecondary, marginTop:2 }}>{dt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Пищевые аллергии</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:4 }}>
                  {ALLERGEN_OPTIONS.map(a => {
                    const active = (settings.foodAllergies ?? []).includes(a.id);
                    return (
                      <button key={a.id} onClick={() => { const current = settings.foodAllergies ?? []; save({ foodAllergies: active ? current.filter(x => x !== a.id) : [...current, a.id] }); }} style={{
                        ...pillBtn(active), borderColor: active ? '#ef4444' : undefined, color: active ? '#ef4444' : undefined, background: active ? 'rgba(239,68,68,0.15)' : undefined,
                      }}>{a.label}</button>
                    );
                  })}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Непереносимости</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:4 }}>
                  {INTOLERANCE_OPTIONS.map(it => {
                    const active = (settings.foodIntolerances ?? []).includes(it.id);
                    return (
                      <button key={it.id} onClick={() => { const current = settings.foodIntolerances ?? []; save({ foodIntolerances: active ? current.filter(x => x !== it.id) : [...current, it.id] }); }} style={{
                        ...pillBtn(active), borderColor: active ? '#f97316' : undefined, color: active ? '#f97316' : undefined, background: active ? 'rgba(249,115,22,0.15)' : undefined,
                      }}>{it.label}</button>
                    );
                  })}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Навыки готовки</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
                  {COOKING_SKILLS.map(cs => (
                    <button key={cs.id} onClick={() => save({ cookingSkill: cs.id as any })} style={{
                      ...pillBtn(settings.cookingSkill === cs.id), width:'100%',
                    }}>{cs.label}</button>
                  ))}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Приёмов пищи в день</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
                  <input type="range" min={2} max={7} value={settings.mealsPerDay ?? 4} onChange={e => save({ mealsPerDay: parseFloat(e.target.value) || 0 })} style={{ flex:1, accentColor: apple.accent }} />
                  <span style={{ fontSize:18, fontWeight:700, minWidth:24, textAlign:'center', color: apple.accent }}>{settings.mealsPerDay ?? 4}</span>
                </div>
              </div>

              {((settings.foodAllergies ?? []).length + (settings.foodIntolerances ?? []).length > 0 || settings.dietType) && (
                <div style={{ ...glassCard, borderColor: apple.accent + '44' }}>
                  <div style={{ fontSize:11, color: apple.accent, fontWeight:600, marginBottom:6 }}>Активные ограничения</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {settings.dietType && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:apple.accentDim, color:apple.accent }}>
                      {DIET_TYPES.find(d => d.id === settings.dietType)?.label}
                    </span>}
                    {(settings.foodAllergies ?? []).map(a => (
                      <span key={a} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>
                        {ALLERGEN_OPTIONS.find(o => o.id === a)?.label || a}
                      </span>
                    ))}
                    {(settings.foodIntolerances ?? []).map(it => (
                      <span key={it} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(249,115,22,0.1)', color:'#f97316' }}>
                        {INTOLERANCE_OPTIONS.find(o => o.id === it)?.label || it}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div></InfoErrorBoundary>
          )}

          {/* ═══ NUTRITION V7 TAB ═══ */}
          {tab === 'nutrition_v7' && (
            <InfoErrorBoundary label="Нутрициология v7"><div>
              <div style={glassCard}>
                <div style={sectionLabel}>Параметры питания V7</div>
                <p style={{ fontSize:10, color: apple.textDim, margin:'4px 0 10px' }}>Эти параметры используются V7 риск-движком для расчёта рисков.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Белок, г/кг', key:'proteinPerKg', hint:'1.6-2.2 г/кг' },
                    { label:'Клетчатка, г/д', key:'fiberG', hint:'25-35 г/день' },
                    { label:'Омега-3, г/д', key:'omega3G', hint:'1.5-3 г' },
                    { label:'Натрий, г/д', key:'sodiumG', hint:'2.3-4 г' },
                    { label:'Калий, г/д', key:'potassiumG', hint:'2.6-3.4 г' },
                  ].map(f => (
                    <div key={f.key}>
                      <span style={{ fontSize:10, color: apple.textDim }}>{f.label}</span>
                      <input style={appleInput} type="number" step="0.1" value={(settings as any)[f.key] || ''} onChange={e => save({ [f.key]: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} placeholder={f.hint} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Образ жизни (V7)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Алкоголь, доз/нед', key:'alcoholPerWeek' },
                    { label:'Уровень стресса', key:'stressLevel' },
                    { label:'Уровень активности', key:'activityLevel' },
                    { label:'Сон, ч/ночь', key:'sleepHours' },
                  ].map(f => (
                    <div key={f.key}>
                      <span style={{ fontSize:10, color: apple.textDim }}>{f.label}</span>
                      <input style={appleInput} type="number" step="1" value={(settings as any)[f.key] || ''} onChange={e => save({ [f.key]: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:10 }}>
                  <span style={{ fontSize:11, color: apple.textDim }}>Курение</span>
                  <button onClick={() => save({ smoke: !settings.smoke })} style={{
                    ...pillBtn(false),
                    background: settings.smoke ? 'rgba(239,68,68,0.15)' : apple.accentDim,
                    borderColor: settings.smoke ? '#ef4444' : apple.accent,
                    color: settings.smoke ? '#ef4444' : apple.accent,
                  }}>{settings.smoke ? 'Курю' : 'Не курю'}</button>
                </div>
              </div>

              <div style={glassCard}>
                <div style={sectionLabel}>Тренировочные параметры (V7)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div><span style={{ fontSize:10, color: apple.textDim }}>HIIT</span>
                    <button onClick={() => save({ hasHIIT: !settings.hasHIIT })} style={{ ...pillBtn(!!settings.hasHIIT), marginTop:4 }}>{settings.hasHIIT ? 'Да' : 'Нет'}</button>
                  </div>
                  <div><span style={{ fontSize:10, color: apple.textDim }}>Объём, т/нед</span><input style={appleInput} type="number" value={settings.volumeTonnes || ''} onChange={e => save({ volumeTonnes: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} /></div>
                  <div><span style={{ fontSize:10, color: apple.textDim }}>LISS, мин/нед</span><input style={appleInput} type="number" value={settings.lissMinutesPerWeek || ''} onChange={e => save({ lissMinutesPerWeek: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} /></div>
                  <div><span style={{ fontSize:10, color: apple.textDim }}>Курсов ААС</span><input style={appleInput} type="number" value={settings.totalCycles || ''} onChange={e => save({ totalCycles: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} /></div>
                </div>
              </div>
            </div></InfoErrorBoundary>
          )}

          {/* ═══ GENETICS TAB ═══ */}
          {tab === 'genetics' && (
            <InfoErrorBoundary label="Генетика"><div style={glassCard}>
              <div style={sectionLabel}>Генетические полиморфизмы</div>
              <p style={{ fontSize:10, color: apple.textDim, margin:'4px 0 10px' }}>Укажите ваши генетические варианты, если известны. Они влияют на расчёт рисков в V7 движке.</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8 }}>
                {([
                  { key:'COMT', label:'COMT', options:['Met/Met','Val/Met','Val/Val'] },
                  { key:'MTHFR', label:'MTHFR', options:['C677T/C677T','C677T/A1298C','A1298C/A1298C','C677T/+','A1298C/+','+/+' ] },
                  { key:'ESR1', label:'ESR1', options:['PvuII TT','PvuII TC','PvuII CC'] },
                  { key:'AGTR1', label:'AGTR1', options:['1166CC','1166AC','1166AA'] },
                  { key:'NOS3', label:'NOS3', options:['Glu298Glu','Glu298Asp','Asp298Asp'] },
                  { key:'SRD5A2', label:'SRD5A2', desc:'5α-редуктаза', options:['V89L V/V','V89L V/L','V89L L/L'] },
                  { key:'CYP3A4', label:'CYP3A4', options:['*1/*1 (WT)','*1/*22','*22/*22'] },
                ] as const).map(gene => (
                  <div key={gene.key} style={{ background:'rgba(255,255,255,0.02)', padding:10, borderRadius:10, border:apple.glassBorder }}>
                    <div style={{ fontWeight:600, fontSize:12, color:apple.textPrimary, marginBottom:1 }}>{gene.label}</div>
                    {(gene as any).desc && <div style={{ fontSize:9, color:apple.textDim, marginBottom:4 }}>{(gene as any).desc}</div>}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <button onClick={() => { const g = {...(settings.genetics ?? {})}; delete g[gene.key]; save({ genetics: g }); }} style={pillBtn(!(settings.genetics ?? {})[gene.key])}>Не знаю</button>
                      {gene.options.map(opt => (
                        <button key={opt} onClick={() => { const g = {...(settings.genetics ?? {})}; g[gene.key] = opt; save({ genetics: g }); }} style={pillBtn((settings.genetics ?? {})[gene.key] === opt)}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div></InfoErrorBoundary>
          )}

          {/* ═══ INJURIES TAB ═══ */}
          {tab === 'injuries' && (
            <InfoErrorBoundary label="Травмы">
              <div style={glassCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={sectionLabel}>Травмы</div>
                  <button style={pillBtn(true)} onClick={addInjury}>+ Добавить</button>
                </div>
              </div>
              {(settings.injuries ?? []).map(inj => (
                <div key={inj.id} style={glassCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <strong style={{ fontSize:12, color: apple.textPrimary }}>{inj.location} — {INJURY_TYPES.find(t => t.id === inj.type)?.label ?? inj.type}</strong>
                    <div style={{ display:'flex', gap:4 }}>
                      <button style={pillBtn(false)} onClick={() => setEditInjury(inj)}>Ред.</button>
                      <button style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#ef4444', fontSize:10, cursor:'pointer' }} onClick={() => deleteInjury(inj.id)}>Удалить</button>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color: apple.textSecondary }}>
                    Боль: {inj.painLevel}/10 | Ограничение: {MOVEMENT_LIMITS.find(m => m.id === inj.movementLimit)?.label} | Сторона: {inj.side === 'left' ? 'Левая' : inj.side === 'right' ? 'Правая' : 'Обе'} | {inj.chronic ? 'Хроническая' : 'Острая'}
                  </div>
                  {inj.notes && <div style={{ fontSize:10, color: apple.textDim, marginTop:4 }}>{inj.notes}</div>}
                </div>
              ))}
              {editInjury && (
                <div style={{ ...glassCard, border: apple.accentBorder }}>
                  <div style={sectionLabel}>{editInjury.id && (settings.injuries ?? []).find(i => i.id === editInjury.id) ? 'Редактирование' : 'Новая травма'}</div>
                  <div style={{ marginTop:8 }}>
                    <span style={sectionLabel}>Тип</span>
                    <div style={{ display:'flex', gap:4, marginTop:2 }}>{INJURY_TYPES.map(t => <button key={t.id} style={pillBtn(editInjury.type === t.id)} onClick={() => setEditInjury({ ...editInjury, type: t.id })}>{t.label}</button>)}</div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <span style={sectionLabel}>Локализация</span>
                    <select style={appleInput} value={editInjury.location} onChange={e => setEditInjury({ ...editInjury, location: e.target.value })}>
                      {INJURY_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span style={sectionLabel}>Боль</span><span style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>{editInjury.painLevel}/10</span></div>
                    <input style={appleSlider} type="range" min="1" max="10" value={editInjury.painLevel} onChange={e => setEditInjury({ ...editInjury, painLevel: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div style={{ marginTop:8 }}>
                    <span style={sectionLabel}>Ограничение движений</span>
                    <div style={{ display:'flex', gap:4, marginTop:2 }}>{MOVEMENT_LIMITS.map(m => <button key={m.id} style={pillBtn(editInjury.movementLimit === m.id)} onClick={() => setEditInjury({ ...editInjury, movementLimit: m.id })}>{m.label}</button>)}</div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <span style={sectionLabel}>Сторона</span>
                    <div style={{ display:'flex', gap:4, marginTop:2 }}>
                      {[{ id:'left', label:'Левая' }, { id:'right', label:'Правая' }, { id:'both', label:'Обе' }].map(x => <button key={x.id} style={pillBtn(editInjury.side === x.id)} onClick={() => setEditInjury({ ...editInjury, side: x.id as any })}>{x.label}</button>)}
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:8 }}>
                    <div><span style={sectionLabel}>Дата</span><input style={appleInput} type="date" value={editInjury.date ?? ''} onChange={e => setEditInjury({ ...editInjury, date: e.target.value })} /></div>
                    <div>
                      <span style={sectionLabel}>Хроническая</span>
                      <div style={{ display:'flex', gap:4, marginTop:2 }}>
                        <button style={pillBtn(editInjury.chronic)} onClick={() => setEditInjury({ ...editInjury, chronic: true })}>Да</button>
                        <button style={pillBtn(!editInjury.chronic)} onClick={() => setEditInjury({ ...editInjury, chronic: false })}>Нет</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop:8 }}><span style={sectionLabel}>Заметки</span><textarea style={{ ...appleInput, minHeight:50 }} value={editInjury.notes ?? ''} onChange={e => setEditInjury({ ...editInjury, notes: e.target.value })} /></div>
                  <button onClick={() => saveInjury(editInjury)} style={{
                    width:'100%', padding:'10px', borderRadius:12, marginTop:10, cursor:'pointer',
                    background: apple.gradientGreen, border:'none', color:'#000', fontWeight:700, fontSize:13,
                  }}>Сохранить</button>
                  <button onClick={() => setEditInjury(null)} style={{
                    ...pillBtn(false), width:'100%', marginTop:6, textAlign:'center' as const,
                  }}>Отмена</button>
                </div>
              )}
            </InfoErrorBoundary>
          )}

          {/* ═══ PROGRESS TAB ═══ */}
          {tab === 'progress' && (
          <InfoErrorBoundary label="Прогресс">
            {/* Weight goal + line chart */}
            <div style={glassCard}>
              <div style={sectionLabel}>Прогресс веса</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <span style={{ fontSize:10, color: apple.textDim }}>Текущий вес</span>
                  <div style={{ fontSize:24, fontWeight:800, color: apple.accent }}>{settings.weight} <span style={{ fontSize:12, fontWeight:400, color: apple.textDim }}>кг</span></div>
                </div>
                <div>
                  <span style={{ fontSize:10, color: apple.textDim }}>Целевой вес</span>
                  <input style={appleInput} type="number" value={settings.targetWeight || ''} onChange={e => save({ targetWeight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} placeholder="75" />
                </div>
              </div>
              {settings.targetWeight && settings.weight && (
                <div>
                  <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
                    <div style={{
                      height:'100%', borderRadius:3,
                      background: apple.gradientGreen,
                      width:`${Math.min(100, Math.max(0, Math.round((1 - Math.abs(settings.weight - settings.targetWeight) / Math.max(1, Math.abs(settings.targetWeight))) * 100)))}%`,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                  <div style={{ fontSize:11, color: apple.textSecondary, textAlign:'center' }}>
                    {Math.round((1 - Math.abs(settings.weight - settings.targetWeight) / Math.max(1, Math.abs(settings.targetWeight))) * 100)}% к цели
                  </div>
                </div>
              )}
            </div>

            {/* Weight trend line chart (SVG) */}
            {weightLog.length > 2 && (
              <div style={glassCard}>
                <div style={sectionLabel}>График веса</div>
                <div style={{ position:'relative', height:120, marginTop:8 }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${weightLog.length - 1} 100`} preserveAspectRatio="none" style={{ position:'absolute', inset:0 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00e68a" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00e68a" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const minW = Math.min(...weightLog.map(w => w.weight)) - 1;
                      const maxW = Math.max(...weightLog.map(w => w.weight)) + 1;
                      const range = maxW - minW || 1;
                      const pts = weightLog.map((e, i) => `${i * (100/(weightLog.length-1))},${100 - ((e.weight - minW) / range) * 100}`).join(' ');
                      const areaPts = `0,100 ${pts} ${weightLog.length-1},100`;
                      return <><polygon points={areaPts} fill="url(#weightGrad)" /><polyline points={pts} fill="none" stroke="#00e68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>;
                    })()}
                  </svg>
                  <div style={{ display:'flex', justifyContent:'space-between', position:'absolute', bottom:0, width:'100%', fontSize:8, color: apple.textDim, paddingTop:4 }}>
                    <span>{weightLog[0]?.date?.slice(5)}</span>
                    <span>{weightLog[weightLog.length-1]?.date?.slice(5)}</span>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color: apple.textDim, marginTop:4 }}>
                  <span>Мин: {Math.min(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
                  <span style={{ color: apple.accent, fontWeight:600 }}>Тек: {weightLog[weightLog.length-1]?.weight?.toFixed(1)} кг</span>
                  <span>Макс: {Math.max(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
                </div>
                {/* Trend indicator */}
                {(() => {
                  const firstW = weightLog[0]?.weight;
                  const lastW = weightLog[weightLog.length-1]?.weight;
                  if (firstW && lastW && weightLog.length >= 7) {
                    const diff = lastW - firstW;
                    const color = diff > 0.5 ? '#f59e0b' : diff < -0.5 ? '#00e68a' : '#3b82f6';
                    const arrow = diff > 0.5 ? '↑' : diff < -0.5 ? '↓' : '→';
                    return <div style={{ marginTop:4, fontSize:10, color, fontWeight:600, textAlign:'center' }}>{arrow} {diff > 0 ? '+' : ''}{diff.toFixed(1)} кг за период</div>;
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Body measurements cards */}
            <div style={glassCard}>
              <div style={sectionLabel}>Обхваты</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { k:'waistCm', l:'Талия', unit:'см' },
                  { k:'chestCm', l:'Грудь', unit:'см' },
                  { k:'bicepCm', l:'Бицепс', unit:'см' },
                  { k:'thighCm', l:'Бедро', unit:'см' },
                  { k:'hipCm', l:'Бёдра', unit:'см' },
                  { k:'neckCm', l:'Шея', unit:'см' },
                ].map(m => {
                  const val = (settings as any)[m.k];
                  return (
                    <div key={m.k} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 8px', textAlign:'center', border: apple.glassBorder }}>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:2 }}>{m.l}</div>
                      <div style={{ fontSize:16, fontWeight:700, color: val ? apple.textPrimary : apple.textSecondary }}>{val ? `${val}` : '—'}<span style={{ fontSize:9, fontWeight:400, marginLeft:2, color: apple.textDim }}>{val ? m.unit : ''}</span></div>
                    </div>
                  );
                })}
              </div>
              {/* Save measurements button */}
              <button onClick={() => {
                const entry: MeasurementEntry = {
                  date: new Date().toISOString().split('T')[0],
                  waistCm: settings.waistCm || 0, chestCm: settings.chestCm || 0,
                  hipCm: settings.hipCm || 0, bicepCm: settings.bicepCm || 0,
                  thighCm: settings.thighCm || 0, neckCm: settings.neckCm || 0,
                  forearmCm: settings.forearmCm || 0, bodyFat: settings.bodyFat || 0,
                };
                const log = getMeasurementsLog();
                log.push(entry);
                localStorage.setItem(MEASUREMENTS_LOG_KEY, JSON.stringify(log.slice(-30)));
                alert('Замеры сохранены');
              }} style={{ ...pillBtn(false), marginTop:10, width:'100%' }}>Сохранить текущие замеры</button>
            </div>

            {/* FFMI trend */}
            {ffmi && (
              <div style={glassCard}>
                <div style={sectionLabel}>FFMI анализ</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>Текущий FFMI</div>
                    <div style={{ fontSize:22, fontWeight:800, color: '#8b5cf6' }}>{ffmi}</div>
                    <div style={{ fontSize:10, color: apple.textSecondary, marginTop:2 }}>{ffmiCategory}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>LBM</div>
                    <div style={{ fontSize:22, fontWeight:800, color: '#3b82f6' }}>{lbm || '—'}<span style={{ fontSize:11, fontWeight:400 }}> кг</span></div>
                    <div style={{ fontSize:10, color: apple.textSecondary, marginTop:2 }}>Сухая масса</div>
                  </div>
                </div>
                {/* FFMI gauge */}
                <div style={{ marginTop:10, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:10, color: apple.textDim, marginBottom:4 }}>Шкала FFMI</div>
                  <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', position:'relative', overflow:'visible' }}>
                    {[
                      { pos:0, color:'#f97316', label:'<18' },
                      { pos:25, color:'#f59e0b', label:'18-20' },
                      { pos:50, color:'#3b82f6', label:'20-22' },
                      { pos:75, color:'#00e68a', label:'22-25' },
                      { pos:95, color:'#ef4444', label:'25+' },
                    ].map(s => (
                      <div key={s.pos} style={{ position:'absolute', left:`${s.pos}%`, top:-0, width:3, height:4, borderRadius:1, background:s.color }} />
                    ))}
                    {ffmi && parseFloat(ffmi) > 0 && (
                      <div style={{
                        position:'absolute',
                        left:`${Math.min(98, Math.max(2, ((parseFloat(ffmi) - 15) / 15) * 100))}%`,
                        top:-5, width:12, height:12, borderRadius:'50%',
                        background: apple.gradientGreen, border:'2px solid rgba(0,0,0,0.3)',
                        boxShadow: '0 0 8px rgba(0,230,138,0.4)',
                      }} />
                    )}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color: apple.textDim, marginTop:2 }}>
                    <span>15</span><span>18</span><span>20</span><span>22</span><span>25</span><span>30</span>
                  </div>
                </div>
              </div>
            )}

            {/* Target body fat */}
            <div style={glassCard}>
              <div style={{ marginTop:0 }}>
                <span style={sectionLabel}>Целевой % жира</span>
                <input style={appleInput} type="number" step="0.1" value={settings.targetBodyFat || ''} onChange={e => save({ targetBodyFat: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} placeholder="12" />
              </div>
              {labIndices && labIndexText && (
                <div style={{ marginTop:12 }}>
                  <div style={sectionLabel}>Индексы лабораторий</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {(['inflammation','metabolism','thyroid','lipids'] as const).map(k => {
                      const val = labIndices[k];
                      const neededCodes: Record<string, string[]> = { inflammation:['CRP','FERRITIN'], metabolism:['GLU','GLUCOSE','HbA1c','HBA1C'], thyroid:['TSH','FT4','FT3'], lipids:['LDL','HDL','TG'] };
                      const hasData = val > 0 || (neededCodes[k] || []).some(c => labs.some(l => l.code.toUpperCase() === c));
                      const emojis: Record<string, string> = { inflammation:'Воспаление', metabolism:'Метаболизм', thyroid:'Щитовидная', lipids:'Липиды' };
                      return (
                        <div key={k} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                          <div style={{ fontSize:9, color: apple.textDim }}>{emojis[k]}</div>
                          <div style={{ fontSize:15, fontWeight:700 }}>{hasData ? `${(val * 100).toFixed(0)}%` : '—'}</div>
                          <div style={{ fontSize:9, color: apple.textDim }}>{hasData ? labIndexText[k] : 'Нет данных'}</div>
                        </div>
                      );
                  })}
                </div>
              </div>
            )}
            </div>

            <div style={{ ...glassCard, marginTop:10 }}>
              <div style={sectionLabel}>Слабые органы</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                {ORGAN_WEAKNESSES.map(o => {
                  const ci = getContraindications();
                  const active = (ci.organWeaknesses ?? []).includes(o.id);
                  return <button key={o.id} onClick={() => { const cur = ci.organWeaknesses ?? []; const upd = active ? cur.filter(x => x !== o.id) : [...cur, o.id]; saveContraindications({ organWeaknesses: upd }); }} style={pillBtn(active)}>{o.label}</button>;
                })}
              </div>
            </div>

            <div style={{ ...glassCard, marginTop:10 }}>
              <div style={sectionLabel}>Генетические полиморфизмы</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                {GENETIC_POLYMORPHISMS.map(g => {
                  const ci = getContraindications();
                  const active = (ci.geneticPolymorphisms ?? []).includes(g.id);
                  return <button key={g.id} onClick={() => { const cur = ci.geneticPolymorphisms ?? []; const upd = active ? cur.filter(x => x !== g.id) : [...cur, g.id]; saveContraindications({ geneticPolymorphisms: upd }); }} style={pillBtn(active)}>{g.label}</button>;
                })}
              </div>
            </div>
          </InfoErrorBoundary>
          )}

          {/* ═══ ANALYTICS TAB ═══ */}
          {tab === 'analytics' && <InfoErrorBoundary label="Аналитика">{(() => {
            const bmiVal = settings.weight && settings.height ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : '—';
            const lbmVal = settings.weight && settings.bodyFat ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : '—';
            const ffmiVal = lbmVal !== '—' && settings.height ? (parseFloat(lbmVal) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : '—';
            const riskData = (() => { try { return JSON.parse(localStorage.getItem('he_last_risk') || 'null'); } catch { return null; } })();
            const suppsList = (settings.currentSupplements || []).map((x: any) => `${x.name || x.label}${x.doseMg ? ` ${x.doseMg}${x.doseUnit || 'mg'}` : ''}`).join(', ') || 'нет';
            const medsList = (settings.currentMedications || []).map((x: any) => `${x.name}${x.doseMg ? ` ${x.doseMg}${x.doseUnit || 'mg'} ${x.frequency || ''}` : ''}`).join(', ') || 'нет';
            const chronicList = (settings.chronicConditions || []).map(c => CHRONIC_CONDITIONS.find(cc => cc.id === c)?.label || c).join(', ') || 'нет';
            const goalLabelR = GOALS.find(g => g.id === (settings.primaryGoal || settings.goal))?.label || 'не указана';
            const labsList = labs.map(l => `${l.code}: ${l.value} ${l.unit}`).join('\n  ') || 'нет данных';
            const last3Workouts = workoutLogs.slice(0, 3);
            const workoutSummary = last3Workouts.length > 0
              ? last3Workouts.map(w => `  • ${w.date} | Сплит: ${w.split} | RPE: ${w.overallRPE} | Упр: ${w.exercises.length} | Объём: ${w.exercises.reduce((s, e) => s + e.totalVolume, 0).toFixed(0)} кг`).join('\n')
              : '  — нет записей';
            const programName = localStorage.getItem('he_current_program') || 'не задана';
            const measurements = getMeasurementsLog();
            const last3Meas = measurements.slice(-3);
            const measSummary = last3Meas.length > 0
              ? last3Meas.map(m => `  • ${m.date}: Тал:${m.waistCm || '—'} Гр:${m.chestCm || '—'} Биц:${m.bicepCm || '—'} Бед:${m.thighCm || '—'} Бёд:${m.hipCm || '—'} Жир:${m.bodyFat || '—'}%`).join('\n')
              : '  — нет записей';

            const trainerReport = [
              `═`.repeat(40),
              `  Отчет для тренера`,
              `═`.repeat(40),
              ``,
              `ОСНОВНАЯ ИНФОРМАЦИЯ`,
              `  Имя: ${profile.name || '—'}`,
              `  Возраст: ${settings.age || '—'} лет | Пол: ${settings.sex === 'male' ? 'муж' : 'жен'}`,
              `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
              `  BMI: ${bmiVal} | FFMI: ${ffmiVal} | BF%: ${settings.bodyFat || '—'}%`,
              ``,
              `ЦЕЛЬ И ОПЫТ`,
              `  Цель: ${goalLabelR}`,
              `  Стаж тренировок: ${settings.trainingExperience || '—'} лет`,
              `  Уровень: ${settings.trainingLevel || '—'}`,
              `  Спорт: ${SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—'}`,
              ``,
              `ТРЕНИРОВОЧНЫЕ ПАРАМЕТРЫ`,
              `  Частота: ${settings.workoutsPerWeek || '—'} тренировок/нед`,
              `  Длительность: ${settings.avgWorkoutMinutes || '—'} мин/тренировка`,
              `  Недельный объём: ~${(settings.workoutsPerWeek || 0) * (settings.avgWorkoutMinutes || 0)} мин/нед`,
              `  Программа: ${programName}`,
              `  Текущий сплит: ${workoutLogs.length > 0 ? (workoutLogs[0].split || 'не указан') : ((() => { try { const ap = JSON.parse(localStorage.getItem('activeProgram') || 'null'); return ap?.weeks?.[0]?.days?.[0]?.name || ap?.name || 'не задан'; } catch { return 'не задан'; } })())}`,
              `  Последняя тренировка: ${workoutLogs.length > 0 ? workoutLogs[0].date : 'нет записей'}`,
              `  Объём за неделю: ${(() => { const last7 = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]; const wkLogs = workoutLogs.filter(w => w.date >= last7); const wkVol = wkLogs.reduce((s, w) => s + w.exercises.reduce((ss, e) => ss + e.totalVolume, 0), 0); return wkVol > 0 ? `${wkVol.toFixed(0)} кг` : 'нет данных'; })()}`,
              ``,
              `ПОСЛЕДНИЕ ТРЕНИРОВКИ (${last3Workouts.length})`,
              workoutSummary,
              ``,
              `ФАЗА КУРСА`,
              `  ${COURSE_PHASES.find(p => p.id === settings.phase)?.label || 'База'}${settings.courseStartDate ? ` (с ${settings.courseStartDate})` : ''}`,
              ``,
              `ПРОГРЕСС ВЕСА`,
              `  Текущий: ${settings.weight || '—'} кг | Целевой: ${settings.targetWeight || '—'} кг`,
              `  Изменений в логе: ${weightLog.length}`,
              ``,
              `  Дата: ${new Date().toLocaleDateString('ru')}`,
              `═`.repeat(40),
            ].join('\n');

            const RISK_SYSTEMS = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];
            const RISK_LABELS_MAP: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'Опорно-дв.' };
            const sysLabels: Record<string, string> = {
              cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС',
              endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'Опорно-дв.',
            };

            const doctorReport = [
              `═`.repeat(40),
              `  Отчет для врача`,
              `═`.repeat(40),
              ``,
              `ПАЦИЕНТ`,
              `  Имя: ${profile.name || '—'}`,
              `  Возраст: ${settings.age || '—'} лет | Пол: ${settings.sex === 'male' ? 'мужской' : 'женский'}`,
              `  Группа крови: ${settings.bloodType || '—'}`,
              `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см | BMI: ${bmiVal}`,
              `  Аллергии: ${settings.allergyNotes || 'нет'}`,
              ``,
              `ЛАБОРАТОРНЫЕ АНАЛИЗЫ`,
              `  ${labsList}`,
              `  Последние анализы: ${labs.length > 0 ? labs.sort((a,b) => b.date.localeCompare(a.date)).slice(0,5).map(l => `${l.code} ${l.value}${l.unit} (${l.date})`).join(', ') : 'нет данных'}`,
              ``,
              `РИСКИ ПО СИСТЕМАМ`,
              ...(riskData?.systemBreakdown
                ? RISK_SYSTEMS.map(sys => {
                    const v = riskData.systemBreakdown[sys];
                    const pct = v?.net !== undefined ? `${v.net}%` : '—';
                    const bar = v?.net !== undefined ? '█'.repeat(Math.round(v.net / 10)) : '';
                    const status = v?.net < 20 ? 'OK' : v?.net < 40 ? 'ВНИМАНИЕ' : v?.net < 60 ? 'РИСК' : 'ОПАСНОСТЬ';
                    return `  ${(RISK_LABELS_MAP[sys] || sysLabels[sys] || sys).padEnd(12)} ${pct.padEnd(6)} ${status.padEnd(10)} ${bar}`;
                  })
                : ['  — нет данных']),
              ``,
              `МЕДИКАМЕНТОЗНАЯ ТЕРАПИЯ`,
              `  Препараты на курсе: ${medsList}`,
              `  БАДы и поддержка: ${suppsList}`,
              ...(riskData?.systemSupport ? RISK_SYSTEMS.filter(sys => riskData.systemSupport[sys] !== undefined).map(sys => `    ${(RISK_LABELS_MAP[sys] || sysLabels[sys] || sys).padEnd(20)} покрытие ${Math.round(riskData.systemSupport[sys])}%`) : []),
              `  Общее покрытие поддержки: ${riskData?.totalSupport ? Math.round(riskData.totalSupport) + '%' : '—'}`,
              ``,
              `ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ`,
              `  ${chronicList}`,
              ``,
              `ЭКСТРЕННЫЙ КОНТАКТ`,
              `  ${settings.emergencyName || '—'} / ${settings.emergencyPhone || '—'}`,
              ``,
              `  Дата: ${new Date().toLocaleDateString('ru')}`,
              `═`.repeat(40),
            ].join('\n');

            const generalReport = [
              `═`.repeat(40),
              `  Общий отчет BodyBuildHealth`,
              `═`.repeat(40),
              ``,
              `ПРОФИЛЬ`,
              `  ${profile.name || '—'} | ${settings.age || '—'} лет | ${settings.sex === 'male' ? 'М' : 'Ж'}`,
              `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
              `  BMI: ${bmiVal} | FFMI: ${ffmiVal} | BF%: ${settings.bodyFat || '—'}%`,
              ``,
              `ТРЕНИРОВКИ`,
              `  Спорт: ${SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—'}`,
              `  Стаж: ${settings.trainingExperience || '—'} лет | Уровень: ${settings.trainingLevel || '—'}`,
              `  Цель: ${goalLabelR}`,
              `  ${settings.workoutsPerWeek || '—'} трен/нед × ${settings.avgWorkoutMinutes || '—'} мин`,
              `  Программа: ${programName}`,
              ``,
              `ПИТАНИЕ`,
              `  Тип: ${DIET_TYPES.find(d => d.id === settings.dietType)?.label || '—'}`,
              `  Приёмы: ${settings.mealsPerDay || '—'} в день`,
              ...(foodDiaryAvg ? [
                `  Среднее (7 дней): ${foodDiaryAvg.avgKcal} ккал | Б:${foodDiaryAvg.avgProtein}г Ж:${foodDiaryAvg.avgFat}г У:${foodDiaryAvg.avgCarbs}г`,
              ] : ['  Среднее: нет данных']),
              ...(function(){try{var r=JSON.parse(localStorage.getItem('he_nutrition_report_archive')||'[]')[0];if(!r)return [];var g=r.overallGrade||'-',kc=r.kbjuPct?.kcal||'-',kp=r.kbjuPct?.p||'-',kf=r.kbjuPct?.f||'-',kc2=r.kbjuPct?.c||'-',defs=(r.microDeficiencies||[]).slice(0,3).join(', ')||'нет';return ['  Оценка: '+g+' | КБЖУ '+kc+'%/'+kp+'%/'+kf+'%/'+kc2+'%','  Дефициты: '+defs]}catch{return[]}})(),
              ``,
              `ФАРМАКОЛОГИЯ И ПОДДЕРЖКА`,
              `  Фаза: ${COURSE_PHASES.find(p => p.id === settings.phase)?.label || 'База'}`,
              `  Препараты: ${medsList}`,
              `  БАДы: ${suppsList}`,
              ...(riskData?.systemSupport ? RISK_SYSTEMS.filter(sys => riskData.systemSupport[sys] !== undefined).map(sys => `    ${sysLabels[sys] || sys}: покрытие ${Math.round(riskData.systemSupport[sys])}%`) : []),
              `  Покрытие поддержки: ${riskData?.totalSupport ? Math.round(riskData.totalSupport) + '%' : '—'}`,
              ...(function(){try{var r=JSON.parse(localStorage.getItem('he_profile_support_reports')||'[]')[0];if(!r)return[];return['  Отчёт поддержки: '+r.grade+' | Риск '+r.overallNet+'/100 | '+r.compoundsCount+' соединений, '+r.supportCount+' в поддержке']}catch{return[]}})(),
              ``,
              `АНАЛИЗЫ`,
              `  ${labsList}`,
              ``,
              `РИСК`,
              `  Общий: ${riskData?.overallNet || '—'}%`,
              ...(riskData?.systemBreakdown
                ? RISK_SYSTEMS.filter(sys => riskData.systemBreakdown[sys]?.net > 0).map(sys => `  ${sysLabels[sys] || sys}: ${riskData.systemBreakdown[sys].net}%`)
                : []),
              ``,
              `ЗАМЕРЫ (последние 3)`,
              measSummary,
              ``,
              `ЗДОРОВЬЕ`,
              `  Кровь: ${settings.bloodType || '—'} | Хроника: ${chronicList}`,
              `  Экстренный: ${settings.emergencyName || '—'} / ${settings.emergencyPhone || '—'}`,
              ``,
              `  Дата: ${new Date().toLocaleDateString('ru')}`,
              `═`.repeat(40),
            ].join('\n');

            const copyReport = (text: string) => {
              navigator.clipboard?.writeText(text).then(() => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg?.showPopup) tg.showPopup({ title: 'Скопировано', message: 'Отчёт скопирован в буфер обмена' });
              });
            };
            const sendReport = (text: string) => {
              const tg = (window as any).Telegram?.WebApp;
              if (tg?.sendData) {
                tg.sendData(JSON.stringify({ type: 'share_report', report: text }));
              } else {
                copyReport(text);
              }
            };

            return (
              <div>
                {/* Analytics sub-tabs: Отчёты / Дневник прогресса */}
                <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                  {[['reports','📄 Отчёты'],['progress','📈 Дневник прогресса']].map(([id,label]) => (
                    <button key={id} onClick={() => setAnalyticsSubTab(id as any)} style={{
                      padding:'6px 14px', borderRadius:16, fontSize:10, fontWeight:700, cursor:'pointer', border:'none',
                      background: analyticsSubTab === id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: analyticsSubTab === id ? '#000' : 'rgba(255,255,255,0.85)',
                    }}>{label}</button>
                  ))}
                </div>
                {analyticsSubTab === 'progress' ? (
                  /* PROGRESS CONTENT (inlined from old progress tab) */
                  <div>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:20 }}>⚖️</span>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)' }}>Вес</div>
                          <div style={{ fontSize:18, fontWeight:800, color:'var(--accent)' }}>{settings.weight || '—'} <span style={{ fontSize:10, color:'var(--text-dim)', fontWeight:400 }}>кг</span></div>
                        </div>
                        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:9, color:'var(--text-dim)' }}>Цель:</span>
                          <input type="number" value={settings.targetWeight || ''} onChange={e => save({ targetWeight: Number(e.target.value) })} style={{ width:50, padding:'3px 6px', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:10, textAlign:'center' }} />
                          <span style={{ fontSize:9, color:'var(--text-dim)' }}>кг</span>
                        </div>
                      </div>
                      {weightLog.length > 0 && <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Записей: {weightLog.length} | Мин: {Math.min(...weightLog.map(w=>w.weight)).toFixed(1)} | Тек: {weightLog[weightLog.length-1].weight.toFixed(1)} | Макс: {Math.max(...weightLog.map(w=>w.weight)).toFixed(1)}</div>}
                      {weightLog.length > 2 && <div style={{ width:'100%', height:40, marginBottom:4 }}>
                        <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
                          <defs><linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00e68a" stopOpacity="0.3"/><stop offset="100%" stopColor="#00e68a" stopOpacity="0"/></linearGradient></defs>
                          <polyline fill="none" stroke="#00e68a" strokeWidth="1.5" points={weightLog.map((w,i)=>`${(i/(weightLog.length-1))*100},${(1-(w.weight-Math.min(...weightLog.map(w=>w.weight)))/Math.max(1,Math.max(...weightLog.map(w=>w.weight))-Math.min(...weightLog.map(w=>w.weight))))*35}`).join(' ')}/>
                          <polygon fill="url(#wgrad)" points={`0,35 ${weightLog.map((w,i)=>`${(i/(weightLog.length-1))*100},${(1-(w.weight-Math.min(...weightLog.map(w=>w.weight)))/Math.max(1,Math.max(...weightLog.map(w=>w.weight))-Math.min(...weightLog.map(w=>w.weight))))*35}`).join(' ')} 100,35`}/>
                        </svg>
                      </div>}
                    </div>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:8 }}>📏 Замеры тела</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:8 }}>
                        {[['waist','Талия',settings.waistCm],['chest','Грудь',settings.chestCm],['bicep','Бицепс',settings.bicepCm],['thigh','Бедро',settings.thighCm],['hip','Бёдра',settings.hipCm],['neck','Шея',settings.neckCm]].map(([key,label,val]) => (
                          <div key={key} style={{ padding:'6px', borderRadius:6, background:'rgba(167,139,250,0.04)', border:'1px solid rgba(167,139,250,0.08)', textAlign:'center' }}>
                            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{label}</div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#a78bfa' }}>{val || '—'}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        const meas = getMeasurementsLog();
                        meas.push({ date: new Date().toISOString().split('T')[0], waistCm: settings.waistCm || 0, chestCm: settings.chestCm || 0, bicepCm: settings.bicepCm || 0, thighCm: settings.thighCm || 0, hipCm: settings.hipCm || 0, bodyFat: settings.bodyFat || 0, neckCm: settings.neckCm || 0, forearmCm: 0 });
                        localStorage.setItem('he_measurements_log', JSON.stringify(meas.slice(-30)));
                      }} style={{ width:'100%', padding:'7px', borderRadius:8, border:'none', cursor:'pointer', background:'rgba(167,139,250,0.1)', color:'#a78bfa', fontWeight:700, fontSize:10 }}>💾 Сохранить текущие замеры</button>
                    </div>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:12, marginBottom:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🏋️ FFMI</div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{ffmiVal}<span style={{ fontSize:10, color:'var(--text-dim)', fontWeight:400, marginLeft:4 }}>кг/м²</span></div>
                      <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{ffmiCategory || '—'}</div>
                      <div style={{ marginTop:6, position:'relative', height:6, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                        <div style={{ position:'absolute', top:-8, left:'15%', fontSize:7, color:'var(--text-dim)' }}>15</div>
                        <div style={{ position:'absolute', top:-8, left:'35%', fontSize:7, color:'var(--text-dim)' }}>20</div>
                        <div style={{ position:'absolute', top:-8, left:'55%', fontSize:7, color:'var(--text-dim)' }}>25</div>
                        <div style={{ position:'absolute', top:-8, left:'75%', fontSize:7, color:'var(--text-dim)' }}>30</div>
                        {ffmiVal !== '—' && <div style={{ position:'absolute', bottom:-2, left:`${Math.min(90, Math.max(1, parseFloat(ffmiVal) * 3))}%`, width:8, height:8, borderRadius:'50%', background:'var(--accent)', transform:'translateX(-50%)' }} />}
                      </div>
                    </div>
                  </div>
                ) : (
                <div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => setReportTab('current')} style={{
                      padding:'6px 14px', borderRadius:16, fontSize:10, fontWeight:700, cursor:'pointer',
                      background: reportTab === 'current' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: reportTab === 'current' ? '#000' : 'rgba(255,255,255,0.85)',
                      border: 'none',
                    }}>📋 Текущие</button>
                    <button onClick={() => setReportTab('archive')} style={{
                      padding:'6px 14px', borderRadius:16, fontSize:10, fontWeight:700, cursor:'pointer',
                      background: reportTab === 'archive' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: reportTab === 'archive' ? '#000' : 'rgba(255,255,255,0.85)',
                      border: 'none',
                    }}>📦 Архив</button>
                  </div>
                </div>
                 {reportTab === 'current' && (
                   <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                     {/* Generate buttons */}
                     <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
                       {[
                         { label:'🏋️ Тренеру', color:'#3b82f6', report:trainerReport },
                         { label:'🏥 Врачу', color:'#ef4444', report:doctorReport },
                          { label:'📋 Общий', color:'#00e68a', report:generalReport },
                          { label:'🎨 Свой', color:'#8b5cf6', report:'custom' },
                        ].map((btn, i) => (
                          <button key={i} onClick={() => {
                            if (btn.report === 'custom') { setShowCustomReport(true); return; }
                            try {
                              const rep = { id: Date.now().toString(), date: new Date().toISOString().slice(0,10), type: btn.label, text: btn.report, timestamp: Date.now() };
                              const archive = JSON.parse(localStorage.getItem('he_profile_reports') || '[]');
                              archive.unshift(rep);
                              localStorage.setItem('he_profile_reports', JSON.stringify(archive.slice(0, 30)));
                            } catch {}
                          }} style={{
                            padding:'6px 12px', borderRadius:8, fontSize:9, cursor:'pointer', fontWeight:600,
                            background: btn.color + '15', border: '1px solid ' + btn.color + '30',
                            color: btn.color, whiteSpace:'nowrap',
                          }}>📄 {btn.label}</button>
                        ))}
                      </div>

                      {/* Custom report popup */}
                      {showCustomReport && (
                        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }} onClick={() => setShowCustomReport(false)}>
                          <div style={{ background:'#18181b', borderRadius:16, padding:20, maxWidth:380, width:'100%', border:'1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#fff' }}>🎨 Свой отчёт</h3>
                            <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>Выберите блоки для включения в отчёт</p>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:12 }}>
                              {[
                                { key:'profile', label:'Профиль', icon:'👤', color:'#a78bfa' },
                                { key:'training', label:'Тренировки', icon:'🏋️', color:'#3b82f6' },
                                { key:'nutrition', label:'Питание', icon:'🥗', color:'#22c55e' },
                                { key:'labs', label:'Анализы', icon:'🩸', color:'#ef4444' },
                                { key:'pharma', label:'Курс', icon:'💊', color:'#ec4899' },
                                { key:'risk', label:'Риски', icon:'⚠️', color:'#f97316' },
                                { key:'support', label:'Поддержка', icon:'🧪', color:'#06b6d4' },
                                { key:'bp', label:'Давление', icon:'❤️', color:'#f43f5e' },
                                { key:'sleep', label:'Сон', icon:'🛌', color:'#8b5cf6' },
                              ].map(b => (
                                <label key={b.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer' }}>
                                  <input type="checkbox" checked={!!customReportBlocks[b.key]} onChange={() => setCustomReportBlocks(prev => ({ ...prev, [b.key]: !prev[b.key] }))} style={{ width:16, height:16, accentColor:'#00e68a', cursor:'pointer' }} />
                                  <span style={{ fontSize:12 }}>{b.icon}</span>
                                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.85)', fontWeight:600, flex:1 }}>{b.label}</span>
                                </label>
                              ))}
                            </div>
                            <button onClick={() => {
                              const sections: string[] = [];
                              if (customReportBlocks.profile) sections.push(`👤 Профиль:\n  Имя: ${profile.name || '—'} · ${settings.age || '—'} лет · ${settings.weight || '—'} кг · ${settings.height || '—'} см · BMI: ${bmiVal} · Цель: ${goalLabelR}`);
                              if (customReportBlocks.training) sections.push(`🏋️ Тренировки:\n  Частота: ${settings.workoutsPerWeek || '—'}/нед · Длит: ${settings.avgWorkoutMinutes || '—'} мин · Программа: ${localStorage.getItem('he_current_program') || '—'}\n${workoutSummary}`);
                              if (customReportBlocks.nutrition) sections.push(`🥗 Питание:\n  Ккал: ${foodDiaryAvg?.avgKcal || '—'} · Б: ${foodDiaryAvg?.avgProtein || '—'}г · Ж: ${foodDiaryAvg?.avgFat || '—'}г · У: ${foodDiaryAvg?.avgCarbs || '—'}г`);
                              if (customReportBlocks.labs) sections.push(`🩸 Анализы:\n  ${labsList || 'нет данных'}`);
                              if (customReportBlocks.pharma) sections.push(`💊 Курс:\n  ${medsList || 'нет'}`);
                              if (customReportBlocks.risk) sections.push(`⚠️ Риски:\n  Общий: ${riskData?.overallNet || '—'}% · Без поддержки: ${riskData?.overallRaw || '—'}%`);
                              if (customReportBlocks.support) sections.push(`🧪 Поддержка:\n  ${suppsList || 'нет'}`);
                              if (customReportBlocks.bp) {
                                const lastBp = bpEntries[0];
                                sections.push(`❤️ Давление:\n  ${lastBp ? `${lastBp.systolic}/${lastBp.diastolic} · Пульс: ${lastBp.hr} · ${lastBp.date}` : 'нет записей'} (всего: ${bpEntries.length} зап.)`);
                              }
                              if (customReportBlocks.sleep) {
                                const sleepDiary = (() => { try { return JSON.parse(localStorage.getItem('he_sleep_diary') || '[]'); } catch { return []; } })();
                                const avgHours = sleepDiary.length > 0 ? (sleepDiary.reduce((s: number, e: any) => s + e.hours, 0) / sleepDiary.length).toFixed(1) : '—';
                                sections.push(`🛌 Сон:\n  Средняя длит: ${avgHours}ч · Записей: ${sleepDiary.length}`);
                              }
                              const text = sections.join('\n\n');
                              const rep = { id: Date.now().toString(), date: new Date().toISOString().slice(0,10), type: '🎨 Свой отчёт', text, timestamp: Date.now() };
                              try {
                                const archive = JSON.parse(localStorage.getItem('he_profile_reports') || '[]');
                                archive.unshift(rep);
                                localStorage.setItem('he_profile_reports', JSON.stringify(archive.slice(0, 30)));
                              } catch {}
                              setShowCustomReport(false);
                            }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontWeight:700, fontSize:12 }}>
                              📄 Сгенерировать отчёт
                            </button>
                          </div>
                        </div>
                      )}

                      {[
                 { title: 'Отчёт для тренера', text: trainerReport, color: '#3b82f6', icon: '🏋️' },
                { title: 'Отчёт для врача', text: doctorReport, color: '#ef4444', icon: '🏥' },
                { title: 'Общий отчёт', text: generalReport, color: '#00e68a', icon: '📋' },
              ].map(r => (
                <div key={r.title} style={{
                  ...glassCard, borderLeft:`3px solid ${r.color}`, background:`${r.color}06`,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:16 }}>{r.icon}</span>
                    <div style={{ fontSize:13, fontWeight:700, color: r.color }}>{r.title}</div>
                  </div>
                  <pre style={{
                    fontSize:9, color: apple.textPrimary, whiteSpace:'pre-wrap',
                    fontFamily:'SF Mono, Consolas, monospace',
                    margin:'0 0 10px', background:'rgba(0,0,0,0.2)', borderRadius:10,
                    padding:10, maxHeight:250, overflowY:'auto', lineHeight:1.5,
                    border: apple.glassBorder,
                  }}>{r.text}</pre>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => copyReport(r.text)} style={{
                      flex:1, padding:'8px 12px', borderRadius:10, cursor:'pointer',
                      border: apple.glassBorder, background: apple.glassBg,
                      color: apple.textSecondary, fontSize:11, fontWeight:600,
                    }}>Копировать</button>
                    <button onClick={() => sendReport(r.text)} style={{
                      flex:1, padding:'8px 12px', borderRadius:10, cursor:'pointer',
                      border:'none', background: r.color, color:'#fff', fontSize:11, fontWeight:600,
                    }}>Отправить</button>
                  </div>
                </div>
              ))}
              {/* Nutrition report card */}
              {(() => { try { const reports = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]'); if (reports.length === 0) return null; const r = reports[0]; return (
                <div style={{ ...glassCard, borderLeft:'3px solid #3b82f6', background:'rgba(59,130,246,0.06)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:16 }}>📋</span>
                    <div style={{ fontSize:13, fontWeight:700, color:'#3b82f6' }}>Отчёт о питании</div>
                    <span style={{ marginLeft:'auto', fontSize:16, fontWeight:800, color: r.overallGrade === 'A' ? '#22c55e' : r.overallGrade === 'B' ? '#8b5cf6' : r.overallGrade === 'C' ? '#f59e0b' : '#ef4444' }}>{r.overallGrade}</span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>{r.overallGradeLabel} · {r.generatedAt?.slice(0,10)}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:6 }}>
                    {[{l:'Ккал',v:r.kbjuPct?.kcal},{l:'Белки',v:r.kbjuPct?.p},{l:'Жиры',v:r.kbjuPct?.f},{l:'Угл.',v:r.kbjuPct?.c}].map(s => (
                      <div key={s.l} style={{ background:'rgba(0,0,0,0.2)', borderRadius:6, padding:'4px', textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>{s.l}</div>
                        <div style={{ fontSize:13, fontWeight:700, color: s.v >= 85 && s.v <= 115 ? '#22c55e' : s.v >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:4 }}>
                    <div style={{ flex:1, background:'rgba(59,130,246,0.06)', borderRadius:6, padding:'4px 6px' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>Вес/нед</div>
                      <div style={{ fontSize:11, fontWeight:700, color: r.weightDynamicsBasic?.direction === 'loss' ? '#22c55e' : r.weightDynamicsBasic?.direction === 'gain' ? '#f59e0b' : '#fff' }}>
                        {r.weightDynamicsBasic?.direction === 'loss' ? '−' : r.weightDynamicsBasic?.direction === 'gain' ? '+' : '∼'}{r.weightDynamicsBasic?.weeklyKg || '0'} кг
                      </div>
                    </div>
                    <div style={{ flex:1, background:'rgba(139,92,246,0.06)', borderRadius:6, padding:'4px 6px' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>Качество</div>
                      <div style={{ fontSize:11, fontWeight:700, color: r.foodQualityScore >= 7 ? '#22c55e' : '#f59e0b' }}>{r.foodQualityScore || '—'}/10</div>
                    </div>
                  </div>
                  {(r.microDeficiencies || []).length > 0 && <div style={{ fontSize:8, color:'#f59e0b' }}>⚠ {r.microDeficiencies.slice(0,3).join('; ')}</div>}
                </div>
              ); } catch { return null; }})()}
              {(() => { try { const reports = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]'); if (reports.length === 0) return null; const r = reports[0]; return (
                <div style={{ ...glassCard, borderLeft:'3px solid #8b5cf6', background:'rgba(139,92,246,0.06)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:16 }}>🧩</span>
                    <div style={{ fontSize:13, fontWeight:700, color:'#8b5cf6' }}>Отчёт о поддержке</div>
                    <span style={{ marginLeft:'auto', fontSize:16, fontWeight:800, color: r.grade === 'A' ? '#22c55e' : r.grade === 'B' ? '#8b5cf6' : r.grade === 'C' ? '#f59e0b' : '#ef4444' }}>{r.grade}</span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', marginBottom:4 }}>{r.date?.slice(0,10)} · Риск {r.overallNet}/100</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <div style={{ flex:1, background:'rgba(139,92,246,0.06)', borderRadius:6, padding:'4px 6px' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>Соединений</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{r.compoundsCount || '—'}</div>
                    </div>
                    <div style={{ flex:1, background:'rgba(0,230,138,0.06)', borderRadius:6, padding:'4px 6px' }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)' }}>Поддержка</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>{r.supportCount || '—'}</div>
                    </div>
                  </div>
                </div>
              ); } catch { return null; }})()}
                  </div>
                )}
                {reportTab === 'archive' && (() => {
                  const allArchives: any[] = [];
                  try {
                    const labReports = JSON.parse(localStorage.getItem('he_lab_reports') || '[]');
                    const riskReports = JSON.parse(localStorage.getItem('he_risk_reports') || '[]');
                    const courseReports = JSON.parse(localStorage.getItem('he_pharma_reports') || '[]');
                    const trainingReports = JSON.parse(localStorage.getItem('he_training_reports') || '[]');
                    const nutritionReports = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
                    allArchives.push(...labReports.map((r:any) => ({ ...r, block:'Лаборатория' })));
                    allArchives.push(...riskReports.map((r:any) => ({ ...r, block:'Риски' })));
                    allArchives.push(...courseReports.map((r:any) => ({ ...r, block:'Курс' })));
                    allArchives.push(...trainingReports.map((r:any) => ({ ...r, block:'Тренировки' })));
                    allArchives.push(...nutritionReports.map((r:any) => ({ ...r, block:'Питание' })));
                    allArchives.sort((a,b) => b.timestamp - a.timestamp);
                  } catch {}
                  return (
                    <div>
                      {allArchives.length > 0 ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {allArchives.slice(0, 50).map((r: any, i: number) => (
                            <div key={r.id || i} onClick={() => setSelectedArchiveItem(selectedArchiveItem?.id === r.id ? null : r)} style={{ borderRadius:10, padding:10, background: selectedArchiveItem?.id === r.id ? 'rgba(0,230,138,0.06)' : 'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.03)', cursor:'pointer' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div>
                                  <span style={{ fontSize:11, fontWeight:700, color:'#00e68a' }}>{r.block}</span>
                                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginLeft:6 }}>от {r.date}</span>
                                </div>
                                <span style={{ fontSize:9, padding:'2px 8px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>
                                  {r.overallNet !== undefined ? `${Math.round(r.overallNet)}%` : r.compoundCount ? `${r.compoundCount} преп.` : r.totalMarkers ? `${r.totalMarkers} марк.` : '✓'}
                                </span>
                              </div>
                              {r.overallRaw !== undefined && (
                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>
                                  raw: {Math.round(r.overallRaw)}% · net: {Math.round(r.overallNet)}% · систем: {r.systems?.length || 0}
                                </div>
                              )}
                              {r.compounds && (
                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2 }}>
                                  {r.compoundCount} преп. · {r.totalWeeks} нед · риск {Math.round(r.risk)}%
                                </div>
                              )}
                              {selectedArchiveItem?.id === r.id && (
                                <div style={{ marginTop:6, padding:8, background:'rgba(0,0,0,0.15)', borderRadius:6, fontSize:8, color:'rgba(255,255,255,0.85)', lineHeight:1.4, whiteSpace:'pre-wrap', maxHeight:300, overflowY:'auto' }}>
                                  {JSON.stringify(r, null, 2).slice(0, 2000)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign:'center', padding:30, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
                          Нет архивных отчётов. Сгенерируйте отчёты в Лаборатории, Рисках, Курсе или Тренировках.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>);
          })()}</InfoErrorBoundary>}
          
          {/* ═══ BP/HR DIARY ═══ */}
          {tab === 'bp_diary' && (
            <InfoErrorBoundary label="Давление"><div>
              {/* Header + Add button */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:700, color: apple.textPrimary }}>🫀 Давление и пульс</h3>
                <button onClick={() => setShowBpForm(!showBpForm)} style={{
                  padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                  background: apple.accentDim, border: apple.accentBorder, color: apple.accent,
                }}>{showBpForm ? '✕ Отмена' : '+ Добавить'}</button>
              </div>

              {/* Entry form */}
              {showBpForm && (
                <div style={{ ...glassCard, marginBottom:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Систолическое</div>
                      <input type="number" value={bpSystolic} onChange={e => setBpSystolic(e.target.value)} placeholder="120" style={appleInput} />
                    </div>
                    <div>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Диастолическое</div>
                      <input type="number" value={bpDiastolic} onChange={e => setBpDiastolic(e.target.value)} placeholder="80" style={appleInput} />
                    </div>
                    <div>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Пульс</div>
                      <input type="number" value={bpHr} onChange={e => setBpHr(e.target.value)} placeholder="70" style={appleInput} />
                    </div>
                  </div>
                  <button onClick={() => {
                    const s = Math.round(Number(bpSystolic)); const d = Math.round(Number(bpDiastolic)); const h = Math.round(Number(bpHr));
                    if (!s || !d || !h || isNaN(s) || isNaN(d) || isNaN(h) || s < 50 || s > 250 || d < 30 || d > 160 || h < 30 || h > 250) return;
                    const entry: BPEntry = { date: new Date().toISOString().slice(0,10), systolic: s, diastolic: d, hr: h };
                    const updated = [...bpEntries, entry];
                    setBpEntries(updated); saveBPDiary(updated);
                    setBpSystolic(''); setBpDiastolic(''); setBpHr(''); setShowBpForm(false);
                  }} style={{
                    width:'100%', padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                    background: apple.gradientGreen, color:'#000', fontWeight:700, fontSize:12,
                  }}>Сохранить</button>
                </div>
              )}

              {/* Period toggle + archive */}
              <div style={{ display:'flex', gap:4, marginBottom:10 }}>
                {(['day','week','month','all'] as const).map(p => (
                  <button key={p} onClick={() => setBpPeriod(p)} style={{
                    flex:1, padding:'8px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: bpPeriod === p ? apple.accentDim : apple.glassBg,
                    border: bpPeriod === p ? apple.accentBorder : apple.glassBorder,
                    color: bpPeriod === p ? apple.accent : apple.textSecondary,
                  }}>{p === 'day' ? 'День' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Всё'}</button>
                ))}
                <button onClick={() => {
                  if (confirm('Очистить все записи давления?')) {
                    setBpEntries([]); localStorage.removeItem('he_bp_diary');
                  }
                }} style={{
                  padding:'8px 10px', borderRadius:10, fontSize:10, fontWeight:600, cursor:'pointer',
                  background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444',
                }}>🗑</button>
              </div>

              {/* Filtered entries */}
              {(() => {
                const now = new Date();
                const cutoff = new Date(now);
                if (bpPeriod === 'day') cutoff.setDate(cutoff.getDate() - 1);
                else if (bpPeriod === 'week') cutoff.setDate(cutoff.getDate() - 7);
                else if (bpPeriod === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
                else cutoff.setFullYear(cutoff.getFullYear() - 10); // all
                const filtered = bpEntries.filter(e => new Date(e.date) >= cutoff).sort((a, b) => b.date.localeCompare(a.date));
                const avgSystolic = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.systolic, 0) / filtered.length) : 0;
                const avgDiastolic = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.diastolic, 0) / filtered.length) : 0;
                const avgHr = filtered.length ? Math.round(filtered.reduce((s, e) => s + e.hr, 0) / filtered.length) : 0;

                return (
                  <>
                    {/* Average cards */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                      <div style={{ ...glassCard, textAlign:'center', padding:12 }}>
                        <div style={{ fontSize:9, color: apple.textDim, marginBottom:4 }}>Среднее сист.</div>
                        <div style={{ fontSize:24, fontWeight:800, color: avgSystolic > 140 ? '#ef4444' : avgSystolic > 130 ? '#f59e0b' : apple.accent }}>{avgSystolic || '—'}</div>
                        <div style={{ fontSize:8, color: apple.textDim }}>мм рт. ст.</div>
                      </div>
                      <div style={{ ...glassCard, textAlign:'center', padding:12 }}>
                        <div style={{ fontSize:9, color: apple.textDim, marginBottom:4 }}>Среднее диаст.</div>
                        <div style={{ fontSize:24, fontWeight:800, color: avgDiastolic > 90 ? '#ef4444' : avgDiastolic > 80 ? '#f59e0b' : apple.accent }}>{avgDiastolic || '—'}</div>
                        <div style={{ fontSize:8, color: apple.textDim }}>мм рт. ст.</div>
                      </div>
                      <div style={{ ...glassCard, textAlign:'center', padding:12 }}>
                        <div style={{ fontSize:9, color: apple.textDim, marginBottom:4 }}>Средний пульс</div>
                        <div style={{ fontSize:24, fontWeight:800, color: avgHr > 100 ? '#ef4444' : avgHr > 85 ? '#f59e0b' : apple.accent }}>{avgHr || '—'}</div>
                        <div style={{ fontSize:8, color: apple.textDim }}>уд/мин</div>
                      </div>
                    </div>

                    {/* Chart */}
                    {filtered.length >= 2 && (
                      <div style={{ ...glassCard, marginBottom:10, padding:'12px 10px', overflow:'hidden' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:10, color: apple.textDim, fontWeight:600 }}>📈 Динамика</span>
                          <span style={{ fontSize:8, color: apple.textDim }}>{filtered.length} записей</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:80 }}>
                          {filtered.slice().reverse().map((e, i) => {
                            const maxVal = 200;
                            const hS = Math.min(100, (e.systolic / maxVal) * 100);
                            const hD = Math.min(100, (e.diastolic / maxVal) * 100);
                            return (
                              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1, position:'relative' }}>
                                <div style={{ width:'70%', height:`${hS}%`, borderRadius:'4px 4px 0 0', background:'linear-gradient(180deg, #ef4444, #dc2626)', opacity:0.8 }} />
                                <div style={{ width:'70%', height:`${hD}%`, borderRadius:'4px 4px 0 0', background:'linear-gradient(180deg, #f59e0b, #d97706)', opacity:0.8 }} />
                                {filtered.length <= 31 && (
                                  <span style={{ fontSize:6, color: apple.textDim, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%', textAlign:'center' }}>
                                    {e.date.slice(5)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display:'flex', gap:10, fontSize:8, color: apple.textDim, marginTop:6 }}>
                          <span><span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#ef4444', marginRight:3 }} /> Систолическое</span>
                          <span><span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#f59e0b', marginRight:3 }} /> Диастолическое</span>
                          <span style={{ marginLeft:'auto', color: avgSystolic <= 120 && avgDiastolic <= 80 ? '#22c55e' : avgSystolic <= 130 && avgDiastolic <= 85 ? '#f59e0b' : '#ef4444', fontWeight:700 }}>
                            Ø {avgSystolic}/{avgDiastolic}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Entry list */}
                    <div style={{ fontSize:10, color: apple.textDim, fontWeight:600, marginBottom:6 }}>Записи ({filtered.length})</div>
                    {filtered.length === 0 ? (
                      <div style={{ ...glassCard, textAlign:'center', padding:20 }}>
                        <div style={{ fontSize:24, marginBottom:4 }}>🫀</div>
                        <div style={{ fontSize:10, color: apple.textDim }}>Нет записей за выбранный период</div>
                      </div>
                    ) : (
                      filtered.map((e, i) => {
                        const bpColor = e.systolic > 140 || e.diastolic > 90 ? '#ef4444' : e.systolic > 130 || e.diastolic > 80 ? '#f59e0b' : apple.accent;
                        return (
                          <div key={i} style={{ ...glassCard, display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                            <div style={{ width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.1)', fontSize:16 }}>🫀</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:700, color: apple.textPrimary }}>{e.systolic}/{e.diastolic}</div>
                              <div style={{ fontSize:9, color: apple.textDim }}>Пульс: {e.hr} уд/мин</div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontSize:11, color: bpColor, fontWeight:600 }}>{e.systolic > 140 || e.diastolic > 90 ? '⚠ Повышено' : e.systolic > 130 || e.diastolic > 80 ? '⚡ Граница' : '✅ Норма'}</div>
                              <div style={{ fontSize:8, color: apple.textDim }}>{e.date}</div>
                            </div>
                            <button onClick={() => {
                              const updated = bpEntries.filter((_, idx) => idx !== bpEntries.indexOf(e));
                              setBpEntries(updated); saveBPDiary(updated);
                            }} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:9 }}>✕</button>
                          </div>
                        );
                      })
                    )}
                  </>
                );
              })()}
            </div></InfoErrorBoundary>
          )}

          {/* ═══ MEASUREMENTS TAB ═══ */}
          {tab === 'measurements' && <InfoErrorBoundary label="Измерения"><ProfileMeasurementsTab /></InfoErrorBoundary>}

          {/* ═══ DIARIES TAB ═══ */}
          {tab === 'diaries' && (
            <InfoErrorBoundary label="Дневники"><div>
              <div style={{ marginBottom:12 }}>
                <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#fff' }}>📔 Дневники</h3>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:0 }}>Все дневники приложения для отслеживания прогресса</p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { icon:'🏋️', title:'Тренировок', desc:'Упражнения, подходы, веса, объём, RPE. История тренировок, прогресс по упражнениям, сплиты.', color:'#3b82f6', tab:'progress' },
                  { icon:'🥗', title:'Питания', desc:'Продукты, калории, белки/жиры/углеводы. OCR сканирование, штрихкоды, рецепты.', color:'#22c55e', tab:'diet' },
                  { icon:'🍽', title:'Приёмов пищи', desc:'Завтрак, обед, ужин, перекусы. Дневное/недельное меню, корзина продуктов.', color:'#f59e0b', tab:'diet' },
                  { icon:'📏', title:'Замеров тела', desc:'Вес, обхваты (талия, грудь, бицепс, бедро), % жира. Фото прогресса с разных ракурсов.', color:'#a855f7', tab:'measurements' },
                  { icon:'🩸', title:'Анализов', desc:'Результаты анализов, референсные диапазоны, отклонения, динамика по датам.', color:'#ef4444', tab:'analytics' },
                  { icon:'💊', title:'Курса', desc:'Препараты, дозировки, фазы. Календарь приёма, корзина покупок.', color:'#ec4899', tab:'overview', navScreen:'pharma' },
                  { icon:'🧪', title:'Поддержки', desc:'БАДы, протоколы, стеки, синергии. Недельный план приёма.', color:'#06b6d4', tab:'overview', navScreen:'support' },
                  { icon:'❤️', title:'Давления', desc:'Систолическое/диастолическое давление, пульс. Дневник на день/неделю/месяц.', color:'#f43f5e', tab:'bp_diary' },
                  { icon:'🛌', title:'Сна', desc:'Продолжительность, качество, пробуждения. Корреляция с тренировками.', color:'#8b5cf6', tab:'sleep' },
                  { icon:'📊', title:'Отчётов', desc:'Полные отчёты по всем блокам: тренировки, анализы, риски, курс. Архив.', color:'#84cc16', tab:'analytics' },
                  { icon:'⚠️', title:'Рисков', desc:'Оценка рисков по системам, Монте-Карло, клинические модели, MDSS.', color:'#f97316', tab:'analytics', navScreen:'risks' },
                  { icon:'🩺', title:'Травм', desc:'Журнал травм, реабилитация, ограничения движений, восстановление.', color:'#14b8a6', tab:'injuries' },
                ].map((d, i) => (
                  <div key={i} onClick={() => { try { if ((d as any).navScreen && onNavigate) onNavigate((d as any).navScreen); else if (d.tab) setTab(d.tab as ProfileTab); } catch(e) { console.warn('[Diary] nav:', e); } }} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, cursor:'pointer',
                    background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ width:40, height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:d.color+'18', fontSize:18 }}>{d.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:d.color, marginBottom:1, letterSpacing:-0.2 }}>{d.title}</div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', lineHeight:1.3 }}>{d.desc}</div>
                    </div>
                    <span style={{ color:d.color, fontSize:14, opacity:0.5 }}>→</span>
                  </div>
                ))}
              </div>
            </div></InfoErrorBoundary>
          )}

          {/* ═══ CONTACTS TAB ═══ */}
          {tab === 'contacts' && (
            <InfoErrorBoundary label="Контакты"><div>
              <div style={glassCard}>
                <div style={sectionLabel}>Контакты и друзья</div>
                <p style={{ fontSize:10, color: apple.textDim, margin:'4px 0 10px' }}>
                  Управление списком друзей, обмен отчётами и доступ к тренировкам через Telegram WebApp.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  <button onClick={addFriend} style={{
                    padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#fff', fontWeight:700, fontSize:12,
                    background: apple.gradientBlue,
                  }}>Добавить друга</button>
                  <button onClick={shareReport} style={{
                    padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#000', fontWeight:700, fontSize:12,
                    background: apple.gradientOrange,
                  }}>Поделиться отчётом</button>
                </div>
                <button onClick={openTrainingForFriend} style={{
                  width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10,
                  background: apple.gradientPurple, border:'none', color:'#fff', fontWeight:700, fontSize:12,
                }}>Открыть тренировку другу</button>
                <button onClick={() => {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg?.openTelegramLink) tg.openTelegramLink('https://t.me/BodyBuildHealthBot');
                  else if (tg?.openLink) tg.openLink('https://t.me/BodyBuildHealthBot');
                  else window.open('https://t.me/BodyBuildHealthBot', '_blank');
                }} style={{
                  width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10,
                  background: apple.gradientGreen, border:'none', color:'#000', fontWeight:700, fontSize:12,
                }}>Связаться с поддержкой</button>

                {friends.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color: apple.accent, marginBottom:8 }}>
                      Список друзей ({friends.length})
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {friends.map(f => (
                        <div key={f.id} style={{
                          display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14,
                          background: apple.glassBg, border: apple.glassBorder,
                        }}>
                          <div style={{
                            width:36, height:36, borderRadius:'50%', flexShrink:0,
                            background: apple.gradientBlue,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:14, color:'#fff', fontWeight:700,
                          }}>
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color: apple.textPrimary }}>{f.name}</div>
                            <div style={{ fontSize:9, color: apple.textDim }}>@{f.username} · {f.addedAt}</div>
                          </div>
                          <button onClick={() => removeFriend(f.id)} style={{
                            padding:'4px 10px', borderRadius:8, fontSize:10, cursor:'pointer',
                            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600,
                          }}>Удалить</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {friends.length === 0 && (
                  <div style={{ textAlign:'center', padding:'20px 0', color: apple.textDim, fontSize:10 }}>
                    Нет добавленных друзей. Нажмите «Добавить друга» чтобы начать.
                  </div>
                )}
              </div>
              <div style={glassCard}>
                <div style={{ fontSize:11, color: apple.textDim, fontWeight:600, marginBottom:4 }}>Быстрые действия</div>
                <div style={{ fontSize:9, color: apple.textDim, lineHeight:1.8 }}>
                  <div>• <b>Добавить друга</b> — открывает Telegram UserPicker</div>
                  <div>• <b>Поделиться отчётом</b> — отправляет сводку профиля в чат</div>
                  <div>• <b>Открыть тренировку</b> — deep-link для доступа друга к программе</div>
                </div>
              </div>
            </div></InfoErrorBoundary>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileMeasurementsTab: React.FC = () => {
  const [measLog, setMeasLog] = React.useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('he_measurements_log') || '[]'); } catch { return []; } });
  const [weightKg, setWeightKg] = React.useState('');
  const [waist, setWaist] = React.useState('');
  const [chest, setChest] = React.useState('');
  const [bicep, setBicep] = React.useState('');
  const [thigh, setThigh] = React.useState('');
  const [hip, setHip] = React.useState('');
  const [bodyFat, setBodyFat] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const photoRef = React.useRef<HTMLInputElement>(null);
  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotos(prev => [...prev, dataUrl].slice(-4));
      try { localStorage.setItem('he_meas_photos', JSON.stringify([...(JSON.parse(localStorage.getItem('he_meas_photos')||'[]')), { date: new Date().toISOString().split('T')[0], photo: dataUrl }].slice(-20))); } catch {}
    }; reader.readAsDataURL(file);
  };
  const saveMeas = () => {
    if (!waist && !chest && !bicep && !weightKg) return;
    const entry = { date: new Date().toISOString().split('T')[0], weightKg: weightKg ? parseFloat(weightKg) : null, waistCm: waist ? parseFloat(waist) : null, chestCm: chest ? parseFloat(chest) : null, bicepCm: bicep ? parseFloat(bicep) : null, thighCm: thigh ? parseFloat(thigh) : null, hipCm: hip ? parseFloat(hip) : null, bodyFat: bodyFat ? parseFloat(bodyFat) : null, photos: photos.length > 0 ? photos : undefined };
    const updated = [...measLog, entry]; setMeasLog(updated);
    try { localStorage.setItem('he_measurements_log', JSON.stringify(updated)); } catch {}
    setWaist(''); setChest(''); setBicep(''); setThigh(''); setHip(''); setBodyFat(''); setWeightKg(''); setPhotos([]);
  };
  return (
    <div style={{ padding:'0 0 80px' }}>
      <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#fff' }}>📏 Дневник замеров</h3>
      <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Вес, обхваты, жир, фото</p>
      <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {[{l:'Вес, кг',v:weightKg,s:setWeightKg},{l:'Талия, см',v:waist,s:setWaist},{l:'Грудь, см',v:chest,s:setChest},{l:'Бицепс, см',v:bicep,s:setBicep},{l:'Бедро, см',v:thigh,s:setThigh},{l:'Ягодицы, см',v:hip,s:setHip},{l:'Жир, %',v:bodyFat,s:setBodyFat}].map((f,i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <label style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>{f.l}</label>
              <input type="number" value={f.v} onChange={e => f.s(e.target.value)} placeholder="—" style={{ padding:'8px 6px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12 }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          <input ref={photoRef} type="file" accept="image/*" onChange={addPhoto} style={{ display:'none' }} />
          <button onClick={() => photoRef.current?.click()} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer' }}>📸 Фото</button>
          <button onClick={saveMeas} style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'var(--accent)', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer' }}>💾 Сохранить</button>
        </div>
        {photos.length > 0 && <div style={{ display:'flex', gap:4, marginTop:4, overflowX:'auto' }}>
          {photos.map((p,i) => <div key={i} style={{ width:48, height:48, borderRadius:6, overflow:'hidden', flexShrink:0, position:'relative' }}>
            <img src={p} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div onClick={() => setPhotos(prev => prev.filter((_,idx) => idx !== i))} style={{ position:'absolute', top:0, right:0, width:14, height:14, background:'rgba(0,0,0,0.6)', borderRadius:'50%', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>✕</div>
          </div>)}
        </div>}
      </div>
      {measLog.length > 0 && <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
        <h4 style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, color:'#fff' }}>История ({measLog.length})</h4>
        {[...measLog].reverse().map((m:any,i:number) => <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', borderRadius:4, background:i%2===0?'rgba(255,255,255,0.03)':'transparent', fontSize:9 }}>
          <span style={{ fontWeight:600 }}>{m.date}</span>
          <span style={{ color:'rgba(255,255,255,0.6)' }}>{m.weightKg ? `В:${m.weightKg}кг ` : ''}{m.waistCm ? `Т:${m.waistCm} ` : ''}{m.chestCm ? `Г:${m.chestCm} ` : ''}{m.bodyFat ? `Ж:${m.bodyFat}%` : ''}{m.photos?.length ? `📸${m.photos.length}` : ''}</span>
        </div>)}
      </div>}
      {measLog.length === 0 && <div style={{ textAlign:'center', padding:30, fontSize:11, color:'rgba(255,255,255,0.5)' }}>Нет записей. Добавьте первый замер.</div>}
    </div>
  );
};
