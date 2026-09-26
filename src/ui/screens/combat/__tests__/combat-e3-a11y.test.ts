/**
 * combat-e3-a11y.test.ts — локи E3 «мобильность + доступность».
 *
 * Проверяем, что APK-слой и a11y-контракт не откатываются: 44px на тапах,
 * aria-current на шагах, live-region на тосте, никаких мёртвых APK-правил.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const CONSTRUCTOR = read('src/ui/screens/combat/CombatConstructor.tsx');
const PLAN_VIEW = read('src/ui/screens/combat/CombatPlanView.tsx');
const CSS = read('src/styles-native.css');

const combatSrc = CONSTRUCTOR + PLAN_VIEW + read('src/ui/screens/combat/CombatUI.tsx') + read('src/ui/screens/combat/combat-annual-card.tsx');

describe('E3.1 — APK: тап-таргеты ≥44px', () => {
  it('ни одного combat-правила с min-height 40px (был .cb-chip)', () => {
    const bad: string[] = [];
    let scope = '';
    for (const raw of CSS.split('\n')) {
      const line = raw.trim();
      if (/^html\.app-native \.combat-/.test(line)) { scope = line.replace(/\s*\{\s*$/, ''); continue; }
      if (line === '}') { scope = ''; continue; }
      if (scope && /min-height: 40px/.test(line)) bad.push(scope);
    }
    expect(bad).toEqual([]);
  });

  it('.cb-chip (ChipToggle) — 44px', () => {
    expect(CSS).toMatch(/\.cb-chip \{\s*min-height: 44px !important/);
  });

  it('шаги покрыты APK-правилом по хуку data-cb="step"', () => {
    expect(CSS).toMatch(/\[data-cb='step'\] \{[^}]*min-height: 44px/);
  });
});

describe('E3.2 — APK: scroll-snap реально работает', () => {
  it('cb-steps висит на СКРОЛЛЕРЕ, а не на внешнем враппере', () => {
    // было: <div className="cb-steps">{renderStepNav()}</div> — snap уезжал на
    // не-скроллящий элемент и не работал
    expect(CONSTRUCTOR).not.toMatch(/<div className="cb-steps">\{renderStepNav\(\)\}<\/div>/);
    expect(CONSTRUCTOR).toMatch(/<div className="cb-steps"[^>]*overflowX: 'auto'/);
  });
});

describe('E3.3 — a11y: aria-current на шагах', () => {
  it('активный шаг помечен, и только он', () => {
    expect(CONSTRUCTOR).toMatch(/aria-current=\{active \? 'step' : undefined\}/);
  });

  it('нет фальшивых tab-ролей (кнопки честнее)', () => {
    // role="tab" без настоящего tablist ломал бы getByRole('button')
    expect(CONSTRUCTOR).not.toMatch(/role="tab"/);
    expect(CONSTRUCTOR).not.toMatch(/role="tablist"/);
  });

  it('шаг несёт data-cb/data-step/data-active хуки', () => {
    expect(CONSTRUCTOR).toContain('data-cb="step"');
    expect(CONSTRUCTOR).toContain('data-step={s}');
    expect(CONSTRUCTOR).toContain("data-active={active ? 'true' : 'false'}");
  });
});

describe('E3.4 — a11y: тост объявляется скринридером', () => {
  it('cb-msg — живая polite-область', () => {
    expect(CONSTRUCTOR).toMatch(/className="cb-msg" role="status" aria-live="polite"/);
  });
});

describe('E3.5 — a11y: аккордеон недель', () => {
  it('заголовок недели: aria-expanded + aria-controls + aria-label', () => {
    expect(PLAN_VIEW).toMatch(/className="cb-plan-weekhead"[\s\S]{0,200}aria-expanded=\{isOpen\}/);
    expect(PLAN_VIEW).toContain('aria-controls={`cb-wk-${wk.week}`}');
    expect(PLAN_VIEW).toMatch(/aria-label=\{`Неделя \$\{wk\.week\}/);
  });

  it('тело недели имеет id, на который ссылается aria-controls', () => {
    expect(PLAN_VIEW).toMatch(/id=\{`cb-wk-\$\{wk\.week\}`\} className="cb-plan-weekbody"/);
  });
});

describe('E3.6 — нет мёртвых APK-правил', () => {
  it('cb-plan-sesshead (без -btn) удалён — исходник использует -btn', () => {
    expect(CSS).not.toMatch(/\.cb-plan-sesshead \{/);
    expect(PLAN_VIEW).toContain('cb-plan-sesshead-btn');
    expect(CSS).toMatch(/\.cb-plan-sesshead-btn \{/);
  });

  it('все прочие combat-селекторы APK-раздела существуют в исходниках', () => {
    // kit-* приходят из shared-кита (SectionCard/SectionNav) — они живые
    const used = new Set<string>();
    for (const m of combatSrc.match(/(?:cb|kit)-[a-z0-9-]+/g) || []) used.add(m);
    const sel = new Set<string>();
    for (const m of CSS.matchAll(/html\.app-native \.combat-(?:constructor|planview) \.((?:cb|kit)-[a-z0-9-]+)/g)) sel.add(m[1]!);
    const dead = [...sel].filter(s => !used.has(s));
    expect(dead).toEqual([]);
  });
});
