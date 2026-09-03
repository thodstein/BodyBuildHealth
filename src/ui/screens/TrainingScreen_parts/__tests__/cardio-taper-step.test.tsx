/**
 * cardio-taper-step.test.tsx — PRO taper-вкладка (раунд 3):
 * план по пред-нагрузке/усталости/сну → предпросмотр окна → применение с колбэком.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioTaperStep } from '../CardioTaperStep';
import { CardioManageStep } from '../CardioManageStep';
import { buildCardioCycle, type CardioCycle } from '../../../../engines/lms/cardio.engine';

function cut8(): CardioCycle {
  return buildCardioCycle({
    goal: 'cut',
    totalWeeks: 8,
    competitions: [{ id: 's1', name: 'Старт', week: 8 }],
    taper: false,
    peakWeek: false,
  });
}

describe('CardioTaperStep', () => {
  it('показывает план, окно изменений и применяет по клику', () => {
    const c = cut8();
    let applied: CardioCycle | null = null;
    let reason = '';
    render(<CardioTaperStep cycle={c} onApply={(n, r) => { applied = n; reason = r; }} />);
    // план-бейдж: длительность/срез/прогноз
    expect(screen.getByText(/14д · −50% · exp τ=4д/)).toBeTruthy();
    expect(screen.getByText(/прогноз \+1\.9%/)).toBeTruthy();
    // окно изменений: недели 6-7
    expect(screen.getByText(/Нед 6:/)).toBeTruthy();
    expect(screen.getByText(/Нед 7:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Применить taper/ }));
    expect(applied).not.toBeNull();
    expect(reason).toMatch(/индивид\. taper/);
    const w6 = (applied as unknown as CardioCycle).weeks.find(w => w.week === 6)!;
    expect(w6.phase).toBe('taper');
    expect(w6.sessions.some(s => s.type === 'hiit')).toBe(false);
  });

  it('F-OR удлиняет план до 21д и требует гигиену сна', () => {
    const c = cut8();
    render(<CardioTaperStep cycle={c} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Усталость F-OR/ }));
    expect(screen.getByText(/21д · −60% · exp τ=8д/)).toBeTruthy();
    expect(screen.getByText(/гигиена сна/)).toBeTruthy();
  });

  it('overload +20% удлиняет окно до 3 недель', () => {
    const c = cut8();
    render(<CardioTaperStep cycle={c} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Пред-нагрузка 20%/ }));
    expect(screen.getByText(/Нед 5:/)).toBeTruthy();
  });

  it('без цикла — пустое состояние', () => {
    render(<CardioTaperStep cycle={null} onApply={() => {}} />);
    expect(screen.getByText(/Нет активного цикла/)).toBeTruthy();
  });

  it('цикл с готовым taper-окном → «уже размечено», кнопка скрыта', () => {
    const c = cut8();
    let applied: CardioCycle | null = null;
    const { unmount } = render(<CardioTaperStep cycle={c} onApply={(n) => { applied = n; }} />);
    fireEvent.click(screen.getByRole('button', { name: /Применить taper/ }));
    expect(applied).not.toBeNull();
    unmount();
    render(<CardioTaperStep cycle={applied as unknown as CardioCycle} onApply={() => {}} />);
    expect(screen.getByText(/Изменений нет/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Применить taper/ })).toBeNull();
  });
});

describe('CardioManageStep — вкладка Тапер', () => {
  it('таб «Тапер» рендерит CardioTaperStep и пробрасывает onApplyTaper', () => {
    const c = cut8();
    let applied: CardioCycle | null = null;
    render(
      <CardioManageStep
        cycle={c} library={[]} scenarios={[]} link={null} macroLink={null} comparison={null}
        onLinkTo={() => {}} onUnlink={() => {}} onAttachMacro={() => {}} onDetachMacro={() => {}}
        onExport={() => {}} onPrint={() => {}} onDuplicate={() => {}} onActivate={() => {}}
        onSaveScenario={() => {}} onLoadScenario={() => {}} onRemoveScenario={() => {}}
        onCompare={() => {}} onRemove={() => {}} onChanged={() => {}}
        onApplyTaper={(n) => { applied = n; }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Тапер/ }));
    expect(screen.getByText(/Индивидуальный taper-план/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Применить taper/ }));
    expect(applied).not.toBeNull();
    expect((applied as unknown as CardioCycle).weeks.find(w => w.week === 7)!.phase).toBe('taper');
  });
});
