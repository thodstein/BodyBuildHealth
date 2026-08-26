import React, { useState, useEffect } from 'react';
import { useProfileRefresh } from '../../core/profile-manager';
import { getSymptomDiaryStats } from '../../engines/symptom-diary.engine';
import { getAdherenceStats } from '../../engines/symptom-adherence.engine';

type ScreenId = 'dashboard'|'pharma'|'course'|'peptides'|'nutrition'|'plan'|'substances'|'labs'|'risks'|'profile'|'predictive'|'marketplace'|'articles'|'assistant'|'gamification'|'fertility-pct'|'reports'|'integrations'|'role-management'|'support'|'training';

interface Props { onNavigate?: (screen: ScreenId) => void; }

const SYMPTOM_CARD: React.CSSProperties = {
  display:'flex', flexDirection:'column', gap:4, padding:'10px 12px',
  borderRadius:10, background:'rgba(18,18,20,0.38)',
  border:'1px solid rgba(255,255,255,0.10)',
  backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
  boxShadow:'0 3px 12px rgba(0,0,0,0.22)',
  minWidth:0,
};

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const [symptomStats, setSymptomStats] = useState(() => getSymptomDiaryStats());
  const [adherence, setAdherence] = useState(() => getAdherenceStats());
  const [drugWarnings, setDrugWarnings] = useState<{ date: string; count: number; highCount: number; warnings: string[] } | null>(() => {
    try { const d = localStorage.getItem('he_drug_warnings'); return d ? JSON.parse(d) : null; } catch { return null; }
  });

  useEffect(() => {
    setSymptomStats(getSymptomDiaryStats());
    setAdherence(getAdherenceStats());
    try { const d = localStorage.getItem('he_drug_warnings'); setDrugWarnings(d ? JSON.parse(d) : null); } catch {}
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, width:'100%', height:'100dvh', minHeight:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'transparent' }}>
      <img src="/hero-main.png" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center center', filter:'saturate(1.05) contrast(1.04)' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 68%, rgba(0,0,0,0.18) 84%, rgba(0,0,0,0.32) 100%)' }} />
      <div style={{ position:'absolute', bottom:70, left:16, right:16, zIndex:2 }}>

        {/* 🩺 Сводка симптомов */}
        {symptomStats.activeSymptoms > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={SYMPTOM_CARD}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:2 }}>
                🩺 Симптомы: {symptomStats.activeSymptoms} активных
              </div>
              <div style={{ display:'flex', gap:8, fontSize:10, color:'#fff', flexWrap:'wrap' }}>
                <span style={{ color:'#4caf50' }}>📉 {symptomStats.improving}</span>
                <span style={{ color:'#ff9800' }}>➡️ {symptomStats.stable}</span>
                <span style={{ color:'#f44336' }}>📈 {symptomStats.worsening}</span>
                <span style={{ color:'#8bc34a' }}>✅ {symptomStats.resolved}</span>
                <span style={{ color:'#fff' }}>Ср. {symptomStats.todayScore}/10</span>
              </div>
              {adherence.activeCount > 0 && (
                <div style={{ fontSize:9, color:'#8b5cf6', marginTop:2 }}>
                  💊 Назначений: {adherence.activeCount} · Приверженность: {adherence.adherence7d}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* ⚠ Лекарственные взаимодействия */}
        {drugWarnings && drugWarnings.highCount > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ ...SYMPTOM_CARD, borderLeft:'3px solid #ef4444' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:2 }}>
                ⚠ Лекарственные взаимодействия: {drugWarnings.count} находок
              </div>
              <div style={{ fontSize:9, color:'#ef4444cc', marginTop:2 }}>
                🔴 {drugWarnings.highCount} критических. {drugWarnings.warnings.join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Кнопки навигации */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { id:'profile' as ScreenId, icon:'👤', label:'Профиль', color:'#a78bfa' },
            { id:'marketplace' as ScreenId, icon:'🛍️', label:'Магазин', color:'#f59e0b' },
            { id:'articles' as ScreenId, icon:'📚', label:'Статьи', color:'#3b82f6' },
          ].map(c => (
            <button key={c.id} onClick={() => onNavigate?.(c.id)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
              aspectRatio:'1', borderRadius:14, cursor:'pointer', border:'1px solid rgba(255,255,255,0.10)',
              background:'rgba(18,18,20,0.38)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', boxShadow:'0 3px 12px rgba(0,0,0,0.22)',
              color:'#fff', transition:'all 0.2s',
            }}>
              <span style={{ fontSize:32 }}>{c.icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:c.color }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
