import { describe, it, expect } from 'vitest';
import { cameraAngleCheck, cameraAngleShortLine, sideConflictCheck, sessionAngleMismatch, snapshotBarRep, barDriftDirection } from '../strength-sport-video.engine';

/**
 * Траектория штанги: вертикальный ход `dyCm` и горизонтальный уход `dxCm` за серию.
 * Так проверяется именно тот сигнал, который реально виден по замеру.
 */
function path(opts?: { dxCm?: number; dyCm?: number; n?: number }) {
  const n = opts?.n ?? 40;
  const dy = opts?.dyCm ?? 40;
  const dx = opts?.dxCm ?? 0;
  return Array.from({ length: n }, (_, i) => ({
    t: i / 30,
    x: 100 + (dx * i) / (n - 1),
    y: 50 + (dy * i) / (n - 1),
  }));
}

describe('cameraAngleCheck — ракурс по замеру, без догадок', () => {
  it('меньше 8 точек — null: утверждать нечего', () => {
    expect(cameraAngleCheck([])).toBeNull();
    expect(cameraAngleCheck(path({ n: 7 }))).toBeNull();
    expect(cameraAngleCheck(null as unknown as [])).toBeNull();
  });

  it('ровная вертикаль без перспективы: ok, но честно про некалиброванную перспективу', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }))!;
    expect(r.flag).toBe('ok');
    expect(r.driftPct).toBe(0);
    expect(r.skewPct).toBeNull();
    expect(r.reason).toContain('перспектива не калибрована');
    expect(r.azimuthKnown).toBe(false);
  });

  it('ровная вертикаль с перспективой: ok и оба числа названы', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 1.2 })!;
    expect(r.flag).toBe('ok');
    expect(r.skewPct).toBe(1.2);
    expect(r.reason).toContain('разброс масштаба по высоте 1.2%');
  });

  it('разброс масштаба выше порога → tilt: нужна перспектива, иначе высоты искажены', () => {
    const r = cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 6 })!;
    expect(r.flag).toBe('tilt');
    expect(r.driftPct).toBe(0);
    expect(r.reason).toContain('плывёт на 6%');
    expect(r.reason).toContain('перспективу по 4 кадрам');
    // Искажение масштаба важнее горизонтального хода: вердикт один и он про масштаб.
    expect(cameraAngleCheck(path({ dxCm: 20, dyCm: 40 }), { skewPct: 10 })!.flag).toBe('tilt');
  });

  it('горизонтальный ход выше порога → drift, и в причине ДВЕ версии без выбора', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { side: 'right' })!;
    expect(r.driftPct).toBe(25);
    expect(r.flag).toBe('drift');
    expect(r.reason).toContain('либо техника');
    expect(r.reason).toContain('не различить');
    expect(r.reason).toContain('переснимите строго сбоку');
  });

  it('граница: ровно 20% хода — ещё не нарушение', () => {
    const r = cameraAngleCheck(path({ dxCm: 8, dyCm: 40 }))!;
    expect(r.driftPct).toBe(20);
    expect(r.flag).toBe('ok');
  });

  it('порог настраивается явно', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { driftLimitPct: 40 })!;
    expect(r.flag).toBe('ok');
    const strict = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { driftLimitPct: 5 })!;
    expect(strict.flag).toBe('drift');
  });

  it('вертикальный ход меньше 2 см → unknown: ракурс по такому треку не проверить', () => {
    const flat = Array.from({ length: 40 }, (_, i) => ({ t: i / 30, x: 100 + i * 0.1, y: 50 + Math.sin(i) * 0.05 }));
    const r = cameraAngleCheck(flat)!;
    expect(r.flag).toBe('unknown');
    expect(r.driftPct).toBeNull();
    expect(r.reason).toContain('меньше 2 см');
  });

  it('мусорные значения не ломают расчёт, но и не выдумывают цифр', () => {
    const pts = path({ dxCm: 0 });
    pts[0] = { t: 0, x: Number.NaN, y: 50 };
    pts[1] = { t: 0.1, x: 100, y: Number.POSITIVE_INFINITY };
    const r = cameraAngleCheck(pts)!;
    expect(r).not.toBeNull();
    expect(r.driftPct).toBe(0);
    // Некорректный разброс масштаба — это null, а не 0 (0 значил бы «проверено и ровно»).
    expect(cameraAngleCheck(path(), { skewPct: Number.NaN })!.skewPct).toBeNull();
    expect(cameraAngleCheck(path(), { skewPct: -2 })!.skewPct).toBeNull();
  });

  it('ракурс «спереди/сбоку» не определяется никогда — это заявлено в каждом вердикте', () => {
    const cases = [
      cameraAngleCheck(path({ dxCm: 0 }))!,
      cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }))!,
      cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 9 })!,
      cameraAngleCheck(Array.from({ length: 20 }, (_, i) => ({ t: i / 30, x: 100, y: 50 + i * 0.05 })))!,
    ];
    for (const r of cases) {
      expect(r.azimuthKnown).toBe(false);
      expect(r.reason).toContain('«спереди/сбоку»');
    }
  });

  it('одиночный выброс трекера не создаёт ложного «ухода»', () => {
    const clean = path({ dxCm: 0 });
    // Одна точка улетела на 20 см — это глюк трекера, а не уход штанги.
    const spiked = clean.map((p, i) => (i === 15 ? { ...p, x: p.x + 20 } : p));
    const r = cameraAngleCheck(spiked)!;
    expect(r.driftPct).toBe(0);
    expect(r.flag).toBe('ok');
  });

  it('выброс по вертикали не занижает уход (иначе «ok» был бы фальшивым)', () => {
    const pts = path({ dxCm: 10, dyCm: 40 }).map((p, i) => (i === 20 ? { ...p, y: p.y + 400 } : p));
    const r = cameraAngleCheck(pts)!;
    expect(r.driftPct).toBe(25);
    expect(r.flag).toBe('drift');
  });

  it('«спереди» меняет трактовку: уход = техника, а не косая камера', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { side: 'front' })!;
    expect(r.basis).toBe('front');
    expect(r.flag).toBe('drift');
    expect(r.reason).toContain('боковой уход');
    expect(r.reason).toContain('сигнал техники');
    expect(r.reason).not.toContain('не перпендикулярно');
  });

  it('«сбоку» — две версии причины без выбора', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { side: 'left' })!;
    expect(r.basis).toBe('side');
    expect(r.reason).toContain('не перпендикулярно');
    expect(r.reason).toContain('не различить');
  });

  it('ракурс не указан — цифра есть, трактовки нет', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }))!;
    expect(r.basis).toBe('unknown');
    expect(r.driftPct).toBe(25);
    expect(r.azimuthDeg).toBeNull();
    expect(r.azimuthKnown).toBe(false);
    expect(r.reason).toContain('не измерен');
    expect(r.reason).toContain('укажите эталон в кадре');
    expect(r.reason).toContain('станет однозначным');
  });

  it('ракурс измерен по эталону: basis выводится из угла, а не из метаданных', () => {
    const side = cameraAngleCheck(path({ dxCm: 0 }), { azimuthDeg: 8 })!;
    expect(side.azimuthDeg).toBe(8);
    expect(side.azimuthKnown).toBe(true);
    expect(side.basis).toBe('side');
    expect(side.reason).toContain('измерен по эталону');
    expect(side.reason).toContain('отклонена от плоскости движения на 8°');

    // 60° и выше — уже не боковой вид, даже если в метаданных написано «сбоку».
    const front = cameraAngleCheck(path({ dxCm: 0 }), { azimuthDeg: 72, side: 'left' })!;
    expect(front.basis).toBe('front');
    expect(front.azimuthDeg).toBe(72);
  });

  it('измеренный боковой ракурс снимает «либо техника, либо камера»', () => {
    const r = cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { azimuthDeg: 6 })!;
    expect(r.flag).toBe('drift');
    expect(r.reason).toContain('камера в плоскости движения (отклонение 6°)');
    expect(r.reason).toContain('а техника');
    expect(r.reason).not.toContain('не различить');
  });

  it('неправдоподобный угол эталона (-5, 120, NaN) не применяется', () => {
    for (const bad of [-5, 120, NaN, Number.POSITIVE_INFINITY]) {
      const r = cameraAngleCheck(path({ dxCm: 0 }), { azimuthDeg: bad })!;
      expect(r.azimuthKnown).toBe(false);
      expect(r.azimuthDeg).toBeNull();
    }
  });

  it('длинная серия (20 000 точек) не роняет стек и считается', () => {
    const big = Array.from({ length: 20_000 }, (_, i) => ({ t: i / 60, x: 100 + i * 0.0005, y: 50 + i * 0.01 }));
    const r = cameraAngleCheck(big)!;
    expect(r).not.toBeNull();
    expect(r.driftPct).toBe(5);
  });
});

