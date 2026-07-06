import React, { useEffect, useState } from 'react';
import type { UserProfile, LabPoint, WorkoutLog } from '../../core/types';
import { updateProfile, useProfileRefresh } from '../../core/profile-manager';
import { saveContraindications } from '../../core/contraindications';
import { db } from '../../core/db';
import { syncAllProfiles } from '../../engines/profile-store';
import { BioStackAISettings } from '../components/BioStackAIProfile';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

import { ProfileBioSection } from './ProfileScreen_parts/ProfileBioSection';
import { ProfileBodySection } from './ProfileScreen_parts/ProfileBodySection';
import { ProfileLifestyleSection } from './ProfileScreen_parts/ProfileLifestyleSection';
import { ProfileDietSection } from './ProfileScreen_parts/ProfileDietSection';
import { ProfileGeneticsSection } from './ProfileScreen_parts/ProfileGeneticsSection';
import { ProfileHealthSection } from './ProfileScreen_parts/ProfileHealthSection';
import { ProfileInjuriesSection } from './ProfileScreen_parts/ProfileInjuriesSection';
import { ProfileDiariesSection } from './ProfileScreen_parts/ProfileDiariesSection';
import { ProfileAnalyticsSection } from './ProfileScreen_parts/ProfileAnalyticsSection';
import { ProfileContactsSection } from './ProfileScreen_parts/ProfileContactsSection';
import { theme } from './ProfileScreen_parts/ProfileComponents';

type ProfileTab = 'overview' | 'anthropometry' | 'sleep' | 'lifestyle' | 'diet' | 'health' | 'genetics' | 'injuries' | 'diaries' | 'biostack_profile' | 'progress' | 'analytics' | 'contacts' | 'measurements';
type ProfilePage = 'hero' | 'tabs';
type MainTab = 'info' | 'analytics' | 'contacts';

const WEIGHT_LOG_KEY = 'he_weight_log';
interface WeightEntry { date: string; weight: number; }
function getWeightLog(): WeightEntry[] { try { return JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]'); } catch { return []; } }
function saveWeightLog(log: WeightEntry[]) { localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(log.slice(-90))); }

