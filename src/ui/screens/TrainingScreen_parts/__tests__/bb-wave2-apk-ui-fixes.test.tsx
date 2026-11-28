/**
 * Замки Волны 2 (docs/BB-AUTO-FULL-AUDIT-PLAN-2026-11.md):
 * P0-11  APK-safe экспорт/печать через apk-share.ts (плюс маркеры check-apk-markers.mjs)
 * P0-13  buildBBMuscleHeatmap матчит landmarks по group / normalizeBBMuscle (не серый 'none')
 * P0-14  BbExSwapModal отдаёт упражнения для quads/glutes/biceps/delt_mid/abs
 * P0-15  BbProgramLibraryPicker оборачивает .lib-sheet в .lib-picker внутри PortalOverlay
 * P1-11  Карточка нагрузки по суставам сравнивает недельный пик с thresh * 3 (не 40)
 * P1-25  «Свернуть все» работает с 1-го клика, PopupExerciseList показывает русские имена,
 *        нет «Подмышка», prepStep сбрасывается и he_prep_cycle_v1 восстанавливается
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { buildBBMuscleHeatmap } from '../../../../engines/bb/bb-visual.engine';
import { BbExSwapModal } from '../bb-step-ex-swap';
import { BbProgramLibraryPicker } from '../BbProgramLibraryPicker';
import { BbWeightsStep } from '../bb-step-weights';
import { PopupExerciseList } from '../../SRCBBScreen_parts/TrainingPopups';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';

const PARTS_DIR = path.resolve(__dirname, '..');
const readPart = (rel: string) => fs.readFileSync(path.join(PARTS_DIR, rel), 'utf8');

describe('Wave 2 APK & UI audit locks', () => {
  it('P0-13: buildBBMuscleHeatmap классифицирует статусы по l.group / RU l.muscle и не падает без mav', () => {
    const plan: any = {
      weeks: [
        {
          week: 1,
          phase: 'accumulation',
          sessions: [{ day: 1, exercises: [{ name: 'Жим', muscle: 'chest', sets: 12, rir: 2, workSets: [] }] }],
        },
      ],
      weeklyVolume: {
        1: {
          chest: { directSets: 12, effectiveSets: 12 },
          back: { directSets: 4, effectiveSets: 4 },
          quads: { directSets: 24, effectiveSets: 24 },
        },
      },
      volumeLandmarks: [
        { group: 'chest', muscle: 'Грудь', mev: 8, mav: 16, mrv: 20 },
        { group: 'back', muscle: 'Спина', mev: 10, mav: 18, mrv: 22 },
        { group: 'quads', muscle: 'Квадрицепсы', mev: 8, mav: 16, mrv: 20 },
      ],
    };
    const cells = buildBBMuscleHeatmap(plan);
    const byM = Object.fromEntries(cells.map(c => [c.muscle, c.status]));
    expect(byM.chest).toBe('mev_mav');
    expect(byM.back).toBe('below_mev');
    expect(byM.quads).toBe('over_mrv');

    // Без mav в опциях превышение mrv всё равно даёт over_mrv
    const cellsNoMav = buildBBMuscleHeatmap(
      { ...plan, volumeLandmarks: undefined },
      { mevByMuscle: { quads: 8 }, mrvByMuscle: { quads: 20 } },
    );
    expect(cellsNoMav.find(c => c.muscle === 'quads')?.status).toBe('over_mrv');
  });

  it('P0-14: BbExSwapModal находит упражнения для канонических мышц (quads/biceps/glutes/abs)', () => {
    for (const muscle of ['quads', 'biceps', 'glutes', 'abs']) {
      const { unmount } = render(
        <BbExSwapModal
          builtPlan={{ weeks: [] } as any}
          exSwapModal={{ si: 0, ei: 0, muscle, currentName: 'Неизвестное упражнение' }}
          exSwapSearch=""
          setExSwapSearch={() => {}}
          dialogRef={React.createRef<HTMLDivElement>()}
          onReplace={() => {}}
          onClose={() => {}}
        />,
      );
      expect(screen.queryByText('Ничего не найдено')).toBeNull();
      unmount();
    }
  });

  it('P0-15: BbProgramLibraryPicker рендерит .lib-sheet внутри .lib-picker в портале', () => {
    render(
      <BbProgramLibraryPicker
        label="Программа"
        value={null}
        onChange={() => {}}
        programs={[{ id: 'p1', name: 'Тест программа', durationWeeks: 8, daysPerWeek: 4, level: 'intermediate' } as any]}
      />,
    );
    fireEvent.click(screen.getByText('Выбрать программу...'));
    const sheet = document.querySelector('.lib-picker .lib-sheet');
    expect(sheet).not.toBeNull();
  });

  it('P1-25: «Свернуть все» на Шаге 5 сворачивает группы с первого клика', () => {
    const Wrap: React.FC = () => {
      const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
      return (
        <BbWeightsStep
          builtPlan={{ weeks: [] } as any}
          weightEntries={[{ name: 'Жим лёжа', muscle: 'chest', planWeight: 80, planReps: 8, planRir: 2, actualWeight: null } as any]}
          setWeightEntries={() => {}}
          weightsApplied={0}
          setWeightsApplied={() => {}}
          weightsCollapsed={collapsed}
          setWeightsCollapsed={setCollapsed}
          workMax={{}}
          setWorkMax={() => {}}
          setBuiltPlan={() => {}}
          setStep={() => {}}
          flash={() => {}}
          actionRow={null}
        />
      );
    };
    render(<Wrap />);
    expect(screen.getByText('Жим лёжа')).toBeTruthy();
    fireEvent.click(screen.getByText('Свернуть все'));
    expect(screen.queryByText('Жим лёжа')).toBeNull();
    fireEvent.click(screen.getByText('Развернуть все'));
    expect(screen.getByText('Жим лёжа')).toBeTruthy();
  });

  it('P1-25: PopupExerciseList отображает русское имя упражнения вместо сырого EN id', () => {
    const sample = EXERCISE_CATALOG[0];
    render(<PopupExerciseList label="Любимые" ids={[sample.id]} onChange={() => {}} />);
    fireEvent.click(screen.getByText('Любимые'));
    expect(screen.getByText(sample.name)).toBeTruthy();
  });

  it('P0-11, P1-11, P2: структурные замки экспорта, суставов и UI', () => {
    const ctor = readPart('BbAutoConstructor.tsx');
    expect(ctor).not.toContain('Подмышка');
    expect(ctor).toContain('Подгруппа');
    expect(ctor).toContain('printHtmlApk');
    expect(ctor).toContain('saveCsvApk');
    expect(ctor).toContain('saveTextFileApk');
    expect(ctor).toContain("localStorage.getItem('he_prep_cycle_v1')");
    expect(ctor).toContain("setPrepStep('params')");
    expect(ctor).not.toContain('disabled={specBlocks.length <= 1}');

    const qual = readPart('bb-quality-sections.tsx');
    expect(qual).toContain('const wHigh = (thresh?.high ?? 40) * 3');
    expect(qual).not.toContain('some((v:any)=> v>40)');
  });
});
