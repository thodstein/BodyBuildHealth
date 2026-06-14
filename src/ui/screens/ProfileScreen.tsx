import React, { useEffect, useState } from 'react';
import type { UserProfile, InjuryRecord, SupplementEntry, MedicationEntry, LabPoint } from '../../core/types';
import { getProfile, updateProfile, useProfileRefresh } from '../../core/profile-manager';
import { db } from '../../core/db';
import { ReportsScreen } from './ReportsScreen';
import { calcReadiness } from '../../engines/readiness.engine';
import { computeLabIndices, interpretLabIndices } from '../../engines/labs-indices.engine';
import { calculateIndices } from '../../engines/clinical-indices.engine';
import { NAVY_BF_FORMULAS, MUSCLE_GROUPS_FULL, INJURY_LOCATIONS } from '../../core/constants';

type ProfileTab = 'overview' | 'anthropometry' | 'sleep' | 'lifestyle' | 'diet' | 'nutrition_v7' | 'genetics' | 'injuries' | 'progress' | 'reports';
type ProfilePage = 'hero' | 'tabs';

const GOALS = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Реcomp' }, { id: 'health', label: 'Здоровье' }
] as const;

const WEIGHT_LOG_KEY = 'he_weight_log';
interface WeightEntry { date: string; weight: number; }
function getWeightLog(): WeightEntry[] {
  try { return JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]'); } catch { return []; }
}
function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(log.slice(-90)));
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
  { id: 'dairy', label: 'Молочные' },
  { id: 'gluten', label: 'Глютен' },
  { id: 'soy', label: 'Соя' },
  { id: 'eggs', label: 'Яйца' },
  { id: 'fish', label: 'Рыба' },
  { id: 'shellfish', label: 'Морепродукты' },
  { id: 'tree_nuts', label: 'Орехи' },
  { id: 'peanuts', label: 'Арахис' },
];

const INTOLERANCE_OPTIONS = [
  { id: 'lactose', label: 'Лактоза' },
  { id: 'fructose', label: 'Фруктоза' },
  { id: 'histamine', label: 'Гистамин' },
  { id: 'sorbitol', label: 'Сорбитол' },
];

const COOKING_SKILLS = [
  { id: 'none', label: 'Не умею' },
  { id: 'basic', label: 'Базовые' },
  { id: 'intermediate', label: 'Средние' },
  { id: 'advanced', label: 'Продвинутые' },
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
  { id: 'baseline', label: 'База' },
  { id: 'course', label: 'Курс' },
  { id: 'course-bridge-course', label: 'Курс+Бридж' },
  { id: 'bridge', label: 'Бридж' },
  { id: 'pct', label: 'ПКТ' },
  { id: 'post_pct', label: 'После ПКТ' },
  { id: 'fertility', label: 'Фертильность' },
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

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 },
  label: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  slider: { width: '100%', accentColor: '#00e68a' },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' as const },
  btnGroup: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 },
  btn: { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 12, cursor: 'pointer' },
  btnActive: { padding: '6px 12px', borderRadius: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 12, cursor: 'pointer' },
  chipActive: { padding: '4px 10px', borderRadius: 16, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.15)', color: '#00e68a', fontSize: 11, cursor: 'pointer' },
  chip: { padding: '4px 10px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: 11, cursor: 'pointer' },
  saveBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#00e68a', color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer', width: '100%', marginTop: 8 },
  delBtn: { padding: '4px 8px', borderRadius: 6, border: '1px solid #f44336', background: 'transparent', color: '#f44336', fontSize: 11, cursor: 'pointer' },
  section: { fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 4, opacity: 0.8 },
  computed: { fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,230,138,0.08)', marginBottom: 6 },
};

