// ════════════════════════════════════════════════════════════════════════════
//  InteractionsTypes — общие типы для interactions
// ════════════════════════════════════════════════════════════════════════════
//  Изолированы от движка, чтобы UI/лейблы могли импортировать типы
//  без загрузки всего движка.
// ════════════════════════════════════════════════════════════════════════════

export type UnifiedSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type InteractionType = 'synergy' | 'conflict' | 'caution' | 'danger' | 'block' | 'warn' | 'monitor' | 'info';

export type InteractionSource = 'support_db' | 'drug_interactions' | 'pharma_rules';

export type WithFood = 'fasting' | 'before_meal' | 'with_meal' | 'after_meal' | 'any';

export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'bedtime';

export interface TimingInfo {
  /** Извлечённый интервал между приёмами: "2ч", "4ч", "48ч" */
  intervalHours?: number;
  /** Режим приёма: до еды / после еды / натощак / с едой / любое время */
  withFood?: WithFood;
  /** Время суток: утро / день / вечер / перед сном */
  timeOfDay?: TimeOfDay;
  /** Периодичность контроля: "каждые 2 нед", "каждые 4 нед" */
  monitoringPeriod?: string;
  /** Длительность приёма: "8 нед", "4-6 мес" */
  durationDays?: string;
}

export interface UnifiedInteraction {
  source: InteractionSource;
  a: string;
  b: string;
  type: InteractionType;
  severity: UnifiedSeverity;
  effect: string;
  mechanism: string;
  recommendation: string;
  /** Извлечённые тайминги из recommendation (для UI: "Принять с интервалом 2ч") */
  timing?: TimingInfo;
  raw: any;
}

export type Locale = 'ru' | 'en';
