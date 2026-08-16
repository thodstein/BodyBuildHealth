import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrainingSafetyHub } from '../TrainingSafetyHub';

describe('TrainingSafetyHub', () => {
  it('shows and applies a reversible load correction', () => {
    let received: any = null;
    render(
      <TrainingSafetyHub
        input={{ source: 'bb_auto', workload: { acwrRatio: 1.6 } }}
        onApply={report => { received = report; }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Применить корректировку/i }));

    expect(received?.adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'volume_multiplier', value: 0.7 }),
    ]));
  });

  it('does not show the apply action without applicable adjustments', () => {
    render(<TrainingSafetyHub input={{ source: 'bb_auto' }} onApply={() => undefined} />);

    expect(screen.queryByRole('button', { name: /Применить корректировку/i })).toBeNull();
  });
});
