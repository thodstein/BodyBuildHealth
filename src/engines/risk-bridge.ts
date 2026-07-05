/**
 * risk-bridge.ts — Общий мост между SupportScreen и RiskScreen.
 *
 * Проблема: SupportScreen считает риски через calculateSupportTZ (support-plan engine),
 * а RiskScreen пересчитывает через calculateTZRisk (risk-engine-tz.ts) — разные движки.
 *
 * Решение: SupportScreen пишет итоговые цифры в localStorage('he_risk_bridge').
 * RiskScreen и data-link.ts читают их напрямую, не пересчитывая.
 *
 * Ключи:
 *   he_risk_bridge = { riskBefore, riskAfter, systemBreakdown, mechanismDetail, subs, timestamp }
 *   he_support_risk = устаревший ключ (используется RiskScreen для subs, сохраняем для обратной совместимости)
 *
 * @module risk-bridge
 */

export interface RiskBridgeData {
  riskBefore: number;
  riskAfter: number;
  supportScore: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  mechanismDetail: Array<{ system: string; mechanism: string; risk: number; net: number }>;
  subs: string[];
  timestamp: number;
}

const BRIDGE_KEY = 'he_risk_bridge';

/** Записать риск-данные из SupportScreen после расчёта. */
export function writeRiskBridge(data: Omit<RiskBridgeData, 'timestamp'>): void {
  try {
    const bridge: RiskBridgeData = { ...data, timestamp: Date.now() };
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge));
  } catch { /* ignore */ }
}

/** Прочитать мост (возвращает null, если данных нет или они устарели > 1 час). */
export function readRiskBridge(): RiskBridgeData | null {
  try {
    const raw = localStorage.getItem(BRIDGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RiskBridgeData;
    if (!data.riskBefore && !data.riskAfter) return null;
    // Данные устаревают через 24 часа (план может поменяться)
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/** Быстрое получение только overall рисков (без разбора всей структуры). */
export function getBridgeRiskSummary(): { riskBefore: number; riskAfter: number; supportScore: number } | null {
  const d = readRiskBridge();
  if (!d) return null;
  return { riskBefore: d.riskBefore, riskAfter: d.riskAfter, supportScore: d.supportScore };
}

/** Получить net-риск по системе из моста. */
export function getBridgeSystemRisk(systemId: string): number | null {
  const d = readRiskBridge();
  if (!d || !d.systemBreakdown) return null;
  return d.systemBreakdown[systemId]?.net ?? null;
}
