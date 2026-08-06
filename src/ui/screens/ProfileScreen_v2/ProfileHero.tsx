/**
 * ProfileHero — главный экран Профиля.
 * Компактная шапка (аватар + сводка) + 4 горизонтальные карточки по аналогии с DashboardScreen.
 */
import React, { useEffect, useState } from 'react';
import { useProfileRefresh, getSnapshots, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { colors } from './ui';

interface TabDef {
  id: 'user' | 'training' | 'diaries' | 'settings';
  icon: string;
  label: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'user', icon: '👤', label: 'Пользователь', color: colors.primary },
  { id: 'training', icon: '🏋️', label: 'Тренировки', color: colors.blue },
  { id: 'diaries', icon: '📓', label: 'Дневники', color: colors.orange },
  { id: 'settings', icon: '⚙️', label: 'Настройки', color: colors.purple },
];

function calcCompleteness(s: any): number {
  if (!s) return 0;
  const checks = [
    s.personal?.age, s.personal?.sex, s.personal?.height, s.personal?.weight,
    s.training?.primaryGoal, s.training?.level, s.training?.daysPerWeek,
    s.lifestyle?.sleepHours, s.lifestyle?.stressLevel,
    s.health?.bpStage,
    s.nutrition?.dietType, s.nutrition?.proteinPerKg,
    s.goals?.primaryGoal,
  ];
  const filled = checks.filter(v => v !== undefined && v !== null && v !== '').length;
  return Math.round((filled / checks.length) * 100);
}

const GOAL_LABELS: Record<string, string> = {
  bulk: 'Набор', cut: 'Сушка', maintenance: 'Поддержка',
  strength: 'Сила', hypertrophy: 'Гипертрофия', rehab: 'Реабилитация',
  recomposition: 'Рекомпозиция', health: 'Здоровье',
};

export const ProfileHero: React.FC<{ onSelectTab: (id: TabDef['id']) => void }> = ({ onSelectTab }) => {
  const profile = useProfileRefresh();
  const settings = (profile.settings || {}) as any;
  const p = settings.personal || {};
  const tr = settings.training || {};
  const ph = settings.pharma || {};

  const [completeness, setCompleteness] = useState(0);
  const [undoAvailable, setUndoAvailable] = useState(false);

  // Подписка на ЛЮБОЕ изменение профиля (включая свою вкладку) — event-bus
  useEffect(() => {
    setCompleteness(calcCompleteness(settings));
  }, [settings]);

  useEffect(() => {
    const refresh = () => setUndoAvailable(getSnapshots().length > 0);
    refresh();
    const unsub = onAnyProfileChange(refresh);
    return unsub;
  }, []);

  const hasData = !!(profile.name || p.age || p.weight || tr.primaryGoal);

  // Если вообще ничего не заполнено — показываем инициалы как "?"
  const initials = profile.name
    ? profile.name.trim().charAt(0).toUpperCase()
    : '?';

  const sexIcon = p.sex === 'female' ? '♀' : (p.sex === 'male' ? '♂' : '');

  // Возраст + вес + цель — отдельные части, чтобы не было "· —"
  const parts: string[] = [];
  if (p.age) parts.push(`${p.age} лет`);
  if (p.weight) parts.push(`${p.weight} кг`);
  if (p.bodyFat) parts.push(`${p.bodyFat}% жира`);
  const goalLabel = tr.primaryGoal ? GOAL_LABELS[tr.primaryGoal] : '';

  const phaseBadge = ph.phase === 'course' ? { label: 'КУРС', color: colors.warning } : null;
  const filled = Math.round((completeness / 100) * 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 4px 16px 4px' }}>
      {/* Шапка — компактная сводка */}
      <div
        role="region"
        aria-label="Сводка профиля"
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: hasData ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${hasData ? colors.primary + '33' : colors.border}`,
          borderRadius: 14,
        }}
      >
        <div
          aria-label={profile.name ? `Инициалы: ${initials}` : 'Профиль не заполнен'}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: hasData
              ? `linear-gradient(135deg, ${colors.primary}, ${colors.blue})`
              : 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
            color: hasData ? '#0a0a0a' : colors.textMuted,
            flexShrink: 0,
          }}
        >{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 16, fontWeight: 700, color: colors.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >{profile.name || 'Профиль'}</span>
            {sexIcon && <span style={{ fontSize: 14, color: colors.textMuted }}>{sexIcon}</span>}
            {phaseBadge && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: phaseBadge.color + '22', color: phaseBadge.color, letterSpacing: 0.5,
              }}>{phaseBadge.label}</span>
            )}
          </div>
          {/* Сводка: показываем только заполненные части, не "· —" */}
          {(parts.length > 0 || goalLabel) && (
            <div
              style={{
                fontSize: 11, color: colors.textMuted, marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {parts.join(' · ')}{parts.length > 0 && goalLabel ? ' · ' : ''}{goalLabel}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Профиль заполнен на ${completeness}%`}
              style={{
                flex: 1, height: 5, borderRadius: 3,
                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
              }}
            >
              <div style={{
                width: `${completeness}%`, height: '100%',
                background: completeness < 50 ? colors.danger : completeness < 80 ? colors.warning : colors.primary,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
              {completeness}%
            </span>
            {undoAvailable && (
              <button
                onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshots().length > 0); }}
                title="Отменить последнее изменение"
                aria-label="Отменить последнее изменение"
                style={{
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                  color: colors.blue, padding: '2px 8px', borderRadius: 6,
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', minHeight: 24,
                }}
              >↩</button>
            )}
          </div>
        </div>
      </div>

      {/* Подсказка для заполнения (только если мало заполнено) */}
      {filled < 8 && (
        <div style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', padding: '0 8px' }}>
          {filled === 0
            ? '👇 Заполните основное в карточке "Пользователь"'
            : `Заполнено ${filled}/12 ключевых полей. Можно дополнить в карточках ниже.`}
        </div>
      )}

      {/* 4 горизонтальные карточки — по аналогии с DashboardScreen */}
      <div
        role="navigation"
        aria-label="Разделы профиля"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            aria-label={`Открыть раздел: ${t.label}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, aspectRatio: '1', minHeight: 80, borderRadius: 14, cursor: 'pointer',
              border: `1px solid ${t.color}33`,
              background: `linear-gradient(135deg, ${t.color}11, rgba(0,0,0,0.2))`,
              color: colors.text, transition: 'transform 0.15s, border-color 0.15s',
              padding: 8,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: t.color,
              textAlign: 'center', lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
