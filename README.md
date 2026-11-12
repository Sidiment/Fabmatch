# Fabmatch site

Reclaimed textiles, ready to specify. A listing site for Fabmatch lots built from the
Fabmatch Interface Handoff 5.0 (`../Fabmatch-Interface-Handoff-5.0`). It follows the
Brand Voice and Interface Guide: Ink, Clay, and Taupe palette, Quicksand and Inter type,
pill controls, 16 px cards, the 12-family color plan, and the microcopy library.

## Run it

Quick start (checks Node, installs packages when needed, starts everything, opens the browser):

```bash
./start.sh
```

| Command | Does |
|---|---|
| `./start.sh` | Development: API and Vite with live reload at http://localhost:5173 |
| `./start.sh serve` | Builds the site and serves it with the API from one server at http://localhost:3001 |
| `WEB_PORT=5174 API_PORT=3005 ./start.sh` | Uses other ports, for example when 5173 is taken |
| `./start.sh --no-open` | Does not open the browser |

The same by hand:

```bash
npm install
npm run dev
```

`npm run dev` starts two processes: the API on port 3001 (restarts when `server/` or `shared/`
changes) and Vite on port 5173, which forwards `/api` to the API. Open http://localhost:5173.

To run it the way it would be deployed, build and start the one Node server, which serves
both the site and the API:

```bash
npm run build
npm start
```

Other scripts: `npm test` (Vitest; jsdom for the site, Node for the server),
`npm run test:coverage` (80 percent thresholds), `npm run preview`.

## Backend

A small Express API in `server/`. There is no database: each collection is a JSON file in the
data directory (`server/.data/` by default, git-ignored). Writes go to a temporary file and are
renamed into place, one at a time, so a crash never leaves half a file. One server process
should own the data directory. All file access goes through the repositories in
`server/repositories/`, so moving to a database later only touches those files.

| File | Holds |
|---|---|
| `lots.json` | Lot records, seeded from `server/data/seed/sample-lots.json` and `redesign-collective-samples.json` on first start. Sample pieces missing from an older `lots.json` are added at start, by ID |
| `users.json` | Accounts: email, name, role, scrypt password hash |
| `sessions.json` | Sign-in sessions: SHA-256 of the cookie token, expiry |
| `projects.json` | One project per account: name, saved lot IDs, workroom messages |
| `contact-messages.json` | About page contact form messages |

Color families are read from `server/data/seed/color-families.json`. Delete the data
directory to start over.

### API

Every response is `{ success, data, error }`; errors carry `error.message` and, for form
input, `error.fields` with one message per field.

| Method and path | Access | Does |
|---|---|---|
| `GET /api/catalog` | Public | Families and lots, loaded by the site at start |
| `GET /api/families`, `GET /api/lots`, `GET /api/lots/:id` | Public | The same data, separately |
| `POST /api/auth/register` | Public | `{ name, email, password, role }`, starts a session |
| `POST /api/auth/login` | Public | `{ email, password }`, starts a session |
| `POST /api/auth/logout` | Any | Ends the session |
| `GET /api/auth/me` | Any | The signed-in account, or `null` |
| `GET /api/project` | Signed in | The account's project |
| `PUT /api/project` | Signed in | `{ name, lotIds }`, replaces both |
| `POST /api/project/messages` | Signed in | Saves an Ask the workroom message |
| `POST /api/contact` | Public | Saves a contact form message |
| `GET /api/health` | Public | Liveness check |

### Authentication

- Email and password. Passwords are hashed with Node's built-in scrypt (no native module).
- The session is a random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` and
  `__Host-` prefixed in production). Only its hash is stored. Sign-in issues a new token.
  Sign-out deletes the session on the server.
- Sign-in failures get one message whether the email or the password was wrong, and an
  unknown email takes as long to check as a known one.
- Cross-site requests: writes must be JSON, and an `Origin` header must be this site or one
  listed in `ALLOWED_ORIGINS`.
- Rate limits per IP: 20 sign-in or sign-up attempts and 10 contact messages per 15 minutes.
  Helmet sets the security headers. Request bodies are capped at 32 KB.
- Roles (guide section 8.1) are stored with the account but do not change access yet; which
  roles sign in during the pilot is open item 8.

Browsing needs no account. Signed out, the project is kept in the browser as before. When an
account signs in, the lots and messages saved on that device move into the account. Signed in,
every change is sent to the server. A change that fails is kept on screen and sent again with
the next change. If the session has expired, the project is kept on the device until the
next sign-in.

### Settings

| Variable | Default | |
|---|---|---|
| `PORT` | `3001` | API port |
| `DATA_DIR` | `server/.data` | Where the JSON files live |
| `SESSION_TTL_HOURS` | `168` | Session length |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Extra origins allowed to write |
| `NODE_ENV` | | `production` turns on Secure cookies |
| `TRUST_PROXY` | | `1` behind a reverse proxy, so rate limits see the client IP |
| `STATIC_DIR` | `dist` | Built site to serve |
| `API_URL` | `http://localhost:3001` | Where Vite forwards `/api` in development |

## What is here

