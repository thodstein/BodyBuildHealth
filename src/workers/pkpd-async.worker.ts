import { calculateMultiSubstancePKPD } from '../engines/pkpd-superposition.engine';
import type { CourseEntry, BayesianState } from '../core/types';

let isRunning = false;
let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, course, weeks, bayesian } = e.data;

  if (type === 'CALCULATE_PKPD') {
    if (isRunning) return;
    isRunning = true;
    cancelled = false;

    try {
      self.postMessage({ type: 'PKPD_PROGRESS', id, progress: 0 });
      
      // Запуск точного многокомпонентного расчёта
      const result = calculateMultiSubstancePKPD(
        course as CourseEntry[],
        weeks as number,
        bayesian as BayesianState
      );

      if (!cancelled) {
        self.postMessage({ type: 'PKPD_PROGRESS', id, progress: 100 });
        self.postMessage({ type: 'PKPD_RESULT', id, status: 'success', data: result });
      }
    } catch (err) {
      self.postMessage({ type: 'PKPD_RESULT', id, status: 'error', error: String(err) });
    } finally {
      isRunning = false;
      cancelled = false;
    }
  }

  if (type === 'CANCEL_PKPD') {
    cancelled = true;
    isRunning = false;
    self.postMessage({ type: 'PKPD_RESULT', id: id || 'cancelled', status: 'cancelled' });
  }
};

export {};