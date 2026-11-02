/**
 * bb-diag-audit-2026-11.test.ts — замки аудита «ББ-диагностики» на UI-исходники.
 *
 * Полный jsdom-рендер BbAutoConstructor виснет (пред-существующее, god-component),
 * поэтому мост/честность проверяем по исходнику — как bb-hub-payload-consume.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f: string) => readFileSync(resolve(__dirname, '..', f), 'utf8');
const HUB = read('BBDiagnosticsHub.tsx');
const AUTO = read('BbAutoConstructor.tsx');
const TAB = read('bb-hub-screening-tab.tsx');
const CONTROLS = read('bb-hub-controls.tsx');

describe('W1 честность UI скрининга', () => {
  it('клик по пустому месту не помечает скрининг пройденным', () => {
    expect(TAB).not.toMatch(/data-bb="mobility-tab"\s+onClick=\{touchScreen\}/);
    expect(TAB).toContain('onClickCapture={markTouched}');
    expect(TAB).toMatch(/el\.closest\('button,input,select,textarea/);
  });

  it('норма ротации — из константы движка (45°), а не хардкод 50', () => {
    expect(TAB).toContain('THORACIC_ROT_NORM');
    expect(TAB).not.toMatch(/Норма ротации ≥50°/);
    expect(TAB).not.toMatch(/placeholder="50"/);
  });

  it('снимок скрининга дедуплицируется по дате и ставит screenDoneAt', () => {
    expect(TAB).toMatch(/e\?\.date !== today/);
    expect(TAB).toMatch(/screenTouched: true, screenDoneAt: today/);
  });

  it('«6 критериев» не выдаётся за 7 признаков', () => {
    expect(TAB).not.toMatch(/6 признаков/);
    expect(TAB).not.toMatch(/отметь 7 признаков/);
  });
});

describe('W1 контролы', () => {
  it('нет <button> внутри <label> (валидная разметка, без двойного клика)', () => {
    expect(CONTROLS).not.toMatch(/<label data-bb="num-field"/);
    expect(CONTROLS).toContain('<span data-bb="num-field"');
  });
});

describe('W2 мост хаб → ББ-авто', () => {
  it('хаб шлёт source bb-auto, а не intellectual (иначе targetCycleId уводил в ПЛ)', () => {
    expect(HUB).not.toMatch(/source: 'intellectual'/);
    expect((HUB.match(/source: 'bb-auto'/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('тост говорит «Отправлено», а не «Применено» без подтверждения приёмника', () => {
    expect(HUB).not.toMatch(/✓ Применено в ББ-авто/);
    expect(HUB).toMatch(/→ Отправлено в ББ-авто/);
  });

  it('событие плана несёт detail (приёмник отличает вставку диагностики)', () => {
    expect(HUB).toMatch(/new CustomEvent\('he-bb-plan-saved', \{ detail: \{ source: 'bb-diag-injection'/);
    expect(AUTO).toMatch(/startsWith\('bb-diag'\)/);
    // несохранённая сборка не затирается
    expect(AUTO).toContain('builtPlanRef');
  });

  it('откат без снимка не молчит, а сообщает', () => {
    expect(HUB).toMatch(/Откатывать нечего/);
  });

  it('гейт weakpoints принимает орто-поля (иначе гарды не доезжают и снимаются)', () => {
    expect(AUTO).toContain('hasBbOnlyInfo');
    expect(AUTO).toMatch(/d\.orthoGuards/);
    // группы могут отсутствовать целиком
    expect(AUTO).toMatch(/bbDiag\.groups \?\? \[\]/);
  });
});

describe('W2b спец-блок и возврат', () => {
  it('приёмник не молчит об усечении длины спец-блока (BB-D-24)', () => {
    expect(AUTO).toMatch(/конструктор держит 3–6, обрезано с/);
    expect(AUTO).toMatch(/specRaw\.rationale/);
  });
  it('хаб просит 4–6 нед — приёмник не режет длину молча (BB-D-24)', () => {
    expect(HUB).toMatch(/Math\.max\(4, Math\.min\(6, n\)\)/);
    expect(HUB).toMatch(/specWeeks: '6'/);
  });

  it('орто-гарды не снимаются чужой диагностикой (BB-D-19)', () => {
    expect(AUTO).toContain('orthoPayloadPresent');
    expect(AUTO).toMatch(/!dec\.active && orthoPayloadPresent/);
  });

  it('bannedPatterns ступени возврата фильтруются в сборке (BB-D-23)', () => {
    expect(AUTO).toContain('isBannedName');
    expect(AUTO).toMatch(/запрещён ступенью возврата — не добавлен/);
    expect(AUTO).toMatch(/запрещён ступенью возврата — замена не сделана/);
  });
});

describe('W4 экспорт и печать', () => {
  it('«Печать» действительно печатает, а скачивание — отдельная кнопка (BB-D-34)', () => {
    expect(HUB).toContain('data-bb="export-print"');
    expect(HUB).toContain('data-bb="export-html"');
    expect(HUB).toMatch(/w\.print\(\)/);
    expect(HUB).toMatch(/Окно печати заблокировано/);
  });

  it('ориентиры по возрасту/полу видны в хабе (BB-D-38)', () => {
    expect(HUB).toContain('data-bb="sex-age-notes"');
    expect(HUB).toContain('teenTrainingNote(');
    expect(HUB).toContain('femaleSymmetryNotes(');
  });

  it('инъекция уважает SafetyScore, а не пишет мимо guard (BB-D-22)', () => {
    expect(HUB).toContain('calculatePlanSafetyScore');
    expect(HUB).toContain('bbPlanSaveBlockReason');
    expect(HUB).toMatch(/SafetyScore \$\{safety\.score\}\/100/);
  });

  it('история балла пишется и показывается (BB-D-39)', () => {
    expect(HUB).toContain('appendDiagHistory(');
    expect(HUB).toContain('data-bb="diag-history"');
    expect(HUB).toContain('diagHistoryTrend(');
  });
});

describe('W5 (BB-G-01/02/04) объём-recovery, deep-links, эффект коррекции', () => {
  const TRAIN = readFileSync(resolve(__dirname, '..', '..', 'TrainingScreen.tsx'), 'utf8');

  it('6-й таб «Объём · Recovery» есть в навигации хаба и рендерится', () => {
    expect(HUB).toMatch(/\{ id: 'volume', label: 'Объём · Recovery'/);
    expect(HUB).toMatch(/type BBTab = .*'volume'/);
    expect(HUB).toContain("{tab === 'volume' && (");
  });

  it('панель строится движком, а не считается инлайном в JSX', () => {
    expect(HUB).toContain('buildVolumeRecoveryPanel(');
    expect(HUB).toContain('data-bb="vr-chips"');
    expect(HUB).toMatch(/data-bb=\{`vr-chip-\$\{c\.id\}`\}/);
    expect(HUB).toContain('data-bb="vr-limiter"');
  });

  it('«нет данных» отделено от нулей: есть ветка vr-nodata и data-zone=nodata', () => {
    expect(HUB).toContain('data-bb="vr-nodata"');
    expect(HUB).toContain('data-zone={c.zone}');
  });

  it('deep-links шлют training-open-tab с белым списком целей', () => {
    expect(HUB).toContain("new CustomEvent('training-open-tab'");
    expect(HUB).toContain('data-bb="vr-link"');
    for (const target of ['volume_hub', 'joints_ortho', 'calc_vbt', 'diary']) {
      expect(HUB).toContain(`['${target}',`);
    }
    // TrainingScreen принимает цель только из списка
    expect(TRAIN).toContain('BB_DIAG_DEEP_LINKS');
    expect(TRAIN).toMatch(/else if \(BB_DIAG_DEEP_LINKS\.has\(String\(t\)\)\) goTab\(t as TrainingTab\)/);
    for (const target of ['volume_hub', 'joints_ortho', 'calc_vbt', 'diary', 'progress']) {
      expect(TRAIN).toContain(`'${target}'`);
    }
  });

  it('вставка коррекций пишется в журнал, эффект строится по последней вставке', () => {
    expect(HUB).toContain('logDiagInjection(');
    expect(HUB).toContain('readDiagInjections');
    expect(HUB).toContain('buildCorrectionEffect(');
    expect(HUB).toContain('data-bb="diag-effect"');
    expect(HUB).toContain('data-bb="diag-effect-row"');
  });
});

describe('W1 дневник хаба обновляется', () => {
  it('diarySessions не заморожен на монтировании', () => {
    expect(HUB).not.toMatch(/loadHubDiarySessions\(\); \} catch \{ return \[\]; \}\s*\}, \[\]\);/);
    expect(HUB).toContain('diaryNonce');
  });

  it('таймеры тостов чистятся (нет голого setTimeout(() => setToast(\'\'))', () => {
    // единственный таймер — внутри scheduleToastClear (с очисткой по unmount)
    expect(HUB).not.toMatch(/^\s+setTimeout\(\(\) => setToast/m);
    expect(HUB).toContain('const scheduleToastClear');
    expect(HUB).toMatch(/clearTimeout\(toastTimer\.current\)/);
  });
});
