/**
 * D1 (§9 плана BB-AUTO-EXHAUSTIVE-PRO) — source-guard приёмника движений ББ-диагностики.
 *
 * Полный jsdom-рендер BbAutoConstructor виснет (god-component — все BB-тесты идут через
 * renderToStaticMarkup, а intake слушает window-событие и pre-render payload не переигрывает),
 * поэтому проверяем исходник: helper вызывается, bits/persist/clean/LEGACY на месте,
 * сборка не тронута (`mobilityRestrictions`/`lrTopUp` из движений не пишутся), `vbtLossPct`
 * остаётся @deprecated-полем моста (не удалён — иначе красный tsc в чужом хабе).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');
const BRIDGE = readFileSync(resolve(__dirname, '..', 'planner-bridge.ts'), 'utf8');
const ENGINE = readFileSync(
  // __tests__ → TrainingScreen_parts → screens → ui → src → engines/bb
  resolve(__dirname, '..', '..', '..', '..', 'engines', 'bb', 'bb-diag-intake.engine.ts'),
  'utf8',
);

/**
 * Канон полей intake = интерфейс `BbDiagIntakeInput` в движке (единственный источник).
 * Замок двусторонний: приёмник не может передать поле, которого движок не знает,
 * и не может ЗАБЫТЬ передать поле, которое движок знает (ровно тот разрыв, из-за
 * которого 6 результатов скрининга не доходили до тоста/печати — см. HUBS-PRO-MASTER-PLAN §2).
 */
function intakeCallFields(): string[] {
  const call = SRC.slice(SRC.indexOf('resolveBbDiagIntakeExtras({'));
  // конец вызова — первая '});' после открытия
  const body = call.slice(0, call.indexOf('});'));
  return Array.from(body.matchAll(/(\w+):\s*bbDiag\.\1\b/g)).map((m) => m[1]);
}

function engineInputFields(): string[] {
  const iface = ENGINE.slice(
    ENGINE.indexOf('export interface BbDiagIntakeInput'),
    ENGINE.indexOf('export interface BbDiagIntakeExtras'),
  );
  return Array.from(iface.matchAll(/^\s*(\w+)\?:\s*unknown;/gm)).map((m) => m[1]);
}

describe('D1 intake: helper + bits (source-guard)', () => {
  it('helper импортирован и вызывается с полями движения', () => {
    expect(SRC).toContain("import { resolveBbDiagIntakeExtras } from '../../../engines/bb/bb-diag-intake.engine';");
    expect(SRC).toContain('resolveBbDiagIntakeExtras({');
    for (const f of ['movementDriver: bbDiag.movementDriver', 'singleLeg: bbDiag.singleLeg', 'lrVerdicts: bbDiag.lrVerdicts', 'lrTopUp: bbDiag.lrTopUp', 'shoulder: bbDiag.shoulder', 'hinge: bbDiag.hinge', 'ybt: bbDiag.ybt', 'scapPain: bbDiag.scapPain', 'videoStandard: bbDiag.videoStandard', 'driverSubs: bbDiag.driverSubs', 'asymPriority: bbDiag.asymPriority']) {
      expect(SRC.includes(f), f).toBe(true);
    }
  });

  it('bits уходят в diagBits-тост «диагностика: …» (без дубль-строки)', () => {
    expect(SRC).toContain('const diagBits: string[] = [...diagExtras.bits];');
    expect(SRC).toContain('диагностика: ');
  });
});

describe('D1 intake: persist + rationale (source-guard)', () => {
  it('persist-ключи движения пишутся', () => {
    expect(SRC).toContain("localStorage.setItem('he_bb_last_movement_driver'");
    expect(SRC).toContain("localStorage.setItem('he_bb_last_single_leg'");
    expect(SRC).toContain("localStorage.setItem('he_bb_last_movement_extra'");
  });

  it('строка в rationale уже собранного плана: дедуп по строке (паттерн labDelta)', () => {
    expect(SRC).toContain('const movementLine = `🧭 Скрининг движений: ${diagExtras.bits.join(');
    expect(SRC).toContain('if (rat.some((r) => r === movementLine)) return prev;');
  });
});

