// ════════════════════════════════════════════════════════════════════════════
//  InteractionsLabels — локализованные лейблы (i18n-ready)
// ════════════════════════════════════════════════════════════════════════════
//  RU-локализация по умолчанию. Для добавления EN: добавить Record<'en', ...>
//  и хелпер pickLabels(locale).
// ════════════════════════════════════════════════════════════════════════════

import type { UnifiedSeverity, TimingInfo, Locale } from './interactions-types';

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

// EN translations (i18n-ready)
const SEVERITY_META_EN: Record<UnifiedSeverity, SeverityMeta> = {
  CRITICAL: { label: 'CRITICAL', color: SEVERITY_META.CRITICAL.color, bg: SEVERITY_META.CRITICAL.bg, border: SEVERITY_META.CRITICAL.border, icon: '🛑' },
  HIGH:     { label: 'WARNING', color: SEVERITY_META.HIGH.color, bg: SEVERITY_META.HIGH.bg, border: SEVERITY_META.HIGH.border, icon: '⚠️' },
  MEDIUM:   { label: 'CAUTION', color: SEVERITY_META.MEDIUM.color, bg: SEVERITY_META.MEDIUM.bg, border: SEVERITY_META.MEDIUM.border, icon: '⚡' },
  LOW:      { label: 'SYNERGY', color: SEVERITY_META.LOW.color, bg: SEVERITY_META.LOW.bg, border: SEVERITY_META.LOW.border, icon: '✨' },
  INFO:     { label: 'INFO', color: SEVERITY_META.INFO.color, bg: SEVERITY_META.INFO.bg, border: SEVERITY_META.INFO.border, icon: 'ℹ️' },
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

const TYPE_LABELS_EN: Record<string, string> = {
  synergy: '⊕ Synergy',
  conflict: '⚡ Conflict',
  caution: '⚠ Caution',
  danger: '🛑 Danger',
  block: '🛑 Block',
  warn: '⚠ Warning',
  monitor: '👁 Monitor',
  info: 'ℹ Info',
};

// ─── Timing food labels ───
export const FOOD_LABELS: Record<NonNullable<TimingInfo['withFood']>, string> = {
  fasting: '⏰ Натощак',
  before_meal: '⏰ До еды',
  with_meal: '🍽 С едой',
  after_meal: '⏰ После еды',
  any: '⏰ Любое время',
};

const FOOD_LABELS_EN: Record<NonNullable<TimingInfo['withFood']>, string> = {
  fasting: '⏰ Fasting',
  before_meal: '⏰ Before meal',
  with_meal: '🍽 With meal',
  after_meal: '⏰ After meal',
  any: '⏰ Anytime',
};

// ─── Time of day labels ───
export const TIME_OF_DAY_LABELS: Record<NonNullable<TimingInfo['timeOfDay']>, string> = {
  morning: '🌅 Утром',
  noon: '☀️ Днём',
  evening: '🌆 Вечером',
  bedtime: '🛌 Перед сном',
};

const TIME_OF_DAY_LABELS_EN: Record<NonNullable<TimingInfo['timeOfDay']>, string> = {
  morning: '🌅 Morning',
  noon: '☀️ Noon',
  evening: '🌆 Evening',
  bedtime: '🛌 Bedtime',
};

// ─── Source labels (где запись родилась) ───
export const SOURCE_LABELS: Record<'support_db' | 'drug_interactions' | 'pharma_rules', string> = {
  support_db: 'БАД-каталог',
  drug_interactions: 'Drug-каталог',
  pharma_rules: 'AAS/PED правила',
};

const SOURCE_LABELS_EN: Record<'support_db' | 'drug_interactions' | 'pharma_rules', string> = {
  support_db: 'Supplement DB',
  drug_interactions: 'Drug DB',
  pharma_rules: 'AAS/PED rules',
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

const SECTION_LABELS_EN = {
  autoAlerts: '🚨 Detected interactions',
  autoAlertsDesc: 'Automatically detected interactions for the selected combination',
  crossAlerts: '🔗 Cross-interactions with supplements',
  crossAlertsDesc: 'Interactions between selected drugs and supplement substances',
  noAlerts: '✅ No critical interactions detected',
  noAlertsDesc: 'No known adverse interactions found for the selected drugs. Always follow recommended dosages and monitoring.',
  fieldMechanism: '⚙️ Mechanism',
  fieldMechanismShort: 'Mechanism',
  fieldRecommendation: '💊 Action',
  fieldRecommendationShort: 'Action',
  fieldEffect: 'Effect',
} as const;

// ─── Фильтр-локализация ───
export const FILTER_LABELS = {
  onlyCritical: 'Только критичные',
  sortBySeverity: 'По серьёзности (критичные сверху)',
  showAll: 'Показать все',
} as const;

const FILTER_LABELS_EN = {
  onlyCritical: 'Critical only',
  sortBySeverity: 'By severity (critical first)',
  showAll: 'Show all',
} as const;

// ─── i18n helper: pickLabels(locale) ───
export interface SectionsLabels {
  autoAlerts: string;
  autoAlertsDesc: string;
  crossAlerts: string;
  crossAlertsDesc: string;
  noAlerts: string;
  noAlertsDesc: string;
  fieldMechanism: string;
  fieldMechanismShort: string;
  fieldRecommendation: string;
  fieldRecommendationShort: string;
  fieldEffect: string;
}
export interface FilterLabels {
  onlyCritical: string;
  sortBySeverity: string;
  showAll: string;
}
export interface LabelsBundle {
  SEVERITY_META: Record<UnifiedSeverity, SeverityMeta>;
  TYPE_LABELS: Record<string, string>;
  FOOD_LABELS: Record<NonNullable<TimingInfo['withFood']>, string>;
  TIME_OF_DAY_LABELS: Record<NonNullable<TimingInfo['timeOfDay']>, string>;
  SOURCE_LABELS: Record<'support_db' | 'drug_interactions' | 'pharma_rules', string>;
  SECTION_LABELS: SectionsLabels;
  FILTER_LABELS: FilterLabels;
}

export function pickLabels(locale: Locale = 'ru'): LabelsBundle {
  if (locale === 'en') {
    return {
      SEVERITY_META: SEVERITY_META_EN,
      TYPE_LABELS: TYPE_LABELS_EN,
      FOOD_LABELS: FOOD_LABELS_EN,
      TIME_OF_DAY_LABELS: TIME_OF_DAY_LABELS_EN,
      SOURCE_LABELS: SOURCE_LABELS_EN,
      SECTION_LABELS: SECTION_LABELS_EN,
      FILTER_LABELS: FILTER_LABELS_EN,
    };
  }
  return {
    SEVERITY_META,
    TYPE_LABELS,
    FOOD_LABELS,
    TIME_OF_DAY_LABELS,
    SOURCE_LABELS,
    SECTION_LABELS,
    FILTER_LABELS,
  };
}

// Глобальный locale (по умолчанию 'ru'). UI может переопределить через setLocale()
let _currentLocale: Locale = 'ru';
export function setLocale(loc: Locale): void {
  _currentLocale = loc;
  // Скринридеры читают по <html lang>: синхронизируем (обе платформы, no-op вне DOM).
  try {
    document.documentElement.setAttribute('lang', loc);
  } catch {
    /* non-DOM окружение (тесты движков) */
  }
}
export function getLocale(): Locale { return _currentLocale; }
export function t(): LabelsBundle { return pickLabels(_currentLocale); }
