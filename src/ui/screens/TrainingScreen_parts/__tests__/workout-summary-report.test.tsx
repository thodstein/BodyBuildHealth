import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, screen } from '@testing-library/react';
import { WorkoutSummaryReport, ReportBlockPicker, PLAYER_REPORT_BLOCKS, readReportBlocks } from '../WorkoutSummaryReport';
import { resolveExerciseMeta } from '../../../../engines/workout-summary.engine';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import type { StrengthDiary } from '../../../engines/strength-diary.engine';

const mkWorkout = (date: string, split = 'FullBody'): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration: 60,
  overallRPE: 7,
  recoveryBefore: 4,
  split,
  exercises: [
    {
      id: `${date}_bench`, date, exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
      isCompound: true, weekNumber: 1,
      sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }, { weight: 80, reps: 8, rir: 1, rpe: 8 }],
      totalVolume: 1280, estimated1RM: 101,
    },
    {
      id: `${date}_squat`, date, exerciseId: 'squat', exerciseName: 'Приседания со штангой',
      isCompound: true, weekNumber: 1,
      sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }],
      totalVolume: 500, estimated1RM: 117,
    },
  ] as StrengthLogEntry[],
});

const workouts = [mkWorkout('2026-11-03'), mkWorkout('2026-11-05'), mkWorkout('2026-11-10')];

/** Жим с запасом: три подхода далеко от отказа, один — близко. */
const buildLazyWorkout = (): WorkoutLog => {
  const base = mkWorkout('2026-11-12');
  return {
    ...base,
    exercises: [{
      ...base.exercises[0],
      sets: [
        { weight: 80, reps: 8, rir: 4, rpe: 6 },
        { weight: 80, reps: 8, rir: 3, rpe: 7 },
        { weight: 80, reps: 8, rir: 3, rpe: 7 },
        { weight: 80, reps: 8, rir: 1, rpe: 8 },
      ],
    }] as StrengthLogEntry[],
  };
};

