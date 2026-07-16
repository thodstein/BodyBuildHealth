import React from 'react';
import type { UserProfile, LabPoint, WorkoutLog, UnifiedSettings } from '../../../core/types';
import { theme, NavCard, PopupCard } from './ProfileComponents';
import { SleepDiaryTab } from './SleepDiaryTab';
import { BPDiaryTab } from '../../components/BPDiaryTab';
import { LabDiaryTab } from '../LabsScreen_parts/LabDiaryTab';
import { InjectionDiaryTab } from './InjectionDiaryTab';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  labs: LabPoint[];
  workoutLogs: WorkoutLog[];
  onNavigate?: (screen: string) => void;
}

type DiaryItem = { id: string; icon: string; title: string; desc: string; color: string; kind: 'inline' | 'nav'; navScreen?: string; navFlag?: string; navFlagVal?: string };

const diaryItems: DiaryItem[] = [
  { id: 'sleep', icon: '🛌', title: 'Сон', desc: 'Часы, качество, график', color: '#8b5cf6', kind: 'inline' },
  { id: 'bp', icon: '❤️', title: 'Давление', desc: 'Систола/диастола, пульс', color: '#ef4444', kind: 'inline' },
  { id: 'inj_diary', icon: '🩼', title: 'Инъекции', desc: 'Зоны, PIP, журнал', color: '#f59e0b', kind: 'inline' },
  { id: 'lab_diary', icon: '📊', title: 'Анализы', desc: 'Динамика маркеров', color: '#6366f1', kind: 'inline' },
  { id: 'nutrition', icon: '🥗', title: 'Питание', desc: 'Дневник еды, КБЖУ', color: '#22c55e', kind: 'nav', navScreen: 'nutrition', navFlag: 'he_nav_nutrition_diary', navFlagVal: '1' },
  { id: 'training', icon: '🏋️', title: 'Тренировки', desc: 'Журнал, объём, нагрузка', color: '#3b82f6', kind: 'nav', navScreen: 'training', navFlag: 'he_nav_training_diary', navFlagVal: '1' },
  { id: 'pharma', icon: '💊', title: 'Фарма', desc: 'Курс, препараты, ПКТ', color: '#ec4899', kind: 'nav', navScreen: 'pharma' },
  { id: 'support', icon: '🧪', title: 'Поддержка', desc: 'БАДы, план, стеки', color: '#06b6d4', kind: 'nav', navScreen: 'support' },
  { id: 'symptoms', icon: '🩺', title: 'Симптомы', desc: 'Жалобы, трекинг', color: '#f97316', kind: 'nav', navScreen: 'support', navFlag: 'he_nav_support_diary', navFlagVal: '1' },
];

const INLINE_IDS = new Set(diaryItems.filter(d => d.kind === 'inline').map(d => d.id));
const NAV_IDS = new Set(diaryItems.filter(d => d.kind === 'nav').map(d => d.id));

export const ProfileDiariesSection: React.FC<Props> = ({ settings, save, labs, workoutLogs, onNavigate }) => {
  const [diarySubTab, setDiarySubTab] = React.useState<string>('sleep');

  const handleNav = (item: DiaryItem) => {
    if (!onNavigate) return;
    if (item.navFlag) {
      try { localStorage.setItem(item.navFlag, item.navFlagVal || '1'); } catch {}
    }
    onNavigate(item.navScreen!);
  };

  const inlineItems = diaryItems.filter(d => d.kind === 'inline');
  const navItems = diaryItems.filter(d => d.kind === 'nav');

  return (
    <div>
      {/* ── Встроенные дневники (открываются inline) ── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
        Встроенные дневники
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
        {inlineItems.map(item => (
          <PopupCard key={item.id} icon={item.icon} label={item.title} value={item.desc} color={item.color}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{item.desc}</div>
              <button
                onClick={() => setDiarySubTab(item.id)}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, background: item.color + '26', color: item.color,
                }}>
                Открыть
              </button>
            </div>
          </PopupCard>
        ))}
      </div>

      {/* ── Внешние дневники (переход на экраны) ── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
        Дневники модулей
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
        {navItems.map(item => (
          <NavCard
            key={item.id}
            icon={item.icon}
            label={item.title}
            desc={item.desc}
            color={item.color}
            onClick={() => handleNav(item)}
          />
        ))}
      </div>

      {/* ── Inline diary content ── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
        Просмотр
      </div>
      <div>
        {diarySubTab === 'sleep' && <SleepDiaryTab settings={settings} save={save} />}
        {diarySubTab === 'bp' && <BPDiaryTab />}
        {diarySubTab === 'lab_diary' && <LabDiaryTab labs={labs} />}
        {diarySubTab === 'inj_diary' && <InjectionDiaryTab />}
      </div>
    </div>
  );
};
