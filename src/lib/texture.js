/**
 * Placeholder textile images. The sample lots have no photographs, so each card shows a
 * woven texture drawn in the lot's tone. Real lots carry the workroom's photographs.
 */
import { escapeHtml } from './html.js';

const SIZE = 240;

/** Used when a lot has no color family recorded. */
const NEUTRAL_TONE = Object.freeze({ hex: '#D8D2C8', name: 'Unrecorded color' });

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel) => {
    const c = (n >> channel) & 255;
    const target = amount < 0 ? 0 : 255;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  return `#${[16, 8, 0].map((ch) => mix(ch).toString(16).padStart(2, '0')).join('')}`;
}

const WEAVES = {
  h: (c, dark, light) => `
    <pattern id="w" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="${c}"/>
      <path d="M0 0 L12 12 L0 24 Z" fill="${dark}" opacity=".45"/>
      <path d="M12 0 L24 12 L12 24 Z" fill="${light}" opacity=".35"/>
    </pattern>`,
  t: (c, dark, light) => `
    <pattern id="w" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="${c}"/>
      <rect y="0" width="8" height="2" fill="${dark}" opacity=".35"/>
      <rect y="4" width="8" height="1" fill="${light}" opacity=".3"/>
      <rect x="0" width="1" height="8" fill="${dark}" opacity=".2"/>
    </pattern>`,
  b: (c, dark, light) => `
    <pattern id="w" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="${c}"/>
      <circle cx="4" cy="4" r="3" fill="${light}" opacity=".5"/>
      <circle cx="11" cy="10" r="2.5" fill="${dark}" opacity=".35"/>
    </pattern>`,
  p: (c, dark, light) => `
    <pattern id="w" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="${c}"/>
      <rect x="0" width="12" height="40" fill="${dark}" opacity=".4"/>
      <rect y="0" width="40" height="12" fill="${dark}" opacity=".4"/>
      <rect x="26" width="3" height="40" fill="${light}" opacity=".5"/>
      <rect y="26" width="40" height="3" fill="${light}" opacity=".5"/>
    </pattern>`,
  f: (c, dark) => `
    <pattern id="w" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${c}"/>
      <circle cx="3" cy="3" r="1" fill="${dark}" opacity=".18"/>
    </pattern>`,
};

export function textureSvg(lot) {
  const base = (lot.tone || NEUTRAL_TONE).hex;
  const weave = (WEAVES[lot.tex] || WEAVES.t)(base, shade(base, -0.5), shade(base, 0.6));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <defs>${weave}
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${(lot.fam ?? 0) * 3 + (lot.shade ?? 0)}"/>
        <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer></filter>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="${base}"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#w)"/>
    <rect width="${SIZE}" height="${SIZE}" filter="url(#g)"/>
  </svg>`;
}

export function textureDataUri(lot) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(textureSvg(lot).replace(/\s+/g, ' '))}`;
}

/** Alt text names tone, pattern, and fiber, as the accessibility checklist asks. */
export function textureAlt(lot) {
  const words = [lot.tone?.name, lot.pattern?.toLowerCase(), lot.fiber?.toLowerCase()].filter(Boolean);
  return escapeHtml(`${words.length ? words.join(' ') : 'Textile'}, placeholder texture`);
}
