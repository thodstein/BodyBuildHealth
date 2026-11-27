/**
 * lab-apk-all-providers.test.ts — АПК-путь «фото бланка → labs» для всех
 * четырёх обязательных лабораторий РФ одним прогоном.
 *
 * В нативном WebView серверных `./api/*` нет, поэтому узнавание идёт через
 * `recognizeImageTextOffline` → `parseLabTextAllWays`. Tesseract замокан:
 * `vi.hoisted` держит изменяемый текст текущего кейса, а `createWorker`
 * возвращает ровно его. Это проверяет не движок OCR, а то, что оффлайн-ветка
 * доводит распознанный текст каждого провайдера до канонических `labs` и
 * честно пишет про оффлайн-режим.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const offline = vi.hoisted(() => ({ text: '' }));

vi.mock('../app-platform', () => ({
  isNativeApp: () => true,
  isCapacitorNative: () => true,
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    setParameters: vi.fn(async () => {}),
    recognize: vi.fn(async () => ({ data: { text: offline.text } })),
    terminate: vi.fn(async () => {}),
  })),
}));

import { processUploadedFile } from '../ocr-engine';

const PROVIDERS = [
  {
    provider: 'helix',
    gluLow: 4.1,
    gluHigh: 5.9,
    text: `ХЕЛИКС
Лабораторная служба Хеликс
Показатель\tРезультат\tРеференсные значения\tЕд. изм.
Аланинаминотрансфераза (АЛТ)\t42\t<41\tЕд/л
Глюкоза в плазме\t5,8\t4,1-5,9\tммоль/л
Креатинин\t88\t74-110\tмкмоль/л
Тиреотропный гормон (ТТГ)\t1,8\t0,4-4,0\tмЕд/л`,
  },
  {
    provider: 'invitro',
    gluLow: 3.9,
    gluHigh: 5.5,
    text: `Инвитрo
Наименование\tРезультат\tРеференсные значения\tЕдиницы
АЛТ\t35\t<41\tЕ/л
Глюкоза\t5,O\t3,9-5,5\tммоль/л
Креатинин\t92\t62-106\tмкмоль/л
ТТГ\t2,I\t0,4-4,0\tмЕд/л`,
  },
  {
    provider: 'gemotest',
    gluLow: 3.9,
    gluHigh: 5.5,
    text: `ГеmоТесТ
Наименование\tРезультат\tРеференс\tЕд.
АЛТ\t38\t7-40\tЕ/л
Глюкоза\t5,1\t3,9-5,5\tммоль/л
Креатинин\t95\t62-106\tмкмоль/л
Кaлий\t4,8\t3,5-5,1\tммоль/л
Гемоглобин\t148\t130-170\tг/л`,
  },
  {
    provider: 'kdl',
    gluLow: 3.9,
    gluHigh: 5.5,
    text: `КДЛ
Наименование\tРезультат\tРеференс\tЕдиницы
АЛТ\t48\t<41\tЕ/л
ГЛЮКОЗА\t5,6\t3,9-5,5\tммоль/л
КРЕАТИНИН\t98\t62-106\tмкмоль/л
ТТГ\t2,8\t0,4-4,0\tмЕд/л
ГЕМОГЛОБИН\t140\t130-170\tг/л`,
  },
] as const;

describe('АПК-оффлайн: бланки Хеликс, ИНВИТРО, Гемотест, КДЛ', () => {
  beforeEach(() => {
    offline.text = '';
  });

  afterEach(() => {
    // Текст кейса не должен дожить до следующего: mock общий на файл.
    offline.text = '';
    vi.clearAllMocks();
  });

  it.each(PROVIDERS)(
    '$provider: фото → канонические labs + оффлайн-warning',
    async ({ provider, gluLow, gluHigh, text }) => {
      offline.text = text;
      const file = new File(['x'.repeat(64)], `${provider}.jpg`, { type: 'image/jpeg' });

      const result = await processUploadedFile(file, { purpose: 'labs' });
      const codes = result.labs.map((lab) => lab.code);

      expect(result.source).toBe('image');
      expect(codes).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE']));
      expect(result.labs.find((lab) => lab.code === 'GLU')).toMatchObject({
        unit: 'mmol/L',
        refLow: gluLow,
        refHigh: gluHigh,
      });
      for (const lab of result.labs) expect(lab.unit, `${lab.code}: пустая единица`).toBeTruthy();
      expect(result.warnings.join(' ')).toMatch(/оффлайн/i);
      expect(result.warnings.join(' ')).toContain(`Распознан бланк: ${provider}`);
    },
  );
});
