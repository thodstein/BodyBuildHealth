/**
 * bb-pose-report.test.ts — BB-G-05: «показано = выгружено» для видео-разбора.
 *
 * Карточка хаба рисует строки `bbPoseLines`, отчёт печатает ровно их же (мета
 * `poseVideo.lines`). Тест держит паритет HTML/CSV и молчание при отсутствии разбора
 * (старые вызовы экспорта не меняют вывод байт-в-байт).
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

const poseVideo = {
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

describe('видео-разбор позы в отчёте', () => {
  it('HTML: секция с ракурсом, качеством, кадрами и применением', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04', poseVideo } as any);
    expect(html).toContain('Видео-разбор позы (сбоку)');
    expect(html).toContain('Качество: ок');
    expect(html).toContain('кадров с позой 18 из 24');
    expect(html).toContain('перенесено в скрининг');
    for (const l of poseVideo.lines) expect(html).toContain(l.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  });

  it('CSV: сводная строка + по строке на показатель', () => {
    const csv = buildBBDiagnosticsCsv(report, undefined, { date: '2026-11-04', poseVideo } as any);
    expect(csv).toContain('"pose_video","side","ok","18/24","applied"');
    expect(csv).toContain('"pose_video_line","Глубина: колено 96');
    expect(csv).toContain('"pose_video_line","Кадров с позой: 18 из 24');
  });

  it('без разбора секций нет (старые вызовы байт-в-байт)', () => {
    const html = buildBBDiagnosticsHtml(report, { date: '2026-11-04' } as any);
    const csv = buildBBDiagnosticsCsv(report, undefined, { date: '2026-11-04' } as any);
    expect(html).not.toContain('Видео-разбор позы');
    expect(csv).not.toContain('pose_video');
  });

  it('плановый немой результат (quality none) не выдаёт себя за замер', () => {
    const html = buildBBDiagnosticsHtml(report, {
      date: '2026-11-04',
      poseVideo: { ...poseVideo, quality: 'none', framesPosed: 0, applied: false, lines: ['x'] },
    } as any);
    expect(html).toContain('Качество: поза не найдена');
    expect(html).not.toContain('перенесено в скрининг');
  });
});
