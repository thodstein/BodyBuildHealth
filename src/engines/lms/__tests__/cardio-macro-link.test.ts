import { describe, it, expect } from 'vitest';
import {
  buildMacrocycle, buildBbMacrocycle,
  serializeMacro, deserializeMacro, serializeBbMacro, deserializeBbMacro,
  attachCardioToMacro, detachCardioFromMacro,
} from '../macrocycle.engine';

describe('привязка кардио к макроциклу (cardioCycleId)', () => {
  it('PL: serialize/deserialize v7 сохраняет cardioCycleId', () => {
    const macro = buildMacrocycle({ level: 'advanced', goal: 'powerlifting', totalWeeks: 12 });
    const linked = attachCardioToMacro(macro, 'cardio-1') as typeof macro;
    const restored = deserializeMacro(serializeMacro(linked));
    expect(restored?.cardioCycleId).toBe('cardio-1');
  });

  it('PL: legacy v6 без k → cardioCycleId undefined (обратная совместимость)', () => {
    const macro = buildMacrocycle({ level: 'advanced', goal: 'powerlifting', totalWeeks: 12 });
    const v6 = JSON.stringify({ ...JSON.parse(serializeMacro(macro)), v: 6, k: undefined });
    const restored = deserializeMacro(v6);
    expect(restored?.cardioCycleId).toBeUndefined();
    expect(restored?.totalWeeks).toBe(12);
  });

  it('BB: serialize/deserialize v8 сохраняет cardioCycleId; v7 читается', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    const linked = attachCardioToMacro(macro, 'cardio-9') as typeof macro;
    const restored = deserializeBbMacro(serializeBbMacro(linked));
    expect(restored?.cardioCycleId).toBe('cardio-9');
    const v7 = JSON.stringify({ ...JSON.parse(serializeBbMacro(linked)), v: 7, k: undefined });
    const legacy = deserializeBbMacro(v7);
    expect(legacy?.cardioCycleId).toBeUndefined();
  });

  it('attach/detach не мутируют исходный объект', () => {
    const macro = buildMacrocycle({ level: 'advanced', goal: 'powerlifting', totalWeeks: 8 });
    const linked = attachCardioToMacro(macro, 'c-2');
    expect((linked as typeof macro).cardioCycleId).toBe('c-2');
    expect(macro.cardioCycleId).toBeUndefined();
    const detached = detachCardioFromMacro(linked);
    expect((detached as typeof macro).cardioCycleId).toBeUndefined();
    expect((linked as typeof macro).cardioCycleId).toBe('c-2');
  });
});
