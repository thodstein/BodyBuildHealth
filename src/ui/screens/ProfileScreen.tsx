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
import { useDataLink } from '../../core/data-link';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';
import { BioStackAISettings } from '../components/BioStackAIProfile';
import { BPDiaryTab } from '../components/BPDiaryTab';

type ProfileTab = 'overview' | 'anthropometry' | 'sleep' | 'lifestyle' | 'diet' 
  | 'genetics' | 'injuries' | 'progress' | 'analytics' 
  | 'contacts' | 'bp_diary' | 'measurements' | 'health' | 'diaries';
type ProfilePage = 'hero' | 'tabs';
type MainTab = 'info' | 'analytics' | 'contacts';

const SPORT_TYPES = [
  { id: 'bodybuilding', label: 'Бодибилдинг' }, { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' }, { id: 'fitness', label: 'Фитнес' }, { id: 'other', label: 'Другое' },
] as const;

const CHRONIC_CONDITIONS: {id:string;label:string}[] = [
  { id: 'hypertension', label: 'Гипертония' }, { id: 'diabetes', label: 'Диабет' },
  { id: 'asthma', label: 'Астма' }, { id: 'thyroid', label: 'Щитовидная железа' },
  { id: 'heart', label: 'Сердечно-сосудистые' }, { id: 'liver', label: 'Заболевания печени' },
  { id: 'kidney', label: 'Заболевания почек' }, { id: 'joints', label: 'Заболевания суставов' },
];

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

interface BPEntry { date: string; systolic: number; diastolic: number; hr: number; }
function getBPDiary(): BPEntry[] {
  try { return JSON.parse(localStorage.getItem('he_bp_diary') || '[]'); } catch { return []; }
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

const ALLERGEN_OPTIONS: {id:string;label:string}[] = [
  { id: 'dairy', label: 'Молочные' }, { id: 'gluten', label: 'Глютен' }, { id: 'soy', label: 'Соя' },
  { id: 'eggs', label: 'Яйца' }, { id: 'fish', label: 'Рыба' }, { id: 'shellfish', label: 'Морепродукты' },
  { id: 'tree_nuts', label: 'Орехи' }, { id: 'peanuts', label: 'Арахис' },
];

const INTOLERANCE_OPTIONS: {id:string;label:string}[] = [
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

// ── Diary Hub card styles ──
const diaryCardBase: React.CSSProperties = {
  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
  padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
  transition:'all 0.15s', border:'none', color:'inherit',
};
const diaryIconWrap: React.CSSProperties = {
  width:36, height:36, borderRadius:10,
  display:'flex', alignItems:'center', justifyContent:'center',
  fontSize:18, marginBottom:2,
};
const diaryCardTitle: React.CSSProperties = {
  fontSize:11, fontWeight:700, color: apple.textPrimary, lineHeight:1.2,
};
const diaryCardDesc: React.CSSProperties = {
  fontSize:9, color: apple.textDim, lineHeight:1.2,
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

/* ── helper components for health tab cards ── */
const HealthSelect: React.FC<{ label:string; value:string; opts:[string,string][]; onChange:(v:string)=>void }> = ({label,value,opts,onChange}) => (
  <div>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:2}}>{label}</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
      {opts.map(([val,lab]) => (
        <button key={val} onClick={()=>onChange(val)} style={{
          flex:1, padding:'5px 4px', borderRadius:6, border:'none', cursor:'pointer', fontSize:9, fontWeight:600,
          background: value===val ? '#3b82f6' : 'rgba(255,255,255,0.06)',
          color: value===val ? '#fff' : 'rgba(255,255,255,0.5)',
        }}>{lab}</button>
      ))}
    </div>
  </div>
);
const HealthBool: React.FC<{ label:string; active:boolean; onClick:()=>void }> = ({label,active,onClick}) => (
  <button onClick={onClick} style={{
    padding:'5px 10px', borderRadius:8, border:'none', cursor:'pointer', fontSize:10, fontWeight:600,
    background: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
    color: active ? '#fca5a5' : 'rgba(255,255,255,0.5)',
  }}>{active ? '✓ ' : ''}{label}</button>
);
const HealthNumber: React.FC<{ label:string; value:string|number; onChange:(v:string)=>void; placeholder?:string; min?:number; max?:number }> = ({label,value,onChange,placeholder,min,max}) => (
  <div>
    <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:2}}>{label}</div>
    <input style={{width:'100%',padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:11,outline:'none',boxSizing:'border-box'}}
      type="number" min={min} max={max} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export const ProfileScreen: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [overTab, setOverTab] = useState('general');
  const [page, setPage] = useState<ProfilePage>('hero');
  const [mainTab, setMainTab] = useState<MainTab>('info');
  const [healthPopup, setHealthPopup] = useState<string | null>(null);
  const [overPopup, setOverPopup] = useState<string | null>(null);
  const [anthroPopup, setAnthroPopup] = useState<string | null>(null);
  const [lifestylePopup, setLifestylePopup] = useState<string | null>(null);
  const [dietPopup, setDietPopup] = useState<string | null>(null);
  const [geneticsPopup, setGeneticsPopup] = useState<string | null>(null);
  const [progressPopup, setProgressPopup] = useState<string | null>(null);
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [editInjury, setEditInjury] = useState<InjuryRecord | null>(null);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(getWeightLog);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [reportTab, setReportTab] = useState<'current' | 'archive'>('current');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'reports' | 'progress'>('reports');
  const [diarySubTab, setDiarySubTab] = useState<'sleep' | 'measurements' | 'progress'>('sleep');
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<any>(null);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [customReportBlocks, setCustomReportBlocks] = useState<Record<string, boolean>>({
    profile: true, training: true, nutrition: true, labs: true,
    pharma: true, risk: true, support: true, bp: true, sleep: true,
  });

  // Contacts state
  const [showFriendForm, setShowFriendForm] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [friendVerifyStatus, setFriendVerifyStatus] = useState<'idle'|'checking'|'found'|'not_found'>('idle');
  const [friendVerifiedName, setFriendVerifiedName] = useState('');
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingUsername, setTrainingUsername] = useState('');
  const [notification, setNotification] = useState<{text:string;type:'success'|'error'} | null>(null);
  const showNotif = (text:string,type:'success'|'error'='success') => { setNotification({text,type}); setTimeout(()=>setNotification(null),2500); };

  const verifyUsername = async () => {
    const u = friendUsername.trim().replace(/^@/, '');
    if (!u) return;
    setFriendVerifyStatus('checking');
    try {
      const res = await fetch('/api/verify-telegram-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      if (data.ok) {
        setFriendVerifyStatus('found');
        setFriendVerifiedName(data.name || u);
        if (!friendName.trim()) setFriendName(data.name || u);
      } else {
        setFriendVerifyStatus('not_found');
      }
    } catch {
      setFriendVerifyStatus('not_found');
    }
  };

  // Debounced verify on username change
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const onFriendUsernameChange = (val: string) => {
    setFriendUsername(val);
    setFriendVerifyStatus('idle');
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    if (val.trim().length >= 3) {
      verifyTimerRef.current = setTimeout(verifyUsername, 600);
    }
  };

  // Food diary data for reports
  const [foodDiaryAvg, setFoodDiaryAvg] = useState<{avgKcal:number;avgProtein:number;avgFat:number;avgCarbs:number} | null>(null);

  interface TelegramFriend { id: string; name: string; username: string; avatar?: string; addedAt: string; }
  const TELEGRAM_FRIENDS_KEY = 'telegramFriends';
  const getFriends = (): TelegramFriend[] => { try { return JSON.parse(localStorage.getItem(TELEGRAM_FRIENDS_KEY) || '[]'); } catch { return []; } };
  const [friends, setFriends] = useState<TelegramFriend[]>(getFriends);
  const saveFriends = (f: TelegramFriend[]) => { localStorage.setItem(TELEGRAM_FRIENDS_KEY, JSON.stringify(f)); setFriends(f); };

  const removeFriend = (id: string) => { saveFriends(friends.filter(f => f.id !== id)); showNotif('Друг удалён'); };

  const doAddFriend = () => {
    if (!friendName.trim()) return;
    const newFriend: TelegramFriend = {
      id: crypto.randomUUID(), name: friendName.trim(),
      username: friendUsername.trim().replace(/^@/, '') || 'user',
      addedAt: new Date().toISOString().split('T')[0],
    };
    saveFriends([...friends, newFriend]);
    setFriendName(''); setFriendUsername(''); setFriendVerifyStatus('idle'); setShowFriendForm(false);
    const status = friendVerifyStatus === 'found' ? ' (подтверждён через Telegram)' : '';
    showNotif(`✅ ${newFriend.name} добавлен${status}`);

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.switchInlineQuery) {
      setTimeout(() => {
        try { tg.switchInlineQuery(`friend_${newFriend.id}`, ['users']); } catch {}
      }, 500);
    }
  };

  const doInviteFriend = () => {
    const inviteLink = `https://t.me/BodyBuildHealthBot?start=ref_${crypto.randomUUID().slice(0,8)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(inviteLink);
      showNotif('🔗 Приглашение отправлено');
    } else {
      navigator.clipboard?.writeText(inviteLink).then(() => showNotif('📋 Ссылка-приглашение скопирована'));
    }
  };

  const doShareReport = () => {
    const tg = (window as any).Telegram?.WebApp;
    const s = profile?.settings ?? {};
    const bmiVal = s.weight && s.height ? (s.weight / Math.pow(s.height / 100, 2)).toFixed(1) : '—';
    const lbm = s.weight && s.bodyFat ? s.weight * (1 - s.bodyFat / 100) : 0;
    const ffmiVal = lbm && s.height ? (lbm / Math.pow(s.height / 100, 2) + 6.1 * (1.8 - s.height / 100)).toFixed(1) : '—';
    const riskRaw = (() => { try { return JSON.parse(localStorage.getItem('he_last_risk') || 'null'); } catch { return null; } })();
    const riskPct = riskRaw?.overallNet || '—';
    const supps = (s.currentSupplements || []).slice(0, 3).map((x: any) => x.name).join(', ') || 'нет';
    const report = [
      `📊 *Отчёт BodyBuildHealth*`,
      `👤 ${profile.name || 'Пользователь'}`,
      `⚖️ Вес: ${s.weight || '—'} кг | Рост: ${s.height || '—'} см`,
      `📐 BMI: ${bmiVal} | FFMI: ${ffmiVal}`,
      `🔥 Риск: ${riskPct}%`,
      `💊 Поддержка: ${supps}`,
      `📅 ${new Date().toLocaleDateString('ru')}`,
    ].join('\n');

    if (tg?.sendData) {
      tg.sendData(JSON.stringify({ type: 'share_report', report }));
      showNotif('📤 Отчёт отправлен через Telegram');
    } else if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent('https://body-build-health.vercel.app')}&text=${encodeURIComponent(report)}`);
      showNotif('🔗 Telegram открыт');
    } else {
      navigator.clipboard?.writeText(report).then(() => showNotif('📋 Отчёт скопирован в буфер'));
    }
  };

  const doShareTraining = () => {
    if (!trainingUsername.trim()) return;
    const tg = (window as any).Telegram?.WebApp;
    const deepLink = `https://t.me/BodyBuildHealthBot?start=training_view_${trainingUsername.trim()}`;
    localStorage.setItem('he_shared_training_for', trainingUsername.trim());
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(deepLink);
    } else if (tg?.openLink) {
      tg.openLink(deepLink);
    } else {
      navigator.clipboard?.writeText(deepLink).then(() => showNotif('📋 Ссылка скопирована'));
    }
    setTrainingUsername(''); setShowTrainingForm(false);
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

  const [calcData, setCalcData] = React.useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('he_autocalc_state') || '{}'); } catch { return {}; }
  });
  const upCalc = (k: string, v: any) => {
    const next = { ...calcData };
    const keys = k.split('.');
    let o = next; for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = v; setCalcData(next);
    try { localStorage.setItem('he_autocalc_state', JSON.stringify(next)); } catch {}
  };

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

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'info', label: '📋 Сведения' },
    { id: 'analytics', label: '📊 Аналитика' },
    { id: 'contacts', label: '📞 Контакты' },
  ];

  // Sub-tabs for 'info' mainTab
  const infoSubTabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Обзор' },
    { id: 'anthropometry', label: 'Тело' },
    { id: 'lifestyle', label: 'Образ жизни' },
    { id: 'health', label: '🏥 Здоровье' },
    { id: 'diet', label: 'Питание' },
    { id: 'genetics', label: 'Генетика' },
    { id: 'injuries', label: 'Травмы' },
    { id: 'diaries', label: '📓 Дневники' },
    { id: 'bp_diary', label: '🫀 Давление' },
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
                { id: 'info', icon: '📋', title: 'Сведения о пользователе', desc: 'Персональные данные, образ жизни, питание, генетика, травмы, дневники (вес, давление, сон, замеры)', color: '#00e68a' },
                { id: 'analytics', icon: '📊', title: 'Аналитика', desc: 'Отчёты по всем модулям, графики прогресса, архив отчётов', color: '#3b82f6' },
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

          {/* Main tabs: 3 only */}
          <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:6, paddingBottom:2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setMainTab(t.id); if (t.id === 'analytics') setTab('analytics'); if (t.id === 'contacts') setTab('contacts'); if (t.id === 'info' && mainTab !== 'info') setTab('overview'); }} style={{
                padding:'8px 18px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: mainTab === t.id ? apple.accentDim : apple.glassBg,
                border: mainTab === t.id ? apple.accentBorder : apple.glassBorder,
                color: mainTab === t.id ? apple.accent : apple.textSecondary,
                transition:'all 0.2s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Sub-tabs for 'info' */}
          {mainTab === 'info' && (
            <div style={{ display:'flex', gap:3, overflowX:'auto', scrollbarWidth:'none', marginBottom:10, paddingBottom:2 }}>
              {infoSubTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding:'5px 12px', borderRadius:18, fontSize:10, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                  background: tab === t.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                  border: tab === t.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: tab === t.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
                  transition:'all 0.2s',
                }}>{t.label}</button>
              ))}
            </div>
          )}

          {/* ═══ INFO TABS (mainTab === 'info') ═══ */}
          {mainTab === 'info' && (<>
          {/* ═══ OVERVIEW TAB ═══ */}
          {tab === 'overview' && <>
            <InfoErrorBoundary label="Сведения о пользователе">
              <div style={{ display:'flex', gap:2, padding:'4px 0', overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  ['general','👤','Общая'], ['nutrition','🥗','Питание'],
                  ['training','💪','Тренировки'], ['supplements','💊','Поддержка'],
                  ['pharma','💉','Фарма'], ['labs','🔬','Анализы'], ['risks','⚠️','Риски'],
                ].map(t => {
                  const a = overTab === t[0];
                  return <button key={t[0]} onClick={() => setOverTab(t[0])} style={{ padding:'4px 8px', borderRadius:8, fontSize:7, fontWeight: a ? 700 : 400, cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0, background: a ? '#00e68a' : 'rgba(255,255,255,0.04)', border:'1px solid ' + (a ? '#00e68a' : 'rgba(255,255,255,0.06)'), color: a ? '#000' : 'rgba(255,255,255,0.8)' }}>{t[1]} {t[2]}</button>;
                })}
              </div>
              {overTab === 'general' && <>
                <div style={{ ...glassCard, background:'linear-gradient(135deg, rgba(0,230,138,0.08), rgba(0,180,100,0.04))', border: apple.accentBorder }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                    <div style={{ width:60, height:60, borderRadius:'50%', background: apple.gradientGreen, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#000', boxShadow:'0 4px 20px rgba(0,230,138,0.25)', flexShrink:0 }}>{initials}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:18, fontWeight:700, color: apple.textPrimary }}>{profile.name || 'Пользователь'}</div>
                      <div style={{ fontSize:12, color: apple.textSecondary, marginTop:2 }}>{settings.age || '—'} лет • {goalLabel} • {sportLabel}</div>
                      <div style={{ fontSize:11, color: apple.textDim, marginTop:2 }}>Стаж: {trainExp || '—'} лет • Уровень: {trainLevelLabel}</div>
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
                {(() => {
                  const op = overPopup;
                  const s = settings;
                  const cards: { id:string; icon:string; title:string; color:string; summary:(s:any)=>string; fields:(s:any)=>React.ReactNode }[] = [
                    { id:'basic', icon:'👤', title:'Основная информация', color:'#60a5fa',
                      summary: s => `${s?.name||profile.name||'—'} • ${s?.age||'—'} лет • ${s?.sex==='male'?'Муж':s?.sex==='female'?'Жен':'—'}`,
                      fields: s => <>
                        <HealthNumber label="Возраст" value={s?.age||''} onChange={v => save({age:parseInt(v)||0})} placeholder="30" />
                        <div style={{marginTop:6}}><HealthBool label="Мужской" active={s?.sex==='male'} onClick={() => save({sex:'male'})} /><span style={{display:'inline-block',width:6}}/><HealthBool label="Женский" active={s?.sex==='female'} onClick={() => save({sex:'female'})} /></div>
                      </>
                    },
                    { id:'extended', icon:'📋', title:'Расширенная информация', color:'#34d399',
                      summary: s => `${SPORT_TYPES.find(st=>st.id===(s?.sportType||'bodybuilding'))?.label||'—'} • Стаж ${s?.trainingExperience||'—'} лет${s?.bloodType ? ' • '+(BLOOD_TYPES.find(b=>b.id===s.bloodType)?.label||'') : ''}`,
                      fields: s => <>
                        <div style={{marginBottom:6}}><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Вид спорта</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{SPORT_TYPES.map(st => <HealthBool key={st.id} label={st.label} active={(s?.sportType||'bodybuilding')===st.id} onClick={() => save({sportType:st.id})} />)}</div></div>
                        <HealthNumber label="Стаж (лет)" value={s?.trainingExperience||''} onChange={v => save({trainingExperience:parseInt(v)||0})} />
                        <div style={{marginTop:6,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          <div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Группа крови</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{BLOOD_TYPES.map(bt => <HealthBool key={bt.id} label={bt.label} active={s?.bloodType===bt.id} onClick={() => save({bloodType:bt.id})} />)}</div></div>
                          <HealthNumber label="Аллергии (заметки)" value={s?.allergyNotes||''} onChange={v => save({allergyNotes:v})} />
                        </div>
                        <div style={{marginTop:6}}><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Хронические заболевания</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{CHRONIC_CONDITIONS.map(c => {const a=(s?.chronicConditions??[]).includes(c.id); return <HealthBool key={c.id} label={c.label} active={a} onClick={() => {const cur=s?.chronicConditions??[]; save({chronicConditions:a?cur.filter((x:string)=>x!==c.id):[...cur,c.id]})}} />})}</div></div>
                        <div style={{marginTop:6,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          <HealthNumber label="Экстренный контакт" value={s?.emergencyName||''} onChange={v => save({emergencyName:v})} />
                          <HealthNumber label="Экстренный телефон" value={s?.emergencyPhone||''} onChange={v => save({emergencyPhone:v})} />
                        </div>
                      </>
                    },
                    { id:'course', icon:'💉', title:'Фаза курса', color:'#f87171',
                      summary: s => `${COURSE_PHASES.find(p=>p.id===(s?.phase||'baseline'))?.label||'—'}${s?.courseStartDate?' • с '+s.courseStartDate:''}`,
                      fields: s => <>
                        <div style={{marginBottom:6}}><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Фаза</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{COURSE_PHASES.map(p => <HealthBool key={p.id} label={p.label} active={(s?.phase||'baseline')===p.id} onClick={() => save({phase:p.id})} />)}</div></div>
                        {s?.courseStartDate ? <HealthNumber label="Дата начала курса" value={s.courseStartDate} onChange={v => save({courseStartDate:v})} /> : s?.phase && s.phase!=='baseline' ? <button onClick={() => save({courseStartDate:new Date().toISOString().slice(0,10)})} style={{marginTop:4,padding:'6px 12px',borderRadius:8,border:'1px solid rgba(248,113,113,0.3)',background:'rgba(248,113,113,0.1)',color:'#fca5a5',cursor:'pointer',fontSize:10,fontWeight:600}}>📅 Указать дату начала</button> : null}
                      </>
                    },
                  ];
                  return <>{cards.map(c => {
                    const open = op === c.id;
                    return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setOverPopup(open?null:c.id)}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:18}}>{c.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                          <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary(s)}</div>
                        </div>
                        <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                      </div>
                      {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields(s)}</div>}
                    </div>;
                  })}</>;
                })()}
              </>}
              {overTab === 'nutrition' && <>
                <div style={glassCard}>
                  <div style={sectionLabel}>Питание v2 (динамический TDEE)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
                    <div style={{ background:'rgba(0,230,138,0.06)', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Текущий TDEE</div>
                      <div style={{ fontSize:20, fontWeight:800, color:'#00e68a' }}>{Math.round(nutV2.currentTDEE)}</div>
                      <div style={{ fontSize:9, color: nutV2.tdeeAdjustment > 50 ? '#ef4444' : nutV2.tdeeAdjustment < -50 ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>{nutV2.tdeeAdjustment !== 0 ? `${nutV2.tdeeAdjustment > 0 ? '+' : ''}${Math.round(nutV2.tdeeAdjustment)} ккал корр.` : 'базовый'}</div>
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
                  {nutV2.weightHistory.length > 0 && <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:4, textAlign:'center' }}>{nutV2.weightHistory.length} записей</div>}
                </div>
                <div style={glassCard}>
                  <div style={sectionLabel}>🍬 Поведенческие режимы</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <button onClick={() => saveNutritionV2Data({ cravingMode: !nutV2.cravingMode })} style={{ padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', fontWeight: nutV2.cravingMode ? 700 : 400, background: nutV2.cravingMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: nutV2.cravingMode ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)', color: nutV2.cravingMode ? '#ef4444' : 'rgba(255,255,255,0.8)' }}>🍬 Хочу сладкое</button>
                      {nutV2.cravingMode && <select value={nutV2.cravingDays} onChange={e => saveNutritionV2Data({ cravingDays: parseInt(e.target.value) })} style={{ padding:'4px 6px', borderRadius:6, fontSize:9, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>{[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} дн.</option>)}</select>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <button onClick={() => saveNutritionV2Data({ lazyDayActive: !nutV2.lazyDayActive })} style={{ padding:'5px 10px', borderRadius:8, fontSize:9, cursor:'pointer', fontWeight: nutV2.lazyDayActive ? 700 : 400, background: nutV2.lazyDayActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: nutV2.lazyDayActive ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)', color: nutV2.lazyDayActive ? '#f59e0b' : 'rgba(255,255,255,0.8)' }}>🛋 Ленивый день</button>
                      {nutV2.lazyDayActive && <select value={nutV2.lazyDayDays} onChange={e => saveNutritionV2Data({ lazyDayDays: parseInt(e.target.value) })} style={{ padding:'4px 6px', borderRadius:6, fontSize:9, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>{[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} дн.</option>)}</select>}
                    </div>
                  </div>
                </div>
              </>}
              {overTab === 'training' && <>
                {readinessScores && <div style={glassCard}>
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
                </div>}
              </>}
              {overTab === 'supplements' && <div style={glassCard}><div style={sectionLabel}>💊 Добавки</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Управление добавками — в разделе Бады → Каталог</div></div>}
              {overTab === 'pharma' && <div style={glassCard}><div style={sectionLabel}>💉 Фармакология</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Управление курсом — в разделе Фармакология → Курс</div></div>}
              {overTab === 'labs' && <>
                {clinicalIndices && <div style={glassCard}>
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
                </div>}
                <div style={glassCard}><div style={sectionLabel}>Ввод анализов</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Ввод и отслеживание анализов — в разделе Питание → Здоровье</div></div>
              </>}
              {overTab === 'risks' && <div style={glassCard}><div style={sectionLabel}>⚠️ Риски</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Детальный анализ рисков — в разделе Риски</div></div>}
            </InfoErrorBoundary>
          </>}

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

            {(() => {
              const ap = anthroPopup;
              const s = settings;
              const cards: { id:string; icon:string; title:string; color:string; summary:(s:any)=>string; fields:(s:any)=>React.ReactNode }[] = [
                { id:'body', icon:'⚖️', title:'Основные параметры', color:'#34d399',
                  summary: s => `${s?.height||'—'} см • ${s?.weight||'—'} кг • ${s?.bodyFat?s.bodyFat+'% жира':''} • ${s?.sex==='male'?'Муж':s?.sex==='female'?'Жен':'—'}`,
                  fields: s => <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <HealthNumber label="Рост (см)" value={s?.height||''} onChange={v => save({height:parseInt(v)||0})} placeholder="175" />
                      <HealthNumber label="Вес (кг)" value={s?.weight||''} onChange={v => save({weight:parseFloat(v)||0})} placeholder="80" />
                      <HealthNumber label="% жира (ручной)" value={s?.bodyFat||''} onChange={v => save({bodyFat:v?parseFloat(v)||0:undefined})} placeholder="15" />
                      <div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Пол</div><div style={{display:'flex',gap:4}}><HealthBool label="М" active={s?.sex==='male'} onClick={()=>save({sex:'male'})} /><HealthBool label="Ж" active={s?.sex==='female'} onClick={()=>save({sex:'female'})} /></div></div>
                    </div>
                  </>
                },
                { id:'girth', icon:'📏', title:'Обхваты (см)', color:'#60a5fa',
                  summary: s => {const items=[{k:'waistCm',l:'Талия'},{k:'neckCm',l:'Шея'},{k:'chestCm',l:'Грудь'},{k:'hipCm',l:'Бёдра'},{k:'forearmCm',l:'Предплечье'},{k:'bicepCm',l:'Бицепс'},{k:'thighCm',l:'Бедро'}].filter(x=>(s||{})[x.k]); return items.length?items.map(x=>x.l+': '+(s||{})[x.k]+'см').join(', '):'Не заполнены';},
                  fields: s => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {[{k:'waistCm',l:'Талия'},{k:'neckCm',l:'Шея'},{k:'chestCm',l:'Грудь'},{k:'hipCm',l:'Бёдра'},{k:'forearmCm',l:'Предплечье'},{k:'bicepCm',l:'Бицепс'},{k:'thighCm',l:'Бедро'}].map(c =>
                      <HealthNumber key={c.k} label={c.l} value={(s||{})[c.k]??''} onChange={v => save({[c.k]:v?parseFloat(v)||0:undefined} as any)} />
                    )}
                  </div>
                },
              ];
              return <>{cards.map(c => {
                const open = ap === c.id;
                return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setAnthroPopup(open?null:c.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary(s)}</div>
                    </div>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                  </div>
                  {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields(s)}</div>}
                </div>;
              })}</>;
            })()}

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
                  <span>Мин: {weightLog.length > 0 ? Math.min(...weightLog.map(w => w.weight ?? 0)).toFixed(1) : '—'} кг</span>
                  <span style={{ color: apple.accent, fontWeight:600 }}>{weightLog[weightLog.length - 1]?.weight?.toFixed(1) ?? '—'} кг</span>
                  <span>Макс: {weightLog.length > 0 ? Math.max(...weightLog.map(w => w.weight ?? 0)).toFixed(1) : '—'} кг</span>
                </div>
              </div>
            )}
            </InfoErrorBoundary>
          )}

          {/* ═══ LIFESTYLE TAB ═══ */}
          {tab === 'lifestyle' && (
            <InfoErrorBoundary label="Образ жизни">
            {(() => {
              const lp = lifestylePopup;
              const s = settings;
              const cd = calcData||{};
              const cards: { id:string; icon:string; title:string; color:string; summary:(s:any,cd:any)=>string; fields:(s:any,cd:any)=>React.ReactNode }[] = [
                { id:'stress', icon:'😰', title:'Стресс и усталость', color:'#f87171',
                  summary: (s) => `Стресс: ${s?.baselineStressLevel??3}/10 • Усталость: ${s?.fatigueLevel??3}/10`,
                  fields: (s) => <>
                    {['baselineStressLevel','fatigueLevel'].map(k => {
                      const label = k==='baselineStressLevel'?'Стресс':'Усталость';
                      const val = s?.[k]??3;
                      return <div key={k} style={{marginBottom:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                          <span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>{label}</span>
                          <span style={{fontSize:11,fontWeight:700,color:val<=3?'#00e68a':val<=6?'#f59e0b':'#ef4444'}}>{val}/10</span>
                        </div>
                        <input type="range" min={1} max={10} value={val} onChange={e => save({[k]:parseFloat(e.target.value)||0})} style={{width:'100%',accentColor:'#00e68a'}} />
                      </div>;
                    })}
                  </>
                },
                { id:'activity', icon:'🏃', title:'Активность', color:'#34d399',
                  summary: (s) => `Шаги: ${s?.dailySteps??6000} • Вода: ${s?.dailyWaterLiters??2}л • Тренировки: ${s?.workoutsPerWeek||'—'}/${s?.avgWorkoutMinutes||'—'}мин`,
                  fields: (s) => <>
                    {[{k:'dailySteps',l:'Шаги/день',max:30000,step:500},{k:'dailyWaterLiters',l:'Вода/день (л)',max:6,step:0.1}].map(({k,l,max,step}) => {
                      const val = s?.[k]??(k==='dailySteps'?6000:2);
                      return <div key={k} style={{marginBottom:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                          <span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>{l}</span>
                          <span style={{fontSize:11,fontWeight:700,color:'#00e68a'}}>{val}</span>
                        </div>
                        <input type="range" min={0} max={max} step={step} value={val} onChange={e => save({[k]:parseFloat(e.target.value)||0})} style={{width:'100%',accentColor:'#00e68a'}} />
                      </div>;
                    })}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <HealthNumber label="Тренировок/нед" value={s?.workoutsPerWeek||''} onChange={v => save({workoutsPerWeek:parseFloat(v)||0})} />
                      <HealthNumber label="Мин/тренировку" value={s?.avgWorkoutMinutes||''} onChange={v => save({avgWorkoutMinutes:parseFloat(v)||0})} />
                    </div>
                  </>
                },
                { id:'levels', icon:'📊', title:'Уровни и опыт', color:'#8b5cf6',
                  summary: (s) => `${TRAINING_LEVELS.find(l=>l.id===(s?.trainingLevel||'intermediate'))?.label||'—'} • ${PHARMA_EXPERIENCE.find(e=>e.id===(s?.pharmaExperience||'none'))?.label||'—'}`,
                  fields: (s) => <>
                    <div style={{marginBottom:6}}><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Тренировочный уровень</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{TRAINING_LEVELS.map(l => <HealthBool key={l.id} label={l.label} active={(s?.trainingLevel||'intermediate')===l.id} onClick={()=>save({trainingLevel:l.id as any})} />)}</div></div>
                    <div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:3}}>Фармакологический опыт</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{PHARMA_EXPERIENCE.map(e => <HealthBool key={e.id} label={e.label} active={(s?.pharmaExperience||'none')===e.id} onClick={()=>save({pharmaExperience:e.id as any})} />)}</div></div>
                  </>
                },
                { id:'goals', icon:'🎯', title:'Цель', color:'#fbbf24',
                  summary: (s) => GOALS.find(g=>g.id===(s?.primaryGoal||s?.goal||''))?.label||'Не выбрана',
                  fields: (s) => <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{GOALS.map(g => <HealthBool key={g.id} label={g.label} active={(s?.primaryGoal||s?.goal||'')===g.id} onClick={()=>save({primaryGoal:g.id as any,goal:g.id})} />)}</div>
                },
                { id:'weakpoints', icon:'💪', title:'Отстающие группы', color:'#f97316',
                  summary: (s) => {const wp=s?.weakPoints??[]; return wp.length?wp.map((id:string)=>MUSCLE_GROUPS_FULL.find(m=>m.id===id)?.label||id).join(', '):'Не указаны';},
                  fields: (s) => <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{MUSCLE_GROUPS_FULL.map(m => <HealthBool key={m.id} label={m.label} active={(s?.weakPoints??[]).includes(m.id)} onClick={()=>toggleWeakPoint(m.id)} />)}</div>
                },
                { id:'supps', icon:'💊', title:'Принимаю: БАДы', color:'#38bdf8',
                  summary: (s) => {const sups=s?.currentSupplements??[]; return sups.length?sups.map((x:any)=>x.name||'?').join(', '):'Нет';},
                  fields: (s) => <div>
                    {(s?.currentSupplements??[]).map((sup:any,i:number) => <div key={sup.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <span style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.7)'}}>{sup.name||'?'} — {sup.doseMg} {sup.doseUnit}</span>
                      <button onClick={()=>save({currentSupplements:(s?.currentSupplements??[]).filter((_:any,j:number)=>j!==i)})} style={{padding:'2px 8px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#ef4444',fontSize:9,cursor:'pointer'}}>✕</button>
                    </div>)}
                    <button onClick={() => {const ns:SupplementEntry={id:crypto.randomUUID(),name:'',doseMg:0,doseUnit:'mg'}; save({currentSupplements:[...(s?.currentSupplements??[]),ns]});}} style={{marginTop:4,padding:'6px 12px',borderRadius:8,border:'1px solid rgba(56,189,248,0.3)',background:'rgba(56,189,248,0.1)',color:'#7dd3fc',cursor:'pointer',fontSize:10,fontWeight:600}}>+ Добавить БАД</button>
                  </div>
                },
                { id:'meds', icon:'💉', title:'Принимаю: Аптека', color:'#a78bfa',
                  summary: (s) => {const meds=s?.currentMedications??[]; return meds.length?meds.map((x:any)=>x.name||'?').join(', '):'Нет';},
                  fields: (s) => <div>
                    {(s?.currentMedications??[]).map((med:any,i:number) => <div key={med.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <span style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.7)'}}>{med.name||'?'} — {med.doseMg} {med.doseUnit} ({med.frequency})</span>
                      <button onClick={()=>save({currentMedications:(s?.currentMedications??[]).filter((_:any,j:number)=>j!==i)})} style={{padding:'2px 8px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'transparent',color:'#ef4444',fontSize:9,cursor:'pointer'}}>✕</button>
                    </div>)}
                    <button onClick={() => {const nm:MedicationEntry={id:crypto.randomUUID(),name:'',doseMg:0,doseUnit:'mg',frequency:'daily'}; save({currentMedications:[...(s?.currentMedications??[]),nm]});}} style={{marginTop:4,padding:'6px 12px',borderRadius:8,border:'1px solid rgba(167,139,250,0.3)',background:'rgba(167,139,250,0.1)',color:'#c4b5fd',cursor:'pointer',fontSize:10,fontWeight:600}}>+ Добавить препарат</button>
                  </div>
                },
                { id:'neuropsych', icon:'🧠', title:'Нейро + Псих (калькулятор)', color:'#e879f9',
                  summary: (cd) => `Дофамин: ${cd.neuro?.dopamineScore||1} • Серотонин: ${cd.neuro?.serotoninScore||1} • Страх потери: ${cd.psych?.fearOfLoss||1}`,
                  fields: (cd) => <>
                    {[
                      {k:'neuro.dopamineScore',l:'Дофамин',g:'neuro',f:'dopamineScore'},
                      {k:'neuro.serotoninScore',l:'Серотонин',g:'neuro',f:'serotoninScore'},
                      {k:'neuro.aggressionScore',l:'Агрессия',g:'neuro',f:'aggressionScore'},
                      {k:'psych.fearOfLoss',l:'Страх потери',g:'psych',f:'fearOfLoss'},
                      {k:'psych.mirrorObsession',l:'Одержимость зеркалом',g:'psych',f:'mirrorObsession'},
                      {k:'psych.apathyOffCycle',l:'Апатия вне курса',g:'psych',f:'apathyOffCycle'},
                    ].map(f => {
                      const val = cd[f.g]?.[f.f]||1;
                      return <div key={f.k} style={{marginBottom:4}}>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:2}}>{f.l}</div>
                        <div style={{display:'flex',gap:3}}>{[1,2,3,4,5].map(n => 
                          <button key={n} onClick={() => upCalc(f.k,n)} style={{flex:1,padding:'5px 0',borderRadius:6,border:'none',cursor:'pointer',fontSize:10,fontWeight:700,background:val===n?'#00e68a':'rgba(255,255,255,0.06)',color:val===n?'#000':'rgba(255,255,255,0.4)'}}>{n}</button>
                        )}</div>
                      </div>;
                    })}
                  </>
                },
              ];
              return <>{cards.map(c => {
                const open = lp === c.id;
                return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setLifestylePopup(open?null:c.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary(s,cd)}</div>
                    </div>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                  </div>
                  {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields(s,cd)}</div>}
                </div>;
              })}</>;
            })()}
            </InfoErrorBoundary>
          )}

          {/* ═══ HEALTH TAB (данные для калькуляторов) ═══ */}
          {tab === 'health' && (
            <InfoErrorBoundary label="Здоровье">
            <div>
              <div style={{ marginBottom:12 }}>
                <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#fff' }}>🏥 Данные здоровья</h3>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', margin:0 }}>Данные для калькулятора поддержки и риск-движка. Заполняется один раз.</p>
              </div>
              {/* Labs + health data hub */}
              <div style={{ ...glassCard, marginBottom:8, border:'1px solid rgba(59,130,246,0.25)', background:'linear-gradient(135deg,rgba(59,130,246,0.10),rgba(99,102,241,0.05))' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>📊</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#60a5fa' }}>Источники данных для расчётов</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:1 }}>Лабораторные маркеры (Labs) + карточки здоровья ниже → все модули</div>
                  </div>
                </div>
                {/* Usage rows */}
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:7 }}>
                  {[
                    { icon:'⚠️', label:'Расчёт рисков (TZ)', info:'38 маркеров + здоровье', nav:'risks' as const, color:'#f87171' },
                    { icon:'🧩', label:'Калькулятор поддержки', info:'50+ маркеров + здоровье', nav:'support' as const, color:'#34d399' },
                    { icon:'🏋️', label:'Тренировки (объём/коррекция)', info:'композиты + здоровье', nav:'training' as const, color:'#60a5fa' },
                    { icon:'🧬', label:'Фертильность', info:'18 параметров', nav:'support' as const, color:'#c084fc' },
                    { icon:'📊', label:'Readiness / прогнозы', info:'4 маркера + стресс/сон', nav:'home' as const, color:'#fbbf24' },
                  ].map(m => (
                    <div key={m.nav+m.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', cursor:'pointer' }}
                      onClick={() => onNavigate?.(m.nav)}>
                      <span style={{ fontSize:12 }}>{m.icon}</span>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)', flex:1 }}>{m.label}</span>
                      <span style={{ fontSize:9, color:m.color, fontWeight:600 }}>{m.info}</span>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>→</span>
                    </div>
                  ))}
                </div>
                {/* Action buttons */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
                  <button onClick={() => onNavigate?.('labs')} style={{
                    padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer',
                    background:'rgba(59,130,246,0.25)', color:'#93c5fd', fontSize:10, fontWeight:700,
                  }}>🧪 Labs</button>
                  <button onClick={() => onNavigate?.('risks')} style={{
                    padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer',
                    background:'rgba(248,113,113,0.2)', color:'#fca5a5', fontSize:10, fontWeight:700,
                  }}>⚠ Риски</button>
                  <button onClick={() => onNavigate?.('support')} style={{
                    padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer',
                    background:'rgba(52,211,153,0.2)', color:'#6ee7b7', fontSize:10, fontWeight:700,
                  }}>🧩 Поддержка</button>
                </div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:6, textAlign:'center' }}>
                  Лабораторные цифры (Labs) + карточки «🫁 Гепатобилиарная», «❤️ ССС», «💧 Мочевыделительная» и т.д. ниже — все данные склеиваются в общий профиль здоровья
                </div>
              </div>
              {(() => {
                const hp = healthPopup;
                const systems: {
                  id: string; icon: string; title: string; color: string;
                  summary: (d: any) => string;
                  fields: (d: any, u: Function) => React.ReactNode;
                }[] = [
                  { id:'hepatobiliary', icon:'🫁', title:'Гепатобилиарная', color:'#34d399',
                    summary: d => {
                      const alt = d?.altAstElevation || 'none'; const ggt = d?.ggtElevation || 'none';
                      const bil = d?.bilirubinElevation || 'none';
                      const flags = [d?.fattyLiver ? 'Жир.печень' : '', d?.cholecystitis ? 'Холецистит' : ''].filter(Boolean).join(', ');
                      return `АЛТ/АСТ: ${alt==='none'?'Норма':alt==='mild'?'↑':alt==='moderate'?'↑↑':'↑↑↑'} | ГГТ: ${ggt==='none'?'Норма':ggt==='mild'?'↑':ggt==='moderate'?'↑↑':'↑↑↑'}${flags ? ' | '+flags : ''}`;
                    },
                    fields: (d, u) => <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <HealthSelect label="АЛТ/АСТ" value={d?.altAstElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑'],['severe','Выраженное ↑']]} onChange={v => u('hepatobiliary',{...d,altAstElevation:v})} />
                        <HealthSelect label="ГГТ" value={d?.ggtElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑'],['severe','Выраженное ↑']]} onChange={v => u('hepatobiliary',{...d,ggtElevation:v})} />
                        <HealthSelect label="Билирубин" value={d?.bilirubinElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑']]} onChange={v => u('hepatobiliary',{...d,bilirubinElevation:v})} />
                        <div style={{ display:'flex', gap:4, alignItems:'end', paddingBottom:4 }}>
                          <HealthBool label="Жир.печень" active={!!d?.fattyLiver} onClick={() => u('hepatobiliary',{...d,fattyLiver:!d?.fattyLiver})} />
                          <HealthBool label="Холецистит" active={!!d?.cholecystitis} onClick={() => u('hepatobiliary',{...d,cholecystitis:!d?.cholecystitis})} />
                        </div>
                      </div>
                    </>
                  },
                  { id:'urinary', icon:'💧', title:'Мочевыделительная', color:'#60a5fa',
                    summary: d => {
                      const cr = d?.creatinineElevation||'none'; const ur = d?.ureaElevation||'none';
                      const flags = [d?.proteinuria?'Протеинурия':'',d?.hypertension?'Гипертония':'',d?.diabetes?'Диабет':''].filter(Boolean).join(', ');
                      return `Креатинин: ${cr==='none'?'Норма':cr==='mild'?'↑':'↑↑'} | Мочевина: ${ur==='none'?'Норма':ur==='mild'?'↑':'↑↑'}${flags ? ' | '+flags : ''}`;
                    },
                    fields: (d, u) => <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <HealthSelect label="Креатинин" value={d?.creatinineElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑']]} onChange={v => u('urinary',{...d,creatinineElevation:v})} />
                        <HealthSelect label="Мочевина" value={d?.ureaElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑']]} onChange={v => u('urinary',{...d,ureaElevation:v})} />
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                        <HealthBool label="Протеинурия" active={!!d?.proteinuria} onClick={() => u('urinary',{...d,proteinuria:!d?.proteinuria})} />
                        <HealthBool label="Гипертония" active={!!d?.hypertension} onClick={() => u('urinary',{...d,hypertension:!d?.hypertension})} />
                        <HealthBool label="Диабет" active={!!d?.diabetes} onClick={() => u('urinary',{...d,diabetes:!d?.diabetes})} />
                      </div>
                    </>
                  },
                  { id:'cardio', icon:'❤️', title:'ССС', color:'#f87171',
                    summary: d => {
                      const bp = d?.bpStage||'normal'; const hr = d?.heartRate||'';
                      const ldl = d?.ldlElevation||'none'; const hct = d?.hctElevation||'none';
                      const f = [d?.previousCVD?'ССЗ':'',d?.familyCVD?'Наслед.':''].filter(Boolean).join(',');
                      return `АД: ${bp==='normal'?'Норма':bp==='high_normal'?'↑':bp==='hypertension1'?'I ст.':'II ст.'}${hr?' | ЧСС: '+hr:''}${f?' | '+f:''}`;
                    },
                    fields: (d, u) => <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <HealthSelect label="АД" value={d?.bpStage||'normal'} opts={[['normal','Норма'],['high_normal','Высокая норма'],['hypertension1','Гипертензия 1'],['hypertension2','Гипертензия 2']]} onChange={v => u('cardio',{...d,bpStage:v})} />
                        <HealthNumber label="ЧСС" value={d?.heartRate||''} onChange={v => u('cardio',{...d,heartRate:v ? parseInt(v)||0 : 0})} placeholder="70" />
                        <HealthSelect label="ЛПНП" value={d?.ldlElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑'],['severe','Выраженное ↑']]} onChange={v => u('cardio',{...d,ldlElevation:v})} />
                        <HealthSelect label="Гематокрит" value={d?.hctElevation||'none'} opts={[['none','Норма'],['mild','Лёгкое ↑'],['moderate','Умеренное ↑'],['severe','Выраженное ↑']]} onChange={v => u('cardio',{...d,hctElevation:v})} />
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                        <HealthBool label="ССЗ в анамнезе" active={!!d?.previousCVD} onClick={() => u('cardio',{...d,previousCVD:!d?.previousCVD})} />
                        <HealthBool label="Наследственность" active={!!d?.familyCVD} onClick={() => u('cardio',{...d,familyCVD:!d?.familyCVD})} />
                      </div>
                    </>
                  },
                  { id:'neuro', icon:'🧠', title:'Неврология', color:'#a78bfa',
                    summary: d => `Дофамин: ${d?.dopamineScore||'—'} | Серотонин: ${d?.serotoninScore||'—'} | Агрессия: ${d?.aggressionScore||'—'}${[d?.memoryIssues?'Память':'',d?.focusIssues?'Конц.':'',d?.headaches?'Боли':''].filter(Boolean).length ? ' | '+[d?.memoryIssues?'Память':'',d?.focusIssues?'Конц.':'',d?.headaches?'Боли':''].filter(Boolean).join(',') : ''}`,
                    fields: (d, u) => <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                        <HealthNumber label="Дофамин (1-5)" value={d?.dopamineScore||1} min={1} max={5} onChange={v => u('neuro',{...d,dopamineScore:parseInt(v)||1})} />
                        <HealthNumber label="Серотонин (1-5)" value={d?.serotoninScore||1} min={1} max={5} onChange={v => u('neuro',{...d,serotoninScore:parseInt(v)||1})} />
                        <HealthNumber label="Агрессия (1-5)" value={d?.aggressionScore||1} min={1} max={5} onChange={v => u('neuro',{...d,aggressionScore:parseInt(v)||1})} />
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                        <HealthBool label="Память" active={!!d?.memoryIssues} onClick={() => u('neuro',{...d,memoryIssues:!d?.memoryIssues})} />
                        <HealthBool label="Концентрация" active={!!d?.focusIssues} onClick={() => u('neuro',{...d,focusIssues:!d?.focusIssues})} />
                        <HealthBool label="Головные боли" active={!!d?.headaches} onClick={() => u('neuro',{...d,headaches:!d?.headaches})} />
                      </div>
                    </>
                  },
                  { id:'gi', icon:'🫀', title:'ЖКТ', color:'#fbbf24',
                    summary: d => { const a = [d?.bloating?'Вздутие':'',d?.heartburn?'Изжога':'',d?.diarrhea?'Диарея':'',d?.constipation?'Запор':'',d?.diagnosedIBS?'СРК':''].filter(Boolean); return a.length ? a.join(', ') : 'Нет жалоб'; },
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <HealthBool label="Вздутие" active={!!d?.bloating} onClick={() => u('gi',{...d,bloating:!d?.bloating})} />
                      <HealthBool label="Изжога" active={!!d?.heartburn} onClick={() => u('gi',{...d,heartburn:!d?.heartburn})} />
                      <HealthBool label="Диарея" active={!!d?.diarrhea} onClick={() => u('gi',{...d,diarrhea:!d?.diarrhea})} />
                      <HealthBool label="Запор" active={!!d?.constipation} onClick={() => u('gi',{...d,constipation:!d?.constipation})} />
                      <HealthBool label="СРК" active={!!d?.diagnosedIBS} onClick={() => u('gi',{...d,diagnosedIBS:!d?.diagnosedIBS})} />
                    </div>
                  },
                  { id:'oda', icon:'🦴', title:'ОДА', color:'#f97316',
                    summary: d => { const a = [d?.jointPain==='mild'?'Боль в суставах':'',d?.ligamentIssues?'Связки':'',d?.backPain?'Боль в спине':'']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет жалоб'; },
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <HealthBool label="Боль в суставах" active={d?.jointPain==='mild'} onClick={() => u('oda',{...d,jointPain:d?.jointPain==='mild'?'none':'mild'})} />
                      <HealthBool label="Связки (слабые)" active={!!d?.ligamentIssues} onClick={() => u('oda',{...d,ligamentIssues:!d?.ligamentIssues})} />
                      <HealthBool label="Боль в спине" active={!!d?.backPain} onClick={() => u('oda',{...d,backPain:!d?.backPain})} />
                    </div>
                  },
                  { id:'epicrisis', icon:'📋', title:'Эпикриз (история)', color:'#c084fc',
                    summary: d => { const a = [d?.pastGyno?'Гинекомастия':'',d?.pastLibidoDrop?'↓ Либидо':'',d?.pastHctSpike?'↑ HCT':'',d?.pastLiverIssues?'Печень':'',d?.pastKidneyIssues?'Почки':'']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет отмеченных'; },
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <HealthBool label="Гинекомастия" active={!!d?.pastGyno} onClick={() => u('epicrisis',{...d,pastGyno:!d?.pastGyno})} />
                      <HealthBool label="↓ Либидо" active={!!d?.pastLibidoDrop} onClick={() => u('epicrisis',{...d,pastLibidoDrop:!d?.pastLibidoDrop})} />
                      <HealthBool label="↑ HCT" active={!!d?.pastHctSpike} onClick={() => u('epicrisis',{...d,pastHctSpike:!d?.pastHctSpike})} />
                      <HealthBool label="Печень" active={!!d?.pastLiverIssues} onClick={() => u('epicrisis',{...d,pastLiverIssues:!d?.pastLiverIssues})} />
                      <HealthBool label="Почки" active={!!d?.pastKidneyIssues} onClick={() => u('epicrisis',{...d,pastKidneyIssues:!d?.pastKidneyIssues})} />
                    </div>
                  },
                  { id:'goals', icon:'🎯', title:'Цели курса', color:'#fb923c',
                    summary: d => { const a = [d?.healthMaintenance?'Здоровье':'',d?.competitionPrep?'Соревн.':'',d?.lipidCorrection?'Липиды':'',d?.bloodThinning?'Кровь':'',d?.liverDetox?'Печень':'',d?.bpControl?'АД':'']; const s = a.filter(Boolean).join(', '); return (s||'—')+(d?.cycleWeeks?` | ${d.cycleWeeks} нед`:''); },
                    fields: (d, u) => <>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        <HealthBool label="Здоровье" active={!!d?.healthMaintenance} onClick={() => u('goals',{...d,healthMaintenance:!d?.healthMaintenance})} />
                        <HealthBool label="Соревнования" active={!!d?.competitionPrep} onClick={() => u('goals',{...d,competitionPrep:!d?.competitionPrep})} />
                        <HealthBool label="Липиды" active={!!d?.lipidCorrection} onClick={() => u('goals',{...d,lipidCorrection:!d?.lipidCorrection})} />
                        <HealthBool label="Кровь" active={!!d?.bloodThinning} onClick={() => u('goals',{...d,bloodThinning:!d?.bloodThinning})} />
                        <HealthBool label="Печень" active={!!d?.liverDetox} onClick={() => u('goals',{...d,liverDetox:!d?.liverDetox})} />
                        <HealthBool label="АД" active={!!d?.bpControl} onClick={() => u('goals',{...d,bpControl:!d?.bpControl})} />
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
                        <HealthNumber label="Длина цикла (нед)" value={d?.cycleWeeks||12} onChange={v => u('goals',{...d,cycleWeeks:parseInt(v)||12})} />
                        <HealthNumber label="Предыдущих курсов" value={d?.previousCycles||0} onChange={v => u('goals',{...d,previousCycles:parseInt(v)||0})} />
                      </div>
                    </>
                  },
                  { id:'psych', icon:'🧘', title:'Психология', color:'#e879f9',
                    summary: d => `Страх: ${d?.fearOfLoss||1} | Зеркало: ${d?.mirrorObsession||1} | Апатия: ${d?.apathyOffCycle||1}`,
                    fields: (d, u) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                      <HealthNumber label="Страх потери (1-5)" value={d?.fearOfLoss||1} min={1} max={5} onChange={v => u('psych',{...d,fearOfLoss:parseInt(v)||1})} />
                      <HealthNumber label="Зеркало (1-5)" value={d?.mirrorObsession||1} min={1} max={5} onChange={v => u('psych',{...d,mirrorObsession:parseInt(v)||1})} />
                      <HealthNumber label="Апатия (1-5)" value={d?.apathyOffCycle||1} min={1} max={5} onChange={v => u('psych',{...d,apathyOffCycle:parseInt(v)||1})} />
                    </div>
                  },
                  { id:'toxicLoad', icon:'☣️', title:'Токсическая нагрузка', color:'#ef4444',
                    summary: d => [d?.hazardousWork?'Вредное производство':'',d?.regularNSAIDs?'НПВС регулярно':''].filter(Boolean).join(', ') || 'Нет',
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <HealthBool label="Вредное производство" active={!!d?.hazardousWork} onClick={() => u('toxicLoad',{...d,hazardousWork:!d?.hazardousWork})} />
                      <HealthBool label="НПВС регулярно" active={!!d?.regularNSAIDs} onClick={() => u('toxicLoad',{...d,regularNSAIDs:!d?.regularNSAIDs})} />
                    </div>
                  },
                  { id:'dental', icon:'🦷', title:'Стоматология', color:'#94a3b8',
                    summary: d => { const a = [d?.bleedingGums?'Кровоточивость':'',d?.looseTeeth?'Подв.зубов':'',d?.cramps?'Судороги':'']; return a.filter(Boolean).length ? a.filter(Boolean).join(', ') : 'Нет жалоб'; },
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <HealthBool label="Кровоточивость" active={!!d?.bleedingGums} onClick={() => u('dental',{...d,bleedingGums:!d?.bleedingGums})} />
                      <HealthBool label="Подвижность зубов" active={!!d?.looseTeeth} onClick={() => u('dental',{...d,looseTeeth:!d?.looseTeeth})} />
                      <HealthBool label="Судороги" active={!!d?.cramps} onClick={() => u('dental',{...d,cramps:!d?.cramps})} />
                    </div>
                  },
                  { id:'injection', icon:'💉', title:'Инъекции', color:'#38bdf8',
                    summary: d => { const z = ['glutes','quads','delts'].map(zn => { const v = (d||{})[zn]; return v && v!=='ok' ? (zn==='glutes'?'Ягодицы':zn==='quads'?'Бёдра':'Дельты')+': '+(v==='painful'?'больно':'уплотн.') : ''; }).filter(Boolean); return z.length ? z.join(', ') : 'Норма'; },
                    fields: (d, u) => <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {['glutes','quads','delts'].map(zone => (
                        <div key={zone} style={{ flex:1, minWidth:100 }}>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:2 }}>{zone==='glutes'?'Ягодицы':zone==='quads'?'Бёдра':'Дельты'}</div>
                          {(['ok','painful','lumps'] as const).map(opt => {
                            const cur = (d||{})[zone]||'ok';
                            return <button key={opt} onClick={() => u('injection',{...d,[zone]:opt})} style={{
                              display:'block', width:'100%', padding:'6px 8px', marginBottom:2, borderRadius:6, border:'none', cursor:'pointer', fontSize:10, fontWeight:600,
                              background: cur===opt ? '#38bdf8' : 'rgba(255,255,255,0.06)', color: cur===opt ? '#000' : 'rgba(255,255,255,0.5)',
                            }}>{opt==='ok'?'Норма':opt==='painful'?'Болезненно':'Уплотнения'}</button>;
                          })}
                        </div>
                      ))}
                    </div>
                  },
                ];

                return <>{systems.map(sys => {
                  const d = (calcData||{})[sys.id];
                  return <React.Fragment key={sys.id}>
                    <div style={{ ...glassCard, cursor:'pointer', borderColor: hp===sys.id ? sys.color : undefined }}
                      onClick={() => setHealthPopup(hp===sys.id ? null : sys.id)}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{sys.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{sys.title}</div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sys.summary(d)}</div>
                        </div>
                        <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)', transition:'transform .2s', transform:hp===sys.id?'rotate(180deg)':'rotate(0deg)' }}>▾</span>
                      </div>
                      {hp === sys.id && <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                        {sys.fields(d, upCalc)}
                      </div>}
                    </div>
                  </React.Fragment>;
                })}</>;
              })()}
            </div>
            </InfoErrorBoundary>
          )}

          {/* ═══ DIET TAB ═══ */}
          {tab === 'diet' && (
            <InfoErrorBoundary label="Питание"><div>
            {(() => {
              const dp = dietPopup;
              const s = settings;
              const cards: { id:string; icon:string; title:string; color:string; summary:(s:any)=>string; fields:(s:any)=>React.ReactNode }[] = [
                { id:'diettype', icon:'🥗', title:'Тип питания', color:'#34d399',
                  summary: s => DIET_TYPES.find(d=>d.id===(s?.dietType||''))?.label||'Не выбран',
                  fields: s => <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:4}}>
                    {DIET_TYPES.map(dt => {
                      const active = s?.dietType===dt.id;
                      return <button key={dt.id} onClick={()=>save({dietType:dt.id as any})} style={{padding:'8px 4px',borderRadius:10,cursor:'pointer',textAlign:'center',background:active?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.04)',border:active?'1px solid #34d399':'1px solid rgba(255,255,255,0.06)',color:active?'#34d399':'rgba(255,255,255,0.6)',fontSize:10,fontWeight:active?700:400}}>
                        <div style={{fontSize:16}}>{dt.icon}</div>
                        <div style={{marginTop:1}}>{dt.label}</div>
                      </button>;
                    })}
                  </div>
                },
                { id:'allergies', icon:'⚠️', title:'Пищевые аллергии', color:'#ef4444',
                  summary: s => {const a=s?.foodAllergies??[]; return a.length?a.map((id:string)=>ALLERGEN_OPTIONS.find(o=>o.id===id)?.label||id).join(', '):'Нет';},
                  fields: s => <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {ALLERGEN_OPTIONS.map(a => {const active=(s?.foodAllergies??[]).includes(a.id); return <HealthBool key={a.id} label={a.label} active={active} onClick={()=>{const cur=s?.foodAllergies??[];save({foodAllergies:active?cur.filter((x:string)=>x!==a.id):[...cur,a.id]});}} />})}
                  </div>
                },
                { id:'intolerances', icon:'🤢', title:'Непереносимости', color:'#f97316',
                  summary: s => {const a=s?.foodIntolerances??[]; return a.length?a.map((id:string)=>INTOLERANCE_OPTIONS.find(o=>o.id===id)?.label||id).join(', '):'Нет';},
                  fields: s => <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {INTOLERANCE_OPTIONS.map(it => {const active=(s?.foodIntolerances??[]).includes(it.id); return <HealthBool key={it.id} label={it.label} active={active} onClick={()=>{const cur=s?.foodIntolerances??[];save({foodIntolerances:active?cur.filter((x:string)=>x!==it.id):[...cur,it.id]});}} />})}
                  </div>
                },
                { id:'cooking', icon:'👨‍🍳', title:'Навыки готовки', color:'#fbbf24',
                  summary: s => COOKING_SKILLS.find(cs=>cs.id===(s?.cookingSkill||''))?.label||'Не указан',
                  fields: s => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                    {COOKING_SKILLS.map(cs => <HealthBool key={cs.id} label={cs.label} active={s?.cookingSkill===cs.id} onClick={()=>save({cookingSkill:cs.id as any})} />)}
                  </div>
                },
                { id:'meals', icon:'🍽️', title:'Приёмов пищи в день', color:'#60a5fa',
                  summary: s => `${s?.mealsPerDay??4} раз/день`,
                  fields: s => <div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type="range" min={2} max={7} value={s?.mealsPerDay??4} onChange={e=>save({mealsPerDay:parseFloat(e.target.value)||0})} style={{flex:1,accentColor:'#00e68a'}} />
                      <span style={{fontSize:18,fontWeight:700,minWidth:24,textAlign:'center',color:'#00e68a'}}>{s?.mealsPerDay??4}</span>
                    </div>
                  </div>
                },
              ];
              const totalRestr = (s?.foodAllergies??[]).length+(s?.foodIntolerances??[]).length;
              return <>{cards.map(c => {
                const open = dp === c.id;
                return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setDietPopup(open?null:c.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary(s)}</div>
                    </div>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                  </div>
                  {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields(s)}</div>}
                </div>;
              })}</>;
            })()}
              {(settings.foodAllergies ?? []).length + (settings.foodIntolerances ?? []).length > 0 || settings.dietType ? (
                <div style={{ ...glassCard, borderColor: 'rgba(0,230,138,0.2)' }}>
                  <div style={{ fontSize:11, color: '#00e68a', fontWeight:600, marginBottom:6 }}>Активные ограничения</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {settings.dietType && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>
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
              ) : null}
            </div></InfoErrorBoundary>
          )}

          {/* ═══ NUTRITION V7 TAB ═══ */}

          {/* ═══ GENETICS TAB ═══ */}
          {tab === 'genetics' && (
            <InfoErrorBoundary label="Генетика">
            {(() => {
              const gp = geneticsPopup;
              const genes = [
                { key:'COMT', label:'COMT', options:['Met/Met','Val/Met','Val/Val'] },
                { key:'MTHFR', label:'MTHFR', options:['C677T/C677T','C677T/A1298C','A1298C/A1298C','C677T/+','A1298C/+','+/+' ] },
                { key:'ESR1', label:'ESR1', options:['PvuII TT','PvuII TC','PvuII CC'] },
                { key:'AGTR1', label:'AGTR1', options:['1166CC','1166AC','1166AA'] },
                { key:'NOS3', label:'NOS3', options:['Glu298Glu','Glu298Asp','Asp298Asp'] },
                { key:'SRD5A2', label:'SRD5A2', desc:'5α-редуктаза', options:['V89L V/V','V89L V/L','V89L L/L'] },
                { key:'CYP3A4', label:'CYP3A4', options:['*1/*1 (WT)','*1/*22','*22/*22'] },
              ];
              const s = settings;
              const cards = genes.map(gene => ({
                id: gene.key, icon:'🧬', title: gene.label, color:'#c084fc',
                desc: (gene as any).desc,
                summary: (s:any) => (s?.genetics??{})[gene.key] || 'Не знаю',
                fields: (s:any) => <>
                  {(gene as any).desc && <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:4}}>{(gene as any).desc}</div>}
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    <HealthBool label="Не знаю" active={!(s?.genetics??{})[gene.key]} onClick={() => { const g={...(s?.genetics??{})}; delete g[gene.key]; save({genetics:g}); }} />
                    {gene.options.map(opt => <HealthBool key={opt} label={opt} active={(s?.genetics??{})[gene.key]===opt} onClick={() => { const g={...(s?.genetics??{})}; g[gene.key]=opt; save({genetics:g}); }} />)}
                  </div>
                </>
              }));
              return <>{cards.map(c => {
                const open = gp === c.id;
                return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setGeneticsPopup(open?null:c.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary(s)}{c.desc?' • '+c.desc:''}</div>
                    </div>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                  </div>
                  {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields(s)}</div>}
                </div>;
              })}</>;
            })()}
            </InfoErrorBoundary>
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
            {(() => {
              const pp = progressPopup;
              const weightCard = {
                id:'weight', icon:'⚖️', title:'Вес и цель', color:'#00e68a',
                summary: () => `${settings.weight || '—'} кг → цель ${settings.targetWeight || '—'} кг`,
                fields: () => <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <HealthNumber label="Текущий вес (кг)" value={String(settings.weight||'')} onChange={v => save({weight:parseFloat(v)||0})} />
                    <HealthNumber label="Целевой вес (кг)" value={String(settings.targetWeight||'')} onChange={v => save({targetWeight:v?parseFloat(v):undefined})} />
                  </div>
                  {settings.targetWeight && settings.weight ? <div style={{marginBottom:8}}>
                    <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden',marginBottom:4}}>
                      <div style={{height:'100%',borderRadius:2,background:apple.gradientGreen,width:`${Math.min(100,Math.max(0,Math.round((1-Math.abs(settings.weight-settings.targetWeight)/Math.max(1,Math.abs(settings.targetWeight)))*100)))}%`,transition:'width .5s'}} />
                    </div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',textAlign:'center'}}>{Math.round((1-Math.abs(settings.weight-settings.targetWeight)/Math.max(1,Math.abs(settings.targetWeight)))*100)}% к цели</div>
                  </div> : null}
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4}}>➕ Новая запись веса</div>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...appleInput,flex:1}} type="date" id="progressWeightDate" defaultValue={new Date().toISOString().split('T')[0]} />
                    <input style={{...appleInput,width:80}} type="number" step="0.1" id="progressWeightVal" placeholder="кг" />
                    <button onClick={()=>{
                      const d=(document.getElementById('progressWeightDate') as HTMLInputElement)?.value;
                      const w=parseFloat((document.getElementById('progressWeightVal') as HTMLInputElement)?.value||'0');
                      if(d&&w){const log=weightLog;log.push({date:d,weight:w});localStorage.setItem(WEIGHT_LOG_KEY,JSON.stringify(log.slice(-180)));setWeightLog([...log]);alert('✓ Записано')}
                    }} style={{padding:'6px 12px',borderRadius:8,background:apple.gradientGreen,border:'none',color:'#000',fontWeight:700,cursor:'pointer',fontSize:11}}>➕</button>
                  </div>
                </>
              };
              const compCard = {
                id:'composition', icon:'💪', title:'Композиция тела', color:'#8b5cf6',
                summary: () => {
                  const bf = settings.bodyFat ? `${settings.bodyFat}%` : '—';
                  const tbf = settings.targetBodyFat ? `→ ${settings.targetBodyFat}%` : '—';
                  return `${bf} жир ${tbf}${ffmi ? ` • FFMI ${ffmi}` : ''}`;
                },
                fields: () => <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <HealthNumber label="% жира" value={String(settings.bodyFat||'')} onChange={v => save({bodyFat:parseFloat(v)||0})} />
                    <HealthNumber label="Целевой % жира" value={String(settings.targetBodyFat||'')} onChange={v => save({targetBodyFat:v?parseFloat(v):undefined})} />
                  </div>
                  {ffmi ? <div style={{background:'rgba(139,92,246,0.1)',borderRadius:8,padding:8}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:2}}>FFMI {ffmi} — {ffmiCategory}</div>
                    <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden',position:'relative'}}>
                      {[{pos:0},{pos:25},{pos:50},{pos:75},{pos:95}].map(s=><div key={s.pos} style={{position:'absolute',left:`${s.pos}%`,top:0,width:2,height:3,borderRadius:1,background:s.pos<50?'#f97316':s.pos<75?'#f59e0b':'#00e68a'}} />)}
                      {parseFloat(ffmi||'0')>0 && <div style={{position:'absolute',left:`${Math.min(98,Math.max(2,((parseFloat(ffmi)-15)/15)*100))}%`,top:-2,width:8,height:8,borderRadius:'50%',background:apple.gradientGreen,border:'2px solid rgba(0,0,0,0.3)'}} />}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'rgba(255,255,255,0.3)',marginTop:1}}><span>15</span><span>18</span><span>20</span><span>22</span><span>25</span><span>30</span></div>
                  </div> : null}
                  {lbm ? <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:4}}>LBM: {lbm} кг</div> : null}
                </>
              };
              const measCard = {
                id:'measurements', icon:'📏', title:'Обхваты', color:'#3b82f6',
                summary: () => {
                  const parts:string[]=[];
                  if(settings.waistCm)parts.push(`Тал:${settings.waistCm}`);
                  if(settings.chestCm)parts.push(`Гр:${settings.chestCm}`);
                  if(settings.bicepCm)parts.push(`Биц:${settings.bicepCm}`);
                  if(settings.thighCm)parts.push(`Бед:${settings.thighCm}`);
                  return parts.length?parts.join(' | '):'нет данных';
                },
                fields: () => <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
                    {[
                      {k:'waistCm',l:'Талия'},{k:'chestCm',l:'Грудь'},{k:'bicepCm',l:'Бицепс'},
                      {k:'thighCm',l:'Бедро'},{k:'hipCm',l:'Бёдра'},{k:'neckCm',l:'Шея'},
                    ].map(m => <HealthNumber key={m.k} label={m.l} value={String((settings as any)[m.k]||'')} onChange={v => save({[m.k]:parseFloat(v)||0})} />)}
                  </div>
                  <button onClick={()=>{
                    const entry:MeasurementEntry={date:new Date().toISOString().split('T')[0],waistCm:settings.waistCm||0,chestCm:settings.chestCm||0,hipCm:settings.hipCm||0,bicepCm:settings.bicepCm||0,thighCm:settings.thighCm||0,neckCm:settings.neckCm||0,forearmCm:settings.forearmCm||0,bodyFat:settings.bodyFat||0};
                    const log=getMeasurementsLog();log.push(entry);localStorage.setItem(MEASUREMENTS_LOG_KEY,JSON.stringify(log.slice(-30)));alert('✓ Замеры сохранены');
                  }} style={{...pillBtn(false),width:'100%',fontSize:11}}>💾 Сохранить замеры в историю</button>
                </>
              };
              const cards = [weightCard, compCard, measCard];
              return <>{cards.map(c => {
                const open = pp === c.id;
                return <div key={c.id} style={{...glassCard,cursor:'pointer',borderColor:open?c.color:undefined}} onClick={() => setProgressPopup(open?null:c.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{c.title}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.summary()}</div>
                    </div>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.3)',transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
                  </div>
                  {open && <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>{c.fields()}</div>}
                </div>;
              })}</>;
            })()}

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

            {/* Lab indices + Weak organs + Genetic polymorphisms */}
            {labIndices && labIndexText && (
              <div style={glassCard}>
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

            <div style={glassCard}>
              <div style={sectionLabel}>Слабые органы</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                {ORGAN_WEAKNESSES.map(o => {
                  const ci = getContraindications();
                  const active = (ci.organWeaknesses ?? []).includes(o.id);
                  return <button key={o.id} onClick={() => { const cur = ci.organWeaknesses ?? []; const upd = active ? cur.filter((x:string) => x !== o.id) : [...cur, o.id]; saveContraindications({ organWeaknesses: upd }); }} style={pillBtn(active)}>{o.label}</button>;
                })}
              </div>
            </div>

            <div style={glassCard}>
              <div style={sectionLabel}>Генетические полиморфизмы</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                {GENETIC_POLYMORPHISMS.map(g => {
                  const ci = getContraindications();
                  const active = (ci.geneticPolymorphisms ?? []).includes(g.id);
                  return <button key={g.id} onClick={() => { const cur = ci.geneticPolymorphisms ?? []; const upd = active ? cur.filter((x:string) => x !== g.id) : [...cur, g.id]; saveContraindications({ geneticPolymorphisms: upd }); }} style={pillBtn(active)}>{g.label}</button>;
                })}
              </div>
            </div>
          </InfoErrorBoundary>
          )}
          </>
          )}

          {/* ═══ ANALYTICS TAB (mainTab === 'analytics') ═══ */}
          {mainTab === 'analytics' && <>
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
              ? last3Workouts.map(w => `  • ${w.date} | Сплит: ${w.split} | RPE: ${w.overallRPE} | Упр: ${(w.exercises??[]).length} | Объём: ${(w.exercises??[]).reduce((s, e) => s + (e.totalVolume??0), 0).toFixed(0)} кг`).join('\n')
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
              `  Объём за неделю: ${(() => { const last7 = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]; const wkLogs = workoutLogs.filter(w => w.date >= last7); const wkVol = wkLogs.reduce((s, w) => s + (w.exercises??[]).reduce((ss, e) => ss + (e.totalVolume??0), 0), 0); return wkVol > 0 ? `${wkVol.toFixed(0)} кг` : 'нет данных'; })()}`,
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
                      {weightLog.length > 0 && <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Записей: {weightLog.length} | Мин: {Math.min(...weightLog.map(w=>w.weight??0)).toFixed(1)} | Тек: {weightLog[weightLog.length-1]?.weight?.toFixed(1) ?? '—'} | Макс: {Math.max(...weightLog.map(w=>w.weight??0)).toFixed(1)}</div>}
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
                                const bpd = getBPDiary(); const lastBp = bpd[0];
                                sections.push(`❤️ Давление:\n  ${lastBp ? `${lastBp.systolic}/${lastBp.diastolic} · Пульс: ${lastBp.hr} · ${lastBp.date}` : 'нет записей'} (всего: ${bpd.length} зап.)`);
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
          
          {/* ═══ DIARIES HUB TAB ═══ */}
          {tab === 'diaries' && (
            <InfoErrorBoundary label="Дневники">
              <div>
                <div style={glassCard}>
                  <div style={sectionLabel}>📓 Дневники</div>
                  <p style={{ fontSize:10, color: apple.textDim, margin:'4px 0 10px' }}>
                    Все дневники приложения в одном месте. Выберите тип дневника ниже, чтобы добавить или просмотреть записи.
                  </p>
                </div>

                {/* External diaries (переход на другие экраны) */}
                <div style={glassCard}>
                  <div style={{ fontSize:10, fontWeight:700, color: apple.textDim, marginBottom:8 }}>
                    🧭 Перейти к дневнику
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button onClick={() => onNavigate?.('nutrition')} style={{ ...diaryCardBase, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)' }}>
                      <div style={diaryIconWrap}>🍽️</div>
                      <div style={diaryCardTitle}>Питание</div>
                    </button>
                    <button onClick={() => onNavigate?.('training')} style={{ ...diaryCardBase, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.15)' }}>
                      <div style={diaryIconWrap}>🏋️</div>
                      <div style={diaryCardTitle}>Тренировки</div>
                    </button>
                    {(settings.phase === 'course' || settings.phase === 'course-bridge-course') && (
                      <button onClick={() => onNavigate?.('pharma')} style={{ ...diaryCardBase, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
                        <div style={diaryIconWrap}>💉</div>
                        <div style={diaryCardTitle}>Фарма</div>
                      </button>
                    )}
                    {(localStorage.getItem('he_autocalc_state') || localStorage.getItem('he_support_substances')) && (
                      <button onClick={() => onNavigate?.('support')} style={{ ...diaryCardBase, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)' }}>
                        <div style={diaryIconWrap}>🧪</div>
                        <div style={diaryCardTitle}>Поддержка</div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Internal diary sub-tabs */}
                <div style={{ display:'flex', gap:3, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
                  {[
                    { id:'sleep', label:'🛌 Сон' },
                    { id:'measurements', label:'📏 Замеры' },
                    { id:'progress', label:'📈 Прогресс' },
                  ].map(d => (
                    <button key={d.id} onClick={() => setDiarySubTab(d.id as any)} style={{
                      padding:'6px 14px', borderRadius:18, fontSize:10, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                      background: diarySubTab === d.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                      border: diarySubTab === d.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      color: diarySubTab === d.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
                    }}>{d.label}</button>
                  ))}
                </div>

                {/* ═══ SLEEP DIARY ═══ */}
                {diarySubTab === 'sleep' && <SleepDiary settings={settings} save={save} />}

                {/* ═══ MEASUREMENTS DIARY ═══ */}
                {diarySubTab === 'measurements' && <ProfileMeasurementsTab />}

                {/* ═══ PROGRESS DIARY ═══ */}
                {diarySubTab === 'progress' && (
                  <div>
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
                    {(() => {
                      const lbmVal = settings.weight && settings.bodyFat ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : null;
                      const ffmiVal = lbmVal && settings.height ? (parseFloat(lbmVal) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : null;
                      const ffmiCategory = ffmiVal ? (parseFloat(ffmiVal) < 18 ? 'Ниже среднего' : parseFloat(ffmiVal) < 20 ? 'Средний' : parseFloat(ffmiVal) < 22 ? 'Хорошо' : parseFloat(ffmiVal) < 25 ? 'Отлично' : parseFloat(ffmiVal) < 28 ? 'Исключительно' : 'Подозрение') : '';
                      if (!ffmiVal) return null;
                      return (
                        <div style={glassCard}>
                          <div style={sectionLabel}>FFMI анализ</div>
                          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>Текущий FFMI</div>
                              <div style={{ fontSize:22, fontWeight:800, color: '#8b5cf6' }}>{ffmiVal}</div>
                              <div style={{ fontSize:10, color: apple.textSecondary, marginTop:2 }}>{ffmiCategory}</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:10, color: apple.textDim, marginBottom:2 }}>LBM</div>
                              <div style={{ fontSize:22, fontWeight:800, color: '#3b82f6' }}>{lbmVal || '—'}<span style={{ fontSize:11, fontWeight:400 }}> кг</span></div>
                              <div style={{ fontSize:10, color: apple.textSecondary, marginTop:2 }}>Сухая масса</div>
                            </div>
                          </div>
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
                              {ffmiVal && parseFloat(ffmiVal) > 0 && (
                                <div style={{
                                  position:'absolute',
                                  left:`${Math.min(98, Math.max(2, ((parseFloat(ffmiVal) - 15) / 15) * 100))}%`,
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
                      );
                    })()}
                  </div>
                )}
              </div>
            </InfoErrorBoundary>
          )}

          {/* ═══ BP DIARY TAB ═══ */}
          {tab === 'bp_diary' && (
            <InfoErrorBoundary label="Давление">
              <BPDiaryTab />
            </InfoErrorBoundary>
          )}

          </>}

          {/* ═══ CONTACTS TAB (mainTab === 'contacts') ═══ */}
          {mainTab === 'contacts' && <>
          {tab === 'contacts' && (
            <InfoErrorBoundary label="Контакты"><div>
              <div style={glassCard}>
                <div style={sectionLabel}>Контакты и друзья</div>
                <p style={{ fontSize:10, color: apple.textDim, margin:'4px 0 10px' }}>
                  Управление списком друзей, обмен отчётами и доступ к тренировкам.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  <button onClick={() => setShowFriendForm(true)} style={{
                    padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#fff', fontWeight:700, fontSize:12,
                    background: apple.gradientBlue,
                  }}>➕ Добавить друга</button>
                  <button onClick={doShareReport} style={{
                    padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#000', fontWeight:700, fontSize:12,
                    background: apple.gradientOrange,
                  }}>📤 Поделиться отчётом</button>
                </div>
                <button onClick={() => setShowTrainingForm(true)} style={{
                  width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10,
                  background: apple.gradientPurple, border:'none', color:'#fff', fontWeight:700, fontSize:12,
                }}>🏋️ Открыть тренировку другу</button>
                <button onClick={() => {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg?.openTelegramLink) tg.openTelegramLink('https://t.me/BodyBuildHealthBot');
                  else if (tg?.openLink) tg.openLink('https://t.me/BodyBuildHealthBot');
                  else window.open('https://t.me/BodyBuildHealthBot', '_blank');
                  showNotif('🔗 Открываю Telegram...');
                }} style={{
                  width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10,
                  background: apple.gradientGreen, border:'none', color:'#000', fontWeight:700, fontSize:12,
                }}>💬 Связаться с поддержкой</button>
              </div>

              {/* ═══ Add Friend Form (inline modal) ═══ */}
              {showFriendForm && (
                <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }} onClick={() => setShowFriendForm(false)}>
                  <div style={{ background:'#18181b', borderRadius:16, padding:20, maxWidth:340, width:'100%', border:'1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#fff' }}>➕ Добавить друга</h3>
                    <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>
                      Добавьте друга в локальный список. После сохранения через Telegram откроется выбор чата — отправьте другу приглашение.
                    </p>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Имя *</div>
                      <input type="text" value={friendName} onChange={e => setFriendName(e.target.value)} placeholder="Алексей" style={appleInput} />
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Username Telegram (без @)</div>
                      <div style={{ position:'relative' }}>
                        <input type="text" value={friendUsername} onChange={e => onFriendUsernameChange(e.target.value)} placeholder="alex_fit" style={appleInput} />
                        {friendVerifyStatus === 'checking' && <span style={{ position:'absolute', right:10, top:10, fontSize:10, color:'#f59e0b' }}>⏳</span>}
                      </div>
                      {friendVerifyStatus === 'found' && (
                        <div style={{ fontSize:8, color:'#22c55e', marginTop:3 }}>✅ Найден: {friendVerifiedName}</div>
                      )}
                      {friendVerifyStatus === 'not_found' && (
                        <div style={{ fontSize:8, color:'#ef4444', marginTop:3 }}>❌ Пользователь не найден. Проверьте username и убедитесь, что бот был добавлен в контакты.</div>
                      )}
                      {friendVerifyStatus === 'idle' && (
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:3 }}>Введите 3+ символа — username проверится через Telegram автоматически.</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                      <button onClick={doAddFriend} style={{
                        flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                        background: friendName.trim() ? apple.gradientGreen : 'rgba(255,255,255,0.06)',
                        color: friendName.trim() ? '#000' : 'rgba(255,255,255,0.4)',
                        fontWeight:700, fontSize:12,
                      }}>💾 Сохранить</button>
                      <button onClick={doInviteFriend} style={{
                        padding:'10px 12px', borderRadius:10, cursor:'pointer',
                        background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', color:'#60a5fa', fontWeight:600, fontSize:12, whiteSpace:'nowrap',
                      }}>🔗 Пригласить</button>
                      <button onClick={() => setShowFriendForm(false)} style={{
                        padding:'10px 16px', borderRadius:10, cursor:'pointer',
                        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)', fontWeight:600, fontSize:12,
                      }}>Отмена</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ Share Training Form (inline modal) ═══ */}
              {showTrainingForm && (
                <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }} onClick={() => setShowTrainingForm(false)}>
                  <div style={{ background:'#18181b', borderRadius:16, padding:20, maxWidth:340, width:'100%', border:'1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#fff' }}>🏋️ Открыть тренировку другу</h3>
                    <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>
                      Создайте ссылку-приглашение, чтобы друг мог просмотреть вашу текущую программу тренировок.
                    </p>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:9, color: apple.textDim, marginBottom:3 }}>Username друга (без @)</div>
                      <input type="text" value={trainingUsername} onChange={e => setTrainingUsername(e.target.value)} placeholder="alex_fit" style={appleInput} />
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:3 }}>Бот создаст ссылку и откроет Telegram для отправки другу. Username не проверяется — убедитесь, что он правильный.</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={doShareTraining} style={{
                        flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                        background: trainingUsername.trim() ? apple.gradientPurple : 'rgba(255,255,255,0.06)',
                        color: trainingUsername.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontWeight:700, fontSize:12,
                      }}>🔗 Открыть доступ</button>
                      <button onClick={() => setShowTrainingForm(false)} style={{
                        padding:'10px 16px', borderRadius:10, cursor:'pointer',
                        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)', fontWeight:600, fontSize:12,
                      }}>Отмена</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Friends list */}
              <div style={glassCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={sectionLabel}>👥 Друзья ({friends.length})</div>
                </div>
                {friends.length > 0 ? (
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
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:'14px 0', color: apple.textDim, fontSize:10 }}>
                    Нет добавленных друзей. Нажмите «➕ Добавить друга» чтобы начать.
                  </div>
                )}
              </div>

              {/* Toast notification */}
              {notification && (
                <div style={{
                  position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)', zIndex:2000,
                  padding:'10px 20px', borderRadius:12,
                  background: notification.type === 'success' ? 'rgba(0,230,138,0.15)' : 'rgba(239,68,68,0.15)',
                  border: notification.type === 'success' ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(239,68,68,0.3)',
                  color: notification.type === 'success' ? '#00e68a' : '#ef4444',
                  fontSize:12, fontWeight:600, textAlign:'center',
                  backdropFilter:'blur(12px)',
                  boxShadow:'0 4px 24px rgba(0,0,0,0.4)',
                }}>
                  {notification.text}
                </div>
              )}
            </div></InfoErrorBoundary>
          )}
          </>}

          {/* ═══ REMOVED TABS (calculator_data, nutrition_planner, biostack_profile, nutrition_v7) — hidden, code kept for reference ═══ */}

          {/* ═══ NUTRITION PLANNER DATA TAB ═══ */}

          {/* ═══ BIOSTACK PROFILE TAB ═══ */}
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

