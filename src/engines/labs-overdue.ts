// ════════════════════════════════════════════════════════════════════════════
//  LABS OVERDUE — определяет, какие системы/маркеры просрочены для сдачи.
//  Используется в баннере «Сдайте анализы» в калькуляторе поддержки.
//  ════════════════════════════════════════════════════════════════════════════

import { REQUIRED_LABS_PER_PHASE } from '../core/constants';
import { LAB_MARKER_MAP } from '../data/lab-marker-map';

export type OverdueSystemId =
  | 'hepatic'
  | 'cardio'
  | 'renal'
  | 'endocrine'
  | 'hematologic'
  | 'metabolic'
  | 'inflammatory';

export interface SystemOverdue {
  system: OverdueSystemId;
  icon: string;
  name: string;
  color: string;
  count: number;
  /** Полный список просроченных маркеров в системе (RU-имена) */
  markers: string[];
  /** Кол-во маркеров с tier-3 отклонениями (критичные) */
  criticalCount: number;
}

interface SystemMeta {
  icon: string;
  name: string;
  color: string;
}

const SYSTEM_META: Record<OverdueSystemId, SystemMeta> = {
  hepatic:      { icon: '🫁', name: 'Печень',       color: '#f59e0b' },
  cardio:       { icon: '❤️', name: 'ССС',         color: '#ef4444' },
  renal:        { icon: '💧', name: 'Почки',        color: '#3b82f6' },
  endocrine:    { icon: '🧬', name: 'Гормоны',      color: '#a78bfa' },
  hematologic:  { icon: '🩸', name: 'Кровь',        color: '#dc2626' },
  metabolic:    { icon: '🍬', name: 'Метаболизм',   color: '#10b981' },
  inflammatory: { icon: '🔥', name: 'Воспаление',   color: '#f97316' },
};

const PANEL_KEYS = [
  'panelBiochem', 'panelSex', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal',
  'panelMineral', 'panelTumor', 'panelUrinalysis',
] as const;

const MARKER_RENAME: Record<string, string> = {
  'Total T': 'TESTOSTERONE', 'Free T': 'FREE_TESTOSTERONE', 'E2': 'ESTRADIOL',
  'Bilirubin': 'BILIRUBIN', 'Uric acid': 'URIC_ACID', 'HCT': 'HEMATOCRIT',
  'Hemoglobin': 'HEMOGLOBIN', 'Total Cholesterol': 'TOTAL_CHOLESTEROL',
  'Triglycerides': 'TRIGLYCERIDES', 'T3 free': 'T3_FREE', 'T4 free': 'T4_FREE',
  'Anti-TPO': 'ANTI_TPO', 'Anti-TG': 'ANTI_TG', 'Vitamin D (25-OH)': 'VITAMIN_D',
  'Transferrin Sat': 'TRANSFERRIN_SAT', 'CK-MB': 'CK_MB', 'D-dimer': 'D_DIMER',
  'IL-6': 'IL_6', 'TNF-alpha': 'TNF_ALPHA', 'DHEA-S': 'DHEA_S', '3a-ADG': '3A_ADG',
  'PSA total': 'PSA_TOTAL', 'PSA free': 'PSA_FREE', 'CA-125': 'CA_125', 'Lp(a)': 'LP_A',
};

export interface LabSliceLike {
  date?: string;
  panelBiochem?: Record<string, string>;
  panelSex?: Record<string, string>;
  panelHematology?: Record<string, string>;
  panelThyroid?: Record<string, string>;
  panelLipid?: Record<string, string>;
  panelIron?: Record<string, string>;
  panelVitamin?: Record<string, string>;
  panelCardiac?: Record<string, string>;
  panelCoagulation?: Record<string, string>;
  panelInflammatory?: Record<string, string>;
  panelAdrenal?: Record<string, string>;
  panelMineral?: Record<string, string>;
  panelTumor?: Record<string, string>;
  panelUrinalysis?: Record<string, string>;
}

export interface OverdueInput {
  fullPanel: LabSliceLike | null | undefined;
  phase?: string;
  /** Время последней сдачи (если нет fullPanel). Если старше 4 нед — баннер. */
  lastLabDate?: string;
  /** Текущая дата (для тестируемости) */
  now?: Date;
  /** Макс. число систем в результате (по умолчанию 3) */
  maxSystems?: number;
}

