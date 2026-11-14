// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION ENGINE — Лабораторные напоминания + протокольные триггеры
//  Использование: import { checkNotifications, type NotificationRule } from './notification-engine';
//  ════════════════════════════════════════════════════════════════════════════

import { computeOverdueSystems, type SystemOverdue, type LabSliceLike } from './labs-overdue';
import { FEMALE_HCT_THERAPY, FEMALE_HCT_URGENT, LFT_SIGNAL_ULN, LFT_STAGE_ULN, HCT_THRESHOLDS } from './lab-norms.engine';

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
  /** Пол для порогов. По умолчанию — мужской путь (обратная совместимость:
   *  старые вызовы без поля получают прежние пороги). */
  sex?: 'male' | 'female' | string;
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

const isFemale = (s: NotificationState): boolean => s.sex === 'female';

// У женского контура свои пороги: HCT 48/52 (эритроцитоз у женщин), АЛТ 2.5×ULN 31,
// E2 — физиологический диапазон цикла (до ~200, овуляторный пик до ~400 пг/мл),
// поэтому мужские E2-правила для женщин дают ложные срабатывания 2–3 раза в неделю.
// Числа берём из единого резолвера норм (lab-norms.engine), а не литералами.
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
      return !isFemale(s) && weeksSince >= 4 && s.pharma.phase === 'course' && !!(s.pharma.hasAI || (s.labs.e2 && s.labs.e2 > 80));
    },
    message: '🔬 Контроль эстрадиола (E2): прошло 4+ нед. При AI-терапии — критично (риск E2-crash <15 или гинекомастия >80).',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    // ♀ На ИА контроль нужен не из-за гинекомастии, а чтобы не обнулить E2:
    // низкий E2 бьёт по либидо, костям и циклу. Без ИА мониторинг не форсируем —
    // физиологический E2 в цикле и так меняется в разы.
    id: 'e2_monitor_female',
    trigger: 'protocol_milestone',
    condition: (s) => {
      const weeksSince = s.labs.lastLabDate
        ? (Date.now() - new Date(s.labs.lastLabDate).getTime()) / (7 * 24 * 3600 * 1000)
        : 5;
      return isFemale(s) && weeksSince >= 4 && s.pharma.phase === 'course' && !!s.pharma.hasAI;
    },
    message: '🔬 Контроль E2 на ИА (♀): цель 20–40 пг/мл, не обнулять — либидо, кости, цикл. Сдать E2 + прогестерон.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    // ♂ Норма до 52 %: 51 — эритроцитоз (предупреждение), 54 — порог флеботомии.
    id: 'hct_high',
    trigger: 'risk_threshold',
    condition: (s) => !isFemale(s) && (s.labs.hct || 0) >= HCT_THRESHOLDS.male.erythrocytosis && (s.labs.hct || 0) < HCT_THRESHOLDS.male.block,
    message: `🩸 Гематокрит ≥${HCT_THRESHOLDS.male.erythrocytosis}% — эритроцитоз. Гидратация, кардио, контроль HCT через 3 дня; при ≥${HCT_THRESHOLDS.male.block}% — флеботомия.`,
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'hct_critical',
    trigger: 'risk_threshold',
    condition: (s) => !isFemale(s) && (s.labs.hct || 0) >= HCT_THRESHOLDS.male.block,
    message: `⛔ Гематокрит ≥${HCT_THRESHOLDS.male.block}% (порог флеботомии) — высокий риск тромбоза. Флеботомия 300-450 мл + контроль HCT через 3 дня.`,
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    // ♀ Норма 36–48 %: ULN — уже «терапия», ULN+4 — «ургент» (градация приложения).
    id: 'hct_high_female',
    trigger: 'risk_threshold',
    condition: (s) => isFemale(s) && (s.labs.hct || 0) >= FEMALE_HCT_THERAPY && (s.labs.hct || 0) < FEMALE_HCT_URGENT,
    message: `🩸 Гематокрит ≥${FEMALE_HCT_THERAPY} % (♀ норма 36–48) — эритроцитоз. Гидратация, контроль HCT через 3 дня; при ≥${FEMALE_HCT_URGENT} % — флеботомия.`,
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'hct_critical_female',
    trigger: 'risk_threshold',
    condition: (s) => isFemale(s) && (s.labs.hct || 0) >= FEMALE_HCT_URGENT,
    message: `⛔ Гематокрит ≥${FEMALE_HCT_URGENT} % (♀ ургент) — высокий риск тромбоза. Флеботомия 300-450 мл + контроль HCT через 3 дня.`,
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'e2_crash',
    trigger: 'risk_threshold',
    condition: (s) => !isFemale(s) && (s.labs.e2 || 30) < 15,
    message: '⚠ Эстрадиол <15 пг/мл — КРИТИЧЕСКИ НИЗКИЙ. Риск: боль в суставах, потеря либидо, ухудшение липидов. Снизить/отменить АИ.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    // ♀ Без ИА низкий E2 — норма ранней фолликулярной фазы, поэтому алерт
    // только на фоне приёма ИА (там это реальный краш от передозировки).
    id: 'e2_crash_female',
    trigger: 'risk_threshold',
    condition: (s) => isFemale(s) && !!s.pharma.hasAI && (s.labs.e2 || 30) < 20,
    message: '⚠ E2 <20 пг/мл на ИА (♀) — E2-краш. Риск: суставы, либидо, кости, сбой цикла. Снизить/отменить АИ.',
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    id: 'e2_high',
    trigger: 'risk_threshold',
    condition: (s) => !isFemale(s) && (s.labs.e2 || 20) > 80,
    message: '⚠ Эстрадиол >80 пг/мл — ВЫСОКИЙ. Риск гинекомастии, отёков. Рассмотреть увеличение дозы АИ.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    // ♀ Порог выше овуляторного пика: 80–400 пг/мл — физиология цикла, а не риск.
    id: 'e2_high_female',
    trigger: 'risk_threshold',
    condition: (s) => isFemale(s) && (s.labs.e2 || 20) > 400,
    message: '⚠ E2 >400 пг/мл (♀) — выше типичного овуляторного пика. Если это не овуляция — обсудить с врачом; E2 не обнулять.',
    priority: 'warning',
    channels: ['browser', 'toast'],
    cooldownHours: 48,
  },
  {
    id: 'alt_critical',
    trigger: 'risk_threshold',
    condition: (s) => !isFemale(s) && (s.labs.alt || 0) > LFT_SIGNAL_ULN.male,
    message: `⛔ АЛТ >${LFT_SIGNAL_ULN.male} Ед/л (2.5×ВГН 40) — гепатотоксичность: повтор + TUDCA. >${LFT_STAGE_ULN.stopOral.male} — отмена оралов, >${LFT_STAGE_ULN.stopAll.male} — отмена всего.`,
    priority: 'critical',
    channels: ['browser', 'toast', 'telegram'],
    cooldownHours: 24,
  },
  {
    // ♀ ULN 31 → 2.5×ВГН = 78: порог >100 для женщин — это уже ~3.2×ВГН.
    id: 'alt_critical_female',
    trigger: 'risk_threshold',
    condition: (s) => isFemale(s) && (s.labs.alt || 0) > LFT_SIGNAL_ULN.female,
    message: `⛔ АЛТ >${LFT_SIGNAL_ULN.female} Ед/л (2.5× женской ВГН 31) — гепатотоксичность: повтор + TUDCA. >${LFT_STAGE_ULN.stopOral.female} — отмена оралов, >${LFT_STAGE_ULN.stopAll.female} — отмена всего.`,
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

/**
 * Пометить уведомление показанным (стартует его cooldown) — для собственных
 * баннеров/тостов UI, которые сами решают, когда скрывать алерт.
 */
export function markNotificationShown(ruleId: string): void {
  try { markTriggered(ruleId); } catch { /* noop */ }
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
