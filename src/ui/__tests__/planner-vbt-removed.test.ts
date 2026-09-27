/**
 * Решение 2026-09-27: VBT убран из UI и из полей НОВЫХ планов у стронга
 * (TA/strongman) и единоборств. Движки VBT НЕ тронуты — они по-прежнему
 * читают velocityLossPct/velocityHistory/vbtHistory/velocityLossPerLift,
 * поэтому старые планы и engine-тесты работают как раньше.
 *
 * Этот файл — источник истины по границе: он ловит возвращение VBT в UI
 * или в снимок плана этих двух конструкторов.
 *
 * Что осталось СПЕЦИАЛЬНО (и ловится отдельными локами):
 *  - LVP-калибровка в стронге (скорость→нагрузка, Wood 2026) — не VBT;
 *  - лестница «Ориентир скорости по %ПМ» в разведке единоборств (vbtVelocityForPct)
 *    — референс движка без ввода и без записи в план;
 *  - sm-bridge-intake: парсер хаба VBT-пакеты ещё понимает.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const SS_CTOR = read('src/ui/screens/strength-sport/StrengthSportConstructor.tsx');
const SS_WIZARD = read('src/ui/screens/strength-sport/useStrengthSportWizard.ts');
const SS_PLANVIEW = read('src/ui/screens/strength-sport/StrengthSportPlanView.tsx');
const CB_CTOR = read('src/ui/screens/combat/CombatConstructor.tsx');
const CB_WIZARD = read('src/ui/screens/combat/useCombatWizard.ts');
const CB_INTEL = read('src/ui/screens/combat/cb-camp-intel.tsx');

describe('VBT убран из UI конструкторов (стронг + единоборства)', () => {
  it('стронг: карточки VBT и поста в наборе подхода нет', () => {
    expect(SS_CTOR).not.toContain('VBT per-lift');
    expect(SS_CTOR).not.toContain('потеря скорости vs бюджет');
    expect(SS_PLANVIEW).not.toContain('placeholder="м/с"');
    expect(SS_PLANVIEW).not.toMatch(/estimate1RMFromVelocitySS/);
  });

  it('единоборства: секции VBT и Best/Last-инпутов нет', () => {
    expect(CB_CTOR).not.toContain('VBT — потеря скорости');
    expect(CB_CTOR).not.toContain('Best скорость, м/с');
    expect(CB_CTOR).not.toContain('Last скорость, м/с');
    expect(CB_CTOR).not.toMatch(/diagnoseVelocityLossCombat/);
  });

  it('единоборства: разведка не показывает потерю скорости', () => {
    expect(CB_INTEL).not.toContain("key: 'vbt'");
    expect(CB_INTEL).not.toContain('Потеря скорости');
    expect(CB_INTEL).not.toMatch(/vbtRecommendationCombat/);
  });

  it('обе разведки не принимают velocityLoss', () => {
    // cb-camp-intel: проп снят; конструктор не передаёт его в карточку.
    expect(CB_INTEL).not.toMatch(/velocityLoss\?/);
    expect(CB_CTOR).not.toMatch(/velocityLoss=\{velocityLoss/);
  });
});

describe('VBT не пишется в снимок нового плана', () => {
  it('стронг: input не несёт velocityLossPct/velocityHistory', () => {
    // Важно: проверяем ИМЯ ПОЛЯ в объекте входа, а не любое упоминание —
    // старые планы движок читает, и это не должно ломаться.
    expect(SS_CTOR).not.toMatch(/velocityLossPct:\s/);
    expect(SS_CTOR).not.toMatch(/velocityHistory:\s/);
    expect(SS_CTOR).not.toMatch(/collectSsVelocityHistory/);
  });

  it('единоборства: input не несёт velocityLossPct/vbtHistory/velocityLossPerLift', () => {
    expect(CB_CTOR).not.toMatch(/velocityLossPct:\s/);
    expect(CB_CTOR).not.toMatch(/vbtHistory:\s/);
    expect(CB_CTOR).not.toMatch(/velocityLossPerLift:\s/);
  });

  it('визарды не хранят VBT-стейт (нет write-only состояния)', () => {
    for (const [name, src] of [['стронг', SS_WIZARD], ['единоборства', CB_WIZARD]] as const) {
      expect(src, name).not.toMatch(/setVelocityLoss/);
      expect(src, name).not.toMatch(/setVbtPerLift/);
      expect(src, name).not.toMatch(/setVbtBest/);
      expect(src, name).not.toMatch(/setVbtLast/);
      expect(src, name).not.toMatch(/setVbtHistory/);
      expect(src, name).not.toMatch(/setVbtMap/);
      expect(src, name).not.toMatch(/setHubVelocity/);
    }
  });
});

describe('граница соблюдена: движки и старые планы не сломаны', () => {
  it('типы планов по-прежнему объявляют поля опционально', () => {
    const ssTypes = read('src/engines/strength-sport/strength-sport.types.ts');
    expect(ssTypes).toMatch(/velocityLossPct\?: number;/);
    expect(ssTypes).toMatch(/velocityHistory\?: Record<string, number\[\]>;/);

    const cbTypes = read('src/engines/combat/combat.types.ts');
    expect(cbTypes).toMatch(/velocityLossPct\?: number \| null;/);
    expect(cbTypes).toMatch(/vbtHistory\?:/);
    expect(cbTypes).toMatch(/velocityLossPerLift\?:/);
  });

  it('движки VBT на месте — их читали старые планы и хабы', () => {
    expect(read('src/engines/strength-sport/strength-sport-vbt.engine.ts')).toContain('export function');
    expect(read('src/engines/combat/combat-vbt.engine.ts')).toContain('export function');
    // Парсер хаба VBT-пакеты ещё понимает (мост не сломан «на входе»).
    expect(read('src/ui/screens/strength-sport/sm-bridge-intake.ts')).toContain('export function collectSsVelocityHistory');
  });

  it('LVP-калибровка и лестница скорости НЕ считаются VBT — они остались', () => {
    // LVP = профиль «скорость→нагрузка» (Wood 2026), отдельная фича.
    expect(SS_CTOR).toContain('LVP калибровка');
    expect(SS_WIZARD).toContain('lvpLift');
    // Лестница скорости по %ПМ в разведке единоборств — референс, не ввод.
    expect(CB_INTEL).toContain('vbtVelocityForPct');
  });
});
