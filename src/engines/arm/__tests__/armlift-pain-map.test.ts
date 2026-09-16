import { describe, it, expect } from 'vitest';
import { assessArmliftPainMap } from '../armlift-pain-map.engine';

describe('PRO-6 M8: карта боли', () => {
  it('без зон — тихо', () => {
    const r = assessArmliftPainMap({});
    expect(r.stop).toBe(false);
    expect(r.unload).toEqual([]);
  });
  it('красные флаги — стоп', () => {
    expect(assessArmliftPainMap({ numbness: true }).stop).toBe(true);
    expect(assessArmliftPainMap({ swelling: true }).stopNote).toContain('врачу');
    expect(assessArmliftPainMap({ nightPain: true }).unloadNote).toContain('врачу');
  });
  it('палец — щипок стоп, остальное можно', () => {
    const r = assessArmliftPainMap({ zones: ['thumb'] });
    expect(r.stop).toBe(false);
    expect(r.unloadNote).toContain('щипок стоп');
    expect(r.unloadNote).toContain('можно');
  });
  it('перепонка — широкий щипок стоп', () => {
    expect(assessArmliftPainMap({ zones: ['web'] }).unloadNote).toContain('широкий щипок стоп');
  });
  it('локоть снаружи vs внутри — разные разгрузки', () => {
    const lat = assessArmliftPainMap({ zones: ['elbow_lateral'] }).unloadNote;
    const med = assessArmliftPainMap({ zones: ['elbow_medial'] }).unloadNote;
    expect(lat).not.toBe(med);
  });
  it('две зоны — две строки', () => {
    expect(assessArmliftPainMap({ zones: ['wrist', 'shoulder'] }).unload.length).toBe(2);
  });
});
