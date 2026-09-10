/**
 * ProfileUserTab — вкладка "Пользователь" с 9 секциями-аккордеонами.
 * Бывшая sticky quick-jump лента УДАЛЕНА: скролл через scrollIntoView
 * не работал в WebView/APK (вложенный скролл-контейнер .profile-body),
 * клики выглядели «мёртвыми». Навигация = аккордеоны + «Развернуть все».
 */
import React from 'react';
import { UserPersonalSection } from './sections/UserPersonalSection';
import { UserHealthSection } from './sections/UserHealthSection';
import { UserDietSection } from './sections/UserDietSection';
import { UserLifestyleSection } from './sections/UserLifestyleSection';
import { UserPharmaSection } from './sections/UserPharmaSection';
import { UserGoalsSection } from './sections/UserGoalsSection';
import { TrainingProfileSection } from './sections/TrainingProfileSection';
import { TrainingPMSection } from './sections/TrainingPMSection';
import { TrainingWeakPointsSection } from './sections/TrainingWeakPointsSection';

export const ProfileUserTab: React.FC = React.memo(function ProfileUserTab() {
  const toggleAll = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('profile-accordion-toggle', { detail: open }));
  };

  return (
    <div className="pf-user">
      <div className="pf-toggle-all" style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 4, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className="pf-toggle-btn"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 800, color: '#06231a',
            background: 'linear-gradient(135deg, var(--profile-accent, #34d399), #22c55e)',
            border: '1px solid transparent',
            boxShadow: '0 4px 14px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >⤢ Развернуть все</button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className="pf-toggle-btn"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
          }}
        >⤡ Свернуть</button>
      </div>

      <div className="profile-user-sections pf-sections" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <UserPersonalSection />
        <UserHealthSection />
        <UserDietSection />
        <UserLifestyleSection />
        <UserPharmaSection />
        <UserGoalsSection />
        <TrainingProfileSection />
        <TrainingPMSection />
        <TrainingWeakPointsSection />
      </div>
    </div>
  );
});
