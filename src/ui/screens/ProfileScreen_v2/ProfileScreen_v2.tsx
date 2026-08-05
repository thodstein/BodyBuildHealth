/**
 * ProfileScreen_v2 — новый экран Профиля.
 * Hero (4 карточки) + 4 вкладки (Пользователь / Тренировки / Дневники / Настройки).
 * Auto-save внутри вкладок через debounce 500мс.
 */
import React, { useState, useEffect } from 'react';
import { ProfileHero } from './ProfileHero';
import { ProfileUserTab } from './ProfileUserTab';
import { ProfileTrainingTab } from './ProfileTrainingTab';
import { ProfileDiariesTab } from './ProfileDiariesTab';
import { ProfileSettingsTab } from './ProfileSettingsTab';
import { useProfileRefresh, getSnapshots, undoLastSnapshot } from '../../../core/profile-manager';
import { colors } from './ui';

type Tab = 'user' | 'training' | 'diaries' | 'settings';

const TAB_META: Record<Tab, { icon: string; title: string; color: string }> = {
  user: { icon: '👤', title: 'Пользователь', color: colors.primary },
  training: { icon: '🏋️', title: 'Тренировки', color: colors.blue },
  diaries: { icon: '📓', title: 'Дневники', color: colors.orange },
  settings: { icon: '⚙️', title: 'Настройки', color: colors.purple },
};

export const ProfileScreen_v2: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  useProfileRefresh(); // ensure subscription
  const [tab, setTab] = useState<Tab | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  useEffect(() => {
    const refresh = () => setUndoAvailable(getSnapshots().length > 0);
    refresh();
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, []);

  // Глобальный Ctrl+Z для undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
          // Не перехватываем undo в текстовых полях
          return;
        }
        e.preventDefault();
        undoLastSnapshot();
        setUndoAvailable(getSnapshots().length > 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (tab === null) {
    return <ProfileHero onSelectTab={setTab} />;
  }

  const meta = TAB_META[tab];

  return (
    <div>
      {/* Хедер вкладки */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        padding: '12px 16px',
        background: `${meta.color}11`,
        border: `1px solid ${meta.color}33`,
        borderRadius: 12,
      }}>
        <button
          onClick={() => setTab(null)}
          aria-label="Назад к hero"
          style={{
            background: 'transparent', border: 'none', color: colors.text,
            fontSize: 20, cursor: 'pointer', padding: 4, minWidth: 36, minHeight: 36,
          }}
        >←</button>
        <span style={{ fontSize: 24 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: meta.color }}>{meta.title}</div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>Изменения сохраняются автоматически</div>
        </div>
        {undoAvailable && (
          <button
            onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshots().length > 0); }}
            aria-label="Отменить последнее изменение (Ctrl+Z)"
            title="Отменить (Ctrl+Z)"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: colors.blue,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 36,
            }}
          >↩ Отменить</button>
        )}
      </div>

      {/* Содержимое вкладки */}
      {tab === 'user' && <ProfileUserTab />}
      {tab === 'training' && <ProfileTrainingTab />}
      {tab === 'diaries' && <ProfileDiariesTab onNavigate={onNavigate} />}
      {tab === 'settings' && <ProfileSettingsTab onNavigate={onNavigate} />}
    </div>
  );
};