describe('cameraAngleShortLine — короткая строка для картинки', () => {
  it('нет замера — нет строки (картинку нечем подписывать)', () => {
    expect(cameraAngleShortLine(null)).toBeNull();
  });

  it('в норме — без восклицательного знака и без приговора', () => {
    const line = cameraAngleShortLine(cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 1.2 }))!;
    expect(line).toBe('ракурс: ход 0% · масштаб по высоте 1.2% — в норме');
    expect(line).not.toContain('⚠');
  });

  it('уход — предупреждение с двумя версиями, как и в отчёте', () => {
    const line = cameraAngleShortLine(cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { side: 'left' }))!;
    expect(line).toContain('⚠');
    expect(line).toContain('ход 25%');
    expect(line).toContain('либо техника, либо камера не под 90°');
  });

  it('вид спереди подписывает цифру как боковой уход', () => {
    const line = cameraAngleShortLine(cameraAngleCheck(path({ dxCm: 10, dyCm: 40 }), { side: 'front' }))!;
    expect(line).toContain('уход вбок 25%');
    expect(line).not.toContain('не под 90°');
  });

  it('косая камера — рецепт, а не диагноз техники', () => {
    const line = cameraAngleShortLine(cameraAngleCheck(path({ dxCm: 0 }), { skewPct: 8 }))!;
    expect(line).toContain('масштаб по высоте 8%');
    expect(line).toContain('нужна перспектива');
    expect(line).not.toContain('техника');
  });

  it('нехватка хода — прямо сказано, что замер не сделан', () => {
    const line = cameraAngleShortLine(cameraAngleCheck(path({ dyCm: 1 })))!;
    expect(line).toBe('ракурс не проверен: ход по вертикали < 2 см');
  });
});

