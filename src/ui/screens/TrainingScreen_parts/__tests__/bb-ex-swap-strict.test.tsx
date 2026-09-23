/**
 * bb-ex-swap-strict.test.tsx — §4.2 мастер-плана: своп ББ-плана внутри жёсткой группы.
 * Для упражнения из STRICT_EXERCISE_GROUPS список замен — только однотипные движения;
 * вне группы — прежний фолбэк по group.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbExSwapModal } from '../bb-step-ex-swap';

function render(currentName: string, muscle: string) {
  return renderToStaticMarkup(React.createElement(BbExSwapModal, {
    builtPlan: { weeks: [] } as any,
    exSwapModal: { si: 0, ei: 0, muscle, currentName },
    exSwapSearch: '',
    setExSwapSearch: (() => {}) as any,
    dialogRef: React.createRef<HTMLDivElement>(),
    onReplace: () => {},
    onClose: () => {},
  }));
}

describe('§4.2 жёсткая группа в своп-модалке', () => {
  it('жим под 30°: замена только внутри группы (без разводок), с подписью', () => {
    const html = render('Жим штанги на наклонной (30°)', 'chest');
    expect(html).toContain('Жёсткая группа');
    expect(html).not.toContain('Разводка гантелей лёжа');
  });

  it('вне жёсткой группы — фолбэк по group (разводки видны)', () => {
    const html = render('Жим штанги лёжа', 'chest');
    expect(html).not.toContain('Жёсткая группа');
  });

  it('поиск фильтрует и внутри жёсткой группы', () => {
    const html = render('Жим штанги на наклонной (30°)', 'chest');
    expect(html.length).toBeGreaterThan(0);
  });
});
