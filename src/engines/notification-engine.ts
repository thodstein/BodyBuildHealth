// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION ENGINE — Лабораторные напоминания + протокольные триггеры
//  Использование: import { checkNotifications, type NotificationRule } from './notification-engine';
//  ════════════════════════════════════════════════════════════════════════════

import { computeOverdueSystems, type SystemOverdue, type LabSliceLike } from './labs-overdue';

export type NotificationPriority = 'info' | 'warning' | 'critical';
export type NotificationChannel = 'telegram' | 'browser' | 'toast';

export interface NotificationRule {
  id: string;
  trigger: 'lab_due' | 'cycle_milestone' | 'risk_threshold' | 'protocol_milestone';
  condition: (state: NotificationState) => boolean;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  cooldownHours: number;
  /** Детальные данные для рендера (для labs_overdue — массив систем). */
  details?: SystemOverdue[];
}

export interface NotificationState {
  labs: {
    lastLabDate?: string;
    alt?: number; ast?: number; ggt?: number;
    hct?: number; hgb?: number;
    e2?: number; prl?: number;
    ldl?: number; hdl?: number; tg?: number;
    creatinine?: number; egfr?: number;
    glucose?: number; hba1c?: number;
    dDimer?: number;
    psa?: number;
    tt?: number; lh?: number; fsh?: number;
    cortisol?: number;
    potassium?: number; sodium?: number;
  };
  /** Полная панель лаб-анализов (LabSlice-формат). Используется для расчёта
   *  просроченных систем (rule labs_overdue). */
  fullPanel?: LabSliceLike | null;
  pharma: {
    phase?: string;
    courseStartDate?: string;
    pctWeek?: number;
    hasAI?: boolean;
    hasOral17?: boolean;
  };
  goals: {
    cycleWeeks?: number;
  };
}

const NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: 'labs_overdue',
    trigger: 'lab_due',
    condition: (s) => {
      // Не срабатывает, если нет активной фазы (без курса/ПКТ анализы опциональны)
      const phase = (s.pharma.phase || '').toLowerCase();
      if (phase === 'none' || phase === '') return false;
      // Запускаем computeOverdueSystems — он сам решит, есть ли просроченные системы
      const systems = computeOverdueSystems({
        fullPanel: s.fullPanel ?? null,
        phase: s.pharma.phase,
        lastLabDate: s.labs.lastLabDate,
      });
      return systems.length > 0;
    },
    message: '⏰ Сдайте анализы: есть просроченные маркеры по текущей фазе.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'e2_monitor',
    trigger: 'protocol_milestone',
    condition: (s) => {
      const weeksSince = s.labs.lastLabDate
        ? (Date.now() - new Date(s.labs.lastLabDate).getTime()) / (7 * 24 * 3600 * 1000)
        : 5;
      return weeksSince >= 4 && s.pharma.phase === 'course' && !!(s.pharma.hasAI || (s.labs.e2 && s.labs.e2 > 80));
    },
    message: '🔬 Контроль эстрадиола (E2): прошло 4+ нед. При AI-терапии — критично (риск E2-crash <20 или гинекомастия >80).',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'hct_high',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.hct || 0) >= 52,
    message: '🩸 Гематокрит ≥52% — повышенный риск тромбоза. Рекомендована флеботомия 300-450 мл + контроль HCT через 3 дня.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'e2_crash',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.e2 || 30) < 15,
    message: '⚠ Эстрадиол <15 пг/мл — КРИТИЧЕСКИ НИЗКИЙ. Риск: боль в суставах, потеря либидо, ухудшение липидов. Снизить/отменить АИ.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'e2_high',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.e2 || 20) > 80,
    message: '⚠ Эстрадиол >80 пг/мл — ВЫСОКИЙ. Риск гинекомастии, отёков. Рассмотреть увеличение дозы АИ.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'alt_critical',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.alt || 0) > 100,
    message: '⛔ АЛТ >100 Ед/л (2.5×ULN) — гепатотоксичность. Немедленно сдать повторно. При >200 — стоп ААС, TUDCA×2.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'ldl_high',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.ldl || 2) > 4.5,
    message: '⚠ ЛПНП >4.5 ммоль/л — критическая дислипидемия. Рассмотреть статин/эзетимиб/красный дрожжевой рис.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 72,
  },
  {
    id: 'egfr_low',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.egfr || 100) < 60,
    message: '⚠ eGFR <60 мл/мин — снижение функции почек. Контроль креатинина/eGFR через 2 нед. Нефролог при <30.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 48,
  },
  {
    id: 'prl_high',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.prl || 10) > 25,
    message: '⚠ Пролактин >25 нг/мл — гиперпролактинемия. Рассмотреть каберголин/витекс/вит.B6. Контроль через 2 нед.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'pct_e2_check',
    trigger: 'protocol_milestone',
    condition: (s) => s.pharma.phase === 'pct' && (s.pharma.pctWeek || 0) === 2,
    message: '📊 Неделя 2 ПКТ: контроль E2 (таргет 20-40 пг/мл), ЛГ, ФСГ, тестостерона. При E2<15 — отменить АИ.',
    priority: 'critical',
    channels: ['browser', 'toast'],
    cooldownHours: 24,
  },
  {
    id: 'pct_hpta_check',
    trigger: 'protocol_milestone',
    condition: (s) => s.pharma.phase === 'pct' && (s.pharma.pctWeek || 0) === 6,
    message: '📊 Неделя 6 ПКТ: контроль ЛГ, ФСГ, общ. тестостерона. При отсутствии восстановления (>6 нед) — эндокринолог.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 24,
  },
  {
    id: 'oral_17_lft',
    trigger: 'cycle_milestone',
    condition: (s) => s.pharma.hasOral17 === true && s.pharma.phase === 'course',
    message: '⏰ Орал 17α: контроль АЛТ/АСТ каждые 2 нед (гепатотоксичность). При АЛТ >2×ULN — снизить/отменить орал.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'ddimer_high',
    trigger: 'risk_threshold',
    condition: (s) => (s.labs.dDimer || 0) > 500,
    message: '⛔ D-димер >500 нг/мл — риск тромбоэмболии. Консультация гематолога. Рассмотреть НМГ (эноксапарин).',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
];

