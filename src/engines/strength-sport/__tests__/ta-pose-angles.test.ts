import { describe, it, expect } from 'vitest';
import { parsePoseAnglesCsv, summarizePoseAngles, avgAnglesOfSummary } from '../strength-sport-pose.engine';
import { autoValidateAnglesFromPose, autoOHSFromPose } from '../strength-sport-biomechanics.engine';

describe('TA pose angles E8', () => {
  const CSV = 't,hip,knee,ankle,shoulder\n0,100,80,40,160\n0.1,95,70,38,155\n0.2,90,65,36,150';
  it('парсит CSV с заголовком', () => {
    const p = parsePoseAnglesCsv(CSV);
    expect(p?.length).toBe(3);
    expect(p?.[0]).toMatchObject({ t: 0, hip: 100, knee: 80, ankle: 40, shoulder: 160 });
  });
  it('точка с запятой + без заголовка', () => {
    const p = parsePoseAnglesCsv('0;100;80;40;160\n0.1;95;70;38;155');
    expect(p?.length).toBe(2);
    expect(p?.[1].knee).toBe(70);
  });
  it('мусор → null', () => {
    expect(parsePoseAnglesCsv('')).toBeNull();
    expect(parsePoseAnglesCsv('a,b\n1,2')).toBeNull();
    expect(parsePoseAnglesCsv(null as any)).toBeNull();
  });
  it('summary + средние', () => {
    const s = summarizePoseAngles(parsePoseAnglesCsv(CSV));
    expect(s?.n).toBe(3);
    expect(s?.knee?.avg).toBeCloseTo(71.7, 1);
    expect(s?.knee?.min).toBe(65);
    expect(avgAnglesOfSummary(s)).toMatchObject({ hip: 95, ankle: 38 });
  });
  it('валидация фаз + OHS из средних', () => {
    const s = summarizePoseAngles(parsePoseAnglesCsv(CSV));
    const v = autoValidateAnglesFromPose(avgAnglesOfSummary(s), ['snatch_catch', 'snatch_mid']);
    expect(v.length).toBe(2);
    expect(v.find(r => r.weakPoint === 'snatch_catch')?.valid).toBe(true); // knee 71.7 в [0,90]
    const o = autoOHSFromPose(avgAnglesOfSummary(s));
    expect(['ok', 'warn', 'critical']).toContain(o.level);
  });
});
