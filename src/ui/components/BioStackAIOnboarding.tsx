import React, { useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { toFinderProfile, HEALTH_CONDS } from './BioStackAIConstants';
import type { HealthCondition, ExperienceLevel } from '../../engines/biostack-ai.engine';

const STEP_STYLES = {
  container: { maxWidth: 400, margin: '0 auto', paddingBottom: 80 } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4, textAlign: 'center' as const },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14, textAlign: 'center' as const, lineHeight: 1.4 },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 } as React.CSSProperties,
  card: (active: boolean, color: string): React.CSSProperties => ({
    padding: '14px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'center' as const,
    background: active ? `${color}14` : 'rgba(24,24,27,0.7)',
    border: active ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.15s',
  }),
  cardIcon: { fontSize: 26, marginBottom: 4 } as React.CSSProperties,
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 } as React.CSSProperties,
  cardDesc: { fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 } as React.CSSProperties,
  nextBtn: (color: string): React.CSSProperties => ({
    width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: `linear-gradient(135deg,${color},${color}dd)`, color: '#000', fontWeight: 800, fontSize: 13,
    boxShadow: `0 4px 16px ${color}28`,
  }),
  backBtn: { width: '100%', padding: '10px 0', borderRadius: 10, marginTop: 6, cursor: 'pointer',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 },
  progress: { display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 14 } as React.CSSProperties,
  dot: (active: boolean): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: 4,
    background: active ? '#00e68a' : 'rgba(255,255,255,0.12)',
    transition: 'all 0.2s',
  }),
};

const EXP_CARDS: Array<{ key: ExperienceLevel; icon: string; title: string; desc: string }> = [
  { key: 'beginner', icon: '🌱', title: 'Новичок', desc: '<1 года тренировок. Базовый стек БАДов' },
  { key: 'intermediate', icon: '💪', title: 'Средний', desc: '1-3 года. Расширенный стек' },
  { key: 'advanced', icon: '🔥', title: 'Продвинутый', desc: '3+ лет. Полный стек + спец. поддержка' },
];

interface OnboardingProps {
  profile: BioStackProfile;
  onComplete: (patch: Partial<BioStackProfile>, autoBuildStack?: boolean) => void;
  onSkip: () => void;
}

export const OnboardingWizard: React.FC<OnboardingProps> = ({ profile, onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [healthConds, setHealthConds] = useState<HealthCondition[]>(profile.healthConditions || []);
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience || 'intermediate');

  const toggleHealth = (h: HealthCondition) => {
    setHealthConds(healthConds.includes(h) ? healthConds.filter(x => x !== h) : [...healthConds, h]);
  };

  const finish = (autoBuild: boolean) => {
    onComplete({ healthConditions: healthConds, experience }, autoBuild);
  };

  return (
    <div style={STEP_STYLES.container}>
      {/* Progress dots */}
      <div style={STEP_STYLES.progress}>
        {[0, 1].map(i => <div key={i} style={STEP_STYLES.dot(step >= i)} />)}
      </div>

      {/* Step 0: Health conditions */}
      {step === 0 && (
        <>
          <div style={STEP_STYLES.title}>🫀 Есть ли особенности здоровья?</div>
          <div style={STEP_STYLES.subtitle}>Это поможет исключить нежелательные БАДы и подобрать безопасный стек</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 12 }}>
            {HEALTH_CONDS.map(h => {
              const active = healthConds.includes(h.key);
              return (
                <button key={h.key} onClick={() => toggleHealth(h.key)} style={{
                  padding: '8px 12px', borderRadius: 16, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                  background: active ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.03)',
                  border: active ? '2px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  color: active ? '#ef4444' : 'rgba(255,255,255,0.6)',
                }}>{h.label}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setStep(1)} style={{ ...STEP_STYLES.nextBtn('#ef4444'), flex: 1 }}>
              Далее {healthConds.length > 0 ? `(${healthConds.length})` : ''} →
            </button>
          </div>
          <button onClick={onSkip} style={STEP_STYLES.backBtn}>Пропустить — заполню позже</button>
        </>
      )}

      {/* Step 1: Experience + Build */}
      {step === 1 && (
        <>
          <div style={STEP_STYLES.title}>💪 Ваш уровень тренировок</div>
          <div style={STEP_STYLES.subtitle}>Это влияет на размер и сложность стека</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {EXP_CARDS.map(e => (
              <div key={e.key} onClick={() => setExperience(e.key)}
                style={{ ...STEP_STYLES.card(experience === e.key, '#60a5fa'), padding: '10px 8px' }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>{e.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: experience === e.key ? '#60a5fa' : '#fff' }}>{e.title}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{e.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setStep(0)} style={STEP_STYLES.backBtn}>← Назад</button>
            <button onClick={() => finish(false)} style={{ ...STEP_STYLES.nextBtn('#8b5cf6'), flex: 1 }}>
              ✅ Сохранить профиль
            </button>
          </div>
          <button onClick={() => finish(true)} style={{
            ...STEP_STYLES.nextBtn('#00e68a'), marginTop: 6,
          }}>
            🧩 Сохранить + собрать первый стек
          </button>
        </>
      )}
    </div>
  );
};
