import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

const goScreening = () => {
  render(<BBDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
};

describe('bb-hub D1 плечо у стены', () => {
  it('блок рендерится, провал даёт thoracic-маршрут', () => {
    goScreening();
    expect(document.querySelector('[data-bb="shoulder-screen"]')).not.toBeNull();
    expect(screen.getByText(/Плечо у стены: чисто/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /Рёбра вниз/ }));
    expect(screen.getByText(/Плечо у стены:/).textContent).toMatch(/грудного|ролле/);
  });
  it('ротация: разрыв виден', () => {
    goScreening();
    fireEvent.change(screen.getByTestId('bb-rot-l'), { target: { value: '38' } });
    fireEvent.change(screen.getByTestId('bb-rot-r'), { target: { value: '52' } });
    expect(screen.getByText(/Ротация грудного: 38/).textContent).toMatch(/левая/);
  });
});

describe('bb-hub D2 шарнир + нагрузка', () => {
  it('шарнир-селект и вердикт', () => {
    goScreening();
    expect(document.querySelector('[data-bb="hinge-screen"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('bb-hinge'));
    fireEvent.click(screen.getAllByText(/Поясница отрывается/)[0]);
    expect(screen.getByText(/Шарнир: поясница/).textContent).toMatch(/румынской|трап/);
  });
  it('деградация под весом', () => {
    goScreening();
    fireEvent.click(screen.getByTestId('bb-sq-body'));
    fireEvent.click(screen.getAllByText('Чисто')[0]);
    fireEvent.click(screen.getByTestId('bb-sq-work'));
    const fails = screen.getAllByText('Плывёт');
    fireEvent.click(fails[fails.length - 1]);
    expect(screen.getByText(/под весом плывёт/).textContent).toMatch(/снизь/);
  });
});

describe('bb-hub D3 YBT + D4/D5', () => {
  it('YBT warn + дисклеймер + приоритет', () => {
    goScreening();
    fireEvent.change(screen.getByTestId('bb-ybt-l'), { target: { value: '58' } });
    fireEvent.change(screen.getByTestId('bb-ybt-r'), { target: { value: '64' } });
    fireEvent.change(screen.getByTestId('bb-shin'), { target: { value: '48' } });
    expect(screen.getByText(/YBT-баланс: асимметрия/).textContent).toMatch(/левая/);
    expect(document.querySelector('[data-bb="ybt-disclaimer"]')?.textContent).toMatch(/не прогноз/);
    expect(document.querySelector('[data-bb="asym-priority"]')?.textContent).toMatch(/YBT-anterior/);
  });
  it('П1 legacy-снимок + провал плеча → «новый трекинг», не регресс', () => {
    localStorage.setItem('he_bb_screen_history', JSON.stringify([{ date: '2026-08-01', fails: ['heels'] }]));
    goScreening();
    fireEvent.click(screen.getByRole('switch', { name: /Рёбра вниз/ }));
    const delta = document.querySelector('[data-bb="screen-delta"]')?.textContent || '';
    expect(delta).toMatch(/новый трекинг/);
    expect(delta).toMatch(/sh-thoracic/);
  });
  it('П1 новый снимок пишется с v:2 и D1–D5 кодами', () => {
    localStorage.setItem('he_bb_screen_history', JSON.stringify([]));
    goScreening();
    fireEvent.click(screen.getByRole('switch', { name: /Рёбра вниз/ }));
    fireEvent.click(screen.getByText('Снимок сегодня'));
    const hist = JSON.parse(localStorage.getItem('he_bb_screen_history') || '[]');
    expect(hist.length).toBe(1);
    expect(hist[0].v).toBe(2);
    expect(hist[0].fails).toContain('sh-thoracic');
  });
  it('лопатка/видео/замены/дисклеймер', () => {
    goScreening();
    expect(document.querySelector('[data-bb="scap-video"]')).not.toBeNull();
    expect(document.querySelector('[data-bb="driver-subs"]')?.textContent).toMatch(/Замены под драйвер/);
    expect(document.querySelector('[data-bb="screening-disclaimer"]')?.textContent).toMatch(/не прогноз/);
    expect(document.querySelector('[data-bb="video-guide"]')?.textContent).toMatch(/штативе/);
  });
});
