/**
 * autoreg-mode-switch.test.tsx — Фаза 2 дедупа: единый селектор авторегуляции.
 *
 * Контракт: канонические метки/порядок (дневник → авто → выкл), onChange и
 * aria-pressed; в PLPlanView/PLCompetitionTab не осталось локальных копий
 * (segBtn/arBtn/«ВЫКЛ»-кнопок) — только общий компонент.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AutoRegModeSwitch, AUTOREG_MODE_LABELS } from '../AutoRegModeSwitch';

const readSrc = (name: string) => readFileSync(resolve(process.cwd(), 'src/ui/screens/SRCBBScreen_parts', name), 'utf8');

describe('AutoRegModeSwitch — единый селектор', () => {
  it('рендерит канонические метки и порядок, сообщает onChange', () => {
    const onChange = vi.fn();
    render(<AutoRegModeSwitch value="off" onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual([
      AUTOREG_MODE_LABELS.diary, AUTOREG_MODE_LABELS.auto, AUTOREG_MODE_LABELS.off,
    ]);
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText(AUTOREG_MODE_LABELS.auto));
    expect(onChange).toHaveBeenCalledWith('auto');
  });

  it('показывает подпись «Авторегуляция:» по флагу showTitleLabel', () => {
    render(<AutoRegModeSwitch value="auto" onChange={() => {}} size="md" showTitleLabel />);
    expect(screen.getByText('Авторегуляция:')).toBeTruthy();
  });

  it('дедуп: в PLPlanView/PLCompetitionTab нет локальных копий селектора', () => {
    for (const src of [readSrc('PLPlanView.tsx'), readSrc('PLCompetitionTab.tsx')]) {
      expect(src).not.toContain('segBtn(');
      expect(src).not.toContain('arBtn(');
      expect(src).toContain("from './AutoRegModeSwitch'");
      expect(src).toContain('<AutoRegModeSwitch');
    }
  });
});
