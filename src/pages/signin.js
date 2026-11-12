/** Sign in and create account (guide section 8.2, "Sign in and onboarding"). */
import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { routes, navigate, parseHash } from '../lib/router.js';
import { validateSignIn, validateRegistration, hasErrors, LIMITS } from '../../shared/validators.js';
import { ROLES, DEFAULT_ROLE } from '../../shared/roles.js';

export const MODES = Object.freeze({ signIn: 'signin', register: 'register' });

const COPY = Object.freeze({
  signin: {
    title: 'Sign in',
    lede: 'An account keeps projects and workroom messages across devices. Browsing needs no account.',
    submit: 'Sign in',
    switchText: 'New to Fabmatch?',
    switchLink: 'Create an account',
  },
  register: {
    title: 'Create an account',
    lede: 'Lots saved on this device move into the new account.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
  },
});

/** The page to open after signing in. Only routes inside the site; anything else opens Projects. */
export function nextHash(next) {
  const fallback = routes.projects();
  if (!next) return fallback;
  const hash = `#/${String(next).replace(/^[#/]+/, '')}`;
  const { name } = parseHash(hash);
  return name === 'notFound' || name === 'signin' ? fallback : hash;
}

function field({ id, name, label, type = 'text', autocomplete, help = '', value = '', error = '', maxlength }) {
  const describedBy = [error ? `${id}-error` : '', help ? `${id}-help` : ''].filter(Boolean).join(' ');
  return html`
    <div class="field ${error ? 'field--error' : ''}">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" value="${value}"
        ${raw(maxlength ? `maxlength="${maxlength}"` : '')} ${raw(error ? 'aria-invalid="true"' : '')} ${raw(describedBy ? `aria-describedby="${describedBy}"` : '')}>
      ${help ? html`<p class="field__help" id="${id}-help">${help}</p>` : ''}
      ${error ? html`<p class="field__error" id="${id}-error">${raw(ICONS.alert)}${error}</p>` : ''}
    </div>`;
}

function roleField(value, error) {
  return html`
    <div class="field ${error ? 'field--error' : ''}">
      <label for="auth-role">Role</label>
      <select id="auth-role" name="role" ${raw(error ? 'aria-invalid="true" aria-describedby="auth-role-error"' : '')}>
        ${ROLES.map((r) => html`<option value="${r.id}" ${raw(r.id === value ? 'selected' : '')}>${r.label}</option>`)}
      </select>
      ${error ? html`<p class="field__error" id="auth-role-error">${raw(ICONS.alert)}${error}</p>` : ''}
    </div>`;
}

export function signInMarkup({ mode, next = '', values = {}, errors = {}, status = '' }) {
  const copy = COPY[mode];
  const isRegister = mode === MODES.register;
  const otherMode = isRegister ? MODES.signIn : MODES.register;
  return html`
    <div class="wrap auth">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${routes.home()}">Home</a><span aria-hidden="true">/</span><span>${copy.title}</span></nav>
        <h1>${copy.title}</h1>
        <p class="section__lede">${copy.lede}</p>
      </div>
      <form class="auth-form" data-auth-form novalidate>
        ${isRegister ? raw(field({ id: 'auth-name', name: 'name', label: 'Name', autocomplete: 'name', value: values.name, error: errors.name, maxlength: LIMITS.name })) : ''}
        ${raw(field({ id: 'auth-email', name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', value: values.email, error: errors.email, maxlength: LIMITS.email }))}
        ${raw(field({
          id: 'auth-password', name: 'password', label: 'Password', type: 'password',
          autocomplete: isRegister ? 'new-password' : 'current-password',
          help: isRegister ? `At least ${LIMITS.passwordMin} characters.` : '',
          error: errors.password, maxlength: LIMITS.passwordMax,
        }))}
        ${isRegister ? raw(roleField(values.role || DEFAULT_ROLE, errors.role)) : ''}
        <button class="btn btn--auto" type="submit">${copy.submit}</button>
        <p class="form__status" role="status" data-auth-status>${status}</p>
      </form>
      <p class="auth__switch">${copy.switchText} <a href="${routes.signIn({ mode: otherMode === MODES.register ? 'register' : '', next })}">${copy.switchLink}</a></p>
    </div>`;
}

function signedInMarkup(user) {
  return html`
    <div class="wrap auth">
      <div class="page-head">
        <h1>Signed in</h1>
        <p class="section__lede">Signed in as ${user.name} (${user.email}).</p>
      </div>
      <p class="auth__actions">
        <a class="btn btn--auto" href="${routes.projects()}">Open projects</a>
        <button class="btn btn--secondary btn--auto" type="button" data-auth-sign-out>Sign out</button>
      </p>
    </div>`;
}

export function renderSignIn({ session, route, toast }) {
  const user = session.user();
  if (user) {
    const node = el(signedInMarkup(user));
    node.querySelector('[data-auth-sign-out]').addEventListener('click', async () => {
      try {
        await session.signOut();
        toast.show('Signed out.');
        navigate(routes.home());
      } catch (error) {
        toast.show(error.message);
      }
    });
    return node;
  }

  const params = new URLSearchParams(route.query);
  const mode = params.get('mode') === MODES.register ? MODES.register : MODES.signIn;
  const next = params.get('next') || '';
  const node = el(signInMarkup({ mode, next }));
  let busy = false;

  const rerender = (state) => {
    node.replaceChildren(...el(signInMarkup({ mode, next, ...state })).childNodes);
    const firstInvalid = node.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
  };

  node.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = node.querySelector('[data-auth-form]');
    const data = Object.fromEntries(new FormData(form).entries());
    const { errors, values } = mode === MODES.register ? validateRegistration(data) : validateSignIn(data);
    const shown = { ...values, password: '' };
    if (hasErrors(errors)) return rerender({ values: shown, errors });

    busy = true;
    form.querySelector('[data-auth-status]').textContent = mode === MODES.register ? 'Creating the account…' : 'Signing in…';
    try {
      const signedIn = mode === MODES.register ? await session.register(values) : await session.signIn(values);
      toast.show(`Signed in as ${signedIn.name}.`);
      navigate(nextHash(next));
    } catch (error) {
      rerender({ values: shown, errors: error.fields || {}, status: error.message });
    } finally {
      busy = false;
    }
    return undefined;
  });
  return node;
}