function getMarkerSystem(code: string): OverdueSystemId | null {
  const upper = code.toUpperCase();
  const byMarker = LAB_MARKER_MAP.find(m => m.marker.toUpperCase() === upper);
  if (byMarker && (byMarker.system as OverdueSystemId) in SYSTEM_META) {
    return byMarker.system as OverdueSystemId;
  }
  return null;
}

function getMarkerNameRu(code: string): string {
  const upper = code.toUpperCase();
  const byMarker = LAB_MARKER_MAP.find(m => m.marker.toUpperCase() === upper);
  if (byMarker) return byMarker.name;
  return code;
}

function resolvePhaseKey(phase?: string): keyof typeof REQUIRED_LABS_PER_PHASE {
  const p = (phase || '').toLowerCase();
  if (p === 'course' || p === 'on_cycle') return 'on_cycle';
  if (p === 'bridge') return 'bridge';
  if (p === 'pct') return 'pct';
  if (p === 'post_pct') return 'post_pct';
  if (p === 'base' || p === 'trt') return 'baseline';
  return 'on_cycle';
}

function extractSubmittedMarkers(fp: LabSliceLike | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!fp) return out;
  for (const pk of PANEL_KEYS) {
    const panel = (fp as any)[pk] as Record<string, string> | undefined;
    if (!panel) continue;
    for (const [marker, val] of Object.entries(panel)) {
      if (!val) continue;
      const num = parseFloat(val);
      if (isNaN(num)) continue;
      const rename = MARKER_RENAME[marker] || marker.toUpperCase().replace(/\s+/g, '_');
      out.add(rename);
    }
  }
  return out;
}

function isLabOverdueByDate(lastLabDate: string | undefined, now: Date): boolean {
  if (!lastLabDate) return true;
  const last = new Date(lastLabDate).getTime();
  if (isNaN(last)) return true;
  const weeks = (now.getTime() - last) / (7 * 24 * 3600 * 1000);
  return weeks >= 4;
}

/**
 * Возвращает массив систем с просроченными маркерами, отсортированный по
 * severity (tier-3 отклонения > кол-во маркеров > алфавит).
 *
 * Пустой массив = всё актуально, баннер не показывается.
 */
export function computeOverdueSystems(input: OverdueInput): SystemOverdue[] {
  const max = input.maxSystems ?? 3;
  const now = input.now ?? new Date();

  // Если пользователь не на курсе/ПКТ/мосту — анализы не обязательны
  const phase = (input.phase || '').toLowerCase();
  if (phase === 'none' || phase === '' ) return [];

  // Проверка: срок сдачи. Если lastLabDate указан и свежий (< 4 нед) — баннер не нужен,
  // даже если в fullPanel не все маркеры.
  if (input.lastLabDate && !isLabOverdueByDate(input.lastLabDate, now)) {
    return [];
  }

  const phaseKey = resolvePhaseKey(input.phase);
  const required = REQUIRED_LABS_PER_PHASE[phaseKey] || [];
  const submitted = extractSubmittedMarkers(input.fullPanel);

  const missing = required.filter(code => !submitted.has(code.toUpperCase()));
  if (missing.length === 0) return [];

  const bySystem = new Map<OverdueSystemId, string[]>();
  for (const code of missing) {
    const sys = getMarkerSystem(code);
    if (!sys) continue;
    if (!bySystem.has(sys)) bySystem.set(sys, []);
    bySystem.get(sys)!.push(code);
  }

  const result: SystemOverdue[] = [];
  for (const [system, codes] of bySystem) {
    const meta = SYSTEM_META[system];
    const markers = codes.map(c => getMarkerNameRu(c));
    result.push({
      system,
      icon: meta.icon,
      name: meta.name,
      color: meta.color,
      count: codes.length,
      markers,
      criticalCount: 0,
    });
  }

  // Сортировка: кол-во маркеров desc, потом по имени
  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'ru');
  });

  return result.slice(0, max);
}

/**
 * Суммарное число просроченных маркеров (для отображения «N маркеров»).
 */
export function countOverdueMarkers(systems: SystemOverdue[]): number {
  return systems.reduce((s, x) => s + x.count, 0);
}