const ProfileCalcData: React.FC = () => {
  const glassCard: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 6 };

  // Popup button-cards
  const PopToggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => {
    const [open, setOpen] = React.useState(false);
    return <><button onClick={()=>setOpen(true)} style={{width:'100%',padding:'8px 10px',borderRadius:8,cursor:'pointer',fontSize:10,textAlign:'center',fontWeight:700,background:value?'linear-gradient(135deg,#00e68a,#00c853)':'rgba(255,255,255,0.04)',border:value?'2px solid var(--accent)':'1px solid rgba(255,255,255,0.06)',color:value?'#000':'var(--text-dim)'}}>{label}</button>
    {open && <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)'}} onClick={()=>setOpen(false)}>
      <div onClick={e=>e.stopPropagation()} style={{width:'80%',maxWidth:300,borderRadius:16,background:'#18181b',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}>
        <div style={{height:3,background:'linear-gradient(90deg,#00e68a,#00c853)'}}/>
        <div style={{padding:'14px 16px'}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:10}}>{label}</div>
          <button onClick={()=>{onChange(true);setOpen(false)}} style={{width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:700,textAlign:'left',background:value?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',border:value?'1px solid rgba(0,230,138,0.3)':'1px solid rgba(255,255,255,0.06)',color:value?'#00e68a':'rgba(255,255,255,0.8)'}}>✓ Да</button>
          <button onClick={()=>{onChange(false);setOpen(false)}} style={{width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:700,textAlign:'left',marginTop:4,background:!value?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.03)',border:!value?'1px solid rgba(239,68,68,0.3)':'1px solid rgba(255,255,255,0.06)',color:!value?'#ef4444':'rgba(255,255,255,0.8)'}}>✗ Нет</button>
        </div>
      </div>
    </div>}</>;
  };

  const PopSelect: React.FC<{ label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
    const [open, setOpen] = React.useState(false);
    const sel = options.find(o=>o.id===value);
    return <><button onClick={()=>setOpen(true)} style={{width:'100%',padding:'8px 10px',borderRadius:8,cursor:'pointer',fontSize:10,textAlign:'left',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',color:value?'var(--text)':'var(--text-dim)'}}>{sel?sel.label:`▸ ${label}`}</button>
    {open && <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)'}} onClick={()=>setOpen(false)}>
      <div onClick={e=>e.stopPropagation()} style={{width:'88%',maxWidth:360,maxHeight:'70vh',borderRadius:16,background:'#18181b',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}>
        <div style={{height:3,background:'linear-gradient(90deg,#00e68a,#00c853)'}}/>
        <div style={{padding:'14px 16px',maxHeight:'calc(70vh - 3px)',overflowY:'auto'}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:10}}>{label}</div>
          {options.map(o=>(<button key={o.id} onClick={()=>{onChange(o.id);setOpen(false)}} style={{width:'100%',padding:'10px 14px',marginBottom:3,borderRadius:10,cursor:'pointer',fontSize:11,fontWeight:value===o.id?700:400,textAlign:'left',background:value===o.id?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.03)',border:value===o.id?'1px solid rgba(0,230,138,0.3)':'1px solid rgba(255,255,255,0.06)',color:value===o.id?'#00e68a':'rgba(255,255,255,0.8)'}}>{o.label}{value===o.id?' ✓':''}</button>))}
        </div>
      </div>
    </div>}</>;
  };

  const PopNum: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step, suffix, onChange }) => {
    const [open, setOpen] = React.useState(false);
    const [edit, setEdit] = React.useState(String(value||0));
    return <><button onClick={()=>{setEdit(String(value||0));setOpen(true)}} style={{width:'100%',padding:'8px 10px',borderRadius:8,cursor:'pointer',fontSize:10,textAlign:'center',fontWeight:value?700:400,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',color:value?'var(--accent)':'var(--text-dim)'}}>{label}: {value||'-'}{suffix?` ${suffix}`:''}</button>
    {open && <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)'}} onClick={()=>setOpen(false)}>
      <div onClick={e=>e.stopPropagation()} style={{width:'80%',maxWidth:300,borderRadius:16,background:'#18181b',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}>
        <div style={{height:3,background:'linear-gradient(90deg,#00e68a,#00c853)'}}/>
        <div style={{padding:'14px 16px'}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:10}}>{label}</div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="number" value={edit} onChange={e=>setEdit(e.target.value)} style={{flex:1,padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:18,fontWeight:700,textAlign:'center',boxSizing:'border-box'}} />
            <button onClick={()=>{const v=parseFloat(edit);if(!isNaN(v))onChange(v);setOpen(false)}} style={{padding:'10px 18px',borderRadius:8,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#00e68a,#00c853)',color:'#000',fontWeight:700,fontSize:13}}>OK</button>
          </div>
        </div>
      </div>
    </div>}</>;
  };

  const SevSelect: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
    const opts = [{id:'none',label:'Нет'},{id:'mild',label:'Лёгкая'},{id:'moderate',label:'Средняя'},{id:'severe',label:'Тяжёлая'}];
    return <PopSelect label={label} value={value||'none'} options={opts} onChange={onChange} />;
  };

  const NumPillsCard: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
    const [open, setOpen] = React.useState(false);
    return <><button onClick={()=>setOpen(true)} style={{width:'100%',padding:'8px 10px',borderRadius:8,cursor:'pointer',fontSize:10,textAlign:'center',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',color:value?'var(--accent)':'var(--text-dim)'}}>{label}: {value||1}/5</button>
    {open && <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)'}} onClick={()=>setOpen(false)}>
      <div onClick={e=>e.stopPropagation()} style={{width:'80%',maxWidth:300,borderRadius:16,background:'#18181b',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}>
        <div style={{height:3,background:'linear-gradient(90deg,#00e68a,#00c853)'}}/>
        <div style={{padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:12}}>{label}</div>
          <div style={{display:'flex',gap:6,justifyContent:'center'}}>
            {[1,2,3,4,5].map(n=><button key={n} onClick={()=>{onChange(n);setOpen(false)}} style={{width:40,height:40,borderRadius:'50%',cursor:'pointer',fontSize:14,fontWeight:700,border:'none',background:value===n?'#00e68a':'rgba(255,255,255,0.06)',color:value===n?'#000':'rgba(255,255,255,0.4)'}}>{n}</button>)}
          </div>
        </div>
      </div>
    </div>}</>;
  };

  const Card: React.FC<{ title: string; color: string; defaultOpen?: boolean; cols?: number } & React.PropsWithChildren> = ({ title, color, defaultOpen, cols, children }) => {
    const [open, setOpen] = React.useState(defaultOpen !== false);
    return <div style={glassCard}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:open?8:0}}>
        <span style={{fontSize:11,fontWeight:700,color}}>{title}</span>
        <span style={{fontSize:9,color:'var(--text-dim)',marginLeft:'auto',transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}>▼</span>
      </div>
      {open && <div style={{display:'grid',gridTemplateColumns:cols?`repeat(${cols},1fr)`:'1fr',gap:4}}>{children}</div>}
    </div>;
  };

  const [calcData, setCalcData] = React.useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('he_autocalc_state') || '{}'); } catch { return {}; }
  });
  const save = (partial: any) => {
    const next = { ...calcData, ...partial };
    setCalcData(next);
    try { localStorage.setItem('he_autocalc_state', JSON.stringify(next)); } catch {}
  };

  const up = (path: string, val: any) => {
    const next = { ...calcData };
    const keys = path.split('.');
    let obj = next;
    for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = obj[keys[i]] || {}; obj = obj[keys[i]]; }
    obj[keys[keys.length - 1]] = val;
    save(next);
  };

  return <div style={{ display:'flex', flexDirection:'column', gap:4, paddingBottom: 70 }}>
    <Card title="👤 Профиль" color="#00e68a" defaultOpen cols={2}>
      <PopNum label="Вес" value={calcData.profile?.weight||80} min={30} max={250} suffix="кг" onChange={v=>up('profile.weight',v)} />
      <PopNum label="Возраст" value={calcData.profile?.age||30} min={14} max={90} suffix="лет" onChange={v=>up('profile.age',v)} />
      <PopNum label="Рост" value={calcData.profile?.height||175} min={140} max={220} suffix="см" onChange={v=>up('profile.height',v)} />
      <PopNum label="Жир" value={calcData.profile?.bodyfat||15} min={4} max={50} suffix="%" onChange={v=>up('profile.bodyfat',v)} />
      <PopNum label="Тренировок/нед" value={calcData.profile?.workoutsPerWeek||3} min={0} max={14} suffix="раз" onChange={v=>up('profile.workoutsPerWeek',v)} />
      <PopNum label="Длит. трен." value={calcData.profile?.avgWorkoutMinutes||60} min={15} max={180} suffix="мин" onChange={v=>up('profile.avgWorkoutMinutes',v)} />
      <PopNum label="Сон" value={calcData.profile?.sleepHours||7} min={3} max={12} suffix="ч" onChange={v=>up('profile.sleepHours',v)} />
      <PopNum label="Кофеин" value={calcData.profile?.caffeineMg||200} min={0} max={2000} step={50} suffix="мг" onChange={v=>up('profile.caffeineMg',v)} />
      <PopSelect label="Пол" value={calcData.profile?.sex||'male'} options={[{id:'male',label:'Мужской'},{id:'female',label:'Женский'}]} onChange={v=>up('profile.sex',v)} />
      <PopSelect label="Алкоголь" value={calcData.profile?.alcohol||'rare'} options={[{id:'never',label:'Никогда'},{id:'rare',label:'Редко'},{id:'sometimes',label:'Иногда'},{id:'regular',label:'Регулярно'}]} onChange={v=>up('profile.alcohol',v)} />
      <PopToggle label="Курение" value={!!calcData.profile?.smoker} onChange={v=>up('profile.smoker',v)} />
      <NumPillsCard label="Стресс" value={calcData.profile?.stressLevel||4} onChange={v=>up('profile.stressLevel',v)} />
    </Card>

    <Card title="🧠 Неврологический статус" color="#a855f7" cols={2}>
      <NumPillsCard label="Дофамин" value={calcData.neuro?.dopamineScore||1} onChange={v=>up('neuro.dopamineScore',v)} />
      <NumPillsCard label="Серотонин" value={calcData.neuro?.serotoninScore||1} onChange={v=>up('neuro.serotoninScore',v)} />
      <NumPillsCard label="Агрессия" value={calcData.neuro?.aggressionScore||1} onChange={v=>up('neuro.aggressionScore',v)} />
      <PopSelect label="ГАМК баланс" value={calcData.neuro?.gabaBalance||'balance'} options={[{id:'balance',label:'Норма'},{id:'overexcited',label:'Возбуждение'},{id:'inhibited',label:'Заторможенность'}]} onChange={v=>up('neuro.gabaBalance',v)} />
      <PopSelect label="Качество сна" value={calcData.neuro?.sleepQuality||'good'} options={[{id:'good',label:'Хорошее'},{id:'fair',label:'Среднее'},{id:'poor',label:'Плохое'}]} onChange={v=>up('neuro.sleepQuality',v)} />
      <PopToggle label="Проблемы с памятью" value={!!calcData.neuro?.memoryIssues} onChange={v=>up('neuro.memoryIssues',v)} />
      <PopToggle label="Проблемы с фокусом" value={!!calcData.neuro?.focusIssues} onChange={v=>up('neuro.focusIssues',v)} />
      <PopToggle label="Замедл. мышление" value={!!calcData.neuro?.slowThinking} onChange={v=>up('neuro.slowThinking',v)} />
      <PopToggle label="Координация" value={!!calcData.neuro?.coordinationIssues} onChange={v=>up('neuro.coordinationIssues',v)} />
      <PopToggle label="Головные боли" value={!!calcData.neuro?.headaches} onChange={v=>up('neuro.headaches',v)} />
      <PopToggle label="Метеозависимость" value={!!calcData.neuro?.weatherDependent} onChange={v=>up('neuro.weatherDependent',v)} />
    </Card>

    <Card title="💉 Фарма стек" color="#f59e0b" cols={2}>
      <PopSelect label="Фаза курса" value={calcData.pharma?.phase||'course'} options={[{id:'course',label:'Курс'},{id:'bridge',label:'Бридж'},{id:'pct',label:'ПКТ'},{id:'base',label:'База'}]} onChange={v=>up('pharma.phase',v)} />
      <PopToggle label="ГР" value={!!calcData.pharma?.hasGH} onChange={v=>up('pharma.hasGH',v)} />
      <PopToggle label="ИГФ-1" value={!!calcData.pharma?.hasIGF} onChange={v=>up('pharma.hasIGF',v)} />
      <PopToggle label="Инсулин" value={!!calcData.pharma?.hasInsulin} onChange={v=>up('pharma.hasInsulin',v)} />
      <PopToggle label="ХГЧ" value={!!calcData.pharma?.hasHCG} onChange={v=>up('pharma.hasHCG',v)} />
      <PopToggle label="АИ" value={!!calcData.pharma?.hasAI} onChange={v=>up('pharma.hasAI',v)} />
      <PopToggle label="Каберголин" value={!!calcData.pharma?.hasCaber} onChange={v=>up('pharma.hasCaber',v)} />
      <PopToggle label="СЕРМ" value={!!calcData.pharma?.hasSERM} onChange={v=>up('pharma.hasSERM',v)} />
      <PopToggle label="SARMs" value={!!calcData.pharma?.hasSARMs} onChange={v=>up('pharma.hasSARMs',v)} />
      <PopToggle label="МГФ" value={!!calcData.pharma?.hasMGF} onChange={v=>up('pharma.hasMGF',v)} />
      <PopToggle label="ГПП-1 (сема/тирз)" value={!!calcData.pharma?.hasGLP1} onChange={v=>up('pharma.hasGLP1',v)} />
    </Card>

    <Card title="🎯 Цели / Цикл" color="#06b6d4" cols={2}>
      <PopSelect label="Тип цикла" value={calcData.goals?.trainingCycle||'mass'} options={[{id:'mass',label:'Масса'},{id:'cut',label:'Сушка'},{id:'maintenance',label:'Поддержка'},{id:'endurance',label:'Выносливость'}]} onChange={v=>up('goals.trainingCycle',v)} />
      <PopToggle label="Здоровье" value={!!calcData.goals?.healthMaintenance} onChange={v=>up('goals.healthMaintenance',v)} />
      <PopToggle label="Подготовка к соревн." value={!!calcData.goals?.competitionPrep} onChange={v=>up('goals.competitionPrep',v)} />
      <PopToggle label="Восст. сна" value={!!calcData.goals?.sleepRecovery} onChange={v=>up('goals.sleepRecovery',v)} />
      <PopToggle label="Коррекция липидов" value={!!calcData.goals?.lipidCorrection} onChange={v=>up('goals.lipidCorrection',v)} />
      <PopToggle label="Разжижение крови" value={!!calcData.goals?.bloodThinning} onChange={v=>up('goals.bloodThinning',v)} />
      <PopToggle label="Детокс печени" value={!!calcData.goals?.liverDetox} onChange={v=>up('goals.liverDetox',v)} />
      <PopToggle label="Контроль АД" value={!!calcData.goals?.bpControl} onChange={v=>up('goals.bpControl',v)} />
      <PopNum label="Длит. цикла" value={calcData.goals?.cycleWeeks||12} min={1} max={52} suffix="нед" onChange={v=>up('goals.cycleWeeks',v)} />
      <PopNum label="Прошло циклов" value={calcData.goals?.previousCycles||1} min={0} max={20} suffix="раз" onChange={v=>up('goals.previousCycles',v)} />
    </Card>

    <Card title="🩺 Медицинские противопоказания" color="#ef4444" cols={3}>
      <PopToggle label="Сердце" value={!!calcData.contraindications?.heart} onChange={v=>up('contraindications.heart',v)} />
      <PopToggle label="Печень" value={!!calcData.contraindications?.liver} onChange={v=>up('contraindications.liver',v)} />
      <PopToggle label="Почки" value={!!calcData.contraindications?.kidney} onChange={v=>up('contraindications.kidney',v)} />
      <PopToggle label="Диабет" value={!!calcData.contraindications?.diabetes} onChange={v=>up('contraindications.diabetes',v)} />
      <PopToggle label="Щитовидная" value={!!calcData.contraindications?.thyroid} onChange={v=>up('contraindications.thyroid',v)} />
      <PopToggle label="Тромбоз" value={!!calcData.contraindications?.thrombosis} onChange={v=>up('contraindications.thrombosis',v)} />
      <PopToggle label="Онкология" value={!!calcData.contraindications?.oncology} onChange={v=>up('contraindications.oncology',v)} />
      <PopToggle label="Язва/ЖКТ" value={!!calcData.contraindications?.ulcer} onChange={v=>up('contraindications.ulcer',v)} />
      <PopToggle label="Психиатрия" value={!!calcData.contraindications?.psychiatric} onChange={v=>up('contraindications.psychiatric',v)} />
    </Card>

    <Card title="🫁 Гепатобилиарная" color="#f59e0b">
      <SevSelect label="АЛТ/АСТ" value={calcData.hepatobiliary?.altAstElevation||'none'} onChange={v=>up('hepatobiliary.altAstElevation',v)} />
      <SevSelect label="ГГТ" value={calcData.hepatobiliary?.ggtElevation||'none'} onChange={v=>up('hepatobiliary.ggtElevation',v)} />
      <SevSelect label="Билирубин" value={calcData.hepatobiliary?.bilirubinElevation||'none'} onChange={v=>up('hepatobiliary.bilirubinElevation',v)} />
      <SevSelect label="Жировой гепатоз" value={calcData.hepatobiliary?.fattyLiver||'none'} onChange={v=>up('hepatobiliary.fattyLiver',v)} />
    </Card>

    <Card title="💧 Мочевыделительная" color="#22c55e">
      <SevSelect label="СКФ снижение" value={calcData.urinary?.gfrReduction||'none'} onChange={v=>up('urinary.gfrReduction',v)} />
      <SevSelect label="Креатинин ↑" value={calcData.urinary?.creatinineElevation||'none'} onChange={v=>up('urinary.creatinineElevation',v)} />
      <SevSelect label="Протеинурия" value={calcData.urinary?.proteinuria||'none'} onChange={v=>up('urinary.proteinuria',v)} />
      <SevSelect label="МКБ/камни" value={calcData.urinary?.kidneyStones||'none'} onChange={v=>up('urinary.kidneyStones',v)} />
    </Card>

    <Card title="❤️ Сердечно-сосудистая" color="#ef4444">
      <SevSelect label="ЛПНП" value={calcData.cardio?.ldlElevation||'none'} onChange={v=>up('cardio.ldlElevation',v)} />
      <SevSelect label="Гематокрит" value={calcData.cardio?.hctElevation||'none'} onChange={v=>up('cardio.hctElevation',v)} />
      <SevSelect label="АД" value={calcData.cardio?.bpElevation||'none'} onChange={v=>up('cardio.bpElevation',v)} />
      <SevSelect label="Триглицериды" value={calcData.cardio?.triglycerides||'none'} onChange={v=>up('cardio.triglycerides',v)} />
      <PopToggle label="Низкий ЛПВП" value={!!calcData.cardio?.hdlLow} onChange={v=>up('cardio.hdlLow',v)} />
    </Card>

    <Card title="🦴 ОДА / Суставы" color="#8b5cf6">
      <SevSelect label="Артралгия" value={calcData.oda?.arthralgia||'none'} onChange={v=>up('oda.arthralgia',v)} />
      <SevSelect label="Тендинит" value={calcData.oda?.tendinitis||'none'} onChange={v=>up('oda.tendinitis',v)} />
    </Card>

    <Card title="🥗 Питание" color="#f97316" cols={2}>
      <PopNum label="Белок" value={calcData.nutrition?.proteinGPerKg||1.8} min={0.5} max={4} step={0.1} suffix="г/кг" onChange={v=>up('nutrition.proteinGPerKg',v)} />
      <PopNum label="Клетчатка" value={calcData.nutrition?.fiberG||25} min={0} max={80} suffix="г" onChange={v=>up('nutrition.fiberG',v)} />
      <PopNum label="Омега-3" value={calcData.nutrition?.omega3G||2} min={0} max={10} step={0.5} suffix="г" onChange={v=>up('nutrition.omega3G',v)} />
      <PopNum label="Натрий" value={calcData.nutrition?.sodiumMg||3500} min={500} max={8000} step={100} suffix="мг" onChange={v=>up('nutrition.sodiumMg',v)} />
      <PopNum label="Калий" value={calcData.nutrition?.potassiumMg||4500} min={1000} max={8000} step={100} suffix="мг" onChange={v=>up('nutrition.potassiumMg',v)} />
      <PopNum label="Вода" value={calcData.nutrition?.waterLiters||3} min={1} max={6} step={0.5} suffix="л/д" onChange={v=>up('nutrition.waterLiters',v)} />
    </Card>

    <Card title="🫀 ЖКТ" color="#fbbf24" cols={2}>
      <PopToggle label="Гастрит" value={!!calcData.gi?.gastritis} onChange={v=>up('gi.gastritis',v)} />
      <PopToggle label="Язва" value={!!calcData.gi?.ulcer} onChange={v=>up('gi.ulcer',v)} />
      <PopToggle label="СРК" value={!!calcData.gi?.ibs} onChange={v=>up('gi.ibs',v)} />
      <PopToggle label="Запор" value={!!calcData.gi?.constipation} onChange={v=>up('gi.constipation',v)} />
      <PopToggle label="Диарея" value={!!calcData.gi?.diarrhea} onChange={v=>up('gi.diarrhea',v)} />
      <PopToggle label="Вздутие" value={!!calcData.gi?.bloating} onChange={v=>up('gi.bloating',v)} />
      <PopToggle label="Рефлюкс" value={!!calcData.gi?.reflux} onChange={v=>up('gi.reflux',v)} />
    </Card>

    <Card title="☣️ Токсическая нагрузка" color="#ec4899" cols={3}>
      <PopToggle label="Курение" value={!!calcData.toxicLoad?.smoking} onChange={v=>up('toxicLoad.smoking',v)} />
      <PopToggle label="Алкоголь регулярно" value={!!calcData.toxicLoad?.alcoholRegular} onChange={v=>up('toxicLoad.alcoholRegular',v)} />
      <PopToggle label="Наркотики" value={!!calcData.toxicLoad?.drugs} onChange={v=>up('toxicLoad.drugs',v)} />
    </Card>

    <Card title="🧘 Психология" color="#8b5cf6" cols={3}>
      <NumPillsCard label="Страх потери" value={calcData.psych?.fearOfLoss||1} onChange={v=>up('psych.fearOfLoss',v)} />
      <NumPillsCard label="Одержимость зеркалом" value={calcData.psych?.mirrorObsession||1} onChange={v=>up('psych.mirrorObsession',v)} />
      <NumPillsCard label="Апатия вне курса" value={calcData.psych?.apathyOffCycle||1} onChange={v=>up('psych.apathyOffCycle',v)} />
    </Card>

    <Card title="💉 Мониторинг зон инъекций" color="#06b6d4" cols={2}>
      <SevSelect label="Боль в месте" value={calcData.injection?.sitePain||'none'} onChange={v=>up('injection.sitePain',v)} />
      <SevSelect label="Отёк" value={calcData.injection?.swelling||'none'} onChange={v=>up('injection.swelling',v)} />
      <SevSelect label="Гематома" value={calcData.injection?.hematoma||'none'} onChange={v=>up('injection.hematoma',v)} />
      <SevSelect label="Инфильтрат" value={calcData.injection?.infiltration||'none'} onChange={v=>up('injection.infiltration',v)} />
    </Card>

    <button onClick={() => { localStorage.setItem('he_autocalc_state', JSON.stringify(calcData)); alert('Данные сохранены. Калькулятор поддержки использует их автоматически.'); }} style={{ padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 12, marginTop: 4 }}>
      💾 Сохранить данные для калькулятора
    </button>
   </div>;
};

const PlannerProfileData: React.FC = () => {
  const linked = useDataLink();
  const glassCard: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 6 };
  const labelS: React.CSSProperties = { fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2, display: 'block' };
  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 10, boxSizing: 'border-box' };
  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: value ? '#00e68a' : 'rgba(255,255,255,0.1)', position: 'relative', padding: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: value ? '#000' : '#fff', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left 0.15s' }} />
      </button>
    </div>
  );

  const [data, setData] = React.useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('he_nutrition_profile') || '{}'); } catch { return {}; }
  });
  const up = (path: string, val: any) => {
    const next = { ...data }; const keys = path.split('.');
    let obj = next; for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = obj[keys[i]] || {}; obj = obj[keys[i]]; }
    obj[keys[keys.length - 1]] = val; setData(next);
    try { localStorage.setItem('he_nutrition_profile', JSON.stringify(next)); } catch {}
  };

  return <div style={{ display:'flex', flexDirection:'column', gap:4, paddingBottom: 70 }}>
    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>🎯 Целевые КБЖУ</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
        <div><span style={labelS}>Калории (ккал)</span><input type="number" value={data.targetKcal||2800} onChange={e=>up('targetKcal',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Белок (г)</span><input type="number" value={data.targetProtein||180} onChange={e=>up('targetProtein',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Жиры (г)</span><input type="number" value={data.targetFat||80} onChange={e=>up('targetFat',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Углеводы (г)</span><input type="number" value={data.targetCarbs||350} onChange={e=>up('targetCarbs',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Клетчатка (г)</span><input type="number" value={data.fiberG||30} onChange={e=>up('fiberG',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Вода (мл)</span><input type="number" value={data.waterMl||3000} onChange={e=>up('waterMl',+e.target.value)} style={inp} /></div>
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 8 }}>⚙️ Параметры планировщика</div>
      <div><span style={labelS}>Цель</span>
        <select value={data.primaryGoal||'mass'} onChange={e=>up('primaryGoal',e.target.value)} style={inp}>
          <option value="mass">Масса</option><option value="strength">Сила</option><option value="fat_loss">Жиросжигание</option><option value="maintenance">Поддержка</option><option value="recomposition">Рекомпозиция</option>
        </select></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginTop:4}}>
        <div><span style={labelS}>Приёмов в день</span><input type="number" value={data.mealsCount||4} min={2} max={7} onChange={e=>up('mealsCount',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Тренировочных дней</span><input type="number" value={data.trainingDays||4} min={0} max={7} onChange={e=>up('trainingDays',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Профицит (%)</span><input type="number" value={data.surplusPct||10} min={0} max={30} onChange={e=>up('surplusPct',+e.target.value)} style={inp} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:4}}>
        <div><span style={labelS}>Тип диеты</span>
          <select value={data.dietType||'omnivore'} onChange={e=>up('dietType',e.target.value)} style={inp}>
            <option value="omnivore">Всеядное</option><option value="vegetarian">Вегетарианское</option><option value="vegan">Веганское</option><option value="keto">Кето</option>
          </select></div>
        <div><span style={labelS}>Бюджет</span>
          <select value={data.budget||'mid'} onChange={e=>up('budget',e.target.value)} style={inp}>
            <option value="low">Эконом</option><option value="mid">Средний</option><option value="max">Максимум</option><option value="enhanced">Улучшенный</option>
          </select></div>
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ Аллергии и непереносимости</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>
        {[{id:'dairy',label:'Молочные'},{id:'gluten',label:'Глютен'},{id:'soy',label:'Соя'},{id:'eggs',label:'Яйца'},{id:'fish',label:'Рыба'},{id:'nuts',label:'Орехи'},{id:'histamine',label:'Гистамин'},{id:'seafood',label:'Морепродукты'}].map(a=>(
          <Toggle key={a.id} label={a.label} value={!!data.allergens?.[a.id]} onChange={v=>up('allergens.'+a.id,v)} />
        ))}
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>🩺 Проблемы здоровья</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
        {[{id:'oedema',label:'Отёки'},{id:'lactose_intolerance',label:'Непереносимость лактозы'},{id:'gluten_intolerance',label:'Непереносимость глютена'},{id:'diabetes',label:'Диабет/инсулинорезистентность'},{id:'hypertension',label:'Гипертония'},{id:'gi_issues',label:'Проблемы ЖКТ'},{id:'gout',label:'Подагра'},{id:'kidney_stones',label:'Камни в почках'}].map(h=>(
          <Toggle key={h.id} label={h.label} value={!!data.healthIssues?.[h.id]} onChange={v=>up('healthIssues.'+h.id,v)} />
        ))}
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 8 }}>⚖️ Спортивный режим</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
        <div><span style={labelS}>Дисциплина</span>
          <select value={data.sportType||'bodybuilding'} onChange={e=>up('sportType',e.target.value)} style={inp}>
            <option value="bodybuilding">Бодибилдинг</option><option value="powerlifting">Пауэрлифтинг</option><option value="crossfit">Кроссфит</option><option value="fitness">Фитнес</option>
          </select></div>
        <div><span style={labelS}>Вес. категория (кг)</span><input type="number" value={data.weightClass||0} onChange={e=>up('weightClass',+e.target.value)} placeholder="Для ПЛ" style={inp} /></div>
      </div>
      <div style={{marginTop:6}}><span style={labelS}>Соревновательная дата</span><input type="date" value={data.compDate||''} onChange={e=>up('compDate',e.target.value)} style={inp} /></div>
      {data.weightClass > 0 && data.sportType === 'powerlifting' && (
        <div style={{marginTop:6,padding:'6px 8px',borderRadius:6,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',fontSize:8,color:'rgba(255,255,255,0.8)'}}>
          📉 До веса {(data.weightClass)} кг: дефицит {Math.max(0,Math.round(((linked.profile?.settings?.weight||80)-data.weightClass)*100/(data.weightClass||1)))}%.
          {data.compDate && (()=>{const days=Math.max(0,Math.round((new Date(data.compDate).getTime()-Date.now())/86400000));return <div>📅 {days} дней до старта</div>;})()}
        </div>
      )}
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', marginBottom: 8 }}>💧 Электролиты и фарма</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:6}}>
        <div><span style={labelS}>Натрий (мг)</span><input type="number" value={data.sodiumMg||3500} onChange={e=>up('sodiumMg',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Калий (мг)</span><input type="number" value={data.potassiumMg||4500} onChange={e=>up('potassiumMg',+e.target.value)} style={inp} /></div>
        <div><span style={labelS}>Магний (мг)</span><input type="number" value={data.magnesiumMg||400} onChange={e=>up('magnesiumMg',+e.target.value)} style={inp} /></div>
      </div>
      <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginBottom:6 }}>💉 Фармакология (влияет на план)</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
        {[{id:'aas_oral',label:'Оральные ААС'},{id:'aas_inj',label:'Инъекционные ААС'},{id:'hgh',label:'ГР'},{id:'insulin',label:'Инсулин'},{id:'diuretics',label:'Диуретики'},{id:'stimulants',label:'Стимуляторы'}].map(d=>(
          <Toggle key={d.id} label={d.label} value={!!data.pharma?.[d.id]} onChange={v=>up('pharma.'+d.id,v)} />
        ))}
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color:'#8b5cf6', marginBottom:8 }}>🔄 Специальные режимы</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
        <Toggle label="Ленивый день" value={!!data.lazyDayMode} onChange={v=>up('lazyDayMode',v)} />
        <Toggle label="Циклирование углеводов" value={!!data.carbCycling} onChange={v=>up('carbCycling',v)} />
        <Toggle label="Читмил разрешён" value={!!data.allowCheatMeal} onChange={v=>up('allowCheatMeal',v)} />
      </div>
      <div style={{marginTop:4}}><span style={labelS}>Предпочтения (через запятую)</span>
        <input value={data.preferences||''} onChange={e=>up('preferences',e.target.value)} placeholder="напр: курица, гречка, яйца" style={inp} />
      </div>
    </div>

    {data.sportType === 'powerlifting' && data.weightClass > 0 && (
      <div style={glassCard}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', marginBottom: 8 }}>💧 Протокол весогонки (водная манипуляция)</div>
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', marginBottom:8, lineHeight:1.4 }}>
          Стандартный протокол на 5 дней до взвешивания. Рассчитан на сброс 2-4% веса тела водой.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:4,marginBottom:8}}>
          <div><span style={labelS}>Целевой вес взвешивания (кг)</span><input type="number" value={data.targetWeighInKg||data.weightClass} onChange={e=>up('targetWeighInKg',+e.target.value)} style={inp} /></div>
        </div>
        {(() => {
          const bw = linked.profile?.settings?.weight || 80;
          const target = data.targetWeighInKg || data.weightClass || bw;
          const toLose = Math.max(0, bw - target);
          if (toLose <= 0) return <div style={{fontSize:8,color:'#22c55e'}}>✅ Вы уже в весе. Фокус на удержание.</div>;
          const days = Math.max(1, Math.ceil(toLose / 0.3));
          return (
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>План на {Math.min(7,days)} дней (сброс ~{toLose.toFixed(1)} кг)</div>
              {[
                { day:'День -5/-4', water:'8-10 л/д', sodium:'6-8 г', carbs:'обычные', note:'Водная загрузка — гипергидратация' },
                { day:'День -3/-2', water:'5-6 л/д', sodium:'3-4 г', carbs:'↓ на 30%', note:'Снижение натрия, начало сушки' },
                { day:'День -1', water:'2-3 л/д', sodium:'1-2 г', carbs:'↓ на 50%', note:'Активная сушка, гликоген ↓' },
                { day:'Взвешивание', water:'глотками', sodium:'мин.', carbs:'минимум', note:'Только поддержание. Никакой еды до взвешивания.' },
                { day:'После взвешивания', water:'постепенно', sodium:'3-5 г', carbs:`${Math.round(target*8)} г`, note:'Регидратация + углеводы + электролиты. Пить медленно!' },
              ].map((row,i) => (
                <div key={i} style={{padding:'6px 8px',borderRadius:6,marginBottom:3,background:'rgba(6,182,212,0.04)',border:'1px solid rgba(6,182,212,0.08)',fontSize:8}}>
                  <div style={{fontWeight:700,color:'#06b6d4',marginBottom:2}}>{row.day}</div>
                  <div style={{color:'rgba(255,255,255,0.8)'}}>💧 {row.water} · 🧂 Na: {row.sodium} · 🍚 {row.carbs}</div>
                  <div style={{color:'rgba(255,255,255,0.5)',marginTop:1}}>{row.note}</div>
                </div>
              ))}
              <div style={{marginTop:4,fontSize:7,color:'#ef4444',lineHeight:1.3}}>
                ⚠️ Не применять при заболеваниях почек, сердца, гипертонии. Консультация врача обязательна. Резкое обезвоживание опасно для здоровья.
              </div>
            </div>
          );
        })()}
      </div>
    )}

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>🏋️ Тренировочная фаза</div>
      <div><span style={labelS}>Текущая фаза</span>
        <select value={data.trainPhase||'hypertrophy'} onChange={e=>up('trainPhase',e.target.value)} style={inp}>
          <option value="hypertrophy">💪 Гипертрофия (8-12 повт)</option>
          <option value="strength">🏋️ Сила (1-5 повт)</option>
          <option value="peak">🏆 Пик/Соревнования</option>
          <option value="deload">🔄 Разгрузка</option>
          <option value="offseason">🌴 Межсезонье</option>
        </select></div>
      <div style={{marginTop:6,padding:'6px 8px',borderRadius:6,background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.08)',fontSize:8,color:'rgba(255,255,255,0.7)',lineHeight:1.4}}>
        {data.trainPhase==='hypertrophy'&&'Белок 2.2 г/кг, профицит 10-15%, углеводы высокие, креатин 5 г/д.'}
        {data.trainPhase==='strength'&&'Белок 2.5 г/кг, профицит 5-10%, жиры 1.0 г/кг, креатин 5-10 г/д.'}
        {data.trainPhase==='peak'&&'Белок 2.8 г/кг, калории = TDEE, натрий контролируемый, вода по протоколу.'}
        {data.trainPhase==='deload'&&'Белок 1.8 г/кг, калории = TDEE, углеводы снижены, объём тренировок -50%.'}
        {data.trainPhase==='offseason'&&'Белок 1.6 г/кг, калории = TDEE, свободное питание, восстановление.'}
        {!data.trainPhase&&'Выберите фазу для рекомендаций по макросам.'}
      </div>
    </div>

    <div style={glassCard}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 8 }}>🔄 Рефид / Читмил калькулятор</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
        <div><span style={labelS}>Частота рефидов (дней)</span>
          <select value={data.refeedFreq||7} onChange={e=>up('refeedFreq',+e.target.value)} style={inp}>
            <option value={3}>Каждые 3 дня</option><option value={5}>Каждые 5 дней</option><option value={7}>Раз в неделю</option><option value={14}>Раз в 2 недели</option>
          </select></div>
        <div><span style={labelS}>Тип рефида</span>
          <select value={data.refeedType||'carb'} onChange={e=>up('refeedType',e.target.value)} style={inp}>
            <option value="carb">Углеводный (+50% углей)</option><option value="maintenance">Поддерживающий (TDEE)</option><option value="surplus">Профицит (+15%)</option>
          </select></div>
      </div>
      {(()=>{const bw=linked.profile?.settings?.weight||80;const tdee=Math.round(bw*33);const extra=data.refeedType==='carb'?Math.round(tdee*0.3):data.refeedType==='surplus'?Math.round(tdee*0.15):0;return(<div style={{marginTop:6,fontSize:8,color:'rgba(255,255,255,0.7)',lineHeight:1.4,padding:'6px 8px',borderRadius:6,background:'rgba(249,115,22,0.04)',border:'1px solid rgba(249,115,22,0.08)'}}>📊 Рефид-день: {tdee+extra} ккал (TDEE {tdee} + {extra} ккал) · Белок {Math.round(bw*2.2)}г · Углеводы {Math.round((tdee+extra)*0.55/4)}г</div>)})()}
    </div>

    <button onClick={() => { alert('Данные сохранены. Планировщик питания использует их автоматически.'); }} style={{ padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 12, marginTop: 4 }}>
      💾 Сохранить данные планировщика
    </button>
  </div>;
};
