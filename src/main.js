import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/motion.css';
import { bootstrap } from './bootstrap.js';
import { installStaticApi } from './lib/staticApi.js';

// The GitHub Pages build has no API server; the catalog ships as catalog.json beside the page.
if (import.meta.env.VITE_STATIC_DEMO === '1') installStaticApi(window);

bootstrap(document.getElementById('app'));
