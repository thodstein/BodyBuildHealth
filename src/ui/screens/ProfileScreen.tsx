import React, { useEffect, useState } from 'react';
import type { UserProfile, LabPoint, WorkoutLog, UnifiedSettings } from '../../core/types';
import { getProfile, updateProfile, useProfileRefresh } from '../../core/profile-manager';
import { saveContraindications } from '../../core/contraindications';
import { db } from '../../core/db';
import { syncAllProfiles } from '../../engines/profile-store';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

import { ProfileBioSection } from './ProfileScreen_parts/ProfileBioSection';
import { ProfileBodySection } from './ProfileScreen_parts/ProfileBodySection';
import { ProfileLifestyleSection } from './ProfileScreen_parts/ProfileLifestyleSection';
import { ProfileDietSection } from './ProfileScreen_parts/ProfileDietSection';
import { ProfileHealthSection } from './ProfileScreen_parts/ProfileHealthSection';
import { ProfileTrainingSection } from './ProfileScreen_parts/ProfileTrainingSection';
import { ProfileDiariesSection } from './ProfileScreen_parts/ProfileDiariesSection';
import { ProfileAnalyticsSection } from './ProfileScreen_parts/ProfileAnalyticsSection';
import { ProfileContactsSection } from './ProfileScreen_parts/ProfileContactsSection';
import { ProfileDataHub } from './ProfileScreen_parts/ProfileDataHub';
import { DataBackupSection } from './ProfileScreen_parts/DataBackupSection';
import { theme, SectionTitle } from './ProfileScreen_parts/ProfileComponents';

type ProfileTab = 'overview' | 'lifestyle' | 'diet' | 'health' | 'training' | 'diaries' | 'data' | 'analytics' | 'contacts';
type ProfilePage = 'hero' | 'sections' | 'detail';

const WEIGHT_LOG_KEY = 'he_weight_log';
interface WeightEntry { date: string; weight: number; }
function getWeightLog(): WeightEntry[] { try { return JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]'); } catch { return []; } }
function saveWeightLog(log: WeightEntry[]) { localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(log.slice(-90))); }

/* ── Glass card styles for hero ── */
const glassCard: React.CSSProperties = {
  background: 'rgba(28,28,32,0.65)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)',
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.2,0.9,0.4,1)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '16px 18px',
  width: '100%',
  textAlign: 'left' as const,
  color: '#fff',
};
const glassCardHover = {
  transform: 'translateY(-2px)',
  boxShadow: '0 14px 40px rgba(0,0,0,0.45), inset 0 0.5px 0 rgba(255,255,255,0.10)',
};

/* ── Section config ── */
interface SectionDef {
  id: ProfileTab;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  wide?: boolean;
}
const SECTIONS: SectionDef[] = [
  { id: 'overview',   icon: '👤', title: 'Общие сведения',   subtitle: 'Персональные данные · Антропометрия · Композиция тела', color: '#00e68a' },
  { id: 'training',   icon: '🏋️', title: 'Тренировки',       subtitle: 'Цель, уровень, сплит, программа, стаж',              color: '#3b82f6' },
  { id: 'health',     icon: '🩺', title: 'Здоровье',         subtitle: 'Хроника, аллергии, генетика, риски',                   color: '#ef4444' },
  { id: 'diet',       icon: '🥗', title: 'Питание',          subtitle: 'Диета, аллергии, КБЖУ, привычки',                     color: '#22c55e' },
  { id: 'lifestyle',  icon: '🌿', title: 'Образ жизни',      subtitle: 'Сон, стресс, активность, вода',                       color: '#8b5cf6' },
  { id: 'diaries',    icon: '📓', title: 'Дневники',         subtitle: 'Все дневники: сон, давление, питание, тренировки',     color: '#f59e0b' },
  { id: 'analytics',  icon: '📊', title: 'Аналитика',        subtitle: 'Сводные отчёты · Отчёты по модулям · Архив',          color: '#ec4899' },
  { id: 'data',       icon: '🗂️', title: 'Мои данные',       subtitle: 'Агрегированные источники · Заполненность профиля',    color: '#14b8a6' },
  { id: 'contacts',   icon: '📞', title: 'Контакты и друзья',subtitle: 'Список друзей, шаринг, поддержка',                    color: '#6366f1' },
];

