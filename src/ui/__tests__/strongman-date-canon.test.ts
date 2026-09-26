/**
 * strongman-date-canon.test.ts — хаб диагностики стронгмена считает дни по канону.
 *
 * Контекст. `StrongmanDiagnosticsHub` брал «сегодня» и даты в именах выгрузок как
 * `toISOString().slice(0, 10)` (UTC). Машина разработки — Asia/Vladivostok (UTC+10),
 * где вечером UTC отстаёт на сутки.
 *
 * Три из семи мест — НЕ косметика, а ключи записи:
 *   - `handleSaveProgress`  → запись прогресса (`appendSMProgress`),
 *   - `handleSaveOHSSnap`   → снимок приседа   (`appendOHSSnapshot`),
 *   - `handleGripAsymSnap`  → снимок хвата     (`appendSMGripSnapshot`).
 * Все три `append*` ЗАМЕНЯЮТ запись по дате (`filter(s => s.date !== entry.date)`).
 * В UTC+ это означает реальную потерю данных на границе суток: вечерняя запись
 * 26-го (UTC 13:30) и утренняя запись 27-го (UTC 23:10) попадают в ОДИН UTC-день
 * 26-го → вторая затирает первую. Это доказано ниже на настоящих движках.
 * Остальные четыре места — имена выгружаемых файлов (бэкап/ICS/HTML/CSV): там
 * сдвиг меняет только имя файла, но файл должен называться тем днём, когда выгрузили.
 *
 * Честно о силе лока. Поведенческого теста на сами обработчики хаба НЕТ и это
 * сознательно: `StrongmanDiagnosticsHub` — тяжёлый god-компонент (свои тосты,
 * бейджи, 6 табов, нужна точка монтирования), а выгрузка идёт через нативный мост
 * (`downloadSMHtml`/`downloadSMCsv`/`downloadSMIcs`/`downloadSMBackup`); цена
 * такой обвязки здесь выше ценности этих мест. Поэтому: source-guard на файл
 * (проверен мутацией — возврат любого date-only вызова роняет тест) + поведенческий
 * лок на ПОСЛЕДСТВИЕ, исполняемый на реальных движках записи. Это тот же приём,
 * что в labs-risk-date-canon, но здесь последствие — не сдвиг подписи, а затирание
 * записи, поэтому лок behavioral, а не только source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localIsoDate } from '../../core/local-date';
import { appendSMProgress } from '../../engines/strength-sport/strength-sport-sm-progress.engine';
import { appendOHSSnapshot } from '../../engines/strength-sport/strength-sport-ohs.engine';
import { appendSMGripSnapshot } from '../../engines/strength-sport/strength-sport-sm-asymmetry.engine';

const ХАБ = 'src/ui/screens/TrainingScreen_parts/StrongmanDiagnosticsHub.tsx';
const кодХаба = () => {
  const src = readFileSync(join(process.cwd(), ХАБ), 'utf8');
  // Комментарии не считаются: ценз их снимает, и гард должен вести себя так же.
  return { src, код: src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') };
};

const СМЕЩЕНИЕ_МИНУТ = -new Date().getTimezoneOffset();

describe('хаб стронгмена: канон дат', () => {
  it('в хабе нет date-only вызовов', () => {
    const { код } = кодХаба();
    const остатки = код.match(/\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g) || [];
    expect(остатки, `${ХАБ}: вернулись date-only вызовы`).toEqual([]);
  });

  it('хаб берёт даты из core/local-date', () => {
    const { src } = кодХаба();
    expect(src, 'нет импорта канона').toMatch(
      /import\s*\{[^}]*localIsoDate[^}]*\}\s*from\s*'\.\.\/\.\.\/\.\.\/core\/local-date'/,
    );
  });

  it('три ключа записи и четыре имени выгрузки идут через канон', () => {
    const { код } = кодХаба();
    // writer-класс: ровно три «сегодня» для снапшотов/прогресса.
    const сегодня = код.match(/const today = localIsoDate\(\);/g) || [];
    expect(сегодня.length, 'ожидались три writer-даты на localIsoDate()').toBe(3);
    // Бэкап, ICS, HTML, CSV — имена файлов.
    const вИмени = код.match(/\$\{localIsoDate\(\)\}/g) || [];
    expect(вИмени.length, 'ожидались четыре имени выгрузки на каноне').toBe(4);
  });
});

describe('последствие writer-даты: запись затирается на границе суток', () => {
  // Две реальные точки времени: вечер 26-го и утро 27-го (локальный календарь).
  const вечер = new Date(2026, 8, 26, 23, 30);
  const утро = new Date(2026, 8, 27, Math.max(0, Math.floor(СМЕЩЕНИЕ_МИНУТ / 60) - 1), 10);

  it('канон различает эти два календарных дня', () => {
    expect(localIsoDate(вечер)).toBe('2026-09-26');
    expect(localIsoDate(утро)).toBe('2026-09-27');
  });

  it('UTC склеивает их в один день — и запись затирается (если машина впереди UTC)', () => {
    if (СМЕЩЕНИЕ_МИНУТ <= 0) {
      // На машине без смещения склейки не происходит — сравнение было бы вакуумным.
      console.log('[date-canon] смещение TZ = 0 — коллизия UTC не проверяется (иначе тест вакуумный)');
      expect(localIsoDate(вечер)).not.toBe(localIsoDate(утро));
      return;
    }
    const utcВечер = вечер.toISOString().slice(0, 10);
    const utcУтро = утро.toISOString().slice(0, 10);
    expect(utcВечер, 'предполагалось, что UTC склеит две записи в один день').toBe(utcУтро);

    // Что было бы, если бы writer брал UTC: вторая запись ЗАТИРАЕТ первую.
    const прогрессUtc = appendSMProgress(
      appendSMProgress([], { date: utcВечер, score: 5, bodyweightKg: 105 } as any),
      { date: utcУтро, score: 6, bodyweightKg: 105 } as any,
    );
    expect(прогрессUtc.length, 'на UTC-датах вторая запись должна затереть первую').toBe(1);

    // С каноном обе записи остаются — это и есть смысл правки.
    const прогрессКанон = appendSMProgress(
      appendSMProgress([], { date: localIsoDate(вечер), score: 5, bodyweightKg: 105 } as any),
      { date: localIsoDate(утро), score: 6, bodyweightKg: 105 } as any,
    );
    expect(прогрессКанон.length, 'на каноне обе записи должны сохраниться').toBe(2);
  });

  it('то же для снапшота приседа и хвата: канон не теряет запись', () => {
    const ohsКанон = appendOHSSnapshot(
      appendOHSSnapshot([], { date: localIsoDate(вечер), score: 4, failed: [], level: 'good' } as any),
      { date: localIsoDate(утро), score: 6, failed: [], level: 'good' } as any,
    );
    expect(ohsКанон.length).toBe(2);

    const gripКанон = appendSMGripSnapshot(
      appendSMGripSnapshot([], { date: localIsoDate(вечер), left: 70, right: 68, diffPct: 3, metric: 'kg' } as any),
      { date: localIsoDate(утро), left: 71, right: 70, diffPct: 1.4, metric: 'kg' } as any,
    );
    expect(gripКанон.length).toBe(2);
  });
});
