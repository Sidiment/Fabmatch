import { html, el } from '../lib/html.js';

const DURATION_MS = 5000;
/** Matches --fm-motion-fast in motion.css, so the node hides once the exit animation has run. */
export const TOAST_EXIT_MS = 150;
const LEAVING_CLASS = 'toast--leaving';

/** Bottom-left toast, five seconds, with an Undo action where the change is reversible. */
export function createToast(root = document.body) {
  const node = el(html`<div class="toast" role="status" aria-live="polite" hidden><span data-toast-text></span><button class="toast__undo" type="button" data-toast-undo hidden>Undo</button></div>`);
  root.appendChild(node);
  let timer = null;
  let exitTimer = null;
  let undoHandler = null;

  const clearTimers = () => { clearTimeout(timer); clearTimeout(exitTimer); };

  const hide = () => {
    clearTimers();
    undoHandler = null;
    if (node.hidden) return;
    node.classList.add(LEAVING_CLASS);
    exitTimer = setTimeout(() => { node.hidden = true; node.classList.remove(LEAVING_CLASS); }, TOAST_EXIT_MS);
  };

  node.querySelector('[data-toast-undo]').addEventListener('click', () => {
    if (undoHandler) undoHandler();
    hide();
  });

  return Object.freeze({
    show(message, { undo } = {}) {
      clearTimers();
      node.classList.remove(LEAVING_CLASS);
      node.querySelector('[data-toast-text]').textContent = message;
      const undoButton = node.querySelector('[data-toast-undo]');
      undoHandler = undo || null;
      undoButton.hidden = !undo;
      node.hidden = false;
      timer = setTimeout(hide, DURATION_MS);
    },
    hide,
    node,
  });
}