describe('WorkoutSummaryReport', () => {
  it('показывает сводку: общее, объём, мышцы, упражнения, движения', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} storageKey="test_blocks_report" />);
    expect(html).toContain('Общие показатели');
    expect(html).toContain('Распределение объёма');
    // Доля подходов — отдельная шкала: тоннаж переоценивает тяжёлые упражнения.
    expect(html).toContain('доля подходов');
    expect(html).toContain('По мышцам');
    expect(html).toContain('По упражнениям');
    expect(html).toContain('Движения (паттерны)');
    expect(html).toContain('тренд по неделям');
    // У движений доля подходов, а не только доля тоннажа.
    expect(html).toContain('Доля подходов');
    // Недельная динамика: тоннаж и КПШ рядом.
    expect(html).toContain('По неделям');
    expect(html).toContain('● КПШ');
    // В подсказке недели есть плотность, а не только объём: 3 сессии + 2 недели.
    expect((html.match(/кг\/мин/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('По тренировкам');
    // Неделя мезоцикла из журнала — в строке тренировки.
    expect(html).toContain('нед. 1');
    expect(html).toContain('Показать всё');
    expect(html).toContain('Жим штанги лёжа');
    expect(html).toContain('подх/нед');
    // Упражнение показывает подходы по неделям, а не только суммарные.
    expect(html).toContain('подх 4·2');
    expect(html).toContain('MEV ');
    expect(html).toContain('Интенсивность');
    expect(html).toContain('инт. ');
    // Подходы на тренировку с этой мышцей и частота, а не только сумма периода.
    expect(html).toContain('2/трен');
    expect(html).toContain('1.5×/нед');
    expect(html).toContain('Только проблемные (2)');
    expect(html).toContain('ниже MEV');
    // Конкретная правка объёма: не только «ниже MEV», но и сколько добавить.
    expect(html).toContain('+5/нед до MEV');
    expect(html).toContain('+6/нед до MEV');
  });

  it('показывает, сколько подходов было близко к отказу', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['totals']} showSelector={false} />);
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    // 3 тренировки по 3 подхода, все с RIR ≤ 2.
    expect(text).toContain('RIR ≤2: 9 из 9 подх. (100%)');
    const lazy = buildLazyWorkout();
    const html2 = renderToStaticMarkup(<WorkoutSummaryReport workouts={[lazy]} blocks={['totals']} showSelector={false} />);
    const text2 = html2.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    // 3 из 4 подходов с запасом 4–3 повтора — это видно, хотя средний RIR «нормальный».
    expect(text2).toContain('RIR ≤2: 1 из 4 подх. (25%)');
  });

  it('в отчёте за одну тренировку не обещает «/нед»', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} blocks={['muscles']} />);
    expect(html).toContain('подх за сессию');
    expect(html).toContain('ориентиры MEV/MAV/MRV недельные');
    expect(html).toContain('до MEV');
    expect(html).not.toContain('/нед до MEV');
  });

  it('блок «План → факт» сравнивает план с фактом по упражнениям', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        blocks={['plan', 'exercises']}
        plan={[
          { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
          { name: 'Тяга штанги в наклоне', sets: [{ weight: 60, reps: 10 }] },
        ]}
      />,
    );
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    expect(text).toContain('План: 4 подх');
    expect(text).toContain('выполнено 75% по подходам');
    expect(text).toContain('3 → 2 (-1)');
    expect(text).toContain('пропущено: Тяга штанги в наклоне');
    expect(text).toContain('не по плану: Приседания со штангой');
    // С блоком плана строки не дублируются под упражнениями.
    expect(text).not.toContain('план 3 → факт 2');
    // План → факт свёрнут по движениям: жим недобрал, тяга не сделана.
    expect(text).toContain(`${resolveExerciseMeta({ name: 'Жим штанги лёжа' }).patternLabel}3 → 2`);
    expect(text).toContain(`${resolveExerciseMeta({ name: 'Тяга штанги в наклоне' }).patternLabel}1 → 0`);
  });

  it('блок «План недели» сверяет микроцикл с журналом по мышцам', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        blocks={['weekplan']}
        weekPlanLabel="03.11–09.11"
        weekPlan={[
          {
            label: 'Верх',
            exercises: [
              { name: 'Жим штанги лёжа', targetSets: 4 },
              { name: 'Приседания со штангой', targetSets: 2 },
            ],
          },
        ]}
      />,
    );
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    expect(text).toContain('План недели → факт');
    expect(text).toContain('1 дн. плана');
    // Видно, за какую неделю и что именно сравнивается.
    expect(text).toContain('03.11–09.11');
    expect(text).toContain('План — targetSets всех дней микроцикла');
    expect(text).toContain('План: 6 подх');
    expect(text).toContain('Факт: 3 подх');
    expect(text).toContain('50% · осталось 3 подх');
    // По мышцам: грудь 4 → 2, квадрицепс 2 → 1.
    expect(text).toContain('4 → 2');
    expect(text).toContain('2 → 1');
    // Без плана микроцикла карточки нет — «план недели» не выдумывается.
    const noPlan = renderToStaticMarkup(
      <WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} blocks={['weekplan']} showSelector={false} />,
    );
    expect(noPlan).not.toContain('План недели → факт');
  });

  it('в выборе блоков видно, для какого блока нет данных', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} storageKey="test_blocks_hints" />,
    );
    // Дневник не знает targetSets сессии — это блок плеера.
    expect(html).toContain('только из плеера');
    expect(html).toContain('нет плана недели');
    expect(html).toContain('нет прошлого периода');
    // Когда план недели передан, пометка снимается.
    const withPlan = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        storageKey="test_blocks_hints2"
        weekPlan={[{ label: 'Верх', exercises: [{ name: 'Жим штанги лёжа', targetSets: 4 }] }]}
      />,
    );
    expect(withPlan).not.toContain('нет плана недели');
  });

  it('без блока «План → факт» строки остаются под упражнениями', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        blocks={['exercises']}
        plan={[
          { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
        ]}
      />,
    );
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    expect(text).not.toContain('План: 3 подх');
    expect(text).toContain('план 3 → факт 2 (-1)');
  });

  it('недобор плана виден в выводах', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        blocks={['insights']}
        plan={[
          { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
          { name: 'Тяга штанги в наклоне', sets: [{ weight: 60, reps: 10 }] },
        ]}
      />,
    );
    expect(html).toContain('План по подходам выполнен на 75%');
    expect(html).toContain('пропущено: Тяга штанги в наклоне');
  });

  it('без плана строк «план → факт» нет', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} blocks={['exercises']} />);
    expect(html).not.toContain('пропущено:');
    expect(html).not.toContain('План: ');
  });

  it('уважает выбор блоков (только «Общее»)', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['totals']} />);
    expect(html).toContain('Общие показатели');
    expect(html).not.toContain('По упражнениям');
    expect(html).not.toContain('По мышцам');
  });

  it('с историей до периода показывает рекорды даже за одну тренировку', () => {
    const stronger: WorkoutLog = {
      ...mkWorkout('2026-11-10'),
      exercises: [{
        id: '2026-11-10_bench', date: '2026-11-10', exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
        isCompound: true, weekNumber: 1,
        sets: [{ weight: 85, reps: 8, rir: 2, rpe: 8 }],
        totalVolume: 680, estimated1RM: 108,
      }] as StrengthLogEntry[],
    };
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[stronger]} blocks={['prs']} baselineWorkouts={[mkWorkout('2026-11-01')]} />);
    expect(html).toContain('Рекорды периода');

    const noBase = renderToStaticMarkup(<WorkoutSummaryReport workouts={[stronger]} blocks={['prs']} />);
    expect(noBase).not.toContain('Рекорды периода');
  });

  it('подходы без веса не попадают в тоннаж, но видны в отчёте', () => {
    const pullupWorkout: WorkoutLog = {
      ...mkWorkout('2026-11-12'),
      exercises: [{
        id: '2026-11-12_pullup', date: '2026-11-12', exerciseId: 'pullup', exerciseName: 'Подтягивания',
        isCompound: true, weekNumber: 1,
        sets: [{ weight: 0, reps: 10, rir: 2, rpe: 7 }, { weight: 0, reps: 8, rir: 1, rpe: 8 }],
        totalVolume: 0, estimated1RM: 0,
      }] as StrengthLogEntry[],
    };
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[pullupWorkout]} blocks={['totals']} />);
    expect(html).toContain('2 подх. без веса');
  });

  it('фильтр «только проблемные» оставляет мышцы вне коридора', () => {
    const mixed: WorkoutLog = {
      ...mkWorkout('2026-11-03'),
      exercises: [
        {
          id: '2026-11-03_bench', date: '2026-11-03', exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
          isCompound: true, weekNumber: 1,
          sets: Array.from({ length: 10 }, () => ({ weight: 80, reps: 8, rir: 2, rpe: 7 })),
          totalVolume: 6400, estimated1RM: 101,
        },
        {
          id: '2026-11-03_squat', date: '2026-11-03', exerciseId: 'squat', exerciseName: 'Приседания со штангой',
          isCompound: true, weekNumber: 1,
          sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }],
          totalVolume: 500, estimated1RM: 117,
        },
      ] as StrengthLogEntry[],
    };
    render(<WorkoutSummaryReport workouts={[mixed]} blocks={['muscles']} />);
    expect(screen.getByText('Грудь')).toBeTruthy();
    fireEvent.click(screen.getByText(/Только проблемные/));
    expect(screen.queryByText('Грудь')).toBeNull();
    expect(screen.getByText('Квадрицепсы')).toBeTruthy();
  });

  it('пустая история даёт честное пустое состояние', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[]} />);
    expect(html).toContain('Нет данных для отчёта');
  });

  it('ReportBlockPicker рендерит чекбоксы всех блоков', () => {
    const html = renderToStaticMarkup(<ReportBlockPicker value={['totals']} onChange={() => {}} />);
    ['Общее', 'Выводы', 'Сравнение', 'Объём', 'Мышцы', 'Упражнения', 'План → факт', 'Подходы', 'Движения', 'Тренировки', 'Рекорды'].forEach(label => {
      expect(html).toContain(label);
    });
  });

  it('«Итог» плеера держит выбор блоков и не оставляет неизвестных', () => {
    expect(PLAYER_REPORT_BLOCKS).toContain('plan');
    expect(PLAYER_REPORT_BLOCKS).toContain('prs');
    expect(new Set(PLAYER_REPORT_BLOCKS).size).toBe(PLAYER_REPORT_BLOCKS.length);
    localStorage.setItem('he_workout_done_blocks', JSON.stringify(['totals', 'plan', 'bogus']));
    expect(readReportBlocks('he_workout_done_blocks', PLAYER_REPORT_BLOCKS)).toEqual(['totals', 'plan']);
    localStorage.setItem('he_workout_done_blocks', JSON.stringify(['bogus']));
    expect(readReportBlocks('he_workout_done_blocks', PLAYER_REPORT_BLOCKS)).toEqual(PLAYER_REPORT_BLOCKS);
    localStorage.removeItem('he_workout_done_blocks');
    expect(readReportBlocks('he_workout_done_blocks', PLAYER_REPORT_BLOCKS)).toEqual(PLAYER_REPORT_BLOCKS);
  });

  it('блок сравнения показывает дельты к прошлому периоду', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-10', 'FullBody')]}
        blocks={['compare']}
        previousWorkouts={[mkWorkout('2026-11-03', 'FullBody')]}
        previousLabel="прошлой неделей"
      />,
    );
    expect(html).toContain('Сравнение периодов');
    expect(html).toContain('прошлой неделей');
    expect(html).toContain('без изменений');
    expect(html).toContain('Средний RIR');
    // Интенсивность сравнивается отдельной строкой, а не через % от %.
    expect(html).toContain('Интенсивность, %');
    expect(html).toContain('Время, мин');
  });

  it('сравнение интенсивности говорит про процентные пункты', () => {
    const heavier = mkWorkout('2026-11-10');
    heavier.exercises = [{
      ...heavier.exercises[0],
      sets: [{ weight: 90, reps: 5, rir: 2, rpe: 8 }],
    }] as StrengthLogEntry[];
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[heavier]}
        blocks={['compare']}
        previousWorkouts={[mkWorkout('2026-11-03')]}
        showSelector={false}
      />,
    );
    expect(html).toContain('Интенсивность, %');
    expect(html).toContain('п.п.');
  });

  it('показывает распределение подходов по зонам повторений', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport workouts={[mkWorkout('2026-11-17')]} blocks={['totals']} showSelector={false} />,
    );
    // Присед 100×5 и два подхода жима 80×8: 1 подход в силовой зоне, 2 — в гипертрофии.
    expect(html).toContain('Зоны повторений');
    expect(html).toContain('1–5');
    expect(html).toContain('6–12');
    expect(html).toContain('<b>1</b> подх.');
    expect(html).toContain('<b>2</b> подх.');
  });

  it('в сравнении видны и движения, а не только мышцы', () => {
    const base = mkWorkout('2026-11-03');
    const prevOnlyBench = { ...base, exercises: base.exercises.slice(0, 1) };
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-10')]}
        blocks={['compare']}
        previousWorkouts={[prevOnlyBench]}
        previousLabel="прошлой тренировкой"
      />,
    );
    expect(html).toContain('Подходы по движениям');
    expect(html).toContain('+1 подх.');
    // Сводка по движениям: видно, изменилось одно из двух, а не «пропало всё».
    expect(html).toContain('▲ 1');
    expect(html).toContain('▼ 0');
  });

  it('в сравнении по упражнениям видно и подходы, а не только e1RM', () => {
    const base = mkWorkout('2026-11-03');
    const prev = {
      ...base,
      exercises: base.exercises.map(e => ({ ...e, sets: [...e.sets!, ...e.sets!] })),
    };
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-10')]}
        blocks={['compare']}
        previousWorkouts={[prev]}
        previousLabel="прошлой тренировкой"
        showSelector={false}
      />,
    );
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    expect(text).toContain('Упражнения: подходы и e1RM');
    // Подходы упали вдвое, хотя e1RM тот же — именно это и объясняет тоннаж.
    expect(text).toContain('подх 4 → 2');
    expect(text).toContain('подх 2 → 1');
  });

  it('сравнение сводит мышцы в «выросло / просело / без изменений» и раскрывает все', () => {
    const base = mkWorkout('2026-11-03');
    const prevOnlyBench = { ...base, exercises: base.exercises.slice(0, 1) };
    const { container } = render(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-10')]}
        blocks={['compare']}
        previousWorkouts={[prevOnlyBench]}
        previousLabel="прошлой тренировкой"
        showSelector={false}
      />,
    );
    const txt = () => container.textContent || '';
    // Жим 2 → 2 (на месте), присед 0 → 1 (рост): по умолчанию виден только рост.
    expect(txt()).toContain('▲ 1');
    expect(txt()).toContain('▼ 0');
    expect(txt()).toContain('= 1');
    expect(txt()).not.toContain('2 → 2');
    fireEvent.click(screen.getByText('Все мышцы (2)'));
    expect(txt()).toContain('2 → 2');
    expect(txt()).toContain('без изменений');
    fireEvent.click(screen.getByText('Только изменения'));
    expect(txt()).not.toContain('2 → 2');
  });

  it('без предыдущего периода блок сравнения молчит', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['compare']} />);
    expect(html).not.toContain('Сравнение периодов');
  });

  it('в строке движения есть сила, а не только объём', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['movement']} showSelector={false} />);
    const text = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
    // Лучший e1RM движения и упражнение, которым он сделан.
    expect(text).toContain('сила e1RM 101 кг');
    expect(text).toContain('Жим штанги лёжа');
  });

  it('блок «Подходы» показывает каждый подход с весом, повторами и RIR', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['sets']} />);
    expect(html).toContain('Все подходы');
    expect(html).toContain('80×8');
    expect(html).toContain('100×5');
    expect(html).toContain('@2');
    // Интенсивность подхода — не только вес, но и % от лучшего e1RM.
    expect(html).toContain('·79%');
    expect(html).toContain('·85%');
    expect(html).not.toContain('По мышцам');
  });

  it('блок выводов показывает наблюдения по периоду', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['insights']} />);
    expect(html).toContain('Выводы');
    expect(html).toContain('Тоннаж недели');
  });

  it('в упражнениях видна прогрессия e1RM (спарклайн и проценты)', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['exercises']} />);
    expect(html).toContain('<polyline');
    expect(html).toContain('→ 0%');
  });

  it('вывод о разгрузке виден, когда объём упал к прошлому периоду', () => {
    const withSets = (date: string, bench: number, squat: number): WorkoutLog => {
      const w = mkWorkout(date);
      const [b, s] = w.exercises as StrengthLogEntry[];
      return {
        ...w,
        exercises: [
          { ...b, sets: Array.from({ length: bench }, () => ({ weight: 80, reps: 8, rir: 2, rpe: 7 })) },
          { ...s, sets: Array.from({ length: squat }, () => ({ weight: 100, reps: 5, rir: 2, rpe: 7 })) },
        ] as StrengthLogEntry[],
      };
    };
    const previous = [withSets('2026-11-02', 6, 6), withSets('2026-11-04', 6, 6)];
    const current = [withSets('2026-11-09', 3, 3), withSets('2026-11-11', 3, 3)];
    render(
      <WorkoutSummaryReport
        workouts={current}
        blocks={['insights']}
        previousWorkouts={previous}
        previousLabel="прошлой неделей"
      />,
    );
    expect(screen.getByText(/Похоже на разгрузку/)).toBeTruthy();
    expect(screen.getByText(/просели 2 мышц/)).toBeTruthy();
  });

  it('длинный список подходов раскрывается целиком', () => {
    const many: WorkoutLog[] = Array.from({ length: 45 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 1 + i));
      return mkWorkout(d.toISOString().slice(0, 10));
    });
    render(<WorkoutSummaryReport workouts={many} blocks={['sets']} />);
    expect(screen.getByText(/Показаны 40 из 45 тренировок/)).toBeTruthy();
    fireEvent.click(screen.getByText('Показать все (45)'));
    expect(screen.getByText(/Показаны 45 из 45 тренировок/)).toBeTruthy();
    expect(screen.getByText('Свернуть')).toBeTruthy();
  });
});

