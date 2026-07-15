import React from 'react';
import type { UserProfile, LabPoint, WorkoutLog, UnifiedSettings } from '../../../core/types';
import { theme, PopupCard } from './ProfileComponents';
import { SleepDiaryTab } from './SleepDiaryTab';
import { BPDiaryTab } from '../../components/BPDiaryTab';
import { LabDiaryTab } from '../LabsScreen_parts/LabDiaryTab';
import { ProfileMeasurementsTab } from './ProfileMeasurementsTab';
import { InjectionDiaryTab } from './InjectionDiaryTab';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
  labs: LabPoint[];
  workoutLogs: WorkoutLog[];
  onNavigate?: (screen: string) => void;
}

const diaryItems = [
  { id:'sleep', icon:'🛌', title:'Сон', desc:'Часы, качество, пробуждения, график', nav:false },
  { id:'bp', icon:'❤️', title:'Давление', desc:'Систола/диастола/пульс, график, архив', nav:false },
  { id:'measurements', icon:'📈', title:'История замеров', desc:'Динамика, фото, графики', nav:false },
  { id:'inj_diary', icon:'🩼', title:'Инъекции', desc:'Зоны, PIP, отёчность, журнал', nav:false },
  { id:'lab_diary', icon:'📊', title:'Дневник анализов', desc:'Динамика маркеров, графики', nav:false },
];

export const ProfileDiariesSection: React.FC<Props> = ({ settings, save, labs, workoutLogs, onNavigate }) => {
  const [diarySubTab, setDiarySubTab] = React.useState<string>('sleep');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {diaryItems.map(item => (
          <PopupCard key={item.id} icon={item.icon} label={item.title} value={item.desc}>
            {item.nav ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>{item.desc}</div>
                <button onClick={() => {
                  const navKey: Record<string, string> = {
                    nutrition:'he_nav_nutrition_diary', training:'he_nav_training_diary',
                    pharma:'he_nav_pharma_diary', support:'he_nav_support_diary', risks:'he_nav_risks',
                  };
                  const sk = item.navScreen ? navKey[item.navScreen] || '' : '';
                  if (sk) try { localStorage.setItem(sk, '1'); } catch {}
                  onNavigate?.(item.navScreen || '');
                }}
                  style={{ padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    background:'rgba(0,230,138,0.15)', color:theme.accent }}>
                  Перейти
                </button>
              </div>
            ) : (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>{item.desc}</div>
                <button onClick={() => setDiarySubTab(item.id)}
                  style={{ padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    background:'rgba(0,230,138,0.15)', color:theme.accent }}>
                  Открыть
                </button>
              </div>
            )}
          </PopupCard>
        ))}
      </div>
      <div style={{ marginTop:12 }}>
        {diarySubTab === 'sleep' && <SleepDiaryTab settings={settings} save={save} />}
        {diarySubTab === 'bp' && <BPDiaryTab />}
        {diarySubTab === 'measurements' && <ProfileMeasurementsTab />}
        {diarySubTab === 'lab_diary' && <LabDiaryTab labs={labs} />}
        {diarySubTab === 'inj_diary' && <InjectionDiaryTab />}
      </div>
    </div>
  );
};
