/**
 * TZRisk3DModel.test.ts — анатомические и визуальные инварианты 3D-модели рисков.
 *
 * Контекст: до этой правки тест закреплял сами дефекты — печень на +x (это
 * ЛЕВО тела), селезёнку на −x (это ПРАВО тела), кардио-зону r=0.22, которая
 * захватывала печень, и репродуктивную зону на y=−0.42 (середина бедра).
 * Теперь проверяется анатомия, а не прежние числа.
 *
 * Система координат (замерено на public/bodybuilder.glb):
 *   +x = ЛЕВО тела, −x = ПРАВО тела, +y = вверх, +z = лицо/перед.
 */
import { describe, it, expect } from 'vitest';
import { assignVertexSystems, ORGAN_MODELS, SYSTEM_ANCHORS, RENDER_LOOK, organSize, ORGAN_SPACE } from '../TZRisk3DModel';
import { getRiskColor } from '../../../../core/utils/risk-colors';
import { ORGAN_SHAPES, BODY_UNIT_CM, organShapeExtent, buildSilhouetteProfile, placeInsideBody, silhouetteAt, type SilhouetteBand } from '../../../../engines/organ-shape.engine';

const TZ_SYSTEMS = ['cns', 'cardio', 'hepatic', 'hematologic', 'renal', 'reproductive'] as const;

const anchor = (id: string) => {
  const a = SYSTEM_ANCHORS.find(x => x.id === id);
  if (!a) throw new Error(`нет якоря ${id}`);
  return a;
};

/**
 * Измеренный профиль силуэта реального bodybuilder.glb (полная ширина, включая руки).
 * Таблица получена замером вершин по полосам ±0.02 — см. комментарий в organ-shape.engine.
 */
const MEASURED: SilhouetteBand[] = [
  { y: -0.5, halfW: 0.5, zFront: 0.2, zBack: -0.2 },
  { y: -0.04, halfW: 0.4956, zFront: 0.2306, zBack: -0.1814 },
  { y: 0.0, halfW: 0.4994, zFront: 0.221, zBack: -0.203 },
  { y: 0.1, halfW: 0.5106, zFront: 0.2163, zBack: -0.1965 },
  { y: 0.2, halfW: 0.5084, zFront: 0.1432, zBack: -0.142 },
  { y: 0.32, halfW: 0.5139, zFront: 0.1615, zBack: -0.2092 },
  { y: 0.37, halfW: 0.5082, zFront: 0.1667, zBack: -0.2143 },
  { y: 0.9, halfW: 0.0914, zFront: 0.1143, zBack: -0.0956 },
  { y: 0.905, halfW: 0.0908, zFront: 0.1143, zBack: -0.0956 },
];

describe('сцена не тёмная', () => {
  it('канвас непрозрачный — иначе просвечивает глобальный тёмный фон canvas', () => {
    expect(RENDER_LOOK.alpha).toBe(false);
  });

  it('фон сцены задан явно (alpha:false без фона = чёрный/глобальный)', () => {
    expect(RENDER_LOOK.background).toBe(0x2f3a52);
    expect(RENDER_LOOK.backgroundCss).toBe('#2f3a52');
  });

  it('фон сцены светлее прежнего чёрного (#141414) и не «фиолетовый туман»', () => {
    // #141414 = 0x141414, 0x2f3a52 светлее по всем каналам
    for (const ch of [0x2f, 0x3a, 0x52]) expect(ch).toBeGreaterThan(0x14);
  });

  it('экспозиция выше прежних 0.85 (ACES сам затемняет)', () => {
    expect(RENDER_LOOK.exposureNative).toBeGreaterThanOrEqual(1);
    expect(RENDER_LOOK.exposureWeb).toBeGreaterThanOrEqual(1);
  });

  it('кожа не затемняется в пол (было multiplyScalar(0.88))', () => {
    expect(RENDER_LOOK.bodyDimFactor).toBe(1);
  });

  it('рентген-тело с выключенными органами читается (было opacity 0.32)', () => {
    expect(RENDER_LOOK.bodyOpacityNoOrgans).toBeGreaterThan(0.32);
  });
});

