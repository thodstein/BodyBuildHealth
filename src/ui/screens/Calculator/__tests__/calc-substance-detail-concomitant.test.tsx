/**
 * calc-substance-detail-concomitant.test.tsx — карточка вещества честно
 * объясняет ПУСТОЙ список механизмов у сопутствующего препарата.
 *
 * Аудит 2026-11: НПВС/ГКС/иммунодепрессанты есть в каталоге ради
 * взаимодействий, но k-покрытия у них нет по определению. Без подписи
 * пустая карточка читалась как «по этому веществу ничего не известно».
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { CalcSubstanceDetail } from '../CalcSubstanceDetail';

afterEach(() => cleanup());

function renderDetail(substanceId: string) {
  return render(
    <CalcSubstanceDetail
      sub={{
        substanceId,
        category: 'other',
        k: 0,
        reason: 'Ручной выбор',
        mechsCovered: [],
        q: 'B',
      } as any}
      rec={{ subs: [], suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [], boosters: [], activatedMechs: [], summary: '', rationale: '', level: 'medium', phase: 'on', phaseLabel: 'На курсе' } as any}
      subNameRu={(id: string) => id}
      subDosage={() => ({ mg: 400, timing: 'с едой' })}
      subTier={() => 'standard'}
      canonIdLocal={(id: string) => id}
    />,
  );
}

function expand(container: HTMLElement) {
  const header = container.querySelector('.calc-substdetail > div') as HTMLElement;
  fireEvent.click(header);
  return container.textContent || '';
}

describe('CalcSubstanceDetail: сопутствующий препарат', () => {
  it('НПВС — «не участвует в покрытии риска», а не пустая карточка', () => {
    const { container } = renderDetail('ibuprofen');
    const text = expand(container);
    expect(text).toContain('Сопутствующий препарат');
    expect(text).toContain('не участвует в покрытии риска');
  });

  it('обычное вещество поддержки такой подписи не получает', () => {
    const { container } = renderDetail('nac');
    const text = expand(container);
    expect(text).not.toContain('Сопутствующий препарат');
  });
});
