/**
 * bb-taper-pro4-hygiene.test.ts — PRO-4 Э10: мёртвый код удалён, живые API и
 * про-слой на месте. Отдельно фиксируем честность аудита: PREP_POST_SHOW и
 * POSING_PROFILES оказались используемыми ВНУТРИ своих модулей — они остаются.
 */
import { describe, it, expect } from 'vitest';
import * as prepCycle from '../bb-prep-cycle.engine';
import * as prepSplits from '../bb-prep-splits';
import * as prepProcess from '../bb-prep-process.engine';
import * as peakPro from '../bb-peak-pro.engine';
import * as engine from '../bb-contest-prep.engine';

describe('PRO-4 Э10 — гигиена', () => {
  it('удалённые dead-экспорты отсутствуют', () => {
    expect('peakTrainingProfile' in prepCycle).toBe(false);
    expect('isKnownPrepCategory' in prepSplits).toBe(false);
  });

  it('используемые API остаются (аудит D10 уточнён по коду)', () => {
    expect('PREP_POST_SHOW' in prepProcess).toBe(true);   // внутри buildPrepProcess
    expect('POSING_PROFILES' in prepCycle).toBe(true);    // внутри posingProfileFor
    expect('coordinateLastHeavyDay' in engine).toBe(true);
    expect('planTwoShowSequence' in engine).toBe(true);
  });

  it('про-слой PRO-4 полностью экспортирован', () => {
    const names = [
      'PEAK_MONITOR_KEY', 'PEAK_MONITOR_DISCLAIMER',
      'sanitizePeakDayEntry', 'loadPeakWeekLog', 'savePeakWeekEntry', 'removePeakWeekEntry',
      'peakWeekDaysForPlan', 'peakDayForDate', 'peakWeekAdherence', 'peakWeekWeightTrace', 'peakWeekTrendAdvice',
      'buildPeakDayTimeline', 'SHOW_DAY_EMERGENCY', 'loadEmergencyContact', 'saveEmergencyContact',
      'sanitizeEmergencyContact', 'emergencyLines', 'showSequencePlan', 'femalePeakGuidance', 'cyclePhaseForDay',
      'prepLabCheckpoint', 'loadPrepLabsDate', 'savePrepLabsDate', 'postShowRecoveryProgress',
    ];
    for (const n of names) expect(n in peakPro, `нет экспорта ${n}`).toBe(true);
  });
});
