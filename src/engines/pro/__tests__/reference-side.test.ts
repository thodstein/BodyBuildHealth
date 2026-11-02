import { describe, it, expect } from 'vitest';
import { referenceSideCheck } from '../trajectory-overlay.engine';

/**
 * Сторона камеры по кадру: длина эталона даёт только |φ|, а **порядок** концов
 * поперечного эталона даёт знак — то есть какой бок спортсмена снимали.
 *
 * Геометрия проверяется здесь же физикой, чтобы не «сойтись по памяти»: лежащий
 * головой на север, камера на его левом (западном) боку смотрит на восток, её
 * собственное «право» указывает на юг. Значит голова на изображении — слева,
 * то есть конец «у ног» правее конца «у головы».
 */

const head = (x: number, y = 300) => ({ x, y });
const feet = (x: number, y = 300) => ({ x, y });

describe('referenceSideCheck — сторона камеры по порядку концов эталона', () => {
  it('голова левее ног → камера слева', () => {
    const r = referenceSideCheck({ head: head(100), feet: feet(300) });
    expect(r.side).toBe('left');
    expect(r.text).toContain('слева');
    expect(r.text).toContain('измерение по кадру');
    expect(r.dxPx).toBe(200);
    expect(r.signal).toBe(1);
  });

  it('голова правее ног → камера справа', () => {
    const r = referenceSideCheck({ head: head(300), feet: feet(100) });
    expect(r.side).toBe('right');
    expect(r.text).toContain('справа');
    expect(r.dxPx).toBe(-200);
  });

  it('зеркальный кадр (селфи) переворачивает ответ, и текст это говорит', () => {
    const r = referenceSideCheck({ head: head(100), feet: feet(300), mirrored: true });
    expect(r.side).toBe('right');
    expect(r.text).toContain('зеркальн');
  });

  it('ось «вдоль штанги» сторону не даёт: концы проецируются в одну точку', () => {
    const r = referenceSideCheck({ head: head(100), feet: feet(300), axis: 'along' });
    expect(r.side).toBe('unknown');
    expect(r.text).toContain('вдоль штанги');
    expect(r.text).toContain('поперёк');
  });

  it('отрезок почти вертикален в кадре (камера почти спереди) → unknown, а не монетка', () => {
    const r = referenceSideCheck({ head: head(200, 100), feet: feet(210, 400) });
    expect(r.side).toBe('unknown');
    expect(r.text).toContain('почти вертикален');
    expect(r.text).toContain('сбоку');
    // Сигнал честно отдаётся наружу: видно, насколько он мал.
    expect(r.signal).toBeLessThan(0.06);
  });

  it('слишком короткий отрезок в кадре → unknown', () => {
    const r = referenceSideCheck({ head: head(100), feet: feet(104) });
    expect(r.side).toBe('unknown');
    expect(r.text).toContain('слишком короткий');
  });

  it('наклонный отрезок считается по доле сдвига, а не по абсолютным пикселям', () => {
    // dx=100, dy=100: сигнал ≈ 0.707 — сторона читается уверенно.
    const slanted = referenceSideCheck({ head: head(100, 100), feet: feet(200, 200) });
    expect(slanted.side).toBe('left');
    expect(slanted.signal).toBeCloseTo(0.707, 2);
    // Порог сигнала настраивается: при 0.9 тот же отрезок уже не годится.
    expect(referenceSideCheck({ head: head(100, 100), feet: feet(200, 200) }, { minSignal: 0.9 }).side).toBe('unknown');
  });

  it('нет разметки или мусор → unknown с причиной, без выдуманной стороны', () => {
    expect(referenceSideCheck(null).side).toBe('unknown');
    expect(referenceSideCheck(undefined).text).toContain('не размечен');
    const bad = referenceSideCheck({ head: { x: NaN, y: 0 }, feet: feet(300) });
    expect(bad.side).toBe('unknown');
    expect(bad.text).toContain('не размечен');
  });
});