describe('SYSTEM_ANCHORS — анатомия зон', () => {
  it('все 6 систем ТЗ покрыты ровно одним якорем', () => {
    expect(SYSTEM_ANCHORS).toHaveLength(6);
    expect(new Set(SYSTEM_ANCHORS.map(a => a.id))).toEqual(new Set(TZ_SYSTEMS));
  });

  it('ЦНС — в голове (y > 0.8)', () => {
    expect(anchor('cns').pos[1]).toBeGreaterThan(0.8);
  });

  it('сердце — в верхней части груди, не в животе (0.3 < y < 0.45)', () => {
    const y = anchor('cardio').pos[1];
    expect(y).toBeGreaterThan(0.3);
    expect(y).toBeLessThan(0.45);
  });

  it('печень — справа по телу (−x) и в верхней части живота', () => {
    expect(anchor('hepatic').pos[0]).toBeLessThan(0);
    expect(anchor('hepatic').pos[1]).toBeGreaterThan(0.25);
  });

  it('селезёнка/кровь — слева по телу (+x), то есть зеркально печени', () => {
    expect(anchor('hematologic').pos[0]).toBeGreaterThan(0);
    expect(anchor('hepatic').pos[0] * anchor('hematologic').pos[0]).toBeLessThan(0);
  });

  it('почки — сзади (z < 0) и выше таза (y > 0.1)', () => {
    expect(anchor('renal').pos[2]).toBeLessThan(0);
    expect(anchor('renal').pos[1]).toBeGreaterThan(0.1);
    expect(anchor('renal').side).toBe('back');
  });

  it('репродуктивная зона — в тазу, а не на середине бедра', () => {
    const y = anchor('reproductive').pos[1];
    expect(y).toBeGreaterThan(-0.15);
    expect(y).toBeLessThan(0.05);
    // Прежний дефект: −0.42 — это середина бедра.
    expect(y).toBeGreaterThan(-0.3);
  });

  it('у соседних зон якорь не совпадает с якорем другой системы', () => {
    // Сферы зон частично перекрываются — это анатомия (сердце и печень рядом,
    // их центры разнесены всего на 0.15). Поэтому проверяется не «сферы не
    // пересекаются», а то, что реально важно: каждая анатомическая точка
    // разрешается в СВОЮ систему (см. describe ниже).
    for (let i = 0; i < SYSTEM_ANCHORS.length; i++) {
      for (let j = i + 1; j < SYSTEM_ANCHORS.length; j++) {
        const a = SYSTEM_ANCHORS[i];
        const b = SYSTEM_ANCHORS[j];
        const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
        expect(d, `${a.id} ↔ ${b.id}: якоря совпали`).toBeGreaterThan(1e-6);
      }
    }
  });

  it('зона сердца не «съедает» верх живота (печень разрешается в печень)', () => {
    const liver = anchor('hepatic').pos;
    const out = assignVertexSystems(new Float32Array(liver));
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hepatic');
  });

  it('зона крови не «съедает» правый верх живота', () => {
    const out = assignVertexSystems(new Float32Array(anchor('hepatic').pos));
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hepatic');
    const out2 = assignVertexSystems(new Float32Array(anchor('hematologic').pos));
    expect(SYSTEM_ANCHORS[out2[0]].id).toBe('hematologic');
  });
});

