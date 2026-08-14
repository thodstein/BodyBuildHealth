import { describe, expect, it } from 'vitest';
import { parseProgressionRationale, progressionTiles, splitDescriptionPoints } from '../plan-card-helpers';

describe('plan-card-helpers: структуризация описаний плана (PED-стиль)', () => {
  it('parseProgressionRationale: дословно по источнику', () => {
    const info = parseProgressionRationale('Программа задана дословно по источнику (явная раскладка всех недель, без авто-прогрессии PM).');
    expect(info.explicitSource).toBe(true);
    expect(info.mode).toContain('Дословно');
    expect(progressionTiles(info)).toEqual([
      { l: 'Источник', v: 'Дословно (явная раскладка всех недель)' },
      { l: 'Прогрессия ПМ', v: 'Без авто-прогрессии' },
    ]);
  });

  it('parseProgressionRationale: натуральный режим с ПМ0/финалом/неделями', () => {
    const info = parseProgressionRationale('Натуральный режим: ПМ растёт на +0.50%/нед (прогрессия восходящая). ПМ0=100 кг → к 12 нед: 106.7 кг.');
    expect(info.explicitSource).toBe(false);
    expect(info.mode).toBe('Натуральный режим');
    expect(info.weeklyPct).toBe('+0.50');
    expect(info.pm0).toBe(100);
    expect(info.pmFinal).toBeCloseTo(106.7, 1);
    expect(info.weeks).toBe(12);
    const tiles = progressionTiles(info);
    expect(tiles.find(t => t.l === 'Режим')?.v).toBe('Натуральный режим');
    expect(tiles.find(t => t.l === 'Прирост ПМ')?.v).toBe('+0.50%/нед');
    expect(tiles.find(t => t.l === 'ПМ (старт)')?.v).toBe('100 кг');
    expect(tiles.find(t => t.l === 'ПМ (финал)')?.v).toBe('106.7 кг');
    expect(tiles.find(t => t.l === 'Цикл')?.v).toBe('12 нед');
  });

  it('parseProgressionRationale: макроцикл — заметки отдельными пунктами', () => {
    const info = parseProgressionRationale('Макроцикл: 3 СРЦ-блок(ов), 24 недель. База 1-8: Классический 12-нед; Сила 9-16: Жимовой; Пик 17-24: Присед.');
    expect(info.notes.length).toBe(1);
    expect(info.notes[0]).toContain('База 1-8');
    // Режим «Макроцикл» даёт одну плитку
    const tiles = progressionTiles(info);
    expect(tiles.length).toBe(1);
    expect(tiles[0]).toEqual({ l: 'Режим', v: 'Макроцикл' });
  });

  it('splitDescriptionPoints: разбивает пояснение недели на пункты', () => {
    const points = splitDescriptionPoints('Тапер-неделя: объём снижен (×0.65/×0.45), RIR +1/+2, интенсивность сохранена (Bosquet 2005). Разгрузка перед соревнованием.');
    expect(points.length).toBe(2);
    expect(points[0]).toContain('объём снижен');
    expect(points[1]).toContain('Разгрузка');
  });

  it('splitDescriptionPoints: пустая строка → пусто', () => {
    expect(splitDescriptionPoints('')).toEqual([]);
  });
});
