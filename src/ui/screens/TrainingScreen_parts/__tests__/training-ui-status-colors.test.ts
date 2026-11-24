import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CANONICAL_STATUS_COLOR } from '../../../../engines/volume-canonical.engine';
import { VOLUME_STATUS_META } from '../volume-recommendation';
import { mrvBadge } from '../training-ui';

/**
 * Замок на расхождение цветов статусов объёма. Раньше каждая таблица держала
 * свою карту: «Бюджет объёма» и «Качество» красили «недотрен» синим (#60a5fa),
 * оптимизатор — красным, а в каноне синий закреплён за «maintenance». Теперь
 * единственный источник — VOLUME_STATUS_META с цветом из CANONICAL_STATUS_COLOR.
 */
const statuses = ['below_mev', 'optimal', 'approaching_mrv', 'exceeding_mrv'] as const;

describe('VOLUME_STATUS_META: цвет статуса берётся из канона', () => {
  it('каждый статус совпадает с CANONICAL_STATUS_COLOR', () => {
    for (const status of statuses) {
      expect(VOLUME_STATUS_META[status].color, status).toBe(CANONICAL_STATUS_COLOR[status]);
    }
  });

  it('«близко к MRV» — янтарный, «недотрен» — красный (раньше было наоборот)', () => {
    expect(VOLUME_STATUS_META.approaching_mrv.color).toBe('#f59e0b');
    expect(VOLUME_STATUS_META.below_mev.color).toBe('#ef4444');
  });

  it('mrvBadge рисует тем же цветом', () => {
    for (const status of statuses) {
      expect(mrvBadge(status).color, status).toBe(VOLUME_STATUS_META[status].color);
    }
  });
});

describe('таблицы объёма не держат своих цветовых карт', () => {
  it.each(['VolumeBudgetCard.tsx', 'bb-quality-load-sections.tsx', 'volume-optimizer-parts.tsx'])(
    '%s берёт статус из VOLUME_STATUS_META',
    (file) => {
      const src = readFileSync(join(process.cwd(), 'src/ui/screens/TrainingScreen_parts', file), 'utf8');
      expect(src).toContain('VOLUME_STATUS_META');
      // Локальные карты статусов запрещены: литерал цвета рядом с below_mev — это
      // ровно тот путь, которым «недотрен» снова станет синим.
      expect(src).not.toMatch(/below_mev:\s*\{\s*label/);
      expect(src).not.toMatch(/below_mev:\s*'#/);
      // И подпись: плоская карта строк ('Ниже MEV' / 'Оптимально') рядом с тремя
      // статусами расходилась с «недотреном»/«оптимумом» из VOLUME_STATUS_META.
      expect(src).not.toMatch(/below_mev:\s*'/);
    },
  );
});
