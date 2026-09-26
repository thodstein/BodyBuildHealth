/**
 * cardio-finish-honesty.test.ts — спринт 5.2 (аудит): finishCardioCycle больше
 * не ставит стамп под слой, который НЕ применился.
 *
 * Дефект: три слоя (мезо / каскад соревнований / персональные темпы) падали в
 * `catch { /* ignore *\/ }`, а стамп `mesoOn = true` / `paceEasySec = ...`
 * писался ВСЕГДА. План врал: UI восстанавливал «мезо включено» и заполненные
 * поля темпа, хотя в плане ничего не было применено.
 *
 * Контракт: стамп — только под факт; пропуск → config.finishNote + console.warn.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildCardioCycle } from '../cardio.engine';

/** Свежий модуль с одним слоем, который бросает исключение. */
async function finishWithThrowing(opts: {
  meso?: boolean; personal?: boolean;
}): Promise<typeof import('../cardio-templates.engine')> {
  vi.resetModules();
  if (opts.meso) {
    vi.doMock('../cardio-meso-progression.engine', async importOriginal => ({
      ...(await importOriginal<typeof import('../cardio-meso-progression.engine')>()),
      applyMesoMult: () => { throw new Error('мезо-сбой'); },
    }));
  }
  if (opts.personal) {
    vi.doMock('../cardio-personal-zones.engine', async importOriginal => ({
      ...(await importOriginal<typeof import('../cardio-personal-zones.engine')>()),
      applyPersonalTargetsToCycle: () => { throw new Error('темпы-сбой'); },
    }));
  }
  return import('../cardio-templates.engine');
}

const cycle = () => buildCardioCycle({ goal: 'health', totalWeeks: 6, id: 'finish-honesty' });

describe('finishCardioCycle: стамп только под факт', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.doUnmock('../cardio-meso-progression.engine'); vi.doUnmock('../cardio-personal-zones.engine'); });

  it('успешный путь: стампы на месте, заметки о пропуске нет (байт-в-байт)', async () => {
    const { finishCardioCycle } = await finishWithThrowing({});
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, id: 'finish-ok' });
    const out = finishCardioCycle(c, { mesoMult: 1.15, easyPaceSec: 320 });
    expect((out.config as Record<string, unknown>).mesoOn).toBe(true);
    expect((out.config as Record<string, unknown>).paceEasySec).toBe(320);
    expect((out.config as Record<string, unknown>).finishNote).toBeUndefined();
  });

  it('мезо упало → стампа НЕТ, есть честная заметка и warn', async () => {
    const { finishCardioCycle } = await finishWithThrowing({ meso: true });
    const out = finishCardioCycle(cycle(), { mesoMult: 1.15 });
    const cfg = out.config as Record<string, unknown>;
    expect(cfg.mesoOn).toBeUndefined();                       // план не врёт
    expect(String(cfg.finishNote)).toMatch(/мезо/);          // и говорит почему
    expect(console.warn).toHaveBeenCalled();                 // не молча
  });

  it('персональные цели упали → стампа темпа НЕТ, заметка называет слой', async () => {
    const { finishCardioCycle } = await finishWithThrowing({ personal: true });
    const out = finishCardioCycle(cycle(), { easyPaceSec: 320, ftpWatts: 250 });
    const cfg = out.config as Record<string, unknown>;
    expect(cfg.paceEasySec).toBeUndefined();
    expect(cfg.ftpWattsApplied).toBeUndefined();
    expect(String(cfg.finishNote)).toMatch(/темпы\/FTP/);
  });

  it('слой не запрашивали → пропуск не выдумывается (нет ложной тревоги)', async () => {
    const { finishCardioCycle } = await finishWithThrowing({ personal: true });
    const out = finishCardioCycle(cycle(), {});   // ничего не просим
    expect((out.config as Record<string, unknown>).finishNote).toBeUndefined();
  });
});
