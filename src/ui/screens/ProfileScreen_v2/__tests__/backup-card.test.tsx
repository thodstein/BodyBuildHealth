/**
 * backup-card.test.tsx — «Полная копия данных» в настройках (4.2).
 *
 * Это не экспорт профиля: профиль без дневников/анализов после смены телефона
 * почти бесполезен. Проверяем не только кнопки, но и границы: восстановление
 * спрашивает подтверждение и показывает, что именно заменит; чужой/битый файл
 * не запускает замену; в тексте честно сказано, чего в бэкапе нет.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const exportMock = vi.fn(async () => ({
  name: 'health-engine-backup-2026-11-02.json',
  text: '{"app":"health-engine","version":"2.0"}',
}));
const importMock = vi.fn(async () => {});

vi.mock('../../../../core/data-backup', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../core/data-backup')>();
  return {
    ...actual,
    backupFile: () => exportMock(),
    importBackup: (b: unknown) => importMock(b),
  };
});

vi.mock('../../../../core/apk-share', () => ({
  saveTextFileApk: vi.fn(async () => 'saved'),
  copyOrShareText: vi.fn(async () => 'copied'),
  shareOutcomeLabel: (o: string) => `outcome:${o}`,
}));

import { saveTextFileApk } from '../../../../core/apk-share';

const VALID_BACKUP = JSON.stringify({
  app: 'health-engine',
  version: '2.0',
  createdAt: '2026-11-01T10:20:00.000Z',
  stores: {},
  spaceStores: {
    home: { training_log: [{}, {}] },
    asp_a1: { labs_log: [{}, {}] },
  },
  localStorage: { he_profile_v2: '{}' },
});

describe('настройки: полная резервная копия', () => {
  let createdInputs: HTMLInputElement[] = [];
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let originalCreate: typeof document.createElement;
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    localStorage.clear();
    createdInputs = [];
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Восстановление заканчивается перезагрузкой: в jsdom это «navigation»,
    // которая на самом деле не реализована — подменяем, чтобы ловить вызов.
    originalLocation = window.location;
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });
    originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: unknown[]) => {
      const el = (originalCreate as unknown as (t: string, ...r: unknown[]) => HTMLElement)(tag, ...rest);
      if (tag === 'input') createdInputs.push(el as HTMLInputElement);
      return el;
    }) as unknown as typeof document.createElement);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    localStorage.clear();
  });

  const openExportSection = (container: HTMLElement) => {
    const header = Array.from(container.querySelectorAll('button')).find(b =>
      (b.textContent || '').includes('4.2 Экспорт'),
    );
    if (!header) throw new Error('секция 4.2 не найдена');
    fireEvent.click(header);
  };

  const pickFile = async (container: HTMLElement, text: string) => {
    fireEvent.click(container.querySelector('[data-backup="import"]') as HTMLElement);
    const input = createdInputs.find(i => i.type === 'file');
    expect(input).toBeTruthy();
    const file = new File([text], 'backup.json', { type: 'application/json' });
    Object.defineProperty(input as HTMLInputElement, 'files', { value: [file], configurable: true });
    fireEvent.change(input as HTMLInputElement);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
  };

  it('кнопки полной копии есть, и текст честно говорит, чего в файле нет', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    expect(container.querySelector('[data-backup="export"]')).toBeTruthy();
    expect(container.querySelector('[data-backup="import"]')).toBeTruthy();
    const note = container.querySelector('[data-backup="note"]')?.textContent ?? '';
    expect(note).toContain('фотографий веса');
    expect(note).toContain('черновиков');
    // и прямо сказано, чем это отличается от копии профиля выше
    expect(container.textContent).toContain('Копия профиля выше несёт только профиль');
  });

  it('экспорт собирает файл и отдаёт его в сохранение', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    fireEvent.click(container.querySelector('[data-backup="export"]') as HTMLElement);
    await waitFor(() => expect(saveTextFileApk).toHaveBeenCalled());
    const call = vi.mocked(saveTextFileApk).mock.calls[0];
    expect(call[0]).toBe('health-engine-backup-2026-11-02.json');
    expect(call[1]).toContain('"app":"health-engine"');
  });

  it('битый файл не запускает замену данных', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    fireEvent.click(container.querySelector('[data-backup="import"]') as HTMLElement);
    const input = createdInputs.find(i => i.type === 'file') as HTMLInputElement;
    const file = new File(['{"hello":"world"}'], 'x.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(importMock).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('подтверждение называет дату, объём и последствия до восстановления', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    await pickFile(container, VALID_BACKUP);

    const asked = String(confirmSpy.mock.calls[0][0]);
    expect(asked).toContain('2026-11-01');
    expect(asked).toContain('2 пространств');
    expect(asked).toContain('4 записей в базе');
    expect(asked).toContain('1 настроек');
    expect(asked).toContain('ЗАМЕНИТ все данные');
    expect(asked).toContain('Фотографии веса и черновики в файл не входят');
    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('после восстановления перезагружает приложение, чтобы не осталось старых данных в памяти', async () => {
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    await pickFile(container, VALID_BACKUP);
    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
  });

  it('отказ в подтверждении оставляет данные как были', async () => {
    confirmSpy.mockReturnValue(false);
    const { ProfileSettingsTab } = await import('../ProfileSettingsTab');
    const { container } = render(<ProfileSettingsTab />);
    openExportSection(container);
    await pickFile(container, VALID_BACKUP);
    expect(importMock).not.toHaveBeenCalled();
  });
});
