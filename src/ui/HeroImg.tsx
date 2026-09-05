/**
 * HeroImg.tsx — hero-картинка с WebP-дериватом и PNG/JPG-фолбэком.
 *
 * Тот же файл, тот же вид везде (TG/APK/web): старые WebView видят исходник,
 * современные — WebP в ~7-15% веса. `picture` с display:contents не участвует
 * в раскладке — все селекторы (`… img`), классы и инлайн-стили img работают
 * как раньше, hero остаются на своих местах.
 *
 * PNG/JPG-исходники НЕ удаляются; WebP генерирует scripts/sync-hero-webp.mjs.
 */

import React from 'react';

interface HeroImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** WebP-дериват (например "/hero-main.webp?v=20250827k"). */
  webp: string;
}

export const HeroImg: React.FC<HeroImgProps> = ({ webp, ...img }) => (
  <picture style={{ display: 'contents' }}>
    <source srcSet={webp} type="image/webp" />
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    <img {...img} />
  </picture>
);
