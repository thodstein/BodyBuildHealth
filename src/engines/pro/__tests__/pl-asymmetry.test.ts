import { describe, expect, it } from 'vitest';
import { asymmetryPct, asymmetryVerdict, diagnoseAsymmetry, isUnilateralExercise } from '../pl-asymmetry.engine';

describe('pl-asymmetry', () => {
  it('pct без референс-лимба: (100-90)/100 = 10%', () => {
    expect(asymmetryPct(100, 90)).toBe(10);
    expect(asymmetryPct(90, 100)).toBe(10);
    expect(asymmetryPct(100, 100)).toBe(0);
  });
  it('null при некорректном вводе', () => {
    expect(asymmetryPct(0, 100)).toBeNull();
    expect(asymmetryPct(-5, 100)).toBeNull();
    expect(asymmetryPct(NaN, 100)).toBeNull();
  });
  it('пороги 10/15 (Bishop/Parkinson)', () => {
    expect(asymmetryVerdict(9.9)).toBe('ok');
    expect(asymmetryVerdict(10)).toBe('watch');
    expect(asymmetryVerdict(15)).toBe('watch');
    expect(asymmetryVerdict(15.1)).toBe('high');
  });
  it('диагноз: слабая сторона + текст', () => {
    const d = diagnoseAsymmetry(85, 100)!;
    expect(d.weaker).toBe('left');
    expect(d.verdict).toBe('watch');
    expect(d.text).toContain('левая');
    expect(diagnoseAsymmetry(100, 100)!.verdict).toBe('ok');
    expect(diagnoseAsymmetry(0, 100)).toBeNull();
  });
  it('унилатеральные маркеры', () => {
    expect(isUnilateralExercise('Жим гантелей лёжа')).toBe(true);
    expect(isUnilateralExercise('Болгарские сплит-приседы')).toBe(true);
    expect(isUnilateralExercise('Жим штанги лёжа')).toBe(false);
  });
});
