// ════════════════════════════════════════════════════════════════════════════
//  CALC NOTIFICATIONS BANNER — реактивные алерты движка notification-engine.
//  До этого прохода `checkNotifications` вызывался, но результат никуда не
//  выводился: пороги считались «в пустоту». Здесь — компактный список без
//  дублей с LabsDueBanner (правило labs_overdue отфильтровано: у него свой баннер).
// ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import type { NotificationRule } from '../../../engines/notification-engine';

const TONE: Record<NotificationRule['priority'], { bg: string; border: string; color: string }> = {
  critical: {
    bg: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.05))',
    border: 'rgba(239,68,68,0.45)',
    color: '#f87171',
  },
  warning: {
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))',
    border: 'rgba(245,158,11,0.4)',
    color: '#fbbf24',
  },
  info: {
    bg: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.04))',
    border: 'rgba(96,165,250,0.4)',
    color: '#60a5fa',
  },
};

/** Убираем labs_overdue: его показывает LabsDueBanner по тем же данным. */
export function visibleCalcNotifications(rules: NotificationRule[]): NotificationRule[] {
  return rules.filter((r) => r.id !== 'labs_overdue');
}

export interface CalcNotificationsBannerProps {
  rules: NotificationRule[];
  onDismiss: (ruleId: string) => void;
}

export const CalcNotificationsBanner: React.FC<CalcNotificationsBannerProps> = ({ rules, onDismiss }) => {
  if (!rules.length) return null;
  return (
    <div
      data-calc-notifications={rules.length}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}
    >
      {rules.map((rule) => {
        const tone = TONE[rule.priority] ?? TONE.warning;
        return (
          <div
            key={rule.id}
            role="alert"
            data-calc-notif={rule.id}
            data-calc-notif-priority={rule.priority}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 10,
              background: tone.bg,
              border: `1px solid ${tone.border}`,
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 10,
                lineHeight: 1.45,
                color: '#fff',
              }}
            >{rule.message}</span>
            <button
              onClick={() => onDismiss(rule.id)}
              aria-label={`Скрыть уведомление: ${rule.id}`}
              title="Скрыть (вернётся через cooldown)"
              style={{
                background: 'transparent',
                border: 'none',
                color: tone.color,
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
};

export default CalcNotificationsBanner;
