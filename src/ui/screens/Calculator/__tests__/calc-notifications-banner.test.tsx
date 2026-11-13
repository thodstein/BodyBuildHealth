/**
 * calc-notifications-banner.test.tsx — у алертов notification-engine появилась
 * UI-поверхность. До этого `checkNotifications` вызывался, а результат
 * отбрасывался: пороги (в т.ч. женские HCT/АЛТ/E2) считались «в пустоту».
 *
 * Гарды:
 *  - баннер рендерит сообщения и priority, × отдаёт id правила;
 *  - labs_overdue не дублируется (его показывает LabsDueBanner);
 *  - source-lock: результат checkNotifications в Calc.mapper попадает в состояние,
 *    а не выбрасывается.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { CalcNotificationsBanner, visibleCalcNotifications } from '../CalcNotificationsBanner';
import type { NotificationRule } from '../../../../engines/notification-engine';

const rule = (over: Partial<NotificationRule>): NotificationRule => ({
  id: 'rule_x',
  trigger: 'risk_threshold',
  condition: () => true,
  message: 'сообщение',
  priority: 'warning',
  channels: ['toast'],
  cooldownHours: 24,
  ...over,
});

describe('CalcNotificationsBanner', () => {
  it('пустой список → ничего не рендерит', () => {
    const { container } = render(<CalcNotificationsBanner rules={[]} onDismiss={() => {}} />);
    expect(container.querySelector('[data-calc-notifications]')).toBeNull();
  });

  it('рендерит сообщения и приоритеты', () => {
    const { container } = render(
      <CalcNotificationsBanner
        rules={[
          rule({ id: 'alt_critical', message: '⛔ АЛТ выше порога', priority: 'critical' }),
          rule({ id: 'prl_high', message: '⚠ Пролактин выше порога', priority: 'warning' }),
        ]}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('⛔ АЛТ выше порога')).toBeInTheDocument();
    expect(screen.getByText('⚠ Пролактин выше порога')).toBeInTheDocument();
    expect(container.querySelector('[data-calc-notif="alt_critical"]')?.getAttribute('data-calc-notif-priority')).toBe('critical');
    expect(container.querySelector('[data-calc-notif="prl_high"]')?.getAttribute('data-calc-notif-priority')).toBe('warning');
  });

  it('× отдаёт id правила в onDismiss', () => {
    const onDismiss = vi.fn();
    render(<CalcNotificationsBanner rules={[rule({ id: 'e2_crash_female' })]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Скрыть уведомление: e2_crash_female'));
    expect(onDismiss).toHaveBeenCalledWith('e2_crash_female');
  });

  it('visibleCalcNotifications убирает labs_overdue (у него свой баннер)', () => {
    const out = visibleCalcNotifications([
      rule({ id: 'labs_overdue' }),
      rule({ id: 'hct_high' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['hct_high']);
  });
});

describe('source-lock: Calc.mapper не выбрасывает уведомления', () => {
  it('checkNotifications кладётся в состояние calcNotifs', () => {
    const file = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'),
      'utf8',
    );
    expect(file).toContain('setCalcNotifs(visibleCalcNotifications(checkNotifications(notifState)))');
    expect(file).toContain('<CalcNotificationsBanner');
    expect(file).not.toContain('checkNotifications(notifState);');
  });
});
