import React, { useState } from "react";
import type { UserProfile } from "../../../../core/types";
import { IndividualPlanProvider } from "./IndividualPlanContext";
import { IndividualPlanSettings } from "./IndividualPlanSettings";
import { IndividualPlanResults } from "./IndividualPlanResults";
import { MealComposer } from "./MealComposer";
import { IndividualPlanHealth } from "./IndividualPlanHealth";
import { usePlanCtx } from "./IndividualPlanContext";

type PlanTab = 'settings' | 'plan' | 'composer' | 'report' | 'health';

const TAB_META: { key: PlanTab; label: string; icon: string }[] = [
  { key: 'settings', label: 'Настройки', icon: '⚙️' },
  { key: 'plan', label: 'План', icon: '🥗' },
  { key: 'composer', label: 'Компоновщик', icon: '🍳' },
  { key: 'health', label: 'Здоровье', icon: '🩺' },
  { key: 'report', label: 'Отчёт', icon: '📊' },
];

export const IndividualPlan: React.FC<{ profile: UserProfile | null; course?: any[] }> = ({ profile, course }) => {
  const [tab, setTab] = useState<PlanTab>('settings');

  return (
    <IndividualPlanProvider profile={profile} course={course}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80, maxWidth: 540, margin: '0 auto' }}>
        <div style={{ display:'flex', gap:3, padding:'4px 0', overflowX:'auto', scrollbarWidth:'none' }}>
          {TAB_META.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink:0, padding:'6px 12px', borderRadius:16, cursor:'pointer',
              fontSize:9, fontWeight: tab === t.key ? 700 : 500,
              border: tab === t.key ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
              background: tab === t.key ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#202023',
              color: tab === t.key ? '#000' : '#fff',
              transition:'all 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === 'settings' && <IndividualPlanSettings />}
        {tab === 'plan' && <IndividualPlanResults />}
        {tab === 'composer' && <MealComposer />}
        {tab === 'health' && <IndividualPlanHealth />}
        {tab === 'report' && <ReportTab />}
      </div>
    </IndividualPlanProvider>
  );
};

const ReportTab: React.FC = () => {
  const { generateFullNutritionReport, nutritionReport } = usePlanCtx();
  const [generated, setGenerated] = useState(false);
  return (
    <div style={{ padding:12, background:'rgba(0,230,138,0.03)', borderRadius:12, border:'1px solid rgba(0,230,138,0.1)' }}>
      <button onClick={() => { generateFullNutritionReport?.(); setGenerated(true); }} style={{
        padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:10, fontWeight:700,
        background:'linear-gradient(135deg,#00e68a,#00c8a0)', border:'none', color:'#000',
      }}>📊 Сгенерировать отчёт</button>
      {generated && (
        <div style={{ marginTop:8, fontSize:9, color:'rgba(255,255,255,0.7)' }}>
          {nutritionReport ? '✅ Отчёт сохранён. Просмотр в Профиль → Отчёты.' : '⚠️ Сначала создайте план на день.'}
        </div>
      )}
    </div>
  );
};
