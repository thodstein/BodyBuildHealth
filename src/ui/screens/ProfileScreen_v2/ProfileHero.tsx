/**
 * ProfileHero — главный экран Профиля.
 * Hero-картинка (full-width) + сводка + pill-вкладки (как в NutritionScreen).
 */
import React, { useEffect, useState } from 'react';
import { useProfileRefresh, getSnapshotsCount, undoLastSnapshot } from '../../../core/profile-manager';
import { onAnyProfileChange } from '../../../core/profile-events';
import { colors } from './ui';

interface TabDef {
  id: 'user' | 'diaries' | 'settings' | 'reports';
  icon: string;
  label: string;
  desc: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'user', icon: '👤', label: 'Пользователь', desc: 'Имя, параметры, образ жизни, курс, цели', color: colors.primary },
  { id: 'diaries', icon: '📓', label: 'Дневники', desc: 'Сон, давление, вес, замеры', color: colors.orange },
  { id: 'reports', icon: '📊', label: 'Отчёты', desc: 'Комплексный отчёт для врача/тренера', color: colors.blue },
  { id: 'settings', icon: '⚙️', label: 'Настройки', desc: 'Единицы, уведомления, экспорт данных', color: colors.purple },
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
    const refresh = () => setUndoAvailable(getSnapshotsCount() > 0);
    refresh();
    const unsub = onAnyProfileChange(refresh);
    return unsub;
  }, []);

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
    <div style={{
      position: 'relative', minHeight: 'calc(100vh - 120px)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '24px 16px 28px', boxSizing: 'border-box',
      background: '#0f172a',
    }}>
      {/* Полноэкранный Hero */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img
          src="/profile-hero.png"
          alt="Profile"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {/* Градиент для читаемости текста */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0.86) 100%)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Имя + метрики поверх полноэкранного изображения */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 22, fontWeight: 800, color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>{profile.name || 'Профиль'}</span>
              {sexIcon && <span style={{ fontSize: 16, color: colors.primary, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{sexIcon}</span>}
              {phaseBadge && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: phaseBadge.color + 'cc', color: '#0a0a0a', letterSpacing: 0.5,
                }}>{phaseBadge.label}</span>
              )}
            </div>
            {(parts.length > 0 || goalLabel) && (
              <div style={{
                fontSize: 12, color: '#ffffff', marginTop: 2,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {parts.join(' · ')}{parts.length > 0 && goalLabel ? ' · ' : ''}{goalLabel}
              </div>
            )}
          </div>
          {undoAvailable && (
            <button
              onClick={() => { undoLastSnapshot(); setUndoAvailable(getSnapshotsCount() > 0); }}
              title="Отменить последнее изменение"
              aria-label="Отменить последнее изменение"
              style={{
                background: 'rgba(59,130,246,0.85)', border: 'none',
                color: '#fff', padding: '6px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 32,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                flexShrink: 0,
              }}
            >↩</button>
          )}
        </div>

        {/* Прогресс-бар заполненности */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <div
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Профиль заполнен на ${completeness}%`}
          style={{
            flex: 1, height: 6, borderRadius: 3,
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          }}
        >
          <div style={{
            width: `${completeness}%`, height: '100%',
            background: completeness < 50 ? colors.danger : completeness < 80 ? colors.warning : colors.primary,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
          {completeness}%
        </span>
        </div>

        {/* Подсказка для заполнения */}
        {filled < 8 && (
          <div style={{ fontSize: 11, color: '#ffffff', textAlign: 'center', padding: '0 8px' }}>
            {filled === 0
              ? '👇 Заполните основное в карточке "Пользователь"'
              : `Заполнено ${filled}/12 ключевых полей. Можно дополнить ниже.`}
          </div>
        )}

        {/* Карточки-баннеры — как в NutritionScreen */}
        <div
          role="navigation"
          aria-label="Разделы профиля"
          style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            width: '100%', padding: '4px 0',
          }}
        >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            aria-label={`Открыть раздел: ${t.label}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
              textAlign: 'left', width: '100%',
              background: `${t.color}1A`, border: `1px solid ${t.color}55`,
              color: colors.text,
              boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.35)';
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 44, height: 44, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, background: `${t.color}33`,
                fontSize: 22, lineHeight: 1,
              }}
            >{t.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.color, letterSpacing: -0.2, marginBottom: 1 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: '#ffffff', lineHeight: 1.3 }}>{t.desc}</div>
            </div>
            <span aria-hidden="true" style={{ color: t.color, fontSize: 18, opacity: 0.7 }}>→</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
};