// ──────────────── STORAGE ────────────────

const STORAGE_KEY = 'he_notification_log';

interface NotificationLog {
  ruleId: string;
  lastTriggered: string; // ISO date
}

function getLog(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLog(log: NotificationLog[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

function wasRecentlyTriggered(ruleId: string, cooldownHours: number): boolean {
  const log = getLog();
  const entry = log.find(l => l.ruleId === ruleId);
  if (!entry) return false;
  const hoursSince = (Date.now() - new Date(entry.lastTriggered).getTime()) / (3600 * 1000);
  return hoursSince < cooldownHours;
}

function markTriggered(ruleId: string): void {
  const log = getLog().filter(l => l.ruleId !== ruleId);
  log.push({ ruleId, lastTriggered: new Date().toISOString() });
  // Keep only last 50 entries
  if (log.length > 50) log.splice(0, log.length - 50);
  saveLog(log);
}

// ──────────────── PUBLIC API ────────────────

export interface ActiveNotification {
  rule: NotificationRule;
  triggeredAt: string;
  shown: boolean;
}

export function checkNotifications(state: NotificationState): NotificationRule[] {
  return NOTIFICATION_RULES.filter(rule => {
    try {
      if (!rule.condition(state)) return false;
      if (wasRecentlyTriggered(rule.id, rule.cooldownHours)) return false;
      return true;
    } catch { return false; }
  }).map(rule => {
    // Для labs_overdue: прикрепляем детали (список систем) для UI-баннера.
    if (rule.id === 'labs_overdue' && !rule.details) {
      const systems = computeOverdueSystems({
        fullPanel: state.fullPanel ?? null,
        phase: state.pharma.phase,
        lastLabDate: state.labs.lastLabDate,
      });
      return { ...rule, details: systems };
    }
    return rule;
  });
}

export function triggerNotifications(state: NotificationState, onNotification: (rule: NotificationRule) => void): void {
  const active = checkNotifications(state);
  for (const rule of active) {
    markTriggered(rule.id);
    onNotification(rule);
  }
}

export function showNotificationToast(rule: NotificationRule): void {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.showPopup && rule.channels.includes('telegram')) {
      tg.showPopup({
        title: rule.priority === 'critical' ? '⛔ Критическое предупреждение' : '⚠ Напоминание',
        message: rule.message,
        buttons: [{ type: 'ok' }],
      });
      tg.HapticFeedback?.notificationOccurred?.(rule.priority === 'critical' ? 'error' : 'warning');
    }
  } catch {}
}

export function getAllRules(): NotificationRule[] {
  return [...NOTIFICATION_RULES];
}

export function getRulesByTrigger(trigger: NotificationRule['trigger']): NotificationRule[] {
  return NOTIFICATION_RULES.filter(r => r.trigger === trigger);
}

export function getCriticalRules(): NotificationRule[] {
  return NOTIFICATION_RULES.filter(r => r.priority === 'critical');
}