export const ProfileScreen: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [page, setPage] = useState<ProfilePage>('hero');
  const [mainTab, setMainTab] = useState<MainTab>('info');
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(getWeightLog);
  const [foodDiaryAvg, setFoodDiaryAvg] = useState<{avgKcal:number;avgProtein:number;avgFat:number;avgCarbs:number} | null>(null);
  const [calcData, setCalcData] = React.useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('he_autocalc_state') || '{}'); } catch { return {}; }
  });

  const settings = profile.settings;

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
    syncAllProfiles({ ...settings, ...partial });
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
  const infoSubTabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Обзор' }, { id: 'anthropometry', label: 'Тело' },
    { id: 'lifestyle', label: 'Образ жизни' }, { id: 'health', label: '🏥 Здоровье' },
    { id: 'diet', label: 'Питание' }, { id: 'genetics', label: 'Генетика' },
    { id: 'injuries', label: 'Травмы' }, { id: 'diaries', label: '📓 Дневники' },
    { id: 'biostack_profile', label: '🧬 BioStack' },
  ];

  useEffect(() => {
    if (settings) saveContraindications({
      chronicConditions: settings.chronicConditions || [],
      foodAllergies: settings.foodAllergies || [], foodIntolerances: settings.foodIntolerances || [],
      excludedFoods: settings.excludedFoods || [], allergyNotes: settings.allergyNotes || '',
    });
  }, [settings.chronicConditions, settings.foodAllergies, settings.foodIntolerances, settings.excludedFoods, settings.allergyNotes]);

  useEffect(() => {
    const load = async () => {
      try { setLabs(await db.getAll<LabPoint>('labs_log')); } catch {}
      try {
        const wLogs = await db.getAll<WorkoutLog>('workout_log');
        setWorkoutLogs((wLogs || []).sort((a, b) => b.date.localeCompare(a.date)));
      } catch {}
      try {
        const diaryEntries = await db.getAll<any>('food_diary');
        if (diaryEntries.length > 0) {
          const last7 = diaryEntries.filter((d: any) => d.date >= new Date(Date.now() - 7*86400000).toISOString().slice(0, 10));
          const sample = last7.length > 0 ? last7 : diaryEntries.slice(-7);
          const n = sample.length;
          setFoodDiaryAvg({
            avgKcal: Math.round(sample.reduce((s: number, d: any) => s + (d.kcal || 0), 0) / n),
            avgProtein: Math.round(sample.reduce((s: number, d: any) => s + (d.protein || 0), 0) / n),
            avgFat: Math.round(sample.reduce((s: number, d: any) => s + (d.fat || 0), 0) / n),
            avgCarbs: Math.round(sample.reduce((s: number, d: any) => s + (d.carbs || 0), 0) / n),
          });
        }
      } catch {}
    };
    load();
  }, []);

  const initials = (profile.name || 'П').charAt(0).toUpperCase();

  return (
    <div className="screen profile">
      {page === 'hero' ? (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/profile-hero.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background: theme.gradientGreen, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#000', border:'2px solid rgba(255,255,255,0.15)', boxShadow:'0 4px 20px rgba(0,230,138,0.3)' }}>
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
                { id: 'info', icon: '📋', title: 'Сведения о пользователе', desc: 'Персональные данные, образ жизни, питание, генетика, травмы, дневники', color: '#00e68a' },
                { id: 'analytics', icon: '📊', title: 'Аналитика', desc: 'Отчёты по всем модулям, графики прогресса, архив отчётов', color: '#3b82f6' },
                { id: 'contacts', icon: '📞', title: 'Контакты и друзья', desc: 'Список друзей, шаринг, поддержка и контакты', color: '#8b5cf6' },
              ].map(card => (
                <button key={card.id} onClick={() => { setPage('tabs'); setTab(card.id === 'info' ? 'overview' : card.id as ProfileTab); }}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%', background:'var(--glass-bg)', border:'1px solid var(--glass-border)', color:'var(--text)', transition:'all 0.2s' }}>
                  <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: card.color + '18', fontSize:20 }}>{card.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2, color: card.color }}>{card.title}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>{card.desc}</div>
                  </div>
                  <span style={{ color: card.color, fontSize:16, opacity:0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position:'relative', minHeight:'100vh' }}>
          <div style={{ position:'relative', zIndex:1, padding:'10px 12px 80px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0, marginBottom:8 }}>
              <button onClick={() => setPage('hero')}
                style={{ padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.9)' }}>
                ← На главную</button>
            </div>

            {/* Main tabs */}
            <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:6, paddingBottom:2 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => { setMainTab(t.id); if (t.id === 'analytics') setTab('analytics'); if (t.id === 'contacts') setTab('contacts'); if (t.id === 'info' && mainTab !== 'info') setTab('overview'); }}
                  style={{ padding:'8px 18px', borderRadius:22, fontSize:12, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background: mainTab === t.id ? 'rgba(0,230,138,0.12)' : 'rgba(24,24,27,0.12)', border: mainTab === t.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.04)', color: mainTab === t.id ? '#00e68a' : 'rgba(255,255,255,0.9)', transition:'all 0.2s' }}>
                  {t.label}</button>
              ))}
            </div>

            {/* Info sub-tabs */}
            {mainTab === 'info' && (
              <div style={{ display:'flex', gap:3, overflowX:'auto', scrollbarWidth:'none', marginBottom:10, paddingBottom:2 }}>
                {infoSubTabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ padding:'5px 12px', borderRadius:18, fontSize:10, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, background: tab === t.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border: tab === t.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)', color: tab === t.id ? '#00e68a' : 'rgba(255,255,255,0.6)', transition:'all 0.2s' }}>
                    {t.label}</button>
                ))}
              </div>
            )}

            {/* ═══ RENDER SECTIONS ═══ */}
            {mainTab === 'info' && (<>
              {tab === 'overview' && (
                <InfoErrorBoundary label="Сведения о пользователе">
                  <ProfileBioSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} />
                </InfoErrorBoundary>
              )}
              {tab === 'anthropometry' && (
                <InfoErrorBoundary label="Замеры">
                  <ProfileBodySection settings={settings} save={save} />
                </InfoErrorBoundary>
              )}
              {tab === 'lifestyle' && (
                <InfoErrorBoundary label="Образ жизни">
                  <ProfileLifestyleSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} toggleWeakPoint={toggleWeakPoint} />
                </InfoErrorBoundary>
              )}
              {tab === 'health' && (
                <InfoErrorBoundary label="Здоровье">
                  <ProfileHealthSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} onNavigate={onNavigate} />
                </InfoErrorBoundary>
              )}
              {tab === 'diet' && (
                <InfoErrorBoundary label="Питание">
                  <ProfileDietSection settings={settings} save={save} />
                </InfoErrorBoundary>
              )}
              {tab === 'genetics' && (
                <InfoErrorBoundary label="Генетика">
                  <ProfileGeneticsSection settings={settings} save={save} />
                </InfoErrorBoundary>
              )}
              {tab === 'injuries' && (
                <InfoErrorBoundary label="Травмы">
                  <ProfileInjuriesSection settings={settings} save={save} />
                </InfoErrorBoundary>
              )}
              {tab === 'diaries' && (
                <InfoErrorBoundary label="Дневники">
                  <ProfileDiariesSection settings={settings} save={save} labs={labs} workoutLogs={workoutLogs} onNavigate={onNavigate} />
                </InfoErrorBoundary>
              )}
              {tab === 'biostack_profile' && (
                <InfoErrorBoundary label="BioStack">
                  <BioStackAISettings />
                </InfoErrorBoundary>
              )}
            </>)}

            {mainTab === 'analytics' && (
              <InfoErrorBoundary label="Аналитика">
                <ProfileAnalyticsSection settings={settings} save={save} labs={labs} workoutLogs={workoutLogs} foodDiaryAvg={foodDiaryAvg} profileName={profile.name} onNavigate={onNavigate} />
              </InfoErrorBoundary>
            )}

            {mainTab === 'contacts' && (
              <InfoErrorBoundary label="Контакты">
                <ProfileContactsSection settings={settings} profileName={profile.name} onNavigate={onNavigate} />
              </InfoErrorBoundary>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