describe('sideConflictCheck — параметры съёмки против замера', () => {
  it('параметры «спереди», замер 8° — спор: метрику бракуют зря', () => {
    const c = sideConflictCheck('front', 8)!;
    expect(c.kind).toBe('meta-front-measured-side');
    expect(c.azimuthDeg).toBe(8);
    expect(c.text).toContain('камера в плоскости движения (8°)');
    expect(c.text).toContain('бракует xLoop');
    // Никакого выбора стороны за пользователя: сказано только направление правки.
    expect(c.text).toContain('Укажите сторону съёмки');
    expect(c.text).not.toContain('слева');
  });

  it('параметры «сбоку», замер 61° — спор: сравнимость обещана зря', () => {
    for (const side of ['left', 'right'] as const) {
      const c = sideConflictCheck(side, 61)!;
      expect(c.kind).toBe('meta-side-measured-front');
      expect(c.metaSide).toBe(side);
      expect(c.text).toContain('почти спереди (61°)');
      expect(c.text).toContain('перестанет обещать сравнимость');
    }
  });

  it('согласие сторон — спора нет (порог тот же, что у вердикта: 60°)', () => {
    expect(sideConflictCheck('front', 61)).toBeNull();
    expect(sideConflictCheck('left', 60)).toBeNull();
    expect(sideConflictCheck('right', 8)).toBeNull();
    expect(sideConflictCheck('left', 0)).toBeNull();
  });

  it('нет данных или мусор — спорить не о чем', () => {
    expect(sideConflictCheck('', 8)).toBeNull();
    expect(sideConflictCheck(null, 8)).toBeNull();
    expect(sideConflictCheck(undefined, 61)).toBeNull();
    expect(sideConflictCheck('front', null)).toBeNull();
    expect(sideConflictCheck('left', undefined)).toBeNull();
    expect(sideConflictCheck('front', NaN)).toBeNull();
    expect(sideConflictCheck('front', -5)).toBeNull();
    expect(sideConflictCheck('front', 120)).toBeNull();
  });
});