| Page | Route | Content |
|---|---|---|
| Home | `#/` | Tagline, search, the 12 palette families with light, medium, and dark tones, performance quick filters, applications, the eight most recently confirmed lots, how it works |
| Textiles | `#/textiles?…` | Every lot as a card, with product-type chips, a filter rail (fire rating, abrasion, acoustic rating, color family, tone, fiber, pattern, yardage on hand, documentation on file), sort, and removable filter chips. Filters live in the URL so a view can be shared |
| Lot | `#/lots/FM-0101` | Key facts, verified manufacturer and region, characteristics, performance with test method and publisher, documentation on file, products the yardage can support (editable assumptions, Method A or B), estimated diversion placeholder, Ask the workroom form |
| Projects | `#/projects` | Saved lots with remove and undo, project name, saved workroom messages, and a specification export (Markdown download) |
| About | `#/about` | Boilerplate, how a record is built, stage, contact form |

Each lot card carries: square image, product type, lot name with its tone name, the fact line
(fiber, width, yardage), color family and tone, verified manufacturer and region, the ratings on
the manufacturer's sheet, the documentation-on-file tag, the products the yardage supports,
the lot ID with its last-confirmed date, and an Add to project button.

## Structure

```
server/        Express API: config, routes, middleware (session, CSRF, rate limits), repositories, JSON file store
  data/seed/   color families and sample lots from the handoff
shared/        code used by both the server and the site: lot record builder, form validators, roles
src/
  data/        the catalog loaded from the API (families, lots), estimator products and assumptions
  lib/         API client, session (sign-in and project sync), estimator (ES module port of yardage-estimator.js), filters, format, router, project state, store, spec export, textures
  components/  header, footer, lot card, filter rail, estimate table, ask form, palette, tags, toast
  pages/       home, textiles, lot, projects, about, sign in, not found
  styles/      tokens (from 03-Design-Tokens), base, layout, pages
tests/         unit and component tests for every module; tests/server/ runs the API against a temporary data directory
public/brand/  wordmarks and app tile from 04-Logos, viewBox cropped to the letterforms
```

Fonts are self-hosted through `@fontsource/quicksand` and `@fontsource/inter`, as the guide asks.
There is no framework; the pages are plain ES modules rendered from escaped template strings.

## Redesign Collective sample pieces

The 91 fabric samples in `DATASET_FABRIC_SAMPLES.xlsx` (sheet Higher-End Textiles) are lots
`RC-0001` to `RC-0091`, one per spreadsheet row, stored in
`server/data/seed/redesign-collective-samples.json` with their photographs in `public/samples/`
(a 480 px square for cards, up to 1000 px for the lot page). They are real inventory, unlike the
`FM-` sample lots.

- **Counted in pieces.** `kind: "piece"`, with `qty`, `size`, and `remnants` (`[{ w, h, qty }]`).
  The estimator's piece mode cuts each panel whole from a piece; while the direction is not
  recorded, pieces are not turned. The Ask the workroom quantity is in pieces.
- **Blank attributes stay blank.** Fiber, application, color family, pattern, ratings, docs,
  region, and last confirmed are `null` or empty, and the site shows "Not recorded". Every lot
  still needs an ID, name, title, kind, and amount on hand. `missingAttributes(lot)` in
  `shared/catalog.js` lists what a lot lacks; `MISSING-DATA-NOTES.txt` lists it for these samples.
- **Brands are not verified manufacturers.** The brand comes from the sample label and is shown as
  "Brand: X", not "Verified". The home page count of verified manufacturers leaves them out.
- **Filters.** Lot type (Yardage lots, Sample pieces) and Manufacturer or brand. Pieces have no
  yardage, so yardage filters skip them and they sort after every roll.
- **No prices or carbon figures**, as below. The spreadsheet's prices and avoided-emissions
  estimates are not imported; see `MISSING-DATA-NOTES.txt`.

## Decisions taken from the handoff

- **Sample data only.** Manufacturers, lots, ratings, and yardage of the `FM-` lots come from
  `sample-lots.json` and are not real inventory (the `RC-` sample pieces above are). The announcement bar says so on every page. Lot IDs (`FM-0101`…),
  last-confirmed dates, and the "Seattle region" label are sample values added here so the cards
  can carry the fields the guide lists in sections 6.2 and 10.2.
- **Placeholder images.** The `FM-` sample lots have no photographs, so each card draws a woven
  texture in the lot's tone (a neutral one when no color is recorded). `RC-` pieces use their photographs. The manufacturer tile images in `08-Datasets` were not used because the
  README notes their reuse terms were not checked.
- **Light theme only.** Guide section 6.3 says no dark mode in the first release (to confirm).
- **No prices, holds, orders, or carbon figures.** The diversion section states that no figure is
  shown until the method is verified (Research Plan, section 5).
- **Status by icon plus words.** Verified manufacturer, documentation on file, and last confirmed
  are tags with an icon and text, never color alone. Clay Deep carries links and error text;
  primary buttons are Ink.
- **Workroom messages are saved, not delivered.** Ask the workroom saves the message with the
  project (on the account when signed in, on the device otherwise) and says nothing was sent,
  because there is no workroom side yet. Contact form messages are stored on the server until
  the contact route is decided (open item 10).
- **Spec export** writes a Markdown file with each lot's record, documentation list, estimate
  table, and the method sentence.

## Open items this build depends on

From guide section 12: approval of Clay Deep, Muted, and Line (1); status colors (2);
boilerplate wording (3); whether copy may say "you" (4; this build avoids it); GIX wording (7);
sign-in roles (8); contact route (10); link-out permissions for manufacturer pages and
Material Bank (18); estimator allowances and product sizes (19); filter choices and rating
sources (20); tone names and Pantone references (24).
