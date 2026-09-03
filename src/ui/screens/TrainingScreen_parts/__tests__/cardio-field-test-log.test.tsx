/**
 * cardio-field-test-log.test.tsx — журнал контрольных замеров (раунд 4)
 * + замыкание «замеры → параметры» (раунд 5).
 */
import React, { useState } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioFieldTestLog } from '../CardioFieldTestLog';
import { CardioParamsStep } from '../CardioParamsStep';
import { loadFieldTestLog, FIELD_TEST_LOG_KEY, latestFieldTestMetrics } from '../../../../engines/lms/cardio.engine';

beforeEach(() => {
  try { localStorage.removeItem(FIELD_TEST_LOG_KEY); } catch { /* ignore */ }
});

function setDate(v: string) {
  fireEvent.change(screen.getByLabelText('Дата замера'), { target: { value: v } });
}
function setNum(label: string, v: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
}
function save() {
  fireEvent.click(screen.getByRole('button', { name: /Сохранить замер/ }));
}

describe('CardioFieldTestLog', () => {
  it('пустое состояние + добавление AeT-замера', () => {
    render(<CardioFieldTestLog />);
    expect(screen.getByText(/Замеров нет/)).toBeTruthy();
    setDate('2026-01-01');
    setNum('Drift', '8');
    setNum('Decoupling', '9');
    save();
    expect(screen.getByText(/drift 8% · decoupling 9%/)).toBeTruthy();
    expect(loadFieldTestLog().length).toBe(1);
  });

  it('два улучшающихся AeT-замера → бейдж Responder', () => {
    render(<CardioFieldTestLog />);
    setDate('2026-01-01');
    setNum('Drift', '9');
    setNum('Decoupling', '10');
    save();
    setDate('2026-02-01');
    setNum('Drift', '4');
    setNum('Decoupling', '3');
    save();
    expect(screen.getByText('Responder')).toBeTruthy();
    expect(screen.getByText(/drift и decoupling улучшились/)).toBeTruthy();
  });

  it('валидация: пустые метрики AeT → alert, запись не добавляется', () => {
    render(<CardioFieldTestLog />);
    setDate('2026-01-01');
    save();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(loadFieldTestLog().length).toBe(0);
  });

  it('LTHR-замер: переключение вида и сохранение', () => {
    render(<CardioFieldTestLog />);
    fireEvent.click(screen.getByRole('button', { name: /Замер: LTHR 30'/ }));
    setDate('2026-03-01');
    setNum('LTHR', '172');
    save();
    expect(screen.getByText(/LTHR 172 уд\/мин/)).toBeTruthy();
  });

  it('FTP-замер хранит FTP (P20 ×0.95)', () => {
    render(<CardioFieldTestLog />);
    fireEvent.click(screen.getByRole('button', { name: /Замер: FTP 20'/ }));
    setDate('2026-03-01');
    setNum('Мощность 20 минут', '200');
    save();
    expect(screen.getByText(/FTP 190 Вт/)).toBeTruthy();
    expect(loadFieldTestLog()[0].ftpWatts).toBe(190);
  });

  it('удаление замера', () => {
    render(<CardioFieldTestLog />);
    setDate('2026-01-01');
    setNum('Drift', '5');
    setNum('Decoupling', '4');
    save();
    expect(loadFieldTestLog().length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Удалить замер 2026-01-01/ }));
    expect(loadFieldTestLog().length).toBe(0);
    expect(screen.getByText(/Замеров нет/)).toBeTruthy();
  });

  it('перемонтирование читает персистентность', () => {
    const { unmount } = render(<CardioFieldTestLog />);
    setDate('2026-01-01');
    setNum('Drift', '5');
    setNum('Decoupling', '4');
    save();
    unmount();
    render(<CardioFieldTestLog />);
    expect(screen.getByText(/drift 5% · decoupling 4%/)).toBeTruthy();
  });
});

describe('Замеры → параметры (раунд 5)', () => {
  function ParamsHarness() {
    const [lthr, setLthr] = useState('');
    const [ftpWatts, setFtpWatts] = useState('');
    const [talkHr, setTalkHr] = useState('');
    const noop = () => {};
    return (
      <CardioParamsStep
        goal="cut" setGoal={noop}
        totalWeeks={12} setTotalWeeks={noop}
        daysAvailable={5} setDaysAvailable={noop}
        recoveryLow={false} setRecoveryLow={noop}
        phaseSplit={{ auto: true, base: 0, build: 0, maintenance: 0 }} setPhaseSplit={noop}
        comps={[]}
        bodyWeight={80} setBodyWeight={noop}
        taperWeeks={2} setTaperWeeks={noop} taperEnabled={true} setTaperEnabled={noop} peakWeek={true} setPeakWeek={noop}
        level="intermediate" setLevel={noop}
        equipment={[]} setEquipment={noop}
        lowImpact={false} setLowImpact={noop}
        age="30" setAge={noop}
        sex="male" setSex={noop}
        restingHr="" setRestingHr={noop}
        legDays={[]} setLegDays={noop}
        factorsOn={{ sleep: false, stress: false, hrv: false, ped: false, joints: false }} onToggleFactor={noop}
        factorsSummary={[]}
        onFromProfile={noop} onSaveProfile={noop} onFromDiaryHr={noop}
        onFromLog={() => {
          const m = latestFieldTestMetrics();
          if (m.lthr != null) setLthr(String(m.lthr));
          if (m.ftpWatts != null) setFtpWatts(String(m.ftpWatts));
          if (m.talkHr != null) setTalkHr(String(m.talkHr));
        }}
        onReset={noop}
        lthr={lthr} setLthr={setLthr}
        ftpWatts={ftpWatts} setFtpWatts={setFtpWatts}
        talkHr={talkHr} setTalkHr={setTalkHr}
      />
    );
  }

  it('кнопка «Из журнала замеров» подтягивает LTHR/FTP/talk', () => {
    localStorage.setItem(FIELD_TEST_LOG_KEY, JSON.stringify([
      { date: '2026-01-01', kind: 'lthr30', lthr: 172 },
      { date: '2026-02-01', kind: 'ftp20', ftpWatts: 250 },
      { date: '2026-03-01', kind: 'talk', talkHr: 144 },
    ]));
    render(<ParamsHarness />);
    fireEvent.click(screen.getByRole('button', { name: /полевые тесты/ }));
    fireEvent.click(screen.getByRole('button', { name: /Из журнала замеров/ }));
    expect((screen.getByLabelText('LTHR') as HTMLInputElement).value).toBe('172');
    expect((screen.getByLabelText('FTP') as HTMLInputElement).value).toBe('250');
    expect((screen.getByLabelText('Talk-test') as HTMLInputElement).value).toBe('144');
  });
});
