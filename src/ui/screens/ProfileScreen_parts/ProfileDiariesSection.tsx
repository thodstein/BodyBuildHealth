import React from 'react';
import type { UserProfile, LabPoint, WorkoutLog } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle } from './ProfileComponents';
import { SleepDiaryTab } from './SleepDiaryTab';
import { BPDiaryTab } from '../../components/BPDiaryTab';
import { LabDiaryTab } from '../LabsScreen_parts/LabDiaryTab';
import { ProfileMeasurementsTab } from './ProfileMeasurementsTab';
import { ProfileInjuriesSection } from './ProfileInjuriesSection';
import { InjectionDiaryTab } from './InjectionDiaryTab';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
  labs: LabPoint[];
  workoutLogs: WorkoutLog[];
  onNavigate?: (screen: string) => void;
}

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

export const ProfileDiariesSection: React.FC<Props> = ({ settings, save, labs, workoutLogs, onNavigate }) => {
  const [diarySubTab, setDiarySubTab] = React.useState<string>('sleep');

  const externalDiaries = [
    { id:'nutrition', icon:'🍽️', title:'Питание', desc:'Дневник приёмов', color:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.15)' },
    { id:'training', icon:'🏋️', title:'Тренировки', desc:'Дневник, прогресс', color:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.15)' },
    { id:'pharma', icon:'💉', title:'Фарма / Курс', desc:'Препараты, цикл', color:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.15)' },
    { id:'support', icon:'🧪', title:'Поддержка', desc:'БАДы, симптомы', color:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.15)' },
    { id:'lab_diary_nav', icon:'📊', title:'Дневник анализов', desc:'Динамика, графики', color:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.15)' },
    { id:'risks', icon:'🩺', title:'Риски', desc:'Оценка здоровья', color:'rgba(244,67,54,0.08)', border:'rgba(244,67,54,0.15)' },
  ];

  const handleExternalNav = (id: string) => {
    if (id === 'lab_diary_nav') { setDiarySubTab('lab_diary'); return; }
    const storageKey = id === 'nutrition' ? 'he_nav_nutrition_diary' : id === 'training' ? 'he_nav_training_diary' : '';
    if (storageKey) { try { localStorage.setItem(storageKey, '1'); } catch {} }
    onNavigate?.(id);
  };

  const internalTabs = [
    { id:'sleep', label:'🛌 Сон' },
    { id:'bp', label:'🫀 Давление' },
    { id:'injections', label:'💉 Инъекции' },
    { id:'measurements', label:'📏 Замеры' },
    { id:'progress', label:'📈 Прогресс' },
    { id:'injuries', label:'🩼 Травмы' },
    { id:'lab_diary', label:'📊 Анализы' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>📓 Дневники</div>
        <p style={{ fontSize:10, color: theme.textDim, margin:'4px 0 10px' }}>
          Все дневники приложения в одном месте. Выберите тип дневника ниже, чтобы добавить или просмотреть записи.
        </p>
      </div>

      {/* External diaries navigation */}
      <div style={glassCardStyle}>
        <div style={{ fontSize:10, fontWeight:700, color: theme.textDim, marginBottom:8 }}>🧭 Перейти к дневнику</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {externalDiaries.map(d => (
            <button key={d.id} onClick={() => handleExternalNav(d.id)}
              style={{ ...diaryCardBase, background: d.color, border: `1px solid ${d.border}` }}>
              <div style={diaryIconWrap}>{d.icon}</div>
              <div style={{ fontSize:11, fontWeight:700, color: theme.textPrimary, lineHeight:1.2 }}>{d.title}</div>
              <div style={{ fontSize:9, color: theme.textDim, lineHeight:1.2 }}>{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Internal diary sub-tabs */}
      <div style={{ display:'flex', gap:3, marginBottom:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {internalTabs.map(d => (
          <button key={d.id} onClick={() => setDiarySubTab(d.id)}
            style={{
              padding:'6px 14px', borderRadius:18, fontSize:10, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
              background: diarySubTab === d.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
              border: diarySubTab === d.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: diarySubTab === d.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
            }}>{d.label}</button>
        ))}
      </div>

      {/* Sleep diary */}
      {diarySubTab === 'sleep' && <SleepDiaryTab settings={settings} save={save as (p: any) => void} />}

      {/* BP diary */}
      {diarySubTab === 'bp' && <BPDiaryTab />}

      {/* Injection diary */}
      {diarySubTab === 'injections' && <InjectionDiaryTab />}

      {/* Measurements diary */}
      {diarySubTab === 'measurements' && <ProfileMeasurementsTab />}

      {/* Progress diary */}
      {diarySubTab === 'progress' && <ProgressDiaryContent settings={settings} save={save} workoutLogs={workoutLogs} />}

      {/* Injuries diary */}
      {diarySubTab === 'injuries' && (
        <div style={{ marginTop: 8 }}>
          <ProfileInjuriesSection settings={settings} save={save} />
        </div>
      )}

      {/* Lab diary */}
      {diarySubTab === 'lab_diary' && (
        <div style={{ marginTop: 8 }}>
          <LabDiaryTab labs={labs} />
        </div>
      )}
    </div>
  );
};

/* ── Progress Diary (inline sub-component) ── */
interface ProgressProps {
  settings: UserProfile['settings'];
  save: (p: Partial<UserProfile['settings']>) => void;
  workoutLogs: WorkoutLog[];
}
const ProgressDiaryContent: React.FC<ProgressProps> = ({ settings, save }) => {
  const weightLog = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]'); } catch { return []; }
  }, [settings.weight]);

  const lbmVal = settings.weight && settings.bodyFat ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : null;
  const ffmiVal = lbmVal && settings.height
    ? (parseFloat(lbmVal) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmiVal
    ? (parseFloat(ffmiVal) < 18 ? 'Ниже среднего' : parseFloat(ffmiVal) < 20 ? 'Средний' : parseFloat(ffmiVal) < 22 ? 'Хорошо' : parseFloat(ffmiVal) < 25 ? 'Отлично' : parseFloat(ffmiVal) < 28 ? 'Исключительно' : 'Подозрение') : '';

  return (
    <div>
      {/* Weight progress */}
      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>Прогресс веса</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <span style={{ fontSize:10, color: theme.textDim }}>Текущий вес</span>
            <div style={{ fontSize:24, fontWeight:800, color: theme.accent }}>{settings.weight} <span style={{ fontSize:12, fontWeight:400, color: theme.textDim }}>кг</span></div>
          </div>
          <div>
            <span style={{ fontSize:10, color: theme.textDim }}>Целевой вес</span>
            <input type="number" value={settings.targetWeight || ''}
              onChange={e => save({ targetWeight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
              placeholder="75"
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
        </div>
        {settings.targetWeight && settings.weight && (
          <div>
            <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', borderRadius:3, background: theme.gradientGreen,
                width: `${Math.min(100, Math.max(0, Math.round((1 - Math.abs(settings.weight - settings.targetWeight) / Math.max(1, Math.abs(settings.targetWeight))) * 100)))}%`,
                transition: 'width 0.5s', }} />
            </div>
            <div style={{ fontSize:11, color: theme.textSecondary, textAlign:'center' }}>
              {Math.round((1 - Math.abs(settings.weight - settings.targetWeight) / Math.max(1, Math.abs(settings.targetWeight))) * 100)}% к цели
            </div>
          </div>
        )}
      </div>

      {/* Weight chart */}
      {weightLog.length > 2 && (
        <div style={glassCardStyle}>
          <div style={sectionLabelStyle}>График веса</div>
          <div style={{ position:'relative', height:120, marginTop:8 }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${weightLog.length - 1} 100`} preserveAspectRatio="none" style={{ position:'absolute', inset:0 }}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e68a" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00e68a" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {(() => {
                const minW = Math.min(...weightLog.map((w: any) => w.weight)) - 1;
                const maxW = Math.max(...weightLog.map((w: any) => w.weight)) + 1;
                const range = maxW - minW || 1;
                const pts = weightLog.map((e: any, i: number) =>
                  `${i * (100 / (weightLog.length - 1))},${100 - ((e.weight - minW) / range) * 100}`).join(' ');
                return <><polygon points={`0,100 ${pts} ${weightLog.length - 1},100`} fill="url(#wGrad)" />
                  <polyline points={pts} fill="none" stroke="#00e68a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>;
              })()}
            </svg>
            <div style={{ display:'flex', justifyContent:'space-between', position:'absolute', bottom:0, width:'100%', fontSize:8, color: theme.textDim, paddingTop:4 }}>
              <span>{weightLog[0]?.date?.slice(5)}</span>
              <span>{weightLog[weightLog.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color: theme.textDim, marginTop:4 }}>
            <span>Мин: {Math.min(...weightLog.map((w: any) => w.weight)).toFixed(1)} кг</span>
            <span style={{ color: theme.accent, fontWeight:600 }}>Тек: {weightLog[weightLog.length - 1]?.weight?.toFixed(1)} кг</span>
            <span>Макс: {Math.max(...weightLog.map((w: any) => w.weight)).toFixed(1)} кг</span>
          </div>
          {(() => {
            const firstW = weightLog[0]?.weight;
            const lastW = weightLog[weightLog.length - 1]?.weight;
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

      {/* Girth measurements */}
      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>Обхваты</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { k:'waistCm', l:'Талия', unit:'см' }, { k:'chestCm', l:'Грудь', unit:'см' },
            { k:'bicepCm', l:'Бицепс', unit:'см' }, { k:'thighCm', l:'Бедро', unit:'см' },
            { k:'hipCm', l:'Бёдра', unit:'см' }, { k:'neckCm', l:'Шея', unit:'см' },
          ].map(m => {
            const val = (settings as any)[m.k];
            return (
              <div key={m.k} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 8px', textAlign:'center', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize:9, color: theme.textDim, marginBottom:2 }}>{m.l}</div>
                <div style={{ fontSize:16, fontWeight:700, color: val ? theme.textPrimary : theme.textSecondary }}>{val ? `${val}` : '—'}<span style={{ fontSize:9, fontWeight:400, marginLeft:2, color: theme.textDim }}>{val ? m.unit : ''}</span></div>
              </div>
            );
          })}
        </div>
        <button onClick={() => {
          const MEASUREMENTS_LOG_KEY = 'he_measurements_log';
          const entry = {
            date: new Date().toISOString().split('T')[0],
            waistCm: settings.waistCm || 0, chestCm: settings.chestCm || 0,
            hipCm: settings.hipCm || 0, bicepCm: settings.bicepCm || 0,
            thighCm: settings.thighCm || 0, neckCm: settings.neckCm || 0,
            forearmCm: settings.forearmCm || 0, bodyFat: settings.bodyFat || 0,
          };
          try {
            const log = JSON.parse(localStorage.getItem(MEASUREMENTS_LOG_KEY) || '[]');
            log.push(entry);
            localStorage.setItem(MEASUREMENTS_LOG_KEY, JSON.stringify(log.slice(-30)));
          } catch {}
        }} style={{ padding:'5px 12px', borderRadius:16, fontSize:10, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', marginTop:10, width:'100%' }}>Сохранить текущие замеры</button>
      </div>

      {/* FFMI analysis */}
      {ffmiVal && (
        <div style={glassCardStyle}>
          <div style={sectionLabelStyle}>FFMI анализ</div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color: theme.textDim, marginBottom:2 }}>Текущий FFMI</div>
              <div style={{ fontSize:22, fontWeight:800, color: '#8b5cf6' }}>{ffmiVal}</div>
              <div style={{ fontSize:10, color: theme.textSecondary, marginTop:2 }}>{ffmiCategory}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color: theme.textDim, marginBottom:2 }}>LBM</div>
              <div style={{ fontSize:22, fontWeight:800, color: '#3b82f6' }}>{lbmVal || '—'}<span style={{ fontSize:11, fontWeight:400 }}> кг</span></div>
              <div style={{ fontSize:10, color: theme.textSecondary, marginTop:2 }}>Сухая масса</div>
            </div>
          </div>
          <div style={{ marginTop:10, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color: theme.textDim, marginBottom:4 }}>Шкала FFMI</div>
            <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', position:'relative', overflow:'visible' }}>
              {[
                { pos:0, color:'#f97316', label:'<18' }, { pos:25, color:'#f59e0b', label:'18-20' },
                { pos:50, color:'#3b82f6', label:'20-22' }, { pos:75, color:'#00e68a', label:'22-25' },
                { pos:95, color:'#ef4444', label:'25+' },
              ].map(s => (
                <div key={s.pos} style={{ position:'absolute', left:`${s.pos}%`, top:0, width:3, height:4, borderRadius:1, background:s.color }} />
              ))}
              {ffmiVal && parseFloat(ffmiVal) > 0 && (
                <div style={{
                  position:'absolute',
                  left:`${Math.min(98, Math.max(2, ((parseFloat(ffmiVal) - 15) / 15) * 100))}%`,
                  top:-5, width:12, height:12, borderRadius:'50%',
                  background: theme.gradientGreen, border:'2px solid rgba(0,0,0,0.3)',
                  boxShadow: '0 0 8px rgba(0,230,138,0.4)',
                }} />
              )}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color: theme.textDim, marginTop:2 }}>
              <span>15</span><span>18</span><span>20</span><span>22</span><span>25</span><span>30</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
