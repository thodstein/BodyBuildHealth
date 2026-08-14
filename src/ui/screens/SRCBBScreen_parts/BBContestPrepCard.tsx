/**
 * BBContestPrepCard.tsx — контракт для годового планировщика (MacrocyclePanel).
 *
 * Заменяет заглушку «Тапер для ББ — в разработке» в карточке ББ-блока:
 * показывает статус единой системы тапера ББ (goals.bbPeakConfig) и даёт
 * кнопку настройки. Вставляется как:
 *
 *   <BBContestPrepCard
 *     competition={{ name: c.name, week: c.week, date: c.date }}
 *     onOpenConfig={() => { /* переход на «🏁 Тапер ББ» в питании или «🏆 Шоу ББ» * / }}
 *   />
 *
 * Без onOpenConfig кнопка использует дефолт: переключает активную вкладку
 * планировщика питания на «🏁 Тапер ББ» (he_plan_active_tab) и уведомляет
 * пользователя тостом.
 */
import React, { useMemo } from 'react';
import { getProfile } from '../../../core/profile-manager';
import {
  deserializeBBPrepConfig, legacyConfigFromProfile,
  buildBBContestPrep, CONTEST_CATEGORY_LABELS,
  type BBContestPrepConfig,
} from '../../../engines/bb/bb-contest-prep.engine';

const defaultOpenConfig = () => {
  try {
    localStorage.setItem('he_plan_active_tab', 'peak');
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'he_plan_active_tab' })); } catch {}
  } catch {}
  const toast = (window as any).showToast;
  if (typeof toast === 'function') {
    toast('Откройте блок «Питание» → планировщик → вкладка «🏁 Тапер ББ»', 'info');
  }
};

export const BBContestPrepCard: React.FC<{
  competition?: { name: string; week: number; date?: string };
  compact?: boolean;
  onOpenConfig?: () => void;
}> = ({ competition, compact, onOpenConfig }) => {
  const cfg: BBContestPrepConfig | null = useMemo(() => {
    try {
      const s = getProfile().settings as any;
      const raw = s?.goals?.bbPeakConfig;
      if (raw) {
        const parsed = deserializeBBPrepConfig(raw);
        if (parsed) return parsed;
      }
      return legacyConfigFromProfile(s?.goals, s?.personal);
    } catch { return null; }
  }, []);

  const summary = useMemo(() => {
    if (!cfg) return null;
    try { return buildBBContestPrep(cfg); } catch { return null; }
  }, [cfg]);

  const statusColor = cfg ? '#22c55e' : 'rgba(255,255,255,0.55)';

  return (
    <div style={{
      marginTop: 6, padding: 8, borderRadius: 8,
      background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.35)',
      fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>🏁</span>
        <b style={{ color: '#f59e0b' }}>Тапер ББ</b>
        {cfg && (
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: statusColor, padding: '1px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.1)' }}>
            ● активен
          </span>
        )}
      </div>
      {cfg ? (
        <>
          <div>
            Шоу <b style={{ color: '#fff' }}>{cfg.showDate}</b> · {CONTEST_CATEGORY_LABELS[cfg.category] ?? cfg.category} · {cfg.weightKg} кг
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)' }}>
            Тапер {cfg.weeksOut} нед ({cfg.trainingProtocol}) · карбс {cfg.carbLoadStrategy} · вода {cfg.waterStrategy} · Na {cfg.sodiumStrategy}
          </div>
          {summary && !compact && (
            <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Пик-неделя: {summary.peakWeek[0]?.phaseLabel} → {summary.peakWeek[6]?.phaseLabel} ({summary.peakWeek[6]?.kcal} ккал в день шоу)
            </div>
          )}
          {competition && cfg.showDate && (
            <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Соревнование «{competition.name}» (нед {competition.week}) — пик-неделя завершается в день шоу.
            </div>
          )}
        </>
      ) : (
        <div>
          Не настроен. Создайте протокол пикинг-недели — тренировочный тапер наложится на последние недели цикла,
          а план питания получит карбс/воду/натрий по дням до шоу.
        </div>
      )}
      <button
        type="button"
        onClick={onOpenConfig || defaultOpenConfig}
        style={{
          width: '100%', marginTop: 6, padding: '8px 10px', minHeight: 44, borderRadius: 8, cursor: 'pointer',
          fontSize: 10, fontWeight: 700, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
        }}
      >
        ⚙ {cfg ? 'Настроить тапер ББ' : 'Создать тапер ББ'}
      </button>
    </div>
  );
};

export default BBContestPrepCard;
