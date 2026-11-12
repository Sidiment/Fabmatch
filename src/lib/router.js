/** Hash routing: #/ , #/textiles?query , #/lots/:id , #/projects , #/about , #/signin?mode=register&next=projects. */

export function parseHash(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '');
  const [withoutAnchor, anchor = ''] = clean.split('#');
  const [pathPart, query = ''] = withoutAnchor.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const [root = 'home', param = ''] = segments;
  if (root === 'home' || root === '') return { name: 'home', param: '', query, anchor };
  if (root === 'textiles') return { name: 'textiles', param: '', query, anchor };
  if (root === 'lots' && param) {
    const id = safeDecode(param);
    return id === null
      ? { name: 'notFound', param: pathPart, query, anchor }
      : { name: 'lot', param: id, query, anchor };
  }
  if (root === 'projects') return { name: 'projects', param: '', query, anchor };
  if (root === 'about') return { name: 'about', param: '', query, anchor };
  if (root === 'signin') return { name: 'signin', param: '', query, anchor };
  return { name: 'notFound', param: pathPart, query, anchor };
}

/** decodeURIComponent that returns null for malformed input instead of throwing. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export const routes = Object.freeze({
  home: () => '#/',
  textiles: (query = '') => `#/textiles${query ? `?${query}` : ''}`,
  lot: (id, anchor = '') => `#/lots/${encodeURIComponent(id)}${anchor ? `#${anchor}` : ''}`,
  projects: () => '#/projects',
  about: () => '#/about',
  signIn: ({ mode = '', next = '' } = {}) => {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (next) params.set('next', next);
    const query = params.toString();
    return `#/signin${query ? `?${query}` : ''}`;
  },
});

export function navigate(hash) {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = hash;
}
