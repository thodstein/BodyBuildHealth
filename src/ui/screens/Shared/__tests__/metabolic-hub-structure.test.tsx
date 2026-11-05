/**
 * metabolic-hub-structure.test.tsx — структура хаба после аудита 2026-11.
 *
 * Зачем: до аудита все поля ввода шли одной стеной вместе с результатами, не
 * было ни шагов, ни группировки калькуляторов, а опциональные лабы показывали
 * фиктивные значения (HCT 45 %, ферритин 120, GGT 25) — пользователь видел
 * число, которого движок не считал.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

const stepButton = (n: number) => screen.getByRole('button', { name: new RegExp(`Шаг ${n}:`) });

describe('MetabolicHub: мастер из 4 шагов', () => {
  it('в DOM ровно 4 шага, первый активен по умолчанию', () => {
    render(<MetabolicHub />);
    const steps = [1, 2, 3, 4].map(stepButton);
    expect(steps).toHaveLength(4);
    expect(steps[0].getAttribute('aria-current')).toBe('true');
    for (const s of steps.slice(1)) expect(s.getAttribute('aria-current')).toBe('false');
  });

  it('переключение шага меняет aria-current и показывает поля этого шага', () => {
    render(<MetabolicHub />);
    const header = screen.getByText(/Метаболический синдром/);
    const card = header.parentElement as HTMLElement;
    // шаг 1: карточка лаб скрыта
    expect(card.style.display).toBe('none');
    const lab = stepButton(3);
    fireEvent.click(lab);
    expect(lab.getAttribute('aria-current')).toBe('true');
    expect(stepButton(1).getAttribute('aria-current')).toBe('false');
    expect(card.style.display).not.toBe('none');
  });

  it('все шаги остаются в DOM (скрыты display:none), иначе теряются поля', () => {
    const { container } = render(<MetabolicHub />);
    const hidden = Array.from(container.querySelectorAll('div')).filter(el => el.style.display === 'none');
    expect(hidden.length).toBeGreaterThanOrEqual(3);
  });
});

describe('MetabolicHub: группировка 16 калькуляторов', () => {
  it('4 группы, каждая — кнопка с aria-pressed', () => {
    const { container } = render(<MetabolicHub />);
    const groups = Array.from(container.querySelectorAll('.mh-group')) as HTMLElement[];
    expect(groups).toHaveLength(4);
    expect(groups.filter(g => g.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('все 16 пилюль остаются в DOM при фильтрации по группе', () => {
    const { container } = render(<MetabolicHub />);
    const groups = Array.from(container.querySelectorAll('.mh-group')) as HTMLElement[];
    fireEvent.click(groups[2]);
    expect(groups[2].getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('.mh-mode')).toHaveLength(16);
  });

  it('селектор не уезжает: контейнер sticky, а не static', () => {
    const { container } = render(<MetabolicHub />);
    const sticky = container.querySelector('#mh-results') as HTMLElement;
    expect(sticky).toBeTruthy();
    expect(sticky.style.position).toBe('sticky');
  });
});

describe('MetabolicHub: честные «не задано» вместо фиктивных лаб', () => {
  it('плитка крови без HCT показывает «—», а не 45 %', () => {
    const { container } = render(<MetabolicHub />);
    const blood = Array.from(container.querySelectorAll('button'))
      .find(b => (b.getAttribute('aria-label') || '').startsWith('Кровь · HCT')) as HTMLElement;
    expect(blood).toBeTruthy();
    expect(blood.textContent).toContain('—');
    expect(blood.textContent).toContain('введи HCT из ОАК');
    expect(blood.textContent).not.toContain('45');
  });

  it('опциональные лабы в шаге 3 подписаны «не задано»', () => {
    render(<MetabolicHub />);
    fireEvent.click(stepButton(3));
    expect(screen.getByRole('button', { name: /HCT, %: не задано/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ферритин, нг\/мл: не задано/ })).toBeTruthy();
  });

  it('опциональный GGT в шаге 1 тоже «не задано»', () => {
    render(<MetabolicHub />);
    expect(screen.getByRole('button', { name: /GGT, Ед\/л: не задано/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /JP3 сумма, мм: не задано/ })).toBeTruthy();
  });
});

describe('MetabolicHub: ручной ввод лаб переживает авто-подтягивание из профиля', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Shared/MetabolicHub.tsx'), 'utf8');

  it('каждая лаба из refreshLabs помечена markManualLab', () => {
    // без пометки таймер раз в 8 секунд возвращает значение из профиля
    for (const key of ['hct', 'hgb', 'ferritin', 'gfr', 'hdl', 'ast', 'alt', 'plt', 'tg', 'glucose', 'insulin', 'tsh', 'ft4']) {
      expect(src, `лаба ${key} должна идти через markManualLab`).toContain(`markManualLab('${key}'`);
    }
  });

  it('ключи valuesRef совпадают с ключами apply(...) в refreshLabs', () => {
    // регрессия: ключи были hdlMgDl/tgMgDl2/glucoseMgDl/insulinMuMl, а apply искал
    // короткие 'hdl'/'tg'/'glucose'/'insulin' — защита «не затираем показанное» молчала
    const block = src.match(/valuesRef\.current = \{([^}]*)\}/);
    expect(block).toBeTruthy();
    const valueKeys = new Set(
      block![1].split(',').map(part => part.trim().split(':')[0]!.trim()).filter(Boolean),
    );
    const applyKeys = Array.from(src.matchAll(/apply\('([a-z0-9]+)'/g)).map(m => m[1]!);
    expect(applyKeys.length).toBeGreaterThanOrEqual(13);
    expect(applyKeys.filter(k => !valueKeys.has(k))).toEqual([]);
  });

  it('«Сброс лаб» вызывает resetLabs (снимает пометки), а не инлайн-сброс четырёх полей', () => {
    expect(src).toMatch(/onClick=\{resetLabs\}/);
    expect(src).toContain('manualLabsRef.current = {};');
  });

  it('у каждого поля снапшота есть человеческая подпись в SNAP_LABEL', () => {
    // регрессия: список покрывал 29 из ~90 ключей, и diff сценариев печатал
    // сырые camelCase (glucoseMgDl, useMeasuredSweat, hct) вместо подписей
    const snapBlock = src.match(/const snapshot = useMemo\(\(\)=>\(\{([^}]*)\}/);
    expect(snapBlock, 'snapshot').toBeTruthy();
    const snapKeys = snapBlock![1].split(',').map(s => s.trim().split(':')[0]!.trim()).filter(Boolean);
    expect(snapKeys.length).toBeGreaterThan(80);
    const labelBlock = src.match(/const SNAP_LABEL: Record<string, string> = \{([\s\S]*?)\n\};/);
    expect(labelBlock, 'SNAP_LABEL').toBeTruthy();
    const labels = new Set(Array.from(labelBlock![1].matchAll(/([A-Za-z0-9_]+)\s*:/g)).map(m => m[1]!));
    expect(snapKeys.filter(k => !labels.has(k))).toEqual([]);
  });

  it('каждый ключ снапшота реально восстанавливается в applySnapshot', () => {
    // регрессия: поле могло попасть в автосейв/сценарий и не читаться обратно —
    // diff показывал разницу, а загрузка сценария молча её теряла.
    const snapBlock = src.match(/const snapshot = useMemo\(\(\)=>\(\{([^}]*)\}/);
    expect(snapBlock, 'snapshot').toBeTruthy();
    const snapKeys = snapBlock![1].split(',').map(s => s.trim().split(':')[0]!.trim()).filter(Boolean);
    const applyStart = src.indexOf('const applySnapshot');
    const applyEnd = src.indexOf('// init: актуальный снапшот');
    expect(applyStart).toBeGreaterThan(-1);
    expect(applyEnd).toBeGreaterThan(applyStart);
    const applied = new Set(Array.from(src.slice(applyStart, applyEnd).matchAll(/\bs\.([A-Za-z0-9_]+)/g)).map(m => m[1]!));
    expect(snapKeys.filter(k => !applied.has(k))).toEqual([]);
  });
});
