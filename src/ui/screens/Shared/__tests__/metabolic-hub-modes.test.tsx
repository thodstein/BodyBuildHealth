/**
 * metabolic-hub-modes.test.tsx — «все 16 калькуляторов действительно считают».
 *
 * Зачем: структура хаба проверена отдельно (metabolic-hub-structure.test.tsx), но
 * можно случайно сломать один режим (уронить `?? 0`, потерять вход, поделить на 0) —
 * пилюля переключится, а в блоке окажется пустота, `NaN` или `undefined`.
 * Этот тест кликает по всем 16 пилюлям и требует непустой результат без мусора.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

/** Ожидаемые подписи 16 режимов — список фиксирует полноту хаба. */
const MODE_LABELS = [
  'Вода', 'Шаги', 'КБЖУ', 'Жир', 'Stress', 'Кровь', 'EA', 'Алко',
  'Белок', 'Поиск нормы', 'NEAT', 'AT', 'Щитовидка', 'Пот', 'MetS', 'Diet break',
];

describe('MetabolicHub: 16 калькуляторов выдают результат', () => {
  it('в DOM ровно 16 пилюль с ожидаемыми подписями', () => {
    const { container } = render(<MetabolicHub />);
    const pills = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    expect(pills).toHaveLength(16);
    const labels = pills.map(p => (p.textContent || '').replace(/^[^\p{L}]+/u, '').trim());
    for (const expected of MODE_LABELS) {
      expect(labels.some(l => l.startsWith(expected)), `нет пилюли «${expected}»`).toBe(true);
    }
  });

  it('каждый режим показывает непустой результат без NaN/undefined', () => {
    const { container } = render(<MetabolicHub />);
    const pills = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    const results = container.querySelector('#mh-results') as HTMLElement;
    expect(results).toBeTruthy();

    for (const pill of pills) {
      fireEvent.click(pill);
      expect(pill.getAttribute('aria-pressed'), `${pill.textContent} не активировался`).toBe('true');

      const text = (results.textContent || '').replace(/\s+/g, ' ');
      const name = (pill.textContent || '').trim();
      expect(text, `${name}: в результате NaN`).not.toMatch(/\bNaN\b/);
      expect(text, `${name}: в результате undefined`).not.toMatch(/\bundefined\b/);
      expect(text, `${name}: результат пустой`).not.toMatch(/\bnull\b/);
      expect(text.trim().length, `${name}: слишком короткий результат`).toBeGreaterThan(120);
    }
  });

  it('переключение режима не сбрасывает мастер ввода (шаг остаётся)', () => {
    render(<MetabolicHub />);
    fireEvent.click(screen.getByRole('button', { name: /Шаг 3:/ }));
    fireEvent.click(screen.getByRole('button', { name: /NEAT/ }));
    expect(screen.getByRole('button', { name: /Шаг 3:/ }).getAttribute('aria-current')).toBe('true');
  });

  it('«нагруженный» профиль (женщина, беременность, лабы, тоннаж) не даёт NaN ни в одном режиме', () => {
    // все ветки сразу: беременность + лютеиновая фаза + измеренный пот + тоннаж + полные лабы
    localStorage.setItem('he_metabolic_snapshot_v6', JSON.stringify({
      weight: 70, height: 168, age: 29, sex: 'female', bodyFat: 26, neck: 32, waist: 78, hip: 98,
      steps: 9000, cardioMin: 150, trainingDays: 4, activityLevel: 'high', profession: 'standing', goal: 'cut',
      stress: 7, sleepHours: 6, sleepQuality: 2, onAAS: false, aasDose: 0, climate: 'hot', humidity: 80,
      standingHours: 6, fidgetLevel: 3, sweatRate: 900, sweatSodium: 1200, alcoholG: 20, alcoholDays: 2,
      caffeineMg: 300, tsh: 1.5, ft4: 15, glucoseMgDl: 95, insulinMuMl: 12, skinfoldSum3: 60, skinfoldSum4: 80,
      biaResistance: 600, deficitKcal: 500, weeksInDeficit: 12, weightLostKg: 5, creatineUse: true,
      weeklyVolumeTons: 30, targetWeight: 63, weeksToGoal: 12, menstrualPhase: 'luteal', sfaG: 20, tgMgDl2: 120,
      ggt: 30, hct: 41, hgb: 135, ferritin: 45, gfr: 100, waterL: 2.6, sodiumG: 3, potassiumG: 3.2,
      metHoursPerWeek: 20, measuredRMR: 1500, boneFlag: false, menstrualFlag: true, preKg: 70, postKg: 69.2,
      fluidL: 0.4, sweatHours: 1, hdlMgDl: 60, systolic: 115, diastolic: 75, ast: 20, alt: 22, plt: 250,
      caffeineHoursSince: 3, trimester: 2, lactating: 'none', ethnicity: 'european', postBariatric: false,
      untreatedHypo: false, acclimated: true, proteinSource: 'plant', proteinMeals: 4, edeScore: 1, lowT: false,
      lowBMD: false, t3Low: false, sweatIntensity: 'moderate', sweatEnv: 'hot', useMeasuredSweat: true,
      fiberG: 30, omega3G: 2, projectionYears: 3, projectionMode: 'hold_ffmi',
    }));
    const { container } = render(<MetabolicHub />);
    // снапшот реально применился (иначе тест проверял бы дефолты)
    expect(container.textContent || '').toMatch(/HCT 41%/);

    const pills = Array.from(container.querySelectorAll('.mh-mode')) as HTMLElement[];
    const results = container.querySelector('#mh-results') as HTMLElement;
    for (const pill of pills) {
      fireEvent.click(pill);
      const text = (results.textContent || '').replace(/\s+/g, ' ');
      const name = (pill.textContent || '').trim();
      expect(text, `${name}: NaN`).not.toMatch(/\bNaN\b/);
      expect(text, `${name}: undefined`).not.toMatch(/\bundefined\b/);
      expect(text, `${name}: null`).not.toMatch(/\bnull\b/);
      expect(text.trim().length, `${name}: пусто`).toBeGreaterThan(120);
    }
    // беременность должна реально добавлять ккал (не молча игнорироваться)
    expect(container.textContent || '').toMatch(/\+340|беременн/i);
  });
});