describe('sessionAngleMismatch — разные ракурсы двух сессий', () => {
  const snap = (o: { vmax?: number; xLoop?: number; cosPhi?: number; angleDeg?: number }) => ({
    index: 1,
    vmax: o.vmax ?? 0.4,
    xLoop: o.xLoop ?? 2,
    amplitude: 40,
    points: [[0, 0], [1, 1]] as Array<[number, number]>,
    ...(o.cosPhi != null ? { cosPhi: o.cosPhi } : {}),
    ...(o.angleDeg != null ? { angleDeg: o.angleDeg } : {}),
  });

  it('одинаковый ракурс — молчим (это шум тапа, а не разница съёмки)', () => {
    expect(sessionAngleMismatch(snap({ cosPhi: 0.99, angleDeg: 8 }), snap({ cosPhi: 0.98, angleDeg: 11 }))).toBeNull();
  });

  it('8° против 25°: ΔxLoop назван разницей ракурсов и дан с поправкой', () => {
    const m = sessionAngleMismatch(snap({ cosPhi: 0.99, angleDeg: 8 }), snap({ cosPhi: 0.906, angleDeg: 25 }))!;
    expect(m.pct).toBe(8.5);
    expect(m.prevDeg).toBe(8);
    expect(m.curDeg).toBe(25);
    expect(m.text).toContain('разница ракурсов, а не техники');
    // Скорость от поворота камеры вокруг вертикали не портится — это важно сказать.
    expect(m.text).toContain('vmax сравнивать можно');
    expect(m.correctedDeltaCm).toBe(0.2);
    expect(m.text).toContain('С поправкой на ракурс ΔxLoop ≈ +0.2 см');
    expect(m.text).toContain('оценка');
  });

  it('дальше 40° поправка не предлагается — только vmax', () => {
    const m = sessionAngleMismatch(snap({ cosPhi: 0.99, angleDeg: 8 }), snap({ cosPhi: 0.5, angleDeg: 60 }))!;
    expect(m.correctedDeltaCm).toBeNull();
    expect(m.text).toContain('Поправка недопустима');
    expect(m.text).toContain('сравнивайте только vmax');
  });

  it('ракурс не записан — не выдумываем ни предупреждения, ни поправки', () => {
    expect(sessionAngleMismatch(snap({ xLoop: 2 }), snap({ cosPhi: 0.5, angleDeg: 60 }))).toBeNull();
    expect(sessionAngleMismatch(snap({ cosPhi: 0.99 }), snap({ xLoop: 2 }))).toBeNull();
    expect(sessionAngleMismatch(null, snap({ cosPhi: 0.5 }))).toBeNull();
    expect(sessionAngleMismatch(snap({ cosPhi: 0 }), snap({ cosPhi: 0.5 }))).toBeNull();
  });
});