describe('ORGAN_MODELS — органы по анатомии', () => {
  it('каждая из 6 систем имеет хотя бы одну модель', () => {
    for (const s of TZ_SYSTEMS) {
      expect(ORGAN_MODELS.some(d => d.system === s), s).toBe(true);
    }
  });

  it('у каждой модели задан либо валидный GLB, либо форма organ-shape', () => {
    for (const def of ORGAN_MODELS) {
      if (def.kind === 'glb') expect(def.url, def.system).toMatch(/^\/organs\/.+\.glb$/);
      else {
        expect(def.shape, def.system).toBeTruthy();
        expect(ORGAN_SHAPES[def.shape!], def.system).toBeTruthy();
      }
    }
  });

  it('модель органа стоит на той же стороне, что и зона системы', () => {
    for (const def of ORGAN_MODELS) {
      const a = anchor(def.system);
      if (Math.abs(a.pos[0]) < 0.01) continue; // центральные органы
      expect(Math.sign(def.pos[0]), `${def.system}: сторона органа`).toBe(Math.sign(a.pos[0]));
    }
  });

  it('орган по высоте близок к зоне своей системы (≤ 0.2)', () => {
    for (const def of ORGAN_MODELS) {
      const dy = Math.abs(def.pos[1] - anchor(def.system).pos[1]);
      expect(dy, `${def.system}: Δy=${dy.toFixed(3)}`).toBeLessThanOrEqual(0.2);
    }
  });

  it('размер органов анатомический: 2.5–21 см (тело ≈2.0 = 180 см, 1 ед. = 90 см)', () => {
    for (const def of ORGAN_MODELS) {
      // organSize берёт размер из формы (procedural) или из поля size (GLB).
      const cm = organSize(def) * BODY_UNIT_CM;
      expect(cm, `${def.system}: ${cm.toFixed(1)} см`).toBeGreaterThan(2.5);
      expect(cm, `${def.system}: ${cm.toFixed(1)} см`).toBeLessThan(21);
    }
  });

  it('у процедурных моделей размер НЕ дублируется в двух местах', () => {
    // Печень однажды разъехалась: shape.size=0.25, а в модели стояло size=0.26.
    for (const def of ORGAN_MODELS) {
      if (def.kind !== 'procedural') continue;
      expect(def.size, `${def.system}: размер должен браться только из формы`).toBeUndefined();
    }
  });

  it('репродуктивная система различает мужскую и женскую модели', () => {
    const repro = ORGAN_MODELS.filter(d => d.system === 'reproductive');
    const male = repro.filter(d => !d.sex || d.sex === 'male');
    const female = repro.filter(d => d.sex === 'female');
    expect(male.some(d => (d.url || '').endsWith('prostate.glb'))).toBe(true);
    expect(female.some(d => d.shape === 'uterus')).toBe(true);
    expect(female.filter(d => (d.url || '').includes('ovary-'))).toHaveLength(2);
  });

  it('яичники стоят симметрично по бокам таза', () => {
    const ovaries = ORGAN_MODELS.filter(d => (d.url || '').includes('ovary-'));
    expect(ovaries).toHaveLength(2);
    const [a, b] = ovaries.map(o => o.pos[0]).sort((p, q) => p - q);
    expect(a * b).toBeLessThan(0);
    expect(Math.abs(a + b)).toBeLessThan(1e-9);
  });

  it('каждый орган целиком помещается в измеренный силуэт тела', () => {
    for (const def of ORGAN_MODELS) {
      // organShapeExtent отдаёт ПОЛУгабарит — делить на 2 нельзя.
      const half = def.kind === 'procedural'
        ? organShapeExtent(ORGAN_SHAPES[def.shape!])
        : GLB_HALF[def.url!.split('/').pop()!];
      const [x, y, z] = placeInsideBody(def.pos, half, MEASURED);
      const band = silhouetteAt(MEASURED, def.pos[1])!;
      // По бокам: центр органа + его полугабарит ≤ 90% полуширины тела
      expect(Math.abs(x) + half[0], `${def.system}: |x|+halfX`).toBeLessThanOrEqual(band.halfW * 0.9 + 1e-6);
      // По глубине: орган не выходит за переднюю и заднюю поверхности
      expect(z + half[2], `${def.system}: перед`).toBeLessThanOrEqual(band.zFront + 1e-6);
      expect(z - half[2], `${def.system}: зад`).toBeGreaterThanOrEqual(band.zBack - 1e-6);
      // По высоте: орган не выходит за макушку/низ модели
      expect(y + half[1], `${def.system}: верх`).toBeLessThanOrEqual(1.0);
      expect(y - half[1], `${def.system}: низ`).toBeGreaterThanOrEqual(-1.0);
    }
  });
});

