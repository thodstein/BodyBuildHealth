/**
 * lab-exercise-ui.test.tsx — Epic F: лента, диагноз, мост, каталог-чипы, техника-блок, персист.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ExerciseLabMerged from '../ExerciseLabMerged';
import PrescriptionTab from '../ExerciseLabPrescription';
import ExerciseLabCatalog from '../ExerciseLabCatalog';
import TechniqueTab from '../ExerciseLabTechnique';

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
