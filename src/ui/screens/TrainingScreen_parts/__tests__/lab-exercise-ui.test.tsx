/**
 * lab-exercise-ui.test.tsx — Epic F: лента, диагноз, мост, каталог-чипы, техника-блок, персист.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ExerciseLabMerged from '../ExerciseLabMerged';
import PrescriptionTab from '../ExerciseLabPrescription';
import ExerciseLabCatalog from '../ExerciseLabCatalog';
import TechniqueTab from '../ExerciseLabTechnique';
import ProSubstituteTab from '../ExerciseLabProSubstitute';
import CompareTab from '../ExerciseLabCompare';

const PLAN_KEY = 'he_bb_plan_saved';
const LAB_KEY = 'he_exercise_lab_v1';
const BRIDGE_KEY = 'he_planner_apply';
const TRAINING_PROFILE_KEY = 'he_training_profile';

function seedPlan() {
  localStorage.setItem(
    PLAN_KEY,
    JSON.stringify({
      plan: {
        weeks: [
          {
            sessions: [
              {
                exercises: [
                  { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2 },
                  { exerciseName: 'incline_db', name: 'Жим гантелей наклон', muscle: 'chest', sets: 3, rir: 2 },
                ],
              },
            ],
          },
        ],
      },
    }),
  );
}

describe('lab-exercise-ui', () => {
  beforeEach(() => {
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem('he_bb_plans');
    localStorage.removeItem(LAB_KEY);
    localStorage.removeItem(BRIDGE_KEY);
    localStorage.removeItem(TRAINING_PROFILE_KEY);
    localStorage.removeItem('he_profile_v2');
    localStorage.removeItem('he_bb_diagnostics_hub_v1');
  });

  it('лента с планом: сводка портфеля + Lab-скор', () => {
    seedPlan();
    render(<ExerciseLabMerged />);
    expect(screen.getByText(/Портфель плана/)).toBeTruthy();
    expect(screen.getByText(/SFR/)).toBeTruthy();
  });

  it('лента без плана: честный пустой стейт', () => {
    render(<ExerciseLabMerged />);
    expect(screen.getByText(/Нет плана ББ/)).toBeTruthy();
  });

  it('Шаг 1: карточка диагноза bench_bar с lowSFR', async () => {
    render(<PrescriptionTab selectedId="bench_bar" />);
    await waitFor(() => {
      expect(screen.getByText(/Диагноз упражнения/)).toBeTruthy();
    });
    expect(screen.getByText(/Низкий SFR/)).toBeTruthy();
    expect(screen.getByText(/Коррекция \(топ-1\)/)).toBeTruthy();
  });

  it('Шаг 1: топ-1 уходит в мост с labDiagnosis', async () => {
    render(<PrescriptionTab selectedId="bench_bar" />);
    await waitFor(() => {
      expect(screen.getByText('▶ Применить в план')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('▶ Применить в план'));
    const raw = localStorage.getItem(BRIDGE_KEY);
    expect(raw).toBeTruthy();
    const payload = JSON.parse(raw!);
    expect(payload.kind).toBe('weakpoints');
    expect(payload.data.labDiagnosis.flags.length).toBeGreaterThan(0);
    expect(payload.data.preferredExerciseIds.length).toBeGreaterThan(0);
    expect(payload.data.exerciseSwap.oldId).toBe('bench_bar');
  });

  it('каталог: SFR и профиль-чипы без открытия карточки', () => {
    render(<ExerciseLabCatalog />);
    expect(screen.getAllByText(/^SFR \d$/).length).toBeGreaterThan(0);
    const profileChips = screen.getAllByText(/^(растянут\.|серед\.|пик\.)~?$/);
    expect(profileChips.length).toBeGreaterThan(0);
  });

  it('Шаг 2: блок регрессии при травме мышцы', () => {
    localStorage.setItem(
      TRAINING_PROFILE_KEY,
      JSON.stringify({ injuries: [{ muscle: 'chest', exclude: true }] }),
    );
    render(<TechniqueTab />);
    fireEvent.click(screen.getByText(/Списком/));
    const toggles = screen.getAllByText('▼ Развернуть разбор').slice(0, 25);
    expect(toggles.length).toBeGreaterThan(0);
    let found = false;
    for (const btn of toggles) {
      fireEvent.click(btn);
      if (screen.queryByText(/Коррекция техники под ваш диагноз/)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('Шаг 1 с планом: бейдж «в плане», singleAngle-флаг и Δ до клика', async () => {
    localStorage.setItem(
      PLAN_KEY,
      JSON.stringify({
        plan: {
          weeks: [
            {
              sessions: [
                {
                  exercises: [
                    { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    render(<PrescriptionTab selectedId="bench_bar" />);
    await waitFor(() => {
      expect(screen.getByText(/Диагноз упражнения/)).toBeTruthy();
    });
    expect(screen.getByText(/в плане/)).toBeTruthy();
    expect(screen.getByText(/1 угол при ≥6 сетов/)).toBeTruthy();
    expect(screen.getByText(/Δ на плане/)).toBeTruthy();
  });

  it('Шаг 1: диагноз пишется в историю he_exercise_lab_v1', async () => {
    render(<PrescriptionTab selectedId="bench_bar" />);
    await waitFor(() => {
      expect(screen.getByText(/Диагноз упражнения/)).toBeTruthy();
    });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(LAB_KEY) || 'null');
      expect(saved?.history?.[0]?.exId).toBe('bench_bar');
    });
    expect(screen.getByText(/История диагнозов/)).toBeTruthy();
  });

  it('Шаг 3: замены ранжированы по Δ на плане', async () => {
    seedPlan();
    render(<ProSubstituteTab selectedId="bench_bar" />);
    await waitFor(() => {
      // Δ и в «Допустимых», и в «Все в группе».
      expect(screen.getAllByText(/Δ на плане/).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('экспорт: печать пишет HTML сводки, CSV скачивается Blob-ом', async () => {
    seedPlan();
    const writes: string[] = [];
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (s: string) => writes.push(s), close: () => {} },
      focus: () => {},
      print: () => {},
    } as never);
    render(<ExerciseLabMerged />);
    fireEvent.click(screen.getByText('🖨 Печать'));
    expect(writes.join('')).toMatch(/Лаборатория упражнений — сводка/);
    openSpy.mockRestore();
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: (b: Blob) => { blobs.push(b); return 'blob:lab'; },
      revokeObjectURL: () => {},
    });
    const downloads: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
    fireEvent.click(screen.getByText('📥 CSV'));
    expect(blobs).toHaveLength(1);
    expect(downloads).toEqual(['lab-audit.csv']);
    // Содержимое CSV покрыто движковыми тестами; тут — непустой Blob правильного типа.
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[0].type).toMatch(/csv/);
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('каталог: диагноз-чип только при плане', () => {
    const { unmount } = render(<ExerciseLabCatalog />);
    expect(screen.queryAllByText(/^(✓|⚠|🚫) \d+$/)).toHaveLength(0);
    unmount();
    seedPlan();
    render(<ExerciseLabCatalog />);
    expect(screen.queryAllByText(/^(✓|⚠|🚫) \d+$/).length).toBeGreaterThan(0);
  });

  it('Шаг 4: травма снижает safety-скор', () => {
    const readScore = () => {
      // Строка разбита по элементам (число в <b>) — матчим по полному textContent.
      const nodes = screen.getAllByText((_, el) => /Безопасность: \d+\/100/.test(el?.textContent || ''));
      const leaf = nodes.find((n) => n.tagName === 'DIV' && n.textContent?.startsWith('Безопасность:'));
      const m = /(\d+)\/100/.exec((leaf || nodes[0]).textContent || '');
      return m ? Number(m[1]) : NaN;
    };
    const { unmount } = render(<CompareTab initialId1="dips_chest" initialId2="bench_bar" />);
    const clean = readScore();
    unmount();
    localStorage.setItem(TRAINING_PROFILE_KEY, JSON.stringify({ injuries: [{ muscle: 'импинджмент', exclude: true }] }));
    render(<CompareTab initialId1="dips_chest" initialId2="bench_bar" />);
    expect(readScore()).toBeLessThan(clean);
  });

  it('персист: выбор в каталоге сохраняется в he_exercise_lab_v1', () => {
    const { container } = render(<ExerciseLabMerged />);
    fireEvent.click(screen.getByText(/📚 Каталог/));
    const firstCard = container.querySelector('.lib-excard') as HTMLElement;
    expect(firstCard).toBeTruthy();
    fireEvent.click(firstCard);
    fireEvent.click(screen.getByText('✓ Выбрать это упражнение'));
    const saved = JSON.parse(localStorage.getItem(LAB_KEY) || 'null');
    expect(typeof saved?.selectedId).toBe('string');
    expect(saved.selectedId.length).toBeGreaterThan(0);
  });
});
