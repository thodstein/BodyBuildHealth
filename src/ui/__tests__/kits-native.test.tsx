/**
 * kits-native.test.tsx — UI-киты: native-хуки (классы/data-active) на месте,
 * поведение не изменилось на обеих платформах.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModernPill, ModernHero } from '../screens/NutritionScreen_parts/nutrition-modern-kit';
import { SegmentedChips, HeroCard } from '../screens/TrainingScreen_parts/CardioUI';
import { ChipToggle } from '../screens/strength-sport/StrengthUI';
import { LabsSectionHeader } from '../screens/LabsScreen_parts/LabsUI';
import { AccordionSection } from '../screens/ProfileScreen_v2/ui';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  await resetPlatform();
});

describe('native kit hooks', () => {
  it('1. ModernPill несёт класс и data-active', () => {
    const { container, rerender } = render(
      <ModernPill active={false} onClick={() => {}}>
        Тест
      </ModernPill>,
    );
    const btn = container.querySelector('.modern-pill') as HTMLElement;
    expect(btn?.dataset.active).toBe('false');
    rerender(
      <ModernPill active={true} onClick={() => {}}>
        Тест
      </ModernPill>,
    );
    expect(btn?.dataset.active).toBe('true');
  });

  it('2. ModernHero рендерит заголовок и статистику', () => {
    render(
      <ModernHero
        icon="📊"
        title="Обзор"
        subtitle="Сводка"
        stats={[{ k: 'ккал', v: 2500, sub: 'цель', col: '#c9f73a', bg: 'rgba(0,0,0,0.2)' }]}
      />,
    );
    expect(screen.getByText('Обзор')).not.toBeNull();
    expect(screen.getByText('2500')).not.toBeNull();
  });

  it('3. SegmentedChips переключаются и маркируют active', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedChips
        options={[
          { value: 'a', label: 'Альфа' },
          { value: 'b', label: 'Бета' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    const chips = container.querySelectorAll('.kit-chip');
    expect(chips.length).toBe(2);
    expect((chips[0] as HTMLElement).dataset.active).toBe('true');
    fireEvent.click(chips[1]);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('4. HeroCard и ChipToggle рендерятся с хуками', () => {
    const { container } = render(
      <>
        <HeroCard icon="🏋️" title="Кардио" subtitle="Подзаголовок" />
        <ChipToggle active={true} onClick={() => {}}>
          Чип
        </ChipToggle>
      </>,
    );
    expect(container.querySelector('.kit-hero')).not.toBeNull();
    const chip = container.querySelector('.kit-chiptoggle') as HTMLElement;
    expect(chip?.dataset.active).toBe('true');
  });

  it('5. LabsSectionHeader показывает заголовок', () => {
    const { container } = render(
      <LabsSectionHeader icon="🧪" title="Панель" subtitle="Подзаголовок" />,
    );
    expect(container.querySelector('.labs-sec-head')).not.toBeNull();
    expect(screen.getByText('Панель')).not.toBeNull();
  });

  it('6. AccordionSection раскрывается по клику', () => {
    const { container } = render(
      <AccordionSection title="Секция" icon="👤">
        <div>Тело секции</div>
      </AccordionSection>,
    );
    expect(container.querySelector('.profile-accordion')).not.toBeNull();
    expect(screen.queryByText('Тело секции')).toBeNull();
    fireEvent.click(screen.getByText('Секция'));
    expect(screen.getByText('Тело секции')).not.toBeNull();
  });
});