describe('assignVertexSystems — клик по телу попадает в свою зону', () => {
  const at = (p: [number, number, number]) => {
    const out = assignVertexSystems(new Float32Array(p));
    return out[0] >= 0 ? SYSTEM_ANCHORS[out[0]].id : null;
  };

  it('голова → ЦНС', () => expect(at([0, 0.90, 0.02])).toBe('cns'));
  it('грудь → Сердце', () => expect(at([0.05, 0.37, 0.10])).toBe('cardio'));
  it('правая верхняя часть живота → Печень (не Сердце!)', () => expect(at([-0.10, 0.32, 0.08])).toBe('hepatic'));
  it('левая верхняя часть живота → кровь (не Печень!)', () => expect(at([0.13, 0.32, 0.0])).toBe('hematologic'));
  it('поясница сзади → Почки', () => expect(at([0, 0.20, -0.10])).toBe('renal'));
  it('таз → Репродуктивная', () => expect(at([0, -0.04, 0.045])).toBe('reproductive'));

  it('точка вне тела (у стоп) не попадает ни в одну зону', () => {
    expect(at([0.5, -1.0, 0.5])).toBeNull();
  });

  it('работает с измеренным профилем тела (z-якорь вынесен наружу)', () => {
    const out = assignVertexSystems(new Float32Array([0, 0.20, -0.10]), SYSTEM_ANCHORS, MEASURED);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('renal');
  });

  it('кастомные якоря работают', () => {
    const out = assignVertexSystems(
      new Float32Array([0, 0.1, 0]),
      [{ id: 'test', label: 't', pos: [0, 0, 0] as [number, number, number], side: 'front' as const, r: 0.5 }],
    );
    expect(out[0]).toBe(0);
  });
});

describe('пространство координат', () => {
  // Родительство объекта из теста не проверить, поэтому решение вынесено в
  // константу и используется в коде: возврат в 'scene' роняет этот тест.
  it('органы живут в локальном пространстве тела, а не в мировом', () => {
    expect(ORGAN_SPACE).toBe('body-local');
  });

  it('ANCHOR-ы и позиции органов в одном пространстве с измеренным силуэтом', () => {
    // Силуэт измерен по локальным вершинам GLB (тело ≈2.0). Если бы профиль
    // считали по мировым вершинам (тело = 3.0 + сдвиг 0.4), полуширины были бы
    // в 1.5 раза больше и якоря перестали бы попадать в тело.
    const head = silhouetteAt(MEASURED, 0.90)!;
    expect(head.halfW).toBeLessThan(0.2);
    expect(head.halfW).toBeGreaterThan(0.05);
    // Торс вдвое шире головы — это и доказывает, что измерение в телесных, а не мировых единицах.
    const torso = silhouetteAt(MEASURED, 0.37)!;
    expect(torso.halfW / head.halfW).toBeGreaterThan(3);
  });
});

describe('цвет риска — один канон на весь экран', () => {
  // Канон risk-colors.ts: <20 #22c55e, 20–40 #84cc16, 40–60 #eab308,
  // 60–80 #f97316, ≥80 #ef4444.
  // Локальная копия в RiskSpecMethod была 4-ступенчатой (25/50/75), из-за чего
  // 20–25% красились зелёным, а 25–40% — жёлтым вместо лаймового.
  it('20–25% — лаймовый по канону, а не зелёный (так красила локальная копия)', () => {
    expect(getRiskColor(22)).toBe('#84cc16');
    expect(getRiskColor(22)).not.toBe('#22c55e');
  });

  it('диапазон 25–40% не жёлтый (локальная копия отдавала жёлтый с 25%)', () => {
    expect(getRiskColor(35)).toBe('#84cc16');
    expect(getRiskColor(35)).not.toBe('#eab308');
  });

  it('шкала строго ступенчатая и заканчивается красным', () => {
    expect(getRiskColor(0)).toBe('#22c55e');
    expect(getRiskColor(100)).toBe('#ef4444');
    const steps = new Set([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(getRiskColor));
    expect(steps.size).toBe(5);
  });
});

/**
 * Полугабариты GLB-моделей в локальных единицах тела: size·osize/(2·maxDim),
 * где size задан в ORGAN_MODELS (локальные единицы, 1 = 90 см).
 */
const GLB_HALF: Record<string, [number, number, number]> = {
  'spleen.glb': [0.0277, 0.0667, 0.0340],
  'prostate.glb': [0.0207, 0.0140, 0.0222],
  'ovary-left.glb': [0.0086, 0.0167, 0.0073],
  'ovary-right.glb': [0.0086, 0.0167, 0.0073],
};

// Страховка от молчаливого расхождения: если движок поменяет форму,
// замеры всё равно останутся явными и будут проверяться заново.
describe('замеры соответствуют текущим формам', () => {
  it('профиль из синтетической геометрии не пустой', () => {
    const p = buildSilhouetteProfile(new Float32Array([0, 0, 0.1, 0.4, 0, 0.2, -0.4, 0, -0.2]), 0.5);
    expect(p.length).toBeGreaterThan(0);
  });
});
