/** Inline line icons in the current text color. Status is always icon plus words, never color alone. */
const svg = (paths, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = Object.freeze({
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  document: svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 18),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 14),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>', 14),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 12),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M19 14v5H5V5h5"/>', 14),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
});
