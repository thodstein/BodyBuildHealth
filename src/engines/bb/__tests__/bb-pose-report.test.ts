/**
 * bb-pose-report.test.ts — BB-G-05: «показано = выгружено» для видео-разбора.
 *
 * Карточка хаба рисует строки `bbPoseLines`, отчёт печатает ровно их же (мета
 * `poseVideos[].lines`). Тест держит паритет HTML/CSV, независимость ракурсов
 * (второй разбор не затирает первый) и молчание при отсутствии разбора.
 */
import { describe, it, expect } from 'vitest';
import { buildBBDiagnosticsCsv, buildBBDiagnosticsHtml } from '../bb-diagnostics-export.engine';

const report = {
  weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
  symmetry: { ratios: {}, score: 0, issues: [] },
  stimulus: { issues: [], scorePenalty: 0, global: {} },
  score: { score: 72, level: 'warn', verification: 1, floors: [] },
  findings: [], priorities: [],
} as any;

const sideEntry = {
  view: 'side' as const,
  quality: 'ok' as const,
  framesPosed: 18,
  framesTotal: 24,
  depthKneeDeg: 96,
  trunkLeanDeg: 32,
  heelRisePct: 8,
  armsOverMidfootPct: 83,
  applied: true,
  lines: [
    'Глубина: колено 96° при 180°=прямая — глубоко (таз ниже параллели)',
    'Наклон корпуса: 32° — умеренный наклон (порог 25°/45°)',
    'Пятка: подъём 8% длины стопы — на полу',
    'Кадров с позой: 18 из 24 · качество: ок',
  ],
};

const frontEntry = {
  view: 'front' as const,
  quality: 'ok' as const,
  framesPosed: 20,
  framesTotal: 24,
  valgusDeg: 10.7,
  hipShiftPct: 4,
  pelvicDropPct: 2,
  armsOverMidfootPct: 100,
  applied: false,
  lines: [
    'Вальгус: 10.7° внутрь — заметный (порог 5°/10°)',
    'Сдвиг таза: 4% ширины стойки — в норме',
    'Кадров с позой: 20 из 24 · качество: ок',
  ],
};

describe('видео-разбор позы в отчёте', () => {
  it('HTML: секция на каждый ракурс с качеством, кадрами и применением', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04', poseVideos: [frontEntry, sideEntry] } as any);
    expect(html).toContain('Видео-разбор позы (фронтально)');
    expect(html).toContain('Видео-разбор позы (сбоку)');
    expect(html).toContain('кадров с позой 18 из 24');
    expect(html).toContain('кадров с позой 20 из 24');
    expect(html).toContain('перенесено в скрининг');
    for (const l of [...frontEntry.lines, ...sideEntry.lines]) {
      expect(html).toContain(l.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    }
  });

  it('CSV: сводная строка на ракурс + строки показателей с меткой ракурса', () => {
    const csv = buildBBDiagnosticsCsv(report, undefined, { date: '2026-11-04', poseVideos: [frontEntry, sideEntry] } as any);
    expect(csv).toContain('"pose_video","front","ok","20/24","not_applied"');
    expect(csv).toContain('"pose_video","side","ok","18/24","applied"');
    expect(csv).toContain('"pose_video_line","side","Глубина: колено 96');
    expect(csv).toContain('"pose_video_line","front","Вальгус: 10.7°');
  });

  it('одиночный legacy `poseVideo` по-прежнему печатается (старые данные)', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04', poseVideo: sideEntry } as any);
    const csv = buildBBDiagnosticsCsv(report, undefined, { date: '2026-11-04', poseVideo: sideEntry } as any);
    expect(html).toContain('Видео-разбор позы (сбоку)');
    expect(csv).toContain('"pose_video","side","ok","18/24","applied"');
  });

  it('без разбора секций нет (старые вызовы байт-в-байт)', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04' } as any);
    const csv = buildBBDiagnosticsCsv(report, undefined, { date: '2026-11-04' } as any);
    expect(html).not.toContain('Видео-разбор позы');
    expect(csv).not.toContain('pose_video');
  });

  it('пустые записи (нет строк / пустой массив) не создают пустую секцию', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04', poseVideos: [], poseVideo: null } as any);
    const html2 = buildBBDiagnosticsHtml(report, { date: '2026-11-04', poseVideos: [{ ...sideEntry, lines: [] }] } as any);
    expect(html).not.toContain('Видео-разбор позы');
    expect(html2).not.toContain('Видео-разбор позы');
  });

  it('немой результат (quality none) не выдаёт себя за замер', () => {
    const html = buildBBDiagnosticsHtml(report, {
      date: '2026-11-04',
      poseVideos: [{ ...sideEntry, quality: 'none', framesPosed: 0, applied: false, lines: ['x'] }],
    } as any);
    expect(html).toContain('Качество: поза не найдена');
    expect(html).not.toContain('перенесено в скрининг');
  });
});
