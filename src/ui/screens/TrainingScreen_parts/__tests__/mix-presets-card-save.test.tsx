/** mix-presets-card-save.test.tsx — smoke-тест попапа «Куда сохранено» в MixPresetsCard:
 *  подтверждение, согласие на план поддержки, итоговое окно, запись во все хранилища. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MixPresetsCard } from '../MixPresetsCard';
import { MIX_DIARY_KEY, FAVORITES_KEY, FAV_REC_KEY, PLAN_QUEUE_KEY } from '../../../../engines/training-plan-save.engine';

beforeEach(() => {
  localStorage.clear();
});

async function openPopup(): Promise<void> {
  render(<MixPresetsCard />);
  const btn = await screen.findByText('💾 Сохранить в дневник и избранное');
  fireEvent.click(btn);
}

describe('MixPresetsCard — попап сохранения', () => {
  it('открывает окно «Куда сохранится» с перечнем мест', async () => {
    await openPopup();
    expect(screen.getAllByText(/Сохранение пресета/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Дневник тренировок/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Избранное БАД/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Рекомендации/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Внести в план поддержки/).length).toBeGreaterThan(0);
  });

  it('сохраняет в дневник + избранное + рекомендации без очереди плана (чекбокс выключен)', async () => {
    await openPopup();
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(screen.getByText('✅ Сохранено')).toBeTruthy());
    const diary = JSON.parse(localStorage.getItem(MIX_DIARY_KEY) || '[]');
    expect(diary.length).toBe(1);
    expect(diary[0].kind).toBe('preset');
    expect(diary[0].substances.length).toBeGreaterThan(0);
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    expect(favs.length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem(FAV_REC_KEY) || '[]').length).toBe(1);
    expect(localStorage.getItem(PLAN_QUEUE_KEY) || '[]').toBe('[]');
  });

  it('по согласию вносит вещества в очередь плана поддержки', async () => {
    await openPopup();
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(screen.getByText('✅ Сохранено')).toBeTruthy());
    const queue = JSON.parse(localStorage.getItem(PLAN_QUEUE_KEY) || '[]');
    expect(queue.length).toBe(1);
    expect(queue[0].ids.length).toBeGreaterThan(0);
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    for (const id of queue[0].ids) expect(favs).toContain(id);
  });

  it('кнопка «Отмена» ничего не сохраняет', async () => {
    await openPopup();
    fireEvent.click(screen.getByText('Отмена'));
    expect(localStorage.getItem(MIX_DIARY_KEY)).toBeNull();
    expect(localStorage.getItem(FAVORITES_KEY)).toBeNull();
  });

  it('повторное сохранение не дублирует избранное (дедуп)', async () => {
    await openPopup();
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(screen.getByText('✅ Сохранено')).toBeTruthy());
    fireEvent.click(screen.getByText('Готово'));
    // открыть попап снова (новый рендер)
    const btn2 = await screen.findByText('💾 Сохранить в дневник и избранное');
    fireEvent.click(btn2);
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(screen.getByText('✅ Сохранено')).toBeTruthy());
    const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    expect(new Set(favs).size).toBe(favs.length);
    expect(JSON.parse(localStorage.getItem(MIX_DIARY_KEY) || '[]').length).toBe(2);
  });
});
