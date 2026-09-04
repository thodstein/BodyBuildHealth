import { describe, it, expect } from 'vitest';
import {
  smPoseCheckFromCsv,
  diagnoseSMPoseCarry,
  diagnoseSMPoseOverhead,
  SM_POSE_NORMS,
} from '../strength-sport-sm-pose-check.engine';
import { summarizePoseAngles } from '../strength-sport-pose.engine';

const carryCsv = [
  // Парсер принимает 0-250: hip ROM 150→120 = 30 ∈ [30,46]; knee ROM 170→120 = 50 ∈ [43,65] (Hindle)
  't,hip,knee,ankle,shoulder',
  '0.00,150,170,90,170',
  '0.03,135,140,88,171',
  '0.06,120,120,85,170',
  '0.09,135,150,89,171',
  '0.12,150,170,90,170',
].join('\n');

describe('SM PRO v3c: pose-check', () => {
  it('нормы Hindle на месте', () => {
    expect(SM_POSE_NORMS.yokeHipRom.min).toBe(30);
    expect(SM_POSE_NORMS.yokeKneeRom.max).toBe(65);
    expect(SM_POSE_NORMS.overheadShoulderAvg).toBe(150);
  });
  it('carry CSV → ok (hip 30 / knee 50 в коридоре)', () => {
    const r = smPoseCheckFromCsv(carryCsv, 'yoke_walk');
    expect(r).not.toBeNull();
    expect(r!.result.n).toBe(5);
    expect(r!.result.verdict).toBe('ok');
  });
  it('укороченный ROM → warn', () => {
    const flat = ['t,hip,knee,ankle,shoulder', '0.00,20,10,90,170', '0.03,18,12,90,170', '0.06,16,14,90,170'].join('\n');
    const r = smPoseCheckFromCsv(flat, 'yoke_walk');
    expect(r!.result.verdict).not.toBe('ok');
  });
  it('лог shoulder <150 → warn, ≥150 → ok', () => {
    const low = summarizePoseAngles([
      { t: 0, hip: 10, knee: 20, ankle: 88, shoulder: 130 },
      { t: 0.03, hip: 10, knee: 20, ankle: 88, shoulder: 135 },
    ]);
    expect(diagnoseSMPoseOverhead(low!)!.verdict).toBe('warn');
    const high = summarizePoseAngles([
      { t: 0, hip: 10, knee: 20, ankle: 88, shoulder: 170 },
      { t: 0.03, hip: 10, knee: 20, ankle: 88, shoulder: 175 },
    ]);
    expect(diagnoseSMPoseOverhead(high!)!.verdict).toBe('ok');
  });
  it('farmer маппится отдельно от yoke', () => {
    const r = smPoseCheckFromCsv(carryCsv, 'farmers_walk_heavy');
    expect(r!.result.lift).toBe('farmers_walk');
  });
  it('мусор → null', () => {
    expect(smPoseCheckFromCsv('hello', 'yoke_walk')).toBeNull();
    expect(smPoseCheckFromCsv('', 'log_press')).toBeNull();
    expect(diagnoseSMPoseCarry(null as never)).toBeNull();
  });
});