export const ProfileScreen: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const profile = useProfileRefresh();
  const [section, setSection] = useState<ProfileTab | null>(null);
  const [page, setPage] = useState<ProfilePage>('hero');
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(getWeightLog);
  const [foodDiaryAvg, setFoodDiaryAvg] = useState<{avgKcal:number;avgProtein:number;avgFat:number;avgCarbs:number} | null>(null);
  const [calcData, setCalcData] = React.useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('he_autocalc_state') || '{}'); } catch { return {}; }
  });

  const settings = profile.settings;
  const us = settings as UnifiedSettings;

  const upCalc = (k: string, v: any) => {
    const next = { ...calcData };
    const keys = k.split('.');
    let o = next; for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = v; setCalcData(next);
    try { localStorage.setItem('he_autocalc_state', JSON.stringify(next)); } catch {}
    const syncMap: Record<string, string> = {
      'neuro.sleepQuality': 'baselineSleepQuality',
      'psych.fearOfLoss': 'baselineStressLevel',
    };
    if (syncMap[k]) {
      const mappedVal = typeof v === 'object' ? (v as any).score || 1 : v;
      const numVal = typeof mappedVal === 'number' ? mappedVal : parseInt(String(mappedVal)) || 1;
      const cur = getProfile().settings || ({} as UserProfile['settings']);
      updateProfile({ settings: { ...cur, [syncMap[k]]: numVal } });
    }
  };

  const save = (partial: Record<string, any>) => {
    const curSettings = getProfile().settings || ({} as UnifiedSettings);
    if (partial.weight !== undefined && partial.weight !== (curSettings as any).personal?.weight) {
      const newEntry: WeightEntry = { date: new Date().toISOString().split('T')[0], weight: partial.weight };
      const updated = [...weightLog.filter(w => w.date !== newEntry.date), newEntry].sort((a, b) => a.date.localeCompare(b.date));
      setWeightLog(updated);
      saveWeightLog(updated);
    }
    const flatToNested: Record<string, string> = {
      age: 'personal.age', sex: 'personal.sex', weight: 'personal.weight',
      height: 'personal.height', bodyFat: 'personal.bodyFat',
      goal: 'training.primaryGoal', primaryGoal: 'training.primaryGoal',
      sportType: 'training.sportType', trainingExperience: 'training.experience',
      trainingLevel: 'training.level', workoutsPerWeek: 'training.daysPerWeek',
      avgWorkoutMinutes: 'training.minutesPerSession', weakPoints: 'training.weakPoints',
      phase: 'pharma.phase', courseStartDate: 'pharma.courseStartDate',
      pharmaExperience: 'pharma.experience', pharmaCoursesCount: 'pharma.totalCycles',
      monthsSinceLastCourse: 'pharma.monthsSinceLastCourse',
      trainingCycleGoal: 'pharma.trainingCycleType', cycleWeeks: 'pharma.trainingCycleWeeks',
      previousCycles: 'pharma.previousCycles',
      sleepHours: 'lifestyle.sleepHours', stressLevel: 'lifestyle.stressLevel',
      fatigueLevel: 'lifestyle.fatigueLevel', baselineSleepQuality: 'lifestyle.sleepQuality',
      baselineStressLevel: 'lifestyle.stressLevel',
      dailySteps: 'lifestyle.dailySteps', dailyWaterLiters: 'lifestyle.dailyWaterLiters',
      chronotype: 'lifestyle.chronotype', nightAwakenings: 'lifestyle.nightAwakenings',
      bedtime: 'lifestyle.bedtime', wakeTime: 'lifestyle.wakeTime',
      dietType: 'nutrition.dietType', mealsPerDay: 'nutrition.mealsPerDay',
      cookingSkill: 'nutrition.cookingSkill',
      foodAllergies: 'nutrition.foodAllergies', foodIntolerances: 'nutrition.foodIntolerances',
      excludedFoods: 'nutrition.excludedFoods', preferredFoods: 'nutrition.preferredFoods',
      proteinPerKg: 'nutrition.proteinPerKg', fiberG: 'nutrition.fiberG',
      omega3G: 'nutrition.omega3G', sodiumG: 'nutrition.sodiumG',
      potassiumG: 'nutrition.potassiumG', alcoholPerWeek: 'nutrition.alcoholPerWeek',
      currentSupplements: 'nutrition.currentSupplements', currentMedications: 'nutrition.currentMedications',
      chronicConditions: 'health.chronicConditions', genetics: 'health.genetics',
      injuries: 'health.injuries', contraindications: 'health.contraindications',
      drugAllergies: 'health.drugAllergies',
      excludedSupplements: 'health.excludedSupplements', excludedMeds: 'health.excludedMeds',
      allergyNotes: 'health.drugAllergies',
      baselineHrvRatio: 'lifestyle.baselineHrvRatio',
      hasHIIT: 'system.hasHIIT', volumeTonnes: 'system.volumeTonnes',
      lissMinutesPerWeek: 'system.lissMinutesPerWeek',
      targetWeight: 'system.targetWeight', targetBodyFat: 'system.targetBodyFat',
      preferredUnits: 'system.preferredUnits',
    };
    const nested: UnifiedSettings = JSON.parse(JSON.stringify(curSettings));
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined || v === null) continue;
      const path = flatToNested[k] || k;
      const parts = path.split('.');
      if (parts.length === 2) {
        (nested as any)[parts[0]][parts[1]] = v;
      } else if (parts.length === 3 && parts[0] === 'health' && parts[1] === 'contraindications') {
        (nested as any).health.contraindications[parts[2]] = v;
      } else {
        const section = parts[0] as keyof UnifiedSettings;
        if (typeof v === 'object' && !Array.isArray(v)) {
          (nested as any)[section] = { ...(nested as any)[section], ...v };
        } else {
          (nested as any)[section] = v;
        }
      }
    }
    updateProfile({ settings: nested });
    syncAllProfiles(nested);
  };

  const toggleWeakPoint = (id: string) => {
    const wp = us.training?.weakPoints ?? [];
    save({ weakPoints: wp.includes(id) ? wp.filter(x => x !== id) : [...wp, id] });
  };

  useEffect(() => {
    if (us) saveContraindications({
      chronicConditions: us.health?.chronicConditions || [],
      foodAllergies: us.nutrition?.foodAllergies || [], foodIntolerances: us.nutrition?.foodIntolerances || [],
      excludedFoods: us.nutrition?.excludedFoods || [], allergyNotes: us.health?.drugAllergies || '',
    });
  }, [us.health?.chronicConditions, us.nutrition?.foodAllergies, us.nutrition?.foodIntolerances, us.nutrition?.excludedFoods, us.health?.drugAllergies]);

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
  const ageStr = (us.personal as any)?.age ? `${(us.personal as any).age} лет` : '—';
  const weightStr = (us.personal as any)?.weight ? `${(us.personal as any).weight} кг` : '';

  /* ── Navigate to section detail ── */
  const openSection = (id: ProfileTab) => {
    setSection(id);
    setPage('detail');
  };
  const backToSections = () => {
    setSection(null);
    setPage('sections');
  };
  const backToHero = () => {
    setSection(null);
    setPage('hero');
  };

  /* ── Render section content ── */
  const renderSectionContent = (tab: ProfileTab) => (
    <InfoErrorBoundary label={SECTIONS.find(s => s.id === tab)?.title || ''}>
      {tab === 'overview' && (
        <>
          <ProfileBioSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} onNavigate={onNavigate} />
          <div style={{ marginTop: 6 }}>
            <ProfileBodySection settings={settings} save={save} />
          </div>
        </>
      )}
      {tab === 'lifestyle' && <ProfileLifestyleSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} toggleWeakPoint={toggleWeakPoint} />}
      {tab === 'health' && <ProfileHealthSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} onNavigate={onNavigate} />}
      {tab === 'diet' && <ProfileDietSection settings={settings} save={save} />}
      {tab === 'training' && <ProfileTrainingSection settings={settings} save={save} calcData={calcData} upCalc={upCalc} toggleWeakPoint={toggleWeakPoint} />}
      {tab === 'diaries' && <ProfileDiariesSection settings={settings} save={save} labs={labs} workoutLogs={workoutLogs} onNavigate={onNavigate} />}
       {tab === 'data' && (
         <>
           <ProfileDataHub
             settings={settings}
             labs={labs}
             workoutLogs={workoutLogs}
             foodDiaryAvg={foodDiaryAvg}
             onOpenProfileTab={(t: string) => openSection(t as ProfileTab)}
             onNavigate={onNavigate}
           />
           <DataBackupSection />
         </>
       )}
      {tab === 'analytics' && <ProfileAnalyticsSection settings={settings} save={save} labs={labs} workoutLogs={workoutLogs} foodDiaryAvg={foodDiaryAvg} profileName={profile.name} onNavigate={onNavigate} />}
      {tab === 'contacts' && <ProfileContactsSection settings={settings} profileName={profile.name} onNavigate={onNavigate} />}
    </InfoErrorBoundary>
  );

  /* ── Bottom quick-nav chips on detail page ── */
  const QuickNavChips: React.FC<{ current: ProfileTab }> = ({ current }) => (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
        Другие разделы
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {SECTIONS.filter(s => s.id !== current && s.id !== 'analytics' && s.id !== 'contacts').slice(0, 7).map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${s.color}22`, background: `${s.color}0d`, color: s.color,
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
            {s.icon} {s.title}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="screen profile">
      {/* ═══════════════ HERO PAGE ═══════════════ */}
      {page === 'hero' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <img src="/profile-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center top' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.92) 100%)' }} />

          <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px 16px 90px' }}>
            {/* Avatar + name */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #00e68a, #00b864)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, fontWeight: 800, color: '#000',
                  border: '2.5px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 8px 32px rgba(0,230,138,0.35)',
                }}>{initials}</div>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.4px', lineHeight: 1.1, textShadow: '0 2px 16px rgba(0,0,0,0.85)' }}>
                    {profile.name || 'Пользователь'}
                  </h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
                    {ageStr}{weightStr ? ` · ${weightStr}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Section grid: 3-column on wider screens, 2-column on mobile */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
                Разделы профиля
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* Primary sections — first 6 in grid */}
                {SECTIONS.filter(s => s.id !== 'analytics' && s.id !== 'contacts' && s.id !== 'data').map(s => (
                  <button key={s.id} onClick={() => openSection(s.id)}
                    style={{
                      ...glassCard, padding: '13px 14px', gap: 10, borderRadius: 16,
                      borderLeft: `3px solid ${s.color}`,
                    }}
                    onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, glassCardHover); }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = '';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)';
                    }}
                    onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{s.title}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Bottom row: analytics + data + contacts — wider cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                {SECTIONS.filter(s => s.id === 'analytics' || s.id === 'data' || s.id === 'contacts').map(s => (
                  <button key={s.id} onClick={() => openSection(s.id)}
                    style={{
                      ...glassCard, padding: '12px 6px', gap: 6, borderRadius: 16, flexDirection: 'column', textAlign: 'center',
                      borderTop: `2px solid ${s.color}`,
                    }}
                    onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, glassCardHover); }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = '';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)';
                    }}
                    onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  >
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{s.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SECTIONS PAGE (grid) ═══════════════ */}
      {page === 'sections' && (
        <div style={{ position: 'relative', minHeight: '100%', padding: '16px 14px 90px' }}>
          <button onClick={backToHero}
            style={{ padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', marginBottom: 14 }}>
            ← Назад
          </button>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            Все разделы
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => openSection(s.id)}
                style={{
                  ...glassCard, padding: '15px 16px', borderRadius: 16,
                  borderLeft: `3px solid ${s.color}`,
                }}
                onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, glassCardHover); }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)';
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{s.title}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.3 }}>{s.subtitle}</div>
                </div>
                <span style={{ fontSize: 14, color: s.color, fontWeight: 600 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ DETAIL PAGE (section content) ═══════════════ */}
      {page === 'detail' && section && (
        <div style={{ position: 'relative', minHeight: '100%', padding: '10px 14px 100px' }}>
          {/* Back */}
          <button onClick={backToSections}
            style={{ padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>
            ← Назад
          </button>

          {/* Section title */}
          {(() => {
            const sec = SECTIONS.find(s => s.id === section);
            if (!sec) return null;
            return <SectionTitle icon={sec.icon} title={sec.title} subtitle={sec.subtitle} color={sec.color} />;
          })()}

          {/* Content */}
          {renderSectionContent(section)}

          {/* Quick nav chips */}
          <QuickNavChips current={section} />
        </div>
      )}
    </div>
  );
};