describe('Дневник → Отчёт', () => {
  const baseProps = {
    diary: {} as any as StrengthDiary,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: workouts,
    macrocycle: null,
    selectedWeek: 1,
    level: 'intermediate',
    onRefresh: () => {},
    trainingOutput: null,
    goal: 'bulk',
    daysPerWeek: 4,
    splitType: 'auto',
    periodizationType: 'auto',
    mesoLength: 12,
    tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
    linked: { profile: { settings: { personal: { height: 175 } } } },
  };

  it('режим отчёта даёт выбор охвата: тренировка / несколько / неделя / месяц / всё', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="summary" />);
    expect(html).toContain('Охват отчёта');
    expect(html).toContain('Несколько');
    expect(html).toContain('Неделя');
    expect(html).toContain('Месяц');
    expect(html).toContain('Всё время');
    expect(html).toContain('Сводный отчёт');
    expect(html).toContain('Сравнение периодов');
  });

  it('legacy-режим «reports» открывает новый отчёт, а не инструменты', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="reports" />);
    expect(html).toContain('Охват отчёта');
    expect(html).toContain('Неделя');
  });

  it('копируемый отчёт честен: одна сессия без «/нед», весь период с «/нед»', async () => {
    const writes: string[] = [];
    const orig = (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => { writes.push(s); return Promise.resolve(); } },
      configurable: true,
    });
    // Живой маунт тянет эффекты хаба: заглушка отвечает на любой вызов дневника.
    const stubDiary = new Proxy({}, {
      get: () => () => Promise.resolve([]),
    }) as unknown as StrengthDiary;
    const copyBtn = () => screen.getByRole('button', { name: /Скопировано|Копировать отчёт/ });
    try {
      render(<TrainingDiaryHub {...baseProps} diary={stubDiary} initialMode="summary" />);

      fireEvent.click(copyBtn());
      await Promise.resolve();
      const one = writes.join('\n');
      expect(one).toContain('По мышцам:');
      expect(one).toContain('подх за сессию');
      expect(one).toContain('до MEV');
      expect(one).not.toContain('/нед до MEV');
      expect(one).toContain('Грудь');

      fireEvent.click(screen.getByText(/Всё время/));
      fireEvent.click(copyBtn());
      await Promise.resolve();
      const all = writes.slice(1).join('\n');
      expect(all).toContain('подх/нед');
      expect(all).toMatch(/\+[1-9]\d*\/нед до MEV/);
      expect(all).toContain('Грудь');
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true });
    }
  });

  it('копируемый отчёт сравнивает движения с прошлой тренировкой', async () => {
    const writes: string[] = [];
    const orig = (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => { writes.push(s); return Promise.resolve(); } },
      configurable: true,
    });
    const stubDiary = new Proxy({}, {
      get: () => () => Promise.resolve([]),
    }) as unknown as StrengthDiary;
    const base = mkWorkout('2026-11-03');
    // Последняя тренировка — только жим, но тяжелее: в прошлой был ещё и присед.
    const benchOnly: WorkoutLog = {
      ...base, id: 'w_bench', date: '2026-11-10',
      exercises: [{
        ...base.exercises[0],
        id: '2026-11-10_bench',
        date: '2026-11-10',
        sets: [{ weight: 90, reps: 8, rir: 2, rpe: 7 }, { weight: 90, reps: 8, rir: 1, rpe: 8 }],
        totalVolume: 1440,
        estimated1RM: 114,
      }] as StrengthLogEntry[],
    };
    try {
      render(
        <TrainingDiaryHub
          {...baseProps}
          diary={stubDiary}
          historyWorkouts={[benchOnly, base]}
          initialMode="summary"
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Скопировано|Копировать отчёт/ }));
      await Promise.resolve();
      const txt = writes.join('\n');
      expect(txt).toContain('Мышцы:');
      expect(txt).toContain('Движения:');
      expect(txt).toMatch(/→ 0 подх\. \(-1\)/);
      expect(txt).toContain('e1RM по упражнениям:');
      expect(txt).toContain('Жим штанги лёжа: 101 → 114 кг (+13)');
      expect(txt).toContain('Время: 60 мин');
      expect(txt).toContain('Средний RIR:');
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true });
    }
  });
});
