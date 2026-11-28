/**
 * calc-substance-safety-evidence.test.tsx — этапы E3/E5 в карточке вещества.
 *
 * Карточка обязана показать три вещи, которых раньше не было:
 *  - замечание безопасности (`block`-DDI / второй реестр) — позиция при этом
 *    остаётся в плане;
 *  - доказательность ДОЗЫ (уровень + ссылки) — отдельно от `sub.q` механизма;
 *  - «расчёт, не назначение» у формульных доз препаратов.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CalcSubstanceDetail } from '../CalcSubstanceDetail';

function renderCard(extra: Record<string, unknown> = {}) {
  return render(
    <CalcSubstanceDetail
      sub={
        { substanceId: 'telmisartan', category: 'other', k: 0, reason: 'Ручной выбор', mechsCovered: [], q: 'B' } as any
      }
      rec={
        {
          subs: [],
          suppression: [],
          coverage: [],
          gaps: [],
          conflicts: [],
          guardrails: [],
          boosters: [],
          activatedMechs: [],
          summary: '',
          rationale: '',
          level: 'medium',
          phase: 'on',
          phaseLabel: 'На курсе',
        } as any
      }
      subNameRu={(id: string) => id}
      subDosage={() => ({ mg: 40, timing: 'утром' })}
      planDose={() => 40}
      doseIsElemental
      subTier={() => 'core'}
      canonIdLocal={(id: string) => id}
      {...extra}
    />,
  );
}

describe('карточка вещества: безопасность, доказательность дозы, дисклеймер', () => {
  it('safetyNote рендерится отдельным блоком', () => {
    const { container } = renderCard({ safetyNote: 'tadalafil + nitrates: фатальная гипотония' });
    const block = container.querySelector('[data-substance-safety]');
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain('фатальная гипотония');
  });

  it('evidence дозы рендерится чипом с уровнем и числом ссылок', () => {
    const { container } = renderCard({ planEvidence: { level: 'A', refs: ['FDA Micardis', 'ESC/ESH 2018'] } });
    const chip = container.querySelector('[data-substance-dose-evidence]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain('доза A');
    expect(chip!.textContent).toContain('2');
    expect(chip!.getAttribute('title')).toContain('FDA Micardis');
  });

  it('doseDisclaimer рендерится рядом с дозой', () => {
    const { container } = renderCard({ doseDisclaimer: 'Расчёт приложения, не назначение: дозу определяет врач.' });
    expect(container.querySelector('[data-substance-dose-note]')!.textContent).toContain('не назначение');
  });

  it('без пропсов — ни одного лишнего блока', () => {
    const { container } = renderCard();
    expect(container.querySelector('[data-substance-safety]')).toBeNull();
    expect(container.querySelector('[data-substance-dose-evidence]')).toBeNull();
    expect(container.querySelector('[data-substance-dose-note]')).toBeNull();
  });
});
