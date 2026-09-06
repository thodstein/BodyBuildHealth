/**
 * NativeIcons.tsx — единый штриховой набор APK (как нижний навбар:
 * 24×24, stroke currentColor, round). ТОЛЬКО native-поверхности и PRO-блоки.
 * Telegram/web классика эмодзи не трогает — замена идёт точечно в своих файлах.
 */

import React from 'react';

export type NativeIconName =
  | 'user' | 'notebook' | 'chart' | 'sliders' | 'heart' | 'target'
  | 'award' | 'trendingDown' | 'alertTriangle' | 'zap' | 'activity'
  | 'shield' | 'bookOpen' | 'bag' | 'cart' | 'grid' | 'droplet'
  | 'flask' | 'bowl' | 'leaf' | 'wind' | 'message' | 'move'
  | 'smile' | 'pill' | 'dumbbell' | 'gem' | 'file' | 'bookmark'
  | 'star' | 'search' | 'chevronDown' | 'chevronRight' | 'check'
  | 'x' | 'plus'   | 'clock' | 'trash' | 'share' | 'moon'
  | 'layers' | 'inbox' | 'kettlebell' | 'syringe' | 'cross'
  | 'ruler' | 'eye' | 'cpu' | 'dot' | 'pin' | 'phone' | 'sun' | 'send'
  | 'lungs' | 'kidney' | 'butterfly' | 'arrowUp' | 'arrowDown' | 'play' | 'pause' | 'scan'
  | 'bell' | 'camera';

const PATHS: Record<NativeIconName, React.ReactNode> = {
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  notebook: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  chart: (<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  sliders: (<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>),
  heart: (<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />),
  target: (<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>),
  award: (<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>),
  trendingDown: (<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>),
  alertTriangle: (<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  zap: (<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  activity: (<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  bookOpen: (<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  bag: (<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>),
  cart: (<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>),
  grid: (<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  droplet: (<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />),
  flask: (<><path d="M9 3h6" /><path d="M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" /><line x1="7" y1="15" x2="17" y2="15" /></>),
  bowl: (<><path d="M3 12h18" /><path d="M5 12a7 7 0 0 0 14 0" /><path d="M12 12V6" /></>),
  leaf: (<><path d="M5 19C5 9 13 5 20 4c-1 7-5 15-15 15z" /><path d="M5 19c3-5 7-9 11-11" /></>),
  wind: (<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />),
  message: (<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />),
  move: (<><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></>),
  smile: (<><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></>),
  pill: (<><rect x="2.5" y="9" width="19" height="6" rx="3" transform="rotate(-45 12 12)" /><line x1="9.6" y1="9.6" x2="14.4" y2="14.4" /></>),
  dumbbell: (<><path d="M7 8v8M17 8v8M4 10v4M20 10v4M7 12h10" /></>),
  gem: (<><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /><path d="M9 3l3 6 3-6" /><path d="M12 9v12" /></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>),
  bookmark: (<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />),
  star: (<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  search: (<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  chevronDown: (<polyline points="6 9 12 15 18 9" />),
  chevronRight: (<polyline points="9 18 15 12 9 6" />),
  check: (<polyline points="20 6 9 17 4 12" />),
  x: (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  trash: (<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  share: (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>),
  moon: (<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />),
  layers: (<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  inbox: (<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  kettlebell: (<><circle cx="12" cy="14" r="6" /><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" /></>),
  syringe: (<><rect x="8" y="8" width="9" height="6" rx="2" transform="rotate(-45 12 11)" /><path d="M15.5 8.5L21 3" /><path d="M9 15l-5 5" /><path d="M4 20l1.5 1.5" /></>),
  cross: (<><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>),
  ruler: (<><path d="M3 17L17 3l4 4L7 21z" /><path d="M8 12l1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5" /></>),
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  cpu: (<><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></>),
  dot: (<circle cx="12" cy="12" r="6" />),
  pin: (<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  phone: (<><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>),
  sun: (<><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>),
  send: (<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  lungs: (<><path d="M12 4v5" /><path d="M11 9C9 6.5 7 5.5 5 5.5c-2 0-3 2-3 5v5a2 2 0 0 0 2 2h4V9z" /><path d="M13 9c2-2.5 4-3.5 6-3.5 2 0 3 2 3 5v5a2 2 0 0 1-2 2h-4V9z" /></>),
  kidney: (<path d="M12 3c-4 0-6 3.5-6 8s2 9 6 9c1.5 0 2-.5 2-2v-3a3 3 0 0 1 3-3h1c1.5 0 2-1.5 2-3.5S16.5 3 12 3z" />),
  butterfly: (<><ellipse cx="8" cy="12" rx="4" ry="6" /><ellipse cx="16" cy="12" rx="4" ry="6" /><line x1="12" y1="8" x2="12" y2="16" /></>),
  arrowUp: (<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>),
  arrowDown: (<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>),
  play: (<polygon points="6 3 20 12 6 21 6 3" />),
  pause: (<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>),
  scan: (<><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  camera: (<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>),
};

export interface NativeIconProps {
  name: NativeIconName | string;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
}

/** Все имена набора (для тестов полноты и переиспользования). */
export const NATIVE_ICON_NAMES = Object.keys(PATHS) as NativeIconName[];

/** Штриховая SVG-иконка. Неизвестное имя — нейтральная точка (не эмодзи, не пустота). */
export const NativeIcon: React.FC<NativeIconProps> = ({ name, size = 20, strokeWidth = 1.8, filled = false, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {(PATHS as Record<string, React.ReactNode>)[name] ?? <circle cx="12" cy="12" r="5" />}
  </svg>
);