export const ProfileScreen: React.FC = () => {
  const profile = useProfileRefresh();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [page, setPage] = useState<ProfilePage>('hero');
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [editInjury, setEditInjury] = useState<InjuryRecord | null>(null);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(getWeightLog);

  const s_ = profile.settings;
  const readinessScores = calcReadiness({
    sleepHours: s_.baselineSleepHours ?? 7,
    sleepQuality: s_.baselineSleepQuality ?? 5,
    nightAwakenings: s_.nightAwakenings ?? 1,
    hrvRatio: s_.baselineHrvRatio ?? 1.0,
    doms: 2, stress: s_.baselineStressLevel ?? 3,
    calRatio: s_.nutritionFactor ?? 0.8, proteinRatio: 0.8,
    waterRatio: 0.7, fiberRatio: 0.6, omega3Flag: false,
    trainingLoadRatio: s_.trainingFactor ?? 0.6,
    subjFatigue: s_.fatigueLevel ?? 3, hrIncrease: 0.1,
    chronotype: s_.chronotype, bedtime: s_.bedtime, wakeTime: s_.wakeTime,
  });

  const clinicalIndices = labs.length > 0 ? calculateIndices(labs, s_.sex, s_.age ?? 30) : null;
  const labIndices = labs.length > 0 ? computeLabIndices(labs) : null;
  const labIndexText = labIndices ? interpretLabIndices(labIndices) : null;

  const bmi = s_.height && s_.weight ? (s_.weight / Math.pow(s_.height / 100, 2)).toFixed(1) : null;
  const bmiText = bmi ? `${bmi} кг/м²` : '';
  const lbm = s_.weight && s_.bodyFat ? (s_.weight * (1 - s_.bodyFat / 100)).toFixed(1) : null;
  const navyBf = (() => {
    if (!s_.waistCm || !s_.neckCm || !s_.height) return null;
    const f = NAVY_BF_FORMULAS[s_.sex] ?? NAVY_BF_FORMULAS.male;
    if (s_.sex === 'male') {
      return Math.max(0, f.a * Math.log10(s_.waistCm - s_.neckCm) - f.b * Math.log10(s_.height) + f.c).toFixed(1);
    }
    if (s_.hipCm) {
      const ff = NAVY_BF_FORMULAS.female;
      return Math.max(0, ff.a * Math.log10(s_.waistCm + s_.hipCm - s_.neckCm) - ff.b * Math.log10(s_.height) + ff.c).toFixed(1);
    }
    return null;
  })();
  const navyBfText = navyBf ? `${navyBf}%` : '';

  useEffect(() => {
    const load = async () => {
      try { setLabs(await db.getAll<LabPoint>('labs_log')); } catch {}
    };
    load();
  }, []);

  const save = (partial: Partial<UserProfile['settings']>) => {
    if (partial.weight !== undefined && partial.weight !== s_.weight) {
      const newEntry: WeightEntry = { date: new Date().toISOString().split('T')[0], weight: partial.weight };
      const updated = [...weightLog.filter(w => w.date !== newEntry.date), newEntry].sort((a, b) => a.date.localeCompare(b.date));
      setWeightLog(updated);
      saveWeightLog(updated);
    }
    updateProfile({ settings: { ...s_, ...partial } });
  };

  const addInjury = () => {
    const newInj: InjuryRecord = { id: crypto.randomUUID(), type: 'muscle', location: '', painLevel: 3, movementLimit: 'none', side: 'left', chronic: false, date: new Date().toISOString().slice(0, 10) };
    setEditInjury(newInj);
  };

  const saveInjury = (inj: InjuryRecord) => {
    const existing = s_.injuries ?? [];
    const idx = existing.findIndex(i => i.id === inj.id);
    const updated = idx >= 0 ? existing.map(i => i.id === inj.id ? inj : i) : [...existing, inj];
    save({ injuries: updated });
    setEditInjury(null);
  };

  const deleteInjury = (id: string) => {
    save({ injuries: (s_.injuries ?? []).filter(i => i.id !== id) });
  };

  const toggleWeakPoint = (id: string) => {
    const wp = s_.weakPoints ?? [];
    save({ weakPoints: wp.includes(id) ? wp.filter(x => x !== id) : [...wp, id] });
  };

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Обзор' }, { id: 'anthropometry', label: 'Антропометрия' },
    { id: 'sleep', label: 'Сон' }, { id: 'lifestyle', label: 'Образ жизни' },
    { id: 'diet', label: 'Питание' }, { id: 'injuries', label: 'Травмы' },
    { id: 'progress', label: 'Прогресс' }, { id: 'reports', label: '📊 Отчёты' }
  ];

  return (
    <div className="screen profile">
      {page === 'hero' ? (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/profile-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <div style={{ marginBottom:16 }}>
              <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0, textShadow:'0 2px 14px rgba(0,0,0,0.9)' }}>Профиль</h1>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.9)', margin:'4px 0 0', textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
                Управление профилем, отчёты и контакты
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { id: 'overview', icon: '📋', title: 'Сведения о пользователе', desc: 'Обзор, антропометрия, сон, образ жизни, питание, травмы', color: '#00e68a' },
                { id: 'reports', icon: '📊', title: 'Отчеты', desc: 'Прогресс и отчёты', color: '#3b82f6' },
                { id: 'progress', icon: '📞', title: 'Контакты', desc: 'Сведения о разработчике, друзья, магазины, тренера и врачи', color: '#8b5cf6' },
              ].map(card => (
                <button key={card.id} onClick={() => { setPage('tabs'); setTab(card.id as ProfileTab); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: card.color + '18', fontSize: 20 }}>{card.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: card.color }}>{card.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position:'relative', minHeight:'100vh', background:'#08080d' }}>
          <img src="/bg-profile.png" alt="" style={{ position:'fixed', inset:0, width:'100%', height:'100%', objectFit:'fill', zIndex:0 }} />
          <div style={{ position:'relative', zIndex:1, padding:'10px 12px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginBottom: 8 }}>
            <button onClick={() => setPage('hero')} style={{
              padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600,
              background:'rgba(20,22,30,0.3)', border:'1px solid rgba(255,255,255,0.06)',
              color:'rgba(255,255,255,0.8)',
            }}>← На главную</button>
          </div>

          <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:10, paddingBottom:2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0,
                background: tab === t.id ? 'rgba(0,230,138,0.2)' : 'rgba(20,22,30,0.3)',
                border: tab === t.id ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: tab === t.id ? '#00e68a' : 'rgba(255,255,255,0.8)',
                backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'overview' && (
        <>
          {readinessScores && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 8px' }}>Оценка готовности</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
                {[
                  { label: 'Восст.', value: readinessScores.recovery, good: 60 },
                  { label: 'Питание', value: readinessScores.nutrition, good: 60 },
                  { label: 'Поддержка', value: readinessScores.support, good: 60 },
                  { label: 'Усталость', value: readinessScores.fatigue, good: 40, invert: true },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.invert ? (m.value <= m.good ? '#00e68a' : m.value <= 60 ? '#ff9800' : '#f44336') : (m.value >= m.good ? '#00e68a' : m.value >= 40 ? '#ff9800' : '#f44336') }}>{m.value}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Фаза курса</h4>
            <div style={s.btnGroup}>
              {COURSE_PHASES.map(p => <button key={p.id} style={(s_.phase ?? 'baseline') === p.id ? s.btnActive : s.btn} onClick={() => save({ phase: p.id })}>{p.label}</button>)}
            </div>
            {s_.courseStartDate && (
              <div style={{ marginTop: 6 }}>
                <span style={s.label}>Дата начала курса</span>
                <input style={s.input} type="date" value={s_.courseStartDate} onChange={e => save({ courseStartDate: e.target.value })} />
              </div>
            )}
            {!s_.courseStartDate && s_.phase && s_.phase !== 'baseline' && (
              <button style={{ ...s.btn, marginTop: 6 }} onClick={() => save({ courseStartDate: new Date().toISOString().slice(0, 10) })}>Указать дату начала</button>
            )}
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Основная информация</h4>
            <div style={s.row}>
              <div><span style={s.label}>Имя</span><input style={s.input} value={profile.name} onChange={e => updateProfile({ name: e.target.value })} placeholder="" /></div>
              <div><span style={s.label}>Email</span><input style={s.input} value={s_.email ?? ''} disabled placeholder="Email" /></div>
            </div>
            <div style={s.row}>
              <div><span style={s.label}>Возраст</span><input style={s.input} type="number" value={s_.age ?? ''} onChange={e => save({ age: +e.target.value })} placeholder="30" /></div>
              <div><span style={s.label}>Пол</span>
                <div style={s.btnGroup}>
                  <button style={s_.sex === 'male' ? s.btnActive : s.btn} onClick={() => save({ sex: 'male' })}>Муж</button>
                  <button style={s_.sex === 'female' ? s.btnActive : s.btn} onClick={() => save({ sex: 'female' })}>Жен</button>
                </div>
              </div>
            </div>
          </div>
          {clinicalIndices && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 8px' }}>Клинические индексы</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
                {[
                  { n: 'HOMA-IR', v: clinicalIndices.homaIR.value, l: clinicalIndices.homaIR.status === 'normal' ? '' : '' },
                  { n: 'eGFR', v: clinicalIndices.egfr.value, l: clinicalIndices.egfr.status === 'normal' ? '' : `` },
                  { n: 'LDL/HDL', v: clinicalIndices.ldlHdlRatio.value, l: clinicalIndices.ldlHdlRatio.status === 'optimal' ? '' : '' },
                  { n: 'De Ritis', v: clinicalIndices.deritis.value, l: clinicalIndices.deritis.status === 'normal' ? '' : '' },
                ].map(i => <div key={i.n}><div style={{ fontSize: 18, fontWeight: 700 }}>{i.v}</div><div style={{ fontSize: 11 }}>{i.n}</div><div style={{ fontSize: 10, opacity: 0.6 }}>{i.l}</div></div>)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'anthropometry' && (
        <>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Основные параметры</h4>
            <div style={s.row}>
              <div><span style={s.label}>Рост (см)</span><input style={s.input} type="number" value={s_.height ?? ''} onChange={e => save({ height: +e.target.value })} /></div>
              <div><span style={s.label}>Вес (кг)</span><input style={s.input} type="number" step="0.1" value={s_.weight} onChange={e => save({ weight: +e.target.value })} /></div>
            </div>
            <div style={s.row}>
              <div><span style={s.label}>% жира (ручной)</span><input style={s.input} type="number" step="0.1" value={s_.bodyFat ?? ''} onChange={e => save({ bodyFat: e.target.value ? +e.target.value : undefined })} placeholder="Optional" /></div>
              <div><span style={s.label}>Пол</span>
                <div style={s.btnGroup}>
                  <button style={s_.sex === 'male' ? s.btnActive : s.btn} onClick={() => save({ sex: 'male' })}>М</button>
                  <button style={s_.sex === 'female' ? s.btnActive : s.btn} onClick={() => save({ sex: 'female' })}>Ж</button>
                </div>
              </div>
            </div>
            {bmi && <div style={s.computed}>BMI: {bmiText} - {parseFloat(bmi) < 18.5 ? '' : parseFloat(bmi) < 25 ? '' : parseFloat(bmi) < 30 ? '' : ''}</div>}
            {lbm && <div style={s.computed}>LBM (сухая масса): {lbm} кг</div>}
            {navyBf && <div style={s.computed}>Navy BF%: {navyBfText} - {parseFloat(navyBf) < 6 ? '' : parseFloat(navyBf) < 18 ? '' : parseFloat(navyBf) < 25 ? '' : ''}</div>}
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Обхваты (см)</h4>
            <div style={s.row3}>
              {[
                { k: 'waistCm', l: '' }, { k: 'neckCm', l: '' }, { k: 'chestCm', l: '' },
                { k: 'hipCm', l: '' }, { k: 'forearmCm', l: '' }, { k: 'bicepCm', l: '' },
                { k: 'thighCm', l: '' }
              ].map(c => (
                <div key={c.k}>
                  <span style={s.label}>{c.l}</span>
                  <input style={s.input} type="number" step="0.5" value={(s_ as any)[c.k] ?? ''} onChange={e => save({ [c.k]: e.target.value ? +e.target.value : undefined } as any)} />
                </div>
              ))}
            </div>
          </div>
          {weightLog.length > 1 && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 8px' }}>История веса ({weightLog.length} записей)</h4>
              <div style={{ display: 'flex', gap: 2, height: 50, alignItems: 'flex-end' }}>
                {weightLog.slice(-30).map((e, i) => {
                  const minW = Math.min(...weightLog.map(w => w.weight));
                  const maxW = Math.max(...weightLog.map(w => w.weight));
                  const range = maxW - minW || 1;
                  const h = Math.max(4, ((e.weight - minW) / range) * 100);
                  const isLast = i === weightLog.slice(-30).length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                      title={`${e.date}: ${e.weight} кг`}>
                      <div style={{ width: '70%', height: `${h}%`, background: isLast ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '1px 1px 0 0', minHeight: 2 }} />
                      {i % 7 === 0 && <span style={{ fontSize: 6, color: 'var(--text-dim)' }}>{e.date.slice(5)}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                <span>Мин: {Math.min(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
                <span>Текущий: {weightLog[weightLog.length - 1]?.weight?.toFixed(1)} кг</span>
                <span>Макс: {Math.max(...weightLog.map(w => w.weight)).toFixed(1)} кг</span>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'sleep' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Параметры сна</h4>
          <div>
            <span style={s.label}>Длительность сна: {s_.baselineSleepHours ?? 7} ч</span>
            <input style={s.slider} type="range" min="0" max="12" step="0.5" value={s_.baselineSleepHours ?? 7} onChange={e => save({ baselineSleepHours: +e.target.value })} />
          </div>
          <div>
            <span style={s.label}>Качество сна: {s_.baselineSleepQuality ?? 5}/10</span>
            <input style={s.slider} type="range" min="1" max="10" step="1" value={s_.baselineSleepQuality ?? 5} onChange={e => save({ baselineSleepQuality: +e.target.value })} />
          </div>
          <div>
            <span style={s.label}>Пробуждения ночью: {s_.nightAwakenings ?? 1}</span>
            <input style={s.slider} type="range" min="0" max="10" step="1" value={s_.nightAwakenings ?? 1} onChange={e => save({ nightAwakenings: +e.target.value })} />
          </div>
          <div style={s.row}>
            <div><span style={s.label}>Время засыпания</span><input style={s.input} type="time" value={s_.bedtime ?? '23:00'} onChange={e => save({ bedtime: e.target.value })} /></div>
            <div><span style={s.label}>Время подъёма</span><input style={s.input} type="time" value={s_.wakeTime ?? '07:00'} onChange={e => save({ wakeTime: e.target.value })} /></div>
          </div>
          <div>
            <span style={s.label}>Хронотип</span>
            <div style={s.btnGroup}>
              {CHRONOTYPES.map(c => <button key={c.id} style={(s_.chronotype ?? 'mixed') === c.id ? s.btnActive : s.btn} onClick={() => save({ chronotype: c.id })}>{c.label}</button>)}
            </div>
          </div>
        </div>
      )}

      {tab === 'lifestyle' && (
        <>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Стресс и усталость</h4>
            <div>
              <span style={s.label}>Стресс: {s_.baselineStressLevel ?? 3}/10</span>
              <input style={s.slider} type="range" min="1" max="10" value={s_.baselineStressLevel ?? 3} onChange={e => save({ baselineStressLevel: +e.target.value })} />
            </div>
            <div>
              <span style={s.label}>Усталость: {s_.fatigueLevel ?? 3}/10</span>
              <input style={s.slider} type="range" min="1" max="10" value={s_.fatigueLevel ?? 3} onChange={e => save({ fatigueLevel: +e.target.value })} />
            </div>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Активность</h4>
            <div>
              <span style={s.label}>Шаги/день: {s_.dailySteps ?? 6000}</span>
              <input style={s.slider} type="range" min="0" max="30000" step="500" value={s_.dailySteps ?? 6000} onChange={e => save({ dailySteps: +e.target.value })} />
            </div>
            <div>
              <span style={s.label}>Вода/день (л): {s_.dailyWaterLiters ?? 2}</span>
              <input style={s.slider} type="range" min="0" max="6" step="0.1" value={s_.dailyWaterLiters ?? 2} onChange={e => save({ dailyWaterLiters: +e.target.value })} />
            </div>
            <div style={s.row}>
              <div><span style={s.label}>Тренировок/нед</span><input style={s.input} type="number" min="0" max="7" value={s_.workoutsPerWeek ?? 3} onChange={e => save({ workoutsPerWeek: +e.target.value })} /></div>
              <div><span style={s.label}>Мин/тренировку</span><input style={s.input} type="number" min="15" max="180" value={s_.avgWorkoutMinutes ?? 60} onChange={e => save({ avgWorkoutMinutes: +e.target.value })} /></div>
            </div>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Уровни и опыт</h4>
            <div>
              <span style={s.label}>Тренировочный уровень</span>
              <div style={s.btnGroup}>
                {TRAINING_LEVELS.map(l => <button key={l.id} style={(s_.trainingLevel ?? 'intermediate') === l.id ? s.btnActive : s.btn} onClick={() => save({ trainingLevel: l.id as any })}>{l.label}</button>)}
              </div>
            </div>
            <div>
              <span style={s.label}>Фармакологический опыт</span>
              <div style={s.btnGroup}>
                {PHARMA_EXPERIENCE.map(e => <button key={e.id} style={(s_.pharmaExperience ?? 'none') === e.id ? s.btnActive : s.btn} onClick={() => save({ pharmaExperience: e.id as any })}>{e.label}</button>)}
              </div>
            </div>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Цель</h4>
            <div style={s.btnGroup}>
              {GOALS.map(g => <button key={g.id} style={(s_.primaryGoal ?? s_.goal ?? '') === g.id ? s.btnActive : s.btn} onClick={() => save({ primaryGoal: g.id as any, goal: g.id })}>{g.label}</button>)}
            </div>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Отстающие группы</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MUSCLE_GROUPS_FULL.map(m => (
                <button key={m.id} style={(s_.weakPoints ?? []).includes(m.id) ? s.chipActive : s.chip} onClick={() => toggleWeakPoint(m.id)}>{m.label}</button>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Принимаю: БАДы</h4>
            {(s_.currentSupplements ?? []).map((sup, i) => (
              <div key={sup.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{sup.name} — {sup.doseMg} {sup.doseUnit}</span>
                <button style={s.delBtn} onClick={() => save({ currentSupplements: (s_.currentSupplements ?? []).filter((_, j) => j !== i) })}>Удалить</button>
              </div>
            ))}
            <button style={{ ...s.btn, marginTop: 8 }} onClick={() => {
              const ns: SupplementEntry = { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg' };
              save({ currentSupplements: [...(s_.currentSupplements ?? []), ns] });
            }}>+ Добавить БАД</button>
          </div>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px' }}>Принимаю: Аптека</h4>
            {(s_.currentMedications ?? []).map((med, i) => (
              <div key={med.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{med.name} — {med.doseMg} {med.doseUnit} ({med.frequency})</span>
                <button style={s.delBtn} onClick={() => save({ currentMedications: (s_.currentMedications ?? []).filter((_, j) => j !== i) })}>Удалить</button>
              </div>
            ))}
            <button style={{ ...s.btn, marginTop: 8 }} onClick={() => {
              const nm: MedicationEntry = { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg', frequency: 'daily' };
              save({ currentMedications: [...(s_.currentMedications ?? []), nm] });
            }}>+ Добавить препарат</button>
          </div>
         </>
      )}

      {tab === 'diet' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Тип питания</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {DIET_TYPES.map(dt => (
                <button key={dt.id} onClick={() => save({ dietType: dt.id as any })} style={{
                  padding: '10px 8px', borderRadius: 10, border: s_.dietType === dt.id ? '2px solid var(--accent-green, #00e68a)' : '2px solid var(--border-color)',
                  background: s_.dietType === dt.id ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)', cursor: 'pointer', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20 }}>{dt.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: s_.dietType === dt.id ? 'var(--accent-green, #00e68a)' : 'var(--text-light)' }}>{dt.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Пищевые аллергии</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALLERGEN_OPTIONS.map(a => {
                const active = (s_.foodAllergies ?? []).includes(a.id);
                return (
                  <button key={a.id} onClick={() => {
                    const current = s_.foodAllergies ?? [];
                    save({ foodAllergies: active ? current.filter(x => x !== a.id) : [...current, a.id] });
                  }} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: active ? 'rgba(239,68,68,0.15)' : 'var(--bg-primary)',
                    border: active ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    color: active ? '#ef4444' : 'var(--text-light)', fontWeight: active ? 600 : 400,
                  }}>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Непереносимости</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INTOLERANCE_OPTIONS.map(it => {
                const active = (s_.foodIntolerances ?? []).includes(it.id);
                return (
                  <button key={it.id} onClick={() => {
                    const current = s_.foodIntolerances ?? [];
                    save({ foodIntolerances: active ? current.filter(x => x !== it.id) : [...current, it.id] });
                  }} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: active ? 'rgba(249,115,22,0.15)' : 'var(--bg-primary)',
                    border: active ? '1px solid #f97316' : '1px solid var(--border-color)',
                    color: active ? '#f97316' : 'var(--text-light)', fontWeight: active ? 600 : 400,
                  }}>
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Навыки готовки</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {COOKING_SKILLS.map(cs => (
                <button key={cs.id} onClick={() => save({ cookingSkill: cs.id as any })} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: s_.cookingSkill === cs.id ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)',
                  border: s_.cookingSkill === cs.id ? '1px solid var(--accent-green, #00e68a)' : '1px solid var(--border-color)',
                  color: s_.cookingSkill === cs.id ? 'var(--accent-green, #00e68a)' : 'var(--text-light)', fontWeight: 500,
                }}>
                  {cs.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Приёмов пищи в день</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={2} max={7} value={s_.mealsPerDay ?? 4} onChange={e => save({ mealsPerDay: parseInt(e.target.value) })} style={{ flex: 1, accentColor: '#00e68a' }} />
              <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{s_.mealsPerDay ?? 4}</span>
            </div>
          </div>

          {((s_.foodAllergies ?? []).length + (s_.foodIntolerances ?? []).length > 0 || s_.dietType) && (
            <div className="card" style={{ marginBottom: 12, borderColor: 'var(--accent-green, #00e68a)', borderWidth: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--accent-green, #00e68a)', fontWeight: 600, marginBottom: 4 }}>
                Активные ограничения
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {s_.dietType && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: 'var(--accent-green, #00e68a)' }}>
                  {DIET_TYPES.find(d => d.id === s_.dietType)?.label}
                </span>}
                {(s_.foodAllergies ?? []).map(a => (
                  <span key={a} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    {ALLERGEN_OPTIONS.find(o => o.id === a)?.label || a}
                  </span>
                ))}
                {(s_.foodIntolerances ?? []).map(it => (
                  <span key={it} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                    {INTOLERANCE_OPTIONS.find(o => o.id === it)?.label || it}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'nutrition_v7' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>🥩 Параметры питания V7</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>Эти параметры используются V7 риск-движком для расчёта рисков. Укажите ваши реальные значения для точных расчётов.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Белок, г/кг</label>
                <input style={s.input} type="number" step="0.1" min="0.5" max="4" value={s_.proteinPerKg ?? 1.8} onChange={e => save({ proteinPerKg: e.target.value ? +e.target.value : undefined })} placeholder="1.8" />
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рекомендация: 1.6–2.2 г/кг</div>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Клетчатка, г/день</label>
                <input style={s.input} type="number" step="1" min="10" max="60" value={s_.fiberG ?? 25} onChange={e => save({ fiberG: e.target.value ? +e.target.value : undefined })} placeholder="25" />
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рекомендация: 25–35 г/день</div>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Омега-3, г/день</label>
                <input style={s.input} type="number" step="0.1" min="0" max="5" value={s_.omega3G ?? 1.5} onChange={e => save({ omega3G: e.target.value ? +e.target.value : undefined })} placeholder="1.5" />
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рекомендация: 1.5–3 г EPA+DHA</div>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Натрий, г/день</label>
                <input style={s.input} type="number" step="0.1" min="0.5" max="8" value={s_.sodiumG ?? 3.5} onChange={e => save({ sodiumG: e.target.value ? +e.target.value : undefined })} placeholder="3.5" />
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Норма: 2.3–4 г/день</div>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Калий, г/день</label>
                <input style={s.input} type="number" step="0.1" min="1" max="6" value={s_.potassiumG ?? 3.0} onChange={e => save({ potassiumG: e.target.value ? +e.target.value : undefined })} placeholder="3.0" />
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Норма: 2.6–3.4 г/день</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>🍷 Образ жизни (V7)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Алкоголь, доз/неделю</label>
                <input style={s.input} type="number" step="1" min="0" max="30" value={s_.alcoholPerWeek ?? 0} onChange={e => save({ alcoholPerWeek: e.target.value ? +e.target.value : undefined })} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Уровень стресса (1-10)</label>
                <input style={s.input} type="number" step="1" min="1" max="10" value={s_.stressLevel ?? 5} onChange={e => save({ stressLevel: e.target.value ? +e.target.value : undefined })} placeholder="5" />
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Уровень активности (1-10)</label>
                <input style={s.input} type="number" step="1" min="1" max="10" value={s_.activityLevel ?? 5} onChange={e => save({ activityLevel: e.target.value ? +e.target.value : undefined })} placeholder="5" />
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Сон, часов/ночь</label>
                <input style={s.input} type="number" step="0.5" min="3" max="12" value={s_.sleepHours ?? s_.baselineSleepHours ?? 7} onChange={e => save({ sleepHours: e.target.value ? +e.target.value : undefined })} placeholder="7" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, opacity: 0.7 }}>Курение</label>
              <button onClick={() => save({ smoke: !s_.smoke })} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                background: s_.smoke ? 'rgba(239,68,68,0.15)' : 'rgba(0,230,138,0.1)',
                border: s_.smoke ? '1px solid #ef4444' : '1px solid #00e68a',
                color: s_.smoke ? '#ef4444' : '#00e68a', fontWeight: 600,
              }}>
                {s_.smoke ? '' : '✅ Не курю'}
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>🏋️ Тренировочные параметры (V7)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Включает HIIT</label>
                <button onClick={() => save({ hasHIIT: !s_.hasHIIT })} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: s_.hasHIIT ? 'rgba(0,230,138,0.15)' : 'var(--bg-primary)',
                  border: s_.hasHIIT ? '1px solid #00e68a' : '1px solid var(--border)',
                  color: s_.hasHIIT ? '#00e68a' : 'var(--text-dim)', fontWeight: 600,
                }}>
                  {s_.hasHIIT ? '✅ Да' : '❌ Нет'}
                </button>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Объём, тонн/нед</label>
                <input style={s.input} type="number" step="500" min="0" max="30000" value={s_.volumeTonnes ?? 8000} onChange={e => save({ volumeTonnes: e.target.value ? +e.target.value : undefined })} placeholder="8000" />
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>LISS, мин/неделю</label>
                <input style={s.input} type="number" step="10" min="0" max="300" value={s_.lissMinutesPerWeek ?? 90} onChange={e => save({ lissMinutesPerWeek: e.target.value ? +e.target.value : undefined })} placeholder="90" />
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 4 }}>Завершённых курсов ААС</label>
                <input style={s.input} type="number" step="1" min="0" max="50" value={s_.totalCycles ?? 0} onChange={e => save({ totalCycles: e.target.value ? +e.target.value : undefined })} placeholder="0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'genetics' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>🧬 Генетические полиморфизмы</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>Укажите ваши генетические варианты, если известны. Они влияют на расчёт рисков в V7 движке через генетические множители.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                { key: 'COMT', label: 'COMT', desc: '', options: ['Met/Met', 'Val/Met', 'Val/Val'] },
                { key: 'MTHFR', label: 'MTHFR', desc: '', options: ['C677T/C677T', 'C677T/A1298C', 'A1298C/A1298C', 'C677T/+', 'A1298C/+', '+/+' ] },
                { key: 'ESR1', label: 'ESR1', desc: '', options: ['PvuII TT', 'PvuII TC', 'PvuII CC'] },
                { key: 'AGTR1', label: 'AGTR1', desc: '', options: ['1166CC', '1166AC', '1166AA'] },
                { key: 'NOS3', label: 'NOS3', desc: '', options: ['Glu298Glu', 'Glu298Asp', 'Asp298Asp'] },
                { key: 'SRD5A2', label: 'SRD5A2', desc: '5α-редуктаза. Влияет на конверсию тестостерона → DHT.', options: ['V89L V/V', 'V89L V/L', 'V89L L/L'] },
                { key: 'CYP3A4', label: 'CYP3A4', desc: '', options: ['*1/*1 (WT)', '*1/*22', '*22/*22'] },
              ] as const).map(gene => (
                <div key={gene.key} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{gene.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>{gene.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button onClick={() => { const g = {...(s_.genetics ?? {})}; delete g[gene.key]; save({ genetics: g }); }} style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      background: !(s_.genetics ?? {})[gene.key] ? 'rgba(0,230,138,0.1)' : 'var(--bg-primary)',
                      border: !(s_.genetics ?? {})[gene.key] ? '1px solid #00e68a' : '1px solid var(--border)',
                      color: !(s_.genetics ?? {})[gene.key] ? '#00e68a' : 'var(--text-dim)', fontWeight: 500,
                    }}>Не знаю</button>
                    {gene.options.map(opt => (
                      <button key={opt} onClick={() => { const g = {...(s_.genetics ?? {})}; g[gene.key] = opt; save({ genetics: g }); }} style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                        background: (s_.genetics ?? {})[gene.key] === opt ? 'rgba(0,230,138,0.15)' : 'var(--bg-primary)',
                        border: (s_.genetics ?? {})[gene.key] === opt ? '1px solid #00e68a' : '1px solid var(--border)',
                        color: (s_.genetics ?? {})[gene.key] === opt ? '#00e68a' : 'var(--text-dim)', fontWeight: 500,
                      }}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'injuries' && (
        <>
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Травмы</h4>
              <button style={s.btnActive} onClick={addInjury}>+ Добавить</button>
            </div>
          </div>
          {(s_.injuries ?? []).map(inj => (
            <div key={inj.id} style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>{inj.location} — {INJURY_TYPES.find(t => t.id === inj.type)?.label ?? inj.type}</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={s.btn} onClick={() => setEditInjury(inj)}>Ред.</button>
                  <button style={s.delBtn} onClick={() => deleteInjury(inj.id)}>Удалить</button>
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Боль: {inj.painLevel}/10 | Ограничение: {MOVEMENT_LIMITS.find(m => m.id === inj.movementLimit)?.label} | Сторона: {inj.side === 'left' ? '' : inj.side === 'right' ? '' : ''} | {inj.chronic ? '' : ''}
              </div>
              {inj.notes && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{inj.notes}</div>}
            </div>
          ))}
          {editInjury && (
            <div style={{ ...s.card, border: '1px solid #00e68a' }}>
              <h4 style={{ margin: '0 0 8px' }}>{editInjury.id && (s_.injuries ?? []).find(i => i.id === editInjury.id) ? '' : ''}</h4>
              <div>
                <span style={s.label}>Тип</span>
                <div style={s.btnGroup}>{INJURY_TYPES.map(t => <button key={t.id} style={editInjury.type === t.id ? s.btnActive : s.btn} onClick={() => setEditInjury({ ...editInjury, type: t.id })}>{t.label}</button>)}</div>
              </div>
              <div>
                <span style={s.label}>Локализация</span>
                <select style={s.input} value={editInjury.location} onChange={e => setEditInjury({ ...editInjury, location: e.target.value })}>
                  {INJURY_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <span style={s.label}>Боль: {editInjury.painLevel}/10</span>
                <input style={s.slider} type="range" min="1" max="10" value={editInjury.painLevel} onChange={e => setEditInjury({ ...editInjury, painLevel: +e.target.value })} />
              </div>
              <div>
                <span style={s.label}>Ограничение движений</span>
                <div style={s.btnGroup}>{MOVEMENT_LIMITS.map(m => <button key={m.id} style={editInjury.movementLimit === m.id ? s.btnActive : s.btn} onClick={() => setEditInjury({ ...editInjury, movementLimit: m.id })}>{m.label}</button>)}</div>
              </div>
              <div>
                <span style={s.label}>Сторона</span>
                <div style={s.btnGroup}>
                  {[{ id: 'left', label: 'Левая' }, { id: 'right', label: 'Правая' }, { id: 'both', label: 'Обе' }].map(x => <button key={x.id} style={editInjury.side === x.id ? s.btnActive : s.btn} onClick={() => setEditInjury({ ...editInjury, side: x.id as any })}>{x.label}</button>)}
                </div>
              </div>
              <div style={s.row}>
                <div><span style={s.label}>Дата</span><input style={s.input} type="date" value={editInjury.date ?? ''} onChange={e => setEditInjury({ ...editInjury, date: e.target.value })} /></div>
                <div><span style={s.label}>Хроническая</span>
                  <div style={s.btnGroup}>
                    <button style={editInjury.chronic ? s.btnActive : s.btn} onClick={() => setEditInjury({ ...editInjury, chronic: true })}>Да</button>
                    <button style={!editInjury.chronic ? s.btnActive : s.btn} onClick={() => setEditInjury({ ...editInjury, chronic: false })}>Нет</button>
                  </div>
                </div>
              </div>
              <div><span style={s.label}>Заметки</span><textarea style={{ ...s.input, minHeight: 50 }} value={editInjury.notes ?? ''} onChange={e => setEditInjury({ ...editInjury, notes: e.target.value })} /></div>
              <button style={s.saveBtn} onClick={() => saveInjury(editInjury)}>Сохранить</button>
              <button style={{ ...s.btn, width: '100%', marginTop: 4 }} onClick={() => setEditInjury(null)}>Отмена</button>
            </div>
          )}
        </>
      )}

      {tab === 'progress' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px' }}>Прогресс к цели</h4>
          <div style={s.row}>
            <div><span style={s.label}>Текущий вес</span><div style={{ fontSize: 20, fontWeight: 700 }}>{s_.weight} кг</div></div>
            <div><span style={s.label}>Целевой вес</span><input style={s.input} type="number" value={s_.targetWeight ?? ''} onChange={e => save({ targetWeight: e.target.value ? +e.target.value : undefined })} placeholder="" /></div>
          </div>
          {s_.targetWeight && (
            <div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', margin: '8px 0' }}>
                <div style={{ height: '100%', borderRadius: 4, background: '#00e68a', width: `${Math.min(100, Math.max(0, Math.round((1 - Math.abs(s_.weight - s_.targetWeight) / Math.max(1, Math.abs(s_.targetWeight)))) * 100))}%` }} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>{Math.round((1 - Math.abs(s_.weight - s_.targetWeight) / Math.max(1, Math.abs(s_.targetWeight))) * 100)}% к цели</div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <span style={s.label}>Целевой % жира</span>
            <input style={s.input} type="number" step="0.1" value={s_.targetBodyFat ?? ''} onChange={e => save({ targetBodyFat: e.target.value ? +e.target.value : undefined })} placeholder="" />
          </div>
          {labIndices && labIndexText && (
            <div style={{ marginTop: 12 }}>
              <h5>Индексы лабораторий</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['inflammation', 'metabolism', 'thyroid', 'lipids'] as const).map(k => {
                  const val = labIndices[k];
                  const hasData = val > 0 || (() => {
                    const neededCodes: Record<string, string[]> = { inflammation: ['CRP','FERRITIN'], metabolism: ['GLU','GLUCOSE','HbA1c','HBA1C'], thyroid: ['TSH','FT4','FT3'], lipids: ['LDL','HDL','TG'] };
                    return (neededCodes[k] || []).some(c => labs.some(l => l.code.toUpperCase() === c));
                  })();
                  return (
                    <div key={k} style={s.computed}>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{k === 'inflammation' ? '' : k === 'metabolism' ? '' : k === 'thyroid' ? '' : ''}</div>
                      <div style={{ fontWeight: 600 }}>{hasData ? `${(val * 100).toFixed(0)}%` : '—'}</div>
                      <div style={{ fontSize: 10, opacity: 0.5 }}>{hasData ? labIndexText[k] : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && <ReportsScreen />}
        </div>
      </div>
      )}
    </div>
  );
};
