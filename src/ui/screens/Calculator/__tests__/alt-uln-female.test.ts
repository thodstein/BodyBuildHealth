/**
 * alt-uln-female.test.ts — проход 55: АЛТ/АСТ — женская ВГН рядом с мужской.
 *
 * Дефект (тот же класс, что HCT/HGB в проходах 39–53): таблицы мониторинга,
 * системные панели и протоколы печатали мужское «АЛТ/АСТ <40 Ед/л» как общий
 * порог. У женщины верх нормы — 31: её АЛТ 35 «нормален» по интерфейсу, хотя
 * это уже 1.1× ВГН, а ступени «40-80 / 80-200» сдвинуты на чужую шкалу.
 *
 * Контракт после прохода:
 *   • единственная шкала — `LFT_ULN` в `lab-norms.engine` (♂ 40/40, ♀ 31/31
 *     из резолвера полов), текст — `lftUlnText` («♂ <40 / ♀ <31»);
 *   • ступени терапии — в ×ВГН, а не в абсолютных числах мужской шкалы;
 *   • в `src/ui` не осталось `target:'<40 Ед/л'` для трансаминаз.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { UCUM_MAP } from '../../../../core/constants';
import { LFT_ULN, lftUlnText, FEMALE_ALT_2_5_ULN } from '../../../../engines/lab-norms.engine';
import { PHASE_LAB_CARDS } from '../../../../engines/support-phase-labs.engine';
import { LAB_MONITOR_DB } from '../../SupportScreen_parts/UnifiedSynergyCalculator';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const ucum = UCUM_MAP as Record<string, { uln: number }>;

/** Все .ts/.tsx под src/ui, кроме тестов. */
function walkUi(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walkUi(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe('LFT_ULN: одна шкала трансаминаз для всего приложения', () => {
  it('мужской верх — ULN приложения, женский — из резолвера полов (31)', () => {
    expect(LFT_ULN.ALT.male).toBe(ucum.ALT.uln);
    expect(LFT_ULN.AST.male).toBe(ucum.AST.uln);
    expect(LFT_ULN.ALT.female).toBe(31);
    expect(LFT_ULN.AST.female).toBe(31);
    expect(LFT_ULN.ALT.female).toBeLessThan(LFT_ULN.ALT.male);
  });

  it('lftUlnText печатает оба пола одной формулировкой', () => {
    expect(lftUlnText('ALT')).toBe('♂ <40 / ♀ <31');
    expect(lftUlnText('AST')).toBe('♂ <40 / ♀ <31');
  });

  it('2.5×ВГН для женщины считается от её 31 (78), а не от мужских 40 (100)', () => {
    expect(FEMALE_ALT_2_5_ULN).toBe(Math.round(LFT_ULN.ALT.female * 2.5));
    expect(FEMALE_ALT_2_5_ULN).toBe(78);
  });
});

describe('LAB_MONITOR_DB: каждый маркер АЛТ/АСТ называет оба пола', () => {
  const rows = Object.values(LAB_MONITOR_DB)
    .flat()
    .filter(r => r && (r.markerRu === 'АЛТ' || r.markerRu === 'АСТ'));

  it('строки есть (иначе проверка ничего не проверяет)', () => {
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it('цель содержит «♂ <… / ♀ <…» и не печатает голое «<40 Ед/л»', () => {
    for (const r of rows) {
      expect(r.target).toContain('♂ <');
      expect(r.target).toContain('♀ <');
      expect(r.target).not.toBe('<40 Ед/л');
    }
  });

  it('ступени терапии — в ×ВГН, а не в абсолютной мужской шкале', () => {
    const all = JSON.stringify(rows);
    expect(all).not.toContain('40-80');
    expect(all).not.toContain('80-200');
    expect(all).toContain('×ВГН');
  });
});

describe('карточки фаз (единственный перечень) и системные панели', () => {
  it('K0: цель ОАК с женскими HCT/HGB, цель печени — оба пола', () => {
    const k0 = JSON.stringify(PHASE_LAB_CARDS.find(c => c.id === 'K0'));
    expect(k0).toContain('♀ <48%');
    expect(k0).toContain('♀ <150');
    expect(k0).toContain('♀ <31');
    expect(k0).not.toContain('АЛТ<40');
  });

  it('системная панель печени: lftUlnText + двойные пороги тревоги', () => {
    const panel = src('src/ui/screens/Calculator/CalcSystemPanel.tsx');
    expect(panel).toContain("lftUlnText('ALT')");
    expect(panel).toContain("lftUlnText('AST')");
    expect(panel).not.toContain('АЛТ/АСТ <40 Ед/л');
    expect(panel).toContain('♀ ');
  });

  it('триггер мега-стека: ВГН по полу, а не литерал 40', () => {
    const mapper = src('src/ui/screens/Calculator/Calc.mapper.tsx');
    expect(mapper).toContain("LFT_ULN.ALT[fem ? 'female' : 'male']");
    expect(mapper).not.toContain('alt > 40');
  });
});

describe('в src/ui не осталось «<40 Ед/л» как общего порога трансаминаз', () => {
  it('скан всех .ts/.tsx (кроме тестов)', () => {
    const offenders = walkUi(resolve(process.cwd(), 'src/ui'))
      .filter(f => !/__tests__|protocol-lab-targets/.test(f))
      .filter(f => {
        const t = readFileSync(f, 'utf8');
        // Комментарий-пояснение в UnifiedSynergyCalculator («<40 Ед/л» больше не общее) — не порог.
        return t.split(/\r?\n/).some(l => /<40 Ед\/л/.test(l) && !/^\s*\/\//.test(l));
      })
      .map(f => f.replace(process.cwd(), ''));
    expect(offenders).toEqual([]);
  });
});
