// ════════════════════════════════════════════════════════════════════════════
//  InteractionsLabels — локализованные лейблы (i18n-ready)
// ════════════════════════════════════════════════════════════════════════════
//  RU-локализация по умолчанию. Для добавления EN: добавить Record<'en', ...>
//  и хелпер pickLabels(locale).
// ════════════════════════════════════════════════════════════════════════════

import type { UnifiedSeverity, TimingInfo } from '../engines/interactions-calculator';

// ─── Severity meta ───
export interface SeverityMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

export const SEVERITY_META: Record<UnifiedSeverity, SeverityMeta> = {
  CRITICAL: { label: 'КРИТИЧНО', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.30)', icon: '🛑' },
  HIGH:     { label: 'ПРЕДУПРЕЖДЕНИЕ', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)', icon: '⚠️' },
  MEDIUM:   { label: 'ВНИМАНИЕ', color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.25)', icon: '⚡' },
  LOW:      { label: 'СИНЕРГИЯ', color: '#00e68a', bg: 'rgba(0,230,138,0.06)', border: 'rgba(0,230,138,0.25)', icon: '✨' },
  INFO:     { label: 'ИНФО', color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.20)', icon: 'ℹ️' },
};

// ─── Type labels (action icons) ───
export const TYPE_LABELS: Record<string, string> = {
  synergy: '⊕ Синергия',
  conflict: '⚡ Конфликт',
  caution: '⚠ Осторожно',
  danger: '🛑 Опасно',
  block: '🛑 Блок',
  warn: '⚠ Предупреждение',
  monitor: '👁 Мониторинг',
  info: 'ℹ Инфо',
};

// ─── Timing food labels ───
export const FOOD_LABELS: Record<NonNullable<TimingInfo['withFood']>, string> = {
  fasting: '⏰ Натощак',
  before_meal: '⏰ До еды',
  with_meal: '🍽 С едой',
  after_meal: '⏰ После еды',
  any: '⏰ Любое время',
};

// ─── Time of day labels ───
export const TIME_OF_DAY_LABELS: Record<NonNullable<TimingInfo['timeOfDay']>, string> = {
  morning: '🌅 Утром',
  noon: '☀️ Днём',
  evening: '🌆 Вечером',
  bedtime: '🛌 Перед сном',
};

// ─── Source labels (где запись родилась) ───
export const SOURCE_LABELS: Record<'support_db' | 'drug_interactions' | 'pharma_rules', string> = {
  support_db: 'БАД-каталог',
  drug_interactions: 'Drug-каталог',
  pharma_rules: 'AAS/PED правила',
};

// ─── Unified header labels ───
export const SECTION_LABELS = {
  autoAlerts: '🚨 Обнаруженные взаимодействия',
  autoAlertsDesc: 'Автоматически обнаруженные взаимодействия для выбранной комбинации препаратов',
  crossAlerts: '🔗 Кросс-взаимодействия с поддержкой',
  crossAlertsDesc: 'Взаимодействия между выбранными препаратами и веществами поддержки',
  noAlerts: '✅ Не обнаружено критических взаимодействий',
  noAlertsDesc: 'Для выбранных препаратов не найдено известных неблагоприятных взаимодействий. Однако всегда соблюдайте рекомендованные дозировки и мониторинг.',
  fieldMechanism: '⚙️ Механизм',
  fieldMechanismShort: 'Механизм',
  fieldRecommendation: '💊 Действие',
  fieldRecommendationShort: 'Рекомендация',
  fieldEffect: 'Суть',
} as const;

// ─── Фильтр-локализация ───
export const FILTER_LABELS = {
  onlyCritical: 'Только критичные',
  sortBySeverity: 'По серьёзности (критичные сверху)',
  showAll: 'Показать все',
} as const;
