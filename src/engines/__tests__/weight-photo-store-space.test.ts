/**
 * weight-photo-store-space.test.ts — база фотографий веса принадлежит пространству.
 *
 * Раньше это была ОДНА база с ключом «дата». В режиме тренера это значило: фото
 * двух атлетов за одну и ту же дату затирают друг друга (ключ совпадает), а
 * «удалить его данные» не удаляло фото вообще. Теперь у каждого пространства
 * своя база, как и у основной базы дневников.
 */
import { describe, it, expect } from 'vitest';
import {
  closeWeightPhotoDb,
  getWeightPhotos,
  memoryStore,
  saveWeightPhotos,
  weightPhotoDbNameFor,
} from '../weight-photo-store';
import { athleteSpaceId } from '../../core/data-space';

describe('база фото веса по пространствам', () => {
  it('home — прежнее имя: обновление ничего не переносит и не теряет', () => {
    expect(weightPhotoDbNameFor('home')).toBe('he_weight_photos_db');
    expect(weightPhotoDbNameFor('')).toBe('he_weight_photos_db');
  });

  it('у каждого атлета своё имя базы', () => {
    const a1 = weightPhotoDbNameFor(athleteSpaceId('a1'));
    const a2 = weightPhotoDbNameFor(athleteSpaceId('a2'));
    expect(a1).not.toBe(a2);
    expect(a1).not.toBe('he_weight_photos_db');
    expect(a1).toContain(athleteSpaceId('a1'));
  });

  it('закрытие соединения, которого нет, не падает', async () => {
    await expect(closeWeightPhotoDb('asp_none')).resolves.toBeUndefined();
  });

  it('в тестовой среде фото работают через память (апи не изменился)', async () => {
    memoryStore.clear();
    await saveWeightPhotos('2026-01-01', ['data:image/png;base64,AAA']);
    expect(await getWeightPhotos('2026-01-01')).toEqual(['data:image/png;base64,AAA']);
    memoryStore.clear();
  });
});
