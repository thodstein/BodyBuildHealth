import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('zz-meta-alt-probe', () => {
  it('TA: CORRECTIVE_META coverage + complex injectId', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/strength-sport/strength-sport-ta-corrective.engine.ts'), 'utf8');
    const libIds = Array.from(new Set(Array.from(src.matchAll(/^\s+P\('([a-z0-9_]+)'/gm)).map((m) => m[1])));
    const metaBlock = src.slice(src.indexOf('const CORRECTIVE_META'), src.indexOf('export function correctiveMetaOf'));
    const metaIds = new Set(Array.from(metaBlock.matchAll(/^\s+([a-z0-9_]+): \{ equipment:/gm)).map((m) => m[1]));
    const noMeta = libIds.filter((id) => !metaIds.has(id));
    console.log(`PROBE| TA lib=${libIds.length} meta=${metaIds.size} noMeta=${noMeta.length} [${noMeta.join(',')}]`);
    const complexes = Array.from(src.matchAll(/injectId: '([a-z0-9_]+)'/g)).map((m) => m[1]);
    const badInject = Array.from(new Set(complexes.filter((id) => !libIds.includes(id))));
    console.log(`PROBE| TA complexes=${complexes.length} injectNotInLib=${badInject.length} [${badInject.join(',')}]`);
  });
  it('BB: equipmentAlt / contraindicated coverage', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/bb/bb-corrective.engine.ts'), 'utf8');
    const block = src.slice(src.indexOf('export const BB_CORRECTIVES'), src.indexOf('export const BB_CORRECTIVE_COUNT'));
    const chunks = block.split(/\n\s{2}c\(/).slice(1);
    const noAlt = chunks.filter((ch) => !/equipmentAlt:/.test(ch)).length;
    const emptyAlt = chunks.filter((ch) => /equipmentAlt: \[\]/.test(ch)).length;
    const pmRed = chunks.filter((ch) => /'pm-red'/.test(ch)).length;
    const teen = chunks.filter((ch) => /'teen-loaded'/.test(ch)).length;
    const shoulder = chunks.filter((ch) => /'shoulder-pain'/.test(ch)).length;
    console.log(`PROBE| BB entries=${chunks.length} noAltField=${noAlt} emptyAlt=${emptyAlt} pmRed=${pmRed} teen=${teen} shoulderPain=${shoulder}`);
    for (const ch of chunks) {
      if (!/equipmentAlt:/.test(ch)) console.log(`PROBE| BB NOALT ${(ch.match(/c\('([a-z-]+)'/) || ch.match(/^'([a-z-]+)'/) || [])[1]}`);
    }
  });
});