describe('snapshotBarRep — ракурс едет в снимок серии', () => {
  const rep = {
    index: 1, vmax: 0.42, xLoop: 2.4, amplitude: 41,
    points: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 1, y: 9 }, { t: 0.2, x: 0, y: 0 }],
  } as unknown as Parameters<typeof snapshotBarRep>[0];

  it('ракурс сохраняется вместе с повтором — иначе сравнение сессий слепо', () => {
    const s = snapshotBarRep(rep, 24, { cosPhi: 0.9056, azimuthDeg: 25.4 });
    expect(s.cosPhi).toBe(0.906);
    expect(s.angleDeg).toBe(25);
  });

  it('без ракурса полей нет вовсе (а не 0 и не 1)', () => {
    const s = snapshotBarRep(rep);
    expect('cosPhi' in s).toBe(false);
    expect('angleDeg' in s).toBe(false);
  });

  it('мусорный ракурс отбрасывается: неправдоподобный cos φ и угол вне 0…90', () => {
    expect('cosPhi' in snapshotBarRep(rep, 24, { cosPhi: 0 })).toBe(false);
    expect('cosPhi' in snapshotBarRep(rep, 24, { cosPhi: 1.5 })).toBe(false);
    expect('cosPhi' in snapshotBarRep(rep, 24, { cosPhi: NaN })).toBe(false);
    expect('angleDeg' in snapshotBarRep(rep, 24, { cosPhi: 0.9, azimuthDeg: 120 })).toBe(false);
    expect('angleDeg' in snapshotBarRep(rep, 24, { cosPhi: 0.9, azimuthDeg: -5 })).toBe(false);
  });
});

describe('barDriftDirection — знак смещения словами, а не «+0.5 см»', () => {
  it('жим: камера слева → +x это к голове (спортсмен в кадре головой вправо)', () => {
    const d = barDriftDirection(0.5, 'left', 'bench');
    expect(d.dir).toBe('toward-head');
    expect(d.text).toContain('к голове');
    expect(d.text).toContain('камера слева');
    // Оговорка про зеркальную запись — часть ответа, а не сноска.
    expect(d.text).toContain('зеркальной');
    expect(barDriftDirection(-0.5, 'left', 'bench').dir).toBe('toward-feet');
  });

  it('жим: камера справа — картинка зеркальная, знак меняется', () => {
    expect(barDriftDirection(0.5, 'right', 'bench').dir).toBe('toward-feet');
    expect(barDriftDirection(-0.5, 'right', 'bench').dir).toBe('toward-head');
  });

  it('стоя: вперёд/назад вместо головы/ног', () => {
    expect(barDriftDirection(1.2, 'left', 'squat').dir).toBe('forward');
    expect(barDriftDirection(1.2, 'left', 'squat').text).toContain('вперёд');
    expect(barDriftDirection(-1.2, 'right', 'deadlift').dir).toBe('forward');
    expect(barDriftDirection(-1.2, 'left', 'deadlift').dir).toBe('backward');
  });

  it('меньше 0.3 см — шум трекинга, а не направление', () => {
    expect(barDriftDirection(0.2, 'left', 'bench').dir).toBe('level');
    expect(barDriftDirection(-0.2, 'left', 'bench').text).toContain('по вертикали');
    // Порог настраиваемый: 0.25 см при пороге 0.1 — уже направление.
    expect(barDriftDirection(0.25, 'left', 'bench', 0.1).dir).toBe('toward-head');
  });

  it('нет стороны съёмки — нет и слова, только причина', () => {
    const d = barDriftDirection(1.5, '', 'bench');
    expect(d.dir).toBe('unknown');
    expect(d.text).toContain('не указана');
    expect(d.text).not.toContain('к голове');
  });

  it('вид спереди: «влево/вправо» в кадре не переводится в тело', () => {
    const d = barDriftDirection(1.5, 'front', 'bench');
    expect(d.dir).toBe('unknown');
    expect(d.text).toContain('спереди');
    expect(barDriftDirection(1.5, 'front', 'squat').dir).toBe('unknown');
  });

  it('мусор вместо смещения — unknown, а не ноль', () => {
    expect(barDriftDirection(NaN, 'left', 'bench').dir).toBe('unknown');
    expect(barDriftDirection(null, 'left', 'bench').dir).toBe('unknown');
  });
});
