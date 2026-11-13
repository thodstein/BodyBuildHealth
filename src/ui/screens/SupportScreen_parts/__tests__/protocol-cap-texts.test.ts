/**
 * protocol-cap-texts.test.ts — §6.2, проход 25: тексты протоколов не обещают
 * кросс-капы выше UL.
 *
 * У сумматора «Кросс-модульные капы» (CROSS_CAPS) своя копия порогов уже
 * убрана (mg 800 → UL 350, zn 50 → UL 40), но ту же цифру повторяли ~15
 * подписей в карточках протоколов: «Суммарно Mg ≤800 мг/сут», «Zn ≤50 мг/сут
 * суммарно», «Кросс-кап 800 мг/сут». Пользователь читал разные лимиты на
 * одном экране.
 *
 * Тест читает исходники протоколов (не рендер) — это лоскут на текст, чтобы
 * старая цифра не вернулась при следующей правке контента.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'src/ui/screens/SupportScreen_parts');
const FILES = readdirSync(DIR)
  .filter((f) => f.startsWith('supportProtocol') && f.endsWith('.tsx'))
  .map((f) => ({ name: f, text: readFileSync(resolve(DIR, f), 'utf8') }));

describe('тексты протоколов: кросс-капы = реестр UL', () => {
  it('файлы протоколов найдены (защита от пустого прогона)', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it('магний: нигде не обещан кап 800 мг/сут', () => {
    for (const f of FILES) {
      expect(f.text, f.name).not.toMatch(/Mg\s*≤\s*800/);
      expect(f.text, f.name).not.toMatch(/≤800\s*мг\/сут/);
      expect(f.text, f.name).not.toMatch(/Кросс-кап\s*800/);
      expect(f.text, f.name).not.toMatch(/превышать\s*800\s*мг\/сут/);
    }
  });

  it('цинк: нигде не обещан суммарный лимит 50 мг/сут', () => {
    for (const f of FILES) {
      expect(f.text, f.name).not.toMatch(/Zn\s*≤\s*50/);
      expect(f.text, f.name).not.toMatch(/Цинк\s*≤\s*50/);
      expect(f.text, f.name).not.toMatch(/50\s*мг\/сут[^.]{0,20}суммарн/);
    }
  });

  it('безопасная доза и её исключение читаются рядом', () => {
    // Там, где остаётся протокольная доза выше UL (Zn 50 курсом), рядом
    // обязана стоять пометка «курс» — иначе цифра выглядит как норма.
    const immune = FILES.find((f) => f.name === 'supportProtocolImmune.tsx')!;
    expect(immune.text).toContain('50 мг/сут — только курсом');
    expect(immune.text).toContain('Zn ≤40 мг/сут постоянно');
  });
});