describe('D1 intake: stale-чистка по маркеру lrVerdicts (source-guard)', () => {
  it('обе ветки чистки используют решение движка', () => {
    expect(SRC).toContain('if (diagExtras.clean.lrTopUp) {');
    expect(SRC).toContain('if (diagExtras.clean.returnAction) {');
    expect(SRC).toContain("localStorage.removeItem('he_bb_lr_topup')");
    expect(SRC).toContain("localStorage.removeItem('he_bb_return_action')");
  });

  it('старые ветки приёма помечены LEGACY', () => {
    expect(/LEGACY[\s\S]{0,500}if \(bbDiag\.lrTopUp/.test(SRC)).toBe(true);
    expect(/LEGACY[\s\S]{0,500}if \(bbDiag\.returnAction/.test(SRC)).toBe(true);
  });

  it('сборка не тронута: движения не пишут mobilityRestrictions/lrTopUp-применение', () => {
    expect(SRC).not.toContain('setMobilityRestrictions((prev) => Array.from(new Set([...prev, ...diagExtras');
    expect(SRC).not.toContain('setLrTopUp(diagExtras');
    expect(SRC).not.toContain('diagExtras.persist.movementDriver) && setMobility');
  });

  it('vbtLossPct конструктором не читается', () => {
    expect(SRC.includes('bbDiag.vbtLossPct')).toBe(false);
  });
});

describe('П3 print: персист движений в печать плана (source-guard)', () => {
  it('импорт + вызов + вставка после rationale', () => {
    expect(SRC).toContain("import { buildBbMovementPrintBlock } from '../../../engines/bb/bb-diagnostics-export.engine';");
    expect(SRC).toContain('movementHtml = buildBbMovementPrintBlock()');
    expect(SRC).toContain('${rationaleHtml}${movementHtml}${weeksHtml}');
  });
});

describe('D1 planner-bridge: vbtLossPct @deprecated, не удалён (source-guard)', () => {
  it('поле на месте и помечено @deprecated', () => {
    expect(BRIDGE).toContain('vbtLossPct?: number | null;');
    expect(/@deprecated[\s\S]{0,400}vbtLossPct\?: number \| null;/.test(BRIDGE)).toBe(true);
  });
});

describe('ЗАМОК НА РАЗРЫВ ЦЕПИ «хаб → мост → приёмник» (Wave-0 Э0.1)', () => {
  it('канон движка не пуст и читается (иначе замок молчит)', () => {
    const canon = engineInputFields();
    expect(canon.length).toBeGreaterThanOrEqual(17);
  });

  it('приёмник передаёт ВСЕ поля, которые знает движок (R1–R6 в т.ч.)', () => {
    const passed = new Set(intakeCallFields());
    const missing = engineInputFields().filter((f) => !passed.has(f));
    expect(missing, `поля intake, не переданные приёмником: ${missing.join(', ')}`).toEqual([]);
  });

  it('R1–R6 скрининга передаются явно (тот самый разрыв)', () => {
    const passed = new Set(intakeCallFields());
    for (const f of ['bench', 'painMon', 'posterior', 'loadedHinge', 'erir', 'screenPriority']) {
      expect(passed.has(f), f).toBe(true);
    }
  });

  it('приёмник не передаёт полей, которых движок не знает (нет тихих no-op)', () => {
    const canon = new Set(engineInputFields());
    const extra = intakeCallFields().filter((f) => !canon.has(f));
    expect(extra, `поля вне контракта движка: ${extra.join(', ')}`).toEqual([]);
  });

  it('мост типизирует те же поля, что принимает приёмник (нет расхождения имён)', () => {
    for (const f of ['bench', 'painMon', 'posterior', 'loadedHinge', 'erir', 'screenPriority']) {
      expect(BRIDGE, f).toContain(`${f}?:`);
    }
  });
});
