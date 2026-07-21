import { useState, useEffect, useCallback } from 'react';
import { getTimingTelemetry } from '../../engines/interactions-calculator';

export interface TelemetryState {
  total: number;
  matched: number;
  missRate: number;
}

export interface UseTimingTelemetryResult {
  state: TelemetryState;
  reset: () => void;
  /** Обновить snapshot из singleton (вызывать вручную или через polling) */
  refresh: () => void;
  /** Средний miss rate за последние N вызовов (если нужно для графика) */
  shouldImprove: boolean;
}

/**
 * React-хук для dev-mode dashboard: читает singleton telemetry и форсит re-render
 * после каждого изменения. Использовать в <TimingTelemetryPanel/>.
 */
export function useTimingTelemetry(autoRefreshMs = 2000): UseTimingTelemetryResult {
  const [state, setState] = useState<TelemetryState>(() => {
    const t = getTimingTelemetry();
    return { total: t.total, matched: t.matched, missRate: t.missRate };
  });

  const refresh = useCallback(() => {
    const t = getTimingTelemetry();
    setState({ total: t.total, matched: t.matched, missRate: t.missRate });
  }, []);

  const reset = useCallback(() => {
    getTimingTelemetry().reset();
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefreshMs <= 0) return;
    const id = setInterval(refresh, autoRefreshMs);
    return () => clearInterval(id);
  }, [refresh, autoRefreshMs]);

  return {
    state,
    reset,
    refresh,
    shouldImprove: state.missRate > 0.3 && state.total >= 10,
  };
}
