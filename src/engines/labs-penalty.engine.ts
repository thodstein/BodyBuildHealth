import { LabPoint, DiagnosticEntry, LabPhase, PenaltyResult } from '../core/types';
import { REQUIRED_LABS_PER_PHASE, REQUIRED_DIAGNOSTICS_PER_PHASE, PENALTY_THRESHOLDS } from '../core/constants';

export function calculateLabPenalty(
  currentPhase: LabPhase, 
  phaseDurationWeeks: number,
  existingLabs: LabPoint[],
  existingDiagnostics: DiagnosticEntry[]
): PenaltyResult {
  if (phaseDurationWeeks < 2) return { score:0, missingLabs:[], missingDiagnostics:[], action:'', affectsTrust:false };
  
  const reqLabs = REQUIRED_LABS_PER_PHASE[currentPhase] || [];
  const reqDx = REQUIRED_DIAGNOSTICS_PER_PHASE[currentPhase] || [];
  
  const labDates = existingLabs.filter(l=>l.phase===currentPhase).map(l=>new Date(l.date).getTime());
  const dxDates = existingDiagnostics.filter(d=>d.phase===currentPhase).map(d=>new Date(d.date).getTime());
  
  const missingLabs: string[] = [];
  const missingDx: string[] = [];
  
  // Проверяем, сдан ли маркер хотя бы раз за текущую фазу
  reqLabs.forEach(code => {
    const exists = existingLabs.some(l => l.code.toUpperCase()===code && l.phase===currentPhase);
    if(!exists) missingLabs.push(code);
  });
  reqDx.forEach(type => {
    const exists = existingDiagnostics.some(d => d.type===type && d.phase===currentPhase);
    if(!exists) missingDx.push(type);
  });
  
  // Расчёт штрафа: базовый вес маркеров 70%, диагностики 30%
  const labWeight = reqLabs.length > 0 ? (missingLabs.length / reqLabs.length) * 0.7 : 0;
  const dxWeight = reqDx.length > 0 ? (missingDx.length / reqDx.length) * 0.3 : 0;
  let score = Math.round((labWeight + dxWeight) * 100);
  
  // Коррекция по длительности курса (длинный курс без анализов = строже)
  if(phaseDurationWeeks > 8) score = Math.min(100, Math.round(score * 1.3));
  
  const action = score >= PENALTY_THRESHOLDS.critical 
    ? '⛔ Блокировка агрессивных режимов. Требуется сдать базовый чек-ап.' 
    : score >= PENALTY_THRESHOLDS.warning 
      ? '⚠️ Рекомендуется сдать анализы в течение 7 дней.' 
      : '';
      
  return {
    score, missingLabs, missingDiagnostics: missingDx, action,
    affectsTrust: score >= PENALTY_THRESHOLDS.warning
  };
}

export function generatePhaseSchedule(phase: LabPhase, startDate: string, durationWeeks: number): { nextLabs: string[], nextDiagnostics: string[], dueDate: string } {
  const start = new Date(startDate);
  const due = new Date(start.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000);
  const mid = new Date(start.getTime() + (durationWeeks/2) * 7 * 24 * 60 * 60 * 1000);
  
  // Длинный курс: обязательный чекап на середине
  const checkDate = durationWeeks > 8 ? mid : due;
  return {
    nextLabs: REQUIRED_LABS_PER_PHASE[phase] || [],
    nextDiagnostics: REQUIRED_DIAGNOSTICS_PER_PHASE[phase] || [],
    dueDate: checkDate.toISOString().slice(0,10)
  };
}