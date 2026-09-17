/**
 * women-protocol-menu-e2e.test.tsx — этап D: живой путь из меню протоколов.
 * Клик по карточке «Женщины и ААС» открывает протокол; новые табы доступны.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupportProtocols } from '../SupportProtocols';

afterEach(cleanup);

const Shell: React.FC = () => {
  const [tab, setTab] = React.useState('');
  const [view, setView] = React.useState('menu');
  return (
    <SupportProtocols
      s={{
        protocolTab: tab,
        setProtocolTab: setTab,
        protocolView: view,
        setProtocolView: setView,
      }}
    />
  );
};

describe('women-protocol-menu-e2e (этап D)', () => {
  it('клик по карточке «Женщины и ААС» открывает протокол с новыми табами', () => {
    const { container, getByText } = render(<Shell />);
    fireEvent.click(getByText('Женщины и ААС'));
    expect(container.textContent).toContain('♀️ Женский цикл и ААС');
    // Новые табы доступны и рендерятся
    fireEvent.click(getByText('⚖️ Дозы веществ'));
    expect(container.textContent).toContain('Калькулятор Virilization Score');
    expect(container.textContent).toContain('Дигидроболденон');
    expect(container.textContent).toContain('Остарин');
    fireEvent.click(getByText('🧪 Поддержка'));
    expect(container.textContent).toContain('Спиронолактон');
    // Обратная кросс-ссылка из «Препаратов» на «Дозы» (таб переписан в §6.4:
    // движковые пороги/флаги; актуальная формулировка кросс-ссылки)
    fireEvent.click(getByText('💊 Препараты'));
    expect(container.textContent).toContain('в табе «⚖️ Дозы веществ»');
    expect(container.textContent).toContain('флаги вирилизации');
  });
});
