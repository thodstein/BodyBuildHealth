import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { PLATFORM_WR } from '../arm-platform.engine';
import {
  armPlanExportBlockReasons,
  ArmPlanExportBlockedError,
  buildArmPrintHtml,
  buildArmIcs,
  isArmPlanExportBlocked,
} from '../arm-export.engine';

describe('arm-export', () => {
  const plan: any = (() => {
    let p: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:4 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    return p;
  })();
  it('print html contains plan name and weeks', () => {
    const html = buildArmPrintHtml(plan);
    expect(html).toContain(plan.pattern.name);
    expect(html).toContain('Неделя 1');
    expect(html).toContain('PRO:');
    // было→стало: WR RT берётся из канона PLATFORM_WR, а не из зашитых 130.5/77.2.
    const rt = PLATFORM_WR.rolling_thunder;
    expect(html).toContain(`WR Rolling Thunder M ${rt.maleKg} / F ${rt.femaleKg}`);
    expect(html).not.toContain('F 77.2');
  });
  it('ics contains VCALENDAR and events', () => {
    const ics = buildArmIcs(plan, '2026-09-01');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART');
    expect(ics).toContain('Арм Н1');
  });
  it('ICS: day 8 (LegsCore) прижимается к 7-му дню недели, UID сохраняет day', () => {
    const base: any = plan.weeks[0].sessions[0];
    const p: any = {
      ...plan,
      weeks: [{
        ...plan.weeks[0],
        sessions: [
          { ...base, day: 7, sessionTag: 'A', exercises: [] },
          { ...base, day: 8, sessionTag: 'LegsCore', exercises: [] },
        ],
      }],
    };
    const ics = buildArmIcs(p, '2026-09-01');
    const d7 = ics.match(/UID:arm-1-7@bbhealth\r\nDTSTART:(\d{8})T/);
    const d8 = ics.match(/UID:arm-1-8@bbhealth\r\nDTSTART:(\d{8})T/);
    expect(d7?.[1]).toBeTruthy();
    expect(d8?.[1]).toBe(d7?.[1]); // clamp 1..7, а не восьмой день
  });
  it('ics escaping', () => {
    const ics = buildArmIcs(plan);
    expect(ics).not.toContain('\n\n');
  });
  it('print без movement — блока движения нет (байт-в-байт)', () => {
    const html = buildArmPrintHtml(plan);
    expect(html).not.toContain('Движение схватки');
  });
  it('print с movement — блок + XSS-escape', () => {
    const html = buildArmPrintHtml(plan, {
      movement: {
        matchPhase: 'mid',
        startNote: 'Реакция 280мс',
        vectorNote: 'Слабый вектор: бок',
        foulNote: 'Фол-рейт 0.2',
        tableStrengthNote: 'Слабое звено: пронация',
        humerusDangerNote: '<script>alert(1)</script>',
      },
    });
    expect(html).toContain('Движение схватки');
    expect(html).toContain('Слабое звено: пронация');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('PRO-6 M11: print без armliftMovement — блока нет; с ним — блок + XSS-escape', () => {
    expect(buildArmPrintHtml(plan)).not.toContain('Движение армлифтинга');
    const html = buildArmPrintHtml(plan, { armliftMovement: ['фаза срыва: Протяжка', '<script>alert(1)</script>'] });
    expect(html).toContain('Движение армлифтинга');
    expect(html).toContain('фаза срыва: Протяжка');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('blocked-план не экспортируется ни в print, ни в ICS', () => {
    const blocked = {
      ...plan,
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        status: 'blocked' as const,
        blocked: ['Ось humerus high', 'Ось humerus high'],
      },
    };
    expect(isArmPlanExportBlocked(blocked)).toBe(true);
    expect(armPlanExportBlockReasons(blocked)).toEqual(['Ось humerus high']);
    expect(() => buildArmPrintHtml(blocked)).toThrow(ArmPlanExportBlockedError);
    expect(() => buildArmIcs(blocked)).toThrow(/Экспорт арм-плана заблокирован/);
  });

  it('warning- и legacy-invalid-планы экспортируются', () => {
    const warning = {
      ...plan,
      validation: { valid: false, errors: [], warnings: ['Проверить баланс'], status: 'warning' as const, blocked: [] },
    };
    expect(isArmPlanExportBlocked(warning)).toBe(false);
    expect(buildArmPrintHtml(warning)).toContain(plan.pattern.name);
    expect(buildArmIcs(warning)).toContain('BEGIN:VCALENDAR');
  });
});
