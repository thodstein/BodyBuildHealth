import { describe, it, expect } from 'vitest';
import { analyzeArmliftVideo } from '../armlift-video-flags.engine';

const straightCsv = ['t,x,y', '0,0.0,0', '0.5,0.5,10', '1.0,1.0,20', '1.5,1.5,30'].join('\n');
const wobblyCsv = ['t,x,y', '0,0,0', '0.5,8,10', '1.0,-4,20', '1.5,6,30'].join('\n');

describe('PRO-6 M6: видео-флаги', () => {
  it('без CSV — null', () => {
    expect(analyzeArmliftVideo({})).toBeNull();
  });
  it('ровный трек — чисто', () => {
    const r = analyzeArmliftVideo({ csv: straightCsv });
    expect(r?.parsed).toBe(true);
    expect(r?.flags).toEqual([]);
    expect(r?.note).toContain('чисто');
  });
  it('гуляние >10 — drift_big', () => {
    const r = analyzeArmliftVideo({ csv: wobblyCsv });
    expect(r?.flags).toContain('drift_big');
  });
  it('мусорный CSV — null без ручных флагов', () => {
    expect(analyzeArmliftVideo({ csv: 'мусор' })).toBeNull();
  });
  it('угол <160 — wrist_break даже без трека', () => {
    const r = analyzeArmliftVideo({ wristDeg: 150 });
    expect(r?.flags).toContain('wrist_break');
  });
  it('не параллелен — not_parallel', () => {
    expect(analyzeArmliftVideo({ parallelOk: false })?.flags).toContain('not_parallel');
  });
  it('рывок <1с — quick_pull', () => {
    const fast = ['t,x,y', '0,0,0', '0.3,1,10', '0.6,2,20'].join('\n');
    expect(analyzeArmliftVideo({ csv: fast })?.flags).toContain('quick_pull');
  });
  it('пиксельные единицы (разброс в метры) — без drift-флага, с пометкой калибровки', () => {
    const px = ['t,x,y', '0,0,0', '0.5,600,10', '1.0,100,20', '1.5,500,30'].join('\n');
    const r = analyzeArmliftVideo({ csv: px });
    expect(r?.flags).not.toContain('drift_big');
    expect(r?.note).toContain('калибруй');
  });
});
