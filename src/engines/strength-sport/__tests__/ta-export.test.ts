import { describe, it, expect } from 'vitest';
import { buildWLDiagnosticsHtml, buildWLCsv } from '../strength-sport-wl-export.engine';

const BASE: any = { weakPoints: ['snatch_mid'], score: 88, level: 'ok', verification: 0.3, findings: ['ok'] };

describe('TA export v2 E14', () => {
  it('backward compat: старый снап без новых полей', () => {
    const html = buildWLDiagnosticsHtml(BASE);
    expect(html).toContain('snatch_mid');
    expect(html).not.toContain('Биомеханика фаз');
    const csv = buildWLCsv(BASE);
    expect(csv).toContain('snatch_mid');
  });
  it('биомеханика + коррекции + попытки', () => {
    const html = buildWLDiagnosticsHtml({
      ...BASE,
      causes: { snatch_mid: 'volume' },
      biomech: [{ weakPoint: 'snatch_mid', label: 'Середина', joint: 'колено', angleRange: '60-90', weakMuscles: 'hams', reason: 'transition' }],
      corrections: [{ weakPoint: 'snatch_mid', corrId: 'pause_snatch', name: 'Рывок с паузой', protocol: '4×5 @70%' }],
      attempts: { snatch: [90, 96, 102] },
    });
    expect(html).toContain('Биомеханика фаз');
    expect(html).toContain('Рывок с паузой');
    expect(html).toContain('90 / 96 / 102');
    expect(html).toContain('volume');
  });
  it('XSS-экранирование', () => {
    const html = buildWLDiagnosticsHtml({ ...BASE, weakPoints: ['<script>alert(1)</script>'], findings: ['<b>x</b>'] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('CSV новые строки', () => {
    const csv = buildWLCsv({ ...BASE, causes: { snatch_mid: 'volume' }, corrections: [{ weakPoint: 'snatch_mid', corrId: 'pause_snatch', protocol: '4×5' }], attempts: { cj: [100, 106, 112] } });
    expect(csv).toContain('pause_snatch');
    expect(csv).toContain('cj=100/106/112');
  });
  it('инъекция notes секция', () => {
    const html = buildWLDiagnosticsHtml({ ...BASE, injectionNotes: ['✓ snatch_mid → pause_snatch'] });
    expect(html).toContain('Инъекция в план');
  });
  it('V4-B Sinclair секция + CSV', () => {
    const snap: any = { ...BASE, sinclair: { total: 225, coeff: 1.2691, value: 285.55 } };
    const html = buildWLDiagnosticsHtml(snap);
    expect(html).toContain('Sinclair');
    expect(html).toContain('285.55');
    expect(buildWLCsv(snap)).toContain('225/1.2691/285.55');
  });
});
